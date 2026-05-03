/**
 * Migration runner — applies every pending .sql file in the codebase's
 * migration directories to the live database.
 *
 * Background (Task #512):
 *   The previous version of this file had a hardcoded list of 5 filenames
 *   it would run and skipped everything else. That meant any newly added
 *   migration .sql file was silently ignored, and missing-column 500 errors
 *   (assumptions_hash, error_message) reached production. This runner now
 *   discovers and applies *all* unapplied migrations, sorted deterministically.
 *
 * Sources scanned (both kept for historical reasons):
 *   - backend/src/db/migrations/
 *   - backend/src/database/migrations/
 *
 * Tracking:
 *   `schema_migrations` is treated as a free-form ledger. The runner adapts
 *   to whichever column layout is already present:
 *     - Modern: schema_migrations(filename TEXT PK, executed_at TIMESTAMPTZ)
 *     - Legacy: schema_migrations(id, migration_number, migration_name,
 *               applied_at) — used by an older Python migration tool that
 *               populated this DB before the TS runner existed.
 *   Tracking keys are stored as the *basename* of the .sql file (no
 *   directory prefix) so the rows interop with the 76 already-tracked
 *   legacy entries.
 *
 *   Caveat: if the same basename ever appears in both migration dirs, only
 *   the first one applied is tracked. Today the only such overlaps are
 *   `20260502_assumptions_hash.sql` and `20260502_017_deal_financial_models_columns.sql`,
 *   both of which are pure `ADD COLUMN IF NOT EXISTS` and therefore safe
 *   to no-op the second time.
 *
 * Usage:
 *   - Standalone: `npm --prefix backend run migrate`
 *   - Programmatic (server startup): `await runPendingMigrations(pool, log)`
 *
 * Behaviour:
 *   Each migration runs inside its own transaction. A failure rolls that
 *   migration back, logs the error, and the runner continues to the next
 *   file. Callers can inspect the returned counts to decide whether to
 *   alert.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { Pool } from 'pg';

export interface MigrationResult {
  applied: string[];
  skipped: number;
  failed: Array<{ file: string; error: string }>;
}

interface MigrationFile {
  /** Tracking key written to schema_migrations — just the basename. */
  trackingKey: string;
  /** Display label for log lines (includes source dir for disambiguation). */
  label: string;
  /** Absolute path to the .sql file. */
  absPath: string;
}

const MIGRATION_DIRS: Array<{ ns: string; absDir: string }> = [
  { ns: 'db',       absDir: join(__dirname, '..', 'db', 'migrations') },
  { ns: 'database', absDir: join(__dirname, '..', 'database', 'migrations') },
];

function discoverMigrations(): MigrationFile[] {
  const out: MigrationFile[] = [];
  for (const { ns, absDir } of MIGRATION_DIRS) {
    if (!existsSync(absDir)) continue;
    const files = readdirSync(absDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      out.push({
        trackingKey: f,
        label:       `${ns}/${f}`,
        absPath:     join(absDir, f),
      });
    }
  }
  // Global sort by basename so files apply in date-prefix order regardless
  // of which directory they live in. Tie-break by full label for determinism
  // when the same basename exists in both dirs.
  out.sort((a, b) => {
    if (a.trackingKey !== b.trackingKey) return a.trackingKey < b.trackingKey ? -1 : 1;
    return a.label < b.label ? -1 : 1;
  });
  return out;
}

interface TableShape {
  /** Column we read/write the migration filename from. */
  keyCol:  string;
  /** Column we write the timestamp into (NULL means "don't write timestamp"). */
  timeCol: string | null;
  /**
   * Some legacy layouts (the Python tool's `id, migration_number,
   * migration_name, applied_at`) have an extra NOT NULL integer column.
   * If present, the runner allocates a fresh sequence value per insert.
   */
  numCol:  string | null;
}

/**
 * Detect (or create) the schema_migrations table and return which columns
 * to read/write. Adapts to the legacy Python-tool layout that some
 * deployments already have on disk.
 */
