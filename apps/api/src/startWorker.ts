import { Worker } from 'bullmq';
import { prisma } from '@dailyx/db';
import { connection } from './redis';
import { CAMPAIGN_QUEUE, type SendCampaignJob, enqueueCampaign } from './queue';
import { processCampaignSend } from './services/campaigns';

// Reconcile on boot: re-enqueue any campaign still SCHEDULED in the DB. BullMQ
// already persists delayed jobs in Redis, but this rebuilds them from Postgres
// (the source of truth) if Redis was ever flushed.
async function reconcileScheduled() {
  const scheduled = await prisma.campaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { not: null } },
  });
  const now = Date.now();
  for (const c of scheduled) {
    const when = c.scheduledAt!.getTime();
    await enqueueCampaign({ campaignId: c.id, accountId: c.accountId }, { delayMs: Math.max(0, when - now) });
  }
  if (scheduled.length) console.log(`[worker] reconciled ${scheduled.length} scheduled campaign(s)`);
}

// Start the BullMQ consumer. Called either from worker.ts (its own process) or
// inline from the API process on hosts where a separate worker isn't available
// (e.g. Render's free tier) via RUN_WORKER=true.
export function startWorker(): Worker<SendCampaignJob> {
  const worker = new Worker<SendCampaignJob>(
    CAMPAIGN_QUEUE,
    async (job) => {
      console.log(`[worker] sending campaign ${job.data.campaignId}`);
      await processCampaignSend(job.data.campaignId, job.data.accountId);
    },
    { connection, concurrency: 5 },
  );

  worker.on('completed', (job) => console.log(`[worker] completed ${job.id}`));
  worker.on('failed', (job, err) => console.error(`[worker] failed ${job?.id}: ${err.message}`));

  reconcileScheduled().catch((e) => console.error('[worker] reconcile error', e));
  console.log('[worker] started, listening for campaign jobs');
  return worker;
}
