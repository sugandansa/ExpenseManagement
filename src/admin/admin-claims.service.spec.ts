import { PrismaService } from '../prisma/prisma.service';
import { AdminBudgetService } from './admin-budget.service';
import { AdminClaimsService } from './admin-claims.service';

describe('AdminClaimsService', () => {
  it('is created', () => {
    expect(new AdminClaimsService({} as PrismaService, {} as AdminBudgetService)).toBeDefined();
  });
});
