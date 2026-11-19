import { apiClient } from './apiClient';
import { UserScheduleItem, UserSettings } from 'shared';

export class ScheduleService {
  /**
   * Fetches user synchronization and Google connection settings.
   */
  static async fetchSettings(): Promise<UserSettings | null> {
    try {
      const res = await apiClient.get<{ success: boolean; data: UserSettings }>(
        '/api/sync/settings'
      );
      return res.data;
    } catch {
      return null;
    }
  }

  /**
   * Fetches the student's scheduled class events from the local database.
   */
  static async fetchSchedule(): Promise<UserScheduleItem[]> {
    const res = await apiClient.get<{ success: boolean; data: UserScheduleItem[] }>(
      '/api/user_schedule'
    );
    return res.data || [];
  }

  /**
   * Deletes a scheduled course event by ID.
   */
  static async deleteScheduleEvent(id: string): Promise<void> {
    await apiClient.request<{ success: boolean; data: any }>(`/api/user_schedule/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Triggers manual synchronization with Google Calendar.
   */
  static async triggerSync(): Promise<{
    syncedCount: number;
    failedCount: number;
    pendingCount: number;
    message: string;
  }> {
    const res = await apiClient.request<{
      success: boolean;
      data: { syncedCount: number; failedCount: number; pendingCount: number; message: string };
    }>('/api/sync/run', {
      method: 'POST',
    });
    return res.data;
  }
}
