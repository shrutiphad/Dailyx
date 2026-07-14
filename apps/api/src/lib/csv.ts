import { parse } from 'csv-parse/sync';
import { normalizeEmail, normalizePhone, parseTags } from '@dailyx/shared';

export interface ParsedContact {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  tags: string[];
  emailKey: string;
  phoneKey: string | null;
  customFields: Record<string, string>;
}

const KNOWN = new Set(['name', 'email', 'phone', 'city', 'tags']);

// Parse CSV into normalized contacts + collect rows we intentionally drop
// (missing email, or duplicate within the file itself). Unknown columns become
// custom fields, honoring the "don't lock them to a fixed schema" requirement.
export function parseContactsCsv(buffer: Buffer): {
  contacts: ParsedContact[];
  skippedInFile: { row: number; reason: string; email?: string }[];
} {
  const records = parse(buffer, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const contacts: ParsedContact[] = [];
  const skippedInFile: { row: number; reason: string; email?: string }[] = [];
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();

  records.forEach((rec, i) => {
    const rowNum = i + 2; // +1 header, +1 for 1-based
    const email = (rec.email || '').trim();
    if (!email) {
      skippedInFile.push({ row: rowNum, reason: 'missing email' });
      return;
    }
    const emailKey = normalizeEmail(email);
    const phoneKey = normalizePhone(rec.phone);

    // De-dupe within the uploaded file before we even hit the DB.
    if (seenEmail.has(emailKey)) {
      skippedInFile.push({ row: rowNum, reason: 'duplicate email in file', email });
      return;
    }
    if (phoneKey && seenPhone.has(phoneKey)) {
      skippedInFile.push({ row: rowNum, reason: 'duplicate phone in file', email });
      return;
    }
    seenEmail.add(emailKey);
    if (phoneKey) seenPhone.add(phoneKey);

    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!KNOWN.has(k) && v != null && String(v).trim() !== '') customFields[k] = String(v);
    }

    contacts.push({
      name: (rec.name || email).trim(),
      email,
      phone: rec.phone?.trim() || null,
      city: rec.city?.trim() || null,
      tags: parseTags(rec.tags),
      emailKey,
      phoneKey,
      customFields,
    });
  });

  return { contacts, skippedInFile };
}
