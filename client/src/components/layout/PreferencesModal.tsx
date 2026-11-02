import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { UserProfile, UserPreferences, Standing, Day, TargetTerm } from 'shared';

const WEEKDAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const AVAILABLE_TERMS: TargetTerm[] = ['Fall 2026', 'Winter 2027', 'Spring 2027', 'Summer 2027'];

interface PreferencesModalProps {
  isOpen: boolean;
  user: (UserProfile & { preferences?: UserPreferences }) | null;
  onClose: () => void;
  onSave: (
    updates: Partial<UserProfile & { preferences: Partial<UserPreferences> }>
  ) => Promise<void>;
}

interface PreferencesModalState {
  standing: Standing;
  major: string;
  minor: string;
  targetTerm: TargetTerm;
  targetCredits: number;
  earliestStartTime: string;
  latestEndTime: string;
  preferredFreeDays: Day[];
  maxBackToBackHours: number;
  validationError: string | null;
  isSaving: boolean;
}

export class PreferencesModal extends BaseComponent<PreferencesModalProps, PreferencesModalState> {
  constructor(props: PreferencesModalProps) {
    super(props);
    const pref = (props.user?.preferences || {}) as Partial<UserPreferences>;
    this.state = {
      standing: (props.user?.standing as Standing) || 'Junior',
      major: props.user?.major || 'Computer Science B.S.',
      minor: props.user?.minor || '',
      targetTerm: (pref.targetTerm as TargetTerm) || 'Winter 2027',
      targetCredits: pref.targetCredits ?? 15,
      earliestStartTime: pref.earliestStartTime || '09:00',
      latestEndTime: pref.latestEndTime || '17:00',
      preferredFreeDays: pref.preferredFreeDays || [],
      maxBackToBackHours: pref.maxBackToBackHours ?? 3,
      validationError: null,
      isSaving: false,
    };
  }

  componentDidUpdate(prevProps: PreferencesModalProps): void {
    if (this.props.user && this.props.user !== prevProps.user) {
      const pref = (this.props.user.preferences || {}) as Partial<UserPreferences>;
      this.safeSetState({
        standing: (this.props.user.standing as Standing) || 'Junior',
        major: this.props.user.major || 'Computer Science B.S.',
        minor: this.props.user.minor || '',
        targetTerm: (pref.targetTerm as TargetTerm) || 'Winter 2027',
        targetCredits: pref.targetCredits ?? 15,
        earliestStartTime: pref.earliestStartTime || '09:00',
        latestEndTime: pref.latestEndTime || '17:00',
        preferredFreeDays: pref.preferredFreeDays || [],
        maxBackToBackHours: pref.maxBackToBackHours ?? 3,
        validationError: null,
      });
    }
  }

  handleDayToggle = (day: Day): void => {
    const current = [...this.state.preferredFreeDays];
    const index = current.indexOf(day);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(day);
    }
    this.safeSetState({ preferredFreeDays: current });
  };

  handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const { earliestStartTime, latestEndTime } = this.state;

    // Time window sanity check
    if (earliestStartTime && latestEndTime && earliestStartTime > latestEndTime) {
      this.safeSetState({
        validationError: 'Earliest start time must not be later than latest end time.',
      });
      return;
    }

    this.safeSetState({ isSaving: true, validationError: null });
    try {
      await this.props.onSave({
        standing: this.state.standing,
        major: this.state.major,
        minor: this.state.minor || null,
        preferences: {
          targetTerm: this.state.targetTerm,
          targetCredits: this.state.targetCredits,
          earliestStartTime: this.state.earliestStartTime,
          latestEndTime: this.state.latestEndTime,
          preferredFreeDays: this.state.preferredFreeDays,
          maxBackToBackHours: this.state.maxBackToBackHours,
        },
      });
      this.props.onClose();
    } catch (err: any) {
      this.safeSetState({
        validationError: err?.message || 'Failed to update preferences. Please check your inputs.',
      });
    } finally {
      this.safeSetState({ isSaving: false });
    }
  };

  render() {
    const { isOpen, onClose } = this.props;
    const {
      standing,
      major,
      minor,
      targetTerm,
      targetCredits,
      earliestStartTime,
      latestEndTime,
      preferredFreeDays,
      maxBackToBackHours,
      validationError,
      isSaving,
    } = this.state;

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-[#E0F7FA] rounded-xl text-[#0098ba]">✏️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Refine Degree & Scheduling Preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Tailor your graduation roadmap and dynamic calendar engine
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={this.handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <span>⚠️</span>
                <span>{validationError}</span>
              </div>
            )}

            {/* Section 1: Degree Profile */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>🎓 Section 1: Academic Profile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Class Standing
                  </label>
                  <select
                    value={standing}
                    onChange={(e) => this.safeSetState({ standing: e.target.value as Standing })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                  >
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Graduate">Graduate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Declared Major
                  </label>
                  <input
                    type="text"
                    required
                    value={major}
                    onChange={(e) => this.safeSetState({ major: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Minor (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Technology & Information Management"
                  value={minor}
                  onChange={(e) => this.safeSetState({ minor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                />
              </div>
            </div>

            {/* Section 2: Quarter Capacity */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>⚡ Section 2: Quarter Capacity</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Target Quarter Term
                  </label>
                  <select
                    value={targetTerm}
                    onChange={(e) =>
                      this.safeSetState({ targetTerm: e.target.value as TargetTerm })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                  >
                    {AVAILABLE_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase">
                      Target Unit Load
                    </label>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E0F7FA] text-[#0098ba]">
                      {targetCredits} Credits
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="20"
                    step="1"
                    value={targetCredits}
                    onChange={(e) =>
                      this.safeSetState({ targetCredits: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-[#00B4DB] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>10 (Part/Light)</span>
                    <span>15 (Normal)</span>
                    <span>20 (Heavy)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Time & Day Constraints */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>⏰ Section 3: Time & Day Constraints</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Earliest Class Start
                  </label>
                  <input
                    type="time"
                    value={earliestStartTime}
                    onChange={(e) => this.safeSetState({ earliestStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Latest Class End
                  </label>
                  <input
                    type="time"
                    value={latestEndTime}
                    onChange={(e) => this.safeSetState({ latestEndTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                  Preferred Free Days (No Classes Requested)
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const isSelected = preferredFreeDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => this.handleDayToggle(day)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-[#00B4DB] text-white border-[#00B4DB] shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : ''}
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Max Back-to-Back Hours ({maxBackToBackHours} Hours)
                </label>
                <select
                  value={maxBackToBackHours}
                  onChange={(e) =>
                    this.safeSetState({ maxBackToBackHours: parseInt(e.target.value, 10) })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-[#00B4DB] focus:outline-none"
                >
                  <option value={1}>1 Hour</option>
                  <option value={2}>2 Hours</option>
                  <option value={3}>3 Hours (Standard)</option>
                  <option value={4}>4 Hours</option>
                  <option value={5}>5 Hours</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white py-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00B4DB] hover:bg-[#0098ba] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
