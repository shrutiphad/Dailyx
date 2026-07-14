import { prisma } from '@dailyx/db';
import { compileFilter, normalizeEmail, normalizePhone, type FilterGroup } from '@dailyx/shared';

export interface ResolvedRecipient {
  contactId: string | null;
  email: string;
  name: string | null;
}

// Given a campaign's source, return the concrete list of contacts to email.
// Always scoped by accountId — resolution can never cross tenants.
export async function resolveRecipients(
  accountId: string,
  source: 'AUDIENCE' | 'TAG' | 'MANUAL',
  opts: { audienceId?: string | null; tag?: string | null; manualEntries?: string[] },
): Promise<{ recipients: ResolvedRecipient[]; unmatched: string[] }> {
  if (source === 'AUDIENCE') {
    const audience = await prisma.audience.findFirst({
      where: { id: opts.audienceId ?? '', accountId },
    });
    if (!audience) return { recipients: [], unmatched: [] };
    const where = { accountId, ...compileFilter(audience.filter as unknown as FilterGroup) };
    const contacts = await prisma.contact.findMany({ where });
    return {
      recipients: contacts.map((c) => ({ contactId: c.id, email: c.email, name: c.name })),
      unmatched: [],
    };
  }

  if (source === 'TAG') {
    const tag = (opts.tag ?? '').trim().toLowerCase();
    const contacts = await prisma.contact.findMany({
      where: { accountId, tags: { has: tag } },
    });
    return {
      recipients: contacts.map((c) => ({ contactId: c.id, email: c.email, name: c.name })),
      unmatched: [],
    };
  }

  // MANUAL: look up each pasted email/phone against saved contacts.
  return matchManualEntries(accountId, opts.manualEntries ?? []);
}

// Used both at send time and by the live "who am I about to email" preview.
export async function matchManualEntries(
  accountId: string,
  entries: string[],
): Promise<{ recipients: ResolvedRecipient[]; unmatched: string[] }> {
  const recipients: ResolvedRecipient[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  const contacts = await prisma.contact.findMany({ where: { accountId } });
  const byEmail = new Map(contacts.map((c) => [c.emailKey, c]));
  const byPhone = new Map(contacts.filter((c) => c.phoneKey).map((c) => [c.phoneKey!, c]));

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const isEmail = entry.includes('@');
    const match = isEmail
      ? byEmail.get(normalizeEmail(entry))
      : (() => {
          const key = normalizePhone(entry);
          return key ? byPhone.get(key) : undefined;
        })();

    if (!match) {
      unmatched.push(entry);
      continue;
    }
    if (seen.has(match.emailKey)) continue; // de-dupe recipients
    seen.add(match.emailKey);
    recipients.push({ contactId: match.id, email: match.email, name: match.name });
  }

  return { recipients, unmatched };
}
