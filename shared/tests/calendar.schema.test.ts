import { describe, it, expect } from 'vitest';
import {
  CourseTypeEnum,
  ConflictBadgeSchema,
  CalendarEventSchema,
  CalendarPreviewResponseSchema,
} from '../src/calendar.schema.js';

describe('Calendar Schema Architectural Contract Tests [TESTING_GOLDEN_RULES.md Layer: Shared]', () => {
  describe('CourseTypeEnum', () => {
    it('accepts valid course types and rejects invalid values', () => {
      expect(CourseTypeEnum.safeParse('MAJOR').success).toBe(true);
      expect(CourseTypeEnum.safeParse('GE').success).toBe(true);
      expect(CourseTypeEnum.safeParse('ELECTIVE').success).toBe(true);
      expect(CourseTypeEnum.safeParse('GOOGLE_CALENDAR_BUSY').success).toBe(true);

      expect(CourseTypeEnum.safeParse('MINOR').success).toBe(false);
      expect(CourseTypeEnum.safeParse('PERSONAL').success).toBe(false);
    });
  });

  describe('ConflictBadgeSchema', () => {
    it('validates all recognized conflict badge types including back-to-back and collisions', () => {
      expect(ConflictBadgeSchema.safeParse('Spans preferred free day').success).toBe(true);
      expect(ConflictBadgeSchema.safeParse('Starts before preferred time').success).toBe(true);
      expect(ConflictBadgeSchema.safeParse('Ends after preferred time').success).toBe(true);
      expect(ConflictBadgeSchema.safeParse('Exceeds max back-to-back hours').success).toBe(true);
      expect(ConflictBadgeSchema.safeParse('Time conflict with another course').success).toBe(true);

      expect(ConflictBadgeSchema.safeParse('Unknown conflict').success).toBe(false);
      expect(ConflictBadgeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('CalendarEventSchema', () => {
    const validEvent = {
      id: 'cse-115a-lec',
      title: 'CSE 115A: Intro to Software Engineering',
      type: 'MAJOR',
      instructor: 'Richard Jullig',
      location: 'Baskin Engr 152',
      days: ['Monday', 'Wednesday', 'Friday'],
      startTime: '09:00',
      endTime: '10:10',
      color: '#00B4DB',
      credits: 5,
      term: 'Winter 2027',
      conflictBadge: 'Spans preferred free day',
      conflictBadges: ['Spans preferred free day', 'Exceeds max back-to-back hours'],
    };

    it('validates a complete calendar event with conflict badges', () => {
      const parsed = CalendarEventSchema.safeParse(validEvent);
      expect(parsed.success).toBe(true);
    });

    it('validates calendar event with pinned flag true and false', () => {
      const pinnedEvent = {
        ...validEvent,
        pinned: true,
      };
      const unpinnedEvent = {
        ...validEvent,
        pinned: false,
      };
      expect(CalendarEventSchema.safeParse(pinnedEvent).success).toBe(true);
      expect(CalendarEventSchema.safeParse(unpinnedEvent).success).toBe(true);
      expect(CalendarEventSchema.parse(pinnedEvent).pinned).toBe(true);
    });

    it('validates minimal calendar event without optional fields', () => {
      const minimalEvent = {
        id: 'gcal-shift',
        title: 'Work Shift',
        type: 'GOOGLE_CALENDAR_BUSY',
        days: ['Tuesday'],
        startTime: '10:00',
        endTime: '12:00',
        color: '#F9CA24',
      };
      const parsed = CalendarEventSchema.safeParse(minimalEvent);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid time formats in CalendarEventSchema', () => {
      expect(
        CalendarEventSchema.safeParse({
          ...validEvent,
          startTime: '9:00',
        }).success
      ).toBe(false);

      expect(
        CalendarEventSchema.safeParse({
          ...validEvent,
          endTime: '25:00',
        }).success
      ).toBe(false);
    });
  });

  describe('CalendarPreviewResponseSchema', () => {
    it('validates successful calendar preview response envelope', () => {
      const response = {
        success: true,
        data: {
          term: 'Winter 2027',
          totalCredits: 15,
          events: [
            {
              id: 'cse-115a-lec',
              title: 'CSE 115A',
              type: 'MAJOR',
              days: ['Monday', 'Wednesday'],
              startTime: '09:00',
              endTime: '10:10',
              color: '#00B4DB',
            },
          ],
        },
      };

      const parsed = CalendarPreviewResponseSchema.safeParse(response);
      expect(parsed.success).toBe(true);
    });

    it('rejects payload missing totalCredits or events', () => {
      expect(
        CalendarPreviewResponseSchema.safeParse({
          success: true,
          data: {
            term: 'Winter 2027',
          },
        }).success
      ).toBe(false);
    });
  });
});
