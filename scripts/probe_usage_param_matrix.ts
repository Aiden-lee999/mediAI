import { PrismaClient } from '@prisma/client';
import { callPublicDrugApi } from '../src/lib/publicDrugApiClient';

type ProbeResult = {
  operation: string;
  query: Record<string, string | number>;
  totalCount: number;
  resultMsg: string;
};

type DrugSeed = {
  productName: string;
  ingredientName: string | null;
  atcCode: string | null;
};

const prisma = new PrismaClient();

function argNum(name: string, fallback: number) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const n = Number(arg.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function baseName(name: string) {
  return (name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasKorean(value: string) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value || '');
}

function uniq(list: string[]) {
  return [...new Set(list.filter(Boolean))];
}

function pushIfCap(out: Record<string, string>[], candidate: Record<string, string>, cap: number) {
  if (out.length < cap) out.push(candidate);
}

async function buildCandidates(seedLimit: number) {
  const rows = await prisma.drug.findMany({
    where: {
      OR: [{ usageFrequency: { lte: 1 } }, { priceLabel: { contains: '가격정보없음' } }],
    },
    select: {
      productName: true,
      ingredientName: true,
      atcCode: true,
    },
    take: seedLimit,
    orderBy: { updatedAt: 'asc' },
  });

  const seeds = rows as DrugSeed[];
  const atc4 = uniq(
    seeds
      .map((r) => (r.atcCode || '').trim())
      .filter((x) => x && x !== '-' && x.length >= 5)
      .map((x) => x.slice(0, 5))
      .concat(['A02BC', 'C10AA', 'N02BE', 'J01DC'])
  );

  const atc3 = uniq(
    seeds
      .map((r) => (r.atcCode || '').trim())
      .filter((x) => x && x !== '-' && x.length >= 4)
      .map((x) => x.slice(0, 4))
      .concat(['A02B', 'C10A', 'N02B', 'J01D'])
  );

  const cmpnCodeCandidates = uniq(
    seeds
      .map((r) => (r.ingredientName || '').trim())
      .filter((x) => /^[A-Z0-9]{5,}$/.test(x) || /[A-Z]{2,}$/.test(x))
      .concat(['286000ATB', '125201ACH'])
  );

  const cmpnNameCandidates = uniq(
    seeds
      .map((r) => {
        const ingredient = (r.ingredientName || '').trim();
        if (hasKorean(ingredient)) return ingredient;
        const product = baseName(r.productName || '');
        return hasKorean(product) ? product : '';
      })
      .filter(Boolean)
  );

  return {
    atc4: atc4.slice(0, 20),
    atc3: atc3.slice(0, 20),
    cmpnCodeCandidates: cmpnCodeCandidates.slice(0, 30),
    cmpnNameCandidates: cmpnNameCandidates.slice(0, 30),
  };
}

function buildOperationQueries(candidates: {
  atc4: string[];
  atc3: string[];
  cmpnCodeCandidates: string[];
  cmpnNameCandidates: string[];
}) {
  const areaPairs = [
    { key: 'sidoCd', value: '11' },
    { key: 'ctpvCd', value: '11' },
    { key: 'areaCd', value: '11' },
    { key: 'SIDO_CD', value: '11' },
    { key: 'sidoCd', value: '26' },
    { key: 'ctpvCd', value: '41' },
  ];

  const clKeys = ['clCd', 'classCd', 'CL_CD', 'CLASS_CD'];
  const atc4Keys = ['atcCd', 'atcCode', 'ATC_CD', 'atcStp4Cd', 'ATC_STP4_CD'];
  const atc3Keys = ['atcCd', 'atcCode', 'ATC_CD', 'atcStp3Cd', 'ATC_STP3_CD'];
  const cmpnCodeKeys = ['mdcinCmpnCd', 'MDCIN_CMPN_CD', 'cmpnCd', 'CMPN_CD'];
  const cmpnNameKeys = ['mdcinCmpnGnrlNm', 'gnrlNm', 'GNRL_NM'];

  const operationQueries = new Map<string, Array<Record<string, string>>>();

  const atc4AreaQueries: Array<Record<string, string>> = [];
  for (const atc of candidates.atc4) {
    for (const atcKey of atc4Keys) {
      pushIfCap(atc4AreaQueries, { [atcKey]: atc }, 60);
      for (const area of areaPairs) {
        pushIfCap(atc4AreaQueries, { [atcKey]: atc, [area.key]: area.value }, 120);
      }
    }
  }
  operationQueries.set('/getAtcStp4AreaList1.2', atc4AreaQueries);

  const atc3AreaQueries: Array<Record<string, string>> = [];
  for (const atc of candidates.atc3) {
    for (const atcKey of atc3Keys) {
      pushIfCap(atc3AreaQueries, { [atcKey]: atc }, 60);
      for (const area of areaPairs) {
        pushIfCap(atc3AreaQueries, { [atcKey]: atc, [area.key]: area.value }, 120);
      }
    }
  }
  operationQueries.set('/getAtcStp3AreaList1.2', atc3AreaQueries);

  const atc4ClQueries: Array<Record<string, string>> = [];
  for (const atc of candidates.atc4) {
    for (const atcKey of atc4Keys) {
      pushIfCap(atc4ClQueries, { [atcKey]: atc }, 60);
      for (const clKey of clKeys) {
        pushIfCap(atc4ClQueries, { [clKey]: atc }, 120);
        pushIfCap(atc4ClQueries, { [atcKey]: atc, [clKey]: atc }, 180);
      }
    }
  }
  operationQueries.set('/getAtcStp4ClList1.2', atc4ClQueries);

  const atc3ClQueries: Array<Record<string, string>> = [];
  for (const atc of candidates.atc3) {
    for (const atcKey of atc3Keys) {
      pushIfCap(atc3ClQueries, { [atcKey]: atc }, 60);
      for (const clKey of clKeys) {
        pushIfCap(atc3ClQueries, { [clKey]: atc }, 120);
        pushIfCap(atc3ClQueries, { [atcKey]: atc, [clKey]: atc }, 180);
      }
    }
  }
  operationQueries.set('/getAtcStp3ClList1.2', atc3ClQueries);

  const cmpnAreaQueries: Array<Record<string, string>> = [];
  for (const key of cmpnCodeKeys) {
    for (const code of candidates.cmpnCodeCandidates) {
      pushIfCap(cmpnAreaQueries, { [key]: code }, 80);
      for (const area of areaPairs) {
        pushIfCap(cmpnAreaQueries, { [key]: code, [area.key]: area.value }, 180);
      }
    }
  }
  for (const key of cmpnNameKeys) {
    for (const name of candidates.cmpnNameCandidates) {
      pushIfCap(cmpnAreaQueries, { [key]: name }, 240);
      for (const area of areaPairs) {
        pushIfCap(cmpnAreaQueries, { [key]: name, [area.key]: area.value }, 320);
      }
    }
  }
  operationQueries.set('/getCmpnAreaList1.2', cmpnAreaQueries);

  const cmpnClQueries: Array<Record<string, string>> = [];
  for (const key of cmpnCodeKeys) {
    for (const code of candidates.cmpnCodeCandidates) {
      pushIfCap(cmpnClQueries, { [key]: code }, 80);
      for (const clKey of clKeys) {
        pushIfCap(cmpnClQueries, { [key]: code, [clKey]: code }, 220);
      }
    }
  }
  for (const key of cmpnNameKeys) {
    for (const name of candidates.cmpnNameCandidates) {
      pushIfCap(cmpnClQueries, { [key]: name }, 280);
      for (const clKey of clKeys) {
        pushIfCap(cmpnClQueries, { [key]: name, [clKey]: name }, 360);
      }
    }
  }
  operationQueries.set('/getCmpnClList1.2', cmpnClQueries);

  return operationQueries;
}

async function run() {
  const attemptCap = argNum('attempt-cap', 800);
  const timeoutMs = argNum('timeout-ms', 2500);
  const seedLimit = argNum('seed-limit', 300);
  const maxHits = argNum('max-hits', 10);
  const months = ['202312', '202212', '202112', '202012', '201912'];
  const operations = [
    '/getAtcStp4AreaList1.2',
    '/getAtcStp4ClList1.2',
    '/getAtcStp3ClList1.2',
    '/getAtcStp3AreaList1.2',
    '/getCmpnAreaList1.2',
    '/getCmpnClList1.2',
  ];

  const candidates = await buildCandidates(seedLimit);
  const operationQueries = buildOperationQueries(candidates);

  console.log(
    JSON.stringify(
      {
        mode: 'start',
        attemptCap,
        timeoutMs,
        seedLimit,
        candidateSummary: {
          atc4: candidates.atc4.length,
          atc3: candidates.atc3.length,
          cmpnCodeCandidates: candidates.cmpnCodeCandidates.length,
          cmpnNameCandidates: candidates.cmpnNameCandidates.length,
        },
      },
      null,
      2
    )
  );

  const results: ProbeResult[] = [];
  let attempts = 0;
  let failures = 0;

  for (const month of months) {
    for (const operation of operations) {
      const queries = operationQueries.get(operation) || [];
      for (const querySeed of queries) {
        if (attempts >= attemptCap) {
          console.log(JSON.stringify({ done: true, reason: 'attempt-cap', attempts, failures, hits: results.length }, null, 2));
          return;
        }

        const query: Record<string, string | number> = {
          mdcareYm: month,
          numOfRows: 5,
          pageNo: 1,
          ...querySeed,
        };

        attempts += 1;
        if (attempts % 25 === 0) {
          console.log(JSON.stringify({ progress: attempts, failures, hits: results.length, operation }));
        }

        try {
          const payload = await callPublicDrugApi({
            baseUrl: 'https://apis.data.go.kr/B551182/msupUserInfoService1.2',
            operation,
            query,
            timeoutMs,
            retries: 0,
          });

          const totalCount = Number(payload?.response?.body?.totalCount || 0);
          const resultMsg = String(payload?.response?.header?.resultMsg || '');
          if (totalCount > 0) {
            const hit = { operation, query, totalCount, resultMsg };
            results.push(hit);
            console.log(JSON.stringify({ hit: true, ...hit }));
            if (results.length >= maxHits) {
              console.log(JSON.stringify({ done: true, reason: 'max-hits', attempts, failures, hits: results.length, results }, null, 2));
              return;
            }
          }
        } catch (error) {
          failures += 1;
          if (failures <= 3) {
            console.log(JSON.stringify({ warning: 'probe-failure', operation, query, error: String(error) }));
          }
        }
      }
    }
  }

  console.log(JSON.stringify({ done: true, reason: 'exhausted', attempts, failures, hits: results.length, results }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
