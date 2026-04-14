import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';

type UsageProbeSample = {
  operation: string;
  query: Record<string, string | number>;
  totalCount: number;
  resultMsg: string;
  itemCount: number;
};

function getParamKey(query: Record<string, string | number>) {
  const keys = Object.keys(query).filter((k) => k !== 'mdcareYm').sort();
  return keys.join(',') || '(none)';
}

async function main() {
  const inputPath = process.argv[2] || 'tmp_usage_probe_samples.json';
  const writeRepresentatives = process.argv.includes('--write-representatives');
  const raw = await readFile(inputPath, 'utf8');
  const samples = JSON.parse(raw) as UsageProbeSample[];

  const byOperation = new Map<string, number>();
  const byParamKey = new Map<string, number>();
  const byMonth = new Map<string, number>();
  let zeroCount = 0;
  let nonZeroCount = 0;

  for (const s of samples) {
    byOperation.set(s.operation, (byOperation.get(s.operation) || 0) + 1);

    const pKey = `${s.operation} | ${getParamKey(s.query)}`;
    byParamKey.set(pKey, (byParamKey.get(pKey) || 0) + 1);

    const month = String(s.query.mdcareYm || '');
    if (month) byMonth.set(month, (byMonth.get(month) || 0) + 1);

    if (s.totalCount > 0 || s.itemCount > 0) nonZeroCount += 1;
    else zeroCount += 1;
  }

  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, count: v }));

  const report = {
    inputPath,
    totalSamples: samples.length,
    zeroCount,
    nonZeroCount,
    byOperation: sortDesc(byOperation),
    byParamKey: sortDesc(byParamKey).slice(0, 20),
    byMonth: sortDesc(byMonth),
  };

  if (writeRepresentatives) {
    const seen = new Set<string>();
    const representatives: UsageProbeSample[] = [];
    for (const sample of samples) {
      const key = `${sample.operation}|${getParamKey(sample.query)}|${sample.query.mdcareYm || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      representatives.push(sample);
      if (representatives.length >= 30) break;
    }
    await writeFile('tmp_usage_probe_representatives.json', JSON.stringify(representatives, null, 2), 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
