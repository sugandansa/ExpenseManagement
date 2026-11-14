import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashOtp } from '../common/utils/crypto';
import { Msg91Service } from '../common/sms/msg91.service';

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
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
    roleCap: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([{ id: 2, role: 'House Keeping', monthlyCap: 8000, isActive: true }]),
    },
    otpRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 1, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
    authSession: { create: jest.fn().mockResolvedValue({ id: 12 }) },
  };
}

function buildMsg91(sendOtp = jest.fn().mockResolvedValue(true)) {
  return { sendOtp } as unknown as Msg91Service;
}

describe('AuthService', () => {
  it('is created', () => {
    const service = new AuthService({} as PrismaService, {} as JwtService, buildConfig(), buildMsg91());
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('stores the fixed test code for whitelisted phones and skips SMS', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', isActive: true });
      const msg91 = buildMsg91();
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '123456', OTP_TEST_PHONES: '9876543210, 9000000001' }),
        msg91,
      );

      await service.sendOtp({ phone: '9876543210' });

      expect(prisma.otpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            codeHash: hashOtp('9876543210', '123456', PEPPER),
          }),
        }),
      );
      expect(msg91.sendOtp).not.toHaveBeenCalled();
    });

    it('stores a random code and sends SMS for phones outside the whitelist', async () => {
      const prisma = buildPrisma({ id: 2, phone: '9123456789', name: 'Anita', isActive: true });
      const msg91 = buildMsg91();
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '123456', OTP_TEST_PHONES: '9876543210' }),
        msg91,
      );

      await service.sendOtp({ phone: '9123456789' });

      const { codeHash } = prisma.otpRequest.create.mock.calls[0][0].data;
      expect(codeHash).not.toEqual(hashOtp('9123456789', '123456', PEPPER));
      expect(msg91.sendOtp).toHaveBeenCalledWith('9123456789', expect.any(String), 'Anita');
    });

    it('ignores the whitelist when no test code is configured', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', isActive: true, name: 'Rajesh' });
      const msg91 = buildMsg91();
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '', OTP_TEST_PHONES: '9876543210' }),
        msg91,
      );

      await service.sendOtp({ phone: '9876543210' });

      const { codeHash } = prisma.otpRequest.create.mock.calls[0][0].data;
      expect(codeHash).not.toEqual(hashOtp('9876543210', '123456', PEPPER));
      expect(msg91.sendOtp).toHaveBeenCalled();
    });

    it('fails the request when MSG91 cannot send', async () => {
      const prisma = buildPrisma({ id: 2, phone: '9123456789', isActive: true });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(jest.fn().mockResolvedValue(false)),
      );

      await expect(service.sendOtp({ phone: '9123456789' })).rejects.toBeInstanceOf(HttpException);
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
        buildMsg91(),
      );

      await expect(
        service.verifyOtp({ phone: '9876543210', otp: '999999', deviceId: 'device-1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('includes department on a successful verify', async () => {
      const prisma = buildPrisma({
        id: 101,
        phone: '9876543210',
        isActive: true,
        name: 'Rajesh',
        email: null,
        role: 'employee',
        roleCapId: null,
        department: 'Housekeeping',
      });
      prisma.otpRequest.findFirst.mockResolvedValue({
        id: 1,
        codeHash: hashOtp('9876543210', '123456', PEPPER),
        expiresAt: new Date(Date.now() + 60_000),
        attempts: 0,
        maxAttempts: 5,
      });
      const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
      const service = new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        buildConfig(),
        buildMsg91(),
      );

      const result = await service.verifyOtp({
        phone: '9876543210',
        otp: '123456',
        deviceId: 'device-1',
        rememberMe: true,
      });

      expect(result.user).toEqual({
        id: 101,
        name: 'Rajesh',
        email: null,
        phone: '9876543210',
        phoneNumber: '9876543210',
        role: { id: 2, name: 'House Keeping' },
        roleId: 2,
        authRole: 'employee',
        department: 'Housekeeping',
        status: 'active',
      });
    });

    it('me returns profile with job role like admin users', async () => {
      const prisma = buildPrisma({
        id: 105,
        name: 'Test user',
        email: 'test@gmail.com',
        phone: '8610309011',
        role: 'employee',
        roleCapId: 5,
        department: 'Admin',
        isActive: true,
      });
      prisma.roleCap.findUnique.mockResolvedValue({ id: 5, role: 'Supervisor' });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(),
      );

      await expect(service.me(105)).resolves.toEqual({
        id: 105,
        name: 'Test user',
        email: 'test@gmail.com',
        phone: '8610309011',
        phoneNumber: '8610309011',
        role: { id: 5, name: 'Supervisor' },
        roleId: 5,
        authRole: 'employee',
        department: 'Admin',
        status: 'active',
        accessLevel: 'EMPLOYEE',
        permissions: [],
        success: true,
        data: {
          id: 105,
          name: 'Test user',
          phone: '8610309011',
          email: 'test@gmail.com',
          accessLevel: 'EMPLOYEE',
          permissions: [],
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('password recovery', () => {
    it('sends a password-specific OTP and masks the phone', async () => {
      const prisma = buildPrisma({ id: 1, phone: '9876543210', name: 'Admin', role: 'admin', isActive: true });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig({ OTP_TEST_CODE: '123456', OTP_TEST_PHONES: '9876543210' }),
        buildMsg91(),
      );
      await expect(service.forgotPassword({ phone: '9876543210' })).resolves.toMatchObject({
        data: { phone: '******3210', expiresIn: 300, resendAfter: 30 },
      });
      expect(prisma.otpRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ purpose: 'password' }) }),
      );
    });

    it('rejects a consumed password OTP without falling back to an older one', async () => {
      const prisma = buildPrisma({ id: 1, role: 'admin', isActive: true });
      prisma.otpRequest.findFirst.mockResolvedValue({
        id: 2,
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        attempts: 1,
        maxAttempts: 5,
      });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(),
      );
      await expect(service.verifyPasswordOtp({ phone: '9876543210', otp: '123456' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.otpRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { phone: '9876543210', purpose: 'password' } }),
      );
    });

    it('consumes a valid password OTP and stores only a hash of the reset token', async () => {
      const prisma = buildPrisma({ id: 1, role: 'admin', isActive: true });
      prisma.otpRequest.findFirst.mockResolvedValue({
        id: 2,
        userId: 1,
        consumedAt: null,
        codeHash: hashOtp('9876543210', '123456', PEPPER),
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        maxAttempts: 5,
      });
      const tx = {
        otpRequest: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        passwordReset: { updateMany: jest.fn(), create: jest.fn() },
      };
      Object.assign(prisma, { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) });
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(),
      );
      const result = await service.verifyPasswordOtp({ phone: '9876543210', otp: '123456' });
      expect(result.data.resetToken).toHaveLength(64);
      expect(tx.passwordReset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 1, tokenHash: expect.not.stringMatching(result.data.resetToken) }),
      });
      expect(tx.otpRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
      );
    });

    it('rejects a reset token already consumed by another request', async () => {
      const tx = {
        passwordReset: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 1, user: { isActive: true, role: 'admin' } }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        user: { update: jest.fn() },
      };
      const prisma = { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) };
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(),
      );
      await expect(service.resetPassword('token', 'NewPassword@123')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('changes the password and revokes sessions on a successful reset', async () => {
      const tx = {
        passwordReset: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 1, user: { isActive: true, role: 'admin' } }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: { update: jest.fn() },
        authSession: { updateMany: jest.fn() },
        otpRequest: { updateMany: jest.fn() },
      };
      const prisma = { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) };
      const service = new AuthService(
        prisma as unknown as PrismaService,
        {} as JwtService,
        buildConfig(),
        buildMsg91(),
      );
      await expect(service.resetPassword('token', 'NewPassword@123')).resolves.toMatchObject({ success: true });
      expect(tx.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: expect.any(String) } }),
      );
      expect(tx.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, revokedAt: null } }),
      );
    });
  });
});
