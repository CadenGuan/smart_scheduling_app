import { Router, Response } from 'express';
import { sampleCalendarEvents } from '../db/seed.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { userQueries } from '../db/queries/userQueries.js';
import { UserPreferences, CalendarEvent } from 'shared';

const router = Router();

router.get('/preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  let preferences: Partial<UserPreferences> = {};

  if (userId) {
    const user = userQueries.findUserById(userId);
    if (user?.preferences) {
      try {
        preferences = JSON.parse(user.preferences);
      } catch {
        preferences = {};
      }
    }
  }

  const term = preferences.targetTerm || 'Winter 2027';
  const targetCredits = preferences.targetCredits ?? 15;
  const preferredFreeDays = preferences.preferredFreeDays || [];
  const earliestStartTime = preferences.earliestStartTime;
  const latestEndTime = preferences.latestEndTime;

  // Filter courses from pool matching targetCredits
  const academicPool = sampleCalendarEvents.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');
  const busyEvents = sampleCalendarEvents.filter((e) => e.type === 'GOOGLE_CALENDAR_BUSY');

  // Determine number of 5-credit courses to include (1 to 5)
  const courseCount = Math.max(1, Math.min(academicPool.length, Math.round(targetCredits / 5)));
  const selectedCourses = academicPool.slice(0, courseCount);

  // Evaluate conflict badges for selected courses based on user preferences
  const mappedCourses: CalendarEvent[] = selectedCourses.map((course) => {
    let conflictBadge: string | undefined = undefined;

    if (preferredFreeDays.length > 0 && course.days.some((day) => preferredFreeDays.includes(day))) {
      conflictBadge = 'Spans preferred free day';
    } else if (earliestStartTime && course.startTime < earliestStartTime) {
      conflictBadge = 'Starts before preferred time';
    } else if (latestEndTime && course.endTime > latestEndTime) {
      conflictBadge = 'Ends after preferred time';
    }

    return {
      ...course,
      conflictBadge,
    };
  });

  const allEvents = [...mappedCourses, ...busyEvents];
  const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits || 5), 0);

  res.status(200).json({
    success: true,
    data: {
      term,
      totalCredits,
      events: allEvents,
    },
  });
});

export default router;
