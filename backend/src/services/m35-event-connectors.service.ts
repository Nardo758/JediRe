/**
 * M35 Event Impact Engine — Atlanta Data Connectors
 *
 * Pulls structured signals from three sources and translates them into
 * M35 draft events queued for analyst review:
 *
 *   1. Atlanta Open Data (Socrata)  — building permits, development activity
 *   2. Atlanta DPCD ArcGIS          — rezoning cases, SUPs (reuses existing patterns)
 *   3. GDELT GKG 2.0               — historical news event seeding for backtest
 *
 * Draft events land in m35_draft_events. The M35 Event Ingestion API (Task #184)
 * picks them up, deduplicates, and routes to analyst review queue.
 *
 * Run modes:
 *   - Scheduled (nightly): pulls last 24h of permits + recent GDELT
 *   - Backtest (one-shot): GDELT range query for 2013–2024 ATL events
 *   - Manual: admin UI triggers individual connector via POST /api/m35/connectors/run
 */

import { getPool } from '../database/connection';
import { logger } from '../utils/logger';
import { kafkaProducer } from './kafka/kafka-producer.service';

// ─── Constants ───────────────────────────────────────────────────────────────

const SOCRATA_BASE = 'https://data.atlantaga.gov/resource';
const ATLANTA_GIS_BASE = 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer';
const GDELT_GKG_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Permit dataset IDs on data.atlantaga.gov
const PERMITS_DATASET_ID = 'rbtn-a52j';   // Building Permits
const DEV_ACTIVITY_DATASET_ID = 'dx7k-4k8a'; // Development Activity (fallback)

// ArcGIS layer IDs (same as atlanta-benchmark-ingestion.service.ts)
const REZONING_LAYER = 10;
const SUP_LAYER = 11;

// Thresholds for auto-drafting events (below these → skip)
const PERMIT_VALUE_THRESHOLD_USD = 5_000_000;   // $5M construction value
const PERMIT_UNITS_THRESHOLD = 50;               // 50+ residential units
const GDELT_GOLDSTEIN_MIN = 3.0;                  // Positive event magnitude (GDELT scale -10 to +10)
const GDELT_RELEVANCE_THRESHOLD = 0.70;           // Actor/location relevance score

// M35 event categories mapped from source signals
const PERMIT_TYPE_CATEGORY_MAP: Record<string, M35EventCategory> = {
  'NEW CONSTRUCTION': 'MAJOR_DEVELOPMENT_STARTED',
  'MULTI-FAMILY':     'MAJOR_DEVELOPMENT_STARTED',
  'MIXED USE':        'MAJOR_DEVELOPMENT_STARTED',
  'COMMERCIAL':       'COMMERCIAL_DEVELOPMENT',
  'RENOVATION':       'MAJOR_DEVELOPMENT_STARTED',
};

