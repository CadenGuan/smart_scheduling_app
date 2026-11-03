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
      const completed = [
        'MATH 19A',
        'MATH 19B',
        'CSE 20',
        'CSE 30',
        'CSE 12',
        'CSE 13S',
        'CSE 16',
      ];
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
      const combined = DeadlinesService.getDeadlines('Software Engineering', 'Undergraduate Showcase', refDate);
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
});
