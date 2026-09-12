import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  it('flags an over-budget submission against category cap', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 5 }),
        update: jest.fn().mockResolvedValue({
          code: 'C_5',
          amount: 60,
          note: null,
          otherCategory: null,
          categoryId: 2,
          subCategoryId: 3,
          status: 'flagged',
        }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 70 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 2, monthlyCap: 100 }) },
      subCategory: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
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
    expect(result.status).toBe('pending');
    expect(result.isOverBudget).toBe(true);
    expect(result.overBudgetAmount).toBe(30);
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
        update: jest.fn().mockResolvedValue({
          code: 'C_6',
          amount: 20,
          note: null,
          otherCategory: null,
          categoryId: 2,
          subCategoryId: 3,
          status: 'pending',
        }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 2, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 2, monthlyCap: 5000 }) },
      subCategory: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
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
    expect(result.isOverBudget).toBe(false);
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', isOverBudget: false }),
      }),
    );
  });

  it('does not flag against user monthly budget when category still has room', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 31 }),
        update: jest.fn().mockResolvedValue({
          code: 'C_31',
          amount: 100,
          note: null,
          otherCategory: null,
          categoryId: 5,
          subCategoryId: 10,
          status: 'pending',
        }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 48, userId: 101 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        // Cleaning category used only 100 so far; user personal budget may be nearly full
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 100 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 5, monthlyCap: 5000 }) },
      subCategory: { findFirst: jest.fn().mockResolvedValue({ id: 10 }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.submit(101, {
      receiptId: 'RC_48',
      amount: 100,
      categoryId: 5,
      subCategoryId: 10,
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('pending');
    expect(result.isOverBudget).toBe(false);
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
          categoryId: null,
          subCategoryId: null,
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

  it('accepts category-only submissions without subCategoryId', async () => {
    const tx = {
      expenseClaim: {
        create: jest.fn().mockResolvedValue({ id: 8 }),
        update: jest.fn().mockResolvedValue({
          code: 'C_8',
          amount: 100,
          note: null,
          otherCategory: null,
          categoryId: 6,
          subCategoryId: null,
          status: 'pending',
        }),
      },
      claimEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      receipt: { findUnique: jest.fn().mockResolvedValue({ id: 4, userId: 7 }) },
      expenseClaim: {
        findUnique: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 6, monthlyCap: 10000 }) },
      subCategory: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ExpenseService(prisma, {} as StorageService);
    const result = await service.submit(7, {
      receiptId: 'RC_48',
      amount: 100,
      categoryId: 6,
      submissionDate: Math.floor(Date.now() / 1000),
    });
    expect(result.status).toBe('pending');
    expect(result.subCategoryId).toBeNull();
    expect(prisma.subCategory.create).not.toHaveBeenCalled();
    expect(tx.expenseClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 6,
          subCategoryId: null,
          status: 'pending',
        }),
      }),
    );
  });

  it('returns category budget limits; subcategories only expose id and name', async () => {
    const prisma = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            name: 'Office',
            iconCategory: 'office',
            monthlyCap: 30000,
            subCategories: [{ id: 6, name: 'Stationery' }],
          },
        ]),
      },
      expenseClaim: {
        groupBy: jest.fn().mockResolvedValue([{ categoryId: 3, _sum: { amount: 1000 } }]),
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
    expect(result[0].subCategories[0]).toEqual({
      id: 6,
      name: 'Stationery',
    });
    expect(prisma.expenseClaim.groupBy).toHaveBeenCalledTimes(1);
  });
});
