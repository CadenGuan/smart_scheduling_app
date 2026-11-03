import { z } from 'zod';

export const StandingEnum = z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']);
export type Standing = z.infer<typeof StandingEnum>;
export const StandingSchema = StandingEnum;

export const TargetTermEnum = z.enum(['Fall 2026', 'Winter 2027', 'Spring 2027', 'Summer 2027']);
export type TargetTerm = z.infer<typeof TargetTermEnum>;

export const DayEnum = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
export type Day = z.infer<typeof DayEnum>;

export const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in 24-hour HH:MM format')
  .or(z.literal(''))
  .or(z.null())
  .transform((val) => (val === '' || val === null ? undefined : val))
  .optional();

export const UserPreferencesSchema = z
  .object({
    targetTerm: TargetTermEnum.default('Winter 2027'),
    targetCredits: z.number().int().min(5).max(25).default(15),
    earliestStartTime: TimeStringSchema,
    latestEndTime: TimeStringSchema,
    preferredFreeDays: z.array(DayEnum).default([]),
    maxBackToBackHours: z.number().min(1).max(8).optional(),
  })
  .refine(
    (data) => {
      if (data.earliestStartTime && data.latestEndTime) {
        return data.earliestStartTime <= data.latestEndTime;
      }
      return true;
    },
    {
      message: 'earliestStartTime must not be later than latestEndTime',
      path: ['earliestStartTime'],
    }
  );

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

export const UpdateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  standing: StandingSchema.optional(),
  major: z.string().min(1).optional(),
  minor: z.string().nullable().optional(),
  intendedMajor: z.string().nullable().optional(),
  preferences: UserPreferencesSchema.optional(),
});
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
