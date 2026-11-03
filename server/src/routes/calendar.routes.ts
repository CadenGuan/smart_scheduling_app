import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';
import { IcsService } from '../services/ics.service.js';

const router = Router();

// GET /api/calendar/preview
router.get('/preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const preview = CalendarService.getPreview(req.user?.userId);
  res.status(200).json({
    success: true,
    data: preview,
  });
});

// GET /api/calendar/export
router.get('/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const preview = CalendarService.getPreview(req.user?.userId);
  const icsData = IcsService.generateCalendar(preview.events, preview.term);

  const filename = `slug-schedule-${preview.term.replace(/\s+/g, '-').toLowerCase()}.ics`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(icsData);
});

export default router;
