/**
 * F9 Pro Forma Tier 3 — Refinement unit tests.
 *
 * Covers:
 *   - T001 position adjustment module (3 modes + half-life defaults)
 *   - T002 renewal-aware revenue formula + renewal-rate baselines
 *   - T003 per-strategy template tuning (BTS Y3+ truncation, STR seasonal)
 *   - T004 calibration metadata wrappers (refusal / Gordon / spread)
 *   - T005 per-line OPEX cycle drivers
 *
 * NOTE: tests do not touch the database. All Tier 3 calibration is in
 * pure TypeScript modules.
 */

import { describe, test, expect } from 'vitest';

import {
  evaluatePositionAt,
  derivePositionSeries,
  positionContributionForYear,
  resolveHalfLife,
  POSITION_HALF_LIFE_DEFAULTS,
  POSITION_CALIBRATION,
  type PositionAdjustmentSpec,
} from '../layered-growth/position-adjustment';

import {
  computeSimpleRevenue,
  computeMarkToMarketRevenue,
  computeRenewalAwareRevenue,
  lookupRenewalRateBaseline,
  RENEWAL_RATE_BASELINES,
  RENEWAL_BASELINE_CALIBRATION,
} from '../revenue/revenue-formulas';

import {
  STRATEGY_TEMPLATE_TUNING,
  applyTemplateGrowthTuning,
  resolveSeasonalOccupancyFactor,
  PROFORMA_TEMPLATES,
  OPEX_LINE_ITEMS,
  OPEX_CYCLE_DRIVER_CALIBRATION,
  PROFORMA_BLUEPRINT,
  type ProFormaTemplateId,
} from '../blueprint/proforma-blueprint';

import {
  ASSET_CLASS_SPREAD_BPS,
  ASSET_CLASS_SPREAD_CALIBRATION,
} from '../layered-growth/rent-growth';

import {
  REFUSAL_THRESHOLDS,
  REFUSAL_THRESHOLDS_CALIBRATION,
} from '../validators/confidence-bands';

import {
  GORDON_THRESHOLDS,
  GORDON_THRESHOLDS_CALIBRATION,
} from '../validators/gordon-growth';

// ────────────────────────────────────────────────────────────────────────────
// T001 — Position adjustment
// ────────────────────────────────────────────────────────────────────────────

