import { db } from '../database.js';
import { UserSettings } from 'shared';

export const settingsQueries = {
  getUserSettings(userId: string): UserSettings {
    const stmt = db.prepare(`
      SELECT user_id as userId, sync_enabled as syncEnabled, is_connected_to_google as isConnectedToGoogle, updated_at as updatedAt
      FROM user_settings
      WHERE user_id = ?
    `);
    const row = stmt.get(userId) as any;
    if (!row) {
      // Default settings if not exists
      return {
        userId,
        syncEnabled: true,
        isConnectedToGoogle: false,
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      userId: row.userId,
      syncEnabled: Boolean(row.syncEnabled),
      isConnectedToGoogle: Boolean(row.isConnectedToGoogle),
      updatedAt: row.updatedAt,
    };
  },

  upsertUserSettings(
    userId: string,
    syncEnabled: boolean,
    isConnectedToGoogle: boolean
  ): UserSettings {
    const stmt = db.prepare(`
      INSERT INTO user_settings (user_id, sync_enabled, is_connected_to_google, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        sync_enabled = excluded.sync_enabled,
        is_connected_to_google = excluded.is_connected_to_google,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, syncEnabled ? 1 : 0, isConnectedToGoogle ? 1 : 0);
    return this.getUserSettings(userId);
  },

  updateGoogleConnection(userId: string, isConnected: boolean): void {
    const stmt = db.prepare(`
      INSERT INTO user_settings (user_id, sync_enabled, is_connected_to_google, updated_at)
      VALUES (?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        is_connected_to_google = excluded.is_connected_to_google,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, isConnected ? 1 : 0);
  },

  updateSyncEnabled(userId: string, enabled: boolean): void {
    const stmt = db.prepare(`
      INSERT INTO user_settings (user_id, sync_enabled, is_connected_to_google, updated_at)
      VALUES (?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        sync_enabled = excluded.sync_enabled,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, enabled ? 1 : 0);
  },
};
