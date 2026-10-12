const { db } = require('../db');
const { newId } = require('../utils/ids');
const { AppError } = require('../middleware/error');
const conversationService = require('./conversationService');

function serializeMessage(row, readBy = [], reactions = [], replyTo = null) {
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: deleted ? '' : row.body,
    createdAt: row.created_at,
    editedAt: deleted ? null : row.edited_at,
    deleted,
    readBy,
    reactions,
    replyTo,
  };
}

async function readByFor(messageIds) {
  if (!messageIds.length) return {};
  const rows = await db('message_reads').whereIn('message_id', messageIds);
  const map = {};
  for (const row of rows) {
    if (!map[row.message_id]) map[row.message_id] = [];
    map[row.message_id].push({ userId: row.user_id, readAt: row.read_at });
  }
  return map;
}

async function reactionsFor(messageIds, viewerId) {
  if (!messageIds.length) return {};
  const rows = await db('message_reactions').whereIn('message_id', messageIds);
  const byMessage = {};
  for (const row of rows) {
    if (!byMessage[row.message_id]) byMessage[row.message_id] = {};
    if (!byMessage[row.message_id][row.emoji]) {
      byMessage[row.message_id][row.emoji] = {
        emoji: row.emoji,
        count: 0,
        users: [],
        hasReacted: false,
      };
    }
    const group = byMessage[row.message_id][row.emoji];
    group.count += 1;
    group.users.push(row.user_id);
    if (row.user_id === viewerId) {
      group.hasReacted = true;
    }
  }

  const result = {};
  for (const id of messageIds) {
    result[id] = byMessage[id] ? Object.values(byMessage[id]) : [];
  }
  return result;
}

async function repliesFor(replyIds) {
  const ids = [...new Set(replyIds.filter(Boolean))];
  if (!ids.length) return {};
  const rows = await db('messages')
    .leftJoin('users', 'messages.sender_id', 'users.id')
    .whereIn('messages.id', ids)
    .select(
      'messages.id',
      'messages.sender_id',
      'messages.body',
      'messages.deleted_at',
      'users.username as sender_username'
    );

  const map = {};
  for (const r of rows) {
    map[r.id] = {
      id: r.id,
      senderId: r.sender_id,
      senderUsername: r.sender_username || 'User',
      body: r.deleted_at ? 'This message was deleted' : r.body,
      deleted: Boolean(r.deleted_at),
    };
  }
  return map;
}

async function listByConversation(conversationId, userId, { limit = 50, before } = {}) {
  await conversationService.assertParticipant(conversationId, userId);
  const query = db('messages')
    .where({ conversation_id: conversationId })
    .orderBy('created_at', 'desc')
    .limit(Math.min(Number(limit) || 50, 100));

  if (before) {
    const pivot = await db('messages').where({ id: before }).first();
    if (pivot) {
      query.andWhere('created_at', '<', pivot.created_at);
    }
  }

  const rows = await query;
  rows.reverse();

  const messageIds = rows.map((r) => r.id);
  const reads = await readByFor(messageIds);
  const reactions = await reactionsFor(messageIds, userId);
  const replies = await repliesFor(rows.map((r) => r.reply_to_message_id));

  return rows.map((row) =>
    serializeMessage(
      row,
      reads[row.id] || [],
      reactions[row.id] || [],
      replies[row.reply_to_message_id] || null
    )
  );
}

async function createMessage(conversationId, senderId, body, replyToId = null) {
  await conversationService.assertParticipant(conversationId, senderId);

  let verifiedReplyId = null;
  if (replyToId) {
    const parent = await db('messages')
      .where({ id: replyToId, conversation_id: conversationId })
      .first();
    if (parent) {
      verifiedReplyId = parent.id;
    }
  }

  const id = newId();
  const now = new Date();
  await db('messages').insert({
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    reply_to_message_id: verifiedReplyId,
    created_at: now,
    edited_at: null,
    deleted_at: null,
  });
  await conversationService.touchLastMessage(conversationId, now);

  const row = await db('messages').where({ id }).first();
  const replyMap = verifiedReplyId ? await repliesFor([verifiedReplyId]) : {};
  return serializeMessage(row, [], [], replyMap[verifiedReplyId] || null);
}

async function getOwnedMessage(messageId, userId) {
  const row = await db('messages').where({ id: messageId }).first();
  if (!row) {
    throw new AppError('Message not found', 404, 'NOT_FOUND');
  }
  await conversationService.assertParticipant(row.conversation_id, userId);
  return row;
}

