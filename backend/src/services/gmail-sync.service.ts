/**
 * Gmail Sync Service
 * Handles Gmail API integration for email synchronization
 * Uses OAuth2 tokens stored in user_email_accounts table
 */

import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';
import { query } from '../database/connection';
import { AppError } from '../middleware/errorHandler';

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: gmail_v1.Schema$MessagePart;
  internalDate: string;
}

interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Date | null;
}

export class GmailSyncService {
  private _oauth2Client: OAuth2Client | null = null;
  private static readonly REQUIRED_SCOPES = new Set([
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ]);

  private resolveCallbackUrl(overrideCallbackUrl?: string): string {
    const callbackUrl = overrideCallbackUrl
      || process.env.GOOGLE_GMAIL_CALLBACK_URL
      || process.env.GOOGLE_REDIRECT_URI
      || process.env.GOOGLE_CALLBACK_URL;

    if (!callbackUrl) {
      logger.error(
        'Missing Gmail OAuth redirect URI env vars: GOOGLE_GMAIL_CALLBACK_URL | GOOGLE_REDIRECT_URI | GOOGLE_CALLBACK_URL'
      );
      throw new AppError(
        500,
        'Google OAuth not configured: set GOOGLE_GMAIL_CALLBACK_URL (or GOOGLE_REDIRECT_URI / GOOGLE_CALLBACK_URL)'
      );
    }

    return callbackUrl;
  }

  private createOAuthClient(overrideCallbackUrl?: string): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = this.resolveCallbackUrl(overrideCallbackUrl);

    if (!clientId || !clientSecret) {
      const missing = [
        !clientId && 'GOOGLE_CLIENT_ID',
        !clientSecret && 'GOOGLE_CLIENT_SECRET',
      ].filter(Boolean).join(', ');
      logger.error(`Missing Google OAuth env vars: ${missing}`);
      throw new AppError(500, `Google OAuth not configured: missing ${missing}`);
    }

