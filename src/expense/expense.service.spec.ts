import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  it('flags an over-budget submission', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest
          .fn()
          .mockResolvedValue({ code: 'C_5', amount: 60, note: null, otherCategory: null, status: 'flagged' }),
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
      receiptId: 'RC_1',
      amount: 60,
      categoryId: 2,
      subCategoryId: 3,
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('flagged');
    expect(result.isOverBudget).toBe(true);
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'flagged', isOverBudget: true }),
      }),
    );
  });

  it('creates pending claims for in-budget submissions', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 6 }),
        update: jest
          .fn()
          .mockResolvedValue({ code: 'C_6', amount: 20, note: null, otherCategory: null, status: 'pending' }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 2, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
      subCategory: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ monthlyBudget: 100 }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.submit(7, {
      receiptId: 'RC_2',
      amount: 20,
      categoryId: 2,
      subCategoryId: 3,
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('pending');
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', isOverBudget: false }),
      }),
    );
  });

  it('accepts Other category with otherCategory text', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 7 }),
        update: jest.fn().mockResolvedValue({
          code: 'C_7',
          amount: 100,
          note: 'Fbbff',
          otherCategory: 'Other note',
          status: 'pending',
        }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 3, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ monthlyBudget: 5000 }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.submit(7, {
      receiptId: 'RC_21',
      amount: 100,
      categoryId: 0,
      otherCategory: 'Other note',
      note: 'Fbbff',
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('pending');
    expect(result.otherCategory).toBe('Other note');
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: null,
          subCategoryId: null,
          otherCategory: 'Other note',
          status: 'pending',
        }),
      }),
    );
  });

  it('returns category and subcategory budget limits with remaining', async () => {
    const prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            name: 'Office',
            iconCategory: 'office',
            monthlyCap: 30000,
            subCategories: [{ id: 6, name: 'Stationery', monthlyCap: 5000 }],
          },
        ]),
      },
      expenseClaim: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ categoryId: 3, _sum: { amount: 1000 } }])
          .mockResolvedValueOnce([{ subCategoryId: 6, _sum: { amount: 1200 } }]),
      },
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.categories(7, 1000);
    expect(result[0]).toMatchObject({
      id: 3,
      limit: 30000,
      used: 1000,
      remaining: 29000,
      remainingAfter: 28000,
      fitsBudget: true,
    });
    expect(result[0].subCategories[0]).toMatchObject({
      id: 6,
      name: 'Stationery',
      limit: 5000,
      used: 1200,
      remaining: 3800,
      remainingAfter: 2800,
      fitsBudget: true,
    });
  });
});
