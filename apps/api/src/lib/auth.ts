import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../env';

export interface TokenPayload {
  userId: string;
  accountId: string;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload): string {
  // JWT_EXPIRES_IN is a config string (e.g. "7d"); @types/jsonwebtoken models the
  // accepted values as a branded string union, so narrow the plain string to it.
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export const AUTH_COOKIE = 'dailyx_token';
