/**
 * Logging Utility
 * Winston-based structured logging
 */

import winston from 'winston';
import path from 'path';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_FILE = process.env.LOG_FILE || 'logs/jedire.log';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// File format (JSON for parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Create logger
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: {
    service: 'jedire-api',
    environment: NODE_ENV,
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File output (errors only)
    new winston.transports.File({
      filename: path.resolve(LOG_FILE),
      level: 'error',
      format: fileFormat,
    }),
    // File output (all levels)
    new winston.transports.File({
      filename: path.resolve(LOG_FILE.replace('.log', '-all.log')),
      format: fileFormat,
    }),
  ],
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logDir = path.dirname(path.resolve(LOG_FILE));
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export default logger;
