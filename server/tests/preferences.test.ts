import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { userQueries } from '../src/db/queries/userQueries.js';
import { UserPreferencesSchema } from 'shared';

describe('Ticket 01: Preferences Schema & Database Foundation', () => {
  let userId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `pref-db-test-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'Preferences Test Slug',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });

    userId = res.body.data.user.userId;
  });

  it('users table should have preferences column', () => {
    const tableInfo = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasPreferencesCol = tableInfo.some((col) => col.name === 'preferences');
    expect(hasPreferencesCol).toBe(true);
  });

  it('userQueries.updateUserProfile should persist preferences JSON and read it back', () => {
    const samplePrefs = {
      targetTerm: 'Spring 2027',
      targetCredits: 18,
      earliestStartTime: '09:00',
      latestEndTime: '17:00',
      preferredFreeDays: ['Friday'],
      maxBackToBackHours: 3,
    };

    userQueries.updateUserProfile(userId, {
      preferences: JSON.stringify(samplePrefs),
    });

    const user = userQueries.findUserById(userId);
    expect(user).toBeDefined();
    expect(user!.preferences).toBeDefined();
    expect(JSON.parse(user!.preferences!)).toEqual(samplePrefs);
  });

  describe('Comprehensive Field-by-Field Validation Tests (UserPreferencesSchema)', () => {
    it('should accept valid full preferences payload', () => {
      const valid = {
        targetTerm: 'Winter 2027',
        targetCredits: 15,
        earliestStartTime: '08:30',
        latestEndTime: '18:00',
        preferredFreeDays: ['Monday', 'Friday'],
        maxBackToBackHours: 3,
      };

      const result = UserPreferencesSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should apply defaults when optional/empty fields are omitted', () => {
      const result = UserPreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetTerm).toBe('Winter 2027');
        expect(result.data.targetCredits).toBe(15);
        expect(result.data.preferredFreeDays).toEqual([]);
      }
    });

    // 1. targetTerm validation
    describe('targetTerm', () => {
      it('rejects unsupported term strings', () => {
        const result = UserPreferencesSchema.safeParse({ targetTerm: 'Summer 2025' });
        expect(result.success).toBe(false);
      });

      it('rejects non-string targetTerm values', () => {
        const result = UserPreferencesSchema.safeParse({ targetTerm: 2027 });
        expect(result.success).toBe(false);
      });
    });

    // 2. targetCredits validation
    describe('targetCredits', () => {
      it('rejects credit load below minimum (under 5)', () => {
        const result = UserPreferencesSchema.safeParse({ targetCredits: 4 });
        expect(result.success).toBe(false);
      });

      it('rejects negative or zero credit values', () => {
        expect(UserPreferencesSchema.safeParse({ targetCredits: 0 }).success).toBe(false);
        expect(UserPreferencesSchema.safeParse({ targetCredits: -5 }).success).toBe(false);
      });

      it('rejects credit load exceeding maximum (over 25)', () => {
        const result = UserPreferencesSchema.safeParse({ targetCredits: 26 });
        expect(result.success).toBe(false);
      });

      it('rejects non-integer decimal credit values', () => {
        const result = UserPreferencesSchema.safeParse({ targetCredits: 15.5 });
        expect(result.success).toBe(false);
      });

      it('rejects string credit values', () => {
        const result = UserPreferencesSchema.safeParse({ targetCredits: '15' });
        expect(result.success).toBe(false);
      });
    });

    // 3. earliestStartTime validation
    describe('earliestStartTime', () => {
      it('rejects times without leading zero (e.g. 8:30 instead of 08:30)', () => {
        const result = UserPreferencesSchema.safeParse({ earliestStartTime: '8:30' });
        expect(result.success).toBe(false);
      });

      it('rejects hours >= 24', () => {
        const result = UserPreferencesSchema.safeParse({ earliestStartTime: '24:00' });
        expect(result.success).toBe(false);
      });

      it('rejects minutes >= 60', () => {
        const result = UserPreferencesSchema.safeParse({ earliestStartTime: '09:60' });
        expect(result.success).toBe(false);
      });

      it('rejects textual or 12-hour AM/PM formats', () => {
        expect(UserPreferencesSchema.safeParse({ earliestStartTime: '8:00 AM' }).success).toBe(
          false
        );
        expect(UserPreferencesSchema.safeParse({ earliestStartTime: 'morning' }).success).toBe(
          false
        );
      });
    });

    // 4. latestEndTime validation
    describe('latestEndTime', () => {
      it('rejects times without leading zero', () => {
        const result = UserPreferencesSchema.safeParse({ latestEndTime: '5:00' });
        expect(result.success).toBe(false);
      });

      it('rejects hours >= 24 or invalid minutes >= 60', () => {
        expect(UserPreferencesSchema.safeParse({ latestEndTime: '25:00' }).success).toBe(false);
        expect(UserPreferencesSchema.safeParse({ latestEndTime: '18:99' }).success).toBe(false);
      });

      it('rejects non-string time formats', () => {
        const result = UserPreferencesSchema.safeParse({ latestEndTime: 1700 });
        expect(result.success).toBe(false);
      });
    });

    // 5. preferredFreeDays validation
    describe('preferredFreeDays', () => {
      it('rejects unrecognized day names', () => {
        const result = UserPreferencesSchema.safeParse({ preferredFreeDays: ['Funday'] });
        expect(result.success).toBe(false);
      });

      it('rejects weekend days (only UCSC instructional weekdays Monday-Friday allowed)', () => {
        expect(UserPreferencesSchema.safeParse({ preferredFreeDays: ['Saturday'] }).success).toBe(
          false
        );
        expect(UserPreferencesSchema.safeParse({ preferredFreeDays: ['Sunday'] }).success).toBe(
          false
        );
      });

      it('rejects non-array day values', () => {
        const result = UserPreferencesSchema.safeParse({ preferredFreeDays: 'Friday' });
        expect(result.success).toBe(false);
      });
    });

    // 6. maxBackToBackHours validation
    describe('maxBackToBackHours', () => {
      it('rejects hours below minimum (under 1 hour)', () => {
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: 0 }).success).toBe(false);
        expect(UserPreferencesSchema.safeParse({ maxBackToBackHours: -2 }).success).toBe(false);
      });

      it('rejects hours exceeding maximum (over 8 hours)', () => {
        const result = UserPreferencesSchema.safeParse({ maxBackToBackHours: 9 });
        expect(result.success).toBe(false);
      });

      it('rejects non-numeric hour strings', () => {
        const result = UserPreferencesSchema.safeParse({ maxBackToBackHours: 'three' });
        expect(result.success).toBe(false);
      });
    });
  });
});
