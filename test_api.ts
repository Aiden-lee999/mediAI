import { POST } from './src/app/api/drugs/search/route';

async function test() {
  const req = new Request('http://localhost:3000/api/drugs/search', {
    method: 'POST',
    body: JSON.stringify({ productName: '타이레놀' })
  });
  
  const res = await POST(req);
  const json: any = await res.json();
  console.log(json.items.slice(0, 3).map((i: any) => ({
     name: i.productName, 
     ing: i.ingredientName, 
     price: i.priceLabel, 
     freq: i.usageFrequency 
  })));
}

test();
