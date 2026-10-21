import { progressQueries } from '../db/queries/progressQueries.js';
import { userQueries } from '../db/queries/userQueries.js';
import { OnboardingProgressPayload } from 'shared';

export class ProgressService {
  static getProgress(userId: string) {
    const row = progressQueries.getProgress(userId);
    if (!row) {
      return {
        userId,
        completed: false,
        lastStep: 1,
        skippedSteps: [],
        draftAnswers: {},
      };
    }

    return {
      userId: row.user_id,
      completed: row.completed === 1,
      lastStep: row.last_step,
      skippedSteps: JSON.parse(row.skipped_steps || '[]'),
      draftAnswers: JSON.parse(row.draft_answers || '{}'),
      updatedAt: row.updated_at,
    };
  }

  static saveProgress(userId: string, payload: OnboardingProgressPayload) {
    progressQueries.upsertProgress({
      user_id: userId,
      completed: payload.completed ? 1 : 0,
      last_step: payload.lastStep,
      skipped_steps: JSON.stringify(payload.skippedSteps || []),
      draft_answers: JSON.stringify(payload.draftAnswers || {}),
    });

    // If profile fields are present in draft answers, sync them to users table
    const answers = payload.draftAnswers;
    if (answers) {
      userQueries.updateUserProfile(userId, {
        standing: answers.standing,
        major: answers.major,
        minor: answers.minor,
        intended_major: answers.intendedMajor,
        ge_status: answers.geSource ? JSON.stringify({ source: answers.geSource, remaining: answers.geCategoriesRemaining || [] }) : undefined,
        major_requirements_taken: answers.majorRequirementsTaken ? JSON.stringify(answers.majorRequirementsTaken) : undefined,
        breaks_preference: answers.scheduledBreaks ? JSON.stringify(answers.scheduledBreaks) : undefined,
      });
    }

    return this.getProgress(userId);
  }
}

