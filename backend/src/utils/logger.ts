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

/** Logger type — use for dependency injection in utilities that need a logger. */
export type Logger = typeof logger;

/**
 * Create a child logger with a named context.
 * Returns a winston-compatible child logger with pino-identical API:
 *   .info(msg, ...meta)
 *   .warn(msg, ...meta)
 *   .error(msg, ...meta)
 */
export function createLogger(context: string) {
  return logger.child({ context });
}

/**
 * Call shape used by services that pass either a message or a metadata
 * object followed by a message. Winston accepts both at runtime; its
 * published overloads only type the message-first form.
 */
export interface ServiceLogger {
  info(msg: string, ...args: unknown[]): void;
  info(obj: object, msg?: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  warn(obj: object, msg?: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  error(obj: object, msg?: string, ...args: unknown[]): void;
  debug(msg: string, ...args: unknown[]): void;
  debug(obj: object, msg?: string, ...args: unknown[]): void;
}

export function createServiceLogger(context: string): ServiceLogger {
  const child = logger.child({ context });
  const forward = (level: 'info' | 'warn' | 'error' | 'debug') =>
    (first: string | object, ...rest: unknown[]) => {
      const write = child[level] as (message: string, ...meta: unknown[]) => void;
      write(first as string, ...rest);
    };
  return {
    info: forward('info'),
    warn: forward('warn'),
    error: forward('error'),
    debug: forward('debug'),
  };
}
