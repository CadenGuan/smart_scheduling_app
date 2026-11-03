import { apiClient } from './apiClient';

export class CalendarService {
  /**
   * Fetches the RFC 5545 .ics calendar content from the server export endpoint.
   */
  static async exportCalendarIcs(): Promise<string> {
    return apiClient.getText('/api/calendar/export');
  }

  /**
   * Triggers a browser download of an .ics file string.
   */
  static downloadIcs(content: string, filename: string = 'slug-schedule.ics'): void {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      !window.URL ||
      typeof window.URL.createObjectURL !== 'function'
    ) {
      return;
    }
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
