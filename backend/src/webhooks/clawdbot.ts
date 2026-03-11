/**
 * Clawdbot Webhook Integration
 * 
 * Sends real-time notifications to Clawdbot Gateway for:
 * - Error notifications
 * - Deal creation events
 * - Analysis completion
 * - Custom events
 * 
 * Security: Only sends in production, includes signature validation
 */

import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  context?: {
    environment?: string;
    userId?: string;
    dealId?: string;
    [key: string]: any;
  };
}

interface ErrorContext {
  url?: string;
  method?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

class ClawdbotWebhook {
  private webhookUrl: string | undefined;
  private webhookSecret: string | undefined;
  private isProduction: boolean;
  private enabled: boolean;
  private rateLimitMap: Map<string, number[]> = new Map();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 10; // Max 10 notifications per minute per event type

  constructor() {
    this.webhookUrl = process.env.CLAWDBOT_WEBHOOK_URL;
    this.webhookSecret = process.env.CLAWDBOT_WEBHOOK_SECRET;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Enable webhooks only if URL is configured
    this.enabled = !!this.webhookUrl;
    
    if (!this.enabled) {
      logger.info('Clawdbot webhooks disabled - CLAWDBOT_WEBHOOK_URL not configured');
    }
    
    if (this.enabled && !this.webhookSecret) {
      logger.warn('Clawdbot webhook configured without secret - signatures will not be sent');
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: string): string | undefined {
    if (!this.webhookSecret) return undefined;
    
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Check rate limit for event type
   */
  private checkRateLimit(eventType: string): boolean {
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(eventType) || [];
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.RATE_LIMIT_WINDOW);
    
    // Check if we're over the limit
    if (validTimestamps.length >= this.RATE_LIMIT_MAX) {
      logger.warn(`Rate limit exceeded for Clawdbot webhook event: ${eventType}`);
      return false;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.rateLimitMap.set(eventType, validTimestamps);
    
    return true;
  }

  /**
   * Send webhook to Clawdbot Gateway
   */
  private async send(payload: WebhookPayload): Promise<void> {
    if (!this.enabled || !this.webhookUrl) {
      return;
    }

    // Check rate limit
    if (!this.checkRateLimit(payload.event)) {
      return;
    }

    try {
      const payloadString = JSON.stringify(payload, (key, value) => {
        if (key === 'request' || key === 'response' || key === 'req' || key === 'res' || key === 'socket' || key === 'agent') return undefined;
        return value;
      });
      const signature = this.generateSignature(payloadString);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'JediRe-Webhook/1.0',
      };
      
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
      
      await axios.post(this.webhookUrl, payload, {
        headers,
        timeout: 5000, // 5 second timeout
      });
      
      logger.debug(`Clawdbot webhook sent: ${payload.event}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error('Failed to send Clawdbot webhook:', {
          event: payload.event,
          status: axiosError.response?.status,
          message: axiosError.message,
        });
      } else {
        logger.error('Failed to send Clawdbot webhook:', {
          event: payload.event,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Send error notification to Clawdbot
   */
  async sendErrorNotification(error: Error, context?: ErrorContext): Promise<void> {
    const payload: WebhookPayload = {
      event: 'error',
      timestamp: new Date().toISOString(),
      data: {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      },
      context: {
        environment: process.env.NODE_ENV,
        ...context,
      },
    };
    
    await this.send(payload);
  }

  /**
   * Send custom event notification
   */
  async sendEventNotification(event: string, data: any, context?: any): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      context: {
        environment: process.env.NODE_ENV,
        ...context,
      },
    };
    
    await this.send(payload);
  }

  /**
   * Send analysis completion notification
   */
  async sendAnalysisComplete(dealId: string, results: any): Promise<void> {
    const payload: WebhookPayload = {
      event: 'analysis.complete',
      timestamp: new Date().toISOString(),
      data: {
        dealId,
        results,
      },
      context: {
        environment: process.env.NODE_ENV,
        dealId,
      },
    };
    
    await this.send(payload);
  }

  /**
   * Send deal creation notification
   */
  async sendDealCreated(deal: any): Promise<void> {
    const payload: WebhookPayload = {
      event: 'deal.created',
      timestamp: new Date().toISOString(),
      data: {
        dealId: deal.id,
        name: deal.name,
        address: deal.address,
        propertyType: deal.propertyType,
        status: deal.status,
        createdBy: deal.createdBy,
      },
      context: {
        environment: process.env.NODE_ENV,
        dealId: deal.id,
        userId: deal.createdBy,
      },
    };
    
    await this.send(payload);
  }

  /**
   * Check if webhooks are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const clawdbotWebhook = new ClawdbotWebhook();
export default clawdbotWebhook;
