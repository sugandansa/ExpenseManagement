import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { monthRange, normalizePage, paginateMeta } from '../common/utils/query';
import { CLOSED_CLAIM_STATUSES, OPEN_CLAIM_STATUSES } from './admin.constants';
import { historyStatusWhere, normalizeClaimStatus } from '../common/utils/claim-status';
import { buildClaimTimeline } from '../common/utils/claim-timeline';
import { AdminBudgetService } from './admin-budget.service';
import { AdminClaimsQueryDto, ApproveClaimDto, BulkApproveDto, RejectClaimDto } from './dto/claims.dto';

@Injectable()
export class AdminClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: AdminBudgetService,
  ) {}

  async list(query: AdminClaimsQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    const where: Prisma.ExpenseClaimWhereInput = {};
    if (query.employeeId) where.userId = query.employeeId;
    if (query.month) {
      try {
        const range = monthRange(query.month);
        if (range) where.submissionDate = { gte: range.start, lt: range.end };
      } catch {
        throw new BadRequestException('month must be YYYY-MM');
      }
    }
    if (query.status && query.status !== 'all') {
      if (query.status === 'open') {
        where.approvalStatus = 'pending';
        where.status = { in: [...OPEN_CLAIM_STATUSES] };
      } else if (query.status === 'flagged') {
        where.approvalStatus = 'pending';
        where.OR = [{ status: 'flagged' }, { isOverBudget: true }];
      } else if (query.status === 'closed') {
        // Approved / rejected / paid claims (decision made), including approvalStatus fallback
        where.OR = [
          { status: { in: [...CLOSED_CLAIM_STATUSES] } },
          { approvalStatus: { in: ['approved', 'rejected'] } },
        ];
      } else {
        const statusFilter = historyStatusWhere(query.status);
        if (statusFilter) where.status = statusFilter;
      }
    }
    const [total, rows, open, flagged, closed] = await this.prisma.$transaction([
      this.prisma.expenseClaim.count({ where }),
      this.prisma.expenseClaim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: true, category: true, receipt: true },
      }),
      this.prisma.expenseClaim.count({
        where: { approvalStatus: 'pending', status: { in: [...OPEN_CLAIM_STATUSES] } },
      }),
      this.prisma.expenseClaim.count({
        where: { approvalStatus: 'pending', OR: [{ status: 'flagged' }, { isOverBudget: true }] },
      }),
      this.prisma.expenseClaim.count({
        where: {
          OR: [{ status: { in: [...CLOSED_CLAIM_STATUSES] } }, { approvalStatus: { in: ['approved', 'rejected'] } }],
        },
      }),
    ]);
    return {
      items: rows.map((row) => {
        const amount = toNumber(row.amount);
        const paidAmount = toNumber(row.paidAmount);
        return {
          claimId: row.code,
          employeeId: row.user.id,
          employee: row.user.name,
          role: row.user.department ?? row.user.role,
          amount,
          paidAmount,
          remainingAmount: Number(Math.max(0, amount - paidAmount).toFixed(2)),
          category: row.category?.name ?? 'Other',
          otherCategory: row.otherCategory,
          status: normalizeClaimStatus(row.status),
          approvalStatus: row.approvalStatus,
          paymentStatus: row.paymentStatus,
          isOverBudget: row.isOverBudget,
          submissionDate: row.submissionDate,
          receiptUrl: row.receipt?.fileUrl ?? null,
        };
      }),
      pagination: paginateMeta(page, limit, total),
      summary: { open, flagged, closed },
    };
  }

  async detail(claimId: string) {
    const claim = await this.findClaim(claimId);
    const month = `${claim.submissionDate.getUTCFullYear()}-${String(claim.submissionDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const range = monthRange(month)!;
    const [categoryUsed, roleCap] = await Promise.all([
      this.prisma.expenseClaim.aggregate({
        where: {
          categoryId: claim.categoryId,
          status: { not: 'rejected' },
          submissionDate: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
      }),
      claim.user.roleCapId != null
        ? this.prisma.roleCap.findUnique({ where: { id: claim.user.roleCapId } })
        : claim.user.department
          ? this.prisma.roleCap.findUnique({ where: { role: claim.user.department } })
          : Promise.resolve(null),
    ]);
    const jobRoleName = roleCap?.role ?? claim.user.department ?? claim.user.role;
    return {
      id: claim.code,
      employee: {
        id: claim.user.id,
        name: claim.user.name,
        role: jobRoleName,
        phoneNumber: claim.user.phone,
      },
      amount: toNumber(claim.amount),
      paidAmount: toNumber(claim.paidAmount),
      remainingAmount: Number(Math.max(0, toNumber(claim.amount) - toNumber(claim.paidAmount)).toFixed(2)),
      category: claim.category?.name ?? 'Other',
      subCategory: claim.subCategory?.name ?? null,
      otherCategory: claim.otherCategory,
      note: claim.note,
      receiptUrl: claim.receipt.fileUrl,
      status: normalizeClaimStatus(claim.status),
      approvalStatus: claim.approvalStatus,
      paymentStatus: claim.paymentStatus,
      rejectionReason: claim.rejectionReason,
      budget: { categoryCap: toNumber(claim.category?.monthlyCap), usedAmount: toNumber(categoryUsed._sum.amount) },
      roleCap: { role: roleCap?.role ?? claim.user.department, monthlyCap: roleCap ? toNumber(roleCap.monthlyCap) : 0 },
      timeline: buildClaimTimeline(claim),
    };
  }

  async approve(claimId: string, actorId: number, dto: ApproveClaimDto) {
    const claim = await this.findClaim(claimId);
    this.assertPending(claim);
    const amount = toNumber(claim.amount);
    const approvedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Credit wallet now; claim stays approved until settlement marks it paid
      await tx.expenseClaim.update({
        where: { id: claim.id },
        data: {
          status: 'approved',
          approvalStatus: 'approved',
          paymentStatus: 'pending',
          paidAmount: 0,
          approvedAt,
          approvalComment: dto.comment ?? null,
        },
      });
      await tx.claimEvent.create({
        data: { claimId: claim.id, actorId, status: 'approved', note: dto.comment ?? 'Claim approved' },
      });
      await tx.wallet.upsert({
        where: { userId: claim.userId },
        update: { balance: { increment: amount } },
        create: { userId: claim.userId, balance: amount },
      });
      await tx.walletLedger.create({
        data: { userId: claim.userId, type: 'credit', amount, claimId: claim.id, note: `Approved ${claim.code}` },
      });
    });
    return { claimId: claim.code, status: 'approved', walletCredited: amount, approvedAt };
  }

  async reject(claimId: string, actorId: number, dto: RejectClaimDto) {
    const claim = await this.findClaim(claimId);
    this.assertPending(claim);
    await this.prisma.$transaction([
      this.prisma.expenseClaim.update({
        where: { id: claim.id },
        data: { status: 'rejected', approvalStatus: 'rejected', rejectionReason: dto.reason },
      }),
      this.prisma.claimEvent.create({ data: { claimId: claim.id, actorId, status: 'rejected', note: dto.reason } }),
    ]);
    return { claimId: claim.code, status: 'rejected', rejectionReason: dto.reason };
  }

  async bulkApprove(actorId: number, dto: BulkApproveDto) {
    let approvedCount = 0;
    let approvedAmount = 0;
    const skippedClaimIds: string[] = [];
    for (const claimId of dto.claimIds) {
      const claim = await this.prisma.expenseClaim.findUnique({
        where: { code: claimId },
        include: { user: true, category: true },
      });
      if (!claim || claim.approvalStatus !== 'pending') {
        skippedClaimIds.push(claimId);
        continue;
      }
      const evaluation = await this.budget.evaluateClaim(claim);
      if (claim.isOverBudget || claim.status === 'flagged' || evaluation.flagged) {
        skippedClaimIds.push(claimId);
        continue;
      }
      const result = await this.approve(claimId, actorId, { comment: 'Bulk approve' });
      approvedCount += 1;
      approvedAmount = Number((approvedAmount + result.walletCredited).toFixed(2));
    }
    return { approvedCount, approvedAmount, skippedCount: skippedClaimIds.length, skippedClaimIds };
  }

  private assertPending(claim: { approvalStatus: string; status: string }) {
    if (claim.approvalStatus !== 'pending' || ['approved', 'rejected', 'paid', 'settled'].includes(claim.status))
      throw new ConflictException('Claim is not pending approval');
  }

  private async findClaim(claimId: string) {
    const claim = await this.prisma.expenseClaim.findUnique({
      where: { code: claimId },
      include: {
        user: true,
        category: true,
        subCategory: true,
        receipt: true,
        settlement: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }
}
