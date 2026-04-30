import fs from 'fs';
import path from 'path';

// Check raw API dumps for 아세트아미노펜
const dumpDir = 'data/public_api_dumps';

interface Item {
  [key: string]: any;
}

const results: Array<{ file: string; count: number; samples: Item[] }> = [];

for (const dir of fs.readdirSync(dumpDir)) {
  const dirPath = path.join(dumpDir, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;

  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(dirPath, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const items = Array.isArray(data) ? data : data.body?.[Object.keys(data.body)[0]] || [];

    const matches = items.filter((item: Item) => {
      const allText = JSON.stringify(item);
      return allText.includes('아세트아미노펜');
    });

    if (matches.length > 0) {
      console.log(`\n${dir}/${file}: ${matches.length}건`);
      
      // Show first sample
      const sample = matches[0];
      console.log('Sample fields:');
      for (const key of Object.keys(sample).sort()) {
        const val = sample[key];
        if (typeof val === 'string' && val.length < 100) {
          console.log(`  ${key}: ${val}`);
        }
      }
    }
  }
}
