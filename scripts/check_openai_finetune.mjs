import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const jobId = process.argv.find((arg) => arg.startsWith('--job='))?.split('=')[1] || process.argv[2];

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 필요합니다.');
  if (!jobId) throw new Error('사용법: npm run ai:fine-tune:status -- --job=ftjob_xxx');
  const job = await openai.fineTuning.jobs.retrieve(jobId);
  console.log(JSON.stringify({
    id: job.id,
    status: job.status,
    model: job.model,
    fineTunedModel: job.fine_tuned_model,
    createdAt: job.created_at,
    finishedAt: job.finished_at,
    error: job.error,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
