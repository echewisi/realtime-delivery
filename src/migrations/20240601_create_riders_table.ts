import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('riders', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.boolean('is_available').defaultTo(true);
    table.decimal('current_latitude', 10, 7).notNullable();
    table.decimal('current_longitude', 10, 7).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('riders');
} 