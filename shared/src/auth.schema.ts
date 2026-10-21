import { z } from 'zod';
import { StandingEnum, UserProfileSchema } from './user.schema.js';

export const RegisterRequestSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  standing: StandingEnum,
  major: z.string().min(1, 'Major is required').max(100),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const GoogleAuthRequestSchema = z.object({
  idToken: z.string().min(1, 'Google ID token or mock identifier is required'),
  isMock: z.boolean().optional().default(false),
});
export type GoogleAuthRequest = z.infer<typeof GoogleAuthRequestSchema>;

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    user: UserProfileSchema,
    token: z.string(),
    onboardingCompleted: z.boolean(),
    googleCalendarLinked: z.boolean().optional(),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

