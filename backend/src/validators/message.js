const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');

const conversationId = [
  param('id').isUUID().withMessage('Invalid conversation id'),
  validate,
];

const messageId = [
  param('id').isUUID().withMessage('Invalid message id'),
  validate,
];

const createConversation = [
  body('userId').isUUID().withMessage('userId must be a valid user id'),
  validate,
];

const listMessages = [
  param('id').isUUID().withMessage('Invalid conversation id'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('before').optional().isUUID(),
  validate,
];

const createMessage = [
  param('id').isUUID().withMessage('Invalid conversation id'),
  body('body')
    .isString()
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message must be 1-4000 characters'),
  body('replyToId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('replyToId must be a valid message id'),
  validate,
];

const editMessage = [
  param('id').isUUID().withMessage('Invalid message id'),
  body('body')
    .isString()
    .trim()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message must be 1-4000 characters'),
  validate,
];

const toggleReaction = [
  param('id').isUUID().withMessage('Invalid message id'),
  body('emoji')
    .isString()
    .trim()
    .isLength({ min: 1, max: 16 })
    .withMessage('emoji must be 1-16 characters'),
  validate,
];

module.exports = {
  conversationId,
  messageId,
  createConversation,
  listMessages,
  createMessage,
  editMessage,
  toggleReaction,
};
