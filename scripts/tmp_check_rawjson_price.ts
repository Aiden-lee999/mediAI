import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.drug.findMany({
    where: {
      reimbursement: { contains: '급여' },
      OR: [{ priceLabel: null }, { priceLabel: '' }, { priceLabel: { contains: '가격정보없음' } }],
    },
    select: {
      productName: true,
      company: true,
      reimbursement: true,
      standardCode: true,
      insuranceCode: true,
      rawJson: true,
    },
    take: 30,
    orderBy: { updatedAt: 'asc' },
  });

  const parsed = rows.map((r) => {
    let extracted: Record<string, unknown> = {};
    try {
      const j = r.rawJson ? JSON.parse(r.rawJson) : null;
      if (j && typeof j === 'object') {
        extracted = {
          maxAmt: (j as any).maxAmt,
          amt: (j as any).amt,
          price: (j as any).price,
          upprAmt: (j as any).upprAmt,
          ceilAmt: (j as any).ceilAmt,
          itemSeq: (j as any).itemSeq,
          itemCd: (j as any).itemCd,
          ediCode: (j as any).ediCode,
        };
      }
    } catch {
      extracted = { parseError: true };
    }

    return {
      productName: r.productName,
      company: r.company,
      reimbursement: r.reimbursement,
      standardCode: r.standardCode,
      insuranceCode: r.insuranceCode,
      extracted,
    };
  });

  console.log(JSON.stringify(parsed, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
