/**
 * Intake Orchestrator Worker
 *
 * Polls intake_jobs WHERE state = 'pending' and advances each job through
 * the enrichment state machine:
 *   pending → parsing → enriching → complete | blocked_needs_user
 *
 * Each state transition appends a structured entry to enrichment_log.
 *
 * Enrichment chain (Phase 1 — stubs except other-docs step):
 *   (a) other-docs check: query data_library_files for matching parcel_id
 *   (b) municipal lookup: stub → not_implemented
 *   (c) web search:       stub → not_implemented
 *   (d) Google Places:    stub → not_implemented
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';

const POLL_INTERVAL_MS = parseInt(process.env.INTAKE_POLL_INTERVAL_MS || '30000', 10);
const BATCH_SIZE = parseInt(process.env.INTAKE_BATCH_SIZE || '20', 10);

export type IntakeJobState =
  | 'pending'
  | 'parsing'
  | 'enriching'
  | 'complete'
  | 'blocked_needs_user'
  | 'failed';

interface LogEntry {
  step: string;
  status: 'ok' | 'not_implemented' | 'blocked' | 'error';
  ts: string;
  detail?: Record<string, unknown>;
}

function ts(): string {
  return new Date().toISOString();
}

async function appendLog(jobId: string, entry: LogEntry): Promise<void> {
  await query(
    `UPDATE intake_jobs
     SET enrichment_log = enrichment_log || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify([entry]), jobId]
  );
}

async function setState(
  jobId: string,
  state: IntakeJobState,
  extra?: { block_reason?: string }
): Promise<void> {
  if (extra?.block_reason !== undefined) {
    await query(
      `UPDATE intake_jobs
       SET state = $1, block_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [state, extra.block_reason, jobId]
    );
  } else {
    await query(
      `UPDATE intake_jobs SET state = $1, updated_at = NOW() WHERE id = $2`,
      [state, jobId]
    );
  }
}

// ── Step (a): other-docs check ───────────────────────────────────────────────

async function stepOtherDocs(
  jobId: string,
  parcelId: string | null
): Promise<{ resolved: boolean; fileCount: number; docTypes: string[] }> {
  if (!parcelId) {
    await appendLog(jobId, {
      step: 'other_docs',
      status: 'blocked',
      ts: ts(),
      detail: { reason: 'no_parcel_id' },
    });
    return { resolved: false, fileCount: 0, docTypes: [] };
  }

  const res = await query<{ document_type: string; cnt: string }>(
    `SELECT document_type, COUNT(*)::text AS cnt
     FROM data_library_files
     WHERE LOWER(parcel_id) = LOWER($1)
     GROUP BY document_type`,
    [parcelId]
  );

  const fileCount = res.rows.reduce((sum, r) => sum + parseInt(r.cnt, 10), 0);
  const docTypes = res.rows.map((r) => r.document_type);

  await appendLog(jobId, {
    step: 'other_docs',
    status: fileCount > 0 ? 'ok' : 'blocked',
    ts: ts(),
    detail: { parcel_id: parcelId, file_count: fileCount, doc_types: docTypes },
  });

  return { resolved: fileCount > 0, fileCount, docTypes };
}

// ── Step (b): municipal lookup stub ─────────────────────────────────────────

async function stepMunicipalLookup(jobId: string): Promise<void> {
  await appendLog(jobId, {
    step: 'municipal_lookup',
    status: 'not_implemented',
    ts: ts(),
    detail: { note: 'Real municipal calls wired in Phase 2.2 (Task #988)' },
  });
}

// ── Step (c): web search stub ────────────────────────────────────────────────

async function stepWebSearch(jobId: string): Promise<void> {
  await appendLog(jobId, {
    step: 'web_search',
    status: 'not_implemented',
    ts: ts(),
    detail: { note: 'Real web search wired in Phase 7' },
  });
}

// ── Step (d): Google Places stub ─────────────────────────────────────────────

async function stepGooglePlaces(jobId: string): Promise<void> {
  await appendLog(jobId, {
    step: 'google_places',
    status: 'not_implemented',
    ts: ts(),
    detail: { note: 'Real Places calls wired in Phase 7' },
  });
}

// ── Main job processor ───────────────────────────────────────────────────────

async function processJob(job: {
  id: string;
  parcel_id: string | null;
}): Promise<void> {
  const { id, parcel_id } = job;

  try {
    // parsing: extract/normalize parcel_id if still missing
    await setState(id, 'parsing');
    await appendLog(id, {
      step: 'parsing',
      status: 'ok',
      ts: ts(),
      detail: { parcel_id: parcel_id ?? null },
    });

    // enriching: run chain
    await setState(id, 'enriching');

    const otherDocs = await stepOtherDocs(id, parcel_id);
    await stepMunicipalLookup(id);
    await stepWebSearch(id);
    await stepGooglePlaces(id);

    // completion logic: if other-docs found matching files, mark complete
    if (otherDocs.resolved) {
      await setState(id, 'complete');
      logger.debug(`[intake-worker] job ${id} → complete (${otherDocs.fileCount} matching docs)`);
    } else {
      await setState(id, 'blocked_needs_user', {
        block_reason: 'no_municipal_or_web_resolution_available',
      });
      logger.debug(`[intake-worker] job ${id} → blocked_needs_user`);
    }
  } catch (err: any) {
    logger.error(`[intake-worker] job ${id} failed`, { error: err.message });
    try {
      await setState(id, 'failed', { block_reason: err.message });
      await appendLog(id, {
        step: 'worker_error',
        status: 'error',
        ts: ts(),
        detail: { error: err.message },
      });
    } catch (_) {}
  }
}

// ── Worker loop ──────────────────────────────────────────────────────────────

let running = false;

async function poll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const res = await query<{ id: string; parcel_id: string | null }>(
      `SELECT id, parcel_id
       FROM intake_jobs
       WHERE state = 'pending'
       ORDER BY created_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (res.rows.length > 0) {
      logger.info(`[intake-worker] processing ${res.rows.length} pending jobs`);
      for (const job of res.rows) {
        await processJob(job);
      }
    }
  } catch (err: any) {
    logger.error('[intake-worker] poll error', { error: err.message });
  } finally {
    running = false;
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startIntakeWorker(): void {
  if (intervalHandle) return;
  logger.info(`[intake-worker] starting — poll interval ${POLL_INTERVAL_MS}ms, batch size ${BATCH_SIZE}`);
  // Run immediately on start, then on interval
  poll().catch((err) => logger.error('[intake-worker] initial poll error', { error: err.message }));
  intervalHandle = setInterval(() => {
    poll().catch((err) => logger.error('[intake-worker] interval poll error', { error: err.message }));
  }, POLL_INTERVAL_MS);
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
}

export function stopIntakeWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[intake-worker] stopped');
  }
}
