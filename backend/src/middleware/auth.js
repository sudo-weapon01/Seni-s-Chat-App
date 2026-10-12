const env = require('../config/env');
const { verifyAccessToken } = require('../utils/tokens');
const { AppError } = require('./error');
const userService = require('../services/userService');

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (req.cookies && req.cookies[env.cookieName]) {
    return req.cookies[env.cookieName];
  }
  return null;
}

async function requireAuth(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }
    const payload = verifyAccessToken(token);
    const user = await userService.findById(payload.sub);
    if (!user) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('Invalid or expired token', 401, 'UNAUTHENTICATED'));
  }
}

module.exports = { requireAuth, extractToken };
