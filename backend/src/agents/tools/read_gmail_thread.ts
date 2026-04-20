/**
 * read_gmail_thread
 *
 * Fetches a Gmail message with attachment content for deal intake.
 * Uses stored OAuth tokens from user_email_accounts.
 * Returns subject, sender, body text, and base64-encoded attachment content.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

export interface GmailAttachment {
  name: string;
  mime_type: string;
  content_base64: string;
  size_bytes: number;
}

export interface GmailThreadResult {
  message_id: string;
  subject: string;
  from: string;
  from_domain: string;
  body_text: string;
  received_at: string;
  attachments: GmailAttachment[];
}

function extractDomain(fromAddress: string): string {
  const emailMatch = fromAddress.match(/<([^>]+)>/) ?? fromAddress.match(/(\S+@\S+)/);
  const email = emailMatch ? emailMatch[1] : fromAddress;
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function extractBodyText(payload: any): string {
  let text = '';
  const findText = (part: any) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(findText);
  };
  findText(payload);
  if (!text && payload?.body?.data) {
    text = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  return text;
}

function parseFromHeader(headers: { name?: string | null; value?: string | null }[]): string {
  const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
  return fromHeader?.value ?? '';
}

function parseSubject(headers: { name?: string | null; value?: string | null }[]): string {
  const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject');
  return subjectHeader?.value ?? '(no subject)';
}

/**
 * Fetch a Gmail message with full content and attachments for deal intake processing.
 * Looks up Gmail credentials from user_email_accounts for the given userId.
 */
export async function readGmailThread(
  messageId: string,
  userId: string
): Promise<GmailThreadResult> {
  const accountRes = await query(
    `SELECT access_token, refresh_token, token_expires_at
     FROM user_email_accounts
     WHERE user_id = $1 AND provider = 'google' AND sync_enabled = true
     ORDER BY is_primary DESC, created_at ASC LIMIT 1`,
    [userId]
  );

  if (accountRes.rows.length === 0) {
    throw new Error(`No Gmail account connected for user ${userId}`);
  }

  const account = accountRes.rows[0];

  const oauth2 = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  const msgRes = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const msg = msgRes.data;
  const headers = msg.payload?.headers ?? [];
  const subject = parseSubject(headers);
  const from = parseFromHeader(headers);
  const bodyText = extractBodyText(msg.payload);
  const receivedAt = msg.internalDate
    ? new Date(parseInt(msg.internalDate)).toISOString()
    : new Date().toISOString();

  const attachments: GmailAttachment[] = [];

  const collectParts = async (part: any) => {
    if (!part) return;
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      try {
        const attRes = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: part.body.attachmentId,
        });
        const data = attRes.data.data ?? '';
        attachments.push({
          name: part.filename,
          mime_type: part.mimeType ?? 'application/octet-stream',
          content_base64: data,
          size_bytes: part.body.size ?? 0,
        });
      } catch (err) {
        logger.warn('read_gmail_thread: failed to fetch attachment', { filename: part.filename, err });
      }
    }
    if (part.parts) {
      for (const p of part.parts) await collectParts(p);
    }
  };

  await collectParts(msg.payload);

  return {
    message_id: messageId,
    subject,
    from,
    from_domain: extractDomain(from),
    body_text: bodyText,
    received_at: receivedAt,
    attachments,
  };
}
