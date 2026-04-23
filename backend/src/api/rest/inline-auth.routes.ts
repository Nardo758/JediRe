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

router.get('/dev-login', async (_req, res) => {
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE password_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1'
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
        plan: dbUser.subscription_tier || 'free',
        modules: dbUser.enabled_modules || ['supply']
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
       RETURNING id, email, full_name, first_name, last_name, phone, role, subscription_tier`,
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

export default router;
