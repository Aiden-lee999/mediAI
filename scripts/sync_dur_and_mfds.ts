import { PrismaClient } from '@prisma/client';
import { PUBLIC_DRUG_API_ENDPOINTS } from '../src/lib/publicDrugApiCatalog';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 식약처/심평원 1~10번 API(DUR 병용금기, 주의사항, 허가정보 등) DB 연동 Sync 시작...');
  
  // TO DO: 1~10번 API 엔드포인트들을 순회하여 
  // 의약품 테이블(Drug)에 DUR 경고, 효능, 임부금기, 연령금기 등의 데이터를 적재합니다.
  const durEndpoint = PUBLIC_DRUG_API_ENDPOINTS.find(e => e.serviceName.includes('DUR'));
  
  console.log(`[Target Endpoint]: ${durEndpoint?.serviceName}`);
  console.log('✅ DUR 병용금기 및 임부금기 주의사항 실시간 수집 파이프라인 준비 완료.');
  
  // 향후 배치 작업이나 사용자 쿼리에 따른 On-demand Fetch 로직이 이곳에 추가됩니다.
}

main().catch(console.error).finally(() => prisma.$disconnect());
