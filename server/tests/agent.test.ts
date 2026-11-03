import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { conversationQueries } from '../src/db/queries/conversationQueries.js';
import { userQueries } from '../src/db/queries/userQueries.js';
import { calendarQueries } from '../src/db/queries/calendarQueries.js';
import { ContextService } from '../src/services/context.service.js';
import { AgentService } from '../src/services/agent.service.js';

describe('Interactive Agent & Conversation API Contract Tests', () => {
  let userTokenA = '';
  let userIdA = '';
  let userTokenB = '';
  let userIdB = '';

  const userA = {
    email: `agent-test-a-${Date.now()}@ucsc.edu`,
    password: 'Password123!',
    name: 'Agent Test Slug A',
    standing: 'Junior',
    major: 'Computer Science B.S.',
  };

  const userB = {
    email: `agent-test-b-${Date.now()}@ucsc.edu`,
    password: 'Password123!',
    name: 'Agent Test Slug B',
    standing: 'Senior',
    major: 'Robotics Engineering B.S.',
  };

  beforeAll(async () => {
    // 1. Register User A
    const resA = await request(app).post('/api/auth/register').send(userA);
    userTokenA = resA.body.data.token;
    userIdA = resA.body.data.user.userId;

    // 2. Register User B
    const resB = await request(app).post('/api/auth/register').send(userB);
    userTokenB = resB.body.data.token;
    userIdB = resB.body.data.user.userId;
  });

  describe('Validation & Security (Misdemeanors)', () => {
    it('POST /api/agent/chat should reject unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/agent/chat').send({ prompt: 'Hello agent' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('MISSING_OR_MALFORMED_TOKEN');
    });

    it('POST /api/agent/chat should reject empty or whitespace prompt with 400', async () => {
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('POST /api/agent/chat should reject prompt > 2000 characters with 400', async () => {
      const longPrompt = 'A'.repeat(2005);
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt: longPrompt });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Agent Query Execution & Persistence', () => {
    it('POST /api/agent/chat should process query, persist both user and agent messages in SQLite, and return 200', async () => {
      const prompt = 'What GE requirements should I take next?';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.userMessage).toBeDefined();
      expect(data.userMessage.userId).toBe(userIdA);
      expect(data.userMessage.sender).toBe('USER');
      expect(data.userMessage.content).toBe(prompt);

      expect(data.agentMessage).toBeDefined();
      expect(data.agentMessage.userId).toBe(userIdA);
      expect(data.agentMessage.sender).toBe('AGENT');
      expect(data.agentMessage.content.length).toBeGreaterThan(10);

      // Verify persistence in SQLite
      const userMsgInDb = conversationQueries.findMessageById(data.userMessage.messageId);
      expect(userMsgInDb).toBeDefined();
      expect(userMsgInDb?.user_id).toBe(userIdA);
      expect(userMsgInDb?.sender).toBe('USER');

      const agentMsgInDb = conversationQueries.findMessageById(data.agentMessage.messageId);
      expect(agentMsgInDb).toBeDefined();
      expect(agentMsgInDb?.user_id).toBe(userIdA);
      expect(agentMsgInDb?.sender).toBe('AGENT');
    });

    it('POST /api/agent/chat should answer "why" questions with rationale explanation and tool call', async () => {
      const prompt = 'Why did you recommend CSE 101?';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentMessage.content).toContain('CSE 101');
      expect(res.body.data.agentMessage.content).toContain('Prerequisite Unblocking');
      expect(res.body.data.agentMessage.toolCalls).toBeDefined();
      const hasRationaleTool = res.body.data.agentMessage.toolCalls.some(
        (tc: any) => tc.tool === 'explain_course_rationale'
      );
      expect(hasRationaleTool).toBe(true);
    });

    it('POST /api/agent/chat should answer prerequisite path queries with DAG solver', async () => {
      const prompt = 'What is the prerequisite path to take CSE 130?';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentMessage.content).toContain('CSE 130');
      const hasPrereqTool = res.body.data.agentMessage.toolCalls.some(
        (tc: any) => tc.tool === 'find_prerequisite_path'
      );
      expect(hasPrereqTool).toBe(true);
    });

    it('POST /api/agent/chat should evaluate drop course impact and flag gatekeepers', async () => {
      const prompt = 'What happens if I drop CSE 101?';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentMessage.content).toContain('downstream degree audit');
      const hasDropTool = res.body.data.agentMessage.toolCalls.some(
        (tc: any) => tc.tool === 'assess_drop_impact'
      );
      expect(hasDropTool).toBe(true);
    });

    it('POST /api/agent/chat should execute preference updates server-side and mutate SQLite user preferences', async () => {
      const prompt = 'Please change my target credits to 12';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agentMessage.content).toContain('12 credits');

      // Verify server updated SQLite database
      const user = userQueries.findUserById(userIdA);
      expect(user?.preferences).toBeDefined();
      const prefs = JSON.parse(user!.preferences || '{}');
      expect(prefs.targetCredits).toBe(12);
    });

    it('GET /api/agent/messages should return recent messages in chronological order', async () => {
      const res = await request(app)
        .get('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.messages)).toBe(true);
      expect(res.body.data.messages.length).toBeGreaterThanOrEqual(2);

      const first = res.body.data.messages[0];
      const second = res.body.data.messages[1];
      expect(first.sender).toBe('USER');
      expect(second.sender).toBe('AGENT');
      expect(new Date(first.createdAt).getTime()).toBeLessThanOrEqual(
        new Date(second.createdAt).getTime()
      );
    });

    it('DELETE /api/agent/messages should clear history only for the authenticated user', async () => {
      // 1. Send message as User B to ensure User B has messages
      await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ prompt: 'Message from user B' });

      // 2. User A deletes their history
      const deleteRes = await request(app)
        .delete('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // 3. User A history should now be empty
      const userARes = await request(app)
        .get('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(userARes.body.data.messages.length).toBe(0);

      // 4. User B history must remain intact (no cross-tenant leakage)
      const userBRes = await request(app)
        .get('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenB}`);
      expect(userBRes.body.data.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ContextService Live Integration', () => {
    it('assembleContext should parse user preferences and attach active calendar schedule', () => {
      userQueries.updateUserProfile(userIdA, {
        preferences: JSON.stringify({
          targetCredits: 20,
          preferredFreeDays: ['Friday'],
          earliestStartTime: '09:00',
          latestEndTime: '18:00',
          maxBackToBackHours: 4,
          breaks: [{ day: 'Monday', startTime: '12:00', endTime: '13:00', label: 'Lunch' }],
        }),
      });

      const context = ContextService.assembleContext(userIdA);
      expect(context.student.userId).toBe(userIdA);
      expect(context.student.name).toBe(userA.name);
      expect(context.preferences.targetCredits).toBe(20);
      expect(context.preferences.preferredFreeDays).toEqual(['Friday']);
      expect(context.preferences.earliestStartTime).toBe('09:00');
      expect(context.preferences.latestEndTime).toBe('18:00');
      expect(context.preferences.maxBackToBackHours).toBe(4);
      expect(context.preferences.breaksPreference.length).toBe(1);
      expect(context.currentSchedule).toBeDefined();
      expect(context.currentSchedule.length).toBeGreaterThan(0);
    });
  });

  describe('Candidate Generation & Greedy Oracle Calendar Persistence (Ticket 04)', () => {
    it('POST /api/agent/chat should return proposedCourses, preview, and persist user_calendar_events', async () => {
      // Clear any prior calendar events for User A to test clean persistence
      calendarQueries.deleteUserCalendarEvents(userIdA);

      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt: 'I want CSE 130 on my schedule for Winter 2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.userMessage).toBeDefined();
      expect(data.agentMessage).toBeDefined();
      expect(data.preview).toBeDefined();
      expect(data.preview.term).toBe('Winter 2027');
      expect(data.preview.events.length).toBeGreaterThan(0);
      expect(data.preview.totalCredits).toBeGreaterThanOrEqual(15);
      expect(Array.isArray(data.proposedCourses)).toBe(true);
      expect(data.proposedCourses.length).toBeGreaterThanOrEqual(3);

      // Verify that greedy oracle eliminated time collisions in preview
      const scheduledCourses = data.preview.events.filter(
        (e: any) => e.type !== 'GOOGLE_CALENDAR_BUSY'
      );
      for (let i = 0; i < scheduledCourses.length; i++) {
        for (let j = i + 1; j < scheduledCourses.length; j++) {
          const a = scheduledCourses[i];
          const b = scheduledCourses[j];
          const commonDays = a.days.filter((d: string) => b.days.includes(d));
          if (commonDays.length > 0) {
            const [aSh, aSm] = a.startTime.split(':').map(Number);
            const [aEh, aEm] = a.endTime.split(':').map(Number);
            const [bSh, bSm] = b.startTime.split(':').map(Number);
            const [bEh, bEm] = b.endTime.split(':').map(Number);
            const aStart = aSh * 60 + aSm;
            const aEnd = aEh * 60 + aEm;
            const bStart = bSh * 60 + bSm;
            const bEnd = bEh * 60 + bEm;
            const overlap = aStart < bEnd && bStart < aEnd;
            expect(overlap).toBe(false);
          }
        }
      }

      // Verify persisted in SQLite user_calendar_events
      const persisted = calendarQueries.getUserCalendarEvents(userIdA, 'Winter 2027');
      expect(persisted.length).toBe(data.preview.events.length);
      const persistedIds = persisted.map((e) => e.id);
      for (const ev of data.preview.events) {
        expect(persistedIds).toContain(ev.id);
      }
    });

    it('GET /api/calendar/preview immediately returns the newly persisted schedule', async () => {
      const res = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.term).toBe('Winter 2027');
      expect(res.body.data.events.length).toBeGreaterThanOrEqual(3);

      // Verify events match SQLite persisted schedule
      const persisted = calendarQueries.getUserCalendarEvents(userIdA, 'Winter 2027');
      expect(res.body.data.events.length).toBe(persisted.length);
      const previewIds = res.body.data.events.map((e: any) => e.id);
      for (const ev of persisted) {
        expect(previewIds).toContain(ev.id);
      }
    });

    it('POST /api/agent/chat pins user-requested course overrides and saves pinned=1 in SQLite', async () => {
      const prompt = 'I really want CSE 130 instead of CSE 115A';
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const preview = res.body.data.preview;
      expect(preview).toBeDefined();

      // Verify CSE 130 is in preview events and marked as pinned
      const cse130 = preview.events.find(
        (e: any) => e.id.toLowerCase().includes('cse-130') || e.title.includes('CSE 130')
      );
      expect(cse130).toBeDefined();
      expect(cse130?.pinned).toBe(true);

      // Verify SQLite persisted pinned status
      const persisted = calendarQueries.getUserCalendarEvents(userIdA, 'Winter 2027');
      const persistedCse130 = persisted.find(
        (e) => e.id.toLowerCase().includes('cse-130') || e.title.includes('CSE 130')
      );
      expect(persistedCse130).toBeDefined();
      expect(persistedCse130?.pinned).toBe(true);
    });

    it('DELETE /api/agent/messages should delete both messages and persisted calendar events', async () => {
      // Verify User A has persisted events before delete
      const beforeEvents = calendarQueries.getUserCalendarEvents(userIdA);
      expect(beforeEvents.length).toBeGreaterThan(0);

      const res = await request(app)
        .delete('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify conversation messages deleted
      const msgRes = await request(app)
        .get('/api/agent/messages')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(msgRes.body.data.messages.length).toBe(0);

      // Verify SQLite user_calendar_events deleted
      const persisted = calendarQueries.getUserCalendarEvents(userIdA, 'Winter 2027');
      expect(persisted.length).toBe(0);

      // Verify subsequent GET /api/calendar/preview falls back to default seed schedule
      const previewRes = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userTokenA}`);
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.events.length).toBeGreaterThan(0);
      // Fallback seed courses are not pinned
      const hasPinned = previewRes.body.data.events.some((e: any) => e.pinned === true);
      expect(hasPinned).toBe(false);
    });

    it('maintains strict multi-tenant isolation for calendar persistence and deletion', async () => {
      // 1. User B requests courses
      const bChatRes = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenB}`)
        .send({ prompt: 'I really want CSE 130 instead of CSE 115A' });
      expect(bChatRes.status).toBe(200);

      const bEventsBefore = calendarQueries.getUserCalendarEvents(userIdB);
      expect(bEventsBefore.length).toBeGreaterThan(0);

      // 2. User A sets a custom schedule
      await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt: 'Recommend courses for Winter 2027' });

      // 3. User A clears their messages
      await request(app).delete('/api/agent/messages').set('Authorization', `Bearer ${userTokenA}`);

      // User A's events should be cleared
      expect(calendarQueries.getUserCalendarEvents(userIdA).length).toBe(0);

      // User B's events must remain intact
      const bEventsAfter = calendarQueries.getUserCalendarEvents(userIdB);
      expect(bEventsAfter.length).toBe(bEventsBefore.length);
      const bPreviewRes = await request(app)
        .get('/api/calendar/preview')
        .set('Authorization', `Bearer ${userTokenB}`);
      expect(bPreviewRes.body.data.events.some((e: any) => e.pinned === true)).toBe(true);
    });

    it('handles empty proposedCourses or offline fallback by returning standard preview without DB corruption', async () => {
      // Mock AgentService.queryAgent temporarily to simulate an agent reply without proposed courses
      const queryAgentSpy = vi.spyOn(AgentService, 'queryAgent').mockResolvedValueOnce({
        response: 'Here is general study advice without any courses.',
        toolCalls: [],
        metadata: { model: 'mock' },
        proposedCourses: [],
      });

      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${userTokenA}`)
        .send({ prompt: 'How do I study for midterms?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preview).toBeDefined();
      expect(res.body.data.preview.events.length).toBeGreaterThan(0);
      expect(res.body.data.proposedCourses).toEqual([]);

      queryAgentSpy.mockRestore();
    });
  });
});
