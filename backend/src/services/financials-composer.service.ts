/**
 * financials-composer.service.ts
 *
 * Shared utilities and data loaders for the F9 financials pipeline.
 * Provides concession recognition, subject history, other-income breakdown,
 * trailing actuals, and extraction rent-roll helpers.
 */
import { Pool } from 'pg';
import { amortizeConcessions } from './concession-amortization/index';
import type {
  ConcessionAmortizationSchedule,
  ConcessionMonthlyDetail,
  DealConcessionRecognition,
  ConcessionRecord,
} from '../types/concessions';
import { RentRollDiffService } from './rent-roll/rent-roll-diff.service';
import { peerIntelligenceService } from './sigma/peer-intelligence';

// â”€â”€ M07 Subject Traffic History record shape (mirrors frontend F9SubjectHistory) â”€â”€â”€
export interface SubjectHistoryRecord {
  tier: 'S1' | 'S2' | 'S3' | 'S4';
  snapshot_count: number;
  coverage_months: number | null;
  current_state: Record<string, unknown> | null;
  observed_dynamics: Record<string, unknown> | null;
  confidence_weights: Record<string, { n_obs: number; n_required: number; weight: number }>;
  peer_collisions: Array<{ coefficient: string; subject_value: number; peer_value: number; sigma_deviation: number }>;
  /** Platform peer-set posteriors for all resolved coefficients â€” for UI peer column. */
  peer_set_values: Record<string, number>;
  updated_at: string;
}




export interface OtherIncomeBreakdownRow {
  category: string;
  rent_roll: number | null;
  t12: number | null;
  om: number | null;
  resolved: number | null;
  resolution: string;
  conflict: boolean;
}

export interface OtherIncomeBreakdownPayload {
  rows: OtherIncomeBreakdownRow[];
  total: {
    rent_roll: number | null;
    t12: number | null;
    om: number | null;
    resolved: number;
  };
}

export interface ExtractionRentRollPayload {
  totalUnits: number | null;
  occupiedUnits: number | null;
  vacantUnits: number | null;
  asOfDate: string | null;
  sourceRef: string | null;
  otherIncomeMonthly: Record<string, number> | null;
  expirationCurve: Record<string, number> | null;
  /** Deal-wide extraction status for the lease-expiration column. Task #514. */
  expirationExtractionStatus: 'ok' | 'partial' | 'failed' | null;
  /** Per-critical-column extraction scorecard. Task #514. */
  columnCoverage: Record<string, string> | null;
  /** True when the extraction needs human review. Task #514. */
  humanReviewNeeded: boolean;
  floorPlanMix: Record<string, {
    count: number;
    avg_sqft: number;
    avg_market_rent: number;
    avg_effective_rent: number;
    occupancy_pct: number;
    expiration_curve?: Record<string, number>;
    expiration_extraction_status?: 'ok' | 'partial' | 'failed';
  }> | null;
  units: Array<Record<string, unknown>> | null;
}



/**
 * 24-hour TTL for the concession_recognition cache stored in deal_data.
 *
 * Recompute triggers (§572 step 6):
 *   - leasing_cost_treatment change → different treatment key forces stale
 *   - fiscal_year_start_month change → different key forces stale
 *   - concession_records update → LV engine writes new records to deal_data (Task #573)
 *   - subject_history update → next financials call re-checks staleness
 *   Any of these changes land in deal_data before the financials pipeline runs, so the
 *   cache key mismatch detection below catches them without a separate event bus.
 */
