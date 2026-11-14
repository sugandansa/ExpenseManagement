import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

type JwtPayload = { sub: number; role: string; sid?: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'change-me',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sid) throw new UnauthorizedException('Invalid session');
    const session = await this.prisma.authSession.findFirst({
      where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!session) throw new UnauthorizedException('Invalid session');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or inactive user');
    }
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      phone: user.phone,
      sessionId: session.id,
    };
  }
}
