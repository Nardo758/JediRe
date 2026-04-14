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
