import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { CalendarService } from '../../services/calendarService';
import { CurriculumNode } from 'shared';

interface PrereqTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PrereqTreeModalState {
  nodes: CurriculumNode[];
  edges: Array<[string, string]>;
  major: string;
  totalCoreCount: number;
  completedCount: number;
  progressPercentage: number;
  readyToEnroll: string[];
  selectedCode: string | null;
  activeTier: number | 'ALL';
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
}

const TIER_NAMES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Tier 1: Foundations', subtitle: 'Calculus, Beginning Python & Computer Systems' },
  2: {
    title: 'Tier 2: Lower Division Core',
    subtitle: 'Discrete Math, Linear Algebra & C Systems',
  },
  3: {
    title: 'Tier 3: Core Gatekeeper',
    subtitle: 'CSE 101 Data Structures (Unlocks Upper Division)',
  },
  4: {
    title: 'Tier 4: Upper Division Core & Electives',
    subtitle: 'Algorithms, Systems, Architecture & Software',
  },
  5: {
    title: 'Tier 5: Capstone Experience',
    subtitle: 'CSE 115B Senior Software Engineering Project',
  },
};

export class PrereqTreeModal extends BaseComponent<PrereqTreeModalProps, PrereqTreeModalState> {
  constructor(props: PrereqTreeModalProps) {
    super(props);
    this.state = {
      nodes: [],
      edges: [],
      major: 'Computer Science B.S.',
      totalCoreCount: 18,
      completedCount: 0,
      progressPercentage: 0,
      readyToEnroll: [],
      selectedCode: null,
      activeTier: 'ALL',
      searchQuery: '',
      isLoading: true,
      error: null,
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    if (this.props.isOpen) {
      await this.loadCurriculum();
    }
  }

  async componentDidUpdate(prevProps: PrereqTreeModalProps): Promise<void> {
    if (this.props.isOpen && !prevProps.isOpen) {
      await this.loadCurriculum();
    }
  }

  loadCurriculum = async (): Promise<void> => {
    try {
      this.safeSetState({ isLoading: true, error: null });
      const data = await CalendarService.getCurriculumDag();
      this.safeSetState({
        nodes: data.nodes,
        edges: data.edges,
        major: data.major,
        totalCoreCount: data.totalCoreCount,
        completedCount: data.completedCount,
        progressPercentage: data.progressPercentage,
        readyToEnroll: data.readyToEnroll,
        isLoading: false,
      });
    } catch {
      this.safeSetState({
        isLoading: false,
        error: 'Failed to load degree roadmap from server.',
      });
    }
  };

  handleSelectCourse = (code: string): void => {
    this.safeSetState((prev) => ({
      selectedCode: prev.selectedCode === code ? null : code,
    }));
  };

  render() {
    const { isOpen, onClose } = this.props;
    const {
      nodes,
      edges,
      major,
      completedCount,
      totalCoreCount,
      progressPercentage,
      selectedCode,
      activeTier,
      searchQuery,
      isLoading,
      error,
    } = this.state;

    if (!isOpen) return null;

    const normalizedQuery = (searchQuery || '').trim().toLowerCase();
    const tierFiltered = activeTier === 'ALL' ? nodes : nodes.filter((n) => n.tier === activeTier);
    const filteredNodes = normalizedQuery
      ? tierFiltered.filter(
          (n) =>
            n.code.toLowerCase().includes(normalizedQuery) ||
            n.title.toLowerCase().includes(normalizedQuery)
        )
      : tierFiltered;

    const selectedNode = selectedCode ? nodes.find((n) => n.code === selectedCode) : null;
    const unlockedBySelected = selectedCode
      ? edges.filter(([from]) => from === selectedCode).map(([, to]) => to)
      : [];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-[#E0F7FA] rounded-xl text-[#0098ba]">🗺️</span>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Degree Roadmap &amp; Prerequisite Hierarchy
                </h2>
                <p className="text-xs text-slate-500">
                  NetworkX Directed Acyclic Graph (DAG) for {major}
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

          {/* Progress Bar Header Banner */}
          <div className="px-6 py-4 bg-slate-100/60 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#00B4DB] to-[#0083B0] h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                {progressPercentage}% Completed
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                ✓ {completedCount} Met
              </span>
              <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-semibold border border-cyan-200">
                ⚡ {nodes.filter((n) => n.status === 'READY_TO_ENROLL').length} Ready
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">
                🔒 {nodes.filter((n) => n.status === 'LOCKED').length} Locked
              </span>
            </div>
          </div>

          {/* Tier Filter Tabs & Course Search */}
          <div className="px-6 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold bg-white">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              <button
                type="button"
                onClick={() => this.safeSetState({ activeTier: 'ALL' })}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTier === 'ALL'
                    ? 'bg-[#00B4DB] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Tiers ({totalCoreCount})
              </button>
              {[1, 2, 3, 4, 5].map((tier) => {
                const tierCount = nodes.filter((n) => n.tier === tier).length;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => this.safeSetState({ activeTier: tier })}
                    className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                      activeTier === tier
                        ? 'bg-[#00B4DB] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tier {tier} ({tierCount})
                  </button>
                );
              })}
            </div>

            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => this.safeSetState({ searchQuery: e.target.value })}
                placeholder="Search code or title..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00B4DB]/40 focus:border-[#00B4DB] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => this.safeSetState({ searchQuery: '' })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-[#00B4DB] border-t-transparent rounded-full mb-3"></div>
                <p className="text-sm font-medium">Computing curriculum graph with NetworkX...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ⚠️ {error}
              </div>
            ) : filteredNodes.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <span className="text-3xl mb-2 block">🔍</span>
                <p className="text-sm font-medium text-slate-600">
                  No courses match &ldquo;{searchQuery}&rdquo;
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try searching by course code (e.g. CSE 101) or title
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {[1, 2, 3, 4, 5]
                  .filter((tier) => activeTier === 'ALL' || activeTier === tier)
                  .map((tier) => {
                    const tierNodes = filteredNodes.filter((n) => n.tier === tier);
                    if (tierNodes.length === 0) return null;
                    const meta = TIER_NAMES[tier];

                    return (
                      <div key={tier} className="space-y-3">
                        <div className="border-b border-slate-200 pb-1.5 flex items-baseline justify-between">
                          <h3 className="font-bold text-slate-800 text-sm">{meta.title}</h3>
                          <span className="text-xs text-slate-400">{meta.subtitle}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {tierNodes.map((node) => {
                            const isSelected = selectedCode === node.code;
                            const isCompleted = node.status === 'COMPLETED';
                            const isReady = node.status === 'READY_TO_ENROLL';

                            return (
                              <div
                                key={node.code}
                                onClick={() => this.handleSelectCourse(node.code)}
                                className={`cursor-pointer p-4 rounded-xl border transition-all relative ${
                                  isSelected
                                    ? 'ring-2 ring-[#00B4DB] shadow-md bg-cyan-50/40 border-[#00B4DB]'
                                    : isCompleted
                                      ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                                      : isReady
                                        ? 'bg-white border-[#00B4DB]/60 hover:shadow-md hover:border-[#00B4DB]'
                                        : 'bg-slate-50/50 border-slate-200 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {node.code}
                                  </span>
                                  {isCompleted ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      ✓ Completed
                                    </span>
                                  ) : isReady ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-[#0098ba] border border-cyan-200 animate-pulse">
                                      ⚡ Ready to Enroll
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      🔒 Locked
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-700 font-medium line-clamp-1 mb-2">
                                  {node.title}
                                </p>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                                  <span>{node.credits} Credits</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                                    {node.level}
                                  </span>
                                </div>

                                {node.unmetPrerequisites.length > 0 && (
                                  <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 rounded p-1 border border-amber-200">
                                    Missing: {node.unmetPrerequisites.join(', ')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Selected Course Inspector Drawer (Bottom Panel) */}
          {selectedNode && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 animate-slide-up">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{selectedNode.code}:</span>
                  <span className="text-sm font-semibold text-slate-800">{selectedNode.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 font-mono">
                    Tier {selectedNode.tier}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {selectedNode.status === 'COMPLETED'
                    ? '🎉 You have completed this course! It is counted towards your CS major degree requirements.'
                    : selectedNode.status === 'READY_TO_ENROLL'
                      ? '✨ All prerequisites satisfied! You can add this course to your schedule for next quarter.'
                      : `⚠️ Locked: You must first pass ${selectedNode.unmetPrerequisites.join(', ')}.`}
                </p>
                {unlockedBySelected.length > 0 && (
                  <p className="text-xs text-[#0098ba] font-medium">
                    🔑 Directly unlocks: {unlockedBySelected.map((c) => `\`${c}\``).join(', ')}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => this.safeSetState({ selectedCode: null })}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 flex justify-end bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md transition-all"
            >
              Close Roadmap
            </button>
          </div>
        </div>
      </div>
    );
  }
}
