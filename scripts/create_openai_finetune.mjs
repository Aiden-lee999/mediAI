import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TRAINING_SYSTEM_PROMPT = '당신은 AIMDNET의 전문 의학 보조 AI입니다. 한국어로 간결하고 임상적으로 안전하게 답하며, 약품·병원·보험·구인구직 데이터가 주어지면 이를 우선 근거로 사용합니다.';
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const fileArg = args.get('file');
const dryRun = args.get('dry-run') === 'true';
const includeRaw = args.get('include-raw') === 'true';
const limit = Math.min(Number(args.get('limit') || 10000) || 10000, 50000);
const minExamples = Number(args.get('min') || 10) || 10;
const model = args.get('model') || process.env.OPENAI_FINE_TUNE_BASE_MODEL || 'gpt-4.1-mini';
const suffix = args.get('suffix') || `aimdnet-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

function toLine(example) {
  return JSON.stringify({
    messages: [
      { role: 'system', content: TRAINING_SYSTEM_PROMPT },
      { role: 'user', content: example.prompt },
      { role: 'assistant', content: example.response },
    ],
  });
}

async function buildDatasetFile() {
  if (fileArg) {
    const content = await fs.readFile(fileArg, 'utf8');
    const count = content.split('\n').filter(Boolean).length;
    return { path: fileArg, count };
  }

  const where = includeRaw
    ? { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, prompt: { not: '' }, response: { not: '' }, status: { not: 'REJECTED' } }
    : { rating: { in: ['LIKE', 'COMMENT', 'CORRECTION'] }, prompt: { not: '' }, response: { not: '' }, status: 'APPROVED' };

  const examples = await prisma.aiTrainingExample.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, prompt: true, response: true },
  });

  const outPath = path.join('exports', `aimdnet-finetune-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, examples.map(toLine).join('\n') + (examples.length ? '\n' : ''), 'utf8');
  return { path: outPath, count: examples.length, ids: examples.map((example) => example.id) };
}

async function main() {
  if (!process.env.OPENAI_API_KEY && !dryRun) throw new Error('OPENAI_API_KEY가 필요합니다.');

  const dataset = await buildDatasetFile();
  if (dataset.count < minExamples) {
    console.log(JSON.stringify({
      ready: false,
      reason: `학습 예시가 ${dataset.count}개입니다. 최소 ${minExamples}개 이상 승인 데이터가 필요합니다.`,
      datasetPath: dataset.path,
      count: dataset.count,
      model,
      dryRun,
    }, null, 2));
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({ ready: true, dryRun: true, datasetPath: dataset.path, count: dataset.count, model, suffix }, null, 2));
    return;
  }

  const uploaded = await openai.files.create({
    file: await fs.open(dataset.path).then((handle) => handle.createReadStream()),
    purpose: 'fine-tune',
  });

  const job = await openai.fineTuning.jobs.create({
    training_file: uploaded.id,
    model,
    suffix,
  });

  if (dataset.ids?.length) {
    await prisma.aiTrainingExample.updateMany({
      where: { id: { in: dataset.ids } },
      data: { status: 'EXPORTED' },
    });
  }

  console.log(JSON.stringify({ ready: true, datasetPath: dataset.path, count: dataset.count, uploadedFile: uploaded.id, fineTuneJob: job.id, model, suffix }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
