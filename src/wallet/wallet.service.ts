import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePage, paginateMeta } from '../common/utils/query';
import { toNumber } from '../common/utils/crypto';
import { OPEN_CLAIM_STATUSES, normalizeEmployeeClaimStatus } from '../common/utils/claim-status';
import { SettlementsQueryDto } from './dto/settlements-query.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(userId: number) {
    const [wallet, pending, approvedWaiting, lastSettlement] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId } }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, status: { in: [...OPEN_CLAIM_STATUSES] } },
        _sum: { amount: true },
      }),
      this.prisma.expenseClaim.aggregate({
        where: { userId, approvalStatus: 'approved', paymentStatus: 'pending' },
        _sum: { amount: true },
      }),
      this.prisma.walletSettlement.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      balance: toNumber(wallet?.balance),
      pendingAmount: toNumber(pending._sum.amount),
      approvedWaitItem: toNumber(approvedWaiting._sum.amount),
      lastTransaction: lastSettlement
        ? {
            settlementId: lastSettlement.code,
            amount: toNumber(lastSettlement.amount),
            paymentMode: lastSettlement.paymentMode,
            status: lastSettlement.status,
            at: lastSettlement.settledAt,
          }
        : null,
    };
  }

  async settlements(userId: number, query: SettlementsQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    const where = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.walletSettlement.count({ where }),
      this.prisma.walletSettlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          claims: {
            include: {
              category: { select: { id: true, name: true } },
              subCategory: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ]);
    return {
      items: rows.map((row) => ({
        settlementId: row.code,
        amount: toNumber(row.amount),
        paymentMode: row.paymentMode,
        reference: row.reference,
        status: row.status,
        settledAt: row.settledAt,
        claims: row.claims.map((claim) => ({
          claimId: claim.code,
          amount: toNumber(claim.amount),
          status: normalizeEmployeeClaimStatus(claim.status),
          approvalStatus: claim.approvalStatus,
          paymentStatus: claim.paymentStatus,
          category: claim.category?.name ?? 'Other',
          categoryId: claim.categoryId ?? 0,
          subCategory: claim.subCategory?.name ?? null,
          subCategoryId: claim.subCategoryId ?? null,
          otherCategory: claim.otherCategory,
          submissionDate: claim.submissionDate,
        })),
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }
}
