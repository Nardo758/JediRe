// ============================================================================
// JEDI RE — dealJourney.selector.ts
// ============================================================================
//
// `useDealJourney(ctx)` — React hook that composes a DealJourney from an
// existing DealContext. Pure derived selector: no network calls, no persistence.
//
// `computeJourneyGap(stateA, stateB)` — pure function for gap arithmetic.
//
// See docs/architecture/deal-journey-framework.md for the full spec.
// ============================================================================

import { useMemo } from 'react';
import type { DealContext, FinancialContext } from './dealContext.types';
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
// Helpers
// ---------------------------------------------------------------------------

/** Safe division — returns 0 when denominator is 0 */
function safePct(num: number, den: number): number {
  return den !== 0 ? num / den : 0;
}

/** Derive evidence source for a lever assumption based on its resolved LayeredValue source. */
function deriveEvidence(
  source: string | undefined,
  updatedAt: string | undefined | null,
  confidence: number | undefined,
  fallbackModule: LeverEvidenceModule,
): LeverEvidence {
  const moduleMap: Record<string, LeverEvidenceModule> = {
    'm05': 'M05', 'market': 'M05',
    'm07': 'M07', 'traffic': 'M07',
    'm04': 'M04', 'supply': 'M04',
    'm26': 'M26', 'tax': 'M26',
    'm37': 'M37', 'analog': 'M37',
    'platform': 'platform_default',
    'broker': 'platform_default',
    'user': 'platform_default',
  };
  const normalizedSource = (source ?? '').toLowerCase();
  const resolvedModule: LeverEvidenceModule =
    (Object.entries(moduleMap).find(([k]) => normalizedSource.includes(k))?.[1]) ??
    fallbackModule;

  return {
    sourceModule: resolvedModule,
    sourceConfidence: confidence ?? 0.5,
    lastCalibrated: updatedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// State A composer
// ---------------------------------------------------------------------------

function composeStateA(ctx: DealContext, dqaFindingCount: number): JourneyStateA {
  const existing = ctx.projectType === 'existing' || ctx.projectType === 'redevelopment'
    ? ctx.existingProperty
    : null;

  const noi = (ctx.financial.outputs?.noi ?? 0) as number;
  const occupancy = existing?.occupancy?.value ?? ctx.market.avgOccupancy.value ?? 0;
  const inPlaceRent = existing?.avgRentPerUnit?.value ?? ctx.market.avgRent.value ?? 0;
  const marketRent = ctx.market.avgRent.value ?? 0;
  const capexPerUnit = ctx.financial.assumptions.capexPerUnit.value;
  const totalUnits = ctx.totalUnits ?? 0;

  const capexLv = {
    ...ctx.financial.assumptions.capexPerUnit,
    value: capexPerUnit * totalUnits,
  };

  const noi_ = noi || (existing?.currentNOI?.value ?? 0);
  const egi = noi_ / Math.max(1 - 0.40, 0.01);
  const expenseRatio = noi_ > 0 ? 1 - safePct(noi_, egi) : 0.40;

  const sourceLayers: JourneyStateA['sourceLayers'] = {
    broker: (ctx.financial as any)._sourceLayers?.broker ?? 'absent',
    t12: (ctx.financial as any)._sourceLayers?.t12 ?? 'absent',
    rentRoll: (ctx.financial as any)._sourceLayers?.rentRoll ?? 'absent',
    taxBill: (ctx.financial as any)._sourceLayers?.taxBill ?? 'absent',
  };

  return {
    asOf: new Date().toISOString(),
    noi: noi_,
    occupancy,
    inPlaceRentPerUnit: inPlaceRent,
    marketRentPerUnit: marketRent,
    expenseRatio,
    propertyClass: existing?.propertyClass?.value ?? null,
    yearBuilt: existing?.yearBuilt?.value ?? null,
    capexBacklog: capexLv,
    sourceLayers,
    dataQualityFindings: dqaFindingCount,
  };
}

// ---------------------------------------------------------------------------
// State B composer
// ---------------------------------------------------------------------------

function composeStateB(ctx: DealContext): JourneyStateB {
  const a = ctx.financial.assumptions;
  const m07 = (ctx as any).traffic ?? null;
  const leaseUpWeeksTo95 = m07?.trafficProjection?.leaseUp?.weeksTo95 ?? null;
  const yearOfStabilization =
    leaseUpWeeksTo95 != null ? Math.ceil(leaseUpWeeksTo95 / 52) : 1;

  const marketRent = ctx.market.avgRent.value ?? 0;
  const rentGrowth = a.rentGrowth.value ?? 0;
  const holdPeriod = a.holdPeriod.value ?? 10;
  const targetRent = marketRent * Math.pow(1 + rentGrowth, yearOfStabilization);
  const targetOccupancy = a.vacancy.value != null ? 1 - a.vacancy.value : 0.95;

  const goiAtStab = ctx.totalUnits * targetRent * targetOccupancy * 12;
  const managementFee = a.managementFee.value ?? 0.04;
  const estimatedOpexRatio = managementFee + 0.28;
  const targetNoi = goiAtStab * (1 - estimatedOpexRatio);
  const targetExpenseRatio = estimatedOpexRatio;

  return {
    targetNoi,
    targetOccupancy,
    targetRentPerUnit: targetRent,
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

  const capexRequired = stateA.capexBacklog.value;

  return {
    noiUplift: { absolute: noiAbsolute, percent: noiPercent },
    occupancyUplift: { points: occupancyPoints },
    rentUplift: { perUnit: rentAbsolute, percent: rentPercent },
    expenseRatioChange: { points: expenseChange },
    capexRequired,
  };
}

// ---------------------------------------------------------------------------
// Path composer
// ---------------------------------------------------------------------------

function composePath(ctx: DealContext): JourneyPath {
  const m07 = (ctx as any).traffic ?? null;
  const holdPeriod = ctx.financial.assumptions.holdPeriod.value ?? 10;
  const projections = (ctx.financial.outputs as any)?.projections ?? [];

  const yearly: JourneyPathYear[] = [];
  for (let y = 1; y <= Math.max(1, holdPeriod); y++) {
    const proj = projections[y - 1] ?? {};
    const m07Year = m07?.trafficProjection?.yearly?.find((r: any) => r.year === y) ?? {};

    const noi = proj.noi ?? proj.netOperatingIncome ?? 0;
    const occupancy =
      m07Year.occupancyPct != null
        ? m07Year.occupancyPct
        : proj.occupancy ?? (1 - (ctx.financial.assumptions.vacancy.value ?? 0.05));
    const effRentPerUnit =
      m07Year.effRent ?? proj.effRentPerUnit ?? ctx.market.avgRent.value ?? 0;
    const rentGrowthPct =
      m07Year.rentGrowthPct ?? ctx.financial.assumptions.rentGrowth.value ?? 0;
    const vacancyPct =
      m07Year.vacancyPct != null
        ? m07Year.vacancyPct
        : ctx.financial.assumptions.vacancy.value ?? 0.05;

    yearly.push({ year: y, noi, occupancy, effRentPerUnit, rentGrowthPct, vacancyPct });
  }

  const leaseUp = m07?.trafficProjection?.leaseUp ?? {};
  return {
    yearByYear: yearly,
    leaseUpTimeline: {
      weeksTo90: leaseUp.weeksTo90 ?? null,
      weeksTo93: leaseUp.weeksTo93 ?? null,
      weeksTo95: leaseUp.weeksTo95 ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Levers composer
// ---------------------------------------------------------------------------

function composeLevers(ctx: DealContext): JourneyLevers {
  const a = ctx.financial.assumptions;

  type AsKey = keyof FinancialContext['assumptions'];
  const evidenceConfig: Array<[AsKey, LeverEvidenceModule]> = [
    ['rentGrowth', 'M05'],
    ['expenseGrowth', 'platform_default'],
    ['vacancy', 'M07'],
    ['exitCapRate', 'M05'],
    ['holdPeriod', 'platform_default'],
    ['capexPerUnit', 'platform_default'],
    ['managementFee', 'platform_default'],
  ];

  const perLeverEvidence: JourneyLevers['perLeverEvidence'] = {};
  for (const [field, fallback] of evidenceConfig) {
    const lv = a[field] as any;
    if (!lv) continue;
    perLeverEvidence[field] = deriveEvidence(
      lv.resolvedFrom ?? lv.source,
      lv.updatedAt,
      lv.confidence,
      fallback,
    );
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
// Strategy frame composer
// ---------------------------------------------------------------------------

function composeStrategyFrame(ctx: DealContext): JourneyStrategyFrame {
  return {
    detectedStrategy: ctx.strategy.selectedStrategy.value,
    arbitrageGap: ctx.strategy.arbitrageGap,
    verdict: ctx.strategy.verdict,
  };
}

// ---------------------------------------------------------------------------
// Score trajectory composer
// ---------------------------------------------------------------------------

function composeScoreTrajectory(ctx: DealContext): JourneyScoreTrajectory {
  return {
    scoreAtA: ctx.scores.overall,
    scoreAtB: null,
    subScoreDeltas: null,
  };
}

// ---------------------------------------------------------------------------
// useDealJourney — main exported hook
// ---------------------------------------------------------------------------

/**
 * Compose a DealJourney from an existing DealContext.
 *
 * @param ctx DealContext from useDealStore
 * @param dqaFindingCount Count of active DQA alerts on State A inputs (from
 *   the DQA alerts endpoint — caller is responsible for fetching this).
 *   Pass 0 when not yet loaded.
 *
 * @returns Memoized DealJourney — recomputed only when ctx or dqaFindingCount changes.
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

    return {
      stateA,
      stateB,
      gap,
      path,
      levers,
      strategyFrame,
      scoreTrajectory,
    };
  }, [ctx, dqaFindingCount]);
}
