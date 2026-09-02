import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashOtp } from '../common/utils/crypto';

const PEPPER = 'test-pepper';

function buildConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    OTP_PEPPER: PEPPER,
    OTP_TTL_SECONDS: '300',
    OTP_RESEND_SECONDS: '30',
    OTP_MAX_ATTEMPTS: '5',
    JWT_ACCESS_EXPIRES_IN: '3600',
    NODE_ENV: 'test',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function buildPrisma(user: unknown) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    otpRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 1, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('AuthService', () => {
  it('is created', () => {
    const service = new AuthService({} as PrismaService, {} as JwtService, buildConfig());
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('stores the fixed test code for whitelisted phones', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', isActive: true });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '123456', OTP_TEST_PHONES: '9876543210, 9000000001' }),
      );

      await service.sendOtp({ phone: '9876543210' });

      expect(prisma.otpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            codeHash: hashOtp('9876543210', '123456', PEPPER),
          }),
        }),
      );
    });

    it('stores a random code for phones outside the whitelist', async () => {
      const prisma = buildPrisma({ id: 2, phone: '9123456789', isActive: true });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '123456', OTP_TEST_PHONES: '9876543210' }),
      );

      await service.sendOtp({ phone: '9123456789' });

      const { codeHash } = prisma.otpRequest.create.mock.calls[0][0].data;
      expect(codeHash).not.toEqual(hashOtp('9123456789', '123456', PEPPER));
    });

    it('ignores the whitelist when no test code is configured', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', isActive: true });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '', OTP_TEST_PHONES: '9876543210' }),
      );

      await service.sendOtp({ phone: '9876543210' });

      const { codeHash } = prisma.otpRequest.create.mock.calls[0][0].data;
      expect(codeHash).not.toEqual(hashOtp('9876543210', '123456', PEPPER));
    });
  });

  describe('verifyOtp', () => {
    it('rejects a code that does not match the stored hash', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', isActive: true });
      prisma.otpRequest.findFirst.mockResolvedValue({
        id: 1,
        codeHash: hashOtp('9876543210', '123456', PEPPER),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
      });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
      );

      await expect(
        service.verifyOtp({ phone: '9876543210', otp: '999999', deviceId: 'device-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
