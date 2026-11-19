import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('User Schedule Routes (/api/user_schedule)', () => {
  let authTokenA = '';
  let userIdA = '';
  let authTokenB = '';
  let userIdB = '';

  beforeAll(async () => {
    // User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({
        email: `schedule-user-a-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'User A',
        standing: 'Junior',
        major: 'Computer Science B.S.',
      });
    authTokenA = resA.body.data.token;
    userIdA = resA.body.data.user.userId;

    // User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({
        email: `schedule-user-b-${Date.now()}@ucsc.edu`,
        password: 'Password123!',
        name: 'User B',
        standing: 'Senior',
        major: 'Computer Science B.S.',
      });
    authTokenB = resB.body.data.token;
    userIdB = resB.body.data.user.userId;
  });

  it('GET /api/user_schedule returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/user_schedule');
    expect(res.status).toBe(401);
  });

  it('GET /api/user_schedule returns 200 with empty list initially', async () => {
    const res = await request(app)
      .get('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/user_schedule creates a pending class event', async () => {
    const payload = {
      courseCode: 'CSE 30',
      title: 'Programming Abstractions in Python',
      description: 'Lecture 01 - MWF 10:00-11:05',
      days: 'M,W,F',
      startTime: '10:00',
      endTime: '11:05',
      startDate: '2027-01-04',
      endDate: '2027-03-19',
    };

    const res = await request(app)
      .post('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.userId).toBe(userIdA);
    expect(res.body.data.courseCode).toBe('CSE 30');
    expect(res.body.data.syncStatus).toBe('pending');
    expect(res.body.data.isImported).toBe(false);
  });

  it('PUT /api/user_schedule/:id updates event and resets sync_status to pending', async () => {
    // Insert event
    const postRes = await request(app)
      .post('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`)
      .send({
        courseCode: 'CSE 12',
        title: 'Computer Systems and Assembly Language',
        days: 'Tu,Th',
        startTime: '13:30',
        endTime: '15:05',
      });
    const eventId = postRes.body.data.id;

    // Update event
    const putRes = await request(app)
      .put(`/api/user_schedule/${eventId}`)
      .set('Authorization', `Bearer ${authTokenA}`)
      .send({
        title: 'Computer Systems (Updated)',
        startTime: '14:00',
        endTime: '15:35',
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.success).toBe(true);
    expect(putRes.body.data.title).toBe('Computer Systems (Updated)');
    expect(putRes.body.data.startTime).toBe('14:00');
    expect(putRes.body.data.syncStatus).toBe('pending');
  });

  it('DELETE /api/user_schedule/:id removes event', async () => {
    const postRes = await request(app)
      .post('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`)
      .send({
        courseCode: 'CSE 13S',
        title: 'Computer Systems and C Programming',
        days: 'M,W,F',
        startTime: '09:00',
        endTime: '10:05',
      });
    const eventId = postRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/user_schedule/${eventId}`)
      .set('Authorization', `Bearer ${authTokenA}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify it is gone
    const getRes = await request(app)
      .get('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`);

    const found = getRes.body.data.find((e: any) => e.id === eventId);
    expect(found).toBeUndefined();
  });

  it('Enforces multi-user isolation (User B cannot update/delete User A event)', async () => {
    const postRes = await request(app)
      .post('/api/user_schedule')
      .set('Authorization', `Bearer ${authTokenA}`)
      .send({
        courseCode: 'CSE 101',
        title: 'Introduction to Data Structures and Algorithms',
        days: 'M,W,F',
        startTime: '11:15',
        endTime: '12:20',
      });
    const eventId = postRes.body.data.id;

    // User B tries to update
    const putRes = await request(app)
      .put(`/api/user_schedule/${eventId}`)
      .set('Authorization', `Bearer ${authTokenB}`)
      .send({ title: 'Hacked Title' });

    expect(putRes.status).toBe(404);

    // User B tries to delete
    const delRes = await request(app)
      .delete(`/api/user_schedule/${eventId}`)
      .set('Authorization', `Bearer ${authTokenB}`);

    expect(delRes.status).toBe(404);
  });
});
