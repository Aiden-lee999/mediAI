import { callPublicDrugApi } from './src/lib/publicDrugApiClient.js';
callPublicDrugApi({
  serviceName: 'test',
  baseUrl: 'http://apis.data.go.kr/1471000/DrbEasyDrugInfoService',
  operation: '/getDrbEasyDrugList',
  query: { itemName: 'Å¸ÀÌ·¹³î', numOfRows: 1 }
}).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
