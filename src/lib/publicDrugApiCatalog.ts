export type PublicDrugApiEndpoint = {
  serviceName: string;
  baseUrl: string;
  defaultFormat: 'JSON+XML' | 'XML';
  operations: string[];
};

// data.go.kr 마이페이지 캡처 기준으로 정리한 의약/의료 공공 API 목록
export const PUBLIC_DRUG_API_ENDPOINTS: PublicDrugApiEndpoint[] = [
  {
    serviceName: '식품의약품안전처_묶음의약품정보서비스',
    baseUrl: 'https://apis.data.go.kr/1471000/DrbBundleInfoService02',
    defaultFormat: 'JSON+XML',
    operations: ['/getDrbBundleList02'],
  },
  {
    serviceName: '식품의약품안전처_의약품안전사용서비스(DUR)성분정보',
    baseUrl: 'https://apis.data.go.kr/1471000/DURIdrntlInfoService03',
    defaultFormat: 'JSON+XML',
    operations: [
      '/getUsjntTaboonInfoList02',
      '/getSpcifyAgrdeTaboonInfoList02',
      '/getPwnmTaboonInfoList02',
      '/getCpctyAtentInfoList02',
      '/getMdctnPdAtentInfoList02',
      '/getOdsnAtentInfoList02',
      '/getEfcyDpcltInfoList02',
    ],
  },
  {
    serviceName: '식품의약품안전처_의약품안전사용서비스(DUR)품목정보',
    baseUrl: 'https://apis.data.go.kr/1471000/DURPrdlstInfoService03',
    defaultFormat: 'JSON+XML',
    operations: [
      '/getUsjntTabooInfoList03',
      '/getOdsnAtentInfoList03',
      '/getDURPrdlstInfoList03',
      '/getSpcifyAgrdeTabooInfoList03',
      '/getCpctyAtentInfoList03',
      '/getMdctnPdAtentInfoList03',
      '/getEfcyDpcltInfoList03',
      '/getSeobangjeongPartitAtentInfoList03',
      '/getPwnmTabooInfoList03',
    ],
  },
  {
    serviceName: '식품의약품안전처_의약품개요정보(안전요약)',
    baseUrl: 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService',
    defaultFormat: 'JSON+XML',
    operations: ['/getDrbEasyDrugList'],
  },
  {
    serviceName: '식품의약품안전처_의약품 낱알식별 정보',
    baseUrl: 'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03',
    defaultFormat: 'JSON+XML',
    operations: ['/getMdcinGrnIdntfcInfoList03'],
  },
  {
    serviceName: '식품의약품안전처_의약품 제품 허가정보',
    baseUrl: 'https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07',
    defaultFormat: 'JSON+XML',
    operations: ['/getDrugPrdtPrmsnInq07', '/getDrugPrdtPrmsnDtlInq06', '/getDrugPrdtMcpnDtlInq07'],
  },
  {
    serviceName: '건강보험심사평가원_비급여진료비정보조회서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/nonPaymentDamtInfoService',
    defaultFormat: 'XML',
    operations: [
      '/getNonPaymentItemHospDtlList',
      '/getNonPaymentItemHospList2',
      '/getNonPaymentItemCodeList2',
      '/getNonPaymentItemCodeList',
      '/getNonPaymentItemHospList',
      '/getNonPaymentItemClcdList',
    ],
  },
  {
    serviceName: '건강보험심사평가원_의료영상진료정보조회서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/medImagInfoService',
    defaultFormat: 'XML',
    operations: ['/getMedImgList'],
  },
  {
    serviceName: '건강보험심사평가원_질병정보서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/diseaseInfoService1',
    defaultFormat: 'XML',
    operations: ['/getDissNameCodeList1', '/getDissByHspItlzPrgnStats1', '/getDissByGenderAgeStats1', '/getDissByClassesStats1', '/getDissByAreaStats1'],
  },
  {
    serviceName: '건강보험심사평가원_의약품성분약효정보조회서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/msupCmpnMeftInfoService',
    defaultFormat: 'XML',
    operations: ['/getMajorCmpnNmCdList'],
  },
  {
    serviceName: '건강보험심사평가원_의약품사용정보조회서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/msupUserInfoService1.2',
    defaultFormat: 'XML',
    operations: ['/getAtcStp4AreaList1.2', '/getAtcStp4ClList1.2', '/getAtcStp3AreaList1.2', '/getCmpnAreaList1.2'],
  },
  {
    serviceName: '건강보험심사평가원_약가기준정보조회서비스',
    baseUrl: 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2',
    defaultFormat: 'XML',
    operations: ['/getDgamtList'],
  },
];

// 캡처에 표시된 일반 인증키. 운영 시에는 반드시 .env.local 의 DATA_GO_KR_SERVICE_KEY 를 우선 사용.
export const DATA_GO_KR_FALLBACK_SERVICE_KEY = 'a73d6c98ef59e73ed780ffb961f298b1cc9fecb40ad0fd0ffab923a67a02027d';
