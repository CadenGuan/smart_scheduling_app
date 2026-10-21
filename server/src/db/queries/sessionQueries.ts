import { db } from '../database.js';

export interface SessionRow {
  session_id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export const sessionQueries = {
  createSession: (session: {
    session_id: string;
    user_id: string;
    token: string;
    expires_at: string;
  }): void => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (session_id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(session.session_id, session.user_id, session.token, session.expires_at);
  },

  findSessionByToken: (token: string): SessionRow | undefined => {
    const stmt = db.prepare(`
      SELECT * FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP
    `);
    return stmt.get(token) as SessionRow | undefined;
  },

  deleteSession: (token: string): void => {
    const stmt = db.prepare(`DELETE FROM sessions WHERE token = ?`);
    stmt.run(token);
  },

  deleteUserSessions: (userId: string): void => {
    const stmt = db.prepare(`DELETE FROM sessions WHERE user_id = ?`);
    stmt.run(userId);
  },
};
