/**
 * M07 → M09 Projections Adapter — Executable Fixture Scenarios
 *
 * Six scenarios, each with deterministic assertions that can be run in CI
 * via runProjectionsFixtures() → throws on any failed assertion.
 *
 *   F1 — Stabilized S1-only  (subject anchors Y1 occ + LTL; LTL compresses)
 *   F2 — Stabilized S3        (7-year hold; INV-4 per row; rent compounds)
 *   F3 — Lease-up absorption  (curve[12] Y1 anchor; LU→S badge; front-loaded conc)
 *   F4 — Redevelopment M22    (2-phase; R→S badge; no M22 = degraded_reason set)
 *   F5 — Override propagation (Y3 LTL override → Y3 eff_rent only; Y1 unchanged)
 *   F6 — INV-1 loud failure   (physical_occupancy > 1 throws with INV-1 VIOLATED)
 */

import {
  M07ProjectionsAdapter,
  type ProjectionsDealContext,
  type ProjectionsOutput,
} from './m07-projections-adapter';
import { assertProjectionsInvariants } from './projections-dependency-graph';
import type { StabilizedState, LeaseUpState, RedevelopmentState } from '../../types/traffic-calibration.types';

// ── Assertion helpers ─────────────────────────────────────────────────────────

class AssertionError extends Error {
  constructor(label: string, detail: string) {
    super(`FIXTURE ASSERTION FAILED: ${label} — ${detail}`);
    this.name = 'AssertionError';
  }
}

function assert(label: string, cond: boolean, detail = ''): void {
  if (!cond) throw new AssertionError(label, detail);
}

function assertApprox(label: string, actual: number, expected: number, tol = 0.01): void {
  const delta = Math.abs(actual - expected);
  if (delta > tol) {
    throw new AssertionError(label, `actual=${actual.toFixed(4)}, expected=${expected.toFixed(4)}, tol=${tol}, delta=${delta.toFixed(6)}`);
  }
}

// ── Shared stable subjects ────────────────────────────────────────────────────

