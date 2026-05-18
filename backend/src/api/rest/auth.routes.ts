/**
 * Authentication REST Routes
 * User registration, login, OAuth
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { query } from '../../database/connection';
import { generateTokenPair, verifyRefreshToken } from '../../auth/jwt';
import { initializeOAuth } from '../../auth/oauth';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { validate, userSchemas } from '../../utils/validators';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';

const router = Router();

// Initialize OAuth
initializeOAuth();
router.use(passport.initialize());

/**
 * POST /api/v1/auth/register
 * Register new user with email/password
 */
router.post('/register', async (req: Request, res: Response, next) => {
  try {
    // Validate input
    const { error, value } = validate(userSchemas.register, req.body);
    if (error) {
      throw new AppError(400, error);
    }

    const { email, password, firstName, lastName } = value;

    // Optional platform_role from registration wizard (sponsor | lp | lender).
    // Defaults to 'sponsor' — backward compat with existing callers that omit it.
    const rawRole = req.body.platformRole ?? req.body.platform_role ?? 'sponsor';
    const platformRole: 'sponsor' | 'lp' | 'lender' =
      ['sponsor', 'lp', 'lender'].includes(rawRole) ? rawRole : 'sponsor';

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError(409, 'User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Derive the canonical user_type from the platform_role (Task #878).
    // human_sponsor | human_lp | human_lender are the extended human sub-types;
    // legacy 'human' is kept valid for old rows but new registrations always use sub-types.
    const userTypeMap: Record<string, string> = {
      sponsor: 'human_sponsor',
      lp: 'human_lp',
      lender: 'human_lender',
    };
    const userType = userTypeMap[platformRole] ?? 'human_sponsor';

    // Create user with both platform_role and user_type set consistently.
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, platform_role, user_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, platform_role, user_type, created_at`,
      [email, passwordHash, firstName, lastName, platformRole, userType]
    );

    const user = result.rows[0];

    // Seed capabilities based on platform_role.
    // Sponsors get full edit access; LP/lender are view-only on capital structure.
    const sponsorCaps = ['edit:capital_structure', 'edit:operating_assumptions', 'view:returns'];
    const baseCaps = ['view:returns'];
    const capsToGrant = platformRole === 'sponsor' ? sponsorCaps : baseCaps;
    for (const cap of capsToGrant) {
      await query(
        `INSERT INTO user_capabilities (user_id, capability, granted_by)
         VALUES ($1, $2, 'system') ON CONFLICT DO NOTHING`,
        [user.id, cap]
      );
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken]
    );

    logger.info('User registered:', email, `platform_role=${platformRole}`);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        platformRole: user.platform_role,
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email/password
 */
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { error, value } = validate(userSchemas.login, req.body);
    if (error) {
      throw new AppError(400, error);
    }

    const { email, password } = value;

    // Find user
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    if (!user.password_hash) {
      throw new AppError(401, 'Please login with OAuth provider');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'Invalid credentials');
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [user.id, tokens.refreshToken]
    );

    logger.info('User logged in:', email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        platformRole: user.platform_role ?? 'sponsor',
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'Refresh token required');
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError(401, 'Invalid refresh token');
    }

    // Check if token exists in database
    const tokenResult = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      throw new AppError(401, 'Refresh token expired or invalid');
    }

    // Generate new tokens
    const tokens = generateTokenPair(payload);

    // Store new refresh token
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [payload.userId, tokens.refreshToken]
    );

    // Delete old refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    res.json({ tokens });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout (invalidate refresh token)
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    // Delete all expired tokens for this user
    await query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()',
      [req.user!.userId]
    );

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.role,
              u.platform_role,
              u.email_verified, u.created_at, u.last_login_at, u.phone,
              COALESCE(ucb.subscription_tier, 'scout') as subscription_tier,
              u.notification_preferences
       FROM users u
       LEFT JOIN user_credit_balances ucb ON ucb.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'User not found');
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      platformRole: user.platform_role ?? 'sponsor',
      phone: user.phone || '',
      tier: user.subscription_tier,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      notificationPreferences: user.notification_preferences || {},
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/auth/profile
 * Update current user profile
 */
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName, phone, notificationPreferences } = req.body;

    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 1;

    if (firstName !== undefined) {
      paramCount++;
      updates.push(`first_name = $${paramCount}`);
      values.push(firstName);
    }

    if (lastName !== undefined) {
      paramCount++;
      updates.push(`last_name = $${paramCount}`);
      values.push(lastName);
    }

    if (phone !== undefined) {
      paramCount++;
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
    }

    if (notificationPreferences !== undefined) {
      paramCount++;
      updates.push(`notification_preferences = $${paramCount}`);
      values.push(JSON.stringify(notificationPreferences));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1
       RETURNING id, email, first_name, last_name, phone, notification_preferences`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError(404, 'User not found');
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone || '',
        notificationPreferences: user.notification_preferences || {},
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Google OAuth routes
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  async (req: any, res: Response, next) => {
    try {
      const user = req.user;

      // Generate tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: 'user',
      });

      // Store refresh token
      await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [user.id, tokens.refreshToken]
      );

      // Redirect to frontend with tokens
      const redirectUrl = `${process.env.CORS_ORIGIN}/auth/callback?` +
        `accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`;

      res.redirect(redirectUrl);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
