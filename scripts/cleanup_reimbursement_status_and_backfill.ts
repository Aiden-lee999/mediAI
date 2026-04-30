import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const beforeTotal = await prisma.drug.count();
  const beforeUnknown = await prisma.drug.count({
    where: {
      OR: [
        { reimbursement: null },
        { reimbursement: '' },
        { reimbursement: { contains: '급여구분미확인' } },
      ],
    },
  });

  // 1) Remove contaminated reimbursement values copied from cancel/status fields.
  const clearStatus = await prisma.drug.updateMany({
    where: {
      reimbursement: { startsWith: '상태:' },
    },
    data: {
      reimbursement: null,
    },
  });

  // 2) Mark as reimbursed when numeric price exists and reimbursement is unknown.
  const setReimbursed = await prisma.drug.updateMany({
    where: {
      OR: [
        { reimbursement: null },
        { reimbursement: '' },
        { reimbursement: { contains: '급여구분미확인' } },
      ],
      AND: [
        { priceLabel: { not: null } },
        { NOT: { priceLabel: { contains: '가격정보없음' } } },
        { NOT: { priceLabel: { contains: '비급여' } } },
      ],
    },
    data: {
      reimbursement: '급여',
    },
  });

  // 3) Mark as non-reimbursed when price label explicitly says 비급여.
  const setNonReimbursed = await prisma.drug.updateMany({
    where: {
      OR: [
        { reimbursement: null },
        { reimbursement: '' },
        { reimbursement: { contains: '급여구분미확인' } },
      ],
      priceLabel: { contains: '비급여' },
    },
    data: {
      reimbursement: '비급여',
    },
  });

  const afterUnknown = await prisma.drug.count({
    where: {
      OR: [
        { reimbursement: null },
        { reimbursement: '' },
        { reimbursement: { contains: '급여구분미확인' } },
      ],
    },
  });

  console.log(
    JSON.stringify(
      {
        before: {
          total: beforeTotal,
          unknown: beforeUnknown,
          unknownRate: beforeTotal > 0 ? Number((beforeUnknown / beforeTotal).toFixed(4)) : 0,
        },
        updates: {
          clearStatus: clearStatus.count,
          setReimbursed: setReimbursed.count,
          setNonReimbursed: setNonReimbursed.count,
        },
        after: {
          total: beforeTotal,
          unknown: afterUnknown,
          unknownRate: beforeTotal > 0 ? Number((afterUnknown / beforeTotal).toFixed(4)) : 0,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
