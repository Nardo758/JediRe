"use strict";
/**
 * Database Connection Layer
 * PostgreSQL with PostGIS support for geospatial queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseStats = exports.isDatabaseHealthy = exports.closeDatabase = exports.transaction = exports.getClient = exports.query = exports.connectDatabase = void 0;
const pg_1 = require("pg");
const logger_1 = require("../utils/logger");
class DatabaseConnection {
    pool = null;
    isConnected = false;
    constructor() {
        this.initialize();
    }
    initialize() {
        const poolConfig = {
            min: parseInt(process.env.DB_POOL_MIN || '2'),
            max: parseInt(process.env.DB_POOL_MAX || '10'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        };
        if (process.env.DATABASE_URL) {
            poolConfig.connectionString = process.env.DATABASE_URL;
        }
        else {
            poolConfig.host = process.env.DB_HOST || 'localhost';
            poolConfig.port = parseInt(process.env.DB_PORT || '5432');
            poolConfig.database = process.env.DB_NAME || 'jedire';
            poolConfig.user = process.env.DB_USER || 'postgres';
            poolConfig.password = process.env.DB_PASSWORD;
        }
        this.pool = new pg_1.Pool(poolConfig);
        // Handle pool errors
        this.pool.on('error', (err) => {
            logger_1.logger.error('Unexpected database pool error:', err);
        });
        this.pool.on('connect', () => {
            logger_1.logger.debug('New database connection established');
        });
        this.pool.on('remove', () => {
            logger_1.logger.debug('Database connection removed from pool');
        });
    }
    /**
     * Connect and verify database
     */
    async connect() {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        try {
            // Test connection
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW(), version()');
            client.release();
            logger_1.logger.info('Database connected:', {
                timestamp: result.rows[0].now,
                version: result.rows[0].version.split(' ')[1],
            });
            // Enable PostGIS if not already enabled
            await this.enablePostGIS();
            this.isConnected = true;
        }
        catch (error) {
            logger_1.logger.error('Database connection failed:', error);
            throw error;
        }
    }
    /**
     * Enable PostGIS extension for geospatial queries
     */
    async enablePostGIS() {
        try {
            await this.query('CREATE EXTENSION IF NOT EXISTS postgis;');
            logger_1.logger.info('PostGIS extension enabled');
        }
        catch (error) {
            logger_1.logger.warn('Could not enable PostGIS extension:', error);
        }
    }
    /**
     * Execute a query
     */
    async query(text, params) {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            if (duration > 1000) {
                logger_1.logger.warn('Slow query detected:', {
                    query: text.substring(0, 100),
                    duration: `${duration}ms`,
                });
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error('Query error:', {
                query: text.substring(0, 100),
                error,
            });
            throw error;
        }
    }
    /**
     * Get a client from the pool for transactions
     */
    async getClient() {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        return await this.pool.connect();
    }
    /**
     * Execute a transaction
     */
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger_1.logger.error('Transaction failed:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Close all connections
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            logger_1.logger.info('Database connections closed');
        }
    }
    /**
     * Check if database is connected
     */
    isHealthy() {
        return this.isConnected && this.pool !== null;
    }
    /**
     * Get pool statistics
     */
    getStats() {
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
const connectDatabase = () => db.connect();
exports.connectDatabase = connectDatabase;
const query = (text, params) => db.query(text, params);
exports.query = query;
const getClient = () => db.getClient();
exports.getClient = getClient;
const transaction = (callback) => db.transaction(callback);
exports.transaction = transaction;
const closeDatabase = () => db.close();
exports.closeDatabase = closeDatabase;
const isDatabaseHealthy = () => db.isHealthy();
exports.isDatabaseHealthy = isDatabaseHealthy;
const getDatabaseStats = () => db.getStats();
exports.getDatabaseStats = getDatabaseStats;
exports.default = db;
//# sourceMappingURL=connection.js.map