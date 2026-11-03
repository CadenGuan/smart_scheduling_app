import { userQueries } from '../db/queries/userQueries.js';
import { progressQueries } from '../db/queries/progressQueries.js';
import { conversationQueries } from '../db/queries/conversationQueries.js';
import { CalendarService } from './calendar.service.js';
import { sampleCalendarEvents } from '../db/seed.js';

export interface AssembledContext {
  student: {
    userId: string;
    name: string;
    email: string;
    standing: string;
    major: string;
    minor?: string | null;
  };
  preferences: {
    targetCredits: number;
    geStatus: any;
    majorRequirementsTaken: string[];
    breaksPreference: any[];
    preferredFreeDays?: string[];
    earliestStartTime?: string;
    latestEndTime?: string;
    maxBackToBackHours?: number;
  };
  currentSchedule: any[];
  history: Array<{
    sender: 'USER' | 'AGENT' | 'SYSTEM';
    content: string;
    createdAt: string;
  }>;
}

export class ContextService {
  static assembleContext(userId: string): AssembledContext {
    const user = userQueries.findUserById(userId);
    const progress = progressQueries.getProgress(userId);

    let draftAnswers: any = {};
    if (progress?.draft_answers) {
      try {
        draftAnswers = JSON.parse(progress.draft_answers);
      } catch {
        draftAnswers = {};
      }
    }

    let userPreferences: any = {};
    if (user?.preferences) {
      try {
        userPreferences = JSON.parse(user.preferences);
      } catch {
        userPreferences = {};
      }
    }

    let geStatus: any = {};
    if (user?.ge_status) {
      try {
        geStatus = JSON.parse(user.ge_status);
      } catch {
        geStatus = { source: 'UCSC', remaining: [] };
      }
    } else if (draftAnswers.geSource || draftAnswers.remainingGEs) {
      geStatus = {
        source: draftAnswers.geSource || 'UCSC',
        remaining: draftAnswers.remainingGEs || [],
      };
    }

    let majorReqs: string[] = [];
    if (user?.major_requirements_taken) {
      try {
        majorReqs = JSON.parse(user.major_requirements_taken);
      } catch {
        majorReqs = [];
      }
    } else if (draftAnswers.majorRequirements) {
      majorReqs = draftAnswers.majorRequirements;
    }

    let breaks: any[] = [];
    if (user?.breaks_preference) {
      try {
        const parsed = JSON.parse(user.breaks_preference);
        breaks = Array.isArray(parsed) ? parsed : [];
      } catch {
        breaks = [];
      }
    } else if (draftAnswers.breaks) {
      breaks = draftAnswers.breaks;
    }

    if (
      userPreferences.breaks &&
      Array.isArray(userPreferences.breaks) &&
      userPreferences.breaks.length > 0
    ) {
      breaks = userPreferences.breaks;
    }

    const targetCredits = userPreferences.targetCredits || draftAnswers.targetCredits || 15;

    // Fetch the sliding window of the last 10 messages for context continuity
    const rawHistory = conversationQueries.getSlidingWindowMessages(userId, 10);
    const history = rawHistory.map((m) => ({
      sender: m.sender,
      content: m.content,
      createdAt: m.created_at,
    }));

    let currentSchedule = sampleCalendarEvents;
    try {
      const preview = CalendarService.getPreview(userId);
      if (preview && preview.events && preview.events.length > 0) {
        currentSchedule = preview.events;
      }
    } catch {
      currentSchedule = sampleCalendarEvents;
    }

    return {
      student: {
        userId,
        name: user?.name || 'UCSC Student',
        email: user?.email || '',
        standing: user?.standing || 'Junior',
        major: user?.major || 'Computer Science B.S.',
        minor: user?.minor || null,
      },
      preferences: {
        targetCredits,
        geStatus,
        majorRequirementsTaken: majorReqs,
        breaksPreference: breaks,
        preferredFreeDays: userPreferences.preferredFreeDays || [],
        earliestStartTime: userPreferences.earliestStartTime,
        latestEndTime: userPreferences.latestEndTime,
        maxBackToBackHours: userPreferences.maxBackToBackHours,
      },
      currentSchedule,
      history,
    };
  }
}
