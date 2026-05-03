"use strict";
/**
 * Database Connection Layer
 * PostgreSQL with PostGIS support for geospatial queries
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = exports.getDatabaseStats = exports.isDatabaseHealthy = exports.closeDatabase = exports.transaction = exports.getClient = exports.query = exports.connectDatabase = void 0;
var pg_1 = require("pg");
var logger_1 = require("../utils/logger");
var DatabaseConnection = /** @class */ (function () {
    function DatabaseConnection() {
        this.pool = null;
        this.isConnected = false;
        this.initialize();
    }
    DatabaseConnection.prototype.initialize = function () {
        var poolConfig = {
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
        this.pool.on('error', function (err) {
            logger_1.logger.error('Unexpected database pool error:', err);
        });
        this.pool.on('connect', function () {
            logger_1.logger.debug('New database connection established');
        });
        this.pool.on('remove', function () {
            logger_1.logger.debug('Database connection removed from pool');
        });
    };
    /**
     * Connect and verify database
     */
    DatabaseConnection.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.pool) {
                            throw new Error('Database pool not initialized');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        return [4 /*yield*/, this.pool.connect()];
                    case 2:
                        client = _a.sent();
                        return [4 /*yield*/, client.query('SELECT NOW(), version()')];
                    case 3:
                        result = _a.sent();
                        client.release();
                        logger_1.logger.info('Database connected:', {
                            timestamp: result.rows[0].now,
                            version: result.rows[0].version.split(' ')[1],
                        });
                        // Enable PostGIS if not already enabled
                        return [4 /*yield*/, this.enablePostGIS()];
                    case 4:
                        // Enable PostGIS if not already enabled
                        _a.sent();
                        this.isConnected = true;
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        logger_1.logger.error('Database connection failed:', error_1);
                        throw error_1;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Enable PostGIS extension for geospatial queries
     */
    DatabaseConnection.prototype.enablePostGIS = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.query('CREATE EXTENSION IF NOT EXISTS postgis;')];
                    case 1:
                        _a.sent();
                        logger_1.logger.info('PostGIS extension enabled');
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        logger_1.logger.warn('Could not enable PostGIS extension:', error_2);
                        return [3 /*break*/, 3];
                    case 3:
                        _a.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, this.query('CREATE EXTENSION IF NOT EXISTS cube;')];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.query('CREATE EXTENSION IF NOT EXISTS earthdistance;')];
                    case 5:
                        _a.sent();
                        logger_1.logger.info('cube + earthdistance extensions enabled (point <@> point)');
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        logger_1.logger.warn('Could not enable cube/earthdistance extensions:', error_3);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a query
     */
    DatabaseConnection.prototype.query = function (text, params) {
        return __awaiter(this, void 0, void 0, function () {
            var start, result, duration, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.pool) {
                            throw new Error('Database pool not initialized');
                        }
                        start = Date.now();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.pool.query(text, params)];
                    case 2:
                        result = _a.sent();
                        duration = Date.now() - start;
                        if (duration > 1000) {
                            logger_1.logger.warn('Slow query detected:', {
                                query: text.substring(0, 100),
                                duration: "".concat(duration, "ms"),
                            });
                        }
                        return [2 /*return*/, result];
                    case 3:
                        error_4 = _a.sent();
                        logger_1.logger.error('Query error:', {
                            query: text.substring(0, 100),
                            error: error_4,
                        });
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a client from the pool for transactions
     */
    DatabaseConnection.prototype.getClient = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.pool) {
                            throw new Error('Database pool not initialized');
                        }
                        return [4 /*yield*/, this.pool.connect()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Execute a transaction
     */
    DatabaseConnection.prototype.transaction = function (callback) {
        return __awaiter(this, void 0, void 0, function () {
            var client, result, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getClient()];
                    case 1:
                        client = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, 8, 9]);
                        return [4 /*yield*/, client.query('BEGIN')];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, callback(client)];
                    case 4:
                        result = _a.sent();
                        return [4 /*yield*/, client.query('COMMIT')];
                    case 5:
                        _a.sent();
                        return [2 /*return*/, result];
                    case 6:
                        error_5 = _a.sent();
                        return [4 /*yield*/, client.query('ROLLBACK')];
                    case 7:
                        _a.sent();
                        logger_1.logger.error('Transaction failed:', error_5);
                        throw error_5;
                    case 8:
                        client.release();
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Close all connections
     */
    DatabaseConnection.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.pool) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.pool.end()];
                    case 1:
                        _a.sent();
                        this.isConnected = false;
                        logger_1.logger.info('Database connections closed');
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if database is connected
     */
    DatabaseConnection.prototype.isHealthy = function () {
        return this.isConnected && this.pool !== null;
    };
    /**
     * Get the underlying pool for legacy route compatibility.
     * Prefer using query(), getClient(), or transaction() instead.
     */
    DatabaseConnection.prototype.getPool = function () {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }
        return this.pool;
    };
    /**
     * Get pool statistics
     */
    DatabaseConnection.prototype.getStats = function () {
        if (!this.pool) {
            return null;
        }
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    };
    return DatabaseConnection;
}());
// Singleton instance
var db = new DatabaseConnection();
var connectDatabase = function () { return db.connect(); };
exports.connectDatabase = connectDatabase;
var query = function (text, params) { return db.query(text, params); };
exports.query = query;
var getClient = function () { return db.getClient(); };
exports.getClient = getClient;
var transaction = function (callback) {
    return db.transaction(callback);
};
exports.transaction = transaction;
var closeDatabase = function () { return db.close(); };
exports.closeDatabase = closeDatabase;
var isDatabaseHealthy = function () { return db.isHealthy(); };
exports.isDatabaseHealthy = isDatabaseHealthy;
var getDatabaseStats = function () { return db.getStats(); };
exports.getDatabaseStats = getDatabaseStats;
var getPool = function () { return db.getPool(); };
exports.getPool = getPool;
exports.default = db;
