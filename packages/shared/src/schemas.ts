import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1),
  accountName: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  customFields: z.record(z.string(), z.any()).optional().default({}),
});

const filterRuleSchema = z.object({
  field: z.string(),
  op: z.enum(['eq', 'neq', 'contains', 'has_tag', 'not_has_tag', 'exists', 'not_exists']),
  value: z.string().optional(),
});

export const filterGroupSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  rules: z.array(filterRuleSchema).default([]),
});

export const audienceSchema = z.object({
  name: z.string().min(1),
  filter: filterGroupSchema,
});

export const campaignSchema = z
  .object({
    name: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    source: z.enum(['AUDIENCE', 'TAG', 'MANUAL']),
    audienceId: z.string().optional().nullable(),
    tag: z.string().optional().nullable(),
    manualEntries: z.array(z.string()).optional().default([]),
    // ISO string; omit/null => send immediately
    scheduledAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (c) =>
      (c.source === 'AUDIENCE' && !!c.audienceId) ||
      (c.source === 'TAG' && !!c.tag) ||
      (c.source === 'MANUAL' && (c.manualEntries?.length ?? 0) > 0),
    { message: 'Recipient selection is incomplete for the chosen source' },
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type AudienceInput = z.infer<typeof audienceSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
