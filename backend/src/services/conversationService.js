const { db } = require('../db');
const { newId } = require('../utils/ids');
const { AppError } = require('../middleware/error');
const userService = require('./userService');

function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function otherUserId(conversation, userId) {
  return conversation.user_low_id === userId
    ? conversation.user_high_id
    : conversation.user_low_id;
}

async function findById(id) {
  return db('conversations').where({ id }).first();
}

async function assertParticipant(conversationId, userId) {
  const conversation = await findById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  if (conversation.user_low_id !== userId && conversation.user_high_id !== userId) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }
  return conversation;
}

async function findBetween(userA, userB) {
  const [low, high] = orderedPair(userA, userB);
  return db('conversations').where({ user_low_id: low, user_high_id: high }).first();
}

async function getOrCreate(userId, otherUserIdValue) {
  if (userId === otherUserIdValue) {
    throw new AppError('Cannot start a conversation with yourself', 400, 'INVALID_TARGET');
  }
  const other = await userService.findById(otherUserIdValue);
  if (!other) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  const existing = await findBetween(userId, otherUserIdValue);
  if (existing) return existing;

  const id = newId();
  const now = new Date();
  const [low, high] = orderedPair(userId, otherUserIdValue);
  try {
    await db('conversations').insert({
      id,
      user_low_id: low,
      user_high_id: high,
      last_message_at: null,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    const raced = await findBetween(userId, otherUserIdValue);
    if (raced) return raced;
    throw err;
  }
  return findById(id);
}

async function listForUser(userId) {
  const conversations = await db('conversations')
    .where((qb) => qb.where('user_low_id', userId).orWhere('user_high_id', userId))
    .orderByRaw('COALESCE(last_message_at, created_at) DESC');

  if (conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c.id);
  const peerIds = [...new Set(conversations.map((c) => otherUserId(c, userId)))];

  // Batch 1: Fetch all peers in one query
  const peerRows = await db('users').whereIn('id', peerIds);
  const peerMap = new Map();
  for (const row of peerRows) {
    peerMap.set(row.id, userService.profileUser(row));
  }

  // Batch 2: Fetch unread counts in one grouped query
  const unreadRows = await db('messages')
    .whereIn('messages.conversation_id', conversationIds)
    .where('messages.sender_id', '!=', userId)
    .whereNull('messages.deleted_at')
    .whereNotExists(function notRead() {
      this.select(db.raw('1'))
        .from('message_reads')
        .whereRaw('message_reads.message_id = messages.id')
        .andWhere('message_reads.user_id', userId);
    })
    .groupBy('messages.conversation_id')
    .select('messages.conversation_id')
    .count({ count: '*' });

  const unreadMap = new Map();
  for (const u of unreadRows) {
    unreadMap.set(u.conversation_id, Number(u.count || 0));
  }

  // Batch 3: Fetch latest messages for each conversation
  const recentMessages = await db('messages')
    .whereIn('conversation_id', conversationIds)
    .orderBy('created_at', 'desc');

  const lastMessageMap = new Map();
  for (const msg of recentMessages) {
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, {
        id: msg.id,
        body: msg.deleted_at ? '' : msg.body,
        deleted: Boolean(msg.deleted_at),
        senderId: msg.sender_id,
        createdAt: msg.created_at,
      });
    }
  }

  return conversations.map((conversation) => {
    const peerId = otherUserId(conversation, userId);
    return {
      id: conversation.id,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      lastMessageAt: conversation.last_message_at,
      unreadCount: unreadMap.get(conversation.id) || 0,
      peer: peerMap.get(peerId) || null,
      lastMessage: lastMessageMap.get(conversation.id) || null,
    };
  });
}

async function touchLastMessage(conversationId, at = new Date()) {
  await db('conversations').where({ id: conversationId }).update({
    last_message_at: at,
    updated_at: at,
  });
}

module.exports = {
  findById,
  assertParticipant,
  getOrCreate,
  listForUser,
  otherUserId,
  touchLastMessage,
};
