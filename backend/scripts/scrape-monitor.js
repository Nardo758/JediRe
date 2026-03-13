#!/usr/bin/env node
const { Pool } = require('pg');

const INTERVAL_MS = 30 * 60 * 1000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkStatus() {
  const ts = new Date().toISOString();
  try {
    const [jobs, units, topErrors] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='completed') as ok,
          COUNT(*) FILTER (WHERE status='failed')    as failed,
          COUNT(*) FILTER (WHERE status='running')   as in_progress,
          COUNT(*)                                    as total
        FROM rent_scrape_jobs
        WHERE started_at > NOW() - INTERVAL '24 hours'
      `),
      pool.query(`
        SELECT
          COUNT(id)::int               as units,
          COUNT(DISTINCT target_id)::int as properties,
          AVG(rent_amount)::int        as avg_rent,
          MIN(rent_amount)::int        as min_rent,
          MAX(rent_amount)::int        as max_rent
        FROM scraped_rents
        WHERE date_scraped = CURRENT_DATE
      `),
      pool.query(`
        SELECT error_message, COUNT(*) as cnt
        FROM rent_scrape_jobs
        WHERE status='failed' AND started_at > NOW() - INTERVAL '24 hours'
        GROUP BY error_message
        ORDER BY cnt DESC
        LIMIT 3
      `),
    ]);

    const j = jobs.rows[0];
    const u = units.rows[0];
    const pct = j.total > 0 ? ((+j.ok + +j.failed) / +j.total * 100).toFixed(1) : '0';

    console.log(`\n[${ts}] ── SCRAPE STATUS ──────────────────────`);
    console.log(`  Jobs : ${j.ok} ok  |  ${j.failed} failed  |  ${j.in_progress} running  |  ${j.total} total  (${pct}% done)`);
    console.log(`  Data : ${u.properties} properties  |  ${u.units} units  |  avg $${u.avg_rent}  |  range $${u.min_rent}–$${u.max_rent}`);
    if (topErrors.rows.length) {
      console.log('  Top errors:');
      topErrors.rows.forEach(r => console.log(`    x${r.cnt}  ${r.error_message?.substring(0, 90)}`));
    }
    console.log('──────────────────────────────────────────────');
  } catch (err) {
    console.error(`[${ts}] Monitor error:`, err.message);
  }
}

console.log(`[${new Date().toISOString()}] Scrape monitor started — checking every ${INTERVAL_MS / 60000} min`);
checkStatus();
setInterval(checkStatus, INTERVAL_MS);
