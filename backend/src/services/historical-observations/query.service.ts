/**
 * CorpusQueryService — Query the historical_observations table
 *
 * Consuming modules (M35, M07, M36, M37, M38) read through this service
 * rather than querying the table directly. The service provides:
 *
 *   - query():   filtered historical rows matching geography + time + criteria
 *   - summary(): aggregate statistics for a geography
 *   - coverage(): data density / freshness report per deal geography
 *
 * All queries use parameterized SQL (no string interpolation for user input)
 * consistent with the existing codebase database/connection pattern.
 *
 * @see HISTORICAL_OBSERVATIONS_SPEC.md Section 8
 */

import { query } from '../../database/connection';
import { logger } from '../../utils/logger';
import {
  type CorpusQuery,
  type CorpusSummary,
  type CoverageReport,
  type GeographyLevel,
  type HistoricalObservationRow,
  type PartialHistoricalObservationRow,
  type RealizationWindow,
} from './types';

// ─── DB column name → TS field name mapping ─────────────────────────────────
// Used by row mapper to convert snake_case DB rows to camelCase interfaces.

type RowMapper = (row: Record<string, unknown>) => HistoricalObservationRow;

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function mapRow(row: Record<string, unknown>): HistoricalObservationRow {
  const mapped: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    mapped[snakeToCamel(key)] = val;
  }
  return mapped as unknown as HistoricalObservationRow;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WINDOW_DATE_PART: Record<RealizationWindow, string> = {
  '3mo': "observation_date + INTERVAL '3 months'",
  '12mo': "observation_date + INTERVAL '12 months'",
  '24mo': "observation_date + INTERVAL '24 months'",
};

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Geography WHERE clause builder ──────────────────────────────────────────

function buildGeographyWhere(
  geo: CorpusQuery['geography'],
  params: unknown[],
): string {
  const clauses: string[] = [];

  if (geo.msaId) {
    params.push(geo.msaId);
    clauses.push(`msa_id = $${params.length}`);
  }
  if (geo.submarketId) {
    params.push(geo.submarketId);
    clauses.push(`submarket_id = $${params.length}`);
  }
  if (geo.parcelId) {
    params.push(geo.parcelId);
    clauses.push(`parcel_id = $${params.length}`);
  }

  return clauses.length > 0 ? clauses.join(' OR ') : '';
}

// ─── Service Class ───────────────────────────────────────────────────────────

