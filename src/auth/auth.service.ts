import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { LoginDto } from './dto/login.dto';
import { generateOtp, generateRefreshToken, hashOtp, publicCode, safeEqual, sha256 } from '../common/utils/crypto';
import { Msg91Service } from '../common/sms/msg91.service';
import { PasswordVerifyOtpDto } from './dto/password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly msg91: Msg91Service,
  ) {}

  async sendOtp(dto: SendOtpDto, purpose = 'login') {
    const latest = await this.prisma.otpRequest.findFirst({
      where: { phone: dto.phone, purpose },
      orderBy: { createdAt: 'desc' },
    });

    if (latest && latest.resendAfter > new Date()) {
      const retryAfter = Math.ceil((latest.resendAfter.getTime() - Date.now()) / 1000);
      throw new HttpException(
        { message: 'Please wait before requesting another OTP', retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    const otp = this.resolveOtp(dto.phone);
    const ttl = Number(this.config.get('OTP_TTL_SECONDS') || 300);
    const resendSeconds = Number(this.config.get('OTP_RESEND_SECONDS') || 30);
    const now = new Date();

    const created = await this.prisma.otpRequest.create({
      data: {
        requestId: 'pending',
        userId: user?.id,
        phone: dto.phone,
        purpose,
        codeHash: hashOtp(dto.phone, otp, this.pepper()),
        expiresAt: new Date(now.getTime() + ttl * 1000),
        resendAfter: new Date(now.getTime() + resendSeconds * 1000),
        maxAttempts: Number(this.config.get('OTP_MAX_ATTEMPTS') || 5),
      },
    });

    const requestId = publicCode('OTP', created.id);
    await this.prisma.otpRequest.update({
      where: { id: created.id },
      data: { requestId },
    });

    if (this.config.get('NODE_ENV') !== 'production') {
      console.log(`[OTP] ${dto.phone} -> ${otp} (${requestId})`);
    }

    if (!this.isTestPhone(dto.phone)) {
      const sent = await this.msg91.sendOtp(dto.phone, otp, user?.name || 'User');
      if (!sent) {
        throw new HttpException('Failed to send OTP', HttpStatus.BAD_GATEWAY);
      }
    }

    return {
      message: 'OTP sent successfully',
      expiresIn: ttl,
      resendAfter: resendSeconds,
      requestId,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || !user.isActive) {
      throw new NotFoundException('Unregistered number');
    }

    const request = await this.prisma.otpRequest.findFirst({
      where: { phone: dto.phone, purpose: 'login', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      throw new BadRequestException('No OTP request found. Request a new OTP.');
    }
    if (request.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired');
    }
    if (request.attempts >= request.maxAttempts) {
      throw new HttpException('Maximum OTP attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const incomingHash = hashOtp(dto.phone, dto.otp, this.pepper());
    const matches = safeEqual(request.codeHash, incomingHash);

    await this.prisma.otpRequest.update({
      where: { id: request.id },
      data: {
        attempts: { increment: 1 },
        consumedAt: matches ? new Date() : undefined,
      },
    });

    if (!matches) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const accessExpiresIn = Number(this.config.get('JWT_ACCESS_EXPIRES_IN') || 3600);
    return this.issueSession(user, dto.deviceId, dto.rememberMe ? 90 : 30, accessExpiresIn);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    if (!['owner', 'admin'].includes(user.role)) {
      throw new UnauthorizedException('Password login is only available for admin users');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid phone or password');
    }
    const accessExpiresIn = Number(this.config.get('JWT_ACCESS_EXPIRES_IN') || 3600);
    return this.issueSession(user, 'admin', 30, accessExpiresIn);
  }

  async refresh(dto: RefreshTokenDto) {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: sha256(dto.refreshToken) },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessExpiresIn = Number(this.config.get('JWT_ACCESS_EXPIRES_IN') || 3600);
    const nextRefresh = generateRefreshToken();

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        tokenHash: sha256(nextRefresh),
        expiresAt: session.expiresAt,
      },
    });

    return {
      accessToken: await this.signAccess(session.user.id, session.user.role, accessExpiresIn, session.id),
      refreshToken: nextRefresh,
      expiresIn: accessExpiresIn,
    };
  }

  async logout(dto: LogoutDto) {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: sha256(dto.refreshToken) },
    });

    if (session && !session.revokedAt && (!dto.deviceId || session.deviceId === dto.deviceId)) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async logoutCurrent(userId: number, sessionId: number) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async forgotPassword(dto: SendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    const ttl = Number(this.config.get('OTP_TTL_SECONDS') || 300);
    const resend = Number(this.config.get('OTP_RESEND_SECONDS') || 30);
    if (user?.isActive && ['owner', 'admin'].includes(user.role)) await this.sendOtp(dto, 'password');
    return {
      success: true,
      message: 'OTP sent successfully',
      data: { phone: `******${dto.phone.slice(-4)}`, expiresIn: ttl, resendAfter: resend },
    };
  }

  async verifyPasswordOtp(dto: PasswordVerifyOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user?.isActive || !['owner', 'admin'].includes(user.role)) throw new UnauthorizedException('Invalid OTP');
    const request = await this.prisma.otpRequest.findFirst({
      where: { phone: dto.phone, purpose: 'password' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (
      !request ||
      request.userId !== user.id ||
      request.consumedAt ||
      request.expiresAt <= new Date() ||
      request.attempts >= request.maxAttempts
    )
      throw new UnauthorizedException('Invalid or expired OTP');
    const matches = safeEqual(request.codeHash, hashOtp(dto.phone, dto.otp, this.pepper()));
    const token = generateRefreshToken();
    const expiresIn = 600;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.otpRequest.updateMany({
        where: {
          id: request.id,
          consumedAt: null,
          attempts: { lt: request.maxAttempts },
          expiresAt: { gt: new Date() },
        },
        data: { attempts: { increment: 1 }, ...(matches ? { consumedAt: new Date() } : {}) },
      });
      if (!updated.count) throw new UnauthorizedException('Invalid or expired OTP');
      if (matches) {
        await tx.passwordReset.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        await tx.passwordReset.create({
          data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + expiresIn * 1000) },
        });
      }
    });
    if (!matches) throw new UnauthorizedException('Invalid OTP');
    return { success: true, message: 'OTP verified successfully', data: { resetToken: token, expiresIn } };
  }

  async resetPassword(token: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Password must be at most 72 bytes');
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction(async (tx) => {
      const reset = await tx.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
      if (!reset || !reset.user.isActive || !['owner', 'admin'].includes(reset.user.role))
        throw new UnauthorizedException('Invalid reset token');
      const consumed = await tx.passwordReset.updateMany({
        where: { id: reset.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (!consumed.count) throw new UnauthorizedException('Invalid reset token');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.authSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordReset.updateMany({
        where: { userId: reset.userId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.otpRequest.updateMany({
        where: { userId: reset.userId, purpose: 'password', consumedAt: null },
        data: { consumedAt: new Date() },
      });
    });
    return { success: true, message: 'Password reset successfully' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const jobRole = await this.resolveJobRole(user);

    // Shape aligned with /admin/users so the app can reuse the same profile fields.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      phoneNumber: user.phone,
      role: jobRole,
      roleId: jobRole?.id ?? user.roleCapId ?? null,
      authRole: user.role,
      department: user.department,
      status: user.isActive ? 'active' : 'inactive',
      accessLevel: user.role.toUpperCase(),
      permissions: ['owner', 'admin'].includes(user.role)
        ? ['DASHBOARD_VIEW', 'USER_MANAGE', 'REPORT_EXPORT', 'SETTLEMENT_MANAGE']
        : [],
      success: true,
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        accessLevel: user.role.toUpperCase(),
        permissions: ['owner', 'admin'].includes(user.role)
          ? ['DASHBOARD_VIEW', 'USER_MANAGE', 'REPORT_EXPORT', 'SETTLEMENT_MANAGE']
          : [],
        status: user.isActive ? 'ACTIVE' : 'REVOKED',
      },
    };
  }

  /** Job role from roleCapId, else normalized department match (additive heal). */
  private async resolveJobRole(user: {
    id: number;
    roleCapId: number | null;
    department: string | null;
  }): Promise<{ id: number; name: string } | null> {
    if (user.roleCapId != null) {
      const cap = await this.prisma.roleCap.findUnique({ where: { id: user.roleCapId } });
      if (cap) return { id: cap.id, name: cap.role };
    }
    if (!user.department) return null;

    const roles = await this.prisma.roleCap.findMany();
    const key = user.department.toLowerCase().replace(/[\s_-]+/g, '');
    const cap = roles.find((r) => r.role.toLowerCase().replace(/[\s_-]+/g, '') === key);
    if (!cap) return null;

    await this.prisma.user.update({ where: { id: user.id }, data: { roleCapId: cap.id } });
    return { id: cap.id, name: cap.role };
  }

  private async issueSession(
    user: {
      id: number;
      name: string;
      email?: string | null;
      role: string;
      roleCapId?: number | null;
      department: string | null;
      phone?: string;
      isActive?: boolean;
    },
    deviceId: string,
    refreshDays: number,
    accessExpiresIn: number,
  ) {
    const refreshToken = generateRefreshToken();
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        deviceId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });
    const jobRole = await this.resolveJobRole({
      id: user.id,
      roleCapId: user.roleCapId ?? null,
      department: user.department,
    });
    return {
      accessToken: await this.signAccess(user.id, user.role, accessExpiresIn, session.id),
      refreshToken,
      expiresIn: accessExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email ?? null,
        phone: user.phone ?? null,
        phoneNumber: user.phone ?? null,
        role: jobRole,
        roleId: jobRole?.id ?? user.roleCapId ?? null,
        authRole: user.role,
        department: user.department,
        status: user.isActive === false ? 'inactive' : 'active',
      },
    };
  }

  private pepper(): string {
    return this.config.get<string>('OTP_PEPPER') || 'otp-pepper';
  }

  /**
   * Test numbers always receive OTP_TEST_CODE so QA and app-store reviewers can
   * sign in without SMS delivery. Every other number gets a random code.
   */
  private resolveOtp(phone: string): string {
    if (this.isTestPhone(phone)) {
      return (this.config.get<string>('OTP_TEST_CODE') || '').trim();
    }
    return generateOtp();
  }

  private isTestPhone(phone: string): boolean {
    const testCode = (this.config.get<string>('OTP_TEST_CODE') || '').trim();
    if (!testCode) {
      return false;
    }
    return (this.config.get<string>('OTP_TEST_PHONES') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .includes(phone);
  }

  private signAccess(userId: number, role: string, expiresIn: number, sessionId: number) {
    return this.jwt.signAsync({ sub: userId, role, sid: sessionId }, { expiresIn: `${expiresIn}s` });
  }
}
