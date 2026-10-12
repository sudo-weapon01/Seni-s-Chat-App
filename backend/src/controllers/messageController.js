const { asyncHandler } = require('../utils/asyncHandler');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const { emitToUsers } = require('../sockets/io');

exports.edit = asyncHandler(async (req, res) => {
  const message = await messageService.editMessage(req.params.id, req.user.id, req.body.body);
  const conversation = await conversationService.findById(message.conversationId);
  emitToUsers([conversation.user_low_id, conversation.user_high_id], 'message:edited', { message });
  res.json({ message });
});

exports.remove = asyncHandler(async (req, res) => {
  const message = await messageService.deleteMessage(req.params.id, req.user.id);
  const conversation = await conversationService.findById(message.conversationId);
  emitToUsers([conversation.user_low_id, conversation.user_high_id], 'message:deleted', { message });
  res.json({ message });
});

exports.history = asyncHandler(async (req, res) => {
  const history = await messageService.editHistory(req.params.id, req.user.id);
  res.json({ history });
});

exports.react = asyncHandler(async (req, res) => {
  const result = await messageService.toggleReaction(req.params.id, req.user.id, req.body.emoji);
  const conversation = await conversationService.findById(result.conversationId);
  emitToUsers(
    [conversation.user_low_id, conversation.user_high_id],
    'reaction:update',
    result
  );
  res.json(result);
});
