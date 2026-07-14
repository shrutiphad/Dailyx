import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Central error handler. Turns Zod + Prisma unique errors into clean 4xx JSON.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(422).json({ error: 'Validation failed', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Prisma unique constraint
  if (typeof err === 'object' && err && (err as { code?: string }).code === 'P2002') {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Internal server error' });
}
