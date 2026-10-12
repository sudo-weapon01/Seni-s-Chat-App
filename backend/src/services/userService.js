const { db } = require('../db');
const { newId } = require('../utils/ids');
const { hashPassword, verifyPassword } = require('../utils/passwords');
const { AppError } = require('../middleware/error');

const PUBLIC_COLUMNS = [
  'id',
  'username',
  'email',
  'avatar_url',
  'bio',
  'created_at',
  'updated_at',
];

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    bio: row.bio || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function profileUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    bio: row.bio || '',
    createdAt: row.created_at,
  };
}

async function findById(id) {
  const row = await db('users').where({ id }).first();
  return row || null;
}

async function findByEmail(email) {
  return db('users').whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first();
}

async function findByUsername(username) {
  return db('users').whereRaw('LOWER(username) = ?', [username.toLowerCase()]).first();
}

async function createUser({ username, email, password }) {
  const existingEmail = await findByEmail(email);
  if (existingEmail) {
    throw new AppError('Email is already registered', 409, 'EMAIL_TAKEN');
  }
  const existingUsername = await findByUsername(username);
  if (existingUsername) {
    throw new AppError('Username is already taken', 409, 'USERNAME_TAKEN');
  }

  const id = newId();
  const now = new Date();
  await db('users').insert({
    id,
    username,
    email: email.toLowerCase(),
    password_hash: await hashPassword(password),
    avatar_url: null,
    bio: null,
    created_at: now,
    updated_at: now,
  });
  return findById(id);
}

async function authenticate(login, password) {
  const row = login.includes('@')
    ? await findByEmail(login)
    : await findByUsername(login);
  if (!row) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }
  return row;
}

async function updateProfile(userId, { bio, avatarUrl }) {
  const patch = { updated_at: new Date() };
  if (bio !== undefined) patch.bio = bio;
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl || null;
  await db('users').where({ id: userId }).update(patch);
  return findById(userId);
}

async function searchUsers(query, viewerId, limit = 20) {
  const like = `%${query.toLowerCase()}%`;
  const rows = await db('users')
    .select(PUBLIC_COLUMNS)
    .where('id', '!=', viewerId)
    .andWhere(function whereSearch() {
      this.whereRaw('LOWER(username) LIKE ?', [like]).orWhereRaw('LOWER(email) LIKE ?', [like]);
    })
    .orderBy('username', 'asc')
    .limit(limit);
  return rows.map((row) => ({
    ...profileUser(row),
    email: row.email,
  }));
}

module.exports = {
  publicUser,
  profileUser,
  findById,
  findByEmail,
  findByUsername,
  createUser,
  authenticate,
  updateProfile,
  searchUsers,
};
