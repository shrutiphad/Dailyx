import { describe, it, expect } from 'vitest';
import { jobIdForCampaign } from './jobId';

describe('jobIdForCampaign', () => {
  it('never contains a colon — BullMQ rejects it ("Custom Id cannot contain :")', () => {
    expect(jobIdForCampaign('cmrld0f2v0001td9yao9gfpwc')).not.toContain(':');
  });

  it('is deterministic, so re-scheduling replaces the job instead of duplicating the send', () => {
    expect(jobIdForCampaign('abc123')).toBe(jobIdForCampaign('abc123'));
  });

  it('is unique per campaign', () => {
    expect(jobIdForCampaign('abc')).not.toBe(jobIdForCampaign('abd'));
  });
});
