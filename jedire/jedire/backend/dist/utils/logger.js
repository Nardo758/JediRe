"use strict";
/**
 * Logging Utility
 * Winston-based structured logging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = process.env.LOG_FILE || 'logs/jedire.log';
const NODE_ENV = process.env.NODE_ENV || 'development';
// Custom format for console output
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
        metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
}));
// File format (JSON for parsing)
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
// Create logger
exports.logger = winston_1.default.createLogger({
    level: LOG_LEVEL,
    defaultMeta: {
        service: 'jedire-api',
        environment: NODE_ENV,
    },
    transports: [
        // Console output
        new winston_1.default.transports.Console({
            format: consoleFormat,
        }),
        // File output (errors only)
        new winston_1.default.transports.File({
            filename: path_1.default.resolve(LOG_FILE),
            level: 'error',
            format: fileFormat,
        }),
        // File output (all levels)
        new winston_1.default.transports.File({
            filename: path_1.default.resolve(LOG_FILE.replace('.log', '-all.log')),
            format: fileFormat,
        }),
    ],
});
// Create logs directory if it doesn't exist
const fs_1 = __importDefault(require("fs"));
const logDir = path_1.default.dirname(path_1.default.resolve(LOG_FILE));
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map