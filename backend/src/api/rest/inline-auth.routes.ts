import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { generateAccessToken } from '../../auth/jwt';
import { validate, loginSchema } from './validation';
import { emailService } from '../../services/email.service';
import { createRateLimiter } from '../../middleware/rateLimit';
import { logger } from '../../utils/logger';

const router = Router();
const pool = getPool();

/**
 * POST /api/v1/auth/register
 *
 * Creates a new user account with an org-of-one in a single atomic transaction:
 *   INSERT users → INSERT organizations → INSERT org_members (owner) →
 *   INSERT org_credit_balances (scout) → UPDATE users SET default_org_id.
 *
 * All-or-nothing: if any step fails the whole tx rolls back, no orphan rows.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const nameTrimmed = (name || '').trim();
    const nameParts = nameTrimmed.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const fullName = nameTrimmed || normalizedEmail.split('@')[0];
    const emailPrefix = normalizedEmail.split('@')[0];
    const orgName = firstName ? `${firstName}'s Organization` : `${emailPrefix}'s Organization`;
    const orgSlug = (firstName || emailPrefix)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + crypto.randomBytes(4).toString('hex');

    const client = await pool.connect();
    let userId: string;
    let orgId: string;
    try {
      await client.query('BEGIN');

      const userRow = await client.query(
        `INSERT INTO users (email, first_name, last_name, full_name, password_hash, email_verified, role)
         VALUES ($1, $2, $3, $4, $5, false, 'investor')
         RETURNING id`,
        [normalizedEmail, firstName, lastName, fullName, passwordHash]
      );
      userId = userRow.rows[0].id;

      const orgRow = await client.query(
        `INSERT INTO organizations (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING id`,
        [orgName, orgSlug, userId]
      );
      orgId = orgRow.rows[0].id;

      await client.query(
        `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [orgId, userId]
      );

      // Seed org credit pool inline (scout tier: 100 credits) — keeps entire creation atomic.
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      await client.query(
        `INSERT INTO org_credit_balances
           (org_id, subscription_tier, credits_included_monthly, credits_remaining,
            credits_used_this_period, monthly_credit_cap, period_start, period_end, updated_at)
         VALUES ($1, 'scout', 100, 100, 0, 100, NOW(), $2, NOW())`,
        [orgId, periodEnd.toISOString()]
      );

      await client.query(
        `UPDATE users SET default_org_id = $1 WHERE id = $2`,
        [orgId, userId]
      );

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const token = generateAccessToken({ userId, email: normalizedEmail, role: 'investor' });

    logger.info('New user registered', { userId, orgId, orgName });

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        email: normalizedEmail,
        name: fullName,
        role: 'investor',
        subscription: { plan: 'scout', modules: [] },
      },
      token,
    });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, hasPassword: !!password, bodyKeys: Object.keys(req.body || {}) });

    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.password_hash,
              COALESCE(ucb.subscription_tier, 'scout') AS subscription_tier
       FROM users u
       LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      console.log('Login failed: user not found');
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const dbUser = result.rows[0];

    if (!dbUser.password_hash) {
      console.log('Login failed: no password hash set for user');
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isValid) {
      console.log('Login failed: password mismatch');
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.full_name || 'User',
      role: dbUser.role || 'user',
      subscription: {
        plan: dbUser.subscription_tier || 'scout',
        modules: []
      }
    };
    const token = generateAccessToken({
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role || 'user'
    });
    console.log('Login successful, token generated');
    res.json({ success: true, user, token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/dev-login', async (_req, res) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    // Pick the dev user that actually has data to look at. Picking purely by
    // most-recent created_at silently swaps the dev session to whichever
    // throwaway test user was most recently inserted (e.g. by an automated
    // test harness), making real seeded deals "disappear" from the UI even
    // though they are still in the DB. Order by owned-deal count first so
    // dev-login lands on the user with the richest workspace, and only fall
    // back to created_at as a tiebreaker.
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role,
              COALESCE(ucb.subscription_tier, 'scout') AS subscription_tier
         FROM users u
         LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
         LEFT JOIN deals d ON d.user_id = u.id
        WHERE u.password_hash IS NOT NULL
        GROUP BY u.id, ucb.subscription_tier
        ORDER BY COUNT(d.id) DESC, u.created_at DESC
        LIMIT 1`
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No dev user available' });
      return;
    }
    const dbUser = result.rows[0];
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.full_name || 'User',
      role: dbUser.role || 'user',
      subscription: {
        plan: dbUser.subscription_tier || 'scout',
        modules: []
      }
    };
    const token = generateAccessToken({
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role || 'user'
    });
    console.log('Dev auto-login successful for:', dbUser.email);
    res.json({ success: true, user, token });
  } catch (error) {
    console.error('Dev login error:', error);
    res.status(500).json({ error: 'Dev login failed' });
  }
});

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role,
              COALESCE(ucb.subscription_tier, 'scout') AS subscription_tier
       FROM users u
       LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const dbUser = result.rows[0];
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.full_name || 'User',
      role: dbUser.role || 'user',
      subscription: {
        plan: dbUser.subscription_tier || 'scout',
        modules: []
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName, phone } = req.body;

    const updates: string[] = [];
    const values: any[] = [userId];
    let p = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${++p}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${++p}`);
      values.push(lastName);
    }
    if (firstName !== undefined || lastName !== undefined) {
      const fn = firstName ?? '';
      const ln = lastName ?? '';
      updates.push(`full_name = $${++p}`);
      values.push(`${fn} ${ln}`.trim());
    }
    if (phone !== undefined) {
      updates.push(`phone = $${++p}`);
      values.push(phone);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1
       RETURNING id, email, full_name, first_name, last_name, phone, role`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const u = result.rows[0];
    res.json({
      success: true,
      user: {
        id: u.id,
        email: u.email,
        name: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User',
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        phone: u.phone || '',
        role: u.role || 'user',
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Password reset ──────────────────────────────────────────────────────────

const RESET_EXPIRY_MINUTES = 45;

// 5 requests per 15 min per IP/user — stricter than authLimiter to prevent token spam
const resetRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many password reset requests. Please try again in 15 minutes.',
});

// POST /api/v1/auth/password-reset/request
// Always returns 200 + generic message — never reveals whether the email exists.
router.post('/password-reset/request', resetRequestLimiter, async (req, res) => {
  const GENERIC_OK = { success: true, message: 'If an account exists for that email, a reset link was sent.' };

  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.json(GENERIC_OK);
      return;
    }

    const userResult = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );

    // No account or Google-only account (no password_hash): silently return generic ok.
    if (userResult.rows.length === 0 || !userResult.rows[0].password_hash) {
      res.json(GENERIC_OK);
      return;
    }

    const user = userResult.rows[0];

    // Generate raw token (goes in email only — never logged or stored).
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    // Delete any prior unexpired tokens for this user (one active reset at a time).
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || process.env.REPLIT_DEV_DOMAIN || 'localhost:5000';
    const baseUrl = `https://${domain}`;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await emailService.sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      expiryMinutes: RESET_EXPIRY_MINUTES,
    });

    console.log(`[password-reset] Reset email dispatched for user ${user.id}`);
  } catch (err) {
    // Log but still return generic ok — don't leak internal errors.
    console.error('[password-reset] request error:', err);
  }

  res.json(GENERIC_OK);
});

// POST /api/v1/auth/password-reset/confirm
// Validates token, updates password, marks token used.
router.post('/password-reset/confirm', async (req, res) => {
  const INVALID_MSG = 'This reset link is invalid or has expired.';

  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string') {
      res.status(400).json({ success: false, error: INVALID_MSG });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await pool.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ success: false, error: INVALID_MSG });
      return;
    }

    const row = tokenResult.rows[0];

    if (row.used_at !== null) {
      res.status(400).json({ success: false, error: INVALID_MSG });
      return;
    }

    if (new Date(row.expires_at) < new Date()) {
      res.status(400).json({ success: false, error: INVALID_MSG });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      row.user_id,
    ]);

    // Mark token used (single-use — replay rejected above).
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    console.log(`[password-reset] Password updated for user ${row.user_id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[password-reset] confirm error:', err);
    res.status(500).json({ success: false, error: 'An internal error occurred. Please try again.' });
  }
});

export default router;
