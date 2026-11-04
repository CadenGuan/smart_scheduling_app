import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CourseTypeEnum,
  CourseLevelEnum,
  ConflictBadgeSchema,
  CalendarEventSchema,
  CourseSchema,
  CourseCatalogItemSchema,
  CalendarPreviewResponseSchema,
  SaveCalendarEventsRequestSchema,
  SaveCalendarEventsResponseSchema,
  ClearCalendarEventsResponseSchema,
  getCourseTypeColor,
} from '../src/calendar.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const coursesJsonPath = path.resolve(__dirname, '../../data/courses.json');

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

  describe('CourseLevelEnum', () => {
    it('accepts LOWER, UPPER, and CAPSTONE levels', () => {
      expect(CourseLevelEnum.safeParse('LOWER').success).toBe(true);
      expect(CourseLevelEnum.safeParse('UPPER').success).toBe(true);
      expect(CourseLevelEnum.safeParse('CAPSTONE').success).toBe(true);
    });

    it('rejects unrecognized course level classifications', () => {
      expect(CourseLevelEnum.safeParse('GRADUATE').success).toBe(false);
      expect(CourseLevelEnum.safeParse('INTRO').success).toBe(false);
      expect(CourseLevelEnum.safeParse('').success).toBe(false);
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

    it('validates calendar event with extended fields (code, department, level, ge)', () => {
      const extendedEvent = {
        ...validEvent,
        code: 'CSE 115A',
        department: 'CSE',
        level: 'UPPER',
        ge: null,
        description: 'Software Engineering core course.',
      };
      const parsed = CalendarEventSchema.safeParse(extendedEvent);
      expect(parsed.success).toBe(true);
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

  describe('CourseSchema & CourseCatalogItemSchema', () => {
    const validCourse = {
      id: 'cse-101-01',
      code: 'CSE 101',
      title: 'CSE 101: Introduction to Data Structures and Algorithms',
      department: 'CSE',
      level: 'UPPER',
      type: 'MAJOR',
      instructor: 'Patrick Tantalo',
      location: 'Baskin Engr 101',
      days: ['Monday', 'Wednesday', 'Friday'],
      startTime: '09:00',
      endTime: '10:15',
      color: '#00B4DB',
      credits: 5,
      term: 'Winter 2027',
      ge: null,
      description: 'Data structures and algorithm design.',
    };

    it('validates a complete course catalog item schema', () => {
      const parsed = CourseSchema.safeParse(validCourse);
      expect(parsed.success).toBe(true);
      expect(CourseCatalogItemSchema.safeParse(validCourse).success).toBe(true);
    });

    it('applies defaults for type, color, and credits when omitted', () => {
      const minimal = {
        id: 'cse-101-min',
        code: 'CSE 101',
        title: 'CSE 101 Minimal',
        department: 'CSE',
        level: 'UPPER' as const,
        term: 'Winter 2027',
        days: ['Monday', 'Wednesday'] as const,
        startTime: '10:00',
        endTime: '11:35',
      };
      const parsed = CourseSchema.parse(minimal);
      expect(parsed.type).toBe('MAJOR');
      expect(parsed.color).toBe('#00B4DB');
      expect(parsed.credits).toBe(5);
    });

    it('rejects course item missing mandatory catalog attributes', () => {
      expect(CourseSchema.safeParse({ id: 'cse-101' }).success).toBe(false);
      expect(CourseSchema.safeParse({ ...validCourse, code: undefined }).success).toBe(false);
      expect(CourseSchema.safeParse({ ...validCourse, department: undefined }).success).toBe(false);
      expect(CourseSchema.safeParse({ ...validCourse, level: 'INVALID' }).success).toBe(false);
    });
  });

  describe('Curated 18-Course Dataset Schema Validation Contract', () => {
    it('verifies that data/courses.json exists and contains exactly 18 curated courses', () => {
      expect(fs.existsSync(coursesJsonPath)).toBe(true);
      const rawData = fs.readFileSync(coursesJsonPath, 'utf8');
      const courses = JSON.parse(rawData);

      expect(Array.isArray(courses)).toBe(true);
      expect(courses).toHaveLength(21);
    });

    it('validates that all curated courses strictly conform to CourseSchema and CalendarEventSchema', () => {
      const rawData = fs.readFileSync(coursesJsonPath, 'utf8');
      const courses = JSON.parse(rawData);

      for (const course of courses) {
        const courseValidation = CourseSchema.safeParse(course);
        expect(
          courseValidation.success,
          `Course ${course.id} failed CourseSchema validation: ${JSON.stringify(
            courseValidation.error?.errors
          )}`
        ).toBe(true);

        const eventValidation = CalendarEventSchema.safeParse(course);
        expect(
          eventValidation.success,
          `Course ${course.id} failed CalendarEventSchema validation: ${JSON.stringify(
            eventValidation.error?.errors
          )}`
        ).toBe(true);

        expect(course.credits).toBe(5);
        expect(course.startTime < course.endTime).toBe(true);
      }
    });

    it('contains exactly the required quarterly distributions with deterministic criteria test vectors', () => {
      const rawData = fs.readFileSync(coursesJsonPath, 'utf8');
      const courses: any[] = JSON.parse(rawData);

      const winter = courses.filter((c) => c.term === 'Winter 2027');
      const fall = courses.filter((c) => c.term === 'Fall 2026');
      const spring = courses.filter((c) => c.term === 'Spring 2027');
      const summer = courses.filter((c) => c.term === 'Summer 2027');

      expect(winter).toHaveLength(9);
      expect(fall).toHaveLength(4);
      expect(spring).toHaveLength(4);
      expect(summer).toHaveLength(4);

      // Verify Winter 2027 duplicate section test vector
      const cse101Sections = winter.filter((c) => c.code === 'CSE 101');
      expect(cse101Sections).toHaveLength(2);
      const sec01 = cse101Sections.find((c) => c.id === 'cse-101-01');
      const sec02 = cse101Sections.find((c) => c.id === 'cse-101-02');
      expect(sec01).toBeDefined();
      expect(sec02).toBeDefined();
      expect(sec01?.days).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(sec01?.startTime).toBe('10:30');
      expect(sec02?.days).toEqual(['Tuesday', 'Thursday']);
      expect(sec02?.startTime).toBe('10:00');

      // Verify Winter 2027 back-to-back cluster test vector
      const cse115a = winter.find((c) => c.id === 'cse-115a-01');
      expect(cse115a).toBeDefined();
      expect(cse115a?.days).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(cse115a?.startTime).toBe('09:00');

      // Verify department variety
      const departments = new Set(courses.map((c) => c.department));
      expect(departments).toContain('CSE');
      expect(departments).toContain('MATH');
      expect(departments).toContain('ART');
      expect(departments).toContain('ECON');
      expect(departments).toContain('STAT');

      // Verify level variety
      const levels = new Set(courses.map((c) => c.level));
      expect(levels).toContain('LOWER');
      expect(levels).toContain('UPPER');
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

  describe('getCourseTypeColor', () => {
    it('returns consistent design tokens across course types', () => {
      expect(getCourseTypeColor('GE')).toBe('#FF6B6B');
      expect(getCourseTypeColor('ELECTIVE')).toBe('#9B51E0');
      expect(getCourseTypeColor('GOOGLE_CALENDAR_BUSY')).toBe('#A0AEC0');
      expect(getCourseTypeColor('MAJOR')).toBe('#00B4DB');
      expect(getCourseTypeColor('OTHER')).toBe('#00B4DB');
    });
  });

  describe('SaveCalendarEventsRequestSchema', () => {
    it('validates custom schedule save request payload', () => {
      const valid = {
        term: 'Winter 2027',
        events: [
          {
            id: 'cse-130',
            title: 'CSE 130',
            type: 'MAJOR',
            days: ['Monday', 'Wednesday', 'Friday'],
            startTime: '13:20',
            endTime: '14:25',
            color: '#00B4DB',
          },
        ],
      };
      expect(SaveCalendarEventsRequestSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects request with malformed event list', () => {
      expect(
        SaveCalendarEventsRequestSchema.safeParse({
          term: 'Winter 2027',
          events: [{ id: 'missing-required-fields' }],
        }).success
      ).toBe(false);
    });
  });

  describe('SaveCalendarEventsResponseSchema & ClearCalendarEventsResponseSchema', () => {
    it('validates save calendar response envelope with data payload', () => {
      const resp = {
        success: true,
        data: {
          message: 'Schedule saved successfully',
          count: 3,
        },
      };
      expect(SaveCalendarEventsResponseSchema.safeParse(resp).success).toBe(true);
    });

    it('validates clear calendar response envelope with data payload', () => {
      const resp = {
        success: true,
        data: {
          message: 'Schedule cleared successfully',
        },
      };
      expect(ClearCalendarEventsResponseSchema.safeParse(resp).success).toBe(true);
    });
  });
});
