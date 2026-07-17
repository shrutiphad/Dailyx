// Deterministic BullMQ job id per campaign, so scheduling/cancelling/rescheduling
// is idempotent (re-adding the same campaign replaces its job rather than
// duplicating the send).
//
// IMPORTANT: BullMQ rejects custom job ids containing ':' — it's their internal
// Redis key separator ("Custom Id cannot contain :"). The separator here must
// never be a colon. Kept in its own module (no Redis import) so it stays testable.
export function jobIdForCampaign(campaignId: string): string {
  return `campaign-${campaignId}`;
}
