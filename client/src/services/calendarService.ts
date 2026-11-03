import { apiClient } from './apiClient';
import { CalendarEvent, ConferenceDeadline } from 'shared';

export class CalendarService {
  /**
   * Fetches the RFC 5545 .ics calendar content from the server export endpoint.
   */
  static async exportCalendarIcs(): Promise<string> {
    return apiClient.getText('/api/calendar/export');
  }

  /**
   * Fetches the UCSC CS curriculum prerequisite DAG and student degree progress.
   */
  static async getCurriculumDag(): Promise<{
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
  }> {
    const res = await apiClient.get<{ success: boolean; data: any }>('/api/calendar/curriculum');
    return res.data;
  }

  /**
   * Fetches the consolidated list of academic and research conference deadlines.
   */
  static async getConferenceDeadlines(
    topic?: string,
    tier?: string
  ): Promise<{
    totalCount: number;
    deadlines: ConferenceDeadline[];
    topics: string[];
  }> {
    const params = new URLSearchParams();
    if (topic && topic !== 'ALL') params.set('topic', topic);
    if (tier && tier !== 'ALL') params.set('tier', tier);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<{ success: boolean; data: any }>(
      `/api/calendar/deadlines${qs}`
    );
    return res.data;
  }

  /**
   * Exports academic and conference deadlines into an RFC 5545 .ics string.
   */
  static async exportDeadlinesIcs(topic?: string, tier?: string): Promise<string> {
    const params = new URLSearchParams();
    if (topic && topic !== 'ALL') params.set('topic', topic);
    if (tier && tier !== 'ALL') params.set('tier', tier);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.getText(`/api/calendar/deadlines/export${qs}`);
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

  /**
   * Saves custom or agent-proposed schedule courses to persistent database storage.
   */
  static async saveCustomSchedule(
    events: CalendarEvent[],
    term: string = 'Winter 2027'
  ): Promise<void> {
    await apiClient.post('/api/calendar/events', { events, term });
  }

  /**
   * Fetches saved custom schedule courses for the user.
   */
  static async getCustomSchedule(term?: string): Promise<CalendarEvent[]> {
    const qs = term ? `?term=${encodeURIComponent(term)}` : '';
    const res = await apiClient.get<{ success: boolean; data: CalendarEvent[] }>(
      `/api/calendar/events${qs}`
    );
    return res.data;
  }

  /**
   * Clears saved custom schedule courses for the user.
   */
  static async clearCustomSchedule(term?: string): Promise<void> {
    const qs = term ? `?term=${encodeURIComponent(term)}` : '';
    await apiClient.delete(`/api/calendar/events${qs}`);
  }
}
