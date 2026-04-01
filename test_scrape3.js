const axios = require('axios');
const https = require('https');
const fs = require('fs');

async function scrapeDetails() {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const detailRes = await axios.get(`https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=200105441`, {
    httpsAgent: agent,
    headers: { "User-Agent": "Mozilla/5.0" },
    responseType: 'arraybuffer'
  });
  
  fs.writeFileSync('detail.html', detailRes.data);
  console.log("Written detail.html");
}

scrapeDetails();