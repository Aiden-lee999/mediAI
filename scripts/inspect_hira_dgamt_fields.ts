import { callPublicDrugApi, extractItems } from '../src/lib/publicDrugApiClient';

async function main() {
  const payload = await callPublicDrugApi({
    baseUrl: 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2',
    operation: '/getDgamtList',
    query: { numOfRows: 200, pageNo: 1 },
    timeoutMs: 30000,
    retries: 2,
  });

  const items = extractItems(payload);
  const first = items[0] || {};
  const keys = Object.keys(first);

  console.log(
    JSON.stringify(
      {
        count: items.length,
        keys,
        first,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
