import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: {},
    create: {
      id: 101,
      name: 'Rajesh',
      phone: '9876543210',
      role: 'employee',
      department: 'Housekeeping',
      monthlyBudget: new Prisma.Decimal(5000),
    },
  });
  await prisma.wallet.upsert({
    where: { userId: 101 },
    update: {},
    create: { userId: 101, balance: new Prisma.Decimal(2500) },
  });

  const categories = [
    { id: 1, name: 'Travel', iconCategory: 'travel', monthlyCap: 40000 },
    { id: 2, name: 'Food', iconCategory: 'food', monthlyCap: 30000 },
    { id: 3, name: 'Office', iconCategory: 'office', monthlyCap: 30000 },
  ];
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: { name: category.name, monthlyCap: new Prisma.Decimal(category.monthlyCap) },
      create: { ...category, monthlyCap: new Prisma.Decimal(category.monthlyCap) },
    });
  }
  const subCategories = [
    [1, 1, 'Taxi', 15000],
    [2, 1, 'Fuel', 15000],
    [3, 1, 'Lodging', 10000],
    [4, 2, 'Meals', 20000],
    [5, 2, 'Snacks', 10000],
    [6, 3, 'Stationery', 30000],
  ] as const;
  for (const [id, categoryId, name, monthlyCap] of subCategories) {
    await prisma.subCategory.upsert({
      where: { id },
      update: { name, monthlyCap: new Prisma.Decimal(monthlyCap) },
      create: { id, categoryId, name, monthlyCap: new Prisma.Decimal(monthlyCap) },
    });
  }
  const settings = {
    force_update_android: '1',
    app_update_android: '1',
    force_update_ios: '1.0.0',
    app_update_ios: '1.0.0',
    min_app_version: '1.0.0',
    update_url: 'https://play.google.com/store/apps/details?id=in.schoollift.expense',
    app_version: '2.0.0',
  };
  for (const [settingKey, settingValue] of Object.entries(settings)) {
    await prisma.appSetting.upsert({
      where: { settingKey },
      update: { settingValue },
      create: { settingKey, settingValue },
    });
  }
  // Additive only: never overwrite existing role_caps / users.
  await prisma.roleCap.upsert({
    where: { role: 'Housekeeping' },
    update: {},
    create: { role: 'Housekeeping', monthlyCap: new Prisma.Decimal(15000) },
  });
  for (const row of [
    { role: 'Driver', description: 'Vehicle operators', monthlyCap: 9000 },
    { role: 'Office Admin', description: 'Office administration', monthlyCap: 9000 },
  ]) {
    await prisma.roleCap.upsert({
      where: { role: row.role },
      update: {},
      create: {
        role: row.role,
        description: row.description,
        monthlyCap: new Prisma.Decimal(row.monthlyCap),
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