async function resolveTableShape(pool: Pool): Promise<TableShape> {
  const { rows } = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_name = 'schema_migrations'`,
  );
  const cols = new Set(rows.map((r: any) => String(r.column_name)));

  if (cols.size === 0) {
    // No table yet — create the modern shape.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    return { keyCol: 'filename', timeCol: 'executed_at', numCol: null };
  }

  // Pick whichever filename column already exists. Order matters: prefer
  // the modern 'filename' over older variants so a fresh DB ends up with
  // the canonical layout.
  const keyCandidates  = ['filename', 'migration_name', 'name'];
  const timeCandidates = ['executed_at', 'applied_at', 'created_at'];
  const numCandidates  = ['migration_number'];

  const keyCol  = keyCandidates.find((c) => cols.has(c));
  const timeCol = timeCandidates.find((c) => cols.has(c)) ?? null;
  const numCol  = numCandidates.find((c) => cols.has(c)) ?? null;

  if (!keyCol) {
    throw new Error(
      `schema_migrations exists but has no recognized filename column. ` +
      `Found columns: [${Array.from(cols).join(', ')}]. ` +
      `Expected one of: ${keyCandidates.join(', ')}.`,
    );
  }
  return { keyCol, timeCol, numCol };
}

/**
 * Allocator for the legacy `migration_number` column. Pre-loads MAX(num)+1
 * once and increments locally so we don't issue one MAX query per insert.
 * Falls back to 0 if the table is empty.
 */
async function makeNumberAllocator(
  pool: Pool,
  shape: TableShape,
): Promise<() => number> {
  if (!shape.numCol) return () => 0;
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX("${shape.numCol}"), 0) + 1 AS next FROM schema_migrations`,
  );
  let next = Number(rows[0]?.next ?? 1);
  return () => next++;
}

async function loadAppliedSet(
  pool: Pool,
  shape: TableShape,
): Promise<Set<string>> {
  const { rows } = await pool.query(
    `SELECT "${shape.keyCol}" AS k FROM schema_migrations`,
  );
  return new Set(rows.map((r: any) => String(r.k)));
}

/**
 * Build a parameterised INSERT for the resolved table shape, including the
 * legacy numeric column when present. Returns the SQL and a value-builder
 * given a tracking key. The value-builder pulls a fresh number from the
 * allocator, so callers must invoke it once per insert (not reuse).
 *
 * `mode` controls conflict handling — 'upsert' uses ON CONFLICT DO NOTHING
 * and requires a unique index on keyCol; 'insert' assumes the caller has
 * already checked for duplicates inside its transaction.
 */
function buildInsert(
  shape: TableShape,
  allocateNum: () => number,
  mode: 'upsert' | 'insert',
): (key: string) => { sql: string; params: any[] } {
  const cols:    string[] = [shape.keyCol];
  const placeholders: string[] = ['$1'];
  let p = 1;

  if (shape.numCol) {
    cols.push(shape.numCol);
    placeholders.push(`$${++p}`);
  }
  if (shape.timeCol) {
    cols.push(shape.timeCol);
    // NOW() is a server-side default — no parameter needed.
    placeholders.push('NOW()');
  }

  const conflict = mode === 'upsert'
    ? ` ON CONFLICT ("${shape.keyCol}") DO NOTHING`
    : '';
  const colsSql  = cols.map((c) => `"${c}"`).join(', ');
  const sqlBase  = `INSERT INTO schema_migrations (${colsSql}) VALUES (${placeholders.join(', ')})${conflict}`;

  return (key: string) => {
    const params: any[] = [key];
    if (shape.numCol) params.push(allocateNum());
    return { sql: sqlBase, params };
  };
}

export interface MigrationLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

const consoleLogger: MigrationLogger = {
  info:  (m) => console.log(`[migrate] ${m}`),
  warn:  (m) => console.warn(`[migrate] ${m}`),
  error: (m) => console.error(`[migrate] ${m}`),
};

/**
 * Apply every unapplied migration in lexical (date-prefix) order.
 * Idempotent: already-applied basenames in `schema_migrations` are skipped.
 */
/**
 * Advisory-lock key for serialising concurrent migration runners (e.g.
 * two replicas booting at once). Arbitrary 64-bit constant — collisions
 * are harmless beyond unrelated callers waiting on each other briefly.
 * `4951290512` = ascii "JediRe" hashed informally; chosen for log clarity.
 */
const MIGRATION_LOCK_KEY = 4951290512;

export async function runPendingMigrations(
  pool: Pool,
  log: MigrationLogger = consoleLogger,
): Promise<MigrationResult> {
  // Take a session-scoped advisory lock so only one runner mutates the
  // schema at a time. `pg_try_advisory_lock` returns immediately; if it
  // fails we wait on the blocking variant so this runner queues up rather
  // than skipping (skipping risks leaving startup ordering ambiguous).
  const lockClient = await pool.connect();
  let lockAcquired = false;
  try {
    const tryRes = await lockClient.query(
      'SELECT pg_try_advisory_lock($1) AS got',
      [MIGRATION_LOCK_KEY],
    );
    if (!tryRes.rows[0]?.got) {
      log.info('another runner is migrating — waiting for lock...');
      await lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    }
    lockAcquired = true;
    return await runPendingMigrationsLocked(pool, log);
  } finally {
    if (lockAcquired) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
      } catch { /* ignore */ }
    }
    lockClient.release();
  }
}

