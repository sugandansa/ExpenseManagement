import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminUsersService, normalizeRoleKey } from './admin-users.service';

describe('AdminUsersService', () => {
  const role = {
    id: 2,
    role: 'House Keeping',
    description: 'Cleaning',
    monthlyCap: new Prisma.Decimal(9000),
    isActive: true,
  };
  const user = {
    id: 101,
    name: 'Rajesh',
    email: 'rajesh@company.com',
    phone: '9876543210',
    role: 'employee',
    roleCapId: null as number | null,
    department: 'Housekeeping',
    monthlyBudget: new Prisma.Decimal(9000),
    passwordHash: null,
    isActive: true,
    createdAt: new Date('2026-09-10T10:30:00Z'),
    updatedAt: new Date('2026-09-10T10:30:00Z'),
  };

  function build(overrides: Record<string, unknown> = {}) {
    const prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(user),
        delete: jest.fn(),
      },
      roleCap: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      wallet: { create: jest.fn(), deleteMany: jest.fn() },
      expenseClaim: { count: jest.fn() },
      authSession: { deleteMany: jest.fn() },
      otpRequest: { deleteMany: jest.fn() },
      walletLedger: { deleteMany: jest.fn() },
      walletSettlement: { deleteMany: jest.fn() },
      receipt: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
      ...overrides,
    };
    return { service: new AdminUsersService(prisma as never), prisma };
  }

  it('normalizes role keys for department/role matching', () => {
    expect(normalizeRoleKey('House Keeping')).toBe('housekeeping');
    expect(normalizeRoleKey('Housekeeping')).toBe('housekeeping');
  });

  it('audits a revocation and invalidates outstanding credentials', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(user);
    const tx = {
      user: { update: jest.fn() },
      authSession: { updateMany: jest.fn() },
      otpRequest: { updateMany: jest.fn() },
      passwordReset: { updateMany: jest.fn() },
      accessEvent: { create: jest.fn().mockResolvedValue({ createdAt: user.createdAt }) },
    };
    prisma.$transaction.mockImplementation(async (fn: (value: typeof tx) => unknown) => fn(tx));
    await expect(service.changeAccess(101, 2, 'Review', false)).resolves.toMatchObject({
      data: { userId: 101, status: 'REVOKED', revokedBy: 2 },
    });
    expect(tx.authSession.updateMany).toHaveBeenCalled();
    expect(tx.otpRequest.updateMany).toHaveBeenCalled();
    expect(tx.passwordReset.updateMany).toHaveBeenCalled();
    expect(tx.accessEvent.create).toHaveBeenCalledWith({
      data: { userId: 101, actorId: 2, reason: 'Review', action: 'revoked' },
    });
  });

  it('lists users resolving role by normalized department and heals roleCapId', async () => {
    const { service, prisma } = build();
    prisma.$transaction.mockResolvedValue([1, [{ ...user }]]);
    prisma.roleCap.findMany.mockResolvedValue([role]);
    prisma.user.update.mockResolvedValue({ ...user, roleCapId: 2 });

    await expect(service.list({ page: 1, limit: 20 })).resolves.toEqual({
      users: [
        {
          id: 101,
          name: 'Rajesh',
          email: 'rajesh@company.com',
          phone: '9876543210',
          role: { id: 2, name: 'House Keeping' },
          roleId: 2,
          department: 'Housekeeping',
          status: 'active',
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { roleCapId: 2 },
    });
  });

  it('returns role null when department has no matching role', async () => {
    const { service, prisma } = build();
    const orphan = { ...user, id: 105, name: 'Test user', department: 'Admin', email: 'test@gmail.com' };
    prisma.$transaction.mockResolvedValue([1, [orphan]]);
    prisma.roleCap.findMany.mockResolvedValue([role]);

    const result = await service.list({ page: 1, limit: 20 });
    expect(result.users[0]).toMatchObject({
      id: 105,
      role: null,
      roleId: null,
      department: 'Admin',
    });
  });

  it('filters by roleCapId even when department differs', async () => {
    const { service, prisma } = build();
    const linked = {
      ...user,
      id: 106,
      name: 'Raja',
      department: 'Production',
      roleCapId: 5,
      email: null,
    };
    const supervisor = { ...role, id: 5, role: 'Supervisor' };
    prisma.roleCap.findUnique.mockResolvedValue(supervisor);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([1, [linked]]);
    prisma.roleCap.findMany.mockResolvedValue([supervisor]);

    const result = await service.list({ page: 1, limit: 20, roleId: 5 });
    expect(result.users[0]).toMatchObject({
      id: 106,
      role: { id: 5, name: 'Supervisor' },
      roleId: 5,
      department: 'Production',
    });
  });

  it('creates a user from roleId and seeds a wallet', async () => {
    const { service, prisma } = build();
    prisma.roleCap.findUnique.mockResolvedValue(role);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: { create: jest.fn().mockResolvedValue({ ...user, roleCapId: 2 }) },
        wallet: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      }),
    );

    await expect(
      service.create({
        name: 'Rajesh',
        email: 'rajesh@company.com',
        phone: '9876543210',
        roleId: 2,
        status: 'active',
      }),
    ).resolves.toMatchObject({
      id: 101,
      role: { id: 2, name: 'House Keeping' },
      roleId: 2,
      status: 'active',
    });
  });

  it('blocks delete when user has claims', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.expenseClaim.count.mockResolvedValue(2);

    await expect(service.remove(101)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when user is missing', async () => {
    const { service, prisma } = build();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundException);
  });
});
