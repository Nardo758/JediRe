/**
 * Chat Session Store — Manages conversation state across channels
 *
 * Sessions persist conversation history, active deals, and DealContext
 * caches. Supports all chat platforms and the web app.
 */

import { query, getPool } from '../../database/connection';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import type {
  ChatPlatform,
  ChatSession,
  SubscriptionTier,
} from '../../types/dealContext';

interface PlatformUser {
  userId: string;
  stripeCustomerId: string;
  subscriptionTier: SubscriptionTier;
}

export class SessionStore {
  /**
   * Find or create a user from their platform identifier.
   */
  async findOrCreateUser(
    platformUserId: string,
    platform: ChatPlatform | 'web' | 'api'
  ): Promise<PlatformUser> {
    // Check if this platform user already has a mapping
    const existing = await query(
      `SELECT u.id as user_id, ucb.stripe_customer_id, ucb.subscription_tier
       FROM chat_sessions cs
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
       WHERE cs.platform_user_id = $1 AND cs.platform = $2
       ORDER BY cs.last_message_at DESC
       LIMIT 1`,
      [platformUserId, platform]
    );

    if (existing.rows.length > 0) {
      return {
        userId: existing.rows[0].user_id,
        stripeCustomerId: existing.rows[0].stripe_customer_id || '',
        subscriptionTier: existing.rows[0].subscription_tier || 'scout',
      };
    }

    // Check if this looks like a phone number that matches an existing user
    const phoneMatch = await query(
      `SELECT id FROM users WHERE phone = $1 LIMIT 1`,
      [platformUserId.replace(/^whatsapp:/, '')]
    );

    if (phoneMatch.rows.length > 0) {
      return {
        userId: phoneMatch.rows[0].id,
        stripeCustomerId: '',
        subscriptionTier: 'scout',
      };
    }

    // Create a new user for this platform contact.
    // B2b: wrapped in a transaction — user + org-of-one + org_members + org_credit_balances
    // + default_org_id all committed atomically. Closes the B1 gap where bridge users
    // had no org membership.
    const pool = getPool();
    const client = await pool.connect();
    let userId: string;
    let orgId: string;
    try {
      await client.query('BEGIN');

      const userEmail = `${platform}_${platformUserId}@chat.jedire.com`;
      const userRow = await client.query(
        `INSERT INTO users (email, role, email_verified, user_type)
         VALUES ($1, 'investor', false, 'human_sponsor')
         RETURNING id`,
        [userEmail]
      );
      userId = userRow.rows[0].id;

      const orgSlug = `personal-${crypto.randomBytes(4).toString('hex')}`;
      const orgRow = await client.query(
        `INSERT INTO organizations (name, slug, owner_id) VALUES ('Personal Organization', $1, $2) RETURNING id`,
        [orgSlug, userId]
      );
      orgId = orgRow.rows[0].id;

      await client.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [orgId, userId]
      );

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await client.query(
        `INSERT INTO org_credit_balances
           (org_id, subscription_tier, credits_included_monthly, credits_remaining,
            credits_used_this_period, monthly_credit_cap, period_start, period_end, updated_at)
         VALUES ($1, 'scout', 100, 100, 0, 100, NOW(), $2, NOW())`,
        [orgId, periodEnd.toISOString()]
      );

      await client.query(
        `UPDATE users SET default_org_id = $1 WHERE id = $2`,
        [orgId, userId]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    logger.info('New chat user created with org', { userId, orgId, platform, platformUserId });

    return {
      userId,
      stripeCustomerId: '',
      subscriptionTier: 'scout',
    };
  }

  /**
   * Load or create a chat session for a user on a platform.
   */
  async loadOrCreateSession(
    userId: string,
    platform: ChatPlatform | 'web' | 'api',
    platformUserId: string
  ): Promise<ChatSession> {
    // Try to load existing active session
    const existing = await query(
      `SELECT * FROM chat_sessions
       WHERE user_id = $1 AND platform = $2 AND expires_at > NOW()
       ORDER BY last_message_at DESC
       LIMIT 1`,
      [userId, platform]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];

      // Get subscription tier
      const tierResult = await query(
        `SELECT subscription_tier, stripe_customer_id, automation_level
         FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );

      const tier = tierResult.rows[0];

      return {
        id: row.id,
        userId,
        platform: row.platform,
        platformUserId: row.platform_user_id,
        stripeCustomerId: tier?.stripe_customer_id || '',
        subscriptionTier: tier?.subscription_tier || 'scout',
        conversationHistory: row.conversation_history || [],
        activeDeals: [],
        automationLevel: tier?.automation_level || 1,
        creditsUsedThisSession: row.credits_used_this_session || 0,
        lastMessageAt: row.last_message_at,
        expiresAt: row.expires_at,
      };
    }

    // Create new session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h for chat

    const newSession = await query(
      `INSERT INTO chat_sessions (
        user_id, platform, platform_user_id,
        conversation_history, automation_level, expires_at
      ) VALUES ($1, $2, $3, $4, 1, $5)
      RETURNING id`,
      [userId, platform, platformUserId, JSON.stringify([]), expiresAt.toISOString()]
    );

    // Get tier info
    const tierResult = await query(
      `SELECT subscription_tier, stripe_customer_id, automation_level
       FROM user_credit_balances WHERE user_id = $1`,
      [userId]
    );
    const tier = tierResult.rows[0];

    return {
      id: newSession.rows[0].id,
      userId,
      platform,
      platformUserId,
      stripeCustomerId: tier?.stripe_customer_id || '',
      subscriptionTier: tier?.subscription_tier || 'scout',
      conversationHistory: [],
      activeDeals: [],
      automationLevel: tier?.automation_level || 1,
      creditsUsedThisSession: 0,
      lastMessageAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Persist session state after processing a message.
   */
  async saveSession(session: ChatSession): Promise<void> {
    await query(
      `UPDATE chat_sessions
       SET conversation_history = $1,
           active_deal_ids = $2,
           credits_used_this_session = $3,
           last_message_at = NOW()
       WHERE id = $4`,
      [
        JSON.stringify(session.conversationHistory.slice(-50)), // Keep last 50 messages
        session.activeDeals.map((d) => d.dealId),
        session.creditsUsedThisSession,
        session.id,
      ]
    );
  }

  /**
   * Clean up expired sessions.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await query(
      `DELETE FROM chat_sessions WHERE expires_at < NOW() RETURNING id`
    );
    const count = result.rows.length;
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired chat sessions`);
    }
    return count;
  }

  /**
   * Get all active sessions for a user (across platforms).
   */
  async getUserSessions(userId: string): Promise<ChatSession[]> {
    const result = await query(
      `SELECT * FROM chat_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_message_at DESC`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      platformUserId: row.platform_user_id,
      stripeCustomerId: '',
      subscriptionTier: 'scout' as SubscriptionTier,
      conversationHistory: row.conversation_history || [],
      activeDeals: [],
      automationLevel: row.automation_level || 1,
      creditsUsedThisSession: row.credits_used_this_session || 0,
      lastMessageAt: row.last_message_at,
      expiresAt: row.expires_at,
    }));
  }
}

export const sessionStore = new SessionStore();
