import { prisma, type CampaignStatus } from '@dailyx/db';
import { cancelCampaignJob, enqueueCampaign } from '../queue';
import { resolveRecipients } from './recipients';
import { sendEmail } from '../lib/mailgun';

// Materialize recipients into CampaignRecipient rows (idempotent via unique
// [campaignId, email]). Returns how many rows now exist for the campaign.
export async function materializeRecipients(campaignId: string, accountId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, accountId } });
  if (!campaign) throw new Error('Campaign not found');

  const { recipients } = await resolveRecipients(accountId, campaign.source, {
    audienceId: campaign.audienceId,
    tag: campaign.tag,
    manualEntries: campaign.manualEntries,
  });

  if (recipients.length > 0) {
    await prisma.campaignRecipient.createMany({
      data: recipients.map((r) => ({
        accountId,
        campaignId,
        contactId: r.contactId,
        email: r.email,
        name: r.name,
      })),
      skipDuplicates: true,
    });
  }
  return prisma.campaignRecipient.count({ where: { campaignId } });
}

// Decide immediate vs scheduled. Called from the route when the user hits "send".
export async function dispatchCampaign(campaignId: string, accountId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, accountId } });
  if (!campaign) throw new Error('Campaign not found');

  await materializeRecipients(campaignId, accountId);

  const now = Date.now();
  const scheduledMs = campaign.scheduledAt ? new Date(campaign.scheduledAt).getTime() : 0;

  if (scheduledMs > now + 1000) {
    const jobId = await enqueueCampaign(
      { campaignId, accountId },
      { delayMs: scheduledMs - now },
    );
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SCHEDULED', jobId },
    });
    return { mode: 'scheduled' as const, scheduledAt: campaign.scheduledAt };
  }

  // Immediate: enqueue with no delay so the worker does the actual sending
  // (keeps the request fast and the send path identical to scheduled).
  const jobId = await enqueueCampaign({ campaignId, accountId });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'QUEUED', jobId },
  });
  return { mode: 'immediate' as const };
}

export async function cancelSchedule(campaignId: string, accountId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, accountId } });
  if (!campaign) throw new Error('Campaign not found');
  await cancelCampaignJob(campaignId);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'CANCELED', jobId: null },
  });
}

// The actual send loop, invoked by the worker. Sends one message per recipient
// and records the provider message id so webhooks can find the row later.
export async function processCampaignSend(campaignId: string, accountId: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, accountId } });
  if (!campaign) return;
  if (campaign.status === 'SENT' || campaign.status === 'CANCELED') return;

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

  // Load attachments once (bytes are the same for every recipient).
  const attachmentRows = await prisma.campaignAttachment.findMany({ where: { campaignId } });
  const attachments = attachmentRows.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    data: Buffer.from(a.data),
  }));

  // Only send to recipients still PENDING → safe to retry the job.
  const pending = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: 'PENDING' },
  });

  for (const r of pending) {
    const result = await sendEmail({
      to: r.email,
      subject: campaign.subject,
      html: campaign.body,
      attachments,
    });
    if (result.ok) {
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: {
          status: 'SENT',
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
        },
      });
    } else {
      await prisma.campaignRecipient.update({
        where: { id: r.id },
        data: { status: 'FAILED', error: result.error },
      });
    }
  }

  const remaining = await prisma.campaignRecipient.count({
    where: { campaignId, status: 'PENDING' },
  });
  const finalStatus: CampaignStatus = remaining === 0 ? 'SENT' : 'SENDING';
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: finalStatus, sentAt: finalStatus === 'SENT' ? new Date() : undefined },
  });
}
