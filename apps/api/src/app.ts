import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, mailgunConfigured } from './env';
import { errorHandler } from './middleware/error';
import authRoutes from './routes/auth';
import contactRoutes from './routes/contacts';
import audienceRoutes from './routes/audiences';
import campaignRoutes from './routes/campaigns';
import webhookRoutes from './routes/webhooks';

export function createApp() {
  const app = express();

  // Allow the browser app's origin and send cookies.
  app.use(
    cors({
      origin: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) =>
    res.json({ ok: true, mailgun: mailgunConfigured ? 'live' : 'dry-run' }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactRoutes);
  app.use('/api/audiences', audienceRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/webhooks', webhookRoutes);

  app.use(errorHandler);
  return app;
}
