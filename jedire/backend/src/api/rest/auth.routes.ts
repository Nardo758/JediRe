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

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError(409, 'User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

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

    logger.info('User registered:', email);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
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
      `SELECT id, email, first_name, last_name, avatar_url, role, 
              email_verified, created_at, last_login_at
       FROM users WHERE id = $1`,
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
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
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
