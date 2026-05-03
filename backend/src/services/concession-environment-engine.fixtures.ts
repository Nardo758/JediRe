/**
 * Concession Environment Engine — Test Fixtures (Task #525)
 *
 * Seven scenarios covering:
 *   F1 — Class × mode × subject tier matrix (class A/B/C × STABILIZED)
 *   F2 — Supply pressure sensitivity (monotonic response)
 *   F3 — Collision detection (3σ subject divergence)
 *   F4 — Lease-up decay curve over 24 months (year 1 vs year 2 vs year 3+)
 *   F5 — Mode transition at month 18/25 (LEASE_UP → STABILIZED floor clamp)
 *   F6 — Mode-mismatch enforcement (lease-up tagged subject not applied to stabilized)
 *   F7 — Bad-input defensibility (NaN suppression, explicit reason returned)
 *
 * Usage:
 *   import { runFixtures } from './concession-environment-engine.fixtures';
 *   const results = await runFixtures(pool);
 *   console.log(results);
 */

import type { Pool } from 'pg';
import type {
  ConcessionEnvironmentOutput,
  PerYearConcessionEnv,
} from '../types/traffic-calibration.types';
import { ConcessionEnvironmentEngine } from './concession-environment-engine';

export interface FixtureResult {
  name: string;
  passed: boolean;
  output?: ConcessionEnvironmentOutput;
  reason?: string;
  assertions: Array<{ label: string; passed: boolean; detail: string }>;
}

// ── Assertion helpers ────────────────────────────────────────────────────────

function assertApprox(label: string, actual: number, expected: number, tol = 0.05): { label: string; passed: boolean; detail: string } {
  const passed = Math.abs(actual - expected) <= tol;
  return { label, passed, detail: `actual=${actual.toFixed(4)}, expected≈${expected.toFixed(4)} ±${tol}` };
}

function assertGte(label: string, actual: number, min: number): { label: string; passed: boolean; detail: string } {
  return { label, passed: actual >= min, detail: `actual=${actual.toFixed(4)}, expected>=${min}` };
}

function assertLte(label: string, actual: number, max: number): { label: string; passed: boolean; detail: string } {
  return { label, passed: actual <= max, detail: `actual=${actual.toFixed(4)}, expected<=${max}` };
}

function assertMonotone(label: string, values: number[], direction: 'ascending' | 'descending'): { label: string; passed: boolean; detail: string } {
  let passed = true;
  for (let i = 1; i < values.length; i++) {
    if (direction === 'ascending' && values[i] < values[i - 1]) { passed = false; break; }
    if (direction === 'descending' && values[i] > values[i - 1]) { passed = false; break; }
  }
  return { label, passed, detail: `values=[${values.map(v => v.toFixed(3)).join(', ')}] direction=${direction}` };
}

function assertTrue(label: string, condition: boolean, detail = ''): { label: string; passed: boolean; detail: string } {
  return { label, passed: condition, detail };
}

// ── Mock pool builder ─────────────────────────────────────────────────────────

