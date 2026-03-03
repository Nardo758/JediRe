/**
 * Clawdbot Webhook Receiver Routes
 * 
 * Receive commands and queries from Clawdbot:
 * - POST /api/v1/clawdbot/command - Execute commands from Clawdbot
 * - POST /api/v1/clawdbot/query - Handle queries from Clawdbot
 * 
 * Security: Validates webhook signatures and auth tokens
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const router = Router();

interface ClawdbotWebhookRequest extends Request {
  body: {
    command?: string;
    query?: string;
    params?: any;
    timestamp?: string;
    requestId?: string;
  };
}

/**
 * Validate webhook signature
 */
function validateSignature(req: Request): boolean {
  const signature = req.headers['x-webhook-signature'] as string;
  const secret = process.env.CLAWDBOT_WEBHOOK_SECRET;
  
  // If no secret is configured, skip validation (development mode)
  if (!secret) {
    logger.warn('CLAWDBOT_WEBHOOK_SECRET not configured - skipping signature validation');
    return true;
  }
  
  // If no signature provided, reject
  if (!signature) {
    logger.warn('Webhook signature missing');
    return false;
  }
  
  // Calculate expected signature
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  // Compare signatures
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  if (!isValid) {
    logger.warn('Invalid webhook signature');
  }
  
  return isValid;
}

/**
 * Validate auth token (alternative to signature)
 */
function validateAuthToken(req: Request): boolean {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const expectedToken = process.env.CLAWDBOT_AUTH_TOKEN;
  
  // If no token is configured, skip validation
  if (!expectedToken) {
    return true;
  }
  
  // If no token provided, reject
  if (!token) {
    return false;
  }
  
  return token === expectedToken;
}

/**
 * Middleware to validate incoming webhooks
 */
function validateWebhook(req: Request, res: Response, next: Function): void {
  // Check signature first, then fall back to auth token
  const isValidSignature = validateSignature(req);
  const isValidToken = validateAuthToken(req);
  
  if (!isValidSignature && !isValidToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature or auth token',
    });
    return;
  }
  
  next();
}

/**
 * POST /api/v1/clawdbot/command
 * 
 * Receive and execute commands from Clawdbot
 */
router.post('/command', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { command, params, timestamp, requestId } = req.body;
    
    logger.info('Clawdbot command received:', {
      command,
      requestId,
      timestamp,
    });
    
    // Validate command
    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required',
      });
    }
    
    // Handle different commands
    let result: any;
    
    switch (command) {
      case 'health':
        // Health check
        result = {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        };
        break;
      
      case 'get_deals':
        // Get deals list (example - implement actual logic)
        result = {
          message: 'Get deals command received',
          params,
          note: 'Implement actual deal fetching logic here',
        };
        break;
      
      case 'get_deal':
        // Get specific deal (example - implement actual logic)
        if (!params?.dealId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'dealId parameter is required',
          });
        }
        result = {
          message: 'Get deal command received',
          dealId: params.dealId,
          note: 'Implement actual deal fetching logic here',
        };
        break;
      
      case 'run_analysis':
        // Run analysis on a deal (example - implement actual logic)
        if (!params?.dealId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'dealId parameter is required',
          });
        }
        result = {
          message: 'Run analysis command received',
          dealId: params.dealId,
          note: 'Implement actual analysis trigger logic here',
        };
        break;
      
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown command: ${command}`,
        });
    }
    
    res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      result,
    });
    
  } catch (error) {
    logger.error('Error processing Clawdbot command:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process command',
    });
  }
});

/**
 * POST /api/v1/clawdbot/query
 * 
 * Handle queries from Clawdbot
 */
router.post('/query', validateWebhook, async (req: ClawdbotWebhookRequest, res: Response) => {
  try {
    const { query, params, timestamp, requestId } = req.body;
    
    logger.info('Clawdbot query received:', {
      query,
      requestId,
      timestamp,
    });
    
    // Validate query
    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required',
      });
    }
    
    // Handle different queries
    let result: any;
    
    switch (query) {
      case 'status':
        // System status
        result = {
          status: 'operational',
          version: process.env.API_VERSION || 'v1',
          environment: process.env.NODE_ENV,
          uptime: process.uptime(),
        };
        break;
      
      case 'deals_count':
        // Get deal count (example - implement actual logic)
        result = {
          message: 'Deals count query received',
          note: 'Implement actual deal count logic here',
          count: 0,
        };
        break;
      
      case 'recent_errors':
        // Get recent errors (example - implement actual logic)
        result = {
          message: 'Recent errors query received',
          note: 'Implement actual error fetching logic here',
          errors: [],
        };
        break;
      
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unknown query: ${query}`,
        });
    }
    
    res.status(200).json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      result,
    });
    
  } catch (error) {
    logger.error('Error processing Clawdbot query:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process query',
    });
  }
});

/**
 * GET /api/v1/clawdbot/health
 * 
 * Simple health check for Clawdbot integration
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    integration: 'clawdbot',
    timestamp: new Date().toISOString(),
    webhookConfigured: !!process.env.CLAWDBOT_WEBHOOK_URL,
  });
});

export default router;
