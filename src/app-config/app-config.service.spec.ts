import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from './app-config.service';

describe('AppConfigService', () => {
  it('maps stored settings', async () => {
    const prisma = { appSetting: { findMany: jest.fn().mockResolvedValue([{ settingKey: 'app_version', settingValue: '2.0.0' }]) } } as unknown as PrismaService;
    await expect(new AppConfigService(prisma).get()).resolves.toMatchObject({ status: 200, app_version: '2.0.0' });
  });
});
