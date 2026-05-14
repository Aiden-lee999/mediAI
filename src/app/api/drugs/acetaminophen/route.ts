import { NextResponse } from 'next/server';
import acetaminophenRows from '../../../../../data/acetaminophen_products.json';
import acetaminophenImageUrls from '../../../../../data/acetaminophen_image_urls.json';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
};

type SourceRow = {
  code: string;
  productName: string;
  productEnglishName?: string;
  company?: string;
  ingredient?: string;
  additive?: string;
  atcCode?: string;
  type?: string;
  releaseDate?: string;
  status?: string;
  price?: string;
};

function normalizeCompanyKey(value: string) {
  return (value || '')
    .replace(/\(주\)|주식회사|㈜|\s+/g, '')
    .toLowerCase()
    .trim();
}

function parsePositivePrice(value: string | number | null | undefined) {
  const firstSegment = String(value ?? '').split('/')[0].replace(/,/g, '').trim();
  const match = firstSegment.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!match) return null;

  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function makeItem(row: SourceRow) {
  const type = row.type || '-';
  const rawPrice = String(row.price || '').trim().replace(/,/g, '');
  const fallbackPrice = type.includes('일반') ? '일반의약품 / 급여구분미확인' : '가격 미상 / 급여구분미확인';
  const priceLabel = parsePositivePrice(rawPrice) !== null ? `${rawPrice}원 / 급여구분미확인` : fallbackPrice;
  const imageUrl = (acetaminophenImageUrls as Record<string, string>)[row.code] || '';

  return {
    id: row.code,
    productName: row.productName,
    ingredientName: row.ingredient || row.productEnglishName || row.additive || '아세트아미노펜',
    company: row.company || '-',
    imageUrl,
    priceLabel,
    reimbursement: '급여구분미확인',
    insuranceCode: row.code,
    standardCode: row.code,
    atcCode: row.atcCode || '-',
    type,
    releaseDate: row.releaseDate || '-',
    usageFrequency: 0,
    brandClass: (row.company || '').includes('존슨앤드존슨') || row.productName.includes('타이레놀') ? '오리지널(대장약)' : '복제약(제네릭)',
    sourceService: '사용자 제공 아세트아미노펜 원본 캐시',
  };
}

const ALL_ITEMS = (acetaminophenRows as SourceRow[])
  .filter((row) => row.code && row.productName)
  .map(makeItem)
  .sort((a, b) => {
    const priceA = parsePositivePrice(a.priceLabel);
    const priceB = parsePositivePrice(b.priceLabel);
    if (priceA !== null && priceB !== null && priceA !== priceB) return priceA - priceB;
    if (priceA !== null && priceB === null) return -1;
    if (priceA === null && priceB !== null) return 1;
    return a.productName.localeCompare(b.productName, 'ko');
  });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '2000') || 2000, 1), 2000);
  const company = normalizeCompanyKey(url.searchParams.get('company') || '');
  const items = company
    ? ALL_ITEMS.filter((item) => normalizeCompanyKey(item.company).includes(company)).slice(0, limit)
    : ALL_ITEMS.slice(0, limit);

  return NextResponse.json(
    {
      success: true,
      count: items.length,
      items,
      fallbackUsed: false,
      source: 'acetaminophen-edge-cache',
    },
    { headers: CACHE_HEADERS }
  );
}
