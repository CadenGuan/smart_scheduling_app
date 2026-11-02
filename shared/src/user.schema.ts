import { z } from 'zod';

export const StandingEnum = z.enum([
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
]);
export type Standing = z.infer<typeof StandingEnum>;

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

export const UserPreferencesSchema = z.object({
  targetTerm: TargetTermEnum.default('Winter 2027'),
  targetCredits: z.number().int().min(5).max(25).default(15),
  earliestStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required').optional(),
  latestEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:MM format required').optional(),
  preferredFreeDays: z.array(DayEnum).default([]),
  maxBackToBackHours: z.number().min(1).max(8).optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const UserProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  standing: StandingEnum,
  major: z.string().min(1).max(100),
  minor: z.string().nullable().optional(),
  intendedMajor: z.string().nullable().optional(),
  preferences: UserPreferencesSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
