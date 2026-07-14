import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseContactsCsv } from './csv';

const csv = (s: string) => parseContactsCsv(Buffer.from(s));

describe('parseContactsCsv — the provided mock file', () => {
  it('yields 16 contacts and skips the 2 in-file duplicates (sneha@, priya@)', () => {
    const path = fileURLToPath(new URL('../../../../mock-data/contacts.csv', import.meta.url));
    const { contacts, skippedInFile } = parseContactsCsv(readFileSync(path));

    expect(contacts).toHaveLength(16);
    expect(skippedInFile).toHaveLength(2);
    expect(skippedInFile.every((s) => s.reason.startsWith('duplicate'))).toBe(true);
    // The two skipped emails are the repeated ones.
    expect(skippedInFile.map((s) => s.email).sort()).toEqual(['priya@example.com', 'sneha@example.com']);
  });
});

describe('parseContactsCsv — dedup + normalization rules', () => {
  it('skips rows with a missing email, tagged as such', () => {
    const { contacts, skippedInFile } = csv('name,email\nNo Email,\nHas Email,a@b.com\n');
    expect(contacts).toHaveLength(1);
    expect(skippedInFile).toEqual([{ row: 2, reason: 'missing email' }]);
  });

  it('de-dupes on email case-insensitively within the file', () => {
    const { contacts, skippedInFile } = csv('name,email\nA,dup@x.com\nB,DUP@x.com\n');
    expect(contacts).toHaveLength(1);
    expect(skippedInFile[0].reason).toBe('duplicate email in file');
  });

  it('de-dupes on phone within the file even when emails differ', () => {
    const { contacts, skippedInFile } = csv('name,email,phone\nA,a@x.com,+91 98765 43210\nB,b@x.com,+919876543210\n');
    expect(contacts).toHaveLength(1);
    expect(skippedInFile[0].reason).toBe('duplicate phone in file');
  });

  it('promotes unknown columns to custom fields and registers built-ins normally', () => {
    const { contacts } = csv('name,email,plan_tier,signup_source\nA,a@x.com,pro,web\n');
    expect(contacts[0].customFields).toEqual({ plan_tier: 'pro', signup_source: 'web' });
  });

  it('normalizes tags and dedup keys', () => {
    const { contacts } = csv('name,email,phone,tags\nA,A@X.com,+91 111 222,"VIP, news; vip"\n');
    expect(contacts[0].emailKey).toBe('a@x.com');
    expect(contacts[0].phoneKey).toBe('+91111222');
    expect(contacts[0].tags).toEqual(['vip', 'news']);
  });

  it('falls back to the email as name when name is blank', () => {
    const { contacts } = csv('name,email\n,a@x.com\n');
    expect(contacts[0].name).toBe('a@x.com');
  });
});
