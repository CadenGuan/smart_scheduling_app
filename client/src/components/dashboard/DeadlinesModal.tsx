import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { CalendarService } from '../../services/calendarService';
import { ConferenceDeadline } from 'shared';

interface DeadlinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeadlinesModalState {
  deadlines: ConferenceDeadline[];
  topics: string[];
  totalCount: number;
  selectedTopic: string;
  selectedTier: string;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;
}

export class DeadlinesModal extends BaseComponent<DeadlinesModalProps, DeadlinesModalState> {
  constructor(props: DeadlinesModalProps) {
    super(props);
    this.state = {
      deadlines: [],
      topics: [],
      totalCount: 0,
      selectedTopic: 'ALL',
      selectedTier: 'ALL',
      isLoading: true,
      isExporting: false,
      error: null,
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    if (this.props.isOpen) {
      await this.loadDeadlines();
    }
  }

  async componentDidUpdate(prevProps: DeadlinesModalProps): Promise<void> {
    if (this.props.isOpen && !prevProps.isOpen) {
      await this.loadDeadlines();
    }
  }

  loadDeadlines = async (): Promise<void> => {
    try {
      this.safeSetState({ isLoading: true, error: null });
      const { selectedTopic, selectedTier } = this.state;
      const data = await CalendarService.getConferenceDeadlines(selectedTopic, selectedTier);
      this.safeSetState({
        deadlines: data.deadlines,
        topics: data.topics,
        totalCount: data.totalCount,
        isLoading: false,
      });
    } catch {
      this.safeSetState({
        isLoading: false,
        error: 'Failed to load conference deadlines from server.',
      });
    }
  };

  handleFilterChange = async (type: 'topic' | 'tier', value: string): Promise<void> => {
    if (type === 'topic') {
      this.safeSetState({ selectedTopic: value }, this.loadDeadlines);
    } else {
      this.safeSetState({ selectedTier: value }, this.loadDeadlines);
    }
  };

  handleExportAll = async (): Promise<void> => {
    try {
      this.safeSetState({ isExporting: true });
      const { selectedTopic, selectedTier } = this.state;
      const ics = await CalendarService.exportDeadlinesIcs(selectedTopic, selectedTier);
      CalendarService.downloadIcs(ics, 'ucsc-cs-conference-deadlines.ics');
      this.safeSetState({ isExporting: false });
    } catch {
      this.safeSetState({ isExporting: false });
    }
  };

  render() {
    const { isOpen, onClose } = this.props;
    const { deadlines, topics, selectedTopic, selectedTier, isLoading, isExporting, error } =
      this.state;

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <span className="text-2xl p-2 bg-[#FFFDE7] rounded-xl text-[#F9CA24]">🎯</span>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  CS Research &amp; Conference Deadlines
                </h2>
                <p className="text-xs text-slate-500">
                  Target undergraduate showcases, student research competitions &amp; top-tier
                  symposiums
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={this.handleExportAll}
                disabled={isExporting || deadlines.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#00B4DB] hover:bg-[#0098ba] text-white shadow-sm transition-all disabled:opacity-50"
                title="Export all conference deadlines to .ics with 1-day reminders"
              >
                <span>{isExporting ? 'Exporting...' : '📥 Export to .ics'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
            {/* Tier Filters */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase text-[10px]">Tier:</span>
              {(['ALL', 'Undergraduate Showcase', 'Major Conference', 'Top Tier'] as const).map(
                (tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => this.handleFilterChange('tier', tier)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      selectedTier === tier
                        ? 'bg-[#00B4DB] text-white font-bold shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    {tier === 'ALL' ? 'All Tiers' : tier}
                  </button>
                )
              )}
            </div>

            {/* Topic Dropdown */}
            {topics.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="font-semibold text-slate-500 uppercase text-[10px]">Topic:</span>
                <select
                  value={selectedTopic}
                  onChange={(e) => this.handleFilterChange('topic', e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00B4DB]"
                >
                  <option value="ALL">All Topics ({topics.length})</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-[#00B4DB] border-t-transparent rounded-full mb-3"></div>
                <p className="text-sm font-medium">Loading upcoming research deadlines...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ⚠️ {error}
              </div>
            ) : deadlines.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                No conference deadlines match your selected filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deadlines.map((conf) => {
                  const isUrgent = conf.status === 'URGENT';
                  const isUpcoming = conf.status === 'UPCOMING';
                  const isPassed = conf.status === 'PASSED';

                  return (
                    <div
                      key={conf.id}
                      className="p-5 rounded-2xl border border-slate-200 hover:border-[#00B4DB]/60 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Pills */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              conf.tier === 'Undergraduate Showcase'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : conf.tier === 'Top Tier'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {conf.tier}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isUrgent
                                ? 'bg-red-100 text-red-800 animate-pulse border border-red-200'
                                : isUpcoming
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : isPassed
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isPassed
                              ? 'Deadline Passed'
                              : conf.daysUntilDeadline !== undefined
                                ? `${conf.daysUntilDeadline} Days Left`
                                : 'Open'}
                          </span>
                        </div>

                        {/* Title & Abbreviation */}
                        <h3 className="font-extrabold text-slate-900 text-sm mb-1 leading-snug">
                          {conf.name}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                          {conf.description}
                        </p>

                        {/* Metadata Grid */}
                        <div className="space-y-1 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl mb-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-600">📝 Submission Due:</span>
                            <span className="font-bold text-slate-800">
                              {conf.submissionDeadline}
                            </span>
                          </div>
                          {conf.notificationDate && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-600">📬 Notification:</span>
                              <span>{conf.notificationDate}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-600">📍 Conference:</span>
                            <span className="truncate max-w-[180px]">{conf.location}</span>
                          </div>
                        </div>

                        {/* Topics */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {conf.topics.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer */}
                      {conf.websiteUrl && (
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <a
                            href={conf.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#0098ba] hover:underline flex items-center gap-1"
                          >
                            <span>Official Website</span>
                            <span>↗</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white text-xs text-slate-500">
            <span>Showing {deadlines.length} research venues</span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
}
