import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export function createMicrosoftInlineRoutes(microsoftConfig: MicrosoftConfig) {
  const router = Router();
  const pool = getPool();

  router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    const configured = !!(microsoftConfig.clientId && microsoftConfig.clientSecret);
    let connected = false;
    try {
      // Use pool directly instead of req.dbClient
    const client = pool;
      const result = await client.query(
        'SELECT id FROM microsoft_accounts WHERE user_id = $1 AND is_active = true LIMIT 1',
        [req.user!.userId]
      );
      connected = result.rows.length > 0;
    } catch (error) {
      console.error('Error checking Microsoft connection:', error);
    }
    res.json({ configured, connected });
  });

  router.get('/auth/url', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!microsoftConfig.clientId) {
      return res.status(500).json({ success: false, error: 'Microsoft not configured' });
    }
    const statePayload = Buffer.from(JSON.stringify({
      userId: req.user!.userId,
      ts: Date.now(),
    })).toString('base64');
    const authUrl = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${microsoftConfig.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(microsoftConfig.redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(microsoftConfig.scopes.join(' '))}` +
      `&state=${encodeURIComponent(statePayload)}`;
    res.json({ success: true, authUrl });
  });

  router.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (error) {
      return res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=${error}`);
    }
    if (!code) {
      return res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=no_code`);
    }
    try {
      const axios = require('axios');
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: microsoftConfig.clientId,
          client_secret: microsoftConfig.clientSecret,
          code: code as string,
          redirect_uri: microsoftConfig.redirectUri,
          grant_type: 'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const tokens = tokenResponse.data;
      let userEmail = 'unknown@outlook.com';
      let displayName = '';
      try {
        const profileRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        userEmail = profileRes.data.mail || profileRes.data.userPrincipalName || userEmail;
        displayName = profileRes.data.displayName || '';
      } catch (profileErr) {
        console.error('Could not fetch Microsoft profile:', profileErr);
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS microsoft_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          email VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          token_expires_at TIMESTAMPTZ,
          is_active BOOLEAN DEFAULT true,
          last_sync_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      let userId: string | null = null;
      try {
        const stateParam = req.query.state as string;
        if (stateParam) {
          const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString());
          userId = decoded.userId || null;
        }
      } catch (e) {
        console.warn('Could not decode Microsoft OAuth state:', e);
      }

      const existingAccount = await pool.query(
        'SELECT id FROM microsoft_accounts WHERE email = $1',
        [userEmail]
      );

      if (existingAccount.rows.length > 0) {
        await pool.query(
          `UPDATE microsoft_accounts
           SET access_token = $1, refresh_token = $2, token_expires_at = $3,
               is_active = true, updated_at = NOW(), display_name = $4
               ${userId ? ', user_id = $6' : ''}
           WHERE id = $5`,
          userId
            ? [tokens.access_token, tokens.refresh_token || null, expiresAt, displayName, existingAccount.rows[0].id, userId]
            : [tokens.access_token, tokens.refresh_token || null, expiresAt, displayName, existingAccount.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO microsoft_accounts (user_id, email, display_name, access_token, refresh_token, token_expires_at)
           VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)`,
          [userId, userEmail, displayName, tokens.access_token, tokens.refresh_token || null, expiresAt]
        );
      }

      console.log(`Microsoft OAuth successful: ${userEmail}`);
      res.redirect(`${frontendUrl}/dashboard/email?connected=microsoft`);
    } catch (error) {
      console.error('Microsoft OAuth error:', error);
      res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=token_exchange_failed`);
    }
  });

  return router;
}
