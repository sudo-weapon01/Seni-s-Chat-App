const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const client = process.env.DB_CLIENT || 'sqlite3';

let connection;
if (client === 'sqlite3') {
  connection = {
    filename: process.env.DB_FILENAME || path.join(__dirname, 'seni_chat.sqlite'),
  };
} else {
  connection = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || (client === 'mysql2' ? 3306 : 5432)),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (client === 'pg') {
    connection.ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  }

  if (client === 'mysql2') {
    connection.charset = 'utf8mb4';
  }
}

module.exports = {
  client,
  connection,
  useNullAsDefault: client === 'sqlite3',
  pool: client === 'sqlite3'
    ? {
        afterCreate: (conn, cb) => {
          conn.run('PRAGMA foreign_keys = ON', cb);
        },
      }
    : { min: 2, max: 10 },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};
