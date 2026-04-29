/**
 * F9 Pro Forma — Tier 1 Protectors Tests
 * ======================================
 *
 * Covers:
 *  - Layered rent growth (spec §6) — components, weight schedule, composition
 *  - Layered OPEX growth (spec §7) — per-line, FL structural overrides, NOI identity
 *  - Gordon Growth validator (spec §8) — severity bands
 *  - Confidence intervals (spec §9) — percentile math, 3-band override classification, refusal threshold
 */

import { describe, test, expect } from 'vitest';
import { provenanced } from '../../../types/provenanced-value';
import {
  computeLayeredRentGrowth,
  computeMomentum,
  computeAnchor,
  computeCycle,
  computeEventDeltasSum,
  computePosition,
  getRentGrowthWeights,
  projectRentGrowthSeries,
  ASSET_CLASS_SPREAD_BPS,
} from '../layered-growth/rent-growth';
import {
  computeOpexLineGrowth,
  computeFloridaStructuralOverride,
  computeManagementFeeGrowth,
  computeTotalOpexGrowth,
  noiGrowthIdentity,
  DEFAULT_LINE_ANCHORS,
  DEFAULT_LINE_SHARES,
  FL_NON_HOMESTEAD_CAP,
} from '../layered-growth/opex-growth';
import {
  validateGordonGrowth,
  buildGordonChartSeries,
  GORDON_THRESHOLDS,
} from '../validators/gordon-growth';
import {
  computeConfidenceBands,
  classifyOverride,
  evaluateRefusal,
  inflateSigmaSparsity,
  REFUSAL_THRESHOLDS,
  Z_P25,
  Z_P10,
} from '../validators/confidence-bands';

// ───────────────────────────────────────────────────────────────────────────
// §6 Rent growth
// ───────────────────────────────────────────────────────────────────────────

describe('Layered rent growth — weight schedule', () => {
  test('weights sum to 1 every year', () => {
    for (let y = 1; y <= 10; y++) {
      const w = getRentGrowthWeights(y);
      expect(w.momentum + w.cycle + w.anchor).toBeCloseTo(1, 6);
    }
  });

  test('momentum dominates Y1, anchor dominates Y5+', () => {
    const y1 = getRentGrowthWeights(1);
    const y5 = getRentGrowthWeights(5);
    expect(y1.momentum).toBeGreaterThan(y1.anchor);
    expect(y5.anchor).toBeGreaterThan(y5.momentum);
    expect(y5.anchor).toBeGreaterThan(y5.cycle);
  });

  test('momentum monotonically decreases with year', () => {
    const ys = [1, 2, 3, 4, 5, 6, 7];
    const ms = ys.map((y) => getRentGrowthWeights(y).momentum);
    for (let i = 1; i < ms.length; i++) {
      expect(ms[i]).toBeLessThanOrEqual(ms[i - 1] + 1e-9);
    }
  });
});

