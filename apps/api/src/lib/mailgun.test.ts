import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { normalizeMessageId, verifyWebhookSignature } from './mailgun';

// The test env (see vitest.config.ts) sets MAILGUN_WEBHOOK_SIGNING_KEY.
const SIGNING_KEY = 'test-signing-key';

describe('normalizeMessageId', () => {
  it('strips angle brackets so send-side and webhook-side ids match', () => {
    expect(normalizeMessageId('<20260714.abc@mg.dailyx.app>')).toBe('20260714.abc@mg.dailyx.app');
    expect(normalizeMessageId('20260714.abc@mg.dailyx.app')).toBe('20260714.abc@mg.dailyx.app');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeMessageId('  <x@y>  ')).toBe('x@y');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeMessageId(undefined)).toBe('');
    expect(normalizeMessageId(null)).toBe('');
  });
});

describe('verifyWebhookSignature', () => {
  const sign = (timestamp: string, token: string) =>
    createHmac('sha256', SIGNING_KEY).update(timestamp + token).digest('hex');

  it('accepts a correctly signed payload', () => {
    const timestamp = '1700000000';
    const token = 'abc123';
    expect(verifyWebhookSignature({ timestamp, token, signature: sign(timestamp, token) })).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const timestamp = '1700000000';
    const token = 'abc123';
    const good = sign(timestamp, token);
    const tampered = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0');
    expect(verifyWebhookSignature({ timestamp, token, signature: tampered })).toBe(false);
  });

  it('rejects when the signed content differs from the claimed timestamp/token', () => {
    const signature = sign('1700000000', 'abc123');
    expect(verifyWebhookSignature({ timestamp: '1700000001', token: 'abc123', signature })).toBe(false);
  });
});
