const { body, query, param } = require('express-validator');
const { validate } = require('../middleware/validate');

const search = [
  query('q')
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage('Search query must be 1-64 characters'),
  validate,
];

const updateProfile = [
  body('bio').optional({ nullable: true }).isString().isLength({ max: 500 }).withMessage('Bio must be 500 characters or fewer'),
  body('avatarUrl')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    })
    .withMessage('Avatar must be a valid http(s) URL'),
  validate,
];

const userIdParam = [
  param('id').isUUID().withMessage('Invalid user id'),
  validate,
];

module.exports = { search, updateProfile, userIdParam };
