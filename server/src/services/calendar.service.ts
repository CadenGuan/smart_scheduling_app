import { CalendarEvent, ConflictBadgeType, UserPreferences } from 'shared';
import { sampleCalendarEvents } from '../db/seed.js';
import { userQueries } from '../db/queries/userQueries.js';
import { calendarQueries } from '../db/queries/calendarQueries.js';

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

export function extractBaseCourseCode(course: CalendarEvent): string {
  const raw = course.code || course.title.split(':')[0].trim();
  return raw.replace(/-\d+$/, '').replace(/\s+section\s+\d+$/i, '').trim().toUpperCase();
}

export const getBaseCourseCode = extractBaseCourseCode;

export function getCourseNumericLevel(course: CalendarEvent): number | null {
  const match = (course.code || course.title).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function isLowerDivision(course: CalendarEvent): boolean {
  if (course.level === 'LOWER') return true;
  if (course.level === 'UPPER' || course.level === 'CAPSTONE') return false;
  const num = getCourseNumericLevel(course);
  return num !== null ? num < 100 : false;
}

export function isUpperDivision(course: CalendarEvent): boolean {
  if (course.level === 'UPPER' || course.level === 'CAPSTONE') return true;
  if (course.level === 'LOWER') return false;
  const num = getCourseNumericLevel(course);
  return num !== null ? num >= 100 : false;
}

export function matchesMajorDepartment(course: CalendarEvent, majorStr?: string): boolean {
  if (!majorStr) return true;
  const normMajor = majorStr.toLowerCase();
  const dept = (course.department || (course.code || course.title).split(' ')[0] || '').toUpperCase();

  if (
    normMajor.includes('computer science') ||
    /\bcs\b/i.test(majorStr) ||
    normMajor.includes('computer engineering')
  ) {
    return dept === 'CSE' || dept === 'CMPS' || dept === 'CMPE';
  }
  if (normMajor.includes('art')) {
    return dept === 'ART' || dept === 'HAVC' || dept === 'FILM';
  }
  if (normMajor.includes('economics') || normMajor.includes('econ')) {
    return dept === 'ECON';
  }
  if (normMajor.includes('math')) {
    return dept === 'MATH' || dept === 'AM' || dept === 'STAT';
  }
  if (normMajor.includes('technology') || /\btim\b/i.test(majorStr)) {
    return dept === 'TIM' || dept === 'CSE';
  }
  return dept.length > 0 && normMajor.toUpperCase().includes(dept);
}

export class CalendarService {
  static getPreview(
    userId?: string,
    preferencesOverride?: Partial<UserPreferences> & { standing?: string; major?: string },
    eventsPool?: CalendarEvent[]
  ): {
    term: string;
    totalCredits: number;
    events: CalendarEvent[];
  } {
    let preferences: Partial<UserPreferences> = {};
    let userStanding = 'Junior';
    let userMajor = 'Computer Science B.S.';

    if (userId) {
      const user = userQueries.findUserById(userId);
      if (user) {
        if (user.standing) userStanding = user.standing;
        if (user.major) userMajor = user.major;
        if (user.preferences) {
          try {
            preferences = JSON.parse(user.preferences);
          } catch {
            preferences = {};
          }
        }
      }
    }

    if (preferencesOverride) {
      const { standing: ovStanding, major: ovMajor, ...prefsOnly } = preferencesOverride as any;
      if (ovStanding) userStanding = ovStanding;
      if (ovMajor) userMajor = ovMajor;
      preferences = { ...preferences, ...prefsOnly };
    }

    const term = preferences.targetTerm || eventsPool?.find((e) => e.term)?.term || 'Winter 2027';
    const targetCredits = preferences.targetCredits ?? 15;
    const preferredFreeDays = preferences.preferredFreeDays || [];
    const earliestStartTime = preferences.earliestStartTime;
    const latestEndTime = preferences.latestEndTime;
    const maxBackToBackHours = preferences.maxBackToBackHours;

    let pool = eventsPool;
    if (!pool && userId) {
      const savedUserEvents = calendarQueries.getUserCalendarEvents(userId, term);
      if (savedUserEvents.length > 0) {
        pool = savedUserEvents.map((e) => ({ ...e }));
      }
    }
    if (!pool) {
      pool = sampleCalendarEvents.map((e) => ({ ...e }));
    }

    const termMatchedPool = pool.filter(
      (e) => e.type !== 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term || Boolean(e.pinned))
    );
    const initialAcademicPool =
      termMatchedPool.length > 0
        ? termMatchedPool
        : pool.filter((e) => e.type !== 'GOOGLE_CALENDAR_BUSY');

    let busyEvents = pool.filter(
      (e) => e.type === 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term)
    );
    // Retain external Google Calendar commitments if not in active pool
    if (busyEvents.length === 0 && pool.length > 0) {
      if (userId) {
        const savedUserBusy = calendarQueries
          .getUserCalendarEvents(userId, term)
          .filter((e) => e.type === 'GOOGLE_CALENDAR_BUSY');
        if (savedUserBusy.length > 0) {
          busyEvents = savedUserBusy;
        }
      }
      if (busyEvents.length === 0) {
        busyEvents = sampleCalendarEvents.filter(
          (e) => e.type === 'GOOGLE_CALENDAR_BUSY' && (!e.term || e.term === term)
        );
      }
    }

    // Determine target course count from credit quota
    let targetCourseCount = 3;
    if (targetCredits <= 10) {
      targetCourseCount = 2;
    } else if (targetCredits <= 15) {
      targetCourseCount = 3;
    } else if (targetCredits <= 20) {
      targetCourseCount = 4;
    } else {
      targetCourseCount = Math.max(3, Math.ceil(targetCredits / 5));
    }

    // Hard Day Exclusion: filter academicPool before greedy selection
    let academicPool = initialAcademicPool;
    if (preferredFreeDays.length > 0) {
      const pinned = initialAcademicPool.filter((c) => Boolean(c.pinned));
      const compliantUnpinned = initialAcademicPool.filter(
        (c) => !c.pinned && !c.days.some((d) => preferredFreeDays.includes(d))
      );
      const violatingUnpinned = initialAcademicPool.filter(
        (c) => !c.pinned && c.days.some((d) => preferredFreeDays.includes(d))
      );

      // Check how many unique base codes are available among compliant candidates + pinned
      const availableBaseCodes = new Set<string>();
      pinned.forEach((c) => availableBaseCodes.add(extractBaseCourseCode(c)));
      compliantUnpinned.forEach((c) => availableBaseCodes.add(extractBaseCourseCode(c)));

      if (
        (availableBaseCodes.size >= targetCourseCount) ||
        violatingUnpinned.length === 0
      ) {
        // Sufficient compliant candidates exist to fulfill target course count; strictly discard free-day violators
        academicPool = [...pinned, ...compliantUnpinned];
      } else {
        // Fallback edge case: compliant candidates cannot satisfy credit quota, allow violators as fallback
        academicPool = [...pinned, ...compliantUnpinned, ...violatingUnpinned];
      }
    }

    const courseCount = academicPool.length === 0 ? 0 : Math.min(academicPool.length, targetCourseCount);

    const isUnderclassman = userStanding === 'Freshman' || userStanding === 'Sophomore';

    // Partition candidates into pinned (unconditionally scheduled) and unpinned
    const uniquePinned: CalendarEvent[] = [];
    const seenIds = new Set<string>();
    const selectedBaseCodes = new Set<string>();

    for (const course of academicPool) {
      if (course.pinned && !seenIds.has(course.id)) {
        seenIds.add(course.id);
        const baseCode = extractBaseCourseCode(course);
        if (!selectedBaseCodes.has(baseCode)) {
          selectedBaseCodes.add(baseCode);
          uniquePinned.push(course);
        }
      }
    }

    // Determine candidate availability for class standing
    const lowerOrGeBaseCodes = new Set<string>();
    for (const course of academicPool) {
      if (course.pinned || isLowerDivision(course) || course.type === 'GE' || Boolean(course.ge)) {
        lowerOrGeBaseCodes.add(extractBaseCourseCode(course));
      }
    }
    const hasSufficientLowerCourses = lowerOrGeBaseCodes.size >= targetCourseCount;

    // Unpinned candidates: apply hard constraints (free days & class standing level)
    const uniqueUnpinned: CalendarEvent[] = [];
    for (const course of academicPool) {
      if (!course.pinned && !seenIds.has(course.id)) {
        seenIds.add(course.id);

        // If base code is already selected via pinned course, exclude it immediately
        const baseCode = extractBaseCourseCode(course);
        if (selectedBaseCodes.has(baseCode)) {
          continue;
        }

        // Hard constraint 2: Class Standing (Freshman/Sophomore restricted to lower-division & GEs)
        if (isUnderclassman && hasSufficientLowerCourses && isUpperDivision(course) && course.type !== 'GE' && !course.ge) {
          continue;
        }

        uniqueUnpinned.push(course);
      }
    }

    // Pinned courses bypass greedy omission and are unconditionally selected first
    const selectedCandidates: CalendarEvent[] = [...uniquePinned];
    let currentCredits = selectedCandidates.reduce((sum, c) => sum + (c.credits || 5), 0);

    // Filter out remaining candidates that duplicate base course codes of pinned courses
    let remainingCandidates: CalendarEvent[] = uniqueUnpinned.filter(
      (c) => !selectedBaseCodes.has(extractBaseCourseCode(c))
    );

    // Continue selecting courses while currentCredits < targetCredits and valid distinct base-code candidates remain
    while (currentCredits < targetCredits && remainingCandidates.length > 0) {
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

        // Soft time window penalties: +2 per hour of deviation, min 3 penalty points
        let softTimePenalty = 0;
        if (earliestStartTime && candidate.startTime < earliestStartTime) {
          const diffMinutes = toMinutes(earliestStartTime) - toMinutes(candidate.startTime);
          const hoursDev = Math.ceil(diffMinutes / 60);
          softTimePenalty += Math.max(3, hoursDev * 2);
        }
        if (latestEndTime && candidate.endTime > latestEndTime) {
          const diffMinutes = toMinutes(candidate.endTime) - toMinutes(latestEndTime);
          const hoursDev = Math.ceil(diffMinutes / 60);
          softTimePenalty += Math.max(3, hoursDev * 2);
        }

        // Major department prioritization
        const isMajorDept = matchesMajorDepartment(candidate, userMajor);
        const isGeCourse = candidate.type === 'GE' || Boolean(candidate.ge);
        const majorPenalty = isMajorDept ? 0 : isGeCourse ? 5 : 15;

        // Standing alignment:
        // Underclassmen prioritize lower-division foundations & GEs over upper-division
        // Upperclassmen prioritize upper-division & GEs over lower-division non-GE
        let standingPenalty = 0;
        if (isUnderclassman && isUpperDivision(candidate) && !isGeCourse) {
          standingPenalty = 10;
        } else if (!isUnderclassman && isLowerDivision(candidate) && !isGeCourse) {
          standingPenalty = 10;
        }

        const score =
          (collides ? 100 : 0) +
          (causesB2B ? 10 : 0) +
          softTimePenalty +
          majorPenalty +
          standingPenalty;

        return { candidate, score };
      });

      scored.sort((a, b) => a.score - b.score);
      const best = scored[0].candidate;
      selectedCandidates.push(best);
      selectedBaseCodes.add(getBaseCourseCode(best));
      currentCredits += best.credits || 5;

      // Section Deduplication: Purge ALL candidates sharing the same base course code
      remainingCandidates = remainingCandidates.filter(
        (c) => !selectedBaseCodes.has(getBaseCourseCode(c))
      );
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

    static getCurriculumDag(
    userId?: string,
    completedOverride?: string[]
  ): {
    major: string;
    totalCoreCount: number;
    completedCount: number;
    progressPercentage: number;
    nodes: Array<{
      code: string;
      title: string;
      credits: number;
      level: 'LOWER' | 'UPPER' | 'CAPSTONE';
      status: 'COMPLETED' | 'READY_TO_ENROLL' | 'LOCKED';
      prerequisites: string[];
      unmetPrerequisites: string[];
      tier: number;
    }>;
    edges: Array<[string, string]>;
    readyToEnroll: string[];
  } {
    const completedSet = new Set<string>();

    if (userId) {
      const user = userQueries.findUserById(userId);
      if (user?.major_requirements_taken) {
        try {
          const parsed = JSON.parse(user.major_requirements_taken);
          if (Array.isArray(parsed)) {
            parsed.forEach((c) => completedSet.add(c.trim().toUpperCase()));
          }
        } catch {
          // Ignore error
        }
      }
    }

    if (completedOverride) {
      completedOverride.forEach((c) => completedSet.add(c.trim().toUpperCase()));
    }

    const nodes = UCSC_CS_CURRICULUM.map((course) => {
      const isCompleted = completedSet.has(course.code.toUpperCase());
      const unmet = course.prerequisites.filter((p) => !completedSet.has(p.toUpperCase()));
      let status: 'COMPLETED' | 'READY_TO_ENROLL' | 'LOCKED' = 'LOCKED';

      if (isCompleted) {
        status = 'COMPLETED';
      } else if (unmet.length === 0) {
        status = 'READY_TO_ENROLL';
      }

      return {
        code: course.code,
        title: course.title,
        credits: course.credits,
        level: course.level,
        status,
        prerequisites: course.prerequisites,
        unmetPrerequisites: isCompleted ? [] : unmet,
        tier: course.tier,
      };
    });

    const edges: Array<[string, string]> = [];
    UCSC_CS_CURRICULUM.forEach((course) => {
      course.prerequisites.forEach((p) => {
        edges.push([p, course.code]);
      });
    });

    const completedCount = nodes.filter((n) => n.status === 'COMPLETED').length;
    const totalCoreCount = nodes.length;
    const progressPercentage = Math.round((completedCount / totalCoreCount) * 100);
    const readyToEnroll = nodes.filter((n) => n.status === 'READY_TO_ENROLL').map((n) => n.code);

    return {
      major: 'Computer Science B.S.',
      totalCoreCount,
      completedCount,
      progressPercentage,
      nodes,
      edges,
      readyToEnroll,
    };
  }
}

