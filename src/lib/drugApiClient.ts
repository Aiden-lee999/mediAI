import { prisma } from '@/lib/prisma';

type RawDrugJson = {
  itemImage?: string;
  BIG_ITEM_IMAGE_DOCID?: string;
  SMALL_ITEM_IMAGE_DOCID?: string;
};

function extractDrugQuery(input: string): string {
  const stopwords = new Set<string>([
    '\uC57D',
    '\uC57D\uAC00',
    '\uAC00\uACA9',
    '\uC774\uBBF8\uC9C0',
    '\uC54C\uB824\uC918',
    '\uBD80\uC791\uC6A9',
    '\uD6A8\uACFC',
    '\uC5D0',
    '\uB300\uD574',
  ]);

  const tokens = input
    .replace(/[.,!?/\\()[\]{}:;"']/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const candidate = tokens.find((token) => token.length >= 2 && !stopwords.has(token));
  return candidate ?? '';
}

export async function fetchDrugInfo(drugName: string) {
  try {
    const query = extractDrugQuery(drugName || '');
    if (!query) return null;

    const target = await prisma.drug.findFirst({
      where: {
        productName: { contains: query, mode: 'insensitive' },
      },
      orderBy: {
        usageFrequency: 'desc',
      },
    });

    if (!target) return null;

    let imageUrl = 'https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/1OKRXo9l4D5';
    if (target.rawJson) {
      try {
        const parsed = JSON.parse(target.rawJson) as RawDrugJson;
        const docId = parsed.itemImage || parsed.BIG_ITEM_IMAGE_DOCID || parsed.SMALL_ITEM_IMAGE_DOCID;
        if (docId) {
          imageUrl = `https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/${String(docId)}`;
        }
      } catch {
        // Keep fallback image URL when JSON parsing fails.
      }
    }

    let priceInfo = 'price unavailable (non-reimbursed)';
    if (target.priceLabel?.trim()) {
      priceInfo = target.priceLabel.trim();
    } else if (target.reimbursement?.trim() && target.reimbursement !== '\uBE44\uAE09\uC5EC') {
      priceInfo = `${target.reimbursement} (reimbursement cap)`;
    }

    const productName = target.productName || 'unknown product';
    const company = target.company || 'unknown company';
    const category = target.type || 'unknown class';
    const ingredient = target.ingredientName || 'unknown ingredient';

    return {
      name: productName,
      imageUrl,
      priceInfo,
      mfdsData: `MFDS approval data: [${productName}] ${company}, ${category}, ingredient ${ingredient}`,
      hiraData: `HIRA listed unit price: ${priceInfo}`,
    };
  } catch (error) {
    console.error('fetchDrugInfo Prisma Error:', error);
    return null;
  }
}
