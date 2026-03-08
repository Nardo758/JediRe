/**
 * Stripe Webhook Handlers
 *
 * Handles subscription lifecycle events:
 * - customer.subscription.created → Provision user
 * - invoice.paid → Reset monthly credits
 * - customer.subscription.updated → Sync tier changes
 * - customer.subscription.deleted → Deactivate user
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { CreditService } from '../ai/creditService';
import type { SubscriptionTier } from '../../types/dealContext';

// ── Stripe Product → Tier Mapping ──────────────────────────────

const PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  // Map your Stripe product IDs here
  [process.env.STRIPE_PRODUCT_SCOUT || 'prod_scout']: 'scout',
  [process.env.STRIPE_PRODUCT_OPERATOR || 'prod_operator']: 'operator',
  [process.env.STRIPE_PRODUCT_PRINCIPAL || 'prod_principal']: 'principal',
  [process.env.STRIPE_PRODUCT_INSTITUTIONAL || 'prod_institutional']: 'institutional',
};

// ── Webhook Router ─────────────────────────────────────────────

export function createStripeWebhookRouter(): Router {
  const router = Router();
  const creditService = new CreditService();

  router.post(
    '/webhooks/stripe',
    // Raw body needed for Stripe signature verification
    async (req: Request, res: Response) => {
      const sig = req.headers['stripe-signature'] as string;

      let event: any;

      try {
        if (process.env.STRIPE_WEBHOOK_SECRET) {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
          event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
          );
        } else {
          // Development mode — skip signature verification
          event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        }
      } catch (err: any) {
        logger.error('Stripe webhook signature verification failed', {
          error: err.message,
        });
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      logger.info('Stripe webhook received', {
        type: event.type,
        id: event.id,
      });

      try {
        switch (event.type) {
          case 'customer.subscription.created':
            await handleSubscriptionCreated(creditService, event.data.object);
            break;

          case 'invoice.paid':
            await handleInvoicePaid(creditService, event.data.object);
            break;

          case 'customer.subscription.updated':
            await handleSubscriptionUpdated(creditService, event.data.object);
            break;

          case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(creditService, event.data.object);
            break;

          default:
            logger.debug('Unhandled Stripe event type', { type: event.type });
        }

        res.json({ received: true });
      } catch (error) {
        logger.error('Stripe webhook handler error', {
          type: event.type,
          error,
        });
        res.status(500).json({ error: 'Webhook handler failed' });
      }
    }
  );

  return router;
}

// ── Event Handlers ─────────────────────────────────────────────

async function handleSubscriptionCreated(
  creditService: CreditService,
  subscription: any
): Promise<void> {
  const customerId = subscription.customer;
  const productId = subscription.items?.data?.[0]?.price?.product;
  const tier = resolveTier(productId);

  // Find user by Stripe customer ID
  const userId = await findUserByStripeCustomer(customerId);
  if (!userId) {
    logger.error('No user found for Stripe customer', { customerId });
    return;
  }

  // Provision credits
  await creditService.provisionUser(userId, customerId, tier);

  logger.info('Subscription created — user provisioned', {
    userId,
    customerId,
    tier,
  });
}

async function handleInvoicePaid(
  creditService: CreditService,
  invoice: any
): Promise<void> {
  const customerId = invoice.customer;

  const userId = await findUserByStripeCustomer(customerId);
  if (!userId) {
    logger.warn('No user found for invoice.paid', { customerId });
    return;
  }

  // Reset monthly credits
  await creditService.resetMonthlyCredits(userId);

  logger.info('Invoice paid — credits reset', { userId, customerId });
}

async function handleSubscriptionUpdated(
  creditService: CreditService,
  subscription: any
): Promise<void> {
  const customerId = subscription.customer;
  const productId = subscription.items?.data?.[0]?.price?.product;
  const newTier = resolveTier(productId);

  const userId = await findUserByStripeCustomer(customerId);
  if (!userId) {
    logger.warn('No user found for subscription update', { customerId });
    return;
  }

  await creditService.updateTier(userId, newTier);

  logger.info('Subscription updated — tier changed', {
    userId,
    customerId,
    newTier,
  });
}

async function handleSubscriptionDeleted(
  creditService: CreditService,
  subscription: any
): Promise<void> {
  const customerId = subscription.customer;

  const userId = await findUserByStripeCustomer(customerId);
  if (!userId) {
    logger.warn('No user found for subscription deletion', { customerId });
    return;
  }

  // Downgrade to scout (free tier equivalent — keeps data but limits access)
  await creditService.updateTier(userId, 'scout');

  logger.info('Subscription deleted — downgraded to scout', {
    userId,
    customerId,
  });
}

// ── Helpers ────────────────────────────────────────────────────

function resolveTier(productId: string): SubscriptionTier {
  return PRODUCT_TO_TIER[productId] || 'scout';
}

async function findUserByStripeCustomer(
  stripeCustomerId: string
): Promise<string | null> {
  try {
    const { query } = await import('../../database/connection');
    const result = await query(
      `SELECT user_id FROM user_credit_balances WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].user_id;
    }

    // Also check if there's a stripe_customer_id in users table
    const userResult = await query(
      `SELECT id FROM users WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );

    return userResult.rows.length > 0 ? userResult.rows[0].id : null;
  } catch {
    return null;
  }
}
