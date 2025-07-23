import { config } from 'dotenv';
import type { Knex } from 'knex';

// Load environment variables
config();

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false
    }
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    max: parseInt(process.env.DB_POOL_MAX || '10')
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './src/migrations',
    extension: 'ts',
    schemaName: 'public',
    disableTransactions: false,
  },
  asyncStackTraces: true,
};

export default knexConfig;
