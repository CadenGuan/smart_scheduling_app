import { z } from 'zod';

export const StandingEnum = z.enum([
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
  'Graduate',
]);
export type Standing = z.infer<typeof StandingEnum>;

export const UserProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  standing: StandingEnum,
  major: z.string().min(1).max(100),
  minor: z.string().nullable().optional(),
  intendedMajor: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

