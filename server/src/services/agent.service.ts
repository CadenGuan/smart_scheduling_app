import { CalendarEvent } from 'shared';
import { config } from '../config.js';
import { AssembledContext } from './context.service.js';

export interface AgentProcessResult {
  response: string;
  toolCalls?: any[];
  metadata?: any;
  proposedCourses?: CalendarEvent[];
}

export type AgentQueryResponse = AgentProcessResult;

export class AgentService {
  static async queryAgent(
    prompt: string,
    context: AssembledContext,
    sessionToken?: string
  ): Promise<AgentProcessResult> {
    const timeoutMs = parseInt(process.env.AGENT_TIMEOUT_MS || '180000', 10);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const useMock =
      process.env.USE_MOCK_AGENT === 'true' ||
      process.env.AGENT_MODE === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      Boolean(process.env.VITEST);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(useMock ? { 'X-Mock-Agent': 'true' } : {}),
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${config.DJANGO_AGENT_URL}/api/agent/process/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          student: context.student,
          preferences: context.preferences,
          currentSchedule: context.currentSchedule,
          history: context.history,
          sessionToken,
          useMock,
          nodeApiUrl: `http://localhost:${config.PORT}`,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Django agent returned status ${response.status}: ${errorBody}`);
      }

      const result: any = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid response from agent service');
      }

      return {
        response: result.data.response,
        toolCalls: result.data.toolCalls || [],
        metadata: { model: result.data.model || 'slug-advisor' },
        proposedCourses: Array.isArray(result.data.proposedCourses)
          ? result.data.proposedCourses
          : [],
      };
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const fallbackReason = isAbort
        ? `Agent request timed out after ${Math.round(timeoutMs / 1000)} seconds`
        : err.message;

      return {
        response:
          `⚠️ **SlugAgent Error**: ${fallbackReason}.\n\n` +
          `Live reasoning could not be completed and mock fallback is disabled. Please verify that the agent service is running on port 8000 with a valid \`GEMINI_API_KEY\`.`,
        toolCalls: [],
        metadata: { fallback: false, error: fallbackReason },
        proposedCourses: [],
      };
    }
  }
}
