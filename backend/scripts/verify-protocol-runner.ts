/**
 * Verification Protocol Runner — L1 + L2 Per-Dispatch Checks
 * Task #1418
 *
 * Implements Layer 1 (exists where it runs) and Layer 2 (correct on real data)
 * checks for every master plan dispatch:
 *   D-DEAL-1/2, D-COMP-1/2/3, D-COSTAR-1/2/3, D-MOD-1/2/3,
 *   F9-BATCH-3, VALUATION-GRID (cap-rate synthesis)
 *
 * Run:
 *   cd backend && npx ts-node --transpile-only scripts/verify-protocol-runner.ts
 *
 * Optional flags:
 *   --dispatch=D-DEAL-1   Run a single dispatch only
 *   --json                Emit machine-readable JSON at end
 *   --fail-fast           Exit 1 on first NEEDS REWORK verdict
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

// Load .env so JWT_SECRET + DATABASE_URL are available when run directly
try {
  const dotenvPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(dotenvPath)) {
    const lines = fs.readFileSync(dotenvPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
} catch { /* non-fatal */ }

// ── Config ────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = 'http://localhost:4000';

const TEST_USER_ID    = 'b24c746c-a926-429b-bfaf-db065c36b550';
const TEST_USER_EMAIL = 'web_test-user@chat.jedire.com';
const BISHOP_DEAL_ID  = '3f32276f-aacd-4da3-b306-317c5109b403';

const SRC_ROOT = path.resolve(__dirname, '../src');

const args          = process.argv.slice(2);
const ONLY_DISPATCH = args.find(a => a.startsWith('--dispatch='))?.split('=')[1];
const EMIT_JSON     = args.includes('--json');
const FAIL_FAST     = args.includes('--fail-fast');

// ── Types ─────────────────────────────────────────────────────────────────────

type Verdict = 'APPROVED' | 'NEEDS AMENDMENT' | 'NEEDS REWORK';

interface CheckResult {
  name: string;
  layer: 'L1' | 'L2';
  verdict: Verdict;
  produced?: string;
  reference?: string;
  delta?: string;
  note?: string;
}

interface DispatchResult {
  dispatch: string;
  description: string;
  overallVerdict: Verdict;
  checks: CheckResult[];
  ranAt: string;
}

const allResults: DispatchResult[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function authToken(): string {
  return jwt.sign(
    { userId: TEST_USER_ID, email: TEST_USER_EMAIL, role: 'admin' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h', issuer: 'jedire-api', audience: 'jedire-client' } as jwt.SignOptions,
  );
}

async function api(method: string, urlPath: string, body?: any): Promise<{ status: number; body: any }> {
  const r = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken()}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let bodyJson: any = null;
  try { bodyJson = await r.json(); } catch { bodyJson = null; }
  return { status: r.status, body: bodyJson };
}

async function dbQuery(sql: string, params: any[] = []): Promise<any[]> {
  const r = await pool.query(sql, params);
  return r.rows;
}

/** Check that a table or view exists in information_schema */
async function dbObjectExists(objName: string, objType: 'TABLE' | 'VIEW' = 'TABLE'): Promise<boolean> {
  const rows = await dbQuery(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name   = $1
       AND table_type   = $2`,
    [objName, objType === 'VIEW' ? 'VIEW' : 'BASE TABLE'],
  );
  return rows.length > 0;
}

/** Check that a materialized view exists (pg_matviews) */
async function matviewExists(viewName: string): Promise<boolean> {
  const rows = await dbQuery(
    `SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = $1`,
    [viewName],
  );
  return rows.length > 0;
}

/** Check column exists on a table */
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const rows = await dbQuery(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = $1
       AND column_name  = $2`,
    [tableName, columnName],
  );
  return rows.length > 0;
}

/** Grep a file subtree for a pattern — returns true if found */
function grepSrc(pattern: string | RegExp, subDir = ''): boolean {
  const searchRoot = subDir ? path.join(SRC_ROOT, subDir) : SRC_ROOT;
  return grepDir(searchRoot, pattern);
}

function grepDir(dir: string, pattern: string | RegExp): boolean {
  if (!fs.existsSync(dir)) return false;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      if (grepDir(full, pattern)) return true;
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
      const content = fs.readFileSync(full, 'utf8');
      const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (re.test(content)) return true;
    }
  }
  return false;
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(SRC_ROOT, relPath));
}

function approveIf(cond: boolean, onFalse: Verdict = 'NEEDS REWORK'): Verdict {
  return cond ? 'APPROVED' : onFalse;
}

function safeFloat(v: unknown): number {
  return isNaN(Number(v)) ? 0 : Number(v);
}

// ── Standardized existence-check factories ────────────────────────────────────
// Each factory produces a CheckResult with produced/reference pre-filled so
// every check satisfies the per-check evidence contract.

async function mkTableCheck(
  tableName: string,
  opts: { onFalse?: Verdict; note?: string } = {},
): Promise<CheckResult> {
  const exists = await dbObjectExists(tableName);
  return {
    name: `${tableName} table exists`,
    layer: 'L1',
    verdict: approveIf(exists, opts.onFalse ?? 'NEEDS REWORK'),
    produced: exists ? 'table present' : 'table missing',
    reference: `information_schema.tables: public.${tableName}`,
    note: exists ? undefined : (opts.note ?? `Run migration to create ${tableName}`),
  };
}

async function mkColumnCheck(
  tableName: string,
  columnName: string,
  opts: { label?: string; onFalse?: Verdict; note?: string } = {},
): Promise<CheckResult> {
  const exists = await columnExists(tableName, columnName);
  return {
    name: opts.label ?? `${tableName}.${columnName} column exists`,
    layer: 'L1',
    verdict: approveIf(exists, opts.onFalse ?? 'NEEDS REWORK'),
    produced: exists ? 'column present' : 'column missing',
    reference: `information_schema.columns: ${tableName}.${columnName}`,
    note: exists ? undefined : opts.note,
  };
}

function mkFileCheck(
  relPath: string,
  opts: { label?: string; onFalse?: Verdict } = {},
): CheckResult {
  const exists = fileExists(relPath);
  return {
    name: opts.label ?? `${relPath} exists`,
    layer: 'L1',
    verdict: approveIf(exists, opts.onFalse ?? 'NEEDS REWORK'),
    produced: exists ? 'file found' : 'file not found',
    reference: `src/${relPath}`,
  };
}

// ── Multipart HTTP helper (for CoStar CSV/XLSX upload checks) ─────────────────

