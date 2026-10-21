import { db } from '../database.js';

export interface OnboardingProgressRow {
  user_id: string;
  completed: number;
  last_step: number;
  skipped_steps: string;
  draft_answers: string;
  updated_at: string;
}

export const progressQueries = {
  getProgress: (userId: string): OnboardingProgressRow | undefined => {
    const stmt = db.prepare(`SELECT * FROM onboarding_progress WHERE user_id = ?`);
    return stmt.get(userId) as OnboardingProgressRow | undefined;
  },

  upsertProgress: (data: {
    user_id: string;
    completed: number;
    last_step: number;
    skipped_steps: string;
    draft_answers: string;
  }): void => {
    const stmt = db.prepare(`
      INSERT INTO onboarding_progress (user_id, completed, last_step, skipped_steps, draft_answers, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        completed = excluded.completed,
        last_step = excluded.last_step,
        skipped_steps = excluded.skipped_steps,
        draft_answers = excluded.draft_answers,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(data.user_id, data.completed, data.last_step, data.skipped_steps, data.draft_answers);
  },

  completeOnboarding: (userId: string): void => {
    const stmt = db.prepare(`
      UPDATE onboarding_progress
      SET completed = 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `);
    stmt.run(userId);
  },
};
