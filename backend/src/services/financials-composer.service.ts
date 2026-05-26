/**
 * financials-composer.service.ts
 *
 * Composes the full F9DealFinancials shape for the /api/v1/deals/:dealId/financials endpoint.
 * Queries multiple DB tables to populate operating statement rows, rent roll summary,
 * traffic projection, assumptions, capital stack, and other fields the frontend expects.
 */
import { Pool } from 'pg';
import { seedProFormaYear1 } from './proforma-seeder.service';
import { amortizeConcessions } from './concession-amortization/index';
import type {
  ConcessionAmortizationSchedule,
  ConcessionMonthlyDetail,
  DealConcessionRecognition,
  ConcessionRecord,
} from '../types/concessions';
import { RentRollDiffService } from './rent-roll/rent-roll-diff.service';
import { peerIntelligenceService } from './sigma/peer-intelligence';
import { calibrationLedger } from './sigma/calibration-ledger';
import { randomUUID } from 'crypto';

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

export interface OSRow {
  field: string;
  label: string;
  broker: number | null;
  platform: number | null;
  t12: number | null;
  t6: number | null;
  t3: number | null;
  t1: number | null;
  rentRoll: number | null;
  taxBill: number | null;
  resolved: number | null;
  resolution: string | null;
  perUnit: number | null;
  source?: string | null;
  confidence?: number | null;
  benchmarkPosition: 'above' | 'below' | 'within' | null;
}

export interface IntegrityCheck {
  id: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: Record<string, unknown>;
}