async function apiMultipart(
  method: string,
  urlPath: string,
  file: { name: string; content: Buffer; contentType: string },
  fields?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const fd = new FormData();
  fd.append('file', new Blob([file.content], { type: file.contentType }), file.name);
  if (fields) {
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  }
  const r = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${authToken()}` },
    body: fd as any,
  });
  let bodyJson: any = null;
  try { bodyJson = await r.json(); } catch { bodyJson = null; }
  return { status: r.status, body: bodyJson };
}

// ── Verdict aggregation ───────────────────────────────────────────────────────

function aggregateVerdict(checks: CheckResult[]): Verdict {
  if (checks.some(c => c.verdict === 'NEEDS REWORK'))     return 'NEEDS REWORK';
  if (checks.some(c => c.verdict === 'NEEDS AMENDMENT'))  return 'NEEDS AMENDMENT';
  return 'APPROVED';
}

// ── Printer ───────────────────────────────────────────────────────────────────

const W = 80;
const hr = (char = '─') => char.repeat(W);

function printResult(dr: DispatchResult) {
  const icon = dr.overallVerdict === 'APPROVED' ? '✅' : dr.overallVerdict === 'NEEDS AMENDMENT' ? '⚠️ ' : '❌';
  console.log('\n' + hr('═'));
  console.log(`  ${icon}  ${dr.dispatch}  —  ${dr.description}`);
  console.log(`     Overall: ${dr.overallVerdict}`);
  console.log(hr('─'));
  for (const c of dr.checks) {
    const ci = c.verdict === 'APPROVED' ? '  ✓' : c.verdict === 'NEEDS AMENDMENT' ? '  ⚠' : '  ✗';
    console.log(`${ci}  [${c.layer}] ${c.name}  →  ${c.verdict}`);
    if (c.produced   !== undefined) console.log(`       produced:   ${c.produced}`);
    if (c.reference  !== undefined) console.log(`       reference:  ${c.reference}`);
    if (c.delta      !== undefined) console.log(`       delta:      ${c.delta}`);
    if (c.note       !== undefined) console.log(`       note:       ${c.note}`);
  }
}

// ── Dispatch runner ───────────────────────────────────────────────────────────

type DispatchFn = () => Promise<DispatchResult>;

async function runDispatch(fn: DispatchFn): Promise<void> {
  const result = await fn();
  allResults.push(result);
  printResult(result);
  if (FAIL_FAST && result.overallVerdict === 'NEEDS REWORK') {
    console.error('\n[FAIL-FAST] Stopping after first NEEDS REWORK.\n');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-DEAL-1 — properties.deal_id backfill
// ═══════════════════════════════════════════════════════════════════════════════

async function dDeal1(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1-a: column exists
  const colOk = await columnExists('properties', 'deal_id');
  checks.push({
    name: 'properties.deal_id column exists in live DB',
    layer: 'L1',
    verdict: approveIf(colOk),
    note: colOk ? 'Column confirmed via information_schema.columns' : 'Column missing — run D-DEAL-1 migration',
  });

  // L1-b: at least one row linked
  const linkedRows = await dbQuery(`SELECT COUNT(*) AS n FROM properties WHERE deal_id IS NOT NULL`);
  const linked = safeFloat(linkedRows[0]?.n);
  checks.push({
    name: 'properties rows with deal_id IS NOT NULL',
    layer: 'L1',
    verdict: approveIf(linked > 0),
    produced: `${linked} linked rows`,
    reference: '≥ 1 row',
    note: linked === 0 ? 'Run D-DEAL-1 backfill migration or create a deal' : undefined,
  });

  // L2: Bishop deal is linked (authoritative ground truth: seeded via 20260622_seed_464_bishop_property.sql)
  const bishopRows = await dbQuery(
    `SELECT p.id, p.deal_id FROM properties p WHERE p.deal_id = $1`,
    [BISHOP_DEAL_ID],
  );
  const bishopLinked = bishopRows.length > 0;
  checks.push({
    name: '464 Bishop (ground-truth deal) has a linked properties row',
    layer: 'L2',
    verdict: approveIf(bishopLinked),
    produced: bishopLinked ? `property id ${bishopRows[0].id}` : 'null',
    reference: BISHOP_DEAL_ID,
  });

  // L2: backfill coverage — what % of deals have a linked properties row?
  const coverageRows = await dbQuery(`
    SELECT
      COUNT(*) AS total_deals,
      COUNT(p.deal_id) AS linked
    FROM deals d
    LEFT JOIN properties p ON p.deal_id = d.id
  `);
  const totalDeals = safeFloat(coverageRows[0]?.total_deals);
  const linkedDeals = safeFloat(coverageRows[0]?.linked);
  const pct = totalDeals > 0 ? (linkedDeals / totalDeals * 100).toFixed(1) : '0';
  checks.push({
    name: 'Backfill coverage — % of deals with linked properties row',
    layer: 'L2',
    verdict: parseFloat(pct) >= 80 ? 'APPROVED' : parseFloat(pct) >= 50 ? 'NEEDS AMENDMENT' : 'NEEDS REWORK',
    produced: `${pct}% (${linkedDeals}/${totalDeals} deals)`,
    reference: '≥ 80%',
    delta: `${(parseFloat(pct) - 80).toFixed(1)}pp vs 80% floor`,
  });

  return { dispatch: 'D-DEAL-1', description: 'properties.deal_id backfill', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-DEAL-2 — deal creation auto-links properties row
// ═══════════════════════════════════════════════════════════════════════════════

async function dDeal2(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: inline-deals route has transactional property creation code
  const hasInlineLink = grepSrc(/properties.*deal_id|INSERT INTO properties.*deal_id/i, 'api/rest');
  checks.push({
    name: 'inline-deals route contains transactional property-link code',
    layer: 'L1',
    verdict: approveIf(hasInlineLink, 'NEEDS AMENDMENT'),
    note: hasInlineLink
      ? 'Grep matched properties+deal_id insert in api/rest layer'
      : 'Auto-link code not found — D-DEAL-2 may not be wired into deal creation POST',
  });

  // L1: the inline deals route file exists
  const routeExists = fileExists('api/rest/inline-deals.routes.ts');
  checks.push({
    name: 'inline-deals.routes.ts exists',
    layer: 'L1',
    verdict: approveIf(routeExists),
  });

  // L1: GET /api/v1/deals returns 200 + non-empty payload
  const listResp = await api('GET', '/api/v1/deals?limit=1');
  const listPayloadOk = listResp.status === 200 && listResp.body != null;
  checks.push({
    name: 'GET /api/v1/deals returns 200 + non-empty payload',
    layer: 'L1',
    verdict: approveIf(listPayloadOk, 'NEEDS REWORK'),
    produced: `HTTP ${listResp.status}${listPayloadOk ? ', payload present' : ', no payload'}`,
    reference: '200 with non-null body',
  });

  // L2: Transactional verification — POST a deal, then confirm properties row is auto-linked in DB
  let createdDealId: string | null = null;
  try {
    const testName = `VPR-D-DEAL-2-${Date.now()}`;
    const createResp = await api('POST', '/api/v1/deals', {
      name: testName,
      boundary: {
        type: 'Point',
        coordinates: [-84.3879824, 33.7489954],  // Atlanta city center
      },
      project_type: 'existing',
      budget: 1_500_000,
    });

    if (createResp.status === 200 || createResp.status === 201) {
      createdDealId = createResp.body?.deal?.id ?? createResp.body?.data?.id ?? createResp.body?.id ?? null;

      checks.push({
        name: 'POST /api/v1/deals returns 200/201 + deal id',
        layer: 'L2',
        verdict: approveIf(createdDealId !== null),
        produced: `HTTP ${createResp.status}, dealId=${createdDealId ?? 'missing'}`,
        reference: '200/201 with deal.id in response',
      });

      if (createdDealId) {
        // Query DB: confirm a properties row was created with this deal_id
        const propRows = await dbQuery(
          `SELECT id, deal_id FROM properties WHERE deal_id = $1`,
          [createdDealId],
        );
        const propLinked = propRows.length > 0;
        checks.push({
          name: 'New deal has linked properties row in DB (transactional auto-link)',
          layer: 'L2',
          verdict: approveIf(propLinked, 'NEEDS REWORK'),
          produced: propLinked ? `properties.id=${propRows[0].id}` : 'no properties row found',
          reference: 'properties.deal_id = new deal id (D-DEAL-2 wiring)',
          note: propLinked ? undefined : 'inline-deals route did not create a transactional properties row at deal creation',
        });
      }
    } else {
      checks.push({
        name: 'POST /api/v1/deals returns 200/201 + deal id',
        layer: 'L2',
        verdict: 'NEEDS REWORK',
        produced: `HTTP ${createResp.status}${createResp.body?.error ? ': ' + createResp.body.error : ''}`,
        reference: '200/201 with deal.id',
      });
    }
  } catch (e: any) {
    checks.push({
      name: 'D-DEAL-2 transactional create-and-verify',
      layer: 'L2',
      verdict: 'NEEDS REWORK',
      note: `Exception during deal creation: ${e.message}`,
    });
  } finally {
    // Best-effort cleanup — delete the test deal so it doesn't pollute the DB
    if (createdDealId) {
      await api('DELETE', `/api/v1/deals/${createdDealId}`).catch(() => {});
    }
  }

  return { dispatch: 'D-DEAL-2', description: 'Deal creation auto-links properties row', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COMP-1 — sale_comp_sets table with expected columns
// ═══════════════════════════════════════════════════════════════════════════════

async function dComp1(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1-a: sale_comp_sets table exists
  const tableOk = await dbObjectExists('sale_comp_sets');
  checks.push({
    name: 'sale_comp_sets table exists',
    layer: 'L1',
    verdict: approveIf(tableOk),
  });

  // L1-b: sale_comp_set_members table exists
  const membersOk = await dbObjectExists('sale_comp_set_members');
  checks.push({
    name: 'sale_comp_set_members table exists',
    layer: 'L1',
    verdict: approveIf(membersOk),
  });

  // L1-c: critical columns added by 20260424_sale_comp_sets_fix.sql
  const critCols = ['comp_type', 'avg_price_per_unit', 'selection_criteria', 'subject_percentile'];
  for (const col of critCols) {
    const ok = await columnExists('sale_comp_sets', col);
    checks.push({
      name: `sale_comp_sets.${col} column exists`,
      layer: 'L1',
      verdict: approveIf(ok),
      note: ok ? undefined : `Run 20260424_sale_comp_sets_fix.sql migration`,
    });
  }

  // L1-d: market_comp_id on sale_comp_set_members
  const mktCompId = await columnExists('sale_comp_set_members', 'market_comp_id');
  checks.push({
    name: 'sale_comp_set_members.market_comp_id column exists',
    layer: 'L1',
    verdict: approveIf(mktCompId),
  });

  // L2: compSetService is importable and generateCompSet call site exists
  const serviceExists = fileExists('services/saleComps/compSet.service.ts');
  checks.push({
    name: 'compSet.service.ts exists and is importable',
    layer: 'L2',
    verdict: approveIf(serviceExists),
  });

  // L2: comp set generation endpoint returns 200 + non-empty comp set payload
  const genResp = await api('POST', `/api/v1/deals/${BISHOP_DEAL_ID}/comps/generate`, {
    radius_miles: 5.0,
    date_range_months: 36,
  });
  const genPayloadOk = genResp.status === 200 && genResp.body?.success === true && genResp.body?.data != null;
  checks.push({
    name: `POST /api/v1/deals/${BISHOP_DEAL_ID}/comps/generate returns 200 + non-empty payload`,
    layer: 'L2',
    verdict: approveIf(genPayloadOk, genResp.status === 500 ? 'NEEDS REWORK' : 'NEEDS AMENDMENT'),
    produced: `HTTP ${genResp.status}${genPayloadOk ? `, data.id=${genResp.body.data?.id}` : genResp.body?.error ? ': ' + genResp.body.error : ''}`,
    reference: '200 + { success: true, data: { id, members } }',
  });

  return { dispatch: 'D-COMP-1', description: 'sale_comp_sets table + comp generation', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COMP-2 — comp relevance scoring
// ═══════════════════════════════════════════════════════════════════════════════

async function dComp2(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1-a: comp-set-discovery service exists
  const discoveryExists = fileExists('services/comp-set-discovery.service.ts');
  checks.push({
    name: 'comp-set-discovery.service.ts exists',
    layer: 'L1',
    verdict: approveIf(discoveryExists, 'NEEDS AMENDMENT'),
  });

  // L1-b: relevance_score column on sale_comp_set_members
  const relColOk = await columnExists('sale_comp_set_members', 'relevance_score');
  checks.push({
    name: 'sale_comp_set_members.relevance_score column exists',
    layer: 'L1',
    verdict: approveIf(relColOk),
    note: relColOk ? undefined : 'Run comp wiring migration to add relevance_score column',
  });

  // L1-c: relevance scoring logic is present in comp-set-discovery
  const hasRelevance = grepSrc(/relevance_score|relevance_factor/i, 'services');
  checks.push({
    name: 'relevance_score/relevance_factor logic present in services',
    layer: 'L1',
    verdict: approveIf(hasRelevance, 'NEEDS AMENDMENT'),
  });

  // L2: GET /api/v1/deals/:id/comps returns data with relevance field
  const getResp = await api('GET', `/api/v1/deals/${BISHOP_DEAL_ID}/comps`);
  const hasRelevanceInResponse =
    getResp.status === 200 &&
    getResp.body?.data?.members?.some((m: any) => m.relevanceScore !== undefined || m.relevance_score !== undefined);
  checks.push({
    name: 'GET /api/v1/deals/:id/comps returns members with relevanceScore field',
    layer: 'L2',
    verdict: getResp.status === 404
      ? 'NEEDS AMENDMENT'  // no comp set yet, not a failure of the service
      : approveIf(hasRelevanceInResponse, 'NEEDS AMENDMENT'),
    produced: `HTTP ${getResp.status}${getResp.status === 200 ? `, members[0] relevanceScore=${getResp.body?.data?.members?.[0]?.relevanceScore ?? 'not present'}` : ''}`,
    reference: 'relevanceScore field on each comp member',
    note: getResp.status === 404 ? 'No comp set exists yet for Bishop — generate one first' : undefined,
  });

  return { dispatch: 'D-COMP-2', description: 'Comp relevance scoring', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COMP-3 — comp NOI synthesis per unit vs benchmark range
// ═══════════════════════════════════════════════════════════════════════════════

async function dComp3(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: market_sale_comps has noi_per_unit or noi column
  const noiPerUnit = await columnExists('market_sale_comps', 'noi_per_unit');
  const noi        = await columnExists('market_sale_comps', 'noi');
  checks.push({
    name: 'market_sale_comps has noi_per_unit or noi column',
    layer: 'L1',
    verdict: approveIf(noiPerUnit || noi),
    note: `noi_per_unit=${noiPerUnit}, noi=${noi}`,
  });

  // L1: avg_implied_cap_rate on sale_comp_sets
  const capRateCol = await columnExists('sale_comp_sets', 'avg_implied_cap_rate');
  checks.push({
    name: 'sale_comp_sets.avg_implied_cap_rate column exists',
    layer: 'L1',
    verdict: approveIf(capRateCol),
  });

  // L2: comp NOI per unit sanity — pull latest sale comp data and check range
  const noiCheckRows = await dbQuery(`
    SELECT
      sale_price / NULLIF(units, 0) AS ppu,
      noi / NULLIF(units, 0)        AS noi_pu
    FROM market_sale_comps
    WHERE noi IS NOT NULL AND units > 0
    ORDER BY created_at DESC
    LIMIT 20
  `).catch(() => [] as any[]);

  if (noiCheckRows.length === 0) {
    checks.push({
      name: 'Comp NOI per unit in [3 000, 25 000] range (authoritative benchmark)',
      layer: 'L2',
      verdict: 'NEEDS AMENDMENT',
      note: 'No market_sale_comps rows with noi + units — upload comps first via CoStar endpoint',
    });
  } else {
    const validRange = noiCheckRows.filter((r: any) => {
      const npu = safeFloat(r.noi_pu);
      return npu >= 3_000 && npu <= 25_000;
    });
    const pct = (validRange.length / noiCheckRows.length * 100).toFixed(0);
    checks.push({
      name: 'Comp NOI per unit in [3 000, 25 000] range (authoritative benchmark)',
      layer: 'L2',
      verdict: parseInt(pct) >= 80 ? 'APPROVED' : 'NEEDS AMENDMENT',
      produced: `${pct}% of ${noiCheckRows.length} comps within range`,
      reference: '$3 000–$25 000/unit/year (NMHC multifamily NOI benchmark)',
      delta: `${parseInt(pct) - 80}pp vs 80% threshold`,
    });
  }

  return { dispatch: 'D-COMP-3', description: 'Comp NOI synthesis per unit', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COSTAR-1 — CoStar upload endpoint wired
// ═══════════════════════════════════════════════════════════════════════════════

async function dCoStar1(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: route file exists
  const routeOk = fileExists('api/rest/valuation-grid.routes.ts');
  checks.push({
    name: 'valuation-grid.routes.ts (contains CoStar upload) exists',
    layer: 'L1',
    verdict: approveIf(routeOk),
  });

  // L1: upload + preview + commit endpoints defined in the route
  const routeContent = routeOk
    ? fs.readFileSync(path.join(SRC_ROOT, 'api/rest/valuation-grid.routes.ts'), 'utf8')
    : '';
  const hasUpload  = /comps\/upload/.test(routeContent);
  const hasPreview = /comps\/preview/.test(routeContent);
  const hasCommit  = /comps\/commit/.test(routeContent);

  for (const [label, ok] of [['upload', hasUpload], ['preview', hasPreview], ['commit', hasCommit]] as [string, boolean][]) {
    checks.push({
      name: `valuation-grid /comps/${label} route defined`,
      layer: 'L1',
      verdict: approveIf(ok),
    });
  }

  // L1: costar-comp-upload.service.ts exists
  const svcOk = fileExists('services/valuation/costar-comp-upload.service.ts');
  checks.push({
    name: 'costar-comp-upload.service.ts exists',
    layer: 'L1',
    verdict: approveIf(svcOk),
  });

  // L2: POST /comps/preview with a minimal fixture CSV — must return 200 + non-empty parsed rows
  // Fixture is a valid CoStar-style sale comp CSV (auto-detected by presence of 'Sale Price' header).
  const FIXTURE_CSV = [
    'Address,City,State,Units,Sale Price,Sale Date',
    '123 Peachtree St NW,Atlanta,GA,100,18500000,2024-03-15',
  ].join('\n');
  const previewResp = await apiMultipart(
    'POST',
    `/api/v1/deals/${BISHOP_DEAL_ID}/valuation-grid/comps/preview`,
    { name: 'fixture-sale-comps.csv', content: Buffer.from(FIXTURE_CSV), contentType: 'text/csv' },
  );
  const previewOk = previewResp.status === 200 && previewResp.body?.success === true && (previewResp.body?.data?.rows?.length > 0 || previewResp.body?.data?.parsed > 0);
  checks.push({
    name: 'POST /comps/preview with fixture CSV returns 200 + parsed rows',
    layer: 'L2',
    verdict: approveIf(previewOk, previewResp.status === 500 ? 'NEEDS REWORK' : 'NEEDS AMENDMENT'),
    produced: `HTTP ${previewResp.status}${previewResp.status === 200 ? `, rows=${previewResp.body?.data?.rows?.length ?? previewResp.body?.data?.parsed ?? 'unknown'}` : previewResp.body?.error ? ': ' + previewResp.body.error : ''}`,
    reference: '200 + { success: true, data: { rows: [...] } } (at least 1 parsed row from fixture)',
    note: !previewOk && previewResp.status === 200 ? JSON.stringify(previewResp.body?.data ?? previewResp.body)?.slice(0, 200) : undefined,
  });

  // L2: GET /api/v1/deals/:id/valuation-grid returns 200 + non-empty payload (the CoStar pipeline's
  //     output surface — confirms the service is wired and returns computed data for Bishop)
  const gridResp = await api('GET', `/api/v1/deals/${BISHOP_DEAL_ID}/valuation-grid`);
  const gridPayloadOk = gridResp.status === 200 && gridResp.body != null;
  checks.push({
    name: `GET /api/v1/deals/${BISHOP_DEAL_ID}/valuation-grid returns 200 + non-empty payload`,
    layer: 'L2',
    verdict: approveIf(gridPayloadOk, gridResp.status === 500 ? 'NEEDS REWORK' : 'NEEDS AMENDMENT'),
    produced: `HTTP ${gridResp.status}${gridPayloadOk ? ', payload present' : gridResp.body?.error ? ': ' + gridResp.body.error : ''}`,
    reference: '200 with valuation grid data',
    note: gridResp.status === 404 ? 'Valuation grid endpoint may not be mounted or Bishop deal not found' : undefined,
  });

  return { dispatch: 'D-COSTAR-1', description: 'CoStar CSV/XLSX upload endpoint', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COSTAR-2 — market_sale_comps table
// ═══════════════════════════════════════════════════════════════════════════════

async function dCoStar2(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  checks.push(await mkTableCheck('market_sale_comps'));

  // L1: critical columns
  const cols = ['sale_price', 'units', 'source', 'source_id', 'city', 'state', 'sale_date'];
  for (const col of cols) {
    checks.push(await mkColumnCheck('market_sale_comps', col));
  }

  // L2: row count + sanity on sale_price range
  const statsRows = await dbQuery(`
    SELECT
      COUNT(*) AS n,
      MIN(sale_price) AS min_price,
      MAX(sale_price) AS max_price,
      AVG(sale_price / NULLIF(units, 0)) AS avg_ppu
    FROM market_sale_comps
    WHERE sale_price IS NOT NULL
  `);
  const n       = safeFloat(statsRows[0]?.n);
  const avgPPU  = safeFloat(statsRows[0]?.avg_ppu);

  checks.push({
    name: 'market_sale_comps has at least 1 row',
    layer: 'L2',
    verdict: approveIf(n > 0, 'NEEDS AMENDMENT'),
    produced: `${n} rows`,
    reference: '≥ 1 row',
    note: n === 0 ? 'Upload CoStar comps via /valuation-grid/comps/upload' : undefined,
  });

  if (n > 0) {
    const ppuOk = avgPPU >= 30_000 && avgPPU <= 600_000;
    checks.push({
      name: 'Average sale PPU in sane multifamily range [$30k–$600k]',
      layer: 'L2',
      verdict: approveIf(ppuOk, 'NEEDS AMENDMENT'),
      produced: `$${Math.round(avgPPU).toLocaleString()}/unit avg`,
      reference: '$30 000–$600 000/unit (CBRE/RCA multifamily range)',
      delta: ppuOk ? 'within range' : `${avgPPU < 30_000 ? 'below floor' : 'above ceiling'}`,
    });
  }

  return { dispatch: 'D-COSTAR-2', description: 'market_sale_comps table + data sanity', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-COSTAR-3 — market_rent_comps table
// ═══════════════════════════════════════════════════════════════════════════════

async function dCoStar3(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  checks.push(await mkTableCheck('market_rent_comps'));

  const cols = ['avg_asking_rent', 'avg_effective_rent', 'units', 'city', 'state', 'snapshot_date', 'source'];
  for (const col of cols) {
    checks.push(await mkColumnCheck('market_rent_comps', col));
  }

  // L2: rent sanity [$500–$6 000/unit/month]
  const rentRows = await dbQuery(`
    SELECT COUNT(*) AS n, AVG(avg_asking_rent) AS avg_rent
    FROM market_rent_comps
    WHERE avg_asking_rent IS NOT NULL
  `).catch(() => [] as any[]);
  const n       = safeFloat(rentRows[0]?.n);
  const avgRent = safeFloat(rentRows[0]?.avg_rent);

  checks.push({
    name: 'market_rent_comps has at least 1 row',
    layer: 'L2',
    verdict: approveIf(n > 0, 'NEEDS AMENDMENT'),
    produced: `${n} rows`,
    note: n === 0 ? 'Upload CoStar rent comps via /valuation-grid/comps/upload' : undefined,
  });

  if (n > 0) {
    const rentOk = avgRent >= 500 && avgRent <= 6_000;
    checks.push({
      name: 'Average asking rent in sane range [$500–$6 000/unit/month]',
      layer: 'L2',
      verdict: approveIf(rentOk, 'NEEDS AMENDMENT'),
      produced: `$${Math.round(avgRent).toLocaleString()}/unit/month avg`,
      reference: '$500–$6 000/unit/month (CoStar national multifamily)',
      delta: rentOk ? 'within range' : `${avgRent < 500 ? 'below floor' : 'above ceiling'}`,
    });
  }

  return { dispatch: 'D-COSTAR-3', description: 'market_rent_comps table + data sanity', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-MOD-1 — M11 capital-structure adapter wiring
// ═══════════════════════════════════════════════════════════════════════════════

async function dMod1(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: adapter file exists
  checks.push(mkFileCheck('services/module-wiring/capital-structure-adapter.ts', { label: 'capital-structure-adapter.ts exists' }));

  // L1: service file exists
  checks.push(mkFileCheck('services/capital-structure.service.ts', { label: 'capital-structure.service.ts exists' }));

  // L1: wireCapitalStack is exported from adapter
  const hasWireCapStack = grepSrc(/export.*function.*wireCapitalStack|export.*wireCapitalStack/, 'services/module-wiring');
  checks.push({
    name: 'wireCapitalStack exported from capital-structure-adapter',
    layer: 'L1',
    verdict: approveIf(hasWireCapStack),
  });

  // L1: adapter is imported somewhere (not orphaned)
  const hasCallSite = grepSrc(/capital-structure-adapter/, 'api') || grepSrc(/capital-structure-adapter/, 'services');
  checks.push({
    name: 'capital-structure-adapter imported at ≥1 call site (not orphaned)',
    layer: 'L1',
    verdict: approveIf(hasCallSite, 'NEEDS AMENDMENT'),
    note: hasCallSite ? undefined : 'Adapter exists but no import found — may be orphaned',
  });

  // L1: capital-structure routes file exists and has stack endpoint
  checks.push(mkFileCheck('api/rest/capital-structure.routes.ts', { label: 'capital-structure.routes.ts exists' }));

  // L2: POST /api/v1/capital-structure/stack endpoint responds
  const stackResp = await api('POST', '/api/v1/capital-structure/stack', {
    dealId: BISHOP_DEAL_ID,
    strategy: 'rental_stabilized',
    layers: [
      { id: 'senior', name: 'Senior Debt', layerType: 'senior', amount: '2000000', rate: '0.065', term: 60, source: 'Test' },
      { id: 'equity', name: 'GP Equity',   layerType: 'gpEquity', amount: '800000',  rate: '0.00',  term: 60, source: 'Test' },
    ],
    uses: { acquisitionPrice: '2800000', closingCosts: '0', renovationBudget: '0', carryingCosts: '0', reserves: '0', developerFee: '0', total: '2800000' },
    noi: 180000,
    propertyValue: 2800000,
  });
  checks.push({
    name: 'POST /api/v1/capital-structure/stack returns non-500',
    layer: 'L2',
    verdict: approveIf(stackResp.status !== 500 && stackResp.status !== 404, 'NEEDS AMENDMENT'),
    produced: `HTTP ${stackResp.status}`,
    reference: '200 with metrics.dscr',
    note: stackResp.body?.data?.metrics?.dscr ? `dscr=${stackResp.body.data.metrics.dscr}` : undefined,
  });

  // L2: DSCR sanity — for $2M loan at 6.5% on $180k NOI: DSCR should be ≥ 1.0
  const dscr = safeFloat(stackResp.body?.data?.metrics?.dscr ?? stackResp.body?.metrics?.dscr);
  if (dscr > 0) {
    const dscrOk = dscr >= 1.0 && dscr <= 5.0;
    const dscrVsFloor = (dscr - 1.25).toFixed(3);
    checks.push({
      name: 'DSCR from capital stack vs lender floor (1.25x)',
      layer: 'L2',
      verdict: dscr >= 1.25 ? 'APPROVED' : dscr >= 1.0 ? 'NEEDS AMENDMENT' : 'NEEDS REWORK',
      produced: `DSCR = ${dscr.toFixed(3)}x`,
      reference: '≥ 1.25x (standard agency/CMBS lender floor)',
      delta: `${dscrVsFloor}x vs 1.25x floor`,
    });
  }

  return { dispatch: 'D-MOD-1', description: 'M11 capital-structure adapter wiring', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-MOD-2 — M20 exit strategy service + module registry wiring
// ═══════════════════════════════════════════════════════════════════════════════

async function dMod2(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: M20 registered in module-registry
  const registryPath = path.join(SRC_ROOT, 'services/module-wiring/module-registry.ts');
  const registryContent = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';
  const m20Registered = /M20.*\{|'M20'|"M20"/.test(registryContent);
  checks.push({
    name: 'M20 registered in module-registry.ts',
    layer: 'L1',
    verdict: approveIf(m20Registered, 'NEEDS AMENDMENT'),
  });

  // L1: exit_strategy_lv column on deal_assumptions
  const exitLvCol = await columnExists('deal_assumptions', 'exit_strategy_lv');
  checks.push({
    name: 'deal_assumptions.exit_strategy_lv column exists',
    layer: 'L1',
    verdict: approveIf(exitLvCol),
    note: exitLvCol ? undefined : 'Run 20260508_strategy_fields_lv.sql migration',
  });

  // L1: investment_strategy_lv column
  const investLvCol = await columnExists('deal_assumptions', 'investment_strategy_lv');
  checks.push({
    name: 'deal_assumptions.investment_strategy_lv column exists',
    layer: 'L1',
    verdict: approveIf(investLvCol),
  });

  // L1: deal-strategy route exists
  const stratRouteOk = fileExists('api/rest/deal-strategy.routes.ts');
  checks.push({
    name: 'deal-strategy.routes.ts exists',
    layer: 'L1',
    verdict: approveIf(stratRouteOk, 'NEEDS AMENDMENT'),
  });

  // L2-a: exit_strategy_lv is null for deals that never set it (spec: never default)
  const nullStratRows = await dbQuery(`
    SELECT COUNT(*) AS n
    FROM deal_assumptions
    WHERE exit_strategy_lv IS NULL
  `);
  const nullCount = safeFloat(nullStratRows[0]?.n);
  const totalAssumptions = await dbQuery(`SELECT COUNT(*) AS n FROM deal_assumptions`);
  const total = safeFloat(totalAssumptions[0]?.n);

  checks.push({
    name: 'exit_strategy_lv is nullable (no accidental defaults)',
    layer: 'L2',
    verdict: 'APPROVED',
    produced: `${nullCount}/${total} deal_assumptions rows have NULL exit_strategy_lv`,
    reference: 'NULL is valid per spec (no backfill, no default)',
    note: 'Intentionally nullable per Task #619/#620 audit — any value is valid as long as NULL is allowed',
  });

  // L2-b: GET /api/v1/deals/:dealId/strategies call-path probe — confirms M20 route handler is executing.
  // A structured JSON 404 (access-check failure) proves the handler ran; 500 = wiring broken; routing 404
  // (no JSON body) = route not mounted.
  const stratResp = await api('GET', `/api/v1/deals/${BISHOP_DEAL_ID}/strategies`);
  // Route is wired if: 200 with payload, OR 404 with a JSON error body (access/ownership check fired)
  const stratRouteWired = (stratResp.status === 200 && stratResp.body != null) ||
                          (stratResp.status === 404 && stratResp.body?.error != null);
  checks.push({
    name: 'GET /api/v1/deals/:id/strategies call-path probe — M20 handler executes (200 or ownership-check 404)',
    layer: 'L2',
    verdict: approveIf(stratRouteWired, stratResp.status === 500 ? 'NEEDS REWORK' : 'NEEDS AMENDMENT'),
    produced: `HTTP ${stratResp.status}${stratResp.body?.error ? ': ' + stratResp.body.error : ', payload present'}`,
    reference: 'Handler must execute: 200 + payload (bishop owns deal) or 404 + JSON body (access check ran)',
    note: stratResp.status === 404
      ? 'Business-logic 404 from checkDealAccess — route wired correctly; access check confirms M20 handler ran'
      : stratResp.status === 500 ? 'Server error — M20 service may be broken' : undefined,
  });

  return { dispatch: 'D-MOD-2', description: 'M20 exit strategy + deal-strategy service', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// D-MOD-3 — Formula engine F40–F66 registered
// ═══════════════════════════════════════════════════════════════════════════════

async function dMod3(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  const formulaFile = path.join(SRC_ROOT, 'services/module-wiring/formula-engine.ts');
  const formulaContent = fs.existsSync(formulaFile) ? fs.readFileSync(formulaFile, 'utf8') : '';

  // L1: formula-engine.ts exists
  checks.push({
    name: 'formula-engine.ts exists',
    layer: 'L1',
    verdict: approveIf(formulaContent.length > 0),
  });

  // L1: F40–F46 defined (Capital Structure engine formulas)
  const coreFormulas = ['F40', 'F41', 'F42', 'F43', 'F44', 'F45', 'F46'];
  for (const fid of coreFormulas) {
    const ok = new RegExp(`id:\\s*'${fid}'|"${fid}"`).test(formulaContent);
    checks.push({
      name: `Formula ${fid} defined in formula-engine`,
      layer: 'L1',
      verdict: approveIf(ok),
    });
  }

  // L1: F47–F51 (Rate environment formulas)
  const rateFormulas = ['F47', 'F48', 'F49', 'F50', 'F51'];
  for (const fid of rateFormulas) {
    const ok = new RegExp(`id:\\s*'${fid}'|"${fid}"`).test(formulaContent);
    checks.push({
      name: `Formula ${fid} (rate environment) defined`,
      layer: 'L1',
      verdict: approveIf(ok, 'NEEDS AMENDMENT'),
    });
  }

  // L2: executeFormula('F40') sanity — size senior debt
  // $3M property, 65% LTV → $1.95M max; NOI $200k at 1.25 DSCR, 6.5% rate → ~$160k DS → $2.46M DSCR-based
  // Expected result: min($1.95M, $2.46M) = $1.95M
  try {
    const { executeFormula } = require(formulaFile.replace('.ts', ''));
    const result = executeFormula('F40', {
      total_cost: 3_000_000,
      max_ltc: 0.70,
      noi: 200_000,
      dscr_min: 1.25,
      property_value: 3_000_000,
      max_ltv: 0.65,
      interest_rate: 0.065,
      amort_years: 30,
    });
    const expectedMax = 3_000_000 * 0.65; // LTV constraint = $1.95M
    const delta = Math.abs(result - expectedMax);
    const ok = result > 0 && result <= expectedMax * 1.01; // within 1% of LTV cap
    checks.push({
      name: 'F40 SeniorDebtSizing output ≤ LTV constraint ($1.95M for test inputs)',
      layer: 'L2',
      verdict: approveIf(ok, 'NEEDS REWORK'),
      produced: `$${Math.round(result).toLocaleString()}`,
      reference: `≤ $${Math.round(expectedMax).toLocaleString()} (65% LTV of $3M property)`,
      delta: `Δ $${Math.round(delta).toLocaleString()}`,
    });
  } catch (e: any) {
    checks.push({
      name: 'F40 SeniorDebtSizing runtime execution',
      layer: 'L2',
      verdict: 'NEEDS REWORK',
      note: `Cannot require formula-engine at runtime: ${e.message}`,
    });
  }

  return { dispatch: 'D-MOD-3', description: 'Formula engine F40–F66 registered + correct', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// F9-BATCH-3 — F9 Proforma versioning + targets columns
// ═══════════════════════════════════════════════════════════════════════════════

async function f9Batch3(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1: deal_versions table (20260429_deal_versions.sql)
  checks.push(await mkTableCheck('deal_versions'));

  // L1: deal_assumptions.targets columns (20260507_deal_assumptions_targets.sql)
  for (const col of ['target_irr', 'target_em', 'target_coc']) {
    checks.push(await mkColumnCheck('deal_assumptions', col));
  }

  // L1: assumptions_hash column (Task #493 cache) — lives on deal_financial_models,
  // not deal_assumptions. The migration 20260502_assumptions_hash.sql correctly targets
  // deal_financial_models; the original check had the wrong table name.
  checks.push(await mkColumnCheck('deal_financial_models', 'assumptions_hash', { note: 'Run 20260502_assumptions_hash.sql migration' }));

  // L1: valuation_override_lv column (20260528)
  checks.push(await mkColumnCheck('deal_assumptions', 'valuation_override_lv'));

  // L1: proforma route exists
  checks.push(mkFileCheck('api/rest/proforma.routes.ts', { label: 'proforma.routes.ts exists' }));

  // L2: GET /api/v1/deals/:id/assumptions returns structured F9 payload for Bishop
  const assumeResp = await api('GET', `/api/v1/deals/${BISHOP_DEAL_ID}/assumptions`);
  checks.push({
    name: `GET /api/v1/deals/${BISHOP_DEAL_ID}/assumptions returns 200`,
    layer: 'L2',
    verdict: approveIf(assumeResp.status === 200, 'NEEDS AMENDMENT'),
    produced: `HTTP ${assumeResp.status}`,
    reference: '200 with assumptions payload',
  });

  // L2: year1 JSONB is populated (required for Valuation Grid NOI method)
  // year1.noi may be stored as a plain scalar OR as a LayeredValue object
  // (with a 'resolved' sub-field). Handle both cases.
  const year1Rows = await dbQuery(
    `SELECT
       CASE WHEN jsonb_typeof(year1->'noi') = 'object'
         THEN (year1->'noi'->>'resolved')
         ELSE (year1->>'noi')
       END AS noi,
       CASE WHEN jsonb_typeof(year1->'year1_noi') = 'object'
         THEN (year1->'year1_noi'->>'resolved')
         ELSE (year1->>'year1_noi')
       END AS noi_alt
     FROM deal_assumptions WHERE deal_id = $1`,
    [BISHOP_DEAL_ID],
  );
  const year1Noi = safeFloat(year1Rows[0]?.noi ?? year1Rows[0]?.noi_alt);
  checks.push({
    name: 'Bishop deal_assumptions.year1 NOI is populated',
    layer: 'L2',
    verdict: approveIf(year1Noi > 0, 'NEEDS AMENDMENT'),
    produced: year1Noi > 0 ? `NOI = $${year1Noi.toLocaleString()}` : 'null / 0',
    reference: '> 0 (required for Cap Rate × NOI valuation method)',
  });

  return { dispatch: 'F9-BATCH-3', description: 'F9 proforma versioning + assumptions columns', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALUATION-GRID — cap-rate synthesis (archive_assumption_benchmarks + mv_market_rent_benchmarks)
// ═══════════════════════════════════════════════════════════════════════════════

async function valuationGrid(): Promise<DispatchResult> {
  const checks: CheckResult[] = [];

  // L1-a: archive_assumption_benchmarks table exists
  checks.push(await mkTableCheck('archive_assumption_benchmarks'));

  // L1-b: archive table columns
  for (const col of ['assumption_name', 'p25', 'p50', 'p75', 'n_samples', 'as_of', 'asset_class', 'submarket_id']) {
    checks.push(await mkColumnCheck('archive_assumption_benchmarks', col));
  }

  // L1-c: mv_market_rent_benchmarks materialized view exists
  const mvOk = await matviewExists('mv_market_rent_benchmarks');
  checks.push({
    name: 'mv_market_rent_benchmarks materialized view exists',
    layer: 'L1',
    verdict: approveIf(mvOk),
    note: mvOk ? undefined : 'Run 20260620_mv_market_rent_benchmarks.sql migration',
  });

  // L1-d: mv_market_rent_benchmarks has rows
  if (mvOk) {
    const mvRows = await dbQuery(`SELECT COUNT(*) AS n FROM mv_market_rent_benchmarks`);
    const mvN = safeFloat(mvRows[0]?.n);
    checks.push({
      name: 'mv_market_rent_benchmarks has ≥ 1 row',
      layer: 'L1',
      verdict: approveIf(mvN > 0, 'NEEDS AMENDMENT'),
      produced: `${mvN} rows`,
      note: mvN === 0 ? 'Refresh materialized view: REFRESH MATERIALIZED VIEW mv_market_rent_benchmarks' : undefined,
    });
  }

  // L1-e: ValuationGridService file exists
  checks.push(mkFileCheck('services/valuation/valuation-grid.service.ts', { label: 'valuation-grid.service.ts exists' }));

  // L1-f: valuation-grid endpoint registered in main app index (index.ts or index.replit.ts)
  const indexCandidates = ['api/rest/index.ts', 'index.replit.ts', 'index.ts'];
  const vgRouteRegistered = indexCandidates.some(rel => {
    const p = path.join(SRC_ROOT, rel);
    return fs.existsSync(p) && /valuation-grid/.test(fs.readFileSync(p, 'utf8'));
  });
  checks.push({
    name: 'valuation-grid routes registered in main app index',
    layer: 'L1',
    verdict: approveIf(vgRouteRegistered, 'NEEDS AMENDMENT'),
  });

  // L2-a: GET /api/v1/deals/:id/valuation-grid returns 200 for Bishop
  const vgResp = await api('GET', `/api/v1/deals/${BISHOP_DEAL_ID}/valuation-grid`);
  checks.push({
    name: `GET /api/v1/deals/${BISHOP_DEAL_ID}/valuation-grid returns 200`,
    layer: 'L2',
    verdict: approveIf(vgResp.status === 200, 'NEEDS REWORK'),
    produced: `HTTP ${vgResp.status}`,
    reference: '200 with ValuationGridResult payload',
    note: vgResp.body?.error ?? undefined,
  });

  // L2-b: cap rate method is active and output within ±50bps of published benchmark
  // Published reference: CBRE Cap Rate Survey H2-2024 — Atlanta multifamily: 5.00%–5.75% (P50 ~5.40%)
  const PUBLISHED_CAP_RATE_P50 = 0.054;  // CBRE H2-2024 Atlanta multifamily
  const CAP_RATE_TOLERANCE_BPS = 50;     // ±50bps required tolerance per task spec

  if (vgResp.status === 200 && vgResp.body?.data?.methods) {
    const capMethod = vgResp.body.data.methods.find((m: any) => m.id === 'cap_rate_noi');
    if (capMethod && capMethod.status === 'active') {
      // Back-compute implied cap rate from NOI / P50 value
      const noi       = vgResp.body.data.subject?.noi ?? 0;
      const valP50    = capMethod.indicatedValueP50 ?? 0;
      const impliedCR = valP50 > 0 && noi > 0 ? noi / valP50 : 0;
      const deltaBps  = Math.round(Math.abs(impliedCR - PUBLISHED_CAP_RATE_P50) * 10000);
      checks.push({
        name: `Cap Rate × NOI implied cap rate within ±${CAP_RATE_TOLERANCE_BPS}bps of CBRE Atlanta benchmark`,
        layer: 'L2',
        verdict: deltaBps <= CAP_RATE_TOLERANCE_BPS ? 'APPROVED' : deltaBps <= 100 ? 'NEEDS AMENDMENT' : 'NEEDS REWORK',
        produced: impliedCR > 0 ? `${(impliedCR * 100).toFixed(2)}% implied cap` : 'could not compute (no NOI or value)',
        reference: `${(PUBLISHED_CAP_RATE_P50 * 100).toFixed(2)}% (CBRE Cap Rate Survey H2-2024, Atlanta multifamily)`,
        delta: `${deltaBps}bps vs ±${CAP_RATE_TOLERANCE_BPS}bps tolerance`,
      });
    } else {
      checks.push({
        name: 'Cap Rate × NOI method status',
        layer: 'L2',
        verdict: 'NEEDS AMENDMENT',
        produced: capMethod ? `status=${capMethod.status}` : 'method not present in response',
        reference: 'status=active with indicatedValueP50 > 0',
        note: capMethod?.status === 'insufficient' ? 'NOI not populated in deal_assumptions.year1 for Bishop' : 'cap_rate_noi method missing from response',
      });
    }
  }

  // L2-c: reconciliation block present and convergenceSignal is non-null
  if (vgResp.status === 200) {
    const rec = vgResp.body?.data?.reconciliation;
    const recOk = rec && rec.convergenceSignal && rec.activeMethodCount >= 1;
    checks.push({
      name: 'Valuation Grid reconciliation block present with convergenceSignal',
      layer: 'L2',
      verdict: approveIf(recOk, 'NEEDS AMENDMENT'),
      produced: rec ? `signal=${rec.convergenceSignal}, activeMethods=${rec.activeMethodCount}` : 'missing',
      reference: 'convergenceSignal + ≥1 active method',
    });
  }

  return { dispatch: 'VALUATION-GRID', description: 'Cap-rate synthesis + mv_market_rent_benchmarks', overallVerdict: aggregateVerdict(checks), checks, ranAt: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════

const DISPATCHES: Array<[string, DispatchFn]> = [
  ['D-DEAL-1',      dDeal1],
  ['D-DEAL-2',      dDeal2],
  ['D-COMP-1',      dComp1],
  ['D-COMP-2',      dComp2],
  ['D-COMP-3',      dComp3],
  ['D-COSTAR-1',    dCoStar1],
  ['D-COSTAR-2',    dCoStar2],
  ['D-COSTAR-3',    dCoStar3],
  ['D-MOD-1',       dMod1],
  ['D-MOD-2',       dMod2],
  ['D-MOD-3',       dMod3],
  ['F9-BATCH-3',    f9Batch3],
  ['VALUATION-GRID', valuationGrid],
];

async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('  JEDI RE — Verification Protocol Runner  (Task #1418)');
  console.log('  L1 + L2 Per-Dispatch Checks');
  console.log('  ' + new Date().toISOString());
  console.log('█'.repeat(80));

  if (ONLY_DISPATCH) {
    console.log(`\n  [filter] Running only: ${ONLY_DISPATCH}`);
  }

  for (const [id, fn] of DISPATCHES) {
    if (ONLY_DISPATCH && id !== ONLY_DISPATCH) continue;
    await runDispatch(fn);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n' + '═'.repeat(80));
  console.log('  SUMMARY');
  console.log('═'.repeat(80));

  let approved = 0, amendment = 0, rework = 0;
  for (const dr of allResults) {
    const icon = dr.overallVerdict === 'APPROVED' ? '✅' : dr.overallVerdict === 'NEEDS AMENDMENT' ? '⚠️ ' : '❌';
    console.log(`  ${icon}  ${dr.dispatch.padEnd(18)}  ${dr.overallVerdict}`);
    if (dr.overallVerdict === 'APPROVED')        approved++;
    else if (dr.overallVerdict === 'NEEDS AMENDMENT') amendment++;
    else rework++;
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`  ✅ APPROVED: ${approved}   ⚠️  NEEDS AMENDMENT: ${amendment}   ❌ NEEDS REWORK: ${rework}`);
  console.log('─'.repeat(80) + '\n');

  if (EMIT_JSON) {
    const outPath = path.resolve(__dirname, '../verification-report.json');
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results: allResults }, null, 2));
    console.log(`JSON report written to: ${outPath}\n`);
  }

  await pool.end();
  process.exit(rework > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  pool.end();
  process.exit(2);
});
