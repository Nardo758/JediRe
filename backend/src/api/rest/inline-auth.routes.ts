import { Router } from 'express';
import { getPool } from '../../database/connection';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';
import { generateAccessToken } from '../../auth/jwt';

const router = Router();
const pool = getPool();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, hasPassword: !!password, bodyKeys: Object.keys(req.body || {}) });
    
    if (email === 'demo@jedire.com' && password === 'demo123') {
      const result = await pool.query(
        'SELECT id, email, full_name, role, subscription_tier, enabled_modules FROM users WHERE email = $1',
        [email]
      );
      console.log('Demo user query result rows:', result.rows.length);
      
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        const user = {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name || 'Demo User',
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
        console.log('Demo login successful, token generated');
        res.json({ success: true, user, token });
        return;
      }
    }
    
    console.log('Login failed: credentials did not match or user not found');
    res.status(401).json({ success: false, error: 'Invalid credentials' });
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
