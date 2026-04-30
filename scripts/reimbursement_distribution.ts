import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.drug.findMany({
    select: { reimbursement: true },
  });

  const counter = new Map<string, number>();
  let nullCount = 0;
  let emptyCount = 0;

  for (const row of rows) {
    const v = row.reimbursement;
    if (v === null) {
      nullCount += 1;
      continue;
    }

    const t = v.trim();
    if (!t) {
      emptyCount += 1;
      continue;
    }

    counter.set(t, (counter.get(t) || 0) + 1);
  }

  const top = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([value, count]) => ({ value, count }));

  const total = rows.length;
  const unknown = rows.filter((r) => {
    const v = (r.reimbursement || '').trim();
    return !v || v.includes('급여구분미확인');
  }).length;

  console.log(JSON.stringify({ total, unknown, nullCount, emptyCount, top }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
