import { Router } from 'express';
import { prisma } from '@dailyx/db';
import { verifyWebhookSignature } from '../lib/mailgun';

const router = Router();

// Mailgun webhook receiver. Mounted with express.json() upstream. Mailgun's
// modern webhooks POST { signature, event-data }. We verify the HMAC signature,
// then update the matching recipient by provider Message-Id. Idempotent via the
// EmailEvent.providerEventId unique index — a re-delivered event won't double-count.
router.post('/mailgun', async (req, res) => {
  const signature = req.body?.signature;
  const eventData = req.body?.['event-data'];

  if (!signature || !eventData) return res.status(400).json({ error: 'Malformed webhook' });
  if (!verifyWebhookSignature(signature)) {
    return res.status(401).json({ error: 'Bad signature' });
  }

  const event: string = eventData.event; // "delivered" | "opened" | "failed" ...
  const messageId: string | undefined = eventData.message?.headers?.['message-id'];
  const providerEventId: string | undefined = eventData.id;

  if (!messageId) return res.status(200).json({ ok: true, ignored: 'no message id' });

  const recipient = await prisma.campaignRecipient.findFirst({
    where: { providerMessageId: messageId },
  });
  // Always 200 so the provider stops retrying, even if we can't match it.
  if (!recipient) return res.status(200).json({ ok: true, ignored: 'unknown message' });

  try {
    await prisma.$transaction(async (tx) => {
      // Insert the raw event first; unique providerEventId makes this idempotent.
      await tx.emailEvent.create({
        data: {
          accountId: recipient.accountId,
          recipientId: recipient.id,
          type: event,
          providerEventId,
          payload: eventData,
        },
      });

      if (event === 'delivered') {
        await tx.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            deliveredAt: recipient.deliveredAt ?? new Date(),
            // don't downgrade an already-OPENED recipient
            status: recipient.status === 'OPENED' ? 'OPENED' : 'DELIVERED',
          },
        });
      } else if (event === 'opened') {
        await tx.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'OPENED',
            openedAt: recipient.openedAt ?? new Date(),
            openCount: { increment: 1 },
          },
        });
      } else if (event === 'failed' || event === 'permanent_fail') {
        await tx.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'BOUNCED', error: eventData.reason ?? 'failed' },
        });
      }
    });
  } catch (e) {
    // P2002 = duplicate providerEventId → already processed, safe to ignore.
    if ((e as { code?: string }).code !== 'P2002') {
      console.error('[webhook] processing error', e);
    }
  }

  return res.status(200).json({ ok: true });
});

export default router;
