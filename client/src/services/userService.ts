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

  static async exportSettings(userId: string): Promise<any> {
    const res = await apiClient.get<{ success: boolean; data: any }>(`/api/users/${userId}/export`);
    return res.data;
  }

  static async importSettings(userId: string, payload: any): Promise<any> {
    const res = await apiClient.post<{ success: boolean; data: any }>(
      `/api/users/${userId}/import`,
      payload
    );
    return res.data;
  }

  static downloadJson(data: any, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
