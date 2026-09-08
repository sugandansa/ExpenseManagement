import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { currentMonth, monthRange, normalizePage, paginateMeta } from '../common/utils/query';
import { publicCode, toNumber } from '../common/utils/crypto';
import { historyStatusWhere, normalizeEmployeeClaimStatus } from '../common/utils/claim-status';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const OTHER_CATEGORY_ID = 0;

function budgetFields(limit: number, used: number, amount?: number) {
  const remaining = Number(Math.max(0, limit - used).toFixed(2));
  const base = { limit, used, remaining };
  if (amount == null) return base;
  const remainingAfter = Number((remaining - amount).toFixed(2));
  return {
    ...base,
    remainingAfter,
    fitsBudget: limit <= 0 ? true : remainingAfter >= 0,
  };
}

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async categories(userId: number, amount?: number) {
    const range = monthRange(currentMonth())!;
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      include: {
        subCategories: {
          where: { isActive: true },
          orderBy: { id: 'asc' },
          select: { id: true, name: true },
        },
      },
    });

    const categoryUsage = await this.prisma.expenseClaim.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        status: { not: 'rejected' },
        categoryId: { not: null },
        submissionDate: { gte: range.start, lt: range.end },
      },
      _sum: { amount: true },
    });

    const categoryUsed = new Map(categoryUsage.map((row) => [row.categoryId!, toNumber(row._sum.amount)]));

    const catalog = rows.map((category) => {
      const limit = toNumber(category.monthlyCap);
      const used = categoryUsed.get(category.id) ?? 0;
      return {
        id: category.id,
        name: category.name,
        iconCategory: category.iconCategory,
        ...budgetFields(limit, used, amount),
        // Sub-categories have no budget limits — return id/name only
        subCategories: category.subCategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
        })),
      };
    });

    catalog.push({
      id: OTHER_CATEGORY_ID,
      name: 'Other',
      iconCategory: 'other',
      ...budgetFields(0, 0, amount),
      subCategories: [],
    });
    return catalog;
  }

  async uploadReceipt(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Receipt file is required');
    if (!ALLOWED_MIME.has(file.mimetype))
      throw new BadRequestException('Only JPEG, PNG, WEBP, or PDF receipts are allowed');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Receipt must be 5MB or smaller');
    const saved = await this.storage.saveReceipt(file);
    const receipt = await this.prisma.receipt.create({
      data: {
        code: 'pending',
        userId,
        fileName: saved.fileName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        fileUrl: saved.fileUrl,
        ocrStatus: 'queued',
      },
    });
    const code = publicCode('RC', receipt.id);
    await this.prisma.receipt.update({ where: { id: receipt.id }, data: { code } });
    return { receipt_id: code, url: saved.fileUrl };
  }

  async submit(userId: number, dto: SubmitExpenseDto) {
    const receipt = await this.prisma.receipt.findUnique({ where: { code: dto.receiptId } });
    if (!receipt || receipt.userId !== userId) throw new NotFoundException('Receipt not found');
    if (await this.prisma.expenseClaim.findUnique({ where: { receiptId: receipt.id } })) {
      throw new ConflictException('This receipt is already attached to a claim');
    }

    const isOther = dto.categoryId === OTHER_CATEGORY_ID;
    let categoryId: number | null = null;
    let subCategoryId: number | null = null;
    let otherCategory: string | null = null;

    if (isOther) {
      const label = dto.otherCategory?.trim();
      if (!label) throw new BadRequestException('otherCategory is required when categoryId is 0 (Other)');
      otherCategory = label;
    } else {
      const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true } });
      if (!category) throw new BadRequestException('Invalid category');
      categoryId = dto.categoryId;
      if (dto.subCategoryId != null) {
        const subCategory = await this.prisma.subCategory.findFirst({
          where: { id: dto.subCategoryId, categoryId: dto.categoryId, isActive: true },
        });
        if (!subCategory) throw new BadRequestException('Invalid sub-category for the selected category');
        subCategoryId = dto.subCategoryId;
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const approved = await this.prisma.expenseClaim.aggregate({
      where: { userId, approvalStatus: 'approved', submissionDate: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    });
    const spent = toNumber(approved._sum.amount);
    const budget = user?.monthlyBudget ? toNumber(user.monthlyBudget) : 0;
    const projected = spent + dto.amount;
    const isOverBudget = budget > 0 && projected > budget;
    const overBudgetAmount = isOverBudget ? Number((projected - budget).toFixed(2)) : 0;
    const submissionDate = new Date(dto.submissionDate * 1000);
    if (Number.isNaN(submissionDate.getTime())) throw new BadRequestException('Invalid submissionDate');

    const status = isOverBudget ? 'flagged' : 'pending';
    const claim = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expenseClaim.create({
        data: {
          code: 'pending',
          userId,
          receiptId: receipt.id,
          amount: new Prisma.Decimal(dto.amount),
          categoryId,
          subCategoryId,
          otherCategory,
          note: dto.note,
          submissionDate,
          status,
          approvalStatus: 'pending',
          paymentStatus: 'pending',
          isOverBudget,
          overBudgetAmount,
        },
      });
      const code = publicCode('C', created.id);
      const updated = await tx.expenseClaim.update({ where: { id: created.id }, data: { code } });
      await tx.claimEvent.create({
        data: {
          claimId: created.id,
          actorId: userId,
          status,
          note: isOverBudget ? 'Expense submitted over budget' : 'Expense submitted',
        },
      });
      return updated;
    });
    return {
      claimId: claim.code,
      amount: toNumber(claim.amount),
      note: claim.note,
      otherCategory: claim.otherCategory,
      status: normalizeEmployeeClaimStatus(claim.status),
      isOverBudget,
      overBudgetAmount,
      overBudgetReason: isOverBudget ? `This claim exceeds the monthly budget by ${overBudgetAmount}` : null,
    };
  }

  async history(userId: number, query: HistoryQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    let range: { start: Date; end: Date } | null;
    try {
      range = monthRange(query.month);
    } catch {
      throw new BadRequestException('month must be YYYY-MM');
    }
    const where: Prisma.ExpenseClaimWhereInput = { userId };
    const statusFilter = historyStatusWhere(query.status);
    if (statusFilter) where.status = statusFilter;
    if (range) where.submissionDate = { gte: range.start, lt: range.end };
    if (query.categoryId === OTHER_CATEGORY_ID) {
      where.categoryId = null;
      where.otherCategory = { not: null };
    } else if (query.categoryId != null) {
      where.categoryId = query.categoryId;
    }
    if (query.subCategoryId != null) where.subCategoryId = query.subCategoryId;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expenseClaim.count({ where }),
      this.prisma.expenseClaim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { category: true, subCategory: true },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        claimId: row.code,
        amount: toNumber(row.amount),
        category: row.category?.name ?? 'Other',
        categoryId: row.categoryId ?? OTHER_CATEGORY_ID,
        subCategory: row.subCategory?.name ?? null,
        subCategoryId: row.subCategoryId ?? null,
        otherCategory: row.otherCategory,
        status: normalizeEmployeeClaimStatus(row.status),
        submissionDate: row.submissionDate,
        isOverBudget: row.isOverBudget,
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async detail(userId: number, claimId: string) {
    const claim = await this.findOwned(userId, claimId);
    return {
      claimId: claim.code,
      amount: toNumber(claim.amount),
      category: claim.category?.name ?? 'Other',
      categoryId: claim.categoryId ?? OTHER_CATEGORY_ID,
      subCategory: claim.subCategory?.name ?? null,
      subCategoryId: claim.subCategoryId ?? null,
      otherCategory: claim.otherCategory,
      note: claim.note,
      status: normalizeEmployeeClaimStatus(claim.status),
      approvalStatus: claim.approvalStatus,
      paymentStatus: claim.paymentStatus,
      rejectionReason: claim.rejectionReason,
      receiptUrl: claim.receipt.fileUrl,
      isOverBudget: claim.isOverBudget,
      overBudgetAmount: toNumber(claim.overBudgetAmount),
      submissionDate: claim.submissionDate,
      timeline: claim.events.map((event) => ({
        status: normalizeEmployeeClaimStatus(event.status),
        note: event.note,
        at: event.createdAt,
      })),
    };
  }

  async claimStatus(userId: number, claimId: string) {
    const claim = await this.findOwned(userId, claimId);
    return {
      claimId: claim.code,
      status: normalizeEmployeeClaimStatus(claim.status),
      approvalStatus: claim.approvalStatus,
      paymentStatus: claim.paymentStatus,
      history: claim.events.map((event) => ({
        status: normalizeEmployeeClaimStatus(event.status),
        note: event.note,
        at: event.createdAt,
      })),
    };
  }

  private async findOwned(userId: number, claimId: string) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { code: claimId },
      include: { category: true, subCategory: true, receipt: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!claim || claim.userId !== userId) throw new NotFoundException('Claim not found');
    return claim;
  }
}
