import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminClaimsService } from './admin-claims.service';
import { AdminClaimsQueryDto, ApproveClaimDto, BulkApproveDto, RejectClaimDto } from './dto/claims.dto';

@ApiTags('admin-claims') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin/claims')
export class AdminClaimsController {
  constructor(private readonly claims: AdminClaimsService) {}
  @Get() @ApiOperation({ summary: 'Approval queue' })
  list(@Query() query: AdminClaimsQueryDto) { return this.claims.list(query); }
  @Post('bulk-approve') @ApiOperation({ summary: 'Approve in-budget claims; skip flagged ones' })
  bulkApprove(@CurrentUser() user: AuthUser, @Body() dto: BulkApproveDto) { return this.claims.bulkApprove(user.id, dto); }
  @Get(':claimId') @ApiOperation({ summary: 'Claim review detail' })
  detail(@Param('claimId') claimId: string) { return this.claims.detail(claimId); }
  @Patch(':claimId/approve') @ApiOperation({ summary: 'Approve a claim and credit the employee wallet' })
  approve(@CurrentUser() user: AuthUser, @Param('claimId') claimId: string, @Body() dto: ApproveClaimDto) { return this.claims.approve(claimId, user.id, dto); }
  @Patch(':claimId/reject') @ApiOperation({ summary: 'Reject a claim' })
  reject(@CurrentUser() user: AuthUser, @Param('claimId') claimId: string, @Body() dto: RejectClaimDto) { return this.claims.reject(claimId, user.id, dto); }
}
