import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { monthRange, normalizePage, paginateMeta } from '../common/utils/query';
import { publicCode, toNumber } from '../common/utils/crypto';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async categories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true }, orderBy: { id: 'asc' },
      include: { subCategories: { where: { isActive: true }, orderBy: { id: 'asc' }, select: { id: true, name: true } } },
    });
    return rows.map((category) => ({ id: category.id, name: category.name, iconCategory: category.iconCategory, subCategories: category.subCategories }));
  }

  async uploadReceipt(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Receipt file is required');
    if (!ALLOWED_MIME.has(file.mimetype)) throw new BadRequestException('Only JPEG, PNG, WEBP, or PDF receipts are allowed');
    if (file.size > MAX_FILE_BYTES) throw new BadRequestException('Receipt must be 5MB or smaller');
    const saved = await this.storage.saveReceipt(file);
    const receipt = await this.prisma.receipt.create({ data: {
      code: 'pending', userId, fileName: saved.fileName, mimeType: file.mimetype,
      sizeBytes: file.size, fileUrl: saved.fileUrl, ocrStatus: 'queued',
    } });
    const code = publicCode('RC', receipt.id);
    await this.prisma.receipt.update({ where: { id: receipt.id }, data: { code } });
    return { receipt_id: code, url: saved.fileUrl };
  }

  async submit(userId: number, dto: SubmitExpenseDto) {
    const receipt = await this.prisma.receipt.findUnique({ where: { code: dto.receiptId } });
    if (!receipt || receipt.userId !== userId) throw new NotFoundException('Receipt not found');
    if (await this.prisma.expenseClaim.findUnique({ where: { receiptId: receipt.id } })) throw new ConflictException('This receipt is already attached to a claim');
    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true } });
    if (!category) throw new BadRequestException('Invalid category');
    const subCategory = await this.prisma.subCategory.findFirst({ where: { id: dto.subCategoryId, categoryId: dto.categoryId, isActive: true } });
    if (!subCategory) throw new BadRequestException('Invalid sub-category for the selected category');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const approved = await this.prisma.expenseClaim.aggregate({
      where: { userId, approvalStatus: 'approved', submissionDate: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true },
    });
    const spent = toNumber(approved._sum.amount);
    const budget = user?.monthlyBudget ? toNumber(user.monthlyBudget) : 0;
    const projected = spent + dto.amount;
    const isOverBudget = budget > 0 && projected > budget;
    const overBudgetAmount = isOverBudget ? Number((projected - budget).toFixed(2)) : 0;
    const submissionDate = new Date(dto.submissionDate * 1000);
    if (Number.isNaN(submissionDate.getTime())) throw new BadRequestException('Invalid submissionDate');
    const claim = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expenseClaim.create({ data: {
        code: 'pending', userId, receiptId: receipt.id, amount: new Prisma.Decimal(dto.amount),
        categoryId: dto.categoryId, subCategoryId: dto.subCategoryId, note: dto.note,
        submissionDate, status: isOverBudget ? 'flagged' : 'tagged', approvalStatus: 'pending',
        paymentStatus: 'pending', isOverBudget, overBudgetAmount,
      } });
      const code = publicCode('C', created.id);
      const updated = await tx.expenseClaim.update({ where: { id: created.id }, data: { code } });
      await tx.claimEvent.create({ data: {
        claimId: created.id, actorId: userId, status: isOverBudget ? 'flagged' : 'tagged',
        note: isOverBudget ? 'Expense submitted over budget' : 'Expense submitted',
      } });
      return updated;
    });
    return {
      claimId: claim.code, amount: toNumber(claim.amount), note: claim.note, status: claim.status,
      isOverBudget, overBudgetAmount,
      overBudgetReason: isOverBudget ? `This claim exceeds the monthly budget by ${overBudgetAmount}` : null,
    };
  }

  async history(userId: number, query: HistoryQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    let range: { start: Date; end: Date } | null;
    try { range = monthRange(query.month); } catch { throw new BadRequestException('month must be YYYY-MM'); }
    const where: Prisma.ExpenseClaimWhereInput = { userId };
    if (query.status && query.status !== 'all') where.status = query.status;
    if (range) where.submissionDate = { gte: range.start, lt: range.end };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.expenseClaim.count({ where }),
      this.prisma.expenseClaim.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { category: true } }),
    ]);
    return {
      items: rows.map((row) => ({ claimId: row.code, amount: toNumber(row.amount), category: row.category.name, status: row.status, submissionDate: row.submissionDate, isOverBudget: row.isOverBudget })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async detail(userId: number, claimId: string) {
    const claim = await this.findOwned(userId, claimId);
    return {
      claimId: claim.code, amount: toNumber(claim.amount), category: claim.category.name,
      subCategory: claim.subCategory.name, note: claim.note, status: claim.status,
      approvalStatus: claim.approvalStatus, paymentStatus: claim.paymentStatus,
      rejectionReason: claim.rejectionReason, receiptUrl: claim.receipt.fileUrl,
      isOverBudget: claim.isOverBudget, overBudgetAmount: toNumber(claim.overBudgetAmount),
      submissionDate: claim.submissionDate,
      timeline: claim.events.map((event) => ({ status: event.status, note: event.note, at: event.createdAt })),
    };
  }

  async claimStatus(userId: number, claimId: string) {
    const claim = await this.findOwned(userId, claimId);
    return {
      claimId: claim.code, status: claim.status, approvalStatus: claim.approvalStatus,
      paymentStatus: claim.paymentStatus,
      history: claim.events.map((event) => ({ status: event.status, note: event.note, at: event.createdAt })),
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
