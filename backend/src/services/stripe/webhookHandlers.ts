import { getStripeSync } from './stripeClient';
import { logger } from '../../utils/logger';
import { CreditService } from '../ai/creditService';
import {
  resolveOrgForUser,
  provisionOrgPool,
  resetOrgPool,
  updateOrgTier,
} from '../ai/orgCreditService';
import type { SubscriptionTier } from '../../types/dealContext';

const PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRODUCT_SCOUT || 'prod_scout']: 'scout',
  [process.env.STRIPE_PRODUCT_OPERATOR || 'prod_operator']: 'operator',
  [process.env.STRIPE_PRODUCT_PRINCIPAL || 'prod_principal']: 'principal',
  [process.env.STRIPE_PRODUCT_INSTITUTIONAL || 'prod_institutional']: 'institutional',
};

function resolveTier(productId: string): SubscriptionTier {
  return PRODUCT_TO_TIER[productId] || 'scout';
}

async function findUserByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  try {
    const { query } = await import('../../database/connection');
    const result = await query(
      `SELECT user_id FROM user_credit_balances WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );
    if (result.rows.length > 0) return result.rows[0].user_id;

    const userResult = await query(
      `SELECT id FROM users WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );
    return userResult.rows.length > 0 ? userResult.rows[0].id : null;
  } catch {
    return null;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    let event: any;
    try {
      event = JSON.parse(payload.toString());
    } catch {
      return;
    }

    logger.info('Stripe webhook received', { type: event.type, id: event.id });

    const creditService = new CreditService();

    try {
      switch (event.type) {
        case 'customer.subscription.created': {
          const sub = event.data?.object;
          const customerId = sub?.customer;
          const productId = sub?.items?.data?.[0]?.price?.product;
          const tier = resolveTier(productId);
          const userId = await findUserByStripeCustomer(customerId);
          if (userId) {
            await creditService.provisionUser(userId, customerId, tier);
            // A5-F7: Keep users.stripe_customer_id in sync with user_credit_balances
            // so billing route resolution (which checks users first) is consistent.
            const { query } = await import('../../database/connection');
            await query(
              `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
              [customerId, userId]
            );
            // B2a: provision the org pool for this user's org.
            const orgId = await resolveOrgForUser(userId);
            if (orgId) {
              await provisionOrgPool(orgId, tier);
              logger.info('Subscription created — org pool provisioned', { userId, orgId, tier });
            }
            logger.info('Subscription created — user provisioned', { userId, tier });
          }
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data?.object;
          const userId = await findUserByStripeCustomer(invoice?.customer);
          if (userId) {
            // B2a: resetMonthlyCredits now resets both user_credit_balances (UI display)
            // and the org pool (gate/decrement target) in a single call.
            await creditService.resetMonthlyCredits(userId);
            logger.info('Invoice paid — credits reset (user + org pool)', { userId });
          }
          break;
        }
        case 'customer.subscription.updated': {
          const sub = event.data?.object;
          const productId = sub?.items?.data?.[0]?.price?.product;
          const newTier = resolveTier(productId);
          const userId = await findUserByStripeCustomer(sub?.customer);
          if (userId) {
            // B2a: updateTier now updates both user_credit_balances and org_credit_balances
            // (Requirement 3 — sync-on-upgrade rule, both tables kept in sync).
            await creditService.updateTier(userId, newTier);
            logger.info('Subscription updated — tier changed (user + org)', { userId, newTier });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const sub = event.data?.object;
          const userId = await findUserByStripeCustomer(sub?.customer);
          if (userId) {
            // B2a: updateTier now updates both user_credit_balances and org_credit_balances.
            await creditService.updateTier(userId, 'scout');
            logger.info('Subscription deleted — downgraded to scout (user + org)', { userId });
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Stripe business logic error', { type: event.type, error });
    }
  }
}
