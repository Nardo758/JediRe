"use strict";
/**
 * Logging Utility
 * Winston-based structured logging
 */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var winston_1 = require("winston");
var path_1 = require("path");
var LOG_LEVEL = process.env.LOG_LEVEL || 'info';
var LOG_FILE = process.env.LOG_FILE || 'logs/jedire.log';
var NODE_ENV = process.env.NODE_ENV || 'development';
// Custom format for console output
var consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(function (_a) {
    var timestamp = _a.timestamp, level = _a.level, message = _a.message, meta = __rest(_a, ["timestamp", "level", "message"]);
    var metaStr = '';
    if (Object.keys(meta).length > 0) {
        metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return "".concat(timestamp, " [").concat(level, "] ").concat(message).concat(metaStr);
}));
// File format (JSON for parsing)
var fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json());
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
var fs_1 = require("fs");
var logDir = path_1.default.dirname(path_1.default.resolve(LOG_FILE));
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
exports.default = exports.logger;
