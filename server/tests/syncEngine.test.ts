import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { db } from '../src/db/database.js';
import { scheduleQueries } from '../src/db/queries/scheduleQueries.js';
import { settingsQueries } from '../src/db/queries/settingsQueries.js';
import { SyncEngineService } from '../src/services/syncEngine.service.js';

describe('Sync Engine & Routes (/api/sync)', () => {
  let authToken = '';
  let userId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `sync-engine-user-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'Sync Student',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });
    authToken = res.body.data.token;
    userId = res.body.data.user.userId;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Route: POST /api/sync/run', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/sync/run');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/sync/settings returns user settings', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);
      const res = await request(app)
        .get('/api/sync/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.syncEnabled).toBe(true);
      expect(res.body.data.isConnectedToGoogle).toBe(true);
    });

    it('returns 400 when Google is not connected', async () => {
      settingsQueries.upsertUserSettings(userId, true, false);

      const res = await request(app)
        .post('/api/sync/run')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('GOOGLE_NOT_CONNECTED');
    });

    it('returns 400 when sync is disabled in settings', async () => {
      settingsQueries.upsertUserSettings(userId, false, true);

      const res = await request(app)
        .post('/api/sync/run')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('SYNC_DISABLED');
    });
  });

  describe('SyncEngineService Unit Tests', () => {
    it('returns pause message if sync is disabled or Google not connected', async () => {
      settingsQueries.upsertUserSettings(userId, false, false);
      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.message).toContain('Sync is paused');
      expect(result.syncedCount).toBe(0);
    });

    it('returns up-to-date message when there are no pending events', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);
      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.message).toContain('All schedule events are up to date');
      expect(result.syncedCount).toBe(0);
      expect(result.pendingCount).toBe(0);
    });

    it('marks events as failed if no OAuth token exists for user', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);

      // Create a pending event
      const ev = scheduleQueries.createScheduleEvent(userId, {
        courseCode: 'CSE 101',
        title: 'Algorithms',
        description: 'Lecture 01',
        days: 'M,W,F',
        startTime: '13:00',
        endTime: '14:05',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
      });

      // Ensure no oauth token in table
      db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(userId);

      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.failedCount).toBeGreaterThanOrEqual(1);
      expect(result.message).toContain('No Google OAuth token available');

      const updated = scheduleQueries.getScheduleEventById(ev.id);
      expect(updated?.syncStatus).toBe('failed');
    });

    it('successfully pushes pending events to Django and updates status to synced', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);

      // Create a pending event
      const ev = scheduleQueries.createScheduleEvent(userId, {
        courseCode: 'CSE 115A',
        title: 'Software Engineering',
        description: 'Lecture 01',
        days: 'Tu,Th',
        startTime: '10:00',
        endTime: '11:45',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
      });

      // Insert dummy oauth token
      db.prepare(
        `
        INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, scope, expires_at)
        VALUES (?, 'google', 'mock_access_token_123', 'mock_refresh_token_123', 'scope', '2099-01-01')
        ON CONFLICT(user_id) DO UPDATE SET access_token = 'mock_access_token_123'
      `
      ).run(userId);

      // Mock pushEventToDjango to return success
      vi.spyOn(SyncEngineService, 'pushEventToDjango').mockResolvedValue({
        success: true,
        googleEventId: 'google_ev_cse115a',
      });

      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.syncedCount).toBeGreaterThanOrEqual(1);

      const updated = scheduleQueries.getScheduleEventById(ev.id);
      expect(updated?.syncStatus).toBe('synced');
      expect(updated?.googleEventId).toBe('google_ev_cse115a');
    });

    it('recovers from 401 via token refresh and retries sync push', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);

      // Create a pending event
      const ev = scheduleQueries.createScheduleEvent(userId, {
        courseCode: 'CSE 130',
        title: 'Operating Systems',
        description: 'Lecture 01',
        days: 'M,W',
        startTime: '15:00',
        endTime: '16:35',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
      });

      // Mock pushEventToDjango: 1st call fails with 401, 2nd call succeeds
      let calls = 0;
      vi.spyOn(SyncEngineService, 'pushEventToDjango').mockImplementation(async () => {
        calls++;
        if (calls === 1) {
          return { success: false, status: 401 };
        }
        return { success: true, googleEventId: 'google_ev_refreshed_130' };
      });

      // Mock refreshGoogleToken to return a refreshed token
      vi.spyOn(SyncEngineService, 'refreshGoogleToken').mockResolvedValue(
        'new_refreshed_access_token'
      );

      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.syncedCount).toBeGreaterThanOrEqual(1);

      const updated = scheduleQueries.getScheduleEventById(ev.id);
      expect(updated?.syncStatus).toBe('synced');
      expect(updated?.googleEventId).toBe('google_ev_refreshed_130');
    });

    it('marks event failed if 401 refresh token retry fails', async () => {
      settingsQueries.upsertUserSettings(userId, true, true);

      // Create a pending event
      const ev = scheduleQueries.createScheduleEvent(userId, {
        courseCode: 'AM 10',
        title: 'Mathematical Methods',
        description: 'Lecture 01',
        days: 'M,W,F',
        startTime: '09:00',
        endTime: '10:05',
        startDate: '2027-01-04',
        endDate: '2027-03-19',
      });

      // Mock pushEventToDjango to return 401
      vi.spyOn(SyncEngineService, 'pushEventToDjango').mockResolvedValue({
        success: false,
        status: 401,
      });

      // Mock refreshGoogleToken to fail (return null)
      vi.spyOn(SyncEngineService, 'refreshGoogleToken').mockResolvedValue(null);

      const result = await SyncEngineService.syncUserSchedule(userId);
      expect(result.failedCount).toBeGreaterThanOrEqual(1);

      const updated = scheduleQueries.getScheduleEventById(ev.id);
      expect(updated?.syncStatus).toBe('failed');
    });
  });
});
