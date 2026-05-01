/**
 * Run pending migrations (100 and 101) directly against the database.
 *
 * Usage: npx tsx backend/src/scripts/run-migrations.ts
 *
 * Safe to run multiple times — creates the tracking table and
 * uses the same column name as stripe-replit-sync's runMigrations.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { getPool } from '../database/connection';

async function run() {
  const pool = getPool();
  const migrationDir = join(__dirname, '..', 'database', 'migrations');

  // Ensure tracking table exists (same schema as stripe-replit-sync)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Discover what's been applied — try 'filename' column first, fall back to 'name'
  let appliedFiles: string[] = [];
  try {
    const { rows } = await pool.query(
      "SELECT filename FROM schema_migrations ORDER BY filename"
    );
    appliedFiles = rows.map((r: any) => r.filename);
  } catch {
    // Column might be 'name' instead of 'filename'
    const { rows } = await pool.query(
      "SELECT name FROM schema_migrations ORDER BY name"
    );
    appliedFiles = rows.map((r: any) => r.name);
  }

  const appliedSet = new Set(appliedFiles);

  // Discover all .sql files sorted
  const files = readdirSync(migrationDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const base = basename(file, '.sql');
    // Only run the two new migrations
    if (base !== '100_macro_anchor_observations' && base !== '101_proforma_line_item_anchors') continue;

    const sql = readFileSync(join(migrationDir, file), 'utf8');
    console.log(`[migrate] Running ${file}...`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, executed_at) VALUES ($1, NOW()) ON CONFLICT (filename) DO NOTHING',
        [file]
      );
      await client.query('COMMIT');
      console.log(`[migrate] ✓ ${file}`);
      ran++;
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`[migrate] ✗ ${file}: ${err.message}`);
      // Don't rethrow — continue to next migration
    } finally {
      client.release();
    }
  }

  if (ran === 0) console.log('[migrate] No pending migrations to run.');
  else console.log(`[migrate] Applied ${ran} migration(s).`);
  await pool.end();
}

run().catch(err => {
  console.error('[migrate] Fatal:', err.message);
  process.exit(1);
});
