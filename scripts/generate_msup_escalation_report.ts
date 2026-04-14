import { writeFile } from 'node:fs/promises';
import { callPublicDrugApi } from '../src/lib/publicDrugApiClient';

type ProbeCase = {
  title: string;
  operation: string;
  query: Record<string, string | number>;
};

type ProbeResult = {
  title: string;
  operation: string;
  query: Record<string, string | number>;
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  ok: boolean;
  error?: string;
};

function argValue(name: string, fallback: string) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return fallback;
  return arg.split('=')[1] || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function buildCases(): ProbeCase[] {
  return [
    {
      title: 'ATC step4 area baseline',
      operation: '/getAtcStp4AreaList1.2',
      query: { mdcareYm: '202312', atcCd: 'N02BE', numOfRows: 1, pageNo: 1 },
    },
    {
      title: 'ATC step3 area baseline',
      operation: '/getAtcStp3AreaList1.2',
      query: { mdcareYm: '202212', atcCd: 'N02B', numOfRows: 1, pageNo: 1 },
    },
    {
      title: 'Component area baseline',
      operation: '/getCmpnAreaList1.2',
      query: { mdcareYm: '202312', gnrlNm: '아세트아미노펜', numOfRows: 1, pageNo: 1 },
    },
    {
      title: 'Component class baseline',
      operation: '/getCmpnClList1.2',
      query: { mdcareYm: '202312', gnrlNm: '아세트아미노펜', clCd: '아세트아미노펜', numOfRows: 1, pageNo: 1 },
    },
  ];
}

function toMarkdown(report: {
  generatedAt: string;
  baseUrl: string;
  environment: string;
  conclusion: string;
  results: ProbeResult[];
  nextRequest: string[];
}) {
  const lines: string[] = [];
  lines.push('# msupUserInfoService No-Data Escalation Report');
  lines.push('');
  lines.push(`- Generated At: ${report.generatedAt}`);
  lines.push(`- Environment: ${report.environment}`);
  lines.push(`- Base URL: ${report.baseUrl}`);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- ${report.conclusion}`);
  lines.push('');
  lines.push('## Probe Results');
  lines.push('| Title | Operation | ResultCode | ResultMsg | TotalCount |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of report.results) {
    lines.push(`| ${r.title} | ${r.operation} | ${r.resultCode || '-'} | ${r.resultMsg || '-'} | ${r.totalCount} |`);
  }
  lines.push('');
  lines.push('## Requested Provider Confirmation');
  for (const req of report.nextRequest) {
    lines.push(`- ${req}`);
  }
  lines.push('');
  lines.push('## Reproduction Command');
  lines.push('```powershell');
  lines.push('npx --yes tsx scripts/generate_msup_escalation_report.ts --write-md=true');
  lines.push('```');
  return lines.join('\n');
}

async function runCase(baseUrl: string, c: ProbeCase): Promise<ProbeResult> {
  try {
    const payload = await callPublicDrugApi({
      baseUrl,
      operation: c.operation,
      query: c.query,
      timeoutMs: 10000,
      retries: 0,
    });
    const resultCode = String(payload?.response?.header?.resultCode || '');
    const resultMsg = String(payload?.response?.header?.resultMsg || '');
    const totalCount = Number(payload?.response?.body?.totalCount || 0);
    return {
      title: c.title,
      operation: c.operation,
      query: c.query,
      resultCode,
      resultMsg,
      totalCount,
      ok: resultCode === '00' && totalCount > 0,
    };
  } catch (error) {
    return {
      title: c.title,
      operation: c.operation,
      query: c.query,
      resultCode: '',
      resultMsg: '',
      totalCount: 0,
      ok: false,
      error: String(error),
    };
  }
}

async function main() {
  const baseUrl = 'https://apis.data.go.kr/B551182/msupUserInfoService1.2';
  const outputPrefix = argValue('output-prefix', 'tmp_msup_escalation_report');
  const writeMd = argValue('write-md', 'true') !== 'false';

  const cases = buildCases();
  const results: ProbeResult[] = [];

  for (const c of cases) {
    const r = await runCase(baseUrl, c);
    results.push(r);
  }

  const normalZeroCount = results.filter((r) => r.resultCode === '00' && r.totalCount === 0).length;
  const anyHit = results.some((r) => r.totalCount > 0);

  const report = {
    generatedAt: nowIso(),
    environment: 'mediAI local batch sync',
    baseUrl,
    anyHit,
    normalZeroCount,
    totalCases: results.length,
    conclusion: anyHit
      ? 'At least one query returned non-zero data.'
      : 'All representative queries returned NORMAL SERVICE with totalCount=0 (or equivalent no-data responses).',
    results,
    nextRequest: [
      '현재 서비스 키에서 msupUserInfoService1.2 데이터 조회 권한/범위가 정상인지 확인 요청',
      'getAtcStp4AreaList1.2/getCmpnAreaList1.2의 필수 파라미터 및 코드 체계(지역/분류) 공식 스펙 제공 요청',
      '정상적으로 totalCount>0가 반환되는 샘플 요청 파라미터(실제 값) 제공 요청',
    ],
  };

  await writeFile(`${outputPrefix}.json`, JSON.stringify(report, null, 2), 'utf8');

  if (writeMd) {
    const md = toMarkdown(report);
    await writeFile(`${outputPrefix}.md`, md, 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