async function editMessage(messageId, userId, body) {
  const row = await getOwnedMessage(messageId, userId);
  if (row.sender_id !== userId) {
    throw new AppError('You can only edit your own messages', 403, 'FORBIDDEN');
  }
  if (row.deleted_at) {
    throw new AppError('Cannot edit a deleted message', 400, 'MESSAGE_DELETED');
  }
  const now = new Date();
  await db.transaction(async (trx) => {
    await trx('message_edit_history').insert({
      id: newId(),
      message_id: row.id,
      edited_by: userId,
      previous_body: row.body,
      edited_at: now,
    });
    await trx('messages').where({ id: row.id }).update({
      body,
      edited_at: now,
    });
    await trx('conversations').where({ id: row.conversation_id }).update({
      last_message_at: now,
      updated_at: now,
    });
  });

  const updated = await db('messages').where({ id: row.id }).first();
  const reads = await readByFor([row.id]);
  const reactions = await reactionsFor([row.id], userId);
  const replies = await repliesFor([row.reply_to_message_id]);
  return serializeMessage(
    updated,
    reads[row.id] || [],
    reactions[row.id] || [],
    replies[row.reply_to_message_id] || null
  );
}

async function deleteMessage(messageId, userId) {
  const row = await getOwnedMessage(messageId, userId);
  if (row.sender_id !== userId) {
    throw new AppError('You can only delete your own messages', 403, 'FORBIDDEN');
  }
  if (row.deleted_at) {
    throw new AppError('Message already deleted', 400, 'MESSAGE_DELETED');
  }
  const now = new Date();
  await db.transaction(async (trx) => {
    await trx('messages').where({ id: row.id }).update({
      deleted_at: now,
      body: '',
    });
    await trx('conversations').where({ id: row.conversation_id }).update({
      updated_at: now,
    });
  });

  const updated = await db('messages').where({ id: row.id }).first();
  const reactions = await reactionsFor([row.id], userId);
  const replies = await repliesFor([row.reply_to_message_id]);
  return serializeMessage(
    updated,
    [],
    reactions[row.id] || [],
    replies[row.reply_to_message_id] || null
  );
}

async function toggleReaction(messageId, userId, emoji) {
  const message = await db('messages').where({ id: messageId }).first();
  if (!message) {
    throw new AppError('Message not found', 404, 'NOT_FOUND');
  }
  await conversationService.assertParticipant(message.conversation_id, userId);

  const existing = await db('message_reactions')
    .where({ message_id: messageId, user_id: userId, emoji })
    .first();

  if (existing) {
    await db('message_reactions').where({ id: existing.id }).delete();
  } else {
    await db('message_reactions').insert({
      id: newId(),
      message_id: messageId,
      user_id: userId,
      emoji,
      created_at: new Date(),
    });
  }

  const reactions = await reactionsFor([messageId], userId);
  return {
    messageId,
    conversationId: message.conversation_id,
    reactions: reactions[messageId] || [],
  };
}

async function markConversationRead(conversationId, userId) {
  await conversationService.assertParticipant(conversationId, userId);
  const unread = await db('messages')
    .where({ conversation_id: conversationId })
    .where('sender_id', '!=', userId)
    .whereNull('deleted_at')
    .whereNotExists(function notRead() {
      this.select(db.raw('1'))
        .from('message_reads')
        .whereRaw('message_reads.message_id = messages.id')
        .andWhere('message_reads.user_id', userId);
    });

  const now = new Date();
  if (unread.length === 0) {
    return { markedMessageIds: [], readAt: now, readerId: userId, conversationId };
  }

  const marked = [];
  await db.transaction(async (trx) => {
    for (const message of unread) {
      try {
        await trx('message_reads').insert({
          id: newId(),
          message_id: message.id,
          user_id: userId,
          read_at: now,
        });
        marked.push(message.id);
      } catch (_err) {
        // Unique constraint: already marked
      }
    }
  });

  return { markedMessageIds: marked, readAt: now, readerId: userId, conversationId };
}

async function editHistory(messageId, userId) {
  const row = await getOwnedMessage(messageId, userId);
  const history = await db('message_edit_history')
    .where({ message_id: row.id })
    .orderBy('edited_at', 'asc');
  return history.map((h) => ({
    id: h.id,
    previousBody: row.deleted_at ? '' : h.previous_body,
    editedAt: h.edited_at,
    editedBy: h.edited_by,
  }));
}

module.exports = {
  serializeMessage,
  listByConversation,
  createMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  markConversationRead,
  editHistory,
};
