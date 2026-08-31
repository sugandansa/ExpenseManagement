import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminFinanceService } from './admin-finance.service';
import { CreateSettlementDto, LedgerQueryDto, MarkSettlementDto, SettlementHistoryQueryDto } from './dto/finance.dto';

@ApiTags('admin-settlements') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin/settlements')
export class AdminSettlementsController {
  constructor(private readonly finance: AdminFinanceService) {}
  @Get('pending') @ApiOperation({ summary: 'Wallets waiting to be paid' }) pending() { return this.finance.pendingSettlements(); }
  @Get() @ApiOperation({ summary: 'Settlement history' }) history(@Query() query: SettlementHistoryQueryDto) { return this.finance.history(query); }
  @Post() @ApiOperation({ summary: 'Create a settlement / mark paid' }) create(@Body() dto: CreateSettlementDto) { return this.finance.createSettlement(dto); }
}

@ApiTags('admin-wallets') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin/wallets')
export class AdminWalletsController {
  constructor(private readonly finance: AdminFinanceService) {}
  @Get(':employeeId/ledger') @ApiOperation({ summary: 'Employee wallet ledger' })
  ledger(@Param('employeeId', ParseIntPipe) employeeId: number, @Query() query: LedgerQueryDto) { return this.finance.ledger(employeeId, query); }
  @Patch(':employeeId/settlement') @ApiOperation({ summary: 'Mark selected approved claims as paid' })
  markPaid(@Param('employeeId', ParseIntPipe) employeeId: number, @Body() dto: MarkSettlementDto) { return this.finance.markPaid(employeeId, dto); }
}
