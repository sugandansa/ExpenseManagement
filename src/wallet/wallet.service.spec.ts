import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  it('returns wallet totals', async () => {
    const prisma = {
      wallet: { findUnique: jest.fn().mockResolvedValue({ balance: 100 }) },
      expenseClaim: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 20 } }) },
      walletSettlement: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(new WalletService(prisma).mine(1)).resolves.toMatchObject({ balance: 100, pendingAmount: 20 });
  });

  it('returns settlements with approved claims and category details', async () => {
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([
        1,
        [
          {
            code: 'WS_1',
            amount: 250,
            paymentMode: 'upi',
            reference: 'TXN1',
            status: 'settled',
            settledAt: new Date('2026-09-01T00:00:00Z'),
            claims: [
              {
                code: 'C_10',
                amount: 250,
                status: 'paid',
                approvalStatus: 'approved',
                paymentStatus: 'paid',
                categoryId: 5,
                subCategoryId: 8,
                otherCategory: null,
                submissionDate: new Date('2026-08-20T00:00:00Z'),
                category: { id: 5, name: 'Travel' },
                subCategory: { id: 8, name: 'Cab' },
              },
            ],
          },
        ],
      ]),
      walletSettlement: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    const result = await new WalletService(prisma).settlements(1, { page: 1, limit: 10 });
    expect(result.items[0]).toMatchObject({
      settlementId: 'WS_1',
      amount: 250,
      claims: [
        {
          claimId: 'C_10',
          amount: 250,
          approvalStatus: 'approved',
          category: 'Travel',
          categoryId: 5,
          subCategory: 'Cab',
          subCategoryId: 8,
        },
      ],
    });
  });
});
