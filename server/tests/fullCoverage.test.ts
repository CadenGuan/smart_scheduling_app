import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { userQueries } from '../src/db/queries/userQueries.js';
import { sessionQueries } from '../src/db/queries/sessionQueries.js';
import { progressQueries } from '../src/db/queries/progressQueries.js';
import { AuthService } from '../src/services/auth.service.js';
import { GoogleAuthService } from '../src/services/google.service.js';
import { ProgressService } from '../src/services/progress.service.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { config } from '../src/config.js';

describe('100% Comprehensive Coverage Verification Test Suite', () => {
  let userToken: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;

  beforeAll(async () => {
    // 1. Create main test user
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        email: `coverage-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'Coverage Slug',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });
    userToken = resA.body.data.token;
    userId = resA.body.data.user.userId;

    // 2. Create another user for isolation tests
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `coverage-other-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'Other Slug',
        standing: 'Freshman',
        major: 'Biology B.S.',
      });
    otherToken = resB.body.data.token;
    otherUserId = resB.body.data.user.userId;
  });

  // =========================================================================
  // 1. APP HEALTH ENDPOINT & CONFIG
  // =========================================================================
  describe('app.ts health endpoint & config', () => {
    it('GET /api/health returns 200 with status ok and timestamp', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });

    it('exercises config.ts default values', async () => {
      const { config: c } = await import('../src/config.js');
      expect(c.PORT).toBeDefined();
      expect(c.JWT_SECRET).toBeDefined();
    });
  });

  // =========================================================================
  // 2. DATABASE QUERIES COVERAGE
  // =========================================================================
  describe('Database Queries (sessionQueries, progressQueries, userQueries)', () => {
    it('exercises completeOnboarding in progressQueries', () => {
      progressQueries.completeOnboarding(userId);
      const row = progressQueries.getProgress(userId);
      expect(row?.completed).toBe(1);
    });

    it('exercises sessionQueries methods (create, find, delete, deleteUserSessions)', () => {
      const testToken = `test-token-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 100000).toISOString();

      sessionQueries.createSession({
        session_id: `sess-${Date.now()}`,
        user_id: userId,
        token: testToken,
        expires_at: expiresAt,
      });

      const found = sessionQueries.findSessionByToken(testToken);
      expect(found).toBeDefined();
      expect(found?.user_id).toBe(userId);

      sessionQueries.deleteSession(testToken);
      const afterDelete = sessionQueries.findSessionByToken(testToken);
      expect(afterDelete).toBeUndefined();

      // deleteUserSessions
      sessionQueries.createSession({
        session_id: `sess-2-${Date.now()}`,
        user_id: userId,
        token: `${testToken}-2`,
        expires_at: expiresAt,
      });
      sessionQueries.deleteUserSessions(userId);
      const afterUserDelete = sessionQueries.findSessionByToken(`${testToken}-2`);
      expect(afterUserDelete).toBeUndefined();
    });

    it('exercises userQueries updates for major_requirements_taken and breaks_preference', () => {
      userQueries.updateUserProfile(userId, {
        major_requirements_taken: JSON.stringify(['CSE 12', 'CSE 30']),
        breaks_preference: JSON.stringify(['Lunch 12-1']),
        ge_status: JSON.stringify({ source: 'MYUCSC', remaining: ['PR-E'] }),
      });

      const user = userQueries.findUserById(userId);
      expect(user?.major_requirements_taken).toContain('CSE 12');
      expect(user?.breaks_preference).toContain('Lunch 12-1');
      expect(user?.ge_status).toContain('PR-E');
    });
  });

  // =========================================================================
  // 3. ERROR HANDLER COMPREHENSIVE COVERAGE
  // =========================================================================
  describe('errorHandler middleware', () => {
    it('handles generic non-Zod error with default 500 status and code', () => {
      let responseStatus = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          responseBody = data;
          return mockRes;
        },
      };

      const genericError: any = new Error('Database connection failed');
      errorHandler(genericError, {} as any, mockRes, () => {});

      expect(responseStatus).toBe(500);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error).toBe('INTERNAL_SERVER_ERROR');
      expect(responseBody.message).toBe('Database connection failed');
    });

    it('handles error with custom statusCode and custom code', () => {
      let responseStatus = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          responseBody = data;
          return mockRes;
        },
      };

      const customError: any = new Error('Custom service error');
      customError.statusCode = 402;
      customError.code = 'PAYMENT_REQUIRED';

      errorHandler(customError, {} as any, mockRes, () => {});

      expect(responseStatus).toBe(402);
      expect(responseBody.error).toBe('PAYMENT_REQUIRED');
    });

    it('handles ZodError with non-array path elements', () => {
      let responseStatus = 0;
      let responseBody: any = null;

      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return mockRes;
        },
        json: (data: any) => {
          responseBody = data;
          return mockRes;
        },
      };

      const zodLikeError: any = {
        name: 'ZodError',
        issues: [{ path: 'singlePathString', message: 'Invalid field' }],
      };

      errorHandler(zodLikeError, {} as any, mockRes, () => {});

      expect(responseStatus).toBe(400);
      expect(responseBody.error).toBe('VALIDATION_ERROR');
      expect(responseBody.details[0].path).toBe('singlePathString');
    });
  });

  // =========================================================================
  // 4. AUTH SERVICE & ROUTES (Logout, Invalid Login, Google Auth)
  // =========================================================================
  describe('Auth Service & Routes', () => {
    it('POST /api/auth/logout logs out authenticated user', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully.');
    });

    it('AuthService.login rejects unregistered email (401 INVALID_CREDENTIALS)', async () => {
      await expect(
        AuthService.login({
          email: 'nonexistent-slug-xyz@ucsc.edu',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('AuthService.login rejects incorrect password (401 INVALID_CREDENTIALS)', async () => {
      const user = userQueries.findUserById(userId);
      await expect(
        AuthService.login({
          email: user!.email,
          password: 'WrongPassword999!',
        })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('GoogleAuthService handles simulated decoded JWT token', async () => {
      const payload = {
        email: `jwt-user-${Date.now()}@ucsc.edu`,
        name: 'JWT Student',
      };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const fakeJwt = `header.${base64Payload}.signature`;

      // Temporarily set GOOGLE_CLIENT_ID to exercise production JWT branch
      const origClientId = config.GOOGLE_CLIENT_ID;
      (config as any).GOOGLE_CLIENT_ID = 'mock-google-client-id';

      try {
        const result = await GoogleAuthService.authenticate(fakeJwt, false);
        expect(result.user.email).toBe(payload.email.toLowerCase());
        expect(result.user.name).toBe('JWT Student');
      } finally {
        (config as any).GOOGLE_CLIENT_ID = origClientId;
      }
    });

    it('GoogleAuthService handles invalid base64 token falling back to default', async () => {
      const origClientId = config.GOOGLE_CLIENT_ID;
      (config as any).GOOGLE_CLIENT_ID = 'mock-google-client-id';

      try {
        const result = await GoogleAuthService.authenticate('malformed.token', false);
        expect(result.user.email).toBe('sammy.slug@ucsc.edu');
      } finally {
        (config as any).GOOGLE_CLIENT_ID = origClientId;
      }
    });
  });

  // =========================================================================
  // 5. CALENDAR ROUTES: Corrupted JSON & latestEndTime Conflict Badge
  // =========================================================================
  describe('Calendar Routes Edge Conditions', () => {
    it('GET /api/calendar/preview handles corrupted user.preferences gracefully', async () => {
      // Corrupt user preferences in SQLite directly
      db.prepare(`UPDATE users SET preferences = 'not valid json' WHERE user_id = ?`).run(userId);

      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.term).toBe('Winter 2027');
    });

    it('GET /api/calendar/preview marks Ends after preferred time conflict badge', async () => {
      // Update preferences with latestEndTime at 14:00 (Math 21 ends at 14:50, Art 10F at 16:55)
      await request(app)
        .put(`/api/users/${userId}/preferences`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetTerm: 'Winter 2027',
          targetCredits: 15,
          latestEndTime: '14:00',
          preferredFreeDays: [],
        });

      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      const lateCourse = res.body.data.events.find((e: any) => e.id === 'cse-130-01' || e.id === 'math-21-lec');
      expect(lateCourse.conflictBadge).toBe('Ends after preferred time');
    });
  });

  // =========================================================================
  // 6. PROGRESS ROUTES & SERVICE (403 Isolation & Default Generation)
  // =========================================================================
  describe('Progress Routes & Service Isolation', () => {
    it('GET /api/users/:id/progress rejects cross-user access (403)', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}/progress`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('PUT /api/users/:id/progress rejects cross-user update (403)', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}/progress`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          completed: false,
          lastStep: 2,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('ProgressService.getProgress generates initial defaults when no DB row exists', () => {
      const newUserId = `brand-new-${Date.now()}`;
      const progress = ProgressService.getProgress(newUserId);
      expect(progress.completed).toBe(false);
      expect(progress.lastStep).toBe(1);
      expect(progress.skippedSteps).toEqual([]);
      expect(progress.draftAnswers).toEqual({});
    });

    it('ProgressService.saveProgress synchronizes geSource, majorRequirementsTaken, and scheduledBreaks', () => {
      const progress = ProgressService.saveProgress(userId, {
        completed: true,
        lastStep: 4,
        skippedSteps: [1],
        draftAnswers: {
          standing: 'Senior',
          major: 'Technology & Information Management',
          geSource: 'TRANSFER',
          geCategoriesRemaining: ['CC'],
          majorRequirementsTaken: ['TIM 50'],
          scheduledBreaks: ['Friday Afternoon'],
        },
      });

      expect(progress.completed).toBe(true);
      const user = userQueries.findUserById(userId);
      expect(user?.ge_status).toContain('TRANSFER');
      expect(user?.major_requirements_taken).toContain('TIM 50');
      expect(user?.breaks_preference).toContain('Friday Afternoon');
    });
  });

  // =========================================================================
  // 7. USER ROUTES: 404 NOT FOUND & 403 ISOLATION
  // =========================================================================
  describe('User Routes 404 & 403 Edge Coverage', () => {
    it('GET /api/users/:id returns 404 when user does not exist in DB', async () => {
      // Craft valid token for non-existent userId
      const ghostId = '00000000-0000-0000-0000-000000000000';
      const { TokenService } = await import('../src/services/token.service.js');
      const token = TokenService.generateSessionToken({
        userId: ghostId,
        email: 'ghost@ucsc.edu',
        standing: 'Senior',
        name: 'Ghost User',
      });

      const res = await request(app)
        .get(`/api/users/${ghostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('GET /api/users/:id/preferences returns 404 when user does not exist in DB', async () => {
      const ghostId = '00000000-0000-0000-0000-000000000000';
      const { TokenService } = await import('../src/services/token.service.js');
      const token = TokenService.generateSessionToken({
        userId: ghostId,
        email: 'ghost@ucsc.edu',
        standing: 'Senior',
        name: 'Ghost User',
      });

      const res = await request(app)
        .get(`/api/users/${ghostId}/preferences`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('PUT /api/users/:id/preferences returns 404 when user does not exist in DB', async () => {
      const ghostId = '00000000-0000-0000-0000-000000000000';
      const { TokenService } = await import('../src/services/token.service.js');
      const token = TokenService.generateSessionToken({
        userId: ghostId,
        email: 'ghost@ucsc.edu',
        standing: 'Senior',
        name: 'Ghost User',
      });

      const res = await request(app)
        .put(`/api/users/${ghostId}/preferences`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetCredits: 15 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('PUT /api/users/:id rejects cross-user profile update (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ standing: 'Senior' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('PUT /api/users/:id returns 404 when target user does not exist in DB', async () => {
      const ghostId = '00000000-0000-0000-0000-000000000000';
      const { TokenService } = await import('../src/services/token.service.js');
      const token = TokenService.generateSessionToken({
        userId: ghostId,
        email: 'ghost@ucsc.edu',
        standing: 'Senior',
        name: 'Ghost User',
      });

      const res = await request(app)
        .put(`/api/users/${ghostId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ standing: 'Senior' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('GET /api/users/:id rejects cross-user profile access (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('GET /api/users/:id returns populated geStatus, majorRequirementsTaken, and breaksPreference', async () => {
      // First update intended_major as well
      userQueries.updateUserProfile(userId, { intended_major: 'Robotics Engineering B.S.' });

      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.intendedMajor).toBe('Robotics Engineering B.S.');
      expect(res.body.data.geStatus).toBeDefined();
      expect(Array.isArray(res.body.data.majorRequirementsTaken)).toBe(true);
      expect(Array.isArray(res.body.data.breaksPreference)).toBe(true);
    });

    it('GET /api/users/:id returns defaults when optional fields are null in DB', async () => {
      // User B has no majorRequirementsTaken or breaksPreference
      const res = await request(app)
        .get(`/api/users/${otherUserId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.majorRequirementsTaken).toEqual([]);
      expect(res.body.data.breaksPreference).toEqual([]);
    });
  });

  // =========================================================================
  // 8. DATABASE DIRECTORY & RUNTIME MIGRATION TESTS
  // =========================================================================
  describe('database.ts directory creation and migration helper', () => {
    it('exercises ensureDbDirectory with a new nested directory path', async () => {
      const { ensureDbDirectory } = await import('../src/db/database.js');
      const fs = await import('fs');
      const path = await import('path');

      const tmpDir = path.resolve(process.cwd(), 'data/tmp-test-dir');
      const tmpDb = path.resolve(tmpDir, 'test.db');

      ensureDbDirectory(tmpDb);
      expect(fs.existsSync(tmpDir)).toBe(true);

      // Clean up tmp test dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('exercises runPreferencesMigration when column does not exist and when statement fails', async () => {
      const { runPreferencesMigration } = await import('../src/db/database.js');
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const { DatabaseSync } = require('node:sqlite');

      // 1. In-memory database without preferences column
      const testDb = new DatabaseSync(':memory:');
      testDb.exec('CREATE TABLE users (user_id TEXT PRIMARY KEY, name TEXT);');

      runPreferencesMigration(testDb);

      const tableInfo = testDb.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
      expect(tableInfo.some((col) => col.name === 'preferences')).toBe(true);

      // 2. Erroneous targetDb to trigger catch block
      const brokenDb = {
        prepare: () => {
          throw new Error('Database disk error');
        },
      };
      expect(() => runPreferencesMigration(brokenDb as any)).not.toThrow();
    });

    it('exercises ProgressService with geSource and undefined remaining categories', () => {
      const res = ProgressService.saveProgress(userId, {
        completed: false,
        lastStep: 3,
        draftAnswers: {
          geSource: 'HIGH_SCHOOL',
        },
      });

      expect(res).toBeDefined();
    });

    it('exercises ProgressService when geSource is omitted in draftAnswers', () => {
      const res = ProgressService.saveProgress(userId, {
        completed: false,
        lastStep: 2,
        draftAnswers: {
          standing: 'Junior',
        },
      });

      expect(res).toBeDefined();
    });
  });
});
