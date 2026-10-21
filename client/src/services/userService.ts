import { apiClient } from './apiClient';
import { UserProfile } from 'shared';

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

