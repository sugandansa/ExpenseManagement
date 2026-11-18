import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';

describe('AdminAccountsService', () => {
  it('restricts account creation to authenticated owners', () => {
    expect(Reflect.getMetadata('roles', AdminAccountsController)).toEqual(['owner']);
    expect(Reflect.getMetadata('__guards__', AdminAccountsController)).toContain(RolesGuard);
  });

  const account = {
    id: 4,
    name: 'Admin User',
    email: null,
    phone: '1234567890',
    role: 'admin',
    department: null,
    isActive: true,
    passwordHash: null,
    createdAt: new Date('2026-11-16T10:00:00Z'),
    updatedAt: new Date('2026-11-16T10:00:00Z'),
  };

  it('creates an active passwordless privileged account and omits the password hash', async () => {
    const prisma = { user: { create: jest.fn().mockResolvedValue(account) } };
    const service = new AdminAccountsService(prisma as never);

    await expect(service.create({ name: ' Admin User ', phone: '1234567890', role: 'admin' })).resolves.toEqual({
      id: 4,
      name: 'Admin User',
      email: null,
      phone: '1234567890',
      role: 'admin',
      department: null,
      status: 'active',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Admin User',
        email: null,
        phone: '1234567890',
        role: 'admin',
        department: null,
        isActive: true,
        passwordHash: null,
      },
    });
  });

  it('reports an already registered phone as a conflict', async () => {
    const duplicatePhone = new Prisma.PrismaClientKnownRequestError('Duplicate phone', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = { user: { create: jest.fn().mockRejectedValue(duplicatePhone) } };
    const service = new AdminAccountsService(prisma as never);

    await expect(service.create({ name: 'Admin User', phone: '1234567890', role: 'owner' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