describe('Layered rent growth — components', () => {
  const baseInputs = {
    horizonYears: 7,
    assetClass: 'multifamily',
    momentum: provenanced(0.04, 'platform', 0.8),
    cyclePressureIndex: provenanced(0.5, 'platform', 0.7),
    cpiShelterYoY: provenanced(0.025, 'platform', 0.95),
    eventDeltas: [provenanced(0.002, 'platform', 0.6)],
    position: provenanced(0.01, 'platform', 0.5),
  } as const;

  test('momentum passes through value', () => {
    const m = computeMomentum({ ...baseInputs, year: 1 });
    expect(m.value).toBeCloseTo(0.04, 6);
  });

  test('anchor adds asset-class spread to CPI shelter', () => {
    const a = computeAnchor({ ...baseInputs, year: 1 });
    expect(a.value).toBeCloseTo(
      0.025 + ASSET_CLASS_SPREAD_BPS.multifamily / 10000,
      6,
    );
  });

  test('cycle scales pressure index by saturation', () => {
    const c = computeCycle({ ...baseInputs, year: 1 });
    expect(c.value).toBeCloseTo(0.5 * (150 / 10000), 6);
  });

  test('event deltas sum and use min confidence', () => {
    const sum = computeEventDeltasSum({
      ...baseInputs,
      year: 1,
      eventDeltas: [
        provenanced(0.005, 'platform', 0.8),
        provenanced(-0.001, 'platform', 0.4),
      ],
    });
    expect(sum.value).toBeCloseTo(0.004, 6);
    expect(sum.confidence).toBeCloseTo(0.4, 6);
  });

  test('missing momentum is gracefully treated as 0 contribution', () => {
    const r = computeLayeredRentGrowth({
      ...baseInputs,
      year: 1,
      momentum: null,
    });
    expect(r.contributions.momentum).toBe(0);
    // anchor + cycle + position + events should still produce a valid number
    expect(typeof r.growth.value).toBe('number');
  });

  test('full composition: g(t) = sum of weighted components + events + position', () => {
    const r = computeLayeredRentGrowth({ ...baseInputs, year: 2 });
    const expected =
      r.contributions.momentum +
      r.contributions.cycle +
      r.contributions.anchor +
      r.contributions.eventDeltas +
      r.contributions.position;
    expect(r.growth.value).toBeCloseTo(expected, 9);
  });

  test('projectRentGrowthSeries returns horizon-length array', () => {
    const series = projectRentGrowthSeries(baseInputs, 5);
    expect(series).toHaveLength(5);
    expect(series.map((s) => s.year)).toEqual([1, 2, 3, 4, 5]);
  });

  test('position defaults to 0 with high confidence when missing', () => {
    const p = computePosition({ ...baseInputs, year: 1, position: null });
    expect(p.value).toBe(0);
    expect(p.confidence).toBeGreaterThan(0.8);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §7 OPEX growth + FL overrides + NOI identity
// ───────────────────────────────────────────────────────────────────────────

describe('Layered OPEX growth — per-line composition', () => {
  test('uses default anchor when no anchor input provided', () => {
    const r = computeOpexLineGrowth({
      line: 'utilities',
      year: 1,
      momentum: provenanced(0.02, 'platform', 0.8),
      cycle: null,
      anchor: null,
      eventDeltas: [],
      structuralOverride: provenanced(0, 'platform', 1.0),
    });
    // Y1 weights have small anchor share but it should still register.
    expect(r.contributions.anchor).toBeCloseTo(
      r.weights.anchor * DEFAULT_LINE_ANCHORS.utilities,
      6,
    );
  });

  test('total = sum of per-line contributions', () => {
    const r = computeOpexLineGrowth({
      line: 'insurance',
      year: 3,
      momentum: provenanced(0.06, 'platform', 0.7),
      cycle: provenanced(0.02, 'platform', 0.5),
      anchor: provenanced(0.05, 'platform', 0.8),
      eventDeltas: [provenanced(0.01, 'platform', 0.6)],
      structuralOverride: provenanced(0.005, 'platform', 0.9),
    });
    const expected =
      r.contributions.momentum +
      r.contributions.cycle +
      r.contributions.anchor +
      r.contributions.eventDeltas +
      r.contributions.structuralOverride;
    expect(r.growth.value).toBeCloseTo(expected, 9);
  });
});

describe('Florida structural overrides', () => {
  test('property tax Y1 step uses purchase / pre-sale ratio', () => {
    const o = computeFloridaStructuralOverride('propertyTax', 1, {
      acquiredThisYear: true,
      preSaleAssessedValue: 10_000_000,
      purchasePrice: 15_000_000,
      coastal: false,
    });
    expect(o.value).toBeCloseTo(0.5, 6); // +50% step
  });

  test('property tax cap clips total growth at 10% in Y2+', () => {
    const r = computeOpexLineGrowth({
      line: 'propertyTax',
      year: 2,
      momentum: provenanced(0.25, 'platform', 0.8), // pretend hot momentum
      cycle: null,
      anchor: provenanced(0.05, 'platform', 0.8),
      eventDeltas: [],
      structuralOverride: provenanced(0, 'platform', 1.0),
      applyFloridaPropertyTaxCap: true,
    });
    expect(r.growth.value).toBeCloseTo(FL_NON_HOMESTEAD_CAP, 6);
    expect(r.ceilingApplied).toBe(true);
  });

  test('insurance hurricane premium present only on coastal FL', () => {
    const inland = computeFloridaStructuralOverride('insurance', 1, {
      acquiredThisYear: false,
      coastal: false,
    });
    const coastal = computeFloridaStructuralOverride('insurance', 1, {
      acquiredThisYear: false,
      coastal: true,
    });
    expect(inland.value).toBe(0);
    expect(coastal.value).toBeGreaterThan(0);
  });

  test('hurricane premium decays year over year', () => {
    const y1 = computeFloridaStructuralOverride('insurance', 1, {
      acquiredThisYear: false,
      coastal: true,
    });
    const y3 = computeFloridaStructuralOverride('insurance', 3, {
      acquiredThisYear: false,
      coastal: true,
    });
    expect(y3.value).toBeLessThan(y1.value!);
  });
});

describe('Mgmt fee auto-couple', () => {
  test('passes through revenue growth', () => {
    const r = computeManagementFeeGrowth(
      2,
      provenanced(0.035, 'platform', 0.8),
    );
    expect(r.growth.value).toBeCloseTo(0.035, 6);
  });
  test('zero when revenue growth missing', () => {
    const r = computeManagementFeeGrowth(2, null);
    expect(r.growth.value).toBe(0);
  });
});

describe('Total OPEX growth — dollar-weighted average', () => {
  test('weighted average sums to expected value', () => {
    const lineResults = [
      computeOpexLineGrowth({
        line: 'propertyTax',
        year: 1,
        momentum: null,
        cycle: null,
        anchor: provenanced(0.04, 'platform', 0.8),
        eventDeltas: [],
        structuralOverride: provenanced(0, 'platform', 1.0),
      }),
      computeOpexLineGrowth({
        line: 'insurance',
        year: 1,
        momentum: null,
        cycle: null,
        anchor: provenanced(0.07, 'platform', 0.8),
        eventDeltas: [],
        structuralOverride: provenanced(0, 'platform', 1.0),
      }),
    ];
    const total = computeTotalOpexGrowth({
      lineResults,
      lineShares: { propertyTax: 0.5, insurance: 0.5 },
    });
    const expected =
      0.5 * (lineResults[0].growth.value ?? 0) +
      0.5 * (lineResults[1].growth.value ?? 0);
    expect(total.totalGrowth.value).toBeCloseTo(expected, 9);
  });

  test('throws on empty input', () => {
    expect(() => computeTotalOpexGrowth({ lineResults: [] })).toThrow();
  });
});

describe('NOI growth identity (spec §7)', () => {
  test('canonical FL multifamily example', () => {
    const r = noiGrowthIdentity(
      provenanced(0.03, 'platform', 0.8),
      provenanced(0.052, 'platform', 0.8),
      0.6,
    );
    // (0.03 - 0.052*0.4) / 0.6
    expect(r.value).toBeCloseTo((0.03 - 0.052 * 0.4) / 0.6, 6);
  });

  test('returns null when margin out of range', () => {
    const r = noiGrowthIdentity(
      provenanced(0.03, 'platform', 0.8),
      provenanced(0.052, 'platform', 0.8),
      0,
    );
    expect(r.value).toBeNull();
  });

  test('returns null when growth inputs missing', () => {
    const r = noiGrowthIdentity(null, provenanced(0.05, 'platform', 0.8), 0.6);
    expect(r.value).toBeNull();
  });

  test('high opex erases rent growth (spec example)', () => {
    // rent +3%, opex +12% on 60% margin → NOI growth negative
    const r = noiGrowthIdentity(
      provenanced(0.03, 'platform', 0.8),
      provenanced(0.12, 'platform', 0.8),
      0.6,
    );
    expect(r.value).toBeLessThan(0);
  });
});

describe('Default line shares roughly cover the OPEX stack', () => {
  test('sum is close to 1 (within rounding)', () => {
    const sum = Object.values(DEFAULT_LINE_SHARES).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(0.9);
    expect(sum).toBeLessThanOrEqual(1.0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §8 Gordon Growth validator
// ───────────────────────────────────────────────────────────────────────────

describe('Gordon Growth validator', () => {
  test('flags GORDON_OVER_PROMISE when exit cap < implied − 25 bps', () => {
    const r = validateGordonGrowth({
      exitCap: 0.05,
      terminalGrowth: 0.04,
      requiredReturn: 0.095,
    });
    // implied = 9.5% - 4% = 5.5%; exit = 5.0% → divergence = -50 bps
    expect(r.flag).toBe('GORDON_OVER_PROMISE');
    expect(r.severity).toBe('high');
    expect(r.divergenceBps).toBe(-50);
    expect(r.valid).toBe(false);
  });

  test('flags GORDON_CONSERVATIVE when exit cap > implied + 100 bps', () => {
    const r = validateGordonGrowth({
      exitCap: 0.07,
      terminalGrowth: 0.02,
      requiredReturn: 0.085,
    });
    // implied = 6.5%; exit = 7% → divergence = +50 (still within range)
    expect(r.flag).toBeUndefined();

    const r2 = validateGordonGrowth({
      exitCap: 0.085,
      terminalGrowth: 0.02,
      requiredReturn: 0.085,
    });
    // implied = 6.5%; exit = 8.5% → divergence = +200 bps → conservative
    expect(r2.flag).toBe('GORDON_CONSERVATIVE');
    expect(r2.severity).toBe('info');
  });

  test('valid when divergence is in (−25, +100] bps band', () => {
    const r = validateGordonGrowth({
      exitCap: 0.057,
      terminalGrowth: 0.025,
      requiredReturn: 0.085,
    });
    // implied = 6%; exit 5.7% → -30 bps → still flagged HIGH
    expect(r.flag).toBe('GORDON_OVER_PROMISE');

    const r2 = validateGordonGrowth({
      exitCap: 0.06,
      terminalGrowth: 0.025,
      requiredReturn: 0.085,
    });
    // implied = 6%; exit = 6% → divergence 0 → valid
    expect(r2.valid).toBe(true);
    expect(r2.flag).toBeUndefined();
  });

  test('thresholds match spec', () => {
    expect(GORDON_THRESHOLDS.overPromiseBps).toBe(-25);
    expect(GORDON_THRESHOLDS.conservativeBps).toBe(100);
  });

  test('graceful handling when inputs missing', () => {
    const r = validateGordonGrowth({
      exitCap: null,
      terminalGrowth: 0.025,
      requiredReturn: 0.085,
    });
    expect(r.valid).toBe(false);
    expect(r.divergenceBps).toBeNull();
    expect(r.flag).toBeUndefined();
  });

  test('chart series returns Gordon line plus user point', () => {
    const c = buildGordonChartSeries(
      { exitCap: 0.055, terminalGrowth: 0.03, requiredReturn: 0.09 },
      100,
    );
    expect(c.line.length).toBeGreaterThan(0);
    // Each point on the line satisfies cap = k - g
    for (const p of c.line) {
      expect(p.cap).toBeCloseTo(0.09 - p.g, 6);
    }
    expect(c.user).toEqual({ g: 0.03, cap: 0.055 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §9 Confidence intervals + refusal
// ───────────────────────────────────────────────────────────────────────────

describe('Confidence bands', () => {
  test('sigma_total = sqrt(sigma_model^2 + sigma_sparsity^2)', () => {
    const b = computeConfidenceBands({
      forecast: 0.03,
      sigmaModel: 0.012,
      sigmaSparsity: 0.005,
    });
    expect(b.sigmaTotal).toBeCloseTo(Math.hypot(0.012, 0.005), 9);
  });

  test('P25/P75 use ±0.674 σ; P10/P90 use ±1.282 σ', () => {
    const b = computeConfidenceBands({
      forecast: 0.04,
      sigmaModel: 0.01,
      sigmaSparsity: 0,
    });
    expect(b.p25).toBeCloseTo(0.04 - Z_P25 * 0.01, 9);
    expect(b.p75).toBeCloseTo(0.04 + Z_P25 * 0.01, 9);
    expect(b.p10).toBeCloseTo(0.04 - Z_P10 * 0.01, 9);
    expect(b.p90).toBeCloseTo(0.04 + Z_P10 * 0.01, 9);
  });

  test('classify within / soft / hard bands', () => {
    const b = computeConfidenceBands({
      forecast: 0.03,
      sigmaModel: 0.01,
      sigmaSparsity: 0,
    });
    // forecast itself
    expect(classifyOverride(0.03, b).classification).toBe('within');
    // 0.5σ above forecast — still inside P25-P75
    expect(classifyOverride(0.035, b).classification).toBe('within');
    // 0.9σ above — between P25-P75 and P10-P90
    expect(classifyOverride(0.039, b).classification).toBe('soft_warning');
    // 2σ above — outside P10-P90
    const hard = classifyOverride(0.05, b);
    expect(hard.classification).toBe('hard_warning');
    expect(hard.requireJustification).toBe(true);
  });
});

describe('Refusal threshold', () => {
  test('passes when comps + history + asset class all sufficient', () => {
    const r = evaluateRefusal({
      stabilizedComps: 8,
      historyYears: 5,
      hasAssetClassRep: true,
    });
    expect(r.refuse).toBe(false);
  });

  test('refuses when comps too few', () => {
    const r = evaluateRefusal({
      stabilizedComps: 2,
      historyYears: 5,
      hasAssetClassRep: true,
    });
    expect(r.refuse).toBe(true);
    expect(r.reason).toBe('INSUFFICIENT_DATA');
    expect(r.available?.comps).toBe(2);
  });

  test('refuses when history too short', () => {
    const r = evaluateRefusal({
      stabilizedComps: 10,
      historyYears: 1.5,
      hasAssetClassRep: true,
    });
    expect(r.refuse).toBe(true);
  });

  test('refuses when asset class not represented', () => {
    const r = evaluateRefusal({
      stabilizedComps: 10,
      historyYears: 5,
      hasAssetClassRep: false,
    });
    expect(r.refuse).toBe(true);
  });

  test('thresholds match spec (5 comps, 3yr history)', () => {
    expect(REFUSAL_THRESHOLDS.minComps).toBe(5);
    expect(REFUSAL_THRESHOLDS.minHistoryYears).toBe(3);
  });
});

describe('Sigma sparsity inflation', () => {
  test('ACTUAL preserves sigma; DEFAULT triples it', () => {
    expect(inflateSigmaSparsity(0.01, 'ACTUAL')).toBeCloseTo(0.01, 9);
    expect(inflateSigmaSparsity(0.01, 'DEFAULT')).toBeCloseTo(0.03, 9);
    expect(inflateSigmaSparsity(0.01, 'INFERRED')).toBeGreaterThan(0.01);
    expect(inflateSigmaSparsity(0.01, 'ESTIMATED')).toBeGreaterThan(
      inflateSigmaSparsity(0.01, 'INFERRED'),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// §9 ACK round-trip — rationale key canonicalization regression
// ───────────────────────────────────────────────────────────────────────────
import { applyFinancialsOverride } from '../../proforma-adjustment.service';

describe('applyFinancialsOverride — rationale key canonicalization (spec §9)', () => {
  function makeMockPool() {
    const calls: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        // Simulate the SELECT in applyFinancialsOverride finding a row
        if (/SELECT.*deal_assumptions/i.test(sql)) {
          return { rows: [{ deal_id: params[0], per_year_overrides: {}, year1_seed: {} }] };
        }
        return { rows: [], rowCount: 1 };
      },
    } as unknown as Parameters<typeof applyFinancialsOverride>[0];
    return { pool, calls };
  }

  test('camelCase patch field writes rationale under snake_case canonical key', async () => {
    const { pool, calls } = makeMockPool();
    try {
      await applyFinancialsOverride(
        pool, 'deal-x', 'vacancyPct', 5, 0.07, 'user-1',
        'Lease-up plan accepted by IC',
      );
    } catch { /* downstream branches may throw on mock data — only the rationale write matters here */ }
    // First SQL after the rationale-bypass is the rationale UPSERT (jsonb_set with rationaleKey)
    const rationaleCall = calls.find(c =>
      typeof c.params[1] === 'string' &&
      (c.params[1] as string).includes('rationale:'));
    expect(rationaleCall).toBeDefined();
    const pathParam = rationaleCall!.params[1] as string;
    // Must contain canonical snake_case form, NOT raw camelCase
    expect(pathParam).toBe('{rationale:vacancy_pct:5}');
    expect(pathParam).not.toContain('vacancyPct');
    // The JSON body should also reflect the canonicalized field name
    const bodyJson = JSON.parse(rationaleCall!.params[2] as string);
    expect(bodyJson.field).toBe('vacancy_pct');
  });

  test('snake_case input passes through unchanged (Section 1/3 rd.key form)', async () => {
    const { pool, calls } = makeMockPool();
    try {
      await applyFinancialsOverride(
        pool, 'deal-x', 'real_estate_tax', 3, 250000, 'user-1',
        'County reassessment notice',
      );
    } catch { /* ignore downstream */ }
    const rationaleCall = calls.find(c =>
      typeof c.params[1] === 'string' &&
      (c.params[1] as string).includes('rationale:'));
    expect(rationaleCall).toBeDefined();
    expect(rationaleCall!.params[1]).toBe('{rationale:real_estate_tax:3}');
  });

  test('empty rationale string deletes the rationale key (still canonicalized)', async () => {
    const { pool, calls } = makeMockPool();
    try {
      await applyFinancialsOverride(
        pool, 'deal-x', 'vacancyPct', 2, 0.06, 'user-1', '   ',
      );
    } catch { /* ignore */ }
    const deleteCall = calls.find(c =>
      typeof c.sql === 'string' && /jsonb.*-\s*\$2/i.test(c.sql));
    expect(deleteCall).toBeDefined();
    expect(deleteCall!.params[1]).toBe('rationale:vacancy_pct:2');
  });
});
