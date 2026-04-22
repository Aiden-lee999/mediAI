import { callPublicDrugApi } from '../src/lib/publicDrugApiClient';

const targets = [
  ['DrbEasyDrugInfoService', '/getDrbEasyDrugList'],
  ['DrugPrdtPrmsnInfoService07', '/getDrugPrdtPrmsnInq07'],
  ['MdcinGrnIdntfcInfoService03', '/getMdcinGrnIdntfcInfoList03'],
  ['DrbBundleInfoService02', '/getDrbBundleList02'],
] as const;

function extractTotalCount(payload: any) {
  const direct = Number(payload?.body?.totalCount || payload?.response?.body?.totalCount || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const rawText = String(payload?.rawText || '');
  const m = rawText.match(/<totalCount>\s*(\d+)\s*<\/totalCount>/i);
  return m ? Number(m[1]) : 0;
}

async function main() {
  for (const [serviceName, operation] of targets) {
    try {
      const payload = await callPublicDrugApi({
        baseUrl: `https://apis.data.go.kr/1471000/${serviceName}`,
        operation,
        query: { numOfRows: 1, pageNo: 1 },
        timeoutMs: 15000,
        retries: 1,
      });

      const total = extractTotalCount(payload);
      console.log(`${serviceName}${operation} TOTAL=${total}`);
    } catch (error: any) {
      console.log(`${serviceName}${operation} ERROR=${String(error?.message || error)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
