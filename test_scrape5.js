const axios = require('axios');
const qs = require('querystring');
async function search() {
  const agent = new (require('https').Agent)({ rejectUnauthorized: false });
  // Try payload as URL encoding
  const data = qs.stringify({
    searchYn: 'true',
    searchOption: 'ST1',
    searchKeyword: '타이레놀',
    sort: '',
    sortOrder: '',
    page: 1
  });
  
  // Actually, nedrug uses URL parameters and GET for search... wait, no. Let's pass it via GET params.
  const res = await axios.get(`https://nedrug.mfds.go.kr/searchDrug?searchYn=true&searchOption=ST1&searchKeyword=${encodeURIComponent('타이레놀')}`, {
    httpsAgent: agent,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  require('fs').writeFileSync('search2.html', typeof res.data === 'object' ? JSON.stringify(res.data) : res.data);
}
search();