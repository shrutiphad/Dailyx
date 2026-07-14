// Pure webhook state-transition logic, split out of routes/webhooks.ts so the
// rules (don't downgrade an OPENED recipient; opens bump the counter; failures
// bounce) are unit-testable without Postgres. The route turns the returned patch
// into a Prisma update; this module makes no DB calls.

export interface RecipientState {
  status: string; // current RecipientStatus
  deliveredAt: Date | null;
  openedAt: Date | null;
}

export interface RecipientPatch {
  status?: string;
  deliveredAt?: Date;
  openedAt?: Date;
  incrementOpenCount?: boolean;
  error?: string;
}

// Given a provider event and the recipient's current state, return the fields to
// update — or null when the event carries no recipient-level change (still logged
// as an EmailEvent by the caller for the audit trail).
export function recipientPatchForEvent(
  event: string,
  current: RecipientState,
  now: Date = new Date(),
  reason?: string,
): RecipientPatch | null {
  switch (event) {
    case 'delivered':
      return {
        deliveredAt: current.deliveredAt ?? now,
        // Never downgrade a recipient that has already opened.
        status: current.status === 'OPENED' ? 'OPENED' : 'DELIVERED',
      };
    case 'opened':
      return {
        status: 'OPENED',
        openedAt: current.openedAt ?? now, // keep the first-open timestamp
        incrementOpenCount: true,
      };
    case 'failed':
    case 'permanent_fail':
      return { status: 'BOUNCED', error: reason ?? 'failed' };
    default:
      return null;
  }
}
