const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../middleware/error');
const userService = require('../services/userService');

exports.search = asyncHandler(async (req, res) => {
  const users = await userService.searchUsers(req.query.q, req.user.id);
  res.json({ users });
});

exports.getById = asyncHandler(async (req, res) => {
  const row = await userService.findById(req.params.id);
  if (!row) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  const profile = req.params.id === req.user.id
    ? userService.publicUser(row)
    : userService.profileUser(row);
  res.json({ user: profile });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, {
    bio: req.body.bio,
    avatarUrl: req.body.avatarUrl,
  });
  res.json({ user: userService.publicUser(user) });
});
