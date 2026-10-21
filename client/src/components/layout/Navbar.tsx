import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { UserProfile } from 'shared';

interface NavbarProps {
  user: UserProfile | null;
  activeTerm: string;
  onOpenPreferences: () => void;
  onLogout: () => void;
}

interface NavbarState {
  isPrefHovered: boolean;
}

export class Navbar extends BaseComponent<NavbarProps, NavbarState> {
  constructor(props: NavbarProps) {
    super(props);
    this.state = { isPrefHovered: false };
  }

  render() {
    const { user, activeTerm, onOpenPreferences, onLogout } = this.props;
    const { isPrefHovered } = this.state;

    return (
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
        {/* Left: Branding & Reserved Logo Space */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00B4DB] flex items-center justify-center text-white text-lg font-bold shadow-md shadow-[#00B4DB]/20">
            🐌
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
              <span>SlugSchedule</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                UCSC
              </span>
            </h1>
            <span className="text-[11px] text-slate-400 font-medium">Smart Degree & Calendar Planner</span>
          </div>
        </div>

        {/* Center: Active Term Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-xs font-semibold text-slate-600">
          <span className="w-2 h-2 rounded-full bg-[#00B4DB]"></span>
          <span>Target: {activeTerm}</span>
        </div>

        {/* Right: Preferences Trigger & User Actions */}
        <div className="flex items-center gap-3">
          {/* Edit Preferences Button */}
          <button
            type="button"
            onClick={onOpenPreferences}
            onMouseEnter={() => this.safeSetState({ isPrefHovered: true })}
            onMouseLeave={() => this.safeSetState({ isPrefHovered: false })}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
              isPrefHovered
                ? 'border-[#F9CA24] bg-[#FFFDE7] text-slate-900 shadow-sm scale-[1.02]'
                : 'border-[#00B4DB] bg-white text-[#0098ba] hover:bg-[#E0F7FA]'
            }`}
          >
            <span>✏️</span>
            <span>Edit Preferences</span>
          </button>

          {/* User Account Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SL'}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-semibold text-slate-400 hover:text-[#FF6B6B] transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
    );
  }
}

