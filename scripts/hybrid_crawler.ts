import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 공공데이터 JSON Dump에서 최후의 수단으로 텍스트 추출 (무결성 보장)
function extractFromPublicApiDump(dumpStr: string | null) {
  if (!dumpStr) return { eff: null, pre: null, priceLabel: null, reimbursement: null };
  try {
    const dump = JSON.parse(dumpStr);
    let eff = '';
    let pre = '';
    let priceLabel: string | null = null;
    let reimbursement: string | null = null;

    // JSON 순회
    function searchKeys(obj: any) {
      if (!obj) return;
      if (typeof obj === 'string') return;
      if (Array.isArray(obj)) {
        obj.forEach(searchKeys);
        return;
      }
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'EE_DOC_DATA' && typeof v === 'string') {
          eff += v.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() + '\n\n';
        }
        if ((k === 'NB_DOC_DATA' || k === 'UD_DOC_DATA') && typeof v === 'string') {
          pre += v.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() + '\n\n';
        }
        // Extract Price data
        if ((k === 'pc' || k === 'price' || k === 'limitAmt') && v) {
            priceLabel = String(v) + '원';
        }
        if (k === 'payInfo' || k === 'mainIngrMaxDoseCnsdrdYn') {
            reimbursement = String(v);
        }

        if (typeof v === 'object') {
          searchKeys(v);
        }
      }
    }
    searchKeys(dump);

    return {
      priceLabel,
      reimbursement,
      eff: eff.length > 10 ? eff.trim() : null,
      pre: pre.length > 10 ? pre.trim() : null
    };
  } catch (err) {
    return { eff: null, pre: null, priceLabel: null, reimbursement: null };
  }
}

