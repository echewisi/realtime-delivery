import { knex } from 'knex';
import config from './knexfile';

const db = knex(config);

async function dropTables() {
  try {
    await db.raw('DROP TABLE IF EXISTS order_total_amount_history CASCADE');
    await db.raw('DROP TABLE IF EXISTS logs CASCADE');
    await db.raw('DROP TABLE IF EXISTS orders CASCADE');
    await db.raw('DROP TABLE IF EXISTS calculated_orders CASCADE');
    await db.raw('DROP TABLE IF EXISTS order_types CASCADE');
    await db.raw('DROP TABLE IF EXISTS riders CASCADE');
    await db.raw('DROP TABLE IF EXISTS knex_migrations CASCADE');
    await db.raw('DROP TABLE IF EXISTS knex_migrations_lock CASCADE');
    console.log('All tables dropped successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

dropTables();
