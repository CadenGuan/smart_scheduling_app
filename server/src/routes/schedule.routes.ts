import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  CreateScheduleEventRequestSchema,
  UpdateScheduleEventRequestSchema,
} from 'shared';
import { scheduleQueries } from '../db/queries/scheduleQueries.js';
import { SyncEngineService } from '../services/syncEngine.service.js';

const router = Router();

// GET /api/user_schedule - Retrieve schedule for current user
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const items = scheduleQueries.getScheduleByUserId(userId);
  res.status(200).json({
    success: true,
    data: items,
  });
});

// POST /api/user_schedule - Add class event (Agent or internal call)
router.post(
  '/',
  requireAuth,
  validateBody(CreateScheduleEventRequestSchema),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }

    const created = scheduleQueries.createScheduleEvent(userId, req.body);

    // Trigger asynchronous background sync if enabled and connected
    try {
      SyncEngineService.triggerBackgroundSync(userId);
    } catch {}

    res.status(201).json({
      success: true,
      data: created,
    });
  }
);

// PUT /api/user_schedule/:id - Update class event
router.put(
  '/:id',
  requireAuth,
  validateBody(UpdateScheduleEventRequestSchema),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }

    const updated = scheduleQueries.updateScheduleEvent(req.params.id, userId, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found or unauthorized' });
      return;
    }

    // Trigger asynchronous background sync
    try {
      SyncEngineService.triggerBackgroundSync(userId);
    } catch {}

    res.status(200).json({
      success: true,
      data: updated,
    });
  }
);

// DELETE /api/user_schedule/:id - Remove class event
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }

  const deleted = scheduleQueries.deleteScheduleEvent(req.params.id, userId);
  if (!deleted) {
    res.status(404).json({ success: false, error: 'EVENT_NOT_FOUND', message: 'Event not found or unauthorized' });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      message: 'Schedule event removed successfully',
      id: req.params.id,
    },
  });
});

export default router;
