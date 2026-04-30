import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SourceRow = {
  itemCode: string;
  productName: string;
  company: string | null;
  ingredientName: string | null;
  atcCode: string | null;
  type: string | null;
  status: string | null;
};

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

function normalizeType(raw: string) {
  const t = (raw || '').trim();
  if (!t) return null;
  if (t.includes('전문')) return '전문의약품';
  if (t.includes('일반')) return '일반의약품';
  return t;
}

async function resolveSourceFiles() {
  const userName = process.env.USERNAME || '';
  const downloadsDir = path.join('C:\\Users', userName, 'Downloads');
  const names = await fs.readdir(downloadsDir);

  const matched = names
    .map((name) => {
      const m = name.match(/^의약품등제품정보목록 \((\d+)\)\.csv$/);
      if (!m) return null;
      return { name, no: Number(m[1]) };
    })
    .filter((v): v is { name: string; no: number } => !!v)
    .sort((a, b) => a.no - b.no)
    .filter((v) => v.no >= 5 && v.no <= 8)
    .map((v) => path.join(downloadsDir, v.name));

  if (matched.length !== 4) {
    throw new Error(`Expected 4 files (5~8), found ${matched.length}`);
  }

  return matched;
}

async function loadRowsFromFile(filePath: string) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [] as SourceRow[];

  const header = parseCsvLine(lines[0]);
  const idxCode = header.findIndex((h) => h.includes('품목기준코드'));
  const idxName = header.findIndex((h) => h.includes('제품명'));
  const idxCompany = header.findIndex((h) => h.includes('업체명'));
  const idxMain = header.findIndex((h) => h === '주성분');
  const idxMainEn = header.findIndex((h) => h.includes('주성분영문'));
  const idxAtc = header.findIndex((h) => h.includes('ATC코드'));
  const idxType = header.findIndex((h) => h.includes('전문의약품'));
  const idxStatus = header.findIndex((h) => h.includes('취소/취하'));

  const out: SourceRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const c = parseCsvLine(lines[i]);
    const itemCode = digits(c[idxCode] || '');
    const productName = (c[idxName] || '').trim();
    if (!itemCode || !productName) continue;

    const ingredientName = ((c[idxMain] || '').trim() || (c[idxMainEn] || '').trim() || null);
    const company = (c[idxCompany] || '').trim() || null;
    const atcCode = (c[idxAtc] || '').trim() || null;
    const type = normalizeType(c[idxType] || '');
    const status = (c[idxStatus] || '').trim() || null;

    out.push({ itemCode, productName, company, ingredientName, atcCode, type, status });
  }

  return out;
}

async function main() {
  const files = await resolveSourceFiles();
  const allRows = (await Promise.all(files.map((f) => loadRowsFromFile(f)))).flat();

  const byCode = new Map<string, SourceRow>();
  for (const row of allRows) {
    if (!byCode.has(row.itemCode)) byCode.set(row.itemCode, row);
  }

  const codes = Array.from(byCode.keys());
  const existing = await prisma.drug.findMany({
    where: { standardCode: { in: codes } },
    select: {
      id: true,
      standardCode: true,
      ingredientName: true,
      company: true,
      atcCode: true,
      type: true,
      reimbursement: true,
    },
  });

  const existingByCode = new Map(existing.map((e) => [e.standardCode || '', e]));

  const creates: SourceRow[] = [];
  const updates: Array<{ id: string; data: Record<string, string> }> = [];

  for (const code of codes) {
    const src = byCode.get(code)!;
    const e = existingByCode.get(code);

    const reimbursement = null;

    if (!e) {
      creates.push(src);
      continue;
    }

    const patch: Record<string, string> = {};
    if (!e.ingredientName && src.ingredientName) patch.ingredientName = src.ingredientName;
    if (!e.company && src.company) patch.company = src.company;
    if (!e.atcCode && src.atcCode) patch.atcCode = src.atcCode;
    if (!e.type && src.type) patch.type = src.type;
    if (!e.reimbursement && reimbursement) patch.reimbursement = reimbursement;

    if (Object.keys(patch).length > 0) {
      updates.push({ id: e.id, data: patch });
    }
  }

  const CHUNK = 500;

  for (let i = 0; i < creates.length; i += CHUNK) {
    const chunk = creates.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((src) => {
        const reimbursement = null;
        return prisma.drug.create({
          data: {
            productName: src.productName,
            ingredientName: src.ingredientName,
            company: src.company,
            standardCode: src.itemCode,
            insuranceCode: src.itemCode,
            atcCode: src.atcCode,
            type: src.type,
            reimbursement,
            usageFrequency: 0,
          },
        });
      }),
    );
  }

  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((u) => prisma.drug.update({ where: { id: u.id }, data: u.data })),
    );
  }

  let presentAfter = 0;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const batch = codes.slice(i, i + CHUNK);
    const count = await prisma.drug.count({
      where: {
        standardCode: { in: batch },
      },
    });
    presentAfter += count;
  }

  console.log(
    JSON.stringify(
      {
        files,
        inputRows: allRows.length,
        uniqueCodes: codes.length,
        existingBefore: existing.length,
        created: creates.length,
        updated: updates.length,
        presentAfter,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
