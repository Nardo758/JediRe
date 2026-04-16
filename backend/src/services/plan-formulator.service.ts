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
  evidenceRef?: string;   // Section 6.2: ref to evidence block driving this action
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

export interface HoldStructure {
  targetHoldMonths: number;
  rationale: string;                         // why this hold length for this sub-strategy
  refiEventMonth?: number;                   // optional interim refi (e.g., bridge-to-perm)
  refiTrigger?: string;                      // condition for refi (e.g., "DSCR ≥ 1.20x")
  exitWindows: Array<{ month: number; condition: string }>;  // opportunistic earlier exits
}

export interface CapitalSequencingStep {
  phase: number;
  monthRange: [number, number];
  capitalEvent: string;                      // what capital action occurs
  amount: number;                            // $ amount (0 if equity / non-cash)
  source: 'equity' | 'debt' | 'refinance' | 'reserves' | 'operating_cash';
  correlationRef?: string;                   // correlation driving the sequencing decision
}

// StrategyPlan — seven required dimensions per M08 v2 spec Section 6.2
export interface StrategyPlan {
  entry: PlanEntry;                          // 1. Entry Timing
  holdStructure: HoldStructure;              // 2. Hold Structure
  valueCreation: ValueCreationPhase[];       // 3. Value-Creation Sequence
  capitalSequencing: CapitalSequencingStep[];// 4. Capital Sequencing
  exit: PlanExit;                            // 5. Exit Targeting
  monitoring: MonitoringTrigger[];           // 6. Risk Mitigations (monitoring triggers)
  pivotConditions: PivotCondition[];         // 7. Pivot Conditions
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
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: deep
        ? 'Deep value-add requires 48mo to fully execute renovation wave and demonstrate stabilized NOI before institutional exit'
        : 'Standard value-add 36mo allows full renovation cycle + 12mo seasoned NOI for institutional buyer underwriting',
      refiEventMonth: deep ? 30 : 18,
      refiTrigger: 'DSCR ≥ 1.25x and occupancy ≥ 90% — bridge-to-perm refinance at post-renovation basis',
      exitWindows: [
        { month: holdMonths - 6, condition: 'Begin broker interviews if COR-08 (permits) fires above +60%' },
        { month: holdMonths,     condition: 'Stabilized NOI seasoned 12mo — target institutional sale' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 3],
        actions: [
          { action: 'Management transition — new PM engagement', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: '+3-6% NOI margin within 90 days' },
          { action: 'Pricing audit — capture 30% of loss-to-lease via new lease pricing', correlationRefs: ['COR-01'], evidenceRef: 'blockB.loss_to_lease', kpi: 'Avg rent up within 60 days' },
          { action: 'Deferred maintenance triage — identify high-priority items', correlationRefs: ['COR-14'], evidenceRef: 'blockB.capital_gap', kpi: 'Maintenance backlog cleared' },
        ],
      },
      {
        phase: 2,
        monthRange: [4, 9],
        actions: [
          { action: 'Exterior paint + signage rebrand (PCS asset-quality lift)', capital: phase2Capital * 0.60, correlationRefs: ['COR-18'], evidenceRef: 'blockC.tradeArea.condition_gap', kpi: 'PCS exterior component score +5 pts' },
          { action: 'Amenity upgrade per trade-area gap analysis', capital: phase2Capital * 0.40, correlationRefs: ['COR-18'], evidenceRef: 'blockC.tradeArea.amenity_score', kpi: 'Google review rating +0.3 within 6mo' },
          { action: 'Launch digital marketing refresh — update listings, photos, virtual tour', correlationRefs: ['COR-20'], evidenceRef: 'blockB.loss_to_lease', kpi: 'Lead volume +20%' },
        ],
      },
      {
        phase: 3,
        monthRange: [10, deep ? 30 : 24],
        actions: [
          { action: `Unit renovation wave — ${renovUnits} units at turn at $${Math.round(capGap / 1000)}K/unit scope`, capital: phase3Capital, correlationRefs: ['COR-01'], evidenceRef: 'blockD.step3.capex_deploy', kpi: `$${Math.round((ctx.avgRent || 1420) * 0.10)}/unit premium at turn` },
          { action: 'Track stabilization metrics: occupancy, effective rent, NOI margin monthly', correlationRefs: ['COR-08', 'COR-19'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'Physical occ ≥ 93%, loss-to-lease < 3%' },
        ],
      },
      {
        phase: 4,
        monthRange: [deep ? 31 : 25, exitMonth],
        actions: [
          { action: 'Hold 12 months stabilized for institutional exit eligibility', correlationRefs: ['COR-07'], evidenceRef: 'blockC.likeKind.hold_months' },
          { action: 'Begin broker interviews Q-2 before exit', correlationRefs: ['COR-04'], evidenceRef: 'blockD.step5.exit_value', kpi: 'LOIs from 3+ qualified buyers' },
          { action: 'Commission third-party appraisal and Phase I ESA', correlationRefs: ['COR-08'], evidenceRef: 'blockD.step5.exit_value', kpi: 'Clean Phase I, appraisal at or above underwritten exit value' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition',       amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Bridge loan draw — acquisition',    amount: Math.round(price * 0.65), source: 'debt',      correlationRef: 'COR-20' },
      { phase: 3, monthRange: [4, 9],  capitalEvent: 'Exterior + amenity capex draws',    amount: Math.round(phase2Capital),                     source: 'reserves' },
      { phase: 4, monthRange: [10, deep ? 30 : 24], capitalEvent: 'Unit renovation capex draws', amount: Math.round(phase3Capital), source: 'reserves', correlationRef: 'COR-01' },
      { phase: 5, monthRange: [deep ? 30 : 18, deep ? 30 : 18], capitalEvent: 'Bridge-to-perm refinance at post-renovation basis', amount: Math.round(price * 0.70), source: 'refinance' },
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
    holdStructure: {
      targetHoldMonths: 42,
      rationale: 'Distressed turnaround requires 36mo to stabilize; 6mo additional for agency refi seasoning before exit',
      refiEventMonth: 30,
      refiTrigger: 'DSCR ≥ 1.20x and occupancy ≥ 90% — bridge to agency or perm refi',
      exitWindows: [
        { month: 36, condition: 'Stabilized; evaluate sale vs. refi-and-hold based on cap rate environment' },
        { month: 42, condition: 'Target exit if COR-04 wage-rent gap compression signals affordability ceiling' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 6],
        actions: [
          { action: 'Emergency management transition — replace PM, reset leasing protocols', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'Occupancy +5pp within 90 days' },
          { action: 'Deferred maintenance triage — make properties habitable, address life-safety items first', correlationRefs: ['COR-14'], evidenceRef: 'blockB.capital_gap', kpi: 'Life-safety deficiencies resolved within 60 days' },
          { action: 'Lender/lien negotiation (if financial distress) — forbearance or discounted payoff', correlationRefs: ['COR-08'], evidenceRef: 'blockB.dscr' },
        ],
      },
      {
        phase: 2,
        monthRange: [7, 18],
        actions: [
          { action: 'Lease-up campaign — aggressive concessions to reach 90% occupancy', capital: units * 1_500, correlationRefs: ['COR-01'], evidenceRef: 'blockB.occupancy', kpi: 'Physical occ ≥ 90%' },
          { action: 'Exterior triage — cosmetic improvements to halt perception decline', capital: units * 2_500, correlationRefs: ['COR-18'], evidenceRef: 'blockC.tradeArea.condition_gap' },
        ],
      },
      {
        phase: 3,
        monthRange: [19, 36],
        actions: [
          { action: 'Transition from distressed to value-add value-creation program', correlationRefs: ['COR-01', 'COR-19'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'NOI margin ≥ 55%' },
          { action: 'Refinance bridge debt to agency/perm once DSCR > 1.20x', correlationRefs: ['COR-04', 'COR-08'], evidenceRef: 'blockD.step6.irr' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — distressed acquisition', amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Bridge loan draw',                       amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 6],  capitalEvent: 'Emergency capex reserves deploy',        amount: Math.round(units * 2_500),  source: 'reserves' },
      { phase: 4, monthRange: [7, 18], capitalEvent: 'Lease-up concessions + exterior capex',  amount: Math.round(units * 4_000),  source: 'operating_cash' },
      { phase: 5, monthRange: [30, 30], capitalEvent: 'Bridge-to-agency refi — DSCR ≥ 1.20x', amount: Math.round(price * 0.70), source: 'refinance' },
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
  const constructionCost = units * 180_000;

  return {
    entry: {
      targetQuarter: nextQuarter(4),
      priceCeiling: price,
      rationale: 'Entitlement confirmation and construction financing commitment required before hard close',
      debtStructure: 'Construction loan 65% LTC, interest-only during construction; mini-perm or agency takeout at stabilization',
    },
    holdStructure: {
      targetHoldMonths: 42,
      rationale: 'Ground-up: 12mo entitlement, 18mo construction, 12mo lease-up + seasoning before institutional sale',
      refiEventMonth: 36,
      refiTrigger: 'CO issued and 93% occupancy sustained for 90 days — agency takeout or mini-perm',
      exitWindows: [
        { month: 36, condition: 'Stabilized at 93% occ — eligible for agency refi or institutional sale' },
        { month: 42, condition: 'Target sale if COR-08 permit velocity signals competing supply within 18mo' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 12],
        actions: [
          { action: 'Entitlement and permitting — secure all approvals', correlationRefs: ['COR-08'], kpi: 'Building permit issued', evidenceRef: 'blockB.market_position' },
          { action: 'Finalize construction documents + GMP contract', correlationRefs: ['COR-14'], evidenceRef: 'blockD.step3.capex_deploy' },
          { action: 'Construction loan close and first draw', correlationRefs: ['COR-14', 'COR-08'], evidenceRef: 'blockD.step3.capex_deploy' },
        ],
      },
      {
        phase: 2,
        monthRange: [13, 30],
        actions: [
          { action: 'Construction — vertical delivery', capital: units * 180_000, correlationRefs: ['COR-01'], kpi: 'CO issued on schedule' },
          { action: 'Pre-leasing campaign — begin 6 months before delivery', correlationRefs: ['COR-01', 'COR-20'], kpi: '50% pre-leased at delivery', evidenceRef: 'blockC.tradeArea.rent_per_unit' },
        ],
      },
      {
        phase: 3,
        monthRange: [31, 42],
        actions: [
          { action: 'Lease-up to stabilization (93% occ)', correlationRefs: ['COR-01', 'COR-20'], kpi: 'Stabilization within 12 months of delivery', evidenceRef: 'blockD.step4.stabilized_noi' },
          { action: 'Refinance or sell at stabilization — target institutional buyer', correlationRefs: ['COR-04', 'COR-07'], kpi: 'Agency takeout or sale close', evidenceRef: 'blockD.step5.exit_value' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],   capitalEvent: 'Equity close — land acquisition',         amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 12],  capitalEvent: 'Entitlement costs + soft costs',           amount: Math.round(price * 0.05), source: 'reserves' },
      { phase: 3, monthRange: [13, 13], capitalEvent: 'Construction loan close + first draw',     amount: Math.round(constructionCost * 0.65), source: 'debt', correlationRef: 'COR-08' },
      { phase: 4, monthRange: [13, 30], capitalEvent: 'Construction draws (monthly)',             amount: Math.round(constructionCost * 0.35), source: 'equity' },
      { phase: 5, monthRange: [36, 36], capitalEvent: 'Agency takeout / mini-perm refi at stabilization', amount: Math.round((price + constructionCost) * 0.65), source: 'refinance' },
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
    holdStructure: {
      targetHoldMonths: 7,
      rationale: 'Fix-and-flip: 2mo renovation + 5mo selling window; hard money cost of capital penalizes extended holds',
      exitWindows: [
        { month: 5, condition: 'List for sale after renovation completion — target under contract within 30 days' },
        { month: 7, condition: 'If DOM > 45 days, evaluate price reduction or convert to sfr_brrrr' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 2],
        actions: [
          { action: 'Cosmetic renovation: kitchen, baths, flooring, paint', capital: reno * 0.70, correlationRefs: ['COR-01', 'COR-14'], evidenceRef: 'blockB.capital_gap', kpi: 'Scope complete on budget' },
          { action: 'Landscaping, exterior, curb appeal', capital: reno * 0.15, correlationRefs: ['COR-18'], evidenceRef: 'blockC.tradeArea.condition_gap' },
          { action: 'Mechanical triage: HVAC, plumbing, electrical if needed', capital: reno * 0.15, correlationRefs: ['COR-14', 'COR-08'], evidenceRef: 'blockB.capital_gap' },
        ],
      },
      {
        phase: 2,
        monthRange: [3, 7],
        actions: [
          { action: 'List with MLS agent — professional photos, staging', correlationRefs: ['COR-20'], evidenceRef: 'blockC.likeKind.dom_days' },
          { action: 'Price at or 2% below renovated comp ceiling for fast DOM', correlationRefs: ['COR-01'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: 'Under contract within 30 days' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Equity close — acquisition',        amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'Hard money draw — 65% ARV',         amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 2], capitalEvent: 'Renovation draws (cosmetic + mech)', amount: Math.round(reno),         source: 'reserves' },
      { phase: 4, monthRange: [7, 7], capitalEvent: 'Sale close — payoff HML + profit',  amount: 0,                         source: 'operating_cash' },
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
    holdStructure: {
      targetHoldMonths: 60,
      rationale: 'BRRRR: 8mo to reno + refi (full equity recovery), then long-term hold for cash flow; exit opportunistically at cap rate compression',
      refiEventMonth: 8,
      refiTrigger: 'ARV × 75% clears all-in basis — cash-out refi fully recycles equity; DSCR must exceed 1.25x at market rate',
      exitWindows: [
        { month: 36, condition: 'Evaluate sale if SFR cap rate compression < 5.5% in submarket' },
        { month: 60, condition: 'Target institutional SFR aggregator exit if portfolio size qualifies' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 4],
        actions: [
          { action: 'Full renovation to ARV standard', capital: reno, correlationRefs: ['COR-01', 'COR-14'], evidenceRef: 'blockB.capital_gap' },
          { action: 'List for rent — target stabilization within 45 days of completion', correlationRefs: ['COR-20'], evidenceRef: 'blockC.tradeArea.rent_per_unit' },
        ],
      },
      {
        phase: 2,
        monthRange: [5, 8],
        actions: [
          { action: `Cash-out refinance at 75% ARV ($${Math.round(arv * 0.75 / 1000)}K) — recover equity`, correlationRefs: ['COR-04', 'COR-14'], evidenceRef: 'blockD.step5.exit_value', kpi: `Refi clears basis of $${Math.round((price + reno) / 1000)}K` },
          { action: 'Evaluate next BRRRR acquisition with recycled capital', correlationRefs: ['COR-04', 'COR-07'], evidenceRef: 'blockC.likeKind.irr' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Equity close — acquisition',              amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'Hard money draw',                          amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 4], capitalEvent: 'Renovation capex draws',                   amount: Math.round(reno),          source: 'reserves' },
      { phase: 4, monthRange: [8, 8], capitalEvent: `Cash-out refi at 75% ARV ($${Math.round(arv * 0.75 / 1000)}K) — equity recycled`, amount: Math.round(arv * 0.75), source: 'refinance', correlationRef: 'RATE-ENV' },
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

// ─── MF Core / Core-Plus ─────────────────────────────────────────────────────

function buildMFCorePlan(ctx: PlanContext, corePlus: boolean): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : (ctx.unitCount || 80) * 220_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 80;
  const capGap = corePlus ? (ctx.capitalGapPerUnit > 0 ? ctx.capitalGapPerUnit : 8_000) : 0;
  const upgradeUnits = corePlus ? Math.round(units * 0.20) : 0;
  const holdMonths = corePlus ? 48 : 60;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * 1.03).toFixed(0)),
      rationale: corePlus
        ? 'Core-plus entry requires sub-5.0% going-in cap; select-unit upgrade program funds the spread to value-add returns'
        : 'Core entry priced at going-in cap ≤ 4.5%; return is hold-period appreciation and inflation-protected cash flow',
      debtStructure: corePlus ? 'Agency financing 70% LTV, 10yr fixed — convert to bridge at refi if upgrade program accelerates' : 'Agency/life company 65-70% LTV, 10yr fixed',
    },
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: corePlus
        ? 'Core-plus: 4yr hold allows select-unit upgrade cycle + 12mo seasoned NOI for institutional resale at tighter cap'
        : 'Core: 5yr hold maximizes depreciation benefit; exit into a compressed-cap-rate environment',
      exitWindows: [
        { month: holdMonths - 12, condition: 'Evaluate early exit if cap rate compression > 50bps below entry' },
        { month: holdMonths, condition: 'Target institutional sale at stabilized NOI with 12mo seasoning' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 6],
        actions: [
          { action: 'Management continuity review — maintain or optimize current PM if performing', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'NOI margin at or above underwritten Year 1' },
          { action: 'Loss-to-lease audit — capture 30% of any remaining LTL via new lease pricing', correlationRefs: ['COR-01'], evidenceRef: 'blockB.loss_to_lease', kpi: 'Effective rent at or above submarket median' },
        ],
      },
      ...(corePlus ? [{
        phase: 2,
        monthRange: [7, 36],
        actions: [
          { action: `Select-unit upgrade program — ${upgradeUnits} units at $${Math.round(capGap / 1000)}K/unit scope`, capital: upgradeUnits * capGap, correlationRefs: ['COR-01', 'COR-18'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: `$${Math.round((ctx.avgRent || 1600) * 0.08)}/unit premium at turn` },
          { action: 'Amenity micro-upgrade (fitness, package lockers, co-working) — minimal capex, high visibility', correlationRefs: ['COR-20'], evidenceRef: 'blockC.tradeArea.amenity_score', kpi: 'Google review rating +0.2' },
        ],
      }] : []),
      {
        phase: corePlus ? 3 : 2,
        monthRange: [corePlus ? 37 : 7, holdMonths],
        actions: [
          { action: 'Hold stabilized; track occupancy and NOI vs. underwritten benchmarks monthly', correlationRefs: ['COR-04', 'COR-07'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'Physical occ ≥ 94%, NOI margin ≥ 60%' },
          { action: 'Begin broker interviews Q-2 before exit target', correlationRefs: ['COR-04'], evidenceRef: 'blockD.step5.exit_value', kpi: 'LOIs from 3+ institutional buyers' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition', amount: Math.round(price * 0.30), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Agency loan draw — 70% LTV',  amount: Math.round(price * 0.70), source: 'debt' },
      ...(corePlus ? [{ phase: 3, monthRange: [7, 36], capitalEvent: 'Select-unit upgrade capex draws', amount: upgradeUnits * capGap, source: 'reserves' as const }] : []),
    ],
    exit: {
      targetQuarter: nextQuarter(holdMonths),
      buyerType: 'institutional',
      activeBuyers: ['Nuveen', 'JP Morgan Real Estate', 'PGIM', 'Principal Real Estate', 'AvalonBay'],
      capRate: corePlus ? 0.050 : 0.046,
      expectedIRR: [
        parseFloat(((ctx.targetIrr || (corePlus ? 0.14 : 0.11)) * 0.90 * 100).toFixed(1)),
        parseFloat(((ctx.targetIrr || (corePlus ? 0.14 : 0.11)) * 1.15 * 100).toFixed(1)),
      ],
    },
    monitoring: [
      { correlationId: 'COR-04', currentValue: 'Wage-rent gap tracking', triggerValue: '+30% gap compression', actionOnTrigger: 'Begin broker interviews if affordability ceiling approaching', severity: 'warning' },
      { correlationId: 'COR-08', currentValue: 'Permit velocity', triggerValue: '+60% sustained 6mo', actionOnTrigger: 'Evaluate early exit before supply delivery', severity: 'info' },
    ],
    pivotConditions: [
      { condition: 'Significant deferred maintenance discovered post-acquisition', probability: 0.15, pivotToSubStrategy: corePlus ? 'mf_value_add_standard' : 'mf_core_plus', irrDelta: 'Expand capital program; accept higher execution risk for return uplift' },
    ],
  };
}

// ─── MF Lease-Up ──────────────────────────────────────────────────────────────

function buildMFLeaseUpPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : (ctx.unitCount || 100) * 180_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 100;

  return {
    entry: {
      targetQuarter: nextQuarter(2),
      priceCeiling: parseFloat((price * 1.0).toFixed(0)),
      rationale: 'Lease-up entry requires below-stabilized-value pricing; typically 10-15% discount to stabilized cap rate to reflect absorption risk',
      debtStructure: 'Bridge loan 65% LTC, interest-only during lease-up; agency takeout at 93% occupancy',
    },
    holdStructure: {
      targetHoldMonths: 30,
      rationale: 'Lease-up: 12-18mo to stabilization + 6mo NOI seasoning before institutional exit; total 24-30mo execution window',
      refiEventMonth: 24,
      refiTrigger: '93% occupancy sustained 90 days — bridge-to-agency refi or sell',
      exitWindows: [
        { month: 18, condition: 'Evaluate sell if lease-up velocity ahead of plan and cap rates compressed' },
        { month: 30, condition: 'Target institutional sale or agency refi at stabilized NOI' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 6],
        actions: [
          { action: 'Aggressive leasing campaign — concessions, digital advertising, referral program', correlationRefs: ['COR-20', 'COR-01'], evidenceRef: 'blockB.occupancy', kpi: 'Occupancy +10pp per month until 80%' },
          { action: 'Pricing optimization — monitor competitive units weekly; adjust pricing matrix', correlationRefs: ['COR-01'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: 'Effective rent within 3% of submarket comp' },
        ],
      },
      {
        phase: 2,
        monthRange: [7, 18],
        actions: [
          { action: 'Stabilization push — target 93% occupancy; shift from concessions to market pricing', correlationRefs: ['COR-01', 'COR-04'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'Physical occ ≥ 93%' },
          { action: 'NOI margin discipline — control operating expenses as occupancy ramps', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'NOI margin ≥ 55% at stabilization' },
        ],
      },
      {
        phase: 3,
        monthRange: [19, 30],
        actions: [
          { action: 'Hold stabilized NOI 6 months — season for agency refi or institutional exit', correlationRefs: ['COR-07'], evidenceRef: 'blockC.likeKind.hold_months', kpi: '6mo seasoned NOI at underwritten level' },
          { action: 'Begin broker interviews / agency refi process', correlationRefs: ['COR-04', 'COR-08'], evidenceRef: 'blockD.step5.exit_value' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],   capitalEvent: 'Equity close — lease-up acquisition', amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1],   capitalEvent: 'Bridge loan draw — 65% LTC',          amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 6],   capitalEvent: 'Lease-up concession reserves',         amount: Math.round(units * 2_000), source: 'reserves' },
      { phase: 4, monthRange: [24, 24], capitalEvent: 'Agency takeout refi at stabilization', amount: Math.round(price * 0.68), source: 'refinance' },
    ],
    exit: {
      targetQuarter: nextQuarter(30),
      buyerType: 'institutional',
      activeBuyers: ['Greystar', 'Aimco', 'Essex Property Trust', 'UDR', 'NexPoint'],
      capRate: 0.048,
      expectedIRR: [18, 25],
    },
    monitoring: [
      { correlationId: 'COR-01', currentValue: 'Lease-up velocity tracking', triggerValue: 'Absorption pace below 8 units/mo', actionOnTrigger: 'Increase concessions; review pricing strategy', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: 'Lease-up stalls at <75% occupancy at month 12', probability: 0.20, pivotToSubStrategy: 'mf_distressed', irrDelta: 'Distress path if absorption fails; accept return compression for capital recovery' },
    ],
  };
}

// ─── MF STR (Short-Term Rental) ───────────────────────────────────────────────

function buildMFStrPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : (ctx.unitCount || 20) * 250_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 20;

  return {
    entry: {
      targetQuarter: nextQuarter(2),
      priceCeiling: parseFloat((price * 1.05).toFixed(0)),
      rationale: 'STR entry priced at long-term rental cap with premium for STR revenue upside; verify STR permitting before hard close',
      debtStructure: 'DSCR loan 65% LTV underwritten to long-term rental rents (not STR ADR) — lender may require STR income seasoning',
    },
    holdStructure: {
      targetHoldMonths: 48,
      rationale: 'STR: 4yr hold captures full seasonality cycle and platform revenue ramp; exit when long-term cap compression creates sale premium',
      exitWindows: [
        { month: 24, condition: 'Evaluate exit if STR regulations tighten or platform fees compress net yield below LTR parity' },
        { month: 48, condition: 'Target exit to STR operator/aggregator or convert to LTR for institutional sale' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 3],
        actions: [
          { action: 'STR setup — furnishing, photography, listing optimization on Airbnb/VRBO', correlationRefs: ['COR-20'], evidenceRef: 'blockB.loss_to_lease', kpi: '90%+ listing completion; first 10 reviews within 30 days' },
          { action: 'Dynamic pricing tool deployment (PriceLabs, Beyond Pricing)', correlationRefs: ['COR-01', 'COR-20'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: 'ADR within 5% of comp set' },
        ],
      },
      {
        phase: 2,
        monthRange: [4, 36],
        actions: [
          { action: 'Platform optimization — Superhost/Premier Host status, review velocity', correlationRefs: ['COR-19', 'COR-20'], kpi: '4.8+ rating; Superhost within 12 months' },
          { action: 'Revenue tracking — monthly RevPAR vs. LTR equivalent; flag underperformance', correlationRefs: ['COR-01'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'RevPAR ≥ 1.8× LTR equivalent rent' },
        ],
      },
      {
        phase: 3,
        monthRange: [37, 48],
        actions: [
          { action: 'Exit evaluation — STR operator acquisition or convert to long-term for institutional sale', correlationRefs: ['COR-07'], evidenceRef: 'blockD.step5.exit_value' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Equity close — acquisition',    amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'DSCR loan draw — 65% LTV',      amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 3], capitalEvent: 'STR setup: furnishing + tech',  amount: units * 8_000, source: 'reserves' },
    ],
    exit: { targetQuarter: nextQuarter(48), buyerType: 'str_operator_or_convert', activeBuyers: ['STR aggregators', 'Vacasa', 'Local owner-operators', 'Institutional long-term buyers'], capRate: 0.052, expectedIRR: [16, 24] },
    monitoring: [
      { correlationId: 'STR-REG', currentValue: 'STR permit status', triggerValue: 'Permit revocation or new restrictions', actionOnTrigger: 'Convert to long-term rental immediately; notify lender', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: 'STR regulations revoked or platform fees exceed 20% of revenue', probability: 0.25, pivotToSubStrategy: 'mf_value_add_standard', irrDelta: 'Convert to LTR value-add; lower peak return but stable income base' },
    ],
  };
}

// ─── SFR Hold ─────────────────────────────────────────────────────────────────

function buildSFRHoldPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 280_000;
  const rent = ctx.avgRent > 0 ? ctx.avgRent : 2_200;

  return {
    entry: {
      targetQuarter: nextQuarter(2),
      priceCeiling: parseFloat((price * 1.0).toFixed(0)),
      rationale: 'SFR hold entry requires GRM ≤ 18× and cash-on-cash ≥ 5% at market financing; buy at or below median submarket price for highest liquidity exit',
      debtStructure: 'Conventional 30yr fixed non-owner-occupied 75-80% LTV; DSCR loan if portfolio exceeds 10 properties',
    },
    holdStructure: {
      targetHoldMonths: 84,
      rationale: 'SFR hold: 7yr hold captures depreciation benefit, amortization equity build, and appreciation; exit to owner-occupant or SFR aggregator',
      exitWindows: [
        { month: 36, condition: 'Evaluate if submarket appreciation > 20% and 1031 exchange opportunity available' },
        { month: 84, condition: 'Sell to owner-occupant or institutional SFR buyer at fully depreciated basis' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 6],
        actions: [
          { action: 'Property management setup — PM engagement if remote; set market rent', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'Leased within 30 days of close at market rent' },
          { action: 'Cosmetic refresh if needed — paint, carpet, appliances to command top-of-range rent', correlationRefs: ['COR-18', 'COR-01'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: 'Rent at or above submarket median' },
        ],
      },
      {
        phase: 2,
        monthRange: [7, 84],
        actions: [
          { action: 'Annual rent increase at lease renewal — target 3-5% YoY or CPI', correlationRefs: ['COR-04'], kpi: 'Effective rent growth ≥ 3% YoY' },
          { action: 'Maintenance reserve discipline — 1% of value annually', correlationRefs: ['COR-14'], evidenceRef: 'blockB.capital_gap', kpi: 'No deferred maintenance at exit' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Equity close — acquisition',                        amount: Math.round(price * 0.25), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'Conventional/DSCR loan — 75% LTV',                 amount: Math.round(price * 0.75), source: 'debt' },
      { phase: 3, monthRange: [1, 3], capitalEvent: 'Move-in ready refresh capex',                       amount: 8_000, source: 'reserves' },
      { phase: 4, monthRange: [36, 36], capitalEvent: 'Optional cash-out refi if appreciation > 25%',   amount: Math.round(price * 0.75 * 1.20), source: 'refinance', correlationRef: 'RATE-ENV' },
    ],
    exit: { targetQuarter: nextQuarter(84), buyerType: 'owner_occupant_or_aggregator', activeBuyers: ['Owner-occupants', 'Invitation Homes', 'Progress Residential', 'Local investors'], capRate: 0.055, expectedIRR: [12, 18] },
    monitoring: [
      { correlationId: 'RATE-ENV', currentValue: 'Rate environment', triggerValue: '30yr rate below 6.5%', actionOnTrigger: 'Evaluate cash-out refi to recycle equity into next acquisition', severity: 'info' },
    ],
    pivotConditions: [
      { condition: 'Submarket appreciation > 30% — sale premium exceeds 10yr NPV of rental income', probability: 0.25, pivotToSubStrategy: 'sfr_fix_flip', irrDelta: 'Sell instead of hold; capture appreciation premium early' },
    ],
  };
}

// ─── SFR STR / MTR ────────────────────────────────────────────────────────────

function buildSFRAlternativeRentalPlan(ctx: PlanContext, mtr: boolean): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 320_000;
  const type = mtr ? 'Mid-Term Rental (MTR)' : 'Short-Term Rental (STR)';
  const subKey = mtr ? 'sfr_mtr' : 'sfr_str';

  return {
    entry: {
      targetQuarter: nextQuarter(1),
      priceCeiling: parseFloat((price * 1.03).toFixed(0)),
      rationale: mtr
        ? 'MTR entry underwritten to LTR rents for downside; MTR premium (30-50% above LTR) is upside; target corporate/medical corridors'
        : 'STR entry underwritten to LTR rents for downside; STR ADR premium is upside; verify STR permit before close',
      debtStructure: mtr ? 'Conventional 75% LTV non-owner-occupied; MTR income accepted by lenders on 12mo+ leases' : 'DSCR loan 65-70% LTV underwritten to LTR rents',
    },
    holdStructure: {
      targetHoldMonths: mtr ? 60 : 48,
      rationale: `${type}: hold while premium income exceeds LTR equivalent; pivot to LTR or sell if demand softens`,
      exitWindows: [
        { month: 24, condition: `Evaluate if ${mtr ? 'MTR demand' : 'STR platform'} softens or regulations tighten` },
        { month: mtr ? 60 : 48, condition: 'Target sale to owner-occupant or investor at market comps' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 3],
        actions: [
          { action: mtr ? 'List on Furnished Finder, Airbnb Monthly, corporate housing platforms' : 'List on Airbnb/VRBO; professional photography; dynamic pricing setup', correlationRefs: ['COR-20'], evidenceRef: 'blockB.loss_to_lease', kpi: mtr ? 'First MTR tenant within 30 days' : 'First STR booking within 14 days' },
          { action: 'Furnish and stage property to target tenant profile', correlationRefs: ['COR-18'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: `Premium at ${mtr ? '30%' : '60%'} above LTR comp` },
        ],
      },
      {
        phase: 2,
        monthRange: [4, mtr ? 60 : 48],
        actions: [
          { action: 'Maintain and renew — tenant satisfaction drives renewal rates and reduces vacancy', correlationRefs: ['COR-19', 'COR-01'], kpi: mtr ? 'Renewal rate ≥ 70%' : 'Occupancy rate ≥ 80% annualized' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Equity close — acquisition',    amount: Math.round(price * 0.30), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'Loan draw',                      amount: Math.round(price * 0.70), source: 'debt' },
      { phase: 3, monthRange: [1, 2], capitalEvent: 'Furnishing + platform setup',   amount: mtr ? 12_000 : 18_000, source: 'reserves' },
    ],
    exit: { targetQuarter: nextQuarter(mtr ? 60 : 48), buyerType: 'owner_occupant_or_str_operator', activeBuyers: ['Owner-occupants', 'STR/MTR operators', 'Local investors'], capRate: 0.057, expectedIRR: [14, 22] },
    monitoring: [
      { correlationId: mtr ? 'MTR-DEMAND' : 'STR-REG', currentValue: `${type} market conditions`, triggerValue: mtr ? 'Corporate relocations drop >30%' : 'STR permit threatened', actionOnTrigger: 'Convert to long-term rental; re-underwrite at LTR rents', severity: 'warning' },
    ],
    pivotConditions: [
      { condition: `${type} income drops to within 10% of LTR equivalent net of expenses`, probability: 0.30, pivotToSubStrategy: 'sfr_hold', irrDelta: 'Convert to long-term rental; lower peak returns but no platform/regulation risk' },
    ],
  };
}

// ─── SFR BTR / Portfolio Agg / Wholesale ─────────────────────────────────────

function buildSFRBtrPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 5_000_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 20;
  const constCost = units * 220_000;

  return {
    entry: {
      targetQuarter: nextQuarter(4),
      priceCeiling: price,
      rationale: 'BTR entry requires entitlement confirmation; land basis + construction cost must deliver 5.5-6.5% stabilized yield on cost',
      debtStructure: 'Construction loan 65% LTC; DSCR takeout at stabilization to permanent SFR portfolio lender or institutional buyer',
    },
    holdStructure: {
      targetHoldMonths: 48,
      rationale: 'BTR: 18mo construction + 12mo lease-up + 12mo NOI seasoning; sell to institutional SFR aggregator or recapitalize',
      refiEventMonth: 42,
      refiTrigger: '93% occupancy sustained 60 days — DSCR takeout or sell to aggregator',
      exitWindows: [
        { month: 36, condition: 'Sell stabilized lease-up portfolio to SFR REIT or aggregator' },
        { month: 48, condition: 'Full stabilization sale or portfolio recapitalization' },
      ],
    },
    valueCreation: [
      { phase: 1, monthRange: [1, 12], actions: [
        { action: 'Entitlement + construction documentation', correlationRefs: ['COR-08'], evidenceRef: 'blockB.market_position', kpi: 'Building permits issued' },
        { action: 'Construction financing close + first draw', correlationRefs: ['COR-14', 'COR-08'], evidenceRef: 'blockD.step3.capex_deploy' },
      ]},
      { phase: 2, monthRange: [13, 30], actions: [
        { action: `Vertical delivery — ${units} SFR units`, capital: constCost, correlationRefs: ['COR-01'], kpi: 'CO issued on schedule' },
        { action: 'Pre-leasing campaign — begin 3mo before delivery', correlationRefs: ['COR-20', 'COR-01'], kpi: '50% pre-leased at delivery' },
      ]},
      { phase: 3, monthRange: [31, 48], actions: [
        { action: 'Lease-up to 93% occupancy', correlationRefs: ['COR-01', 'COR-04'], kpi: '93% in 12 months of delivery', evidenceRef: 'blockD.step4.stabilized_noi' },
        { action: 'Sell portfolio to SFR aggregator or DSCR takeout', correlationRefs: ['COR-07'], evidenceRef: 'blockD.step5.exit_value' },
      ]},
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],   capitalEvent: 'Land acquisition equity', amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [13, 13], capitalEvent: 'Construction loan close',  amount: Math.round(constCost * 0.65), source: 'debt', correlationRef: 'COR-08' },
      { phase: 3, monthRange: [13, 30], capitalEvent: 'Construction draws',       amount: Math.round(constCost * 0.35), source: 'equity' },
    ],
    exit: { targetQuarter: nextQuarter(48), buyerType: 'sfr_aggregator', activeBuyers: ['Invitation Homes', 'AMH', 'Progress Residential', 'Tricon Residential'], capRate: 0.054, expectedIRR: [18, 26] },
    monitoring: [
      { correlationId: 'COR-08', currentValue: 'Construction cost tracking', triggerValue: 'Cost overrun > 10% of GMP', actionOnTrigger: 'Re-underwrite project; evaluate value-engineering options', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: 'Construction cost inflation exceeds 15% — project economics deteriorate below 5% yield on cost', probability: 0.20, pivotToSubStrategy: 'sfr_portfolio_agg', irrDelta: 'Aggregate existing SFR vs. ground-up; lower return but eliminates construction risk' },
    ],
  };
}

function buildSFRPortfolioAggPlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 3_000_000;
  const units = ctx.unitCount > 0 ? ctx.unitCount : 12;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * 1.02).toFixed(0)),
      rationale: 'Portfolio aggregation: buy below $200K/door in growth submarkets; DSCR ≥ 1.20 at market rents; target 10-30 units for institutional packaging',
      debtStructure: 'Blanket portfolio DSCR loan 70-75% LTV; or individual DSCR loans per asset with cross-collateralization waiver',
    },
    holdStructure: {
      targetHoldMonths: 60,
      rationale: 'Portfolio agg: 5yr hold builds scale; exit to institutional SFR buyer who values portfolio premium over individual asset pricing',
      exitWindows: [
        { month: 36, condition: 'Evaluate partial portfolio sale if cap rate compression creates premium exit' },
        { month: 60, condition: 'Full portfolio sale to SFR REIT or institutional aggregator at 5-10% portfolio premium' },
      ],
    },
    valueCreation: [
      { phase: 1, monthRange: [1, 18], actions: [
        { action: 'Acquisition cadence — add 2-4 assets per quarter at or below target basis', correlationRefs: ['COR-01', 'COR-07'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: `Portfolio at ${units}+ doors within 18 months` },
        { action: 'Centralized PM platform — single PM system for all assets; reduce per-unit expense', correlationRefs: ['COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'Mgmt cost < 8% of gross rents' },
      ]},
      { phase: 2, monthRange: [19, 60], actions: [
        { action: 'Portfolio NOI optimization — lease renewals at market, reduce vacancy days to < 14', correlationRefs: ['COR-04', 'COR-01'], kpi: 'Portfolio DSCR ≥ 1.30x' },
        { action: 'Prepare for institutional exit — standardize leases, reports, PM documentation', correlationRefs: ['COR-07'], evidenceRef: 'blockD.step5.exit_value', kpi: 'Institutional-quality data room ready' },
      ]},
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 18],  capitalEvent: 'Rolling acquisition equity draws', amount: Math.round(price * 0.25), source: 'equity' },
      { phase: 2, monthRange: [1, 18],  capitalEvent: 'Portfolio DSCR loan draws',         amount: Math.round(price * 0.75), source: 'debt' },
    ],
    exit: { targetQuarter: nextQuarter(60), buyerType: 'sfr_aggregator', activeBuyers: ['Invitation Homes', 'AMH', 'Amherst', 'Tricon Residential', 'Regional SFR operators'], capRate: 0.056, expectedIRR: [14, 20] },
    monitoring: [
      { correlationId: 'COR-04', currentValue: 'Submarket rent growth', triggerValue: 'Rent growth < 2% for 2 consecutive quarters', actionOnTrigger: 'Re-evaluate acquisition pace; focus on portfolio optimization over growth', severity: 'warning' },
    ],
    pivotConditions: [
      { condition: 'Institutional SFR buyer market dries up — portfolio premium evaporates', probability: 0.20, pivotToSubStrategy: 'sfr_hold', irrDelta: 'Individual asset sales at retail prices; lower portfolio exit premium but more liquid' },
    ],
  };
}

function buildSFRWholesalePlan(ctx: PlanContext): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 180_000;
  const spread = Math.round(price * 0.08);

  return {
    entry: {
      targetQuarter: nextQuarter(0),
      priceCeiling: parseFloat((price * 0.70).toFixed(0)),
      rationale: 'Wholesale: must acquire at 60-70% of ARV to leave room for assignee rehab profit margin and still net a $10K+ spread',
      debtStructure: 'Transactional funding (1-3 day bridge) or assignment of contract — no permanent financing required',
    },
    holdStructure: {
      targetHoldMonths: 1,
      rationale: 'Wholesale: in-and-out in 30-45 days; no renovation, no long-term hold; fee-based income on assignment',
      exitWindows: [
        { month: 1, condition: 'Assign contract or double-close within 30 days of contract execution' },
      ],
    },
    valueCreation: [
      { phase: 1, monthRange: [1, 1], actions: [
        { action: 'Market deal at estimated ARV − repair − spread to qualified cash buyers list', correlationRefs: ['COR-20', 'COR-01'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: `Assignee found within 7 days; spread ≥ $${Math.round(spread / 1000)}K` },
        { action: 'Execute assignment or double-close at title company', correlationRefs: ['COR-07'], kpi: 'Assignment fee collected at close' },
      ]},
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1], capitalEvent: 'Option/contract deposit (1-2%)',   amount: Math.round(price * 0.02), source: 'equity' },
      { phase: 2, monthRange: [1, 1], capitalEvent: 'Transactional funding if needed',  amount: price, source: 'debt' },
      { phase: 3, monthRange: [1, 1], capitalEvent: 'Assignment fee collected',          amount: spread, source: 'operating_cash' },
    ],
    exit: { targetQuarter: nextQuarter(1), buyerType: 'cash_buyer_investor', activeBuyers: ['Local fix-and-flip investors', 'BRRRR buyers', 'Rehabbers on cash buyer list'], capRate: 0, expectedIRR: [60, 120] },
    monitoring: [
      { correlationId: 'BUYER-POOL', currentValue: 'Active cash buyer list', triggerValue: 'No offers within 7 days at target spread', actionOnTrigger: 'Reduce spread by $5K; expand buyer list; or pivot to direct flip', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: 'Cannot find assignee at target spread within 14 days', probability: 0.30, pivotToSubStrategy: 'sfr_fix_flip', irrDelta: 'Retain asset and renovate; higher capital requirement but significantly higher return if ARV holds' },
    ],
  };
}

// ─── Retail ───────────────────────────────────────────────────────────────────

function buildRetailPlan(ctx: PlanContext, subKey: string): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 4_000_000;
  const isNNN = subKey === 'retail_nnn_core';
  const isGrocery = subKey === 'retail_grocery_anchored';
  const isLastMile = subKey === 'retail_last_mile';

  const holdMonths = isNNN ? 84 : isGrocery ? 72 : isLastMile ? 60 : 48;
  const exitCap = isNNN ? 0.057 : isGrocery ? 0.062 : isLastMile ? 0.055 : 0.065;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * (isNNN ? 1.02 : 1.05)).toFixed(0)),
      rationale: isNNN
        ? 'NNN Core: priced on credit quality of tenant + lease term remaining; cap rate spread to 10yr Treasury determines entry attractiveness'
        : isGrocery
        ? 'Grocery-anchored: anchor lease term ≥ 5yr required; priced on blended NOI of anchor + inline tenants at submarket cap'
        : isLastMile
        ? 'Last-mile conversion: acquisition basis must support clear height/dock modification capex and still deliver 5.5%+ stabilized yield on cost'
        : 'Retail value-add: pricing at vacancy-adjusted NOI; value-creation through re-tenanting and NOI improvement',
      debtStructure: isNNN ? 'NNN credit tenant loan 70-75% LTV; very competitive spread due to credit quality' : 'CMBS or bank bridge 65% LTV; perm refi at stabilization',
    },
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: isNNN
        ? 'NNN: hold 7yr aligns with depreciation benefit and targets minimum 3yr lease term remaining at exit for financing eligibility'
        : `${subKey.replace(/_/g, ' ')}: ${Math.round(holdMonths / 12)}yr hold allows full repositioning cycle and NOI stabilization`,
      exitWindows: [
        { month: Math.round(holdMonths * 0.6), condition: 'Evaluate early exit if cap rate compression > 75bps' },
        { month: holdMonths, condition: 'Target institutional or 1031 exchange buyer at stabilized NOI' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 12],
        actions: [
          { action: isNNN ? 'Lease administration — verify NNN pass-throughs, rent escalations, tenant compliance' : 'Tenant audit — assess anchor health; identify inline vacancy for re-tenanting', correlationRefs: ['COR-07', 'COR-19'], evidenceRef: 'blockB.ops_score', kpi: 'Full NNN compliance audit; zero lease violations' },
          ...(isLastMile ? [{ action: 'Dock modification + clear height assessment — confirm last-mile conversion feasibility', correlationRefs: ['COR-14'], evidenceRef: 'blockB.capital_gap', kpi: 'Conversion scope confirmed within budget' }] : []),
        ],
      },
      {
        phase: 2,
        monthRange: [13, holdMonths],
        actions: [
          { action: isGrocery || !isNNN ? 'Re-tenanting campaign — target health/wellness, QSR, and service tenants co-benefiting from anchor traffic' : 'Hold stabilized NNN cash flow — no active asset management required', correlationRefs: ['COR-01', 'COR-20'], evidenceRef: 'blockC.tradeArea.rent_per_unit', kpi: isNNN ? 'Zero vacancy events; rent escalation tracking' : 'Inline vacancy < 10%' },
          { action: 'Begin broker interviews Q-4 before exit', correlationRefs: ['COR-04', 'COR-07'], evidenceRef: 'blockD.step5.exit_value', kpi: 'LOIs from 3+ qualified buyers' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition',   amount: Math.round(price * 0.30), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Loan draw',                     amount: Math.round(price * 0.70), source: 'debt' },
      ...(isLastMile ? [{ phase: 3, monthRange: [1, 6], capitalEvent: 'Dock + clear height modification capex', amount: Math.round(price * 0.05), source: 'reserves' as const }] : []),
    ],
    exit: {
      targetQuarter: nextQuarter(holdMonths),
      buyerType: isNNN ? '1031_exchange_or_private_capital' : 'institutional_or_private_equity',
      activeBuyers: isNNN
        ? ['1031 exchange investors', 'Net lease REITs (STORE, NNN)', 'Private capital NNN buyers']
        : isGrocery
        ? ['Inland Western', 'Regency Centers', 'Kite Realty', 'PREIT', 'Local operators']
        : ['Industrial/retail hybrid buyers', 'Last-mile logistics operators', 'Private equity retail funds'],
      capRate: exitCap,
      expectedIRR: [isNNN ? 8 : 12, isNNN ? 12 : 18],
    },
    monitoring: [
      { correlationId: 'TENANT-CREDIT', currentValue: 'Anchor tenant financial health', triggerValue: 'Anchor downgrade to below BB or closure', actionOnTrigger: 'Begin re-leasing immediately; adjust exit timeline', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: 'E-commerce penetration further erodes foot traffic — inline re-tenanting fails', probability: 0.20, pivotToSubStrategy: isLastMile ? 'industrial_last_mile' : 'retail_last_mile', irrDelta: 'Convert to last-mile logistics if zoning and truck court allow; industrial rents above retail' },
    ],
  };
}

// ─── Office ───────────────────────────────────────────────────────────────────

function buildOfficePlan(ctx: PlanContext, subKey: string): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 6_000_000;
  const isAdaptiveReuse = subKey === 'office_adaptive_reuse';
  const isMedical = subKey === 'office_medical';
  const holdMonths = isAdaptiveReuse ? 60 : 72;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * (isAdaptiveReuse ? 0.80 : 1.02)).toFixed(0)),
      rationale: isAdaptiveReuse
        ? 'Adaptive reuse: entry must reflect conversion cost + residential value; buy at deep discount to office replacement cost'
        : isMedical
        ? 'Medical office: priced on healthcare system tenant credit quality; entry cap ≤ 6.5% for MOB-quality tenants'
        : 'Office tenant rollup: enter at vacancy-adjusted cap reflecting 12-24mo re-tenanting risk',
      debtStructure: isAdaptiveReuse ? 'Construction/conversion loan 60% LTC; residential agency takeout at conversion completion' : 'CMBS or life company bridge 65% LTV; perm refi at stabilization',
    },
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: isAdaptiveReuse
        ? 'Adaptive reuse: 24mo conversion + 18mo lease-up + 12mo seasoning for residential institutional sale'
        : `Office ${isMedical ? 'medical' : 'tenant rollup'}: ${Math.round(holdMonths / 12)}yr hold allows full lease-up and NOI stabilization`,
      exitWindows: [
        { month: Math.round(holdMonths * 0.65), condition: 'Evaluate early exit if target tenancy achieved ahead of plan' },
        { month: holdMonths, condition: 'Institutional sale at stabilized NOI with 12mo seasoning' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, isAdaptiveReuse ? 24 : 12],
        actions: [
          { action: isAdaptiveReuse ? 'Conversion design + permitting (residential conversion plan)' : isMedical ? 'Medical tenant recruitment — target hospital systems, group practices' : 'Identify and target rollover tenants for lease-up campaign', correlationRefs: ['COR-08', 'COR-14'], evidenceRef: 'blockB.market_position', kpi: isAdaptiveReuse ? 'Building permit for residential conversion issued' : 'First medical LOI signed' },
        ],
      },
      {
        phase: 2,
        monthRange: [isAdaptiveReuse ? 25 : 13, holdMonths],
        actions: [
          { action: isAdaptiveReuse ? 'Conversion construction + residential lease-up' : 'Lease execution + TI deployment for stabilization', capital: Math.round(price * (isAdaptiveReuse ? 0.30 : 0.08)), correlationRefs: ['COR-01', 'COR-19'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: isAdaptiveReuse ? '93% residential occupancy within 18mo of delivery' : 'Occupancy ≥ 85%' },
          { action: 'Begin exit marketing Q-4 before target close', correlationRefs: ['COR-04', 'COR-07'], evidenceRef: 'blockD.step5.exit_value', kpi: 'LOIs from 2+ institutional buyers' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition',   amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Loan draw',                     amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, isAdaptiveReuse ? 24 : 12], capitalEvent: isAdaptiveReuse ? 'Conversion capex draws' : 'TI + leasing commissions', amount: Math.round(price * (isAdaptiveReuse ? 0.30 : 0.08)), source: 'reserves' },
    ],
    exit: {
      targetQuarter: nextQuarter(holdMonths),
      buyerType: isAdaptiveReuse ? 'multifamily_institutional' : 'medical_reit_or_institutional',
      activeBuyers: isAdaptiveReuse
        ? ['Multifamily REITs', 'Residential developers', 'Opportunity zone funds']
        : isMedical
        ? ['Healthcare REITs (Physicians Realty, Healthpeak)', 'Hospital systems', 'Medical office funds']
        : ['Office REITs', 'Private equity office funds', 'Owner-users'],
      capRate: isAdaptiveReuse ? 0.048 : isMedical ? 0.058 : 0.068,
      expectedIRR: [isAdaptiveReuse ? 18 : 12, isAdaptiveReuse ? 26 : 18],
    },
    monitoring: [
      { correlationId: 'OFFICE-VAC', currentValue: 'Submarket office vacancy', triggerValue: 'Vacancy > 25% in submarket', actionOnTrigger: 'Accelerate adaptive reuse or medical conversion; generic office re-tenanting becomes uneconomic', severity: 'critical' },
    ],
    pivotConditions: [
      { condition: isAdaptiveReuse ? 'Floor plate > 12K SF makes residential conversion infeasible' : 'Target tenancy does not materialize within 18 months', probability: 0.25, pivotToSubStrategy: isAdaptiveReuse ? 'office_tenant_rollup' : 'office_adaptive_reuse', irrDelta: 'Shift strategy; accept lower peak return for de-risked path' },
    ],
  };
}

// ─── Industrial ───────────────────────────────────────────────────────────────

function buildIndustrialPlan(ctx: PlanContext, subKey: string): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 8_000_000;
  const isLastMile = subKey === 'industrial_last_mile';
  const holdMonths = isLastMile ? 60 : 84;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * 1.03).toFixed(0)),
      rationale: isLastMile
        ? 'Last-mile: entry priced on e-commerce demand density; truck court + clear height premium of 15-25% over standard warehouse'
        : 'Industrial core: stabilized asset priced at going-in cap 5.5-6.5%; long-term lease credit quality drives financing spread',
      debtStructure: isLastMile
        ? 'Bridge 65% LTV during repositioning; life company perm at stabilization'
        : 'Life company or CMBS 70% LTV at 10yr fixed — core industrial is highly financeable',
    },
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: isLastMile
        ? 'Last-mile: 5yr hold allows full last-mile demand ramp and exit into compressed industrial cap rate environment'
        : 'Industrial core: 7yr hold maximizes depreciation benefit and targets cap rate compression as e-commerce demand grows',
      exitWindows: [
        { month: Math.round(holdMonths * 0.60), condition: 'Evaluate early exit if industrial cap rate compression > 75bps below entry' },
        { month: holdMonths, condition: 'Institutional sale to industrial REIT or logistics operator' },
      ],
    },
    valueCreation: [
      { phase: 1, monthRange: [1, 12], actions: [
        { action: isLastMile ? 'Last-mile tenant recruitment — 3PLs, food delivery, e-commerce returns processing' : 'Lease administration — verify triple-net pass-throughs, renewal option exercise tracking', correlationRefs: ['COR-01', 'COR-07'], evidenceRef: 'blockB.ops_score', kpi: isLastMile ? 'First last-mile LOI within 90 days' : '100% NNN lease compliance audit complete' },
        ...(isLastMile ? [{ action: 'Dock + infrastructure upgrades for last-mile use (power, dock levelers, truck court widening)', correlationRefs: ['COR-14'], evidenceRef: 'blockB.capital_gap', capital: Math.round(price * 0.03), kpi: 'Clear height ≥ 24ft; dock count ≥ 1 per 5K SF' }] : []),
      ]},
      { phase: 2, monthRange: [13, holdMonths], actions: [
        { action: 'Hold stabilized — track absorption pace and rental rate reversion quarterly', correlationRefs: ['COR-04', 'COR-08'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: 'Physical occ ≥ 97%; NNN pass-through reconciled annually' },
        { action: 'Begin exit process Q-4 before target', correlationRefs: ['COR-07'], evidenceRef: 'blockD.step5.exit_value', kpi: 'LOIs from 3+ industrial REITs or logistics operators' },
      ]},
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition', amount: Math.round(price * 0.30), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Loan draw',                   amount: Math.round(price * 0.70), source: 'debt' },
      ...(isLastMile ? [{ phase: 3, monthRange: [1, 6], capitalEvent: 'Last-mile infrastructure capex', amount: Math.round(price * 0.03), source: 'reserves' as const }] : []),
    ],
    exit: {
      targetQuarter: nextQuarter(holdMonths),
      buyerType: 'industrial_reit_or_logistics_operator',
      activeBuyers: isLastMile
        ? ['Prologis', 'Duke Realty (Prologis)', 'Rexford Industrial', 'EQT Exeter', 'Local logistics operators']
        : ['Industrial REITs', 'Core-plus institutional funds', 'Life company separate accounts'],
      capRate: isLastMile ? 0.047 : 0.052,
      expectedIRR: [isLastMile ? 14 : 10, isLastMile ? 20 : 14],
    },
    monitoring: [
      { correlationId: 'IND-SUPPLY', currentValue: 'Industrial deliveries SF in submarket', triggerValue: 'Deliveries > 5% of submarket inventory in 12mo', actionOnTrigger: 'Accelerate lease-up if vacant; lock in renewal if occupied to avoid re-leasing into soft market', severity: 'warning' },
    ],
    pivotConditions: [
      { condition: 'Last-mile lease velocity slows — absorption > 18mo from available', probability: 0.20, pivotToSubStrategy: 'industrial_core', irrDelta: 'Reposition to standard industrial core tenant; lower rent premium but faster stabilization' },
    ],
  };
}

// ─── Hospitality ──────────────────────────────────────────────────────────────

function buildHospitalityPlan(ctx: PlanContext, subKey: string): StrategyPlan {
  const price = ctx.acquisitionPrice > 0 ? ctx.acquisitionPrice : 7_000_000;
  const isReflag = subKey === 'hospitality_reflag';
  const holdMonths = isReflag ? 60 : 72;

  return {
    entry: {
      targetQuarter: nextQuarter(3),
      priceCeiling: parseFloat((price * 1.0).toFixed(0)),
      rationale: isReflag
        ? 'Hotel reflag: priced at below-flag-standard RevPAR × 4-5x; PIP cost must fit within budget delivering ≥ 15% RevPAR lift post-flag'
        : 'Extended-stay: priced on stabilized occupancy at extended-stay ADR; corporate/medical demand drivers required within 3mi',
      debtStructure: isReflag ? 'Bridge loan 65% LTV; SBA 504 or franchise-backed financing post-PIP' : 'CMBS or bridge 65% LTV; perm refi at stabilization',
    },
    holdStructure: {
      targetHoldMonths: holdMonths,
      rationale: isReflag
        ? 'Hotel reflag: 18mo PIP + 12mo ramp + 12mo seasoned RevPAR for institutional exit; total 42-60mo'
        : 'Extended-stay: 6yr hold captures full corporate market cycle; extended-stay assets are more liquid than traditional hotels',
      refiEventMonth: isReflag ? 42 : 48,
      refiTrigger: isReflag ? 'RevPAR at or above flag system median — perm refi eligibility' : 'Stabilized at 80%+ occupancy — CMBS perm refi',
      exitWindows: [
        { month: isReflag ? 36 : 48, condition: 'Evaluate early exit if ADR/RevPAR exceeds flag standard — strong buyer demand' },
        { month: holdMonths, condition: 'Target hospitality REIT or institutional operator exit' },
      ],
    },
    valueCreation: [
      { phase: 1, monthRange: [1, isReflag ? 18 : 12], actions: [
        { action: isReflag ? 'PIP execution — rooms, lobby, F&B, exterior per flag standard' : 'Extended-stay conversion — kitchenettes, workspace, laundry per brand standard', capital: Math.round(price * (isReflag ? 0.12 : 0.08)), correlationRefs: ['COR-14', 'COR-18'], evidenceRef: 'blockB.capital_gap', kpi: isReflag ? 'PIP complete within budget; franchise approval' : 'Certificate of conversion; brand approval' },
      ]},
      { phase: 2, monthRange: [isReflag ? 19 : 13, holdMonths], actions: [
        { action: 'RevPAR ramp — revenue management; OTA channel optimization; group sales', correlationRefs: ['COR-01', 'COR-20'], evidenceRef: 'blockD.step4.stabilized_noi', kpi: `RevPAR at or above ${isReflag ? 'flag system median' : '80% extended-stay comp set'}` },
        { action: 'Hold stabilized NOI — track ADR, occupancy, RevPAR monthly vs. STR data', correlationRefs: ['COR-04', 'COR-19'], kpi: 'Stabilized NOI margin ≥ 25%' },
      ]},
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],   capitalEvent: 'Equity close — acquisition', amount: Math.round(price * 0.35), source: 'equity' },
      { phase: 2, monthRange: [1, 1],   capitalEvent: 'Bridge loan draw — 65% LTV',  amount: Math.round(price * 0.65), source: 'debt' },
      { phase: 3, monthRange: [1, 18],  capitalEvent: `PIP capex draws`, amount: Math.round(price * (isReflag ? 0.12 : 0.08)), source: 'reserves' },
      { phase: 4, monthRange: [42, 42], capitalEvent: 'Perm refi at stabilized RevPAR', amount: Math.round(price * 0.65), source: 'refinance' },
    ],
    exit: {
      targetQuarter: nextQuarter(holdMonths),
      buyerType: 'hospitality_reit_or_operator',
      activeBuyers: isReflag
        ? ['Host Hotels', 'Park Hotels', 'Regional operator groups', 'Family office hotel buyers']
        : ['Extended Stay America (Bluerock)', 'Apple Hospitality REIT', 'Sonesta Hotels', 'Corporate lodging operators'],
      capRate: isReflag ? 0.072 : 0.068,
      expectedIRR: [14, 22],
    },
    monitoring: [
      { correlationId: 'REVPAR', currentValue: 'RevPAR vs comp set', triggerValue: 'RevPAR penetration < 90% of comp set for 6 months', actionOnTrigger: 'Revenue management overhaul; evaluate GM replacement', severity: 'warning' },
    ],
    pivotConditions: [
      { condition: isReflag ? 'Franchise not available or PIP budget exceeds 20% of acquisition — reflag economics fail' : 'Extended-stay corporate demand drops > 30%', probability: 0.25, pivotToSubStrategy: isReflag ? 'hospitality_extended_stay' : 'hospitality_reflag', irrDelta: 'Pivot to alternative hospitality format; accept repositioning timeline reset' },
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
    holdStructure: {
      targetHoldMonths: 60,
      rationale: 'Generic 5-year hold allows full value-creation cycle and exit in stable market conditions',
      exitWindows: [
        { month: 36, condition: 'Evaluate early exit if cap rate compression creates sale premium' },
        { month: 60, condition: 'Target institutional or private equity exit at full stabilization' },
      ],
    },
    valueCreation: [
      {
        phase: 1,
        monthRange: [1, 12],
        actions: [
          { action: 'Operational stabilization and value-creation execution', correlationRefs: ['COR-01', 'COR-19'], evidenceRef: 'blockB.market_position', kpi: 'NOI at or above underwritten year 1' },
        ],
      },
    ],
    capitalSequencing: [
      { phase: 1, monthRange: [1, 1],  capitalEvent: 'Equity close — acquisition',   amount: Math.round(price * 0.30), source: 'equity' },
      { phase: 2, monthRange: [1, 1],  capitalEvent: 'Conventional loan draw',        amount: Math.round(price * 0.70), source: 'debt' },
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
    // Multifamily
    case 'mf_value_add_standard': return buildMFValueAddPlan(ctx, false);
    case 'mf_deep_value_add':     return buildMFValueAddPlan(ctx, true);
    case 'mf_distressed':         return buildMFDistressedPlan(ctx);
    case 'mf_bts_ground_up':      return buildMFGroundUpPlan(ctx);
    case 'mf_core':               return buildMFCorePlan(ctx, false);
    case 'mf_core_plus':          return buildMFCorePlan(ctx, true);
    case 'mf_lease_up':           return buildMFLeaseUpPlan(ctx);
    case 'mf_str':                return buildMFStrPlan(ctx);
    // SFR
    case 'sfr_fix_flip':          return buildSFRFixFlipPlan(ctx);
    case 'sfr_brrrr':             return buildSFRBRRRRPlan(ctx);
    case 'sfr_hold':              return buildSFRHoldPlan(ctx);
    case 'sfr_str':               return buildSFRAlternativeRentalPlan(ctx, false);
    case 'sfr_mtr':               return buildSFRAlternativeRentalPlan(ctx, true);
    case 'sfr_btr':               return buildSFRBtrPlan(ctx);
    case 'sfr_portfolio_agg':     return buildSFRPortfolioAggPlan(ctx);
    case 'sfr_wholesale':         return buildSFRWholesalePlan(ctx);
    // Retail
    case 'retail_nnn_core':
    case 'retail_grocery_anchored':
    case 'retail_value_add':
    case 'retail_last_mile':      return buildRetailPlan(ctx, subStrategy);
    // Office
    case 'office_adaptive_reuse':
    case 'office_medical':
    case 'office_tenant_rollup':  return buildOfficePlan(ctx, subStrategy);
    // Industrial
    case 'industrial_last_mile':
    case 'industrial_core':       return buildIndustrialPlan(ctx, subStrategy);
    // Hospitality
    case 'hospitality_reflag':
    case 'hospitality_extended_stay': return buildHospitalityPlan(ctx, subStrategy);
    // Fallback (should only trigger for newly-added sub-strategies not yet in catalog)
    default:                      return buildGenericPlan(ctx);
  }
}
