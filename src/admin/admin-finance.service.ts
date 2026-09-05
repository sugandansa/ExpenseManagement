import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { publicCode, toNumber } from '../common/utils/crypto';
import { monthRange, normalizePage, paginateMeta } from '../common/utils/query';
import { CreateSettlementDto, LedgerQueryDto, MarkSettlementDto, SettlementHistoryQueryDto } from './dto/finance.dto';

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
    if (dto.amount > toNumber(employee.wallet?.balance))
      throw new BadRequestException('Settlement amount exceeds wallet due');
    const claims = await this.prisma.expenseClaim.findMany({
      where: { userId: dto.employeeId, approvalStatus: 'approved', paymentStatus: 'pending' },
      orderBy: { approvedAt: 'asc' },
    });
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.walletSettlement.create({
        data: {
          code: 'pending',
          userId: dto.employeeId,
          amount: new Prisma.Decimal(dto.amount),
          paymentMode: dto.paymentMethod,
          reference: dto.reference,
          status: 'paid',
          settledAt: new Date(),
        },
      });
      const code = publicCode('SET', created.id);
      await tx.walletSettlement.update({ where: { id: created.id }, data: { code } });
      await tx.wallet.update({ where: { userId: dto.employeeId }, data: { balance: { decrement: dto.amount } } });
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
      for (const claim of claims) {
        if (remaining <= 0) break;
        const claimAmount = toNumber(claim.amount);
        if (claimAmount <= remaining + 0.001) {
          await tx.expenseClaim.update({
            where: { id: claim.id },
            data: { paymentStatus: 'paid', status: 'paid', settlementId: created.id },
          });
          remaining = Number((remaining - claimAmount).toFixed(2));
        }
      }
      return { ...created, code };
    });
    return {
      settlementId: result.code,
      employeeId: dto.employeeId,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      status: 'paid',
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
    const claims = await this.prisma.expenseClaim.findMany({
      where: { code: { in: dto.claimIds }, userId: employeeId },
    });
    if (claims.length !== dto.claimIds.length)
      throw new BadRequestException('One or more claims were not found for this employee');
    if (claims.some((claim) => claim.approvalStatus !== 'approved' || claim.paymentStatus === 'paid'))
      throw new BadRequestException('All claims must be approved and unpaid');
    const total = Number(claims.reduce((sum, claim) => sum + toNumber(claim.amount), 0).toFixed(2));
    if (Math.abs(total - dto.paidAmount) > 0.01)
      throw new BadRequestException('paidAmount must match the selected claim total');
    const settlement = await this.prisma.$transaction(async (tx) => {
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
      await tx.expenseClaim.updateMany({
        where: { id: { in: claims.map((claim) => claim.id) } },
        data: { paymentStatus: 'paid', status: 'paid', settlementId: created.id },
      });
      await tx.wallet.upsert({
        where: { userId: employeeId },
        update: { balance: { decrement: dto.paidAmount } },
        create: { userId: employeeId, balance: 0 },
      });
      await tx.walletLedger.create({
        data: {
          userId: employeeId,
          type: 'debit',
          amount: dto.paidAmount,
          settlementId: created.id,
          note: `Settlement ${code}`,
        },
      });
      return { code, amount: dto.paidAmount };
    });
    return {
      settlementId: settlement.code,
      employeeId,
      paidAmount: dto.paidAmount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference,
      status: 'paid',
      paidAt,
    };
  }
}
