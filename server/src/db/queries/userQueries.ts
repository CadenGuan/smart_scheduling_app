import { db } from '../database.js';

export interface UserRow {
  user_id: string;
  email: string;
  password_hash: string | null;
  name: string;
  standing: string;
  major: string;
  minor: string | null;
  intended_major: string | null;
  ge_status: string | null;
  major_requirements_taken: string | null;
  breaks_preference: string | null;
  created_at: string;
  updated_at: string;
}

export const userQueries = {
  createUser: (user: {
    user_id: string;
    email: string;
    password_hash: string | null;
    name: string;
    standing: string;
    major: string;
    minor?: string | null;
    intended_major?: string | null;
  }): void => {
    const stmt = db.prepare(`
      INSERT INTO users (user_id, email, password_hash, name, standing, major, minor, intended_major)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.user_id,
      user.email.toLowerCase(),
      user.password_hash,
      user.name,
      user.standing,
      user.major,
      user.minor || null,
      user.intended_major || null
    );
  },

  findUserByEmail: (email: string): UserRow | undefined => {
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
    return stmt.get(email.toLowerCase()) as UserRow | undefined;
  },

  findUserById: (userId: string): UserRow | undefined => {
    const stmt = db.prepare(`SELECT * FROM users WHERE user_id = ?`);
    return stmt.get(userId) as UserRow | undefined;
  },

  updateUserProfile: (
    userId: string,
    updates: {
      standing?: string;
      major?: string;
      minor?: string | null;
      intended_major?: string | null;
      ge_status?: string;
      major_requirements_taken?: string;
      breaks_preference?: string;
    }
  ): void => {
    const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];

    if (updates.standing !== undefined) {
      fields.push('standing = ?');
      values.push(updates.standing);
    }
    if (updates.major !== undefined) {
      fields.push('major = ?');
      values.push(updates.major);
    }
    if (updates.minor !== undefined) {
      fields.push('minor = ?');
      values.push(updates.minor);
    }
    if (updates.intended_major !== undefined) {
      fields.push('intended_major = ?');
      values.push(updates.intended_major);
    }
    if (updates.ge_status !== undefined) {
      fields.push('ge_status = ?');
      values.push(updates.ge_status);
    }
    if (updates.major_requirements_taken !== undefined) {
      fields.push('major_requirements_taken = ?');
      values.push(updates.major_requirements_taken);
    }
    if (updates.breaks_preference !== undefined) {
      fields.push('breaks_preference = ?');
      values.push(updates.breaks_preference);
    }

    values.push(userId);
    const stmt = db.prepare(`
      UPDATE users
      SET ${fields.join(', ')}
      WHERE user_id = ?
    `);
    stmt.run(...values);
  },
};
