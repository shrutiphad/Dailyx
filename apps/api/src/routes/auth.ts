import { Router } from 'express';
import { prisma } from '@dailyx/db';
import { loginSchema, signupSchema } from '@dailyx/shared';
import { AUTH_COOKIE, hashPassword, signToken, verifyPassword } from '../lib/auth';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { isProd } from '../env';

const router = Router();

const cookieOpts = {
  httpOnly: true,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

// Sign up creates a brand-new isolated account + its first user.
router.post('/signup', async (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new HttpError(409, 'An account with that email already exists');

    const user = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { name: input.accountName } });
      return tx.user.create({
        data: {
          accountId: account.id,
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash: await hashPassword(input.password),
        },
      });
    });

    const token = signToken({ userId: user.id, accountId: user.accountId });
    res.cookie(AUTH_COOKIE, token, cookieOpts);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const token = signToken({ userId: user.id, accountId: user.accountId });
    res.cookie(AUTH_COOKIE, token, cookieOpts);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { account: true },
    });
    if (!user) throw new HttpError(401, 'Session user no longer exists');
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      account: { id: user.account.id, name: user.account.name },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
