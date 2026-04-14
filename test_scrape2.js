const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

async function scrape(drugName) {
  try {
    const searchUrl = `https://nedrug.mfds.go.kr/searchDrug?sort=&sortOrder=&searchYn=true&page=1&searchChrstcDetail=%EC%A0%84%EC%B2%B4&searchOption=ST1&searchKeyword=${encodeURIComponent(drugName)}`;
    
    // Nedrug might block or fail on some TLS versions, ignoring cert issues locally
    const agent = new https.Agent({  
      rejectUnauthorized: false
    });

    const res = await axios.get(searchUrl, {
      httpsAgent: agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      },
      timeout: 10000
    });
    console.log("Success fetch. Status:", res.status);
    const $ = cheerio.load(res.data);
    
    let itemSeq = null;
    $('td > span > a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('itemSeq=')) {
        const match = href.match(/itemSeq=([0-9]+)/);
        if (match) {
          itemSeq = match[1];
          return false;
        }
      }
    });

    console.log(`Found itemSeq: ${itemSeq} for ${drugName}`);

    if (itemSeq) {
      const detailUrl = `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${itemSeq}`;
      const detailRes = await axios.get(detailUrl, { httpsAgent: agent, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } });
      const $d = cheerio.load(detailRes.data);
      
      let imageUrl = $d('#viewFullImage').attr('src') || $d('.dr_img img').attr('src') || $d('img[alt="약학정보원 이미지 보러가기"]').attr('src');
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `https://nedrug.mfds.go.kr${imageUrl}`;
      }
      console.log("Image URL:", imageUrl || "Not found");
      
      const priceText = $d('th:contains("보험약가")').next('td').text().trim() || $d('th:contains("상한금액")').next('td').text().trim() || $d('th:contains("약가")').next('td').text().trim();
      console.log("Price Info:", priceText || "정보 없음");
    }
  } catch (error) {
    console.error("Scraping error:", error.message);
  }
}

scrape('타이레놀');
