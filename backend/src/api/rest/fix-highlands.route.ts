import { Router } from 'express';
import { getPool } from '../../database/connection';

const router = Router();
const pool = getPool();

// Admin-only fix endpoint (use Clawdbot API key)
router.post('/fix-highlands', async (req, res) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  const clawdbotKey = '69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6';
  
  if (apiKey !== clawdbotKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = pool;
    
    // Get first user
    const userResult = await client.query(
      'SELECT id, email FROM users ORDER BY created_at LIMIT 1'
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No users found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Update Highlands deal
    const updateResult = await client.query(
      `UPDATE deals 
       SET user_id = $1
       WHERE name = 'Highlands at Satellite'
       RETURNING id, name, user_id, status, deal_category`,
      [userId]
    );
    
    if (updateResult.rows.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Highlands deal not found or already has user_id',
        user: userResult.rows[0]
      });
    }
    
    res.json({
      success: true,
      message: 'Highlands deal updated successfully',
      user: userResult.rows[0],
      deal: updateResult.rows[0]
    });
    
  } catch (error: any) {
    console.error('Fix Highlands error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
