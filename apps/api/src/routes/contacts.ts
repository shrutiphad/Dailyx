import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@dailyx/db';
import {
  contactSchema,
  normalizeEmail,
  normalizePhone,
} from '@dailyx/shared';
import { requireAuth, accountId } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { parseContactsCsv } from '../lib/csv';

const router = Router();
router.use(requireAuth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// List (with simple search) — always scoped to the caller's account.
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const contacts = await prisma.contact.findMany({
      where: {
        accountId: accountId(req),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json({ contacts });
  } catch (e) {
    next(e);
  }
});

// Distinct tags + cities for building audience filters in the UI.
router.get('/facets', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const [contacts, defs] = await Promise.all([
      prisma.contact.findMany({ where: { accountId: acc }, select: { tags: true, city: true } }),
      prisma.customFieldDef.findMany({ where: { accountId: acc } }),
    ]);
    const tags = new Set<string>();
    const cities = new Set<string>();
    for (const c of contacts) {
      c.tags.forEach((t) => tags.add(t));
      if (c.city) cities.add(c.city);
    }
    res.json({ tags: [...tags].sort(), cities: [...cities].sort(), customFields: defs });
  } catch (e) {
    next(e);
  }
});

// Create one contact — same dedup rule as import (unique email/phone per account).
router.post('/', async (req, res, next) => {
  try {
    const input = contactSchema.parse(req.body);
    const acc = accountId(req);
    const emailKey = normalizeEmail(input.email);
    const phoneKey = normalizePhone(input.phone);

    const clash = await prisma.contact.findFirst({
      where: {
        accountId: acc,
        OR: [{ emailKey }, ...(phoneKey ? [{ phoneKey }] : [])],
      },
    });
    if (clash) {
      throw new HttpError(
        409,
        clash.emailKey === emailKey
          ? 'A contact with this email already exists'
          : 'A contact with this phone number already exists',
      );
    }

    const contact = await prisma.contact.create({
      data: {
        accountId: acc,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        city: input.city ?? null,
        tags: input.tags,
        customFields: input.customFields,
        emailKey,
        phoneKey,
      },
    });
    await registerCustomKeys(acc, input.customFields);
    res.status(201).json({ contact });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = contactSchema.parse(req.body);
    const acc = accountId(req);
    // Ownership check: updateMany with accountId guard, then read back.
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!existing) throw new HttpError(404, 'Contact not found');

    const emailKey = normalizeEmail(input.email);
    const phoneKey = normalizePhone(input.phone);
    const clash = await prisma.contact.findFirst({
      where: {
        accountId: acc,
        id: { not: existing.id },
        OR: [{ emailKey }, ...(phoneKey ? [{ phoneKey }] : [])],
      },
    });
    if (clash) throw new HttpError(409, 'Another contact already uses this email or phone');

    const contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        city: input.city ?? null,
        tags: input.tags,
        customFields: input.customFields,
        emailKey,
        phoneKey,
      },
    });
    await registerCustomKeys(acc, input.customFields);
    res.json({ contact });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.contact.deleteMany({
      where: { id: req.params.id, accountId: accountId(req) },
    });
    if (result.count === 0) throw new HttpError(404, 'Contact not found');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// CSV import. Returns a summary: "15 added, 3 skipped as duplicates".
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, 'No file uploaded (field name: file)');
    const acc = accountId(req);
    const { contacts, skippedInFile } = parseContactsCsv(req.file.buffer);

    let added = 0;
    let skippedExisting = 0;
    const customKeys = new Set<string>();

    for (const c of contacts) {
      // Skip if it collides with an existing DB contact on email or phone.
      const clash = await prisma.contact.findFirst({
        where: {
          accountId: acc,
          OR: [{ emailKey: c.emailKey }, ...(c.phoneKey ? [{ phoneKey: c.phoneKey }] : [])],
        },
        select: { id: true },
      });
      if (clash) {
        skippedExisting += 1;
        continue;
      }
      await prisma.contact.create({
        data: {
          accountId: acc,
          name: c.name,
          email: c.email,
          phone: c.phone,
          city: c.city,
          tags: c.tags,
          customFields: c.customFields,
          emailKey: c.emailKey,
          phoneKey: c.phoneKey,
        },
      });
      Object.keys(c.customFields).forEach((k) => customKeys.add(k));
      added += 1;
    }

    await registerCustomKeys(acc, Object.fromEntries([...customKeys].map((k) => [k, ''])));

    const skippedDupInFile = skippedInFile.filter((s) => s.reason.startsWith('duplicate')).length;
    const skippedMissing = skippedInFile.filter((s) => s.reason === 'missing email').length;

    res.json({
      added,
      skippedDuplicatesInFile: skippedDupInFile,
      skippedAlreadyExisting: skippedExisting,
      skippedMissingEmail: skippedMissing,
      totalRows: contacts.length + skippedInFile.length,
      message: `${added} added, ${skippedDupInFile + skippedExisting} skipped as duplicates${
        skippedMissing ? `, ${skippedMissing} skipped (missing email)` : ''
      }`,
      details: skippedInFile,
    });
  } catch (e) {
    next(e);
  }
});

// Record any new custom field keys so the UI/audiences know about them.
async function registerCustomKeys(acc: string, customFields: Record<string, unknown>) {
  const keys = Object.keys(customFields ?? {});
  for (const key of keys) {
    await prisma.customFieldDef.upsert({
      where: { accountId_key: { accountId: acc, key } },
      update: {},
      create: { accountId: acc, key, label: humanize(key) },
    });
  }
}

function humanize(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default router;
