import { apiClient } from './apiClient';
import { AgentChatResponse, AgentMessagesResponse, AgentMessage, ClearChatResponse } from 'shared';

export class AgentService {
  static async sendMessage(prompt: string): Promise<AgentChatResponse['data']> {
    const res = await apiClient.post<AgentChatResponse>('/api/agent/chat', { prompt });
    return res.data;
  }

  static async getMessages(): Promise<AgentMessage[]> {
    const res = await apiClient.get<AgentMessagesResponse>('/api/agent/messages');
    return res.data.messages;
  }

  static async clearMessages(): Promise<void> {
    await apiClient.delete<ClearChatResponse>('/api/agent/messages');
  }
}
