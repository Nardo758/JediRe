import pool from '../database/connection';

async function fixHighlandsUser() {
  try {
    console.log('🔧 Fixing Highlands at Satellite user_id...');
    
    // Get first user
    const userResult = await pool.query('SELECT id, email FROM users ORDER BY created_at LIMIT 1');
    
    if (userResult.rows.length === 0) {
      console.error('❌ No users found in database');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.email} (${user.id})`);
    
    // Update Highlands deal
    const updateResult = await pool.query(
      `UPDATE deals 
       SET user_id = $1
       WHERE name = 'Highlands at Satellite'
       RETURNING id, name, user_id, status, deal_category`,
      [user.id]
    );
    
    if (updateResult.rows.length === 0) {
      console.log('⚠️  Highlands deal not found or already has user_id');
    } else {
      const deal = updateResult.rows[0];
      console.log('✅ Updated Highlands deal:');
      console.log(`   ID: ${deal.id}`);
      console.log(`   Name: ${deal.name}`);
      console.log(`   User: ${deal.user_id}`);
      console.log(`   Status: ${deal.status}`);
      console.log(`   Category: ${deal.deal_category}`);
    }
    
    await pool.end();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixHighlandsUser();
