const env = require('../config/env');
const { asyncHandler } = require('../utils/asyncHandler');
const { signAccessToken, cookieOptions } = require('../utils/tokens');
const userService = require('../services/userService');

function setAuthCookie(res, user) {
  const token = signAccessToken(user);
  res.cookie(env.cookieName, token, cookieOptions());
  return token;
}

exports.register = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  const token = setAuthCookie(res, user);
  res.status(201).json({ user: userService.publicUser(user), token });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await userService.authenticate(req.body.login, req.body.password);
  const token = setAuthCookie(res, user);
  res.json({ user: userService.publicUser(user), token });
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie(env.cookieName, { ...cookieOptions(), maxAge: 0 });
  res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: userService.publicUser(req.user) });
});
