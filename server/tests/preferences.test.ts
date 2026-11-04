import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { userQueries } from '../src/db/queries/userQueries.js';
import { UserPreferencesSchema } from 'shared';

describe('Preferences Specification & API Contract Tests [TESTING_GOLDEN_RULES]', () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let _userBId: string;

  beforeAll(async () => {
    // 1. Arrange User A (Primary test subject)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        email: `usera-pref-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'User A Slug',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user.userId;

    // 2. Arrange User B (For cross-user isolation and authorization testing)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `userb-pref-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'User B Slug',
        standing: 'Senior',
        major: 'Computer Engineering B.S.',
      });
    userBToken = resB.body.data.token;
    _userBId = resB.body.data.user.userId;
  });

  // =========================================================================
  // 1. HAPPY PATHS
  // =========================================================================
  describe('1. Happy Paths (Successful Updates & Retrieval)', () => {
    it('PUT /api/users/:id/preferences updates full valid scheduling preferences', async () => {
      // Arrange
      const validPayload = {
        targetTerm: 'Spring 2027',
        targetCredits: 18,
        earliestStartTime: '09:00',
        latestEndTime: '17:00',
        preferredFreeDays: ['Friday'],
        maxBackToBackHours: 3,
      };

      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send(validPayload);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetTerm).toBe('Spring 2027');
      expect(res.body.data.targetCredits).toBe(18);
      expect(res.body.data.earliestStartTime).toBe('09:00');
      expect(res.body.data.latestEndTime).toBe('17:00');
      expect(res.body.data.preferredFreeDays).toEqual(['Friday']);
      expect(res.body.data.maxBackToBackHours).toBe(3);
    });

    it('GET /api/users/:id/preferences returns the stored preferences for authenticated user', async () => {
      // Act
      const res = await request(app)
        .get(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetTerm).toBe('Spring 2027');
      expect(res.body.data.targetCredits).toBe(18);
      expect(res.body.data.preferredFreeDays).toEqual(['Friday']);
    });

    it('PUT /api/users/:id composite update persists academic standing and preferences atomically', async () => {
      // Arrange
      const compositePayload = {
        name: 'User A Senior',
        standing: 'Senior',
        major: 'Robotics Engineering B.S.',
        minor: 'Applied Math',
        preferences: {
          targetTerm: 'Winter 2027',
          targetCredits: 15,
          preferredFreeDays: ['Monday', 'Wednesday'],
        },
      };

      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send(compositePayload);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('User A Senior');
      expect(res.body.data.standing).toBe('Senior');
      expect(res.body.data.major).toBe('Robotics Engineering B.S.');
      expect(res.body.data.minor).toBe('Applied Math');
      expect(res.body.data.preferences.targetCredits).toBe(15);
      expect(res.body.data.preferences.preferredFreeDays).toEqual(['Monday', 'Wednesday']);

      // Double-check direct database persistence
      const row = userQueries.findUserById(userAId);
      expect(row?.standing).toBe('Senior');
      expect(JSON.parse(row!.preferences!).targetCredits).toBe(15);
    });

    it('PUT /api/users/:id/preferences applies default values when optional fields are omitted', async () => {
      // Act: send empty payload
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({});

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetTerm).toBe('Winter 2027');
      expect(res.body.data.targetCredits).toBe(15);
      expect(res.body.data.preferredFreeDays).toEqual([]);
    });
  });

  // =========================================================================
  // 2. UNHAPPY / FAILURE PATHS: UNAUTHORIZED TOKENS & SECURITY
  // =========================================================================
  describe('2. Unhappy Paths: Authentication & Access Control', () => {
    it('rejects PUT /api/users/:id/preferences when Authorization header is missing (401)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .send({ targetCredits: 15 });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('MISSING_OR_MALFORMED_TOKEN');
    });

    it('rejects PUT /api/users/:id/preferences when Bearer token is invalid or malformed (401)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', 'Bearer invalid-token-xyz-123')
        .send({ targetCredits: 15 });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('rejects cross-user update: User B attempting to modify User A preferences (403)', async () => {
      // Act: User B token targeting User A resource
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ targetCredits: 20 });

      // Assert
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('rejects cross-user read: User B attempting to fetch User A preferences (403)', async () => {
      // Act: User B token reading User A resource
      const res = await request(app)
        .get(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userBToken}`);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 3. UNHAPPY / FAILURE PATHS: MALFORMED PAYLOADS & MISSING FIELDS
  // =========================================================================
  describe('3. Unhappy Paths: Malformed Payloads & Invalid Types', () => {
    it('rejects non-object array payload in PUT /api/users/:id/preferences (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send(['targetCredits', 15]);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric string for targetCredits (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ targetCredits: 'fifteen' });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details.some((d: any) => d.path === 'targetCredits')).toBe(true);
    });

    it('rejects string instead of array for preferredFreeDays (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ preferredFreeDays: 'Friday' });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details.some((d: any) => d.path === 'preferredFreeDays')).toBe(true);
    });

    it('rejects malformed nested preferences in composite PUT /api/users/:id (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          standing: 'Junior',
          preferences: { targetCredits: -99 },
        });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details[0].path).toContain('targetCredits');
    });

    it('rejects invalid profile standing like "SuperSenior" in PUT /api/users/:id (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          standing: 'SuperSenior',
        });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details.some((d: any) => d.path === 'standing')).toBe(true);
    });

    it('rejects empty string major in PUT /api/users/:id (400)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          major: '',
        });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details.some((d: any) => d.path === 'major')).toBe(true);
    });
  });

  // =========================================================================
  // 4. UNHAPPY / FAILURE PATHS: CONFLICTING STATES
  // =========================================================================
  describe('4. Unhappy Paths: Conflicting States', () => {
    it('rejects conflicting time window: earliestStartTime later than latestEndTime (400)', async () => {
      // Act: earliest 18:00 (6 PM) vs latest 09:00 (9 AM)
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          earliestStartTime: '18:00',
          latestEndTime: '09:00',
        });

      // Assert
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details[0].message).toContain(
        'earliestStartTime must not be later than latestEndTime'
      );
    });

    it('accepts equal earliestStartTime and latestEndTime (e.g. single boundary hour)', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          earliestStartTime: '12:00',
          latestEndTime: '12:00',
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. EDGE CASES: FIELD-LEVEL BOUNDARIES (Schema Unit Tests)
  // =========================================================================
  describe('5. Edge Cases: Schema Boundary Invariants', () => {
    describe('targetTerm boundaries', () => {
      it('rejects unsupported term strings', () => {
        expect(UserPreferencesSchema.safeParse({ targetTerm: 'Summer 2025' }).success).toBe(false);
        expect(UserPreferencesSchema.safeParse({ targetTerm: 'Fall 2099' }).success).toBe(false);
      });
    });

    describe('targetCredits boundaries', () => {
      it('accepts exact lower bound (5 credits) and upper bound (25 credits)', () => {
        expect(UserPreferencesSchema.safeParse({ targetCredits: 5 }).success).toBe(true);
        expect(UserPreferencesSchema.safeParse({ targetCredits: 25 }).success).toBe(true);
      });

      it('rejects below lower bound (4 credits)', () => {
        expect(UserPreferencesSchema.safeParse({ targetCredits: 4 }).success).toBe(false);
      });

      it('rejects above upper bound (26 credits)', () => {
        expect(UserPreferencesSchema.safeParse({ targetCredits: 26 }).success).toBe(false);
      });

      it('rejects decimal unit numbers (15.5 credits)', () => {
        expect(UserPreferencesSchema.safeParse({ targetCredits: 15.5 }).success).toBe(false);
      });
    });

    describe('time regex boundaries', () => {
      it('rejects missing leading zero (8:30)', () => {
        expect(UserPreferencesSchema.safeParse({ earliestStartTime: '8:30' }).success).toBe(false);
      });

      it('rejects hour overflow (24:00)', () => {
        expect(UserPreferencesSchema.safeParse({ earliestStartTime: '24:00' }).success).toBe(false);
      });

      it('rejects minute overflow (09:60)', () => {
        expect(UserPreferencesSchema.safeParse({ latestEndTime: '09:60' }).success).toBe(false);
      });

      it('accepts exact 24h boundaries (00:00 and 23:59)', () => {
        expect(
          UserPreferencesSchema.safeParse({ earliestStartTime: '00:00', latestEndTime: '23:59' })
            .success
        ).toBe(true);
      });
    });

    describe('preferredFreeDays boundaries', () => {
      it('rejects weekend days (Saturday, Sunday)', () => {
        expect(UserPreferencesSchema.safeParse({ preferredFreeDays: ['Saturday'] }).success).toBe(
          false
        );
        expect(UserPreferencesSchema.safeParse({ preferredFreeDays: ['Sunday'] }).success).toBe(
          false
        );
      });

      it('accepts all five instructional weekdays', () => {
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        expect(UserPreferencesSchema.safeParse({ preferredFreeDays: weekdays }).success).toBe(true);
      });
    });

    describe('maxBackToBackHours boundaries', () => {
      it('accepts exact boundary range (1 to 8 hours)', () => {
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 1 }).success).toBe(true);
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 8 }).success).toBe(true);
      });

      it('rejects out of bounds (0 or 9 hours)', () => {
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 0 }).success).toBe(false);
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 9 }).success).toBe(false);
      });
    });
  });

  // =========================================================================
  // 6. DATABASE SCHEMA INTEGRITY
  // =========================================================================
  describe('6. Database Table Schema Integrity', () => {
    it('verifies users table contains preferences column', () => {
      const tableInfo = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
      const hasPreferencesCol = tableInfo.some((col) => col.name === 'preferences');
      expect(hasPreferencesCol).toBe(true);
    });
  });

  // =========================================================================
  // 7. DYNAMIC SCHEDULE RECALCULATION & CONFLICT BADGING (Ticket 03)
  // =========================================================================
  describe('7. Dynamic Schedule Recalculation & Conflict Badges', () => {
    it('GET /api/calendar/preview recalculates based on user targetTerm and targetCredits', async () => {
      // Arrange: update User A preferences to 10 credits in Fall 2026
      await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetTerm: 'Fall 2026',
          targetCredits: 10,
          preferredFreeDays: [],
        });

      // Act
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.term).toBe('Fall 2026');
      expect(res.body.data.totalCredits).toBe(10);
      // 2 academic courses (5 credits each) + 1 google busy event
      const academicEvents = res.body.data.events.filter(
        (e: any) => e.type !== 'GOOGLE_CALENDAR_BUSY'
      );
      expect(academicEvents.length).toBe(2);
    });

    it('prioritizes conflict-free courses first when available in candidate pool', async () => {
      // Arrange: User A wants 15 credits (3 courses) with Friday free
      // The pool has 4 courses with no Friday meetings and 1 course (CSE 115A) meeting Friday
      await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetTerm: 'Winter 2027',
          targetCredits: 15,
          preferredFreeDays: ['Friday'],
        });

      // Act
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const academicEvents = res.body.data.events.filter(
        (e: any) => e.type !== 'GOOGLE_CALENDAR_BUSY'
      );
      expect(academicEvents).toHaveLength(3);
      // None of the selected courses meet on Friday
      academicEvents.forEach((c: any) => {
        expect(c.days).not.toContain('Friday');
        expect(c.conflictBadge).toBeUndefined();
      });
      // Conflicted CSE 115A was avoided because sufficient conflict-free alternatives existed
      expect(academicEvents.some((c: any) => c.id.includes('cse-115a'))).toBe(false);
    });

    it('GET /api/calendar/preview attaches conflict badge when course meets on preferred free day', async () => {
      // Arrange: User A wants Friday off, but CSE 115A meets Mon/Wed/Fri
      // When 25 credits (all 5 courses) are requested, CSE 115A must be included and badged
      await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetTerm: 'Winter 2027',
          targetCredits: 25,
          preferredFreeDays: ['Friday'],
        });

      // Act
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      const cse115a = res.body.data.events.find((e: any) => e.id.includes('cse-115a'));
      expect(cse115a).toBeDefined();
      expect(cse115a.conflictBadge).toBe('Spans preferred free day');
      expect(cse115a.conflictBadges).toContain('Spans preferred free day');

      // Math 21 meets Tue/Thu, should NOT have a conflict badge
      const nonConflicted = res.body.data.events.find((e: any) => e.id.includes('cse-130') || e.id.includes('math-21'));
      expect(nonConflicted?.conflictBadge).toBeUndefined();
    });

    it('GET /api/calendar/preview attaches conflict badge when course starts before earliestStartTime', async () => {
      // Arrange: User A wants classes no earlier than 10:00, but CSE 115A starts at 09:00
      // Requesting 25 credits ensures CSE 115A is selected in best-effort schedule
      await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetTerm: 'Winter 2027',
          targetCredits: 25,
          earliestStartTime: '10:00',
          preferredFreeDays: [],
        });

      // Act
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      const earlyCourse = res.body.data.events.find((e: any) => e.startTime < '10:00' && e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(earlyCourse).toBeDefined();
      expect(earlyCourse.conflictBadge).toBe('Starts before preferred time');
      expect(earlyCourse.conflictBadges).toContain('Starts before preferred time');
    });

    it('captures multiple simultaneous conflicts into typed array and combined string', async () => {
      // Arrange: CSE 115A meets Friday AND starts at 09:00 (< 10:00)
      await request(app)
        .put(`/api/users/${userAId}/preferences`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          targetTerm: 'Winter 2027',
          targetCredits: 25,
          preferredFreeDays: ['Friday'],
          earliestStartTime: '10:00',
        });

      // Act
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      const multiConflict = res.body.data.events.find((e: any) => e.startTime < '10:00' && e.days.includes('Friday') && e.type !== 'GOOGLE_CALENDAR_BUSY');
      expect(multiConflict).toBeDefined();
      expect(multiConflict.conflictBadges).toContain('Spans preferred free day');
      expect(multiConflict.conflictBadges).toContain('Starts before preferred time');
      expect(multiConflict.conflictBadge).toBe('Spans preferred free day, Starts before preferred time');
    });
  });

  describe('Profile & Preferences Import / Export (Sprint 4 Priority 3)', () => {
    it('exports profile and preferences as standard JSON', async () => {
      // Act
      const res = await request(app)
        .get(`/api/users/${userAId}/export`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBe('1.0');
      expect(res.body.data.profile.name).toBe('User A Senior');
      expect(res.body.data.profile.major).toBe('Robotics Engineering B.S.');
      expect(res.body.data.preferences).toBeDefined();
    });

    it('imports profile and preferences from JSON and mutates user record', async () => {
      // Arrange
      const importPayload = {
        profile: {
          name: 'Imported Sammy Slug',
          standing: 'Senior',
          major: 'Computer Science B.S.',
        },
        preferences: {
          targetCredits: 12,
          targetTerm: 'Spring 2027',
          preferredFreeDays: ['Friday'],
        },
        majorRequirementsTaken: ['CSE 101', 'CSE 115A'],
      };

      // Act
      const res = await request(app)
        .post(`/api/users/${userAId}/import`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send(importPayload);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Imported Sammy Slug');
      expect(res.body.data.standing).toBe('Senior');
      expect(res.body.data.preferences.targetCredits).toBe(12);

      // Verify persistence via GET /api/users/:id
      const getRes = await request(app)
        .get(`/api/users/${userAId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Imported Sammy Slug');
    });

    it('rejects unauthorized export or import attempts', async () => {
      const exportRes = await request(app)
        .get(`/api/users/${userAId}/export`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(exportRes.status).toBe(403);

      const importRes = await request(app)
        .post(`/api/users/${userAId}/import`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});
      expect(importRes.status).toBe(403);
    });
  });
});
