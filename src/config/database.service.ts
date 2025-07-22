import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Knex, knex } from 'knex';
import knexConfig from './knexfile';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private knexInstance: Knex;
  private readonly logger = new Logger(DatabaseService.name);
  private isConnected = false;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000; // 5 seconds

  constructor() {
    this.initializeKnex();
  }

  private initializeKnex() {
    this.knexInstance = knex(knexConfig);
    
    // Add event listeners for connection issues
    this.knexInstance.client.pool.on('createSuccess', () => {
      if (!this.isConnected) {
        this.isConnected = true;
        this.logger.log('Database connection established');
      }
    });

    this.knexInstance.client.pool.on('error', (error) => {
      this.logger.error(`Database pool error: ${error.message}`);
      this.isConnected = false;
    });
  }

  async onModuleInit() {
    await this.validateConnection();
  }

  private async validateConnection(retryCount = 0): Promise<void> {
    try {
      await this.knexInstance.raw('SELECT 1');
      this.isConnected = true;
      this.logger.log('Database connection validated');
    } catch (error) {
      this.isConnected = false;
      this.logger.error(`Failed to validate database connection: ${error.message}`);

      if (retryCount < this.maxRetries) {
        this.logger.warn(`Retrying connection in ${this.retryDelay}ms... (${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        await this.validateConnection(retryCount + 1);
      } else {
        throw new Error('Failed to establish database connection after maximum retries');
      }
    }
  }

  get knex(): Knex {
    if (!this.isConnected) {
      throw new Error('Database connection is not available');
    }
    return this.knexInstance;
  }

  async raw<T = any>(query: string, bindings?: readonly any[]): Promise<Knex.Raw<T>> {
    try {
      return await this.knexInstance.raw<T>(query, bindings || []);
    } catch (error) {
      this.logger.error(`Raw query error: ${error.message}`);
      this.logger.error(`Query: ${query}`);
      this.logger.error(`Bindings: ${JSON.stringify(bindings)}`);
      throw error;
    }
  }

  async transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>,
    config?: Knex.TransactionConfig
  ): Promise<T> {
    try {
      return await this.knexInstance.transaction(callback, config);
    } catch (error) {
      this.logger.error(`Transaction error: ${error.message}`);
      throw error;
    }
  }

  // Method to check if specific table exists
  async hasTable(tableName: string): Promise<boolean> {
    try {
      return await this.knexInstance.schema.hasTable(tableName);
    } catch (error) {
      this.logger.error(`Error checking table ${tableName}: ${error.message}`);
      throw error;
    }
  }

  // Method to get table column information
  async getTableInfo(tableName: string): Promise<any[]> {
    try {
      const result = await this.raw(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = ?`,
        [tableName]
      );
      return result.rows;
    } catch (error) {
      this.logger.error(`Error getting table info for ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.knexInstance.destroy();
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error(`Error closing database connection: ${error.message}`);
    }
  }
}
