import { CalendarEvent, ConflictBadgeType, UserPreferences } from 'shared';
import { sampleCalendarEvents } from '../db/seed.js';
import { userQueries } from '../db/queries/userQueries.js';

function toMinutes(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
}

export function coursesOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  if (a.id === b.id) return false;
  const commonDays = a.days.filter((day) => b.days.includes(day));
  if (commonDays.length === 0) return false;

  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);

  return aStart < bEnd && bStart < aEnd;
}

export function getIndividualConflicts(
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

export function isClusterExceeding(cluster: CalendarEvent[], maxHours: number): boolean {
  if (cluster.length === 0) return false;
  const start = toMinutes(cluster[0].startTime);
  const end = Math.max(...cluster.map((c) => toMinutes(c.endTime)));
  const totalMeetingMinutes = cluster.reduce(
    (sum, c) => sum + (toMinutes(c.endTime) - toMinutes(c.startTime)),
    0
  );
  return end - start > maxHours * 60 || totalMeetingMinutes > maxHours * 60;
}

export function courseExceedsBackToBack(
  course: CalendarEvent,
  allCourses: CalendarEvent[],
  maxHours: number
): boolean {
  for (const day of course.days) {
    const dayCourses = allCourses
      .filter((c) => c.days.includes(day))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    let currentCluster: CalendarEvent[] = [];
    for (const c of dayCourses) {
      if (currentCluster.length === 0) {
        currentCluster.push(c);
      } else {
        const last = currentCluster[currentCluster.length - 1];
        const gap = toMinutes(c.startTime) - toMinutes(last.endTime);
        if (gap <= 30) {
          currentCluster.push(c);
        } else {
          if (
            isClusterExceeding(currentCluster, maxHours) &&
            currentCluster.some((item) => item.id === course.id)
          ) {
            return true;
          }
          currentCluster = [c];
        }
      }
    }
    if (
      currentCluster.length > 0 &&
      isClusterExceeding(currentCluster, maxHours) &&
      currentCluster.some((item) => item.id === course.id)
    ) {
      return true;
    }
  }
  return false;
}

export function wouldExceedBackToBack(courses: CalendarEvent[], maxHours: number): boolean {
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const) {
    const dayCourses = courses
      .filter((c) => c.days.includes(day))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    let currentCluster: CalendarEvent[] = [];
    for (const c of dayCourses) {
      if (currentCluster.length === 0) {
        currentCluster.push(c);
      } else {
        const last = currentCluster[currentCluster.length - 1];
        const gap = toMinutes(c.startTime) - toMinutes(last.endTime);
        if (gap <= 30) {
          currentCluster.push(c);
        } else {
          if (isClusterExceeding(currentCluster, maxHours)) return true;
          currentCluster = [c];
        }
      }
    }
    if (currentCluster.length > 0 && isClusterExceeding(currentCluster, maxHours)) {
      return true;
    }
  }
  return false;
}

export class CalendarService {
  static getPreview(
    userId?: string,
    preferencesOverride?: Partial<UserPreferences>,
    eventsPool?: CalendarEvent[]
  ): {
    term: string;
    totalCredits: number;
    events: CalendarEvent[];
  } {
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

    if (preferencesOverride) {
      preferences = { ...preferences, ...preferencesOverride };
    }

    const term = preferences.targetTerm || 'Winter 2027';
    const targetCredits = preferences.targetCredits ?? 15;
    const preferredFreeDays = preferences.preferredFreeDays || [];
    const earliestStartTime = preferences.earliestStartTime;
    const latestEndTime = preferences.latestEndTime;
    const maxBackToBackHours = preferences.maxBackToBackHours;

    const pool = eventsPool || sampleCalendarEvents;

    const termMatchedPool = pool.filter(
      (e) => e.type !== 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term)
    );
    const academicPool =
      termMatchedPool.length > 0
        ? termMatchedPool
        : pool.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');

    const termBusy = pool.filter(
      (e) => e.type === 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term)
    );
    const busyEvents =
      termBusy.length > 0 ? termBusy : pool.filter((e) => e.type === 'GOOGLE_CALENDAR_BUSY');

    const courseCount = Math.max(1, Math.min(academicPool.length, Math.round(targetCredits / 5)));

    // Greedy candidate selection prioritizing conflict-free and non-colliding courses
    const selectedCandidates: CalendarEvent[] = [];
    const remainingCandidates = [...academicPool];

    while (selectedCandidates.length < courseCount && remainingCandidates.length > 0) {
      const scored = remainingCandidates.map((candidate) => {
        const indBadges = getIndividualConflicts(
          candidate,
          preferredFreeDays,
          earliestStartTime,
          latestEndTime
        );
        const collides = selectedCandidates.some((sel) => coursesOverlap(sel, candidate));
        let causesB2B = false;
        if (maxBackToBackHours) {
          causesB2B = wouldExceedBackToBack([...selectedCandidates, candidate], maxBackToBackHours);
        }

        const score = indBadges.length + (collides ? 10 : 0) + (causesB2B ? 5 : 0);
        return { candidate, score };
      });

      scored.sort((a, b) => a.score - b.score);
      const best = scored[0].candidate;
      selectedCandidates.push(best);
      const idx = remainingCandidates.findIndex((c) => c.id === best.id);
      remainingCandidates.splice(idx, 1);
    }

    // Attach conflict badges
    const mappedCourses: CalendarEvent[] = selectedCandidates.map((course) => {
      const badges: ConflictBadgeType[] = getIndividualConflicts(
        course,
        preferredFreeDays,
        earliestStartTime,
        latestEndTime
      );

      const hasCollision = selectedCandidates.some((other) => coursesOverlap(course, other));
      if (hasCollision) {
        badges.push('Time conflict with another course');
      }

      if (
        maxBackToBackHours &&
        courseExceedsBackToBack(course, selectedCandidates, maxBackToBackHours)
      ) {
        badges.push('Exceeds max back-to-back hours');
      }

      return {
        ...course,
        conflictBadge: badges.length > 0 ? badges.join(', ') : undefined,
        conflictBadges: badges.length > 0 ? badges : undefined,
      };
    });

    const allEvents = [...mappedCourses, ...busyEvents];
    const totalCredits = mappedCourses.reduce((sum, c) => sum + (c.credits || 5), 0);

    return {
      term,
      totalCredits,
      events: allEvents,
    };
  }
}
