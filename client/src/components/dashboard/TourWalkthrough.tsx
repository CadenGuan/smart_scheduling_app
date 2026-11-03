import React from 'react';
import { BaseComponent } from '../base/BaseComponent';

export interface TourStep {
  title: string;
  description: string;
  targetSelector?: string;
  icon: string;
  highlightLabel?: string;
}

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    icon: '🎓',
    title: 'Welcome to SlugSchedule!',
    description:
      'Your interactive UCSC degree planner and dynamic schedule generator. Let us take a quick 1-minute tour of your intelligent advising dashboard.',
    highlightLabel: 'Dashboard Overview',
  },
  {
    icon: '📅',
    title: 'Balanced Weekly Calendar Preview',
    description:
      'Your schedule preview is calculated by our constraint engine to match your target unit load, eliminate time collisions, and honor your preferred free days and hours.',
    targetSelector: '[data-tour="calendar-preview"]',
    highlightLabel: 'Weekly Timetable',
  },
  {
    icon: '🗺️',
    title: 'Prerequisite Hierarchy & Degree Roadmap',
    description:
      'Click "Prereq Roadmap" in the calendar header to explore all 18 UCSC CS core courses arranged across 5 tiers, verify completed coursework, and view unblocked next steps.',
    targetSelector: '[data-tour="prereq-roadmap"]',
    highlightLabel: 'Curriculum DAG',
  },
  {
    icon: '📥',
    title: 'Standard Calendar Export (.ics)',
    description:
      'Click "Export .ics" to download your schedule into standard RFC 5545 format for Google Calendar or Apple Calendar, complete with 15-minute reminders and milestone alerts!',
    targetSelector: '[data-tour="export-ics"]',
    highlightLabel: 'Calendar Sync',
  },
  {
    icon: '🐌',
    title: 'Sammy Slug AI Advising Workspace',
    description:
      'Chat with Sammy Slug! Ask "Why this course?", say "This is too much" to lighten your schedule in real-time, or check the downstream impact if you need to drop a class.',
    targetSelector: '[data-tour="agent-workspace"]',
    highlightLabel: 'AI Advising Agent',
  },
  {
    icon: '⚙️',
    title: 'Preferences & Device Portability',
    description:
      'Click "Edit Preferences" anytime to update unit caps, adjust preferred times, or use the Import/Export JSON buttons to back up and restore your degree plan across devices.',
    targetSelector: '[data-tour="navbar-preferences"]',
    highlightLabel: 'Degree Settings',
  },
];

interface TourWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  steps?: TourStep[];
}

interface TourWalkthroughState {
  currentStepIndex: number;
}

export class TourWalkthrough extends BaseComponent<TourWalkthroughProps, TourWalkthroughState> {
  constructor(props: TourWalkthroughProps) {
    super(props);
    this.state = {
      currentStepIndex: 0,
    };
  }

  componentDidMount(): void {
    super.componentDidMount();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  componentWillUnmount(): void {
    super.componentWillUnmount();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
  }

  handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.props.isOpen) return;
    if (e.key === 'Escape') {
      this.handleSkip();
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      this.handleNext();
    } else if (e.key === 'ArrowLeft') {
      this.handleBack();
    }
  };

  handleNext = (): void => {
    const steps = this.props.steps || DASHBOARD_TOUR_STEPS;
    if (this.state.currentStepIndex < steps.length - 1) {
      this.safeSetState((prev) => ({ currentStepIndex: prev.currentStepIndex + 1 }));
    } else {
      this.handleFinish();
    }
  };

  handleBack = (): void => {
    if (this.state.currentStepIndex > 0) {
      this.safeSetState((prev) => ({ currentStepIndex: prev.currentStepIndex - 1 }));
    }
  };

  handleSkip = (): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hasSeenDashboardTour', 'true');
    }
    this.props.onClose();
  };

  handleFinish = (): void => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('hasSeenDashboardTour', 'true');
    }
    this.props.onClose();
  };

  render() {
    const { isOpen } = this.props;
    if (!isOpen) return null;

    const steps = this.props.steps || DASHBOARD_TOUR_STEPS;
    const { currentStepIndex } = this.state;
    const currentStep = steps[currentStepIndex];
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === steps.length - 1;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
        {/* Modal Card */}
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-[#00B4DB] to-[#0083B0] p-6 text-white relative">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-bold tracking-wide">
                {currentStep.highlightLabel || `Tour Step ${currentStepIndex + 1}`}
              </span>
              <button
                type="button"
                onClick={this.handleSkip}
                className="text-white/80 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Skip tour (Esc)"
              >
                Skip Tour ✕
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-4xl p-2.5 rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
                {currentStep.icon}
              </span>
              <div>
                <h3 className="text-lg font-extrabold leading-snug">{currentStep.title}</h3>
                <span className="text-xs text-white/80 font-medium">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <p className="text-slate-600 text-sm leading-relaxed">{currentStep.description}</p>

            {/* Progress Dots */}
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => this.safeSetState({ currentStepIndex: idx })}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'w-6 bg-[#00B4DB]'
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  aria-label={`Jump to step ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={this.handleBack}
              disabled={isFirst}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
            >
              ← Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={this.handleNext}
                className="px-5 py-2.5 rounded-xl bg-[#00B4DB] hover:bg-[#0098ba] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
              >
                {isLast ? 'Finish Tour 🚀' : 'Next Step →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
