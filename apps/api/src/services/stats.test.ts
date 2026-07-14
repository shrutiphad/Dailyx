import { describe, it, expect } from 'vitest';
import { deriveCampaignStats } from './stats';

describe('deriveCampaignStats', () => {
  it('returns zeros (and 0 rates, no divide-by-zero) for no recipients', () => {
    expect(deriveCampaignStats({})).toEqual({
      total: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      failed: 0,
      pending: 0,
      rates: { deliveryRate: 0, openRate: 0 },
    });
  });

  it('rolls later states up into sent/delivered so buckets are not double-counted', () => {
    // Each recipient sits in exactly one bucket.
    const stats = deriveCampaignStats({
      PENDING: 2,
      SENT: 1,
      DELIVERED: 3,
      OPENED: 4,
      FAILED: 1,
      BOUNCED: 1,
    });
    expect(stats.total).toBe(12);
    expect(stats.sent).toBe(8); // SENT + DELIVERED + OPENED
    expect(stats.delivered).toBe(7); // DELIVERED + OPENED
    expect(stats.opened).toBe(4);
    expect(stats.failed).toBe(2); // FAILED + BOUNCED
    expect(stats.pending).toBe(2);
  });

  it('computes rounded delivery/open rates', () => {
    const stats = deriveCampaignStats({ SENT: 1, DELIVERED: 3, OPENED: 4 });
    // sent=8, delivered=7, opened=4
    expect(stats.rates.deliveryRate).toBe(88); // round(7/8*100)
    expect(stats.rates.openRate).toBe(57); // round(4/7*100)
  });
});
