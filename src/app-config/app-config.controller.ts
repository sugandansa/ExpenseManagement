import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AppConfigService } from './app-config.service';

@ApiTags('config')
@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Mobile app force-update and version config' })
  get() {
    return this.appConfigService.get();
  }
}
