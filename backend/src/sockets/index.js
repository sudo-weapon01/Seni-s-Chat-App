const { Server } = require('socket.io');
const env = require('../config/env');
const { verifyAccessToken } = require('../utils/tokens');
const userService = require('../services/userService');
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const { setIo } = require('./io');
const { addSocket, removeSocket, isOnline } = require('./presence');

function tokenFromHandshake(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  if (authToken) return authToken;
  const header = socket.handshake.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  const cookie = socket.handshake.headers.cookie || '';
  const match = cookie.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${env.cookieName}=`));
  if (match) return decodeURIComponent(match.split('=').slice(1).join('='));
  return null;
}

function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const token = tokenFromHandshake(socket);
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await userService.findById(payload.sub);
      if (!user) return next(new Error('Authentication required'));
      socket.user = user;
      next();
    } catch (_err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    addSocket(userId, socket.id);
    socket.join(`user:${userId}`);
    io.emit('presence:update', { userId, online: true });

    socket.on('conversation:join', async (payload, ack) => {
      try {
        const conversationId = payload && payload.conversationId;
        if (!conversationId) throw new Error('conversationId required');
        await conversationService.assertParticipant(conversationId, userId);
        socket.join(`conversation:${conversationId}`);
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('conversation:leave', (payload) => {
      const conversationId = payload && payload.conversationId;
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing:start', async (payload) => {
      try {
        const conversationId = payload && payload.conversationId;
        await conversationService.assertParticipant(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId,
          username: socket.user.username,
          typing: true,
        });
      } catch (_err) {
        /* ignore */
      }
    });

    socket.on('typing:stop', async (payload) => {
      try {
        const conversationId = payload && payload.conversationId;
        await conversationService.assertParticipant(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit('typing:update', {
          conversationId,
          userId,
          username: socket.user.username,
          typing: false,
        });
      } catch (_err) {
        /* ignore */
      }
    });

    socket.on('conversation:read', async (payload, ack) => {
      try {
        const conversationId = payload && payload.conversationId;
        const result = await messageService.markConversationRead(conversationId, userId);
        if (result.markedMessageIds.length) {
          const conversation = await conversationService.findById(conversationId);
          io.to(`user:${conversation.user_low_id}`).emit('receipt:update', result);
          io.to(`user:${conversation.user_high_id}`).emit('receipt:update', result);
        }
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('reaction:toggle', async (payload, ack) => {
      try {
        const { messageId, emoji } = payload || {};
        if (!messageId || !emoji) throw new Error('messageId and emoji required');
        const result = await messageService.toggleReaction(messageId, userId, emoji);
        const conversation = await conversationService.findById(result.conversationId);
        io.to(`user:${conversation.user_low_id}`).emit('reaction:update', result);
        io.to(`user:${conversation.user_high_id}`).emit('reaction:update', result);
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('presence:query', (payload, ack) => {
      const ids = (payload && payload.userIds) || [];
      const statuses = {};
      for (const id of ids) statuses[id] = isOnline(id);
      if (typeof ack === 'function') ack({ statuses });
    });

    socket.on('disconnect', () => {
      removeSocket(userId, socket.id);
      if (!isOnline(userId)) {
        io.emit('presence:update', { userId, online: false });
      }
    });
  });

  setIo(io);
  return io;
}

module.exports = { attachSockets };
