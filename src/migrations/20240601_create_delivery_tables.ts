import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  
  await knex.schema.createTable('riders', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('email').unique();
    table.string('phone').unique();
    table.string('password').notNullable();
    table.boolean('is_available').defaultTo(false);
    table.decimal('current_latitude', 10, 8).nullable();
    table.decimal('current_longitude', 11, 8).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('order_types', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('calculated_orders', (table) => {
    table.increments('id').primary();
    table.decimal('total_amount', 10, 2).notNullable();
    table.boolean('free_delivery').defaultTo(false);
    table.decimal('delivery_fee', 10, 2).defaultTo(0);
    table.decimal('service_charge', 10, 2).defaultTo(0);
    table.jsonb('address_details').notNullable();
    table.jsonb('meals').notNullable();
    table.decimal('amount').notNullable();
    table.decimal('internal_profit').notNullable();
    table.decimal('lat', 10, 8).nullable();
    table.decimal('lng', 11, 8).nullable();
    table.string('cokitchen_polygon_id');
    table.integer('user_id').notNullable();
    table.string('cokitchen_id');
    table.boolean('pickup').defaultTo(false);
    table.decimal('prev_price', 10, 2).nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('orders', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable();
    table.boolean('completed').defaultTo(false);
    table.boolean('cancelled').defaultTo(false);
    table.boolean('kitchen_cancelled').defaultTo(false);
    table.boolean('kitchen_accepted').defaultTo(false);
    table.boolean('kitchen_dispatched').defaultTo(false);
    table.timestamp('kitchen_dispatched_time').nullable();
    table.timestamp('completed_time').nullable();
    table.integer('rider_id').nullable().references('id').inTable('riders');
    table.boolean('kitchen_prepared').defaultTo(false);
    table.boolean('rider_assigned').defaultTo(false);
    table.boolean('paid').defaultTo(false);
    table.string('order_code').notNullable();
    table.jsonb('order_change').nullable();
    table.integer('calculated_order_id').notNullable().references('id').inTable('calculated_orders');
    table.integer('order_type_id').references('id').inTable('order_types');
    table.timestamp('kitchen_verified_time').nullable();
    table.timestamp('kitchen_completed_time').nullable();
    table.boolean('shop_accepted').defaultTo(false);
    table.boolean('shop_prepared').defaultTo(false);
    table.integer('no_of_mealbags_delivered').defaultTo(0);
    table.integer('no_of_drinks_delivered').defaultTo(0);
    table.timestamp('rider_started_time').nullable();
    table.boolean('rider_started').defaultTo(false);
    table.timestamp('rider_arrived_time').nullable();
    table.boolean('rider_arrived').defaultTo(false);
    table.boolean('is_failed_trip').defaultTo(false);
    table.jsonb('failed_trip_details').nullable();
    table.string('box_number').nullable();
    table.string('shelf_id').nullable();
    table.string('status').defaultTo('pending');
    table.boolean('is_hidden').defaultTo(false);
    table.integer('confirmed_by_id').nullable();
    table.integer('completed_by_id').nullable();
    table.boolean('scheduled').defaultTo(false);
    table.date('scheduled_delivery_date').nullable();
    table.string('scheduled_delivery_time').nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('logs', (table) => {
    table.increments('id').primary();
    table.integer('order_id').notNullable().references('id').inTable('orders');
    table.text('description').notNullable();
    table.timestamp('time').notNullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('order_total_amount_history', (table) => {
    table.increments('id').primary();
    table.integer('order_id').notNullable().references('id').inTable('orders');
    table.decimal('total_amount', 10, 2).notNullable();
    table.timestamp('time').notNullable();
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  try {
    // Drop tables in reverse order of creation (due to foreign key constraints)
    await knex.raw('DROP TABLE IF EXISTS order_total_amount_history CASCADE');
    await knex.raw('DROP TABLE IF EXISTS logs CASCADE');
    await knex.raw('DROP TABLE IF EXISTS orders CASCADE');
    await knex.raw('DROP TABLE IF EXISTS calculated_orders CASCADE');
    await knex.raw('DROP TABLE IF EXISTS order_types CASCADE');
    await knex.raw('DROP TABLE IF EXISTS riders CASCADE');
    

  } catch (error) {
    console.error('Error during migration rollback:', error);
    throw error;
  }
}
