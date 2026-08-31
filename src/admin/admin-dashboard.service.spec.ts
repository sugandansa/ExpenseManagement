import { PrismaService } from '../prisma/prisma.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  it('is created', () => expect(new AdminDashboardService({} as PrismaService)).toBeDefined());
});
