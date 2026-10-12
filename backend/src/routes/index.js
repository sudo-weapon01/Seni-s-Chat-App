const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, writeLimiter } = require('../middleware/rateLimit');
const authValidators = require('../validators/auth');
const userValidators = require('../validators/user');
const messageValidators = require('../validators/message');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const conversationController = require('../controllers/conversationController');
const messageController = require('../controllers/messageController');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.post('/auth/register', authLimiter, authValidators.register, authController.register);
router.post('/auth/login', authLimiter, authValidators.login, authController.login);
router.post('/auth/logout', authController.logout);
router.get('/auth/me', requireAuth, authController.me);

router.get('/users/search', requireAuth, userValidators.search, userController.search);
router.patch('/users/me', requireAuth, writeLimiter, userValidators.updateProfile, userController.updateMe);
router.get('/users/:id', requireAuth, userValidators.userIdParam, userController.getById);

router.get('/conversations', requireAuth, conversationController.list);
router.post('/conversations', requireAuth, writeLimiter, messageValidators.createConversation, conversationController.create);
router.get('/conversations/:id/messages', requireAuth, messageValidators.listMessages, conversationController.messages);
router.post('/conversations/:id/messages', requireAuth, writeLimiter, messageValidators.createMessage, conversationController.sendMessage);
router.post('/conversations/:id/read', requireAuth, messageValidators.conversationId, conversationController.markRead);

router.patch('/messages/:id', requireAuth, writeLimiter, messageValidators.editMessage, messageController.edit);
router.delete('/messages/:id', requireAuth, writeLimiter, messageValidators.messageId, messageController.remove);
router.get('/messages/:id/history', requireAuth, messageValidators.messageId, messageController.history);
router.post('/messages/:id/reactions', requireAuth, writeLimiter, messageValidators.toggleReaction, messageController.react);

module.exports = router;
