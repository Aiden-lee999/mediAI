import { PrismaClient } from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import { loadRichDrugPrices } from '../src/lib/drugPricesCsv';
import { callPublicDrugApi, extractItems } from '../src/lib/publicDrugApiClient';

const prisma = new PrismaClient();

type Row = {
  id: string;
  productName: string;
  ingredientName: string | null;
  company: string | null;
  standardCode: string | null;
  insuranceCode: string | null;
  atcCode: string | null;
  priceLabel: string | null;
  usageFrequency: number;
  reimbursement: string | null;
};

type ProbeStats = {
  usageProbeAttempts: number;
  usageProbeFailures: number;
  usageProbeTimeouts: number;
  usageProbeHits: number;
  usageQuotaExceeded: boolean;
  usageServiceNoDataLikely: boolean;
};

type UsageProbeSample = {
  rowId: string;
  productName: string;
  ingredientName: string | null;
  atcCode: string | null;
  operation: string;
  query: Record<string, string | number>;
  totalCount: number;
  resultMsg: string;
  itemCount: number;
};

type DebugOptions = {
  enabled: boolean;
  maxSamples: number;
  samples: UsageProbeSample[];
};

function toDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function toProductCode(value: string | null | undefined) {
  const digits = toDigits(value);
  if (!digits) return '';
  if (digits.length === 9) return digits;
  if (digits.length === 13 && digits.startsWith('880')) return digits.slice(3, 12);
  return '';
}

function normalizeBaseProductName(name: string) {
  return (name || '')
    .replace(/&nbsp;/gi, ' ')
    .split('(')[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLooseName(name: string) {
  return normalizeBaseProductName(name)
    .toLowerCase()
    .replace(/[\s\-_/.,]/g, '');
}

function normalizeCompany(name: string | null | undefined) {
  return (name || '').toLowerCase().replace(/[\s()]/g, '');
}

function normalizeIngredient(name: string | null | undefined) {
  return (name || '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[\s\-_/.,]/g, '');
}

function hasKoreanText(value: string | null | undefined) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value || '');
}

function isNonReimbursed(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '').includes('비급여');
}

