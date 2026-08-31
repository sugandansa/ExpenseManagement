import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const rows = await this.prisma.appSetting.findMany();
    const map = Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue]));
    return {
      status: 200,
      force_update_android: Number(map.force_update_android ?? 0),
      force_update_ios: Number(map.force_update_ios ?? 0),
      min_app_version: map.min_app_version ?? '1.0.0',
      update_url: map.update_url ?? '',
      app_version: map.app_version ?? '1.0.0',
    };
  }
}
