import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toNumber } from '../common/utils/crypto';
import { currentMonth, monthRange } from '../common/utils/query';
import { AdminBudgetService } from './admin-budget.service';
import { CreateCategoryDto, CreateSubcategoryDto, UpdateCategoryCapDto, UpdateCategoryDto, UpdateCategoryStatusDto, UpdateRoleCapDto } from './dto/catalog.dto';

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService, private readonly budget: AdminBudgetService) {}

  async categories() {
    const range = monthRange(currentMonth())!;
    const rows = await this.prisma.category.findMany({ orderBy: { id: 'asc' }, include: { subCategories: { orderBy: { id: 'asc' } } } });
    const usage = await this.prisma.expenseClaim.groupBy({
      by: ['categoryId'], where: { status: { not: 'rejected' }, submissionDate: { gte: range.start, lt: range.end } },
      _sum: { amount: true }, _count: { _all: true },
    });
    const usageMap = new Map(usage.map((row) => [row.categoryId, row]));
    return rows.map((category) => {
      const stats = usageMap.get(category.id);
      return {
        id: category.id, name: category.name, monthlyCap: toNumber(category.monthlyCap),
        isActive: category.isActive, usedAmount: toNumber(stats?._sum.amount), claimCount: stats?._count._all ?? 0,
        subCategories: category.subCategories.map((sub) => ({ id: sub.id, name: sub.name, isActive: sub.isActive })),
      };
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({ data: {
      name: dto.name, iconCategory: dto.name.toLowerCase().replace(/\s+/g, '_'),
      monthlyCap: new Prisma.Decimal(dto.monthlyCap), isActive: dto.isActive ?? true,
    } });
    return { id: category.id, name: category.name, monthlyCap: toNumber(category.monthlyCap), isActive: category.isActive };
  }

  async updateCategory(categoryId: number, dto: UpdateCategoryDto) {
    await this.requireCategory(categoryId);
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.monthlyCap !== undefined) data.monthlyCap = new Prisma.Decimal(dto.monthlyCap);
    const category = await this.prisma.category.update({ where: { id: categoryId }, data });
    const flaggedClaimsUpdated = dto.monthlyCap !== undefined ? await this.budget.reevaluateOpenClaims() : 0;
    return { id: category.id, name: category.name, monthlyCap: toNumber(category.monthlyCap), isActive: category.isActive, flaggedClaimsUpdated };
  }

  updateCap(categoryId: number, dto: UpdateCategoryCapDto) { return this.updateCategory(categoryId, { monthlyCap: dto.monthlyCap }); }

  async updateStatus(categoryId: number, dto: UpdateCategoryStatusDto) {
    await this.requireCategory(categoryId);
    const category = await this.prisma.category.update({ where: { id: categoryId }, data: { isActive: dto.isActive } });
    return { id: category.id, name: category.name, isActive: category.isActive };
  }

  async addSubcategory(categoryId: number, dto: CreateSubcategoryDto) {
    await this.requireCategory(categoryId);
    const sub = await this.prisma.subCategory.create({ data: { categoryId, name: dto.name } });
    return { id: sub.id, name: sub.name, categoryId: sub.categoryId };
  }

  async roleCaps() {
    const rows = await this.prisma.roleCap.findMany({ orderBy: { role: 'asc' } });
    return rows.map((row) => ({ role: row.role, monthlyCap: toNumber(row.monthlyCap), isActive: row.isActive }));
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

  private async requireCategory(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }
}
