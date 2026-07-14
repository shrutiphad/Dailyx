import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE, verifyToken, type TokenPayload } from '../lib/auth';

// Adds req.auth. Reads the JWT from httpOnly cookie OR Authorization: Bearer.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = req.cookies?.[AUTH_COOKIE] || bearer;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Convenience: throw if somehow reached without auth (keeps handlers terse & typed).
export function accountId(req: Request): string {
  if (!req.auth) throw new Error('accountId() called without requireAuth');
  return req.auth.accountId;
}
