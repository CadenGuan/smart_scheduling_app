import { apiClient } from './apiClient';

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