    return new google.auth.OAuth2(clientId, clientSecret, callbackUrl);
  }

  private getExpiryDate(expiryDate?: number | null): Date {
    // Google returns expiry_date as an absolute Unix ms timestamp.
    if (typeof expiryDate === 'number' && Number.isFinite(expiryDate) && expiryDate > 0) {
      return expiryDate > 10_000_000_000
        ? new Date(expiryDate)
        : new Date(Date.now() + expiryDate);
    }

    return new Date(Date.now() + 3600000);
  }

  private parseGrantedScopes(scopeValue?: string | null): string[] {
    if (!scopeValue) return [];
    return scopeValue
      .split(/\s+/)
      .map(scope => scope.trim())
      .filter(Boolean);
  }

  private validateGrantedScopes(grantedScopes: string[]): void {
    if (grantedScopes.length === 0) {
      // Some token responses omit scope when unchanged; skip strict validation in that case.
      return;
    }

    const missingScopes = [...GmailSyncService.REQUIRED_SCOPES].filter(
      scope => !grantedScopes.includes(scope)
    );

    if (missingScopes.length > 0) {
      throw new AppError(
        400,
        `Google permissions missing required scopes: ${missingScopes.join(', ')}. Reconnect Gmail and approve all requested permissions.`
      );
    }
  }

  private getOAuthErrorMessage(statusCode: number | string, detail: string): string {
    const detailLower = detail.toLowerCase();

    if (detailLower.includes('redirect_uri_mismatch')) {
      return `Google auth failed (${statusCode}): redirect URI mismatch. Ensure GOOGLE_GMAIL_CALLBACK_URL matches the exact authorized redirect URI in Google Cloud Console.`;
    }

    if (detailLower.includes('unauthorized_client') || detailLower.includes('unauthorized') || statusCode === 401) {
      return `Google auth failed (${statusCode}): unauthorized client. Verify client ID/secret, use a Web Application OAuth client, and confirm the Gmail callback URI is authorized.`;
    }

    if (detailLower.includes('invalid_client')) {
      return `Google auth failed (${statusCode}): invalid OAuth client credentials. Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`;
    }

    if (detailLower.includes('invalid_grant')) {
      return `Google auth failed (${statusCode}): authorization code is invalid or expired. Start the Gmail connection flow again.`;
    }

    return `Google auth failed (${statusCode}): ${detail}`;
  }

  private get oauth2Client(): OAuth2Client {
    if (!this._oauth2Client) {
      const callbackUrl = this.resolveCallbackUrl();
      logger.info(`Initializing Google OAuth2 client with callback: ${callbackUrl}`);
      this._oauth2Client = this.createOAuthClient(callbackUrl);
    }
    return this._oauth2Client;
  }

  /**
   * Get authorization URL for Gmail OAuth
   */
  getAuthUrl(state?: string, callbackUrl?: string): string {
    const oauthClient = this.createOAuthClient(callbackUrl);

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true,
      state,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    email: string;
    grantedScopes: string[];
  }>;
  async exchangeCodeForTokens(code: string, callbackUrl?: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date;
    email: string;
    grantedScopes: string[];
  }> {
    try {
      const resolvedCallbackUrl = this.resolveCallbackUrl(callbackUrl);
      logger.info(`Token exchange using callback URL: ${resolvedCallbackUrl}`);
      const tempClient = this.createOAuthClient(resolvedCallbackUrl);
      const { tokens } = await tempClient.getToken(code);
      
      if (!tokens.access_token) {
        throw new AppError(500, 'No access token received from Google');
      }

      tempClient.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: tempClient });
      const userInfo = await oauth2.userinfo.get();
      
      const email = userInfo.data.email;
      if (!email) {
        throw new AppError(500, 'No email found in Google account');
      }

      const grantedScopes = this.parseGrantedScopes(tokens.scope);
      this.validateGrantedScopes(grantedScopes);
      const expiresAt = this.getExpiryDate(tokens.expiry_date);

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        email,
        grantedScopes,
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      const gaxiosData = error?.response?.data;
      const detail = gaxiosData?.error_description 
        || gaxiosData?.error 
        || error?.message 
        || 'Unknown error';
      const statusCode = error?.response?.status || error?.code || 'N/A';
      logger.error(`Google token exchange failed [${statusCode}]:`, detail, JSON.stringify(gaxiosData || {}));
      throw new AppError(500, this.getOAuthErrorMessage(statusCode, detail));
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new AppError(500, 'No access token received from refresh');
      }

      const expiresAt = this.getExpiryDate(credentials.expiry_date);

      return {
        accessToken: credentials.access_token,
        expiresAt,
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new AppError(401, 'Failed to refresh Gmail token. Please reconnect your account.');
    }
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getValidAccessToken(account: EmailAccount): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    if (account.token_expires_at) {
      const expiresAt = new Date(account.token_expires_at);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      
      if (expiresAt > fiveMinutesFromNow) {
        return account.access_token;
      }
    }

    // Token expired or close to expiry - refresh it
    if (!account.refresh_token) {
      throw new AppError(401, 'No refresh token available. Please reconnect your Gmail account.');
    }

    const refreshed = await this.refreshAccessToken(account.refresh_token);

    // Update token in database
    await query(
      `UPDATE user_email_accounts 
       SET access_token = $1, token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [refreshed.accessToken, refreshed.expiresAt, account.id]
    );

    return refreshed.accessToken;
  }

  /**
   * Get Gmail client for an account
   */
  private async getGmailClient(account: EmailAccount): Promise<gmail_v1.Gmail> {
    const accessToken = await this.getValidAccessToken(account);
    
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: account.refresh_token || undefined,
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Parse email headers
   */
  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): {
    subject: string;
    from: { name: string; email: string };
    to: string[];
    cc: string[];
    date: string;
  } {
    const result = {
      subject: '',
      from: { name: '', email: '' },
      to: [] as string[],
      cc: [] as string[],
      date: '',
    };

    if (!headers) return result;

    for (const header of headers) {
      const name = header.name?.toLowerCase();
      const value = header.value || '';

      switch (name) {
        case 'subject':
          result.subject = value;
          break;
        case 'from':
          const fromMatch = value.match(/^(.*?)\s*<(.+?)>$/) || value.match(/^(.+)$/);
          if (fromMatch) {
            result.from.name = fromMatch[1]?.trim() || '';
            result.from.email = (fromMatch[2] || fromMatch[1]).trim();
          }
          break;
        case 'to':
          result.to = value.split(',').map(e => e.trim());
          break;
        case 'cc':
          result.cc = value.split(',').map(e => e.trim());
          break;
        case 'date':
          result.date = value;
          break;
      }
    }

    return result;
  }

  /**
   * Extract email body
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart): {
    text: string;
    html: string;
  } {
    let text = '';
    let html = '';

    const findBody = (part: gmail_v1.Schema$MessagePart) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      if (part.parts) {
        part.parts.forEach(findBody);
      }
    };

    findBody(payload);

    return { text, html };
  }

  /**
   * Sync emails for an account
   */
  async syncEmails(accountId: string, maxResults: number = 50): Promise<{
    fetched: number;
    stored: number;
    skipped: number;
  }> {
    const syncLogId = await this.createSyncLog(accountId);

    try {
      // Get account details
      const accountResult = await query(
        'SELECT * FROM user_email_accounts WHERE id = $1',
        [accountId]
      );

      if (accountResult.rows.length === 0) {
        throw new AppError(404, 'Email account not found');
      }

      const account = accountResult.rows[0] as EmailAccount;

      // Get Gmail client
      const gmail = await this.getGmailClient(account);

      // Fetch messages
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox OR in:sent',
      });

      const messages = response.data.messages || [];
      let stored = 0;
      let skipped = 0;

      // Process each message
      for (const message of messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const headers = this.parseHeaders(fullMessage.data.payload?.headers);
          const body = this.extractBody(fullMessage.data.payload!);
          const receivedAt = new Date(parseInt(fullMessage.data.internalDate || '0'));

          const existingResult = await query(
            'SELECT id FROM emails WHERE email_account_id = $1 AND external_id = $2',
            [accountId, message.id]
          );

          if (existingResult.rows.length > 0) {
            skipped++;
            continue;
          }

          await query(
            `INSERT INTO emails (
              email_account_id, user_id, external_id, thread_id,
              subject, from_address, from_name, to_addresses, cc_addresses,
              body_text, body_html, body_preview, received_at,
              is_read, has_attachments
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              accountId,
              account.user_id,
              message.id,
              fullMessage.data.threadId,
              headers.subject,
              headers.from.email,
              headers.from.name,
              headers.to,
              headers.cc,
              body.text,
              body.html,
              fullMessage.data.snippet,
              receivedAt,
              fullMessage.data.labelIds?.includes('UNREAD') ? false : true,
              false,
            ]
          );

          stored++;
        } catch (error) {
          logger.error(`Error processing message ${message.id}:`, error);
        }
      }

      // Update sync log
      await this.completeSyncLog(syncLogId, messages.length, stored, skipped);

      // Update last_sync_at
      await query(
        'UPDATE user_email_accounts SET last_sync_at = NOW() WHERE id = $1',
        [accountId]
      );

      logger.info(`Gmail sync completed for account ${accountId}: ${stored} stored, ${skipped} skipped`);

      return {
        fetched: messages.length,
        stored,
        skipped,
      };
    } catch (error) {
      await this.failSyncLog(syncLogId, error);
      throw error;
    }
  }

  /**
   * Create sync log
   */
  private async createSyncLog(accountId: string): Promise<string> {
    const result = await query(
      `INSERT INTO email_sync_logs (account_id, sync_started_at, sync_status)
       VALUES ($1, NOW(), 'running')
       RETURNING id`,
      [accountId]
    );

    return result.rows[0].id;
  }

  /**
   * Complete sync log
   */
  private async completeSyncLog(
    logId: string,
    fetched: number,
    stored: number,
    skipped: number
  ): Promise<void> {
    await query(
      `UPDATE email_sync_logs 
       SET sync_completed_at = NOW(), sync_status = 'success',
           messages_fetched = $2, messages_stored = $3, messages_skipped = $4
       WHERE id = $1`,
      [logId, fetched, stored, skipped]
    );
  }

  /**
   * Fail sync log
   */
  private async failSyncLog(logId: string, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await query(
      `UPDATE email_sync_logs 
       SET sync_completed_at = NOW(), sync_status = 'failed', error_message = $2
       WHERE id = $1`,
      [logId, errorMessage]
    );
  }

  /**
   * Send email via Gmail
   */
  async sendEmail(
    accountId: string,
    params: {
      to: string[];
      cc?: string[];
      subject: string;
      body: string;
      bodyType?: 'text' | 'html';
    }
  ): Promise<void> {
    const accountResult = await query(
      'SELECT * FROM user_email_accounts WHERE id = $1',
      [accountId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Email account not found');
    }

    const account = accountResult.rows[0] as EmailAccount;
    const gmail = await this.getGmailClient(account);

    // Create email message
    const messageParts = [
      `To: ${params.to.join(', ')}`,
      params.cc ? `Cc: ${params.cc.join(', ')}` : '',
      `Subject: ${params.subject}`,
      params.bodyType === 'html' ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
      '',
      params.body,
    ].filter(Boolean);

    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    logger.info(`Email sent via Gmail account ${accountId}`);
  }
}

export const gmailSyncService = new GmailSyncService();
