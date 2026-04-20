import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': '*/*'
};

async function testSingle() {
  const drugName = '엘리펜세미정'; // Test drug
  console.log(`Testing extraction for: ${drugName}`);
  
  let eff = '';
  let pre = '';

  try {
    // 1. Health.kr search
    const eucKrTitle = Array.from(iconv.encode(drugName, 'euc-kr'))
      .map(b => '%' + b.toString(16).toUpperCase())
      .join('');
      
    // It seems Health.kr uses POST or specific referer, or we use a more direct search endpoint
    const hUrl = `https://www.health.kr/searchDrug/search_total_result.asp?keyword=${eucKrTitle}`;
    console.log(`Health.kr URL: ${hUrl}`);
    const hRes = await axios.get(hUrl, { headers });
    const $h = cheerio.load(hRes.data);
    
    // Print what we got back
    const alertMatch = hRes.data.match(/alert\('([^']+)'\)/);
    if (alertMatch) console.log(`Health.kr Alert: ${alertMatch[1]}`);
    else console.log(`Health.kr Found links:`, $h('a[href*="search_detail"], a[onclick*="search_detail"]').length);

  } catch(e: any) {
    console.log('Health.kr Error:', e.message);
  }

  try {
    // 2. KIMS search - try fetch to bypass Axios blocks
    // Sometimes KIMS blocks Axios based on headers/TLS fingeprint, but raw fetch might work
    const kUrl = `https://www.kimsonline.co.kr/drugsearch/search?Keyword=${encodeURIComponent(drugName)}`;
    console.log(`KIMS URL: ${kUrl}`);
    
    const kRes = await fetch(kUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      }
    });

    if (!kRes.ok) throw new Error(`KIMS HTTP ${kRes.status} ${kRes.statusText}`);
    const html = await kRes.text();
    const $k = cheerio.load(html);
    console.log(`KIMS Found links:`, $k('a').length);

  } catch(e: any) {
    console.log('KIMS Error:', e.message);
  }

  // 3. Fallback to 공공데이터
  const item_name = encodeURIComponent(drugName);
  const serviceKey = "a73d6c98ef59e73ed780ffb961f298b1cc9fecb40ad0fd0ffab923a67a02027d";
  const pUrl = `https://apis.data.go.kr/1471000/DrbBundleInfoService02/getDrbBundleList02?serviceKey=${serviceKey}&item_name=${item_name}&type=json`;
  
  console.log(`공공데이터 요청 중... URL: ${pUrl}`);
  try {
    const pRes = await axios.get(pUrl, { timeout: 10000 });
    const items = pRes.data?.body?.items || [];
    if (items.length > 0) {
      console.log('공공데이터 응답 항목:', items[0]);
      eff += items[0].EE_DOC_DATA || '';
      pre += items[0].UD_DOC_DATA || '';
    } else {
      console.log('공공데이터 항목 없음:', JSON.stringify(pRes.data).substring(0,200));
    }
  } catch(e:any) {
    console.log('공공데이터 에러:', e.message);
  }
}

testSingle();
