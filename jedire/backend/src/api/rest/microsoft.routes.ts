/**
 * Microsoft Integration REST Routes
 * OAuth flow and email/calendar operations
 */

import { Router, Response, Request } from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { query } from '../../database/connection';
import {
  MicrosoftAuthService,
  MicrosoftGraphService,
} from '../../services/microsoft-graph.service';

const router = Router();
const authService = new MicrosoftAuthService();

/**
 * GET /api/v1/microsoft/status
 * Check if Microsoft integration is configured and user is connected
 */
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    
    // Check if service is configured
    const configured = authService.isConfigured();
    
    if (!configured) {
      return res.json({
        configured: false,
        connected: false,
        message: 'Microsoft Graph API not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.',
      });
    }
    
    // Check if user has connected account
    const result = await query(
      'SELECT id, email, display_name, is_active, last_sync_at FROM microsoft_accounts WHERE user_id = $1',
      [userId]
    );
    
    const connected = result.rows.length > 0 && result.rows[0].is_active;
    
    res.json({
      configured: true,
      connected,
      account: connected ? {
        email: result.rows[0].email,
        displayName: result.rows[0].display_name,
        lastSync: result.rows[0].last_sync_at,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/auth/connect
 * Start OAuth flow - redirect to Microsoft login
 */
router.get('/auth/connect', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!authService.isConfigured()) {
      throw new AppError(503, 'Microsoft integration not configured');
    }
    
    const userId = req.user!.userId;
    const authUrl = authService.getAuthorizationUrl(userId);
    
    logger.info('Starting Microsoft OAuth flow', { userId });
    
    res.json({
      authUrl,
      message: 'Redirect user to authUrl to complete OAuth flow',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/auth/callback
 * OAuth callback - exchange code for tokens
 */
router.get('/auth/callback', async (req: Request, res: Response, next) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logger.error('Microsoft OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/settings?microsoft_error=${error}`);
    }
    
    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Authorization code missing');
    }
    
    const userId = state as string; // We passed userId as state
    
    // Exchange code for tokens
    const tokens = await authService.getTokenFromCode(code);
    
    // Get user profile from Microsoft
    const graphService = new MicrosoftGraphService(tokens.accessToken);
    const profile = await graphService.getUserProfile();
    
    // Store in database
    await query(
      `INSERT INTO microsoft_accounts (
        user_id, microsoft_user_id, email, display_name, 
        access_token, refresh_token, token_expires_at,
        scopes, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        microsoft_user_id = $2,
        email = $3,
        display_name = $4,
        access_token = $5,
        refresh_token = $6,
        token_expires_at = $7,
        scopes = $8,
        is_active = $9,
        updated_at = NOW()`,
      [
        userId,
        profile.id,
        profile.mail || profile.userPrincipalName,
        profile.displayName,
        tokens.accessToken,
        tokens.refreshToken,
        new Date(tokens.expiresAt),
        ['Mail.ReadWrite', 'Mail.Send', 'Calendars.ReadWrite'],
        true,
      ]
    );
    
    logger.info('Microsoft account connected', { userId, email: profile.mail });
    
    // Redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}/settings?microsoft_connected=true`);
  } catch (error) {
    logger.error('Microsoft OAuth callback error:', error);
    next(error);
  }
});

/**
 * POST /api/v1/microsoft/auth/disconnect
 * Disconnect Microsoft account
 */
router.post('/auth/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    
    await query(
      'UPDATE microsoft_accounts SET is_active = false WHERE user_id = $1',
      [userId]
    );
    
    logger.info('Microsoft account disconnected', { userId });
    
    res.json({ message: 'Microsoft account disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper: Get Microsoft Graph service for user
 */
async function getUserGraphService(userId: string): Promise<MicrosoftGraphService> {
  const result = await query(
    'SELECT access_token, refresh_token, token_expires_at FROM microsoft_accounts WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError(404, 'Microsoft account not connected');
  }
  
  const account = result.rows[0];
  const now = Date.now();
  const expiresAt = new Date(account.token_expires_at).getTime();
  
  // Refresh token if expired or expiring soon (within 5 minutes)
  if (expiresAt - now < 5 * 60 * 1000) {
    logger.info('Refreshing Microsoft access token', { userId });
    const tokens = await authService.refreshAccessToken(account.refresh_token);
    
    // Update tokens in database
    await query(
      'UPDATE microsoft_accounts SET access_token = $1, refresh_token = $2, token_expires_at = $3 WHERE user_id = $4',
      [tokens.accessToken, tokens.refreshToken, new Date(tokens.expiresAt), userId]
    );
    
    return new MicrosoftGraphService(tokens.accessToken);
  }
  
  return new MicrosoftGraphService(account.access_token);
}

/**
 * GET /api/v1/microsoft/emails/inbox
 * Get inbox messages
 */
router.get('/emails/inbox', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { top = 20, skip = 0, search } = req.query;
    
    const graphService = await getUserGraphService(userId);
    const result = await graphService.getInbox({
      top: parseInt(top as string),
      skip: parseInt(skip as string),
      search: search as string,
    });
    
    res.json({
      emails: result.value,
      hasMore: !!result['@odata.nextLink'],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/emails/:emailId
 * Get specific email
 */
router.get('/emails/:emailId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.params;
    
    const graphService = await getUserGraphService(userId);
    const email = await graphService.getEmail(emailId);
    
    res.json(email);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/microsoft/emails/send
 * Send email
 */
router.post('/emails/send', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { to, cc, bcc, subject, body, bodyType } = req.body;
    
    if (!to || !subject || !body) {
      throw new AppError(400, 'Missing required fields: to, subject, body');
    }
    
    const graphService = await getUserGraphService(userId);
    await graphService.sendEmail({
      to: Array.isArray(to) ? to : [to],
      cc,
      bcc,
      subject,
      body,
      bodyType,
    });
    
    logger.info('Email sent', { userId, to, subject });
    
    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/microsoft/emails/:emailId/reply
 * Reply to email
 */
router.post('/emails/:emailId/reply', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.params;
    const { body, replyAll = false } = req.body;
    
    if (!body) {
      throw new AppError(400, 'Reply body is required');
    }
    
    const graphService = await getUserGraphService(userId);
    await graphService.replyToEmail(emailId, body, replyAll);
    
    logger.info('Email reply sent', { userId, emailId, replyAll });
    
    res.json({ message: 'Reply sent successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/microsoft/emails/:emailId
 * Update email (mark as read, move, etc.)
 */
router.patch('/emails/:emailId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.params;
    const { isRead, moveTo } = req.body;
    
    const graphService = await getUserGraphService(userId);
    
    if (typeof isRead === 'boolean') {
      await graphService.markAsRead(emailId, isRead);
    }
    
    if (moveTo) {
      await graphService.moveEmail(emailId, moveTo);
    }
    
    res.json({ message: 'Email updated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/microsoft/emails/:emailId
 * Delete email
 */
router.delete('/emails/:emailId', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.params;
    
    const graphService = await getUserGraphService(userId);
    await graphService.deleteEmail(emailId);
    
    logger.info('Email deleted', { userId, emailId });
    
    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/emails/search
 * Search emails
 */
router.get('/emails/search', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { q, top = 20 } = req.query;
    
    if (!q) {
      throw new AppError(400, 'Search query (q) is required');
    }
    
    const graphService = await getUserGraphService(userId);
    const result = await graphService.searchEmails(q as string, parseInt(top as string));
    
    res.json({
      emails: result.value,
      query: q,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/folders
 * Get email folders
 */
router.get('/folders', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    
    const graphService = await getUserGraphService(userId);
    const result = await graphService.getFolders();
    
    res.json({ folders: result.value });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/microsoft/calendar/events
 * Get calendar events
 */
router.get('/calendar/events', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { start, end, top = 50 } = req.query;
    
    const graphService = await getUserGraphService(userId);
    const result = await graphService.getCalendarEvents({
      startDateTime: start as string,
      endDateTime: end as string,
      top: parseInt(top as string),
    });
    
    res.json({ events: result.value });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/microsoft/calendar/events
 * Create calendar event
 */
router.post('/calendar/events', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const eventData = req.body;
    
    const graphService = await getUserGraphService(userId);
    const event = await graphService.createCalendarEvent(eventData);
    
    logger.info('Calendar event created', { userId, subject: event.subject });
    
    res.json(event);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/microsoft/emails/:emailId/link-property
 * Link email to property
 */
router.post('/emails/:emailId/link-property', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.params;
    const { propertyId, notes } = req.body;
    
    if (!propertyId) {
      throw new AppError(400, 'propertyId is required');
    }
    
    // Get email from local database or sync from Microsoft
    let emailRecord = await query(
      'SELECT id FROM emails WHERE microsoft_message_id = $1 AND user_id = $2',
      [emailId, userId]
    );
    
    if (emailRecord.rows.length === 0) {
      // Email not in local database yet - fetch and store it
      const graphService = await getUserGraphService(userId);
      const email = await graphService.getEmail(emailId);
      
      const msAccount = await query(
        'SELECT id FROM microsoft_accounts WHERE user_id = $1',
        [userId]
      );
      
      await query(
        `INSERT INTO emails (
          user_id, microsoft_account_id, microsoft_message_id, subject,
          from_name, from_email, received_at, body_preview, has_attachments,
          is_read, linked_property_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          msAccount.rows[0].id,
          email.id,
          email.subject,
          email.from.name,
          email.from.address,
          email.receivedDateTime,
          email.bodyPreview,
          email.hasAttachments,
          email.isRead,
          propertyId,
        ]
      );
      
      emailRecord = await query(
        'SELECT id FROM emails WHERE microsoft_message_id = $1 AND user_id = $2',
        [emailId, userId]
      );
    } else {
      // Update existing email
      await query(
        'UPDATE emails SET linked_property_id = $1 WHERE id = $2',
        [propertyId, emailRecord.rows[0].id]
      );
    }
    
    // Create link record
    await query(
      `INSERT INTO property_email_links (property_id, email_id, linked_by, link_type, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (property_id, email_id) DO UPDATE SET notes = $5`,
      [propertyId, emailRecord.rows[0].id, userId, 'manual', notes]
    );
    
    logger.info('Email linked to property', { userId, emailId, propertyId });
    
    res.json({ message: 'Email linked to property successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
