import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAppUpdateDto } from './dto/update-app-update.dto';

const SEMVER = /^\d+\.\d+\.\d+$/;
const UPDATE_KEYS = ['force_update_android', 'app_update_android', 'force_update_ios', 'app_update_ios'] as const;

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

  async update(dto: UpdateAppUpdateDto) {
    const values: Record<(typeof UPDATE_KEYS)[number], string> = {
      force_update_android: String(dto.force_update_android),
      app_update_android: String(dto.app_update_android),
      force_update_ios: dto.force_update_ios,
      app_update_ios: dto.app_update_ios,
    };

    await this.prisma.$transaction(
      UPDATE_KEYS.map((settingKey) =>
        this.prisma.appSetting.upsert({
          where: { settingKey },
          update: { settingValue: values[settingKey] },
          create: { settingKey, settingValue: values[settingKey] },
        }),
      ),
    );

    return this.get();
  }
}
