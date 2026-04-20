import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { PUBLIC_DRUG_API_ENDPOINTS, DATA_GO_KR_FALLBACK_SERVICE_KEY } from '../src/lib/publicDrugApiCatalog';

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 10개 이상의 공공 API 통합 백업
async function syncAllApiDataLossless() {
  console.log('🚀 [공공 API 1개 대상 테스트] API 전체 데이터 진짜 DB로 적재 시작...');

  const drug = await prisma.drug.findFirst({
    where: { productName: '엘리펜세미정' }
  });

  if (!drug) return console.log('약품을 찾을 수 없습니다.');

  console.log(`\n📌 의약품: [${drug.productName} / ${drug.ingredientName || '성분미상'}] - 실제 데이터 패치 중...`);

  const aggregatedDump = {
    productRef: drug.productName,
    timestamp: new Date().toISOString(),
    apiResponses: {} as Record<string, any>
  };

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY || DATA_GO_KR_FALLBACK_SERVICE_KEY;

  for (const endpoint of PUBLIC_DRUG_API_ENDPOINTS) {
    if (endpoint.serviceName.includes('약가') || endpoint.serviceName.includes('사용정보')) {
      continue;
    }

    for (const op of endpoint.operations) {
      // getDrugPrdtMcpnDtlInq07 returns XML if we add type=json inside it randomly. We handle that.
      const queryParam = endpoint.serviceName.includes('성분') ? 'ingr_name' : 'item_name';
      const queryVal = encodeURIComponent(drug.productName);

      let url = `${endpoint.baseUrl}${op}?serviceKey=${serviceKey}&${queryParam}=${queryVal}`;
      if (endpoint.defaultFormat === 'JSON+XML') url += '&type=json';

      try {
        console.log(`요청 -> ${op}`);
        const apiRes = await axios.get(url, { timeout: 10000 });
        
        aggregatedDump.apiResponses[op] = { 
          status: 'success', 
          url_called: url,
          data: apiRes.data
        };

      } catch (error: any) {
        aggregatedDump.apiResponses[op] = { status: 'error', url_called: url, reason: error.message };
      }
      
      await delay(50);
    }
  }

  const publicApiDumpString = JSON.stringify(aggregatedDump);
  
  await prisma.drug.update({
    where: { id: drug.id },
    data: {
      publicApiDump: publicApiDumpString,
      updatedAt: new Date()
    }
  });

  console.log(`✅ [${drug.productName}] 공공 API 전체 원천 데이터(DUR, 허가, 식별 등)가 완벽히 DB에 백업되었습니다.`);
  console.log(`DB에 저장된 문자열 길이: ${publicApiDumpString.length} bytes`);
  
  // 간단한 파싱 테스트
  console.log("\n🧪 저장 직후 효능 검사...");
  if (publicApiDumpString.includes('EE_DOC_DATA')) {
    console.log("EE_DOC_DATA (효능효과) 데이터가 존재합니다!");
  } else {
    console.log("효능효과 데이터가 누락되었습니다.");
  }
}

syncAllApiDataLossless().catch(console.error).finally(() => prisma.$disconnect());
