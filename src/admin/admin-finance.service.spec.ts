import { PrismaService } from '../prisma/prisma.service';
import { AdminFinanceService } from './admin-finance.service';

describe('AdminFinanceService', () => {
  it('rejects invalid paid dates', async () => {
    const service = new AdminFinanceService({} as PrismaService);
    await expect(service.markPaid(1, {
      claimIds: ['C_1'], paymentMethod: 'UPI', paidAmount: 10, paidAt: 'invalid', reference: 'REF',
    })).rejects.toThrow('Invalid paidAt');
  });
});
