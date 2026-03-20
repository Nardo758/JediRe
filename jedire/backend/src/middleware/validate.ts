/**
 * Validation Middleware
 * Applies Zod schemas to Express routes
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodError(error: ZodError): {
  field: string;
  message: string;
}[] {
  return error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Validates request params against a Zod schema
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed for params', {
          path: req.path,
          errors: formatZodError(error),
        });
        
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request parameters',
          details: formatZodError(error),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validates request body against a Zod schema
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed for body', {
          path: req.path,
          errors: formatZodError(error),
        });
        
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request body',
          details: formatZodError(error),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Validates request query against a Zod schema
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed for query', {
          path: req.path,
          errors: formatZodError(error),
        });
        
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: formatZodError(error),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Combined validator for all request parts
 */
export function validate<
  TParams extends z.ZodTypeAny = z.ZodAny,
  TBody extends z.ZodTypeAny = z.ZodAny,
  TQuery extends z.ZodTypeAny = z.ZodAny
>(schemas: {
  params?: TParams;
  body?: TBody;
  query?: TQuery;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate params
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }

      // Validate body
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      // Validate query
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: formatZodError(error),
        });

        res.status(400).json({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: formatZodError(error),
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Sanitize string input to prevent XSS
 * Basic sanitization - removes HTML tags
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Middleware to sanitize all request inputs
 */
export function sanitizeInputs(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

export default {
  validateParams,
  validateBody,
  validateQuery,
  validate,
  sanitizeString,
  sanitizeObject,
  sanitizeInputs,
};
