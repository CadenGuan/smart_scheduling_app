import { describe, it, expect } from 'vitest';
import {
  CalendarService,
  coursesOverlap,
  getIndividualConflicts,
  isClusterExceeding,
  courseExceedsBackToBack,
  wouldExceedBackToBack,
} from '../src/services/calendar.service.js';
import { DeadlinesService } from '../src/services/deadlines.service.js';
import { CalendarEvent } from 'shared';
import { userQueries } from '../src/db/queries/userQueries.js';
import { calendarQueries } from '../src/db/queries/calendarQueries.js';
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

  describe('Pinned Course Overrides & Greedy Conflict Oracle Suite', () => {
    it('unconditionally schedules pinned courses even when they fall on preferred free days', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'pinned-free-day',
          title: 'CSE 115A (Forced Friday)',
          type: 'MAJOR',
          days: ['Friday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'unpinned-1',
          title: 'MATH 21',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'unpinned-2',
          title: 'CSE 130',
          type: 'MAJOR',
          days: ['Tuesday', 'Thursday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
          preferredFreeDays: ['Friday'],
        },
        pool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      const pinnedEvent = academic.find((c) => c.id === 'pinned-free-day');
      expect(pinnedEvent).toBeDefined();
      expect(pinnedEvent?.pinned).toBe(true);
      expect(pinnedEvent?.conflictBadges).toContain('Spans preferred free day');
      expect(pinnedEvent?.conflictBadge).toContain('Spans preferred free day');

      // The second course should not fall on Friday
      const unpinnedSelected = academic.find((c) => c.id !== 'pinned-free-day');
      expect(unpinnedSelected?.days).not.toContain('Friday');
      expect(unpinnedSelected?.conflictBadges).toBeUndefined();
    });

    it('unconditionally schedules pinned courses even when violating earliest/latest time preferences', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'early-pinned',
          title: 'Early Morning Lecture',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '07:30',
          endTime: '08:45',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'late-pinned',
          title: 'Late Evening Lab',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '18:30',
          endTime: '20:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
          earliestStartTime: '09:00',
          latestEndTime: '17:00',
        },
        pool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      const early = academic.find((c) => c.id === 'early-pinned');
      expect(early).toBeDefined();
      expect(early?.conflictBadges).toContain('Starts before preferred time');
      expect(early?.conflictBadge).toBe('Starts before preferred time');

      const late = academic.find((c) => c.id === 'late-pinned');
      expect(late).toBeDefined();
      expect(late?.conflictBadges).toContain('Ends after preferred time');
      expect(late?.conflictBadge).toBe('Ends after preferred time');
    });

    it('schedules overlapping pinned courses and attaches collision badges to both', () => {
      const collidingPinned: CalendarEvent[] = [
        {
          id: 'pinned-overlap-1',
          title: 'CSE 101 Lecture A',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'pinned-overlap-2',
          title: 'CSE 130 Lecture B',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '10:30',
          endTime: '12:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
      ];

      const preview = CalendarService.getPreview(undefined, { targetCredits: 10 }, collidingPinned);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      academic.forEach((course) => {
        expect(course.pinned).toBe(true);
        expect(course.conflictBadges).toContain('Time conflict with another course');
        expect(course.conflictBadge).toContain('Time conflict with another course');
      });
    });

    it('attaches collision badge to both pinned and unpinned courses when a forced course collides with an unpinned course', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'pinned-forced',
          title: 'Forced Seminar',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'unpinned-colliding',
          title: 'Colliding Candidate',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:30',
          endTime: '12:00',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      // Pool only has 2 courses and target is 10 credits (2 courses)
      const preview = CalendarService.getPreview(undefined, { targetCredits: 10 }, pool);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      const pinned = academic.find((c) => c.id === 'pinned-forced');
      const unpinned = academic.find((c) => c.id === 'unpinned-colliding');

      expect(pinned?.conflictBadges).toContain('Time conflict with another course');
      expect(unpinned?.conflictBadges).toContain('Time conflict with another course');
    });

    it('fills remaining quota from non-pinned candidates while actively avoiding collisions with pinned courses', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'pinned-anchor',
          title: 'CSE 101 (Anchor)',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '09:00',
          endTime: '10:15',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'unpinned-colliding',
          title: 'CSE 115A (Colliding with Anchor)',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '09:30',
          endTime: '10:45',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'unpinned-clear-1',
          title: 'MATH 21 (Afternoon Clear)',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday'],
          startTime: '13:00',
          endTime: '14:15',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'unpinned-clear-2',
          title: 'ART 10F (Tuesday/Thursday Clear)',
          type: 'GE',
          days: ['Tuesday', 'Thursday'],
          startTime: '10:00',
          endTime: '11:30',
          color: '#FF6B6B',
          credits: 5,
        },
      ];

      // Request 15 credits (3 courses: 1 pinned anchor + 2 unpinned)
      const preview = CalendarService.getPreview(undefined, { targetCredits: 15 }, pool);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(3);
      expect(preview.totalCredits).toBe(15);

      const ids = academic.map((c) => c.id);
      expect(ids).toContain('pinned-anchor');
      expect(ids).toContain('unpinned-clear-1');
      expect(ids).toContain('unpinned-clear-2');
      expect(ids).not.toContain('unpinned-colliding');

      // None of the chosen courses should have collision badges
      academic.forEach((course) => {
        expect(course.conflictBadges).toBeUndefined();
        expect(course.conflictBadge).toBeUndefined();
      });
    });

    it('keeps all pinned courses when pinned count exceeds target course quota', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'p1',
          title: 'Pinned 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'p2',
          title: 'Pinned 2',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'p3',
          title: 'Pinned 3',
          type: 'MAJOR',
          days: ['Wednesday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'p4',
          title: 'Pinned 4',
          type: 'MAJOR',
          days: ['Thursday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'unpinned-extra',
          title: 'Unpinned Extra',
          type: 'ELECTIVE',
          days: ['Friday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#9B51E0',
          credits: 5,
        },
      ];

      // Target credits is 10 (which normally requests 2 courses), but 4 courses are pinned
      const preview = CalendarService.getPreview(undefined, { targetCredits: 10 }, pool);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(4);
      expect(preview.totalCredits).toBe(20);

      const ids = academic.map((c) => c.id);
      expect(ids).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(ids).not.toContain('unpinned-extra');
    });

    it('accumulates multiple individual and collision conflict badges accurately', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'multi-conflict-pinned',
          title: 'Overconstrained Class',
          type: 'MAJOR',
          days: ['Friday'],
          startTime: '08:00',
          endTime: '09:30',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'colliding-friday',
          title: 'Friday Morning Collision',
          type: 'MAJOR',
          days: ['Friday'],
          startTime: '09:00',
          endTime: '10:30',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
          preferredFreeDays: ['Friday'],
          earliestStartTime: '08:30',
        },
        pool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      const multi = academic.find((c) => c.id === 'multi-conflict-pinned');
      expect(multi).toBeDefined();
      expect(multi?.conflictBadges).toContain('Spans preferred free day');
      expect(multi?.conflictBadges).toContain('Starts before preferred time');
      expect(multi?.conflictBadges).toContain('Time conflict with another course');
      expect(multi?.conflictBadge).toBe(
        'Spans preferred free day, Starts before preferred time, Time conflict with another course'
      );

      const other = academic.find((c) => c.id === 'colliding-friday');
      expect(other).toBeDefined();
      expect(other?.conflictBadges).toContain('Spans preferred free day');
      expect(other?.conflictBadges).toContain('Time conflict with another course');
      expect(other?.conflictBadges).not.toContain('Starts before preferred time');
    });

    it('attaches "Exceeds max back-to-back hours" badge when pinned courses cause consecutive clustering', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'pinned-b2b-1',
          title: 'Lecture 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '09:00',
          endTime: '11:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'pinned-b2b-2',
          title: 'Lecture 2',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '11:15',
          endTime: '13:15',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
      ];

      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
          maxBackToBackHours: 2,
        },
        pool
      );

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);

      academic.forEach((course) => {
        expect(course.conflictBadges).toContain('Exceeds max back-to-back hours');
      });
    });

    it('deduplicates candidate courses with identical IDs across pinned and unpinned pools', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'duplicate-course',
          title: 'Duplicate CSE 101 (Pinned)',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:00',
          endTime: '11:00',
          color: '#00B4DB',
          credits: 5,
          pinned: true,
        },
        {
          id: 'duplicate-course',
          title: 'Duplicate CSE 101 (Unpinned)',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '10:00',
          endTime: '11:00',
          color: '#00B4DB',
          credits: 5,
          pinned: false,
        },
        {
          id: 'other-course',
          title: 'MATH 21',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '10:00',
          endTime: '11:00',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      const preview = CalendarService.getPreview(undefined, { targetCredits: 10 }, pool);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      expect(preview.totalCredits).toBe(10);

      const dupCourse = academic.find((c) => c.id === 'duplicate-course');
      expect(dupCourse).toBeDefined();
      expect(dupCourse?.pinned).toBe(true);
    });

    it('handles empty candidate pool gracefully with 0 totalCredits and 0 events', () => {
      const preview = CalendarService.getPreview(undefined, { targetCredits: 15 }, []);

      expect(preview.events).toHaveLength(0);
      expect(preview.totalCredits).toBe(0);
    });

    it('preserves backwards compatibility when candidate pool has no pinned courses', () => {
      const pool: CalendarEvent[] = [
        {
          id: 'clean-1',
          title: 'Clean Course 1',
          type: 'MAJOR',
          days: ['Monday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
        },
        {
          id: 'clean-2',
          title: 'Clean Course 2',
          type: 'MAJOR',
          days: ['Tuesday'],
          startTime: '09:00',
          endTime: '10:00',
          color: '#00B4DB',
          credits: 5,
        },
      ];

      const preview = CalendarService.getPreview(undefined, { targetCredits: 10 }, pool);

      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      expect(preview.totalCredits).toBe(10);
      academic.forEach((c) => {
        expect(c.pinned).toBeFalsy();
        expect(c.conflictBadges).toBeUndefined();
      });
    });
  });

  describe('Curriculum Prerequisite DAG & Degree Progress Suite', () => {
    it('returns the 18 UCSC CS core courses structured into tiers 1 through 5', () => {
      const dag = CalendarService.getCurriculumDag();

      expect(dag.major).toBe('Computer Science B.S.');
      expect(dag.totalCoreCount).toBe(18);
      expect(dag.nodes).toHaveLength(18);
      expect(dag.edges.length).toBeGreaterThan(15);

      // Verify foundational courses are Tier 1
      const math19a = dag.nodes.find((n) => n.code === 'MATH 19A');
      expect(math19a).toBeDefined();
      expect(math19a?.tier).toBe(1);
      expect(math19a?.prerequisites).toEqual([]);

      // Verify CSE 101 is Tier 3 Gatekeeper
      const cse101 = dag.nodes.find((n) => n.code === 'CSE 101');
      expect(cse101).toBeDefined();
      expect(cse101?.tier).toBe(3);
      expect(cse101?.prerequisites).toContain('CSE 13S');
      expect(cse101?.prerequisites).toContain('CSE 16');

      // Verify Capstone is Tier 5
      const cse115b = dag.nodes.find((n) => n.code === 'CSE 115B');
      expect(cse115b).toBeDefined();
      expect(cse115b?.tier).toBe(5);
      expect(cse115b?.level).toBe('CAPSTONE');
    });

    it('identifies initial open courses as READY_TO_ENROLL for empty student history', () => {
      const dag = CalendarService.getCurriculumDag(undefined, []);

      expect(dag.completedCount).toBe(0);
      expect(dag.progressPercentage).toBe(0);

      // Open courses: MATH 19A, CSE 20, CSE 12
      expect(dag.readyToEnroll).toContain('MATH 19A');
      expect(dag.readyToEnroll).toContain('CSE 20');
      expect(dag.readyToEnroll).toContain('CSE 12');

      // Locked courses requiring prerequisites
      const cse101 = dag.nodes.find((n) => n.code === 'CSE 101');
      expect(cse101?.status).toBe('LOCKED');
      expect(cse101?.unmetPrerequisites).toEqual(['CSE 13S', 'CSE 16']);
    });

    it('updates node statuses and computes progress percentage for student coursework', () => {
      // Completed: MATH 19A, MATH 19B, CSE 20, CSE 30, CSE 12, CSE 13S, CSE 16
      const completed = ['MATH 19A', 'MATH 19B', 'CSE 20', 'CSE 30', 'CSE 12', 'CSE 13S', 'CSE 16'];
      const dag = CalendarService.getCurriculumDag(undefined, completed);

      expect(dag.completedCount).toBe(7);
      expect(dag.progressPercentage).toBe(Math.round((7 / 18) * 100)); // 39%

      // Completed nodes have status COMPLETED and empty unmetPrerequisites
      const cse13s = dag.nodes.find((n) => n.code === 'CSE 13S');
      expect(cse13s?.status).toBe('COMPLETED');
      expect(cse13s?.unmetPrerequisites).toEqual([]);

      // CSE 101 was unblocked because both CSE 13S and CSE 16 are completed
      const cse101 = dag.nodes.find((n) => n.code === 'CSE 101');
      expect(cse101?.status).toBe('READY_TO_ENROLL');
      expect(cse101?.unmetPrerequisites).toEqual([]);
      expect(dag.readyToEnroll).toContain('CSE 101');

      // Capstone CSE 115B is still LOCKED
      const cse115b = dag.nodes.find((n) => n.code === 'CSE 115B');
      expect(cse115b?.status).toBe('LOCKED');
      expect(cse115b?.unmetPrerequisites).toContain('CSE 115A');
    });

    it('reads completed major requirements directly from SQLite user record', () => {
      const testUserId = uuidv4();
      userQueries.createUser({
        user_id: testUserId,
        email: `dag-user-${Date.now()}@ucsc.edu`,
        password_hash: 'hash123',
        name: 'DAG Student',
        standing: 'Senior',
        major: 'Computer Science B.S.',
      });

      userQueries.updateUserProfile(testUserId, {
        major_requirements_taken: JSON.stringify(['MATH 19A', 'MATH 19B', 'MATH 21']),
      });

      const dag = CalendarService.getCurriculumDag(testUserId);
      expect(dag.completedCount).toBe(3);
      expect(dag.nodes.find((n) => n.code === 'MATH 21')?.status).toBe('COMPLETED');
    });
  });

  describe('DeadlinesService & Academic Research Opportunities', () => {
    it('returns all conference deadlines with computed statuses and topics list', () => {
      // Use fixed reference date
      const refDate = new Date('2027-01-01T00:00:00Z');
      const result = DeadlinesService.getDeadlines(undefined, undefined, refDate);

      expect(result.totalCount).toBeGreaterThan(5);
      expect(result.topics).toContain('Software Engineering');
      expect(result.topics).toContain('Systems');
      expect(result.topics).toContain('AI & Machine Learning');

      // Check specific deadline properties
      const urs = result.deadlines.find((d) => d.id === 'ucsc-urs-2027');
      expect(urs).toBeDefined();
      expect(urs?.tier).toBe('Undergraduate Showcase');
      expect(urs?.status).toBe('OPEN');
      expect(urs?.daysUntilDeadline).toBeGreaterThan(0);
    });

    it('filters deadlines accurately by topic and tier', () => {
      const refDate = new Date('2027-01-01T00:00:00Z');

      // Filter by topic 'Software Engineering'
      const seResult = DeadlinesService.getDeadlines('Software Engineering', undefined, refDate);
      expect(seResult.deadlines.length).toBeGreaterThan(0);
      for (const d of seResult.deadlines) {
        expect(d.topics).toContain('Software Engineering');
      }

      // Filter by tier 'Undergraduate Showcase'
      const ugResult = DeadlinesService.getDeadlines(undefined, 'Undergraduate Showcase', refDate);
      expect(ugResult.deadlines.length).toBeGreaterThan(0);
      for (const d of ugResult.deadlines) {
        expect(d.tier).toBe('Undergraduate Showcase');
      }

      // Filter by both
      const combined = DeadlinesService.getDeadlines(
        'Software Engineering',
        'Undergraduate Showcase',
        refDate
      );
      expect(combined.deadlines.length).toBeGreaterThan(0);
      for (const d of combined.deadlines) {
        expect(d.topics).toContain('Software Engineering');
        expect(d.tier).toBe('Undergraduate Showcase');
      }
    });

    it('generates standard RFC 5545 .ics calendar with VALARM 1-day advance triggers', () => {
      const refDate = new Date('2027-01-01T00:00:00Z');
      const { deadlines } = DeadlinesService.getDeadlines(undefined, undefined, refDate);
      const ics = DeadlinesService.exportDeadlinesIcs(deadlines);

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('X-WR-CALNAME:UCSC CS Research & Conference Deadlines');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:🎯 [Deadline] UCSC URS 2027 Submission');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-P1D');
      expect(ics).toContain('END:VALARM');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('calendarQueries Database Persistence Test Suite', () => {
    const testUserId = uuidv4();
    const testEvents: CalendarEvent[] = [
      {
        id: 'cse-101',
        title: 'CSE 101: Data Structures',
        type: 'MAJOR',
        days: ['Monday', 'Wednesday'],
        startTime: '10:00',
        endTime: '11:35',
        color: '#00B4DB',
        credits: 5,
        term: 'Winter 2027',
        pinned: true,
        conflictBadge: 'Starts before preferred time',
      },
      {
        id: 'art-10f',
        title: 'ART 10F: 2D Design',
        type: 'GE',
        days: ['Tuesday', 'Thursday'],
        startTime: '13:00',
        endTime: '14:35',
        color: '#FF6B6B',
        credits: 5,
        term: 'Winter 2027',
        pinned: false,
      },
    ];

    it('saves user calendar events and retrieves them with parsed fields', () => {
      // First ensure user exists
      userQueries.createUser({
        user_id: testUserId,
        email: `calendar-query-${Date.now()}@ucsc.edu`,
        password_hash: 'hash',
        name: 'Calendar Query Student',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

      calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', testEvents);

      const retrieved = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
      expect(retrieved).toHaveLength(2);

      const cse101 = retrieved.find((e) => e.id === 'cse-101');
      expect(cse101).toBeDefined();
      expect(cse101?.title).toBe('CSE 101: Data Structures');
      expect(cse101?.type).toBe('MAJOR');
      expect(cse101?.days).toEqual(['Monday', 'Wednesday']);
      expect(cse101?.pinned).toBe(true);
      expect(cse101?.conflictBadge).toBe('Starts before preferred time');

      const art10f = retrieved.find((e) => e.id === 'art-10f');
      expect(art10f).toBeDefined();
      expect(art10f?.type).toBe('GE');
      expect(art10f?.pinned).toBe(false);
    });

    it('retrieves all events across terms when term filter is omitted', () => {
      const springEvents: CalendarEvent[] = [
        {
          id: 'cse-130',
          title: 'CSE 130: Computer Systems Design',
          type: 'MAJOR',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:10',
          credits: 5,
          term: 'Spring 2027',
        },
      ];

      calendarQueries.saveUserCalendarEvents(testUserId, 'Spring 2027', springEvents);

      const allEvents = calendarQueries.getUserCalendarEvents(testUserId);
      expect(allEvents).toHaveLength(3); // 2 from Winter + 1 from Spring
    });

    it('deletes user calendar events by term and completely for a user', () => {
      calendarQueries.deleteUserCalendarEvents(testUserId, 'Winter 2027');
      const afterWinterDelete = calendarQueries.getUserCalendarEvents(testUserId);
      expect(afterWinterDelete).toHaveLength(1);
      expect(afterWinterDelete[0].id).toBe('cse-130');

      calendarQueries.deleteUserCalendarEvents(testUserId);
      const afterFullDelete = calendarQueries.getUserCalendarEvents(testUserId);
      expect(afterFullDelete).toHaveLength(0);
    });

    it('generates conflict-free previews across all four academic quarters', () => {
      const quarters = ['Fall 2026', 'Winter 2027', 'Spring 2027', 'Summer 2027'];
      for (const quarter of quarters) {
        const preview = CalendarService.getPreview(undefined, {
          targetTerm: quarter as any,
          targetCredits: 15,
        });

        expect(preview.term).toBe(quarter);
        expect(preview.totalCredits).toBe(15);
        const academicEvents = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
        expect(academicEvents).toHaveLength(3);
        for (const event of academicEvents) {
          expect(event.term).toBe(quarter);
        }
      }
    });
  });

  describe('Greedy Oracle Preference & Section Deduplication Engine (Tickets 01-05 Spec)', () => {
    it('strictly guarantees that each course on the preview has only ONE section present (no duplicate CSE 101)', () => {
      // Arrange: Winter 2027 contains both cse-101-01 (MWF 09:00) and cse-101-02 (TuTh 10:00)
      // Act: Generate 15-credit preview
      const preview = CalendarService.getPreview(undefined, {
        targetTerm: 'Winter 2027',
        targetCredits: 15,
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

      // Assert
      const academicEvents = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academicEvents).toHaveLength(3);

      const cse101Sections = academicEvents.filter(
        (e) => (e.code || e.title).toUpperCase().includes('CSE 101')
      );
      expect(cse101Sections).toHaveLength(1);
    });

    it('enforces preferred free days as a hard constraint for unpinned courses', () => {
      // Arrange: Friday is a preferred free day; CSE 101-01 and CSE 115A-01 meet on Friday
      // Act
      const preview = CalendarService.getPreview(undefined, {
        targetTerm: 'Winter 2027',
        preferredFreeDays: ['Friday'],
        targetCredits: 15,
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

      // Assert: No unpinned academic event meets on Friday
      const academicEvents = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academicEvents.length).toBeGreaterThan(0);
      academicEvents.forEach((course) => {
        expect(course.days).not.toContain('Friday');
      });
    });

    it('allows explicitly pinned courses to bypass hard free day exclusions with badge', () => {
      // Arrange: Pin CSE 101-01 (meets on Friday) while Friday is a preferred free day
      const pinnedPool: CalendarEvent[] = [
        {
          id: 'cse-101-01',
          code: 'CSE 101',
          title: 'CSE 101: Introduction to Data Structures and Algorithms',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:15',
          pinned: true,
          credits: 5,
          term: 'Winter 2027',
        },
        {
          id: 'cse-130-01',
          code: 'CSE 130',
          title: 'CSE 130: Principles of Computer Systems Design',
          days: ['Tuesday', 'Thursday'],
          startTime: '13:15',
          endTime: '14:50',
          credits: 5,
          term: 'Winter 2027',
        },
      ];

      // Act
      const preview = CalendarService.getPreview(
        undefined,
        {
          targetTerm: 'Winter 2027',
          preferredFreeDays: ['Friday'],
          targetCredits: 10,
        },
        pinnedPool
      );

      // Assert: Pinned course is scheduled and badged
      const pinnedCourse = preview.events.find((e) => e.id === 'cse-101-01');
      expect(pinnedCourse).toBeDefined();
      expect(pinnedCourse?.pinned).toBe(true);
      expect(pinnedCourse?.conflictBadges).toContain('Spans preferred free day');
    });

    it('filters courses by class standing: Freshmen receive lower division (< 100), not upper division', () => {
      // Act: Freshman requesting 10 units in Winter 2027
      const freshmanPreview = CalendarService.getPreview(undefined, {
        targetTerm: 'Winter 2027',
        standing: 'Freshman',
        targetCredits: 10,
        major: 'Computer Science B.S.',
      });

      // Assert: Only lower division (< 100) or GE courses are returned (CSE 12, ART 10F)
      const academic = freshmanPreview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      academic.forEach((course) => {
        const numMatch = (course.code || course.title).match(/\d+/);
        if (numMatch && course.type !== 'GE') {
          expect(parseInt(numMatch[0], 10)).toBeLessThan(100);
        }
      });
      // CSE 101, CSE 115A, CSE 130 must NOT be scheduled for freshmen
      const upperDiv = academic.filter((c) => (c.code || c.title).includes('101') || (c.code || c.title).includes('115A'));
      expect(upperDiv).toHaveLength(0);
    });

    it('prioritizes declared major department courses before electives/GEs', () => {
      // Act: Junior CS major vs Art major
      const csPreview = CalendarService.getPreview(undefined, {
        targetTerm: 'Winter 2027',
        standing: 'Junior',
        major: 'Computer Science B.S.',
        targetCredits: 10,
      });

      const csAcademic = csPreview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(csAcademic).toHaveLength(2);
      // CS major should have CS courses scheduled
      csAcademic.forEach((c) => {
        expect((c.department || c.code || c.title).toUpperCase()).toContain('CSE');
      });
    });

    it('soft time constraint prefers courses within the preferred time window over out-of-window courses', () => {
      // Arrange: Preferred window is 09:00 - 12:00. CSE 130 is 13:15-14:50 (outside).
      // Act
      const preview = CalendarService.getPreview(undefined, {
        targetTerm: 'Winter 2027',
        earliestStartTime: '09:00',
        latestEndTime: '12:00',
        targetCredits: 10,
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

      // Assert: In-window morning courses (09:00 - 11:45) are scheduled before afternoon CSE 130
      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      const cse130 = academic.find((c) => (c.code || c.title).includes('130'));
      expect(cse130).toBeUndefined();
    });

    it('accurately scales candidate course count according to target credit quotas (10, 15, 20 units)', () => {
      // Act 1: 10 credits -> 2 courses
      const p10 = CalendarService.getPreview(undefined, { targetTerm: 'Winter 2027', targetCredits: 10 });
      const academic10 = p10.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic10).toHaveLength(2);
      expect(p10.totalCredits).toBe(10);

      // Act 2: 15 credits -> 3 courses
      const p15 = CalendarService.getPreview(undefined, { targetTerm: 'Winter 2027', targetCredits: 15 });
      const academic15 = p15.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic15).toHaveLength(3);
      expect(p15.totalCredits).toBe(15);

      // Act 3: 20 credits -> 4 courses
      const p20 = CalendarService.getPreview(undefined, { targetTerm: 'Winter 2027', targetCredits: 20 });
      const academic20 = p20.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic20).toHaveLength(4);
      expect(p20.totalCredits).toBe(20);
    });

    it('identifies and badges consecutive class hours exceeding maxBackToBackHours', () => {
      // Arrange: Two adjacent courses on MWF that together exceed 2 hours back-to-back
      const b2bPool: CalendarEvent[] = [
        {
          id: 'course-1',
          code: 'CSE 101',
          title: 'CSE 101',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:30',
          credits: 5,
          pinned: true,
          term: 'Winter 2027',
        },
        {
          id: 'course-2',
          code: 'CSE 115A',
          title: 'CSE 115A',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '10:45',
          endTime: '12:45',
          credits: 5,
          pinned: true,
          term: 'Winter 2027',
        },
      ];

      // Act: Max back-to-back set to 2 hours
      const preview = CalendarService.getPreview(
        undefined,
        {
          targetTerm: 'Winter 2027',
          maxBackToBackHours: 2,
          targetCredits: 10,
        },
        b2bPool
      );

      // Assert: Both courses in the cluster get the badge
      const course1 = preview.events.find((e) => e.id === 'course-1');
      const course2 = preview.events.find((e) => e.id === 'course-2');
      expect(course1?.conflictBadges).toContain('Exceeds max back-to-back hours');
      expect(course2?.conflictBadges).toContain('Exceeds max back-to-back hours');
    });

    it('strictly rejects duplicate section candidates when passing both cse-101-01 and cse-101-02 in eventsPool', () => {
      // Arrange: Candidate pool with two conflicting sections of CSE 101 plus a distinct course CSE 130
      const duplicatePool: CalendarEvent[] = [
        {
          id: 'cse-101-01',
          code: 'CSE 101',
          title: 'CSE 101: Introduction to Data Structures and Algorithms',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:15',
          credits: 5,
          color: '#00B4DB',
        },
        {
          id: 'cse-101-02',
          code: 'CSE 101',
          title: 'CSE 101: Introduction to Data Structures and Algorithms',
          days: ['Tuesday', 'Thursday'],
          startTime: '10:00',
          endTime: '11:35',
          credits: 5,
          color: '#00B4DB',
        },
        {
          id: 'cse-130-01',
          code: 'CSE 130',
          title: 'CSE 130: Principles of Computer Systems Design',
          days: ['Tuesday', 'Thursday'],
          startTime: '13:15',
          endTime: '14:50',
          credits: 5,
          color: '#00B4DB',
        },
      ];

      // Act: Request 10 credits (2 courses) from a 3-course pool where 2 candidates are CSE 101
      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 10,
        },
        duplicatePool
      );

      // Assert: Exactly ONE section of CSE 101 is scheduled, and total course count is 2
      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(2);
      expect(preview.totalCredits).toBe(10);

      const cse101Sections = academic.filter(
        (c) => (c.code || c.title).toUpperCase().includes('CSE 101')
      );
      expect(cse101Sections).toHaveLength(1);

      const cse130Sections = academic.filter(
        (c) => (c.code || c.title).toUpperCase().includes('CSE 130')
      );
      expect(cse130Sections).toHaveLength(1);
    });

    it('strictly excludes unpinned Friday courses when Friday is specified in preferredFreeDays', () => {
      // Arrange: Pool with Friday courses (cse-101-01, cse-115a-01) and non-Friday courses (cse-101-02, cse-130-01, art-10f-01)
      const freeDayPool: CalendarEvent[] = [
        {
          id: 'cse-101-01',
          code: 'CSE 101',
          title: 'CSE 101: Data Structures (MWF)',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '09:00',
          endTime: '10:15',
          credits: 5,
        },
        {
          id: 'cse-101-02',
          code: 'CSE 101',
          title: 'CSE 101: Data Structures (TuTh)',
          days: ['Tuesday', 'Thursday'],
          startTime: '10:00',
          endTime: '11:35',
          credits: 5,
        },
        {
          id: 'cse-115a-01',
          code: 'CSE 115A',
          title: 'CSE 115A: Software Engineering (MWF)',
          days: ['Monday', 'Wednesday', 'Friday'],
          startTime: '10:30',
          endTime: '11:45',
          credits: 5,
        },
        {
          id: 'cse-130-01',
          code: 'CSE 130',
          title: 'CSE 130: Computer Systems Design (TuTh)',
          days: ['Tuesday', 'Thursday'],
          startTime: '13:15',
          endTime: '14:50',
          credits: 5,
        },
        {
          id: 'art-10f-01',
          code: 'ART 10F',
          title: 'ART 10F: 2D Design (MW)',
          days: ['Monday', 'Wednesday'],
          startTime: '15:20',
          endTime: '16:55',
          credits: 5,
        },
      ];

      // Act: Request 15 credits (3 courses) with Friday as preferred free day
      const preview = CalendarService.getPreview(
        undefined,
        {
          targetCredits: 15,
          preferredFreeDays: ['Friday'],
        },
        freeDayPool
      );

      // Assert: Exactly 3 non-Friday courses scheduled, and 0 courses meet on Friday
      const academic = preview.events.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(academic).toHaveLength(3);
      academic.forEach((course) => {
        expect(course.days).not.toContain('Friday');
      });

      // Verify that non-Friday section cse-101-02 was scheduled rather than Friday section cse-101-01
      expect(academic.some((c) => c.id === 'cse-101-02')).toBe(true);
      expect(academic.some((c) => c.id === 'cse-101-01')).toBe(false);
      expect(academic.some((c) => c.id === 'cse-115a-01')).toBe(false);
    });
  });
});