export class CorpusQueryService {
  /**
   * Query historical_observations rows matching the given criteria.
   * Returns rows as HistoricalObservationRow interface (camelCase).
   */
  async query(q: CorpusQuery): Promise<HistoricalObservationRow[]> {
    const params: unknown[] = [];
    const whereClauses: string[] = [];
    const fieldName = q.requireRealization
      ? WINDOW_DATE_PART[q.requireRealization]
      : null;

    // Geography
    if (q.geography) {
      const geoWhere = buildGeographyWhere(q.geography, params);
      if (geoWhere) whereClauses.push(`(${geoWhere})`);
    }

    // Time range
    if (q.timeRange?.start) {
      params.push(q.timeRange.start);
      whereClauses.push(`observation_date >= $${params.length}::DATE`);
    }
    if (q.timeRange?.end) {
      params.push(q.timeRange.end);
      whereClauses.push(`observation_date <= $${params.length}::DATE`);
    }

    // Observation window
    if (q.observationWindow) {
      params.push(q.observationWindow);
      whereClauses.push(`observation_window = $${params.length}`);
    }

    // Subject property filter
    // Double-guard: flag must be TRUE AND the row's own deal must currently be
    // in owned/closed/portfolio.  For rows that have deal_id populated (the
    // normal path after #722), we join directly on deals.id.  For rows whose
    // deal_id is still NULL (pre-backfill), we fall back to the parcel JOIN so
    // they are neither silently returned nor silently dropped.
    if (q.isSubjectOnly) {
      whereClauses.push(`(
        is_subject_property = TRUE
        AND (
          deal_id IN (SELECT id FROM deals WHERE status IN ('owned', 'closed', 'portfolio'))
          OR (
            deal_id IS NULL
            AND parcel_id IN (
              SELECT COALESCE(p.parcel_id, dp.property_id::text)
              FROM deal_properties dp
              LEFT JOIN properties p ON p.id = dp.property_id
              JOIN deals d ON d.id = dp.deal_id
              WHERE d.status IN ('owned', 'closed', 'portfolio')
            )
          )
        )
      )`);
    }
    if (q.isUnlabeledOnly) {
      whereClauses.push('is_subject_property = FALSE');
    }

    // Require fields — only return rows where these specific columns are non-null
    if (q.requireFields && q.requireFields.length > 0) {
      for (const field of q.requireFields) {
        // Convert camelCase field name to snake_case for SQL
        const dbCol = field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        whereClauses.push(`${dbCol} IS NOT NULL`);
      }
    }

    // Require realization — only return rows old enough that the output
    // window has closed (observation_date + window <= NOW())
    if (q.requireRealization && fieldName) {
      // Use partial interval from field name
      const suffix = q.requireRealization; // '3mo', '12mo', '24mo'
      const months = parseInt(suffix.replace('mo', ''), 10);
      params.push(months);
      whereClauses.push(
        `observation_date + ($${params.length} || ' months')::INTERVAL <= NOW()`,
      );
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT * FROM historical_observations ${whereSQL} ORDER BY observation_date DESC`;

    try {
      const result = await query(sql, params);
      return result.rows.map(mapRow);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[CorpusQueryService] query failed', { error: msg, sql });
      throw err;
    }
  }

  /**
   * Return aggregate summary for a given geography/time range.
   */
  async summary(q: CorpusQuery): Promise<CorpusSummary> {
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (q.geography) {
      const geoWhere = buildGeographyWhere(q.geography, params);
      if (geoWhere) whereClauses.push(`(${geoWhere})`);
    }
    if (q.timeRange?.start) {
      params.push(q.timeRange.start);
      whereClauses.push(`observation_date >= $${params.length}::DATE`);
    }
    if (q.timeRange?.end) {
      params.push(q.timeRange.end);
      whereClauses.push(`observation_date <= $${params.length}::DATE`);
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
      SELECT
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE is_subject_property = TRUE) AS subject_count,
        COUNT(*) FILTER (WHERE realization_complete = TRUE) AS realization_count,
        MIN(observation_date) AS earliest_date,
        MAX(observation_date) AS latest_date,
        ARRAY_AGG(DISTINCT geography_level) AS geo_levels,
        (
          SELECT ARRAY_AGG(DISTINCT src)
          FROM historical_observations, UNNEST(source_signals) AS src
          ${whereSQL.replace('WHERE', 'WHERE')}
        ) AS signal_sources
      FROM historical_observations
      ${whereSQL}
    `;

    try {
      const result = await query(sql, params);
      const row = result.rows[0] || {};

      return {
        totalRows: Number(row.total_rows) || 0,
        dateRange: {
          earliest: row.earliest_date ? new Date(row.earliest_date) : null,
          latest: row.latest_date ? new Date(row.latest_date) : null,
        },
        geographyLevels: (row.geo_levels || []) as GeographyLevel[],
        signalSources: (row.signal_sources || []) as string[],
        subjectPropertyCount: Number(row.subject_count) || 0,
        realizationCompleteCount: Number(row.realization_count) || 0,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[CorpusQueryService] summary failed', {
        error: msg,
        sql,
      });
      throw err;
    }
  }

