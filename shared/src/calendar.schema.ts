import { z } from 'zod';
import { DayEnum } from './onboarding.schema.js';

export const CourseTypeEnum = z.enum(['MAJOR', 'GE', 'ELECTIVE', 'GOOGLE_CALENDAR_BUSY']);
export type CourseType = z.infer<typeof CourseTypeEnum>;

export function getCourseTypeColor(type: string): string {
  switch (type) {
    case 'GE':
      return '#FF6B6B';
    case 'ELECTIVE':
      return '#9B51E0';
    case 'GOOGLE_CALENDAR_BUSY':
      return '#A0AEC0';
    default:
      return '#00B4DB';
  }
}

export const ConflictBadgeSchema = z.enum([
  'Spans preferred free day',
  'Starts before preferred time',
  'Ends after preferred time',
  'Exceeds max back-to-back hours',
  'Time conflict with another course',
]);
export type ConflictBadgeType = z.infer<typeof ConflictBadgeSchema>;

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
  credits: z.number().optional(),
  term: z.string().optional(),
  conflictBadge: z.string().optional(),
  conflictBadges: z.array(ConflictBadgeSchema).optional(),
  pinned: z.boolean().optional(),
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

export const CurriculumNodeStatusEnum = z.enum(['COMPLETED', 'READY_TO_ENROLL', 'LOCKED']);
export type CurriculumNodeStatus = z.infer<typeof CurriculumNodeStatusEnum>;

export const CurriculumNodeSchema = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  level: z.enum(['LOWER', 'UPPER', 'CAPSTONE']),
  status: CurriculumNodeStatusEnum,
  prerequisites: z.array(z.string()),
  unmetPrerequisites: z.array(z.string()),
  tier: z.number(),
});
export type CurriculumNode = z.infer<typeof CurriculumNodeSchema>;

export const CurriculumDagResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    major: z.string(),
    totalCoreCount: z.number(),
    completedCount: z.number(),
    progressPercentage: z.number(),
    nodes: z.array(CurriculumNodeSchema),
    edges: z.array(z.tuple([z.string(), z.string()])),
    readyToEnroll: z.array(z.string()),
  }),
});
export type CurriculumDagResponse = z.infer<typeof CurriculumDagResponseSchema>;

export const SaveCalendarEventsRequestSchema = z.object({
  term: z.string().optional().default('Winter 2027'),
  events: z.array(CalendarEventSchema),
});
export type SaveCalendarEventsRequest = z.infer<typeof SaveCalendarEventsRequestSchema>;

export const SaveCalendarEventsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    message: z.string(),
    count: z.number(),
  }),
  message: z.string().optional(),
  count: z.number().optional(),
});
export type SaveCalendarEventsResponse = z.infer<typeof SaveCalendarEventsResponseSchema>;

export const ClearCalendarEventsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    message: z.string(),
  }),
  message: z.string().optional(),
});
export type ClearCalendarEventsResponse = z.infer<typeof ClearCalendarEventsResponseSchema>;
