const axios = require('axios');
const https = require('https');
const fs = require('fs');

async function scrapeSearch() {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const searchUrl = `https://nedrug.mfds.go.kr/searchDrug?sort=&sortOrder=&searchYn=true&page=1&searchChrstcDetail=%EC%A0%84%EC%B2%B4&searchOption=ST1&searchKeyword=${encodeURIComponent('타이레놀')}`;
  
  const res = await axios.get(searchUrl, {
    httpsAgent: agent,
    headers: { "User-Agent": "Mozilla/5.0" },
    responseType: 'arraybuffer'
  });
  
  fs.writeFileSync('search.html', res.data);
  console.log("Written search.html");
}

scrapeSearch();