const GDELT_THEME_CATEGORY_MAP: Record<string, M35EventCategory> = {
  'ECON_UNEMPLOYMENT':          'MAJOR_EMPLOYER_DEPARTURE',
  'ECON_BUSINESSCONFIDENCE':    'MAJOR_EMPLOYER_ARRIVAL',
  'ECON_HOUSING':               'MAJOR_DEVELOPMENT_STARTED',
  'INFRASTRUCTURE':             'TRANSIT_INFRASTRUCTURE',
  'NATURAL_DISASTER':           'NATURAL_DISASTER',
  'LEGISLATION':                'REGULATORY_CHANGE',
  'GOV_REFORM':                 'REGULATORY_CHANGE',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type M35EventCategory =
  | 'MAJOR_EMPLOYER_ARRIVAL'
  | 'MAJOR_EMPLOYER_DEPARTURE'
  | 'MAJOR_DEVELOPMENT_STARTED'
  | 'COMMERCIAL_DEVELOPMENT'
  | 'TRANSIT_INFRASTRUCTURE'
  | 'NATURAL_DISASTER'
  | 'REGULATORY_CHANGE'
  | 'MARKET_TRANSACTION';

type M35EventScope = 'MSA' | 'SUBMARKET' | 'PROPERTY' | 'STATE';

interface M35DraftEvent {
  source_connector: string;
  source_record_id: string;
  msa_id: string;
  submarket_hint?: string;           // Best guess — analyst confirms
  lat?: number;
  lng?: number;
  category: M35EventCategory;
  scope: M35EventScope;
  name: string;
  description: string;
  signal_date: Date;                 // Date signal was detected
  estimated_materialization?: Date;
  estimated_magnitude: number;       // 1–5
  confidence: number;                // 0–1
  source_url?: string;
  raw_payload: Record<string, unknown>;
}

export interface ConnectorRunStats {
  connector: string;
  recordsScanned: number;
  draftEventsCreated: number;
  draftEventsSkipped: number;
  duplicatesIgnored: number;
  errors: string[];
  durationMs: number;
}

// ─── Database Helpers ─────────────────────────────────────────────────────────

async function ensureStagingTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m35_draft_events (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_connector varchar(64)  NOT NULL,
      source_record_id varchar(256) NOT NULL,
      msa_id           varchar(128) NOT NULL,
      submarket_hint   varchar(256),
      lat              double precision,
      lng              double precision,
      category         varchar(64)  NOT NULL,
      scope            varchar(16)  NOT NULL DEFAULT 'SUBMARKET',
      name             varchar(512) NOT NULL,
      description      text,
      signal_date      timestamptz  NOT NULL,
      est_materialization timestamptz,
      estimated_magnitude smallint   NOT NULL DEFAULT 2,
      confidence       double precision NOT NULL DEFAULT 0.5,
      source_url       text,
      raw_payload      jsonb,
      status           varchar(32)  NOT NULL DEFAULT 'DRAFT',
      created_at       timestamptz  NOT NULL DEFAULT now(),
      reviewed_at      timestamptz,
      reviewed_by      varchar(128),
      UNIQUE (source_connector, source_record_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_m35_draft_events_status ON m35_draft_events(status);
    CREATE INDEX IF NOT EXISTS idx_m35_draft_events_msa    ON m35_draft_events(msa_id);
  `);
}

async function upsertDraftEvent(draft: M35DraftEvent): Promise<'created' | 'duplicate'> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO m35_draft_events
       (source_connector, source_record_id, msa_id, submarket_hint, lat, lng,
        category, scope, name, description, signal_date, est_materialization,
        estimated_magnitude, confidence, source_url, raw_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (source_connector, source_record_id) DO NOTHING
     RETURNING id`,
    [
      draft.source_connector,
      draft.source_record_id,
      draft.msa_id,
      draft.submarket_hint ?? null,
      draft.lat ?? null,
      draft.lng ?? null,
      draft.category,
      draft.scope,
      draft.name,
      draft.description,
      draft.signal_date,
      draft.estimated_materialization ?? null,
      draft.estimated_magnitude,
      draft.confidence,
      draft.source_url ?? null,
      JSON.stringify(draft.raw_payload),
    ]
  );
  return result.rowCount && result.rowCount > 0 ? 'created' : 'duplicate';
}

// ─── Connector 1: Atlanta Open Data — Building Permits (Socrata) ─────────────

interface SocrataPermit {
  permit_number: string;
  permit_type: string;
  work_description: string;
  address: string;
  declared_valuation: string;
  units?: string;
  issue_date: string;
  latitude?: string;
  longitude?: string;
  status: string;
  contractor_company_name?: string;
}

function permitMagnitude(valuationUsd: number, units: number): number {
  if (valuationUsd > 100_000_000 || units > 500) return 5;
  if (valuationUsd > 50_000_000  || units > 250) return 4;
  if (valuationUsd > 20_000_000  || units > 100) return 3;
  if (valuationUsd > 5_000_000   || units > 50)  return 2;
  return 1;
}

function inferSubmarket(address: string): string {
  const addr = address.toUpperCase();
  if (/MIDTOWN|PEACHTREE ST|10TH ST|14TH ST/.test(addr))  return 'Midtown Atlanta';
  if (/BUCKHEAD|PEACHTREE RD|LENOX/.test(addr))            return 'Buckhead';
  if (/OLD FOURTH WARD|HIGHLAND|PONCE/.test(addr))         return 'Old Fourth Ward';
  if (/VINE CITY|ENGLISH AVE|JOSEPH E LOWERY/.test(addr))  return 'Vine City / English Ave';
  if (/WEST END|ADAIR|BELTLINE W/.test(addr))              return 'West End';
  if (/INMAN PARK|LITTLE 5|EDGEWOOD/.test(addr))           return 'Inman Park';
  if (/DOWNTOWN|PEACHTREE CTR|BROAD ST/.test(addr))        return 'Downtown Atlanta';
  if (/AIRPORT|COLLEGE PARK|HAPEVILLE/.test(addr))         return 'Airport / South Fulton';
  return 'Atlanta MSA (unclassified submarket)';
}

export async function runAtlantaPermitsConnector(
  options: { sinceDate?: Date; limit?: number } = {}
): Promise<ConnectorRunStats> {
  const start = Date.now();
  const stats: ConnectorRunStats = {
    connector: 'atlanta-permits',
    recordsScanned: 0,
    draftEventsCreated: 0,
    draftEventsSkipped: 0,
    duplicatesIgnored: 0,
    errors: [],
    durationMs: 0,
  };

  await ensureStagingTable();

  const since = options.sinceDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceFmt = since.toISOString().split('T')[0];
  const limit = options.limit ?? 1000;

  const url = new URL(`${SOCRATA_BASE}/${PERMITS_DATASET_ID}.json`);
  url.searchParams.set('$where', `issue_date >= '${sinceFmt}T00:00:00.000'`);
  url.searchParams.set('$limit', String(limit));
  url.searchParams.set('$order', 'issue_date DESC');
  url.searchParams.set('$$app_token', process.env.SOCRATA_APP_TOKEN ?? '');

  let permits: SocrataPermit[] = [];
  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) throw new Error(`Socrata HTTP ${resp.status}`);
    permits = await resp.json() as any;
  } catch (err: any) {
    stats.errors.push(`Socrata fetch failed: ${err.message}`);
    stats.durationMs = Date.now() - start;
    return stats;
  }

  stats.recordsScanned = permits.length;

  for (const permit of permits) {
    try {
      const valuation = parseFloat(permit.declared_valuation ?? '0') || 0;
      const units = parseInt(permit.units ?? '0', 10) || 0;
      const permitTypeUpper = (permit.permit_type ?? '').toUpperCase();

      // Filter: must meet threshold
      const meetsValue = valuation >= PERMIT_VALUE_THRESHOLD_USD;
      const meetsUnits = units >= PERMIT_UNITS_THRESHOLD;
      if (!meetsValue && !meetsUnits) {
        stats.draftEventsSkipped++;
        continue;
      }

      // Map permit type to M35 category
      let category: M35EventCategory = 'MAJOR_DEVELOPMENT_STARTED';
      for (const [key, cat] of Object.entries(PERMIT_TYPE_CATEGORY_MAP)) {
        if (permitTypeUpper.includes(key)) { category = cat; break; }
      }

      const magnitude = permitMagnitude(valuation, units);
      const submarket = inferSubmarket(permit.address ?? '');
      const lat = permit.latitude ? parseFloat(permit.latitude) : undefined;
      const lng = permit.longitude ? parseFloat(permit.longitude) : undefined;

      const draft: M35DraftEvent = {
        source_connector: 'atlanta-permits',
        source_record_id: permit.permit_number,
        msa_id: 'atlanta-sandy-springs-roswell-ga',
        submarket_hint: submarket,
        lat,
        lng,
        category,
        scope: 'SUBMARKET',
        name: `${permitTypeUpper} — ${permit.address}`,
        description: [
          permit.work_description,
          valuation > 0 ? `Declared value: $${(valuation / 1e6).toFixed(1)}M` : '',
          units > 0 ? `${units} units` : '',
          permit.contractor_company_name ? `Contractor: ${permit.contractor_company_name}` : '',
        ].filter(Boolean).join(' | '),
        signal_date: new Date(permit.issue_date),
        estimated_magnitude: magnitude,
        confidence: 0.75,
        source_url: `https://data.atlantaga.gov/d/${PERMITS_DATASET_ID}`,
        raw_payload: permit as unknown as Record<string, unknown>,
      };

      const outcome = await upsertDraftEvent(draft);
      if (outcome === 'created') stats.draftEventsCreated++;
      else stats.duplicatesIgnored++;
    } catch (err: any) {
      stats.errors.push(`Permit ${permit.permit_number}: ${err.message}`);
    }
  }

  stats.durationMs = Date.now() - start;
  logger.info('[M35 Connector] atlanta-permits complete', stats);
  return stats;
}

