import { Router, Response } from 'express';
import { sampleCalendarEvents } from '../db/seed.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { userQueries } from '../db/queries/userQueries.js';
import { UserPreferences, CalendarEvent, ConflictBadgeType } from 'shared';

const router = Router();

function getCourseConflicts(
  course: CalendarEvent,
  preferredFreeDays: string[],
  earliestStartTime?: string,
  latestEndTime?: string
): ConflictBadgeType[] {
  const badges: ConflictBadgeType[] = [];

  if (preferredFreeDays.length > 0 && course.days.some((day) => preferredFreeDays.includes(day))) {
    badges.push('Spans preferred free day');
  }

  if (earliestStartTime && course.startTime < earliestStartTime) {
    badges.push('Starts before preferred time');
  }

  if (latestEndTime && course.endTime > latestEndTime) {
    badges.push('Ends after preferred time');
  }

  return badges;
}

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

  // Filter courses from pool matching term (if defined on events) or default gracefully
  const termMatchedPool = sampleCalendarEvents.filter(
    (e) => e.type !== 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term)
  );
  const academicPool =
    termMatchedPool.length > 0
      ? termMatchedPool
      : sampleCalendarEvents.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');

  const busyEvents = sampleCalendarEvents.filter((e) => e.type === 'GOOGLE_CALENDAR_BUSY');

  // Determine number of 5-credit courses to include (1 to 5)
  const courseCount = Math.max(1, Math.min(academicPool.length, Math.round(targetCredits / 5)));

  // Score candidate courses by conflict count and sort (0 conflicts first)
  const evaluatedCandidates = academicPool.map((course) => {
    const badges = getCourseConflicts(course, preferredFreeDays, earliestStartTime, latestEndTime);
    return {
      course,
      badges,
      conflictCount: badges.length,
    };
  });

  // Sort candidate courses: fewest conflicts first, preserving original order as secondary sort
  evaluatedCandidates.sort((a, b) => a.conflictCount - b.conflictCount);

  const selectedCandidates = evaluatedCandidates.slice(0, courseCount);

  const mappedCourses: CalendarEvent[] = selectedCandidates.map(({ course, badges }) => ({
    ...course,
    conflictBadge: badges.length > 0 ? badges.join(', ') : undefined,
    conflictBadges: badges.length > 0 ? badges : undefined,
  }));

  const allEvents = [...mappedCourses, ...busyEvents];
  const totalCredits = mappedCourses.reduce((sum, c) => sum + (c.credits || 5), 0);

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
