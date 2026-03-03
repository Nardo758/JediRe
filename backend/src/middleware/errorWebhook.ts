/**
 * Error Webhook Middleware
 * 
 * Global error interceptor that sends unhandled errors to Clawdbot
 * Includes stack trace, context, user info
 * 
 * Usage: Add to error handling chain in express app
 */

import { Request, Response, NextFunction } from 'express';
import { clawdbotWebhook } from '../webhooks/clawdbot';
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
 * Should be placed BEFORE the final error handler but AFTER all routes
 */
export function errorWebhookMiddleware(
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if webhooks are enabled
  if (!clawdbotWebhook.isEnabled()) {
    // Skip webhook, pass to next error handler
    next(err);
    return;
  }
  
  // Only send non-operational errors (unexpected errors)
  // Operational errors are expected (e.g., validation errors)
  const shouldNotify = !err.isOperational || (err.statusCode && err.statusCode >= 500);
  
  if (shouldNotify) {
    // Extract context
    const context = extractErrorContext(req, err);
    
    // Send to Clawdbot asynchronously (don't block response)
    clawdbotWebhook
      .sendErrorNotification(err, context)
      .catch((webhookError) => {
        // Log webhook failure, but don't throw
        logger.error('Failed to send error webhook to Clawdbot:', webhookError);
      });
  }
  
  // Pass error to next handler (the actual error response handler)
  next(err);
}

/**
 * Unhandled rejection handler
 * 
 * Catches unhandled promise rejections and sends to Clawdbot
 */
export function setupUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason,
      promise,
    });
    
    // Create error object
    const error = reason instanceof Error 
      ? reason 
      : new Error(String(reason));
    
    // Send to Clawdbot
    clawdbotWebhook
      .sendErrorNotification(error, {
        type: 'unhandledRejection',
        environment: process.env.NODE_ENV,
      })
      .catch((webhookError) => {
        logger.error('Failed to send unhandled rejection webhook:', webhookError);
      });
  });
}

/**
 * Uncaught exception handler
 * 
 * Catches uncaught exceptions and sends to Clawdbot before process exit
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    
    // Send to Clawdbot with immediate notification
    clawdbotWebhook
      .sendErrorNotification(error, {
        type: 'uncaughtException',
        critical: true,
        environment: process.env.NODE_ENV,
      })
      .catch((webhookError) => {
        logger.error('Failed to send uncaught exception webhook:', webhookError);
      })
      .finally(() => {
        // Give webhook time to send before exiting
        setTimeout(() => {
          logger.error('Process exiting due to uncaught exception');
          process.exit(1);
        }, 1000);
      });
  });
}

export default errorWebhookMiddleware;
