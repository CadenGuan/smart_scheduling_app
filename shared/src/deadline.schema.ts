import { z } from 'zod';

export const ConferenceTierEnum = z.enum([
  'Top Tier',
  'Major Conference',
  'Undergraduate Showcase',
]);
export type ConferenceTier = z.infer<typeof ConferenceTierEnum>;

export const ConferenceDeadlineSchema = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string(),
  tier: ConferenceTierEnum,
  submissionDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  conferenceDates: z.string(),
  location: z.string(),
  topics: z.array(z.string()),
  websiteUrl: z.string().optional(),
  description: z.string(),
  daysUntilDeadline: z.number().optional(),
  status: z.enum(['URGENT', 'UPCOMING', 'OPEN', 'PASSED']).optional(),
});
export type ConferenceDeadline = z.infer<typeof ConferenceDeadlineSchema>;

export const DeadlinesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    totalCount: z.number(),
    deadlines: z.array(ConferenceDeadlineSchema),
    topics: z.array(z.string()),
  }),
});
export type DeadlinesResponse = z.infer<typeof DeadlinesResponseSchema>;
