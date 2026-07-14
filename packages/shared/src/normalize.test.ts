import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhone, parseTags } from './normalize';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });
});

describe('normalizePhone', () => {
  it('collapses spacing/punctuation but keeps a leading +', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('keeps digits without a + when none is present', () => {
    expect(normalizePhone('(044) 2233-4455')).toBe('04422334455');
  });

  it('returns null for empty / undefined / non-numeric input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('n/a')).toBeNull();
  });

  it('makes two spellings of the same number collide (dedup key property)', () => {
    expect(normalizePhone('+91 98765 43210')).toBe(normalizePhone('+919876543210'));
  });
});

describe('parseTags', () => {
  it('splits on comma/semicolon, lowercases, trims, dedupes', () => {
    expect(parseTags('VIP, newsletter; vip ,, Newsletter')).toEqual(['vip', 'newsletter']);
  });

  it('returns [] for empty/nullish', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });
});
