import { PrismaService } from '../prisma/prisma.service';
import { AdminFinanceService } from './admin-finance.service';
import { validate } from 'class-validator';
import { CreateSettlementDto } from './dto/finance.dto';

describe('AdminFinanceService', () => {
  it('rejects invalid paid dates', async () => {
    const service = new AdminFinanceService({} as PrismaService);
    await expect(
      service.markPaid(1, {
        claimIds: ['C_1'],
        paymentMethod: 'UPI',
        paidAmount: 10,
        paidAt: 'invalid',
        reference: 'REF',
      }),
    ).rejects.toThrow('Invalid paidAt');
  });

  it('accepts cash settlements with notes and no reference', async () => {
    const dto = Object.assign(new CreateSettlementDto(), {
      employeeId: 1,
      amount: 1500,
      paymentMethod: 'Cash',
      notes: 'Cash payment',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a concurrent debit that exceeds the remaining wallet balance', async () => {
    const tx = { wallet: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ wallet: { balance: 1500 } }) },
      $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
    };
    const service = new AdminFinanceService(prisma as unknown as PrismaService);
    await expect(service.createSettlement({ employeeId: 1, amount: 1000, paymentMethod: 'Cash' })).rejects.toThrow(
      'Settlement amount exceeds wallet due',
    );
  });
});
