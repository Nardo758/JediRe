import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import crypto from 'crypto';

interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function signState(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const payload = Buffer.from(
    JSON.stringify({ userId, nonce: crypto.randomBytes(16).toString('hex'), exp: Date.now() + OAUTH_STATE_TTL_MS })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const dot = state.lastIndexOf('.');
  if (dot === -1) throw new Error('Invalid OAuth state');
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('OAuth state signature invalid');
  }
  let parsed: { userId: string; nonce: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('OAuth state payload malformed');
  }
  if (!parsed.userId || !parsed.exp) throw new Error('OAuth state missing fields');
  if (Date.now() > parsed.exp) throw new Error('OAuth state expired');
  return parsed.userId;
}

export function createMicrosoftInlineRoutes(microsoftConfig: MicrosoftConfig) {
  const router = Router();
  const pool = getPool();

  router.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    const configured = !!(microsoftConfig.clientId && microsoftConfig.clientSecret);
    let connected = false;
    try {
      const result = await pool.query(
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
    let signedState: string;
    try {
      signedState = signState(req.user!.userId);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Could not generate OAuth state' });
    }
    const authUrl = `https://login.microsoftonline.com/${microsoftConfig.tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${microsoftConfig.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(microsoftConfig.redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(microsoftConfig.scopes.join(' '))}` +
      `&state=${encodeURIComponent(signedState)}`;
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

    const stateParam = req.query.state as string | undefined;
    if (!stateParam) {
      return res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=missing_state`);
    }

    let userId: string;
    try {
      userId = verifyState(stateParam);
    } catch (e) {
      console.warn('Microsoft OAuth state verification failed:', e);
      return res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=invalid_state`);
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

      const existingAccount = await pool.query(
        'SELECT id FROM microsoft_accounts WHERE email = $1',
        [userEmail]
      );

      if (existingAccount.rows.length > 0) {
        await pool.query(
          `UPDATE microsoft_accounts
           SET access_token = $1, refresh_token = $2, token_expires_at = $3,
               is_active = true, updated_at = NOW(), display_name = $4,
               user_id = $6
           WHERE id = $5`,
          [tokens.access_token, tokens.refresh_token || null, expiresAt, displayName, existingAccount.rows[0].id, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO microsoft_accounts (user_id, email, display_name, access_token, refresh_token, token_expires_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
          [userId, userEmail, displayName, tokens.access_token, tokens.refresh_token || null, expiresAt]
        );
      }

      const insertedAccount = await pool.query(
        'SELECT id FROM microsoft_accounts WHERE email = $1 ORDER BY updated_at DESC LIMIT 1',
        [userEmail]
      );
      const msAccountId = insertedAccount.rows[0]?.id || '';
      console.log(`Microsoft OAuth successful: ${userEmail}`);
      res.redirect(`${frontendUrl}/dashboard/email?connected=microsoft&accountId=${msAccountId}`);
    } catch (error) {
      console.error('Microsoft OAuth error:', error);
      res.redirect(`${frontendUrl}/dashboard/email?error=microsoft_auth&detail=token_exchange_failed`);
    }
  });

  return router;
}
