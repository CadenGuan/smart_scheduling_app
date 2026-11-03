import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { AgentChatRequestSchema } from 'shared';
import { conversationQueries } from '../db/queries/conversationQueries.js';
import { userQueries } from '../db/queries/userQueries.js';
import { calendarQueries } from '../db/queries/calendarQueries.js';
import { ContextService } from '../services/context.service.js';
import { AgentService } from '../services/agent.service.js';
import { CalendarService } from '../services/calendar.service.js';

const router = Router();

// POST /api/agent/chat
router.post(
  '/chat',
  requireAuth,
  validateBody(AgentChatRequestSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { prompt } = req.body;

    const userMessageId = uuidv4();
    const userCreatedAt = new Date().toISOString();

    // 1. Persist user message
    conversationQueries.insertMessage({
      message_id: userMessageId,
      user_id: userId,
      sender: 'USER',
      content: prompt,
    });

    // 2. Assemble context & sliding window
    const context = ContextService.assembleContext(userId);

    // 3. Query Django Agent Service
    const agentResult = await AgentService.queryAgent(prompt, context);

    // 3.5 Execute server-side actions triggered by agent tool calls
    if (agentResult.toolCalls && Array.isArray(agentResult.toolCalls)) {
      for (const tc of agentResult.toolCalls) {
        if (tc.tool === 'update_schedule_preferences') {
          try {
            const output = typeof tc.output === 'string' ? JSON.parse(tc.output) : tc.output;
            if (output && output.action === 'UPDATE_PREFERENCES' && output.updates) {
              const existingUser = userQueries.findUserById(userId);
              let currentPrefs: any = {};
              if (existingUser?.preferences) {
                try {
                  currentPrefs = JSON.parse(existingUser.preferences);
                } catch {
                  currentPrefs = {};
                }
              }
              const updatedPrefs = { ...currentPrefs, ...output.updates };
              userQueries.updateUserProfile(userId, {
                preferences: JSON.stringify(updatedPrefs),
              });
            }
          } catch {
            // Ignore malformed tool output
          }
        }
      }
    }

    // 4. Persist agent response
    const agentMessageId = uuidv4();
    const agentCreatedAt = new Date().toISOString();

    conversationQueries.insertMessage({
      message_id: agentMessageId,
      user_id: userId,
      sender: 'AGENT',
      content: agentResult.response,
      tool_calls: agentResult.toolCalls ? JSON.stringify(agentResult.toolCalls) : null,
      metadata: agentResult.metadata ? JSON.stringify(agentResult.metadata) : null,
    });

    // 4.5 Compute calendar preview and persist if proposedCourses present
    let preview;
    if (agentResult.proposedCourses && agentResult.proposedCourses.length > 0) {
      preview = CalendarService.getPreview(userId, undefined, agentResult.proposedCourses);
      calendarQueries.saveUserCalendarEvents(userId, preview.term, preview.events);
    } else {
      preview = CalendarService.getPreview(userId);
    }

    // 5. Return both message envelopes and calendar preview
    res.status(200).json({
      success: true,
      data: {
        userMessage: {
          messageId: userMessageId,
          userId,
          sender: 'USER',
          content: prompt,
          createdAt: userCreatedAt,
        },
        agentMessage: {
          messageId: agentMessageId,
          userId,
          sender: 'AGENT',
          content: agentResult.response,
          toolCalls: agentResult.toolCalls || [],
          metadata: agentResult.metadata || {},
          createdAt: agentCreatedAt,
        },
        proposedCourses: agentResult.proposedCourses,
        preview,
      },
    });
  })
);

// GET /api/agent/messages
router.get(
  '/messages',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const rows = conversationQueries.getRecentMessages(userId, 50);

    const messages = rows.map((row) => ({
      messageId: row.message_id,
      userId: row.user_id,
      sender: row.sender,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      createdAt: row.created_at,
    }));

    res.status(200).json({
      success: true,
      data: { messages },
    });
  })
);

// DELETE /api/agent/messages
router.delete(
  '/messages',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    conversationQueries.deleteMessagesByUserId(userId);
    calendarQueries.deleteUserCalendarEvents(userId);

    res.status(200).json({
      success: true,
      message: 'Conversation history cleared successfully.',
    });
  })
);

export default router;
