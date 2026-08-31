import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { phone: '9876543210' },
    update: { name: 'Rajesh' },
    create: { id: 101, name: 'Rajesh', phone: '9876543210', role: 'employee', department: 'Housekeeping', monthlyBudget: new Prisma.Decimal(5000) },
  });
  await prisma.wallet.upsert({ where: { userId: 101 }, update: { balance: new Prisma.Decimal(2500) }, create: { userId: 101, balance: new Prisma.Decimal(2500) } });

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
    [1, 1, 'Taxi'], [2, 1, 'Fuel'], [3, 1, 'Lodging'],
    [4, 2, 'Meals'], [5, 2, 'Snacks'], [6, 3, 'Stationery'],
  ] as const;
  for (const [id, categoryId, name] of subCategories) {
    await prisma.subCategory.upsert({ where: { id }, update: { name }, create: { id, categoryId, name } });
  }
  const settings = {
    force_update_android: '1', force_update_ios: '0', min_app_version: '1.0.0',
    update_url: 'https://play.google.com/store/apps/details?id=in.schoollift.expense', app_version: '2.0.0',
  };
  for (const [settingKey, settingValue] of Object.entries(settings)) {
    await prisma.appSetting.upsert({ where: { settingKey }, update: { settingValue }, create: { settingKey, settingValue } });
  }
  await prisma.roleCap.upsert({
    where: { role: 'Housekeeping' },
    update: { monthlyCap: new Prisma.Decimal(15000) },
    create: { role: 'Housekeeping', monthlyCap: new Prisma.Decimal(15000) },
  });
}

main().finally(() => prisma.$disconnect());
