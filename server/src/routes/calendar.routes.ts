import { Router, Request, Response } from 'express';
import { sampleCalendarEvents } from '../db/seed.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/preview', requireAuth, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      term: 'Winter 2027',
      totalCredits: 15,
      events: sampleCalendarEvents,
    },
  });
});

export default router;