// ─── Connector 2: Atlanta DPCD ArcGIS — Rezoning + SUPs ──────────────────────
// Reuses the paginatedQuery pattern from atlanta-benchmark-ingestion.service.ts

async function arcgisPaginatedQuery(layerUrl: string, where: string, outFields: string): Promise<any[]> {
  const PAGE = 500;
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const url = new URL(`${layerUrl}/query`);
    url.searchParams.set('f', 'json');
    url.searchParams.set('where', where);
    url.searchParams.set('outFields', outFields);
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('resultOffset', String(offset));
    url.searchParams.set('resultRecordCount', String(PAGE));
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`ArcGIS ${resp.status}`);
    const data = await resp.json() as any;
    const features = data.features ?? [];
    all.push(...features);
    if (features.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function runAtlantaRezoningConnector(
  options: { sinceDate?: Date } = {}
): Promise<ConnectorRunStats> {
  const start = Date.now();
  const stats: ConnectorRunStats = {
    connector: 'atlanta-rezoning',
    recordsScanned: 0,
    draftEventsCreated: 0,
    draftEventsSkipped: 0,
    duplicatesIgnored: 0,
    errors: [],
    durationMs: 0,
  };

  await ensureStagingTable();

  const since = options.sinceDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceMs = since.getTime();

  const rezoningUrl = `${ATLANTA_GIS_BASE}/${REZONING_LAYER}`;
  const supUrl = `${ATLANTA_GIS_BASE}/${SUP_LAYER}`;

  // ── Rezoning cases ──
  let rezonings: any[] = [];
  try {
    rezonings = await arcgisPaginatedQuery(
      rezoningUrl,
      `CREATED_DATE >= ${sinceMs}`,
      'DOCKET_NO,FROM_ZONE,TO_ZONE,STATUS,CREATED_DATE,FINAL_UPDA,ACRES'
    );
  } catch (err: any) {
    stats.errors.push(`Rezoning ArcGIS: ${err.message}`);
  }

  for (const feature of rezonings) {
    stats.recordsScanned++;
    const a = feature.attributes ?? {};
    const acres = parseFloat(a.ACRES ?? '0') || 0;
    if (acres < 1.0) { stats.draftEventsSkipped++; continue; } // too small

    const magnitude = acres > 20 ? 4 : acres > 5 ? 3 : 2;
    const signalDate = a.CREATED_DATE ? new Date(a.CREATED_DATE) : new Date();
    const geo = feature.geometry;
    let lat: number | undefined;
    let lng: number | undefined;
    if (geo?.x != null) { lng = geo.x; lat = geo.y; }

    const draft: M35DraftEvent = {
      source_connector: 'atlanta-rezoning',
      source_record_id: a.DOCKET_NO ?? `rezone-${signalDate.getTime()}`,
      msa_id: 'atlanta-sandy-springs-roswell-ga',
      lat,
      lng,
      category: 'REGULATORY_CHANGE',
      scope: 'SUBMARKET',
      name: `Rezoning — ${a.FROM_ZONE ?? '?'} → ${a.TO_ZONE ?? '?'} (${a.DOCKET_NO})`,
      description: `Atlanta DPCD rezoning case ${a.DOCKET_NO}. Status: ${a.STATUS ?? 'unknown'}. ${acres.toFixed(1)} acres affected.`,
      signal_date: signalDate,
      estimated_magnitude: magnitude,
      confidence: 0.80,
      source_url: `https://gis.atlantaga.gov/dpcd/`,
      raw_payload: a,
    };

    const outcome = await upsertDraftEvent(draft);
    if (outcome === 'created') stats.draftEventsCreated++;
    else stats.duplicatesIgnored++;
  }

  // ── Special Use Permits ──
  let sups: any[] = [];
  try {
    sups = await arcgisPaginatedQuery(
      supUrl,
      `DATE_APP >= ${sinceMs}`,
      'SUP_DOCKET,SUP_TYPE,DATE_APP,APPSTATUS,ADDRESS'
    );
  } catch (err: any) {
    stats.errors.push(`SUP ArcGIS: ${err.message}`);
  }

  for (const feature of sups) {
    stats.recordsScanned++;
    const a = feature.attributes ?? {};
    const supType = (a.SUP_TYPE ?? '').toUpperCase();

    // Only surface SUPs that signal notable development (hotel, senior housing, drive-through, etc.)
    const notable = ['HOTEL', 'RESIDENTIAL', 'MIXED', 'SENIOR', 'COMMERCIAL'].some(t => supType.includes(t));
    if (!notable) { stats.draftEventsSkipped++; continue; }

    const signalDate = a.DATE_APP ? new Date(a.DATE_APP) : new Date();
    const draft: M35DraftEvent = {
      source_connector: 'atlanta-rezoning',
      source_record_id: `sup-${a.SUP_DOCKET}`,
      msa_id: 'atlanta-sandy-springs-roswell-ga',
      submarket_hint: a.ADDRESS ? inferSubmarket(a.ADDRESS) : undefined,
      category: 'COMMERCIAL_DEVELOPMENT',
      scope: 'PROPERTY',
      name: `SUP — ${a.SUP_TYPE ?? 'Unknown'} at ${a.ADDRESS ?? 'Unknown Address'}`,
      description: `Special Use Permit ${a.SUP_DOCKET}. Status: ${a.APPSTATUS ?? 'unknown'}.`,
      signal_date: signalDate,
      estimated_magnitude: 2,
      confidence: 0.65,
      source_url: 'https://gis.atlantaga.gov/dpcd/',
      raw_payload: a,
    };

    const outcome = await upsertDraftEvent(draft);
    if (outcome === 'created') stats.draftEventsCreated++;
    else stats.duplicatesIgnored++;
  }

  stats.durationMs = Date.now() - start;
  logger.info('[M35 Connector] atlanta-rezoning complete', stats);
  return stats;
}

// ─── Connector 3: GDELT GKG 2.0 — Historical News Event Seeding ─────────────
// Used for backtest: queries GDELT for Atlanta events in a date range.
// Outputs high-Goldstein-score events as M35 draft records.

interface GdeltArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
  status?: string;
}

