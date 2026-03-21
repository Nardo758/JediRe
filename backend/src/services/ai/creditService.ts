/**
 * Credit Service — Manages user credit balances and billing operations
 *
 * Users see credits, not tokens. Maps operations to flat credit costs
 * and manages the lifecycle of monthly credit grants.
 */

import { query, transaction } from '../../database/connection';
import { logger } from '../../utils/logger';
import type { SubscriptionTier, AutomationLevel } from '../../types/dealContext';

// ── Tier Configuration ─────────────────────────────────────────

interface TierConfig {
  creditsIncludedMonthly: number;
  overageCostPerCredit: number;
  maxActiveDeals: number;
  maxAutomationLevel: AutomationLevel;
  surfaces: string[];
}

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  scout: {
    creditsIncludedMonthly: 100,
    overageCostPerCredit: 0.25,
    maxActiveDeals: 5,
    maxAutomationLevel: 1,
    surfaces: ['chat'],
  },
  operator: {
    creditsIncludedMonthly: 500,
    overageCostPerCredit: 0.15,
    maxActiveDeals: 25,
    maxAutomationLevel: 2,
    surfaces: ['chat', 'web'],
  },
  principal: {
    creditsIncludedMonthly: 2000,
    overageCostPerCredit: 0.10,
    maxActiveDeals: -1, // unlimited
    maxAutomationLevel: 3,
    surfaces: ['chat', 'web', 'api'],
  },
  institutional: {
    creditsIncludedMonthly: -1, // custom/negotiated
    overageCostPerCredit: 0, // volume pricing
    maxActiveDeals: -1,
    maxAutomationLevel: 4,
    surfaces: ['chat', 'web', 'api'],
  },
};

// ── Credit Balance Operations ──────────────────────────────────

export class CreditService {
  /**
   * Get current credit balance for a user.
   */
  async getBalance(userId: string): Promise<CreditBalance | null> {
    const result = await query(
      `SELECT * FROM user_credit_balances WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      stripeCustomerId: row.stripe_customer_id,
      subscriptionTier: row.subscription_tier,
      automationLevel: row.automation_level,
      creditsIncludedMonthly: row.credits_included_monthly,
      creditsRemaining: row.credits_remaining,
      creditsUsedThisPeriod: row.credits_used_this_period,
      monthlyCreditCap: row.monthly_credit_cap,
      alertThresholdPct: row.alert_threshold_pct,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    };
  }

  /**
   * Provision a new user with credit balance (called on subscription creation).
   */
  async provisionUser(
    userId: string,
    stripeCustomerId: string,
    tier: SubscriptionTier
  ): Promise<void> {
    const config = TIER_CONFIG[tier];
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await query(
      `INSERT INTO user_credit_balances (
        user_id, stripe_customer_id, subscription_tier, automation_level,
        credits_included_monthly, credits_remaining, credits_used_this_period,
        period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        stripe_customer_id = $2,
        subscription_tier = $3,
        automation_level = $4,
        credits_included_monthly = $5,
        credits_remaining = $6,
        period_start = $7,
        period_end = $8,
        updated_at = NOW()`,
      [
        userId,
        stripeCustomerId,
        tier,
        1, // start at Level 1 automation
        config.creditsIncludedMonthly,
        config.creditsIncludedMonthly,
        periodStart.toISOString(),
        periodEnd.toISOString(),
      ]
    );

    logger.info('User credit balance provisioned', {
      userId,
      tier,
      credits: config.creditsIncludedMonthly,
    });
  }

  /**
   * Reset monthly credits (called on invoice.paid webhook).
   */
  async resetMonthlyCredits(userId: string): Promise<void> {
    const balance = await this.getBalance(userId);
    if (!balance) return;

    const config = TIER_CONFIG[balance.subscriptionTier];
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await query(
      `UPDATE user_credit_balances
       SET credits_remaining = $1,
           credits_used_this_period = 0,
           period_start = $2,
           period_end = $3,
           updated_at = NOW()
       WHERE user_id = $4`,
      [
        config.creditsIncludedMonthly,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        userId,
      ]
    );

    logger.info('Monthly credits reset', {
      userId,
      credits: config.creditsIncludedMonthly,
    });
  }

  /**
   * Handle tier changes (upgrade/downgrade).
   */
  async updateTier(
    userId: string,
    newTier: SubscriptionTier
  ): Promise<void> {
    const config = TIER_CONFIG[newTier];
    const currentBalance = await this.getBalance(userId);

    // On upgrade: add the difference in credits immediately
    // On downgrade: keep existing credits until end of period
    let newCreditsRemaining = config.creditsIncludedMonthly;
    if (currentBalance) {
      const oldConfig = TIER_CONFIG[currentBalance.subscriptionTier];
      const creditDiff =
        config.creditsIncludedMonthly - oldConfig.creditsIncludedMonthly;

      if (creditDiff > 0) {
        // Upgrade — add the difference
        newCreditsRemaining = currentBalance.creditsRemaining + creditDiff;
      } else {
        // Downgrade — keep existing, cap at new max
        newCreditsRemaining = Math.min(
          currentBalance.creditsRemaining,
          config.creditsIncludedMonthly
        );
      }
    }

    await query(
      `UPDATE user_credit_balances
       SET subscription_tier = $1,
           credits_included_monthly = $2,
           credits_remaining = $3,
           automation_level = LEAST(automation_level, $4),
           updated_at = NOW()
       WHERE user_id = $5`,
      [
        newTier,
        config.creditsIncludedMonthly,
        newCreditsRemaining,
        config.maxAutomationLevel,
        userId,
      ]
    );

    logger.info('User tier updated', { userId, newTier, newCreditsRemaining });
  }

  /**
   * Set user automation level (must be within tier limits).
   */
  async setAutomationLevel(
    userId: string,
    level: AutomationLevel
  ): Promise<boolean> {
    const balance = await this.getBalance(userId);
    if (!balance) return false;

    const config = TIER_CONFIG[balance.subscriptionTier];
    if (level > config.maxAutomationLevel) {
      logger.warn('Automation level exceeds tier limit', {
        userId,
        requested: level,
        maxAllowed: config.maxAutomationLevel,
      });
      return false;
    }

    await query(
      `UPDATE user_credit_balances
       SET automation_level = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [level, userId]
    );

    return true;
  }

  /**
   * Check if a user can access a surface based on their tier.
   */
  canAccessSurface(tier: SubscriptionTier, surface: string): boolean {
    return TIER_CONFIG[tier].surfaces.includes(surface);
  }

  /**
   * Get tier configuration (for display purposes).
   */
  getTierConfig(tier: SubscriptionTier): TierConfig {
    return { ...TIER_CONFIG[tier] };
  }

  /**
   * Check if user should receive a low-credit alert.
   */
  async shouldAlert(userId: string): Promise<boolean> {
    const balance = await this.getBalance(userId);
    if (!balance || balance.creditsIncludedMonthly <= 0) return false;

    const usedPct =
      ((balance.creditsIncludedMonthly - balance.creditsRemaining) /
        balance.creditsIncludedMonthly) *
      100;
    return usedPct >= balance.alertThresholdPct;
  }
}

// ── Types ──────────────────────────────────────────────────────

interface CreditBalance {
  userId: string;
  stripeCustomerId: string;
  subscriptionTier: SubscriptionTier;
  automationLevel: AutomationLevel;
  creditsIncludedMonthly: number;
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  monthlyCreditCap: number | null;
  alertThresholdPct: number;
  periodStart: string;
  periodEnd: string;
}

export const creditService = new CreditService();
