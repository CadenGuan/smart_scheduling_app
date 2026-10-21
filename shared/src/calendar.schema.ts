import { z } from 'zod';
import { DayEnum } from './onboarding.schema.js';

export const CourseTypeEnum = z.enum([
  'MAJOR',
  'GE',
  'ELECTIVE',
  'GOOGLE_CALENDAR_BUSY',
]);
export type CourseType = z.infer<typeof CourseTypeEnum>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: CourseTypeEnum,
  instructor: z.string().optional(),
  location: z.string().optional(),
  days: z.array(DayEnum),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  color: z.string(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarPreviewResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    term: z.string(),
    totalCredits: z.number(),
    events: z.array(CalendarEventSchema),
  }),
});
export type CalendarPreviewResponse = z.infer<typeof CalendarPreviewResponseSchema>;

