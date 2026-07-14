import { describe, it, expect } from 'vitest';
import { recipientPatchForEvent, type RecipientState } from './emailEvents';

const NOW = new Date('2026-07-14T12:00:00.000Z');
const pending: RecipientState = { status: 'PENDING', deliveredAt: null, openedAt: null };

describe('recipientPatchForEvent', () => {
  it('marks a delivered recipient DELIVERED and stamps deliveredAt', () => {
    expect(recipientPatchForEvent('delivered', pending, NOW)).toEqual({
      status: 'DELIVERED',
      deliveredAt: NOW,
    });
  });

  it('never downgrades an already-OPENED recipient on a late delivered event', () => {
    const opened: RecipientState = { status: 'OPENED', deliveredAt: null, openedAt: new Date('2026-07-14T11:00:00Z') };
    const patch = recipientPatchForEvent('delivered', opened, NOW);
    expect(patch?.status).toBe('OPENED');
  });

  it('marks opened, keeps the first-open timestamp, and bumps the open counter', () => {
    const firstOpen = new Date('2026-07-14T11:30:00Z');
    // first open: no prior openedAt -> stamps now
    expect(recipientPatchForEvent('opened', pending, NOW)).toEqual({
      status: 'OPENED',
      openedAt: NOW,
      incrementOpenCount: true,
    });
    // second open: preserves the original openedAt, still increments
    const already: RecipientState = { status: 'OPENED', deliveredAt: NOW, openedAt: firstOpen };
    expect(recipientPatchForEvent('opened', already, NOW)).toEqual({
      status: 'OPENED',
      openedAt: firstOpen,
      incrementOpenCount: true,
    });
  });

  it('bounces on failed / permanent_fail and carries the reason', () => {
    expect(recipientPatchForEvent('failed', pending, NOW, 'mailbox full')).toEqual({
      status: 'BOUNCED',
      error: 'mailbox full',
    });
    expect(recipientPatchForEvent('permanent_fail', pending, NOW)).toEqual({
      status: 'BOUNCED',
      error: 'failed',
    });
  });

  it('returns null for events with no recipient-level change', () => {
    expect(recipientPatchForEvent('clicked', pending, NOW)).toBeNull();
    expect(recipientPatchForEvent('unsubscribed', pending, NOW)).toBeNull();
  });
});
