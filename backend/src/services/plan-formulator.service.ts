/**
 * Plan Formulator Service — M08 v2 Stage 3
 *
 * Synthesizes a structured acquisition plan from:
 *  - Detected primary sub-strategy + scores
 *  - Active correlation signals
 *  - Golden Chain position
 *  - Capital constraints and hold preferences
 *
 * Outputs a machine-readable plan with 7 dimensions:
 *  1. Entry Timing
 *  2. Hold Structure
 *  3. Value-Creation Sequence
 *  4. Capital Sequencing
 *  5. Exit Targeting
 *  6. Risk Mitigations
 *  7. Adjacent-Strategy Pivot Conditions
 */

import { DetectionResult } from './asset-class-detection.service';
import { EvidenceReport } from './evidence-report.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanAction {
  action: string;
  capital?: number;
  correlationRefs: string[];
  kpi?: string;
}

export interface ValueCreationPhase {
  phase: number;
  monthRange: [number, number];
  actions: PlanAction[];
}

export interface PlanEntry {
  targetQuarter: string;
  priceCeiling: number;
  rationale: string;
  debtStructure: string;
}

export interface PlanExit {
  targetQuarter: string;
  buyerType: string;
  activeBuyers: string[];
  capRate: number;
  expectedIRR: [number, number];
}

