const { asyncHandler } = require('../utils/asyncHandler');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const { emitToUsers } = require('../sockets/io');
const { isOnline } = require('../sockets/presence');

exports.list = asyncHandler(async (req, res) => {
  const conversations = await conversationService.listForUser(req.user.id);
  res.json({
    conversations: conversations.map((c) => ({
      ...c,
      peer: c.peer ? { ...c.peer, online: isOnline(c.peer.id) } : null,
    })),
  });
});

exports.create = asyncHandler(async (req, res) => {
  const conversation = await conversationService.getOrCreate(req.user.id, req.body.userId);
  const match = (await conversationService.listForUser(req.user.id)).find((c) => c.id === conversation.id);
  res.status(201).json({
    conversation: {
      ...match,
      peer: match.peer ? { ...match.peer, online: isOnline(match.peer.id) } : null,
    },
  });
});

exports.messages = asyncHandler(async (req, res) => {
  const messages = await messageService.listByConversation(req.params.id, req.user.id, {
    limit: req.query.limit,
    before: req.query.before,
  });
  res.json({ messages });
});

exports.sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.createMessage(
    req.params.id,
    req.user.id,
    req.body.body,
    req.body.replyToId
  );
  const conversation = await conversationService.findById(message.conversationId);
  emitToUsers([conversation.user_low_id, conversation.user_high_id], 'message:new', { message });
  res.status(201).json({ message });
});

exports.markRead = asyncHandler(async (req, res) => {
  const result = await messageService.markConversationRead(req.params.id, req.user.id);
  if (result.markedMessageIds.length) {
    const conversation = await conversationService.findById(req.params.id);
    emitToUsers(
      [conversation.user_low_id, conversation.user_high_id],
      'receipt:update',
      result
    );
  }
  res.json(result);
});
