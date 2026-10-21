import React from 'react';
import { BaseFormView, BaseFormState } from '../components/base/BaseFormView';
import { StepIndicators } from '../components/onboarding/StepIndicators';
import { ProgressService } from '../services/progressService';
import { useAuthStore } from '../store/authStore';
import { withRouter, WithRouterProps } from '../utils/withRouter';
import {
  OnboardingQuestionnaire,
  Standing,
  GeSource,
  TargetTerm,
  Day,
} from 'shared';

const UCSC_LOWER_DIV_COURSES = [
  'CSE 12: Computer Systems & Assembly Language',
  'CSE 13S: Computer Systems & C Programming',
  'CSE 16: Applied Discrete Mathematics',
  'CSE 30: Programming Abstractions: Python',
  'MATH 19A: Calculus for Science & Engineering I',
  'MATH 19B: Calculus for Science & Engineering II',
  'AM 10: Mathematical Methods for Engineers I',
  'AM 20: Mathematical Methods for Engineers II',
];

const GE_CATEGORIES = [
  { code: 'CC', name: 'Cross-Cultural Analysis' },
  { code: 'ER', name: 'Ethnicity and Race' },
  { code: 'IM', name: 'Interpreting Arts and Media' },
  { code: 'SI', name: 'Scientific Inquiry' },
  { code: 'SR', name: 'Statistical Reasoning' },
  { code: 'TA', name: 'Textual Analysis' },
  { code: 'PE', name: 'Physical & Environmental Sciences' },
  { code: 'PR', name: 'Practice: Collaborative & Creative' },
  { code: 'C', name: 'Composition' },
];

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface OnboardingState extends BaseFormState {
  currentStep: number;
  skippedSteps: number[];
  formData: OnboardingQuestionnaire;
  isSkipHovered: boolean;
  isNextHovered: boolean;
  isLoading: boolean;
}

