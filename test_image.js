const axios = require('axios');
const https = require('https');

async function testImage() {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const res = await axios.get('https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetail?itemSeq=200808876', { 
    httpsAgent: agent, 
    headers: { 'User-Agent': 'Mozilla/5.0' } 
  });
  
  let m = res.data.match(/<img[^>]*id="viewFullImage"?[^>]*src="([^"]+)"/i);
  if (!m) {
    console.log("Not found by ID, trying general");
    const arr = res.data.match(/<img[^>]*src="([^"]+)"/ig);
    console.log(arr ? arr.filter(x => x.includes('ImageDownload')) : 'No ImageDownload found');
  } else {
    console.log("Found:", m[1]);
  }
}
testImage();