async function runPendingMigrationsLocked(
  pool: Pool,
  log: MigrationLogger,
): Promise<MigrationResult> {
  const shape       = await resolveTableShape(pool);
  const applied     = await loadAppliedSet(pool, shape);
  const all         = discoverMigrations();
  // Fail loudly if two migration files share the same basename across the
  // two migration directories. Tracking is by basename for interop with the
  // historical schema_migrations rows, so a collision would silently skip
  // one of the two — a real risk now that future migrations could land in
  // either folder. Better to refuse to start than to apply an ambiguous set.
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const m of all) {
    const prior = seen.get(m.trackingKey);
    if (prior) collisions.push(`${prior}  vs  ${m.label}`);
    else seen.set(m.trackingKey, m.label);
  }
  if (collisions.length > 0) {
    throw new Error(
      `Migration filename collisions detected (basename used in both dirs):\n  ` +
      collisions.join('\n  ') +
      `\nRename one of each pair so basenames are globally unique.`,
    );
  }
  const allocateNum = await makeNumberAllocator(pool, shape);

  const result: MigrationResult = { applied: [], skipped: 0, failed: [] };

  // Detect whether the key column itself has a unique/PK constraint. The
  // legacy Python-tool layout has a PK on `id`, not on `migration_name`,
  // so a blanket ON CONFLICT would fail. When the key column isn't unique,
  // we fall back to a select-then-insert under the same transaction.
  let useUpsert = false;
  try {
    const { rows } = await pool.query(
      `SELECT 1
         FROM pg_index i
         JOIN pg_attribute a
           ON a.attrelid = i.indrelid
          AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'schema_migrations'::regclass
          AND i.indisunique
          AND i.indnatts = 1
          AND a.attname = $1
        LIMIT 1`,
      [shape.keyCol],
    );
    useUpsert = rows.length > 0;
  } catch {
    useUpsert = false;
  }

  const buildOne = buildInsert(shape, allocateNum, useUpsert ? 'upsert' : 'insert');

  for (const m of all) {
    if (applied.has(m.trackingKey)) {
      result.skipped++;
      continue;
    }

    let sql: string;
    try {
      sql = readFileSync(m.absPath, 'utf8');
    } catch (err: any) {
      log.error(`Could not read ${m.label}: ${err.message}`);
      result.failed.push({ file: m.label, error: `read: ${err.message}` });
      continue;
    }

    log.info(`Running ${m.label}...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);

      if (useUpsert) {
        const ins = buildOne(m.trackingKey);
        await client.query(ins.sql, ins.params);
      } else {
        // Manual existence check for legacy tables whose key column has no
        // unique constraint (e.g. the Python-tool layout: PK on `id`, not
        // on `migration_name`).
        const exists = await client.query(
          `SELECT 1 FROM schema_migrations WHERE "${shape.keyCol}" = $1 LIMIT 1`,
          [m.trackingKey],
        );
        if (exists.rowCount === 0) {
          const ins = buildOne(m.trackingKey);
          await client.query(ins.sql, ins.params);
        }
      }

      await client.query('COMMIT');
      log.info(`✓ ${m.label}`);
      result.applied.push(m.label);
      applied.add(m.trackingKey);
    } catch (err: any) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      log.error(`✗ ${m.label}: ${err.message}`);
      result.failed.push({ file: m.label, error: err.message });
      // Continue — one bad migration should not stop the rest.
    } finally {
      client.release();
    }
  }

  if (result.applied.length === 0 && result.failed.length === 0) {
    log.info(`No pending migrations (${result.skipped} already applied).`);
  } else {
    log.info(
      `Done — applied ${result.applied.length}, ` +
      `skipped ${result.skipped}, failed ${result.failed.length}.`,
    );
  }
  return result;
}

// ── Schema sanity check ────────────────────────────────────────────────────
// Best-effort canary on a small set of columns that have caused production
// outages by being missing. Surfaces drift early so the operator sees a
// clear warning at startup instead of a 500 on the first request.

interface RequiredColumn {
  table:  string;
  column: string;
  reason: string;
}

const REQUIRED_COLUMNS: RequiredColumn[] = [
  { table: 'deal_financial_models', column: 'assumptions_hash',
    reason: 'F9 cache staleness check (Task #493 / #511)' },
  { table: 'deal_financial_models', column: 'error_message',
    reason: 'engine writes failure reason (Task #511)' },
];

export interface SchemaCheckResult {
  ok:      boolean;
  missing: Array<{ table: string; column: string; reason: string }>;
}

export async function verifyCriticalSchema(
  pool: Pool,
  log: MigrationLogger = consoleLogger,
): Promise<SchemaCheckResult> {
  const missing: SchemaCheckResult['missing'] = [];
  for (const req of REQUIRED_COLUMNS) {
    try {
      const { rows } = await pool.query(
        `SELECT 1
           FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
          LIMIT 1`,
        [req.table, req.column],
      );
      if (rows.length === 0) missing.push(req);
    } catch (err: any) {
      log.warn(`schema check failed for ${req.table}.${req.column}: ${err.message}`);
    }
  }
  if (missing.length > 0) {
    log.warn(`SCHEMA DRIFT — ${missing.length} required column(s) missing:`);
    for (const m of missing) {
      log.warn(`  • ${m.table}.${m.column}  (${m.reason})`);
    }
    log.warn('A migration file likely exists in the codebase but was not');
    log.warn('applied to this database. Run: npm --prefix backend run migrate');
  } else {
    log.info(`schema check OK (${REQUIRED_COLUMNS.length} required column(s) present).`);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Throws if any critical column is missing. Intended for callers that want
 * to fail-fast at startup rather than warn — keeps the warn path available
 * for development environments where a partial schema is sometimes desired.
 */
export async function assertCriticalSchema(
  pool: Pool,
  log: MigrationLogger = consoleLogger,
): Promise<void> {
  const r = await verifyCriticalSchema(pool, log);
  if (!r.ok) {
    const detail = r.missing.map((m) => `${m.table}.${m.column}`).join(', ');
    throw new Error(`schema drift detected — missing required column(s): ${detail}`);
  }
}

/**
 * Mark every discovered migration as applied WITHOUT running it. Used once
 * after deploying this framework to an existing database whose schema is
 * already correct (so the legacy SQL files — many of which contain bugs
 * like Supabase-only roles or ON CONFLICT on non-unique columns — don't
 * spam the startup log on every boot). After baselining, only newly-added
 * .sql files will be attempted.
 */
export async function baselineMigrations(
  pool: Pool,
  log: MigrationLogger = consoleLogger,
): Promise<{ recorded: number; alreadyApplied: number }> {
  const shape       = await resolveTableShape(pool);
  const applied     = await loadAppliedSet(pool, shape);
  const all         = discoverMigrations();
  const allocateNum = await makeNumberAllocator(pool, shape);
  const buildOne    = buildInsert(shape, allocateNum, 'insert');

  let recorded = 0;
  for (const m of all) {
    // Skip duplicates within the same baseline run too — the same basename
    // can appear in both migration directories (today: `20260502_*.sql`).
    if (applied.has(m.trackingKey)) continue;
    try {
      const ins = buildOne(m.trackingKey);
      await pool.query(ins.sql, ins.params);
      applied.add(m.trackingKey);
      recorded++;
    } catch (err: any) {
      log.warn(`baseline insert failed for ${m.trackingKey}: ${err.message}`);
    }
  }
  log.info(`Baseline recorded ${recorded} migration(s); ${applied.size} were already tracked.`);
  return { recorded, alreadyApplied: applied.size };
}

// ── CLI entry point ────────────────────────────────────────────────────────

/**
 * Build a Pool directly from env vars instead of going through
 * `database/connection.ts`. That module imports the winston-based shared
 * logger, which has occasionally failed to initialise in standalone
 * ts-node runs (winston.format.combine throwing). The CLI doesn't need
 * the shared logger — it has its own consoleLogger — so we skip that
 * dependency entirely to keep `npm run migrate` reliable.
 */
function buildStandalonePool(): import('pg').Pool {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg');
  const cfg: any = {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  if (process.env.DATABASE_URL) {
    cfg.connectionString = process.env.DATABASE_URL;
  } else {
    cfg.host     = process.env.DB_HOST || 'localhost';
    cfg.port     = parseInt(process.env.DB_PORT || '5432', 10);
    cfg.database = process.env.DB_NAME || 'jedire';
    cfg.user     = process.env.DB_USER || 'postgres';
    cfg.password = process.env.DB_PASSWORD;
  }
  return new Pool(cfg);
}

async function main() {
  const pool = buildStandalonePool();
  const isBaseline = process.argv.includes('--baseline');
  try {
    if (isBaseline) {
      await baselineMigrations(pool);
      // Baseline still uses the warn-only check: the operator is explicitly
      // saying "trust the current DB state", so drift here is informational.
      await verifyCriticalSchema(pool);
      return;
    }
    const res = await runPendingMigrations(pool);
    // Strict in CLI mode: exit non-zero if any migration failed OR if a
    // critical column is still missing afterwards. Lets CI use this as
    // a hard gate before deploying.
    await assertCriticalSchema(pool);
    if (res.failed.length > 0) process.exit(1);
  } finally {
    await pool.end().catch(() => { /* ignore */ });
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[migrate] Fatal:', err.message);
    process.exit(1);
  });
}
