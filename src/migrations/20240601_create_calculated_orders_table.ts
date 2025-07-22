import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('calculated_orders', (table) => {
    table.increments('id').primary();
    table.decimal('total_amount').notNullable();
    table.boolean('free_delivery').defaultTo(false);
    table.decimal('delivery_fee').notNullable();
    table.decimal('service_charge').notNullable();
    table.jsonb('address_details').notNullable();
    table.jsonb('meals').notNullable();
    table.decimal('amount').notNullable();
    table.decimal('internal_profit').notNullable();
    table.string('lat').notNullable();
    table.string('lng').notNullable();
    table.string('cokitchen_polygon_id').notNullable();
    table.integer('user_id').notNullable();
    table.integer('cokitchen_id').notNullable();
    table.boolean('pickup').defaultTo(false);
    table.decimal('prev_price').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('calculated_orders');
} 