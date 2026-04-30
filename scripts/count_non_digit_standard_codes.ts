import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw<Array<{ id: string; standardCode: string; productName: string; company: string | null; reimbursement: string | null }>>`
    SELECT id, "standardCode", "productName", company, reimbursement
    FROM "Drug"
    WHERE "standardCode" IS NOT NULL
      AND "standardCode" !~ '^[0-9]+$'
    ORDER BY "createdAt" DESC
    LIMIT 200;
  `;

  console.log(JSON.stringify({ countSample: rows.length, sample: rows.slice(0, 20) }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
