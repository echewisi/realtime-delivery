import { Knex } from 'knex';

function getConnectionConfig() {
  const environment = process.env.NODE_ENV || 'development';
  
  // First, try to use connection string if provided
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
  if (connectionString) {
    // For connection string, we return it directly with optional SSL config
    return connectionString + (environment === 'production' ? '?sslmode=require' : '');
  }

  // If no connection string, build from individual params
  const envPrefix = environment === 'test' ? 'TEST_DB_' : 'DB_';
  
  const config = {
    host: process.env[`${envPrefix}HOST`] || 'localhost',
    port: parseInt(process.env[`${envPrefix}PORT`] || '5432', 10),
    user: process.env[`${envPrefix}USER`] || 'postgres',
    password: process.env[`${envPrefix}PASSWORD`] || 'postgres',
    database: process.env[`${envPrefix}NAME`] || `realtime_delivery_${environment}`,
    ssl: environment === 'production' ? { rejectUnauthorized: false } : false
  };

  // Validate configuration for production
  if (environment === 'production' && (!config.host || !config.password || !config.user)) {
    throw new Error('Database configuration missing required fields');
  }

  return config;
}

const knexConfig: Knex.Config = {
  client: 'pg',
  connection: getConnectionConfig(),
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '30000', 10),
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: '../migrations',
    extension: 'ts',
  },
  debug: process.env.DB_DEBUG === 'true',
  asyncStackTraces: process.env.NODE_ENV !== 'production'
};

export default knexConfig;
