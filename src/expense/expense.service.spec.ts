import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  it('flags an over-budget submission', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue({ code: 'C_5', amount: 60, note: null, status: 'flagged' }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 70 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      subCategory: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ monthlyBudget: 100 }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.submit(7, {
      receiptId: 'RC_1', amount: 60, categoryId: 2, subCategoryId: 3,
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('flagged');
    expect(result.isOverBudget).toBe(true);
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'flagged', isOverBudget: true }),
    }));
  });
});
