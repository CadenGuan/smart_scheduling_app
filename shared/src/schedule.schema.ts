import { z } from 'zod';

export const SyncStatusEnum = z.enum(['pending', 'synced', 'failed']);
export type SyncStatus = z.infer<typeof SyncStatusEnum>;

export const UserScheduleItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseCode: z.string(),
  title: z.string(),
  description: z.string().default(''),
  days: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isImported: z.boolean().default(false),
  syncStatus: SyncStatusEnum.default('pending'),
  googleEventId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});
export type UserScheduleItem = z.infer<typeof UserScheduleItemSchema>;

export const UserSettingsSchema = z.object({
  userId: z.string(),
  syncEnabled: z.boolean().default(true),
  isConnectedToGoogle: z.boolean().default(false),
  updatedAt: z.string().optional(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const CreateScheduleEventRequestSchema = z.object({
  courseCode: z.string().min(1, 'Course code is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().default(''),
  days: z.string().min(1, 'Days are required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  startDate: z.string().optional().default('2027-01-04'),
  endDate: z.string().optional().default('2027-03-19'),
  isImported: z.boolean().optional().default(false),
});
export type CreateScheduleEventDTO = z.infer<typeof CreateScheduleEventRequestSchema>;

export const UpdateScheduleEventRequestSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  days: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type UpdateScheduleEventDTO = z.infer<typeof UpdateScheduleEventRequestSchema>;

export const SyncRunResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    syncedCount: z.number(),
    failedCount: z.number(),
    pendingCount: z.number(),
    message: z.string(),
  }),
});
export type SyncRunResponse = z.infer<typeof SyncRunResponseSchema>;
