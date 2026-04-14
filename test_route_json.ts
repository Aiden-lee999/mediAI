import { POST } from './src/app/api/drugs/search/route';

async function test() {
  try {
    const req = new Request('http://localhost:3000/api/drugs/search', {
      method: 'POST',
      body: JSON.stringify({ productName: '타이레놀' })
    });
    
    const res = await POST(req);
    const text = await res.text();
    console.log("RESPONSE HTTP STATUS:", res.status);
    console.log("RESPONSE TEXT:", text.substring(0, 500)); // Print start of response to check for 'A', "An error o"...
  } catch (e) {
    console.error("FATAL ERROR:", e);
  }
}

test();
