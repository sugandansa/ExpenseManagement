import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { currentMonth, monthRange } from '../common/utils/query';
import { AdminBudgetService } from './admin-budget.service';
import {
  CreateCategoryDto,
  CreateRoleDto,
  CreateSubcategoryDto,
  UpdateCategoryCapDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  UpdateRoleCapDto,
  UpdateRoleDto,
  UpdateSubcategoryDto,
} from './dto/catalog.dto';

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budget: AdminBudgetService,
  ) {}

  async categories() {
    const range = monthRange(currentMonth())!;
    const rows = await this.prisma.category.findMany({
      orderBy: { id: 'asc' },
      include: { subCategories: { orderBy: { id: 'asc' } } },
    });
    const usage = await this.prisma.expenseClaim.groupBy({
      by: ['categoryId'],
      where: { status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    const subUsage = await this.prisma.expenseClaim.groupBy({
      by: ['subCategoryId'],
      where: {
        status: { not: 'rejected' },
        submissionDate: { gte: range.start, lt: range.end },
        subCategoryId: { not: null },
      },
      _sum: { amount: true },
    });
    const usageMap = new Map(usage.map((row) => [row.categoryId, row]));
    const subUsageMap = new Map(subUsage.map((row) => [row.subCategoryId!, toNumber(row._sum.amount)]));
    return rows.map((category) => {
      const stats = usageMap.get(category.id);
      return {
        id: category.id,
        name: category.name,
        monthlyCap: toNumber(category.monthlyCap),
        isActive: category.isActive,
        usedAmount: toNumber(stats?._sum.amount),
        claimCount: stats?._count._all ?? 0,
        items: category.subCategories.filter((s) => s.isActive).map((s) => s.name),
        subCategories: category.subCategories.map((sub) => {
          const used = subUsageMap.get(sub.id) ?? 0;
          const limit = toNumber(sub.monthlyCap);
          return {
            id: sub.id,
            name: sub.name,
            monthlyCap: limit,
            limit,
            used,
            remaining: Number(Math.max(0, limit - used).toFixed(2)),
            isActive: sub.isActive,
          };
        }),
      };
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        iconCategory: dto.name.toLowerCase().replace(/\s+/g, '_'),
        monthlyCap: new Prisma.Decimal(dto.monthlyCap),
        isActive: dto.isActive ?? true,
      },
    });
    const items = dto.items?.length ? await this.syncCategoryItems(category.id, dto.items) : [];
    return {
      id: category.id,
      name: category.name,
      monthlyCap: toNumber(category.monthlyCap),
      isActive: category.isActive,
      items,
    };
  }

  async updateCategory(categoryId: number, dto: UpdateCategoryDto) {
    await this.requireCategory(categoryId);
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name) {
      data.name = dto.name;
      data.iconCategory = dto.name.toLowerCase().replace(/\s+/g, '_');
    }
    if (dto.monthlyCap !== undefined) data.monthlyCap = new Prisma.Decimal(dto.monthlyCap);
    const category = await this.prisma.category.update({ where: { id: categoryId }, data });
    const items = dto.items ? await this.syncCategoryItems(categoryId, dto.items) : undefined;
    const flaggedClaimsUpdated = dto.monthlyCap !== undefined ? await this.budget.reevaluateOpenClaims() : 0;
    const response: Record<string, unknown> = {
      id: category.id,
      name: category.name,
      monthlyCap: toNumber(category.monthlyCap),
      isActive: category.isActive,
      flaggedClaimsUpdated,
    };
    if (items) response.items = items;
    return response;
  }

  async deleteCategory(categoryId: number) {
    await this.requireCategory(categoryId);
    const claimCount = await this.prisma.expenseClaim.count({ where: { categoryId } });
    if (claimCount > 0) {
      throw new ConflictException("It won't be possible if that category is mapped to any of the bill already");
    }
    await this.prisma.$transaction([
      this.prisma.subCategory.deleteMany({ where: { categoryId } }),
      this.prisma.category.delete({ where: { id: categoryId } }),
    ]);
    return { deleted: true, message: 'deleted Successfully', categoryId };
  }

  updateCap(categoryId: number, dto: UpdateCategoryCapDto) {
    return this.updateCategory(categoryId, { monthlyCap: dto.monthlyCap });
  }

  async updateStatus(categoryId: number, dto: UpdateCategoryStatusDto) {
    await this.requireCategory(categoryId);
    const category = await this.prisma.category.update({ where: { id: categoryId }, data: { isActive: dto.isActive } });
    return { id: category.id, name: category.name, isActive: category.isActive };
  }

  async addSubcategory(categoryId: number, dto: CreateSubcategoryDto) {
    await this.requireCategory(categoryId);
    const sub = await this.prisma.subCategory.create({
      data: {
        categoryId,
        name: dto.name,
        monthlyCap: new Prisma.Decimal(dto.monthlyCap ?? 0),
      },
    });
    return {
      id: sub.id,
      name: sub.name,
      categoryId: sub.categoryId,
      monthlyCap: toNumber(sub.monthlyCap),
      limit: toNumber(sub.monthlyCap),
    };
  }

  async updateSubcategory(subCategoryId: number, dto: UpdateSubcategoryDto) {
    const existing = await this.prisma.subCategory.findUnique({ where: { id: subCategoryId } });
    if (!existing) throw new NotFoundException('Subcategory not found');
    const data: Prisma.SubCategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.monthlyCap !== undefined) data.monthlyCap = new Prisma.Decimal(dto.monthlyCap);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const sub = await this.prisma.subCategory.update({ where: { id: subCategoryId }, data });
    const flaggedClaimsUpdated = dto.monthlyCap !== undefined ? await this.budget.reevaluateOpenClaims() : 0;
    return {
      id: sub.id,
      name: sub.name,
      categoryId: sub.categoryId,
      monthlyCap: toNumber(sub.monthlyCap),
      limit: toNumber(sub.monthlyCap),
      isActive: sub.isActive,
      flaggedClaimsUpdated,
    };
  }

  async roleCaps() {
    const rows = await this.prisma.roleCap.findMany({ orderBy: { role: 'asc' } });
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      description: row.description,
      monthlyCap: toNumber(row.monthlyCap),
      isActive: row.isActive,
    }));
  }

  async updateRoleCap(role: string, dto: UpdateRoleCapDto) {
    const decoded = decodeURIComponent(role);
    const row = await this.prisma.roleCap.upsert({
      where: { role: decoded },
      update: { monthlyCap: new Prisma.Decimal(dto.monthlyCap), isActive: dto.isActive ?? true },
      create: { role: decoded, monthlyCap: new Prisma.Decimal(dto.monthlyCap), isActive: dto.isActive ?? true },
    });
    const flaggedClaimsUpdated = await this.budget.reevaluateOpenClaims();
    return { role: row.role, monthlyCap: toNumber(row.monthlyCap), isActive: row.isActive, flaggedClaimsUpdated };
  }

  /** Dashboard "roles" API — same RoleCap rows used by claims/budget. */
  async listRoles() {
    const rows = await this.prisma.roleCap.findMany({ orderBy: { id: 'asc' } });
    const counts = await Promise.all(
      rows.map((row) =>
        this.prisma.user.count({
          where: {
            OR: [{ roleCapId: row.id }, { roleCapId: null, department: row.role }],
          },
        }),
      ),
    );
    return rows.map((row, i) => this.mapRole(row, counts[i] ?? 0));
  }

  async createRole(dto: CreateRoleDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.roleCap.findUnique({ where: { role: name } });
    if (existing) throw new ConflictException('Role already exists');
    const row = await this.prisma.roleCap.create({
      data: {
        role: name,
        description: dto.description?.trim() || null,
        monthlyCap: new Prisma.Decimal(dto.monthlyCap),
        isActive: true,
      },
    });
    return this.mapRole(row, 0);
  }

  async updateRole(id: number, dto: UpdateRoleDto) {
    const existing = await this.requireRole(id);
    const nextName = dto.name?.trim();
    if (nextName && nextName !== existing.role) {
      const clash = await this.prisma.roleCap.findUnique({ where: { role: nextName } });
      if (clash) throw new ConflictException('Role already exists');
    }
    const data: Prisma.RoleCapUpdateInput = {};
    if (nextName) data.role = nextName;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.monthlyCap !== undefined) data.monthlyCap = new Prisma.Decimal(dto.monthlyCap);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Update role row only — do not rewrite existing users' department values.
    const row = await this.prisma.roleCap.update({ where: { id }, data });

    if (dto.monthlyCap !== undefined) await this.budget.reevaluateOpenClaims();
    const userCount = await this.prisma.user.count({
      where: { OR: [{ roleCapId: row.id }, { roleCapId: null, department: row.role }] },
    });
    return this.mapRole(row, userCount);
  }

  async deleteRole(id: number) {
    const existing = await this.requireRole(id);
    const userCount = await this.prisma.user.count({
      where: { OR: [{ roleCapId: existing.id }, { roleCapId: null, department: existing.role }] },
    });
    if (userCount > 0) {
      throw new ConflictException('Cannot delete a role that is assigned to users');
    }
    await this.prisma.roleCap.delete({ where: { id } });
    return { id };
  }

  private mapRole(
    row: { id: number; role: string; description: string | null; monthlyCap: Prisma.Decimal; isActive: boolean },
    userCount: number,
  ) {
    return {
      id: row.id,
      name: row.role,
      description: row.description,
      status: row.isActive ? 'active' : 'inactive',
      monthlyCap: toNumber(row.monthlyCap),
      userCount,
    };
  }

  private async requireRole(id: number) {
    const role = await this.prisma.roleCap.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  /**
   * Sync subcategory names for a category:
   * - create / reactivate names in `items`
   * - soft-disable unused names with no claims
   */
  private async syncCategoryItems(categoryId: number, items: string[]) {
    const desired = [...new Set(items.map((name) => name.trim()).filter(Boolean))];
    const desiredLower = new Set(desired.map((n) => n.toLowerCase()));
    const existing = await this.prisma.subCategory.findMany({ where: { categoryId } });
    const byLower = new Map(existing.map((row) => [row.name.toLowerCase(), row]));

    for (const name of desired) {
      const found = byLower.get(name.toLowerCase());
      if (found) {
        if (!found.isActive || found.name !== name) {
          await this.prisma.subCategory.update({
            where: { id: found.id },
            data: { isActive: true, name },
          });
        }
      } else {
        await this.prisma.subCategory.create({
          data: { categoryId, name, monthlyCap: new Prisma.Decimal(0), isActive: true },
        });
      }
    }

    for (const row of existing) {
      if (desiredLower.has(row.name.toLowerCase())) continue;
      if (!row.isActive) continue;
      const claimCount = await this.prisma.expenseClaim.count({ where: { subCategoryId: row.id } });
      if (claimCount > 0) continue;
      await this.prisma.subCategory.update({ where: { id: row.id }, data: { isActive: false } });
    }

    const active = await this.prisma.subCategory.findMany({
      where: { categoryId, isActive: true },
      orderBy: { id: 'asc' },
    });
    return active.map((row) => row.name);
  }

  private async requireCategory(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}
