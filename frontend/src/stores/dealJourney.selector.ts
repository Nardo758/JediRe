// ============================================================================
// JEDI RE — dealJourney.selector.ts
// ============================================================================
//
// `useDealJourney(ctx, dqaCount, projections?, trafficProjection?)` — React
// hook that composes a DealJourney from an existing DealContext plus optional
// per-year projection data from the F9 financial engine.
//
// `computeJourneyGap(stateA, stateB)` — pure function exported for unit tests.
//
// DATA CONTRACT (LOCKED slots):
//   stateA.noi           = existingProperty.currentNOI.value (existing/redev)
//                        | redevelopment.existingNOI.value (redev fallback)
//                        | 0 for ground-up development
//   stateA.occupancy     = existingProperty.occupancy.value | market.avgOccupancy
//   stateB.targetNoi     = financial.outputs.noi (stabilized proforma build output)
//                        | computed estimate as fallback (no build yet)
//   stateB.exitCapRate   = financial.assumptions.exitCapRate.value
//   stateB.yearOfStabilization = first year where projections[y].occupancy >= targetOccupancy
//                              | heuristic from holdPeriod when projections absent
//   path.yearByYear      = mapped from F9 projections when available (LOCKED)
//                        | estimated from assumptions when projections absent
//   path.leaseUpTimeline = from trafficProjection.leaseUp when available (M07)
//
// See docs/architecture/deal-journey-framework.md for the full spec.
// ============================================================================

import { useMemo } from 'react';
import {
  isExistingDeal,
  isRedevelopmentDeal,
  type DealContext,
  type FinancialContext,
  type LayeredValue,
  type ExistingPropertyContext,
} from './dealContext.types';
import type {
  DealJourney,
  JourneyStateA,
  JourneyStateB,
  JourneyGap,
  JourneyPath,
  JourneyPathYear,
  JourneyLevers,
  LeverEvidence,
  LeverEvidenceModule,
  JourneyStrategyFrame,
  JourneyScoreTrajectory,
} from './dealJourney.types';

// ---------------------------------------------------------------------------
// Minimal slice types for F9 projection data
// (Avoids importing from financial-engine/types.ts to keep dependency clean)
// ---------------------------------------------------------------------------

/** Minimal per-year projection slice from F9DealFinancials.projections */
export type ProjectionSlice = {
  year: number;
  noi: number;
  occupancy: number | null;
  /** Effective Gross Income — used to compute effRentPerUnit */
  egi: number;
  gpr: number;
};

