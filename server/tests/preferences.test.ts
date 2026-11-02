import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { userQueries } from '../src/db/queries/userQueries.js';

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
});