const CONCESSION_RECOGNITION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Compute (or serve from 24h cache) concession recognition for a deal.
 *
 * Cache strategy: write-through to deal_data.concession_recognition.
 *   - Cache hit: last_recomputed < 24h AND treatment/fiscalStart keys match dealData → return cached.
 *   - Cache miss: run amortizeConcessions(), write result back to deal_data, return fresh.
 *
 * Recompute triggers wired here:
 *   - leasing_cost_treatment change: cache key includes treatment string
 *   - fiscal_year_start_month change: cache key includes fiscalStart integer
 *   - concession_records update: record count/content change in dealData invalidates computation
 *   - subject_history update (Task #573): LV engine re-emits records on subject history change
 *
 * Non-fatal: any error returns null (engine errors logged; do not break financials response).
 */

function computeMonthlyDetail(
  schedules: ConcessionAmortizationSchedule[],
  records: ConcessionRecord[],
  treatment: 'OPERATING' | 'CAPITALIZED' | 'HYBRID' = 'OPERATING',
): Record<string, ConcessionMonthlyDetail> {
  const recordMap = new Map(records.map(r => [r.id, r]));
  const detail: Record<string, {
    new_lease_count: number; new_lease_dollars: number; new_lease_earned: number;
    renewal_count: number; renewal_dollars: number; renewal_earned: number;
    continuing_count: number; continuing_dollars: number;
    earliest_commencement?: string; latest_commencement?: string;
    methodSet: Set<string>;
    methodByType: Map<string, Set<string>>;
    write_offs: Array<{ amount: number; reason: string; concession_id: string }>;
    commencingIds: Set<string>;
  }> = {};

  const ensure = (month: string) => {
    if (!detail[month]) {
      detail[month] = {
        new_lease_count: 0, new_lease_dollars: 0, new_lease_earned: 0,
        renewal_count: 0, renewal_dollars: 0, renewal_earned: 0,
        continuing_count: 0, continuing_dollars: 0,
        methodSet: new Set(),
        methodByType: new Map(),
        write_offs: [],
        commencingIds: new Set(),
      };
    }
    return detail[month];
  };

  for (const sched of schedules) {
    if (sched.is_lease_up_period && treatment === 'CAPITALIZED') continue;
    const record = recordMap.get(sched.concession_id);
    if (!record) continue;
    const commMonth = record.lease_start_date.slice(0, 7).replace('-', '');
    const ctype = record.concession_type;

    for (const entry of sched.monthly_entries) {
      const md = ensure(entry.month);
      md.methodSet.add(sched.method);
      const typeSet = md.methodByType.get(ctype) ?? new Set<string>();
      typeSet.add(sched.method);
      md.methodByType.set(ctype, typeSet);

      if (entry.month === commMonth) {
        if (record.is_renewal) {
          md.renewal_count += 1;
          md.renewal_dollars += entry.amount;
          if (!md.commencingIds.has(record.id)) {
            md.renewal_earned += record.cash_value;
            md.commencingIds.add(record.id);
          }
        } else {
          md.new_lease_count += 1;
          md.new_lease_dollars += entry.amount;
          if (!md.commencingIds.has(record.id)) {
            md.new_lease_earned += record.cash_value;
            md.commencingIds.add(record.id);
          }
        }
      } else {
        md.continuing_count += 1;
        md.continuing_dollars += entry.amount;
        const commDate = record.lease_start_date;
        if (!md.earliest_commencement || commDate < md.earliest_commencement) {
          md.earliest_commencement = commDate;
        }
        if (!md.latest_commencement || commDate > md.latest_commencement) {
          md.latest_commencement = commDate;
        }
      }
    }

    for (const wo of sched.write_offs) {
      const md = ensure(wo.write_off_month);
      md.write_offs.push({ amount: wo.amount, reason: wo.reason, concession_id: wo.concession_id });
    }
  }

  const result: Record<string, ConcessionMonthlyDetail> = {};
  for (const [month, md] of Object.entries(detail)) {
    const method_by_type: Record<string, string[]> = {};
    for (const [ctype, mSet] of md.methodByType.entries()) {
      method_by_type[ctype] = Array.from(mSet);
    }
    result[month] = {
      new_lease_count: md.new_lease_count,
      new_lease_dollars: md.new_lease_dollars,
      new_lease_earned: md.new_lease_earned,
      renewal_count: md.renewal_count,
      renewal_dollars: md.renewal_dollars,
      renewal_earned: md.renewal_earned,
      continuing_count: md.continuing_count,
      continuing_dollars: md.continuing_dollars,
      earliest_commencement: md.earliest_commencement,
      latest_commencement: md.latest_commencement,
      methods: Array.from(md.methodSet),
      method_by_type,
      write_offs: md.write_offs,
    };
  }
  return result;
}

export async function computeConcessionRecognition(
  pool: Pool,
  dealId: string,
  dealData: Record<string, any>,
): Promise<DealConcessionRecognition | null> {
  // ── Task #573: Merge all three concession record sources ─────────────────
  // 1. lv_concession_records       — set by the LV engine route when dealId is present
  // 2. history_concession_records  — extracted from the latest M07 rent roll snapshot;
  //    lazily populated here on first financials computation if not yet persisted
  // 3. concession_records          — manually provided or legacy records
  const lvRecords: ConcessionRecord[] = Array.isArray(dealData?.lv_concession_records)
    ? (dealData.lv_concession_records as ConcessionRecord[])
    : [];

  // ── M07 history: lazy extraction when not yet persisted ─────────────────
  // If deal_data.history_concession_records has never been written (undefined/null),
  // run extractHistoricalConcessionRecords now and persist the result so future
  // financials calls can use it from cache without hitting the DB extractor again.
  let histRecords: ConcessionRecord[] = [];
  if (!Array.isArray(dealData?.history_concession_records)) {
    try {
      const rrDiff = new RentRollDiffService(pool);
      const extracted = await rrDiff.extractHistoricalConcessionRecords(dealId);
      histRecords = extracted;
      await pool.query(
        `UPDATE deals
         SET deal_data = jsonb_set(
           COALESCE(deal_data, '{}'::jsonb),
           '{history_concession_records}',
           $1::jsonb
         )
         WHERE id = $2`,
        [JSON.stringify(extracted), dealId],
      );
    } catch (err: any) {
      console.warn(
        '[computeConcessionRecognition] M07 history extraction failed:',
        err?.message ?? err,
      );
    }
  } else {
    histRecords = dealData.history_concession_records as ConcessionRecord[];
  }

  // ── Source 3: manual / legacy records ───────────────────────────────────
  // Read from concession_records, but deduplicate against the lv+hist sources
  // below so that re-runs (where concession_records already holds the prior
  // merged output) do not double-count projected or historical records.
  // Any record whose ID is already present in lv or hist is skipped here.
  const lvHistIds = new Set<string>([
    ...lvRecords.map(r => r.id),
    ...histRecords.map(r => r.id),
  ]);
  const manualRecords: ConcessionRecord[] = (
    Array.isArray(dealData?.concession_records)
      ? (dealData.concession_records as ConcessionRecord[])
      : []
  ).filter(r => !lvHistIds.has(r.id));

  const records: ConcessionRecord[] = [...lvRecords, ...histRecords, ...manualRecords];

  // ── Persist merged set as canonical concession_records ───────────────────
  // Task #573 contract: write the full merged past+projected stream to
  // deal_data.concession_records so downstream tasks (#574, #575) and the
  // financials panel read a single canonical field.
  // Always persisted (including empty array) so zero-record recomputes clear
  // any stale data left by a prior run. Non-fatal — failure does not block.
  pool.query(
    `UPDATE deals
     SET deal_data = jsonb_set(
       COALESCE(deal_data, '{}'::jsonb),
       '{concession_records}',
       $1::jsonb
     )
     WHERE id = $2`,
    [JSON.stringify(records), dealId],
  ).catch((persistErr: any) => {
    console.warn(
      '[computeConcessionRecognition] Failed to persist concession_records:',
      persistErr?.message ?? persistErr,
    );
  });

  if (records.length === 0) return null;

  const treatment: string = dealData?.leasing_cost_treatment ?? 'OPERATING';
  if (treatment !== 'OPERATING' && treatment !== 'CAPITALIZED' && treatment !== 'HYBRID') {
    return null;
  }
  const fiscalStart = typeof dealData?.fiscal_year_start_month === 'number'
    ? dealData.fiscal_year_start_month
    : 1;

  // ── Content fingerprint (detects LV-output / subject-history changes) ───
  // Fingerprints all fields that affect amortization output. A change in any record's
  // cash_value, dates, method, write-off dates, or treatment flags invalidates the cache
  // even when record count stays constant. Sort by id for stable ordering.
  const fingerprint = [treatment, String(fiscalStart), ...records
    .map(r => [
      r.id,
      String(r.cash_value),
      r.amortization_method,
      r.lease_start_date,
      r.lease_end_date,
      String(r.lease_term_months),
      r.early_termination_date ?? '',
      r.structural_write_off_date ?? '',
      String(r.is_lease_up_period),
      String(r.inferred_from_rent_roll ?? false),
      r.leasing_cost_treatment,
    ].join(':'))
    .sort(),
  ].join('|');

  // ── Cache read ───────────────────────────────────────────────────────────
  const cached = dealData?.concession_recognition as (DealConcessionRecognition & {
    _cache_key?: string;
  }) | null | undefined;
  const cacheKey = fingerprint;
  if (cached?.last_recomputed && cached?._cache_key === cacheKey) {
    const age = Date.now() - new Date(cached.last_recomputed).getTime();
    if (age < CONCESSION_RECOGNITION_CACHE_TTL_MS) {
      return {
        monthly: cached.monthly,
        by_calendar_year: cached.by_calendar_year,
        by_fiscal_year: cached.by_fiscal_year,
        write_offs_year_to_date: cached.write_offs_year_to_date,
        last_recomputed: cached.last_recomputed,
        capitalized_lease_up_total: cached.capitalized_lease_up_total,
        monthly_detail: cached.monthly_detail,
      };
    }
  }

  // ── Cache miss: compute ──────────────────────────────────────────────────
  try {
    const output = amortizeConcessions({
      records,
      leasing_cost_treatment: treatment as 'OPERATING' | 'CAPITALIZED' | 'HYBRID',
      fiscal_year_start_month: fiscalStart,
    });
    const result: DealConcessionRecognition = {
      monthly: output.monthly_recognition,
      by_calendar_year: output.calendar_year_recognition,
      by_fiscal_year: output.fiscal_year_recognition,
      write_offs_year_to_date: output.write_offs_year_to_date,
      last_recomputed: output.computed_at,
      capitalized_lease_up_total: output.lease_up_reserve_required,
      monthly_detail: computeMonthlyDetail(output.schedules, records, treatment as 'OPERATING' | 'CAPITALIZED' | 'HYBRID'),
    };

    // ── Write-through cache: persist to deal_data ──────────────────────────
    // Non-fatal — cache write failure doesn't break the financials response.
    //
    // Cache-stamp pattern: _treatment is load-bearing — do NOT remove it.
    // PUT /stance updates operator_stance.leasingCostTreatment without calling
    // the financials pipeline, so the cache and the current treatment can diverge.
    // getDealFinancials reads _treatment on every call and, when it doesn't match
    // effectiveLct, inline-recomputes via amortizeConcessions (pure fn, no DB calls)
    // rather than serving a stale capitalized_lease_up_total.  The stamp makes the
    // cache self-correcting with zero race conditions and no manual invalidation step.
    // See getDealFinancials in proforma-adjustment.service.ts for the read-side logic.
    const cachePayload = { ...result, _cache_key: cacheKey, _treatment: treatment };
    try {
      await pool.query(
        `UPDATE deals
         SET deal_data = jsonb_set(
           COALESCE(deal_data, '{}'::jsonb),
           '{concession_recognition}',
           $1::jsonb
         )
         WHERE id = $2`,
        [JSON.stringify(cachePayload), dealId],
      );
    } catch (cacheWriteErr: any) {
      console.warn(
        '[composer] concession_recognition cache write failed (non-fatal):',
        cacheWriteErr?.message ?? cacheWriteErr,
      );
    }

    return result;
  } catch (err: any) {
    console.warn('[composer] computeConcessionRecognition failed (non-fatal):', err?.message ?? err);
    return null;
  }
}

/**
 * Build per-category ancillary reconciliation payload for the UI.
 * - rent_roll: monthly $ Ã— 12 from `extraction_rent_roll.other_income_monthly`
 * - om:        monthly $ Ã— 12 from `extraction_om.other_income_monthly`
 * - t12:       only the aggregate (T-12 has no per-category breakdown) â€” set
 *              on the synthetic total row, NOT on per-category rows
 * - resolved + resolution: pulled from the seed's `other_income_breakdown.<cat>`
 *                          LayeredValue computed by proforma-seeder.
 * - conflict: true when two non-null sources differ by >15%.
 * Task #519.
 */
/**
 * Loads platform peer-set posterior values for a deal using the same
 * scope-degradation cascade as CoefficientResolverService.loadPlatformCoefficients().
 * Ensures the Peer SET column in SubjectHistoryPanel matches the peer context
 * actually used by the resolver when computing blended effective values.
 */
async function loadDealScopedPeerPosteriors(
  pool: Pool,
  deal: { submarket_id: string | null; property_class: string | null; year_built: number | null; msa_id: string | null },
): Promise<Record<string, number>> {
  // Derive vintage band identically to CoefficientResolverService.getVintageBand()
  const yb = deal.year_built;
  const vintageBand = yb == null ? null
    : yb < 1980 ? 'pre_1980'
    : yb < 2000 ? '1980_2000'
    : yb < 2015 ? '2000_2015'
    : 'post_2015';

  const submarketId = deal.submarket_id ?? null;
  const propertyClass = deal.property_class ?? null;
  const msaId = deal.msa_id ?? null;

  const scopeAttempts: Array<{
    scope_level: string;
    submarket_id: string | null;
    property_class: string | null;
    vintage_band: string | null;
    msa_id: string | null;
  }> = [
    { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: vintageBand, msa_id: null },
    { scope_level: 'submarket', submarket_id: submarketId, property_class: propertyClass, vintage_band: null,        msa_id: null },
    { scope_level: 'submarket', submarket_id: submarketId, property_class: null,          vintage_band: null,        msa_id: null },
    { scope_level: 'msa',       submarket_id: null,        property_class: propertyClass, vintage_band: null,        msa_id: msaId },
    { scope_level: 'class',     submarket_id: null,        property_class: propertyClass, vintage_band: null,        msa_id: null },
    { scope_level: 'vintage',   submarket_id: null,        property_class: null,          vintage_band: vintageBand, msa_id: null },
    { scope_level: 'platform',  submarket_id: null,        property_class: null,          vintage_band: null,        msa_id: null },
  ];

  for (const attempt of scopeAttempts) {
    const res = await pool.query<{ coefficient_name: string; posterior_value: string }>(
      `SELECT coefficient_name, posterior_value
       FROM traffic_calibration_factors
       WHERE scope_level = $1
         AND (submarket_id = $2 OR ($2 IS NULL AND submarket_id IS NULL))
         AND (property_class = $3 OR ($3 IS NULL AND property_class IS NULL))
         AND (vintage_band = $4 OR ($4 IS NULL AND vintage_band IS NULL))
         AND (msa_id = $5 OR ($5 IS NULL AND msa_id IS NULL))
         AND coefficient_name != 'absorption_curve'
         AND cal_window = 'TTM'
       ORDER BY n_peer_properties DESC`,
      [attempt.scope_level, attempt.submarket_id, attempt.property_class, attempt.vintage_band, attempt.msa_id],
    );
    if (res.rows.length > 0) {
      const result: Record<string, number> = {};
      for (const row of res.rows) {
        result[row.coefficient_name] = parseFloat(row.posterior_value);
      }
      return result;
    }
  }
  return {};
}

export async function loadSubjectHistory(
  pool: Pool,
  dealId: string,
  dealData: Record<string, any>,
): Promise<SubjectHistoryRecord | null> {
  let subjectHistory: SubjectHistoryRecord | null = null;
  try {
    const sthRes = await pool.query<{
      tier: string;
      snapshot_count: number;
      coverage_months: string | null;
      current_state: Record<string, unknown> | null;
      observed_dynamics: Record<string, unknown> | null;
      confidence_weights: Record<string, unknown>;
      peer_collisions: Array<Record<string, unknown>>;
      updated_at: string;
    }>(
      `SELECT tier, snapshot_count, coverage_months, current_state, observed_dynamics,
              confidence_weights, peer_collisions, updated_at
       FROM subject_traffic_history WHERE deal_id = $1`,
      [dealId],
    );
    if (sthRes.rows.length > 0) {
      const row = sthRes.rows[0];
      let peerSetValues: Record<string, number> = {};
      try {
        const deal = {
          submarket_id: dealData?.submarketId ?? null,
          property_class: dealData?.property_class ?? null,
          year_built: dealData?.year_built != null ? parseInt(dealData.year_built) : null,
          msa_id: dealData?.msaId ?? null,
        };
        peerSetValues = await loadDealScopedPeerPosteriors(pool, deal);
      } catch {
        // Platform posteriors not available — peer column stays empty for non-collision rows
      }
      // M39: enrich peer_set_values with top-peer traffic/leasing metrics from
      // the peer intelligence engine. Writes to canonical F9 keys consumed by
      // ProjectionsTab and InlineAssumptionBlock.
      const submarketId = dealData?.submarketId ?? null;
      if (submarketId) {
        try {
          const m39AssetClass = dealData?.property_class ?? 'multifamily';
          const m39Ranking = peerIntelligenceService.computeDualRanking(
            submarketId, m39AssetClass, 1,
          );
          const topPeerMetrics =
            m39Ranking.competitors[0]?.recentMetrics ??
            m39Ranking.analogs[0]?.recentMetrics ??
            null;
          if (topPeerMetrics) {
            if (topPeerMetrics.rentGrowth != null)        peerSetValues['rent_growth_yr1']   = topPeerMetrics.rentGrowth;
            if (topPeerMetrics.renewalRate != null)       peerSetValues['renewal_rate']       = topPeerMetrics.renewalRate;
            if (topPeerMetrics.turnoverRate != null)      peerSetValues['turnover_rate']      = topPeerMetrics.turnoverRate;
            if (topPeerMetrics.daysVacantMedian != null)  peerSetValues['days_vacant_median'] = topPeerMetrics.daysVacantMedian;
          }
        } catch {
          // M39 enrichment non-fatal
        }
      }
      subjectHistory = {
        tier:               row.tier as SubjectHistoryRecord['tier'],
        snapshot_count:     row.snapshot_count,
        coverage_months:    row.coverage_months != null ? parseFloat(row.coverage_months) : null,
        current_state:      row.current_state ?? null,
        observed_dynamics:  row.observed_dynamics ?? null,
        confidence_weights: (row.confidence_weights ?? {}) as SubjectHistoryRecord['confidence_weights'],
        peer_collisions:    (row.peer_collisions ?? []) as SubjectHistoryRecord['peer_collisions'],
        peer_set_values:    peerSetValues,
        updated_at:         row.updated_at,
      };
    }
  } catch {
    // subject_traffic_history table may not exist in older envs — graceful fallback
    subjectHistory = null;
  }
  return subjectHistory;
}

export function composeOtherIncomeBreakdown(
  dealData: Record<string, any>,
  year1Data: Record<string, any> | null
): OtherIncomeBreakdownPayload | null {
  const rrOI = (dealData?.extraction_rent_roll?.other_income_monthly &&
    typeof dealData.extraction_rent_roll.other_income_monthly === 'object')
    ? dealData.extraction_rent_roll.other_income_monthly as Record<string, unknown>
    : null;
  const omOI = (dealData?.extraction_om?.other_income_monthly &&
    typeof dealData.extraction_om.other_income_monthly === 'object')
    ? dealData.extraction_om.other_income_monthly as Record<string, unknown>
    : null;
  const t12Total = (typeof dealData?.extraction_t12?.other_income?.total === 'number')
    ? dealData.extraction_t12.other_income.total as number
    : null;
  const seedBreakdown = (year1Data?.other_income_breakdown &&
    typeof year1Data.other_income_breakdown === 'object')
    ? year1Data.other_income_breakdown as Record<string, {
        resolved?: number | null;
        resolution?: string;
        t12?: number | null;
      }>
    : null;

  if (!rrOI && !omOI && !seedBreakdown && t12Total == null) return null;

  // Map UI category â†’ (rrKey, omKey). Rent-roll uses `pet_rent`; OM uses `pet`.
  const CATS: Array<{ cat: string; rr: string; om: string }> = [
    { cat: 'parking', rr: 'parking', om: 'parking' },
    { cat: 'pet', rr: 'pet_rent', om: 'pet' },
    { cat: 'storage', rr: 'storage', om: 'storage' },
    { cat: 'laundry', rr: 'laundry', om: 'laundry' },
    { cat: 'rubs', rr: 'rubs', om: 'rubs' },
    { cat: 'fees', rr: 'fees', om: 'fees' },
    { cat: 'insurance_admin', rr: 'insurance_admin', om: 'insurance_admin' },
    { cat: 'other', rr: 'other', om: 'other' },
  ];
  // OM is positive-by-design: any finite value (including 0) is meaningful.
  const annualOM = (m: Record<string, unknown> | null, k: string): number | null => {
    const v = m?.[k];
    return typeof v === 'number' && Number.isFinite(v) ? v * 12 : null;
  };
  // Rent-roll per-category lines are positive-by-design ancillary buckets.
  // The seeder treats RR â‰¤ 0 as "no data" (PM doesn't track this line, or a
  // write-off is leaking in) and falls through to OM. Mirror that here so
  // the displayed RR column and conflict badge stay consistent with the
  // resolver's actual precedence behavior. Task #519 (composer/seeder parity).
  const annualRR = (m: Record<string, unknown> | null, k: string): number | null => {
    const v = m?.[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
    return v * 12;
  };
  const isConflict = (a: number | null, b: number | null): boolean => {
    if (a == null || b == null) return false;
    const denom = Math.max(Math.abs(a), Math.abs(b));
    if (denom < 1) return false; // both â‰ˆ 0 â€” no meaningful spread
    return Math.abs(a - b) / denom > 0.15;
  };

  // User category overrides written by OtherIncomeTab (Task #1145).
  // Keyed by category; value is annual $/yr; null entry = cleared override.
  const userCatOverrides = (year1Data?.other_income_overrides &&
    typeof year1Data.other_income_overrides === 'object')
    ? year1Data.other_income_overrides as Record<string, number | null>
    : null;

  const rows: OtherIncomeBreakdownRow[] = CATS.map(({ cat, rr, om }) => {
    const rrV = annualRR(rrOI, rr);
    const omV = annualOM(omOI, om);
    const seed = seedBreakdown?.[cat];
    const seedResolved = typeof seed?.resolved === 'number' ? seed.resolved : null;
    const seedResolution = typeof seed?.resolution === 'string' ? seed.resolution : 'unseeded';
    // T-12 has no per-category data in the source extraction. The seeder
    // routes the T-12 aggregate into the `other` bucket as a fallback when
    // RR/OM are empty (Task #519 post-review fix), so surface seed.t12 when
    // it's populated.
    const t12V = typeof seed?.t12 === 'number' && Number.isFinite(seed.t12) ? seed.t12 : null;

    // Apply user category override (Task #1145 — OtherIncomeTab edits).
    // A present non-null entry wins over the seeder-reconciled value.
    const userOvr = userCatOverrides?.[cat] ?? null;
    const resolved   = userOvr != null ? userOvr   : seedResolved;
    const resolution = userOvr != null ? 'user_override' : seedResolution;

    return {
      category: cat,
      rent_roll: rrV,
      t12: t12V,
      om: omV,
      resolved,
      resolution,
      conflict: isConflict(rrV, omV),
    };
  });

  const sumNonNull = (vals: Array<number | null>): number | null => {
    const present = vals.filter((v): v is number => v != null);
    return present.length ? present.reduce((s, v) => s + v, 0) : null;
  };
  const total = {
    rent_roll: sumNonNull(rows.map(r => r.rent_roll)),
    t12: t12Total,
    om: sumNonNull(rows.map(r => r.om)),
    resolved: rows.reduce((s, r) => s + (r.resolved ?? 0), 0),
  };
  return { rows, total };
}

/**
 * Convert `extraction_rent_roll.floor_plan_mix` (the multi-row real per-
 * floorplan output of the rent-roll parser) into the same row shape the
 * legacy `rent_roll` SQL table produces. Applies per-row overrides from
 * `per_year_overrides` (`da:unit_mix:<idx>:in_place_rent` / `:market_rent`).
 *
 * Rows are returned in stable name order so override indices remain stable
 * across reads (so an edit to "1BR/1BA" at idx 2 keeps targeting idx 2).
 */

/**
 * Convert OM-published unit mix rows into the same rent_roll-row shape used
 * downstream by `computeUnitMixDerived` and `buildRentRollSummary`. Applies
 * per-row overrides from `per_year_overrides` so the user can edit OM-only
 * deals the same way they can edit rent-roll-backed deals.
 *
 * Rows are returned in stable name order so override indices remain stable
 * across reads (so an edit at idx 2 keeps targeting the same floor plan).
 */

/**
 * Maps each OSRow field name to the exact deal_monthly_actuals column name.
 * Column list verified against live schema (information_schema.columns).
 */
const TRAILING_FIELD_COL: Record<string, string> = {
  gpr:                 'gross_potential_rent',
  vacancy_loss:        'vacancy_loss',
  loss_to_lease:       'loss_to_lease',
  concessions:         'concessions',
  bad_debt:            'bad_debt',
  net_rental_income:   'net_rental_income',
  other_income:        'other_income',
  egi:                 'effective_gross_income',
  payroll:             'payroll',
  management_fee:      'management_fee',
  utilities:           'utilities',          // actual column; NOT utilities_total
  repairs_maintenance: 'repairs_maintenance',
  turnover:            'turnover_costs',     // actual column; NOT make_ready
  insurance:           'insurance',
  real_estate_tax:     'real_estate_taxes',   // key = OSRow field name; value = DB column name
  total_opex:          'total_opex',         // actual column; NOT total_operating_expenses
  noi:                 'noi',
};

/**
 * Loads the most-recent 12 months of non-budget, non-proforma actuals for a deal
 * and returns an annualised T-1 / T-3 / T-6 value for each mapped OSRow field.
 * Column names are verified against the live deal_monthly_actuals schema.
 * Logs a warning and returns {} on any query failure so upstream rows are
 * untouched (t6/t3/t1 stay null) rather than crashing the financials response.
 *
 * Exported so getDealFinancials in proforma-adjustment.service.ts can reuse
 * the same trailing-actuals enrichment without duplicating the query logic.
 */
export async function loadTrailingActualsMap(
  pool: Pool,
  dealId: string,
): Promise<Record<string, { t6: number | null; t3: number | null; t1: number | null }>> {
  try {
    const res = await pool.query(
      `SELECT
         gross_potential_rent, vacancy_loss, loss_to_lease, concessions, bad_debt,
         net_rental_income, other_income, effective_gross_income,
         payroll, management_fee, utilities, repairs_maintenance, turnover_costs,
         insurance, real_estate_taxes, total_opex, noi
       FROM deal_monthly_actuals
       WHERE deal_id = $1
         AND is_budget = false
         AND is_proforma = false
         AND (
           gross_potential_rent IS NOT NULL
           OR effective_gross_income IS NOT NULL
           OR total_opex IS NOT NULL
           OR noi IS NOT NULL
         )
       ORDER BY report_month DESC
       LIMIT 12`,
      [dealId],
    );
    const rows = res.rows as Record<string, string | null>[];
    if (rows.length === 0) return {};

    const annualise = (sum: number, months: number) => (sum / months) * 12;

    // Intentional: the divisor is always `n` (full window), even when individual
    // months have a null value for a given column.  A null month is treated as
    // a $0 period rather than an excluded period.  This is the conservative choice
    // for underwriting — it prevents sparse data from artificially inflating the
    // annualised figure.  If all months in the slice are null, we return null
    // (no data) rather than $0.
    const sumSlice = (col: string, n: number): number | null => {
      const slice = rows.slice(0, n);
      if (slice.length < n) return null;  // insufficient history for this window
      let total = 0; let hasAny = false;
      for (const row of slice) {
        const v = row[col];
        if (v != null) { total += Number(v); hasAny = true; }
      }
      return hasAny ? annualise(total, n) : null;
    };

    const out: Record<string, { t6: number | null; t3: number | null; t1: number | null }> = {};
    for (const [field, col] of Object.entries(TRAILING_FIELD_COL)) {
      out[field] = {
        t1: rows.length >= 1 ? sumSlice(col, 1) : null,
        t3: rows.length >= 3 ? sumSlice(col, 3) : null,
        t6: rows.length >= 6 ? sumSlice(col, 6) : null,
      };
    }
    return out;
  } catch (err) {
    console.warn('[composer] loadTrailingActualsMap failed (t6/t3/t1 will be null):', (err as Error)?.message ?? err);
    return {};
  }
}

// â”€â”€ Helper: Capsule aggregates fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// When no rent_roll rows exist, pull aggregates from deal_capsules.deal_data
// (sourced from OM extraction) so the synthesized Default unit-mix row carries
// real units / avg rent / occupancy / avg SF instead of all-null cells.

/**
 * Load the `extraction_rent_roll` capsule payload (parsed rent-roll output).
 * This is the real per-floorplan mix + per-unit detail produced by the rent-
 * roll parser. Returns `null` when no rent roll has been processed for the
 * deal yet â€” callers should then fall back to capsule aggregates / OM data.
 */
export async function loadExtractionRentRoll(pool: Pool, dealId: string): Promise<ExtractionRentRollPayload | null> {
  // The rent-roll parser writes its output to `deals.deal_data.extraction_rent_roll`
  // via the data-router (see data-router.ts: persistRentRollExtraction). The
  // capsule (`deal_capsules`) only carries the capsule aggregates that are
  // computed from broker_claims + extraction_*; the per-unit rent roll is NOT
  // mirrored there. So we must read straight from the `deals` row.
  let dealRes;
  try {
    dealRes = await pool.query(
      `SELECT deal_data FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadExtractionRentRoll] deals lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = dealRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;
  const err = (dd.extraction_rent_roll && typeof dd.extraction_rent_roll === 'object')
    ? dd.extraction_rent_roll
    : null;
  if (!err) return null;
  // Treat the payload as present only when there's something usable
  // (a floor plan mix OR per-unit list OR aggregates).
  const fpm = (err.floor_plan_mix && typeof err.floor_plan_mix === 'object') ? err.floor_plan_mix : null;
  const units = Array.isArray(err.units) ? err.units : null;
  if (!fpm && !units && err.total_units == null) return null;
  return {
    totalUnits: typeof err.total_units === 'number' ? err.total_units : null,
    occupiedUnits: typeof err.occupied_units === 'number' ? err.occupied_units : null,
    vacantUnits: typeof err.vacant_units === 'number' ? err.vacant_units : null,
    asOfDate: typeof err.as_of_date === 'string' ? err.as_of_date : null,
    sourceRef: typeof err.source_ref === 'string' ? err.source_ref : null,
    otherIncomeMonthly: (err.other_income_monthly && typeof err.other_income_monthly === 'object')
      ? err.other_income_monthly : null,
    expirationCurve: (err.expiration_curve && typeof err.expiration_curve === 'object')
      ? err.expiration_curve : null,
    expirationExtractionStatus: (err.expiration_extraction_status === 'ok'
      || err.expiration_extraction_status === 'partial'
      || err.expiration_extraction_status === 'failed')
      ? err.expiration_extraction_status : null,
    columnCoverage: (err.column_coverage && typeof err.column_coverage === 'object')
      ? err.column_coverage : null,
    humanReviewNeeded: err.human_review_needed === true,
    floorPlanMix: fpm,
    units,
  };
}
