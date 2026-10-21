import React from 'react';
import { BaseComponent } from '../base/BaseComponent';

interface StepIndicatorsProps {
  currentStep: number;
  skippedSteps: number[];
  onStepClick: (step: number) => void;
}

const STEPS = [
  { step: 1, title: 'Profile' },
  { step: 2, title: 'History' },
  { step: 3, title: 'GEs' },
  { step: 4, title: 'Term' },
  { step: 5, title: 'Preferences' },
];

export class StepIndicators extends BaseComponent<StepIndicatorsProps> {
  render() {
    const { currentStep, skippedSteps, onStepClick } = this.props;

    return (
      <div className="w-full mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded"></div>
          {STEPS.map((s) => {
            const isCompleted = s.step < currentStep && !skippedSteps.includes(s.step);
            const isCurrent = s.step === currentStep;
            const isSkipped = skippedSteps.includes(s.step);

            let bgClass = 'bg-white border-2 border-slate-300 text-slate-500';
            if (isCurrent) {
              bgClass = 'bg-[#F9CA24] border-2 border-[#e5b613] text-slate-900 shadow-md ring-4 ring-[#F9CA24]/20';
            } else if (isCompleted) {
              bgClass = 'bg-[#00B4DB] border-2 border-[#0098ba] text-white shadow-sm';
            } else if (isSkipped) {
              bgClass = 'bg-[#FFEBEB] border-2 border-[#FF6B6B] text-[#FF6B6B]';
            }

            return (
              <button
                key={s.step}
                type="button"
                onClick={() => onStepClick(s.step)}
                className="flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 ${bgClass}`}
                >
                  {isCompleted ? '✓' : isSkipped ? '–' : s.step}
                </div>
                <span
                  className={`text-[11px] mt-2 font-medium tracking-wide transition-colors ${
                    isCurrent ? 'text-slate-900 font-bold' : 'text-slate-500'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

