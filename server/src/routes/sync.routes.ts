import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { settingsQueries } from '../db/queries/settingsQueries.js';
import { SyncEngineService } from '../services/syncEngine.service.js';

const router = Router();

// GET /api/sync/settings - Retrieve sync and Google connection settings
router.get('/settings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const settings = settingsQueries.getUserSettings(userId);
  res.status(200).json({
    success: true,
    data: settings,
  });
});

// POST /api/sync/run - Manually trigger calendar sync
router.post('/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const settings = settingsQueries.getUserSettings(userId);
  if (!settings.syncEnabled) {
    res.status(400).json({
      success: false,
      error: 'SYNC_DISABLED',
      message: 'Synchronization is currently disabled in your settings.',
    });
    return;
  }

  if (!settings.isConnectedToGoogle) {
    res.status(400).json({
      success: false,
      error: 'GOOGLE_NOT_CONNECTED',
      message: 'Google account is not connected. Please connect your Google Calendar.',
    });
    return;
  }

  try {
    const result = await SyncEngineService.syncUserSchedule(userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'SYNC_FAILED',
      message: err.message || 'Failed to execute synchronization.',
    });
  }
});

export default router;
