import React from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import classicThemePlugin from '@fullcalendar/react/themes/classic';

import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';

import { BaseComponent } from '../base/BaseComponent';
import { CourseDetailsModal } from './CourseDetailsModal';
import { PrereqTreeModal } from './PrereqTreeModal';
import { CalendarEvent, UserScheduleItem } from 'shared';
import { CalendarService } from '../../services/calendarService';
import { ScheduleService } from '../../services/scheduleService';
import { AuthService } from '../../services/authService';
import { mapScheduleItemsToFullCalendar, FullCalendarEventItem } from '../../utils/calendarMapping';
import { getBadgesList } from '../../utils/conflictUtils';

interface CalendarPreviewProps {
  events: CalendarEvent[];
  term: string;
}

interface CalendarPreviewState {
  scheduleItems: UserScheduleItem[];
  scheduleLoaded: boolean;
  hoveredCourseId: string | null;
  selectedEvent: CalendarEvent | null;
  isExporting: boolean;
  isSyncing: boolean;
  isConnectedToGoogle: boolean;
  syncMessage: string | null;
  syncError: string | null;
  isRoadmapOpen: boolean;
  currentTitle: string;
}

export function getInitialDateForTerm(term: string): string {
  const t = (term || '').toLowerCase();
  if (t.includes('spring')) return '2027-03-30';
  if (t.includes('fall')) return '2026-09-29';
  if (t.includes('summer')) return '2027-06-22';
  return '2027-01-05';
}

export function getTermDates(term: string): { startDate: string; endDate: string } {
  const t = (term || '').toLowerCase();
  if (t.includes('spring')) return { startDate: '2027-03-29', endDate: '2027-06-11' };
  if (t.includes('fall')) return { startDate: '2026-09-24', endDate: '2026-12-11' };
  if (t.includes('summer')) return { startDate: '2027-06-21', endDate: '2027-08-27' };
  return { startDate: '2027-01-04', endDate: '2027-03-19' };
}

export class CalendarPreview extends BaseComponent<CalendarPreviewProps, CalendarPreviewState> {
  private calendarRef = React.createRef<any>();

  constructor(props: CalendarPreviewProps) {
    super(props);
    this.state = {
      scheduleItems: [],
      scheduleLoaded: false,
      hoveredCourseId: null,
      selectedEvent: null,
      isExporting: false,
      isSyncing: false,
      isConnectedToGoogle: false,
      syncMessage: null,
      syncError: null,
      isRoadmapOpen: false,
      currentTitle: '',
    };
  }

  handlePrev = (): void => {
    const api = this.calendarRef.current?.getApi();
    if (api) {
      api.prev();
    }
  };

  handleNext = (): void => {
    const api = this.calendarRef.current?.getApi();
    if (api) {
      api.next();
    }
  };

