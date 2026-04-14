import fs from 'fs';
import iconv from 'iconv-lite';
const raw = fs.readFileSync('data/drug_master_codes.csv');
console.log(iconv.decode(raw, 'euc-kr').split('\n')[0]);
