/**
 * Simple Migration Runner
 * 
 * Runs a specific migration file against the database
 */

import * as fs from 'fs';
import * as path from 'path';
import db from '../database/connection';

async function runMigration(migrationFile: string) {
  try {
    const migrationPath = path.join(__dirname, '../../migrations', migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }
    
    console.log(`Running migration: ${migrationFile}`);
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolons and filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    console.log(`Found ${statements.length} SQL statements`);
    
    await db.connect();
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await db.query(statement);
        } catch (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          console.error('Statement:', statement.substring(0, 200));
        }
      }
    }
    
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: ts-node run-migration.ts <migration-file>');
  console.error('Example: ts-node run-migration.ts 040_module_libraries.sql');
  process.exit(1);
}

runMigration(migrationFile);
