import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('rejects revoked or legacy sessions', async () => {
    const prisma = { authSession: { findFirst: jest.fn().mockResolvedValue(null) }, user: { findUnique: jest.fn() } };
    const strategy = new JwtStrategy({ get: () => 'secret' } as never, prisma as never);
    await expect(strategy.validate({ sub: 1, role: 'admin', sid: 1 })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(strategy.validate({ sub: 1, role: 'admin' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
