/**
 * OAuth Provider Configuration
 * Google OAuth 2.0 integration
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

export interface OAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  provider: string;
  providerId: string;
}

/**
 * Configure Google OAuth Strategy
 */
export function configureGoogleOAuth(): void {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth not configured - missing credentials');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_AUTH_CALLBACK_URL ||
          process.env.GOOGLE_CALLBACK_URL ||
          '/api/v1/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user info from Google profile
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const avatarUrl = profile.photos?.[0]?.value;
          const googleId = profile.id;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Check if user exists
          let userResult = await query(
            'SELECT * FROM users WHERE google_id = $1 OR email = $2',
            [googleId, email]
          );

          let user;

          if (userResult.rows.length > 0) {
            // User exists - update last login
            user = userResult.rows[0];
            await query(
              `UPDATE users 
               SET last_login_at = NOW(), google_id = $1, avatar_url = $2
               WHERE id = $3`,
              [googleId, avatarUrl, user.id]
            );
          } else {
            // Create new user
            const insertResult = await query(
              `INSERT INTO users (
                email, first_name, last_name, avatar_url, 
                google_id, oauth_provider, email_verified, last_login_at
              ) VALUES ($1, $2, $3, $4, $5, 'google', TRUE, NOW())
              RETURNING *`,
              [email, firstName, lastName, avatarUrl, googleId]
            );
            user = insertResult.rows[0];
            logger.info('New user created via Google OAuth:', email);
          }

          const oauthUser: OAuthUser = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            avatarUrl: user.avatar_url,
            provider: 'google',
            providerId: googleId,
          };

          done(null, oauthUser);
        } catch (error) {
          logger.error('Google OAuth error:', error);
          done(error as Error);
        }
      }
    )
  );
}

/**
 * Initialize OAuth
 */
export function initializeOAuth(): void {
  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const result = await query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        done(null, result.rows[0]);
      } else {
        done(new Error('User not found'));
      }
    } catch (error) {
      done(error);
    }
  });

  // Configure providers
  configureGoogleOAuth();

  logger.info('OAuth providers configured');
}
