/**
 * Global Error Handler
 * Catch and format errors consistently
 * Integrated with Clawdbot webhook notifications
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { clawdbotWebhook } from '../webhooks/clawdbot';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Send to Clawdbot if it's a server error
  if (statusCode >= 500 && clawdbotWebhook.isEnabled()) {
    clawdbotWebhook.sendErrorNotification(err, {
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode,
    }).catch((webhookError) => {
      logger.error('Failed to send error webhook:', webhookError);
    });
  }

  // Determine if we should expose error details
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Build error response
  const errorResponse: any = {
    error: err.name || 'Error',
    message: err.message || 'Internal server error',
    statusCode,
  };

  // Include stack trace in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
}
