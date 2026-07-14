// Normalization used for deduplication. The goal: two spellings of the same
// email/phone collapse to the same key so the DB unique index catches dups.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Keep a leading +, strip everything else non-digit. "+91 98765 43210" and
// "+919876543210" both become "+919876543210".
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,;]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
