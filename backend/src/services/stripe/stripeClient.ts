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

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = getSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
