import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlMissingDrugInfo() {
  console.log('🚀 약학정보 사이트 크롤링을 통해 유효한 효능효과/주의사항 DB 채우기 시작...');

  const pendingDrugs = await prisma.drug.findMany({
    where: {
      OR: [
        { efficacy: null },
        { precaution: null }
      ]
    },
    take: 10, // 한 번의 배치에 10건씩 진행 (안전성 및 테스트)
  });

  if (pendingDrugs.length === 0) {
    console.log('✅ 모든 의약품의 효능/주의사항 정보가 이미 채워져 있습니다!');
    return;
  }

  for (const drug of pendingDrugs) {
    try {
      console.log(`\n⏳ [${drug.productName}] 검색 중...`);
      
      // 약학정보원 통합 검색 페이지 활용
      const searchUrl = `https://www.health.kr/searchDrug/search_total_result.asp?keyword=${encodeURIComponent(drug.productName)}`;
      const response = await axios.get(searchUrl, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);
      
      // 검색 결과에서 첫 번째 제품의 상세 페이지 링크 추출
      const detailLink = $('#result_drug table tbody tr td:nth-child(2) a').attr('href');
      
      let scrapedEfficacy = null;
      let scrapedPrecaution = null;

      if (detailLink) {
        const detailUrl = `https://www.health.kr/searchDrug/${detailLink.replace(/&amp;/g, '&')}`;
        const detailRes = await axios.get(detailUrl, { headers, timeout: 10000 });
        const $detail = cheerio.load(detailRes.data);
        
        // 효능/효과, 주의사항 섹션의 텍스트를 정확하게 추출
        scrapedEfficacy = $detail('div#effect').text().trim().replace(/\s+/g, ' ');
        scrapedPrecaution = $detail('div#usage').text().trim().replace(/\s+/g, ' ');
      }

      // 만약 정보가 유효하면 (쓸데없는 쓰레기 데이터 거르기)DB에 반영
      if ((scrapedEfficacy && scrapedEfficacy.length > 5) || (scrapedPrecaution && scrapedPrecaution.length > 5)) {
        await prisma.drug.update({
          where: { id: drug.id },
          data: {
            efficacy: scrapedEfficacy?.substring(0, 3000) || drug.efficacy,
            precaution: scrapedPrecaution?.substring(0, 3000) || drug.precaution,
            updatedAt: new Date()
          }
        });
        console.log(`✅ [${drug.productName}] 진료 기반 유효 데이터 추출 및 DB 적재 완료!`);
      } else {
        console.log(`⚠ [${drug.productName}] 유효한 텍스트 데이터가 없습니다. (API 백업 데이터로 대채 필요)`);
      }

      await delay(2000); 

    } catch (error: any) {
      console.log(`❌ [${drug.productName}] 접근 실패: 차단 회피 딜레이 적용...`);
      await delay(5000);
    }
  }
}

crawlMissingDrugInfo().finally(() => prisma.$disconnect());
