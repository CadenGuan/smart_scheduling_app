import { z } from 'zod';
import { CalendarEventSchema, CalendarPreviewResponseSchema } from './calendar.schema.js';

export const AgentSenderEnum = z.enum(['USER', 'AGENT', 'SYSTEM']);
export type AgentSender = z.infer<typeof AgentSenderEnum>;

export const AgentChatRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt cannot be empty')
    .max(2000, 'Prompt cannot exceed 2000 characters'),
});
export type AgentChatRequest = z.infer<typeof AgentChatRequestSchema>;

export const AgentMessageSchema = z.object({
  messageId: z.string(),
  userId: z.string(),
  sender: AgentSenderEnum,
  content: z.string(),
  toolCalls: z.any().optional(),
  metadata: z.any().optional(),
  createdAt: z.string(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentChatResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    userMessage: AgentMessageSchema,
    agentMessage: AgentMessageSchema,
    proposedCourses: z.array(CalendarEventSchema).optional(),
    preview: CalendarPreviewResponseSchema.shape.data.optional(),
  }),
});
export type AgentChatResponse = z.infer<typeof AgentChatResponseSchema>;

export const AgentMessagesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    messages: z.array(AgentMessageSchema),
  }),
});
export type AgentMessagesResponse = z.infer<typeof AgentMessagesResponseSchema>;

export const ClearChatResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      message: z.string(),
    })
    .optional(),
  message: z.string(),
});
export type ClearChatResponse = z.infer<typeof ClearChatResponseSchema>;
