import fs from 'fs';

let content = fs.readFileSync('src/lib/drugMasterCsv.ts', 'utf8');

const regex = /function scoreCsvHeader[\s\S]*?async function readCsvText[^}]*\}[^}]*\}/m;

content = content.replace(regex, `
async function readCsvText(filePath: string) {
  const raw = await fs.promises.readFile(filePath);
  return await import('iconv-lite').then(iconv => iconv.default.decode(raw, 'euc-kr'));
}
`);

fs.writeFileSync('src/lib/drugMasterCsv.ts', content);
