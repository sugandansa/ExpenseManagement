import { Workbook } from 'exceljs';
import { AdminReportsController } from './admin-reports.controller';

describe('AdminReportsController', () => {
  it('exports claim approval and settlement details', async () => {
    const prisma = {
      expenseClaim: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'C_1',
            submissionDate: new Date('2026-11-02T00:00:00Z'),
            amount: 150,
            status: 'paid',
            isOverBudget: true,
            user: { name: 'Employee', roleCap: { role: 'Driver' }, department: 'Operations' },
            category: { name: 'Travel' },
            subCategory: { name: 'Taxi' },
            otherCategory: null,
            events: [{ actor: { name: 'Admin' } }],
            approvedAt: new Date('2026-11-03T00:00:00Z'),
            settlement: { paymentMode: 'UPI', reference: 'UTR123' },
          },
        ]),
      },
    };
    const response = { setHeader: jest.fn(), send: jest.fn() };
    const controller = new AdminReportsController(prisma as never);
    await controller.spends({ month: '2026-11' }, response as never);
    const workbook = new Workbook();
    await workbook.xlsx.load(response.send.mock.calls[0][0]);
    const row = workbook.getWorksheet('Report')!.getRow(2);
    expect(row.getCell(1).value).toBe('C_1');
    expect(row.getCell(10).value).toBe('Over budget');
    expect(row.getCell(11).value).toBe('Admin');
    expect(row.getCell(13).value).toBe('UPI');
    expect(row.getCell(14).value).toBe('UTR123');
  });

  it('exports personnel totals and current wallet balance as an Excel workbook', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            name: 'Employee',
            phone: '9876543210',
            department: 'Operations',
            isActive: true,
            monthlyBudget: 1000,
            roleCap: { role: 'Driver', monthlyCap: 1000 },
            wallet: { balance: 150 },
            claims: [
              { amount: 200, approvalStatus: 'approved' },
              { amount: 300, approvalStatus: 'rejected' },
            ],
            settlements: [{ amount: 50 }],
          },
        ]),
      },
    };
    const response = { setHeader: jest.fn(), send: jest.fn() };
    const controller = new AdminReportsController(prisma as never);
    await controller.personnel({ month: '2026-11' }, response as never);
    const workbook = new Workbook();
    await workbook.xlsx.load(response.send.mock.calls[0][0]);
    const sheet = workbook.getWorksheet('Report')!;
    expect(sheet.getRow(1).getCell(1).value).toBe('Employee Name');
    expect((sheet.getRow(2).values as unknown[]).slice(1)).toEqual([
      'Employee',
      '9876543210',
      'Driver',
      'Operations',
      'ACTIVE',
      2,
      1,
      1,
      0,
      1000,
      20,
      150,
      50,
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          claims: {
            where: { submissionDate: { gte: new Date('2026-11-01T00:00:00Z'), lt: new Date('2026-12-01T00:00:00Z') } },
          },
        }),
      }),
    );
  });

  it('rejects invalid months before querying', async () => {
    const controller = new AdminReportsController({} as never);
    await expect(controller.spends({ month: '2026-13' }, {} as never)).rejects.toThrow('month must be YYYY-MM');
  });
});
