import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, mailgunConfigured } from '../env';

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

// Mailgun's send API returns the Message-Id wrapped in angle brackets
// ("<2025...@domain>"), but the webhook's message.headers.message-id is usually
// bare. Normalizing both sides through this helper guarantees the webhook can
// match the recipient row we stored at send time regardless of bracketing.
export function normalizeMessageId(id: string | null | undefined): string {
  return (id ?? '').trim().replace(/^<|>$/g, '');
}

// Send one email via Mailgun's HTTP API using the built-in fetch (Node 20+).
// Open tracking is enabled with o:tracking-opens=yes; Mailgun injects the pixel.
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!mailgunConfigured) {
    // Dry-run: pretend it sent so scheduling/analytics flow can be demoed without keys.
    return { ok: true, providerMessageId: `dryrun-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  }

  const form = new URLSearchParams();
  form.set('from', env.MAILGUN_FROM!);
  form.set('to', params.to);
  form.set('subject', params.subject);
  form.set('html', params.html);
  form.set('o:tracking', 'yes');
  form.set('o:tracking-opens', 'yes');

  const url = `${env.MAILGUN_BASE_URL}/v3/${env.MAILGUN_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `Mailgun ${res.status}` };
    // Mailgun returns id wrapped in angle brackets, e.g. "<2025...@domain>". Strip them.
    const providerMessageId = normalizeMessageId(data.id);
    return { ok: true, providerMessageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

// Verify Mailgun webhook signature: hmac-sha256(timestamp + token) with the
// HTTP webhook signing key. Rejects tampered or replayed-key payloads.
export function verifyWebhookSignature(sig: {
  timestamp: string;
  token: string;
  signature: string;
}): boolean {
  if (!env.MAILGUN_WEBHOOK_SIGNING_KEY) return false;
  const hmac = createHmac('sha256', env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(sig.timestamp + sig.token)
    .digest('hex');
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(sig.signature));
  } catch {
    return false;
  }
}
