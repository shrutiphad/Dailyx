import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Root vitest config for the whole monorepo. Tests are pure/unit — they exercise
// the normalization, dedup, filter-compilation, analytics and webhook-transition
// logic without a live Postgres/Redis/Mailgun, so `pnpm test` runs anywhere.
export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace package to its TS source so Vite transforms it
      // (its package.json "main" points at src, which plain Node can't load).
      '@dailyx/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    environment: 'node',
    // Minimal env so modules that validate config at import time (api/src/env.ts)
    // load. These are throwaway values; no real services are contacted.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-jwt-secret-at-least-16-chars',
      MAILGUN_WEBHOOK_SIGNING_KEY: 'test-signing-key',
    },
  },
});
