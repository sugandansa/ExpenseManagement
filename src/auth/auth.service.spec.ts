import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('is created', () => {
    const service = new AuthService({} as PrismaService, {} as JwtService, {} as ConfigService);
    expect(service).toBeDefined();
  });
});
