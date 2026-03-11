import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { CreditService } from '../../services/ai/creditService';

const router = Router();

router.use(requireAuth);

const TIER_PRICES: Record<string, { monthly: string; annual: string }> = {
  scout: {
    monthly: process.env.STRIPE_PRICE_SCOUT_MONTHLY || 'price_scout_monthly',
    annual: process.env.STRIPE_PRICE_SCOUT_ANNUAL || 'price_scout_annual',
  },
  operator: {
    monthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY || 'price_operator_monthly',
    annual: process.env.STRIPE_PRICE_OPERATOR_ANNUAL || 'price_operator_annual',
  },
  principal: {
    monthly: process.env.STRIPE_PRICE_PRINCIPAL_MONTHLY || 'price_principal_monthly',
    annual: process.env.STRIPE_PRICE_PRINCIPAL_ANNUAL || 'price_principal_annual',
  },
  institutional: {
    monthly: process.env.STRIPE_PRICE_INSTITUTIONAL_MONTHLY || 'price_institutional_monthly',
    annual: process.env.STRIPE_PRICE_INSTITUTIONAL_ANNUAL || 'price_institutional_annual',
  },
};

router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const { tier, billingCycle } = req.body;

    if (!tier || !['scout', 'operator', 'principal', 'institutional'].includes(tier)) {
      return res.status(400).json({ success: false, error: 'Invalid tier. Must be scout, operator, principal, or institutional.' });
    }

    if (!billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({ success: false, error: 'Invalid billingCycle. Must be monthly or annual.' });
    }

    const priceId = TIER_PRICES[tier][billingCycle as 'monthly' | 'annual'];

    const { getUncachableStripeClient } = await import('../../services/stripe/stripeClient');
    const stripe = await getUncachableStripeClient();

    const userResult = await query(
      `SELECT email, stripe_customer_id FROM users WHERE id = $1`,
      [userId]
    );

    let stripeCustomerId: string | undefined;
    let customerEmail: string | undefined;

    if (userResult.rows.length > 0) {
      stripeCustomerId = userResult.rows[0].stripe_customer_id || undefined;
      customerEmail = userResult.rows[0].email;
    }

    if (!stripeCustomerId) {
      const creditResult = await query(
        `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
        [userId]
      );
      if (creditResult.rows.length > 0 && creditResult.rows[0].stripe_customer_id) {
        stripeCustomerId = creditResult.rows[0].stripe_customer_id;
      }
    }

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    const baseUrl = `https://${domain}`;

    if (!stripeCustomerId && customerEmail) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await query(
        `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
        [stripeCustomerId, userId]
      );
    }

    const sessionParams: any = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings?tab=subscription&checkout=success`,
      cancel_url: `${baseUrl}/settings?tab=subscription&checkout=canceled`,
      client_reference_id: userId,
      metadata: { userId, tier, billingCycle },
    };

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    logger.info('Checkout session created', { userId, tier, billingCycle, sessionId: session.id });

    res.json({ success: true, sessionUrl: session.url, sessionId: session.id });
  } catch (error: any) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

router.post('/create-portal-session', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;

    let stripeCustomerId: string | null = null;

    const creditResult = await query(
      `SELECT stripe_customer_id FROM user_credit_balances WHERE user_id = $1`,
      [userId]
    );
    if (creditResult.rows.length > 0) {
      stripeCustomerId = creditResult.rows[0].stripe_customer_id;
    }

    if (!stripeCustomerId) {
      const userResult = await query(
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0) {
        stripeCustomerId = userResult.rows[0].stripe_customer_id;
      }
    }

    if (!stripeCustomerId) {
      return res.status(400).json({ success: false, error: 'No Stripe customer found. Please subscribe to a plan first.' });
    }

    const { getUncachableStripeClient } = await import('../../services/stripe/stripeClient');
    const stripe = await getUncachableStripeClient();

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    const returnUrl = `https://${domain}/settings?tab=subscription`;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info('Portal session created', { userId, stripeCustomerId });

    res.json({ success: true, portalUrl: session.url });
  } catch (error: any) {
    logger.error('Error creating portal session:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create portal session' });
  }
});

router.get('/subscription', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const creditService = new CreditService();
    const balance = await creditService.getBalance(userId!);

    if (!balance) {
      return res.json({
        success: true,
        data: {
          tier: 'scout',
          status: 'none',
          creditsIncludedMonthly: 100,
          creditsRemaining: 0,
          creditsUsedThisPeriod: 0,
          periodStart: null,
          periodEnd: null,
          cancelAtPeriodEnd: false,
          stripeSubscription: null,
        },
      });
    }

    let stripeSubscription: any = null;

    if (balance.stripeCustomerId) {
      try {
        const { getUncachableStripeClient } = await import('../../services/stripe/stripeClient');
        const stripe = await getUncachableStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: balance.stripeCustomerId,
          status: 'all',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          stripeSubscription = {
            id: sub.id,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
          };
        }
      } catch (stripeErr: any) {
        logger.warn('Could not fetch Stripe subscription', { error: stripeErr.message });
      }
    }

    res.json({
      success: true,
      data: {
        tier: balance.subscriptionTier,
        status: stripeSubscription?.status || 'active',
        creditsIncludedMonthly: balance.creditsIncludedMonthly,
        creditsRemaining: balance.creditsRemaining,
        creditsUsedThisPeriod: balance.creditsUsedThisPeriod,
        periodStart: balance.periodStart,
        periodEnd: balance.periodEnd,
        cancelAtPeriodEnd: stripeSubscription?.cancelAtPeriodEnd || false,
        stripeSubscription,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription details' });
  }
});

router.get('/usage', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.userId;
    const creditService = new CreditService();
    const balance = await creditService.getBalance(userId!);

    let usageByOperation: any[] = [];
    let recentUsage: any[] = [];

    try {
      const groupedResult = await query(
        `SELECT 
           COALESCE(operation_type, 'unknown') AS operation,
           COUNT(*) AS call_count,
           SUM(credits_consumed) AS total_credits,
           SUM(input_tokens + output_tokens) AS total_tokens
         FROM ai_usage_log
         WHERE user_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY COALESCE(operation_type, 'unknown')
         ORDER BY total_credits DESC`,
        [userId]
      );
      usageByOperation = groupedResult.rows;

      const recentResult = await query(
        `SELECT 
           COALESCE(operation_type, 'unknown') AS operation,
           model,
           credits_consumed AS credits_charged,
           (input_tokens + output_tokens) AS total_tokens,
           latency_ms,
           created_at
         FROM ai_usage_log
         WHERE user_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      recentUsage = recentResult.rows;
    } catch (dbErr: any) {
      logger.warn('Could not fetch usage logs', { error: dbErr.message });
    }

    res.json({
      success: true,
      data: {
        balance: balance
          ? {
              tier: balance.subscriptionTier,
              creditsIncludedMonthly: balance.creditsIncludedMonthly,
              creditsRemaining: balance.creditsRemaining,
              creditsUsedThisPeriod: balance.creditsUsedThisPeriod,
              periodStart: balance.periodStart,
              periodEnd: balance.periodEnd,
            }
          : null,
        usageByOperation,
        recentUsage,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch usage data' });
  }
});

export default router;