async function runComprehensiveCrawler() {
  console.log('🚀 약학정보원 & KIMS & 공공데이터 하이브리드 무손실 크롤러 시작...');

  const limit = 100; // 한 번에 처리할 양을 조금 늘림

  while (true) {
    const pendingDrugs = await prisma.drug.findMany({
      where: {
        OR: [
          { efficacy: null },
          { precaution: null },
          { efficacy: '' },
          { precaution: '' },
          { priceLabel: null },
          { reimbursement: null }
        ]
      },
      take: limit,
    });

    if (pendingDrugs.length === 0) {
      console.log('✅ 모든 의약품의 정보 수집(가격/약가 포함)이 완료되었습니다.');
      break;
    }

    for (const drug of pendingDrugs) {
      console.log(`\n▶ 의약품: [${drug.productName}] 수집 시작...`);
      
      let efficacyScore = '';
      let precautionScore = '';

      // ==========================================
      // 1. Health.kr (약학정보원) 크롤링 시도 (EUC-KR 변환 및 정밀 파싱)
      // ==========================================
      try {
        console.log(`  -> 🌐 약학정보원(Health.kr) 검색 중...`);
        // 약학정보원은 EUC-KR 인코딩된 URL パラ미터를 사용함
        const eucKrTitle = Array.from(iconv.encode(drug.productName, 'euc-kr'))
          .map(b => '%' + b.toString(16).toUpperCase())
          .join('');
          
        const hUrl = `https://www.health.kr/searchDrug/search_total_result.asp?keyword=${eucKrTitle}`;
        const hRes = await axios.get(hUrl, { headers, timeout: 10000 });
        const $h = cheerio.load(hRes.data);

        const detailHref = $h('td:nth-child(2) a[onclick*="search_detail"]').attr('onclick')
                          || $h('a[href*="search_detail"]').attr('href');

        if (detailHref) {
          const codeMatch = detailHref.match(/'([^']+)'/);
          const code = codeMatch ? codeMatch[1] : detailHref.split('?')[1];

          if (code) {
            const detailUrl = `https://www.health.kr/searchDrug/search_detail.asp?${code.includes('=') ? code : 'drug_cd='+code}`;
            const dRes = await axios.get(detailUrl, { headers, timeout: 10000 });
            const $d = cheerio.load(dRes.data);

            const eff = $d('#_ee_doc').text().replace(/\s+/g, ' ').trim() || $d('.effect_content').text().replace(/\s+/g, ' ').trim();
            const pre = $d('#_nb_doc').text().replace(/\s+/g, ' ').trim() || $d('.usage_content').text().replace(/\s+/g, ' ').trim();

            if (eff && eff.length > 5) efficacyScore += '\n[약학정보원 효능효과]\n' + eff;
            if (pre && pre.length > 5) precautionScore += '\n[약학정보원 주의사항]\n' + pre;
          }
        }
      } catch (e: any) {
        console.log(`  -> ⚠️ 약학정보원 접근 지연/차단: ${e.message}`);
      }

      // ==========================================
      // 2. KIMS (킴스온라인) 크롤링 시도 (파싱 강화)
      // ==========================================
      try {
        console.log(`  -> 🌐 KIMS(킴스온라인) 백업 검색 중...`);
        const kUrl = `https://www.kimsonline.co.kr/drugsearch/search?Keyword=${encodeURIComponent(drug.productName)}`;
        const kRes = await axios.get(kUrl, { headers, timeout: 10000 });
        const $k = cheerio.load(kRes.data);

        const detailHref = $k('a[href*="/drugsearch/druginfo"]').first().attr('href') 
                        || $k('li:contains("제품명")').closest('a').attr('href');
                        
        if (detailHref) {
          const detailUrl = `https://www.kimsonline.co.kr${detailHref.startsWith('/') ? '' : '/'}${detailHref}`;
          const dRes = await axios.get(detailUrl, { headers, timeout: 10000 });
          const $kd = cheerio.load(dRes.data);

          // KIMS의 일반적인 클래스 구조
          const eff = $kd('.sec_efficacy, .drug-efficacy, #efficacy').text().replace(/\s+/g, ' ').trim() || $kd('h3:contains("효능효과")').nextUntil('h3').text().trim();
          const pre = $kd('.sec_precaution, .drug-warning, #precaution').text().replace(/\s+/g, ' ').trim() || $kd('h3:contains("사용상의주의사항")').nextUntil('h3').text().trim();

          if (eff && eff.length > 5) efficacyScore += '\n[KIMS 효능효과]\n' + eff;
          if (pre && pre.length > 5) precautionScore += '\n[KIMS 주의사항]\n' + pre;
        }
      } catch (e: any) {
        console.log(`  -> ⚠️ KIMS 접근 지연/차단: ${e.message}`);
      }

      // ==========================================
      // 3. 최후의 보루: 기존 DB(publicApiDump) 파싱
      // ==========================================
      let extractedPrice = null;
      let extractedReimbursement = null;

      const publicDump = (drug as any).publicApiDump;
      if (publicDump) {
        console.log(`  -> 공공 API Raw 데이터 정밀 추출 중...`);
        const { eff, pre, priceLabel, reimbursement } = extractFromPublicApiDump(publicDump);
        if (efficacyScore.length < 10 && eff && eff.length > 5) efficacyScore = eff;
        if (precautionScore.length < 10 && pre && pre.length > 5) precautionScore = pre;
        if (priceLabel) extractedPrice = priceLabel;
        if (reimbursement) extractedReimbursement = reimbursement;
      }

      // 최종 결과 DB 저장 (null 방지용 fallback 포함)
      const finalEfficacy = efficacyScore.length > 10 ? efficacyScore.substring(0, 4500) : (drug.efficacy || '정보 없음');
      const finalPrecaution = precautionScore.length > 10 ? precautionScore.substring(0, 4500) : (drug.precaution || '정보 없음');
      const finalPrice = extractedPrice || drug.priceLabel || '조회불가';
      const finalReimbursement = extractedReimbursement || drug.reimbursement || '조회불가';

      await prisma.drug.update({
        where: { id: drug.id },
        data: {
          efficacy: finalEfficacy,
          precaution: finalPrecaution,
          priceLabel: finalPrice,
          reimbursement: finalReimbursement,
          updatedAt: new Date()
        }
      });

      if (efficacyScore.length > 10 || precautionScore.length > 10 || extractedPrice) {
        console.log(`  -> ✅ [성공] 총 수집된 효능/주의사항/약가 텍스트 DB 무손실 적재 완료.`);
      } else {
        console.log(`  -> ❌ [실패] 모든 채널에서 유의미한 텍스트를 찾지 못했습니다 (DB에 없음 처리).`);
      }

      // 서버 부하 방지를 위한 랜덤 딜레이
      await delay(1500 + Math.random() * 1000);
    }
  }
}

runComprehensiveCrawler()
  .catch(e => console.error('Crawler Error:', e))
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🏁 크롤링 배치 작업이 완전히 종료되었습니다.');
  });
