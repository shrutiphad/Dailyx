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

// Compile a FilterGroup into a Prisma `where` fragment (already scoped by
// accountId at the call site). Unknown/empty rules are ignored.
export function compileFilter(group: FilterGroup): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];

  for (const rule of group.rules ?? []) {
    const clause = compileRule(rule);
    if (clause) clauses.push(clause);
  }

  if (clauses.length === 0) return {};
  return group.match === 'any' ? { OR: clauses } : { AND: clauses };
}

function compileRule(rule: FilterRule): Record<string, unknown> | null {
  const { field, op, value } = rule;

  // Tags are a scalar string[]; use Prisma array operators.
  if (field === 'tag') {
    const v = (value ?? '').trim().toLowerCase();
    if (!v) return null;
    if (op === 'has_tag') return { tags: { has: v } };
    if (op === 'not_has_tag') return { NOT: { tags: { has: v } } };
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
