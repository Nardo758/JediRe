/**
 * Email Service — abstraction layer for transactional email delivery.
 *
 * Provider auto-detection order (first match wins):
 *   1. EMAIL_PROVIDER env var explicitly set → use that provider
 *   2. RESEND_API_KEY present                → resend (preferred)
 *   3. SENDGRID_API_KEY present              → sendgrid
 *   4. POSTMARK_SERVER_TOKEN present          → postmark
 *   5. Fallback                               → noop (logs only)
 *
 * Required env vars:
 *   EMAIL_FROM            — "Sender Name <from@yourdomain.com>"
 *   RESEND_API_KEY        — Resend API key (starts with re_)
 *   SENDGRID_API_KEY      — SendGrid API key (alternative to Resend)
 *   POSTMARK_SERVER_TOKEN — Postmark server token (alternative to Resend)
 */

import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
  readonly name: string;
}

// ─── Providers ────────────────────────────────────────────────────────────────

class NoOpEmailProvider implements EmailProvider {
  readonly name = 'noop';

  async send(payload: EmailPayload): Promise<void> {
    logger.info('[email:noop] Email not sent — no provider configured', {
      to: payload.to,
      subject: payload.subject,
    });
  }
}

class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly apiKey: string;
  private readonly from: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY!;
    this.from = process.env.EMAIL_FROM ?? 'JediRe <onboarding@resend.dev>';
  }

  async send(payload: EmailPayload): Promise<void> {
    const body = {
      from: this.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Resend error ${resp.status}: ${errText}`);
    }

    logger.info('[email:resend] Email dispatched', { to: payload.to, subject: payload.subject });
  }
}

class SendGridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly apiKey: string;
  private readonly from: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY!;
    this.from = process.env.EMAIL_FROM ?? 'JediRe <noreply@jedire.com>';
  }

  async send(payload: EmailPayload): Promise<void> {
    const fromParsed = this.parseAddress(this.from);
    const body = {
      personalizations: [{ to: [{ email: payload.to }] }],
      from: fromParsed,
      subject: payload.subject,
      content: [
        { type: 'text/plain', value: payload.text },
        { type: 'text/html',  value: payload.html },
      ],
    };

    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`SendGrid error ${resp.status}: ${errText}`);
    }

    logger.info('[email:sendgrid] Email dispatched', { to: payload.to, subject: payload.subject });
  }

  private parseAddress(raw: string): { email: string; name?: string } {
    const m = raw.match(/^(.+?)\s*<(.+?)>$/);
    if (m) return { name: m[1].trim(), email: m[2].trim() };
    return { email: raw.trim() };
  }
}

class PostmarkEmailProvider implements EmailProvider {
  readonly name = 'postmark';
  private readonly token: string;
  private readonly from: string;

  constructor() {
    this.token = process.env.POSTMARK_SERVER_TOKEN!;
    this.from = process.env.EMAIL_FROM ?? 'JediRe <noreply@jedire.com>';
  }

  async send(payload: EmailPayload): Promise<void> {
    const body = {
      From: this.from,
      To: payload.to,
      Subject: payload.subject,
      TextBody: payload.text,
      HtmlBody: payload.html,
      MessageStream: 'outbound',
    };

    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.token,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Postmark error ${resp.status}: ${errText}`);
    }

    logger.info('[email:postmark] Email dispatched', { to: payload.to, subject: payload.subject });
  }
}

// ─── Provider factory ─────────────────────────────────────────────────────────

function createProvider(): EmailProvider {
  const explicit = (process.env.EMAIL_PROVIDER ?? '').toLowerCase();

  // Explicit override takes priority
  if (explicit === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      logger.warn('[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is missing — falling back to noop');
      return new NoOpEmailProvider();
    }
    logger.info('[email] Provider: resend (explicit)');
    return new ResendEmailProvider();
  }

  if (explicit === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn('[email] EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY is missing — falling back to noop');
      return new NoOpEmailProvider();
    }
    logger.info('[email] Provider: sendgrid (explicit)');
    return new SendGridEmailProvider();
  }

  if (explicit === 'postmark') {
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      logger.warn('[email] EMAIL_PROVIDER=postmark but POSTMARK_SERVER_TOKEN is missing — falling back to noop');
      return new NoOpEmailProvider();
    }
    logger.info('[email] Provider: postmark (explicit)');
    return new PostmarkEmailProvider();
  }

  // Auto-detect from key presence when EMAIL_PROVIDER is not set
  if (!explicit || explicit === 'noop') {
    if (process.env.RESEND_API_KEY) {
      logger.info('[email] Provider: resend (auto-detected from RESEND_API_KEY)');
      return new ResendEmailProvider();
    }
    if (process.env.SENDGRID_API_KEY) {
      logger.info('[email] Provider: sendgrid (auto-detected from SENDGRID_API_KEY)');
      return new SendGridEmailProvider();
    }
    if (process.env.POSTMARK_SERVER_TOKEN) {
      logger.info('[email] Provider: postmark (auto-detected from POSTMARK_SERVER_TOKEN)');
      return new PostmarkEmailProvider();
    }
  }

  if (explicit && explicit !== 'noop') {
    logger.warn(`[email] Unknown EMAIL_PROVIDER="${explicit}" — falling back to noop`);
  }

  return new NoOpEmailProvider();
}

