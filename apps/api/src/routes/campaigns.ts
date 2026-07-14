import { Router } from 'express';
import { prisma } from '@dailyx/db';
import { campaignSchema } from '@dailyx/shared';
import { requireAuth, accountId } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { matchManualEntries } from '../services/recipients';
import { dispatchCampaign, cancelSchedule } from '../services/campaigns';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { accountId: accountId(req) },
      orderBy: { createdAt: 'desc' },
      include: { audience: { select: { name: true } } },
    });
    res.json({ campaigns });
  } catch (e) {
    next(e);
  }
});

// Live preview for the "paste emails/phones" box: matched names + unmatched list.
router.post('/match', async (req, res, next) => {
  try {
    const entries: string[] = Array.isArray(req.body.entries)
      ? req.body.entries
      : String(req.body.entries ?? '')
          .split(/[\n,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
    const result = await matchManualEntries(accountId(req), entries);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = campaignSchema.parse(req.body);
    const acc = accountId(req);
    if (input.audienceId) {
      const owned = await prisma.audience.findFirst({ where: { id: input.audienceId, accountId: acc } });
      if (!owned) throw new HttpError(400, 'Audience not found');
    }
    const campaign = await prisma.campaign.create({
      data: {
        accountId: acc,
        name: input.name,
        subject: input.subject,
        body: input.body,
        source: input.source,
        audienceId: input.audienceId ?? null,
        tag: input.tag ?? null,
        manualEntries: input.manualEntries ?? [],
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: 'DRAFT',
      },
    });
    res.status(201).json({ campaign });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, accountId: accountId(req) },
      include: { audience: { select: { name: true } } },
    });
    if (!campaign) throw new HttpError(404, 'Campaign not found');
    res.json({ campaign });
  } catch (e) {
    next(e);
  }
});

// Send now or schedule (scheduledAt in body overrides the stored one).
router.post('/:id/send', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!campaign) throw new HttpError(404, 'Campaign not found');
    if (['QUEUED', 'SENDING', 'SENT'].includes(campaign.status)) {
      throw new HttpError(409, `Campaign already ${campaign.status.toLowerCase()}`);
    }
    if (req.body.scheduledAt !== undefined) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null },
      });
    }
    const result = await dispatchCampaign(campaign.id, acc);
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    await cancelSchedule(req.params.id, accountId(req));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Extra credit: duplicate a campaign into a fresh draft (content + recipients).
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const src = await prisma.campaign.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!src) throw new HttpError(404, 'Campaign not found');
    const copy = await prisma.campaign.create({
      data: {
        accountId: acc,
        name: `${src.name} (copy)`,
        subject: src.subject,
        body: src.body,
        source: src.source,
        audienceId: src.audienceId,
        tag: src.tag,
        manualEntries: src.manualEntries,
        status: 'DRAFT',
      },
    });
    res.status(201).json({ campaign: copy });
  } catch (e) {
    next(e);
  }
});

// Analytics: counts the frontend polls every few seconds.
router.get('/:id/stats', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!campaign) throw new HttpError(404, 'Campaign not found');

    const grouped = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;

    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    // "Sent" = anything that left our system (SENT/DELIVERED/OPENED).
    const sent =
      (byStatus.SENT ?? 0) + (byStatus.DELIVERED ?? 0) + (byStatus.OPENED ?? 0);
    const delivered = (byStatus.DELIVERED ?? 0) + (byStatus.OPENED ?? 0);
    const opened = byStatus.OPENED ?? 0;

    res.json({
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      total,
      sent,
      delivered,
      opened,
      failed: (byStatus.FAILED ?? 0) + (byStatus.BOUNCED ?? 0),
      pending: byStatus.PENDING ?? 0,
      rates: {
        deliveryRate: sent ? Math.round((delivered / sent) * 100) : 0,
        openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/recipients', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!campaign) throw new HttpError(404, 'Campaign not found');
    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: campaign.id },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });
    res.json({ recipients });
  } catch (e) {
    next(e);
  }
});

export default router;
