import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { SettlementsQueryDto } from './dto/settlements-query.dto';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('settlements') @ApiOperation({ summary: 'Paginated wallet settlement history' })
  settlements(@CurrentUser() user: AuthUser, @Query() query: SettlementsQueryDto) {
    return this.walletService.settlements(user.id, query);
  }

  @Get() @ApiOperation({ summary: 'Current wallet balance and pending amounts' })
  mine(@CurrentUser() user: AuthUser) { return this.walletService.mine(user.id); }
}
