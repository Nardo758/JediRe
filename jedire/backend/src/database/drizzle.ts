import { drizzle } from 'drizzle-orm/node-postgres';
import { getPool } from './connection';
import * as schema from '../db/schema/dataPipeline';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const pool = getPool();
    _db = drizzle(pool, { schema });
  }
  return _db;
}
