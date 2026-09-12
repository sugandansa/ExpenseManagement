import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePage, paginateMeta } from '../common/utils/query';
import { AdminUsersQueryDto, CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from './dto/users.dto';

type JobRole = { id: number; name: string };

/** Collapse casing/spacing so "Housekeeping" matches "House Keeping". */
export function normalizeRoleKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminUsersQueryDto) {
    const { page, limit, skip } = normalizePage(query.page, query.limit);
    const where: Prisma.UserWhereInput = { role: 'employee' };

    if (query.status === 'active') where.isActive = true;
    if (query.status === 'inactive') where.isActive = false;

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }];
    }

    if (query.roleId) {
      const role = await this.requireRole(query.roleId);
      const legacyIds = await this.legacyUserIdsForRole(role);
      where.AND = [
        {
          OR: [{ roleCapId: role.id }, ...(legacyIds.length ? [{ id: { in: legacyIds } }] : [])],
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const roleByUserId = await this.resolveRoles(rows, { heal: true });
    return {
      users: rows.map((user) => this.mapUser(user, roleByUserId.get(user.id))),
      pagination: paginateMeta(page, limit, total),
    };
  }

  async getById(id: number) {
    const user = await this.requireEmployee(id);
    const roleByUserId = await this.resolveRoles([user], { heal: true });
    return this.mapUser(user, roleByUserId.get(user.id));
  }

  async create(dto: CreateUserDto) {
    const role = await this.requireRole(dto.roleId);
    if (!role.isActive) throw new ConflictException('Cannot assign an inactive role');

    const phoneTaken = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (phoneTaken) throw new ConflictException('Phone number already registered');

    const department = dto.department?.trim() || role.role;
    const isActive = (dto.status ?? 'active') === 'active';

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email?.trim() || null,
          phone: dto.phone,
          role: 'employee',
          roleCapId: role.id,
          department,
          monthlyBudget: role.monthlyCap,
          isActive,
        },
      });
      await tx.wallet.create({ data: { userId: created.id, balance: new Prisma.Decimal(0) } });
      return created;
    });

    return this.mapUser(user, { id: role.id, name: role.role });
  }

  async update(id: number, dto: UpdateUserDto) {
    const existing = await this.requireEmployee(id);
    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.phone !== undefined && dto.phone !== existing.phone) {
      const phoneTaken = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (phoneTaken) throw new ConflictException('Phone number already registered');
      data.phone = dto.phone;
    }
    if (dto.status !== undefined) data.isActive = dto.status === 'active';

    let roleRef: JobRole | undefined;
    if (dto.roleId !== undefined) {
      const role = await this.requireRole(dto.roleId);
      if (!role.isActive) throw new ConflictException('Cannot assign an inactive role');
      data.roleCap = { connect: { id: role.id } };
      data.monthlyBudget = role.monthlyCap;
      if (dto.department !== undefined) {
        data.department = dto.department.trim() || null;
      } else if (!existing.department) {
        data.department = role.role;
      }
      roleRef = { id: role.id, name: role.role };
    } else if (dto.department !== undefined) {
      data.department = dto.department.trim() || null;
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    if (!roleRef) {
      const roleByUserId = await this.resolveRoles([user], { heal: true });
      roleRef = roleByUserId.get(user.id);
    }
    return this.mapUser(user, roleRef);
  }

  async updateStatus(id: number, dto: UpdateUserStatusDto) {
    await this.requireEmployee(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.status === 'active' },
    });
    const roleByUserId = await this.resolveRoles([user], { heal: true });
    return this.mapUser(user, roleByUserId.get(user.id));
  }

  async remove(id: number) {
    const user = await this.requireEmployee(id);
    const claimCount = await this.prisma.expenseClaim.count({ where: { userId: id } });
    if (claimCount > 0) {
      throw new ConflictException('Cannot delete a user that has expense claims; deactivate instead');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.authSession.deleteMany({ where: { userId: id } });
      await tx.otpRequest.deleteMany({ where: { userId: id } });
      await tx.walletLedger.deleteMany({ where: { userId: id } });
      await tx.walletSettlement.deleteMany({ where: { userId: id } });
      await tx.receipt.deleteMany({ where: { userId: id } });
      await tx.wallet.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return { id: user.id };
  }

  private mapUser(user: User, role?: JobRole) {
    const resolved = role ?? null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: resolved,
      roleId: resolved?.id ?? user.roleCapId ?? null,
      department: user.department,
      status: user.isActive ? 'active' : 'inactive',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Resolve job role by roleCapId first, then normalized department name.
   * Optionally backfill roleCapId for legacy rows (additive FK only).
   */
  private async resolveRoles(users: User[], opts: { heal?: boolean } = {}) {
    const byId = new Map<number, JobRole>();
    if (!users.length) return byId;

    const roles = await this.prisma.roleCap.findMany();
    const byCapId = new Map(roles.map((r) => [r.id, { id: r.id, name: r.role }]));
    const byNormName = new Map(roles.map((r) => [normalizeRoleKey(r.role), { id: r.id, name: r.role }]));

    const toHeal: Array<{ userId: number; roleCapId: number }> = [];

    for (const user of users) {
      if (user.roleCapId != null && byCapId.has(user.roleCapId)) {
        byId.set(user.id, byCapId.get(user.roleCapId)!);
        continue;
      }
      if (user.department) {
        const matched = byNormName.get(normalizeRoleKey(user.department));
        if (matched) {
          byId.set(user.id, matched);
          if (opts.heal && user.roleCapId == null) {
            toHeal.push({ userId: user.id, roleCapId: matched.id });
          }
        }
      }
    }

    if (opts.heal && toHeal.length) {
      await Promise.all(
        toHeal.map(({ userId, roleCapId }) => this.prisma.user.update({ where: { id: userId }, data: { roleCapId } })),
      );
      for (const { userId, roleCapId } of toHeal) {
        const u = users.find((row) => row.id === userId);
        if (u) u.roleCapId = roleCapId;
      }
    }

    return byId;
  }

  /** Legacy employees with null roleCapId whose department normalizes to this role name. */
  private async legacyUserIdsForRole(role: { id: number; role: string }) {
    const orphans = await this.prisma.user.findMany({
      where: { role: 'employee', roleCapId: null, department: { not: null } },
      select: { id: true, department: true },
    });
    const key = normalizeRoleKey(role.role);
    return orphans.filter((u) => u.department && normalizeRoleKey(u.department) === key).map((u) => u.id);
  }

  private async requireEmployee(id: number) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'employee' } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async requireRole(id: number) {
    const role = await this.prisma.roleCap.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