describe('T001 position adjustment (spec §10)', () => {
  describe('mean_reverting mode', () => {
    test('initial position returned at year 0', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.10,
        mode: 'mean_reverting',
        assetClass: 'multifamily',
      };
      expect(evaluatePositionAt(spec, 0)).toBeCloseTo(0.10, 8);
    });

    test('decays exponentially with the configured half-life', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.10,
        mode: 'mean_reverting',
        halfLifeYears: 5,
      };
      // After exactly one half-life the value should be initial / 2.
      expect(evaluatePositionAt(spec, 5)).toBeCloseTo(0.05, 6);
      // After two half-lives, initial / 4.
      expect(evaluatePositionAt(spec, 10)).toBeCloseTo(0.025, 6);
    });

    test('discount closure uses asset-class-specific half-life when none supplied', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: -0.10,
        mode: 'mean_reverting',
        assetClass: 'multifamily',
      };
      // Multifamily discount default = 6yr → after 6yr |position| = 0.05
      expect(Math.abs(evaluatePositionAt(spec, 6))).toBeCloseTo(0.05, 6);
    });

    test('half-life resolution prefers explicit, then asset-class, then default', () => {
      const explicit: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'mean_reverting',
        halfLifeYears: 7,
        assetClass: 'multifamily',
      };
      expect(resolveHalfLife(explicit)).toBe(7);

      const byClassPremium: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'mean_reverting',
        assetClass: 'office',
      };
      expect(resolveHalfLife(byClassPremium)).toBe(POSITION_HALF_LIFE_DEFAULTS.office.premium);

      const byClassDiscount: PositionAdjustmentSpec = {
        initialPosition: -0.05,
        mode: 'mean_reverting',
        assetClass: 'office',
      };
      expect(resolveHalfLife(byClassDiscount)).toBe(POSITION_HALF_LIFE_DEFAULTS.office.discount);

      const fallback: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'mean_reverting',
      };
      expect(resolveHalfLife(fallback)).toBe(POSITION_HALF_LIFE_DEFAULTS.default.premium);
    });
  });

  describe('constant_gap mode', () => {
    test('position never decays', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.08,
        mode: 'constant_gap',
      };
      for (const y of [0, 1, 5, 10, 30]) {
        expect(evaluatePositionAt(spec, y)).toBeCloseTo(0.08, 8);
      }
    });
  });

  describe('widening mode', () => {
    test('compounds at the configured rate', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'widening',
        wideningRatePerYear: 0.02,
      };
      expect(evaluatePositionAt(spec, 1)).toBeCloseTo(0.05 * 1.02, 8);
      expect(evaluatePositionAt(spec, 10)).toBeCloseTo(0.05 * Math.pow(1.02, 10), 8);
    });
  });

  describe('per-year delta series', () => {
    test('series length matches horizon', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.10,
        mode: 'mean_reverting',
        halfLifeYears: 5,
      };
      const series = derivePositionSeries(spec, 10);
      expect(series).toHaveLength(10);
    });

    test('mean-reverting deltas are negative for premium (decay shrinks position)', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.10,
        mode: 'mean_reverting',
        halfLifeYears: 5,
      };
      const series = derivePositionSeries(spec, 5);
      for (const pv of series) {
        expect(pv.value).not.toBeNull();
        expect(pv.value!).toBeLessThan(0);
      }
      // Sum of deltas ≈ end_position − initial_position
      const sum = series.reduce((a, pv) => a + (pv.value ?? 0), 0);
      expect(sum).toBeCloseTo(evaluatePositionAt(spec, 5) - 0.10, 6);
    });

    test('constant-gap deltas are all zero', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'constant_gap',
      };
      const series = derivePositionSeries(spec, 7);
      for (const pv of series) {
        expect(pv.value).toBeCloseTo(0, 10);
      }
    });

    test('widening confidence is lower than mean-reverting (rare path)', () => {
      const wide: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'widening',
      };
      const mr: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'mean_reverting',
      };
      const w = derivePositionSeries(wide, 3);
      const m = derivePositionSeries(mr, 3);
      expect(w[0].confidence).toBeLessThan(m[0].confidence);
    });

    test('positionContributionForYear single-year shortcut matches series entry', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.12,
        mode: 'mean_reverting',
        halfLifeYears: 4,
      };
      const series = derivePositionSeries(spec, 5);
      const single = positionContributionForYear(spec, 3);
      expect(single.value).toBeCloseTo(series[2].value!, 10);
    });

    test('horizon 0 returns empty series', () => {
      const spec: PositionAdjustmentSpec = {
        initialPosition: 0.05,
        mode: 'constant_gap',
      };
      expect(derivePositionSeries(spec, 0)).toEqual([]);
    });
  });

  test('POSITION_CALIBRATION metadata is shaped correctly', () => {
    expect(POSITION_CALIBRATION.calibrationStatus).toBe('tbd');
    expect(POSITION_CALIBRATION.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(POSITION_CALIBRATION.source.length).toBeGreaterThan(0);
  });

  test('multifamily defaults match spec §10 values (4.5yr / 6yr)', () => {
    expect(POSITION_HALF_LIFE_DEFAULTS.multifamily.premium).toBe(4.5);
    expect(POSITION_HALF_LIFE_DEFAULTS.multifamily.discount).toBe(6.0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T002 — Revenue formulas + renewal-rate baselines
// ────────────────────────────────────────────────────────────────────────────

describe('T002 revenue formulas (spec §11)', () => {
  test('SIMPLE: revenue = units × rent_0 × (1+g)^t', () => {
    const pv = computeSimpleRevenue({
      year: 5,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.03,
    });
    const expected = 100 * 1500 * Math.pow(1.03, 5);
    expect(pv.value).toBeCloseTo(expected, 2);
  });

  test('MARK_TO_MARKET: in-place + turnover decomposition matches spec algebra', () => {
    const pv = computeMarkToMarketRevenue({
      year: 3,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.03,
      renewalRate: 0.6,
      escalator: 0.025,
    });
    const inPlace = 100 * 0.6 * 1500 * Math.pow(1.025, 3);
    const turnover = 100 * 0.4 * 1700;
    expect(pv.value).toBeCloseTo(inPlace + turnover, 2);
  });

  test('RENEWAL_AWARE: split renewal vs new-lease growth (spec §11)', () => {
    const pv = computeRenewalAwareRevenue({
      year: 1,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.04,
      renewalRate: 0.55,
      renewalGrowth: 0.025,
    });
    // marketRent is documented as year-t (already trended) — new-lease leg
    // does NOT re-multiply by (1+g_market) per the contract.
    const renewing = 100 * 0.55 * 1500 * (1 + 0.025);
    const newLease = 100 * 0.45 * 1700;
    expect(pv.value).toBeCloseTo(renewing + newLease, 2);
  });

  test('RENEWAL_AWARE: year>1 does NOT double-count market growth', () => {
    // Caller passes year-3 trended marketRent. The result must depend on
    // marketRent verbatim, NOT on (1+marketGrowth) again.
    const pv = computeRenewalAwareRevenue({
      year: 3,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1850, // already trended Y3 value supplied by caller
      marketGrowth: 0.04, // marginal growth this year (informational)
      renewalRate: 0.6,
      renewalGrowth: 0.02,
    });
    const expected = 100 * 0.6 * 1500 * 1.02 + 100 * 0.4 * 1850;
    expect(pv.value).toBeCloseTo(expected, 2);

    // Sanity: changing marketGrowth alone (with marketRent fixed) must NOT
    // change the result — proves the (1+g_market) double-count bug is gone.
    const pv2 = computeRenewalAwareRevenue({
      year: 3,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1850,
      marketGrowth: 0.10, // very different marginal growth
      renewalRate: 0.6,
      renewalGrowth: 0.02,
    });
    expect(pv2.value).toBeCloseTo(pv.value!, 6);
  });

  test('renewal rate clamped to [0,1]', () => {
    const high = computeRenewalAwareRevenue({
      year: 1,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.04,
      renewalRate: 1.5,
      renewalGrowth: 0.025,
    });
    // All units treated as renewing → revenue is purely in-place × (1+g_renew)
    expect(high.value).toBeCloseTo(100 * 1500 * 1.025, 2);

    const low = computeRenewalAwareRevenue({
      year: 1,
      units: 100,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.04,
      renewalRate: -0.5,
      renewalGrowth: 0.025,
    });
    // All units treated as new leases → revenue is purely year-t market rent
    expect(low.value).toBeCloseTo(100 * 1700, 2);
  });

  test('zero / negative units returns missing (null value)', () => {
    const pv = computeSimpleRevenue({
      year: 1,
      units: 0,
      inPlaceRent: 1500,
      marketRent: 1700,
      marketGrowth: 0.03,
    });
    expect(pv.value).toBeNull();
    // missing() helper returns DEFAULT data quality with confidence 0
    expect(pv.confidence).toBe(0);
  });

  describe('renewal-rate baselines (spec §14)', () => {
    test('multifamily values escalate from urban → tertiary', () => {
      const u = lookupRenewalRateBaseline('multifamily', 'urban');
      const sub = lookupRenewalRateBaseline('multifamily', 'suburban');
      const sec = lookupRenewalRateBaseline('multifamily', 'secondary');
      const ter = lookupRenewalRateBaseline('multifamily', 'tertiary');
      expect(u).toBeLessThan(sub);
      expect(sub).toBeLessThan(sec);
      expect(sec).toBeLessThan(ter);
    });

    test('industrial baselines highest (sticky tenants)', () => {
      const ind = lookupRenewalRateBaseline('industrial', 'suburban');
      const mf = lookupRenewalRateBaseline('multifamily', 'suburban');
      expect(ind).toBeGreaterThan(mf);
    });

    test('unknown asset class falls back to 0.55 default', () => {
      expect(lookupRenewalRateBaseline('crypto_mine', 'urban')).toBe(0.55);
    });

    test('STR has no baseline (booking-by-booking) → fallback', () => {
      expect(lookupRenewalRateBaseline('str', 'urban')).toBe(0.55);
    });

    test('baseline table + calibration metadata are exported', () => {
      expect(RENEWAL_RATE_BASELINES).toBeDefined();
      expect(RENEWAL_BASELINE_CALIBRATION.calibrationStatus).toBe('tbd');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T003 — Per-strategy template tuning
// ────────────────────────────────────────────────────────────────────────────

describe('T003 per-strategy template tuning', () => {
  test('tuning registry is exhaustive over all template IDs', () => {
    const templateIds = Object.keys(PROFORMA_TEMPLATES) as ProFormaTemplateId[];
    for (const id of templateIds) {
      expect(STRATEGY_TEMPLATE_TUNING).toHaveProperty(id);
    }
    // And no extras either (catches drift if a template is removed).
    const tuningIds = Object.keys(STRATEGY_TEMPLATE_TUNING);
    expect(tuningIds.sort()).toEqual(templateIds.sort());
  });

  test('BTS truncates growth past Y3', () => {
    expect(applyTemplateGrowthTuning('development_ground_up', 1, 0.03)).toBe(0.03);
    expect(applyTemplateGrowthTuning('development_ground_up', 3, 0.03)).toBe(0.03);
    expect(applyTemplateGrowthTuning('development_ground_up', 4, 0.03)).toBe(0);
    expect(applyTemplateGrowthTuning('development_ground_up', 10, 0.03)).toBe(0);
  });

  test('flip truncates past Y1', () => {
    expect(applyTemplateGrowthTuning('flip', 1, 0.05)).toBe(0.05);
    expect(applyTemplateGrowthTuning('flip', 2, 0.05)).toBe(0);
  });

  test('untuned templates pass growth through unchanged', () => {
    expect(applyTemplateGrowthTuning('acquisition_stabilized', 5, 0.04)).toBe(0.04);
    expect(applyTemplateGrowthTuning('acquisition_value_add', 5, 0.04)).toBe(0.04);
  });

  test('STR seasonal multipliers average ≈ 1.0 across the year', () => {
    let sum = 0;
    for (let m = 1; m <= 12; m++) sum += resolveSeasonalOccupancyFactor('str_shortterm', m);
    expect(sum / 12).toBeCloseTo(1.0, 1);
  });

  test('STR peak summer > shoulder', () => {
    const may = resolveSeasonalOccupancyFactor('str_shortterm', 5);
    const oct = resolveSeasonalOccupancyFactor('str_shortterm', 10);
    expect(may).toBeGreaterThan(oct);
  });

  test('non-STR templates return 1.0 regardless of month', () => {
    for (let m = 1; m <= 12; m++) {
      expect(resolveSeasonalOccupancyFactor('acquisition_stabilized', m)).toBe(1.0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T004 — Calibration metadata wrappers
// ────────────────────────────────────────────────────────────────────────────

describe('T004 calibration metadata wrappers', () => {
  test('REFUSAL_THRESHOLDS unchanged for back-compat', () => {
    expect(REFUSAL_THRESHOLDS.minComps).toBe(5);
    expect(REFUSAL_THRESHOLDS.minHistoryYears).toBe(3);
  });

  test('REFUSAL_THRESHOLDS_CALIBRATION shape', () => {
    expect(REFUSAL_THRESHOLDS_CALIBRATION.calibrationStatus).toBe('tbd');
    expect(REFUSAL_THRESHOLDS_CALIBRATION.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REFUSAL_THRESHOLDS_CALIBRATION.source.length).toBeGreaterThan(0);
  });

  test('GORDON_THRESHOLDS unchanged for back-compat', () => {
    expect(GORDON_THRESHOLDS.overPromiseBps).toBe(-25);
    expect(GORDON_THRESHOLDS.conservativeBps).toBe(100);
  });

  test('GORDON_THRESHOLDS_CALIBRATION shape', () => {
    expect(GORDON_THRESHOLDS_CALIBRATION.calibrationStatus).toBe('tbd');
    expect(GORDON_THRESHOLDS_CALIBRATION.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('ASSET_CLASS_SPREAD_BPS unchanged for back-compat', () => {
    expect(ASSET_CLASS_SPREAD_BPS.multifamily).toBe(30);
    expect(ASSET_CLASS_SPREAD_BPS.default).toBe(30);
  });

  test('ASSET_CLASS_SPREAD_CALIBRATION shape', () => {
    expect(ASSET_CLASS_SPREAD_CALIBRATION.calibrationStatus).toBe('tbd');
    expect(ASSET_CLASS_SPREAD_CALIBRATION.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T005 — Per-line OPEX cycle drivers
// ────────────────────────────────────────────────────────────────────────────

describe('T005 per-line OPEX cycle drivers', () => {
  test('every line has a structured cycleDriver', () => {
    for (const line of OPEX_LINE_ITEMS) {
      expect(line.cycleDriver).toBeDefined();
      expect(line.cycleDriver.code).toBeTruthy();
      expect(line.cycleDriver.label).toBeTruthy();
      expect(line.cycleDriver.source).toBeTruthy();
    }
  });

  test('expected source codes', () => {
    const byKey = Object.fromEntries(OPEX_LINE_ITEMS.map((l) => [l.key, l.cycleDriver]));
    expect(byKey.propertyTax.source).toBe('platform_intra');
    expect(byKey.insurance.source).toBe('gc_reinsurance_index');
    expect(byKey.utilities.seriesId).toBe('CUUR0000SEHF');
    expect(byKey.repairsMaintenance.seriesId).toBe('PCU8113');
    expect(byKey.payroll.seriesId).toBe('CIU2010000000000A');
    expect(byKey.marketingAdmin.seriesId).toBe('CUSR0000SA0');
    expect(byKey.replacementReserves.seriesId).toBe('CUSR0000SA0');
    expect(byKey.other.seriesId).toBe('CUSR0000SA0');
    expect(byKey.managementFee.source).toBe('derived');
  });

  test('legacy growthDriver field is preserved for back-compat', () => {
    for (const line of OPEX_LINE_ITEMS) {
      expect(typeof line.growthDriver).toBe('string');
    }
  });

  test('OPEX_CYCLE_DRIVER_CALIBRATION is exported with calibrationStatus', () => {
    expect(['tbd', 'partial', 'calibrated']).toContain(
      OPEX_CYCLE_DRIVER_CALIBRATION.calibrationStatus,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T006 — Composite blueprint version + new exports
// ────────────────────────────────────────────────────────────────────────────

describe('T006 composite blueprint integration', () => {
  test('PROFORMA_BLUEPRINT version bumped to 2.1.0', () => {
    expect(PROFORMA_BLUEPRINT.version).toBe('2.1.0');
  });

  test('new Tier 3 exports are exposed on the composite', () => {
    expect(PROFORMA_BLUEPRINT.templateTuning).toBe(STRATEGY_TEMPLATE_TUNING);
    expect(PROFORMA_BLUEPRINT.opexCycleDriverCalibration).toBe(
      OPEX_CYCLE_DRIVER_CALIBRATION,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// T007 — projectProforma orchestrator (Tier 1+2+3 integration)
// ────────────────────────────────────────────────────────────────────────────

import { projectProforma, type ProjectionInputs } from '../proforma-projection.service';
import { provenanced } from '../../../types/provenanced-value';
import { OPEX_LINE_KEYS } from '../layered-growth/opex-growth';

function pv(v: number, conf = 0.7) {
  return provenanced(v, 'platform', conf, 'computed', null);
}
function zeroStructural() {
  return provenanced(0, 'platform', 1.0, 'derived', 'no FL override');
}
function baseInputs(overrides: Partial<ProjectionInputs> = {}): ProjectionInputs {
  return {
    templateId: 'acquisition_stabilized',
    revenueFormula: 'simple',
    horizonYears: 5,
    rentGrowthBase: {
      horizonYears: 5,
      assetClass: 'multifamily',
      momentum: pv(0.04),
      cyclePressureIndex: pv(0.2),
      cpiShelterYoY: pv(0.035),
      eventDeltas: [],
    },
    opexBase: {
      propertyTax:        { momentum: pv(0.03), cycle: pv(0.005), anchor: pv(0.025), eventDeltas: [], structuralOverride: zeroStructural() },
      insurance:          { momentum: pv(0.08), cycle: pv(0.10),  anchor: pv(0.04),  eventDeltas: [], structuralOverride: zeroStructural() },
      utilities:          { momentum: pv(0.04), cycle: pv(0.02),  anchor: pv(0.03),  eventDeltas: [], structuralOverride: zeroStructural() },
      repairsMaintenance: { momentum: pv(0.03), cycle: pv(0.01),  anchor: pv(0.025), eventDeltas: [], structuralOverride: zeroStructural() },
      payroll:            { momentum: pv(0.04), cycle: pv(0.02),  anchor: pv(0.035), eventDeltas: [], structuralOverride: zeroStructural() },
      marketingAdmin:     { momentum: pv(0.025),cycle: pv(0.005), anchor: pv(0.025), eventDeltas: [], structuralOverride: zeroStructural() },
      replacementReserves:{ momentum: pv(0.025),cycle: pv(0.005), anchor: pv(0.025), eventDeltas: [], structuralOverride: zeroStructural() },
      other:              { momentum: pv(0.025),cycle: pv(0.005), anchor: pv(0.025), eventDeltas: [], structuralOverride: zeroStructural() },
    },
    revenueParams: {
      units: 100,
      inPlaceRent: 1500,
      marketRentYear1: 1600,
    },
    noiMargin: 0.60,
    ...overrides,
  };
}

describe('T007 projectProforma orchestrator (Tier 1+2+3 wiring)', () => {
  test('produces a year per horizon with exhaustive OPEX rows', () => {
    const out = projectProforma(baseInputs());
    expect(out).toHaveLength(5);
    for (const y of out) {
      expect(y.opex).toHaveLength(OPEX_LINE_KEYS.length);
      for (const line of y.opex) {
        expect(OPEX_LINE_KEYS).toContain(line.line);
        expect(line.cycleDriver).toBeDefined();
        expect(line.cycleDriver.code).toBeTruthy();
        expect(line.cycleDriver.source).toBeTruthy();
      }
    }
  });

  test('BTS template truncates rent growth and per-line OPEX growth at Y4+', () => {
    const out = projectProforma(baseInputs({
      templateId: 'development_ground_up',
      horizonYears: 5,
    }));
    // Y1-Y3 carry growth (>0), Y4+ tuned to 0.
    expect(out[0].rentGrowth.value).toBeGreaterThan(0);
    expect(out[2].rentGrowth.value).toBeGreaterThan(0);
    expect(out[3].rentGrowth.value).toBe(0);
    expect(out[4].rentGrowth.value).toBe(0);
    // Same for OPEX lines (each line tuned independently per template rule).
    for (const line of out[3].opex) expect(line.growthTuned).toBe(0);
    for (const line of out[4].opex) expect(line.growthTuned).toBe(0);
    // Tuning must preserve raw vs tuned distinction.
    const truncatedLine = out[3].opex.find(l => l.line === 'utilities')!;
    expect(truncatedLine.growthRaw).toBeGreaterThan(0);
    expect(truncatedLine.growthTuned).toBe(0);
  });

  test('Flip template truncates Y2+ growth (exit-by-year-1 strategy)', () => {
    const out = projectProforma(baseInputs({
      templateId: 'flip',
      horizonYears: 3,
    }));
    // growthTruncationYear:1 means year > 1 is tuned to 0; Y1 still carries.
    expect(out[0].rentGrowth.value).toBeGreaterThan(0);
    expect(out[1].rentGrowth.value).toBe(0);
    expect(out[2].rentGrowth.value).toBe(0);
  });

  test('renewal_aware formula is invoked when revenueFormula is set', () => {
    const inputs = baseInputs({
      revenueFormula: 'renewal_aware',
      revenueParams: {
        units: 100,
        inPlaceRent: 1500,
        marketRentYear1: 1600,
        renewalRate: 0.6,
        renewalGrowth: 0.02,
      },
    });
    const out = projectProforma(inputs);
    const y1 = out[0];
    // Renewal-aware Y1: 60 units × 1500 × 1.02 + 40 × 1600 = 91,800 + 64,000 = 155,800.
    // Formula returns same-period revenue as inputs (no ×12 wrap).
    const expected = 60 * 1500 * 1.02 + 40 * 1600;
    expect(y1.revenue.value).toBeCloseTo(expected, 0);
  });

  test('simple formula returns units × inPlaceRent × (1+g)^year for Y1', () => {
    const out = projectProforma(baseInputs({
      revenueFormula: 'simple',
      horizonYears: 1,
    }));
    const g = out[0].rentGrowth.value!;
    expect(out[0].revenue.value).toBeCloseTo(100 * 1500 * (1 + g), 2);
  });

  test('positionSpec injects per-year contribution into rent growth', () => {
    const withoutPos = projectProforma(baseInputs({ horizonYears: 1 }));
    const withPos = projectProforma(baseInputs({
      horizonYears: 1,
      positionSpec: {
        initialPosition: 0.10,         // 10% premium
        mode: 'mean_reverting',
        assetClass: 'multifamily',     // 4.5yr half-life premium
      },
    }));
    // Mean-reverting from +10% → 0 contributes a NEGATIVE delta in Y1.
    expect(withPos[0].rentGrowth.value!).toBeLessThan(withoutPos[0].rentGrowth.value!);
    expect(withPos[0].positionContribution).toBeLessThan(0);
    expect(withoutPos[0].positionContribution).toBe(0);
  });

  test('OPEX cycleDriver codes match the blueprint registry verbatim', () => {
    const out = projectProforma(baseInputs({ horizonYears: 1 }));
    const lookup = Object.fromEntries(OPEX_LINE_ITEMS.map(l => [l.key, l.cycleDriver]));
    for (const line of out[0].opex) {
      expect(line.cycleDriver).toEqual(lookup[line.line]);
    }
  });

  test('marketRent_t trends year-over-year by tuned growth', () => {
    const out = projectProforma(baseInputs({ revenueFormula: 'simple', horizonYears: 3 }));
    expect(out[0].marketRentT).toBeCloseTo(1600, 6);
    expect(out[1].marketRentT).toBeCloseTo(1600 * (1 + out[1].rentGrowth.value!), 4);
    expect(out[2].marketRentT).toBeCloseTo(out[1].marketRentT * (1 + out[2].rentGrowth.value!), 4);
  });

  test('management fee row auto-couples to revenue growth (tuned)', () => {
    const out = projectProforma(baseInputs({ horizonYears: 2 }));
    const mgmtY1 = out[0].opex.find(l => l.line === 'managementFee')!;
    expect(mgmtY1.growthTuned).toBeCloseTo(out[0].rentGrowth.value!, 6);
  });
});
