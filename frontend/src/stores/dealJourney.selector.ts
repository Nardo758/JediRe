// ============================================================================
// JEDI RE — dealJourney.selector.ts
// ============================================================================
//
// `useDealJourney(ctx, dqaCount)` — React hook that composes a DealJourney
// from an existing DealContext. Pure derived selector: no network calls, no
// persistence.
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
//   path.yearByYear      = estimated from assumptions per year (M07 PENDING)
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
// Internal helpers
// ---------------------------------------------------------------------------

/** Safe division — returns 0 when denominator is 0 */
function safePct(num: number, den: number): number {
  return den !== 0 ? num / den : 0;
}

/**
 * Derive which M-module contributed the platform layer for a lever, based on
 * the LayeredValue's source tag. Falls back to the provided default module.
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
  const totalRent = existing.unitMixProgram.reduce((s, r) => s + r.targetRent.value * r.count, 0);
  return totalRent / totalUnits;
}

/** Detect whether a given source layer is present by scanning LayeredValue sources. */
function detectSourceLayer(
  lv: LayeredValue<number>,
  tag: string,
): boolean {
  if ((lv.source ?? '').toLowerCase().includes(tag)) return true;
  if ((lv.resolvedFrom ?? '').toLowerCase().includes(tag)) return true;
  const layers = lv.layers;
  if (!layers) return false;
  // broker layer present implies broker source exists
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

// ---------------------------------------------------------------------------
// State A composer — current financial reality, source-document-grounded
// ---------------------------------------------------------------------------

function composeStateA(ctx: DealContext, dqaFindingCount: number): JourneyStateA {
  const existing = (isExistingDeal(ctx) || isRedevelopmentDeal(ctx))
    ? ctx.existingProperty
    : null;

  // In-place NOI: from existing property docs or redevelopment delta — NOT the proforma build.
  // Ground-up development deals start at NOI=0 (greenfield).
  let noi = 0;
  if (isRedevelopmentDeal(ctx) && ctx.redevelopment?.existingNOI?.value != null) {
    noi = ctx.redevelopment.existingNOI.value;
  } else if (existing?.currentNOI?.value != null) {
    noi = existing.currentNOI.value;
  }

  const occupancy = existing?.occupancy?.value ?? ctx.market.avgOccupancy.value ?? 0;
  const marketRent = ctx.market.avgRent.value ?? 0;
  const inPlaceRentPerUnit = weightedAvgRent(existing, marketRent);

  // Expense ratio estimate from NOI/EGI — fallback to 40% when NOI is zero
  const totalUnits = ctx.totalUnits ?? 0;
  const estimatedGoi = totalUnits > 0
    ? inPlaceRentPerUnit * totalUnits * occupancy * 12
    : 0;
  const expenseRatio = noi > 0 && estimatedGoi > 0
    ? 1 - safePct(noi, estimatedGoi)
    : 0.40;

  // CapEx backlog = capexPerUnit × totalUnits
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

function composeStateB(ctx: DealContext): JourneyStateB {
  const a = ctx.financial.assumptions;

  // Year of stabilization: estimated from hold period (no M07 in DealContext for Phase 1)
  // When M07 is wired, this should read from ctx.traffic.trafficProjection.leaseUp.weeksTo95
  const yearOfStabilization = 2; // conservative default; M07 fills this in Phase 3

  // Stabilized target rent = market rent grown to stabilization year
  const marketRent = ctx.market.avgRent.value ?? 0;
  const rentGrowth = a.rentGrowth.value ?? 0;
  const targetRentPerUnit = marketRent * Math.pow(1 + rentGrowth, yearOfStabilization);

  const targetOccupancy = a.vacancy.value != null ? 1 - a.vacancy.value : 0.95;

  // Target NOI: canonical source is financial.outputs.noi (the stabilized proforma build result).
  // When the model hasn't been built yet, estimate from unit mix + assumptions.
  let targetNoi: number;
  if (ctx.financial.outputs?.noi != null && ctx.financial.outputs.noi > 0) {
    // The build model output IS the stabilized NOI — use it directly.
    targetNoi = ctx.financial.outputs.noi;
  } else {
    // Fallback: estimate from unit mix and assumptions (pre-build state)
    const totalUnits = ctx.totalUnits ?? 0;
    const managementFee = a.managementFee.value ?? 0.04;
    const estimatedOpexRatio = managementFee + 0.28; // mgmt + typical fixed opex
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
    holdPeriodYears: a.holdPeriod.value ?? 10,
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
// Path composer — year-by-year trajectory (Phase 1: assumptions-based estimates)
// ---------------------------------------------------------------------------

function composePath(ctx: DealContext): JourneyPath {
  const holdPeriod = ctx.financial.assumptions.holdPeriod.value ?? 10;
  const vacancyPct = ctx.financial.assumptions.vacancy.value ?? 0.05;
  const rentGrowth = ctx.financial.assumptions.rentGrowth.value ?? 0;
  const expenseGrowth = ctx.financial.assumptions.expenseGrowth.value ?? 0;
  const marketRent = ctx.market.avgRent.value ?? 0;

  // Year 1 NOI from the proforma build output; 0 if not yet built.
  const noiY1 = ctx.financial.outputs?.noi ?? 0;

  const yearly: JourneyPathYear[] = [];
  for (let y = 1; y <= Math.max(1, holdPeriod); y++) {
    const effRentPerUnit = marketRent * Math.pow(1 + rentGrowth, y);
    const occupancy = 1 - vacancyPct;
    // Project NOI forward from Y1 using a rent-growth / expense-growth blend
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

  return {
    yearByYear: yearly,
    leaseUpTimeline: {
      // PENDING: M07 backend wiring; null until that ships
      weeksTo90: null,
      weeksTo93: null,
      weeksTo95: null,
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
 * @param ctx  DealContext from useDealStore (null = not yet loaded or deal
 *             identity doesn't match resolvedDealId)
 * @param dqaFindingCount  Count of active (non-dismissed) DQA alerts on State A
 *   inputs, fetched from /api/v1/deals/:id/dqa/alerts by the caller. Pass 0
 *   when not yet loaded.
 *
 * @returns Memoized DealJourney — recomputed only when ctx or dqaFindingCount
 *   changes. Returns null when ctx is null.
 */
export function useDealJourney(
  ctx: DealContext | null,
  dqaFindingCount: number = 0,
): DealJourney | null {
  return useMemo(() => {
    if (!ctx) return null;

    const stateA = composeStateA(ctx, dqaFindingCount);
    const stateB = composeStateB(ctx);
    const gap = computeJourneyGap(stateA, stateB);
    const path = composePath(ctx);
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
  }, [ctx, dqaFindingCount]);
}
