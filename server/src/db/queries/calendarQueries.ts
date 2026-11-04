import { CalendarEvent, CourseType, getCourseTypeColor } from 'shared';
import { db } from '../database.js';

export interface UserCalendarEventRow {
  event_id: string;
  user_id: string;
  course_id: string;
  title: string;
  type: string;
  days: string;
  start_time: string;
  end_time: string;
  credits: number;
  term: string;
  pinned: number;
  conflict_badges: string;
  created_at?: string;
}

export const calendarQueries = {
  saveUserCalendarEvents: (
    userId: string,
    term: string,
    events: CalendarEvent[],
    targetDb: any = db
  ): void => {
    targetDb.exec('BEGIN');
    try {
      const deleteStmt = targetDb.prepare(
        'DELETE FROM user_calendar_events WHERE user_id = ? AND term = ?'
      );
      deleteStmt.run(userId, term);

      if (events.length > 0) {
        const insertStmt = targetDb.prepare(`
          INSERT INTO user_calendar_events (
            event_id,
            user_id,
            course_id,
            title,
            type,
            days,
            start_time,
            end_time,
            credits,
            term,
            pinned,
            conflict_badges
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const event of events) {
          const eventId = event.id.startsWith(`${userId}_`)
            ? event.id
            : `${userId}_${term.replace(/\s+/g, '_')}_${event.id}`;
          const daysJson = JSON.stringify(event.days);
          const conflictBadgesJson = JSON.stringify(
            event.conflictBadges || (event.conflictBadge ? [event.conflictBadge] : [])
          );

          insertStmt.run(
            eventId,
            userId,
            event.id,
            event.title,
            event.type,
            daysJson,
            event.startTime,
            event.endTime,
            event.credits ?? 5,
            term,
            event.pinned ? 1 : 0,
            conflictBadgesJson
          );
        }
      }

      targetDb.exec('COMMIT');
    } catch (err) {
      targetDb.exec('ROLLBACK');
      throw err;
    }
  },

  getUserCalendarEvents: (userId: string, term?: string, targetDb: any = db): CalendarEvent[] => {
    let rows: UserCalendarEventRow[];
    if (term) {
      const stmt = targetDb.prepare(`
        SELECT * FROM user_calendar_events
        WHERE user_id = ? AND term = ?
        ORDER BY start_time ASC
      `);
      rows = stmt.all(userId, term) as UserCalendarEventRow[];
    } else {
      const stmt = targetDb.prepare(`
        SELECT * FROM user_calendar_events
        WHERE user_id = ?
        ORDER BY start_time ASC
      `);
      rows = stmt.all(userId) as UserCalendarEventRow[];
    }

    return rows.map((row) => {
      let days: any[] = [];
      try {
        days = JSON.parse(row.days);
      } catch {
        days = row.days.split(',').map((d: string) => d.trim());
      }

      let conflictBadges: any[] = [];
      if (row.conflict_badges) {
        try {
          conflictBadges = JSON.parse(row.conflict_badges);
        } catch {
          conflictBadges = [];
        }
      }

      return {
        id: row.course_id || row.event_id,
        title: row.title,
        type: row.type as CourseType,
        days,
        startTime: row.start_time,
        endTime: row.end_time,
        color: getCourseTypeColor(row.type),
        credits: row.credits ?? 5,
        term: row.term,
        pinned: Boolean(row.pinned),
        conflictBadges: conflictBadges.length > 0 ? conflictBadges : undefined,
        conflictBadge: conflictBadges.length > 0 ? conflictBadges[0] : undefined,
      };
    });
  },

  deleteUserCalendarEvents: (userId: string, term?: string, targetDb: any = db): void => {
    if (term) {
      const stmt = targetDb.prepare(`
        DELETE FROM user_calendar_events
        WHERE user_id = ? AND term = ?
      `);
      stmt.run(userId, term);
    } else {
      const stmt = targetDb.prepare(`
        DELETE FROM user_calendar_events
        WHERE user_id = ?
      `);
      stmt.run(userId);
    }
  },
};
