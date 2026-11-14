import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Workbook } from 'exceljs';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { toNumber } from '../common/utils/crypto';
import { resolveMonth } from '../common/utils/query';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLES } from './admin.constants';
import { MonthQueryDto } from './dto/month-query.dto';

@ApiTags('admin-reports')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly prisma: PrismaService) {}

  private range(month?: string) {
    try {
      return resolveMonth(month);
    } catch {
      throw new BadRequestException('month must be YYYY-MM');
    }
  }

  private async send(response: Response, filename: string, headers: string[], rows: unknown[][]) {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Report');
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => {
      column.width = 22;
    });
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    response.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  }

  @Get('spends')
  async spends(@Query() query: MonthQueryDto, @Res() response: Response) {
    const range = this.range(query.month);
    const claims = await this.prisma.expenseClaim.findMany({
      where: { submissionDate: { gte: range.start, lt: range.end } },
      include: {
        user: { include: { roleCap: true } },
        category: true,
        subCategory: true,
        settlement: true,
        events: { where: { status: 'approved' }, include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { submissionDate: 'asc' },
    });
    const rows = claims.map((claim) => [
      claim.code,
      claim.submissionDate,
      claim.user.name,
      claim.user.roleCap?.role ?? '',
      claim.user.department ?? '',
      claim.category?.name ?? claim.otherCategory ?? 'Other',
      claim.subCategory?.name ?? '',
      toNumber(claim.amount),
      claim.status,
      claim.isOverBudget ? 'Over budget' : '',
      claim.events[0]?.actor?.name ?? '',
      claim.approvedAt ?? '',
      claim.settlement?.paymentMode ?? '',
      claim.settlement?.reference ?? '',
    ]);
    return this.send(
      response,
      `spends-${range.month}`,
      [
        'Claim ID',
        'Date',
        'Employee',
        'Role',
        'Department',
        'Category',
        'Subcategory',
        'Amount',
        'Status',
        'Flags',
        'Approved By',
        'Approved At',
        'Settlement Method',
        'Settlement Reference',
      ],
      rows,
    );
  }

  @Get('personnel')
  async personnel(@Query() query: MonthQueryDto, @Res() response: Response) {
    const range = this.range(query.month);
    const users = await this.prisma.user.findMany({
      where: { role: 'employee' },
      include: {
        roleCap: true,
        wallet: true,
        claims: { where: { submissionDate: { gte: range.start, lt: range.end } } },
        settlements: { where: { settledAt: { gte: range.start, lt: range.end } } },
      },
      orderBy: { name: 'asc' },
    });
    const rows = users.map((user) => {
      const cap = toNumber(user.roleCap?.monthlyCap ?? user.monthlyBudget);
      const used = user.claims
        .filter((claim) => claim.approvalStatus !== 'rejected')
        .reduce((sum, claim) => sum + toNumber(claim.amount), 0);
      return [
        user.name,
        user.phone,
        user.roleCap?.role ?? '',
        user.department ?? '',
        user.isActive ? 'ACTIVE' : 'REVOKED',
        user.claims.length,
        user.claims.filter((claim) => claim.approvalStatus === 'approved').length,
        user.claims.filter((claim) => claim.approvalStatus === 'rejected').length,
        user.claims.filter((claim) => claim.approvalStatus === 'pending').length,
        cap,
        cap ? Number(((used * 100) / cap).toFixed(2)) : 0,
        toNumber(user.wallet?.balance),
        user.settlements.reduce((sum, settlement) => sum + toNumber(settlement.amount), 0),
      ];
    });
    return this.send(
      response,
      `personnel-${range.month}`,
      [
        'Employee Name',
        'Phone',
        'Role',
        'Department',
        'Status',
        'Claims Submitted',
        'Claims Approved',
        'Claims Rejected',
        'Claims Pending',
        'Role Cap',
        'Cap Used %',
        'Wallet Due',
        'Settled Amount',
      ],
      rows,
    );
  }
}
