/**
 * Notification Service
 * 
 * Handles delivery of notifications via email, SMS, and webhooks
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

import { logger } from '../utils/logger';
import type { Alert, AlertTriggerContext } from './alert.service';

// ============================================================================
// Types
// ============================================================================

export interface EmailNotification {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface SMSNotification {
  to: string;
  message: string;
}

export interface WebhookNotification {
  url: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
}

// ============================================================================
// Notification Service Class
// ============================================================================

export class NotificationService {
  /**
   * Send alert notification via configured delivery method
   */
  async sendAlertNotification(alert: Alert, context: AlertTriggerContext): Promise<void> {
    try {
      switch (alert.deliveryMethod) {
        case 'email':
          await this.sendEmail({
            to: alert.deliveryAddress,
            subject: this.getAlertSubject(alert, context),
            body: this.getAlertBody(alert, context),
            html: this.getAlertHTML(alert, context),
          });
          break;
        
        case 'sms':
          await this.sendSMS({
            to: alert.deliveryAddress,
            message: this.getAlertSMSMessage(alert, context),
          });
          break;
        
        case 'webhook':
          await this.sendWebhook({
            url: alert.deliveryAddress,
            payload: {
              alert_id: alert.id,
              alert_type: alert.alertType,
              triggered_at: new Date().toISOString(),
              context,
            },
          });
          break;
      }

      logger.info(`Notification sent via ${alert.deliveryMethod}`, {
        alertId: alert.id,
        deliveryMethod: alert.deliveryMethod,
      });
    } catch (error) {
      logger.error('Failed to send notification', { alert, context, error });
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(notification: EmailNotification): Promise<void> {
    try {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      logger.info('Sending email', { to: notification.to, subject: notification.subject });

      // Mock implementation
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Email content:', {
          to: notification.to,
          subject: notification.subject,
          body: notification.body,
        });
      }
    } catch (error) {
      logger.error('Failed to send email', { notification, error });
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(notification: SMSNotification): Promise<void> {
    try {
      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      logger.info('Sending SMS', { to: notification.to });

      // Mock implementation
      if (process.env.NODE_ENV === 'development') {
        logger.debug('SMS content:', {
          to: notification.to,
          message: notification.message,
        });
      }
    } catch (error) {
      logger.error('Failed to send SMS', { notification, error });
      throw error;
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(notification: WebhookNotification): Promise<void> {
    try {
      logger.info('Sending webhook', { url: notification.url });

      // TODO: Make HTTP POST request to webhook URL
      // Use axios or fetch
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Webhook payload:', notification.payload);
      }
    } catch (error) {
      logger.error('Failed to send webhook', { notification, error });
      throw error;
    }
  }

  // ==========================================================================
  // Alert Message Formatting
  // ==========================================================================

  private getAlertSubject(alert: Alert, context: AlertTriggerContext): string {
    const submarketName = context.submarketName || 'Market';
    
    switch (alert.alertType) {
      case 'imbalance_change':
        return `🚨 Market Alert: ${submarketName} Opportunity Score Changed`;
      
      case 'rent_spike':
        return `📈 Rent Alert: ${submarketName} Rents Increased`;
      
      case 'vacancy_high':
        return `⚠️ Vacancy Alert: ${submarketName} High Vacancy Detected`;
      
      case 'vacancy_low':
        return `✅ Vacancy Alert: ${submarketName} Low Vacancy (Tight Market)`;
      
      case 'opportunity_score':
        return `🎯 Opportunity Alert: ${submarketName} Investment Opportunity`;
      
      case 'pipeline_delivery':
        return `🏗️ Pipeline Alert: New Supply Delivered in ${submarketName}`;
      
      default:
        return `🔔 Market Alert: ${submarketName}`;
    }
  }

  private getAlertBody(alert: Alert, context: AlertTriggerContext): string {
    const { submarketName, city, currentValue, thresholdValue } = context;
    const location = submarketName && city ? `${submarketName}, ${city}` : submarketName || city || 'Your market';

    let message = `JEDI RE Market Alert\n\n`;
    message += `Location: ${location}\n`;
    message += `Alert Type: ${this.formatAlertType(alert.alertType)}\n`;
    message += `Triggered: ${new Date().toLocaleString()}\n\n`;

    switch (alert.alertType) {
      case 'imbalance_change':
        message += `Opportunity Score: ${currentValue.toFixed(0)}/100\n`;
        message += `Threshold: ${alert.condition} ${thresholdValue}\n\n`;
        message += `Market conditions have changed. Review the latest analysis for opportunities.\n`;
        break;
      
      case 'rent_spike':
        message += `Current Rent: $${currentValue.toFixed(0)}\n`;
        message += `Threshold: ${alert.condition} $${thresholdValue}\n\n`;
        message += `Rents have moved beyond your alert threshold.\n`;
        break;
      
      case 'vacancy_high':
        message += `Vacancy Rate: ${currentValue.toFixed(1)}%\n`;
        message += `Threshold: ${alert.condition} ${thresholdValue}%\n\n`;
        message += `High vacancy detected. This may indicate negotiation opportunities.\n`;
        break;
    }

    message += `\nView detailed analysis: ${process.env.APP_URL}/analysis?submarket=${context.submarketName}\n`;
    
    return message;
  }

  private getAlertHTML(alert: Alert, context: AlertTriggerContext): string {
    const { submarketName, city, currentValue, thresholdValue } = context;
    const location = submarketName && city ? `${submarketName}, ${city}` : submarketName || city || 'Your market';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; }
          .metric { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #667eea; }
          .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .metric-value { font-size: 24px; font-weight: bold; color: #333; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 JEDI RE Market Alert</h1>
            <p>${location}</p>
          </div>
          
          <div class="content">
            <p><strong>Alert Type:</strong> ${this.formatAlertType(alert.alertType)}</p>
            <p><strong>Triggered:</strong> ${new Date().toLocaleString()}</p>
            
            <div class="metric">
              <div class="metric-label">Current Value</div>
              <div class="metric-value">${this.formatMetricValue(alert.alertType, currentValue)}</div>
            </div>
            
            <div class="metric">
              <div class="metric-label">Your Threshold</div>
              <div class="metric-value">${alert.condition} ${this.formatMetricValue(alert.alertType, thresholdValue)}</div>
            </div>
            
            <p>${this.getAlertDescription(alert.alertType)}</p>
            
            <a href="${process.env.APP_URL}/analysis?submarket=${context.submarketName}" class="button">
              View Detailed Analysis →
            </a>
          </div>
          
          <div class="footer">
            <p>JEDI RE - Real Estate Intelligence Platform</p>
            <p>To manage your alerts, visit your <a href="${process.env.APP_URL}/settings/alerts">alert settings</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getAlertSMSMessage(alert: Alert, context: AlertTriggerContext): string {
    const { submarketName, currentValue } = context;
    const location = submarketName || 'Market';

    let message = `JEDI RE Alert: ${location} - `;
    
    switch (alert.alertType) {
      case 'imbalance_change':
        message += `Opportunity score ${currentValue.toFixed(0)}/100`;
        break;
      case 'rent_spike':
        message += `Rent $${currentValue.toFixed(0)}`;
        break;
      case 'vacancy_high':
        message += `Vacancy ${currentValue.toFixed(1)}%`;
        break;
      default:
        message += this.formatAlertType(alert.alertType);
    }

    message += `. View: ${process.env.APP_URL}`;
    
    return message;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private formatAlertType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatMetricValue(alertType: string, value: number): string {
    switch (alertType) {
      case 'rent_spike':
        return `$${value.toFixed(0)}`;
      case 'vacancy_high':
      case 'vacancy_low':
        return `${value.toFixed(1)}%`;
      case 'imbalance_change':
      case 'opportunity_score':
        return `${value.toFixed(0)}/100`;
      default:
        return value.toFixed(2);
    }
  }

  private getAlertDescription(alertType: string): string {
    switch (alertType) {
      case 'imbalance_change':
        return 'Market conditions have shifted. This may indicate new investment opportunities or changing risk levels.';
      case 'rent_spike':
        return 'Rental rates have moved beyond your threshold. Review market dynamics and adjust your strategy accordingly.';
      case 'vacancy_high':
        return 'High vacancy detected in this market. This typically indicates negotiation leverage and potential concessions.';
      case 'vacancy_low':
        return 'Tight market conditions detected. Limited supply may lead to increased rents and reduced negotiation power.';
      case 'opportunity_score':
        return 'Investment opportunity score has crossed your threshold. Review detailed analysis for insights.';
      case 'pipeline_delivery':
        return 'New supply has been delivered. Monitor absorption rates and rental concessions.';
      default:
        return 'Market conditions have changed and triggered your alert.';
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const notificationService = new NotificationService();
