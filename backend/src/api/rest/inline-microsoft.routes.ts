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
      const client = req.dbClient || pool;
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
    const authUrl = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${microsoftConfig.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(microsoftConfig.redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(microsoftConfig.scopes.join(' '))}` +
      `&state=${Date.now()}`;
    res.json({ success: true, authUrl });
  });

  router.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (error) {
      return res.redirect(`${frontendUrl}/settings?microsoft_error=${error}`);
    }
    if (!code) {
      return res.redirect(`${frontendUrl}/settings?microsoft_error=no_code`);
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
      console.log('Microsoft OAuth successful');
      res.redirect(`${frontendUrl}/settings?microsoft_connected=true`);
    } catch (error) {
      console.error('Microsoft OAuth error:', error);
      res.redirect(`${frontendUrl}/settings?microsoft_error=token_exchange_failed`);
    }
  });

  return router;
}
