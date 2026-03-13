import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { generateAccessToken } from '../../auth/jwt';
import { validate, loginSchema } from './validation';

const router = Router();
const pool = getPool();

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, hasPassword: !!password, bodyKeys: Object.keys(req.body || {}) });

    const result = await pool.query(
      'SELECT id, email, full_name, role, subscription_tier, enabled_modules, password_hash FROM users WHERE email = $1',
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
        plan: dbUser.subscription_tier || 'free',
        modules: dbUser.enabled_modules || ['supply']
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

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE id = $1',
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
        plan: dbUser.subscription_tier || 'free',
        modules: dbUser.enabled_modules || ['supply']
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
