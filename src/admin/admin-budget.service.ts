import { Injectable } from '@nestjs/common';
import { Category, ExpenseClaim, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { monthRange } from '../common/utils/query';
import { OPEN_CLAIM_STATUSES } from './admin.constants';

type EvaluatedClaim = ExpenseClaim & { user: User; category: Category };

@Injectable()
export class AdminBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async reevaluateOpenClaims() {
    const claims = await this.prisma.expenseClaim.findMany({
      where: { approvalStatus: 'pending', status: { in: OPEN_CLAIM_STATUSES } },
      include: { user: true, category: true },
    });
    let updated = 0;
    for (const claim of claims) {
      const result = await this.evaluateClaim(claim);
      const nextStatus = result.flagged ? 'flagged' : claim.status === 'flagged' ? 'tagged' : claim.status;
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
    const [categorySpend, userSpend, roleCap] = await Promise.all([
      this.prisma.expenseClaim.aggregate({
        where: { categoryId: claim.categoryId, id: { not: claim.id }, status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { userId: claim.userId, id: { not: claim.id }, status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
        _sum: { amount: true },
      }),
      claim.user.department ? this.prisma.roleCap.findUnique({ where: { role: claim.user.department } }) : Promise.resolve(null),
    ]);
    const categoryCap = toNumber(claim.category.monthlyCap);
    const categoryProjected = toNumber(categorySpend._sum.amount) + amount;
    const userBudget = toNumber(claim.user.monthlyBudget);
    const userProjected = toNumber(userSpend._sum.amount) + amount;
    const roleLimit = roleCap?.isActive ? toNumber(roleCap.monthlyCap) : 0;
    const overCategory = categoryCap > 0 && categoryProjected > categoryCap ? categoryProjected - categoryCap : 0;
    const overUser = userBudget > 0 && userProjected > userBudget ? userProjected - userBudget : 0;
    const overRole = roleLimit > 0 && userProjected > roleLimit ? userProjected - roleLimit : 0;
    const overAmount = Number(Math.max(overCategory, overUser, overRole).toFixed(2));
    return { flagged: overAmount > 0, overAmount };
  }
}
