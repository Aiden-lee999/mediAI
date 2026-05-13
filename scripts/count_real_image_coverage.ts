import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractImageDoc(rawJson: string | null | undefined) {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const direct =
      String(parsed.itemImage || '') ||
      String(parsed.ITEM_IMAGE || '') ||
      String(parsed.itemImage1 || '') ||
      String(parsed.ITEM_IMAGE1 || '');
    const doc = String(parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID || '');
    return (direct || doc || '').trim();
  } catch {
    return '';
  }
}

async function main() {
  const rows = await prisma.drug.findMany({
    select: { rawJson: true },
  });

  let withRawImage = 0;
  let withoutRawImage = 0;

  for (const row of rows) {
    if (extractImageDoc(row.rawJson)) withRawImage += 1;
    else withoutRawImage += 1;
  }

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        withRawImage,
        withoutRawImage,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
