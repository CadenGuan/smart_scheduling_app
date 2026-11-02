import { apiClient } from './apiClient';
import { UserProfile, UserPreferences } from 'shared';

export class UserService {
  static async getProfile(userId: string): Promise<
    UserProfile & {
      preferences: UserPreferences;
      geStatus: any;
      majorRequirementsTaken: string[];
    }
  > {
    const res = await apiClient.get<{ success: boolean; data: any }>(`/api/users/${userId}`);
    return res.data;
  }

  static async updateProfile(
    userId: string,
    updates: Partial<UserProfile & { preferences: Partial<UserPreferences> }>
  ): Promise<UserProfile> {
    const res = await apiClient.put<{ success: boolean; data: UserProfile }>(
      `/api/users/${userId}`,
      updates
    );
    return res.data;
  }

  static async getPreferences(userId: string): Promise<UserPreferences> {
    const res = await apiClient.get<{ success: boolean; data: UserPreferences }>(
      `/api/users/${userId}/preferences`
    );
    return res.data;
  }

  static async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const res = await apiClient.put<{ success: boolean; data: UserPreferences }>(
      `/api/users/${userId}/preferences`,
      preferences
    );
    return res.data;
  }
}
