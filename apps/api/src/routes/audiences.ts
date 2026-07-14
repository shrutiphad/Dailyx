import { Router } from 'express';
import { prisma } from '@dailyx/db';
import { audienceSchema, compileFilter, type FilterGroup } from '@dailyx/shared';
import { requireAuth, accountId } from '../middleware/auth';
import { HttpError } from '../middleware/error';

const router = Router();
router.use(requireAuth);

// Count how many contacts currently match a filter (used for live "N people").
async function countForFilter(acc: string, filter: FilterGroup): Promise<number> {
  return prisma.contact.count({ where: { accountId: acc, ...compileFilter(filter) } });
}

// List audiences with their current member counts.
router.get('/', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const audiences = await prisma.audience.findMany({
      where: { accountId: acc },
      orderBy: { createdAt: 'desc' },
    });
    const withCounts = await Promise.all(
      audiences.map(async (a) => ({
        ...a,
        count: await countForFilter(acc, a.filter as unknown as FilterGroup),
      })),
    );
    res.json({ audiences: withCounts });
  } catch (e) {
    next(e);
  }
});

// Preview a filter's count before saving (composer helper).
router.post('/preview', async (req, res, next) => {
  try {
    const filter = audienceSchema.shape.filter.parse(req.body.filter);
    const count = await countForFilter(accountId(req), filter);
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const input = audienceSchema.parse(req.body);
    const acc = accountId(req);
    const audience = await prisma.audience.create({
      data: { accountId: acc, name: input.name, filter: input.filter },
    });
    res.status(201).json({ audience: { ...audience, count: await countForFilter(acc, input.filter) } });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const input = audienceSchema.parse(req.body);
    const acc = accountId(req);
    const owned = await prisma.audience.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!owned) throw new HttpError(404, 'Audience not found');
    const audience = await prisma.audience.update({
      where: { id: owned.id },
      data: { name: input.name, filter: input.filter },
    });
    res.json({ audience: { ...audience, count: await countForFilter(acc, input.filter) } });
  } catch (e) {
    next(e);
  }
});

// The members currently in an audience (for the detail view).
router.get('/:id/members', async (req, res, next) => {
  try {
    const acc = accountId(req);
    const audience = await prisma.audience.findFirst({ where: { id: req.params.id, accountId: acc } });
    if (!audience) throw new HttpError(404, 'Audience not found');
    const members = await prisma.contact.findMany({
      where: { accountId: acc, ...compileFilter(audience.filter as unknown as FilterGroup) },
      take: 500,
    });
    res.json({ members });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prisma.audience.deleteMany({
      where: { id: req.params.id, accountId: accountId(req) },
    });
    if (result.count === 0) throw new HttpError(404, 'Audience not found');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
