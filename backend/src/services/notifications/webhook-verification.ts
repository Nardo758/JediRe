/**
 * Webhook authenticity verification — gates OpenClaw action dispatch.
 *
 * The /webhooks/twilio and /webhooks/telegram endpoints ALSO carry free-text
 * chat traffic (handled by the unified orchestrator). To avoid breaking local
 * development we don't require signatures for chat — but ANY request that
 * triggers a structured action (Telegram inline button, Twilio "approve <id>"
 * reply) MUST be cryptographically attributable, otherwise an attacker who
 * can POST to the public webhook URL could forge an allowlisted sender id
 * and execute actions without authorization.
 *
 * Signature validation is OFF by default (verifyTwilioSignature / verifyTelegramSecret
 * return true) so existing dev workflows keep working. Set the relevant env
 * vars (see .env.example) to enable.
 */

import type { Request } from 'express';
import { logger } from '../../utils/logger';

/**
 * Verify a Twilio webhook request using the SDK's RequestValidator.
 *
 * Returns true iff:
 *   - signature verification is disabled (no TWILIO_AUTH_TOKEN configured), OR
 *   - the X-Twilio-Signature header is present and validates against the
 *     request URL + form-encoded body using the configured auth token.
 *
 * Set TWILIO_WEBHOOK_BASE_URL (e.g. "https://api.jedire.com") if the request's
 * Host header doesn't match the URL Twilio used (typical when running behind
 * a reverse proxy that rewrites Host).
 */
export async function verifyTwilioSignature(req: Request): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // No auth token => nothing to verify against. Treat as "not enforcing".
    return true;
  }
  const signature = (req.headers['x-twilio-signature'] as string | undefined) || '';
  if (!signature) {
    logger.warn('OpenClaw: Twilio request missing X-Twilio-Signature header');
    return false;
  }

  const baseOverride = process.env.TWILIO_WEBHOOK_BASE_URL;
  const url = baseOverride
    ? `${baseOverride.replace(/\/$/, '')}${req.originalUrl}`
    : `${(req.headers['x-forwarded-proto'] as string) || req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Body must be a flat string→string map for validation. Express's
  // urlencoded parser already produces this shape.
  const params: Record<string, string> = {};
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      params[k] = typeof v === 'string' ? v : String(v ?? '');
    }
  }

  try {
    const twilioMod: any = await import('twilio');
    const Validator =
      twilioMod?.webhook?.webhookValidator ??
      twilioMod?.default?.webhook?.webhookValidator ??
      null;
    // SDK exposes validateRequest as a top-level helper too.
    const validateRequest =
      twilioMod?.validateRequest ?? twilioMod?.default?.validateRequest;
    if (typeof validateRequest === 'function') {
      const ok = validateRequest(authToken, signature, url, params);
      if (!ok) {
        logger.warn('OpenClaw: Twilio signature mismatch', { url });
      }
      return Boolean(ok);
    }
    // Fallback to RequestValidator class if validateRequest isn't exported.
    const RequestValidator =
      twilioMod?.RequestValidator ?? twilioMod?.default?.RequestValidator;
    if (typeof RequestValidator === 'function') {
      const validator = new RequestValidator(authToken);
      const ok = validator.validate(url, params, signature);
      if (!ok) {
        logger.warn('OpenClaw: Twilio signature mismatch', { url });
      }
      return Boolean(ok);
    }
    logger.warn('OpenClaw: twilio SDK exposes no signature validator — denying');
    return false;
  } catch (err: any) {
    logger.warn('OpenClaw: Twilio signature verify threw', { error: err?.message });
    return false;
  }
}

/**
 * Verify a Telegram webhook request using the per-bot secret token.
 *
 * Telegram lets you register the webhook with a `secret_token` parameter
 * (1-256 chars). On every delivery Telegram sends it back in the
 * `X-Telegram-Bot-Api-Secret-Token` header. We compare it against
 * TELEGRAM_WEBHOOK_SECRET; if the env var is unset we treat the channel as
 * unverified (returns true so existing dev flows keep working).
 *
 * To enable: pick a strong random string, set TELEGRAM_WEBHOOK_SECRET to it,
 * and call setWebhook with `?secret_token=<same value>`.
 */
export function verifyTelegramSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return true;
  const got = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  const ok = typeof got === 'string' && got === expected;
  if (!ok) {
    logger.warn('OpenClaw: Telegram secret token mismatch');
  }
  return ok;
}
