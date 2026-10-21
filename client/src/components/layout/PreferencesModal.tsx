import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { UserProfile, Standing } from 'shared';

interface PreferencesModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile & { preferences: any }>) => Promise<void>;
}

interface PreferencesModalState {
  standing: Standing;
  major: string;
  minor: string;
  targetCredits: number;
  isSaving: boolean;
}

export class PreferencesModal extends BaseComponent<PreferencesModalProps, PreferencesModalState> {
  constructor(props: PreferencesModalProps) {
    super(props);
    this.state = {
      standing: (props.user?.standing as Standing) || 'Junior',
      major: props.user?.major || 'Computer Science B.S.',
      minor: props.user?.minor || '',
      targetCredits: 15,
      isSaving: false,
    };
  }

  componentDidUpdate(prevProps: PreferencesModalProps): void {
    if (this.props.user && this.props.user !== prevProps.user) {
      this.safeSetState({
        standing: (this.props.user.standing as Standing) || 'Junior',
        major: this.props.user.major || 'Computer Science B.S.',
        minor: this.props.user.minor || '',
      });
    }
  }

  handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    this.safeSetState({ isSaving: true });
    try {
      await this.props.onSave({
        standing: this.state.standing,
        major: this.state.major,
        minor: this.state.minor || null,
        preferences: {
          targetCredits: this.state.targetCredits,
        },
      });
      this.props.onClose();
    } finally {
      this.safeSetState({ isSaving: false });
    }
  };

  render() {
    const { isOpen, onClose } = this.props;
    const { standing, major, minor, targetCredits, isSaving } = this.state;

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">✏️</span>
              <h2 className="text-lg font-bold text-slate-800">Edit Degree & Scheduling Preferences</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={this.handleSave} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Class Standing
              </label>
              <select
                value={standing}
                onChange={(e) => this.safeSetState({ standing: e.target.value as Standing })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
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
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Target Unit Load ({targetCredits} Credits)
              </label>
              <input
                type="range"
                min="10"
                max="20"
                step="1"
                value={targetCredits}
                onChange={(e) => this.safeSetState({ targetCredits: parseInt(e.target.value, 10) })}
                className="w-full mt-2 accent-[#00B4DB]"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-[#00B4DB] hover:bg-[#0098ba] text-white text-sm font-bold rounded-xl shadow-md transition-all"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

