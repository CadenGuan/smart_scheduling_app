import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { conversationQueries } from '../src/db/queries/conversationQueries.js';

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
      const res = await request(app)
        .post('/api/agent/chat')
        .send({ prompt: 'Hello agent' });

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
      expect(new Date(first.createdAt).getTime()).toBeLessThanOrEqual(new Date(second.createdAt).getTime());
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
});
