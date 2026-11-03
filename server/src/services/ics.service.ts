import { CalendarEvent } from 'shared';

const DAY_CODES: Record<string, string> = {
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
  Sunday: 'SU',
};

// Term reference dates (Academic quarter start and end dates)
interface TermBoundary {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  quarterMonday: string; // YYYYMMDD format for the first Monday
}

const TERM_DATES: Record<string, TermBoundary> = {
  'Winter 2027': {
    startDate: '2027-01-04',
    endDate: '2027-03-19',
    quarterMonday: '20270104',
  },
  'Spring 2027': {
    startDate: '2027-03-29',
    endDate: '2027-06-11',
    quarterMonday: '20270329',
  },
  'Fall 2026': {
    startDate: '2026-09-24',
    endDate: '2026-12-11',
    quarterMonday: '20260928',
  },
};

const DAY_OFFSET_MAP: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
};

function formatDateToICS(baseMondayStr: string, dayName: string, timeStr: string): string {
  // baseMondayStr is YYYYMMDD
  const year = parseInt(baseMondayStr.slice(0, 4), 10);
  const month = parseInt(baseMondayStr.slice(4, 6), 10) - 1;
  const day = parseInt(baseMondayStr.slice(6, 8), 10);

  const offset = DAY_OFFSET_MAP[dayName] ?? 0;
  const targetDate = new Date(Date.UTC(year, month, day + offset));

  const [hours, mins] = timeStr.split(':').map((v) => parseInt(v, 10));
  targetDate.setUTCHours(hours, mins, 0, 0);

  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  const h = String(targetDate.getUTCHours()).padStart(2, '0');
  const min = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const s = '00';

  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export class IcsService {
  /**
   * Generates a fully RFC 5545 compliant iCalendar string (.ics)
   * with recurring weekly course lectures, academic milestones, and 15-minute VALARM alerts.
   */
  static generateCalendar(events: CalendarEvent[], term: string = 'Winter 2027'): string {
    const termInfo = TERM_DATES[term] || TERM_DATES['Winter 2027'];
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const untilDate = termInfo.endDate.replace(/-/g, '') + 'T235959Z';

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UCSC Smart Scheduler//SlugSchedule 1.0//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:UCSC Schedule (${escapeICS(term)})`,
      'X-WR-TIMEZONE:America/Los_Angeles',
    ];

    // 1. Generate Course & Commitment Events
    for (const event of events) {
      if (!event.days || event.days.length === 0) continue;

      const firstDay = event.days[0];
      const dtStart = formatDateToICS(termInfo.quarterMonday, firstDay, event.startTime);
      const dtEnd = formatDateToICS(termInfo.quarterMonday, firstDay, event.endTime);

      const byDay = event.days.map((d) => DAY_CODES[d] || 'MO').join(',');
      const uid = `${event.id}-${termInfo.quarterMonday}@slugschedule.ucsc.edu`;
      const summary = escapeICS(event.title);
      const description = escapeICS(
        `Course: ${event.title}\nType: ${event.type}\nCredits: ${event.credits || 5}\nLocation: UCSC Campus\nTerm: ${term}`
      );
      const location = escapeICS(event.location || 'UCSC Campus, Santa Cruz, CA');

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${untilDate};BYDAY=${byDay}`);
      lines.push(`SUMMARY:${summary}`);
      lines.push(`DESCRIPTION:${description}`);
      lines.push(`LOCATION:${location}`);
      lines.push('STATUS:CONFIRMED');

      // 15-Minute Audio/Display Alarm (RFC 5545 VALARM)
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Class Reminder: ${summary} starts in 15 minutes`);
      lines.push('TRIGGER:-PT15M');
      lines.push('END:VALARM');

      lines.push('END:VEVENT');
    }

    // 2. Academic Deadlines & Milestones (All-Day Events with 1-Day Advance Warning)
    const milestones = [
      {
        id: `deadline-add-drop-${termInfo.quarterMonday}`,
        summary: `UCSC Add/Drop/Swap Deadline (${term})`,
        date: '20270122',
        description: 'Last day to add, drop, or swap classes for the quarter without a W grade.',
      },
      {
        id: `deadline-grade-option-${termInfo.quarterMonday}`,
        summary: `UCSC Grade Option Deadline (${term})`,
        date: '20270212',
        description: 'Last day to change grade option (Pass/No Pass vs Letter Grade).',
      },
      {
        id: `milestone-finals-${termInfo.quarterMonday}`,
        summary: `UCSC Final Examinations Week (${term})`,
        date: '20270315',
        description: 'Comprehensive examinations week for all undergraduate courses.',
      },
    ];

    for (const m of milestones) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${m.id}@slugschedule.ucsc.edu`);
      lines.push(`DTSTAMP:${nowStamp}`);
      lines.push(`DTSTART;VALUE=DATE:${m.date}`);
      lines.push(`DTEND;VALUE=DATE:${m.date}`);
      lines.push(`SUMMARY:${escapeICS(m.summary)}`);
      lines.push(`DESCRIPTION:${escapeICS(m.description)}`);
      lines.push('LOCATION:UCSC Campus, Santa Cruz, CA');
      lines.push('STATUS:CONFIRMED');

      // 1-Day Advance Reminder for Academic Milestones
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Reminder: Tomorrow is the ${escapeICS(m.summary)}`);
      lines.push('TRIGGER:-P1D');
      lines.push('END:VALARM');

      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}
