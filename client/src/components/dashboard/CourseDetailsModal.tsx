import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { CalendarEvent } from 'shared';

interface CourseDetailsModalProps {
  event: CalendarEvent | null;
  onClose: () => void;
}

export class CourseDetailsModal extends BaseComponent<CourseDetailsModalProps> {
  render() {
    const { event, onClose } = this.props;
    if (!event) return null;

    const isMajor = event.type === 'MAJOR';
    const isGE = event.type === 'GE';
    const badgeColor = isMajor
      ? 'bg-[#E0F7FA] text-[#0098ba]'
      : isGE
      ? 'bg-[#FFEBEB] text-[#FF6B6B]'
      : 'bg-[#FFFDE7] text-[#e5b613]';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-start justify-between">
            <div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${badgeColor}`}>
                {event.type}
              </span>
              <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-4 text-sm text-slate-600">
            {event.instructor && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Instructor:</span>
                <span className="font-semibold text-slate-800">{event.instructor}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Location:</span>
                <span className="font-semibold text-slate-800">{event.location}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Meeting Days:</span>
              <span className="font-semibold text-slate-800">{event.days.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Time:</span>
              <span className="font-semibold text-slate-800">{event.startTime} – {event.endTime}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}

