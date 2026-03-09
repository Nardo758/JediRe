/**
 * Message Router — Unified entry point for all chat channels
 *
 * Normalizes messages from Twilio (WhatsApp + iMessage + SMS) and Telegram
 * into a common ChatMessage format, routes through the AI Coordinator,
 * and formats responses per channel.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { AICoordinator } from '../ai/coordinator';
import { CreditService } from '../ai/creditService';
import { SessionStore } from './sessionStore';
import { formatForChannel } from './formatters';
import type {
  ChatMessage,
  ChatPlatform,
  ChatResponse,
  ChatSession,
} from '../../types/dealContext';

// ── Message Router ─────────────────────────────────────────────

export class MessageRouter {
  private coordinator: AICoordinator;
  private creditService: CreditService;
  private sessionStore: SessionStore;

  constructor() {
    this.coordinator = new AICoordinator();
    this.creditService = new CreditService();
    this.sessionStore = new SessionStore();
  }

  /**
   * Create Express router with webhook endpoints.
   */
  createRouter(): Router {
    const router = Router();

    // Twilio Conversations webhook (WhatsApp + iMessage + SMS)
    router.post('/webhooks/twilio', this.handleTwilio.bind(this));

    // Telegram Bot API webhook
    router.post('/webhooks/telegram', this.handleTelegram.bind(this));

    // Internal REST API endpoint (web app / direct API)
    router.post('/api/v1/chat/message', this.handleAPI.bind(this));

    return router;
  }

  // ── Twilio Handler (WhatsApp + iMessage + SMS) ───────────────

  private async handleTwilio(req: Request, res: Response): Promise<void> {
    try {
      const { Author, Body, Media, ConversationSid } = req.body;

      const platform = this.detectTwilioPlatform(Author);
      const message: ChatMessage = {
        platform,
        platformUserId: Author,
        text: Body || '',
        attachments: Media ? this.parseTwilioMedia(Media) : undefined,
        timestamp: new Date().toISOString(),
      };

      const response = await this.processMessage(message);

      // Reply through Twilio Conversations API using Replit connector
      try {
        const { getTwilioClient } = await import('../twilio/twilioClient');
        const client = await getTwilioClient();

        await client.conversations.v1
          .conversations(ConversationSid)
          .messages.create({ body: response.text });
      } catch (twilioErr) {
        logger.warn('Twilio reply failed (connector may not be configured)', { error: twilioErr });
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('Twilio webhook error:', { error });
      res.sendStatus(500);
    }
  }

  // ── Telegram Handler ─────────────────────────────────────────

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

      const message: ChatMessage = {
        platform: 'telegram',
        platformUserId: String(tgMsg.from.id),
        text: tgMsg.text,
        timestamp: new Date(tgMsg.date * 1000).toISOString(),
      };

      const response = await this.processMessage(message);

      // Reply via Telegram Bot API
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const axios = (await import('axios')).default;
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: tgMsg.chat.id,
            text: response.text,
            parse_mode: 'Markdown',
            reply_markup: response.inlineKeyboard
              ? JSON.stringify(response.inlineKeyboard)
              : undefined,
          }
        );
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('Telegram webhook error:', { error });
      res.sendStatus(200); // Always 200 to Telegram to avoid retries
    }
  }

  // ── REST API Handler ─────────────────────────────────────────

  private async handleAPI(req: Request, res: Response): Promise<void> {
    try {
      const { userId, text, platform = 'web' } = req.body;

      if (!userId || !text) {
        res.status(400).json({ error: 'userId and text are required' });
        return;
      }

      const message: ChatMessage = {
        platform: platform as ChatPlatform,
        platformUserId: userId,
        text,
        timestamp: new Date().toISOString(),
      };

      const response = await this.processMessage(message);
      res.json(response);
    } catch (error: any) {
      logger.error('Chat API error:', { error });
      if (error.name === 'CreditExhaustedError') {
        res.status(402).json({
          error: 'Insufficient credits',
          remaining: error.creditsRemaining,
          required: error.creditCost,
        });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Unified Processing Pipeline ──────────────────────────────

  async processMessage(message: ChatMessage): Promise<ChatResponse> {
    // 1. Find or create user from platform ID
    const user = await this.sessionStore.findOrCreateUser(
      message.platformUserId,
      message.platform
    );

    // 2. Load or create chat session
    const session = await this.sessionStore.loadOrCreateSession(
      user.userId,
      message.platform,
      message.platformUserId
    );

    // 3. Check subscription tier + credit balance
    const balance = await this.creditService.getBalance(user.userId);
    if (balance && balance.remaining <= 0) {
      return formatForChannel(
        {
          address: '',
          dealId: '',
          jediScore: 0,
          recommendation: 'INVESTIGATE',
          fullSummary: `You've used all ${balance.included} credits this month. Upgrade your plan or wait for renewal on ${new Date(balance.periodEnd).toLocaleDateString()}.`,
          zoning: { summary: '', buildableUnits: 0, maxStories: 0, farUtilization: 0, parkingRequired: 0, overlayRestrictions: [], developmentCapacity: '', confidence: 0, details: {} },
          supply: { summary: '', absorptionRate: 0, vacancyTrend: 'stable', monthsOfSupply: 0, pipelineDeliveries: 0, competitivePositioning: '', marketCyclePhase: 'expansion', confidence: 0, details: {} },
          cashflow: { summary: '', noiProjection: 0, cashOnCashReturn: 0, irrEstimate: 0, dscr: 0, recommendedStrategy: 'hold', riskFlags: [], confidence: 0, details: {} },
          followUpOptions: [],
          creditsUsed: balance.used,
          creditsRemaining: 0,
        },
        message.platform
      );
    }

    // 4. Append to conversation history
    session.conversationHistory.push({
      role: 'user',
      content: message.text,
      timestamp: message.timestamp,
    });

    // 5. Route to AI Coordinator
    const coordinatorResult = await this.coordinator.process(session, message);

    // 6. Update credits remaining on result
    const updatedBalance = await this.creditService.getBalance(user.userId);
    if (updatedBalance) {
      coordinatorResult.creditsRemaining = updatedBalance.remaining;
    }

    // 7. Append assistant response to history
    session.conversationHistory.push({
      role: 'assistant',
      content: coordinatorResult.fullSummary,
      timestamp: new Date().toISOString(),
    });

    // 8. Persist session
    await this.sessionStore.saveSession(session);

    // 9. Format response for this specific channel
    return formatForChannel(coordinatorResult, message.platform);
  }

  // ── Telegram Callback Handler ────────────────────────────────

  private async handleTelegramCallback(callbackQuery: any): Promise<void> {
    const { data, from, message: originalMsg } = callbackQuery;

    // Convert callback into a text message and process
    const message: ChatMessage = {
      platform: 'telegram',
      platformUserId: String(from.id),
      text: data, // callback_data becomes the "message"
      timestamp: new Date().toISOString(),
    };

    const response = await this.processMessage(message);

    // Send response
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const axios = (await import('axios')).default;
      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: originalMsg.chat.id,
          text: response.text,
          parse_mode: 'Markdown',
          reply_markup: response.inlineKeyboard
            ? JSON.stringify(response.inlineKeyboard)
            : undefined,
        }
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private detectTwilioPlatform(author: string): ChatPlatform {
    if (author.startsWith('whatsapp:')) return 'whatsapp';
    if (author.startsWith('messenger:')) return 'imessage';
    return 'sms';
  }

  private parseTwilioMedia(media: any): ChatMessage['attachments'] {
    if (!media) return undefined;
    // Twilio media parsing
    return [];
  }
}

export const messageRouter = new MessageRouter();
