/**
 * Check benchmark projects ingestion status
 */
import { getPool } from '../database/connection';

const db = getPool();

async function checkStatus() {
  console.log('📊 Checking benchmark projects status...\n');

  try {
    // Total count
    const totalResult = await db.query('SELECT COUNT(*) as total FROM benchmark_projects');
    const total = parseInt(totalResult.rows[0].total);
    console.log(`Total benchmark projects: ${total}\n`);

    if (total === 0) {
      console.log('⚠️  No benchmark projects found in database.');
      console.log('   Ingestion may have failed or not completed yet.\n');
      await db.end();
      return;
    }

    // By source
    const sourceResult = await db.query(`
      SELECT source, COUNT(*) as count
      FROM benchmark_projects
      GROUP BY source
      ORDER BY count DESC
    `);
    console.log('By source:');
    sourceResult.rows.forEach(row => {
      console.log(`  ${row.source}: ${row.count}`);
    });

    // By municipality
    const muniResult = await db.query(`
      SELECT municipality, state, COUNT(*) as count
      FROM benchmark_projects
      WHERE municipality IS NOT NULL
      GROUP BY municipality, state
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\nTop 10 municipalities:');
    muniResult.rows.forEach(row => {
      console.log(`  ${row.municipality}, ${row.state}: ${row.count}`);
    });

    // Recent additions
    const recentResult = await db.query(`
      SELECT 
        project_name,
        municipality,
        state,
        outcome,
        total_entitlement_days,
        created_at
      FROM benchmark_projects
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('\nMost recent 5 projects:');
    recentResult.rows.forEach(row => {
      console.log(`  ${row.project_name || 'Unknown'} - ${row.municipality}, ${row.state}`);
      console.log(`    Outcome: ${row.outcome || 'N/A'} | Timeline: ${row.total_entitlement_days || 'N/A'} days`);
      console.log(`    Added: ${row.created_at}`);
    });

    // Zoning district links
    const linkedResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE zoning_from_district_id IS NOT NULL) as from_linked,
        COUNT(*) FILTER (WHERE zoning_to_district_id IS NOT NULL) as to_linked,
        COUNT(*) FILTER (WHERE zoning_from_district_id IS NOT NULL AND zoning_to_district_id IS NOT NULL) as both_linked
      FROM benchmark_projects
    `);
    console.log('\nZoning district linkage:');
    console.log(`  From district linked: ${linkedResult.rows[0].from_linked}`);
    console.log(`  To district linked: ${linkedResult.rows[0].to_linked}`);
    console.log(`  Both linked: ${linkedResult.rows[0].both_linked}`);

    // Timeline data availability
    const timelineResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE total_entitlement_days IS NOT NULL AND total_entitlement_days > 0) as has_timeline,
        AVG(total_entitlement_days) FILTER (WHERE total_entitlement_days > 0) as avg_days
      FROM benchmark_projects
    `);
    console.log('\nTimeline data:');
    console.log(`  Projects with timeline: ${timelineResult.rows[0].has_timeline}`);
    console.log(`  Average entitlement days: ${Math.round(timelineResult.rows[0].avg_days || 0)}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

checkStatus().catch(console.error);
