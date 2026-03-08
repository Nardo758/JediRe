// Quick fix script - run directly on Replit
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

async function fix() {
  try {
    // Get first user
    const userRes = await pool.query('SELECT id, email FROM users ORDER BY created_at LIMIT 1');
    if (!userRes.rows[0]) {
      console.log('No users found');
      return;
    }
    
    const userId = userRes.rows[0].id;
    console.log('Using user:', userRes.rows[0].email, userId);
    
    // Update Highlands
    const res = await pool.query(
      `UPDATE deals 
       SET user_id = $1 
       WHERE name = 'Highlands at Satellite' 
       RETURNING id, name, user_id, status, deal_category`,
      [userId]
    );
    
    console.log('Updated:', res.rows);
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

fix();
