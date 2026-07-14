// Fail fast if required env vars are missing, and expose a typed config object.
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be set (>=16 chars)'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),
  MAILGUN_BASE_URL: z.string().default('https://api.mailgun.net'),
  MAILGUN_FROM: z.string().optional(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';

// If Mailgun isn't configured we run in "dry-run" mode: sends are simulated and
// marked SENT so the rest of the flow (scheduling, analytics UI) still works.
export const mailgunConfigured = Boolean(
  env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN && env.MAILGUN_FROM,
);
