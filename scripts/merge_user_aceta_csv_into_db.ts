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

function isAceta(text: string) {
  const t = (text || '').toLowerCase();
  return (
    t.includes('아세트아미노펜') ||
    t.includes('acetaminophen') ||
    t.includes('paracetamol') ||
    t.includes('프로파세타몰') ||
    t.includes('propacetamol')
  );
}

function normalizeType(raw: string) {
  const t = (raw || '').trim();
  if (!t) return null;
  if (t.includes('전문')) return '전문의약품';
  if (t.includes('일반')) return '일반의약품';
  return t;
}

async function resolveCsvPath() {
  if (process.env.ACETA_SOURCE_CSV_PATH) return process.env.ACETA_SOURCE_CSV_PATH;

  const downloadsDir = path.join('C:\\Users', process.env.USERNAME || '', 'Downloads');
  try {
    const files = await fs.readdir(downloadsDir);
    const picked = files.find((name) => name.includes('의약품등제품정보목록_아세트아미노펜') && name.endsWith('.csv'));
    if (picked) return path.join(downloadsDir, picked);
  } catch {
    // no-op
  }

  return path.join(process.cwd(), 'tmp2.csv');
}

async function main() {
  const csvPath = await resolveCsvPath();
  const text = await fs.readFile(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV rows are empty');

  const headers = parseCsvLine(lines[0]);
  const idxCode = headers.findIndex((h) => h.includes('품목기준코드'));
  const idxName = headers.findIndex((h) => h.includes('제품명'));
  const idxCompany = headers.findIndex((h) => h.includes('업체명'));
  const idxMain = headers.findIndex((h) => h.includes('주성분'));
  const idxMainEn = headers.findIndex((h) => h.includes('주성분영문'));
  const idxAtc = headers.findIndex((h) => h.includes('ATC코드'));
  const idxType = headers.findIndex((h) => h.includes('전문의약품'));
  const idxCancel = headers.findIndex((h) => h.includes('취소/취하'));

  let scanned = 0;
  let acetaRows = 0;
  let created = 0;
  let updated = 0;

  for (let i = 1; i < lines.length; i += 1) {
    scanned += 1;
    const cols = parseCsvLine(lines[i]);

    const code = digits(cols[idxCode] || '');
    const productName = (cols[idxName] || '').trim();
    const company = (cols[idxCompany] || '').trim();
    let ingredient = ((cols[idxMain] || '').trim() || (cols[idxMainEn] || '').trim() || null);
    const atcCode = (cols[idxAtc] || '').trim() || null;
    const type = normalizeType(cols[idxType] || '');
    const cancelState = (cols[idxCancel] || '').trim();

    if (!code || !productName) continue;
    if (!(isAceta(productName) || isAceta(ingredient || ''))) continue;

    if (!ingredient && /프로파세타몰|propacetamol/i.test(productName)) {
      ingredient = '프로파세타몰염산염(아세트아미노펜 전구체)';
    }

    acetaRows += 1;

    const existing = await prisma.drug.findFirst({
      where: {
        OR: [
          { standardCode: code },
          { insuranceCode: code },
          { AND: [{ productName }, { company: company || undefined }] },
        ],
      },
      select: {
        id: true,
        ingredientName: true,
        atcCode: true,
        type: true,
        reimbursement: true,
      },
    });

    const reimbursement = null;

    if (!existing) {
      await prisma.drug.create({
        data: {
          productName,
          ingredientName: ingredient,
          company: company || null,
          standardCode: code,
          insuranceCode: code,
          atcCode,
          reimbursement,
          type,
          usageFrequency: 0,
        },
      });
      created += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (!existing.ingredientName && ingredient) patch.ingredientName = ingredient;
    if (!existing.atcCode && atcCode) patch.atcCode = atcCode;
    if (!existing.type && type) patch.type = type;
    if (!existing.reimbursement && reimbursement) patch.reimbursement = reimbursement;

    if (Object.keys(patch).length > 0) {
      await prisma.drug.update({ where: { id: existing.id }, data: patch });
      updated += 1;
    }
  }

  console.log(JSON.stringify({ csvPath, scanned, acetaRows, created, updated }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
