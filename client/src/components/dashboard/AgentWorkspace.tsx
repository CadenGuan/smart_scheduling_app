import React from 'react';
import { BaseComponent } from '../base/BaseComponent';
import { UserProfile, AgentMessage, CalendarEvent } from 'shared';
import { AgentService } from '../../services/agentService';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AgentWorkspaceProps {
  user: UserProfile | null;
  onScheduleUpdated?: () => void;
  onCalendarUpdate?: (preview: {
    term: string;
    totalCredits: number;
    events: CalendarEvent[];
  }) => void;
}

interface AgentWorkspaceState {
  messages: AgentMessage[];
  inputPrompt: string;
  isProcessing: boolean;
  error: string | null;
  isClearConfirming: boolean;
  isSendHovered: boolean;
}

export class AgentWorkspace extends BaseComponent<AgentWorkspaceProps, AgentWorkspaceState> {
  private chatScrollRef = React.createRef<HTMLDivElement>();

  constructor(props: AgentWorkspaceProps) {
    super(props);
    this.state = {
      messages: [],
      inputPrompt: '',
      isProcessing: false,
      error: null,
      isClearConfirming: false,
      isSendHovered: false,
    };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    try {
      const messages = await AgentService.getMessages();
      this.safeSetState({ messages }, () => this.scrollToBottom());
    } catch {
      // Graceful load failure
    }
  }

  componentDidUpdate(prevProps: AgentWorkspaceProps, prevState: AgentWorkspaceState): void {
    if (
      prevState.messages.length !== this.state.messages.length ||
      prevState.isProcessing !== this.state.isProcessing
    ) {
      this.scrollToBottom();
    }
  }

  private scrollToBottom = (): void => {
    if (this.chatScrollRef.current) {
      this.chatScrollRef.current.scrollTop = this.chatScrollRef.current.scrollHeight;
    }
  };

  private handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.safeSetState({ inputPrompt: e.target.value, error: null });
  };

  private handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleSendMessage();
    }
  };

  private handleQuickChip = (prompt: string): void => {
    if (this.state.isProcessing) return;
    this.safeSetState({ inputPrompt: prompt }, () => {
      this.handleSendMessage();
    });
  };

  private handleSendMessage = async (): Promise<void> => {
    const prompt = this.state.inputPrompt.trim();
    if (!prompt || this.state.isProcessing) return;

    // Optimistic user message for instant UI responsiveness
    const optimisticUserMsg: AgentMessage = {
      messageId: `optimistic-${Date.now()}`,
      userId: this.props.user?.userId || '',
      sender: 'USER',
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    this.safeSetState((prev) => ({
      messages: [...prev.messages, optimisticUserMsg],
      inputPrompt: '',
      isProcessing: true,
      error: null,
    }));

    try {
      const result = await AgentService.sendMessage(prompt);
      this.safeSetState((prev) => {
        // Replace optimistic message with confirmed user message and append agent response
        const filtered = prev.messages.filter((m) => m.messageId !== optimisticUserMsg.messageId);
        return {
          messages: [...filtered, result.userMessage, result.agentMessage],
          isProcessing: false,
        };
      });

      if (result.preview) {
        this.props.onCalendarUpdate?.(result.preview);
      } else if (result.agentMessage.toolCalls && result.agentMessage.toolCalls.length > 0) {
        this.props.onScheduleUpdated?.();
      }
    } catch (err: any) {
      this.safeSetState({
        isProcessing: false,
        error: err.response?.data?.message || err.message || 'Failed to send message to agent',
      });
    }
  };

  private handleClearChat = async (): Promise<void> => {
    if (!this.state.isClearConfirming) {
      this.safeSetState({ isClearConfirming: true });
      setTimeout(() => this.safeSetState({ isClearConfirming: false }), 4000);
      return;
    }

    try {
      await AgentService.clearMessages();
      this.safeSetState({ messages: [], isClearConfirming: false, error: null });
    } catch {
      this.safeSetState({ error: 'Failed to clear chat history' });
    }
  };

  render() {
    const { user } = this.props;
    const { messages, inputPrompt, isProcessing, error, isClearConfirming, isSendHovered } =
      this.state;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        {/* 1. Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00B4DB] to-[#0098ba] flex items-center justify-center text-white text-lg shadow-sm">
              🐌
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-sm">SlugAgent Advisor</h3>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {user?.standing || 'Junior'} • {user?.major || 'Computer Science B.S.'}
              </p>
            </div>
          </div>

          {/* Clear Chat Button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={this.handleClearChat}
              disabled={isProcessing}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isClearConfirming
                  ? 'bg-[#FF6B6B] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Clear all messages in this conversation"
            >
              {isClearConfirming ? 'Confirm Clear?' : '🗑️ Clear'}
            </button>
          )}
        </div>

        {/* 2. Message History Container */}
        <div
          ref={this.chatScrollRef}
          className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/30"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-3xl shadow-sm">
                🐌
              </div>
              <div className="max-w-xs space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">How can Sammy help you today?</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  I can review your remaining General Education requirements, recommend
                  prerequisite-friendly CS courses, explain why specific classes fit your timeline,
                  or balance your workload.
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="w-full pt-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                  Suggested Questions:
                </span>
                <div className="flex flex-col gap-1.5">
                  {[
                    'What GE requirements do I have left?',
                    'What is the prerequisite path to CSE 130?',
                    'What happens if I drop CSE 101?',
                    'Why should I take CSE 101?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => this.handleQuickChip(chip)}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-left bg-white text-slate-700 border border-slate-200 hover:border-[#00B4DB] hover:bg-[#00B4DB]/5 transition-all duration-150 shadow-xs"
                    >
                      💡 {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === 'USER';
              return (
                <div
                  key={msg.messageId}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs shadow-xs ${
                      isUser
                        ? 'bg-[#00B4DB] text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/90 border-l-4 border-l-[#F9CA24] rounded-bl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <MarkdownRenderer content={msg.content} />
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator while processing */}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-2.5 shadow-xs flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Sammy is thinking</span>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00B4DB] animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F9CA24] animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B] animate-bounce"></span>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 text-[#FF6B6B] text-xs font-medium border border-red-200 flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button
                type="button"
                onClick={() => this.safeSetState({ error: null })}
                className="text-xs font-bold text-red-400 hover:text-red-700 ml-2"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* 3. Input & Send Container (Locked during processing) */}
        <div className="p-3.5 border-t border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={this.handleInputChange}
              onKeyDown={this.handleKeyDown}
              disabled={isProcessing}
              placeholder={
                isProcessing
                  ? 'Waiting for Sammy to respond...'
                  : 'Ask Sammy about courses, GEs, prerequisites...'
              }
              className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs transition-all duration-150 outline-none ${
                isProcessing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                  : 'bg-slate-50 text-slate-800 border-slate-200 focus:bg-white focus:border-[#00B4DB] focus:ring-2 focus:ring-[#00B4DB]/15'
              }`}
            />
            <button
              type="button"
              onClick={this.handleSendMessage}
              onMouseEnter={() => this.safeSetState({ isSendHovered: true })}
              onMouseLeave={() => this.safeSetState({ isSendHovered: false })}
              disabled={isProcessing || !inputPrompt.trim()}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-xs ${
                isProcessing || !inputPrompt.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : isSendHovered
                    ? 'bg-[#e55959] text-white shadow-md scale-[1.02]'
                    : 'bg-[#FF6B6B] text-white'
              }`}
            >
              <span>Send</span>
              <span>🚀</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
