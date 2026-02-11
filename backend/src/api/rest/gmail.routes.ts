/**
 * Gmail Integration Routes
 * Connect Gmail accounts, sync emails, manage accounts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { gmailSyncService } from '../../services/gmail-sync.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

interface GmailOAuthStatePayload {
  userId: string;
  callbackUrl?: string;
}

function getRequestOrigin(req: Request): string {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedHostHeader = req.headers['x-forwarded-host'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : forwardedHostHeader;

  const protocol = (forwardedProto || req.protocol || 'https').split(',')[0].trim();
  const host = (forwardedHost || req.get('host') || '').split(',')[0].trim();

  if (!host) {
    throw new AppError(500, 'Unable to determine request host for OAuth callback');
  }

  return `${protocol}://${host}`;
}

function resolveGmailCallbackUrl(req: Request): string {
  return process.env.GOOGLE_GMAIL_CALLBACK_URL
    || process.env.GOOGLE_REDIRECT_URI
    || process.env.GOOGLE_CALLBACK_URL
    || `${getRequestOrigin(req)}/api/v1/gmail/callback`;
}

function encodeState(payload: GmailOAuthStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

function decodeState(state?: string): GmailOAuthStatePayload | null {
  if (!state) return null;

  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as GmailOAuthStatePayload;

    if (!parsed?.userId || typeof parsed.userId !== 'string') {
      return null;
    }

    return parsed;
  } catch {
    // Backward compatibility for older flows where state only included userId.
    return { userId: state };
  }
}

router.get('/auth-url', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const callbackUrl = resolveGmailCallbackUrl(req);
    const state = encodeState({ userId, callbackUrl });
    const authUrl = gmailSyncService.getAuthUrl(state, callbackUrl);

    res.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    next(error);
  }
});

router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Authorization code required');
    }

    const parsedState = decodeState(typeof state === 'string' ? state : undefined);
    const userId = parsedState?.userId;
    const callbackUrl = parsedState?.callbackUrl;

    if (!userId) {
      throw new AppError(400, 'Invalid state parameter');
    }

    const tokens = await gmailSyncService.exchangeCodeForTokens(code, callbackUrl);

    const existingResult = await query(
      'SELECT id, refresh_token FROM user_email_accounts WHERE user_id = $1 AND email_address = $2',
      [userId, tokens.email]
    );

    let accountId: string;

    if (existingResult.rows.length > 0) {
      accountId = existingResult.rows[0].id;
      const refreshToken = tokens.refreshToken || existingResult.rows[0].refresh_token || null;
      await query(
        `UPDATE user_email_accounts 
         SET access_token = $1, refresh_token = $2, token_expires_at = $3, 
             sync_enabled = true, updated_at = NOW()
         WHERE id = $4`,
        [tokens.accessToken, refreshToken, tokens.expiresAt, accountId]
      );
      logger.info(`Gmail account reconnected: ${tokens.email}`);
    } else {
      const result = await query(
        `INSERT INTO user_email_accounts (
          user_id, provider, email_address, access_token, refresh_token, token_expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [userId, 'google', tokens.email, tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
      );
      accountId = result.rows[0].id;
      logger.info(`New Gmail account connected: ${tokens.email}`);
    }

    if (tokens.grantedScopes.length > 0) {
      logger.info(`Gmail OAuth scopes granted for ${tokens.email}: ${tokens.grantedScopes.join(', ')}`);
    }

    gmailSyncService.syncEmails(accountId, 50).catch(error => {
      logger.error('Background sync failed:', error);
    });

    const baseUrl = process.env.CORS_ORIGIN || getRequestOrigin(req);
    const redirectUrl = `${baseUrl}/settings/email?connected=true`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Gmail callback error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const baseUrl = process.env.CORS_ORIGIN || getRequestOrigin(req);
    const redirectUrl = `${baseUrl}/settings/email?error=auth_failed&detail=${encodeURIComponent(errorMsg)}`;
    res.redirect(redirectUrl);
  }
});

router.post('/connect', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const callbackUrl = resolveGmailCallbackUrl(req);
    const state = encodeState({ userId, callbackUrl });
    const authUrl = gmailSyncService.getAuthUrl(state, callbackUrl);

    res.json({
      success: true,
      data: {
        authUrl,
        message: 'Redirect user to authUrl to complete Gmail connection',
      },
    });
  } catch (error) {
    logger.error('Error initiating Gmail connection:', error);
    next(error);
  }
});

router.get('/accounts', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT 
        id, email_address, is_primary, last_sync_at, sync_enabled,
        sync_frequency_minutes, created_at, updated_at
       FROM user_email_accounts
       WHERE user_id = $1 AND provider = 'google'
       ORDER BY is_primary DESC, created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error fetching Gmail accounts:', error);
    next(error);
  }
});

router.get('/sync', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { accountId } = req.query;

    if (accountId) {
      const accountResult = await query(
        'SELECT id FROM user_email_accounts WHERE id = $1 AND user_id = $2',
        [accountId, userId]
      );

      if (accountResult.rows.length === 0) {
        throw new AppError(404, 'Account not found');
      }

      const result = await gmailSyncService.syncEmails(accountId as string);

      res.json({
        success: true,
        data: {
          accountId,
          ...result,
        },
        message: 'Email sync completed successfully',
      });
    } else {
      const accountsResult = await query(
        'SELECT id FROM user_email_accounts WHERE user_id = $1 AND provider = $2 AND sync_enabled = true',
        [userId, 'google']
      );

      const accounts = accountsResult.rows;
      const syncResults: any[] = [];

      for (const account of accounts) {
        try {
          const result = await gmailSyncService.syncEmails(account.id);
          syncResults.push({
            accountId: account.id,
            success: true,
            ...result,
          });
        } catch (error) {
          logger.error(`Sync failed for account ${account.id}:`, error);
          syncResults.push({
            accountId: account.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      res.json({
        success: true,
        data: syncResults,
        message: `Synced ${accounts.length} accounts`,
      });
    }
  } catch (error) {
    logger.error('Error syncing emails:', error);
    next(error);
  }
});

router.post('/sync/:accountId', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    const accountResult = await query(
      'SELECT id FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Account not found or access denied');
    }

    const result = await gmailSyncService.syncEmails(accountId);

    res.json({
      success: true,
      data: {
        accountId,
        ...result,
      },
      message: 'Email sync completed successfully',
    });
  } catch (error) {
    logger.error('Error syncing emails:', error);
    next(error);
  }
});

router.delete('/disconnect/:accountId', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    const accountResult = await query(
      'SELECT email_address FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Account not found or access denied');
    }

    const emailAddress = accountResult.rows[0].email_address;

    await query(
      'DELETE FROM user_email_accounts WHERE id = $1',
      [accountId]
    );

    logger.info(`Gmail account disconnected: ${emailAddress}`);

    res.json({
      success: true,
      message: 'Gmail account disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting Gmail account:', error);
    next(error);
  }
});

router.patch('/accounts/:accountId', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;
    const { syncEnabled, syncFrequencyMinutes, isPrimary } = req.body;

    const accountResult = await query(
      'SELECT id FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Account not found or access denied');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (syncEnabled !== undefined) {
      updates.push(`sync_enabled = $${paramCount++}`);
      values.push(syncEnabled);
    }

    if (syncFrequencyMinutes !== undefined) {
      updates.push(`sync_frequency_minutes = $${paramCount++}`);
      values.push(syncFrequencyMinutes);
    }

    if (isPrimary !== undefined) {
      updates.push(`is_primary = $${paramCount++}`);
      values.push(isPrimary);
    }

    if (updates.length === 0) {
      throw new AppError(400, 'No valid fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(accountId);

    await query(
      `UPDATE user_email_accounts SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    res.json({
      success: true,
      message: 'Account settings updated successfully',
    });
  } catch (error) {
    logger.error('Error updating account settings:', error);
    next(error);
  }
});

router.get('/emails', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { accountId, limit = 50, offset = 0, unreadOnly = 'false' } = req.query;

    let queryStr = `
      SELECT 
        e.id, e.subject, e.from_address as from_email, e.from_name, e.body_preview as snippet,
        e.received_at, e.is_read, e.is_flagged as is_important, e.is_flagged as is_starred,
        e.has_attachments, e.deal_id as linked_deal_id,
        a.email_address as account_email
      FROM emails e
      JOIN user_email_accounts a ON e.email_account_id::text = a.id::text
      WHERE e.user_id = $1
    `;

    const values: any[] = [userId];
    let paramCount = 2;

    if (accountId) {
      queryStr += ` AND e.email_account_id = $${paramCount++}`;
      values.push(accountId);
    }

    if (unreadOnly === 'true') {
      queryStr += ` AND e.is_read = false`;
    }

    queryStr += ` ORDER BY e.received_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    values.push(limit, offset);

    const result = await query(queryStr, values);

    let countQuery = 'SELECT COUNT(*) FROM emails WHERE user_id = $1';
    const countValues: any[] = [userId];
    
    if (accountId) {
      countQuery += ' AND email_account_id = $2';
      countValues.push(accountId);
    }
    
    if (unreadOnly === 'true') {
      countQuery += ' AND is_read = false';
    }

    const countResult = await query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + result.rows.length < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching emails:', error);
    next(error);
  }
});

router.get('/sync-logs', requireAuth, async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { accountId, limit = 20 } = req.query;

    let queryStr = `
      SELECT 
        sl.id, sl.sync_started_at, sl.sync_completed_at, sl.sync_status,
        sl.messages_fetched, sl.messages_stored, sl.messages_skipped,
        sl.error_message, a.email_address
      FROM email_sync_logs sl
      JOIN user_email_accounts a ON sl.account_id = a.id
      WHERE a.user_id = $1
    `;

    const values: any[] = [userId];
    let paramCount = 2;

    if (accountId) {
      queryStr += ` AND sl.account_id = $${paramCount++}`;
      values.push(accountId);
    }

    queryStr += ` ORDER BY sl.sync_started_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await query(queryStr, values);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching sync logs:', error);
    next(error);
  }
});

export default router;