  /**
   * Determine how well-covered a given geography is by the corpus.
   * Returns a CoverageReport with signal-by-signal status and an overall
   * confidence rating.
   *
   * NOTE: This method currently returns stub data until the corpus has
   * populated rows. Once ingestion is running (Phase 2+), it will query
   * actual row counts and date ranges from the table.
   */
  async coverage(
    geography: CorpusQuery['geography'],
  ): Promise<CoverageReport> {
    const submarketId = geography.submarketId || geography.msaId || 'unknown';
    const msaId = geography.msaId || 'unknown';

    // Try to get actual counts from the table
    let totalMonths = 0;
    let lastUpload: Date | null = null;

    try {
      const params: unknown[] = [];
      const geoWhere = buildGeographyWhere(geography, params);
      if (geoWhere) {
        const countSql = `SELECT COUNT(*) AS cnt, MAX(observation_date) AS latest FROM historical_observations WHERE ${geoWhere}`;
        const countResult = await query(countSql, params);
        totalMonths = Number(countResult.rows[0]?.cnt) || 0;
        lastUpload = countResult.rows[0]?.latest
          ? new Date(countResult.rows[0].latest)
          : null;
      }
    } catch {
      // Table may not exist yet — fall through to stub
      logger.info(
        '[CorpusQueryService.coverage] Table not available, returning stub report',
      );
    }

    // If we have real data, return it; otherwise return stub
    if (totalMonths > 0) {
      return {
        msaId,
        submarketId,
        propertyPerformance: {
          status: lastUpload ? 'current' : 'missing',
          totalMonths,
          lastUpload,
          gaps: 0,
          coveragePct: Math.min(100, Math.round((totalMonths / 84) * 100)),
        },
        submarketData: {
          status: totalMonths >= 36 ? 'strong' : totalMonths >= 12 ? 'partial' : 'sparse',
          totalMonths,
          dateRange: { earliest: null, latest: lastUpload },
        },
        externalSignals: [
          { name: 'LODES (commute-shed)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
          { name: 'QCEW (employment)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
          { name: 'FRED (rates)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
          { name: 'M35 events', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
          { name: 'Veraset mobility', status: 'pending', throughDate: null, note: 'Awaiting subscription' },
        ],
        confidence: totalMonths >= 36 ? 'high' : totalMonths >= 12 ? 'medium' : 'low',
      };
    }

    // Stub report — table exists but is empty
    return {
      msaId,
      submarketId,
      propertyPerformance: {
        status: 'missing',
        totalMonths: 0,
        lastUpload: null,
        gaps: 0,
        coveragePct: 0,
      },
      submarketData: {
        status: 'missing',
        totalMonths: 0,
        dateRange: { earliest: null, latest: null },
      },
      externalSignals: [
        { name: 'LODES (commute-shed)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
        { name: 'QCEW (employment)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
        { name: 'FRED (rates)', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
        { name: 'M35 events', status: 'pending', throughDate: null, note: 'Awaiting ingestion Phase 4' },
        { name: 'Veraset mobility', status: 'pending', throughDate: null, note: 'Awaiting subscription' },
      ],
      confidence: 'low',
    };
  }

  /**
   * Insert a new historical_observations row. Returns the generated UUID.
   */
  async insertRow(
    row: PartialHistoricalObservationRow,
  ): Promise<string> {
    // Build column list from non-undefined fields
    const colNames: string[] = [];
    const params: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 0;

    // Map camelCase keys to snake_case column names
    const keyToCol: Record<string, string> = {
      // Geography
      msaId: 'msa_id',
      submarketId: 'submarket_id',
      parcelId: 'parcel_id',
      latitude: 'latitude',
      longitude: 'longitude',
      geographyLevel: 'geography_level',
      // Time
      observationDate: 'observation_date',
      observationWindow: 'observation_window',
      // Mobility
      commuteShedWorkers: 'commute_shed_workers',
      commuteShedWagePct: 'commute_shed_wage_pct',
      mobilityVisitsMonthly: 'mobility_visits_monthly',
      mobilityUniqueVisitors: 'mobility_unique_visitors',
      mobilityVisitsPsf: 'mobility_visits_psf',
      // Events
      activeEventCount: 'active_event_count',
      eventEmployerJobsAdded: 'event_employer_jobs_added',
      eventEmployerJobsLost: 'event_employer_jobs_lost',
      eventSupplyUnitsDelivered: 'event_supply_units_delivered',
      eventSupplyUnitsAnnounced: 'event_supply_units_announced',
      eventSubtypes: 'event_subtypes',
      // MSA macro
      msaEmploymentTotal: 'msa_employment_total',
      msaEmploymentGrowthYoy: 'msa_employment_growth_yoy',
      msaAvgWage: 'msa_avg_wage',
      msaWageGrowthYoy: 'msa_wage_growth_yoy',
      msaUnemploymentRate: 'msa_unemployment_rate',
      msaPopulation: 'msa_population',
      msaHouseholdGrowthYoy: 'msa_household_growth_yoy',
      msaInMigrationNet: 'msa_in_migration_net',
      msaTreasury10y: 'msa_treasury_10y',
      msaFedFundsRate: 'msa_fed_funds_rate',
      // Submarket
      submarketAvgAskingRent: 'submarket_avg_asking_rent',
      submarketAvgEffectiveRent: 'submarket_avg_effective_rent',
      submarketVacancyRate: 'submarket_vacancy_rate',
      submarketConcessionPct: 'submarket_concession_pct',
      submarketUnderConstruction: 'submarket_under_construction',
      submarketPipelineUnits24mo: 'submarket_pipeline_units_24mo',
      submarketClassAShare: 'submarket_class_a_share',
      // Property state
      propertyOccupancy: 'property_occupancy',
      propertyAvgRent: 'property_avg_rent',
      propertyConcessionPerUnit: 'property_concession_per_unit',
      propertyUnitCount: 'property_unit_count',
      propertyYearBuilt: 'property_year_built',
      propertyClass: 'property_class',
      // Realized
      realizedRentChangeT3: 'realized_rent_change_t3',
      realizedRentChangeT12: 'realized_rent_change_t12',
      realizedRentChangeT24: 'realized_rent_change_t24',
      realizedOccupancyChangeT3: 'realized_occupancy_change_t3',
      realizedOccupancyChangeT12: 'realized_occupancy_change_t12',
      realizedConcessionChangeT12: 'realized_concession_change_t12',
      realizedSigningVelocityT3: 'realized_signing_velocity_t3',
      realizedSigningVelocityT12: 'realized_signing_velocity_t12',
      realizedCapRateChangeT12Bps: 'realized_cap_rate_change_t12_bps',
      realizedCapRateChangeT24Bps: 'realized_cap_rate_change_t24_bps',
      realizedWalkinsPsfT12: 'realized_walkins_psf_t12',
      // Property state (Phase 1 additions)
      propertyAskingRent: 'property_asking_rent',
      propertySigningVelocity: 'property_signing_velocity',
      // Capital events
      capitalEventType: 'capital_event_type',
      capitalEventAmount: 'capital_event_amount',
      capitalEventMetadata: 'capital_event_metadata',
      // Data quality
      dataQualityTier: 'data_quality_tier',
      redistributionRestricted: 'redistribution_restricted',
      // CoStar overlay (Phase 4)
      costarSubmarketRent: 'costar_submarket_rent',
      costarSubmarketVacancy: 'costar_submarket_vacancy',
      costarSubmarketAbsorption: 'costar_submarket_absorption',
      costarSubmarketConcessionPct: 'costar_submarket_concession_pct',
      costarSubmarketNewSupply: 'costar_submarket_new_supply',
      // Market survey (Phase 4)
      marketSurveySource: 'market_survey_source',
      marketSurveySnapshot: 'market_survey_snapshot',
      // Metadata
      sourceSignals: 'source_signals',
      signalFreshnessDays: 'signal_freshness_days',
      isSubjectProperty: 'is_subject_property',
      realizationComplete: 'realization_complete',
      realizationCompleteDate: 'realization_complete_date',
      dataQualityFlags: 'data_quality_flags',
      dealId: 'deal_id',
    };

    for (const [camelKey, colName] of Object.entries(keyToCol)) {
      const val = (row as Record<string, unknown>)[camelKey];
      if (val !== undefined) {
        idx++;
        colNames.push(colName);
        params.push(val);
        placeholders.push(`$${idx}`);
      }
    }

    if (colNames.length === 0) {
      throw new Error('insertRow: at least one field must be provided');
    }

    const colsJoined = colNames.join(', ');
    const phJoined = placeholders.join(', ');

    const sql = `INSERT INTO historical_observations (${colsJoined}) VALUES (${phJoined}) RETURNING id`;

    try {
      const result = await query(sql, params);
      const id = result.rows[0]?.id;
      logger.info('[CorpusQueryService] Row inserted', { id });
      return id as string;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[CorpusQueryService] insertRow failed', {
        error: msg,
        sql,
      });
      throw err;
    }
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────

export const corpusQueryService = new CorpusQueryService();