function parsePrice(value: string) {
  const clean = String(value || '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  return `${clean}원`;
}

function parseNum(value: unknown) {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function buildUsageMonths() {
  const now = new Date();
  const out: string[] = [];

  // Prefer stable historical windows first (recent full years), then recent rolling months.
  const anchors = ['202312', '202212', '202112', '202012', '201912'];
  for (const m of anchors) out.push(m);

  for (let i = 1; i <= 12; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  return [...new Set(out)];
}

async function fetchPriceFromApi(row: Row): Promise<string> {
  const baseUrl = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2';
  const operation = '/getDgamtList';
  const baseName = normalizeBaseProductName(row.productName);
  const company = (row.company || '').trim();
  const productCode = toProductCode(row.standardCode) || toProductCode(row.insuranceCode);
  const stdDigits = toDigits(row.standardCode);

  const candidates: Array<Record<string, string>> = [];
  if (productCode) {
    candidates.push({ mdcinCd: productCode });
    candidates.push({ itemCd: productCode });
    candidates.push({ ediCode: productCode });
  }
  if (stdDigits) {
    candidates.push({ mdcinCd: stdDigits });
    candidates.push({ itemCd: stdDigits });
    candidates.push({ ediCode: stdDigits });
  }
  if (baseName) {
    candidates.push({ itemNm: baseName });
    candidates.push({ itemName: baseName });
  }
  if (baseName && company) {
    candidates.push({ itemNm: baseName, entpName: company });
    candidates.push({ itemName: baseName, entpName: company });
    candidates.push({ itemNm: baseName, entpNm: company });
  }

  for (const query of candidates) {
    try {
      const payload = await callPublicDrugApi({
        baseUrl,
        operation,
        serviceName: 'price-sync',
        timeoutMs: 10000,
        retries: 1,
        query: { numOfRows: 10, pageNo: 1, ...query },
      });
      const items = extractItems(payload);
      for (const item of items) {
        const priceRaw =
          String(item.maxAmt || item.amt || item.price || item.dgamt || item.upprAmt || item.ceilAmt || '').trim();
        const parsed = parsePrice(priceRaw);
        if (parsed) return parsed;
      }
    } catch {
      // best effort sync only
    }
  }

  return '';
}

async function fetchUsageFromApi(
  row: Row,
  probeStats: ProbeStats,
  debug: DebugOptions,
  useProductNameFallback: boolean,
  probeCapPerRow: number
): Promise<number> {
  if (probeStats.usageQuotaExceeded) return 0;

  const baseUrl = 'https://apis.data.go.kr/B551182/msupUserInfoService1.2';
  const months = buildUsageMonths();

  const ingredient = (row.ingredientName || '').replace(/\([^)]*\)/g, '').trim();
  const derivedKeyword = normalizeBaseProductName(row.productName)
    .replace(/[0-9]/g, ' ')
    .replace(/\b(mg|ml|mcg|g|tab|tablet|cap|capsule|inj|syrup)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const atcRaw = (row.atcCode || '').trim();
  const atc = atcRaw === '-' ? '' : atcRaw;
  const atc4 = atc.length >= 5 ? atc.slice(0, 5) : '';
  const atc3 = atc.length >= 4 ? atc.slice(0, 4) : '';
  const ingredientLooksUseful = Boolean(ingredient && ingredient !== '-' && hasKoreanText(ingredient));
  const usageKeyword = ingredientLooksUseful
    ? ingredient
    : (derivedKeyword || (useProductNameFallback ? normalizeBaseProductName(row.productName) : ''));
  if (!usageKeyword && !atc) return 0;

  const areaSeeds: Array<Record<string, string>> = [
    { sidoCd: '11' },
    { ctpvCd: '11' },
    { areaCd: '11' },
    { SIDO_CD: '11' },
    { sidoCd: '26' },
  ];
  const classSeeds = ['clCd', 'classCd', 'CL_CD', 'CLASS_CD'];

  const withArea = (base: Record<string, string>) => [base, ...areaSeeds.map((area) => ({ ...base, ...area }))];
  const withClass = (base: Record<string, string>, value: string) => [
    base,
    ...classSeeds.map((k) => ({ ...base, [k]: value })),
  ];

  const operationQueries: Array<{ operation: string; queries: Array<Record<string, string>> }> = [
    {
      operation: '/getCmpnAreaList1.2',
      queries: usageKeyword
        ? [
            ...withArea({ mdcinCmpnGnrlNm: usageKeyword }),
            ...withArea({ gnrlNm: usageKeyword }),
            ...withArea({ GNRL_NM: usageKeyword }),
            ...withArea({ mdcinCmpnCd: usageKeyword }),
            ...withArea({ cmpnCd: usageKeyword }),
          ]
        : [],
    },
    {
      operation: '/getAtcStp4AreaList1.2',
      queries: atc4
        ? [
            ...withArea({ atcCd: atc4 }),
            ...withArea({ atcCode: atc4 }),
            ...withArea({ ATC_CD: atc4 }),
            ...withArea({ atcStp4Cd: atc4 }),
          ]
        : [],
    },
    {
      operation: '/getAtcStp4ClList1.2',
      queries: atc4
        ? [
            ...withClass({ atcCd: atc4 }, atc4),
            ...withClass({ atcCode: atc4 }, atc4),
            ...withClass({ ATC_CD: atc4 }, atc4),
            ...withClass({ atcStp4Cd: atc4 }, atc4),
            ...withClass({ clCd: atc4 }, atc4),
            ...withClass({ classCd: atc4 }, atc4),
          ]
        : [],
    },
    {
      operation: '/getAtcStp3ClList1.2',
      queries: atc3
        ? [
            ...withClass({ atcCd: atc3 }, atc3),
            ...withClass({ atcCode: atc3 }, atc3),
            ...withClass({ ATC_CD: atc3 }, atc3),
            ...withClass({ atcStp3Cd: atc3 }, atc3),
            ...withClass({ clCd: atc3 }, atc3),
            ...withClass({ classCd: atc3 }, atc3),
          ]
        : [],
    },
    {
      operation: '/getAtcStp3AreaList1.2',
      queries: atc3
        ? [
            ...withArea({ atcCd: atc3 }),
            ...withArea({ atcCode: atc3 }),
            ...withArea({ ATC_CD: atc3 }),
          ]
        : [],
    },
    {
      operation: '/getCmpnClList1.2',
      queries: usageKeyword
        ? [
            ...withClass({ mdcinCmpnGnrlNm: usageKeyword }, usageKeyword),
            ...withClass({ gnrlNm: usageKeyword }, usageKeyword),
            ...withClass({ GNRL_NM: usageKeyword }, usageKeyword),
            ...withClass({ mdcinCmpnCd: usageKeyword }, usageKeyword),
            ...withClass({ cmpnCd: usageKeyword }, usageKeyword),
          ]
        : [],
    },
  ];

  let localAttempts = 0;

  for (const month of months) {
    for (const { operation, queries } of operationQueries) {
      for (const query of queries) {
        if (localAttempts >= probeCapPerRow) {
          return 0;
        }
        try {
          probeStats.usageProbeAttempts += 1;
          localAttempts += 1;
          const payload = await callPublicDrugApi({
            baseUrl,
            operation,
            serviceName: 'usage-sync',
            timeoutMs: 10000,
            retries: 0,
            query: { numOfRows: 10, pageNo: 1, mdcareYm: month, ...query },
          });
          const items = extractItems(payload);
          const totalCount = Number(payload?.response?.body?.totalCount || 0);
          const resultMsg = String(payload?.response?.header?.resultMsg || '');

          if (debug.enabled && totalCount === 0 && debug.samples.length < debug.maxSamples) {
            debug.samples.push({
              rowId: row.id,
              productName: row.productName,
              ingredientName: row.ingredientName,
              atcCode: row.atcCode,
              operation,
              query: { mdcareYm: month, ...query },
              totalCount,
              resultMsg,
              itemCount: items.length,
            });
          }

          for (const item of items) {
            const n =
              parseNum(item.useCnt) ||
              parseNum(item.prescriptCnt) ||
              parseNum(item.cnt) ||
              parseNum(item.totCnt) ||
              parseNum(item.totUseCnt) ||
              parseNum(item.totUseQty) ||
              parseNum(item.useQty) ||
              parseNum(item.qty) ||
              parseNum(item.mdcareCnt) ||
              parseNum(item.mdcareUseCnt) ||
              parseNum(item.ykihoCnt) ||
              parseNum(item.claimCnt) ||
              parseNum(item.caseCnt) ||
              parseNum(item.prescrCnt);
            if (n > 0) {
              probeStats.usageProbeHits += 1;
              return n;
            }
          }
        } catch (error) {
          probeStats.usageProbeFailures += 1;
          const errorText = String(error || '');
          if (errorText.includes('(429)') || /quota exceeded/i.test(errorText)) {
            probeStats.usageQuotaExceeded = true;
            return 0;
          }
          if (String(error).toLowerCase().includes('abort')) {
            probeStats.usageProbeTimeouts += 1;
          }
          // best effort sync only
        }
      }
    }
  }

  return 0;
}

async function detectUsageServiceNoDataLikely() {
  const baseUrl = 'https://apis.data.go.kr/B551182/msupUserInfoService1.2';
  const probes = [
    {
      operation: '/getAtcStp4AreaList1.2',
      query: { mdcareYm: '202312', atcCd: 'N02BE', numOfRows: 1, pageNo: 1 },
    },
    {
      operation: '/getCmpnAreaList1.2',
      query: { mdcareYm: '202312', gnrlNm: '아세트아미노펜', numOfRows: 1, pageNo: 1 },
    },
    {
      operation: '/getAtcStp3AreaList1.2',
      query: { mdcareYm: '202212', atcCd: 'N02B', numOfRows: 1, pageNo: 1 },
    },
  ];

  let normalZeroCount = 0;

  for (const p of probes) {
    try {
      const payload = await callPublicDrugApi({
        baseUrl,
        operation: p.operation,
        query: p.query,
        timeoutMs: 8000,
        retries: 0,
      });
      const resultCode = String(payload?.response?.header?.resultCode || '');
      const totalCount = Number(payload?.response?.body?.totalCount || 0);
      if (resultCode === '00' && totalCount === 0) {
        normalZeroCount += 1;
      }
    } catch {
      return false;
    }
  }

  return normalZeroCount === probes.length;
}

async function main() {
  const limitArg = process.argv.find((x) => x.startsWith('--limit='));
  const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : 1000;
  const debugSample = process.argv.includes('--debug-sample');
  const debugSampleMaxArg = process.argv.find((x) => x.startsWith('--debug-sample-max='));
  const debugSampleMax = debugSampleMaxArg ? Math.max(1, Number(debugSampleMaxArg.split('=')[1])) : 200;
  const useProductNameFallback = process.argv.includes('--usage-from-product-name');
  const skipUsage = process.argv.includes('--skip-usage');
  const skipPrice = process.argv.includes('--skip-price');
  const writeReport = process.argv.includes('--write-report');
  const replaceProxyUsage = process.argv.includes('--replace-proxy-usage');
  const usageProbeCapArg = process.argv.find((x) => x.startsWith('--usage-probe-cap='));
  const usageProbeCap = usageProbeCapArg ? Math.max(1, Number(usageProbeCapArg.split('=')[1])) : 240;
  const skipUsageWhenNoDataLikely = !process.argv.includes('--force-usage-probe');

  const csvPrices = await loadRichDrugPrices();

  // Build quick lookup by normalized product base name from CSV payload.
  const csvNamePriceMap = new Map<string, string>();
  for (const value of csvPrices.values()) {
    const normalized = normalizeLooseName(value.productName || '');
    const parsed = parsePrice(value.price || '');
    if (normalized && parsed && !csvNamePriceMap.has(normalized)) {
      csvNamePriceMap.set(normalized, parsed);
    }
  }

  const usageCandidateRows = skipUsage
    ? []
    : await prisma.drug.findMany({
        where: {
          usageFrequency: replaceProxyUsage ? { lte: 1 } : 0,
          OR: [
            {
              AND: [
                { ingredientName: { not: null } },
                { ingredientName: { not: '' } },
                { ingredientName: { not: '-' } },
              ],
            },
            {
              AND: [
                { atcCode: { not: null } },
                { atcCode: { not: '' } },
                { atcCode: { not: '-' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          productName: true,
          ingredientName: true,
          company: true,
          standardCode: true,
          insuranceCode: true,
          atcCode: true,
          priceLabel: true,
          usageFrequency: true,
          reimbursement: true,
        },
        take: limit,
        orderBy: { updatedAt: 'asc' },
      });

  const priceCandidateRows = skipPrice
    ? []
    : await prisma.drug.findMany({
        where: {
          OR: [
            { priceLabel: null },
            { priceLabel: '' },
            { priceLabel: { contains: '가격정보없음' } },
          ],
        },
        select: {
          id: true,
          productName: true,
          ingredientName: true,
          company: true,
          standardCode: true,
          insuranceCode: true,
          atcCode: true,
          priceLabel: true,
          usageFrequency: true,
          reimbursement: true,
        },
        take: limit,
        orderBy: { updatedAt: 'asc' },
      });

  const rows = await prisma.drug.findMany({
    where: {
      OR: [
        { priceLabel: null },
        { priceLabel: '' },
        { priceLabel: { contains: '가격정보없음' } },
        { usageFrequency: 0 },
      ],
    },
    select: {
      id: true,
      productName: true,
      ingredientName: true,
      company: true,
      standardCode: true,
      insuranceCode: true,
      atcCode: true,
      priceLabel: true,
      usageFrequency: true,
      reimbursement: true,
    },
    take: Math.max(limit * 2, limit),
    orderBy: { updatedAt: 'asc' },
  });

  const mergedById = new Map<string, Row>();
  for (const row of priceCandidateRows) mergedById.set(row.id, row);
  for (const row of usageCandidateRows) mergedById.set(row.id, row);
  for (const row of rows) {
    if (mergedById.size >= limit) break;
    if (!mergedById.has(row.id)) mergedById.set(row.id, row);
  }
  const selectedRows = [...mergedById.values()].slice(0, limit);

  // Build known price map from already-priced rows for safe intra-product propagation.
  const knownPriceRows = await prisma.drug.findMany({
    where: { priceLabel: { not: null } },
    select: { productName: true, priceLabel: true, company: true, ingredientName: true },
    take: 200000,
  });
  const knownByBase = new Map<string, string>();
  const knownByLoose = new Map<string, string>();
  const knownByCompanyLoose = new Map<string, string>();
  const ingredientPriceBuckets = new Map<string, Map<string, number>>();

  for (const row of knownPriceRows) {
    const base = normalizeBaseProductName(row.productName || '');
    const loose = normalizeLooseName(row.productName || '');
    const company = normalizeCompany(row.company);
    const ingredient = normalizeIngredient(row.ingredientName);
    const parsed = parsePrice(row.priceLabel || '');

    if (!parsed) continue;

    if (base && parsed && !knownByBase.has(base)) {
      knownByBase.set(base, parsed);
    }
    if (loose && !knownByLoose.has(loose)) {
      knownByLoose.set(loose, parsed);
    }
    if (company && loose) {
      const key = `${company}|${loose}`;
      if (!knownByCompanyLoose.has(key)) {
        knownByCompanyLoose.set(key, parsed);
      }
    }
    if (ingredient) {
      const bucket = ingredientPriceBuckets.get(ingredient) ?? new Map<string, number>();
      bucket.set(parsed, (bucket.get(parsed) || 0) + 1);
      ingredientPriceBuckets.set(ingredient, bucket);
    }
  }

  // Only accept ingredient-based inference when one dominant/unique price exists.
  const knownByIngredient = new Map<string, string>();
  for (const [ingredient, bucket] of ingredientPriceBuckets.entries()) {
    const sorted = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const second = sorted[1];
    if (!top) continue;
    const isSinglePrice = sorted.length === 1 && top[1] >= 2;
    const isDominant = top[1] >= 3 && (!second || top[1] >= second[1] * 3);
    if (isSinglePrice || isDominant) {
      knownByIngredient.set(ingredient, top[0]);
    }
  }

  let priceUpdated = 0;
  let usageUpdated = 0;
  const probeStats: ProbeStats = {
    usageProbeAttempts: 0,
    usageProbeFailures: 0,
    usageProbeTimeouts: 0,
    usageProbeHits: 0,
    usageQuotaExceeded: false,
    usageServiceNoDataLikely: false,
  };
  const debugOptions: DebugOptions = {
    enabled: debugSample,
    maxSamples: debugSampleMax,
    samples: [],
  };

  if (!skipUsage) {
    probeStats.usageServiceNoDataLikely = await detectUsageServiceNoDataLikely();
  }

  for (const row of selectedRows) {
    let newPrice = parsePrice(row.priceLabel || '');
    let newUsage = row.usageFrequency || 0;

    if (!skipPrice && !newPrice) {
      const lookupCodes = [
        row.standardCode || '',
        row.insuranceCode || '',
        toDigits(row.standardCode),
        toDigits(row.insuranceCode),
        toProductCode(row.standardCode),
        toProductCode(row.insuranceCode),
      ].filter(Boolean);

      for (const code of lookupCodes) {
        const data = csvPrices.get(code);
        const parsed = parsePrice(data?.price || '');
        if (parsed) {
          newPrice = parsed;
          break;
        }
      }

      if (!newPrice) {
        const base = normalizeBaseProductName(row.productName);
        newPrice = knownByBase.get(base) || '';
      }

      if (!newPrice) {
        const loose = normalizeLooseName(row.productName);
        newPrice = knownByLoose.get(loose) || '';
      }

      if (!newPrice) {
        const loose = normalizeLooseName(row.productName);
        newPrice = csvNamePriceMap.get(loose) || '';
      }

      if (!newPrice) {
        const company = normalizeCompany(row.company);
        const loose = normalizeLooseName(row.productName);
        if (company && loose) {
          newPrice = knownByCompanyLoose.get(`${company}|${loose}`) || '';
        }
      }

      if (!newPrice) {
        const ingredient = normalizeIngredient(row.ingredientName);
        if (ingredient) {
          newPrice = knownByIngredient.get(ingredient) || '';
        }
      }

      // Skip remote price lookup for clearly non-reimbursed products.
      if (!newPrice && isNonReimbursed(row.reimbursement)) {
        newPrice = '비급여';
      }

      if (!newPrice) {
        newPrice = await fetchPriceFromApi(row);
      }
    }

    const shouldProbeUsage =
      !skipUsage &&
      (!probeStats.usageServiceNoDataLikely || !skipUsageWhenNoDataLikely) &&
      (newUsage <= 0 || (replaceProxyUsage && row.usageFrequency <= 1));
    if (shouldProbeUsage) {
      newUsage = await fetchUsageFromApi(row, probeStats, debugOptions, useProductNameFallback, usageProbeCap);
    }

    const patch: { priceLabel?: string; usageFrequency?: number } = {};
    if (newPrice && !parsePrice(row.priceLabel || '')) {
      patch.priceLabel = newPrice;
    }
    if (newUsage > 0 && (row.usageFrequency <= 0 || (replaceProxyUsage && row.usageFrequency <= 1 && newUsage > row.usageFrequency))) {
      patch.usageFrequency = newUsage;
    }

    if (Object.keys(patch).length > 0) {
      await prisma.drug.update({ where: { id: row.id }, data: patch });
      if (patch.priceLabel) priceUpdated += 1;
      if (patch.usageFrequency) usageUpdated += 1;

      if (patch.priceLabel) {
        const base = normalizeBaseProductName(row.productName);
        const loose = normalizeLooseName(row.productName);
        const company = normalizeCompany(row.company);
        const ingredient = normalizeIngredient(row.ingredientName);

        if (base && !knownByBase.has(base)) {
          knownByBase.set(base, patch.priceLabel);
        }
        if (loose && !knownByLoose.has(loose)) {
          knownByLoose.set(loose, patch.priceLabel);
        }
        if (company && loose) {
          const key = `${company}|${loose}`;
          if (!knownByCompanyLoose.has(key)) {
            knownByCompanyLoose.set(key, patch.priceLabel);
          }
        }
        if (ingredient && !knownByIngredient.has(ingredient)) {
          knownByIngredient.set(ingredient, patch.priceLabel);
        }
      }
    }
  }

  if (debugOptions.enabled && debugOptions.samples.length > 0) {
    await writeFile('tmp_usage_probe_samples.json', JSON.stringify(debugOptions.samples, null, 2), 'utf8');
  }

  const summary = {
    scanned: rows.length,
    selected: selectedRows.length,
    priceUpdated,
    usageUpdated,
    usageProbeStats: probeStats,
    useProductNameFallback,
    skipUsage,
    skipPrice,
    replaceProxyUsage,
    usageProbeCap,
    skipUsageWhenNoDataLikely,
    usageSkipReason:
      probeStats.usageServiceNoDataLikely && skipUsageWhenNoDataLikely
        ? 'msup preflight returned normal+zero on all sentinels'
        : null,
    debugSampleWritten: debugOptions.enabled && debugOptions.samples.length > 0,
    debugSampleCount: debugOptions.samples.length,
  };

  if (writeReport) {
    await writeFile('tmp_sync_report.json', JSON.stringify(summary, null, 2), 'utf8');
  }

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
