/**
 * Stripe Client & Sync
 *
 * A5-F8: Replaced dynamic `stripe-replit-sync` import with inline Stripe SDK
 * implementation. The package was never in package.json, so every webhook was
 * silently failing. Now webhook verification and endpoint management use the
 * native `stripe` SDK directly.
 */

import Stripe from 'stripe';

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return key;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return new Stripe(getSecretKey(), {
    apiVersion: '2025-01-27.acacia' as any,
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const secretKey = getSecretKey();
  const isTest = secretKey.startsWith('sk_test_');
  return isTest
    ? (process.env.STRIPE_PUBLISHABLE_KEY || '')
    : (process.env.STRIPE_PUBLISHABLE_KEY || '');
}

export async function getStripeSecretKey(): Promise<string> {
  return getSecretKey();
}

// ── Inline Stripe Sync (replaces stripe-replit-sync dependency) ───────────────

let _stripeClient: Stripe | null = null;
async function getStripeClient(): Promise<Stripe> {
  if (!_stripeClient) {
    _stripeClient = await getUncachableStripeClient();
  }
  return _stripeClient;
}

export interface StripeSync {
  /** Verify Stripe webhook signature and return the parsed event. */
  processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event>;
  /** Find existing webhook endpoint or create one for this Replit domain. */
  findOrCreateManagedWebhook(url: string): Promise<{ webhook: Stripe.WebhookEndpoint | null }>;
}

let stripeSync: StripeSync | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSync) {
    stripeSync = createStripeSync();
  }
  return stripeSync;
}

function createStripeSync(): StripeSync {
  const secretKey = getSecretKey();
  const stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' as any });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  return {
    async processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
      if (!webhookSecret) {
        throw new Error(
          'STRIPE_WEBHOOK_SECRET is not configured. ' +
          'All webhook requests are rejected until the signing secret is set. ' +
          'Obtain the whsec_... value from the Stripe dashboard and set it as STRIPE_WEBHOOK_SECRET.'
        );
      }
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    },

    async findOrCreateManagedWebhook(url: string) {
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const existing = endpoints.data.find(e => e.url === url);
      if (existing) {
        return { webhook: existing };
      }
      const created = await stripe.webhookEndpoints.create({
        url,
        enabled_events: [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
        ],
      });
      return { webhook: created };
    },
  };
}

/** Migrations for stripe-replit-sync tables — no-op since we own the schema. */
export async function runStripeMigrations(opts: { databaseUrl: string }): Promise<void> {
  // The user_credit_balances table and all billing schema are managed by
  // the main migration system (20260427_credit_columns_numeric.sql etc.).
  // Nothing extra needed from stripe-replit-sync.
  console.log('[Stripe] runMigrations: schema owned by main migration system — skipping');
}
