import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SEMVER = /^\d+\.\d+\.\d+$/;

function asAndroidCode(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIosVersion(value: string | undefined, fallback: string): string {
  if (value && SEMVER.test(value)) {
    return value;
  }
  return fallback;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const rows = await this.prisma.appSetting.findMany();
    const map = Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue]));
    const iosFallback = asIosVersion(map.min_app_version, asIosVersion(map.app_version, '1.0.0'));

    return {
      status: 200,
      data: {
        force_update_android: asAndroidCode(map.force_update_android, 1),
        app_update_android: asAndroidCode(map.app_update_android, asAndroidCode(map.force_update_android, 1)),
        force_update_ios: asIosVersion(map.force_update_ios, iosFallback),
        app_update_ios: asIosVersion(map.app_update_ios, iosFallback),
      },
    };
  }
}
