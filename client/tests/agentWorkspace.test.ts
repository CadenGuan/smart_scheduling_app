import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AgentWorkspace } from '../src/components/dashboard/AgentWorkspace';
import { MarkdownRenderer } from '../src/components/dashboard/MarkdownRenderer';
import { AgentService } from '../src/services/agentService';
import { UserProfile, AgentMessage } from 'shared';

const cleanHtml = (html: string) => html.replace(/<!--.*?-->/g, '');

const mockUser: UserProfile = {
  userId: 'test-user-123',
  email: 'sammy@ucsc.edu',
  name: 'Sammy Slug',
  standing: 'Junior',
  major: 'Computer Science B.S.',
  minor: null,
};

const mockMessages: AgentMessage[] = [
  {
    messageId: 'm1',
    userId: 'test-user-123',
    sender: 'USER',
    content: 'What GE courses should I take?',
    createdAt: '2026-11-03T01:00:00.000Z',
  },
  {
    messageId: 'm2',
    userId: 'test-user-123',
    sender: 'AGENT',
    content: '### Recommended GEs\n- **PHIL 9**: *Intro to Logic* with `MF` credit.\n- **ART 10F**: 2D Design.',
    createdAt: '2026-11-03T01:00:05.000Z',
  },
];

describe('AgentWorkspace Component Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('MarkdownRenderer', () => {
    it('renders headings, bold, italics, inline code, and lists correctly', () => {
      const markdown = 
        '### Course Advice\n' +
        'Here is **bold text** and *italic text* and `inline code`.\n' +
        '- First bullet item\n' +
        '- Second bullet item\n' +
        '1. Step one\n' +
        '2. Step two';

      const html = cleanHtml(renderToString(React.createElement(MarkdownRenderer, { content: markdown })));

      expect(html).toContain('Course Advice');
      expect(html).toContain('bold text');
      expect(html).toContain('italic text');
      expect(html).toContain('inline code');
      expect(html).toContain('First bullet item');
      expect(html).toContain('Second bullet item');
      expect(html).toContain('Step one');
      expect(html).toContain('Step two');
    });

    it('renders empty content without throwing', () => {
      const html = cleanHtml(renderToString(React.createElement(MarkdownRenderer, { content: '' })));
      expect(html).toBe('<div class="space-y-1"></div>');
    });
  });

  describe('AgentWorkspace Rendering & State', () => {
    it('renders welcome screen and suggested chips when message list is empty', async () => {
      vi.spyOn(AgentService, 'getMessages').mockResolvedValue([]);

      const workspace = new AgentWorkspace({ user: mockUser });
      await workspace.componentDidMount();

      const html = cleanHtml(renderToString(workspace.render()));

      expect(html).toContain('SlugAgent Advisor');
      expect(html).toContain('Junior • Computer Science B.S.');
      expect(html).toContain('How can Sammy help you today?');
      expect(html).toContain('What GE requirements do I have left?');
      expect(html).toContain('Recommend courses for a 15-credit quarter');
      expect(html).toContain('Why should I take CSE 101?');
    });

    it('renders conversation messages when history exists', async () => {
      vi.spyOn(AgentService, 'getMessages').mockResolvedValue(mockMessages);

      const workspace = new AgentWorkspace({ user: mockUser });
      await workspace.componentDidMount();

      const html = cleanHtml(renderToString(workspace.render()));

      expect(html).toContain('What GE courses should I take?');
      expect(html).toContain('Recommended GEs');
      expect(html).toContain('PHIL 9');
      expect(html).toContain('Clear');
    });

    it('handles message submission and updates optimistic state', async () => {
      vi.spyOn(AgentService, 'getMessages').mockResolvedValue([]);
      const sendSpy = vi.spyOn(AgentService, 'sendMessage').mockResolvedValue({
        userMessage: {
          messageId: 'u-msg',
          userId: mockUser.userId,
          sender: 'USER',
          content: 'Hello agent',
          createdAt: new Date().toISOString(),
        },
        agentMessage: {
          messageId: 'a-msg',
          userId: mockUser.userId,
          sender: 'AGENT',
          content: 'Hello student! How can I help?',
          createdAt: new Date().toISOString(),
        },
      });

      const workspace = new AgentWorkspace({ user: mockUser });
      await workspace.componentDidMount();

      (workspace as any).handleInputChange({ target: { value: 'Hello agent' } });
      expect(workspace.state.inputPrompt).toBe('Hello agent');

      await (workspace as any).handleSendMessage();

      expect(sendSpy).toHaveBeenCalledWith('Hello agent');
      expect(workspace.state.messages).toHaveLength(2);
      expect(workspace.state.messages[1].content).toBe('Hello student! How can I help?');
      expect(workspace.state.isProcessing).toBe(false);
    });

    it('triggers onScheduleUpdated when agent response includes tool calls', async () => {
      vi.spyOn(AgentService, 'getMessages').mockResolvedValue([]);
      const onScheduleUpdated = vi.fn();
      vi.spyOn(AgentService, 'sendMessage').mockResolvedValue({
        userMessage: {
          messageId: 'u-msg',
          userId: mockUser.userId,
          sender: 'USER',
          content: 'Why CSE 101?',
          createdAt: new Date().toISOString(),
        },
        agentMessage: {
          messageId: 'a-msg',
          userId: mockUser.userId,
          sender: 'AGENT',
          content: 'Because it unblocks electives.',
          toolCalls: [{ tool: 'explain_course_rationale', output: {} }],
          createdAt: new Date().toISOString(),
        },
      });

      const workspace = new AgentWorkspace({ user: mockUser, onScheduleUpdated });
      await workspace.componentDidMount();

      (workspace as any).handleInputChange({ target: { value: 'Why CSE 101?' } });
      await (workspace as any).handleSendMessage();

      expect(onScheduleUpdated).toHaveBeenCalledTimes(1);
    });

    it('handles clear chat confirmation toggle and clear execution', async () => {
      vi.spyOn(AgentService, 'getMessages').mockResolvedValue(mockMessages);
      const clearSpy = vi.spyOn(AgentService, 'clearMessages').mockResolvedValue();

      const workspace = new AgentWorkspace({ user: mockUser });
      await workspace.componentDidMount();

      // First click: sets confirming state
      await (workspace as any).handleClearChat();
      expect(workspace.state.isClearConfirming).toBe(true);

      // Second click: executes clear
      await (workspace as any).handleClearChat();
      expect(clearSpy).toHaveBeenCalled();
      expect(workspace.state.messages).toHaveLength(0);
      expect(workspace.state.isClearConfirming).toBe(false);
    });
  });
});
