const knex = require('knex');
const knexfile = require('../../knexfile');

const db = knex(knexfile);

async function pingDatabase() {
  await db.raw('SELECT 1');
  try {
    await db.migrate.latest();
  } catch (err) {
    console.warn('Migration warning:', err.message);
  }
}

module.exports = { db, pingDatabase };
