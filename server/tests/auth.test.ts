import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('Auth API Contract Tests', () => {
  const testUser = {
    email: `test-${Date.now()}@ucsc.edu`,
    password: 'Password123!',
    name: 'Test Slug',
    standing: 'Junior',
    major: 'Computer Science B.S.',
  };

  let authToken = '';
  let userId = '';

  it('POST /api/auth/register should create a new account and return signed JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testUser.email.toLowerCase());

    authToken = res.body.data.token;
    userId = res.body.data.user.userId;
  });

  it('POST /api/auth/register should reject duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('POST /api/auth/login should authenticate with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.userId).toBe(userId);
  });

  it('POST /api/auth/login should reject invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/google should authenticate in dev mock mode', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({
        idToken: `google-mock-${Date.now()}@ucsc.edu`,
        isMock: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.googleCalendarLinked).toBe(true);
  });

  it('GET /api/users/:id should reject requests without Bearer token with 401', async () => {
    const res = await request(app).get(`/api/users/${userId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/users/:id should return profile when provided valid Bearer token', async () => {
    const res = await request(app)
      .get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(userId);
    expect(res.body.data.standing).toBe('Junior');
  });
});

