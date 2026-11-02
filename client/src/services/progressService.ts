import { apiClient } from './apiClient';
import { OnboardingProgressPayload } from 'shared';

export class ProgressService {
  static async getProgress(userId: string): Promise<{
    userId: string;
    completed: boolean;
    lastStep: number;
    skippedSteps: number[];
    draftAnswers: any;
  }> {
    const res = await apiClient.get<{ success: boolean; data: any }>(
      `/api/users/${userId}/progress`
    );
    return res.data;
  }

  static async saveProgress(userId: string, payload: OnboardingProgressPayload): Promise<any> {
    const res = await apiClient.put<{ success: boolean; data: any }>(
      `/api/users/${userId}/progress`,
      payload
    );
    return res.data;
  }
}
