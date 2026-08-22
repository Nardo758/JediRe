/**
 * Sibling Sweep: Find all CHECK constraints with enum-like value lists
 * and diff them against canonical-keys.ts values.
 *
 * Run: cd backend && npx ts-node --transpile-only scripts/sibling-sweep-check-constraints.ts
 */

import { getPool } from '../src/database/connection';

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('=== Sibling Sweep: CHECK constraints with enum-like value lists ===\n');

    // Query all CHECK constraints whose definition contains IN (...) or = ANY (...)
    const res = await client.query(`
      SELECT
        conrelid::regclass AS table_name,
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'c'
        AND pg_get_constraintdef(oid) ~* 'IN\s*\(|=\s*ANY\s*\('
      ORDER BY conrelid::regclass::text, conname
    `);

    if (res.rows.length === 0) {
      console.log('No CHECK constraints with enum-like value lists found.');
      return;
    }

    console.log(`Found ${res.rows.length} candidate constraint(s):\n`);

    for (const row of res.rows) {
      console.log(`Table:    ${row.table_name}`);
      console.log(`Name:     ${row.constraint_name}`);
      console.log(`Def:      ${row.definition}`);

      // Extract the values from the IN (...) clause
      const inMatch = row.definition.match(/IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const values = inMatch[1]
          .split(',')
          .map((v: string) => v.trim().replace(/^'|'$/g, ''))
          .filter((v: string) => v.length > 0);
        console.log(`Values:   [${values.join(', ')}]`);

        // Flag if any value looks like a hyphenated variant (not underscore)
        const hyphenated = values.filter((v: string) => v.includes('-') && !v.includes('_'));
        if (hyphenated.length > 0) {
          console.log(`⚠️  HYPHENATED values (may be stale): ${hyphenated.join(', ')}`);
        }
      }

      console.log('');
    }

    console.log('=== Recommendations ===');
    console.log('1. Any table with hyphenated values when canonical-keys uses underscore:');
    console.log('   → Migration needed: drop old constraint, add new with canonical values.');
    console.log('2. Any table missing canonical values (e.g. lease_up):');
    console.log('   → Migration needed: expand constraint to include missing canonical value.');
    console.log('3. Any constraint whose value list does not match canonical-keys.ts:');
    console.log('   → Document the delta in the migration comment for future visibility.');

  } catch (err: any) {
    console.error('Sweep failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
