import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('order_total_amount_history', (table) => {
    table.increments('id').primary();
    table.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    table.timestamp('time').notNullable();
    table.decimal('total_amount').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('order_total_amount_history');
} 