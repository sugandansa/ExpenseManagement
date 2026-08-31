import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';

@ApiTags('config')
@ApiBearerAuth()
@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}
  @Get() @ApiOperation({ summary: 'Mobile app force-update and version config' })
  get() { return this.appConfigService.get(); }
}
