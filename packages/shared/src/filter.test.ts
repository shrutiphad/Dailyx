import { describe, it, expect } from 'vitest';
import { compileFilter, type FilterGroup } from './filter';

const group = (partial: Partial<FilterGroup>): FilterGroup => ({
  match: 'all',
  rules: [],
  ...partial,
});

describe('compileFilter', () => {
  it('returns an empty where for no rules', () => {
    expect(compileFilter(group({ rules: [] }))).toEqual({});
  });

  it('ignores unknown fields and empty values (no crash, no clause)', () => {
    const where = compileFilter(
      group({ rules: [{ field: 'zzz', op: 'eq', value: 'x' }, { field: 'tag', op: 'has_tag', value: '' }] }),
    );
    expect(where).toEqual({});
  });

  it('wraps multiple clauses in AND for match=all', () => {
    const where = compileFilter(
      group({
        match: 'all',
        rules: [
          { field: 'city', op: 'eq', value: 'Mumbai' },
          { field: 'tag', op: 'has_tag', value: 'VIP' },
        ],
      }),
    );
    expect(where).toEqual({
      AND: [
        { city: { equals: 'Mumbai', mode: 'insensitive' } },
        { tags: { has: 'vip' } }, // tag value is lowercased
      ],
    });
  });

  it('wraps multiple clauses in OR for match=any', () => {
    const where = compileFilter(
      group({
        match: 'any',
        rules: [
          { field: 'city', op: 'eq', value: 'Delhi' },
          { field: 'city', op: 'eq', value: 'Pune' },
        ],
      }),
    );
    expect(where).toEqual({
      OR: [
        { city: { equals: 'Delhi', mode: 'insensitive' } },
        { city: { equals: 'Pune', mode: 'insensitive' } },
      ],
    });
  });

  // A group always combines its clauses under AND/OR (harmless for a single
  // clause; keeps the shape uniform), so single-rule groups come back as { AND: [...] }.
  it('compiles tag operators', () => {
    expect(compileFilter(group({ rules: [{ field: 'tag', op: 'not_has_tag', value: 'spam' }] }))).toEqual({
      AND: [{ NOT: { tags: { has: 'spam' } } }],
    });
  });

  it('compiles built-in string operators case-insensitively', () => {
    expect(compileFilter(group({ rules: [{ field: 'name', op: 'contains', value: 'ar' }] }))).toEqual({
      AND: [{ name: { contains: 'ar', mode: 'insensitive' } }],
    });
    expect(compileFilter(group({ rules: [{ field: 'email', op: 'neq', value: 'a@b.com' }] }))).toEqual({
      AND: [{ NOT: { email: { equals: 'a@b.com', mode: 'insensitive' } } }],
    });
  });

  it('compiles custom-field JSON path operators', () => {
    expect(compileFilter(group({ rules: [{ field: 'custom:plan_tier', op: 'eq', value: 'pro' }] }))).toEqual({
      AND: [{ customFields: { path: ['plan_tier'], equals: 'pro' } }],
    });
    expect(compileFilter(group({ rules: [{ field: 'custom:plan_tier', op: 'exists' }] }))).toEqual({
      AND: [{ customFields: { path: ['plan_tier'], not: null } }],
    });
    expect(compileFilter(group({ rules: [{ field: 'custom:src', op: 'contains', value: 'web' }] }))).toEqual({
      AND: [{ customFields: { path: ['src'], string_contains: 'web' } }],
    });
  });
});
