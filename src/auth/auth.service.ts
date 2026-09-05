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
import {
  generateOtp,
  generateRefreshToken,
  hashOtp,
  publicCode,
  safeEqual,
  sha256,
} from '../common/utils/crypto';
import { Msg91Service } from '../common/sms/msg91.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly msg91: Msg91Service,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const latest = await this.prisma.otpRequest.findFirst({
      where: { phone: dto.phone },
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
      where: { phone: dto.phone, consumedAt: null },
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
      accessToken: await this.signAccess(session.user.id, session.user.role, accessExpiresIn),
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

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      phoneNumber: user.phone,
    };
  }

  private async issueSession(
    user: { id: number; name: string; role: string; department: string | null },
    deviceId: string,
    refreshDays: number,
    accessExpiresIn: number,
  ) {
    const refreshToken = generateRefreshToken();
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        deviceId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken: await this.signAccess(user.id, user.role, accessExpiresIn),
      refreshToken,
      expiresIn: accessExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
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

  private signAccess(userId: number, role: string, expiresIn: number) {
    return this.jwt.signAsync({ sub: userId, role }, { expiresIn: `${expiresIn}s` });
  }
}
