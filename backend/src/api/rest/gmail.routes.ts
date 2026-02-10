/**
 * Gmail Integration Routes
 * Connect Gmail accounts, sync emails, manage accounts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { gmailSyncService } from '../../services/gmail-sync.service';
import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

/**
 * GET /api/v1/gmail/auth-url
 * Get Gmail OAuth authorization URL
 */
router.get('/auth-url', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const authUrl = gmailSyncService.getAuthUrl(userId);

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

/**
 * GET /api/v1/gmail/callback
 * OAuth callback endpoint
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Authorization code required');
    }

    const userId = state as string;
    if (!userId) {
      throw new AppError(400, 'Invalid state parameter');
    }

    // Exchange code for tokens
    const tokens = await gmailSyncService.exchangeCodeForTokens(code);

    // Check if account already exists
    const existingResult = await query(
      'SELECT id FROM user_email_accounts WHERE user_id = $1 AND email_address = $2',
      [userId, tokens.email]
    );

    let accountId: string;

    if (existingResult.rows.length > 0) {
      // Update existing account
      accountId = existingResult.rows[0].id;
      await query(
        `UPDATE user_email_accounts 
         SET access_token = $1, refresh_token = $2, token_expires_at = $3, 
             sync_enabled = true, updated_at = NOW()
         WHERE id = $4`,
        [tokens.accessToken, tokens.refreshToken, tokens.expiresAt, accountId]
      );
      logger.info(`Gmail account reconnected: ${tokens.email}`);
    } else {
      // Create new account
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

    // Trigger initial sync in background (don't wait)
    gmailSyncService.syncEmails(accountId, 50).catch(error => {
      logger.error('Background sync failed:', error);
    });

    // Redirect to frontend settings page
    const redirectUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5000'}/settings/email?connected=true`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Gmail callback error:', error);
    const redirectUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5000'}/settings/email?error=auth_failed`;
    res.redirect(redirectUrl);
  }
});

/**
 * POST /api/v1/gmail/connect
 * Initiate Gmail connection (alternative to auth-url)
 */
router.post('/connect', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const authUrl = gmailSyncService.getAuthUrl(userId);

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

/**
 * GET /api/v1/gmail/accounts
 * List connected Gmail accounts
 */
router.get('/accounts', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

/**
 * GET /api/v1/gmail/sync
 * Manually trigger email sync for all accounts
 */
router.get('/sync', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { accountId } = req.query;

    if (accountId) {
      // Sync specific account
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
      // Sync all accounts for user
      const accountsResult = await query(
        'SELECT id FROM user_email_accounts WHERE user_id = $1 AND provider = $2 AND sync_enabled = true',
        [userId, 'google']
      );

      const accounts = accountsResult.rows;
      const syncResults = [];

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

/**
 * POST /api/v1/gmail/sync/:accountId
 * Manually trigger sync for specific account
 */
router.post('/sync/:accountId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    // Verify account belongs to user
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

/**
 * DELETE /api/v1/gmail/disconnect/:accountId
 * Disconnect Gmail account
 */
router.delete('/disconnect/:accountId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    // Verify account belongs to user
    const accountResult = await query(
      'SELECT email_address FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Account not found or access denied');
    }

    const emailAddress = accountResult.rows[0].email_address;

    // Delete account (cascade will handle related records)
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

/**
 * PATCH /api/v1/gmail/accounts/:accountId
 * Update account settings
 */
router.patch('/accounts/:accountId', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;
    const { syncEnabled, syncFrequencyMinutes, isPrimary } = req.body;

    // Verify account belongs to user
    const accountResult = await query(
      'SELECT id FROM user_email_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (accountResult.rows.length === 0) {
      throw new AppError(404, 'Account not found or access denied');
    }

    // Build update query dynamically
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

/**
 * GET /api/v1/gmail/emails
 * Get synced emails
 */
router.get('/emails', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { accountId, limit = 50, offset = 0, unreadOnly = false } = req.query;

    let queryStr = `
      SELECT 
        e.id, e.subject, e.from_email, e.from_name, e.snippet,
        e.received_at, e.is_read, e.is_important, e.is_starred,
        e.has_attachments, e.labels, e.linked_deal_id,
        a.email_address as account_email
      FROM emails e
      JOIN user_email_accounts a ON e.account_id = a.id
      WHERE e.user_id = $1
    `;

    const values: any[] = [userId];
    let paramCount = 2;

    if (accountId) {
      queryStr += ` AND e.account_id = $${paramCount++}`;
      values.push(accountId);
    }

    if (unreadOnly === 'true' || unreadOnly === true) {
      queryStr += ` AND e.is_read = false`;
    }

    queryStr += ` ORDER BY e.received_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    values.push(limit, offset);

    const result = await query(queryStr, values);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM emails WHERE user_id = $1';
    const countValues: any[] = [userId];
    
    if (accountId) {
      countQuery += ' AND account_id = $2';
      countValues.push(accountId);
    }
    
    if (unreadOnly === 'true' || unreadOnly === true) {
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

/**
 * GET /api/v1/gmail/sync-logs
 * Get sync history
 */
router.get('/sync-logs', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
