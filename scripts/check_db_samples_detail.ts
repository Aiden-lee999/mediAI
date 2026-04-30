import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all unique ingredientName samples
  const samples = await prisma.drug.findMany({
    where: {
      ingredientName: {
        not: null,
      },
    },
    select: {
      id: true,
      productName: true,
      ingredientName: true,
    },
    take: 50,
  });

  console.log(`샘플 (처음 50개):`);
  samples.forEach((s, i) => {
    // Show byte representation
    const bytes = Buffer.from(s.ingredientName || '', 'utf-8');
    console.log(`${i + 1}. ${s.productName.substring(0, 20)}`);
    console.log(`   ingredientName: "${s.ingredientName}"`);
    console.log(`   bytes (hex): ${bytes.toString('hex').substring(0, 60)}...`);
    console.log();
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