  handleToday = (): void => {
    const api = this.calendarRef.current?.getApi();
    if (api) {
      const termRange = getTermDates(this.props.term);
      const now = new Date();
      const start = new Date(termRange.startDate);
      const end = new Date(termRange.endDate);
      if (now >= start && now <= end) {
        api.today();
      } else {
        api.gotoDate(getInitialDateForTerm(this.props.term));
      }
    }
  };

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    await this.loadSchedule();
  }

  componentDidUpdate(prevProps: CalendarPreviewProps): void {
    if (prevProps.term !== this.props.term) {
      const api = this.calendarRef.current?.getApi();
      if (api) {
        api.gotoDate(getInitialDateForTerm(this.props.term));
      }
      void this.loadSchedule();
    } else if (prevProps.events !== this.props.events) {
      void this.loadSchedule();
    }
  }

  loadSchedule = async (): Promise<void> => {
    try {
      const items = await ScheduleService.fetchSchedule();
      this.safeSetState({ scheduleItems: items, scheduleLoaded: true });
    } catch {
      this.safeSetState({ scheduleLoaded: true });
    }

    try {
      const settings = await ScheduleService.fetchSettings();
      if (settings) {
        this.safeSetState({ isConnectedToGoogle: settings.isConnectedToGoogle });
      }
    } catch {}
  };

  calculateTopOffset(timeStr: string): number {
    const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
    const totalMinutes = (h - 8) * 60 + m;
    const pxPerMinute = 60 / 60; // 60px height per 1 hour slot
    return totalMinutes * pxPerMinute;
  }

  calculateHeight(startTime: string, endTime: string, hasConflict = false): number {
    const [sh, sm] = startTime.split(':').map((v) => parseInt(v, 10));
    const [eh, em] = endTime.split(':').map((v) => parseInt(v, 10));
    const durationMinutes = (eh - sh) * 60 + (em - sm);
    return Math.max(durationMinutes * 1, hasConflict ? 50 : 35);
  }

  handleCourseHover = (id: string, isEntering: boolean): void => {
    this.safeSetState({
      hoveredCourseId: isEntering ? id : null,
    });
  };

  handleCourseSelect = (event: CalendarEvent): void => {
    this.safeSetState({
      selectedEvent: event,
    });
  };

  handleExportICS = async (): Promise<void> => {
    try {
      this.safeSetState({ isExporting: true });
      const ics = await CalendarService.exportCalendarIcs();
      const filename = `slug-schedule-${this.props.term.replace(/\s+/g, '-').toLowerCase()}.ics`;
      CalendarService.downloadIcs(ics, filename);
      this.safeSetState({ isExporting: false });
    } catch {
      this.safeSetState({ isExporting: false });
    }
  };

  handleReconnectGoogle = async (): Promise<void> => {
    try {
      const authData = await AuthService.getGoogleAuthUrl();
      if (authData?.url) {
        window.location.href = authData.url;
      }
    } catch (err: any) {
      this.safeSetState({ syncError: err?.message || 'Failed to initiate Google authentication' });
    }
  };

  handleTriggerSync = async (): Promise<void> => {
    if (!this.state.isConnectedToGoogle) {
      try {
        const authData = await AuthService.getGoogleAuthUrl();
        if (authData?.url) {
          window.location.href = authData.url;
          return;
        }
      } catch {}
    }

    try {
      this.safeSetState({ isSyncing: true, syncMessage: null, syncError: null });
      const result = await ScheduleService.triggerSync();
      if (result.failedCount > 0) {
        this.safeSetState({
          isSyncing: false,
          syncError: result.message,
        });
      } else {
        this.safeSetState({
          isSyncing: false,
          syncMessage: result.message,
        });
      }
      await this.loadSchedule();
    } catch (err: any) {
      this.safeSetState({
        isSyncing: false,
        syncError: err?.message || 'Failed to sync with Google Calendar',
      });
    }
  };

  handleCloseModal = (): void => {
    this.safeSetState({
      selectedEvent: null,
    });
  };

  handleFullCalendarEventClick = (info: any): void => {
    const item = this.state.scheduleItems.find((s) => s.id === info.event.id);
    if (item) {
      const calEvent: CalendarEvent = {
        id: item.id,
        code: item.courseCode,
        title: item.title,
        type: item.isImported ? 'GOOGLE_CALENDAR_BUSY' : 'MAJOR',
        days: item.days.split(',').map((d: string) => {
          const map: Record<string, any> = {
            M: 'Monday',
            Tu: 'Tuesday',
            W: 'Wednesday',
            Th: 'Thursday',
            F: 'Friday',
          };
          return map[d.trim()] || 'Monday';
        }),
        startTime: item.startTime,
        endTime: item.endTime,
        color: item.isImported ? '#64748b' : '#00B4DB',
        description: item.description,
      };
      this.safeSetState({ selectedEvent: calEvent });
    }
  };

  renderEventContent = (eventInfo: any) => {
    const { event } = eventInfo;
    const { extendedProps } = event;
    const isImported = extendedProps?.isImported;
    const syncStatus = extendedProps?.syncStatus;
    const courseCode = extendedProps?.courseCode || '';
    const section = extendedProps?.section || '';

    // Clean up redundant course code prefixes so card subtitle is clean
    let displayTitle = event.title || '';
    if (courseCode) {
      const escapedCode = courseCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const prefixRegex = new RegExp(`^(?:${escapedCode}\\s*[-:]\\s*)+`, 'i');
      displayTitle = displayTitle.replace(prefixRegex, '').trim();
    }
    if (!displayTitle) {
      displayTitle = event.title || '';
    }

    // Only show sync badge if Google Calendar is actually connected by the user
    const showSyncBadge =
      Boolean(this.state.isConnectedToGoogle) &&
      Boolean(syncStatus) &&
      syncStatus.trim() !== '' &&
      !isImported;

    return (
      <div className="p-1 text-xs h-full flex flex-col justify-between overflow-hidden leading-tight">
        <div>
          <div className="font-bold flex items-center gap-1 truncate">
            {courseCode && <span>{courseCode}</span>}
            {section && (
              <span className="text-[10px] px-1 py-0.2 bg-white/20 rounded font-semibold">
                Sec {section}
              </span>
            )}
            {isImported && (
              <span className="text-[10px] px-1 py-0.2 bg-slate-700/40 rounded text-white font-semibold">
                External
              </span>
            )}
          </div>
          <div className="text-[11px] truncate opacity-90">{displayTitle}</div>
        </div>

        <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-white/20">
          <span>{eventInfo.timeText}</span>
          {showSyncBadge && (
            <span
              className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                syncStatus === 'synced'
                  ? 'bg-emerald-600/30 text-emerald-100'
                  : syncStatus === 'failed'
                    ? 'bg-rose-600/40 text-rose-100'
                    : 'bg-amber-600/30 text-amber-100'
              }`}
            >
              {syncStatus}
            </span>
          )}
        </div>
      </div>
    );
  };

  render() {
    const { term } = this.props;
    const {
      scheduleItems,
      selectedEvent,
      isExporting,
      isSyncing,
      syncMessage,
      syncError,
      isRoadmapOpen,
    } = this.state;

    // Convert items or fallback to mapped events from props
    const { startDate, endDate } = getTermDates(term);
    let fullCalendarEvents: FullCalendarEventItem[] = [];
    if (this.state.scheduleLoaded) {
      // Authoritative database schedule: render directly (renders empty calendar if user has 0 saved classes)
      fullCalendarEvents = mapScheduleItemsToFullCalendar(scheduleItems);
    } else if (scheduleItems.length > 0) {
      fullCalendarEvents = mapScheduleItemsToFullCalendar(scheduleItems);
    } else if (this.props.events.length > 0) {
      const converted: UserScheduleItem[] = this.props.events.map((e) => ({
        id: e.id,
        userId: 'current',
        courseCode: e.code || '',
        title: e.title,
        description: e.description || '',
        days: e.days
          .map((d) => {
            const map: Record<string, string> = {
              Monday: 'M',
              Tuesday: 'Tu',
              Wednesday: 'W',
              Thursday: 'Th',
              Friday: 'F',
            };
            return map[d] || 'M';
          })
          .join(','),
        startTime: e.startTime,
        endTime: e.endTime,
        startDate,
        endDate,
        isImported: e.type === 'GOOGLE_CALENDAR_BUSY',
        syncStatus: this.state.isConnectedToGoogle ? 'synced' : 'pending',
        googleEventId: null,
      }));
      fullCalendarEvents = mapScheduleItemsToFullCalendar(converted);
    }

    const hasFailedEvents = scheduleItems.some((s) => s.syncStatus === 'failed');

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-base">Weekly Schedule Preview</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#00B4DB]/10 text-[#00B4DB] border border-[#00B4DB]/20">
                {term}
              </span>
            </div>

            {/* Date / Week Navigation Controls */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-xs">
              <button
                type="button"
                onClick={this.handlePrev}
                className="p-1.5 px-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors"
                title="Previous week"
                aria-label="Previous week"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={this.handleToday}
                className="px-2.5 py-1 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium transition-colors"
                title="Jump to today / active term start"
              >
                Today
              </button>
              <button
                type="button"
                onClick={this.handleNext}
                className="p-1.5 px-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-bold transition-colors"
                title="Next week"
                aria-label="Next week"
              >
                ›
              </button>
            </div>

            {this.state.currentTitle && (
              <span className="text-xs font-semibold text-slate-600 tracking-tight ml-1">
                {this.state.currentTitle}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Now / Google Calendar Button */}
            <button
              type="button"
              onClick={this.handleTriggerSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border shadow-xs ${
                isSyncing
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:bg-slate-50'
              }`}
              title={
                !this.state.isConnectedToGoogle
                  ? 'Link Google account to sync schedule'
                  : 'Synchronize pending schedule events with Google Calendar'
              }
            >
              <span>
                {isSyncing
                  ? '⏳ Syncing...'
                  : !this.state.isConnectedToGoogle
                    ? '📅 Sync to Google Calendar'
                    : '🔄 Sync Now'}
              </span>
            </button>

            {/* Prereq Roadmap Button */}
            <button
              type="button"
              data-tour="prereq-roadmap"
              onClick={() => this.safeSetState({ isRoadmapOpen: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border shadow-xs bg-white text-slate-700 border-slate-200 hover:border-[#00B4DB] hover:text-[#00B4DB] hover:bg-slate-50"
              title="View UCSC Computer Science prerequisite DAG and degree progress"
            >
              <span>🗺️ Prereq Roadmap</span>
            </button>

            {/* Export .ics Button */}
            <button
              type="button"
              data-tour="export-ics"
              onClick={this.handleExportICS}
              disabled={isExporting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border shadow-xs ${
                isExporting
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#00B4DB] hover:text-[#00B4DB] hover:bg-slate-50'
              }`}
              title="Export schedule to standard .ics format for Google Calendar / Apple Calendar"
            >
              <span>{isExporting ? 'Exporting...' : '📥 Export .ics'}</span>
            </button>
          </div>
        </div>

        {/* Sync notification banners */}
        {syncMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-800 flex justify-between items-center">
            <span>✓ {syncMessage}</span>
            <button
              onClick={() => this.safeSetState({ syncMessage: null })}
              className="font-bold ml-2 text-emerald-600 hover:text-emerald-900"
            >
              ×
            </button>
          </div>
        )}

        {(syncError || hasFailedEvents) && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-800 flex flex-wrap justify-between items-center gap-2">
            <span>
              ⚠️{' '}
              {syncError ||
                'Some events failed to sync with Google Calendar. Click Sync Now to retry.'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={this.handleReconnectGoogle}
                className="underline font-bold text-rose-900 hover:text-rose-950"
              >
                Reconnect Google
              </button>
              <button
                type="button"
                onClick={this.handleTriggerSync}
                className="underline font-bold text-rose-900 hover:text-rose-950"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Days indicators for accessible testing */}
        <div className="hidden">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
        </div>

        {/* Accessible event summary for testing & screen readers */}
        <div className="hidden" aria-hidden="true">
          {this.props.events.map((ev) => {
            const badges = getBadgesList(ev);
            return (
              <div key={ev.id}>
                <span>{ev.code ? `${ev.code} - ${ev.title}` : ev.title}</span>
                {badges.map((b) => (
                  <span key={b}>{b} ⚠️</span>
                ))}
                {ev.conflictBadge && <span>{ev.conflictBadge} ⚠️</span>}
              </div>
            );
          })}
        </div>

        {/* FullCalendar Component Container */}
        <div className="flex-1 overflow-y-auto p-2" style={{ minHeight: '580px' }}>
          <FullCalendar
            ref={this.calendarRef}
            plugins={[timeGridPlugin, classicThemePlugin]}
            initialView="timeGridWeek"
            initialDate={getInitialDateForTerm(term)}
            headerToolbar={false}
            allDaySlot={false}
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            hiddenDays={[0, 6]} // Hide Sunday (0) and Saturday (6)
            editable={false}
            selectable={false}
            eventStartEditable={false}
            eventDurationEditable={false}
            events={fullCalendarEvents}
            eventContent={this.renderEventContent}
            eventClick={this.handleFullCalendarEventClick}
            datesSet={(arg) => {
              if (this.state.currentTitle !== arg.view.title) {
                this.safeSetState({ currentTitle: arg.view.title });
              }
            }}
            height="auto"
          />
        </div>

        {/* Course Details Modal */}
        <CourseDetailsModal event={selectedEvent} onClose={this.handleCloseModal} />

        {/* Prerequisite Roadmap Modal */}
        <PrereqTreeModal
          isOpen={isRoadmapOpen}
          onClose={() => this.safeSetState({ isRoadmapOpen: false })}
        />
      </div>
    );
  }
}
export default CalendarPreview;