const provider = createProvider();

// ─── Templates ───────────────────────────────────────────────────────────────

function buildShareInvitationHtml(params: {
  senderName: string;
  dealName: string;
  previewPitch?: string | null;
  capsuleUrl: string;
  expiresAt?: string | null;
  accessType: string;
}): string {
  const expiryLine = params.expiresAt
    ? `<p style="color:#6b7280;font-size:13px;margin:0 0 0 0;">This link expires on ${new Date(params.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>`
    : '';

  const pitchBlock = params.previewPitch
    ? `<div style="background:#f3f4f6;border-left:3px solid #2563eb;padding:12px 16px;margin:20px 0;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:14px;color:#374151;font-style:italic;">"${params.previewPitch}"</p>
       </div>`
    : '';

  const agentLine = params.accessType === 'external_agent_enabled'
    ? `<p style="color:#374151;font-size:14px;margin:0 0 16px 0;">You can also connect your AI API key to query the deal agent directly.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Deal Shared With You</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">JediRe</p>
          <h1 style="margin:6px 0 0 0;color:#ffffff;font-size:20px;font-weight:600;">Deal shared with you</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px 0;font-size:15px;color:#111827;"><strong>${params.senderName}</strong> wants you to review a deal:</p>
          <h2 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#111827;">${params.dealName}</h2>
          ${pitchBlock}
          ${agentLine}

          <!-- CTA -->
          <div style="text-align:center;margin:28px 0;">
            <a href="${params.capsuleUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">View Deal →</a>
          </div>

          <p style="color:#6b7280;font-size:13px;margin:16px 0 0 0;">Or copy this link into your browser:</p>
          <p style="color:#2563eb;font-size:13px;margin:4px 0 0 0;word-break:break-all;">${params.capsuleUrl}</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid #e5e7eb;padding:20px 32px;background:#f9fafb;">
          ${expiryLine}
          <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0;">This deal was shared via JediRe, an AI-powered real estate intelligence platform. If you didn't expect this, you can ignore this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildShareInvitationText(params: {
  senderName: string;
  dealName: string;
  previewPitch?: string | null;
  capsuleUrl: string;
  expiresAt?: string | null;
}): string {
  const lines: string[] = [
    `${params.senderName} shared a deal with you on JediRe`,
    '',
    `Deal: ${params.dealName}`,
  ];
  if (params.previewPitch) {
    lines.push('', `"${params.previewPitch}"`);
  }
  lines.push('', `View the deal here:`, params.capsuleUrl);
  if (params.expiresAt) {
    lines.push('', `This link expires on ${new Date(params.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`);
  }
  lines.push('', '---', 'Shared via JediRe. If you didn\'t expect this, ignore this email.');
  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const emailService = {
  /** Returns true if a real provider (non-noop) is configured. */
  isEnabled(): boolean {
    return provider.name !== 'noop';
  },

  /** Name of the active provider ('sendgrid' | 'postmark' | 'noop'). */
  providerName(): string {
    return provider.name;
  },

  /**
   * Sends a share invitation email to a specific recipient.
   * Returns true if the email was dispatched to a live provider,
   * false if the noop provider is active (email logged only).
   */
  async sendShareInvitation(params: {
    to: string;
    senderName: string;
    dealName: string;
    previewPitch?: string | null;
    capsuleUrl: string;
    expiresAt?: string | null;
    accessType: string;
  }): Promise<boolean> {
    const subject = `${params.senderName} shared a deal with you: ${params.dealName}`;
    const html = buildShareInvitationHtml(params);
    const text = buildShareInvitationText(params);

    await provider.send({ to: params.to, subject, html, text });
    return this.isEnabled();
  },
};
