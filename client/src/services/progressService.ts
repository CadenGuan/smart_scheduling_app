import { apiClient } from './apiClient';
import { UserProfile, OnboardingProgressPayload } from 'shared';

export class UserService {
  static async getProfile(userId: string): Promise<UserProfile & { preferences: any; geStatus: any; majorRequirementsTaken: string[] }> {
    const res = await apiClient.get<{ success: boolean; data: any }>(`/api/users/${userId}`);
    return res.data;
  }

  static async updateProfile(userId: string, updates: Partial<UserProfile & { preferences: any }>): Promise<UserProfile> {
    const res = await apiClient.put<{ success: boolean; data: UserProfile }>(`/api/users/${userId}`, updates);
    return res.data;
  }
}

export class ProgressService {
  static async getProgress(userId: string): Promise<{
    userId: string;
    completed: boolean;
    lastStep: number;
    skippedSteps: number[];
    draftAnswers: any;
  }> {
    const res = await apiClient.get<{ success: boolean; data: any }>(`/api/users/${userId}/progress`);
    return res.data;
  }

  static async saveProgress(userId: string, payload: OnboardingProgressPayload): Promise<any> {
    const res = await apiClient.put<{ success: boolean; data: any }>(`/api/users/${userId}/progress`, payload);
    return res.data;
  }
}

