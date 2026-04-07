import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.drug.count();
  const withPrice = await prisma.drug.count({
    where: {
      priceLabel: { not: null },
    },
  });
  const withUsage = await prisma.drug.count({
    where: {
      usageFrequency: { gt: 0 },
    },
  });

  const topMissingPrice = await prisma.drug.groupBy({
    by: ['company'],
    where: { priceLabel: null },
    _count: { _all: true },
    orderBy: { _count: { company: 'desc' } },
    take: 10,
  });

  const topMissingUsage = await prisma.drug.groupBy({
    by: ['company'],
    where: { usageFrequency: 0 },
    _count: { _all: true },
    orderBy: { _count: { company: 'desc' } },
    take: 10,
  });

  const summary = {
    total,
    withPrice,
    withoutPrice: total - withPrice,
    priceCoveragePct: total > 0 ? Number(((withPrice / total) * 100).toFixed(2)) : 0,
    withUsage,
    withoutUsage: total - withUsage,
    usageCoveragePct: total > 0 ? Number(((withUsage / total) * 100).toFixed(2)) : 0,
    topMissingPriceCompanies: topMissingPrice.map((x) => ({
      company: x.company || '-',
      count: x._count._all,
    })),
    topMissingUsageCompanies: topMissingUsage.map((x) => ({
      company: x.company || '-',
      count: x._count._all,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
