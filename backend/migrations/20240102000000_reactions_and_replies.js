/**
 * Schema migration for emoji reactions and message replies.
 * Compatible with SQLite, PostgreSQL, and MySQL.
 */

exports.up = async function up(knex) {
  // 1. Add reply_to_message_id to messages
  await knex.schema.alterTable('messages', (table) => {
    table.string('reply_to_message_id', 36).nullable();
    table.index(['reply_to_message_id']);
  });

  // 2. Create message_reactions table
  await knex.schema.createTable('message_reactions', (table) => {
    table.string('id', 36).primary();
    table.string('message_id', 36).notNullable();
    table.string('user_id', 36).notNullable();
    table.string('emoji', 16).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['message_id', 'user_id', 'emoji']);
    table.foreign('message_id').references('messages.id').onDelete('CASCADE');
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.index(['message_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('message_reactions');
  await knex.schema.alterTable('messages', (table) => {
    table.dropColumn('reply_to_message_id');
  });
};
