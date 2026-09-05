import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  it('wraps update flags in a data object for the mobile app', async () => {
    const prisma = {
      appSetting: {
        findMany: jest.fn().mockResolvedValue([
          { settingKey: 'force_update_android', settingValue: '1' },
          { settingKey: 'app_update_android', settingValue: '1' },
          { settingKey: 'force_update_ios', settingValue: '0' },
          { settingKey: 'min_app_version', settingValue: '1.0.0' },
          { settingKey: 'app_version', settingValue: '2.0.0' },
        ]),
      },
    } as unknown as PrismaService;

    await expect(new AppConfigService(prisma).get()).resolves.toEqual({
      status: 200,
      data: {
        force_update_android: 1,
        app_update_android: 1,
        force_update_ios: '1.0.0',
        app_update_ios: '1.0.0',
      },
    });
  });
});
