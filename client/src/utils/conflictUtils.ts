import { CalendarEvent } from 'shared';

/**
 * Normalizes conflict badges from a CalendarEvent into a single string array.
 * Prioritizes the typed array `conflictBadges` if present and non-empty;
 * falls back to parsing or wrapping `conflictBadge` string.
 */
export function getBadgesList(event: CalendarEvent | null | undefined): string[] {
  if (!event) return [];
  if (event.conflictBadges && event.conflictBadges.length > 0) {
    return event.conflictBadges;
  }
  if (event.conflictBadge && event.conflictBadge.trim().length > 0) {
    return event.conflictBadge
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
