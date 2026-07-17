import './loadEnv';
import { createApp } from './app';
import { env, mailgunConfigured, runWorker } from './env';
import { startWorker } from './startWorker';

const app = createApp();
app.listen(env.API_PORT, () => {
  console.log(`[api] listening on :${env.API_PORT}`);
  console.log(`[api] mailgun: ${mailgunConfigured ? 'configured' : 'DRY-RUN (no keys)'}`);
  console.log(`[api] web origin: ${env.WEB_ORIGIN}`);
});

.
if (runWorker) {
  console.log('[api] RUN_WORKER=true — starting worker in this process');
  startWorker();
}