/** Minimal traffic projection slice from F9DealFinancials.trafficProjection */
export type TrafficProjectionSlice = {
  yearly: Array<{
    year: number;
    vacancyPct: number | null;
    occupancyPct: number | null;
    effRent: number | null;
    rentGrowthPct: number | null;
  }>;
  leaseUp: {
    weeksTo90: number | null;
    weeksTo93: number | null;
    weeksTo95: number | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Safe division — returns 0 when denominator is 0 */
function safePct(num: number, den: number): number {
  return den !== 0 ? num / den : 0;
}

/**
 * Derive which M-module contributed the platform layer for a lever, based on
 * the LayeredValue's source tag.
 */
function deriveEvidence(
  lv: LayeredValue<number>,
  fallbackModule: LeverEvidenceModule,
): LeverEvidence {
  const moduleMap: Array<[string, LeverEvidenceModule]> = [
    ['m05', 'M05'], ['market', 'M05'],
    ['m07', 'M07'], ['traffic', 'M07'],
    ['m04', 'M04'], ['supply', 'M04'],
    ['m26', 'M26'], ['tax', 'M26'],
    ['m37', 'M37'], ['analog', 'M37'],
  ];
  const srcLower = (lv.source ?? '').toLowerCase();
  const resolvedFrom = (lv.resolvedFrom ?? '').toLowerCase();
  const combined = `${srcLower} ${resolvedFrom}`;

  let resolvedModule: LeverEvidenceModule = fallbackModule;
  for (const [key, mod] of moduleMap) {
    if (combined.includes(key)) { resolvedModule = mod; break; }
  }

  return {
    sourceModule: resolvedModule,
    sourceConfidence: lv.confidence ?? 0.5,
    lastCalibrated: lv.updatedAt ?? null,
  };
}

/**
 * Compute weighted-average in-place rent from the existing property's unit mix.
 * Falls back to market avgRent when unitMixProgram is empty.
 */
function weightedAvgRent(
  existing: ExistingPropertyContext | null,
  marketRent: number,
): number {
  if (!existing || existing.unitMixProgram.length === 0) return marketRent;
  const totalUnits = existing.unitMixProgram.reduce((s, r) => s + r.count, 0);
  if (totalUnits === 0) return marketRent;
  const totalRent = existing.unitMixProgram.reduce(
    (s, r) => s + r.targetRent.value * r.count, 0,
  );
  return totalRent / totalUnits;
}

/** Detect whether a given source layer is present by scanning LayeredValue sources. */
function detectSourceLayer(lv: LayeredValue<number>, tag: string): boolean {
  if ((lv.source ?? '').toLowerCase().includes(tag)) return true;
  if ((lv.resolvedFrom ?? '').toLowerCase().includes(tag)) return true;
  const layers = lv.layers;
  if (!layers) return false;
  if (tag === 'broker' && layers.broker != null) return true;
  return false;
}

function detectSourceLayers(
  financial: FinancialContext,
): JourneyStateA['sourceLayers'] {
  // Scan all 7 lever assumptions to detect source provenance
  const samples = Object.values(financial.assumptions) as LayeredValue<number>[];
  const has = (tag: string) => samples.some(lv => detectSourceLayer(lv, tag));
  return {
    broker: has('broker') ? 'present' : 'absent',
    t12: has('t12') ? 'present' : 'absent',
    rentRoll: has('rent_roll') ? 'present' : 'absent',
    taxBill: has('tax_bill') ? 'present' : 'absent',
  };
}

/**
 * Find the first projection year where occupancy reaches the stabilization
 * target. Returns the last projection year if never reached.
 * Falls back to a holdPeriod-derived heuristic when projections are absent.
 */
function findStabilizationYear(
  projections: ProjectionSlice[] | null | undefined,
  targetOccupancy: number,
  holdPeriod: number,
): number {
  if (projections && projections.length > 0) {
    for (const p of projections) {
      if (p.occupancy != null && p.occupancy >= targetOccupancy) {
        return p.year;
      }
    }
    // Never reached threshold — return last year
    return projections[projections.length - 1].year;
  }
  // Heuristic: typical lease-up is ~25% of hold period, bounded [1, 4]
  return Math.min(Math.max(1, Math.ceil(holdPeriod * 0.25)), 4);
}

// ---------------------------------------------------------------------------
// State A composer — current financial reality, source-document-grounded
// ---------------------------------------------------------------------------

function composeStateA(ctx: DealContext, dqaFindingCount: number): JourneyStateA {
  const existing = (isExistingDeal(ctx) || isRedevelopmentDeal(ctx))
    ? ctx.existingProperty
    : null;

  // In-place NOI: from existing property docs or redevelopment existing NOI.
  // NOT the proforma build output. Ground-up development deals start at NOI=0.
  let noi = 0;
  if (isRedevelopmentDeal(ctx) && ctx.redevelopment?.existingNOI?.value != null) {
    noi = ctx.redevelopment.existingNOI.value;
  } else if (existing?.currentNOI?.value != null) {
    noi = existing.currentNOI.value;
  }

  const occupancy = existing?.occupancy?.value ?? ctx.market.avgOccupancy.value ?? 0;
  const marketRent = ctx.market.avgRent.value ?? 0;
  const inPlaceRentPerUnit = weightedAvgRent(existing, marketRent);

  const totalUnits = ctx.totalUnits ?? 0;
  const estimatedGoi = totalUnits > 0
    ? inPlaceRentPerUnit * totalUnits * occupancy * 12
    : 0;
  const expenseRatio = noi > 0 && estimatedGoi > 0
    ? 1 - safePct(noi, estimatedGoi)
    : 0.40;

  const capexLv: LayeredValue<number> = {
    ...ctx.financial.assumptions.capexPerUnit,
    value: ctx.financial.assumptions.capexPerUnit.value * totalUnits,
  };

  return {
    asOf: new Date().toISOString(),
    noi,
    occupancy,
    inPlaceRentPerUnit,
    marketRentPerUnit: marketRent,
    expenseRatio,
    propertyClass: existing?.propertyClass?.value ?? null,
    yearBuilt: existing?.yearBuilt?.value ?? null,
    capexBacklog: capexLv,
    sourceLayers: detectSourceLayers(ctx.financial),
    dataQualityFindings: dqaFindingCount,
  };
}

// ---------------------------------------------------------------------------
// State B composer — stabilized underwriting target
// ---------------------------------------------------------------------------

function composeStateB(
  ctx: DealContext,
  projections: ProjectionSlice[] | null | undefined,
): JourneyStateB {
  const a = ctx.financial.assumptions;
  const vacancyPct = a.vacancy.value ?? 0.05;
  const targetOccupancy = 1 - vacancyPct;
  const holdPeriod = a.holdPeriod.value ?? 10;

  // yearOfStabilization: first year projections reach targetOccupancy.
  // When projections are absent, use holdPeriod-derived heuristic.
  const yearOfStabilization = findStabilizationYear(
    projections,
    targetOccupancy,
    holdPeriod,
  );

  // Stabilized target rent = market rent grown to stabilization year
  const marketRent = ctx.market.avgRent.value ?? 0;
  const rentGrowth = a.rentGrowth.value ?? 0;
  const targetRentPerUnit = marketRent * Math.pow(1 + rentGrowth, yearOfStabilization);

  // Target NOI: canonical source is financial.outputs.noi (the stabilized proforma build).
  // When the model hasn't been built yet, estimate from unit mix + assumptions.
  let targetNoi: number;
  if (ctx.financial.outputs?.noi != null && ctx.financial.outputs.noi > 0) {
    targetNoi = ctx.financial.outputs.noi;
  } else {
    const totalUnits = ctx.totalUnits ?? 0;
    const managementFee = a.managementFee.value ?? 0.04;
    const estimatedOpexRatio = managementFee + 0.28;
    const estimatedEgi = totalUnits * targetRentPerUnit * targetOccupancy * 12;
    targetNoi = estimatedEgi * (1 - estimatedOpexRatio);
  }

  const targetExpenseRatio = targetNoi > 0 && ctx.financial.outputs?.effectiveGrossIncome != null
    ? 1 - safePct(targetNoi, ctx.financial.outputs.effectiveGrossIncome)
    : (a.managementFee.value ?? 0.04) + 0.28;

  return {
    targetNoi,
    targetOccupancy,
    targetRentPerUnit,
    targetExpenseRatio,
    exitCapRate: a.exitCapRate.value ?? 0.055,
    holdPeriodYears: holdPeriod,
    yearOfStabilization,
  };
}

// ---------------------------------------------------------------------------
// Gap — pure function, exported for unit tests
// ---------------------------------------------------------------------------

export function computeJourneyGap(
  stateA: JourneyStateA,
  stateB: JourneyStateB,
): JourneyGap {
  const noiAbsolute = stateB.targetNoi - stateA.noi;
  const noiPercent = safePct(noiAbsolute, stateA.noi);

  const occupancyPoints = (stateB.targetOccupancy - stateA.occupancy) * 100;

  const rentAbsolute = stateB.targetRentPerUnit - stateA.inPlaceRentPerUnit;
  const rentPercent = safePct(rentAbsolute, stateA.inPlaceRentPerUnit);

  const expenseChange = (stateB.targetExpenseRatio - stateA.expenseRatio) * 100;

  return {
    noiUplift: { absolute: noiAbsolute, percent: noiPercent },
    occupancyUplift: { points: occupancyPoints },
    rentUplift: { perUnit: rentAbsolute, percent: rentPercent },
    expenseRatioChange: { points: expenseChange },
    capexRequired: stateA.capexBacklog.value,
    // liftAggressiveness: undefined — PENDING M36 Phase A
  };
}

// ---------------------------------------------------------------------------
// Path composer — year-by-year trajectory
// LOCKED: maps from F9 projections when available.
// Fallback: estimates from assumptions when projections are absent.
// ---------------------------------------------------------------------------

function composePath(
  ctx: DealContext,
  projections: ProjectionSlice[] | null | undefined,
  trafficProjection: TrafficProjectionSlice | null | undefined,
): JourneyPath {
  const holdPeriod = ctx.financial.assumptions.holdPeriod.value ?? 10;
  const vacancyPct = ctx.financial.assumptions.vacancy.value ?? 0.05;
  const rentGrowth = ctx.financial.assumptions.rentGrowth.value ?? 0;
  const expenseGrowth = ctx.financial.assumptions.expenseGrowth.value ?? 0;
  const totalUnits = ctx.totalUnits ?? 1;
  const marketRent = ctx.market.avgRent.value ?? 0;

  let yearly: JourneyPathYear[];

  if (projections && projections.length > 0) {
    // LOCKED path: compose from existing F9 per-year projection outputs.
    // Trim to holdPeriod years.
    const trafficByYear = new Map(
      (trafficProjection?.yearly ?? []).map(ty => [ty.year, ty]),
    );

    yearly = projections
      .filter(p => p.year <= Math.max(1, holdPeriod))
      .map(p => {
        const traffic = trafficByYear.get(p.year);
        // effRentPerUnit: use M07 effRent when available; compute from EGI fallback.
        const effRentPerUnit = traffic?.effRent != null
          ? traffic.effRent
          : (totalUnits > 0 && p.egi > 0 ? p.egi / (totalUnits * 12) : marketRent);
        const rentGrowthPct = traffic?.rentGrowthPct ?? rentGrowth;
        const vacPct = traffic?.vacancyPct ?? vacancyPct;

        return {
          year: p.year,
          noi: p.noi,
          occupancy: p.occupancy ?? (1 - vacPct),
          effRentPerUnit,
          rentGrowthPct,
          vacancyPct: vacPct,
          // confidenceBand: undefined — PENDING M07 percentile output
        };
      });
  } else {
    // Fallback: synthetic path from assumptions + NOI output.
    const noiY1 = ctx.financial.outputs?.noi ?? 0;
    yearly = [];
    for (let y = 1; y <= Math.max(1, holdPeriod); y++) {
      const effRentPerUnit = marketRent * Math.pow(1 + rentGrowth, y);
      const occupancy = 1 - vacancyPct;
      const noiAtYear = noiY1 > 0
        ? noiY1 * Math.pow(1 + rentGrowth - expenseGrowth * 0.5, y - 1)
        : 0;
      yearly.push({
        year: y,
        noi: noiAtYear,
        occupancy,
        effRentPerUnit,
        rentGrowthPct: rentGrowth,
        vacancyPct,
        // confidenceBand: undefined — PENDING M07 percentile output
      });
    }
  }

  // Lease-up timeline: from M07 trafficProjection.leaseUp when available.
  const leaseUp = trafficProjection?.leaseUp ?? null;

  return {
    yearByYear: yearly,
    leaseUpTimeline: {
      weeksTo90: leaseUp?.weeksTo90 ?? null,
      weeksTo93: leaseUp?.weeksTo93 ?? null,
      weeksTo95: leaseUp?.weeksTo95 ?? null,
    },
    // eventAdjustedTrajectory: undefined — PENDING M35 integration
    // pathConfidence: undefined — PENDING M38 build
  };
}

// ---------------------------------------------------------------------------
// Levers composer
// ---------------------------------------------------------------------------

type LeverField = keyof FinancialContext['assumptions'];

const LEVER_EVIDENCE_DEFAULTS: Array<[LeverField, LeverEvidenceModule]> = [
  ['rentGrowth', 'M05'],
  ['expenseGrowth', 'platform_default'],
  ['vacancy', 'M07'],
  ['exitCapRate', 'M05'],
  ['holdPeriod', 'platform_default'],
  ['capexPerUnit', 'platform_default'],
  ['managementFee', 'platform_default'],
];

function composeLevers(ctx: DealContext): JourneyLevers {
  const a = ctx.financial.assumptions;

  const perLeverEvidence: JourneyLevers['perLeverEvidence'] = {};
  for (const [field, fallback] of LEVER_EVIDENCE_DEFAULTS) {
    const lv = a[field];
    perLeverEvidence[field] = deriveEvidence(lv, fallback);
  }

  const stance = ctx.operatorStance;
  const stanceModulators: JourneyLevers['stanceModulators'] = stance
    ? {
        stressRentGrowthHaircut: stance.stressRentGrowthHaircut,
        stressExitCapWiden: stance.stressExitCapWiden,
        stressVacancyFloor: stance.stressVacancyFloor,
        concessionStrategy: stance.concessionStrategy,
        leasingCostTreatment: stance.leasingCostTreatment,
      }
    : null;

  return {
    rentGrowth: a.rentGrowth,
    expenseGrowth: a.expenseGrowth,
    vacancy: a.vacancy,
    exitCapRate: a.exitCapRate,
    holdPeriod: a.holdPeriod,
    capexPerUnit: a.capexPerUnit,
    managementFee: a.managementFee,
    perLeverEvidence,
    stanceModulators,
  };
}

// ---------------------------------------------------------------------------
// Strategy frame + score trajectory composers
// ---------------------------------------------------------------------------

function composeStrategyFrame(ctx: DealContext): JourneyStrategyFrame {
  return {
    detectedStrategy: ctx.strategy.selectedStrategy.value,
    arbitrageGap: ctx.strategy.arbitrageGap,
    verdict: ctx.strategy.verdict,
  };
}

function composeScoreTrajectory(ctx: DealContext): JourneyScoreTrajectory {
  return {
    scoreAtA: ctx.scores.overall,
    scoreAtB: null,      // TODO: M25 extension — no current code projects forward
    subScoreDeltas: null,
  };
}

// ---------------------------------------------------------------------------
// useDealJourney — main exported hook
// ---------------------------------------------------------------------------

/**
 * Compose a DealJourney from an existing DealContext.
 *
 * @param ctx  DealContext from useDealStore. null = not yet loaded or deal
 *             identity doesn't match resolvedDealId.
 * @param dqaFindingCount  Count of active (non-dismissed) DQA alerts on State A
 *   inputs, fetched from /api/v1/deals/:id/data-quality-alerts by the caller.
 *   Pass 0 when not yet loaded.
 * @param projections  Optional per-year projection array from
 *   F9DealFinancials.projections (mergedFinancials or f9Financials). When
 *   provided, path.yearByYear is composed from real model outputs (LOCKED).
 *   When absent, falls back to synthetic assumption extrapolation.
 * @param trafficProjection  Optional M07 traffic projection from
 *   F9DealFinancials.trafficProjection. When provided, leaseUpTimeline and
 *   effRentPerUnit in path.yearByYear are enriched with M07 data.
 *
 * @returns Memoized DealJourney — null when ctx is null.
 */
export function useDealJourney(
  ctx: DealContext | null,
  dqaFindingCount: number = 0,
  projections?: ProjectionSlice[] | null,
  trafficProjection?: TrafficProjectionSlice | null,
): DealJourney | null {
  return useMemo(() => {
    if (!ctx) return null;

    const stateA = composeStateA(ctx, dqaFindingCount);
    const stateB = composeStateB(ctx, projections);
    const gap = computeJourneyGap(stateA, stateB);
    const path = composePath(ctx, projections, trafficProjection);
    const levers = composeLevers(ctx);
    const strategyFrame = composeStrategyFrame(ctx);
    const scoreTrajectory = composeScoreTrajectory(ctx);

    const journey: DealJourney = {
      stateA,
      stateB,
      gap,
      path,
      levers,
      strategyFrame,
      scoreTrajectory,
      // aggressiveness: undefined — PENDING M36 Phase A
      // calibration: undefined — PENDING M38 build
    };

    return journey;
  }, [ctx, dqaFindingCount, projections, trafficProjection]);
}
