/**
 * Twilio client — lazy SDK initialisation.
 *
 * Returns a configured Twilio REST client if `TWILIO_ACCOUNT_SID` and
 * `TWILIO_AUTH_TOKEN` are set, throws a clear error otherwise. Used by both
 * the chat reply path (messageRouter.handleTwilio) and the OpenClaw
 * notification channel (services/notifications/channels/twilio.ts).
 */

let cachedClient: any = null;

export async function getTwilioClient(): Promise<any> {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error(
      'Twilio not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN',
    );
  }
  const twilioMod = await import('twilio');
  const factory = (twilioMod as any).default ?? (twilioMod as any);
  cachedClient = factory(sid, token);
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
