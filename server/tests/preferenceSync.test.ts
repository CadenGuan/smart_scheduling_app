import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../src/app.js';
import { calendarQueries } from '../src/db/queries/calendarQueries.js';
import { conversationQueries } from '../src/db/queries/conversationQueries.js';
import { AgentService } from '../src/services/agent.service.js';
import { MacroPivotResult } from '../src/services/calendar.service.js';
import { buildPivotNotice, describePivotChanges } from '../src/services/preferenceSync.service.js';

const BASE_PREFS = { targetTerm: 'Winter 2027', targetCredits: 15 };

async function registerUser(): Promise<{ token: string; userId: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `pref-sync-${uuidv4()}@ucsc.edu`,
      password: 'Password123!',
      name: 'Pref Sync Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    });
  return { token: res.body.data.token, userId: res.body.data.user.userId };
}

/** Initial setup in mock mode generates and persists a baseline schedule. */
async function seedSchedule(token: string, userId: string): Promise<void> {
  await request(app)
    .put(`/api/users/${userId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ preferences: BASE_PREFS });
}

/** isUsingMockAgent() is true under vitest; clear every signal so the real-agent path runs. */
function useRealAgentMode(): void {
  vi.stubEnv('VITEST', '');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('USE_MOCK_AGENT', 'false');
  vi.stubEnv('AGENT_MODE', 'real');
}

function systemMessages(userId: string) {
  return conversationQueries.getRecentMessages(userId, 50).filter((m) => m.sender === 'SYSTEM');
}

describe('Preference changes stitched into the agent', () => {
  let token: string;
  let userId: string;

  beforeEach(async () => {
    ({ token, userId } = await registerUser());
    await seedSchedule(token, userId);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('pivot notice text', () => {
    it('describes each changed field', () => {
      // Arrange
      const changes: MacroPivotResult['changes'] = [
        { field: 'targetTerm', from: 'Winter 2027', to: 'Spring 2027' },
        { field: 'targetCredits', from: '15', to: '10' },
      ];

      // Act
      const text = describePivotChanges(changes);

      // Assert
      expect(text).toBe('target term Winter 2027 → Spring 2027; target credits 15 → 10');
    });

    it('mentions cleared pinned courses and that the agent must rebuild', () => {
      // Arrange
      const result: MacroPivotResult = {
        isMacroPivot: true,
        isInitialSetup: false,
        changes: [{ field: 'targetCredits', from: '15', to: '10' }],
        clearedPinnedCourses: true,
        requiresAgentRegeneration: true,
      };

      // Act
      const text = buildPivotNotice(result, 'AGENT');

      // Assert
      expect(text).toContain('via SlugAgent');
      expect(text).toContain('(including pinned courses)');
      expect(text).toContain('needs to be built');
    });
  });

  describe('Edit Preferences (PUT /api/users/:id)', () => {
    it('mock mode: credit change returns a pivot, rebuilds server-side, and records a SYSTEM notice', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: { ...BASE_PREFS, targetCredits: 10 } });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.meta.schedulePivot).toMatchObject({
        isMacroPivot: true,
        requiresAgentRegeneration: false,
        changes: [{ field: 'targetCredits', from: '15', to: '10' }],
      });
      expect(calendarQueries.getUserCalendarEvents(userId, 'Winter 2027').length).toBeGreaterThan(
        0
      );
      const notices = systemMessages(userId);
      expect(notices).toHaveLength(1);
      expect(notices[0].content).toContain('target credits 15 → 10');
    });

    it('real-agent mode: term change clears the schedule and asks the client to rebuild via the agent', async () => {
      // Arrange
      useRealAgentMode();

      // Act
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: { ...BASE_PREFS, targetTerm: 'Spring 2027' } });

      // Assert
      expect(res.body.meta.schedulePivot.requiresAgentRegeneration).toBe(true);
      expect(calendarQueries.getUserCalendarEvents(userId)).toHaveLength(0);
      expect(systemMessages(userId)[0].content).toContain('needs to be built');
    });

    it('soft adjustment (free days) keeps the schedule and records no notice', async () => {
      // Arrange
      const before = calendarQueries.getUserCalendarEvents(userId, 'Winter 2027').length;

      // Act
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: { ...BASE_PREFS, preferredFreeDays: ['Friday'] } });

      // Assert
      expect(res.body.meta.schedulePivot.isMacroPivot).toBe(false);
      expect(res.body.meta.schedulePivot.requiresAgentRegeneration).toBe(false);
      expect(calendarQueries.getUserCalendarEvents(userId, 'Winter 2027')).toHaveLength(before);
      expect(systemMessages(userId)).toHaveLength(0);
    });

    it('PUT /api/users/:id/preferences also reports the pivot', async () => {
      // Act
      const res = await request(app)
        .put(`/api/users/${userId}/preferences`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ...BASE_PREFS, targetCredits: 10 });

      // Assert
      expect(res.body.meta.schedulePivot.isMacroPivot).toBe(true);
      expect(systemMessages(userId)).toHaveLength(1);
    });
  });

  describe('Agent tool update_schedule_preferences (POST /api/agent/chat)', () => {
    function stubAgentPreferenceUpdate(updates: object, proposedCourses: any[] = []) {
      vi.spyOn(AgentService, 'queryAgent').mockResolvedValue({
        response: 'Updated your preferences.',
        toolCalls: [
          {
            tool: 'update_schedule_preferences',
            output: JSON.stringify({ action: 'UPDATE_PREFERENCES', updates }),
          },
        ],
        metadata: {},
        proposedCourses,
      });
    }

    it('real-agent mode: a term change from chat clears the stale schedule and requests a rebuild', async () => {
      // Arrange
      useRealAgentMode();
      stubAgentPreferenceUpdate({ targetTerm: 'Spring 2027' });

      // Act
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Plan for spring instead' });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.schedulePivot.changes).toEqual([
        { field: 'targetTerm', from: 'Winter 2027', to: 'Spring 2027' },
      ]);
      expect(res.body.data.requiresAgentRegeneration).toBe(true);
      expect(calendarQueries.getUserCalendarEvents(userId, 'Winter 2027')).toHaveLength(0);
      expect(systemMessages(userId)[0].content).toContain('via SlugAgent');
    });

    it('does not request a rebuild when the agent proposed replacement courses in the same turn', async () => {
      // Arrange
      useRealAgentMode();
      const [course] = calendarQueries
        .getUserCalendarEvents(userId, 'Winter 2027')
        .filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
      stubAgentPreferenceUpdate({ targetCredits: 10 }, [course]);

      // Act
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Make it 10 credits' });

      // Assert
      expect(res.body.data.schedulePivot.isMacroPivot).toBe(true);
      expect(res.body.data.requiresAgentRegeneration).toBe(false);
    });

    it('a soft adjustment from chat returns no pivot', async () => {
      // Arrange
      stubAgentPreferenceUpdate({ preferredFreeDays: ['Friday'] });

      // Act
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ prompt: 'Keep Fridays free' });

      // Assert
      expect(res.body.data.schedulePivot).toBeUndefined();
      expect(res.body.data.requiresAgentRegeneration).toBe(false);
      expect(systemMessages(userId)).toHaveLength(0);
    });
  });

  describe('message ordering', () => {
    it('keeps insertion order for messages written in the same second', () => {
      // Arrange
      const senders = ['USER', 'SYSTEM', 'AGENT'] as const;
      senders.forEach((sender, i) =>
        conversationQueries.insertMessage({
          message_id: uuidv4(),
          user_id: userId,
          sender,
          content: `msg-${i}`,
        })
      );

      // Act
      const recent = conversationQueries.getRecentMessages(userId).map((m) => m.content);
      const window = conversationQueries.getSlidingWindowMessages(userId, 3).map((m) => m.content);

      // Assert
      expect(recent).toEqual(['msg-0', 'msg-1', 'msg-2']);
      expect(window).toEqual(['msg-0', 'msg-1', 'msg-2']);
    });
  });
});
