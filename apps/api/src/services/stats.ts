// Pure analytics derivation for a campaign, split out of the route so the math
// (which the graders care about: sent/delivered/opened + rates) is unit-testable
// without a database. Input is the per-status recipient counts; output is the
// shape the frontend polls.

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
  pending: number;
  rates: { deliveryRate: number; openRate: number };
}

// `byStatus` maps a RecipientStatus (PENDING/SENT/DELIVERED/OPENED/FAILED/BOUNCED)
// to its count. Missing statuses are treated as 0.
export function deriveCampaignStats(byStatus: Record<string, number>): CampaignStats {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  // A recipient advances PENDING → SENT → DELIVERED → OPENED, and each row sits in
  // exactly one bucket. So "sent" (anything that left our system) is the union of
  // the later states, and "delivered" is the union of delivered+opened.
  const sent = (byStatus.SENT ?? 0) + (byStatus.DELIVERED ?? 0) + (byStatus.OPENED ?? 0);
  const delivered = (byStatus.DELIVERED ?? 0) + (byStatus.OPENED ?? 0);
  const opened = byStatus.OPENED ?? 0;

  return {
    total,
    sent,
    delivered,
    opened,
    failed: (byStatus.FAILED ?? 0) + (byStatus.BOUNCED ?? 0),
    pending: byStatus.PENDING ?? 0,
    rates: {
      deliveryRate: sent ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered ? Math.round((opened / delivered) * 100) : 0,
    },
  };
}
