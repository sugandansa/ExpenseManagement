import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminDashboardService } from './admin-dashboard.service';
import { MonthQueryDto } from './dto/month-query.dto';

@ApiTags('admin') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}
  @Get('dashboard') @ApiOperation({ summary: 'Admin dashboard KPIs' })
  getDashboard(@Query() query: MonthQueryDto) { return this.dashboard.dashboard(query.month); }
  @Get('expenses/daily-summary') @ApiOperation({ summary: 'Daily spend summary for a month' })
  dailySummary(@Query() query: MonthQueryDto) { return this.dashboard.dailySummary(query.month); }
  @Get('expenses/category-summary') @ApiOperation({ summary: 'Category spend vs monthly cap' })
  categorySummary(@Query() query: MonthQueryDto) { return this.dashboard.categorySummary(query.month); }
  @Get('employees/expense-summary') @ApiOperation({ summary: 'Per-employee spend, flags, and wallet due' })
  employeeSummary(@Query() query: MonthQueryDto) { return this.dashboard.employeeExpenseSummary(query.month); }
}
