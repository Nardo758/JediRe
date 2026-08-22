/**
 * W1-10 Fix: Relax check_project_type constraint to allow lease_up
 *
 * The DB CHECK constraint check_project_type currently blocks 'lease_up' / 'lease-up',
 * which prevents the epoch flag positive case from ever firing (Bishop is a lease-up deal).
 *
 * This script:
 *   1. Reads the current constraint definition
 *   2. Drops the old constraint
 *   3. Adds a new constraint allowing all canonical project types
 *
 * Safe: idempotent (drops only if exists, adds only if missing).
 *
 * Run in Replit: cd backend && npx ts-node --transpile-only scripts/fix-project-type-constraint.ts
 */

import { getPool } from '../src/database/connection';

const VALID_PROJECT_TYPES = [
  'existing',
  'stabilized',
  'value_add',
  'lease_up',
  'development',
  'redevelopment',
];

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('=== W1-10 Fix: check_project_type constraint ===\n');

    // 1. Show current constraint
    const currentRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'deals'::regclass AND conname = 'check_project_type'
    `);

    if (currentRes.rows.length === 0) {
      console.log('No check_project_type constraint found on deals table.');
    } else {
      console.log('Current constraint:');
      console.log(`  ${currentRes.rows[0].conname}: ${currentRes.rows[0].def}`);
    }

    // 2. Drop old constraint if exists
    console.log('\n→ Dropping old constraint (if exists)...');
    await client.query(`ALTER TABLE deals DROP CONSTRAINT IF EXISTS check_project_type`);
    console.log('  ✅ Dropped');

    // 3. Add new constraint with canonical values
    // Also allow NULL (deals may not have project_type set yet)
    const valuesList = VALID_PROJECT_TYPES.map(v => `'${v}'`).join(', ');
    const newConstraint = `project_type IS NULL OR project_type IN (${valuesList})`;

    console.log('\n→ Adding new constraint:');
    console.log(`  ${newConstraint}`);

    await client.query(`
      ALTER TABLE deals
      ADD CONSTRAINT check_project_type
      CHECK (${newConstraint})
    `);
    console.log('  ✅ Added');

    // 4. Verify
    const verifyRes = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'deals'::regclass AND conname = 'check_project_type'
    `);

    console.log('\n=== VERIFICATION ===');
    console.log(`  Constraint: ${verifyRes.rows[0].def}`);

    // 5. Test that lease_up is now accepted
    console.log('\n→ Testing lease_up acceptance on a dummy update (rolled back)...');
    await client.query('BEGIN');
    await client.query(`
      UPDATE deals SET project_type = 'lease_up'
      WHERE id = '3f32276f-aacd-4da3-b306-317c5109b403'
    `);
    await client.query('ROLLBACK');
    console.log('  ✅ lease_up accepted (rolled back)');

    console.log('\n=== W1-10 Fix COMPLETE ===');
    console.log('Re-run E4: cd backend && npx ts-node --transpile-only scripts/e4-w1-10-epoch-flag-live.ts');

    process.exit(0);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

main();
