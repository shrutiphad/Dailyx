// Audience filter model + a Prisma-where compiler.
//
// A filter is a group of rules combined with AND ("all") or OR ("any"). Fields
// can be built-ins (city, tag, email, name) or custom fields (customFields.<key>).

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'has_tag'
  | 'not_has_tag'
  | 'exists'
  | 'not_exists';

export interface FilterRule {
  field: string; // "city" | "name" | "email" | "tag" | "custom:plan_tier"
  op: FilterOp;
  value?: string;
}

export interface FilterGroup {
  match: 'all' | 'any';
  rules: FilterRule[];
}

export const EMPTY_FILTER: FilterGroup = { match: 'all', rules: [] };

// A Prisma `where` that matches no rows. `id IN ()` is always false, and Prisma
// compiles an empty `in: []` to that. Used when the user defined filter rules but
// none of them are usable — we must NOT fall back to "match everyone".
export const MATCH_NONE: Record<string, unknown> = { id: { in: [] } };

// Compile a FilterGroup into a Prisma `where` fragment (already scoped by
// accountId at the call site).
//
// Fallback rule that matters: if the group has rules but none compile to a usable
// clause (e.g. an unsupported field/operator pair, or an empty value), we return
// MATCH_NONE — an audience with a broken rule targets nobody, never the whole list.
// Only a group with genuinely zero rules means "no filter → everyone" ({}).
export function compileFilter(group: FilterGroup): Record<string, unknown> {
  const rules = group.rules ?? [];
  const clauses: Record<string, unknown>[] = [];

  for (const rule of rules) {
    const clause = compileRule(rule);
    if (clause) clauses.push(clause);
  }

  if (clauses.length > 0) {
    return group.match === 'any' ? { OR: clauses } : { AND: clauses };
  }
  return rules.length === 0 ? {} : MATCH_NONE;
}

function compileRule(rule: FilterRule): Record<string, unknown> | null {
  const { field, op, value } = rule;

  // Tags are a scalar string[]; use Prisma array operators. For a tag, "is X"
  // and "equals X" naturally mean "has tag X", so accept eq/neq as aliases of
  // has_tag/not_has_tag — otherwise a `tag is vip` rule would be dropped.
  if (field === 'tag') {
    const v = (value ?? '').trim().toLowerCase();
    if (!v) return null;
    if (op === 'has_tag' || op === 'eq') return { tags: { has: v } };
    if (op === 'not_has_tag' || op === 'neq') return { NOT: { tags: { has: v } } };
    return null;
  }

  // Custom fields live in a JSON column.
  if (field.startsWith('custom:')) {
    const key = field.slice('custom:'.length);
    if (op === 'exists') return { customFields: { path: [key], not: null } };
    if (op === 'not_exists') return { customFields: { path: [key], equals: null } };
    if (op === 'eq') return { customFields: { path: [key], equals: value ?? '' } };
    if (op === 'neq') return { NOT: { customFields: { path: [key], equals: value ?? '' } } };
    if (op === 'contains')
      return { customFields: { path: [key], string_contains: value ?? '' } };
    return null;
  }

  // Built-in scalar string columns.
  if (['city', 'name', 'email'].includes(field)) {
    const v = value ?? '';
    if (op === 'eq') return { [field]: { equals: v, mode: 'insensitive' } };
    if (op === 'neq') return { NOT: { [field]: { equals: v, mode: 'insensitive' } } };
    if (op === 'contains') return { [field]: { contains: v, mode: 'insensitive' } };
    if (op === 'exists') return { [field]: { not: null } };
    return null;
  }

  return null;
}
