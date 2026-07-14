import { Redis } from 'ioredis';
import { env } from './env';

// BullMQ requires maxRetriesPerRequest: null on the shared connection.
export const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('error', (e) => console.error('[redis] connection error', e.message));
