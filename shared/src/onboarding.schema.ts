import { z } from 'zod';
import { StandingEnum } from './user.schema.js';

export const GeSourceEnum = z.enum([
  'UCSC',
  'Community College / IGETC',
  'Hybrid',
]);
export type GeSource = z.infer<typeof GeSourceEnum>;

export const TargetTermEnum = z.enum([
  'Fall 2026',
  'Winter 2027',
  'Spring 2027',
  'Summer 2027',
]);
export type TargetTerm = z.infer<typeof TargetTermEnum>;

export const DayEnum = z.enum([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
]);
export type Day = z.infer<typeof DayEnum>;

export const TimeWindowSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  days: z.array(DayEnum),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required'),
});
export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export const OnboardingQuestionnaireSchema = z.object({
  // Step 1: Personal & Academic Profile
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  standing: StandingEnum,
  major: z.string().min(1, 'Major is required'),
  minor: z.string().nullable().optional(),
  intendedMajor: z.string().nullable().optional(),

  // Step 2: Academic History
  majorRequirementsTaken: z.array(z.string()).default([]),

  // Step 3: General Education
  geSource: GeSourceEnum.default('UCSC'),
  geCategoriesRemaining: z.array(z.string()).default([]),

  // Step 4: Quarter Planning & Capacity
  targetTerm: TargetTermEnum.default('Winter 2027'),
  targetCredits: z.number().int().min(5).max(25).default(15),
  targetCourseCount: z.number().int().min(1).max(5).default(3),

  // Step 5: Scheduling Preferences & Constraints
  earliestStartTime: z.string().optional(),
  latestEndTime: z.string().optional(),
  preferredFreeDays: z.array(DayEnum).default([]),
  scheduledBreaks: z.array(TimeWindowSchema).default([]),
  maxBackToBackHours: z.number().min(1).max(8).optional(),
});
export type OnboardingQuestionnaire = z.infer<typeof OnboardingQuestionnaireSchema>;

export const OnboardingProgressPayloadSchema = z.object({
  lastStep: z.number().int().min(1).max(5),
  skippedSteps: z.array(z.number().int().min(1).max(5)).default([]),
  draftAnswers: OnboardingQuestionnaireSchema.partial().default({}),
  completed: z.boolean().default(false),
});
export type OnboardingProgressPayload = z.infer<typeof OnboardingProgressPayloadSchema>;

