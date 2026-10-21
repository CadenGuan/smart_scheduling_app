import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { UserProfile } from 'shared';

interface AgentPlaceholderProps {
  user: UserProfile | null;
}

export class AgentPlaceholder extends BaseComponent<AgentPlaceholderProps> {
  render() {
    const { user } = this.props;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
        {/* Agent Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00B4DB] to-[#0098ba] flex items-center justify-center text-white text-xl shadow-md">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">SlugAgent Assistant</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FFEBEB] text-[#FF6B6B] border border-[#FF6B6B]/20">
                Sprint 2 Preview
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Schedule Optimizer</p>
          </div>
        </div>

        {/* Profile Snapshot */}
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Student:</span>
            <span className="font-bold text-slate-700">{user?.name || 'Sammy Slug'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Standing / Major:</span>
            <span className="font-bold text-slate-700">{user?.standing} • {user?.major}</span>
          </div>
        </div>

        {/* Informative Preview Card */}
        <div className="flex-1 bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-200/80 p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              In <strong className="text-[#00B4DB]">Sprint 2</strong>, this panel will host your interactive AI scheduling partner.
              The agent will negotiate complex degree prerequisites, balance workload capacity, and inspect Google Calendar busy windows.
            </p>

            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Planned Agent Capabilities:
              </span>
              <div className="space-y-1.5">
                {[
                  'Explain recommendation justifications',
                  'Drop a course & analyze downstream impact',
                  'Find shortest prerequisite path to targets',
                  'Adjust to capacity limits ("This is too much")',
                ].map((cap, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="text-[#00B4DB] font-bold">›</span>
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Preview Chips */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Sample Prompt Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Why did you choose CSE 115A?',
                'Move Friday classes',
                'Find a lighter GE',
              ].map((chip, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 cursor-not-allowed opacity-80"
                >
                  💡 {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Input Placeholder Box */}
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              type="text"
              disabled
              placeholder="Agent integration coming in Sprint 2..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 cursor-not-allowed"
            />
            <button
              disabled
              className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }
}

