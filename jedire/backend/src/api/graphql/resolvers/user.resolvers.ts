/**
 * User GraphQL Resolvers
 */

import { query } from '../../../database/connection';
import { AppError } from '../../../middleware/errorHandler';

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new AppError(401, 'Not authenticated');
      }

      const result = await query(
        `SELECT id, email, first_name, last_name, avatar_url, role,
                email_verified, created_at, last_login_at
         FROM users WHERE id = $1`,
        [context.user.userId]
      );

      if (result.rows.length === 0) {
        throw new AppError(404, 'User not found');
      }

      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url,
        role: user.role,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      };
    },
  },
};
