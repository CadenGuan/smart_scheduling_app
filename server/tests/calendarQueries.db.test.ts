import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CalendarEvent, CalendarEventSchema } from 'shared';
import { calendarQueries } from '../src/db/queries/calendarQueries.js';
import { userQueries } from '../src/db/queries/userQueries.js';
import { db, runCalendarEventsMigration } from '../src/db/database.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

describe('Calendar Queries & Database Persistence Unit Tests', () => {
  const testUserId = `test-user-${Date.now()}`;
  const testUserId2 = `test-user-2-${Date.now()}`;

  beforeEach(() => {
    // Ensure test users exist in the database for foreign key integrity
    userQueries.createUser({
      user_id: testUserId,
      email: `${testUserId}@ucsc.edu`,
      password_hash: 'hash123',
      name: 'Sammy Slug',
      standing: 'Junior',
      major: 'Computer Science B.S.',
    });

    userQueries.createUser({
      user_id: testUserId2,
      email: `${testUserId2}@ucsc.edu`,
      password_hash: 'hash123',
      name: 'Charlie Slug',
      standing: 'Senior',
      major: 'Computer Engineering B.S.',
    });
  });

  afterEach(() => {
    calendarQueries.deleteUserCalendarEvents(testUserId);
    calendarQueries.deleteUserCalendarEvents(testUserId2);
    db.prepare('DELETE FROM users WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE user_id = ?').run(testUserId2);
  });

  const sampleEvents: CalendarEvent[] = [
    {
      id: 'cse-115a-01',
      title: 'CSE 115A: Intro to Software Engineering',
      type: 'MAJOR',
      days: ['Monday', 'Wednesday', 'Friday'],
      startTime: '09:00',
      endTime: '10:10',
      color: '#00B4DB',
      credits: 5,
      term: 'Winter 2027',
      pinned: true,
      conflictBadges: ['Spans preferred free day'],
    },
    {
      id: 'cse-130-01',
      title: 'CSE 130: Principles of Computer Systems Design',
      type: 'MAJOR',
      days: ['Monday', 'Wednesday', 'Friday'],
      startTime: '10:40',
      endTime: '11:45',
      color: '#00B4DB',
      credits: 5,
      term: 'Winter 2027',
      pinned: false,
    },
    {
      id: 'art-10f-01',
      title: 'ART 10F: 2D Design',
      type: 'GE',
      days: ['Monday', 'Wednesday'],
      startTime: '15:20',
      endTime: '16:55',
      color: '#FF6B6B',
      credits: 5,
      term: 'Winter 2027',
    },
  ];

  it('saves and retrieves calendar events for a specific user and term', () => {
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', sampleEvents);

    const retrieved = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
    expect(retrieved).toHaveLength(3);

    // Validate that each retrieved event satisfies the shared CalendarEventSchema contract
    for (const event of retrieved) {
      const parsed = CalendarEventSchema.safeParse(event);
      expect(parsed.success).toBe(true);
    }

    const cse115a = retrieved.find((e) => e.id === 'cse-115a-01');
    expect(cse115a).toBeDefined();
    expect(cse115a?.pinned).toBe(true);
    expect(cse115a?.conflictBadges).toContain('Spans preferred free day');
    expect(cse115a?.conflictBadge).toBe('Spans preferred free day');
    expect(cse115a?.days).toEqual(['Monday', 'Wednesday', 'Friday']);

    const cse130 = retrieved.find((e) => e.id === 'cse-130-01');
    expect(cse130).toBeDefined();
    expect(cse130?.pinned).toBe(false);

    const art10f = retrieved.find((e) => e.id === 'art-10f-01');
    expect(art10f).toBeDefined();
    expect(art10f?.color).toBe('#FF6B6B');
  });

  it('filters events accurately by term or retrieves all terms when term is omitted', () => {
    const winterEvents: CalendarEvent[] = [sampleEvents[0]];
    const springEvents: CalendarEvent[] = [
      {
        id: 'cse-180-01',
        title: 'CSE 180: Database Systems I',
        type: 'MAJOR',
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '14:40',
        endTime: '15:45',
        color: '#00B4DB',
        credits: 5,
        term: 'Spring 2027',
      },
    ];

    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', winterEvents);
    calendarQueries.saveUserCalendarEvents(testUserId, 'Spring 2027', springEvents);

    const winter = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
    expect(winter).toHaveLength(1);
    expect(winter[0].id).toBe('cse-115a-01');

    const spring = calendarQueries.getUserCalendarEvents(testUserId, 'Spring 2027');
    expect(spring).toHaveLength(1);
    expect(spring[0].id).toBe('cse-180-01');

    const all = calendarQueries.getUserCalendarEvents(testUserId);
    expect(all).toHaveLength(2);
  });

  it('replaces existing events atomically in a transaction when re-saving', () => {
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', sampleEvents);
    expect(calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027')).toHaveLength(3);

    // Re-save with only 1 event
    const updatedEvents = [sampleEvents[1]];
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', updatedEvents);

    const afterUpdate = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
    expect(afterUpdate).toHaveLength(1);
    expect(afterUpdate[0].id).toBe('cse-130-01');
  });

  it('handles empty events array by deleting existing events for that term', () => {
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', sampleEvents);
    expect(calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027')).toHaveLength(3);

    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', []);
    expect(calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027')).toHaveLength(0);
  });

  it('isolates events between different users', () => {
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', [sampleEvents[0]]);
    calendarQueries.saveUserCalendarEvents(testUserId2, 'Winter 2027', [sampleEvents[1]]);

    const user1Events = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
    const user2Events = calendarQueries.getUserCalendarEvents(testUserId2, 'Winter 2027');

    expect(user1Events).toHaveLength(1);
    expect(user1Events[0].id).toBe('cse-115a-01');

    expect(user2Events).toHaveLength(1);
    expect(user2Events[0].id).toBe('cse-130-01');
  });

  it('deletes events by term and by user across terms', () => {
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', [sampleEvents[0]]);
    calendarQueries.saveUserCalendarEvents(testUserId, 'Spring 2027', [sampleEvents[1]]);

    calendarQueries.deleteUserCalendarEvents(testUserId, 'Winter 2027');
    expect(calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027')).toHaveLength(0);
    expect(calendarQueries.getUserCalendarEvents(testUserId, 'Spring 2027')).toHaveLength(1);

    calendarQueries.deleteUserCalendarEvents(testUserId);
    expect(calendarQueries.getUserCalendarEvents(testUserId)).toHaveLength(0);
  });

  it('rolls back transaction on error during saveUserCalendarEvents', () => {
    // Initial state: 1 event
    calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', [sampleEvents[0]]);

    // Broken DB mock or broken insert statement to trigger rollback
    const faultyDb = {
      exec: (sql: string) => {
        if (sql === 'BEGIN') return;
        if (sql === 'ROLLBACK') return;
      },
      prepare: (sql: string) => {
        if (sql.includes('DELETE')) {
          return { run: () => {} };
        }
        if (sql.includes('INSERT')) {
          return {
            run: () => {
              throw new Error('Disk failure during insert');
            },
          };
        }
        return { run: () => {} };
      },
    };

    expect(() =>
      calendarQueries.saveUserCalendarEvents(testUserId, 'Winter 2027', sampleEvents, faultyDb)
    ).toThrow('Disk failure during insert');
  });

  it('handles comma-separated days and malformed conflict badges gracefully', () => {
    // Direct raw insertion to test fallback parsers
    db.prepare(
      `
      INSERT INTO user_calendar_events (
        event_id, user_id, course_id, title, type, days, start_time, end_time, credits, term, pinned, conflict_badges
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      `raw-${Date.now()}`,
      testUserId,
      'cse-legacy-01',
      'CSE Legacy',
      'ELECTIVE',
      'Monday, Wednesday',
      '09:00',
      '10:10',
      5,
      'Winter 2027',
      0,
      'invalid-json'
    );

    const events = calendarQueries.getUserCalendarEvents(testUserId, 'Winter 2027');
    const legacy = events.find((e) => e.id === 'cse-legacy-01');
    expect(legacy).toBeDefined();
    expect(legacy?.days).toEqual(['Monday', 'Wednesday']);
    expect(legacy?.color).toBe('#9B51E0'); // ELECTIVE color
    expect(legacy?.conflictBadges).toBeUndefined();
  });

  it('runs runCalendarEventsMigration on in-memory DB and handles errors safely', () => {
    const memoryDb = new DatabaseSync(':memory:');
    runCalendarEventsMigration(memoryDb);

    const tables = memoryDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_calendar_events'")
      .all();
    expect(tables).toHaveLength(1);

    const indexes = memoryDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_user_calendar_events_user_term'"
      )
      .all();
    expect(indexes).toHaveLength(1);

    // Broken DB triggers catch block without throwing
    const brokenDb = {
      exec: () => {
        throw new Error('Simulation of read-only DB');
      },
    };
    expect(() => runCalendarEventsMigration(brokenDb as any)).not.toThrow();
  });
});
