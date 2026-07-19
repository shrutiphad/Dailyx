import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@dailyx/db';
import { campaignSchema } from '@dailyx/shared';
import { requireAuth, accountId } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { matchManualEntries } from '../services/recipients';
import { dispatchCampaign, cancelSchedule } from '../services/campaigns';
import { deriveCampaignStats } from '../services/stats';

const router = Router();
router.use(requireAuth);

// Attachments are held in memory then stored as bytes; cap at 10MB (Mailgun's
// message size limit is ~25MB total, so this is a safe per-file ceiling).
const uploadAttachment = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
      include: {
        audience: { select: { name: true } },
        // metadata only — never ship the file bytes in the campaign payload
        attachments: {
          select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
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
    // Carry the attachments over too, so a duplicate is truly send-ready.
    const srcAttachments = await prisma.campaignAttachment.findMany({ where: { campaignId: src.id } });
    if (srcAttachments.length > 0) {
      await prisma.campaignAttachment.createMany({
        data: srcAttachments.map((a) => ({
          accountId: acc,
          campaignId: copy.id,
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          data: a.data,
        })),
      });
    }
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

    res.json({
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      ...deriveCampaignStats(byStatus),
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

// ── Attachments ────────────────────────────────────────────────────────────
// Ensure the campaign belongs to the caller (tenant isolation) before touching
// its attachments; returns the campaign or throws 404.
async function ownedCampaign(req: import('express').Request) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, accountId: accountId(req) },
  });
  if (!campaign) throw new HttpError(404, 'Campaign not found');
  return campaign;
}

router.get('/:id/attachments', async (req, res, next) => {
  try {
    await ownedCampaign(req);
    const attachments = await prisma.campaignAttachment.findMany({
      where: { campaignId: req.params.id },
      select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ attachments });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/attachments', uploadAttachment.single('file'), async (req, res, next) => {
  try {
    const acc = accountId(req);
    const campaign = await ownedCampaign(req);
    // Only editable while the campaign hasn't gone out yet.
    if (!['DRAFT', 'SCHEDULED', 'CANCELED', 'FAILED'].includes(campaign.status)) {
      throw new HttpError(409, `Can't change attachments on a ${campaign.status.toLowerCase()} campaign`);
    }
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name: file)');

    const attachment = await prisma.campaignAttachment.create({
      data: {
        accountId: acc,
        campaignId: campaign.id,
        filename: req.file.originalname,
        contentType: req.file.mimetype || 'application/octet-stream',
        size: req.file.size,
        data: req.file.buffer,
      },
      select: { id: true, filename: true, contentType: true, size: true, createdAt: true },
    });
    res.status(201).json({ attachment });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/attachments/:attId', async (req, res, next) => {
  try {
    await ownedCampaign(req); // 404s if the campaign isn't the caller's
    const result = await prisma.campaignAttachment.deleteMany({
      where: { id: req.params.attId, campaignId: req.params.id },
    });
    if (result.count === 0) throw new HttpError(404, 'Attachment not found');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/attachments/:attId/download', async (req, res, next) => {
  try {
    await ownedCampaign(req);
    const attachment = await prisma.campaignAttachment.findFirst({
      where: { id: req.params.attId, campaignId: req.params.id },
    });
    if (!attachment) throw new HttpError(404, 'Attachment not found');
    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.filename.replace(/"/g, '')}"`);
    res.send(Buffer.from(attachment.data));
  } catch (e) {
    next(e);
  }
});

export default router;
