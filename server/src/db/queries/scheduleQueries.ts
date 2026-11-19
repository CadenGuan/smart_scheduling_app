import { v4 as uuidv4 } from 'uuid';
import { db } from '../database.js';
import {
  UserScheduleItem,
  SyncStatus,
  CreateScheduleEventDTO,
  UpdateScheduleEventDTO,
} from 'shared';

function mapRow(row: any): UserScheduleItem {
  return {
    id: row.id,
    userId: row.user_id,
    courseCode: row.course_code,
    title: row.title,
    description: row.description || '',
    days: row.days,
    startTime: row.start_time,
    endTime: row.end_time,
    startDate: row.start_date,
    endDate: row.end_date,
    isImported: Boolean(row.is_imported),
    syncStatus: row.sync_status as SyncStatus,
    googleEventId: row.google_event_id || null,
    createdAt: row.created_at,
  };
}

export const scheduleQueries = {
  getScheduleByUserId(userId: string): UserScheduleItem[] {
    const stmt = db.prepare(`
      SELECT id, user_id, course_code, title, description, days, start_time, end_time, start_date, end_date, is_imported, sync_status, google_event_id, created_at
      FROM user_schedule
      WHERE user_id = ?
      ORDER BY start_time ASC
    `);
    const rows = stmt.all(userId) as any[];
    return rows.map(mapRow);
  },

  getScheduleEventById(id: string, userId?: string): UserScheduleItem | null {
    let stmt;
    let row;
    if (userId) {
      stmt = db.prepare(`
        SELECT id, user_id, course_code, title, description, days, start_time, end_time, start_date, end_date, is_imported, sync_status, google_event_id, created_at
        FROM user_schedule
        WHERE id = ? AND user_id = ?
      `);
      row = stmt.get(id, userId);
    } else {
      stmt = db.prepare(`
        SELECT id, user_id, course_code, title, description, days, start_time, end_time, start_date, end_date, is_imported, sync_status, google_event_id, created_at
        FROM user_schedule
        WHERE id = ?
      `);
      row = stmt.get(id);
    }
    return row ? mapRow(row) : null;
  },

  createScheduleEvent(userId: string, data: CreateScheduleEventDTO): UserScheduleItem {
    const id = uuidv4();
    const isImported = data.isImported ? 1 : 0;
    const syncStatus: SyncStatus = 'pending';
    const startDate = data.startDate || '2027-01-04';
    const endDate = data.endDate || '2027-03-19';

    const stmt = db.prepare(`
      INSERT INTO user_schedule (
        id, user_id, course_code, title, description, days, start_time, end_time, start_date, end_date, is_imported, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      data.courseCode.trim(),
      data.title.trim(),
      data.description?.trim() || '',
      data.days.trim(),
      data.startTime.trim(),
      data.endTime.trim(),
      startDate,
      endDate,
      isImported,
      syncStatus
    );

    return this.getScheduleEventById(id)!;
  },

  updateScheduleEvent(
    id: string,
    userId: string,
    data: UpdateScheduleEventDTO
  ): UserScheduleItem | null {
    const existing = this.getScheduleEventById(id, userId);
    if (!existing) return null;

    const title = data.title ?? existing.title;
    const description = data.description ?? existing.description;
    const days = data.days ?? existing.days;
    const startTime = data.startTime ?? existing.startTime;
    const endTime = data.endTime ?? existing.endTime;
    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate ?? existing.endDate;

    const stmt = db.prepare(`
      UPDATE user_schedule
      SET title = ?, description = ?, days = ?, start_time = ?, end_time = ?, start_date = ?, end_date = ?, sync_status = 'pending'
      WHERE id = ? AND user_id = ?
    `);

    stmt.run(title, description, days, startTime, endTime, startDate, endDate, id, userId);
    return this.getScheduleEventById(id, userId);
  },

  deleteScheduleEvent(id: string, userId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM user_schedule
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(id, userId);
    return (result as any).changes > 0;
  },

  deleteScheduleEventByCourseCode(courseCode: string, userId: string): boolean {
    const stmt = db.prepare(`
      DELETE FROM user_schedule
      WHERE UPPER(course_code) = UPPER(?) AND user_id = ?
    `);
    const result = stmt.run(courseCode.trim(), userId);
    return (result as any).changes > 0;
  },

  getPendingEvents(userId: string): UserScheduleItem[] {
    const stmt = db.prepare(`
      SELECT id, user_id, course_code, title, description, days, start_time, end_time, start_date, end_date, is_imported, sync_status, google_event_id, created_at
      FROM user_schedule
      WHERE user_id = ? AND sync_status = 'pending' AND is_imported = 0
      ORDER BY start_time ASC
    `);
    const rows = stmt.all(userId) as any[];
    return rows.map(mapRow);
  },

  updateSyncStatus(id: string, status: SyncStatus, googleEventId?: string | null): void {
    if (googleEventId !== undefined) {
      const stmt = db.prepare(`
        UPDATE user_schedule
        SET sync_status = ?, google_event_id = ?
        WHERE id = ?
      `);
      stmt.run(status, googleEventId, id);
    } else {
      const stmt = db.prepare(`
        UPDATE user_schedule
        SET sync_status = ?
        WHERE id = ?
      `);
      stmt.run(status, id);
    }
  },
};
