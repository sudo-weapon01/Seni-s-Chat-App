/**
 * Schema for users, conversations, messages, read receipts, and edit history.
 * Compatible with both PostgreSQL (DB_CLIENT=pg) and MySQL (DB_CLIENT=mysql2).
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.string('id', 36).primary();
    table.string('username', 32).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('avatar_url', 2048).nullable();
    table.string('bio', 500).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('conversations', (table) => {
    table.string('id', 36).primary();
    table.string('user_low_id', 36).notNullable();
    table.string('user_high_id', 36).notNullable();
    table.timestamp('last_message_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_low_id', 'user_high_id']);
    table.foreign('user_low_id').references('users.id').onDelete('CASCADE');
    table.foreign('user_high_id').references('users.id').onDelete('CASCADE');
    table.index(['last_message_at']);
  });

  await knex.schema.createTable('messages', (table) => {
    table.string('id', 36).primary();
    table.string('conversation_id', 36).notNullable();
    table.string('sender_id', 36).notNullable();
    table.text('body').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('edited_at').nullable();
    table.timestamp('deleted_at').nullable();
    table.foreign('conversation_id').references('conversations.id').onDelete('CASCADE');
    table.foreign('sender_id').references('users.id').onDelete('CASCADE');
    table.index(['conversation_id', 'created_at']);
  });

  await knex.schema.createTable('message_reads', (table) => {
    table.string('id', 36).primary();
    table.string('message_id', 36).notNullable();
    table.string('user_id', 36).notNullable();
    table.timestamp('read_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['message_id', 'user_id']);
    table.foreign('message_id').references('messages.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['user_id', 'message_id']);
  });

  await knex.schema.createTable('message_edit_history', (table) => {
    table.string('id', 36).primary();
    table.string('message_id', 36).notNullable();
    table.string('edited_by', 36).notNullable();
    table.text('previous_body').notNullable();
    table.timestamp('edited_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('message_id').references('messages.id').onDelete('CASCADE');
    table.foreign('edited_by').references('users.id').onDelete('CASCADE');
    table.index(['message_id', 'edited_at']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('message_edit_history');
  await knex.schema.dropTableIfExists('message_reads');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('conversations');
  await knex.schema.dropTableIfExists('users');
};
