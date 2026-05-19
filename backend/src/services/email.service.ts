/**
 * Email Service — abstraction layer for transactional email delivery.
 *
 * EMAIL_PROVIDER env var controls which provider is active:
 *   'noop'      — default; emails are logged but not sent (development / staging)
 *   'sendgrid'  — TODO: implement SendGridEmailProvider when ready to send
 *   'postmark'  — TODO: implement PostmarkEmailProvider when ready to send
 *
 * To connect a real provider:
 *   1. Add a new class implementing EmailProvider below
 *   2. Add its case to createProvider()
 *   3. Set EMAIL_PROVIDER + provider-specific API key env vars
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
}

// ─── Providers ────────────────────────────────────────────────────────────────

class NoOpEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<void> {
    logger.info('[email:noop] Email not sent — EMAIL_PROVIDER is unset or noop', {
      to: payload.to,
      subject: payload.subject,
    });
  }
}

// Future providers — uncomment and implement when ready:
//
// class SendGridEmailProvider implements EmailProvider {
//   private readonly apiKey = process.env.SENDGRID_API_KEY!;
//   async send(payload: EmailPayload): Promise<void> { ... }
// }
//
// class PostmarkEmailProvider implements EmailProvider {
//   private readonly apiKey = process.env.POSTMARK_SERVER_TOKEN!;
//   async send(payload: EmailPayload): Promise<void> { ... }
// }

function createProvider(): EmailProvider {
  const name = (process.env.EMAIL_PROVIDER ?? 'noop').toLowerCase();
  switch (name) {
    // case 'sendgrid': return new SendGridEmailProvider();
    // case 'postmark': return new PostmarkEmailProvider();
    case 'noop':
    default:
      return new NoOpEmailProvider();
  }
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
          <p style="margin:0;color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">JEDI RE</p>
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
          <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0;">This deal was shared via JEDI RE, an AI-powered real estate intelligence platform. If you didn't expect this, you can ignore this email.</p>
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
    `${params.senderName} shared a deal with you on JEDI RE`,
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
  lines.push('', '---', 'Shared via JEDI RE. If you didn\'t expect this, ignore this email.');
  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const emailService = {
  /** Returns true if a real provider (non-noop) is configured. */
  isEnabled(): boolean {
    return (process.env.EMAIL_PROVIDER ?? 'noop').toLowerCase() !== 'noop';
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
