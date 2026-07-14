import { describe, it, expect } from 'vitest';
import { contactSchema, campaignSchema, signupSchema } from './schemas';

describe('contactSchema', () => {
  it('applies defaults for tags and customFields', () => {
    const out = contactSchema.parse({ name: 'A', email: 'a@b.com' });
    expect(out.tags).toEqual([]);
    expect(out.customFields).toEqual({});
  });

  it('rejects a bad email', () => {
    expect(contactSchema.safeParse({ name: 'A', email: 'not-an-email' }).success).toBe(false);
  });
});

describe('signupSchema', () => {
  it('requires an 8+ char password', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'short', name: 'A', accountName: 'Acme' }).success).toBe(false);
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'longenough', name: 'A', accountName: 'Acme' }).success).toBe(true);
  });
});

describe('campaignSchema recipient-source refinement', () => {
  const base = { name: 'C', subject: 'S', body: 'B' };

  it('accepts AUDIENCE with an audienceId', () => {
    expect(campaignSchema.safeParse({ ...base, source: 'AUDIENCE', audienceId: 'aud_1' }).success).toBe(true);
  });

  it('rejects AUDIENCE without an audienceId', () => {
    expect(campaignSchema.safeParse({ ...base, source: 'AUDIENCE' }).success).toBe(false);
  });

  it('rejects TAG without a tag', () => {
    expect(campaignSchema.safeParse({ ...base, source: 'TAG' }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, source: 'TAG', tag: 'vip' }).success).toBe(true);
  });

  it('rejects MANUAL with no entries', () => {
    expect(campaignSchema.safeParse({ ...base, source: 'MANUAL', manualEntries: [] }).success).toBe(false);
    expect(campaignSchema.safeParse({ ...base, source: 'MANUAL', manualEntries: ['a@b.com'] }).success).toBe(true);
  });

  it('rejects a non-ISO scheduledAt', () => {
    expect(
      campaignSchema.safeParse({ ...base, source: 'TAG', tag: 'vip', scheduledAt: 'tomorrow' }).success,
    ).toBe(false);
  });
});
