import './loadEnv';
import { startWorker } from './startWorker';

// Standalone worker entrypoint (its own process): `pnpm dev:worker` /
// `pnpm start:worker`. On hosts without a separate worker service, the API can
// run the same worker in-process instead — see RUN_WORKER in index.ts.
startWorker();