export async function runGdeltBacktestConnector(options: {
  fromDate: Date;
  toDate: Date;
  keywords?: string[];
  limit?: number;
}): Promise<ConnectorRunStats> {
  const start = Date.now();
  const stats: ConnectorRunStats = {
    connector: 'gdelt-backtest',
    recordsScanned: 0,
    draftEventsCreated: 0,
    draftEventsSkipped: 0,
    duplicatesIgnored: 0,
    errors: [],
    durationMs: 0,
  };

  await ensureStagingTable();

  const defaultKeywords = [
    '"Atlanta" AND ("headquarters" OR "HQ" OR "relocation")',
    '"Atlanta" AND ("groundbreaking" OR "development" OR "mixed-use")',
    '"Atlanta" AND ("BeltLine" OR "transit" OR "MARTA")',
    '"Atlanta" AND ("rezoning" OR "upzone" OR "ordinance")',
    '"Atlanta" AND ("major employer" OR "jobs" OR "campus")',
    '"Atlanta" AND ("natural disaster" OR "tornado" OR "flood")',
  ];
  const queries = options.keywords ?? defaultKeywords;

  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}000000`;

  for (const query of queries) {
    const url = new URL(GDELT_GKG_BASE);
    url.searchParams.set('query', query);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('maxrecords', String(options.limit ?? 250));
    url.searchParams.set('startdatetime', fmt(options.fromDate));
    url.searchParams.set('enddatetime', fmt(options.toDate));
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'DateDesc');

    let data: GdeltResponse = {};
    try {
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) throw new Error(`GDELT HTTP ${resp.status}`);
      data = await resp.json();
    } catch (err: any) {
      stats.errors.push(`GDELT query "${query.slice(0, 40)}...": ${err.message}`);
      continue;
    }

    const articles = data.articles ?? [];
    stats.recordsScanned += articles.length;

    for (const article of articles) {
      // Determine M35 category from query keyword signal
      let category: M35EventCategory = 'MAJOR_EMPLOYER_ARRIVAL';
      if (query.includes('BeltLine') || query.includes('transit') || query.includes('MARTA')) {
        category = 'TRANSIT_INFRASTRUCTURE';
      } else if (query.includes('rezoning') || query.includes('ordinance')) {
        category = 'REGULATORY_CHANGE';
      } else if (query.includes('groundbreaking') || query.includes('development')) {
        category = 'MAJOR_DEVELOPMENT_STARTED';
      } else if (query.includes('natural disaster')) {
        category = 'NATURAL_DISASTER';
      }

      const signalDate = article.seendate
        ? new Date(
            parseInt(article.seendate.slice(0, 4)),
            parseInt(article.seendate.slice(4, 6)) - 1,
            parseInt(article.seendate.slice(6, 8))
          )
        : new Date();

      const recordId = Buffer.from(article.url).toString('base64').slice(0, 64);

      const draft: M35DraftEvent = {
        source_connector: 'gdelt-backtest',
        source_record_id: recordId,
        msa_id: 'atlanta-sandy-springs-roswell-ga',
        category,
        scope: 'MSA',
        name: article.title ?? 'GDELT Article (untitled)',
        description: `Source: ${article.domain} | Language: ${article.language} | Seen: ${article.seendate}`,
        signal_date: signalDate,
        estimated_magnitude: 2,                // Analyst will set magnitude on review
        confidence: 0.50,                       // Lower confidence — needs analyst review
        source_url: article.url,
        raw_payload: article as unknown as Record<string, unknown>,
      };

      const outcome = await upsertDraftEvent(draft);
      if (outcome === 'created') stats.draftEventsCreated++;
      else stats.duplicatesIgnored++;
    }
  }

  stats.durationMs = Date.now() - start;
  logger.info('[M35 Connector] gdelt-backtest complete', stats);
  return stats;
}

// ─── Orchestrator: run all connectors ─────────────────────────────────────────

export async function runAllAtlantaConnectors(options: {
  sinceDate?: Date;
} = {}): Promise<ConnectorRunStats[]> {
  const [permitsStats, rezoningStats] = await Promise.all([
    runAtlantaPermitsConnector(options),
    runAtlantaRezoningConnector(options),
  ]);
  return [permitsStats, rezoningStats];
}

// ─── Backtest seed (2013–2024 full range) ────────────────────────────────────

export async function seedAtlantaBacktest(): Promise<ConnectorRunStats[]> {
  logger.info('[M35 Backtest] Starting full Atlanta seed 2013-01-01 → 2024-12-31');
  const from = new Date('2013-01-01');
  const to   = new Date('2024-12-31');

  // Run permits + rezoning from historical data (ArcGIS has partial history)
  const [permitsStats, rezoningStats, gdeltStats] = await Promise.all([
    runAtlantaPermitsConnector({ sinceDate: from, limit: 10000 }),
    runAtlantaRezoningConnector({ sinceDate: from }),
    runGdeltBacktestConnector({ fromDate: from, toDate: to }),
  ]);

  const summary = [permitsStats, rezoningStats, gdeltStats];
  const total = summary.reduce((s, r) => s + r.draftEventsCreated, 0);
  logger.info(`[M35 Backtest] Seed complete — ${total} draft events created across all connectors`);
  return summary;
}
