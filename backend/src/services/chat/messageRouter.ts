/**
 * Message Router — Unified entry point for all chat channels
 *
 * Thin adapter layer that normalizes messages from all platforms
 * and routes through the Unified Orchestrator.
 * 
 * Supported channels:
 * - Twilio (WhatsApp, iMessage, SMS)
 * - Telegram
 * - Web UI / REST API
 * - Mobile App
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { unifiedOrchestrator, OrchestratorRequest, OrchestratorResponse, ChatPlatform } from '../orchestrator';
import { CreditService } from '../ai/creditService';
import { SessionStore } from './sessionStore';

// ============================================================================
// Message Router
// ============================================================================

export class MessageRouter {
  private creditService: CreditService;
  private sessionStore: SessionStore;

  constructor() {
    this.creditService = new CreditService();
    this.sessionStore = new SessionStore();
  }

  /**
   * Create Express router with webhook endpoints
   */
  createRouter(): Router {
    const router = Router();

    // Twilio Conversations webhook (WhatsApp + iMessage + SMS)
    router.post('/webhooks/twilio', this.handleTwilio.bind(this));

    // Telegram Bot API webhook
    router.post('/webhooks/telegram', this.handleTelegram.bind(this));

    // Internal REST API endpoint (web app / direct API)
    router.post('/api/v1/chat/message', this.handleAPI.bind(this));
    
    // Mobile app endpoint
    router.post('/api/v1/chat/mobile', this.handleMobile.bind(this));

    return router;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TWILIO HANDLER (WhatsApp + iMessage + SMS)
  // ══════════════════════════════════════════════════════════════════════════

  private async handleTwilio(req: Request, res: Response): Promise<void> {
    try {
      const { Author, Body, Media, ConversationSid } = req.body;

      const platform = this.detectTwilioPlatform(Author);
      
      // Find or create user
      const user = await this.sessionStore.findOrCreateUser(Author, platform);
      const session = await this.sessionStore.loadOrCreateSession(user.userId, platform, Author);

      // Build orchestrator request
      const orchestratorRequest: OrchestratorRequest = {
        message: Body || '',
        userId: user.userId,
        platform,
        platformUserId: Author,
        sessionId: session.sessionId,
        conversationHistory: session.conversationHistory,
        userTier: user.tier,
        attachments: Media ? this.parseTwilioMedia(Media) : undefined,
      };

      // Process through orchestrator
      const response = await unifiedOrchestrator.process(orchestratorRequest);

      // Update session history
      session.conversationHistory.push(
        { role: 'user', content: Body, timestamp: new Date().toISOString() },
        { role: 'assistant', content: response.text, timestamp: new Date().toISOString() }
      );
      await this.sessionStore.saveSession(session);

      // Reply through Twilio
      await this.sendTwilioReply(Author, ConversationSid, response.text);

      res.sendStatus(200);
    } catch (error) {
      logger.error('Twilio webhook error:', { error });
      res.sendStatus(500);
    }
  }

  private async sendTwilioReply(to: string, conversationSid: string, text: string): Promise<void> {
    try {
      const { getTwilioClient, getTwilioFromPhoneNumber } = await import('../twilio/twilioClient');
      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();

      if (conversationSid) {
        await client.conversations.v1
          .conversations(conversationSid)
          .messages.create({ body: text });
      } else if (to && fromNumber) {
        const cleanTo = to.replace('whatsapp:', '').replace('messenger:', '');
        await client.messages.create({
          body: text,
          to: cleanTo,
          from: fromNumber,
        });
      }
    } catch (error: any) {
      logger.warn('Twilio reply failed', {
        message: error?.message || 'unknown',
        code: error?.code,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TELEGRAM HANDLER
  // ══════════════════════════════════════════════════════════════════════════

  private async handleTelegram(req: Request, res: Response): Promise<void> {
    try {
      const { message: tgMsg, callback_query } = req.body;

      // Handle callback queries (inline keyboard button presses)
      if (callback_query) {
        await this.handleTelegramCallback(callback_query);
        res.sendStatus(200);
        return;
      }

      if (!tgMsg?.text) {
        res.sendStatus(200);
        return;
      }

      const platformUserId = String(tgMsg.from.id);
      
      // Find or create user
      const user = await this.sessionStore.findOrCreateUser(platformUserId, 'telegram');
      const session = await this.sessionStore.loadOrCreateSession(user.userId, 'telegram', platformUserId);

      // Build orchestrator request
      const orchestratorRequest: OrchestratorRequest = {
        message: tgMsg.text,
        userId: user.userId,
        platform: 'telegram',
        platformUserId,
        sessionId: session.sessionId,
        conversationHistory: session.conversationHistory,
        userTier: user.tier,
      };

      // Process through orchestrator
      const response = await unifiedOrchestrator.process(orchestratorRequest);

      // Update session history
      session.conversationHistory.push(
        { role: 'user', content: tgMsg.text, timestamp: new Date(tgMsg.date * 1000).toISOString() },
        { role: 'assistant', content: response.text, timestamp: new Date().toISOString() }
      );
      await this.sessionStore.saveSession(session);

      // Reply via Telegram
      await this.sendTelegramReply(tgMsg.chat.id, response);

      res.sendStatus(200);
    } catch (error) {
      logger.error('Telegram webhook error:', { error });
      res.sendStatus(200); // Always 200 to Telegram to avoid retries
    }
  }

  private async handleTelegramCallback(callbackQuery: any): Promise<void> {
    const { data, from, message: originalMsg } = callbackQuery;
    const platformUserId = String(from.id);

    const user = await this.sessionStore.findOrCreateUser(platformUserId, 'telegram');
    const session = await this.sessionStore.loadOrCreateSession(user.userId, 'telegram', platformUserId);

    const orchestratorRequest: OrchestratorRequest = {
      message: data, // callback_data becomes the message
      userId: user.userId,
      platform: 'telegram',
      platformUserId,
      sessionId: session.sessionId,
      conversationHistory: session.conversationHistory,
      userTier: user.tier,
    };

    const response = await unifiedOrchestrator.process(orchestratorRequest);

    session.conversationHistory.push(
      { role: 'user', content: data, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response.text, timestamp: new Date().toISOString() }
    );
    await this.sessionStore.saveSession(session);

    await this.sendTelegramReply(originalMsg.chat.id, response);
  }

  private async sendTelegramReply(chatId: number, response: OrchestratorResponse): Promise<void> {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;

    try {
      const axios = (await import('axios')).default;
      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: response.text,
          parse_mode: 'Markdown',
          reply_markup: response.inlineKeyboard
            ? JSON.stringify(response.inlineKeyboard)
            : undefined,
        }
      );
    } catch (error: any) {
      logger.warn('Telegram reply failed:', error?.message);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REST API HANDLER (Web UI)
  // ══════════════════════════════════════════════════════════════════════════

  private async handleAPI(req: Request, res: Response): Promise<void> {
    try {
      const { userId, text, dealId, msaId, sessionId, platform = 'web' } = req.body;

      if (!userId || !text) {
        res.status(400).json({ error: 'userId and text are required' });
        return;
      }

      // Check credits
      const balance = await this.creditService.getBalance(userId);
      if (balance && balance.remaining <= 0) {
        res.status(402).json({
          error: 'Insufficient credits',
          remaining: balance.remaining,
          periodEnd: balance.periodEnd,
        });
        return;
      }

      // Build orchestrator request
      const orchestratorRequest: OrchestratorRequest = {
        message: text,
        userId,
        platform: platform as ChatPlatform,
        dealId,
        msaId,
        sessionId,
      };

      // Process through orchestrator
      const response = await unifiedOrchestrator.process(orchestratorRequest);

      // Update credits
      const updatedBalance = await this.creditService.getBalance(userId);
      if (updatedBalance) {
        response.creditsRemaining = updatedBalance.remaining;
      }

      res.json(response);
    } catch (error: any) {
      logger.error('Chat API error:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE APP HANDLER
  // ══════════════════════════════════════════════════════════════════════════

  private async handleMobile(req: Request, res: Response): Promise<void> {
    try {
      const { userId, text, dealId, msaId, deviceId } = req.body;

      if (!userId || !text) {
        res.status(400).json({ error: 'userId and text are required' });
        return;
      }

      const orchestratorRequest: OrchestratorRequest = {
        message: text,
        userId,
        platform: 'mobile',
        platformUserId: deviceId,
        dealId,
        msaId,
      };

      const response = await unifiedOrchestrator.process(orchestratorRequest);
      res.json(response);
    } catch (error: any) {
      logger.error('Mobile chat error:', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private detectTwilioPlatform(author: string): ChatPlatform {
    if (author.startsWith('whatsapp:')) return 'whatsapp';
    if (author.startsWith('messenger:')) return 'imessage';
    return 'sms';
  }

  private parseTwilioMedia(media: any): OrchestratorRequest['attachments'] {
    if (!media) return undefined;
    // Parse Twilio media format
    return [];
  }
}

export const messageRouter = new MessageRouter();
