import { describe, it, expect } from 'vitest';
import {
  CalendarService,
  coursesOverlap,
  getIndividualConflicts,
  isClusterExceeding,
  courseExceedsBackToBack,
  wouldExceedBackToBack,
} from '../src/services/calendar.service.js';
import { CalendarEvent } from 'shared';
import { userQueries } from '../src/db/queries/userQueries.js';
import { v4 as uuidv4 } from 'uuid';

describe('CalendarService Domain Service Test Suite', () => {
  const courseA: CalendarEvent = {
    id: 'course-a',
    title: 'Course A',
    type: 'MAJOR',
    days: ['Monday', 'Wednesday'],
    startTime: '09:00',
    endTime: '10:30',
    color: '#00B4DB',
    credits: 5,
  };

  const courseB: CalendarEvent = {
    id: 'course-b',
    title: 'Course B',
    type: 'MAJOR',
    days: ['Monday', 'Wednesday'],
    startTime: '10:00',
    endTime: '11:30',
    color: '#00B4DB',
    credits: 5,
  };

  const courseC: CalendarEvent = {
    id: 'course-c',
    title: 'Course C',
    type: 'MAJOR',
    days: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '10:30',
    color: '#00B4DB',
    credits: 5,
  };

  const courseAdjacent: CalendarEvent = {
    id: 'course-adj',
    title: 'Course Adjacent',
    type: 'MAJOR',
    days: ['Monday', 'Wednesday'],
    startTime: '10:30',
    endTime: '12:00',
    color: '#00B4DB',
    credits: 5,
  };

  describe('coursesOverlap Helper', () => {
    it('returns false for the exact same course id', () => {
      expect(coursesOverlap(courseA, courseA)).toBe(false);
    });

    it('returns false when courses meet on completely disjoint days', () => {
      expect(coursesOverlap(courseA, courseC)).toBe(false);
    });

    it('returns false when courses are strictly adjacent with no overlap', () => {
      expect(coursesOverlap(courseA, courseAdjacent)).toBe(false);
    });

    it('returns true when courses share a day and overlap in time', () => {
      expect(coursesOverlap(courseA, courseB)).toBe(true);
      expect(coursesOverlap(courseB, courseA)).toBe(true);
    });
  });

  describe('getIndividualConflicts Helper', () => {
    it('attaches free day conflict badge when course falls on preferred free day', () => {
      const badges = getIndividualConflicts(courseA, ['Monday']);
      expect(badges).toContain('Spans preferred free day');
    });

    it('attaches early start and late end badges when boundaries are violated', () => {
      const badges = getIndividualConflicts(courseA, [], '09:30', '10:00');
      expect(badges).toContain('Starts before preferred time');
      expect(badges).toContain('Ends after preferred time');
    });

    it('returns empty array when course adheres to all time constraints', () => {
      const badges = getIndividualConflicts(courseA, ['Friday'], '08:00', '12:00');
      expect(badges).toHaveLength(0);
    });
  });

  describe('Consecutive Class Hours & Back-to-Back Evaluation', () => {
    it('handles empty cluster in isClusterExceeding', () => {
      expect(isClusterExceeding([], 3)).toBe(false);
    });

    it('correctly flags exceeding clusters when total meeting minutes or span exceed limit', () => {
      const shortCluster = [courseA];
      expect(isClusterExceeding(shortCluster, 2)).toBe(false);

      const longCourse: CalendarEvent = {
        ...courseA,
        startTime: '09:00',
        endTime: '13:00', // 4 hours
      };
      expect(isClusterExceeding([longCourse], 3)).toBe(true);
    });

    it('evaluates courseExceedsBackToBack across passing periods and multiple days', () => {
      const class1: CalendarEvent = {
        id: 'c1',
        title: 'Class 1',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '09:00',
        endTime: '10:30',
        color: '#00B4DB',
      };
      const class2: CalendarEvent = {
        id: 'c2',
        title: 'Class 2',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '10:45', // 15 min gap
        endTime: '12:15',
        color: '#00B4DB',
      };
      const class3: CalendarEvent = {
        id: 'c3',
        title: 'Class 3',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '12:30', // 15 min gap
        endTime: '14:00', // Total span 09:00 to 14:00 (5 hours)
        color: '#00B4DB',
      };
      const isolatedClass: CalendarEvent = {
        id: 'c4',
        title: 'Class 4',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '17:00',
        endTime: '18:15',
        color: '#00B4DB',
      };

      const all = [class1, class2, class3, isolatedClass];
      expect(courseExceedsBackToBack(class1, all, 3)).toBe(true);
      expect(courseExceedsBackToBack(class2, all, 3)).toBe(true);
      expect(courseExceedsBackToBack(class3, all, 3)).toBe(true);
      expect(courseExceedsBackToBack(isolatedClass, all, 3)).toBe(false);

      expect(wouldExceedBackToBack(all, 3)).toBe(true);
      expect(wouldExceedBackToBack([isolatedClass], 3)).toBe(false);

      // Two non-exceeding classes separated by > 30 min break
      const morningClass: CalendarEvent = {
        id: 'm1',
        title: 'Morning Class',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '09:00',
        endTime: '10:00',
        color: '#00B4DB',
      };
      const afternoonClass: CalendarEvent = {
        id: 'm2',
        title: 'Afternoon Class',
        type: 'MAJOR',
        days: ['Monday'],
        startTime: '13:00',
        endTime: '14:00',
        color: '#00B4DB',
      };
      expect(wouldExceedBackToBack([morningClass, afternoonClass], 3)).toBe(false);
    });
  });

  describe('CalendarService.getPreview', () => {
    it('generates a default preview for anonymous user without preferences', () => {
      const preview = CalendarService.getPreview();
      expect(preview.term).toBe('Winter 2027');
      expect(preview.totalCredits).toBe(15);
      expect(preview.events.length).toBeGreaterThan(0);
    });

    it('loads preferences from user record in SQLite when userId is provided', () => {
      const email = `cal-test-${Date.now()}@ucsc.edu`;
      const userId = uuidv4();
      userQueries.createUser({
        user_id: userId,
        email,
        password_hash: 'hash',
        name: 'Calendar Slug',
        standing: 'Senior',
        major: 'Computer Science B.S.',
      });

      userQueries.updateUserProfile(userId, {
        preferences: JSON.stringify({
          targetTerm: 'Winter 2027',
          targetCredits: 10,
          preferredFreeDays: ['Friday'],
        }),
      });

      const preview = CalendarService.getPreview(userId);
      expect(preview.totalCredits).toBe(10);
      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      academic.forEach((c) => {
        expect(c.days).not.toContain('Friday');
      });
    });

    it('gracefully handles user with corrupted preferences JSON', () => {
      const email = `corrupt-${Date.now()}@ucsc.edu`;
      const userId = uuidv4();
      userQueries.createUser({
        user_id: userId,
        email,
        password_hash: 'hash',
        name: 'Corrupt Slug',
        standing: 'Junior',
        major: 'CS',
      });
      userQueries.updateUserProfile(userId, {
        preferences: 'invalid-json{',
      });

      const preview = CalendarService.getPreview(userId);
      expect(preview.term).toBe('Winter 2027');
      expect(preview.totalCredits).toBe(15);
    });

    it('accurately filters candidate courses when switching active terms (Fall 2026 & Spring 2027)', () => {
      const fallPreview = CalendarService.getPreview(undefined, {
        targetTerm: 'Fall 2026',
        targetCredits: 15,
      });
      expect(fallPreview.term).toBe('Fall 2026');
      const fallAcademic = fallPreview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(fallAcademic).toHaveLength(3);
      fallAcademic.forEach((c) => {
        expect(c.term).toBe('Fall 2026');
      });

      const springPreview = CalendarService.getPreview(undefined, {
        targetTerm: 'Spring 2027',
        targetCredits: 15,
      });
      expect(springPreview.term).toBe('Spring 2027');
      const springAcademic = springPreview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(springAcademic).toHaveLength(3);
      springAcademic.forEach((c) => {
        expect(c.term).toBe('Spring 2027');
      });
    });

    it('falls back gracefully to pool when term has no exact matches', () => {
      const fallbackPreview = CalendarService.getPreview(undefined, {
        targetTerm: 'Summer 2027',
        targetCredits: 15,
      });
      expect(fallbackPreview.term).toBe('Summer 2027');
      expect(fallbackPreview.events.length).toBeGreaterThan(0);
    });

    it('detects mutual time collisions and attaches "Time conflict with another course" badge', () => {
      const collidingPool: CalendarEvent[] = [
        {
          id: 'coll-1',
          title: 'Collision 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'coll-2',
          title: 'Collision 2',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:30',
          endTime: '12:00',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
        },
        collidingPool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      academic.forEach((c) => {
        expect(c.conflictBadges).toContain('Time conflict with another course');
      });
    });

    it('detects max back-to-back hours and attaches "Exceeds max back-to-back hours" badge', () => {
      const b2bPool: CalendarEvent[] = [
        {
          id: 'b2b-1',
          title: 'B2B Course 1',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '09:00',
          endTime: '11:00',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'b2b-2',
          title: 'B2B Course 2',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '11:15',
          endTime: '13:15',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
          maxBackToBackHours: 2, // 2 hours max, but consecutive span is 09:00 - 13:15 (4.25 hrs)
        },
        b2bPool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      academic.forEach((c) => {
        expect(c.conflictBadges).toContain('Exceeds max back-to-back hours');
      });
    });

    it('prioritizes non-colliding courses when alternatives exist', () => {
      const selectivePool: CalendarEvent[] = [
        {
          id: 'sel-1',
          title: 'Selected 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'sel-2-colliding',
          title: 'Collides with 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '09:30',
          endTime: '10:30',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'sel-3-clear',
          title: 'Clean Afternoon',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '13:00',
          endTime: '14:00',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      // Request 10 credits (2 courses out of 3)
      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
        },
        selectivePool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      const ids = academic.map((c) => c.id);
      expect(ids).toContain('sel-1');
      expect(ids).toContain('sel-3-clear');
      expect(ids).not.toContain('sel-2-colliding');
    });
  });
});
