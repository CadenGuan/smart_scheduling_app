import { scheduleQueries } from '../db/queries/scheduleQueries.js';
import { settingsQueries } from '../db/queries/settingsQueries.js';
import { db } from '../db/database.js';
import { config } from '../config.js';

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
  pendingCount: number;
  message: string;
}

export class SyncEngineService {
  /**
   * Refreshes the Google OAuth access token using stored refresh_token.
   */
  static async refreshGoogleToken(userId: string): Promise<string | null> {
    const tokenRow = db
      .prepare('SELECT refresh_token FROM oauth_tokens WHERE user_id = ?')
      .get(userId) as any;
    if (!tokenRow?.refresh_token) {
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.GOOGLE_CLIENT_ID,
          client_secret: config.GOOGLE_CLIENT_SECRET,
          refresh_token: tokenRow.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data: any = await response.json();
      const newAccessToken = data.access_token;
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

      db.prepare(
        `
        UPDATE oauth_tokens
        SET access_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `
      ).run(newAccessToken, expiresAt, userId);

      return newAccessToken;
    } catch (err) {
      console.error('[SyncEngine] Token refresh failed:', err);
      return null;
    }
  }

  /**
   * Pushes a single schedule event to Google Calendar via Django agent service.
   */
  static async pushEventToDjango(
    event: any,
    googleToken: string
  ): Promise<{ success: boolean; googleEventId?: string; status?: number }> {
    const djangoUrl = `${config.DJANGO_AGENT_URL || 'http://localhost:8000'}/api/sync/push/`;
    try {
      const response = await fetch(djangoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleToken,
          event,
        }),
      });

      if (response.status === 401) {
        return { success: false, status: 401 };
      }

      if (!response.ok) {
        return { success: false, status: response.status };
      }

      const data: any = await response.json();
      return { success: true, googleEventId: data.data?.googleEventId };
    } catch (err) {
      return { success: false, status: 500 };
    }
  }

  /**
   * Runs the sync engine for a specific student.
   */
  static async syncUserSchedule(userId: string): Promise<SyncResult> {
    const settings = settingsQueries.getUserSettings(userId);
    if (!settings.syncEnabled || !settings.isConnectedToGoogle) {
      return {
        syncedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        message: 'Sync is paused or Google Calendar is not connected.',
      };
    }

    const pendingEvents = scheduleQueries.getPendingEvents(userId);
    if (pendingEvents.length === 0) {
      return {
        syncedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        message: 'All schedule events are up to date.',
      };
    }

    let tokenRow = db
      .prepare('SELECT access_token, expires_at FROM oauth_tokens WHERE user_id = ?')
      .get(userId) as any;
    if (!tokenRow?.access_token) {
      // Mark failed
      for (const ev of pendingEvents) {
        scheduleQueries.updateSyncStatus(ev.id, 'failed');
      }
      return {
        syncedCount: 0,
        failedCount: pendingEvents.length,
        pendingCount: 0,
        message: 'No Google OAuth token available.',
      };
    }

    let accessToken = tokenRow.access_token;
    let synced = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      let pushResult = await this.pushEventToDjango(event, accessToken);

      // Handle 401 by attempting token refresh
      if (!pushResult.success && pushResult.status === 401) {
        const refreshedToken = await this.refreshGoogleToken(userId);
        if (refreshedToken) {
          accessToken = refreshedToken;
          pushResult = await this.pushEventToDjango(event, accessToken);
        }
      }

      if (pushResult.success && pushResult.googleEventId) {
        scheduleQueries.updateSyncStatus(event.id, 'synced', pushResult.googleEventId);
        synced++;
      } else {
        scheduleQueries.updateSyncStatus(event.id, 'failed');
        failed++;
      }
    }

    return {
      syncedCount: synced,
      failedCount: failed,
      pendingCount: 0,
      message: `Sync complete: ${synced} synced, ${failed} failed.`,
    };
  }

  /**
   * Non-blocking background sync trigger.
   */
  static triggerBackgroundSync(userId: string): void {
    const settings = settingsQueries.getUserSettings(userId);
    if (settings.syncEnabled && settings.isConnectedToGoogle) {
      // Run asynchronously without awaiting
      setTimeout(() => {
        this.syncUserSchedule(userId).catch((err) => {
          console.error(`[SyncEngine] Background sync error for user ${userId}:`, err);
        });
      }, 0);
    }
  }
}
