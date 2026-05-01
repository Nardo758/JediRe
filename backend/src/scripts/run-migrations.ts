/**
 * Run pending migrations (100 and 101) directly against the database.
 *
 * Usage: npx tsx backend/src/scripts/run-migrations.ts
 *
 * This can be called from the Replit shell or post-deploy hook.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { getPool } from '../database/connection';

async function run() {
  const pool = getPool();
  const migrationDir = join(__dirname, '..', 'database', 'migrations');

  // Read what's already been run
  const { rows: applied } = await pool.query(
    "SELECT filename FROM schema_migrations ORDER BY filename"
  );
  const appliedSet = new Set(applied.map((r: any) => r.filename));

  // Discover all .sql files sorted
  const files = readdirSync(migrationDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const base = basename(file, '.sql');
    // Only run migrations 100 and 101
    if (base !== '100_macro_anchor_observations' && base !== '101_proforma_line_item_anchors') continue;

    const sql = readFileSync(join(migrationDir, file), 'utf8');
    console.log(`[migrate] Running ${file}...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, executed_at) VALUES ($1, NOW())',
        [file]
      );
      await client.query('COMMIT');
      console.log(`[migrate] ✓ ${file}`);
      ran++;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }

  if (ran === 0) console.log('[migrate] No pending migrations to run.');
  await pool.end();
}

run().catch(err => {
  console.error('[migrate] Fatal:', err.message);
  process.exit(1);
});
