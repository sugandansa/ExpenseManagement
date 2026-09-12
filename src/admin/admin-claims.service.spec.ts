import { PrismaService } from '../prisma/prisma.service';
import { AdminBudgetService } from './admin-budget.service';
import { AdminClaimsService } from './admin-claims.service';

describe('AdminClaimsService', () => {
  it('is created', () => {
    expect(new AdminClaimsService({} as PrismaService, {} as AdminBudgetService)).toBeDefined();
  });

  it('lists claims with receiptUrl and filters status=closed', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        code: 'C_9',
        amount: 60,
        paidAmount: 0,
        otherCategory: null,
        status: 'approved',
        approvalStatus: 'approved',
        paymentStatus: 'pending',
        isOverBudget: false,
        submissionDate: new Date('2026-09-04T14:01:52.000Z'),
        user: { id: 101, name: 'Rajesh', department: 'Housekeeping', role: 'employee' },
        category: { name: 'Travel' },
        receipt: {
          fileUrl:
            'https://api.schoollift.in/expense-management/uploads/receipts/da5ca1e2-c237-4371-acf4-d891e30dc7f1.jpg',
        },
      },
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
      expenseClaim: { count, findMany },
    } as unknown as PrismaService;

    const result = await new AdminClaimsService(prisma, {} as AdminBudgetService).list({
      status: 'closed',
      month: '2026-09',
      page: 1,
      limit: 20,
    });

    expect(result.items[0]).toMatchObject({
      claimId: 'C_9',
      employee: 'Rajesh',
      role: 'Housekeeping',
      amount: 60,
      paidAmount: 0,
      remainingAmount: 60,
      status: 'approved',
      paymentStatus: 'pending',
      receiptUrl:
        'https://api.schoollift.in/expense-management/uploads/receipts/da5ca1e2-c237-4371-acf4-d891e30dc7f1.jpg',
    });
    expect(result.summary).toEqual(expect.objectContaining({ open: 1, flagged: 1, closed: 1 }));
  });
});