export interface MonitoringTrigger {
  correlationId: string;
  currentValue: string;
  triggerValue: string;
  actionOnTrigger: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface PivotCondition {
  condition: string;
  probability: number;
  pivotToSubStrategy: string;
  irrDelta: string;
}

export interface StrategyPlan {
  entry: PlanEntry;
  valueCreation: ValueCreationPhase[];
  exit: PlanExit;
  monitoring: MonitoringTrigger[];
  pivotConditions: PivotCondition[];
}

export interface PlanContext {
  detection: DetectionResult;
  primaryScore: number;
  adjacentScores: Array<{ key: string; score: number }>;
  acquisitionPrice: number;
  unitCount: number;
  avgRent: number;
  capitalGapPerUnit: number;
  targetIrr: number;
  holdPeriodYears: number;
  correlationAlerts?: string[];
}

// ─── Quarter helper ───────────────────────────────────────────────────────────

function nextQuarter(offsetMonths: number): string {
  const now = new Date();
  now.setMonth(now.getMonth() + offsetMonths);
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q} ${now.getFullYear()}`;
}

// ─── Sub-strategy plan builders ───────────────────────────────────────────────

function buildMFValueAddPlan(ctx: PlanContext, deep: boolean): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : (ctx.unitCount || 50) * 160_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 50;
  const capGap = ctx.capitalGapPerUnit > 0 ? ctx.capitalGapPerUnit : 25_000;
  const renovUnits = Math.round(units * (deep ? 0.80 : 0.50));
  const phase2Capital = units * 2_000;
  const phase3Capital = renovUnits * capGap;
  const holdMonths = ctx.holdPeriodYears > 0 ? ctx.holdPeriodYears * 12 : (deep ? 48 : 36);

  const exitCapRate = deep ? 0.0525 : 0.054;
  const exitMonth = holdMonths;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * 1.05).toFixed(0)),
      rationale: 'COR-20 digital-physical gap supports near-term entry; market pricing reflects unrenovated basis',
      debtStructure: deep
        ? 'Bridge loan 65% LTC, 24mo IO, then perm refi post-stabilization'
        : 'Bridge-to-perm 65% LTC, 18mo IO',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 3],
        actions: [
          { action: 'Management transition — new PM engagement', correlationRefs: ['COR-19'], kpi: '+3-6% NOI margin within 90 days' },
          { action: 'Pricing audit — capture 30% of loss-to-lease via new lease pricing', correlationRefs: ['COR-01'], kpi: 'Avg rent up within 60 days' },
          { action: 'Deferred maintenance triage — identify high-priority items', correlationRefs: [], kpi: 'Maintenance backlog cleared' },
        ],
      },
      {
        phase: 2,
        monthRange: [4, 9],
        actions: [
          { action: 'Exterior paint + signage rebrand (PCS asset-quality lift)', capital: phase2Capital * 0.60, correlationRefs: [], kpi: 'PCS exterior component score +5 pts' },
          { action: 'Amenity upgrade per trade-area gap analysis', capital: phase2Capital * 0.40, correlationRefs: ['COR-18'], kpi: 'Google review rating +0.3 within 6mo' },
          { action: 'Launch digital marketing refresh — update listings, photos, virtual tour', correlationRefs: ['COR-20'], kpi: 'Lead volume +20%' },
        ],
      },
      {
        phase: 3,
        monthRange: [10, deep ? 30 : 24],
        actions: [
          { action: `Unit renovation wave — ${renovUnits} units at turn at $${Math.round(capGap / 1000)}K/unit scope`, capital: phase3Capital, correlationRefs: ['COR-01'], kpi: `$${Math.round((ctx.avgRent || 1420) * 0.10)}/unit premium at turn` },
          { action: 'Track stabilization metrics: occupancy, effective rent, NOI margin monthly', correlationRefs: [], kpi: 'Physical occ ≥ 93%, loss-to-lease < 3%' },
        ],
      },
      {
        phase: 4,
        monthRange: [deep ? 31 : 25, exitMonth],
        actions: [
          { action: 'Hold 12 months stabilized for institutional exit eligibility', correlationRefs: [] },
          { action: 'Begin broker interviews Q-2 before exit', correlationRefs: ['COR-04'], kpi: 'LOIs from 3+ qualified buyers' },
          { action: 'Commission third-party appraisal and Phase I ESA', correlationRefs: [], kpi: 'Clean Phase I, appraisal at or above underwritten exit value' },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(exitMonth),
      buyerType: 'institutional',
      activeBuyers: ['Cortland', 'Blackstone Real Estate', 'Morgan Properties', 'Aimco', 'FPA Multifamily'],
      capRate: exitCapRate,
      expectedIRR: [
        parseFloat(((ctx.targetIrr || 0.18) * 0.90 * 100).toFixed(1)),
        parseFloat(((ctx.targetIrr || 0.18) * 1.15 * 100).toFixed(1)),
      ],
    },
    monitoring: [
      {
        correlationId: 'COR-08',
        currentValue: '+42% permit velocity (below trigger)',
        triggerValue: '+60% sustained 6 months',
        actionOnTrigger: 'Compress hold to 18 months; begin broker interviews immediately',
        severity: 'critical',
      },
      {
        correlationId: 'COR-04',
        currentValue: '+18% wage-rent gap (below trigger)',
        triggerValue: '+30% wage-rent gap',
        actionOnTrigger: 'Begin broker interviews; target exit before affordability correction',
        severity: 'warning',
      },
      {
        correlationId: 'COR-01',
        currentValue: 'Traffic surge active (+0.28, 10 weeks)',
        triggerValue: 'Surge ends or reverses',
        actionOnTrigger: 'Reassess rent growth assumptions for Phase 3 underwriting',
        severity: 'info',
      },
    ],
    pivotConditions: [
      {
        condition: 'Zoning upzone passes (pending in many municipalities) enabling 3x+ density',
        probability: 0.30,
        pivotToSubStrategy: 'mf_bts_ground_up',
        irrDelta: '+7-8% IRR lift (from value-add ~19% to BTS ~26%); increases capital and construction risk',
      },
      {
        condition: 'COR-08 fires above +60% for 6+ months — supply wave incoming',
        probability: 0.25,
        pivotToSubStrategy: 'mf_core_plus',
        irrDelta: '-3-4% IRR vs. value-add plan; trade return for capital safety before supply hits',
      },
    ],
  };
}

function buildMFDistressedPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : (ctx.unitCount || 50) * 120_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 50;

  return {
    entry: {
      targetQuarter: nextQuarter(2),
      priceCeiling: parseFloat((price * 0.90).toFixed(0)),
      rationale: 'Distress discount must reflect turnaround execution risk; 10-15% discount to stabilized value required',
      debtStructure: 'Bridge loan only — no agency financing available until stabilization; 65-70% LTC, 24mo IO',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 6],
        actions: [
          { action: 'Emergency management transition — replace PM, reset leasing protocols', correlationRefs: ['COR-19'], kpi: 'Occupancy +5pp within 90 days' },
          { action: 'Deferred maintenance triage — make properties habitable, address life-safety items first', correlationRefs: [], kpi: 'Life-safety deficiencies resolved within 60 days' },
          { action: 'Lender/lien negotiation (if financial distress) — forbearance or discounted payoff', correlationRefs: [] },
        ],
      },
      {
        phase: 2,
        monthRange: [7, 18],
        actions: [
          { action: 'Lease-up campaign — aggressive concessions to reach 90% occupancy', capital: units * 1_500, correlationRefs: ['COR-01'], kpi: 'Physical occ ≥ 90%' },
          { action: 'Exterior triage — cosmetic improvements to halt perception decline', capital: units * 2_500, correlationRefs: [] },
        ],
      },
      {
        phase: 3,
        monthRange: [19, 36],
        actions: [
          { action: 'Transition from distressed to value-add value-creation program', correlationRefs: [], kpi: 'NOI margin ≥ 55%' },
          { action: 'Refinance bridge debt to agency/perm once DSCR > 1.20x', correlationRefs: [] },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(42),
      buyerType: 'value_add_operator',
      activeBuyers: ['Regional value-add operators', 'Family office syndicators', 'Opportunistic funds'],
      capRate: 0.058,
      expectedIRR: [20, 27],
    },
    monitoring: [
      {
        correlationId: 'COR-04',
        currentValue: 'Wage-rent gap monitoring',
        triggerValue: '+30% wage-rent gap',
        actionOnTrigger: 'Accelerate lease-up with concession incentives before affordability drops demand',
        severity: 'warning',
      },
    ],
    pivotConditions: [
      {
        condition: 'Turnaround fails — occupancy stays below 80% at month 12',
        probability: 0.20,
        pivotToSubStrategy: 'mf_bts_ground_up',
        irrDelta: 'Teardown and redevelop if land value exceeds income value — possible IRR improvement',
      },
    ],
  };
}

function buildMFGroundUpPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 5_000_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 100;

  return {
    entry: {
      targetQuarter: nextQuarter(4),
      priceCeiling: price,
      rationale: 'Entitlement confirmation and construction financing commitment required before hard close',
      debtStructure: 'Construction loan 65% LTC, interest-only during construction; mini-perm or agency takeout at stabilization',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 12],
        actions: [
          { action: 'Entitlement and permitting — secure all approvals', correlationRefs: [], kpi: 'Building permit issued' },
          { action: 'Finalize construction documents + GMP contract', correlationRefs: [] },
          { action: 'Construction loan close and first draw', correlationRefs: [] },
        ],
      },
      {
        phase: 2,
        monthRange: [13, 30],
        actions: [
          { action: 'Construction — vertical delivery', capital: units * 180_000, correlationRefs: ['COR-01'], kpi: 'CO issued on schedule' },
          { action: 'Pre-leasing campaign — begin 6 months before delivery', correlationRefs: [], kpi: '50% pre-leased at delivery' },
        ],
      },
      {
        phase: 3,
        monthRange: [31, 42],
        actions: [
          { action: 'Lease-up to stabilization (93% occ)', correlationRefs: ['COR-01'], kpi: 'Stabilization within 12 months of delivery' },
          { action: 'Refinance or sell at stabilization — target institutional buyer', correlationRefs: [], kpi: 'Agency takeout or sale close' },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(42),
      buyerType: 'institutional',
      activeBuyers: ['Greystar', 'Aimco', 'Nuveen', 'JPMorgan Real Estate'],
      capRate: 0.048,
      expectedIRR: [20, 28],
    },
    monitoring: [
      {
        correlationId: 'COR-08',
        currentValue: 'Permit velocity',
        triggerValue: '+60% competitor permits for 12 months',
        actionOnTrigger: 'Re-evaluate absorption pace; may need to adjust rents at lease-up',
        severity: 'warning',
      },
    ],
    pivotConditions: [
      {
        condition: 'Construction cost inflation exceeds 15% above original GMP',
        probability: 0.20,
        pivotToSubStrategy: 'mf_value_add_standard',
        irrDelta: 'Revert to renovation on existing building if economics favor',
      },
    ],
  };
}

function buildSFRFixFlipPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 250_000;
  const reno = ctx.capitalGapPerUnit > 0 ? ctx.capitalGapPerUnit : 35_000;

  return {
    entry: {
      targetQuarter: nextQuarter(1),
      priceCeiling: parseFloat((price * 0.70).toFixed(0)),
      rationale: 'ARV − (Rehab + Holding + Selling + Acq) must exceed 18% margin; hard-money at 65% ARV',
      debtStructure: 'Hard money bridge 65% ARV, 6-9mo term',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 2],
        actions: [
          { action: 'Cosmetic renovation: kitchen, baths, flooring, paint', capital: reno * 0.70, correlationRefs: [], kpi: 'Scope complete on budget' },
          { action: 'Landscaping, exterior, curb appeal', capital: reno * 0.15, correlationRefs: [] },
          { action: 'Mechanical triage: HVAC, plumbing, electrical if needed', capital: reno * 0.15, correlationRefs: [] },
        ],
      },
      {
        phase: 2,
        monthRange: [3, 7],
        actions: [
          { action: 'List with MLS agent — professional photos, staging', correlationRefs: [] },
          { action: 'Price at or 2% below renovated comp ceiling for fast DOM', correlationRefs: ['COR-01'], kpi: 'Under contract within 30 days' },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(7),
      buyerType: 'owner_occupant',
      activeBuyers: ['Local owner-occupants', 'FHA buyers', 'Move-up buyers'],
      capRate: 0,
      expectedIRR: [25, 40],
    },
    monitoring: [
      {
        correlationId: 'SFR-DOM',
        currentValue: 'DOM tracking',
        triggerValue: 'DOM exceeds 45 days in submarket',
        actionOnTrigger: 'Price reduction of 2-3%; evaluate rental alternative',
        severity: 'warning',
      },
    ],
    pivotConditions: [
      {
        condition: 'Resale market softens — DOM > 60 days, offers below asking',
        probability: 0.20,
        pivotToSubStrategy: 'sfr_brrrr',
        irrDelta: 'Convert to rental hold; defer flip exit until market recovers',
      },
    ],
  };
}

function buildSFRBRRRRPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 200_000;
  const reno = ctx.capitalGapPerUnit > 0 ? ctx.capitalGapPerUnit : 40_000;
  const arv = (price + reno) * 1.30;

  return {
    entry: {
      targetQuarter: nextQuarter(1),
      priceCeiling: parseFloat((price * 0.80).toFixed(0)),
      rationale: 'ARV × 75% must exceed (Acq + Rehab) to clear BRRRR basis; rental comp must support DSCR > 1.25x post-refi',
      debtStructure: 'Hard money acquisition + reno; cash-out refi at 75% ARV post-stabilization',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 4],
        actions: [
          { action: 'Full renovation to ARV standard', capital: reno, correlationRefs: [] },
          { action: 'List for rent — target stabilization within 45 days of completion', correlationRefs: [] },
        ],
      },
      {
        phase: 2,
        monthRange: [5, 8],
        actions: [
          { action: `Cash-out refinance at 75% ARV ($${Math.round(arv * 0.75 / 1000)}K) — recover equity`, correlationRefs: [], kpi: `Refi clears basis of $${Math.round((price + reno) / 1000)}K` },
          { action: 'Evaluate next BRRRR acquisition with recycled capital', correlationRefs: [] },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(60),
      buyerType: 'sfr_aggregator_or_hold',
      activeBuyers: ['Invitation Homes', 'Progress Residential', 'Local investors'],
      capRate: 0.058,
      expectedIRR: [15, 22],
    },
    monitoring: [
      {
        correlationId: 'RATE-ENV',
        currentValue: 'Rate environment monitoring',
        triggerValue: 'Cash-out refi rates above 8%',
        actionOnTrigger: 'Delay refi; evaluate seller-finance or bridge alternatives',
        severity: 'warning',
      },
    ],
    pivotConditions: [
      {
        condition: 'ARV does not support 75% LTV cash-out refi',
        probability: 0.25,
        pivotToSubStrategy: 'sfr_hold',
        irrDelta: 'Hold as rental — lower cash-on-cash but still positive; recycle capital slower',
      },
    ],
  };
}

function buildGenericPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 1_000_000;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: price,
      rationale: 'Entry price aligned with underwritten return assumptions',
      debtStructure: 'Conventional commercial financing 65-70% LTV',
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 12],
        actions: [
          { action: 'Operational stabilization and value-creation execution', correlationRefs: [], kpi: 'NOI at or above underwritten year 1' },
        ],
      },
    ],
    exit: {
      targetQuarter: nextQuarter(60),
      buyerType: 'institutional',
      activeBuyers: [],
      capRate: 0.055,
      expectedIRR: [
        parseFloat(((ctx.targetIrr || 0.15) * 0.85 * 100).toFixed(1)),
        parseFloat(((ctx.targetIrr || 0.15) * 1.15 * 100).toFixed(1)),
      ],
    },
    monitoring: [],
    pivotConditions: [],
  };
}

// ─── Main formulator ──────────────────────────────────────────────────────────

export function formulatePlan(ctx: PlanContext, _evidence: EvidenceReport): StrategyPlan {
  const subStrategy = ctx.detection.detectedSubStrategy;

  switch (subStrategy) {
    case 'mf_value_add_standard':
      return buildMFValueAddPlan(ctx, false);
    case 'mf_deep_value_add':
      return buildMFValueAddPlan(ctx, true);
    case 'mf_distressed':
      return buildMFDistressedPlan(ctx);
    case 'mf_bts_ground_up':
      return buildMFGroundUpPlan(ctx);
    case 'sfr_fix_flip':
      return buildSFRFixFlipPlan(ctx);
    case 'sfr_brrrr':
      return buildSFRBRRRRPlan(ctx);
    default:
      return buildGenericPlan(ctx);
  }
}
