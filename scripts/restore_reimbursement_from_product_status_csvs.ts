import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCsvLine(line: string) {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function digits(v: string) {
  return (v || '').replace(/\D/g, '');
}

async function resolveCsvs() {
  const userName = process.env.USERNAME || '';
  const downloads = path.join('C:\\Users', userName, 'Downloads');
  const names = await fs.readdir(downloads);

  const productList = names
    .map((name) => {
      const m = name.match(/^의약품등제품정보목록 \((\d+)\)\.csv$/);
      if (!m) return null;
      return { name, no: Number(m[1]) };
    })
    .filter((v): v is { name: string; no: number } => !!v)
    .filter((v) => v.no >= 5 && v.no <= 8)
    .sort((a, b) => a.no - b.no)
    .map((v) => path.join(downloads, v.name));

  return productList;
}

async function loadStatusMap(filePath: string, map: Map<string, string>) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;

  const header = parseCsvLine(lines[0]);
  const idxCode = header.findIndex((h) => h.includes('품목기준코드'));
  const idxStatus = header.findIndex((h) => h.includes('취소/취하'));

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const code = digits(cols[idxCode] || '');
    const status = (cols[idxStatus] || '').trim();
    if (!code || !status) continue;
    if (!map.has(code)) map.set(code, status);
  }
}

async function main() {
  const files = await resolveCsvs();
  const statusByCode = new Map<string, string>();

  for (const f of files) {
    await loadStatusMap(f, statusByCode);
  }

  const codes = Array.from(statusByCode.keys());
  const CHUNK = 500;
  let scanned = 0;
  let updated = 0;

  for (let i = 0; i < codes.length; i += CHUNK) {
    const batch = codes.slice(i, i + CHUNK);
    const rows = await prisma.drug.findMany({
      where: { standardCode: { in: batch } },
      select: { id: true, standardCode: true, reimbursement: true },
    });

    scanned += rows.length;

    for (const row of rows) {
      const status = statusByCode.get(row.standardCode || '');
      if (!status) continue;
      if ((row.reimbursement || '').trim()) continue;

      const reimbursement = status.includes('정상') ? '급여구분미확인' : `상태:${status}`;
      await prisma.drug.update({
        where: { id: row.id },
        data: { reimbursement },
      });
      updated += 1;
    }
  }

  console.log(JSON.stringify({ files, statusCodes: codes.length, scanned, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
