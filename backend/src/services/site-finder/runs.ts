import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { SITE_COUNTIES, SiteCriteria, SiteRun } from '../../types/site-finder';
import { CatalogType } from './criteria';
import { discoverCounty, SOURCES } from './sources';
import { reviewParcel } from './review';
import { logger } from '../../utils/logger';

export async function siteCatalog(pool: Pool): Promise<CatalogType[]> {
  return (await pool.query('SELECT type_key,display_name,category FROM property_types WHERE enabled=true ORDER BY sort_order,display_name')).rows;
}
export class SiteFinderRuns {
  private initialized?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(private pool: Pool) {}
  async ensureReady() {
    if (!this.initialized) this.initialized = this.pool.query(`
      CREATE TABLE IF NOT EXISTS site_finder_runs (
        id uuid PRIMARY KEY, owner_id text NOT NULL,
        status text NOT NULL CHECK (status IN ('queued','running','complete','partial','error')),
        snapshot jsonb NOT NULL, lease_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS site_finder_runs_owner_created ON site_finder_runs(owner_id,created_at DESC);
      CREATE INDEX IF NOT EXISTS site_finder_runs_work ON site_finder_runs(status,updated_at) WHERE status IN ('queued','running');
    `).then(() => undefined).catch(e => { this.initialized = undefined; throw e; });
    await this.initialized;
    if (!this.timer) { this.timer = setInterval(() => void this.tick().catch(e => logger.error('Site Finder worker failed', { error: e.message })), 3000); this.timer.unref(); }
  }
  async get(id: string, owner: string): Promise<SiteRun | null> {
    await this.ensureReady();
    const r = await this.pool.query('SELECT snapshot FROM site_finder_runs WHERE id=$1 AND owner_id=$2', [id, owner]);
    return r.rows[0]?.snapshot || null;
  }
  async list(owner: string): Promise<SiteRun[]> {
    await this.ensureReady();
    return (await this.pool.query('SELECT snapshot FROM site_finder_runs WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 10', [owner])).rows.map(r => r.snapshot);
  }
  async create(owner: string, criteria: SiteCriteria): Promise<SiteRun> {
    await this.ensureReady();
    const now = new Date().toISOString();
    const run: SiteRun = { id: randomUUID(), criteria, status: 'queued', createdAt: now, updatedAt: now, results: [], warnings: ['Preliminary bounded screening, not an exhaustive inventory. Current property classification is not a zoning permission.'], sources: criteria.counties.map(county => ({ county, status: 'pending', sourceUrl: SOURCES[county].parcel, scanned: 0, matched: 0, limited: false, messages: [] })) };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`site-finder:${owner}`]);
      const active = await client.query("SELECT count(*)::int AS n FROM site_finder_runs WHERE owner_id=$1 AND status IN ('queued','running')", [owner]);
      if (active.rows[0].n >= 2) throw new Error('Two searches are already active. Wait for one to finish, then retry.');
      const recent = await client.query("SELECT count(*)::int AS n FROM site_finder_runs WHERE owner_id=$1 AND created_at > now()-interval '1 hour'", [owner]);
      if (recent.rows[0].n >= 20) throw new Error('Hourly search limit reached. Retry in an hour.');
      await client.query('INSERT INTO site_finder_runs(id,owner_id,status,snapshot) VALUES($1,$2,$3,$4)', [run.id,owner,run.status,JSON.stringify(run)]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    void this.tick().catch(e => logger.error('Site Finder worker failed', { error: e.message }));
    return run;
  }
  private async save(run: SiteRun, lease: string) {
    run.updatedAt = new Date().toISOString();
    const r = await this.pool.query('UPDATE site_finder_runs SET snapshot=$1,status=$2,updated_at=now() WHERE id=$3 AND lease_id=$4', [JSON.stringify(run),run.status,run.id,lease]);
    if (r.rowCount !== 1) throw new Error('Search lease lost; recovered worker owns this run.');
  }
  async updateReview(owner: string, id: string, key: string): Promise<SiteRun['results'][number]['review'] | null> {
    const run = await this.get(id,owner);
    const parcel = run?.results.find(p => p.key === key);
    if (!parcel) return null;
    const review = await reviewParcel(parcel, true);
    // Update exactly one parcel; do not overwrite progress from an in-flight run.
    await this.pool.query(`UPDATE site_finder_runs SET snapshot=jsonb_set(snapshot,ARRAY['results',(
      SELECT (ordinality-1)::text FROM jsonb_array_elements(snapshot->'results') WITH ORDINALITY p
      WHERE p.value->>'key'=$3 LIMIT 1
    )],$4::jsonb),updated_at=now() WHERE id=$1 AND owner_id=$2`, [id,owner,key,JSON.stringify({ ...parcel, review })]);
    return review;
  }
  private async tick() {
    if (this.busy) return;
    this.busy = true;
    const lease = randomUUID();
    try {
      // Cross-process lease; interrupted runs recover from stored snapshots, retaining completed counties.
      const claimed = await this.pool.query(`UPDATE site_finder_runs SET lease_id=$1,status='running',updated_at=now()
        WHERE id=(SELECT id FROM site_finder_runs WHERE status='queued' OR (status='running' AND updated_at < now()-interval '4 minutes')
          ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING snapshot`, [lease]);
      if (!claimed.rows.length) return;
      const run: SiteRun = claimed.rows[0].snapshot;
      run.status = 'running';
      const catalog = await siteCatalog(this.pool);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 150000);
      try {
        for (const county of run.criteria.counties) {
          const prior = run.sources.find(s => s.county === county)!;
          if (prior.finishedAt) continue;
          if (['partial','error'].includes(prior.status) || (prior.status === 'working' && prior.checkedAt && prior.messages.length && run.results.some(p => p.county === county))) {
            // On recovery, re-run an interrupted county from page zero and deduplicate.
            run.results = run.results.filter(p => p.county !== county);
          }
          await discoverCounty(county,run.criteria,catalog, async (parcels, health) => {
            for (const p of parcels) {
              p.review = await reviewParcel(p);
              if (!run.results.some(existing => existing.key === p.key)) run.results.push(p);
            }
            run.sources = run.sources.map(s => s.county === county ? health : s);
            await this.save(run,lease);
          },controller.signal);
        }
        const failed = run.sources.filter(s => s.status === 'error');
        run.status = failed.length === run.sources.length ? 'error' : run.sources.some(s => s.status === 'error' || s.status === 'partial' || s.limited) ||
          run.results.some(p => p.review.status === 'unverified') ? 'partial' : 'complete';
        if (run.criteria.intendedUse && run.results.some(p => p.review.status === 'unverified')) run.warnings.push('Use-permission checks are incomplete. Unverified leads are not permission matches.');
      } catch (e: any) { run.status = run.results.length ? 'partial' : 'error'; run.warnings.push(`Run interrupted: ${e.message}. Retry with narrower criteria.`); }
      finally { clearTimeout(timeout); }
      await this.save(run,lease);
    } finally { this.busy = false; }
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}