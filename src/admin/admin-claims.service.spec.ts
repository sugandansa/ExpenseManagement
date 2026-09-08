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
        code: 'C_15',
        amount: 250,
        otherCategory: null,
        status: 'approved',
        isOverBudget: false,
        submissionDate: new Date('2026-09-04T15:27:12.000Z'),
        user: { id: 101, name: 'Rajesh' },
        category: { name: 'Food' },
        receipt: {
          fileUrl:
            'https://api.schoollift.in/expense-management/uploads/receipts/a96bd104-1ce1-4ed7-b955-035253dad1d5.jpg',
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

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['approved', 'rejected', 'paid', 'settled'] },
        }),
        include: { user: true, category: true, receipt: true },
      }),
    );
    expect(result.items[0]).toMatchObject({
      claimId: 'C_15',
      employee: 'Rajesh',
      receiptUrl:
        'https://api.schoollift.in/expense-management/uploads/receipts/a96bd104-1ce1-4ed7-b955-035253dad1d5.jpg',
    });
  });
});
