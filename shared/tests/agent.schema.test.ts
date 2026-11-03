import { describe, it, expect } from 'vitest';
import {
  AgentSenderEnum,
  AgentChatRequestSchema,
  AgentMessageSchema,
  AgentChatResponseSchema,
  AgentMessagesResponseSchema,
  ClearChatResponseSchema,
} from '../src/agent.schema.js';

describe('Agent Zod Schema Contract Test Suite', () => {
  describe('AgentSenderEnum', () => {
    it('validates supported senders', () => {
      expect(AgentSenderEnum.parse('USER')).toBe('USER');
      expect(AgentSenderEnum.parse('AGENT')).toBe('AGENT');
      expect(AgentSenderEnum.parse('SYSTEM')).toBe('SYSTEM');
      expect(() => AgentSenderEnum.parse('ROBOT')).toThrow();
    });
  });

  describe('AgentChatRequestSchema', () => {
    it('accepts valid prompt strings', () => {
      const parsed = AgentChatRequestSchema.parse({ prompt: 'Recommend a class' });
      expect(parsed.prompt).toBe('Recommend a class');
    });

    it('rejects empty or whitespace-only prompt', () => {
      expect(() => AgentChatRequestSchema.parse({ prompt: '' })).toThrow();
      expect(() => AgentChatRequestSchema.parse({ prompt: '   ' })).toThrow();
    });

    it('rejects prompts exceeding 2000 characters', () => {
      expect(() => AgentChatRequestSchema.parse({ prompt: 'a'.repeat(2001) })).toThrow();
    });
  });

  describe('AgentMessageSchema', () => {
    it('validates a complete agent message', () => {
      const msg = {
        messageId: 'msg-123',
        userId: 'user-456',
        sender: 'AGENT',
        content: 'Take CSE 101 next quarter',
        toolCalls: [{ tool: 'dag_solve' }],
        metadata: { model: 'mock-advisor' },
        createdAt: '2026-11-03T12:00:00Z',
      };
      const parsed = AgentMessageSchema.parse(msg);
      expect(parsed.messageId).toBe('msg-123');
      expect(parsed.sender).toBe('AGENT');
    });
  });

  describe('AgentChatResponseSchema', () => {
    it('validates multi-turn chat response payload', () => {
      const payload = {
        success: true,
        data: {
          userMessage: {
            messageId: 'u-1',
            userId: 'usr-1',
            sender: 'USER',
            content: 'Hello',
            createdAt: '2026-11-03T12:00:00Z',
          },
          agentMessage: {
            messageId: 'a-1',
            userId: 'usr-1',
            sender: 'AGENT',
            content: 'Welcome back!',
            createdAt: '2026-11-03T12:00:01Z',
          },
        },
      };
      const parsed = AgentChatResponseSchema.parse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.agentMessage.content).toBe('Welcome back!');
    });

    it('validates agent chat response with proposedCourses and calendar preview', () => {
      const payload = {
        success: true,
        data: {
          userMessage: {
            messageId: 'u-1',
            userId: 'usr-1',
            sender: 'USER',
            content: 'Recommend CSE 101 and CSE 130',
            createdAt: '2026-11-03T12:00:00Z',
          },
          agentMessage: {
            messageId: 'a-1',
            userId: 'usr-1',
            sender: 'AGENT',
            content: 'I have proposed CSE 101 and CSE 130 for your schedule.',
            createdAt: '2026-11-03T12:00:01Z',
          },
          proposedCourses: [
            {
              id: 'cse-101-01',
              title: 'CSE 101: Introduction to Data Structures and Algorithms',
              type: 'MAJOR',
              days: ['Tuesday', 'Thursday'],
              startTime: '10:00',
              endTime: '11:35',
              color: '#00B4DB',
              credits: 5,
              term: 'Winter 2027',
              pinned: true,
            },
          ],
          preview: {
            term: 'Winter 2027',
            totalCredits: 5,
            events: [
              {
                id: 'cse-101-01',
                title: 'CSE 101: Introduction to Data Structures and Algorithms',
                type: 'MAJOR',
                days: ['Tuesday', 'Thursday'],
                startTime: '10:00',
                endTime: '11:35',
                color: '#00B4DB',
                credits: 5,
                term: 'Winter 2027',
                pinned: true,
              },
            ],
          },
        },
      };
      const parsed = AgentChatResponseSchema.parse(payload);
      expect(parsed.success).toBe(true);
      expect(parsed.data.proposedCourses).toHaveLength(1);
      expect(parsed.data.proposedCourses?.[0].pinned).toBe(true);
      expect(parsed.data.preview?.totalCredits).toBe(5);
    });
  });

  describe('AgentMessagesResponseSchema and ClearChatResponseSchema', () => {
    it('validates history list response', () => {
      const res = {
        success: true,
        data: {
          messages: [
            {
              messageId: 'm-1',
              userId: 'u-1',
              sender: 'SYSTEM',
              content: 'Conversation started',
              createdAt: '2026-11-03T12:00:00Z',
            },
          ],
        },
      };
      const parsed = AgentMessagesResponseSchema.parse(res);
      expect(parsed.data.messages).toHaveLength(1);
    });

    it('validates clear chat response', () => {
      const res = {
        success: true,
        message: 'Chat history cleared successfully',
      };
      const parsed = ClearChatResponseSchema.parse(res);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toContain('cleared');
    });
  });
});
