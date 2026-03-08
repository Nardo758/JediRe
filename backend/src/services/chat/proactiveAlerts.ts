/**
 * Proactive Alert Pipeline — Sends deal alerts to users via their preferred channel
 *
 * Channel priority for proactive messages:
 * 1. Telegram (always works, free)
 * 2. WhatsApp (within 24hr window or via template)
 * 3. SMS (always works, costs money)
 * 4. iMessage (NEVER — customer-initiated only)
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { ChatPlatform } from '../../types/dealContext';

// ── Alert Types ────────────────────────────────────────────────

export interface DealAlert {
  type: 'new_permit' | 'rent_change' | 'rate_change' | 'comp_change' | 'opportunity' | 'credit_low';
  dealAddress?: string;
  dealId?: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  data?: Record<string, unknown>;
}

interface UserChannel {
  platform: ChatPlatform;
  platformUserId: string;
  chatId?: string;
  conversationSid?: string;
  phoneNumber?: string;
  lastMessageAt?: string;
}

// ── Proactive Alert Service ────────────────────────────────────

export class ProactiveAlertService {
  /**
   * Send a proactive alert to a user via their best available channel.
   */
  async sendAlert(userId: string, alert: DealAlert): Promise<boolean> {
    const channels = await this.getUserChannels(userId);

    if (channels.length === 0) {
      logger.warn('No channels available for proactive alert', { userId });
      return false;
    }

    // Try channels in priority order: Telegram → WhatsApp → SMS (never iMessage)
    for (const channel of channels) {
      try {
        const sent = await this.sendViaChannel(channel, alert);
        if (sent) {
          await this.logAlert(userId, alert, channel.platform);
          return true;
        }
      } catch (error) {
        logger.warn(`Failed to send via ${channel.platform}`, { error, userId });
      }
    }

    logger.warn('All channels failed for proactive alert', { userId });
    return false;
  }

  /**
   * Send alert to a specific channel.
   */
  private async sendViaChannel(
    channel: UserChannel,
    alert: DealAlert
  ): Promise<boolean> {
    switch (channel.platform) {
      case 'telegram':
        return this.sendTelegram(channel, alert);
      case 'whatsapp':
        return this.sendWhatsApp(channel, alert);
      case 'sms':
        return this.sendSMS(channel, alert);
      case 'imessage':
        // Never send proactive messages via iMessage
        return false;
      default:
        return false;
    }
  }

  // ── Channel-Specific Senders ─────────────────────────────────

  private async sendTelegram(
    channel: UserChannel,
    alert: DealAlert
  ): Promise<boolean> {
    if (!process.env.TELEGRAM_BOT_TOKEN || !channel.chatId) return false;

    const text = this.formatAlertForTelegram(alert);
    const axios = (await import('axios')).default;

    await axios.post(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: channel.chatId,
        text,
        parse_mode: 'Markdown',
      }
    );

    return true;
  }

  private async sendWhatsApp(
    channel: UserChannel,
    alert: DealAlert
  ): Promise<boolean> {
    if (!process.env.TWILIO_ACCOUNT_SID || !channel.phoneNumber) return false;

    // Check if within 24hr free-form window
    const withinWindow = channel.lastMessageAt
      ? Date.now() - new Date(channel.lastMessageAt).getTime() < 24 * 60 * 60 * 1000
      : false;

    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN!
    );

    if (withinWindow && channel.conversationSid) {
      // Free-form message within 24hr window
      await client.conversations.v1
        .conversations(channel.conversationSid)
        .messages.create({ body: this.formatAlertForWhatsApp(alert) });
    } else {
      // Template message for out-of-window re-engagement
      const templateSid = process.env.WHATSAPP_ALERT_TEMPLATE_SID;
      if (!templateSid) return false;

      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
        to: `whatsapp:${channel.phoneNumber}`,
        contentSid: templateSid,
        contentVariables: JSON.stringify({
          '1': alert.dealAddress || 'your deal',
          '2': alert.type,
          '3': alert.summary.substring(0, 100),
        }),
      });
    }

    return true;
  }

  private async sendSMS(
    channel: UserChannel,
    alert: DealAlert
  ): Promise<boolean> {
    if (!process.env.TWILIO_ACCOUNT_SID || !channel.phoneNumber) return false;

    const twilio = (await import('twilio')).default;
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN!
    );

    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: channel.phoneNumber,
      body: this.formatAlertForSMS(alert),
    });

    return true;
  }

  // ── Alert Formatters ─────────────────────────────────────────

  private formatAlertForTelegram(alert: DealAlert): string {
    const icon = this.getAlertIcon(alert);
    const lines = [
      `${icon} **JEDI RE Alert**`,
      ``,
      `**${alert.type.replace(/_/g, ' ').toUpperCase()}**`,
    ];

    if (alert.dealAddress) {
      lines.push(`Property: ${alert.dealAddress}`);
    }

    lines.push(``, alert.summary);

    return lines.join('\n');
  }

  private formatAlertForWhatsApp(alert: DealAlert): string {
    const icon = this.getAlertIcon(alert);
    return [
      `${icon} *JEDI RE Alert*`,
      ``,
      `*${alert.type.replace(/_/g, ' ').toUpperCase()}*`,
      alert.dealAddress ? `Property: ${alert.dealAddress}` : '',
      ``,
      alert.summary,
    ].filter(Boolean).join('\n');
  }

  private formatAlertForSMS(alert: DealAlert): string {
    // SMS: keep under 160 chars
    const prefix = `JEDI RE: `;
    const maxLen = 155 - prefix.length;
    return prefix + alert.summary.substring(0, maxLen);
  }

  private getAlertIcon(alert: DealAlert): string {
    switch (alert.severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      default: return '🔵';
    }
  }

  // ── Channel Discovery ────────────────────────────────────────

  private async getUserChannels(userId: string): Promise<UserChannel[]> {
    const result = await query(
      `SELECT DISTINCT platform, platform_user_id,
              twilio_conversation_sid, whatsapp_window_expires_at,
              last_message_at
       FROM chat_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_message_at DESC`,
      [userId]
    );

    const channels: UserChannel[] = [];

    for (const row of result.rows) {
      const channel: UserChannel = {
        platform: row.platform,
        platformUserId: row.platform_user_id,
        lastMessageAt: row.last_message_at,
      };

      if (row.platform === 'telegram') {
        channel.chatId = row.platform_user_id;
      } else if (row.platform === 'whatsapp') {
        channel.conversationSid = row.twilio_conversation_sid;
        channel.phoneNumber = row.platform_user_id.replace('whatsapp:', '');
      } else if (row.platform === 'sms') {
        channel.phoneNumber = row.platform_user_id;
      }

      channels.push(channel);
    }

    // Sort by priority: telegram first, whatsapp second, sms third, never imessage
    const priority: Record<string, number> = {
      telegram: 1,
      whatsapp: 2,
      sms: 3,
      imessage: 99,
    };

    channels.sort((a, b) => (priority[a.platform] || 50) - (priority[b.platform] || 50));

    return channels;
  }

  // ── Alert Logging ────────────────────────────────────────────

  private async logAlert(
    userId: string,
    alert: DealAlert,
    platform: ChatPlatform
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO proactive_alerts_log (
          user_id, alert_type, deal_id, platform, summary, severity
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, alert.type, alert.dealId || null, platform, alert.summary, alert.severity]
      );
    } catch (error) {
      logger.warn('Failed to log proactive alert', { error });
    }
  }
}

export const proactiveAlerts = new ProactiveAlertService();
