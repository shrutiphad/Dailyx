// Load .env from the app dir or the monorepo root, whichever exists.
// Env vars already set in the environment (e.g. on Render) always win.
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const p of ['.env', '../../.env', '../../../.env']) {
  const abs = resolve(process.cwd(), p);
  if (existsSync(abs)) {
    config({ path: abs });
    break;
  }
}
