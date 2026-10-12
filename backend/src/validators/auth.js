const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

const usernameRule = body('username')
  .trim()
  .isLength({ min: 3, max: 32 })
  .withMessage('Username must be 3-32 characters')
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage('Username may only contain letters, numbers, and underscores');

const emailRule = body('email')
  .trim()
  .isEmail()
  .withMessage('Valid email is required')
  .normalizeEmail()
  .isLength({ max: 255 });

const passwordRule = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be 8-128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must include a letter')
  .matches(/[0-9]/)
  .withMessage('Password must include a number');

const register = [
  usernameRule,
  emailRule,
  passwordRule,
  validate,
];

const login = [
  body('login').trim().notEmpty().withMessage('Username or email is required').isLength({ max: 255 }),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

module.exports = { register, login };