export interface CourseCatalogEntry {
  code: string;
  title: string;
  credits: number;
  level: 'LOWER' | 'UPPER' | 'CAPSTONE';
  tier: number;
  prerequisites: string[];
}

export const UCSC_CS_CURRICULUM: CourseCatalogEntry[] = [
  // Tier 1: Foundations
  {
    code: 'MATH 19A',
    title: 'Calculus for Sci/Eng I',
    credits: 5,
    level: 'LOWER',
    tier: 1,
    prerequisites: [],
  },
  {
    code: 'MATH 19B',
    title: 'Calculus for Sci/Eng II',
    credits: 5,
    level: 'LOWER',
    tier: 1,
    prerequisites: ['MATH 19A'],
  },
  {
    code: 'CSE 20',
    title: 'Beginning Python Programming',
    credits: 5,
    level: 'LOWER',
    tier: 1,
    prerequisites: [],
  },
  {
    code: 'CSE 12',
    title: 'Computer Systems & Assembly',
    credits: 5,
    level: 'LOWER',
    tier: 1,
    prerequisites: [],
  },

  // Tier 2: Lower Division Core
  {
    code: 'MATH 21',
    title: 'Linear Algebra',
    credits: 5,
    level: 'LOWER',
    tier: 2,
    prerequisites: ['MATH 19B'],
  },
  {
    code: 'CSE 16',
    title: 'Applied Discrete Mathematics',
    credits: 5,
    level: 'LOWER',
    tier: 2,
    prerequisites: ['MATH 19B'],
  },
  {
    code: 'CSE 30',
    title: 'Programming Abstractions in Python',
    credits: 5,
    level: 'LOWER',
    tier: 2,
    prerequisites: ['CSE 20'],
  },
  {
    code: 'CSE 13S',
    title: 'Computer Systems and C',
    credits: 5,
    level: 'LOWER',
    tier: 2,
    prerequisites: ['CSE 30', 'CSE 12'],
  },

  // Tier 3: Core Gatekeeper
  {
    code: 'CSE 101',
    title: 'Data Structures and Algorithms',
    credits: 5,
    level: 'UPPER',
    tier: 3,
    prerequisites: ['CSE 13S', 'CSE 16'],
  },

  // Tier 4: Upper Division Core & Electives
  {
    code: 'CSE 102',
    title: 'Analysis of Algorithms',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },
  {
    code: 'CSE 103',
    title: 'Computational Models',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },
  {
    code: 'CSE 107',
    title: 'Probability & Statistics for Engr',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },
  {
    code: 'CSE 115A',
    title: 'Intro to Software Engineering',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },
  {
    code: 'CSE 130',
    title: 'Principles of Computer Systems Design',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101', 'CSE 12'],
  },
  {
    code: 'CSE 150',
    title: 'Computer Networks',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 130'],
  },
  {
    code: 'CSE 180',
    title: 'Database Systems I',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },
  {
    code: 'CSE 185S',
    title: 'Technical Writing for Engineers',
    credits: 5,
    level: 'UPPER',
    tier: 4,
    prerequisites: ['CSE 101'],
  },

  // Tier 5: Capstone
  {
    code: 'CSE 115B',
    title: 'Software Design Capstone',
    credits: 5,
    level: 'CAPSTONE',
    tier: 5,
    prerequisites: ['CSE 115A'],
  },
];
