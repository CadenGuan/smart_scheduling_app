import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';

const router = Router();

router.get('/preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const preview = CalendarService.getPreview(req.user?.userId);
  res.status(200).json({
    success: true,
    data: preview,
  });
});

export default router;
