import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminAccountsService } from './admin-accounts.service';
import { CreateAdminAccountDto } from './dto/admin-accounts.dto';

@ApiTags('admin-accounts')
@ApiBearerAuth()
@Roles('owner')
@UseGuards(RolesGuard)
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an admin or owner account (owner only)' })
  create(@Body() dto: CreateAdminAccountDto) {
    return this.accounts.create(dto);
  }
}
