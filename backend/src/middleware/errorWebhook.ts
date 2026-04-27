/**
 * Error Webhook Middleware
 *
 * Global error interceptor that sends unhandled errors to OpenClaw
 * (Telegram + Twilio multi-channel notifier — formerly the ClawdBot stub).
 * Includes stack trace, context, user info.
 *
 * Usage: Add to error handling chain in express app.
 */

import { Request, Response, NextFunction } from 'express';
import { openclawNotifier } from '../services/notifications/openclawNotifier';
import { logger } from '../utils/logger';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Extract relevant error context from request
 */
function extractErrorContext(req: Request, error: ErrorWithStatus): any {
  return {
    // Request information
    url: req.url,
    method: req.method,
    path: req.path,
    query: req.query,

    // User information (if available)
    userId: (req as any).user?.id,
    userEmail: (req as any).user?.email,

    // Client information
    ip: req.ip,
    userAgent: req.get('user-agent'),

    // Error information
    statusCode: error.statusCode,
    isOperational: error.isOperational,

    // Additional metadata
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };
}

/**
 * Error webhook middleware
 *
 * Should be placed BEFORE the final error handler but AFTER all routes.
 */
export function errorWebhookMiddleware(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!openclawNotifier.isEnabled()) {
    next(err);
    return;
  }

  // Only notify on unexpected errors (skip operational/validation errors).
  const shouldNotify = !err.isOperational || (err.statusCode && err.statusCode >= 500);

  if (shouldNotify) {
    const context = extractErrorContext(req, err);
    openclawNotifier.notifyError(err, context).catch((notifyError) => {
      logger.error('Failed to send error notification to OpenClaw:', notifyError);
    });
  }

  next(err);
}

/**
 * Unhandled rejection handler
 *
 * Catches unhandled promise rejections and sends to OpenClaw.
 */
export function setupUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', { reason, promise });

    const error = reason instanceof Error
      ? reason
      : new Error(String(reason));

    openclawNotifier.notifyError(error, {
      type: 'unhandledRejection',
      environment: process.env.NODE_ENV,
    }).catch((notifyError) => {
      logger.error('Failed to send unhandled rejection notification:', notifyError);
    });
  });
}

/**
 * Uncaught exception handler
 *
 * Catches uncaught exceptions and sends to OpenClaw before process exit.
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);

    openclawNotifier.notifyError(error, {
      type: 'uncaughtException',
      critical: true,
      environment: process.env.NODE_ENV,
    }).catch((notifyError) => {
      logger.error('Failed to send uncaught exception notification:', notifyError);
    }).finally(() => {
      // Give the notifier time to send before exiting.
      setTimeout(() => {
        logger.error('Process exiting due to uncaught exception');
        process.exit(1);
      }, 1000);
    });
  });
}

export default errorWebhookMiddleware;
