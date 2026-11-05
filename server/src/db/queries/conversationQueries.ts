import { db } from '../database.js';

export interface ConversationRow {
  message_id: string;
  user_id: string;
  sender: 'USER' | 'AGENT' | 'SYSTEM';
  content: string;
  tool_calls: string | null;
  metadata: string | null;
  created_at: string;
}

export const conversationQueries = {
  insertMessage: (msg: {
    message_id: string;
    user_id: string;
    sender: 'USER' | 'AGENT' | 'SYSTEM';
    content: string;
    tool_calls?: string | null;
    metadata?: string | null;
  }): void => {
    const stmt = db.prepare(`
      INSERT INTO conversations (message_id, user_id, sender, content, tool_calls, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.message_id,
      msg.user_id,
      msg.sender,
      msg.content,
      msg.tool_calls || null,
      msg.metadata || null
    );
  },

  getRecentMessages: (userId: string, limit: number = 50): ConversationRow[] => {
    const stmt = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY created_at ASC, rowid ASC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as ConversationRow[];
  },

  getSlidingWindowMessages: (userId: string, limit: number = 10): ConversationRow[] => {
    const stmt = db.prepare(`
      SELECT message_id, user_id, sender, content, tool_calls, metadata, created_at FROM (
        SELECT *, rowid AS seq FROM conversations
        WHERE user_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?
      ) sub
      ORDER BY created_at ASC, seq ASC
    `);
    return stmt.all(userId, limit) as ConversationRow[];
  },

  findMessageById: (messageId: string): ConversationRow | undefined => {
    const stmt = db.prepare(`SELECT * FROM conversations WHERE message_id = ?`);
    return stmt.get(messageId) as ConversationRow | undefined;
  },

  deleteMessagesByUserId: (userId: string): void => {
    const stmt = db.prepare(`DELETE FROM conversations WHERE user_id = ?`);
    stmt.run(userId);
  },
};
