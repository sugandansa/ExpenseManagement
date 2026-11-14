import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from '../admin/admin.constants';
import { AppConfigService } from './app-config.service';
import { UpdateAppUpdateDto } from './dto/update-app-update.dto';

@ApiTags('app-update')
@Controller(['app-update', 'config'])
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Mobile app force-update and version config' })
  get() {
    return this.appConfigService.get();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(...ADMIN_ROLES)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update mobile app force-update and version config' })
  update(@Body() dto: UpdateAppUpdateDto) {
    return this.appConfigService.update(dto);
  }
}
