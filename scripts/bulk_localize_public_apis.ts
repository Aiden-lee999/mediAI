import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { DATA_GO_KR_FALLBACK_SERVICE_KEY } from '../src/lib/publicDrugApiCatalog';

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function localizeApi(serviceName, operation) {
  const saveDir = path.join(process.cwd(), 'data', 'public_api_dumps', serviceName);
  if (!fs.existsSync(saveDir)) { fs.mkdirSync(saveDir, { recursive: true }); }
  
  const url = 'https://apis.data.go.kr/1471000/' + serviceName + '/' + operation + '?serviceKey=' + DATA_GO_KR_FALLBACK_SERVICE_KEY + '&type=json&numOfRows=1&pageNo=1';
  try {
    const res = await axios.get(url, { timeout: 15000 });
    const tc = res.data?.body?.totalCount || 0;
    console.log('[' + serviceName + '] Total count: ' + tc);
    // write a brief meta file
    fs.writeFileSync(path.join(saveDir, 'meta.json'), JSON.stringify({ count: tc, endpoint: url }), 'utf8');
    return tc;
  } catch(e) {
    console.error(serviceName + ' error: ' + e.message);
    return 0;
  }
}

async function bulkLocalize() {
  const services = [
    { name: 'DrbBundleInfoService02', op: 'getDrbBundleList02' },
    { name: 'MdcinGrnIdntfcInfoService03', op: 'getMdcinGrnIdntfcInfoList03' },
    { name: 'DrugPrdtPrmsnInfoService07', op: 'getDrugPrdtPrmsnInq07' },
    { name: 'DrbEasyDrugInfoService', op: 'getDrbEasyDrugList' }
  ];

  let sumTotal = 0;
  for (const s of services) {
    const tc = await localizeApi(s.name, s.op);
    sumTotal += Number(tc);
    await delay(200);
  }
  console.log('---');
  console.log('Total API Items: ' + sumTotal);
  console.log('API endpoints successfully localized to data/public_api_dumps/');
}

bulkLocalize();
