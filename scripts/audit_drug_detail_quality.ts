import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type DrugSample = {
  id: string;
  productName: string;
  ingredientName: string | null;
  company: string | null;
  standardCode: string | null;
  insuranceCode: string | null;
  atcCode: string | null;
  usageFrequency: number;
};

type DetailPayload = {
  success?: boolean;
  detail?: any;
  message?: string;
};

type DurPayload = {
  success?: boolean;
  sections?: Array<{ title?: string; total?: number; items?: Array<any> }>;
  message?: string;
};

type DrugAuditResult = {
  id: string;
  productName: string;
  usageFrequency: number;
  detailScore: number;
  durScore: number;
  totalScore: number;
  detailIssues: string[];
  durIssues: string[];
};

const prisma = new PrismaClient();

function parseArg(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const raw = process.argv.find((v) => v.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

function asNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const lowered = normalized.toLowerCase();
  if (!normalized) return '';
  if (['null', 'undefined', 'nan', '-', '없음', '데이터 없음', '해당없음'].includes(lowered)) return '';
  return normalized;
}

function hasNoise(value: string): boolean {
  const lowered = value.toLowerCase();
  return ['undefined', 'null', 'nan'].some((token) => lowered.includes(token));
}

function uniqueNonEmpty(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const v = cleanText(line);
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function isLikelyValidProductName(name: string): boolean {
  const value = cleanText(name);
  if (!value) return false;
  if (value.length < 2 || value.length > 120) return false;

  const commaCount = (value.match(/,/g) || []).length;
  if (commaCount >= 3) return false;

  const digitRatio = (value.match(/[0-9]/g) || []).length / value.length;
  if (digitRatio > 0.35) return false;

  if (value.includes('유효기간만료')) return false;
  if (value.includes('LTD.') || value.includes('Ltd.')) return false;
  return true;
}

function scoreLongText(name: string, value: unknown, issues: string[]): number {
  const text = cleanText(value);
  if (!text) {
    issues.push(`${name} 비어 있음`);
    return 0;
  }

  let score = 8;
  if (text.length >= 80) score += 8;
  else if (text.length >= 40) score += 5;
  else score += 2;

  if (hasNoise(text)) {
    score -= 4;
    issues.push(`${name} 노이즈 토큰 포함`);
  }

  const lines = text.split('\n').map((v) => v.trim()).filter(Boolean);
  const uniq = uniqueNonEmpty(lines);
  if (lines.length >= 4 && uniq.length / lines.length < 0.7) {
    score -= 3;
    issues.push(`${name} 중복 라인 비율 높음`);
  }

  return Math.max(0, Math.min(20, score));
}

function scoreDetail(payload: DetailPayload): { score: number; issues: string[] } {
  const issues: string[] = [];
  const d = payload?.detail;

  if (!payload?.success || !d) {
    return { score: 0, issues: ['detail API 실패'] };
  }

  let score = 0;
  const mustFields: Array<[string, unknown, number]> = [
    ['productName', d.productName, 6],
    ['company', d.company, 5],
    ['insuranceInfo', d.insuranceInfo, 5],
    ['ingredientContent', d.ingredientContent, 5],
    ['kimsClass', d.kimsClass, 4],
    ['atcCode', d.atcCode, 4],
  ];

  for (const [name, value, points] of mustFields) {
    if (cleanText(value)) score += points;
    else issues.push(`${name} 누락`);
  }

  score += scoreLongText('효능효과', d.efficacyText, issues);
  score += scoreLongText('용법용량', d.usageText, issues);
  score += scoreLongText('주의사항', d.cautionText, issues);

  const packages = Array.isArray(d.packageInfo) ? d.packageInfo : [];
  if (packages.length === 0) {
    issues.push('포장정보 없음');
  } else {
    const labels = uniqueNonEmpty(packages.map((p: any) => `${p?.label || ''}|${p?.standardCode || ''}`));
    if (labels.length !== packages.length) issues.push('포장정보 중복 존재');
    if (labels.length > 0) score += 6;
  }

  if (cleanText(d.imageUrl)) score += 3;

  const capped = Math.max(0, Math.min(100, score));
  return { score: capped, issues };
}

function scoreDur(payload: DurPayload): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (!payload?.success || !Array.isArray(payload.sections)) {
    return { score: 0, issues: ['dur API 실패'] };
  }

  const sections = payload.sections;
  let score = 0;

  const withSignals = sections.filter((s) => (s.total || 0) > 0);
  if (withSignals.length > 0) score += 25;
  else issues.push('활성 DUR 섹션 없음');

  const allItems = withSignals.flatMap((s) => s.items || []);
  if (allItems.length === 0) {
    issues.push('DUR 아이템 없음');
    return { score, issues };
  }

  const summaries = allItems
    .map((it: any) => cleanText(it?.summary || it?.contraDrug || it?.ageInfo || it?.pregnantInfo || it?.caution || ''))
    .filter(Boolean);

  if (summaries.length === 0) {
    issues.push('DUR 사유 텍스트 없음');
    return { score, issues };
  }

  const uniqueSummaries = uniqueNonEmpty(summaries);
  const uniqRatio = uniqueSummaries.length / summaries.length;
  if (uniqRatio >= 0.85) score += 35;
  else if (uniqRatio >= 0.6) score += 24;
  else {
    score += 12;
    issues.push('DUR 중복 사유 비율 높음');
  }

  const avgLength = summaries.reduce((acc, cur) => acc + cur.length, 0) / summaries.length;
  if (avgLength >= 25) score += 25;
  else if (avgLength >= 12) score += 16;
  else {
    score += 8;
    issues.push('DUR 사유 정보 밀도 낮음');
  }

  const noiseCount = summaries.filter(hasNoise).length;
  if (noiseCount > 0) {
    issues.push(`DUR 노이즈 ${noiseCount}건`);
  } else {
    score += 15;
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  return data;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function toMarkdown(results: DrugAuditResult[], baseUrl: string, limit: number): string {
  const now = new Date();
  const totalScores = results.map((r) => r.totalScore);
  const detailScores = results.map((r) => r.detailScore);
  const durScores = results.map((r) => r.durScore);

  const avg = (arr: number[]) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '0.0');

  const worst = [...results].sort((a, b) => a.totalScore - b.totalScore).slice(0, 10);
  const best = [...results].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);

  const lines: string[] = [];
  lines.push(`# Drug Detail Quality Audit`);
  lines.push('');
  lines.push(`- generatedAt: ${now.toISOString()}`);
  lines.push(`- sampleLimit: ${limit}`);
  lines.push(`- targetBaseUrl: ${baseUrl}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- averageTotalScore: ${avg(totalScores)}`);
  lines.push(`- averageDetailScore: ${avg(detailScores)}`);
  lines.push(`- averageDurScore: ${avg(durScores)}`);
  lines.push(`- p25TotalScore: ${percentile(totalScores, 25).toFixed(1)}`);
  lines.push(`- p50TotalScore: ${percentile(totalScores, 50).toFixed(1)}`);
  lines.push(`- p75TotalScore: ${percentile(totalScores, 75).toFixed(1)}`);
  lines.push('');
  lines.push('## Worst 10');
  lines.push('');
  lines.push('| productName | usageFrequency | detail | dur | total | issues |');
  lines.push('|---|---:|---:|---:|---:|---|');
  for (const row of worst) {
    const issues = [...row.detailIssues, ...row.durIssues].slice(0, 4).join('; ') || '-';
    lines.push(`| ${row.productName} | ${row.usageFrequency} | ${row.detailScore} | ${row.durScore} | ${row.totalScore} | ${issues} |`);
  }
  lines.push('');
  lines.push('## Best 5');
  lines.push('');
  lines.push('| productName | usageFrequency | detail | dur | total |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const row of best) {
    lines.push(`| ${row.productName} | ${row.usageFrequency} | ${row.detailScore} | ${row.durScore} | ${row.totalScore} |`);
  }

  return lines.join('\n');
}

async function main() {
  const baseUrl = parseArg('base-url', 'https://mediai-gules.vercel.app');
  const limit = asNumber(parseArg('limit', '20'), 20);
  const concurrency = asNumber(parseArg('concurrency', '4'), 4);
  const write = parseArg('write', 'true') === 'true';

  let candidates = await prisma.drug.findMany({
    where: {
      productName: { not: '' },
      usageFrequency: { gt: 0 },
    },
    orderBy: [{ usageFrequency: 'desc' }, { updatedAt: 'desc' }],
    take: limit * 12,
    select: {
      id: true,
      productName: true,
      ingredientName: true,
      company: true,
      standardCode: true,
      insuranceCode: true,
      atcCode: true,
      usageFrequency: true,
    },
  });

  let samples = candidates.filter((row) => isLikelyValidProductName(row.productName)).slice(0, limit);

  if (samples.length === 0) {
    candidates = await prisma.drug.findMany({
      where: {
        productName: { not: '' },
      },
      orderBy: [{ usageFrequency: 'desc' }, { updatedAt: 'desc' }],
      take: limit * 20,
      select: {
        id: true,
        productName: true,
        ingredientName: true,
        company: true,
        standardCode: true,
        insuranceCode: true,
        atcCode: true,
        usageFrequency: true,
      },
    });

    samples = candidates
      .filter((row) => isLikelyValidProductName(row.productName))
      .filter((row) => cleanText(row.standardCode || '') || cleanText(row.insuranceCode || ''))
      .slice(0, limit);
  }

  if (samples.length === 0) {
    samples = candidates.filter((row) => isLikelyValidProductName(row.productName)).slice(0, limit);
  }

  if (samples.length === 0) {
    throw new Error('점검 대상 약품이 없습니다.');
  }

  console.log(`[audit] start: samples=${samples.length}, baseUrl=${baseUrl}`);

  const results = await runWithConcurrency(samples, concurrency, async (drug): Promise<DrugAuditResult> => {
    const detailBody = {
      productName: drug.productName,
      company: drug.company || undefined,
      standardCode: drug.standardCode || undefined,
      insuranceCode: drug.insuranceCode || undefined,
      atcCode: drug.atcCode || undefined,
    };

    const durBody = {
      productName: drug.productName,
      ingredientName: drug.ingredientName || undefined,
      company: drug.company || undefined,
      prioritizePatientContext: false,
    };

    let detailPayload: DetailPayload = { success: false, message: 'unknown' };
    let durPayload: DurPayload = { success: false, message: 'unknown' };

    try {
      detailPayload = await postJson<DetailPayload>(`${baseUrl}/api/drugs/detail`, detailBody);
    } catch (error) {
      detailPayload = { success: false, message: (error as Error).message };
    }

    try {
      durPayload = await postJson<DurPayload>(`${baseUrl}/api/drugs/dur`, durBody);
    } catch (error) {
      durPayload = { success: false, message: (error as Error).message };
    }

    const detail = scoreDetail(detailPayload);
    const dur = scoreDur(durPayload);
    const totalScore = Math.round(detail.score * 0.65 + dur.score * 0.35);

    return {
      id: drug.id,
      productName: drug.productName,
      usageFrequency: drug.usageFrequency,
      detailScore: detail.score,
      durScore: dur.score,
      totalScore,
      detailIssues: detail.issues,
      durIssues: dur.issues,
    };
  });

  const md = toMarkdown(results, baseUrl, limit);
  const json = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    limit,
    results,
  };

  if (write) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = join(process.cwd(), 'docs', 'quality');
    mkdirSync(outDir, { recursive: true });

    const jsonPath = join(outDir, `drug_detail_audit_${stamp}.json`);
    const mdPath = join(outDir, `drug_detail_audit_${stamp}.md`);

    writeFileSync(jsonPath, JSON.stringify(json, null, 2), 'utf-8');
    writeFileSync(mdPath, md, 'utf-8');

    console.log(`[audit] wrote json: ${jsonPath}`);
    console.log(`[audit] wrote md: ${mdPath}`);
  }

  const avgTotal = results.reduce((acc, cur) => acc + cur.totalScore, 0) / results.length;
  console.log(`[audit] average total score: ${avgTotal.toFixed(1)}`);
  console.log('[audit] worst 3:');
  for (const row of [...results].sort((a, b) => a.totalScore - b.totalScore).slice(0, 3)) {
    const issue = [...row.detailIssues, ...row.durIssues][0] || '-';
    console.log(`  - ${row.productName}: total=${row.totalScore}, issue=${issue}`);
  }
}

main()
  .catch((error) => {
    console.error('[audit] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
