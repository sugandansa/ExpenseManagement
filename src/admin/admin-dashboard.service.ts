import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { resolveMonth } from '../common/utils/query';
import { OPEN_CLAIM_STATUSES } from './admin.constants';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(month?: string) {
    const range = this.month(month);
    const notRejected: Prisma.ExpenseClaimWhereInput = {
      status: { not: 'rejected' },
      submissionDate: { gte: range.start, lt: range.end },
    };
    const [spent, committed, pending, flagged, wallets, categoryCaps] = await Promise.all([
      this.prisma.expenseClaim.aggregate({
        where: { ...notRejected, approvalStatus: 'approved' },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.aggregate({ where: notRejected, _sum: { amount: true } }),
      this.prisma.expenseClaim.aggregate({
        where: { approvalStatus: 'pending', status: { in: [...OPEN_CLAIM_STATUSES] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.count({
        where: { approvalStatus: 'pending', OR: [{ status: 'flagged' }, { isOverBudget: true }] },
      }),
      this.prisma.wallet.aggregate({ _sum: { balance: true } }),
      this.prisma.category.aggregate({ _sum: { monthlyCap: true } }),
    ]);
    return {
      spentThisMonth: toNumber(spent._sum.amount),
      budgetCommitted: toNumber(committed._sum.amount),
      budgetTotal: toNumber(categoryCaps._sum.monthlyCap),
      pendingClaimsCount: pending._count._all,
      pendingClaimsAmount: toNumber(pending._sum.amount),
      flaggedClaimsCount: flagged,
      walletsToSettle: toNumber(wallets._sum.balance),
    };
  }

  async dailySummary(month?: string) {
    const range = this.month(month);
    const claims = await this.prisma.expenseClaim.findMany({
      where: { status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
      select: { submissionDate: true, amount: true },
    });
    const buckets = new Map<string, { date: string; claimCount: number; amount: number }>();
    for (const claim of claims) {
      const date = claim.submissionDate.toISOString().slice(0, 10);
      const current = buckets.get(date) ?? { date, claimCount: 0, amount: 0 };
      current.claimCount += 1;
      current.amount = Number((current.amount + toNumber(claim.amount)).toFixed(2));
      buckets.set(date, current);
    }
    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async categorySummary(month?: string) {
    const range = this.month(month);
    const categories = await this.prisma.category.findMany({ orderBy: { id: 'asc' } });
    const committed = await this.prisma.expenseClaim.groupBy({
      by: ['categoryId'],
      where: { status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
    });
    const committedMap = new Map(committed.map((row) => [row.categoryId, toNumber(row._sum.amount)]));
    return categories.map((category) => {
      const committedAmount = committedMap.get(category.id) ?? 0;
      const monthlyCap = toNumber(category.monthlyCap);
      return {
        categoryId: category.id,
        category: category.name,
        committedAmount,
        monthlyCap,
        percentage: monthlyCap > 0 ? Number(((committedAmount / monthlyCap) * 100).toFixed(1)) : 0,
      };
    });
  }

  async employeeExpenseSummary(month?: string) {
    const range = this.month(month);
    const employees = await this.prisma.user.findMany({
      where: { role: 'employee' },
      include: { wallet: true },
      orderBy: { id: 'asc' },
    });
    const roleCaps = await this.prisma.roleCap.findMany();
    const capByRole = new Map(roleCaps.map((row) => [row.role, toNumber(row.monthlyCap)]));
    const claims = await this.prisma.expenseClaim.findMany({
      where: { submissionDate: { gte: range.start, lt: range.end }, user: { role: 'employee' } },
      select: { userId: true, amount: true, status: true, isOverBudget: true },
    });
    const byUser = new Map<number, { claimCount: number; flaggedCount: number; totalSpend: number }>();
    for (const claim of claims) {
      const current = byUser.get(claim.userId) ?? { claimCount: 0, flaggedCount: 0, totalSpend: 0 };
      current.claimCount += 1;
      if (claim.status === 'flagged' || claim.isOverBudget) current.flaggedCount += 1;
      if (claim.status !== 'rejected')
        current.totalSpend = Number((current.totalSpend + toNumber(claim.amount)).toFixed(2));
      byUser.set(claim.userId, current);
    }
    return employees.map((employee) => {
      const stats = byUser.get(employee.id) ?? { claimCount: 0, flaggedCount: 0, totalSpend: 0 };
      return {
        employeeId: employee.id,
        name: employee.name,
        role: employee.department ?? employee.role,
        claimCount: stats.claimCount,
        flaggedCount: stats.flaggedCount,
        totalSpend: stats.totalSpend,
        roleCap: employee.department ? (capByRole.get(employee.department) ?? 0) : 0,
        walletDue: toNumber(employee.wallet?.balance),
      };
    });
  }

  private month(month?: string) {
    try {
      return resolveMonth(month);
    } catch {
      throw new BadRequestException('month must be YYYY-MM');
    }
  }
}
