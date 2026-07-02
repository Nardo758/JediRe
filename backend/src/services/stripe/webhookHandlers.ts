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

/**
 * B3: Resolve a Stripe customer directly to an org via org_credit_balances.stripe_customer_id.
 * This is the PRIMARY resolution path for new subscriptions (attached to the org, not the user).
 * Returns null when no org row has this customer — falls back to user-indirect path.
 */
async function findOrgByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  try {
    const { query } = await import('../../database/connection');
    const result = await query(
      `SELECT org_id FROM org_credit_balances WHERE stripe_customer_id = $1`,
      [stripeCustomerId]
    );
    return result.rows.length > 0 ? result.rows[0].org_id : null;
  } catch {
    return null;
  }
}

/**
 * Find the owner user of an org (used to keep user_credit_balances as a display mirror).
 */
async function findOrgOwner(orgId: string): Promise<string | null> {
  try {
    const { query } = await import('../../database/connection');
    const result = await query(
      `SELECT user_id FROM org_members WHERE org_id = $1 AND role = 'owner' LIMIT 1`,
      [orgId]
    );
    return result.rows.length > 0 ? result.rows[0].user_id : null;
  } catch {
    return null;
  }
}

/**
 * FALLBACK: Resolve Stripe customer → user (pre-B3 user-attached subscriptions).
 * Kept for backward compatibility with existing customers stored on users/user_credit_balances.
 */
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

          // B3: try direct org resolution first (org-level customer).
          const orgId = await findOrgByStripeCustomer(customerId);
          if (orgId) {
            await provisionOrgPool(orgId, tier);
            // Mirror to org owner's user row for billing display.
            const ownerId = await findOrgOwner(orgId);
            if (ownerId) {
              await creditService.provisionUser(ownerId, customerId, tier);
              const { query } = await import('../../database/connection');
              await query(
                `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
                [customerId, ownerId]
              );
            }
            logger.info('Subscription created — org provisioned (direct)', { orgId, tier });
          } else {
            // Fallback: user-indirect path (pre-B3 customers stored on user rows).
            const userId = await findUserByStripeCustomer(customerId);
            if (userId) {
              await creditService.provisionUser(userId, customerId, tier);
              const { query } = await import('../../database/connection');
              await query(
                `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
                [customerId, userId]
              );
              // B2a: provision the org pool for this user's org.
              const resolvedOrgId = await resolveOrgForUser(userId);
              if (resolvedOrgId) {
                await provisionOrgPool(resolvedOrgId, tier);
                // Link the user customer to the org now for future direct resolution.
                await (await import('../../database/connection')).query(
                  `UPDATE org_credit_balances SET stripe_customer_id = $1, updated_at = NOW()
                   WHERE org_id = $2 AND stripe_customer_id IS NULL`,
                  [customerId, resolvedOrgId]
                );
                logger.info('Subscription created — org provisioned (user-indirect)', { userId, resolvedOrgId, tier });
              }
              logger.info('Subscription created — user provisioned', { userId, tier });
            }
          }
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data?.object;
          const customerId = invoice?.customer;

          // B3: try direct org resolution first.
          const orgId = await findOrgByStripeCustomer(customerId);
          if (orgId) {
            await resetOrgPool(orgId);
            // Reset the org owner's user row too (display mirror).
            const ownerId = await findOrgOwner(orgId);
            if (ownerId) {
              await creditService.resetMonthlyCredits(ownerId);
            }
            logger.info('Invoice paid — org pool reset (direct)', { orgId });
          } else {
            // Fallback: user-indirect.
            const userId = await findUserByStripeCustomer(customerId);
            if (userId) {
              // B2a: resetMonthlyCredits resets both user_credit_balances (display)
              // and the org pool (gate/decrement target) in a single call.
              await creditService.resetMonthlyCredits(userId);
              logger.info('Invoice paid — credits reset (user + org, indirect)', { userId });
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data?.object;
          const productId = sub?.items?.data?.[0]?.price?.product;
          const newTier = resolveTier(productId);
          const customerId = sub?.customer;

          // B3: try direct org resolution first.
          const orgId = await findOrgByStripeCustomer(customerId);
          if (orgId) {
            // Update org tier directly. Then mirror to owner's user row.
            // creditService.updateTier handles the credit arithmetic and calls updateOrgTier
            // internally — call it on the owner to avoid duplicating the logic.
            const ownerId = await findOrgOwner(orgId);
            if (ownerId) {
              await creditService.updateTier(ownerId, newTier);
            } else {
              // No owner found — update org tier directly.
              await updateOrgTier(orgId, newTier);
            }
            logger.info('Subscription updated — tier changed (direct)', { orgId, newTier });
          } else {
            // Fallback: user-indirect.
            const userId = await findUserByStripeCustomer(customerId);
            if (userId) {
              // B2a: updateTier updates both user_credit_balances and org_credit_balances.
              await creditService.updateTier(userId, newTier);
              logger.info('Subscription updated — tier changed (user+org, indirect)', { userId, newTier });
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data?.object;
          const customerId = sub?.customer;

          // B3: try direct org resolution first.
          const orgId = await findOrgByStripeCustomer(customerId);
          if (orgId) {
            const ownerId = await findOrgOwner(orgId);
            if (ownerId) {
              await creditService.updateTier(ownerId, 'scout');
            } else {
              await updateOrgTier(orgId, 'scout');
            }
            logger.info('Subscription deleted — downgraded to scout (direct)', { orgId });
          } else {
            // Fallback: user-indirect.
            const userId = await findUserByStripeCustomer(customerId);
            if (userId) {
              // B2a: updateTier updates both user_credit_balances and org_credit_balances.
              await creditService.updateTier(userId, 'scout');
              logger.info('Subscription deleted — downgraded to scout (user+org, indirect)', { userId });
            }
          }
          break;
        }
      }
    } catch (error) {
      logger.error('Stripe business logic error', { type: event.type, error });
    }
  }
}