class OnboardingPageComponent extends BaseFormView<WithRouterProps, OnboardingState> {
  constructor(props: WithRouterProps) {
    super(props);
    const user = useAuthStore.getState().user;

    this.state = {
      currentStep: 1,
      skippedSteps: [],
      isLoading: true,
      isSubmitting: false,
      isSkipHovered: false,
      isNextHovered: false,
      errors: {},
      formData: {
        name: user?.name || '',
        email: user?.email || '',
        standing: (user?.standing as Standing) || 'Junior',
        major: user?.major || 'Computer Science B.S.',
        minor: user?.minor || '',
        intendedMajor: user?.intendedMajor || '',
        majorRequirementsTaken: [],
        geSource: 'UCSC',
        geCategoriesRemaining: ['CC', 'ER'],
        targetTerm: 'Winter 2027',
        targetCredits: 15,
        targetCourseCount: 3,
        earliestStartTime: '09:00',
        latestEndTime: '18:00',
        preferredFreeDays: ['Friday'],
        scheduledBreaks: [
          {
            label: 'Lunch Break',
            days: ['Monday', 'Wednesday', 'Friday'],
            startTime: '12:00',
            endTime: '13:00',
          },
        ],
      },
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    const user = useAuthStore.getState().user;
    if (user?.userId) {
      try {
        const progress = await ProgressService.getProgress(user.userId);
        if (progress.completed) {
          this.props.navigate('/dashboard');
          return;
        }

        this.safeSetState({
          currentStep: progress.lastStep || 1,
          skippedSteps: progress.skippedSteps || [],
          formData: {
            ...this.state.formData,
            ...(progress.draftAnswers || {}),
          },
          isLoading: false,
        });
      } catch {
        this.safeSetState({ isLoading: false });
      }
    } else {
      this.safeSetState({ isLoading: false });
    }
  }

  handleFieldChange = (field: keyof OnboardingQuestionnaire, value: any): void => {
    this.safeSetState((prev) => ({
      formData: {
        ...prev.formData,
        [field]: value,
      },
    }));
  };

  handleToggleCourse = (course: string): void => {
    const list = this.state.formData.majorRequirementsTaken || [];
    const updated = list.includes(course)
      ? list.filter((c) => c !== course)
      : [...list, course];
    this.handleFieldChange('majorRequirementsTaken', updated);
  };

  handleToggleGE = (code: string): void => {
    const list = this.state.formData.geCategoriesRemaining || [];
    const updated = list.includes(code)
      ? list.filter((c) => c !== code)
      : [...list, code];
    this.handleFieldChange('geCategoriesRemaining', updated);
  };

  handleToggleDay = (day: Day): void => {
    const list = this.state.formData.preferredFreeDays || [];
    const updated = list.includes(day)
      ? list.filter((d) => d !== day)
      : [...list, day];
    this.handleFieldChange('preferredFreeDays', updated);
  };

  saveCurrentProgress = async (nextStep: number, isSkipping: boolean = false, isCompleted: boolean = false): Promise<void> => {
    const user = useAuthStore.getState().user;
    if (!user?.userId) return;

    const skippedSteps = isSkipping
      ? Array.from(new Set([...this.state.skippedSteps, this.state.currentStep]))
      : this.state.skippedSteps.filter((s) => s !== this.state.currentStep);

    await ProgressService.saveProgress(user.userId, {
      lastStep: nextStep,
      skippedSteps,
      draftAnswers: this.state.formData,
      completed: isCompleted,
    });

    this.safeSetState({
      currentStep: nextStep,
      skippedSteps,
    });
  };

  handleNext = async (): Promise<void> => {
    this.safeSetState({ isSubmitting: true });
    try {
      if (this.state.currentStep < 5) {
        await this.saveCurrentProgress(this.state.currentStep + 1, false, false);
      } else {
        // Complete onboarding
        await this.saveCurrentProgress(5, false, true);
        this.props.navigate('/dashboard');
      }
    } finally {
      this.safeSetState({ isSubmitting: false });
    }
  };

  handleSkip = async (): Promise<void> => {
    this.safeSetState({ isSubmitting: true });
    try {
      if (this.state.currentStep < 5) {
        await this.saveCurrentProgress(this.state.currentStep + 1, true, false);
      } else {
        await this.saveCurrentProgress(5, true, true);
        this.props.navigate('/dashboard');
      }
    } finally {
      this.safeSetState({ isSubmitting: false });
    }
  };

  handleBack = (): void => {
    if (this.state.currentStep > 1) {
      this.safeSetState((prev) => ({ currentStep: prev.currentStep - 1 }));
    }
  };

  renderStepContent() {
    const { currentStep, formData } = this.state;

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Step 1: Personal & Academic Profile</h2>
            <p className="text-xs text-slate-500">Provide your basic degree information.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => this.handleFieldChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Class Standing</label>
                <select
                  value={formData.standing}
                  onChange={(e) => this.handleFieldChange('standing', e.target.value as Standing)}
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
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Primary Major</label>
                <input
                  type="text"
                  value={formData.major}
                  onChange={(e) => this.handleFieldChange('major', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Minor (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Bioinformatics"
                  value={formData.minor || ''}
                  onChange={(e) => this.handleFieldChange('minor', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Intended Major (Optional)</label>
                <input
                  type="text"
                  placeholder="For proposed students"
                  value={formData.intendedMajor || ''}
                  onChange={(e) => this.handleFieldChange('intendedMajor', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Step 2: Major Requirements Taken</h2>
            <p className="text-xs text-slate-500">Select prerequisite courses you have already completed or waived.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
              {UCSC_LOWER_DIV_COURSES.map((course) => {
                const code = course.split(':')[0];
                const isSelected = formData.majorRequirementsTaken?.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => this.handleToggleCourse(code)}
                    className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[#00B4DB] bg-[#E0F7FA] text-[#0098ba] font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{course}</span>
                      {isSelected && <span>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Step 3: General Education (GE) Status</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">GE Fulfillment Source</label>
              <div className="grid grid-cols-3 gap-3">
                {(['UCSC', 'Community College / IGETC', 'Hybrid'] as GeSource[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => this.handleFieldChange('geSource', src)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      formData.geSource === src
                        ? 'border-[#00B4DB] bg-[#00B4DB] text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {src}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Remaining GE Requirements</label>
              <div className="grid grid-cols-3 gap-2">
                {GE_CATEGORIES.map((cat) => {
                  const isSelected = formData.geCategoriesRemaining?.includes(cat.code);
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => this.handleToggleGE(cat.code)}
                      className={`p-2 rounded-lg border text-xs text-left transition-all ${
                        isSelected
                          ? 'border-[#FF6B6B] bg-[#FFEBEB] text-[#FF6B6B] font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <span className="font-bold">{cat.code}</span> — {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Step 4: Quarter Target & Unit Capacity</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Quarter</label>
                <select
                  value={formData.targetTerm}
                  onChange={(e) => this.handleFieldChange('targetTerm', e.target.value as TargetTerm)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="Fall 2026">Fall 2026</option>
                  <option value="Winter 2027">Winter 2027</option>
                  <option value="Spring 2027">Spring 2027</option>
                  <option value="Summer 2027">Summer 2027</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Credits ({formData.targetCredits} Units)</label>
                <input
                  type="range"
                  min="10"
                  max="20"
                  step="1"
                  value={formData.targetCredits}
                  onChange={(e) => this.handleFieldChange('targetCredits', parseInt(e.target.value, 10))}
                  className="w-full mt-2 accent-[#00B4DB]"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>10 (Part-time)</span>
                  <span>15 (Standard 3)</span>
                  <span>19+ (Overload 4)</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Step 5: Scheduling Preferences & Constraints</h2>
            <p className="text-xs text-slate-500">Define your preferred class hours and free days.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Earliest Start Time</label>
                <input
                  type="time"
                  value={formData.earliestStartTime || '09:00'}
                  onChange={(e) => this.handleFieldChange('earliestStartTime', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Latest End Time</label>
                <input
                  type="time"
                  value={formData.latestEndTime || '18:00'}
                  onChange={(e) => this.handleFieldChange('latestEndTime', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Preferred Free / Light Days</label>
              <div className="flex gap-2">
                {DAYS.map((day) => {
                  const isSelected = formData.preferredFreeDays?.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => this.handleToggleDay(day)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-[#F9CA24] bg-[#FFFDE7] text-slate-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  render() {
    const { currentStep, skippedSteps, isSubmitting, isSkipHovered, isNextHovered, isLoading } = this.state;

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-slate-500 font-medium">Loading questionnaire...</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <StepIndicators
            currentStep={currentStep}
            skippedSteps={skippedSteps}
            onStepClick={(s) => this.safeSetState({ currentStep: s })}
          />

          <div className="min-h-[300px] mb-8">{this.renderStepContent()}</div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={this.handleBack}
              disabled={currentStep === 1 || isSubmitting}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentStep === 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              ← Back
            </button>

            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={this.handleSkip}
                  onMouseEnter={() => this.safeSetState({ isSkipHovered: true })}
                  onMouseLeave={() => this.safeSetState({ isSkipHovered: false })}
                  disabled={isSubmitting}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isSkipHovered ? 'text-[#FF6B6B] bg-[#FFEBEB]' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Skip this step
                </button>
              )}

              <button
                type="button"
                onClick={this.handleNext}
                onMouseEnter={() => this.safeSetState({ isNextHovered: true })}
                onMouseLeave={() => this.safeSetState({ isNextHovered: false })}
                disabled={isSubmitting}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-all ${
                  isNextHovered
                    ? 'bg-[#0098ba] shadow-[#00B4DB]/30 scale-[1.02]'
                    : 'bg-[#00B4DB]'
                }`}
              >
                {isSubmitting ? 'Saving...' : currentStep === 5 ? 'Finish Onboarding' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export const OnboardingPage = withRouter(OnboardingPageComponent);

