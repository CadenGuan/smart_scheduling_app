import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { CalendarService } from '../services/calendar.service.js';
import { IcsService } from '../services/ics.service.js';
import { DeadlinesService } from '../services/deadlines.service.js';
import { calendarQueries } from '../db/queries/calendarQueries.js';

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

// GET /api/calendar/curriculum
router.get('/curriculum', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const dag = CalendarService.getCurriculumDag(req.user?.userId);
  res.status(200).json({
    success: true,
    data: dag,
  });
});

// GET /api/calendar/deadlines
router.get('/deadlines', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const topic = req.query.topic as string | undefined;
  const tier = req.query.tier as string | undefined;
  const result = DeadlinesService.getDeadlines(topic, tier);
  res.status(200).json({
    success: true,
    data: result,
  });
});

// GET /api/calendar/deadlines/export
router.get('/deadlines/export', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const topic = req.query.topic as string | undefined;
  const tier = req.query.tier as string | undefined;
  const result = DeadlinesService.getDeadlines(topic, tier);
  const icsData = DeadlinesService.exportDeadlinesIcs(result.deadlines);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ucsc-cs-conference-deadlines.ics"');
  res.status(200).send(icsData);
});

// POST /api/calendar/events - Save custom schedule
router.post('/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  const term = (req.body.term as string) || 'Winter 2027';
  const events = req.body.events || [];
  calendarQueries.saveUserCalendarEvents(userId, term, events);
  res.status(200).json({ success: true, message: 'Schedule saved successfully', count: events.length });
});

// GET /api/calendar/events - Retrieve saved custom schedule
router.get('/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  const term = req.query.term as string | undefined;
  const events = calendarQueries.getUserCalendarEvents(userId, term);
  res.status(200).json({ success: true, data: events });
});

// DELETE /api/calendar/events - Clear saved custom schedule
router.delete('/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  const term = req.query.term as string | undefined;
  calendarQueries.deleteUserCalendarEvents(userId, term);
  res.status(200).json({ success: true, message: 'Schedule cleared successfully' });
});

export default router;
