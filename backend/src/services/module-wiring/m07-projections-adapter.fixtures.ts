/**
 * M07 → M09 Projections Adapter — Test Fixtures
 *
 * Six fixture scenarios:
 *   F1 — Stabilized S1-only: Y1 anchored from subject current_state; LTL compresses; INVs pass
 *   F2 — Stabilized S3: Y1 anchored from S3 subject; rent growth applied; row count = holdYears
 *   F3 — Lease-up absorption: absorption curve drives Physical Occupancy ramp; concessions front-loaded
 *   F4 — Redevelopment with M22: renovation dilution; RDEV mode until last phase; R→S badge present
 *   F5 — Override propagation: recomputeRowOnOverride produces downstream-only change; INVs pass
 *   F6 — Invariant violation (loud failure): INV-1 fires when physical_occupancy > 1
 */

import {
  M07ProjectionsAdapter,
  type ProjectionsDealContext,
  type ProjectionsOutput,
} from './m07-projections-adapter';
import { assertProjectionsInvariants } from './projections-dependency-graph';

// ── Types ────────────────────────────────────────────────────────────────────

interface FixtureAssertion {
  label: string;
  passed: boolean;
  detail: string;
}

interface FixtureResult {
  name: string;
  passed: boolean;
  assertions: FixtureAssertion[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertTrue(label: string, cond: boolean, detail: string): FixtureAssertion {
  return { label, passed: cond, detail };
}

function assertLte(label: string, actual: number, max: number): FixtureAssertion {
  return {
    label,
    passed: actual <= max,
    detail: `actual=${actual.toFixed(4)}, max=${max.toFixed(4)}`,
  };
}

function assertGte(label: string, actual: number, min: number): FixtureAssertion {
  return {
    label,
    passed: actual >= min,
    detail: `actual=${actual.toFixed(4)}, min=${min.toFixed(4)}`,
  };
}

function assertApprox(label: string, actual: number, expected: number, tol = 0.01): FixtureAssertion {
  return {
    label,
    passed: Math.abs(actual - expected) <= tol,
    detail: `actual=${actual.toFixed(4)}, expected=${expected.toFixed(4)}, tol=${tol}`,
  };
}

// ── Fixture runner ────────────────────────────────────────────────────────────

export async function runProjectionsFixtures(): Promise<FixtureResult[]> {
  const adapter = new M07ProjectionsAdapter();
  const results: FixtureResult[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // F1 — Stabilized S1-only
  //   subject.current_state provides occupancy_rate = 0.91, loss_to_lease = 0.04
  //   hold_years = 5; no concession environment → defaults used
  //   Assertions:
  //     - Y1 physical_occupancy ≈ 0.91 (from subject)
  //     - Y1 loss_to_lease ≈ 0.04 (from subject)
  //     - Y5 loss_to_lease < Y1 loss_to_lease (compresses toward stabilized default)
  //     - all rows physical_occupancy ∈ [0, 1]
  //     - row count = 5
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
      const ctx: ProjectionsDealContext = {
        deal_id: 'deal-f1',
        deal_mode: 'STABILIZED',
        hold_years: 5,
        traffic: {
          starting_state: {
            mode: 'STABILIZED',
            current_occupancy: 0.88,   // will be overridden by subject
          },
          subject_history: {
            tier: 'S1',
            current_state: {
              occupancy_rate: 0.91,
              loss_to_lease: 0.04,
              unit_count: 200,
              occupied_count: 182,
              vacant_count: 18,
              notice_count: 4,
              avg_concession_value: 1200,
              avg_contract_rent: 1650,
              avg_market_rent: 1720,
              expiration_waterfall: [],
              signing_velocity: 3.5,
              lease_term_distribution: {},
            },
            observed_dynamics: null,
          },
          concession_environment: null,
          market_rent_growth: 0.03,
          market_rent_per_unit: 1720,
        },
      };

      const out = adapter.build(ctx);

      assertions.push(assertTrue('row count = 5', out.occupancy_leasing.length === 5,
        `${out.occupancy_leasing.length}`));
      assertions.push(assertApprox('Y1 physical_occ ≈ 0.91', out.occupancy_leasing[0].physical_occupancy, 0.91, 0.001));
      assertions.push(assertApprox('Y1 loss_to_lease ≈ 0.04', out.occupancy_leasing[0].loss_to_lease, 0.04, 0.001));
      assertions.push(assertTrue('Y5 LTL < Y1 LTL (compression)',
        out.occupancy_leasing[4].loss_to_lease < out.occupancy_leasing[0].loss_to_lease,
        `Y1=${out.occupancy_leasing[0].loss_to_lease.toFixed(4)}, Y5=${out.occupancy_leasing[4].loss_to_lease.toFixed(4)}`));
      assertions.push(assertTrue('all physical_occ ∈ [0,1]',
        out.occupancy_leasing.every(r => r.physical_occupancy >= 0 && r.physical_occupancy <= 1),
        out.occupancy_leasing.map(r => r.physical_occupancy.toFixed(3)).join(',')));
      assertions.push(assertTrue('subject_used = true', out.subject_used, ''));
      assertions.push(assertTrue('anchor_source = subject_history:s1', out.anchor_source === 'subject_history:s1', out.anchor_source));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F1 — Stabilized S1-only (subject-anchored Y1 occ + LTL)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F2 — Stabilized S3: extended subject history
  //   subject.tier = 'S3'; hold_years = 7; rent_growth = 4%
  //   Assertions:
  //     - row count = 7
  //     - effective_rent[Y7] > effective_rent[Y1] (rent growth compounds)
  //     - INV-4 holds: effective_rent ≈ market_rent × (1 − loss_to_lease)
  //     - anchor_source = 'subject_history:s3'
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
      const ctx: ProjectionsDealContext = {
        deal_id: 'deal-f2',
        deal_mode: 'STABILIZED',
        hold_years: 7,
        traffic: {
          starting_state: { mode: 'STABILIZED', current_occupancy: 0.94 },
          subject_history: {
            tier: 'S3',
            current_state: {
              occupancy_rate: 0.94,
              loss_to_lease: 0.025,
              unit_count: 300,
              occupied_count: 282,
              vacant_count: 18,
              notice_count: 6,
              avg_concession_value: 800,
              avg_contract_rent: 1900,
              avg_market_rent: 1950,
              expiration_waterfall: [],
              signing_velocity: 4.2,
              lease_term_distribution: {},
            },
            observed_dynamics: null,
          },
          concession_environment: null,
          market_rent_growth: 0.04,
          market_rent_per_unit: 1950,
        },
      };

      const out = adapter.build(ctx);

      assertions.push(assertTrue('row count = 7', out.occupancy_leasing.length === 7, `${out.occupancy_leasing.length}`));
      assertions.push(assertTrue('Y7 effective_rent > Y1 effective_rent',
        (out.occupancy_leasing[6].effective_rent ?? 0) > (out.occupancy_leasing[0].effective_rent ?? 0),
        `Y1=${out.occupancy_leasing[0].effective_rent?.toFixed(0)}, Y7=${out.occupancy_leasing[6].effective_rent?.toFixed(0)}`));
      assertions.push(assertTrue('anchor_source = subject_history:s3', out.anchor_source === 'subject_history:s3', out.anchor_source));

      // INV-4: check per row
      for (const row of out.occupancy_leasing) {
        if (row.effective_rent != null && row.market_rent != null) {
          const expected = row.market_rent * (1 - row.loss_to_lease);
          assertions.push(assertApprox(`INV-4 Y${row.year}`, row.effective_rent, expected, Math.max(1, expected * 0.01)));
        }
      }

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F2 — Stabilized S3 (7-year hold, INV-4 per row)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F3 — Lease-up absorption
  //   deal_mode = LEASE_UP; transition_month = 18; hold_years = 5
  //   absorption_curve drives Physical Occupancy ramp
  //   Concession Environment Engine output provided for Y1–Y5
  //   Assertions:
  //     - Y1 physical_occ < Y2 physical_occ (occupancy ramps up)
  //     - Y3 mode = 'STABILIZED' (transition at month 18 → fully STAB in Y3)
  //     - Y2 has transition_badge = 'LU→S'
  //     - Y1 concession free_months > Y3 free_months (front-loaded decay)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
      const ctx: ProjectionsDealContext = {
        deal_id: 'deal-f3',
        deal_mode: 'LEASE_UP',
        hold_years: 5,
        capex_schedule: { transition_month: 18 },
        traffic: {
          starting_state: {
            mode: 'LEASE_UP',
            start_occupancy: 0.10,
            target_occupancy: 0.93,
            absorption_curve: Array.from({ length: 24 }, (_, i) => Math.min(0.93, 0.10 + i * 0.035)),
          },
          subject_history: {
            tier: 'S1',
            current_state: {
              occupancy_rate: 0.10,
              loss_to_lease: 0.06,
              unit_count: 150,
              occupied_count: 15,
              vacant_count: 135,
              notice_count: 0,
              avg_concession_value: 2400,
              avg_contract_rent: 1600,
              avg_market_rent: 1700,
              expiration_waterfall: [],
              signing_velocity: 6.0,
              lease_term_distribution: {},
            },
            observed_dynamics: null,
          },
          concession_environment: {
            deal_id: 'deal-f3',
            mode: 'LEASE_UP',
            property_class: 'B',
            hold_years: 5,
            per_year: [
              { year: 1, free_months: 2.5, concession_pct: 0.08, supply_pressure_modifier: 1.0, confidence: 'MED', source_blend: { class_default_weight: 0.7, submarket_weight: 0.3, subject_weight: 0.0 } },
              { year: 2, free_months: 1.3, concession_pct: 0.04, supply_pressure_modifier: 1.0, confidence: 'MED', source_blend: { class_default_weight: 0.5, submarket_weight: 0.5, subject_weight: 0.0 } },
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
          market_rent_growth: 0.03,
          market_rent_per_unit: 1700,
        },
      };

      const out = adapter.build(ctx);

      assertions.push(assertTrue('Y1 occ < Y2 occ (ramp)',
        out.occupancy_leasing[0].physical_occupancy < out.occupancy_leasing[1].physical_occupancy,
        `Y1=${out.occupancy_leasing[0].physical_occupancy.toFixed(3)}, Y2=${out.occupancy_leasing[1].physical_occupancy.toFixed(3)}`));
      assertions.push(assertTrue('Y3 mode = STABILIZED (post-transition)',
        out.occupancy_leasing[2].mode === 'STABILIZED',
        `Y3 mode=${out.occupancy_leasing[2].mode}`));
      assertions.push(assertTrue('Y2 transition_badge = LU→S',
        out.occupancy_leasing[1].transition_badge === 'LU→S',
        `Y2 badge=${out.occupancy_leasing[1].transition_badge}`));
      assertions.push(assertTrue('Y1 free_months > Y3 free_months (front-loaded decay)',
        out.concessions[0].free_months > out.concessions[2].free_months,
        `Y1=${out.concessions[0].free_months.toFixed(3)}, Y3=${out.concessions[2].free_months.toFixed(3)}`));
      assertions.push(assertTrue('row count = 5', out.occupancy_leasing.length === 5, `${out.occupancy_leasing.length}`));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F3 — Lease-up absorption (month-18 transition, front-loaded concessions)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F4 — Redevelopment with M22
  //   deal_mode = REDEVELOPMENT; capex_schedule has 2 phases; hold_years = 5
  //   Assertions:
  //     - Y1 mode = REDEVELOPMENT (renovation in progress)
  //     - At least one year has transition_badge = 'R→S'
  //     - Y1 physical_occ < Y5 physical_occ (occupancy improves as phases complete)
  //     - degraded_reason = null (M22 capex_schedule is present)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
      const ctx: ProjectionsDealContext = {
        deal_id: 'deal-f4',
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
          starting_state: {
            mode: 'REDEVELOPMENT',
            overall_occupancy: 0.40,
            phases: [
              { phase_number: 1, units_count: 60, co_date_months_out: 12, mini_lease_up_months: 12 },
              { phase_number: 2, units_count: 40, co_date_months_out: 24, mini_lease_up_months: 12 },
            ],
          },
          subject_history: null,
          concession_environment: null,
          market_rent_growth: 0.03,
          market_rent_per_unit: 2000,
        },
        total_units: 100,
      };

      const out = adapter.build(ctx);

      assertions.push(assertTrue('Y1 mode = REDEVELOPMENT',
        out.occupancy_leasing[0].mode === 'REDEVELOPMENT',
        `Y1 mode=${out.occupancy_leasing[0].mode}`));
      assertions.push(assertTrue('some year has R→S badge',
        out.occupancy_leasing.some(r => r.transition_badge === 'R→S'),
        out.occupancy_leasing.map(r => r.transition_badge ?? '-').join(',')));
      assertions.push(assertTrue('Y1 occ < Y5 occ (improving)',
        out.occupancy_leasing[0].physical_occupancy < out.occupancy_leasing[4].physical_occupancy,
        `Y1=${out.occupancy_leasing[0].physical_occupancy.toFixed(3)}, Y5=${out.occupancy_leasing[4].physical_occupancy.toFixed(3)}`));
      assertions.push(assertTrue('degraded_reason = null (M22 present)',
        out.degraded_reason === null,
        `degraded_reason=${out.degraded_reason}`));
      assertions.push(assertTrue('row count = 5', out.occupancy_leasing.length === 5, `${out.occupancy_leasing.length}`));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F4 — Redevelopment with M22 (2-phase, R→S badge, dilution)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F5 — Override propagation
  //   Start with F1 context; build baseline; then override Y3 loss_to_lease = 0.10
  //   Assertions:
  //     - Y3 loss_to_lease = 0.10 in updated output
  //     - Y3 effective_rent = market_rent[Y3] × (1 − 0.10) (INV-4 passes)
  //     - Y1 rows UNCHANGED (override is year-specific)
  //     - INVs pass on updated output
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
      const ctx: ProjectionsDealContext = {
        deal_id: 'deal-f5',
        deal_mode: 'STABILIZED',
        hold_years: 5,
        traffic: {
          starting_state: { mode: 'STABILIZED', current_occupancy: 0.91 },
          subject_history: {
            tier: 'S1',
            current_state: {
              occupancy_rate: 0.91,
              loss_to_lease: 0.04,
              unit_count: 200,
              occupied_count: 182,
              vacant_count: 18,
              notice_count: 4,
              avg_concession_value: 1200,
              avg_contract_rent: 1650,
              avg_market_rent: 1720,
              expiration_waterfall: [],
              signing_velocity: 3.5,
              lease_term_distribution: {},
            },
            observed_dynamics: null,
          },
          market_rent_growth: 0.03,
          market_rent_per_unit: 1720,
        },
      };

      const baseline = adapter.build(ctx);

      // Override Y3 loss_to_lease
      const ctxWithOverride: ProjectionsDealContext = {
        ...ctx,
        user_overrides: { 'occ.loss_to_lease.3': 0.10 },
      };
      const updated = adapter.recomputeRowOnOverride(
        baseline, 'occ.loss_to_lease.3', 0.10, ctxWithOverride,
      );

      assertions.push(assertApprox('Y3 LTL = 0.10 after override',
        updated.occupancy_leasing[2].loss_to_lease, 0.10, 0.001));

      const y3Row = updated.occupancy_leasing[2];
      if (y3Row.market_rent != null && y3Row.effective_rent != null) {
        const expectedEff = y3Row.market_rent * (1 - 0.10);
        assertions.push(assertApprox('Y3 effective_rent = MR × (1 − 0.10)',
          y3Row.effective_rent, expectedEff, Math.max(1, expectedEff * 0.01)));
      }

      assertions.push(assertApprox('Y1 LTL unchanged',
        updated.occupancy_leasing[0].loss_to_lease,
        baseline.occupancy_leasing[0].loss_to_lease,
        0.0001));

      // INVs pass
      let invError: string | null = null;
      try { assertProjectionsInvariants(updated); } catch (e: any) { invError = e.message; }
      assertions.push(assertTrue('INVs pass on updated output', invError === null, invError ?? ''));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F5 — Override propagation (Y3 LTL → Y3 effective_rent recomputed)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F6 — Invariant violation (loud failure)
  //   Manually construct output with physical_occupancy = 1.5 → INV-1 must fire
  //   Assertions:
  //     - assertProjectionsInvariants throws with 'INV-1 VIOLATED' in message
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureAssertion[] = [];
    let passed = true;
    try {
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
          physical_occupancy: 1.5,   // VIOLATION
          loss_to_lease: 0.03,
          rent_growth: 0.03,
          effective_rent: 1748,
          market_rent: 1800,
          mode: 'STABILIZED',
          source: 'platform',
        }],
        concessions: [{
          year: 1,
          free_months: 0.5,
          concession_pct: 0.04,
          supply_pressure_modifier: 1.0,
          confidence: 'MED',
          source_blend: { class_default_weight: 1.0, submarket_weight: 0.0, subject_weight: 0.0 },
          mode: 'STABILIZED',
        }],
      };

      let caughtMessage: string | null = null;
      try {
        assertProjectionsInvariants(badOutput);
      } catch (err: any) {
        caughtMessage = err.message;
      }

      assertions.push(assertTrue('INV-1 violation thrown',
        caughtMessage !== null && caughtMessage.includes('INV-1 VIOLATED'),
        caughtMessage ?? 'no error thrown'));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F6 — Invariant violation: INV-1 fires loud on physical_occupancy > 1', passed, assertions });
  }

  return results;
}

/**
 * Convenience: run all fixtures and print results to console.
 */
export async function runAndPrintProjectionsFixtures(): Promise<void> {
  const results = await runProjectionsFixtures();
  let allPassed = true;
  for (const r of results) {
    if (!r.passed) allPassed = false;
    const icon = r.passed ? '✓' : '✗';
    console.log(`\n${icon} ${r.name}`);
    for (const a of r.assertions) {
      const aIcon = a.passed ? '  ✓' : '  ✗';
      console.log(`${aIcon} ${a.label}: ${a.detail}`);
    }
  }
  console.log(`\n${allPassed ? 'ALL FIXTURES PASSED' : 'SOME FIXTURES FAILED'} (${results.filter(r => r.passed).length}/${results.length})`);
}
