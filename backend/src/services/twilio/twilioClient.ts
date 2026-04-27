/**
 * Twilio client — lazy SDK initialisation.
 *
 * Returns a configured Twilio REST client if `TWILIO_ACCOUNT_SID` and
 * `TWILIO_AUTH_TOKEN` are set, throws a clear error otherwise. Used by both
 * the chat reply path (messageRouter.handleTwilio) and the OpenClaw
 * notification channel (services/notifications/channels/twilio.ts).
 */

/**
 * Minimal interface covering the parts of the Twilio SDK we actually use.
 * Avoids leaking `any` into callers and lets TypeScript catch typos like
 * `client.message.create(...)` (vs. the correct plural `messages`).
 */
export interface TwilioRestClient {
  messages: {
    create(opts: {
      from?: string;
      to: string;
      body?: string;
      mediaUrl?: string[];
    }): Promise<{ sid: string; status: string }>;
  };
}

type TwilioFactory = (sid: string, token: string) => TwilioRestClient;

let cachedClient: TwilioRestClient | null = null;

export async function getTwilioClient(): Promise<TwilioRestClient> {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error(
      'Twilio not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN',
    );
  }
  // The SDK is a CommonJS module exporting a callable factory as the default.
  // ESM dynamic import surfaces it under `.default`; we fall back to the
  // module itself for environments where the interop hoists named exports.
  const twilioMod = (await import('twilio')) as unknown;
  const candidate =
    typeof twilioMod === 'function'
      ? (twilioMod as TwilioFactory)
      : ((twilioMod as { default?: TwilioFactory }).default as TwilioFactory | undefined);
  if (typeof candidate !== 'function') {
    throw new Error('Twilio SDK does not expose a callable factory');
  }
  cachedClient = candidate(sid, token);
  return cachedClient;
}

export async function getTwilioFromPhoneNumber(): Promise<string> {
  const from = process.env.TWILIO_FROM_PHONE_NUMBER;
  if (!from) {
    throw new Error(
      'Twilio not configured: set TWILIO_FROM_PHONE_NUMBER',
    );
  }
  return from;
}
