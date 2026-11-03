import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { CourseCard } from './CourseCard';
import { CourseDetailsModal } from './CourseDetailsModal';
import { PrereqTreeModal } from './PrereqTreeModal';
import { DeadlinesModal } from './DeadlinesModal';
import { CalendarEvent, Day } from 'shared';
import { CalendarService } from '../../services/calendarService';

interface CalendarPreviewProps {
  events: CalendarEvent[];
  term: string;
}

interface CalendarPreviewState {
  hoveredCourseId: string | null;
  selectedEvent: CalendarEvent | null;
  isExporting: boolean;
  isRoadmapOpen: boolean;
  isDeadlinesOpen: boolean;
}

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

export class CalendarPreview extends BaseComponent<CalendarPreviewProps, CalendarPreviewState> {
  constructor(props: CalendarPreviewProps) {
    super(props);
    this.state = {
      hoveredCourseId: null,
      selectedEvent: null,
      isExporting: false,
      isRoadmapOpen: false,
      isDeadlinesOpen: false,
    };
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

  handleCloseModal = (): void => {
    this.safeSetState({
      selectedEvent: null,
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

  // Convert HH:MM to minute offset from 8:00 AM
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

  render() {
    const { events, term } = this.props;
    const { hoveredCourseId, selectedEvent, isExporting, isRoadmapOpen, isDeadlinesOpen } =
      this.state;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-slate-800 text-base">Weekly Schedule Preview</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#00B4DB]/10 text-[#00B4DB] border border-[#00B4DB]/20">
              {term}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#00B4DB] inline-block"></span>
                <span>Major</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#FF6B6B] inline-block"></span>
                <span>GE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#F9CA24] inline-block"></span>
                <span>Busy</span>
              </div>
            </div>

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

            {/* Conference & Research Deadlines Button */}
            <button
              type="button"
              onClick={() => this.safeSetState({ isDeadlinesOpen: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border shadow-xs bg-white text-slate-700 border-slate-200 hover:border-[#00B4DB] hover:text-[#00B4DB] hover:bg-slate-50"
              title="View CS research conference deadlines and undergraduate symposiums"
            >
              <span>🎯 Deadlines</span>
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

        {/* Grid Container */}
        <div className="flex-1 overflow-y-auto max-h-[680px]">
          <div className="grid grid-cols-[60px_repeat(5,1fr)] min-w-[700px] border-b border-slate-100">
            {/* Header row */}
            <div className="p-3 text-center border-r border-slate-100 font-semibold text-xs text-slate-400 bg-slate-50">
              Time
            </div>
            {DAYS.map((day) => (
              <div
                key={day}
                className="p-3 text-center font-bold text-xs uppercase tracking-wider text-slate-700 border-r border-slate-100 bg-slate-50 last:border-r-0"
              >
                {day.slice(0, 3)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[60px_repeat(5,1fr)] min-w-[700px] relative">
            {/* Hour time labels column */}
            <div className="border-r border-slate-100 bg-slate-50/30">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] text-[11px] font-medium text-slate-400 text-right pr-2 pt-1 border-b border-slate-100"
                >
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}
                </div>
              ))}
            </div>

            {/* 5 Day Columns */}
            {DAYS.map((day) => {
              const dayEvents = events.filter((e) => e.days.includes(day));

              return (
                <div key={day} className="relative border-r border-slate-100 last:border-r-0">
                  {/* Background hour slot lines */}
                  {HOURS.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-slate-100/70"></div>
                  ))}

                  {/* Rendered Event Cards */}
                  {dayEvents.map((ev) => {
                    const top = this.calculateTopOffset(ev.startTime);
                    const hasConflict = Boolean(
                      ev.conflictBadge || (ev.conflictBadges && ev.conflictBadges.length > 0)
                    );
                    const height = this.calculateHeight(ev.startTime, ev.endTime, hasConflict);

                    return (
                      <CourseCard
                        key={`${ev.id}-${day}`}
                        event={ev}
                        isHoveredGlobally={hoveredCourseId === ev.id}
                        onHover={this.handleCourseHover}
                        onClick={this.handleCourseSelect}
                        style={{ top: `${top}px`, height: `${height}px` }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Course Details Modal */}
        <CourseDetailsModal event={selectedEvent} onClose={this.handleCloseModal} />

        {/* Prerequisite Roadmap Modal */}
        <PrereqTreeModal
          isOpen={isRoadmapOpen}
          onClose={() => this.safeSetState({ isRoadmapOpen: false })}
        />

        {/* Research & Conference Deadlines Modal */}
        <DeadlinesModal
          isOpen={isDeadlinesOpen}
          onClose={() => this.safeSetState({ isDeadlinesOpen: false })}
        />
      </div>
    );
  }
}
