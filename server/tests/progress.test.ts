import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Progress & Calendar API Tests', () => {
  let authToken = '';
  let userId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `progress-test-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'Progress Slug',
        standing: 'Senior',
        major: 'Computer Science B.S.',
      });

    authToken = res.body.data.token;
    userId = res.body.data.user.userId;
  });

  it('GET /api/users/:id/progress should fetch initial onboarding state', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}/progress`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed).toBe(false);
    expect(res.body.data.lastStep).toBe(1);
  });

  it('PUT /api/users/:id/progress should persist step progress, skip arrays, and draft answers', async () => {
    const updatePayload = {
      lastStep: 3,
      skippedSteps: [2],
      draftAnswers: {
        standing: 'Senior',
        major: 'Computer Science B.S.',
        geSource: 'UCSC',
        geCategoriesRemaining: ['CC', 'ER'],
        targetTerm: 'Winter 2027',
        targetCredits: 15,
      },
      completed: false,
    };

    const res = await request(app)
      .put(`/api/users/${userId}/progress`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lastStep).toBe(3);
    expect(res.body.data.skippedSteps).toContain(2);
  });

  it('GET /api/calendar/preview should return seeded UCSC courses with Triadic colors', async () => {
    const res = await request(app)
      .get('/api/calendar/preview')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.term).toBe('Winter 2027');
    expect(res.body.data.events.length).toBeGreaterThanOrEqual(4);

    const cse115a = res.body.data.events.find((e: any) => e.id === 'cse-115a-lec');
    expect(cse115a).toBeDefined();
    expect(cse115a.color).toBe('#00B4DB'); // Triadic Teal

    const art10f = res.body.data.events.find((e: any) => e.id === 'art-10f-lec');
    expect(art10f).toBeDefined();
    expect(art10f.color).toBe('#FF6B6B'); // Triadic Magenta

    const workShift = res.body.data.events.find((e: any) => e.id === 'gcal-work-shift');
    expect(workShift).toBeDefined();
    expect(workShift.color).toBe('#F9CA24'); // Triadic Yellow
  });
});

