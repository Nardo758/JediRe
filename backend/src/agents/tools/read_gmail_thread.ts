/**
 * read_gmail_thread
 *
 * Fetches a Gmail thread (all messages) for deal intake processing.
 * Uses stored OAuth tokens from user_email_accounts.
 *
 * Returns the triggering message's subject, sender, combined body text from
 * all thread messages, and base64-encoded attachment content from the
 * triggering message.
 *
 * We use `users.threads.get` (not `messages.get`) so that body text from
 * prior messages in the conversation is available for the LLM classifier and
 * field extractor — brokers frequently include the offering memo details in
 * earlier replies.
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
  thread_id: string;
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

function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string
): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

/**
 * Fetch a full Gmail thread for deal intake.
 * Returns combined body text from all messages in the thread, plus attachments
 * from the triggering message (identified by messageId).
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

  // ── Step A: Fetch the triggering message to get its threadId ────────────
  const msgRes = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date'],
  });

  const triggerMsg = msgRes.data;
  const threadId = triggerMsg.threadId ?? messageId;
  const triggerHeaders = triggerMsg.payload?.headers ?? [];
  const subject = getHeader(triggerHeaders, 'subject') || '(no subject)';
  const from = getHeader(triggerHeaders, 'from');
  const receivedAt = triggerMsg.internalDate
    ? new Date(parseInt(triggerMsg.internalDate)).toISOString()
    : new Date().toISOString();

  // ── Step B: Fetch the full thread (all messages, full format) ───────────
  const threadRes = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const threadMessages = threadRes.data.messages ?? [];

  // Combine body text from all messages, newest-last so the most recent
  // message appears at the bottom (as brokers typically append new content).
  const combinedBodies: string[] = [];
  const attachments: GmailAttachment[] = [];

  for (const msg of threadMessages) {
    const bodyText = extractBodyText(msg.payload);
    if (bodyText.trim()) combinedBodies.push(bodyText.trim());

    // Collect attachments only from the triggering message to avoid
    // including attachments from unrelated prior replies.
    if (msg.id === messageId && msg.payload) {
      await collectAttachments(gmail, msg.payload, messageId, attachments);
    }
  }

  return {
    message_id: messageId,
    thread_id: threadId,
    subject,
    from,
    from_domain: extractDomain(from),
    body_text: combinedBodies.join('\n\n---\n\n').slice(0, 50_000),
    received_at: receivedAt,
    attachments,
  };
}

async function collectAttachments(
  gmail: ReturnType<typeof google.gmail>,
  part: any,
  messageId: string,
  out: GmailAttachment[]
): Promise<void> {
  if (!part) return;

  if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
    try {
      const attRes = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: part.body.attachmentId,
      });
      const data = attRes.data.data ?? '';
      out.push({
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
    for (const p of part.parts) {
      await collectAttachments(gmail, p, messageId, out);
    }
  }
}


export const readGmailThreadTool = {
  name: 'read_gmail_thread',
  description: `Fetch a Gmail thread (all messages) for deal intake processing.
Uses stored OAuth tokens from user_email_accounts.
Returns subject, sender, combined body text, and base64 attachments.
Use the thread's triggering message ID to fetch full context including prior replies.`,
  inputSchema: z.object({
    message_id: z.string().describe('Gmail message ID of the triggering email'),
    user_id: z.string().describe('User ID for OAuth token lookup'),
    include_attachments: z.boolean().optional().default(false),
    max_attachments: z.number().optional().default(5),
    max_attachment_mb: z.number().optional().default(10),
  }),
  outputSchema: z.object({
    subject: z.string(),
    from: z.string(),
    from_address: z.string(),
    body_text: z.string(),
    thread_length: z.number(),
    attachments: z.array(z.object({
      name: z.string(),
      mime_type: z.string(),
      size_bytes: z.number(),
    })).optional(),
  }),
  execute: readGmailThread,
};