export interface ComposedFinancials {
  dealId: string;
  dealName: string;
  totalUnits: number;
  proforma: {
    year1: OSRow[];
    integrityChecks: IntegrityCheck[];
    unitEconomics: Record<string, number | null>;
    valuationSnapshot: Record<string, unknown> | null;
  };
  returns: any;
  capitalStack: any;
  rentRollSummary: any;
  trafficProjection: any;
  assumptions: any;
  userOverrides: Record<string, any>;
  meta: { seeded: boolean; updatedAt: string | null };
  taxes: any;
  debt: any;
  sourcesUses: any;
  waterfall: any;
  projections: any;
  capital: any;
  /**
   * Raw `extraction_rent_roll` capsule payload when present. Carries
   * `units[]` (per-unit drill-down), `other_income_monthly` (real ancillary
   * breakdown), `expiration_curve` (deal-wide), and `floor_plan_mix` (with
   * per-floorplan expiration curves). The frontend uses this to render the
   * Ancillary panel and the Per-Unit drill-down without re-fetching.
   */
  extractionRentRoll: ExtractionRentRollPayload | null;
  /**
   * Per-category ancillary income reconciliation: rent-roll, T-12 (aggregate
   * only â€” `t12` only set on the synthetic 'total' row), and OM broker
   * pro-forma side-by-side with the seeder's resolved value, source, and
   * conflict flag (>15% spread between any two non-null sources). Surfaces
   * `extraction_om.other_income_monthly` + `extraction_rent_roll.other_income_monthly`
   * + `extraction_t12.other_income.total`. Task #519.
   */
  otherIncomeBreakdown: OtherIncomeBreakdownPayload | null;
  /**
   * Subject property traffic history â€” M07 Â§6.
   * Null until the first rent roll has been uploaded and S1 aggregation run.
   * Populated from subject_traffic_history via composeDealFinancials().
   */
  subjectHistory: SubjectHistoryRecord | null;
  /** User-added ancillary lines (custom labels). Task #519. */
  otherIncomeUserLines: Array<{
    id: string;
    label: string;
    monthly: number;
    note?: string;
    created_by?: string;
    created_at: string;
    updated_at?: string;
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  }>;
  /**
   * Concession amortization recognition schedule — populated by the
   * ConcessionAmortizationEngine when ConcessionRecord[] are available.
   * Null until Task #573 wires LV engine output → concession_records[].
   *
   * EARNED-VS-RECOGNIZED-DISTINCTION (§14):
   *   This field holds "recognized" dollars only. Never display
   *   concession_recognition values in the same row as earned (cash_value) amounts.
   *
   * Recomputed on: LV engine output update, leasing_cost_treatment change,
   *   subject_history update, fiscal_year_start_month change (24h cache per DealContext rules).
   */
  concessionRecognition: DealConcessionRecognition | null;
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

export async function composeDealFinancials(
  pool: Pool,
  dealId: string,
  userId: string
): Promise<{ success: boolean; data: ComposedFinancials }> {
  // 1. Load deal row
  const dealRes = await pool.query(
    `SELECT id, name, deal_data, operator_stance, project_type, target_units,
            unit_count, city, state_code AS state,
            deal_data->>'submarketId'   AS submarket_id,
            deal_data->>'property_class' AS property_class,
            (deal_data->>'year_built')::int AS year_built,
            deal_data->>'msaId'         AS msa_id
     FROM deals WHERE id = $1 AND user_id = $2`,
    [dealId, userId]
  );
  const deal = dealRes.rows[0];
  if (!deal) {
    throw new Error(`Deal ${dealId} not found or not accessible by user`);
  }
  const dealData = typeof deal.deal_data === 'object' && deal.deal_data ? deal.deal_data : {};
  // ── Operator Stance: leasingCostTreatment wins over legacy deal_data field ──
  // operator_stance is the canonical write location (StanceTab → PUT /stance).
  // deal_data.leasing_cost_treatment is the legacy field; kept as fallback only.
  const _dealOperatorStance = typeof deal.operator_stance === 'object' && deal.operator_stance
    ? deal.operator_stance as Record<string, any>
    : {} as Record<string, any>;
  const _VALID_LCT = ['OPERATING', 'CAPITALIZED', 'HYBRID'] as const;
  const effectiveLct: 'OPERATING' | 'CAPITALIZED' | 'HYBRID' =
    _VALID_LCT.includes(_dealOperatorStance?.leasingCostTreatment)
      ? _dealOperatorStance.leasingCostTreatment as 'OPERATING' | 'CAPITALIZED' | 'HYBRID'
      : _VALID_LCT.includes((dealData as any)?.leasing_cost_treatment)
        ? (dealData as any).leasing_cost_treatment as 'OPERATING' | 'CAPITALIZED' | 'HYBRID'
        : 'OPERATING';
  // Inject into dealData so computeConcessionRecognition reads the correct source.
  (dealData as any).leasing_cost_treatment = effectiveLct;
  const totalUnits = deal.target_units || deal.unit_count || (dealData?.units) || 0;
  const purchasePrice = dealData?.purchase_price || dealData?.asking_price || null;
  const brokerClaims = dealData?.broker_claims && typeof dealData.broker_claims === 'object' ? dealData.broker_claims as Record<string, any> : {};
  const brokerProforma = brokerClaims.proforma && typeof brokerClaims.proforma === 'object' ? brokerClaims.proforma as Record<string, any> : null;
  const extractionOm = dealData?.extraction_om && typeof dealData.extraction_om === 'object' ? dealData.extraction_om as Record<string, any> : null;

  // 2. Load year1 proforma JSON.
  // P0 fix (Task #869): prefer the active underwriting scenario (canonical
  // write target for the cashflow agent) so agent-computed values reach F9.
  // Falls back to deal_assumptions.year1 for deals that pre-date the scenario
  // layer or that have no active scenario row.
  //
  // Error policy: scenario query failures are logged at ERROR level and
  // counted in the telemetry note below — they do NOT silently degrade to
  // deal_assumptions without a trace, so data-source regressions are visible.
  type ScenRow = { year1: unknown };
  type ScenResult = { rows: ScenRow[] };
  const EMPTY_SCEN: ScenResult = { rows: [] };

  const [scenRes, assRes] = await Promise.all([
    pool.query<ScenRow>(
      `SELECT year1 FROM deal_underwriting_scenarios
        WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL
        LIMIT 1`,
      [dealId]
    ).catch((err: unknown) => {
      logger.error('[composer][P0] scenario year1 query failed; falling back to deal_assumptions', {
        dealId, error: err instanceof Error ? err.message : String(err),
      });
      return EMPTY_SCEN;
    }),
    pool.query(
      `SELECT year1, source_type, source_date, updated_at FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    ),
  ]);
  const year1Row = assRes.rows[0] ?? null;
  let year1Data = scenRes.rows[0]?.year1 ?? year1Row?.year1 ?? null;

  // Lazy seed: if no year1 data exists, seed from extraction capsules.
  if (!year1Data && totalUnits > 0) {
    try {
      await seedProFormaYear1(pool, dealId);
      // Re-read after seeding — scenario is preferred if it now exists.
      const [retrySc, retryDa] = await Promise.all([
        pool.query<ScenRow>(
          `SELECT year1 FROM deal_underwriting_scenarios
            WHERE deal_id = $1 AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`,
          [dealId]
        ).catch((err: unknown) => {
          logger.error('[composer][P0] post-seed scenario re-read failed; falling back to deal_assumptions', {
            dealId, error: err instanceof Error ? err.message : String(err),
          });
          return EMPTY_SCEN;
        }),
        pool.query(
          `SELECT year1 FROM deal_assumptions WHERE deal_id = $1 LIMIT 1`,
          [dealId]
        ),
      ]);
      year1Data = retrySc.rows[0]?.year1 ?? retryDa.rows[0]?.year1 ?? null;
    } catch (seedErr: any) {
      console.warn('[composer] Lazy seed failed (non-fatal):', seedErr?.message ?? seedErr);
    }
  }

  // 3. Load rent_roll rows (table may not exist)
  let rentRollRows: any[] = [];
  try {
    const rrRes = await pool.query(
      `SELECT type, count, avg_sqft, in_place_rent, market_rent,
              occupancy_pct, concession_pct
       FROM rent_roll WHERE deal_id = $1 ORDER BY type`,
      [dealId]
    );
    rentRollRows = rrRes.rows;
  } catch {
    // rent_roll table may not exist yet â€” graceful fallback
    rentRollRows = [];
  }

  // 3a. ALWAYS load `extraction_rent_roll` capsule when present, regardless
  // of whether SQL rent-roll rows exist. The UI consumes this payload
  // independently for ancillary income (other_income_monthly), per-unit
  // drill-down (units array), and expiration curves â€” even when SQL rows
  // win the unit-mix derivation tier. Without this decoupling, a deal that
  // has both legacy SQL rent_roll AND a fresh extraction would lose
  // ancillary/per-unit features in the UI.
  const extractionRentRoll = await loadExtractionRentRoll(pool, dealId);
  // Also load capsule aggregates when an extraction is present but its
  // `floor_plan_mix` is empty/malformed â€” in that case the extraction can
  // still hand us aggregates (otherIncomeMonthly, expirationCurve, totals)
  // but we need OM-level fallbacks to render the Default row. Without this,
  // an extraction with units:[] and {} floor_plan_mix would leave
  // derivationRows undefined and crash buildOSRows downstream.
  const extractionHasFloorPlanMix = !!(
    extractionRentRoll &&
    extractionRentRoll.floorPlanMix &&
    Object.keys(extractionRentRoll.floorPlanMix).length > 0
  );
  // Tier 3: OM-extracted per-floorplan unit mix. The OM parser writes a
  // multi-row table to `deals.deal_data.extraction_om.unit_mix` whenever the
  // broker published one. We use it ONLY when no rent-roll source upstream
  // produced floor plan rows â€” otherwise it would silently override real
  // rent-roll truth with broker marketing.
  const omUnitMix = (rentRollRows.length === 0 && !extractionHasFloorPlanMix)
    ? await loadOmUnitMix(pool, dealId)
    : null;
  const capsuleAggregates = (rentRollRows.length === 0 && !extractionHasFloorPlanMix && (!omUnitMix || omUnitMix.length === 0))
    ? await loadCapsuleAggregates(pool, dealId)
    : null;

  // 4. Load per-deal flag and per_year_overrides (controls GPR mode AND carries
  // per-row rent overrides written by PATCH /financials/override under keys
  // `da:unit_mix:<idx>:in_place_rent` / `da:unit_mix:<idx>:market_rent`).
  let useUnitMixForGpr = false;
  let pyOvs: Record<string, { value: unknown }> = {};
  try {
    const flagRes = await pool.query(
      `SELECT per_year_overrides FROM deal_assumptions WHERE deal_id = $1`,
      [dealId]
    );
    pyOvs = flagRes.rows[0]?.per_year_overrides ?? {};
    useUnitMixForGpr = pyOvs?.['da:use_unit_mix_for_gpr']?.value === true;
  } catch {
    useUnitMixForGpr = false;
  }

  const readUnitMixOverride = (idx: number) => ({
    inPlace: numOrNull(pyOvs?.[`da:unit_mix:${idx}:in_place_rent`]?.value),
    market:  numOrNull(pyOvs?.[`da:unit_mix:${idx}:market_rent`]?.value),
  });

  // Back-compat shorthand for the synthesized Default row (idx 0).
  const ovIdx0 = readUnitMixOverride(0);
  const ovInPlace = ovIdx0.inPlace;
  const ovMarket  = ovIdx0.market;

  // 4a. Pre-compute unit mix derived revenue items (used by both buildOSRows
  // and buildRentRollSummary). Tier ordering:
  //   1. legacy `rent_roll` SQL rows (multi-row, takes precedence)
  //   2. `extraction_rent_roll.floor_plan_mix` (multi-row, real per-floorplan)
  //   3. capsule single-row aggregate (OM averages)
  // Each tier is fed through the SAME derivation pipeline so revenue rows
  // resolved by `buildOSRows` (gpr/vacancy/loss-to-lease) cannot drift from
  // what the F9 Unit Mix tab displays.
  let derivationRows: any[];
  let extractionDerivationRows: any[] | null = null;
  let omDerivationRows: any[] | null = null;
  if (rentRollRows.length > 0) {
    derivationRows = rentRollRows;
  } else if (extractionRentRoll && extractionRentRoll.floorPlanMix && Object.keys(extractionRentRoll.floorPlanMix).length > 0) {
    extractionDerivationRows = extractionFloorPlanToRentRollRows(extractionRentRoll, readUnitMixOverride);
    derivationRows = extractionDerivationRows;
  } else if (omUnitMix && omUnitMix.length > 0) {
    omDerivationRows = omUnitMixToRentRollRows(omUnitMix, readUnitMixOverride);
    derivationRows = omDerivationRows;
  } else if (capsuleAggregates || ovInPlace != null || ovMarket != null) {
    derivationRows = [{
      type: 'Default',
      count: capsuleAggregates?.units ?? (totalUnits > 0 ? totalUnits : 0),
      avg_sqft: capsuleAggregates?.avgSf ?? null,
      // User overrides take precedence; otherwise capsule avgRent. Mirror to
      // the other column so loss-to-lease is zero (no phantom gap).
      in_place_rent: ovInPlace ?? capsuleAggregates?.avgRent ?? null,
      market_rent:   ovMarket  ?? ovInPlace ?? capsuleAggregates?.avgRent ?? null,
      occupancy_pct: capsuleAggregates?.occupancyPct ?? null,
      concession_pct: null,
    }];
  } else {
    derivationRows = [];
  }
  const unitMixDerived = computeUnitMixDerived(derivationRows);

  // Pass the same overrides to the summary builder so the Default row in the
  // Unit Mix tab reflects user edits even when no rent_roll row was inserted.
  // Only relevant when we actually fall back to the synthesized Default row
  // (no rent-roll, no extraction, no OM unit mix).
  const synthesizedOverrides = (rentRollRows.length === 0 && extractionDerivationRows == null && omDerivationRows == null)
    ? { inPlaceRent: ovInPlace, marketRent: ovMarket }
    : null;

  // 5. Build operating statement rows
  const year1Rows: OSRow[] = buildOSRows(year1Data, totalUnits, purchasePrice, rentRollRows, unitMixDerived, useUnitMixForGpr, brokerProforma, extractionOm);

  // 5b. Enrich rows with trailing-period actuals (T-6, T-3, T-1) from deal_monthly_actuals.
  //     Falls back gracefully (rows unchanged) when no actuals exist for a deal.
  const trailingMap = await loadTrailingActualsMap(pool, dealId);
  for (const row of year1Rows) {
    const ta = trailingMap[row.field];
    if (ta) {
      row.t6 = ta.t6;
      row.t3 = ta.t3;
      row.t1 = ta.t1;
    }
  }

  // 6. Build integrity checks
  const integrityChecks: IntegrityCheck[] = buildIntegrityChecks(year1Data, totalUnits, year1Rows, dealData);

  // 7. Build unit economics
  const unitEconomics = buildUnitEconomics(year1Rows, totalUnits);

  // 8. Build valuation snapshot
  const valuationSnapshot = buildValuationSnapshot(purchasePrice, totalUnits, year1Rows, deal);

  // 9. Build rent roll summary
  const rentRollSummary = buildRentRollSummary(
    rentRollRows, totalUnits, unitMixDerived, useUnitMixForGpr,
    capsuleAggregates, synthesizedOverrides,
    extractionRentRoll, extractionDerivationRows,
    omDerivationRows,
  );

  // 10. Build traffic projection
  const trafficProjection = buildTrafficProjection();

  // 11. Build assumptions (pass pyOvs so growth-rate overrides are reflected)
  const assumptions = buildAssumptions(year1Data, pyOvs);

  // 12. Build capital stack
  const capitalStack = buildCapitalStack(purchasePrice, year1Data);

  // 13. Load M07 subject traffic history (non-fatal â€” null when no rent roll uploaded)
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
      // Load deal-scoped platform peer-set posteriors using scope degradation
      // identical to CoefficientResolverService.loadPlatformCoefficients().
      // This ensures the Peer SET column in the UI reflects the same peer
      // context the resolver used when computing the blended effective value.
      let peerSetValues: Record<string, number> = {};
      try {
        peerSetValues = await loadDealScopedPeerPosteriors(pool, deal);
      } catch {
        // Platform posteriors not available — peer column stays empty for non-collision rows
      }
      // M39: enrich peer_set_values with top-peer traffic/leasing metrics from
      // the peer intelligence engine. Writes to canonical F9 keys consumed by
      // ProjectionsTab and InlineAssumptionBlock:
      //   renewal_rate, turnover_rate, days_vacant_median, rent_growth_yr1.
      // Uses competitor recentMetrics as primary source, falls back to analog.
      // recentMetrics are populated from the candidate's registered character.
      // Non-fatal — engine may have no registered characters.
      if (deal.submarket_id) {
        try {
          const m39AssetClass = deal.property_class ?? 'multifamily';
          const m39Ranking = peerIntelligenceService.computeDualRanking(
            deal.submarket_id, m39AssetClass, 1,
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
    // subject_traffic_history table may not exist in older envs â€” graceful fallback
    subjectHistory = null;
  }

  const concessionRecognition = await computeConcessionRecognition(pool, dealId, dealData);

  // End 1 — P&L concessions line responds to leasingCostTreatment (operator-stance phase 2).
  // When CAPITALIZED: all lease-up concessions bypass P&L → 0 on operating statement.
  // When HYBRID: P&L portion = resolved total minus the capitalized lease-up amount.
  // OPERATING: no change (default path, concessions already resolved from year1Data).
  if (effectiveLct === 'CAPITALIZED' || effectiveLct === 'HYBRID') {
    const concRow = year1Rows.find(r => r.field === 'concessions');
    if (concRow) {
      if (effectiveLct === 'CAPITALIZED') {
        concRow.resolved = 0;
      } else {
        // HYBRID: subtract capitalized one-time concessions from the P&L line.
        const capitalized = concessionRecognition?.capitalized_lease_up_total ?? 0;
        concRow.resolved = Math.max(0, (concRow.resolved ?? 0) - capitalized);
      }
      concRow.resolution = 'treatment_adjusted';
      concRow.source = 'stance';
    }
  }

  // M38: record non-blocking calibration predictions for Year-1 NOI, occupancy,
  // and rent growth after every successful compose. Fire-and-forget — never
  // throws or blocks the response.
  const m38NoiRow  = year1Rows.find(r => r.field === 'noi');
  const m38GprRow  = year1Rows.find(r => r.field === 'gpr');
  const m38VacRow  = year1Rows.find(r => r.field === 'vacancy_loss');
  const m38Noi     = m38NoiRow?.resolved ?? null;
  const m38Gpr     = m38GprRow?.resolved ?? null;
  const m38Vac     = m38VacRow?.resolved ?? null;
  // Occupancy = 1 - (|vacancyLoss| / gpr) when both are available and gpr > 0
  const m38Occupancy = (m38Gpr != null && m38Gpr > 0 && m38Vac != null)
    ? 1 - Math.abs(m38Vac) / m38Gpr
    : null;
  const m38RentGrowth: number | null = year1Data?.rentGrowthRate ?? null;
  if (m38Noi != null) {
    setImmediate(() => {
      const now = new Date();
      const realizationTargetDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const baseSource = {
        module: 'M38.financials-composer',
        version: '1.0.0',
        dealId,
        submarketId: deal.submarket_id ?? undefined,
      };
      const assetClass = deal.property_class ?? 'multifamily';
      try {
        calibrationLedger.recordPrediction({
          predictionId: randomUUID(),
          emittedAt: now,
          source: baseSource,
          metric: 'noi_year1',
          assetClass,
          regimeAtPrediction: 'expansion',
          predictionType: 'point_with_ci',
          pointEstimate: m38Noi,
          ciLevels: [
            { level: 0.80, low: m38Noi * 0.90, high: m38Noi * 1.10 },
            { level: 0.90, low: m38Noi * 0.85, high: m38Noi * 1.15 },
          ],
          realizationHorizonMonths: 12,
          realizationTargetDate,
          context: { rationaleSummary: 'Year-1 NOI from pro-forma compose (M38)' },
        });
      } catch { /* non-fatal */ }
      if (m38Occupancy != null) {
        try {
          calibrationLedger.recordPrediction({
            predictionId: randomUUID(),
            emittedAt: now,
            source: baseSource,
            metric: 'occupancy_year1',
            assetClass,
            regimeAtPrediction: 'expansion',
            predictionType: 'point_with_ci',
            pointEstimate: m38Occupancy,
            ciLevels: [
              { level: 0.80, low: m38Occupancy - 0.04, high: Math.min(1, m38Occupancy + 0.04) },
              { level: 0.90, low: m38Occupancy - 0.06, high: Math.min(1, m38Occupancy + 0.06) },
            ],
            realizationHorizonMonths: 12,
            realizationTargetDate,
            context: { rationaleSummary: 'Year-1 occupancy derived from vacancy_loss/gpr (M38)' },
          });
        } catch { /* non-fatal */ }
      }
      if (m38RentGrowth != null) {
        try {
          calibrationLedger.recordPrediction({
            predictionId: randomUUID(),
            emittedAt: now,
            source: baseSource,
            metric: 'rent_growth_yr1',
            assetClass,
            regimeAtPrediction: 'expansion',
            predictionType: 'point_with_ci',
            pointEstimate: m38RentGrowth,
            ciLevels: [
              { level: 0.80, low: m38RentGrowth - 0.01, high: m38RentGrowth + 0.01 },
              { level: 0.90, low: m38RentGrowth - 0.015, high: m38RentGrowth + 0.015 },
            ],
            realizationHorizonMonths: 12,
            realizationTargetDate,
            context: { rationaleSummary: 'Year-1 rent growth assumption from pro-forma (M38)' },
          });
        } catch { /* non-fatal */ }
      }
    });
  }

  return {
    success: true,
    data: {
      dealId,
      dealName: deal.name || 'Untitled Deal',
      totalUnits,
      proforma: {
        year1: year1Rows,
        integrityChecks,
        unitEconomics,
        valuationSnapshot,
      },
      returns: null,
      capitalStack,
      rentRollSummary,
      trafficProjection,
      assumptions,
      userOverrides: {},
      meta: {
        seeded: assRes.rows.length > 0,
        updatedAt: year1Row?.updated_at ?? null,
      },
      taxes: null,
      debt: null,
      sourcesUses: null,
      waterfall: null,
      projections: buildProjections(year1Rows, totalUnits, year1Data, purchasePrice, null),
      capital: null,
      extractionRentRoll,
      subjectHistory,
      otherIncomeBreakdown: composeOtherIncomeBreakdown(dealData, year1Data),
      otherIncomeUserLines: Array.isArray(year1Data?.other_income_user_lines)
        ? year1Data.other_income_user_lines
        : [],
      concessionRecognition,
    },
  };
}


/**
 * 24-hour TTL for the concession_recognition cache stored in deal_data.
 *
 * Recompute triggers (§572 step 6):
 *   - leasing_cost_treatment change → different treatment key forces stale
 *   - fiscal_year_start_month change → different key forces stale
 *   - concession_records update → LV engine writes new records to deal_data (Task #573)
 *   - subject_history update → next composeDealFinancials call re-checks staleness
 *   Any of these changes land in deal_data before composeDealFinancials runs, so the
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

async function computeConcessionRecognition(
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
    // composeDealFinancials, so the cache and the current treatment can diverge.
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
function extractionFloorPlanToRentRollRows(
  extraction: ExtractionRentRollPayload,
  readOverride: (idx: number) => { inPlace: number | null; market: number | null },
): any[] {
  const fpEntries = Object.entries(extraction.floorPlanMix ?? {})
    .sort(([a], [b]) => a.localeCompare(b));
  return fpEntries.map(([type, fp], idx) => {
    const ov = readOverride(idx);
    return {
      type,
      count: fp.count ?? 0,
      avg_sqft: fp.avg_sqft ?? null,
      in_place_rent: ov.inPlace ?? (fp.avg_effective_rent > 0 ? fp.avg_effective_rent : null),
      market_rent:   ov.market  ?? (fp.avg_market_rent    > 0 ? fp.avg_market_rent    : null),
      occupancy_pct: fp.occupancy_pct ?? null,
      concession_pct: null,
      // Originals retained so the UI can display the pre-edit value in the
      // OVR badge / reset affordance.
      _originalInPlace: fp.avg_effective_rent > 0 ? fp.avg_effective_rent : null,
      _originalMarket:  fp.avg_market_rent    > 0 ? fp.avg_market_rent    : null,
      _inPlaceOverridden: ov.inPlace != null,
      _marketOverridden:  ov.market != null,
      _expirationCurve: fp.expiration_curve ?? null,
      _expirationExtractionStatus: fp.expiration_extraction_status ?? null,
    };
  });
}

/**
 * Convert OM-published unit mix rows into the same rent_roll-row shape used
 * downstream by `computeUnitMixDerived` and `buildRentRollSummary`. Applies
 * per-row overrides from `per_year_overrides` so the user can edit OM-only
 * deals the same way they can edit rent-roll-backed deals.
 *
 * Rows are returned in stable name order so override indices remain stable
 * across reads (so an edit at idx 2 keeps targeting the same floor plan).
 */
function omUnitMixToRentRollRows(
  rows: Array<{ floorplan: string; count: number | null; avgSf: number | null; marketRent: number | null; inPlaceRent: number | null }>,
  readOverride: (idx: number) => { inPlace: number | null; market: number | null },
): any[] {
  const sorted = [...rows].sort((a, b) => a.floorplan.localeCompare(b.floorplan));
  return sorted.map((r, idx) => {
    const ov = readOverride(idx);
    const inPlaceOriginal = (r.inPlaceRent != null && r.inPlaceRent > 0) ? r.inPlaceRent : null;
    const marketOriginal  = (r.marketRent  != null && r.marketRent  > 0) ? r.marketRent  : null;
    return {
      type: r.floorplan,
      count: r.count ?? 0,
      avg_sqft: r.avgSf,
      // OM "in place" is the broker's published "current/avg" rent; when the
      // OM only published a single rent column, mirror it to in-place so the
      // tab shows a usable row instead of all nulls.
      in_place_rent: ov.inPlace ?? inPlaceOriginal ?? marketOriginal,
      market_rent:   ov.market  ?? marketOriginal  ?? inPlaceOriginal,
      occupancy_pct: null,
      concession_pct: null,
      _originalInPlace: inPlaceOriginal,
      _originalMarket: marketOriginal,
      _inPlaceOverridden: ov.inPlace != null,
      _marketOverridden:  ov.market  != null,
      _expirationCurve: null,
      _source: 'extraction_om',
    };
  });
}

// â”€â”€ Helper: Build operating statement rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function buildOSRows(
  y1: any,
  totalUnits: number,
  _purchasePrice: number | null,
  _rentRollRows: any[],
  unitMixDerived: UnitMixDerived,
  useUnitMixForGpr: boolean,
  brokerProforma: Record<string, any> | null = null,
  extractionOm: Record<string, any> | null = null
): OSRow[] {
  const rows: OSRow[] = [];

  function addRow(
    field: string,
    label: string,
    resolved: number | null,
    opts?: {
      broker?: number | null;
      platform?: number | null;
      t12?: number | null;
      rentRoll?: number | null;
      taxBill?: number | null;
      source?: string;
      resolution?: string;
      isSubtotal?: boolean;
    }
  ) {
    const r: OSRow = {
      field,
      label,
      broker: opts?.broker ?? null,
      platform: opts?.platform ?? null,
      t12: opts?.t12 ?? null,
      t6: null,
      t3: null,
      t1: null,
      rentRoll: opts?.rentRoll ?? null,
      taxBill: opts?.taxBill ?? null,
      resolved,
      resolution: opts?.resolution ?? (resolved != null ? 'proforma' : 'unseeded'),
      perUnit: totalUnits > 0 && resolved != null ? resolved / totalUnits : null,
      source: opts?.source ?? 'platform',
      confidence: resolved != null ? 0.5 : null,
      benchmarkPosition: null,
    };
    if (opts?.isSubtotal) {
      r.resolution = 'aggregated';
      r.source = 'computed';
    }
    rows.push(r);
  }

  if (!y1) {
    addRow('gpr', 'Gross Potential Rent', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('vacancy_loss', 'Vacancy Loss', null, { resolution: 'unseeded' });
    addRow('loss_to_lease', 'Loss to Lease', null, { resolution: 'unseeded' });
    addRow('concessions', 'Concessions', null, { resolution: 'unseeded' });
    addRow('bad_debt', 'Bad Debt / Collection Loss', null, { resolution: 'unseeded' });
    addRow('non_revenue_units', 'Non-Revenue Units', null, { resolution: 'unseeded' });
    addRow('net_rental_income', 'Net Rental Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('other_income', 'Other Income', null, { resolution: 'unseeded' });
    addRow('egi', 'Effective Gross Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('total_opex', 'Total Operating Expenses', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('real_estate_taxes', 'Real Estate Taxes', null, { resolution: 'unseeded' });
    addRow('insurance', 'Insurance', null, { resolution: 'unseeded' });
    addRow('utilities', 'Utilities', null, { resolution: 'unseeded' });
    addRow('repairs_maintenance', 'Repairs & Maintenance', null, { resolution: 'unseeded' });
    addRow('management', 'Management', null, { resolution: 'unseeded' });
    addRow('payroll', 'Payroll', null, { resolution: 'unseeded' });
    addRow('marketing', 'Marketing', null, { resolution: 'unseeded' });
    addRow('other_opex', 'Other OpEx', null, { resolution: 'unseeded' });
    addRow('total_opex_sum', 'Total OpEx', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('noi', 'Net Operating Income', null, { isSubtotal: true, resolution: 'unseeded' });
    addRow('debt_service', 'Debt Service', null, { resolution: 'unseeded' });
    addRow('pre_tax_cash_flow', 'Pre-Tax Cash Flow', null, { isSubtotal: true, resolution: 'unseeded' });
    return rows;
  }

  // â”€â”€â”€ LayeredValue extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // year1 stores each field as { resolved, t12, om, rent_roll, tax_bill, platform, override, resolution }.
  // Helpers: lv() returns the LayeredValue object (or empty); res() the resolved number.
  type LV = {
    resolved?: number | null; t12?: number | null; om?: number | null;
    rent_roll?: number | null; tax_bill?: number | null; platform?: number | null;
    override?: number | null; resolution?: string;
  };
  function lv(key: string): LV {
    const v = y1?.[key];
    if (v && typeof v === 'object') return v as LV;
    if (typeof v === 'number') return { resolved: v };  // legacy plain-number fallback
    return {};
  }
  function res(key: string): number | null {
    const v = lv(key);
    return v.resolved ?? v.platform ?? null;
  }

  // â”€â”€â”€ Revenue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mirrors Projections REVENUE block. When useUnitMixForGpr is on AND the unit
  // mix has the relevant data, we resolve from unit mix; otherwise fall back to
  // year1 platform values.

  // Convert percentage-of-GPR fields to dollar amounts
  const gprY1 = res('gpr');
  const pctToDollar = (pctKey: string): number | null => {
    const pct = res(pctKey);
    if (pct == null || gprY1 == null) return null;
    return gprY1 * pct;
  };

  const platformGpr           = gprY1;
  const platformVacancyLoss   = pctToDollar('vacancy_pct');
  const platformL2L           = pctToDollar('loss_to_lease_pct');
  const platformConcessions   = pctToDollar('concessions_pct');
  const platformBadDebt       = pctToDollar('bad_debt_pct');
  const platformNRU           = pctToDollar('non_revenue_units_pct');
  const totalUnitsForOI       = totalUnits || 0;
  const otherIncPerUnitMo     = res('other_income_per_unit');  // monthly per unit
  const platformOtherIncome   = otherIncPerUnitMo != null && totalUnitsForOI > 0
    ? otherIncPerUnitMo * totalUnitsForOI * 12
    : null;

  // Unit-mix-derived values (when available); chooseSource picks per row
  const um = unitMixDerived;
  const useUM = useUnitMixForGpr;

  function chooseSource<T>(umVal: T | null, platformVal: T | null): { resolved: T | null; source: string } {
    if (useUM && umVal != null) return { resolved: umVal, source: 'unit_mix' };
    return { resolved: platformVal, source: 'platform' };
  }

  const gprPick   = chooseSource(um.gprFromUnitMix, platformGpr);
  const vacPick   = chooseSource(um.vacancyLossFromUnitMix, platformVacancyLoss);
  const l2lPick   = chooseSource(um.lossToLeaseFromUnitMix, platformL2L);
  const concPick  = chooseSource(um.concessionsFromUnitMix, platformConcessions);
  const nruPick   = chooseSource<number>(null, platformNRU);

  // F-009 fix: prefer the agent's annual dollar total from other_income_dollars
  // (written by postprocess via revenue.other_income → other_income_dollars mapping)
  // over the per-unit-per-month extraction value × units × 12.
  // If the operator has a manual override on other_income_per_unit, respect it —
  // that override is an explicit annual-basis entry that should not be displaced.
  const oiDollarsLV   = lv('other_income_dollars');
  const oiPerUnitLV   = lv('other_income_per_unit');
  const hasOiOverride = oiPerUnitLV.override != null && typeof oiPerUnitLV.override === 'number' && isFinite(oiPerUnitLV.override);
  const agentOiDollars: number | null =
    !hasOiOverride && oiDollarsLV.resolved != null && typeof oiDollarsLV.resolved === 'number'
      ? oiDollarsLV.resolved
      : null;
  const otherPick = agentOiDollars != null
    ? { resolved: agentOiDollars, source: oiDollarsLV.resolution ?? 'agent' }
    : chooseSource<number>(null, platformOtherIncome);

  // Bad Debt: per spec, T-12 or Rent Roll. Use the LayeredValue's resolution to
  // determine source honestly.
  const badDebtLV = lv('bad_debt_pct');
  const badDebtSource: string = badDebtLV.resolution === 't12' || badDebtLV.resolution === 'rent_roll'
    ? badDebtLV.resolution
    : 'platform';

  // Net Rental Income = GPR âˆ’ Vacancy Loss âˆ’ L2L âˆ’ Concessions âˆ’ Bad Debt âˆ’ NRU
  const nri = (() => {
    if (gprPick.resolved == null) return null;
    return gprPick.resolved
      - (vacPick.resolved   ?? 0)
      - (l2lPick.resolved   ?? 0)
      - (concPick.resolved  ?? 0)
      - (platformBadDebt    ?? 0)
      - (nruPick.resolved   ?? 0);
  })();

  // EGI = NRI + Other Income (prefer year1 stored EGI when present)
  const egiY1 = res('egi');
  const egi = egiY1 ?? (nri != null ? nri + (otherPick.resolved ?? 0) : null);

  // ── Broker OM proforma values ──────────────────────────────────────────────
  // Populated when the deal has extraction_om / broker_claims data from an
  // uploaded Offering Memorandum. All values are null when no OM was extracted.
  //
  // Broker GPR: prefer explicit stabilizedGpr stored in brokerProforma (from OM pro-forma
  // statement), then fall back to sum of unit_mix marketRent × count × 12, then platform GPR.
  const bpStabilizedGpr: number | null =
    brokerProforma?.stabilizedGpr != null ? Number(brokerProforma.stabilizedGpr) : null;
  const omUnitMix: Array<{ count: number | null; marketRent: number | null }> =
    Array.isArray(extractionOm?.unit_mix) ? extractionOm.unit_mix : [];
  const bpGprFromUnitMix: number | null = omUnitMix.length > 0
    ? omUnitMix.reduce((sum, r) => {
        const cnt = r.count != null ? Number(r.count) : 0;
        const rent = r.marketRent != null ? Number(r.marketRent) : 0;
        return sum + cnt * rent * 12;
      }, 0) || null
    : null;
  // Broker other income: prefer stabilizedOtherIncomeAnnual stored in brokerProforma (from OM
  // pro-forma statement), then fall back to extraction_om.other_income_total_monthly × 12.
  const bpOtherIncomeAnnual: number | null =
    brokerProforma?.stabilizedOtherIncomeAnnual != null
      ? Number(brokerProforma.stabilizedOtherIncomeAnnual)
      : extractionOm?.other_income_total_monthly != null
        ? Number(extractionOm.other_income_total_monthly) * 12
        : null;

  const bpGpr      = bpStabilizedGpr ?? bpGprFromUnitMix ?? gprPick.resolved;
  const bpVacPct   = brokerProforma?.stabilizedVacancy  != null ? Number(brokerProforma.stabilizedVacancy)          : null;
  const bpLtlPct   = brokerProforma?.lossToLease        != null ? Number(brokerProforma.lossToLease)                : null;
  const bpConcPct  = brokerProforma?.concessionsPct     != null ? Number(brokerProforma.concessionsPct)             : null;
  const bpBdPct    = brokerProforma?.badDebtPct         != null ? Number(brokerProforma.badDebtPct)                 : null;
  const bpMgmtPct  = brokerProforma?.managementFeePct   != null ? Number(brokerProforma.managementFeePct)           : null;
  const bpResPerUt = brokerProforma?.replacementReservesPerUnit != null ? Number(brokerProforma.replacementReservesPerUnit) : null;
  const bpNOI      = brokerProforma?.yearOneNOI != null ? Number(brokerProforma.yearOneNOI)
                   : brokerProforma?.stabilizedNOI != null ? Number(brokerProforma.stabilizedNOI) : null;

  const bpVacLoss  = bpVacPct  != null && bpGpr != null ? bpVacPct  * bpGpr : null;
  const bpLtlDol   = bpLtlPct  != null && bpGpr != null ? bpLtlPct  * bpGpr : null;
  const bpConcDol  = bpConcPct != null && bpGpr != null ? bpConcPct * bpGpr : null;
  // Broker NRI and EGI — needed for mgmt fee and bad debt derivations.
  const bpNri      = bpGpr != null
    ? bpGpr - (bpVacLoss ?? 0) - (bpLtlDol ?? 0) - (bpConcDol ?? 0)
    : null;
  const bpEgi      = bpNri != null
    ? bpNri + (bpOtherIncomeAnnual ?? 0)
    : null;
  const bpBdDol    = bpBdPct   != null && bpEgi  != null ? bpBdPct   * bpEgi  : null;
  const bpMgmtDol  = bpMgmtPct != null && bpEgi  != null ? bpMgmtPct * bpEgi  : null;
  const bpReserves = bpResPerUt != null && totalUnits > 0 ? bpResPerUt * totalUnits : null;

  // Per-expense-line broker dollar amounts — extracted directly from OM pro-forma statement.
  // Keyed by OSRow field name for lookup in addExpenseRow.
  const bpExpense: Record<string, number | null> = {
    payroll:             brokerProforma?.payrollAnnual            != null ? Number(brokerProforma.payrollAnnual)            : null,
    insurance:           brokerProforma?.insuranceAnnual          != null ? Number(brokerProforma.insuranceAnnual)          : null,
    utilities:           brokerProforma?.utilitiesAnnual          != null ? Number(brokerProforma.utilitiesAnnual)          : null,
    repairs_maintenance: brokerProforma?.repairsMaintenanceAnnual != null ? Number(brokerProforma.repairsMaintenanceAnnual) : null,
    turnover:            brokerProforma?.turnoverAnnual           != null ? Number(brokerProforma.turnoverAnnual)           : null,
    marketing:           brokerProforma?.marketingAnnual          != null ? Number(brokerProforma.marketingAnnual)          : null,
    g_and_a:             brokerProforma?.gAndAAnnual              != null ? Number(brokerProforma.gAndAAnnual)              : null,
    contract_services:   brokerProforma?.contractServicesAnnual   != null ? Number(brokerProforma.contractServicesAnnual)   : null,
    real_estate_taxes:   brokerProforma?.realEstateTaxesAnnual    != null ? Number(brokerProforma.realEstateTaxesAnnual)    : null,
  };
  // Broker total opex: prefer extracted value; derive from bpEgi - bpNOI when both are known.
  const bpTotalOpex = brokerProforma?.totalOpexAnnual != null
    ? Number(brokerProforma.totalOpexAnnual)
    : (bpEgi != null && bpNOI != null ? bpEgi - bpNOI : null);

  // ─── T12 and Platform revenue subtotals ─────────────────────────────────────
  // Compute t12/platform NRI and EGI so the OS subtotal rows show all four
  // columns (broker / t12 / platform / resolved). Opex subtotals are computed
  // later, after mgmtPctLV is defined.
  const t12GprVal       = lv('gpr').t12;
  const t12OtherIncome  = lv('other_income').t12;
  const t12Nri = t12GprVal != null
    ? t12GprVal
      - (lv('vacancy_loss').t12       ?? 0)
      - (lv('loss_to_lease').t12      ?? 0)
      - (lv('concessions').t12        ?? 0)
      - (lv('bad_debt').t12           ?? 0)
      - (lv('non_revenue_units').t12  ?? 0)
    : null;
  const t12Egi = t12Nri != null ? t12Nri + (t12OtherIncome ?? 0) : null;

  const platformNri = platformGpr != null
    ? platformGpr
      - (platformVacancyLoss  ?? 0)
      - (platformL2L          ?? 0)
      - (platformConcessions  ?? 0)
      - (platformBadDebt      ?? 0)
      - (platformNRU          ?? 0)
    : null;
  const platformEgi = platformNri != null ? platformNri + (platformOtherIncome ?? 0) : null;

  addRow('gpr',                'Gross Potential Rent',       gprPick.resolved,    { isSubtotal: true, source: gprPick.source, platform: platformGpr, rentRoll: um.gprFromUnitMix, t12: lv('gpr').t12, broker: bpStabilizedGpr ?? bpGprFromUnitMix });
  addRow('vacancy_loss',       'Vacancy Loss',               vacPick.resolved,    { source: vacPick.source, platform: platformVacancyLoss, rentRoll: um.vacancyLossFromUnitMix, broker: bpVacLoss });
  addRow('loss_to_lease',      'Loss to Lease',              l2lPick.resolved,    { source: l2lPick.source, platform: platformL2L, rentRoll: um.lossToLeaseFromUnitMix, broker: bpLtlDol });
  addRow('concessions',        'Concessions',                concPick.resolved,   { source: concPick.source, platform: platformConcessions, rentRoll: um.concessionsFromUnitMix, broker: bpConcDol });
  addRow('bad_debt',           'Bad Debt / Collection Loss', platformBadDebt,     {
    source: badDebtSource,
    t12:      badDebtSource === 't12'       ? platformBadDebt : null,
    rentRoll: badDebtSource === 'rent_roll' ? platformBadDebt : null,
    broker:   bpBdDol,
  });
  addRow('non_revenue_units',  'Non-Revenue Units',          nruPick.resolved,    { source: nruPick.source, platform: platformNRU });
  addRow('net_rental_income',  'Net Rental Income',          nri,                  { isSubtotal: true, broker: bpNri,  t12: t12Nri,  platform: platformNri });
  addRow('other_income',       'Other Income',               otherPick.resolved,  { source: otherPick.source, platform: platformOtherIncome, broker: bpOtherIncomeAnnual, t12: t12OtherIncome });
  addRow('egi',                'Effective Gross Income',     egi,                  { isSubtotal: true, broker: bpEgi,  t12: t12Egi,  platform: platformEgi });

  // â”€â”€â”€ Expenses (mirrors Projections EXPENSES section) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Helper: emit an expense row pulling resolved + source columns from the LayeredValue.
  function addExpenseRow(field: string, label: string, key: string) {
    const v = lv(key);
    addRow(field, label, v.resolved ?? v.platform ?? null, {
      source:   v.resolution ?? 'platform',
      t12:      v.t12       ?? null,
      rentRoll: v.rent_roll ?? null,
      taxBill:  v.tax_bill  ?? null,
      platform: v.platform  ?? null,
      broker:   bpExpense[field] ?? null,
    });
  }

  addExpenseRow('payroll',             'Payroll / Personnel',       'payroll');
  addExpenseRow('repairs_maintenance', 'Repairs & Maintenance',     'repairs_maintenance');
  addExpenseRow('turnover',            'Turnover / Make-Ready',     'turnover');
  addExpenseRow('contract_services',   'Contract Services',         'contract_services');
  addExpenseRow('marketing',           'Marketing & Leasing',       'marketing');
  addExpenseRow('utilities',           'Utilities',                 'utilities');
  addExpenseRow('g_and_a',             'G&A / Administrative',      'g_and_a');

  // Management Fee: stored as a percent of EGI in year1.management_fee_pct.
  // Convert to a dollar value using the EGI computed above so the row matches Projections.
  const mgmtPctLV = lv('management_fee_pct');
  const mgmtPct = mgmtPctLV.resolved ?? mgmtPctLV.platform ?? null;
  const mgmtFeeDollar = (mgmtPct != null && egi != null) ? mgmtPct * egi : null;
  addRow('management_fee', 'Management Fee', mgmtFeeDollar, {
    source:   mgmtPctLV.resolution ?? 'platform',
    t12:      mgmtPctLV.t12 != null && egi != null ? mgmtPctLV.t12 * egi : null,
    platform: mgmtPctLV.platform != null && egi != null ? mgmtPctLV.platform * egi : null,
    broker:   bpMgmtDol,
  });

  addExpenseRow('insurance',            'Insurance',           'insurance');
  addExpenseRow('real_estate_taxes',    'Real Estate Taxes',   'real_estate_tax');
  addRow('replacement_reserves', 'Replacement Reserves',
    lv('replacement_reserves').resolved ?? lv('replacement_reserves').platform ?? null, {
    source:   lv('replacement_reserves').resolution ?? 'platform',
    t12:      lv('replacement_reserves').t12       ?? null,
    rentRoll: lv('replacement_reserves').rent_roll ?? null,
    taxBill:  lv('replacement_reserves').tax_bill  ?? null,
    platform: lv('replacement_reserves').platform  ?? null,
    broker:   bpReserves,
  });

  // Total OpEx â€” prefer stored value, otherwise sum the rows we just added
  // plus any custom_opex_* GL line items the seeder may have surfaced.
  const storedTotalOpex = res('total_opex');
  const summedOpex = (() => {
    const keys = ['payroll', 'repairs_maintenance', 'turnover', 'contract_services',
                  'marketing', 'utilities', 'g_and_a', 'insurance', 'real_estate_tax',
                  'replacement_reserves', 'amenities', 'office', 'hoa_dues',
                  'personal_property_tax'];
    let sum = 0; let any = false;
    for (const k of keys) {
      const v = res(k);
      if (v != null) { sum += v; any = true; }
    }
    if (mgmtFeeDollar != null) { sum += mgmtFeeDollar; any = true; }
    // Pull in any custom_opex_* GL items not in the canonical list
    if (y1 && typeof y1 === 'object') {
      for (const k of Object.keys(y1)) {
        if (k.startsWith('custom_opex_')) {
          const v = res(k);
          if (v != null) { sum += v; any = true; }
        }
      }
    }
    return any ? sum : null;
  })();

  // ─── T12 and Platform opex subtotals (requires mgmtPctLV, defined above) ────
  const opexExpKeys: string[] = ['payroll', 'repairs_maintenance', 'turnover', 'contract_services',
                                  'marketing', 'utilities', 'g_and_a', 'insurance', 'real_estate_tax',
                                  'replacement_reserves'];
  const t12TotalOpex = (() => {
    let sum = 0; let any = false;
    for (const k of opexExpKeys) { const v = lv(k).t12; if (v != null) { sum += v; any = true; } }
    const mgmtT12 = mgmtPctLV.t12 != null && egi != null ? mgmtPctLV.t12 * egi : null;
    if (mgmtT12 != null) { sum += mgmtT12; any = true; }
    return any ? sum : null;
  })();
  const platformTotalOpex = (() => {
    let sum = 0; let any = false;
    for (const k of opexExpKeys) { const v = lv(k).platform; if (v != null) { sum += v; any = true; } }
    const mgmtPlatform = mgmtPctLV.platform != null && egi != null ? mgmtPctLV.platform * egi : null;
    if (mgmtPlatform != null) { sum += mgmtPlatform; any = true; }
    return any ? sum : null;
  })();

  addRow('total_opex', 'Total Operating Expenses',
    storedTotalOpex ?? summedOpex, { isSubtotal: true, broker: bpTotalOpex, t12: t12TotalOpex, platform: platformTotalOpex });

  // NOI
  const noiY1 = res('noi');
  const totalOpForNoi = storedTotalOpex ?? summedOpex;
  const computedNoi = (egi != null && totalOpForNoi != null) ? egi - totalOpForNoi : null;
  const t12Noi      = t12Egi  != null && t12TotalOpex      != null ? t12Egi  - t12TotalOpex      : null;
  const platformNoi = platformEgi != null && platformTotalOpex != null ? platformEgi - platformTotalOpex : null;
  addRow('noi', 'Net Operating Income', noiY1 ?? computedNoi, { isSubtotal: true, broker: bpNOI, t12: t12Noi, platform: platformNoi });

  // Debt (composer doesn't surface debt yet â€” leave nullable rows)
  addRow('debt_service',      'Debt Service',      null);
  addRow('pre_tax_cash_flow', 'Pre-Tax Cash Flow', null, { isSubtotal: true });

  return rows;
}

// â”€â”€ Helper: Integrity checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildIntegrityChecks(
  y1: any,
  _totalUnits: number,
  rows: OSRow[],
  dealData?: Record<string, any> | null,
): IntegrityCheck[] {
  const checks: IntegrityCheck[] = [];

  if (!y1) {
    // Check if extraction capsules exist â€” if none, this deal has never had
    // documents parsed and will always be empty until ingestion happens.
    // Diagnostic: when proforma is empty AND no extraction capsules exist
    // on the deal, surface a hard error so the UI can render an actionable
    // banner instead of silently showing blank rows.
    //
    // Rationale: the seeder (`proforma-seeder.service.ts`) bails with
    // `seeded: false, warnings: ['No extraction sources available']` when none
    // of `extraction_t12`, `extraction_rent_roll`, `extraction_tax_bill` exist
    // on `deals.deal_data`. The route handler swallows that as "non-critical",
    // so without this check the frontend has no way to know why every tab is
    // blank.
    const hasExtractionT12 = !!(dealData && dealData['extraction_t12']);
    const hasExtractionRR  = !!(dealData && dealData['extraction_rent_roll']);
    const hasExtractionTax = !!(dealData && dealData['extraction_tax_bill']);

    if (!hasExtractionT12 && !hasExtractionRR && !hasExtractionTax) {
      checks.push({
        id: 'extraction_data_missing',
        status: 'error',
        message: 'No T-12, rent roll, or tax bill found for this deal â€” upload and parse documents to populate the model.',
      });
    } else if (!hasExtractionT12 && !hasExtractionTax) {
      checks.push({
        id: 'seed_partial',
        status: 'warn',
        message: 'Rent roll found but no T-12 or tax bill â€” revenue assumptions will be populated but expenses may be incomplete.',
      });
    } else {
      checks.push({
        id: 'proforma_seeded',
        status: 'warn',
        message: 'No proforma data seeded â€” add deal assumptions or trigger auto-seed.',
      });
    }
  }

  const noiRow = rows.find(r => r.field === 'noi');
  if (noiRow && noiRow.resolved != null) {
    checks.push({
      id: 'noi_positive',
      status: noiRow.resolved > 0 ? 'ok' : 'warn',
      message: noiRow.resolved > 0
        ? 'NOI positive'
        : 'NOI is zero or negative â€” review revenue and expense assumptions.',
    });
  }

  return checks;
}

// â”€â”€ Helper: Unit economics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildUnitEconomics(rows: OSRow[], totalUnits: number): Record<string, number | null> {
  const gprRow = rows.find(r => r.field === 'gpr');
  const egiRow = rows.find(r => r.field === 'egi');
  const opexRow = rows.find(r => r.field === 'total_opex_sum');
  const noiRow = rows.find(r => r.field === 'noi');
  const gpr = gprRow?.resolved ?? null;
  const egi = egiRow?.resolved ?? null;
  const opex = opexRow?.resolved ?? null;
  const noi = noiRow?.resolved ?? null;

  return {
    gprPerUnit: totalUnits > 0 && gpr != null ? gpr / totalUnits : null,
    egiPerUnit: totalUnits > 0 && egi != null ? egi / totalUnits : null,
    opexPerUnit: totalUnits > 0 && opex != null ? opex / totalUnits : null,
    noiPerUnit: totalUnits > 0 && noi != null ? noi / totalUnits : null,
    opexRatioPct: egi != null && egi > 0 && opex != null ? (opex / egi) * 100 : null,
    derivedVacancyPct: gpr != null && gpr > 0 && egi != null ? (gpr - egi) / gpr : null,
  };
}

// â”€â”€ Helper: Valuation snapshot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildValuationSnapshot(
  purchasePrice: number | null,
  totalUnits: number,
  rows: OSRow[],
  _deal: any
): Record<string, unknown> | null {
  if (!purchasePrice || purchasePrice <= 0) return null;

  const noiRow = rows.find(r => r.field === 'noi');
  const noi = noiRow?.resolved ?? null;
  const gprRow = rows.find(r => r.field === 'gpr');
  const gpr = gprRow?.resolved ?? null;

  return {
    pricePerUnit: totalUnits > 0 ? purchasePrice / totalUnits : null,
    pricePerSF: null,
    grm: gpr != null && gpr > 0 ? purchasePrice / gpr : null,
    gim: null,
    goingInCapT12: noi != null && noi > 0 ? (noi / purchasePrice) * 100 : null,
    priceToRC: null,
    rcPerUnit: null,
    buildArbitrageFlag: null,
    pricePerUnitSubmarketMedian: null,
    pricePerUnitPercentile: null,
    pricePerSFSubmarketMedian: null,
    pricePerSFPercentile: null,
    grmSubmarketMedian: null,
    grmPercentile: null,
    gimSubmarketMedian: null,
    gimPercentile: null,
    goingInCapSubmarketMedian: null,
    goingInCapPercentile: null,
  };
}

// â”€â”€ Helper: Rent roll summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Helper: Unit-mix derived revenue items (shared across composer paths) â”€â”€â”€â”€

interface UnitMixDerived {
  unitMix: Array<{
    type: string; count: number; avgSf: number | null;
    inPlaceRent: number | null; marketRent: number | null;
    occupancyPct: number | null; concessionPct: number | null;
  }>;
  totalUnitsInMix: number;
  avgInPlaceRent: number | null;
  weightedOccupancyPct: number | null;
  gprFromUnitMix: number | null;        // Î£ marketRent Ã— count Ã— 12  (potential gross â€” Projections semantics)
  vacancyLossFromUnitMix: number | null; // gpr Ã— (1 âˆ’ weightedOccupancy)
  lossToLeaseFromUnitMix: number | null; // Î£ max(0, marketRent âˆ’ inPlaceRent) Ã— count Ã— 12
  concessionsFromUnitMix: number | null; // Î£ marketRent Ã— count Ã— 12 Ã— concessionPct
}

function computeUnitMixDerived(rentRollRows: any[]): UnitMixDerived {
  const empty: UnitMixDerived = {
    unitMix: [], totalUnitsInMix: 0, avgInPlaceRent: null, weightedOccupancyPct: null,
    gprFromUnitMix: null, vacancyLossFromUnitMix: null,
    lossToLeaseFromUnitMix: null, concessionsFromUnitMix: null,
  };
  if (!rentRollRows || rentRollRows.length === 0) return empty;

  const unitMix = rentRollRows.map(r => ({
    type: r.type || 'Unknown',
    count: r.count || 0,
    avgSf: r.avg_sqft ?? null,
    inPlaceRent: r.in_place_rent ?? null,
    marketRent: r.market_rent ?? null,
    occupancyPct: r.occupancy_pct ?? null,
    concessionPct: r.concession_pct ?? null,
  }));

  const totalUnitsInMix = unitMix.reduce((s, u) => s + u.count, 0);
  const weightedInPlace = totalUnitsInMix > 0
    ? unitMix.reduce((s, u) => s + (u.inPlaceRent ?? 0) * u.count, 0) / totalUnitsInMix
    : null;
  // Null-aware weighted occupancy. OM-derived rows intentionally have null
  // occupancy because brokers rarely publish per-floorplan vacancy. Treating
  // null as 0 here would silently propagate "100% vacant" through GPR
  // vacancy loss math, badly distorting Pro Forma. Skip null rows entirely
  // (excluded from both numerator and denominator); return null when no row
  // contributes â€” downstream `vacancyLossFromUnitMix` already null-checks.
  const weightedOcc = (() => {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const u of unitMix) {
      if (u.occupancyPct == null) continue;
      weightedSum += u.occupancyPct * u.count;
      weightTotal += u.count;
    }
    if (weightTotal === 0) return null;
    return weightedSum / weightTotal;
  })();

  // GPR = potential annual rent at MARKET rates (matches Projections "Gross Potential Rent")
  const gprFromMix = unitMix.reduce((s, u) => {
    const rate = u.marketRent ?? u.inPlaceRent ?? 0;
    return s + rate * u.count * 12;
  }, 0);

  const vacancyLossFromUnitMix = (gprFromMix > 0 && weightedOcc != null)
    ? gprFromMix * (1 - weightedOcc)
    : null;

  const lossToLeaseFromUnitMix = unitMix.reduce((s, u) => {
    if (u.marketRent == null || u.inPlaceRent == null) return s;
    const gap = Math.max(0, u.marketRent - u.inPlaceRent);
    return s + gap * u.count * 12;
  }, 0);

  const concessionsFromUnitMix = unitMix.reduce((s, u) => {
    const rate = u.marketRent ?? u.inPlaceRent ?? 0;
    const cp = u.concessionPct ?? 0;
    return s + rate * u.count * 12 * cp;
  }, 0);

  return {
    unitMix,
    totalUnitsInMix,
    avgInPlaceRent: weightedInPlace,
    weightedOccupancyPct: weightedOcc,
    gprFromUnitMix: gprFromMix > 0 ? gprFromMix : null,
    vacancyLossFromUnitMix,
    lossToLeaseFromUnitMix: lossToLeaseFromUnitMix > 0 ? lossToLeaseFromUnitMix : null,
    concessionsFromUnitMix: concessionsFromUnitMix > 0 ? concessionsFromUnitMix : null,
  };
}

function buildRentRollSummary(
  rentRollRows: any[],
  totalUnits: number,
  derived: UnitMixDerived,
  useUnitMixForGpr: boolean,
  capsuleAggregates: CapsuleAggregates | null = null,
  synthesizedOverrides: { inPlaceRent: number | null; marketRent: number | null } | null = null,
  extractionRentRoll: ExtractionRentRollPayload | null = null,
  extractionDerivationRows: any[] | null = null,
  omDerivationRows: any[] | null = null,
): any | null {
  // Tier 2: extraction_rent_roll.floor_plan_mix (real per-floorplan rows).
  // Build the unit mix directly from the derivation rows so the OVR badge
  // (overridden + originalValue) and lease-expiration column have the data
  // they need on the frontend.
  // Tier 3: OM-published per-floorplan unit mix (extraction_om.unit_mix).
  // Used when no rent-roll source produced rows. Same column shape as the
  // rent-roll tier so the F9 Unit Mix tab renders identically â€” only the
  // source badge changes.
  if (omDerivationRows && omDerivationRows.length > 0) {
    const unitMix = omDerivationRows.map(r => ({
      type: r.type,
      count: r.count,
      avgSf: r.avg_sqft,
      inPlaceRent: r.in_place_rent,
      marketRent: r.market_rent,
      occupancyPct: r.occupancy_pct,
      concessionPct: r.concession_pct,
      inPlaceRentOriginal: r._originalInPlace ?? null,
      marketRentOriginal: r._originalMarket ?? null,
      inPlaceRentOverridden: r._inPlaceOverridden === true,
      marketRentOverridden:  r._marketOverridden === true,
      expirationCurve: null,
      source: 'extraction_om',
    }));
    return {
      unitMix,
      avgInPlaceRent: derived.avgInPlaceRent,
      weightedOccupancyPct: derived.weightedOccupancyPct,
      gprFromUnitMix: derived.gprFromUnitMix,
      vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
      lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
      concessionsFromUnitMix: derived.concessionsFromUnitMix,
      useUnitMixForGpr,
      expirationCurve: null,
      source: 'extraction_om',
    };
  }

  if (extractionDerivationRows && extractionDerivationRows.length > 0) {
    const unitMix = extractionDerivationRows.map(r => ({
      type: r.type,
      count: r.count,
      avgSf: r.avg_sqft,
      inPlaceRent: r.in_place_rent,
      marketRent: r.market_rent,
      occupancyPct: r.occupancy_pct,
      concessionPct: r.concession_pct,
      inPlaceRentOriginal: r._originalInPlace ?? null,
      marketRentOriginal: r._originalMarket ?? null,
      inPlaceRentOverridden: r._inPlaceOverridden === true,
      marketRentOverridden:  r._marketOverridden === true,
      expirationCurve: r._expirationCurve ?? null,
      expirationExtractionStatus: r._expirationExtractionStatus ?? null,
      source: 'extraction_rent_roll',
    }));
    return {
      unitMix,
      avgInPlaceRent: derived.avgInPlaceRent,
      weightedOccupancyPct: derived.weightedOccupancyPct,
      gprFromUnitMix: derived.gprFromUnitMix,
      vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
      lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
      concessionsFromUnitMix: derived.concessionsFromUnitMix,
      useUnitMixForGpr,
      expirationCurve: extractionRentRoll?.expirationCurve ?? null,
      // Task #514 â€” surface deal-wide extraction quality flags for the
      // Unit Mix tab's TOTALS row tri-state + the review banner.
      expirationExtractionStatus: extractionRentRoll?.expirationExtractionStatus ?? null,
      columnCoverage: extractionRentRoll?.columnCoverage ?? null,
      humanReviewNeeded: extractionRentRoll?.humanReviewNeeded === true,
      source: 'extraction_rent_roll',
    };
  }
  if (!rentRollRows || rentRollRows.length === 0) {
    // Pick a unit count: prefer the deal's target_units; fall back to capsule.units
    const synthesizedCount = totalUnits > 0 ? totalUnits : (capsuleAggregates?.units ?? 0);
    if (synthesizedCount > 0) {
      // Synthesize a default unit mix row so the UnitMixTab renders with an editable row.
      // Layered values for the DISPLAYED row: user override (per_year_overrides) â†’
      // capsule aggregate â†’ null. Both columns share the same fallback chain so the
      // Unit Mix tab and the OS derivation pipeline agree on what the row "is".
      const ovInPlace = synthesizedOverrides?.inPlaceRent ?? null;
      const ovMarket  = synthesizedOverrides?.marketRent  ?? null;
      const inPlaceRent = ovInPlace ?? capsuleAggregates?.avgRent ?? null;
      const marketRent  = ovMarket  ?? capsuleAggregates?.avgRent ?? null;
      const occupancyPct = capsuleAggregates?.occupancyPct ?? null;
      const avgSf = capsuleAggregates?.avgSf ?? null;
      // Mark the row as user-overridden when an explicit override exists so the
      // tab can render an "OVR" badge / reset affordance correctly.
      const inPlaceOverridden = ovInPlace != null;
      const marketOverridden  = ovMarket  != null;
      const defaultMix = [{
        type: 'Default',
        count: synthesizedCount,
        avgSf,
        inPlaceRent,
        marketRent,
        occupancyPct,
        concessionPct: null,
        inPlaceRentOriginal: capsuleAggregates?.avgRent ?? null,
        marketRentOriginal: capsuleAggregates?.avgRent ?? null,
        inPlaceRentOverridden: inPlaceOverridden,
        marketRentOverridden: marketOverridden,
        // Provenance: capsule when capsule had data, synthesized otherwise.
        source: capsuleAggregates ? 'capsule' : 'synthesized',
      }];
      // Use the SAME derivation outputs that buildOSRows consumes â€” derivationRows
      // was synthesized from the same overrides + capsule, so this guarantees the
      // Unit Mix tab metrics (gpr/vacancy/loss-to-lease) cannot drift from the
      // Pro Forma Operating Statement values. Falls back to single-row math only
      // when the derivation didn't produce a value (no unit count, all rents null).
      return {
        unitMix: defaultMix,
        avgInPlaceRent: derived.avgInPlaceRent ?? inPlaceRent,
        weightedOccupancyPct: derived.weightedOccupancyPct ?? occupancyPct,
        gprFromUnitMix: derived.gprFromUnitMix,
        vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
        lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
        concessionsFromUnitMix: derived.concessionsFromUnitMix,
        useUnitMixForGpr,
        // Top-level provenance mirrors the row's source so downstream
        // consumers (e.g. ProFormaSummaryTab badges, banners) can read
        // either field consistently.
        source: capsuleAggregates ? 'capsule' : 'synthesized',
      };
    }
    return null;
  }
  // Tier 1: legacy SQL `rent_roll` table â€” explicit source so downstream
  // provenance handling is uniform across all tiers.
  return {
    unitMix: derived.unitMix,
    avgInPlaceRent: derived.avgInPlaceRent,
    weightedOccupancyPct: derived.weightedOccupancyPct,
    gprFromUnitMix: derived.gprFromUnitMix,
    vacancyLossFromUnitMix: derived.vacancyLossFromUnitMix,
    lossToLeaseFromUnitMix: derived.lossToLeaseFromUnitMix,
    concessionsFromUnitMix: derived.concessionsFromUnitMix,
    useUnitMixForGpr,
    source: 'rent_roll',
  };
}

// â”€â”€ Helper: Traffic projection (placeholder) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildTrafficProjection(): any {
  return {
    yearly: [],
    leaseUp: null,
    calibrated: {
      vacancyPct: null,
      rentGrowthPct: null,
      exitCap: null,
      lastCalibrated: null,
    },
    leasingSignals: null,
  };
}

// â”€â”€ Helper: Assumptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildAssumptions(y1: any, pyOvs: Record<string, { value: unknown }> = {}): any {
  const holdYears = y1?.holdYears ?? 10;
  const pyNum = (key: string): number | null => {
    const v = pyOvs[key]?.value;
    const n = typeof v === 'number' ? v : (v != null ? Number(v) : NaN);
    return Number.isFinite(n) ? n : null;
  };
  return {
    holdYears,
    exitCap: y1?.exitCap ?? null,
    rentGrowthYr1: y1?.rentGrowthRate ?? null,
    rentGrowthStabilized: y1?.rentGrowthStabilized ?? null,
    perYear: Array.from({ length: holdYears }, (_, i) => ({
      year: i + 1,
      rentGrowthPct: i === 0 ? (y1?.rentGrowthRate ?? null) : (y1?.rentGrowthStabilized ?? null),
      vacancyPct: y1?.vacancy ?? null,
      exitCapIfLastYear: i === holdYears - 1 ? (y1?.exitCap ?? null) : null,
      capexDraw: null,
    })),
    // Growth-rate overrides — read from per_year_overrides['growth:*'] written
    // by applyFinancialsOverride when the user edits a Section 10 row.
    opexGrowthPct:       pyNum('growth:opex'),
    utilitiesGrowthPct:  pyNum('growth:utilities'),
    insuranceGrowthPct:  pyNum('growth:insurance'),
    taxGrowthPct:        pyNum('growth:tax'),
    reservesGrowthPct:   pyNum('growth:reserves'),
    ancillaryGrowthPct:  pyNum('growth:ancillary'),
    concessionBurnOffPct: pyNum('concessionBurnOffPct:yr1'),
    gprDecomposition: y1?.gprDecomposition ?? null,
    narrative: y1?.narrative ?? null,
  };
}

// â”€â”€ Helper: Capsule aggregates fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// When no rent_roll rows exist, pull aggregates from deal_capsules.deal_data
// (sourced from OM extraction) so the synthesized Default unit-mix row carries
// real units / avg rent / occupancy / avg SF instead of all-null cells.

export interface CapsuleAggregates {
  units: number | null;
  avgRent: number | null;
  occupancyPct: number | null;
  avgSf: number | null;
}

/** Coerce occupancy that may arrive as a fraction (0.95) or a percent (95).
 *  Preserves a real 0 (fully vacant) â€” only `null`/`undefined`/non-finite/negative are dropped. */
function normalizeOccupancy(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : (raw != null ? Number(raw) : NaN);
  if (!Number.isFinite(n) || n < 0) return null;
  // Percentages > 1.5 are treated as percent; values â‰¤ 1.5 stay as fractions.
  const norm = n > 1.5 ? n / 100 : n;
  return Math.min(Math.max(norm, 0), 1);
}

function num(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : (raw != null ? Number(raw) : NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Like num() but accepts 0 and negative values; only nullish/non-finite return null.
// Used for user-edited override values where 0 (e.g. concession-driven free rent)
// is meaningful and must not be coerced away.
function numOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

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

/**
 * Per-floorplan unit mix as the broker published it in the Offering Memo
 * (lives at `deals.deal_data.extraction_om.unit_mix`, written by the OM
 * parser via data-router.persistOMExtraction). Returns `null` when no OM
 * has been parsed or the OM didn't include a per-floorplan table.
 *
 * Schema (per row):
 *   { floorplan: string, count, avgSf, marketRent, inPlaceRent }
 */
export async function loadOmUnitMix(pool: Pool, dealId: string): Promise<Array<{
  floorplan: string;
  count: number | null;
  avgSf: number | null;
  marketRent: number | null;
  inPlaceRent: number | null;
}> | null> {
  let dealRes;
  try {
    dealRes = await pool.query(
      `SELECT deal_data FROM deals WHERE id = $1 LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadOmUnitMix] deals lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = dealRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;
  const om = (dd.extraction_om && typeof dd.extraction_om === 'object') ? dd.extraction_om : null;
  if (!om) return null;
  const arr = Array.isArray(om.unit_mix) ? om.unit_mix : null;
  if (!arr || arr.length === 0) return null;
  // Filter rows with at least a floor plan label and SOMETHING quantitative
  // â€” empty rows from a noisy parse would otherwise show up as all-null UI rows.
  const cleaned = arr
    .map((r: Record<string, unknown>) => ({
      floorplan: typeof r.floorplan === 'string' ? r.floorplan.trim() : '',
      count:       numOrNull(r.count),
      avgSf:       numOrNull(r.avgSf),
      marketRent:  numOrNull(r.marketRent),
      inPlaceRent: numOrNull(r.inPlaceRent),
    }))
    .filter(r => r.floorplan.length > 0 && (r.count != null || r.avgSf != null || r.marketRent != null || r.inPlaceRent != null));
  return cleaned.length > 0 ? cleaned : null;
}

export async function loadCapsuleAggregates(pool: Pool, dealId: string): Promise<CapsuleAggregates | null> {
  // Capsules are stored two ways in the wild:
  //   â€¢ shared-UUID: deal_capsules.id === deals.id (legacy / pre-bridge)
  //   â€¢ bridge:      deal_capsules.deal_data->>'deal_id' = deals.id (auto-created)
  // Try both so we work for either. id is uuid â†’ cast to text for the param compare.
  let capRes;
  try {
    capRes = await pool.query(
      `SELECT deal_data
         FROM deal_capsules
        WHERE id::text = $1
           OR deal_data->>'deal_id' = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [dealId]
    );
  } catch (err) {
    console.warn('[loadCapsuleAggregates] capsule lookup failed for', dealId,
      err instanceof Error ? err.message : err);
    return null;
  }
  const dd = capRes.rows[0]?.deal_data;
  if (!dd || typeof dd !== 'object') return null;

  // OM extraction shape (from `pdf-extractor â†’ broker_claims`):
  //   deal_data.broker_claims.property  â†’ { units, avgUnitSF, netRentableSF, ... }
  //   deal_data.broker_claims.proforma  â†’ { stabilizedVacancy, lossToLease, ... }
  // Older capsules sometimes also stash a flatter copy under `extraction_om.{property,proforma}`.
  const claims = (dd.broker_claims && typeof dd.broker_claims === 'object') ? dd.broker_claims : {};
  const om = (dd.extraction_om && typeof dd.extraction_om === 'object') ? dd.extraction_om : {};
  const property = (claims.property && typeof claims.property === 'object')
    ? claims.property
    : (om.property && typeof om.property === 'object' ? om.property : {});
  const proforma = (claims.proforma && typeof claims.proforma === 'object')
    ? claims.proforma
    : (om.proforma && typeof om.proforma === 'object' ? om.proforma : {});

  const units = num(dd.units) ?? num(dd.target_units) ?? num(property.units);

  const avgRent = num(dd.avg_rent) ?? num(claims.avg_rent) ?? num(proforma.avgRent);

  const occRaw = dd.occupancy ?? claims.occupancy ?? dd.broker_occupancy ?? null;
  let occupancyPct = normalizeOccupancy(occRaw);
  if (occupancyPct == null) {
    // Derive from stabilizedVacancy when present (e.g. 0.05 â†’ 0.95)
    const vac = normalizeOccupancy(proforma.stabilizedVacancy);
    if (vac != null) occupancyPct = Math.max(0, 1 - vac);
  }

  const avgSf = num(property.avgUnitSF) ?? num(dd.avg_unit_sf);

  // If nothing usable was found, return null so the row stays all-null (matches old behavior).
  if (units == null && avgRent == null && occupancyPct == null && avgSf == null) {
    return null;
  }
  return { units, avgRent, occupancyPct, avgSf };
}

// â”€â”€ Helper: Capital stack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildCapitalStack(purchasePrice: number | null, y1: any): any {
  return {
    purchasePrice,
    loanAmount: y1?.loanAmount ?? null,
    equityAtClose: y1?.equityAtClose ?? null,
    ltcPct: y1?.ltcPct ?? null,
    interestRate: y1?.interestRate ?? null,
    ioPeriodMonths: y1?.ioPeriodMonths ?? null,
    amortizationYears: y1?.amortizationYears ?? null,
    dscrMin: y1?.dscrMin ?? null,
    originationFeePct: y1?.originationFeePct ?? null,
    pricePerUnit: purchasePrice != null && purchasePrice > 0 ? purchasePrice : null,
  };
}

// â”€â”€ Projections builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generates the projections array that ProjectionsTab expects. Each year is an
// object with flat keys matching the tab's RowDef definitions. Year 1 reads
// from the year1Rows resolved values; subsequent years apply rent growth to
// revenue items and expense growth to expense items.

interface ProjYear {
  year: number;
  // Revenue
  gpr: number | null; vacancyLoss: number | null; lossToLease: number | null;
  concessions: number | null; badDebt: number | null; nru: number | null;
  nri: number | null; otherIncome: number | null; egi: number | null;
  // Expenses (camelCase keys matching ProjectionsTab RowDef)
  payroll: number | null; repairs: number | null; turnover: number | null;
  contractSvc: number | null; marketing: number | null; utilities: number | null;
  gAndA: number | null; mgmtFee: number | null; insurance: number | null;
  reTaxes: number | null; reserves: number | null; totalOpex: number | null;
  // NOI
  noi: number | null; opMargin: number | null; noiPerUnit: number | null;
  // Debt Service
  interest: number | null; principal: number | null; annualDS: number | null;
  // Cash Flow
  cfbt: number | null; cfads: number | null;
  // After-Tax
  depreciation: number | null; taxableIncome: number | null;
  taxPayable: number | null; afterTaxCfads: number | null;
  // Exit/Disposition
  exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
  sellingCosts: number | null; dispositionDocStamps: number | null;
  loanPayoff: number | null; dispositionTaxPayable: number | null;
  netSaleProceeds: number | null;
  // Metrics strip
  occupancy: number | null; dscr: number | null; debtYield: number | null;
  coc: number | null; cumulativeEM: number | null; capRatePct: number | null;
  noiMarginPct: number | null; opexRatioPct: number | null;
  rentGrowthPct: number | null;
}

function buildProjections(
  rows: OSRow[],
  totalUnits: number,
  y1: any,
  purchasePrice: number | null,
  totalOpexY1: number | null,
): ProjYear[] {
  // Extract year 1 resolved values from OSRow[]
  const r = (field: string): number | null => {
    const row = rows.find(rr => rr.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  // Alias for expense rows (same extraction)
  const expense = r;

  const gprY1          = r('gpr');
  const vacancyLossY1  = r('vacancy_loss');
  const lossToLeaseY1  = r('loss_to_lease');
  const concessionsY1  = r('concessions');
  const badDebtY1      = r('bad_debt');
  const nruY1          = r('non_revenue_units');
  const nriY1          = r('net_rental_income');
  const otherIncY1     = r('other_income');
  const egiY1          = r('egi');

  // Adoption-ramp support (Task #1147): separate breakdown contribution from
  // user-added lines so per-year ramp values can be applied instead of flat
  // growth. breakdownY1 = total other income Y1 minus the user lines Y1 sum.
  const _userLinesForProj = Array.isArray(y1?.other_income_user_lines)
    ? (y1.other_income_user_lines as Array<{ monthly: number; adoption?: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null }>)
    : [];
  // Import computeUserLineAnnual lazily to avoid circular deps at module load.
  // The helper is pure — no I/O, safe to call synchronously.
  let _computeUserLineAnnual: ((l: { monthly: number; adoption?: { ramp_start_period: number; ramp_duration_months: number; steady_state_monthly: number; probability_adopted: number } | null }, yi: number) => number) | null = null;
  const getUserLineAnnual = (l: typeof _userLinesForProj[number], yi: number): number => {
    if (!_computeUserLineAnnual) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _computeUserLineAnnual = require('./proforma-seeder.service').computeUserLineAnnual;
      } catch {
        return (Number.isFinite(l.monthly) ? l.monthly : 0) * 12;
      }
    }
    return _computeUserLineAnnual!(l, yi);
  };
  const userLinesY1Annual = _userLinesForProj.reduce((s, l) => s + getUserLineAnnual(l, 0), 0);
  const breakdownY1 = otherIncY1 != null ? otherIncY1 - userLinesY1Annual : null;

  const payrollY1     = expense('payroll');
  const repairsY1     = expense('repairs_maintenance');
  const turnoverY1    = expense('turnover');
  const contractSvcY1 = expense('contract_services');
  const marketingY1   = expense('marketing');
  const utilitiesY1   = expense('utilities');
  const gAndAY1       = expense('g_and_a');
  const mgmtFeeY1     = expense('management_fee');
  const insuranceY1   = expense('insurance');
  const reTaxesY1     = expense('real_estate_taxes');
  const reservesY1    = expense('replacement_reserves');
  const noiY1         = r('noi');

  // Growth rates from y1 seed
  const rentGrowth = ((): number => {
    const v = y1?.rent_growth;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && v.resolved != null) return v.resolved;
    return 0.03;
  })();
  const expenseGrowth = ((): number => {
    const v = y1?.expense_growth;
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && v.resolved != null) return v.resolved;
    return 0.03;
  })();

  // Capital stack
  const loanAmount    = y1?.loanAmount ?? null;
  const interestRate = ((): number => {
    const v = y1?.interestRate;
    if (typeof v === 'number') return v;
    return 0.065;
  })();
  const holdYears = ((): number => {
    const v = y1?.holdYears;
    if (typeof v === 'number') return v;
    return 5;
  })();
  const exitCap = ((): number => {
    const v = y1?.exitCap;
    if (typeof v === 'number') return v;
    return 0.0625;
  })();
  const sellingCostsPct = ((): number => {
    const v = y1?.sellingCosts;
    if (typeof v === 'number') return v;
    return 0.02;
  })();

  // Compute constant-payment debt service
  const monthlyRate = interestRate / 12;
  const numPayments = 360; // 30-year amort
  let monthlyPayment = 0;
  if (loanAmount && loanAmount > 0 && monthlyRate > 0) {
    monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }
  const annualDS = monthlyPayment * 12;

  // Build 10 years
  const years: ProjYear[] = [];
  for (let yi = 0; yi < 10; yi++) {
    const yearNum = yi + 1;
    const rg = Math.pow(1 + rentGrowth, yi);
    const eg = Math.pow(1 + expenseGrowth, yi);

    const scale = (val: number | null): number | null =>
      val != null ? val * rg : null;
    const expenseScale = (val: number | null): number | null =>
      val != null ? val * eg : null;

    const gpr         = scale(gprY1);
    const vacancyLoss = scale(vacancyLossY1);
    const lossToLease = scale(lossToLeaseY1);
    const concessions = scale(concessionsY1);
    const badDebt     = scale(badDebtY1);
    const nru         = scale(nruY1);
    const nri         = scale(nriY1);
    // Adoption ramp: breakdown portion grows with rent; user lines get per-year
    // ramp values instead of flat growth. Task #1147.
    const userLinesThisYear = _userLinesForProj.reduce((s, l) => s + getUserLineAnnual(l, yi), 0);
    const otherIncome = breakdownY1 != null
      ? (breakdownY1 * rg + userLinesThisYear)
      : (otherIncY1 != null ? otherIncY1 * rg : null);
    const egi         = scale(egiY1);

    const payroll     = expenseScale(payrollY1);
    const repairs     = expenseScale(repairsY1);
    const turnover    = expenseScale(turnoverY1);
    const contractSvc = expenseScale(contractSvcY1);
    const marketing   = expenseScale(marketingY1);
    const utilities   = expenseScale(utilitiesY1);
    const gAndA       = expenseScale(gAndAY1);
    const mgmtFee     = expenseScale(mgmtFeeY1);
    const insurance   = expenseScale(insuranceY1);
    const reTaxes     = expenseScale(reTaxesY1);
    const reserves    = expenseScale(reservesY1);
    const totalOpex   = expenseScale(totalOpexY1);

    // If totalOpex is null, sum individual items
    const totalOpexCalc = totalOpex ?? (
      (payroll != null || repairs != null)
        ? ((payroll ?? 0) + (repairs ?? 0) + (turnover ?? 0) + (contractSvc ?? 0) +
           (marketing ?? 0) + (utilities ?? 0) + (gAndA ?? 0) + (mgmtFee ?? 0) +
           (insurance ?? 0) + (reTaxes ?? 0) + (reserves ?? 0))
        : null
    );

    const noi = scale(noiY1) ?? (
      (egi != null && totalOpexCalc != null) ? egi - totalOpexCalc : null
    );
    const opMargin       = noi != null && egi != null && egi > 0 ? noi / egi : null;
    const noiPerUnit     = totalUnits > 0 && noi != null ? noi / totalUnits : null;

    // Debt service (constant payment)
    const annualDSVal = loanAmount != null ? annualDS : null;
    const interest = loanAmount != null ? loanAmount * interestRate : null;
    const principal = annualDSVal != null && interest != null ? annualDSVal - interest : null;
    const cfbt = noi != null && annualDSVal != null ? noi - annualDSVal : null;
    const cfads = cfbt;

    // Sale year disposition (only on holdYears)
    let exitNoiVal: number | null = null;
    let grossSaleValue: number | null = null;
    let sellingCostsVal: number | null = null;
    let netSaleProceedsVal: number | null = null;
    const isSaleYear = yearNum === holdYears;
    if (isSaleYear && noi != null) {
      exitNoiVal = noi;
      grossSaleValue = exitCap > 0 ? noi / exitCap : null;
      sellingCostsVal = grossSaleValue != null ? grossSaleValue * sellingCostsPct : null;
      const loanBalance = loanAmount != null
        ? Math.max(0, loanAmount - (principal ?? 0) * yi)
        : null;
      netSaleProceedsVal = grossSaleValue != null && sellingCostsVal != null && loanBalance != null
        ? grossSaleValue - sellingCostsVal - loanBalance
        : null;
    }

    // Metrics strip
    const occupancy = gpr != null && gpr > 0 && vacancyLoss != null
      ? (gpr - vacancyLoss) / gpr : null;
    const dscr = annualDSVal != null && annualDSVal > 0 && noi != null
      ? noi / annualDSVal : null;
    const debtYield = loanAmount != null && loanAmount > 0 && noi != null
      ? noi / loanAmount : null;
    const coc = cfbt != null && loanAmount != null && loanAmount > 0
      ? cfbt / (loanAmount * 0.01) : null;
    const cumEM = null;
    const capRatePct = purchasePrice != null && purchasePrice > 0 && noi != null
      ? noi / purchasePrice : null;
    const noiMarginPct = opMargin;
    const opexRatioPct = totalOpexCalc != null && egi != null && egi > 0
      ? totalOpexCalc / egi : null;
    const rentGrowthPct = yi === 0 ? rentGrowth : null;

    years.push({
      year: yearNum,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru, nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities, gAndA,
      mgmtFee, insurance, reTaxes, reserves,
      totalOpex: totalOpexCalc,
      noi, opMargin, noiPerUnit,
      interest, principal, annualDS: annualDSVal,
      cfbt, cfads,
      depreciation: null, taxableIncome: null, taxPayable: null, afterTaxCfads: null,
      exitNoi: exitNoiVal,
      exitCap: isSaleYear ? exitCap : null,
      grossSaleValue,
      sellingCosts: sellingCostsVal,
      dispositionDocStamps: null,
      loanPayoff: isSaleYear ? loanAmount : null,
      dispositionTaxPayable: null,
      netSaleProceeds: netSaleProceedsVal,
      occupancy, dscr, debtYield, coc, cumulativeEM: cumEM, capRatePct,
      noiMarginPct, opexRatioPct, rentGrowthPct,
    });
  }
  return years;
}