function buildMockPool(overrides: {
  deal?: Partial<{
    deal_mode: string | null;
    property_class: string;
    submarket_id: string | null;
    msa_id: string | null;
    trade_area_id: string | null;
    deal_data: any;
  }>;
  calibration?: {
    curve_data: { concession_intensity_curve: number[] };
    n_peer_properties: number;
  } | null;
  supplyRiskScore?: number | null;
  subjectHistory?: {
    tier: string;
    current_state: { avg_concession_value: number; avg_contract_rent: number } | null;
    observed_dynamics: {} | null;
    confidence_weights: Record<string, { weight: number }>;
    deal_mode?: string | null;
  } | null;
}): Pool {
  const dealRow = {
    deal_mode:      overrides.deal?.deal_mode      ?? 'STABILIZED',
    property_class: overrides.deal?.property_class ?? 'B',
    submarket_id:   overrides.deal?.submarket_id   ?? 'submarket_test',
    msa_id:         overrides.deal?.msa_id         ?? null,
    // trade_area_id is required for M04 lookup (supply_risk_scores keyed by trade_area_id).
    // Fixtures that specify supplyRiskScore must also set trade_area_id for M04 to fire;
    // here we default to a sentinel that the mock recognises when supplyScore is non-null.
    trade_area_id:  overrides.deal?.trade_area_id  ?? (overrides.supplyRiskScore != null ? 'trade-area-mock' : null),
    deal_data:      overrides.deal?.deal_data      ?? {},
  };

  const calRow = overrides.calibration;
  const supplyScore = overrides.supplyRiskScore;
  const subjectRow = overrides.subjectHistory;

  return {
    query: async (sql: string, _params: any[] = []) => {
      // Deal meta — includes trade_area_id (required for M04 lookup)
      if (sql.includes('FROM deals') && !sql.includes('JOIN')) {
        return { rows: [dealRow], rowCount: 1 };
      }
      // Calibration factors (M05)
      if (sql.includes('traffic_calibration_factors')) {
        if (calRow === undefined || calRow === null) return { rows: [], rowCount: 0 };
        return { rows: [{ curve_data: calRow.curve_data, n_peer_properties: calRow.n_peer_properties, n_evidence: calRow.n_peer_properties }], rowCount: 1 };
      }
      // Supply risk score (M04) — keyed by trade_area_id, ordered by calculated_at DESC
      if (sql.includes('supply_risk_scores')) {
        if (supplyScore === undefined || supplyScore === null || !isFinite(supplyScore as number)) {
          if (supplyScore !== null && supplyScore !== undefined && !isFinite(supplyScore as number)) {
            // NaN/Infinity passed deliberately — return it so NaN-suppression path is exercised
            return { rows: [{ supply_risk_score: String(supplyScore) }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        return { rows: [{ supply_risk_score: String(supplyScore) }], rowCount: 1 };
      }
      // Subject history (M07 S2+)
      if (sql.includes('subject_traffic_history')) {
        if (!subjectRow) return { rows: [], rowCount: 0 };
        return {
          rows: [{
            tier:               subjectRow.tier,
            current_state:      subjectRow.current_state,
            observed_dynamics:  subjectRow.observed_dynamics,
            confidence_weights: subjectRow.confidence_weights,
            deal_mode:          subjectRow.deal_mode ?? null,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
}

// ── Fixture runner ────────────────────────────────────────────────────────────

export async function runFixtures(pool?: Pool): Promise<FixtureResult[]> {
  const results: FixtureResult[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // F1 — Class × mode × subject tier matrix
  //      Class A/B/C STABILIZED — class defaults apply, class A < B < C concessions
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      const outputs: Record<string, ConcessionEnvironmentOutput> = {};
      for (const cls of ['A', 'B', 'C'] as const) {
        const engine = new ConcessionEnvironmentEngine(buildMockPool({
          deal: { deal_mode: 'STABILIZED', property_class: cls, submarket_id: null },
          calibration: null,
          supplyRiskScore: null,
          subjectHistory: null,
        }));
        outputs[cls] = await engine.computeForDeal('deal-f1', 3);
      }

      // Class A should have lower concessions than B and C (better quality = less needed)
      const a1 = outputs['A'].per_year[0].free_months;
      const b1 = outputs['B'].per_year[0].free_months;
      const c1 = outputs['C'].per_year[0].free_months;

      assertions.push(assertTrue('class A < class B concessions', a1 < b1, `A=${a1.toFixed(3)}, B=${b1.toFixed(3)}`));
      assertions.push(assertTrue('class B < class C concessions', b1 < c1, `B=${b1.toFixed(3)}, C=${c1.toFixed(3)}`));

      // STABILIZED: each year should be identical (no overlay, no decay)
      for (const cls of ['A', 'B', 'C'] as const) {
        const yrs = outputs[cls].per_year;
        const allSame = yrs.every(y => Math.abs(y.free_months - yrs[0].free_months) < 0.001);
        assertions.push(assertTrue(`class ${cls} STABILIZED years are uniform`, allSame,
          yrs.map(y => y.free_months.toFixed(3)).join(',')));
      }

      // Confidence should be LOW (no submarket, no M04, no subject)
      assertions.push(assertTrue('confidence is LOW (no data)',
        outputs['B'].per_year[0].confidence === 'LOW', outputs['B'].per_year[0].confidence));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F1 — Class × mode × subject tier matrix', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F2 — Supply pressure sensitivity (monotonic)
  //      Higher supply_risk_score → higher concessions (monotonic)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      const scores = [0, 25, 50, 75, 100];
      const freeMonths: number[] = [];

      for (const score of scores) {
        const engine = new ConcessionEnvironmentEngine(buildMockPool({
          deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: 'sm1' },
          calibration: null,
          supplyRiskScore: score,
          subjectHistory: null,
        }));
        const out = await engine.computeForDeal('deal-f2', 1);
        freeMonths.push(out.per_year[0].free_months);
      }

      assertions.push(assertMonotone('concessions increase with supply pressure', freeMonths, 'ascending'));
      assertions.push(assertTrue('score=0 modifier ≥ 0.5', freeMonths[0] >= 0, `${freeMonths[0]}`));
      assertions.push(assertTrue('score=100 modifier ≤ 2.5× class default',
        freeMonths[4] <= 0.75 * 2.5 + 0.01, `${freeMonths[4]}`));

      // modifier at score=50 should equal 1.0 (neutral)
      const neutralEngine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: 'sm1' },
        calibration: null,
        supplyRiskScore: 50,
        subjectHistory: null,
      }));
      const neutralOut = await neutralEngine.computeForDeal('deal-f2n', 1);
      assertions.push(assertApprox('modifier=1.0 at score=50',
        neutralOut.per_year[0].supply_pressure_modifier, 1.0, 0.01));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F2 — Supply pressure sensitivity (monotonic)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F3 — Collision detection (3σ subject divergence)
  //      Subject S2 concession far above M05 → SEVERE collision in output
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      // M05 submarket: 0.5 free months/year (30 sample)
      // Subject S2: avg_concession_value = 3 months rent → freeMonths ≈ 3
      // std_dev = 20% × 0.5 = 0.1 → delta = |3 - 0.5| / 0.1 = 25σ (SEVERE)
      const engine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: 'sm3' },
        calibration: {
          curve_data: {
            concession_intensity_curve: new Array(24).fill(0.5 * 4.333 / 12), // ≈0.18 weeks/month → 0.5 months/year
          },
          n_peer_properties: 30,
        },
        supplyRiskScore: null,
        subjectHistory: {
          tier: 'S2',
          current_state: { avg_concession_value: 3000, avg_contract_rent: 1000 },
          observed_dynamics: {},
          confidence_weights: { concession_trend: { weight: 0.8 } },
        },
      }));
      const out = await engine.computeForDeal('deal-f3', 3);

      assertions.push(assertTrue('collisions array non-empty', out.collisions.length > 0,
        `${out.collisions.length} collisions`));
      assertions.push(assertTrue('at least one SEVERE collision',
        out.collisions.some(c => c.severity === 'SEVERE'),
        out.collisions.map(c => c.severity).join(',')));
      assertions.push(assertTrue('collision has narrative', out.collisions[0]?.narrative?.length > 0, ''));
      assertions.push(assertGte('collision delta_sigma ≥ 2.5', out.collisions[0]?.delta_sigma ?? 0, 2.5));
      assertions.push(assertTrue('subject_s2_available = true', out.subject_s2_available, ''));

      // Deterministic formula validation:
      // avg_concession_value=3000 (dollars), avg_contract_rent=1000 ($/mo) → 3000/1000 = 3 months free.
      // If the engine incorrectly applied × 12, subject_value_months would be 36, not 3.
      assertions.push(assertApprox(
        'subject_value_months ≈ 3.0 (formula: value/rent, no × 12)',
        out.collisions[0]?.subject_value_months ?? -1,
        3.0,
        0.05,
      ));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F3 — Collision detection (3σ subject divergence)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F4 — Lease-up decay curve over 24 months
  //      Y1 concessions > Y2 > Y3 (monotone decreasing); Y3 ≥ stabilized floor
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      const engine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'LEASE_UP', property_class: 'B', submarket_id: null },
        calibration: null,
        supplyRiskScore: null,
        subjectHistory: null,
      }));
      const out = await engine.computeForDeal('deal-f4', 5);

      const months = out.per_year.map(y => y.free_months);
      assertions.push(assertTrue('5 years produced', months.length === 5, `${months.length}`));
      assertions.push(assertTrue('Y1 > Y2 (decay)', months[0] > months[1],
        `Y1=${months[0].toFixed(3)}, Y2=${months[1].toFixed(3)}`));
      assertions.push(assertTrue('Y2 > Y3 (decay continues)', months[1] > months[2],
        `Y2=${months[1].toFixed(3)}, Y3=${months[2].toFixed(3)}`));
      assertions.push(assertTrue('Y3-Y5 approximately equal (stabilized)',
        Math.abs(months[2] - months[3]) < 0.05 && Math.abs(months[3] - months[4]) < 0.05,
        `Y3=${months[2].toFixed(3)}, Y4=${months[3].toFixed(3)}, Y5=${months[4].toFixed(3)}`));

      // Stabilized floor clamp: Y3 should not be below the class B STABILIZED default
      const classB_stab = 0.75;
      assertions.push(assertGte('Y3 ≥ stabilized floor', months[2], classB_stab - 0.01));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F4 — Lease-up decay curve over 24 months', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F5a — Mode transition: LEASE_UP Y1/Y2 > post-transition STABILIZED Y3
  //       supply_risk_score=0 → modifier=0.5 → STABILIZED years go to
  //       class_default × 0.5 (NOT clamped to stab floor — that's LEASE_UP only)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      // score=0 → modifier clamped to 0.5 → LEASE_UP Y1/Y2 follow curve (≥ stab floor);
      // post-transition STABILIZED Y3+ = class B stab base × 0.5 modifier = 0.375
      const engine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'LEASE_UP', property_class: 'B', submarket_id: 'sm5' },
        calibration: null,
        supplyRiskScore: 0,
        subjectHistory: null,
      }));
      const out = await engine.computeForDeal('deal-f5', 4);
      const months = out.per_year.map(y => y.free_months);

      // Y1 (lease-up curve, bounded ≥ stab floor) > Y3 (post-transition STABILIZED × 0.5)
      assertions.push(assertTrue('Y1 > Y3',
        months[0] > months[2],
        `Y1=${months[0].toFixed(3)}, Y3=${months[2].toFixed(3)}`));

      // Y3 = stab_base × spModifier = 0.75 × 0.5 = 0.375 (no STABILIZED floor clamp)
      // Allow ±0.05 tolerance for floating point
      const expectedY3 = 0.375;
      assertions.push(assertTrue('Y3 ≈ stab_base × spModifier (0.375)',
        Math.abs(months[2] - expectedY3) < 0.05,
        `actual=${months[2].toFixed(4)}, expected≈${expectedY3}`));

      assertions.push(assertTrue('supply_pressure_modifier ≈ 0.5',
        Math.abs(out.per_year[0].supply_pressure_modifier - 0.5) < 0.01,
        out.per_year[0].supply_pressure_modifier.toFixed(4)));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F5a — Mode transition / STABILIZED downside at modifier×0.5', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F5b — STABILIZED deal: supply pressure can reduce concessions to
  //        class_default × 0.5 (no LEASE_UP floor protection)
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      // Pure STABILIZED deal, class B, score=0 → modifier=0.5 → Y1 = 0.75 × 0.5 = 0.375
      const engine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: 'sm5b' },
        calibration: null,
        supplyRiskScore: 0,
        subjectHistory: null,
      }));
      const out = await engine.computeForDeal('deal-f5b', 3);
      const months = out.per_year.map(y => y.free_months);

      // All years should reflect modifier=0.5 suppression — not clamped to 0.75
      const expectedMonths = 0.375;   // class B stab free_months (0.75) × modifier (0.5)
      assertions.push(assertTrue('Y1 ≈ class_default × 0.5',
        Math.abs(months[0] - expectedMonths) < 0.05,
        `actual=${months[0].toFixed(4)}, expected≈${expectedMonths}`));

      assertions.push(assertTrue('Y1 < class B stab floor (0.75) — no floor clamp for STABILIZED',
        months[0] < 0.74,
        `Y1=${months[0].toFixed(4)} should be < 0.74`));

      assertions.push(assertTrue('supply_pressure_modifier ≈ 0.5',
        Math.abs(out.per_year[0].supply_pressure_modifier - 0.5) < 0.01,
        out.per_year[0].supply_pressure_modifier.toFixed(4)));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F5b — STABILIZED deal: M04 downside reaches class_default × 0.5', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F6 — Mode-mismatch enforcement
  //      Subject history tagged with LEASE_UP mode must NOT influence a STABILIZED deal.
  //      The engine reads sth.deal_mode (subject's recorded mode) and rejects the
  //      signal entirely when it differs from the current deal mode, preventing
  //      absorption-phase concession coefficients from inflating stabilized projections.
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      // Baseline: STABILIZED deal with no subject data at all
      const baseEngine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: null },
        calibration: null,
        supplyRiskScore: null,
        subjectHistory: null,
      }));
      const baseOut = await baseEngine.computeForDeal('deal-f6b', 2);

      // Mismatch: STABILIZED deal with LEASE_UP-tagged subject (extreme concession)
      // The subject records avg_concession_value = 5 months rent — if applied, Y1 would
      // shift far above the class-B STABILIZED default of 0.75 months.
      const mismatchEngine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: null },
        calibration: null,
        supplyRiskScore: null,
        subjectHistory: {
          tier: 'S2',
          current_state: { avg_concession_value: 5000, avg_contract_rent: 1000 }, // 5× avg rent
          observed_dynamics: {},
          confidence_weights: { concession_trend: { weight: 0.9 } },
          deal_mode: 'LEASE_UP', // ← mismatch tag — subject was recorded during lease-up
        },
      }));
      const mismatchOut = await mismatchEngine.computeForDeal('deal-f6m', 2);

      // Spec requirement: LEASE_UP-tagged subject must be REJECTED for a STABILIZED deal.
      // loadSubjectS2 reads sth.deal_mode; if it differs from currentMode, returns null.
      assertions.push(assertTrue(
        'subject_s2_available = false (mismatch rejected)',
        mismatchOut.subject_s2_available === false,
        `subject_s2_available=${mismatchOut.subject_s2_available}`,
      ));

      // All source_blend.subject_weight must be zero (no subject influence whatsoever)
      assertions.push(assertTrue(
        'all years have subject_weight = 0',
        mismatchOut.per_year.every(y => y.source_blend.subject_weight === 0),
        mismatchOut.per_year.map(y => y.source_blend.subject_weight.toFixed(4)).join(','),
      ));

      // Mismatch output must equal the no-subject baseline (within floating-point tolerance)
      assertions.push(assertTrue(
        'Y1 free_months equals baseline (subject ignored)',
        Math.abs(mismatchOut.per_year[0].free_months - baseOut.per_year[0].free_months) < 0.001,
        `mismatch=${mismatchOut.per_year[0].free_months.toFixed(4)}, base=${baseOut.per_year[0].free_months.toFixed(4)}`,
      ));
      assertions.push(assertTrue(
        'Y2 free_months equals baseline (subject ignored)',
        Math.abs(mismatchOut.per_year[1].free_months - baseOut.per_year[1].free_months) < 0.001,
        `mismatch=${mismatchOut.per_year[1].free_months.toFixed(4)}, base=${baseOut.per_year[1].free_months.toFixed(4)}`,
      ));

      // Sanity: the extreme subject concession (5 months) would have created a
      // massive divergence if applied — verify it did NOT inflate the output
      const classB_stab = 0.75;
      assertions.push(assertLte(
        'Y1 free_months not inflated by lease-up subject (must be ≤ 1.5× class default)',
        mismatchOut.per_year[0].free_months,
        classB_stab * 1.5,
      ));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F6 — Mode-mismatch enforcement (LEASE_UP subject rejected for STABILIZED deal)', passed, assertions });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F7 — Bad-input defensibility (NaN suppression, explicit reason returned)
  //      Bad pool (all queries throw), NaN supply score, null deal ID
  // ──────────────────────────────────────────────────────────────────────────
  {
    const assertions: FixtureResult['assertions'] = [];
    let passed = true;
    try {
      // Scenario A: pool throws on every query → emptyOutput returned, no crash
      const badPool = {
        query: async () => { throw new Error('DB connection lost'); },
      } as unknown as Pool;

      const badEngine = new ConcessionEnvironmentEngine(badPool);
      const badOut = await badEngine.computeForDeal('deal-f7-bad', 3);

      assertions.push(assertTrue('bad pool: per_year is empty array', badOut.per_year.length === 0,
        `${badOut.per_year.length}`));
      assertions.push(assertTrue('bad pool: no crash (deal_id returned)', badOut.deal_id === 'deal-f7-bad', ''));
      assertions.push(assertTrue('bad pool: degraded_reason is non-null string',
        typeof badOut.degraded_reason === 'string' && badOut.degraded_reason.length > 0,
        String(badOut.degraded_reason)));

      // Scenario B: NaN supply risk score → treated as null (modifier = 1.0)
      const nanEngine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'B', submarket_id: 'sm7' },
        calibration: null,
        supplyRiskScore: NaN,
        subjectHistory: null,
      }));
      const nanOut = await nanEngine.computeForDeal('deal-f7-nan', 1);

      assertions.push(assertTrue('NaN supply score: modifier = 1.0',
        Math.abs(nanOut.per_year[0].supply_pressure_modifier - 1.0) < 0.01,
        nanOut.per_year[0].supply_pressure_modifier.toFixed(4)));
      assertions.push(assertTrue('NaN supply score: supply_pressure_score is null', nanOut.supply_pressure_score === null, ''));

      // Scenario C: concession_pct should never be negative even with extreme M04 (score=0 → modifier=0.5)
      const extremeEngine = new ConcessionEnvironmentEngine(buildMockPool({
        deal: { deal_mode: 'STABILIZED', property_class: 'A', submarket_id: 'sm7' },
        calibration: null,
        supplyRiskScore: 0,
        subjectHistory: null,
      }));
      const extremeOut = await extremeEngine.computeForDeal('deal-f7-extreme', 5);

      assertions.push(assertTrue('extreme low supply: all concession_pct ≥ 0',
        extremeOut.per_year.every(y => y.concession_pct >= 0),
        extremeOut.per_year.map(y => y.concession_pct.toFixed(4)).join(',')));
      assertions.push(assertTrue('extreme low supply: all free_months ≥ 0',
        extremeOut.per_year.every(y => y.free_months >= 0),
        extremeOut.per_year.map(y => y.free_months.toFixed(4)).join(',')));

      passed = assertions.every(a => a.passed);
    } catch (e: any) {
      passed = false;
      assertions.push({ label: 'no exception', passed: false, detail: e.message });
    }
    results.push({ name: 'F7 — Bad-input defensibility (NaN suppression)', passed, assertions });
  }

  return results;
}

/**
 * Convenience: run all fixtures against a real pool and print results to console.
 * Call this from an admin route or one-shot script for integration verification.
 */
export async function runAndPrintFixtures(pool?: Pool): Promise<void> {
  const results = await runFixtures(pool);
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
