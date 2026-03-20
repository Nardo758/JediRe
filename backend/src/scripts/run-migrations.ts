/**
 * Database Migration Runner
 * Applies SQL migrations in order
 */

import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, '../db/migrations');

interface Migration {
  filename: string;
  number: number;
  sql: string;
}

async function runMigrations() {
  console.log('🔧 Database Migration Runner\n');

  // Connect to database
  const poolConfig: any = {};
  
  if (process.env.DATABASE_URL) {
    poolConfig.connectionString = process.env.DATABASE_URL;
  } else {
    poolConfig.host = process.env.DB_HOST || 'localhost';
    poolConfig.port = parseInt(process.env.DB_PORT || '5432');
    poolConfig.database = process.env.DB_NAME || 'jedire';
    poolConfig.user = process.env.DB_USER || 'postgres';
    poolConfig.password = process.env.DB_PASSWORD;
  }

  const pool = new Pool(poolConfig);

  try {
    // Test connection
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', testResult.rows[0].now);
    console.log('');

    // Create migrations tracking table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_number INTEGER UNIQUE NOT NULL,
        migration_name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get already applied migrations
    const appliedResult = await pool.query(
      'SELECT migration_number FROM schema_migrations ORDER BY migration_number'
    );
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.migration_number));

    console.log(`📊 Already applied: ${appliedMigrations.size} migrations\n`);

    // Read migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = files.map(filename => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(`Invalid migration filename: ${filename}`);
      }

      const number = parseInt(match[1]);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');

      return { filename, number, sql };
    });

    console.log(`📁 Found ${migrations.length} migration files\n`);

    // Apply pending migrations
    let appliedCount = 0;

    for (const migration of migrations) {
      if (appliedMigrations.has(migration.number)) {
        console.log(`⏭️  Skipping ${migration.filename} (already applied)`);
        continue;
      }

      console.log(`🔄 Applying ${migration.filename}...`);

      try {
        // Run migration in transaction
        await pool.query('BEGIN');
        await pool.query(migration.sql);
        await pool.query(
          'INSERT INTO schema_migrations (migration_number, migration_name) VALUES ($1, $2)',
          [migration.number, migration.filename]
        );
        await pool.query('COMMIT');

        console.log(`✅ Applied ${migration.filename}`);
        appliedCount++;
      } catch (error: any) {
        await pool.query('ROLLBACK');
        console.error(`❌ Failed to apply ${migration.filename}:`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('');
    if (appliedCount === 0) {
      console.log('✨ All migrations up to date!');
    } else {
      console.log(`✅ Successfully applied ${appliedCount} new migration(s)`);
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMigrations };
