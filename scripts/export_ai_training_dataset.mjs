import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRAINING_SYSTEM_PROMPT = '당신은 AIMDNET의 전문 의학 보조 AI입니다. 한국어로 간결하고 임상적으로 안전하게 답하며, 약품·병원·보험·구인구직 데이터가 주어지면 이를 우선 근거로 사용합니다.';
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));
const limit = Math.min(Number(args.get('limit') || 5000) || 5000, 50000);
const outArg = args.get('out');
const includeRaw = args.get('include-raw') === 'true';

function lineFor(example) {
  return JSON.stringify({
    messages: [
      { role: 'system', content: TRAINING_SYSTEM_PROMPT },
      { role: 'user', content: example.prompt },
      { role: 'assistant', content: example.response },
    ],
  });
}

async function main() {
  const where = includeRaw
    ? { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, prompt: { not: '' }, response: { not: '' }, status: { not: 'REJECTED' } }
    : { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, prompt: { not: '' }, response: { not: '' }, status: 'APPROVED' };

  let examples = await prisma.aiTrainingExample.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, rating: true, prompt: true, response: true, status: true, createdAt: true },
  });

  if (!examples.length && !includeRaw) {
    examples = await prisma.aiTrainingExample.findMany({
      where: { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, prompt: { not: '' }, response: { not: '' }, status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, rating: true, prompt: true, response: true, status: true, createdAt: true },
    });
    console.warn('APPROVED 데이터가 없어 RAW 포함 데이터셋으로 대체합니다. 운영 fine-tuning 전 검수/승인을 권장합니다.');
  }

  const lines = examples.map(lineFor);
  const outPath = outArg || path.join('exports', `aimdnet-training-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  console.log(JSON.stringify({ output: outPath, count: lines.length, includeRaw, ratings: examples.reduce((acc, item) => ({ ...acc, [item.rating]: (acc[item.rating] || 0) + 1 }), {}) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
