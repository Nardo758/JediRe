import { Pool } from 'pg';
import { SiteInstruction } from '../../types/site-finder';
import { SiteFinderRuns, siteCatalog } from './runs';
import { instructionFailure, summarizeCriteria, understandInstruction } from './instruction-agent';
import { logger } from '../../utils/logger';

export class InstructionRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Durable, owner-scoped instruction queue. Retried HTTP submissions never repeat model calls or searches. */
export class SiteFinderInstructions {
  private ready?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(private pool: Pool, private runs: SiteFinderRuns) {}

  async ensureReady() {
    if (!this.ready) this.ready = this.pool.query('SELECT id FROM site_finder_instructions LIMIT 0')
      .then(() => undefined).catch(e => { this.ready = undefined; throw e; });
    await this.ready;
    await this.runs.ensureReady();
    if (!this.timer) { this.timer = setInterval(() => void this.tick().catch(() => logger.warn('Site Finder instruction worker unavailable')), 2000); this.timer.unref(); }
  }

  async get(id: string, owner: string): Promise<SiteInstruction | null> {
    await this.ensureReady();
    const row = (await this.pool.query('SELECT snapshot FROM site_finder_instructions WHERE id=$1 AND owner_id=$2', [id, owner])).rows[0];
    return row?.snapshot ?? null;
  }
  async list(owner: string): Promise<SiteInstruction[]> {
    await this.ensureReady();
    return (await this.pool.query('SELECT snapshot FROM site_finder_instructions WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 10', [owner])).rows.map(row => row.snapshot);
  }

  async submit(owner: string, id: string, text: string, clarificationOf?: string): Promise<SiteInstruction> {
    await this.ensureReady();
    const client = await this.pool.connect();
    let submission: SiteInstruction;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`site-instruction:${owner}`]);
      const existing = (await client.query('SELECT snapshot FROM site_finder_instructions WHERE id=$1', [id])).rows[0];
      if (existing) {
        const owned = (await client.query('SELECT snapshot FROM site_finder_instructions WHERE id=$1 AND owner_id=$2', [id, owner])).rows[0];
        if (!owned || owned.snapshot.text !== text || owned.snapshot.clarificationOf !== clarificationOf) throw new InstructionRequestError(409, 'Submission ID already used. Start a new request.');
        await client.query('COMMIT');
        return owned.snapshot;
      }
      const counts = (await client.query(`SELECT
        count(*) FILTER (WHERE snapshot->>'status' IN ('queued','understanding'))::int AS active,
        count(*)::int AS recent FROM site_finder_instructions WHERE owner_id=$1 AND created_at > now()-interval '1 hour'`, [owner])).rows[0];
      if (counts.active >= 2 || counts.recent >= 20) throw new InstructionRequestError(429, 'Instruction limit reached. Wait for active requests or retry in an hour.');
      // Preflight parcel quotas before spending on the instruction agent.
      await this.runs.ensureReady();
      const runCounts = (await client.query(`SELECT count(*) FILTER (WHERE status IN ('queued','running'))::int AS active,
        count(*) FILTER (WHERE created_at > now()-interval '1 hour')::int AS recent FROM site_finder_runs WHERE owner_id=$1`, [owner])).rows[0];
      if (runCounts.active >= 2 || runCounts.recent >= 20) throw new InstructionRequestError(429, 'Search limit reached. Wait for active searches or retry in an hour.');
      let prior;
      if (clarificationOf) {
        const row = (await client.query('SELECT snapshot,prior FROM site_finder_instructions WHERE id=$1 AND owner_id=$2', [clarificationOf, owner])).rows[0];
        if (!row || row.snapshot.status !== 'clarification') throw new InstructionRequestError(404, 'Clarification request not found for this account.');
        prior = { text: row.prior ? `${row.prior.text}\nAnswer: ${row.snapshot.text}` : row.snapshot.text, message: row.snapshot.message };
        if (prior.text.length + text.length > 3000) throw new InstructionRequestError(422, 'Please restate the complete request in one instruction (up to 1,000 characters).');
      }
      submission = { id, text, ...(clarificationOf ? { clarificationOf } : {}), status: 'queued', message: 'Waiting for the instruction agent…' };
      await client.query('INSERT INTO site_finder_instructions(id,owner_id,snapshot,prior) VALUES($1,$2,$3,$4)', [id, owner, JSON.stringify(submission), prior ? JSON.stringify(prior) : null]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    void this.tick().catch(() => logger.warn('Site Finder instruction worker unavailable'));
    return submission!;
  }

  private async save(owner: string, submission: SiteInstruction) {
    await this.pool.query("UPDATE site_finder_instructions SET snapshot=$3,updated_at=now() WHERE id=$1 AND owner_id=$2 AND snapshot->>'status'='understanding'", [submission.id, owner, JSON.stringify(submission)]);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      // A crashed agent is never silently re-billed. Recover a created run, otherwise require an explicit retry.
      await this.pool.query(`UPDATE site_finder_instructions i SET snapshot =
        CASE WHEN r.id IS NOT NULL THEN i.snapshot || jsonb_build_object('status','searching','runId',r.id,'criteria',r.snapshot->'criteria','message','Search recovered.')
        ELSE i.snapshot || '{"status":"error","message":"Instruction processing was interrupted. No search was started. Retry your saved instructions."}'::jsonb END,
        updated_at=now() FROM (SELECT id FROM site_finder_instructions WHERE snapshot->>'status'='understanding'
        AND updated_at < now()-interval '3 minutes') stale
        LEFT JOIN site_finder_runs r ON r.id=stale.id WHERE i.id=stale.id AND (r.id IS NULL OR r.owner_id=i.owner_id)`);
      const row = (await this.pool.query(`UPDATE site_finder_instructions SET
        snapshot=snapshot || '{"status":"understanding","message":"Agent is understanding and validating your request…"}'::jsonb, updated_at=now()
        WHERE id=(SELECT id FROM site_finder_instructions WHERE snapshot->>'status'='queued'
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING snapshot,owner_id,prior`)).rows[0];
      if (!row) return;
      const submission: SiteInstruction = row.snapshot;
      try {
        let catalog;
        try { catalog = await siteCatalog(this.pool); } catch {
          submission.status = 'error'; submission.message = 'The live property catalog is unavailable. Ask an administrator to check the catalog/database, then retry. Your instructions are saved.';
          await this.save(row.owner_id, submission); return;
        }
        const output = await understandInstruction(row.owner_id, submission.text, catalog, row.prior);
        if (output.kind === 'clarification') {
          submission.status = 'clarification'; submission.message = output.message;
        } else {
          const run = await this.runs.create(row.owner_id, output.criteria, submission.id, true);
          submission.status = 'searching'; submission.runId = run.id; submission.criteria = run.criteria;
          submission.summary = summarizeCriteria(run.criteria); submission.message = 'Search started. Checking public parcel sources and zoning evidence.';
        }
      } catch (e) {
        submission.status = 'error';
        submission.message = /already active|limit reached/.test((e as Error).message) ? 'Search quota reached. Wait for active searches or retry in an hour. Your instructions are saved.' : instructionFailure(e);
      }
      await this.save(row.owner_id, submission);
    } finally { this.busy = false; }
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}