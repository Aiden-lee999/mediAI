import { spawnSync } from 'node:child_process';

type SyncSummary = {
  scanned: number;
  selected: number;
  priceUpdated: number;
  usageUpdated: number;
  usageProbeStats?: {
    usageProbeAttempts: number;
    usageProbeFailures: number;
    usageProbeTimeouts: number;
    usageProbeHits: number;
    usageQuotaExceeded: boolean;
  };
};

function parseArg(name: string, defaultValue: number) {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!arg) return defaultValue;
  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : defaultValue;
}

function runSyncOnce(limit: number, skipUsage: boolean, skipPrice: boolean) {
  const args = ['--yes', 'tsx', 'scripts/sync_drug_metrics.ts', `--limit=${limit}`, '--write-report'];
  if (skipUsage) args.push('--skip-usage');
  if (skipPrice) args.push('--skip-price');

  const run = spawnSync('npx', args, {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (run.status !== 0) {
    throw new Error(`sync_drug_metrics failed: ${run.stderr || run.stdout}`);
  }

  const output = (run.stdout || '').trim();
  const jsonStart = output.indexOf('{');
  const jsonText = jsonStart >= 0 ? output.slice(jsonStart) : output;
  return JSON.parse(jsonText) as SyncSummary;
}

async function main() {
  const loops = parseArg('loops', 5);
  const limit = parseArg('limit', 10000);
  const stopWhenNoUpdates = !process.argv.includes('--no-stop-on-zero');
  const skipUsage = process.argv.includes('--skip-usage');
  const skipPrice = process.argv.includes('--skip-price');

  const summaries: SyncSummary[] = [];

  for (let i = 1; i <= loops; i += 1) {
    const summary = runSyncOnce(limit, skipUsage, skipPrice);
    summaries.push(summary);

    const totalUpdated = summary.priceUpdated + summary.usageUpdated;
    console.log(
      JSON.stringify(
        {
          iteration: i,
          scanned: summary.scanned,
          selected: summary.selected,
          priceUpdated: summary.priceUpdated,
          usageUpdated: summary.usageUpdated,
          usageQuotaExceeded: summary.usageProbeStats?.usageQuotaExceeded ?? false,
        },
        null,
        2
      )
    );

    if (stopWhenNoUpdates && totalUpdated === 0) {
      break;
    }

    if (summary.usageProbeStats?.usageQuotaExceeded) {
      break;
    }
  }

  const aggregate = summaries.reduce(
    (acc, cur) => {
      acc.iterations += 1;
      acc.priceUpdated += cur.priceUpdated;
      acc.usageUpdated += cur.usageUpdated;
      return acc;
    },
    { iterations: 0, priceUpdated: 0, usageUpdated: 0 }
  );

  console.log(JSON.stringify({ batchSummary: aggregate }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
