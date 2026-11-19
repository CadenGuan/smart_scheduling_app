import { UserScheduleItem } from 'shared';

export interface FullCalendarEventItem {
  id: string;
  title: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startRecur: string;
  endRecur: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    courseCode: string;
    isImported: boolean;
    syncStatus: string;
    description: string;
  };
}

/**
 * Parses days representation into numeric FullCalendar daysOfWeek (0=Sun, 1=Mon, ..., 6=Sat)
 */
export function parseDaysToDaysOfWeek(daysStr: string): number[] {
  if (!daysStr || !daysStr.trim()) {
    return [1];
  }

  const clean = daysStr.trim();
  const days: number[] = [];

  // Comma-separated like "M,W,F" or "Tu,Th"
  if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => p.trim());
    for (const p of parts) {
      if (p === 'M' || p === 'Mo') days.push(1);
      else if (p === 'Tu' || p === 'T') days.push(2);
      else if (p === 'W' || p === 'We') days.push(3);
      else if (p === 'Th' || p === 'R') days.push(4);
      else if (p === 'F' || p === 'Fr') days.push(5);
      else if (p === 'Sa') days.push(6);
      else if (p === 'Su') days.push(0);
    }
    return days.length > 0 ? days : [1];
  }

  // Tokens like MWF, TuTh, MTuWThF
  const regex = /(Tu|Th|Sa|Su|M|W|F)/g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    const token = match[1];
    if (token === 'M') days.push(1);
    else if (token === 'Tu') days.push(2);
    else if (token === 'W') days.push(3);
    else if (token === 'Th') days.push(4);
    else if (token === 'F') days.push(5);
    else if (token === 'Sa') days.push(6);
    else if (token === 'Su') days.push(0);
  }

  return days.length > 0 ? days : [1];
}

function normalizeTime(time: string): string {
  const t = time.trim();
  if (t.length === 5) return `${t}:00`;
  return t;
}

const COURSE_PALETTE = ['#00B4DB', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];

/**
 * Maps UserScheduleItem records to FullCalendar event format.
 */
export function mapScheduleItemsToFullCalendar(items: UserScheduleItem[]): FullCalendarEventItem[] {
  return items.map((item, index) => {
    const isImported = Boolean(item.isImported);
    const color = isImported
      ? '#64748b' // Slate/gray for external imported blocks
      : COURSE_PALETTE[index % COURSE_PALETTE.length];

    let title = item.title;
    if (item.courseCode) {
      const escaped = item.courseCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const startsWithCode = new RegExp(`^${escaped}\\b`, 'i').test(item.title);
      if (!startsWithCode) {
        title = `${item.courseCode} - ${item.title}`;
      }
    }

    return {
      id: item.id,
      title,
      daysOfWeek: parseDaysToDaysOfWeek(item.days),
      startTime: normalizeTime(item.startTime),
      endTime: normalizeTime(item.endTime),
      startRecur: item.startDate || '2027-01-04',
      endRecur: item.endDate || '2027-03-19',
      backgroundColor: color,
      borderColor: color,
      textColor: '#FFFFFF',
      extendedProps: {
        courseCode: item.courseCode,
        isImported,
        syncStatus: item.syncStatus,
        description: item.description,
      },
    };
  });
}
