import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { IcsService } from '../src/services/ics.service.js';
import { sampleCalendarEvents } from '../src/db/seed.js';

describe('RFC 5545 iCalendar (.ics) Service & Export Suite', () => {
  let userToken = '';

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: `ics-test-${Date.now()}@ucsc.edu`,
      password: 'Password123!',
      name: 'ICS Tester',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    });
    userToken = res.body.data.token;
  });

  describe('IcsService.generateCalendar', () => {
    it('produces valid RFC 5545 format with VCALENDAR wrapper and version 2.0', () => {
      const ics = IcsService.generateCalendar(sampleCalendarEvents, 'Winter 2027');

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//UCSC Smart Scheduler//SlugSchedule 1.0//EN');
      expect(ics).toContain('CALSCALE:GREGORIAN');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('generates weekly recurrence RRULE and BYDAY tokens for courses', () => {
      const ics = IcsService.generateCalendar(sampleCalendarEvents, 'Winter 2027');

      expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20270319T235959Z');
      expect(ics).toContain('BYDAY=');
    });

    it('attaches 15-minute VALARM alerts to class meetings', () => {
      const ics = IcsService.generateCalendar(sampleCalendarEvents, 'Winter 2027');

      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('ACTION:DISPLAY');
      expect(ics).toContain('TRIGGER:-PT15M');
      expect(ics).toContain('END:VALARM');
    });

    it('includes quarter deadlines with 1-day advance warning alarms', () => {
      const ics = IcsService.generateCalendar(sampleCalendarEvents, 'Winter 2027');

      expect(ics).toContain('UCSC Add/Drop/Swap Deadline (Winter 2027)');
      expect(ics).toContain('UCSC Final Examinations Week (Winter 2027)');
      expect(ics).toContain('TRIGGER:-P1D');
    });
  });

  describe('GET /api/calendar/export endpoint', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/calendar/export');
      expect(res.status).toBe(401);
    });

    it('returns 200 with text/calendar content type and attachment header', async () => {
      const res = await request(app)
        .get('/api/calendar/export')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['content-disposition']).toContain('attachment; filename="slug-schedule-winter-2027.ics"');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('BEGIN:VEVENT');
      expect(res.text).toContain('END:VCALENDAR');
    });
  });
});
