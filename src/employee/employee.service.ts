import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { monthRange } from '../common/utils/query';
import { toNumber } from '../common/utils/crypto';
import { OPEN_CLAIM_STATUSES, normalizeClaimStatus } from '../common/utils/claim-status';

const OTHER_CATEGORY_ID = 0;

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(userId: number, month?: string) {
    let range: { start: Date; end: Date } | null = null;
    try {
      range = monthRange(month);
    } catch {
      throw new BadRequestException('month must be YYYY-MM');
    }

    const monthFilter: Prisma.ExpenseClaimWhereInput = range
      ? { submissionDate: { gte: range.start, lt: range.end } }
      : {};

    const pendingStatuses = OPEN_CLAIM_STATUSES.filter((status) => status !== 'flagged');

    const [wallet, pending, paid, monthClaims, monthApproved, recentClaims] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, status: { in: [...pendingStatuses] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, OR: [{ paymentStatus: 'paid' }, { status: { in: ['paid', 'settled'] } }] },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, ...monthFilter },
        _count: { _all: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, ...monthFilter, approvalStatus: 'approved' },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          code: true,
          amount: true,
          status: true,
          submissionDate: true,
          categoryId: true,
          subCategoryId: true,
          otherCategory: true,
          category: { select: { name: true } },
          subCategory: { select: { name: true } },
        },
      }),
    ]);

    return {
      walletBalance: toNumber(wallet?.balance),
      pendingCount: pending._count._all,
      pendingAmount: toNumber(pending._sum.amount),
      paidCount: paid._count._all,
      paidTotal: toNumber(paid._sum.amount),
      claimCount: monthClaims._count._all,
      approvedThisMonth: toNumber(monthApproved._sum.amount),
      recentClaims: recentClaims.map((claim) => ({
        claimId: claim.code,
        amount: toNumber(claim.amount),
        status: normalizeClaimStatus(claim.status),
        date: claim.submissionDate,
        category: claim.category?.name ?? 'Other',
        categoryId: claim.categoryId ?? OTHER_CATEGORY_ID,
        subCategory: claim.subCategory?.name ?? null,
        subCategoryId: claim.subCategoryId ?? null,
        otherCategory: claim.otherCategory,
      })),
    };
  }
}
