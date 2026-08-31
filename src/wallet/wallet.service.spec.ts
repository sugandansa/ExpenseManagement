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
});