function makeS1Subject(occupancyRate: number, ltl: number) {
  return {
    id: 1,
    deal_id: 'test',
    tier: 'S1' as const,
    snapshot_count: 1,
    coverage_months: null,
    current_state: {
      occupancy_rate:     occupancyRate,
      loss_to_lease:      ltl,
      unit_count:         200,
      occupied_count:     Math.round(occupancyRate * 200),
      vacant_count:       Math.round((1 - occupancyRate) * 200),
      notice_count:       4,
      avg_concession_value: 1200,
      avg_contract_rent:    1650,
      avg_market_rent:      1720,
      expiration_waterfall: [],
      signing_velocity:     3.5,
      lease_term_distribution: {},
    },
    observed_dynamics: null,
    confidence_weights: {},
    peer_collisions: [],
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const stabilizedSS: StabilizedState = {
  mode: 'STABILIZED',
  current_occupancy: 0.88,
  renewal_rate: 0.55,
  expiration_waterfall: [],
  avg_days_vacant: 30,
  churn_replacement_rate: 0.025,
};

// ── Fixture runner ─────────────────────────────────────────────────────────────

export async function runProjectionsFixtures(): Promise<void> {
  const adapter = new M07ProjectionsAdapter();
  const results: { name: string; error: string | null }[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // F1 — Stabilized S1-only
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F1 — Stabilized S1-only (subject-anchored Y1 occ + LTL compression)', () => {
    const ctx: ProjectionsDealContext = {
      deal_id: 'deal-f1',
      deal_mode: 'STABILIZED',
      hold_years: 5,
      traffic: {
        starting_state:   stabilizedSS,
        subject_history:  makeS1Subject(0.91, 0.04),
        concession_environment: null,
        market_rent_growth:   0.03,
        market_rent_per_unit: 1720,
      },
    };

    const out = adapter.build(ctx);

    assert('row count = 5', out.occupancy_leasing.length === 5,
      `got ${out.occupancy_leasing.length}`);
    assert('conc row count = 5', out.concessions.length === 5,
      `got ${out.concessions.length}`);

    // Y1 anchored from subject S1
    assertApprox('Y1 physical_occ ≈ 0.91', out.occupancy_leasing[0].physical_occupancy, 0.91, 0.001);
    assertApprox('Y1 loss_to_lease ≈ 0.04', out.occupancy_leasing[0].loss_to_lease, 0.04, 0.001);

    // Y5 LTL has compressed toward 2.5% floor
    assert('Y5 LTL < Y1 LTL',
      out.occupancy_leasing[4].loss_to_lease < out.occupancy_leasing[0].loss_to_lease,
      `Y1=${out.occupancy_leasing[0].loss_to_lease.toFixed(4)}, Y5=${out.occupancy_leasing[4].loss_to_lease.toFixed(4)}`);

    // All physical_occ ∈ [0, 1]
    for (const row of out.occupancy_leasing) {
      assert(`Y${row.year} occ ∈ [0,1]`,
        row.physical_occupancy >= 0 && row.physical_occupancy <= 1,
        `${row.physical_occupancy}`);
    }

    // Y5 effective_rent > Y1 (rent compounds at 3%)
    assert('Y5 effective_rent > Y1',
      (out.occupancy_leasing[4].effective_rent ?? 0) > (out.occupancy_leasing[0].effective_rent ?? 0),
      `Y1=${out.occupancy_leasing[0].effective_rent}, Y5=${out.occupancy_leasing[4].effective_rent}`);

    assert('anchor_source = subject_history:s1', out.anchor_source === 'subject_history:s1',
      out.anchor_source);
    assert('subject_used = true', out.subject_used, '');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F2 — Stabilized S3 (7-year hold, INV-4 per row)
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F2 — Stabilized S3 (7-year hold; INV-4 per row; rent compounds)', () => {
    const s3Subject = {
      ...makeS1Subject(0.94, 0.025),
      tier: 'S3' as const,
      snapshot_count: 3,
    };

    const ctx: ProjectionsDealContext = {
      deal_id: 'deal-f2',
      deal_mode: 'STABILIZED',
      hold_years: 7,
      traffic: {
        starting_state:   { ...stabilizedSS, current_occupancy: 0.94 },
        subject_history:  s3Subject,
        concession_environment: null,
        market_rent_growth:   0.04,
        market_rent_per_unit: 1950,
      },
    };

    const out = adapter.build(ctx);

    assert('row count = 7', out.occupancy_leasing.length === 7, `got ${out.occupancy_leasing.length}`);
    assert('Y7 eff_rent > Y1 eff_rent',
      (out.occupancy_leasing[6].effective_rent ?? 0) > (out.occupancy_leasing[0].effective_rent ?? 0),
      `Y1=${out.occupancy_leasing[0].effective_rent?.toFixed(0)}, Y7=${out.occupancy_leasing[6].effective_rent?.toFixed(0)}`);
    assert('anchor_source = subject_history:s3', out.anchor_source === 'subject_history:s3', out.anchor_source);

    // INV-4: effective_rent ≈ market_rent × (1 − LTL) per row
    for (const row of out.occupancy_leasing) {
      if (row.effective_rent != null && row.market_rent != null) {
        const expected = row.market_rent * (1 - row.loss_to_lease);
        assertApprox(`INV-4 Y${row.year} eff_rent`,
          row.effective_rent, expected, Math.max(1, expected * 0.01));
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F3 — Lease-up absorption
  //   absorption_curve is 24 elements; Y1 = curve[12], Y2 = curve[24] → target
  //   transition_month = 18 → LU→S badge in Y2, Y3 mode = STABILIZED
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F3 — Lease-up absorption (curve[12] Y1; LU→S badge Y2; front-loaded conc)', () => {
    // curve[12] = min(0.93, 0.10 + 12*0.035) = min(0.93, 0.52) = 0.52
    const absorptionCurve = Array.from({ length: 24 }, (_, i) => Math.min(0.93, 0.10 + i * 0.035));

    const luSS: LeaseUpState = {
      mode: 'LEASE_UP',
      start_occupancy: 0.10,
      target_occupancy: 0.93,
      absorption_curve: absorptionCurve,
      months_to_stabilization_p50: 18,
      months_to_stabilization_p25: 14,
      months_to_stabilization_p75: 24,
      seasonality_overlay: Array.from({ length: 12 }, () => 1.0),
      concession_intensity_curve:  Array.from({ length: 24 }, (_, i) => Math.max(0, 2.5 - i * 0.1)),
    };

    const ctx: ProjectionsDealContext = {
      deal_id: 'deal-f3',
      deal_mode: 'LEASE_UP',
      hold_years: 5,
      capex_schedule: { transition_month: 18 },
      traffic: {
        starting_state:  luSS,
        subject_history: makeS1Subject(0.10, 0.06),
        concession_environment: {
          deal_id: 'deal-f3',
          mode: 'LEASE_UP',
          property_class: 'B',
          hold_years: 5,
          per_year: [
            { year: 1, free_months: 2.5,  concession_pct: 0.08, supply_pressure_modifier: 1.0, confidence: 'MED',  source_blend: { class_default_weight: 0.7, submarket_weight: 0.3, subject_weight: 0.0 } },
            { year: 2, free_months: 1.3,  concession_pct: 0.04, supply_pressure_modifier: 1.0, confidence: 'MED',  source_blend: { class_default_weight: 0.5, submarket_weight: 0.5, subject_weight: 0.0 } },
            { year: 3, free_months: 0.75, concession_pct: 0.02, supply_pressure_modifier: 1.0, confidence: 'HIGH', source_blend: { class_default_weight: 1.0, submarket_weight: 0.0, subject_weight: 0.0 } },
            { year: 4, free_months: 0.75, concession_pct: 0.02, supply_pressure_modifier: 1.0, confidence: 'HIGH', source_blend: { class_default_weight: 1.0, submarket_weight: 0.0, subject_weight: 0.0 } },
            { year: 5, free_months: 0.75, concession_pct: 0.02, supply_pressure_modifier: 1.0, confidence: 'HIGH', source_blend: { class_default_weight: 1.0, submarket_weight: 0.0, subject_weight: 0.0 } },
          ],
          collisions: [],
          computed_at: new Date().toISOString(),
          supply_pressure_score: null,
          submarket_sample_size: null,
          subject_s2_available: false,
          degraded_reason: null,
        },
        market_rent_growth:   0.03,
        market_rent_per_unit: 1700,
      },
    };

    const out = adapter.build(ctx);

    // Y1 occ = curve[12] = 0.52
    assertApprox('Y1 occ = curve[12] ≈ 0.52', out.occupancy_leasing[0].physical_occupancy, 0.52, 0.001);

    // Y2 occ = curve[24] → undefined → target_occupancy = 0.93
    assertApprox('Y2 occ = target_occupancy = 0.93', out.occupancy_leasing[1].physical_occupancy, 0.93, 0.001);

    // Mode transition at month 18 → badge in Y2 (months 13-24)
    assert('Y2 transition_badge = LU→S', out.occupancy_leasing[1].transition_badge === 'LU→S',
      `Y2 badge=${out.occupancy_leasing[1].transition_badge}`);

    // Y3 mode is STABILIZED (transition_month 18 < year 3 starts at month 25)
    assert('Y3 mode = STABILIZED', out.occupancy_leasing[2].mode === 'STABILIZED',
      `Y3 mode=${out.occupancy_leasing[2].mode}`);

    // Front-loaded concessions: Y1 free_months > Y3
    assert('Y1 free_months > Y3 free_months',
      out.concessions[0].free_months > out.concessions[2].free_months,
      `Y1=${out.concessions[0].free_months.toFixed(3)}, Y3=${out.concessions[2].free_months.toFixed(3)}`);

    assert('row count = 5', out.occupancy_leasing.length === 5, `got ${out.occupancy_leasing.length}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F4 — Redevelopment with M22 + degraded (missing M22 sub-scenario)
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F4 — Redevelopment M22 (2-phase; R→S badge; missing M22 = degraded)', () => {
    const redevSS: RedevelopmentState = {
      mode: 'REDEVELOPMENT',
      total_units: 100,
      occupied_units: 40,
      offline_units:  60,
      overall_occupancy: 0.40,
      phases: [
        { phase_number: 1, units_count: 60, co_date_months_out: 12, start_occupancy: 0, target_occupancy: 0.93, mini_lease_up_months: 12 },
        { phase_number: 2, units_count: 40, co_date_months_out: 24, start_occupancy: 0, target_occupancy: 0.93, mini_lease_up_months: 12 },
      ],
    };

    // Sub-scenario A: with capex_schedule (M22 present)
    const ctxWithM22: ProjectionsDealContext = {
      deal_id: 'deal-f4a',
      deal_mode: 'REDEVELOPMENT',
      hold_years: 5,
      capex_schedule: {
        renovation_pct: 0.6,
        post_reno_rent_uplift: 0.12,
        phases: [
          { units: 60, co_months_out: 12, lease_up_months: 12, rent_uplift_pct: 0.12 },
          { units: 40, co_months_out: 24, lease_up_months: 12, rent_uplift_pct: 0.10 },
        ],
      },
      traffic: {
        starting_state:   redevSS,
        subject_history:  null,
        concession_environment: null,
        market_rent_growth:   0.03,
        market_rent_per_unit: 2000,
      },
      total_units: 100,
    };

    const outM22 = adapter.build(ctxWithM22);

    assert('Y1 mode = REDEVELOPMENT', outM22.occupancy_leasing[0].mode === 'REDEVELOPMENT',
      `Y1 mode=${outM22.occupancy_leasing[0].mode}`);
    assert('some year has R→S badge',
      outM22.occupancy_leasing.some(r => r.transition_badge === 'R→S'),
      outM22.occupancy_leasing.map(r => r.transition_badge ?? '-').join(','));
    assert('Y1 occ < Y5 occ (improving)',
      outM22.occupancy_leasing[0].physical_occupancy < outM22.occupancy_leasing[4].physical_occupancy,
      `Y1=${outM22.occupancy_leasing[0].physical_occupancy}, Y5=${outM22.occupancy_leasing[4].physical_occupancy}`);
    assert('M22 present → degraded_reason = null', outM22.degraded_reason === null,
      `degraded_reason=${outM22.degraded_reason}`);
    assert('row count = 5', outM22.occupancy_leasing.length === 5, `got ${outM22.occupancy_leasing.length}`);

    // Sub-scenario B: without capex_schedule (M22 absent → degraded)
    const ctxNoM22: ProjectionsDealContext = {
      ...ctxWithM22,
      deal_id: 'deal-f4b',
      capex_schedule: null,
    };

    const outNoM22 = adapter.build(ctxNoM22);
    assert('no M22 → degraded_reason set', outNoM22.degraded_reason === 'M22_MISSING_CAPEX_SCHEDULE',
      `degraded_reason=${outNoM22.degraded_reason}`);
    assert('no M22 → rows still produced', outNoM22.occupancy_leasing.length === 5, `got ${outNoM22.occupancy_leasing.length}`);
    // With no M22, renovation_pct = 0 → no dilution → occ = overall_occupancy
    assertApprox('no M22 Y1 occ = overall_occupancy (no dilution)',
      outNoM22.occupancy_leasing[0].physical_occupancy, 0.40, 0.01);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F5 — Override propagation (dependency-graph-driven selective recompute)
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F5 — Override propagation (Y3 LTL → Y3 eff_rent; Y1 unchanged)', () => {
    const ctx: ProjectionsDealContext = {
      deal_id: 'deal-f5',
      deal_mode: 'STABILIZED',
      hold_years: 5,
      traffic: {
        starting_state:   stabilizedSS,
        subject_history:  makeS1Subject(0.91, 0.04),
        concession_environment: null,
        market_rent_growth:   0.03,
        market_rent_per_unit: 1720,
      },
    };

    const baseline = adapter.build(ctx);
    const baselineY1LTL    = baseline.occupancy_leasing[0].loss_to_lease;
    const baselineY1EffRnt = baseline.occupancy_leasing[0].effective_rent;

    // Override Y3 loss_to_lease = 0.10
    const updated = adapter.recomputeRowOnOverride(
      baseline, 'occ.loss_to_lease.3', 0.10, ctx,
    );

    // Override applied
    assertApprox('Y3 LTL = 0.10 after override', updated.occupancy_leasing[2].loss_to_lease, 0.10, 0.0001);

    // Downstream: Y3 effective_rent recomputed
    const y3Row = updated.occupancy_leasing[2];
    if (y3Row.market_rent != null && y3Row.effective_rent != null) {
      const expectedEff = y3Row.market_rent * (1 - 0.10);
      assertApprox('Y3 eff_rent = MR × (1 − 0.10)',
        y3Row.effective_rent, expectedEff, Math.max(1, expectedEff * 0.01));
    }

    // Y1 rows UNCHANGED (year-specific override)
    assertApprox('Y1 LTL unchanged', updated.occupancy_leasing[0].loss_to_lease, baselineY1LTL, 0.0001);
    assertApprox('Y1 eff_rent unchanged',
      updated.occupancy_leasing[0].effective_rent ?? 0, baselineY1EffRnt ?? 0, 0.01);

    // Override free_months Y2 for conc block
    const updatedConc = adapter.recomputeRowOnOverride(
      baseline, 'conc.free_months.2', 3.0, ctx,
    );
    assertApprox('Y2 free_months = 3.0', updatedConc.concessions[1].free_months, 3.0, 0.0001);
    assertApprox('Y2 concession_pct = 3.0/12', updatedConc.concessions[1].concession_pct, 3.0 / 12, 0.0001);
    assert('Y1 conc unchanged',
      updatedConc.concessions[0].free_months === baseline.concessions[0].free_months,
      `Y1=${updatedConc.concessions[0].free_months}, baseline=${baseline.concessions[0].free_months}`);

    // INVs pass on both updated outputs
    assertProjectionsInvariants(updated);
    assertProjectionsInvariants(updatedConc);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // F6 — INV-1 loud failure (physical_occupancy > 1 → throws)
  // ──────────────────────────────────────────────────────────────────────────
  await runScenario(results, 'F6 — INV-1 loud failure: physical_occupancy > 1 throws', () => {
    const badOutput: ProjectionsOutput = {
      deal_id: 'deal-f6',
      computed_at: new Date().toISOString(),
      hold_years: 1,
      deal_mode: 'STABILIZED',
      anchor_source: 'platform',
      subject_used: false,
      degraded_reason: null,
      occupancy_leasing: [{
        year: 1,
        physical_occupancy: 1.5,  // VIOLATION
        loss_to_lease:      0.03,
        rent_growth:        0.03,
        effective_rent:     1748,
        market_rent:        1800,
        mode: 'STABILIZED',
        source: 'platform',
      }],
      concessions: [{
        year: 1,
        free_months:              0.5,
        concession_pct:           0.04,
        supply_pressure_modifier: 1.0,
        confidence: 'MED',
        source_blend: { class_default_weight: 1.0, submarket_weight: 0.0, subject_weight: 0.0 },
        mode: 'STABILIZED',
      }],
    };

    let caughtMessage: string | null = null;
    try {
      assertProjectionsInvariants(badOutput);
    } catch (err: unknown) {
      caughtMessage = err instanceof Error ? err.message : String(err);
    }

    assert('INV-1 violation thrown (not null)', caughtMessage !== null, 'no error thrown');
    assert('message contains INV-1 VIOLATED',
      caughtMessage !== null && caughtMessage.includes('INV-1 VIOLATED'),
      caughtMessage ?? '');
  });

  // ── Results ───────────────────────────────────────────────────────────────

  const failed = results.filter(r => r.error !== null);
  if (failed.length > 0) {
    const report = failed.map(r => `  ✗ ${r.name}\n    ${r.error}`).join('\n');
    throw new Error(
      `[M07→M09 Fixtures] ${failed.length}/${results.length} scenarios FAILED:\n${report}`,
    );
  }

  // All passed — caller can log success
}

/** Wraps a scenario function, capturing errors without letting one failure abort the rest. */
async function runScenario(
  results: { name: string; error: string | null }[],
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  try {
    await fn();
    results.push({ name, error: null });
  } catch (err: unknown) {
    results.push({
      name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Run all six fixture scenarios and print pass/fail to console.
 * Throws on any failure so it can gate CI.
 */
export async function runAndPrintProjectionsFixtures(): Promise<void> {
  console.log('\n[M07→M09 Fixtures] Running 6 scenarios…\n');
  try {
    await runProjectionsFixtures();
    console.log('[M07→M09 Fixtures] ALL 6 SCENARIOS PASSED ✓\n');
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    throw err;
  }
}
