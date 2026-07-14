import { Queue } from 'bullmq';
import { connection } from '../redis';

export interface SendCampaignJob {
  campaignId: string;
  accountId: string;
}

export const CAMPAIGN_QUEUE = 'campaign-send';

// Single queue for campaign sends. A scheduled campaign is a *delayed* job:
// BullMQ persists it in Redis, so it survives an API/worker restart and fires
// at the right time — no setTimeout, no polling the table.
export const campaignQueue = new Queue<SendCampaignJob>(CAMPAIGN_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Deterministic job id per campaign so we can cancel/reschedule idempotently.
export function jobIdForCampaign(campaignId: string): string {
  return `campaign:${campaignId}`;
}

export async function enqueueCampaign(
  data: SendCampaignJob,
  opts: { delayMs?: number } = {},
): Promise<string> {
  const jobId = jobIdForCampaign(data.campaignId);
  // Remove any prior job for this campaign (e.g. rescheduling) before re-adding.
  const existing = await campaignQueue.getJob(jobId);
  if (existing) await existing.remove().catch(() => undefined);

  await campaignQueue.add('send', data, {
    jobId,
    delay: opts.delayMs && opts.delayMs > 0 ? opts.delayMs : undefined,
  });
  return jobId;
}

export async function cancelCampaignJob(campaignId: string): Promise<void> {
  const job = await campaignQueue.getJob(jobIdForCampaign(campaignId));
  if (job) await job.remove().catch(() => undefined);
}
