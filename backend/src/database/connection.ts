/**
 * Database Connection Layer
 * PostgreSQL with PostGIS support for geospatial queries
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

class DatabaseConnection {
  private pool: Pool | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const poolConfig: any = {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    if (process.env.DATABASE_URL) {
      poolConfig.connectionString = process.env.DATABASE_URL;
    } else {
      poolConfig.host = process.env.DB_HOST || 'localhost';
      poolConfig.port = parseInt(process.env.DB_PORT || '5432');
      poolConfig.database = process.env.DB_NAME || 'jedire';
      poolConfig.user = process.env.DB_USER || 'postgres';
      poolConfig.password = process.env.DB_PASSWORD;
    }

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error:', err);
    });

    this.pool.on('connect', () => {
      logger.debug('New database connection established');
    });

    this.pool.on('remove', () => {
      logger.debug('Database connection removed from pool');
    });
  }

  /**
   * Connect and verify database
   */
  public async connect(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW(), version()');
      client.release();

      logger.info('Database connected:', {
        timestamp: result.rows[0].now,
        version: result.rows[0].version.split(' ')[1],
      });

      // Enable PostGIS if not already enabled
      await this.enablePostGIS();

      this.isConnected = true;
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Enable PostGIS extension for geospatial queries
   */
  private async enablePostGIS(): Promise<void> {
    try {
      await this.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      logger.info('PostGIS extension enabled');
    } catch (error) {
      logger.warn('Could not enable PostGIS extension:', error);
    }
  }

  /**
   * Execute a query
   */
  public async query<T = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn('Slow query detected:', {
          query: text.substring(0, 100),
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      logger.error('Query error:', {
        query: text.substring(0, 100),
        error,
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connections closed');
    }
  }

  /**
   * Check if database is connected
   */
  public isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Get pool statistics
   */
  public getStats(): any {
    if (!this.pool) {
      return null;
    }
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Singleton instance
const db = new DatabaseConnection();

export const connectDatabase = () => db.connect();
export const query = (text: string, params?: any[]) => db.query(text, params);
export const getClient = () => db.getClient();
export const transaction = <T>(callback: (client: PoolClient) => Promise<T>) =>
  db.transaction(callback);
export const closeDatabase = () => db.close();
export const isDatabaseHealthy = () => db.isHealthy();
export const getDatabaseStats = () => db.getStats();

export default db;
