const axios = require('axios');
const cheerio = require('cheerio');

async function scrape(drugName) {
  try {
    const searchUrl = `https://nedrug.mfds.go.kr/searchDrug?sort=&sortOrder=&searchYn=true&page=1&searchChrstcDetail=%EC%A0%84%EC%B2%B4&searchOption=ST1&searchKeyword=${encodeURIComponent(drugName)}`;
    console.log("Searching URL:", searchUrl);
    
    // 1. 검색 페이지에서 첫번째 약물의 고유번호(itemSeq) 가져오기
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    const $ = cheerio.load(res.data);
    
    // td 내 a 태그 중에서 href에 itemSeq가 포함된 첫번째 값을 찾음
    let itemSeq = null;
    $('td > span > a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('itemSeq=')) {
        const match = href.match(/itemSeq=(\d+)/);
        if (match) {
          itemSeq = match[1];
          return false; // break loop
        }
      }
    });

    if (!itemSeq) {
        // Fallback search
        $('td.al_L > span > a').each((i, el) => {
            const onClick = $(el).attr('onclick');
            if (onClick && onClick.includes('goDetail')) {
              const match = onClick.match(/'(\d+)'/);
              if (match) {
                itemSeq = match[1];
                return false;
              }
            }
        });
    }

    console.log(`Found itemSeq: ${itemSeq} for ${drugName}`);

    if (itemSeq) {
      // 2. 상세 페이지에서 올바른 이미지/약가 가져오기
      const detailUrl = `https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=${itemSeq}`;
      const detailRes = await axios.get(detailUrl, {
         headers: { "User-Agent": "Mozilla/5.0" }
      });
      const $d = cheerio.load(detailRes.data);
      
      const imageUrl = $d('#viewFullImage').attr('src') || $d('img[alt="약학정보원 이미지 보러가기"]').attr('src') || $d('.dr_img img').attr('src');
      console.log("Image URL:", imageUrl);
      
      // 심평원 처방 약가 (만약 있다면)
      let priceInfo = "정보 없음 (비급여 또는 미등재)";
      // 간단히 상세페이지 안에서 특정 텍스트 찾기 (예: "보험약가")
      const priceText = $d('th:contains("보험약가")').next('td').text().trim();
      if(priceText) priceInfo = priceText;

      console.log("Price Info:", priceInfo);
    }
  } catch (error) {
    console.error("Scraping error:", error.message);
  }
}

scrape('타이레놀');