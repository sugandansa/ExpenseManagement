import { Injectable } from '@nestjs/common';
import { Category, ExpenseClaim, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { monthRange } from '../common/utils/query';
import { OPEN_CLAIM_STATUSES } from './admin.constants';

type EvaluatedClaim = ExpenseClaim & { user: User; category: Category | null };

@Injectable()
export class AdminBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async reevaluateOpenClaims() {
    const claims = await this.prisma.expenseClaim.findMany({
      where: { approvalStatus: 'pending', status: { in: [...OPEN_CLAIM_STATUSES] } },
      include: { user: true, category: true },
    });
    let updated = 0;
    for (const claim of claims) {
      const result = await this.evaluateClaim(claim);
      const nextStatus = result.flagged ? 'flagged' : claim.status === 'flagged' ? 'pending' : claim.status;
      if (result.flagged !== claim.isOverBudget || nextStatus !== claim.status) {
        await this.prisma.expenseClaim.update({
          where: { id: claim.id },
          data: { isOverBudget: result.flagged, overBudgetAmount: result.overAmount, status: nextStatus },
        });
        updated += 1;
      }
    }
    return updated;
  }

  async evaluateClaim(claim: EvaluatedClaim) {
    const month = `${claim.submissionDate.getUTCFullYear()}-${String(claim.submissionDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const range = monthRange(month)!;
    const amount = toNumber(claim.amount);

    // Catalog categories: flag against the employee's per-category monthly cap (same as categories API).
    if (claim.categoryId != null) {
      const categorySpend = await this.prisma.expenseClaim.aggregate({
        where: {
          userId: claim.userId,
          categoryId: claim.categoryId,
          id: { not: claim.id },
          status: { not: 'rejected' },
          submissionDate: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
      });
      const categoryCap = claim.category ? toNumber(claim.category.monthlyCap) : 0;
      const categoryProjected = toNumber(categorySpend._sum.amount) + amount;
      const overCategory =
        categoryCap > 0 && categoryProjected > categoryCap ? Number((categoryProjected - categoryCap).toFixed(2)) : 0;
      return { flagged: overCategory > 0, overAmount: overCategory };
    }

    // Free-text "Other": fall back to the employee's personal monthly budget.
    const userSpend = await this.prisma.expenseClaim.aggregate({
      where: {
        userId: claim.userId,
        id: { not: claim.id },
        status: { not: 'rejected' },
        submissionDate: { gte: range.start, lt: range.end },
      },
      _sum: { amount: true },
    });
    const userBudget = toNumber(claim.user.monthlyBudget);
    const userProjected = toNumber(userSpend._sum.amount) + amount;
    const overUser = userBudget > 0 && userProjected > userBudget ? Number((userProjected - userBudget).toFixed(2)) : 0;
    return { flagged: overUser > 0, overAmount: overUser };
  }
}
