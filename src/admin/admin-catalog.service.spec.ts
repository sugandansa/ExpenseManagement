import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminBudgetService } from './admin-budget.service';
import { AdminCatalogService } from './admin-catalog.service';

describe('AdminCatalogService', () => {
  it('blocks delete when category is mapped to claims', async () => {
    const prisma = {
      category: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'Travel' }) },
      expenseClaim: { count: jest.fn().mockResolvedValue(3) },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma, {} as AdminBudgetService);
    await expect(service.deleteCategory(1)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes category and subcategories when unused', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, name: 'Temp' }),
        delete: jest.fn().mockResolvedValue({}),
      },
      expenseClaim: { count: jest.fn().mockResolvedValue(0) },
      subCategory: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $transaction: jest.fn().mockResolvedValue([{}, {}]),
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma, {} as AdminBudgetService);
    await expect(service.deleteCategory(9)).resolves.toMatchObject({
      deleted: true,
      message: 'deleted Successfully',
      categoryId: 9,
    });
  });

  it('syncs items on updateCategory', async () => {
    const prisma = {
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'Travel' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          name: 'Travel',
          monthlyCap: 40000,
          isActive: true,
        }),
      },
      subCategory: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 2, name: 'Taxi', isActive: true, categoryId: 1 }])
          .mockResolvedValueOnce([
            { id: 2, name: 'Taxi', isActive: true },
            { id: 3, name: 'Fuel', isActive: true },
            { id: 4, name: 'Lodging', isActive: true },
          ]),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      expenseClaim: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const budget = { reevaluateOpenClaims: jest.fn().mockResolvedValue(0) } as unknown as AdminBudgetService;
    const service = new AdminCatalogService(prisma, budget);
    const result = await service.updateCategory(1, {
      name: 'Travel',
      monthlyCap: 40000,
      items: ['Taxi', 'Fuel', 'Lodging'],
    });
    expect(result).toMatchObject({
      id: 1,
      name: 'Travel',
      monthlyCap: 40000,
      items: ['Taxi', 'Fuel', 'Lodging'],
    });
    expect(prisma.subCategory.create).toHaveBeenCalled();
  });

  it('lists roles with userCount from department matching', async () => {
    const prisma = {
      roleCap: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            role: 'Housekeeping',
            description: 'Cleaning & upkeep staff',
            monthlyCap: 9000,
            isActive: true,
          },
        ]),
      },
      user: {
        count: jest.fn().mockResolvedValue(3),
      },
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma, {} as AdminBudgetService);
    await expect(service.listRoles()).resolves.toEqual([
      {
        id: 1,
        name: 'Housekeeping',
        description: 'Cleaning & upkeep staff',
        status: 'active',
        monthlyCap: 9000,
        userCount: 3,
      },
    ]);
  });

  it('blocks deleteRole when users are assigned', async () => {
    const prisma = {
      roleCap: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, role: 'Quality Checker' }),
        delete: jest.fn(),
      },
      user: { count: jest.fn().mockResolvedValue(2) },
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma, {} as AdminBudgetService);
    await expect(service.deleteRole(9)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.roleCap.delete).not.toHaveBeenCalled();
  });
});
