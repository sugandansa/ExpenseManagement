import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicCode, toNumber } from '../common/utils/crypto';
import { monthRange, normalizePage, paginateMeta } from '../common/utils/query';
import { paymentStateForAmounts } from '../common/utils/claim-status';
import { CreateSettlementDto, LedgerQueryDto, MarkSettlementDto, SettlementHistoryQueryDto } from './dto/finance.dto';

function paidTimelineNote(
  paymentMethod: string,
  reference: string | null | undefined,
  allocated: number,
  claimAmount: number,
  fullyPaid: boolean,
): string {
  const mode = paymentMethod?.trim() || 'wallet';
  const ref = reference?.trim();
  const via = ref ? `via ${mode} (Ref: ${ref})` : `via ${mode}`;
  if (fullyPaid) return `Paid ${allocated} ${via}`;
  return `Partially paid ${allocated} of ${claimAmount} ${via}`;
}

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async pendingSettlements() {
    const wallets = await this.prisma.wallet.findMany({
      where: { balance: { gt: 0 } },
      include: { user: true },
      orderBy: { balance: 'desc' },
    });
    const items = wallets.map((wallet) => ({
      employeeId: wallet.userId,
      name: wallet.user.name,
      amount: toNumber(wallet.balance),
    }));
    return {
      totalAmount: items.reduce((sum, item) => Number((sum + item.amount).toFixed(2)), 0),
      employeeCount: items.length,
      items,
    };
  }

  async createSettlement(dto: CreateSettlementDto) {
    const employee = await this.prisma.user.findUnique({ where: { id: dto.employeeId }, include: { wallet: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (dto.amount <= 0) throw new BadRequestException('Settlement amount must be greater than 0');
    if (dto.amount > toNumber(employee.wallet?.balance))
      throw new BadRequestException('Settlement amount exceeds wallet due');

    const result = await this.prisma.$transaction(async (tx) => {
      const debited = await tx.wallet.updateMany({
        where: { userId: dto.employeeId, balance: { gte: dto.amount } },
        data: { balance: { decrement: dto.amount } },
      });
      if (!debited.count) throw new BadRequestException('Settlement amount exceeds wallet due');
      const claims = await tx.expenseClaim.findMany({
        where: {
          userId: dto.employeeId,
          approvalStatus: 'approved',
          paymentStatus: { in: ['pending', 'partially_paid'] },
        },
        orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
      });
      const created = await tx.walletSettlement.create({
        data: {
          code: 'pending',
          userId: dto.employeeId,
          amount: new Prisma.Decimal(dto.amount),
          paymentMode: dto.paymentMethod,
          reference: dto.reference,
          notes: dto.notes,
          status: 'paid',
          settledAt: new Date(),
        },
      });
      const code = publicCode('SET', created.id);
      await tx.walletSettlement.update({ where: { id: created.id }, data: { code } });
      await tx.walletLedger.create({
        data: {
          userId: dto.employeeId,
          type: 'debit',
          amount: dto.amount,
          settlementId: created.id,
          note: `Settlement ${code}`,
        },
      });

      let remaining = dto.amount;
      const allocations: Array<{ claimId: string; allocated: number; status: string }> = [];

      for (const claim of claims) {
        if (remaining <= 0.001) break;
        const claimAmount = toNumber(claim.amount);
        const alreadyPaid = toNumber(claim.paidAmount);
        const due = Number((claimAmount - alreadyPaid).toFixed(2));
        if (due <= 0.001) continue;

        const allocated = Number(Math.min(due, remaining).toFixed(2));
        const nextPaid = Number((alreadyPaid + allocated).toFixed(2));
        const state = paymentStateForAmounts(claimAmount, nextPaid);

        await tx.expenseClaim.update({
          where: { id: claim.id },
          data: {
            paidAmount: state.paidAmount,
            paymentStatus: state.paymentStatus,
            status: state.status,
            // Keep latest settlement pointer for audit; partials may span multiple settlements
            settlementId: created.id,
          },
        });
        await tx.claimEvent.create({
          data: {
            claimId: claim.id,
            status: state.status,
            note: paidTimelineNote(
              dto.paymentMethod,
              dto.reference,
              allocated,
              claimAmount,
              state.paymentStatus === 'paid',
            ),
          },
        });

        allocations.push({ claimId: claim.code, allocated, status: state.status });
        remaining = Number((remaining - allocated).toFixed(2));
      }

      if (remaining > 0.001) {
        throw new BadRequestException(
          `Settlement amount could not be fully allocated to open claims (unallocated ${remaining})`,
        );
      }

      return { ...created, code, allocations };
    });

    return {
      success: true,
      message: 'Settlement created successfully',
      data: {
        id: result.code,
        employeeId: dto.employeeId,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        status: 'COMPLETED',
        createdAt: result.createdAt,
      },
      settlementId: result.code,
      employeeId: dto.employeeId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      status: 'paid',
      allocations: result.allocations,
    };
  }

  async history(query: SettlementHistoryQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    const where: Prisma.WalletSettlementWhereInput = {};
    if (query.month) {
      try {
        const range = monthRange(query.month);
        if (range) where.settledAt = { gte: range.start, lt: range.end };
      } catch {
        throw new BadRequestException('month must be YYYY-MM');
      }
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.walletSettlement.count({ where }),
      this.prisma.walletSettlement.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        settlementId: row.code,
        employeeId: row.userId,
        employee: row.user.name,
        amount: toNumber(row.amount),
        paymentMode: row.paymentMode,
        reference: row.reference,
        status: row.status,
        settledAt: row.settledAt,
      })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async ledger(employeeId: number, query: LedgerQueryDto) {
    const employee = await this.prisma.user.findUnique({ where: { id: employeeId }, include: { wallet: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    const where: Prisma.WalletLedgerWhereInput = { userId: employeeId };
    if (query.month) {
      try {
        const range = monthRange(query.month);
        if (range) where.createdAt = { gte: range.start, lt: range.end };
      } catch {
        throw new BadRequestException('month must be YYYY-MM');
      }
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.walletLedger.count({ where }),
      this.prisma.walletLedger.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    ]);
    return {
      employeeId,
      balance: toNumber(employee.wallet?.balance),
      items: rows.map((row) => ({ type: row.type, amount: toNumber(row.amount), note: row.note, at: row.createdAt })),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async markPaid(employeeId: number, dto: MarkSettlementDto) {
    const paidAt = new Date(dto.paidAt);
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Invalid paidAt');
    if (dto.paidAmount <= 0) throw new BadRequestException('paidAmount must be greater than 0');
    const settlement = await this.prisma.$transaction(async (tx) => {
      const debited = await tx.wallet.updateMany({
        where: { userId: employeeId, balance: { gte: dto.paidAmount } },
        data: { balance: { decrement: dto.paidAmount } },
      });
      if (!debited.count) throw new BadRequestException('paidAmount exceeds wallet due');
      const claims = await tx.expenseClaim.findMany({ where: { code: { in: dto.claimIds }, userId: employeeId } });
      if (claims.length !== dto.claimIds.length)
        throw new BadRequestException('One or more claims were not found for this employee');
      if (claims.some((claim) => claim.approvalStatus !== 'approved'))
        throw new BadRequestException('All claims must be approved');
      if (claims.some((claim) => claim.paymentStatus === 'paid'))
        throw new BadRequestException('One or more claims are already fully paid');
      const dueTotal = Number(
        claims
          .reduce((sum, claim) => sum + Math.max(0, toNumber(claim.amount) - toNumber(claim.paidAmount)), 0)
          .toFixed(2),
      );
      if (dto.paidAmount > dueTotal)
        throw new BadRequestException('paidAmount exceeds remaining due on selected claims');
      const created = await tx.walletSettlement.create({
        data: {
          code: 'pending',
          userId: employeeId,
          amount: new Prisma.Decimal(dto.paidAmount),
          paymentMode: dto.paymentMethod,
          reference: dto.reference,
          status: 'paid',
          settledAt: paidAt,
        },
      });
      const code = publicCode('SET', created.id);
      await tx.walletSettlement.update({ where: { id: created.id }, data: { code } });

      let remaining = dto.paidAmount;
      const allocations: Array<{ claimId: string; allocated: number; status: string }> = [];
      for (const claim of claims) {
        if (remaining <= 0.001) break;
        const claimAmount = toNumber(claim.amount);
        const alreadyPaid = toNumber(claim.paidAmount);
        const due = Number((claimAmount - alreadyPaid).toFixed(2));
        if (due <= 0.001) continue;
        const allocated = Number(Math.min(due, remaining).toFixed(2));
        const state = paymentStateForAmounts(claimAmount, alreadyPaid + allocated);
        await tx.expenseClaim.update({
          where: { id: claim.id },
          data: {
            paidAmount: state.paidAmount,
            paymentStatus: state.paymentStatus,
            status: state.status,
            settlementId: created.id,
          },
        });
        await tx.claimEvent.create({
          data: {
            claimId: claim.id,
            status: state.status,
            note: paidTimelineNote(
              dto.paymentMethod,
              dto.reference,
              allocated,
              claimAmount,
              state.paymentStatus === 'paid',
            ),
          },
        });
        allocations.push({ claimId: claim.code, allocated, status: state.status });
        remaining = Number((remaining - allocated).toFixed(2));
      }

      await tx.walletLedger.create({
        data: {
          userId: employeeId,
          type: 'debit',
          amount: dto.paidAmount,
          settlementId: created.id,
          note: `Settlement ${code}`,
        },
      });
      return { code, amount: dto.paidAmount, allocations };
    });
    return {
      settlementId: settlement.code,
      employeeId,
      paidAmount: dto.paidAmount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      status: 'paid',
      paidAt,
      allocations: settlement.allocations,
    };
  }
}
