export type DealType = 'existing' | 'development' | 'redevelopment';

export type InputSource = 'broker' | 'platform' | 'user' | 'agent' | 'capsule';

export interface SourcedValue<T = number> {
  value: T;
  source: InputSource;
  agentName?: string;
  linkedFrom?: string;
}

export interface UnitMixRow {
  floorPlan: string;
  unitSize: number;
  beds: number;
  units: number;
  occupied: number;
  vacant: number;
  marketRent: number;
  inPlaceRent: number;
}

export interface OtherIncomeItem {
  perUnitMonth: number;
  penetration: number;
}

export interface ExpenseItem {
  amount: number;
  type: 'perUnit' | 'total' | 'pctEGR';
  growthRate: number;
}

export interface CapexLineItem {
  description: string;
  amount: number;
}

export interface WaterfallHurdle {
  hurdleRate: number;
  promoteToGP: number;
  lpSplit: number;
}

export interface LoanOption {
  id: string;
  name: string;
  type: string;
  amount: number;
  rate: number;
  spread: number;
  term: number;
  amortization: number;
  ioPeriod: number;
  originationFee: number;
  rateCapCost: number;
  prepayPenalty: number;
  loanType: 'Fixed' | 'Floating';
  source: InputSource;
  selected?: boolean;
}

export interface ModelAssumptions {
  dealInfo: {
    dealName: string;
    totalUnits: number;
    netRentableSF: number;
    vintage: number;
    address: string;
    city: string;
    state: string;
  };
  modelType: 'existing' | 'development';
  holdPeriod: number;
  unitMix: UnitMixRow[];
  acquisition: {
    purchasePrice: number;
    capRate: number;
    closingCosts: Record<string, number>;
  };
  disposition: {
    exitCapRate: number;
    sellingCosts: number;
    saleNOIMethod: string;
  };
  revenue: {
    rentGrowth: number[];
    lossToLease: number;
    stabilizedOccupancy: number;
    collectionLoss: number;
    otherIncome: Record<string, OtherIncomeItem>;
  };
  expenses: Record<string, ExpenseItem>;
  financing: {
    loanAmount: number;
    loanType: string;
    interestRate: number;
    spread: number;
    term: number;
    amortization: number;
    ioPeriod: number;
    originationFee: number;
    rateCapCost: number;
    prepayPenalty: number;
  };
  capex: {
    lineItems: CapexLineItem[];
    contingencyPct: number;
    reservesPerUnit: number;
  };
  waterfall: {
    lpShare: number;
    gpShare: number;
    hurdles: WaterfallHurdle[];
    equityContribution: number;
  };
  development?: {
    landCost: number;
    hardCostPerSF: number;
    hardCostContingency: number;
    softCostPct: number;
    developerFee: number;
    constructionPeriod: number;
    leaseUpVelocity: number;
    constructionLoanLTC: number;
    constructionLoanRate: number;
  };
}

export interface ModelResults {
  summary: {
    irr?: number;
    equityMultiple?: number;
    cashOnCash?: number;
    noi?: number;
    dscr?: number;
    yieldOnCost?: number;
    exitValue?: number;
    totalProfit?: number;
    lpIrr?: number;
    lpEm?: number;
    lpCoC?: number;
    lpTotalDistributions?: number;
    lpProfit?: number;
    gpIrr?: number;
    gpEm?: number;
    gpCoC?: number;
    gpTotalDistributions?: number;
    gpPromoteEarned?: number;
  };
  annualCashFlow: AnnualCashFlowRow[];
  sourcesAndUses: {
    sources: { label: string; amount: number }[];
    uses: { label: string; amount: number }[];
  };
  debtMetrics: any;
  sensitivityAnalysis: any;
  waterfallDistributions: WaterfallDistribution[];
  projections?: ProjectionRow[];
}

export interface AnnualCashFlowRow {
  year: number;
  gpr: number;
  vacancy: number;
  egr: number;
  otherIncome: number;
  totalRevenue: number;
  opex: number;
  noi: number;
  debtService: number;
  cashFlow: number;
  lpDistribution?: number;
  gpDistribution?: number;
  cumulativeReturn?: number;
  runningEM?: number;
}

export interface ProjectionRow {
  label: string;
  section: 'revenue' | 'expense' | 'noi' | 'debt' | 'cashflow' | 'metrics' | 'exit';
  isHeader?: boolean;
  isTotal?: boolean;
  values: (number | null)[];
  monthly?: (number | null)[];
}

export interface WaterfallDistribution {
  tier: string;
  hurdleRate: number;
  lpAmount: number;
  gpAmount: number;
  lpSplit: number;
  gpSplit: number;
  promotePct: number;
}

export interface ModelVersion {
  id: string;
  name: string;
  timestamp: number;
  source: 'user' | string;
  dealType: DealType;
  assumptions: ModelAssumptions;
  results?: ModelResults;
}

// ─── F9 DealFinancials types (shared across tabs) ────────────────────────────

export interface F9TrafficYear {
  year: number; vacancyPct: number|null; occupancyPct: number|null;
  effRent: number|null; rentGrowthPct: number|null;
  t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null;
  walkInsPerWeek: number|null; toursPerWeek: number|null;
  appsPerWeek: number|null; leasesPerWeek: number|null;
}

export interface F9GprDecomposition {
  brokerAnnual: number|null; platformAnnual: number|null; t12Annual: number|null;
  rentRollAnnual: number|null; resolvedAnnual: number|null;
  brokerPerUnitMo: number|null; platformPerUnitMo: number|null;
  t12PerUnitMo: number|null; resolvedPerUnitMo: number|null;
}

export interface F9DealFinancials {
  dealId: string; dealName: string; totalUnits: number;
  /** Top-level peer benchmark — available even before a traffic prediction is run.
   *  Sourced from deal_market_data / apartment_market_snapshots independently of trafficProjection. */
  peerBenchmark?: {
    nPeerProperties: number|null;
    submarketPercentile: { vacancy: number|null; rent: number|null; leaseVelocity: number|null }|null;
    peerDistribution: {
      vacancy:       { p25: number|null; p50: number|null; p75: number|null };
      rent:          { p25: number|null; p50: number|null; p75: number|null };
      leaseVelocity: { p25: number|null; p50: number|null; p75: number|null };
    }|null;
    dataSource: string|null;
  }|null;
  proforma: {
    year1: Array<{
      field: string; label: string;
      broker: number|null; platform: number|null; t12: number|null;
      t6: number|null; t3: number|null; t1: number|null;
      rentRoll: number|null; taxBill: number|null;
      resolved: number|null; resolution: string|null; perUnit: number|null;
      source?: string|null; confidence?: number|null;
      benchmarkPosition: 'above' | 'below' | 'within' | null;
    }>;
    integrityChecks: Array<{ id: string; status: 'ok'|'warn'|'error'; message: string; detail?: Record<string, unknown> }>;
    unitEconomics: Record<string, number|null>;
    valuationSnapshot: {
      pricePerUnit: number|null; pricePerSF: number|null;
      grm: number|null; gim: number|null; goingInCapT12: number|null;
      priceToRC: number|null; rcPerUnit: number|null;
      buildArbitrageFlag: 'buy_existing'|'neutral'|'build_new'|null;
      pricePerUnitSubmarketMedian: number|null; pricePerUnitPercentile: number|null;
      pricePerSFSubmarketMedian: number|null; pricePerSFPercentile: number|null;
      grmSubmarketMedian: number|null; grmPercentile: number|null;
      gimSubmarketMedian: number|null; gimPercentile: number|null;
      goingInCapSubmarketMedian: number|null; goingInCapPercentile: number|null;
    } | null;
  };
  /** Hold-period returns computed from the F9 projection engine */
  returns: {
    lpNetIrr: number|null; lpEquityMultiple: number|null; avgCashOnCash: number|null; gpPromoteEarned: number|null;
    unleveragedIrr: number|null; unleveragedEm: number|null; goingInCapRate: number|null; stabilizedCapRate: number|null;
    yocUntrended: number|null; yocTrended: number|null; developmentSpread: number|null; avgNoiGrowth: number|null; peakNoiYear: number|null;
    minDscr: number|null; minDscrYear: number|null; avgDscr: number|null;
    minDebtYield: number|null; minDebtYieldYear: number|null; avgDebtYield: number|null; maturityLtv: number|null;
    refiEventCount: number;
    holdMonths: number|null; equityRecoveryYear: number|null; equityRecoveryMonths: number|null;
    breakevenCfYear: number|null; breakevenCfMonths: number|null; breakevenCfDateStr: string|null;
    leaseUpMonths: number|null; prefAccrualYears: number|null; peakEquityDeployed: number|null;
    peakEquityDateStr: string|null;
    totalLpDistributions: number|null; prefAccrued: number|null; prefPaid: number|null;
    netDistributionsByYear: number[]; cumulativeCfByYear: number[];
    lpTrancheReturns: Array<{ id: string; avgCoc: number|null; twr: number|null; promoteTierHit: boolean|null }>;
    totalGpFees: number|null; totalGpPromote: number|null; gpAllInMultiple: number|null;
    gpCoInvestIrr: number|null; gpCoInvestEm: number|null;
    irr: number|null; equityMultiple: number|null; cashOnCash: number|null;
    debtMetrics: {
      coverage: { dscrY1: number|null; dscrMin: { year: number; value: number }|null; dscrAvg: number|null; dscrStab: number|null; dyY1: number|null; dyMin: { year: number; value: number }|null; dyAvg: number|null; icr: number|null; cashFlowCoverage: number|null; loanConstantBlended: number|null };
      structural: { ltvAtClose: number|null; ltvAtStab: number|null; ltvAtMaturity: number|null; ltc: number|null; ltsv: number|null; refiOutProbability: number|null; maturityRiskScore: number|null };
      leverage: { positiveLeverage: boolean|null; leverageSpreadBps: number|null; leverageIrrLiftBps: number|null; cashOnCashSpread: number|null };
      stress: { breakevenOccupancy: number|null; breakevenRent: number|null; dscrAtMinus10PctNOI: number|null; dscrAtPlus200bps: number|null; cashTrapDistanceBps: number|null; defaultBufferMonths: number|null };
      refi: { events: Array<{ year: number; payoff: number; prepayPenalty: number; exitFee: number; netProceeds: number }>; defeasanceCostToday: number|null; ymCostToday: number|null; costToRefiNowBps: number|null };
      covenants: { dscrCushionBps: number|null; sweepTriggerYear: number|null; recourseBurnoffDate: string|null };
    }|null;
    valuation: {
      perUnit: { goingIn: number|null; stabilized: number|null; atExit: number|null; submarketMedian: number|null; percentile: number|null };
      perSF: { netRentable: { goingIn: number|null; atExit: number|null; submarketMedian: number|null; percentile: number|null }; gross: { goingIn: number|null; submarketMedian: number|null } };
      multiples: { grm: { goingIn: number|null; submarketMedian: number|null; percentile: number|null }; gim: { goingIn: number|null; submarketMedian: number|null; percentile: number|null }; nim: number|null; opexRatio: { y1: number|null; stab: number|null }; coc: { y1: number|null; stab: number|null; avg: number|null }; capRate: { goingIn: number|null; stabilized: number|null; atExit: number|null }; yieldOnCost: { untrended: number|null; trended: number|null }; devSpread: number|null };
      replacementCost: { rcTotal: number|null; rcPerUnit: number|null; priceToRC: number|null; buildArbitrageFlag: 'buy_existing'|'neutral'|'build_new'|null; insurableValue: number|null };
      positionMatrix: { priceSF: number|null; capRate: number|null; quadrant: 'value_buy'|'suspicious'|'distressed_trophy'|'trophy'|null; comps: Array<{ name: string; priceSF: number; capRate: number }> };
    }|null;
    strategyAlternative: { strategy: string; irr: number; em: number; rationale: string }|null;
  } | null;
  capitalStack: {
    purchasePrice: number|null; loanAmount: number|null; equityAtClose: number|null;
    ltcPct: number|null; interestRate: number|null; ioPeriodMonths: number|null;
    amortizationYears: number|null; dscrMin: number|null;
    originationFeePct: number|null; pricePerUnit: number|null;
  };
  rentRollSummary: {
    unitMix: Array<{
      type: string; count: number; avgSf: number|null;
      inPlaceRent: number|null; marketRent: number|null;
      occupancyPct: number|null; concessionPct: number|null;
    }>|null;
    avgInPlaceRent: number|null;
    weightedOccupancyPct: number|null;
    gprFromUnitMix: number|null;
    useUnitMixForGpr: boolean;
  }|null;
  trafficProjection: {
    yearly: F9TrafficYear[];
    leaseUp: { weeksTo90: number|null; weeksTo93: number|null; weeksTo95: number|null }|null;
    calibrated: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null };
    leasingSignals: { t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null; confidence: number|null; preLeasedPct?: number|null; peakDownUnits?: number|null; postRenoAbsorptionLagWks?: number|null }|null;
    /** traffic.mode.effective — the authoritative five-mode deal mode from the traffic engine.
     *  Preferred over leaseVelocity.resolvedMode for mode-conditional rendering. */
    mode?: { effective: string; raw: string } | null;
    /** Peer/submarket benchmark data derived from deal_market_data (comp-set) or
     *  apartment_market_snapshots (city aggregate). All distribution fields except P50 are
     *  null until per-property distribution data is available. */
    peerBenchmark?: {
      nPeerProperties: number|null;
      submarketPercentile: { vacancy: number|null; rent: number|null; leaseVelocity: number|null }|null;
      peerDistribution: {
        vacancy:       { p25: number|null; p50: number|null; p75: number|null };
        rent:          { p25: number|null; p50: number|null; p75: number|null };
        leaseVelocity: { p25: number|null; p50: number|null; p75: number|null };
      }|null;
      dataSource: string|null;
    }|null;
  }|null;
  assumptions: {
    holdYears: number; exitCap: number|null; rentGrowthYr1: number|null;
    rentGrowthStabilized: number|null;
    perYear: Array<{
      year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null;
      /** Regime bridge overrides — populated from per_year_overrides JSONB by the agent (Pass 3). */
      turnoverRatioOvr?: number|null; repairsMultOvr?: number|null;
      concessionsPctOvr?: number|null; marketingMultOvr?: number|null;
    }>;
    gprDecomposition: F9GprDecomposition|null;
    narrative: string|null;
  };
  userOverrides: Record<string, Record<number, number|null>>;
  meta: { seeded: boolean; updatedAt: string|null };
  /** Phase 1A — Pro Forma stabilization window. */
  adoptionTimeline?: {
    constructionMonths: number|null; leaseUpMonths: number|null;
    absorptionUnitsPerMonth: number|null; stabilizationTargetPct: number|null;
    /** First hold-period year where vacancy reaches AND sustains the threshold. */
    stabilizationYear: number|null;
    /** Operator manual pin for the Pro Forma window start year. */
    stabilizationYearOverride: number|null;
    /** Effective year = override ?? agent-computed ?? null. */
    effectiveStabilizationYear: number|null;
    /** Submarket equilibrium vacancy % for context display. */
    submarketVacancyRate: number|null;
  } | null;
  /**
   * LTL forward trajectory signals — Task #1540 (Piece B1).
   * Exposes the T12 trailing average vs live lease-level LTL and the per-year
   * decay curve used by Engine A. Present whenever year1 is seeded.
   */
  ltlSignals?: {
    t12Pct: number | null;
    livePct: number | null;
    /** Which source was actually used to seed the trajectory. */
    trajectorySource: 'live' | 't12' | 'resolved';
    /**
     * Operator's persisted baseline preference from deal_assumptions.ltl_baseline_source.
     * null = auto (engine chooses). Written via PATCH /:dealId/assumptions/ltl-controls.
     */
    operatorBaselineSource: 'live' | 't12' | null;
    byYear: number[];
    captureRate: number;
  } | null;
  closeDate: string | null;
  saleDate: string | null;
  taxes: F9TaxData | null;
  /** Debt stack — senior + mezz/B-Note loans (v2) */
  debt: F9DebtStack | null;
  /** Sources & Uses — capital deployment at close */
  sourcesUses: {
    sources: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable?: boolean }>;
    uses: Array<{ id: string; label: string; amount: number | null; pct: number | null; sub: string | null; userOverridable: boolean }>;
    totalSources: number | null;
    totalUses: number | null;
    delta: number | null;
    balanced: boolean;
    benchmarks: {
      totalCostPerUnit: number | null;
      totalCostPerSf: number | null;
      closingCostsPct: number | null;
      debtPct: number | null;
      equityPct: number | null;
      capexPerUnit: number | null;
    };
    userOverrides: {
      closingCosts: number | null;
      capexTotal: number | null;
      workingCapital: number | null;
      preopeningCosts: number | null;
      otherUses: number | null;
      sellerFinancing: number | null;
    };
  } | null;
  /** Waterfall / capital configuration */
  waterfall: {
    waterfallType: string;
    lpShare: number;
    gpShare: number;
    prefRate: number;
    tiers: Array<{ triggerIrr: number; lpPct: number; gpPct: number; triggerType: string }>;
    fees: {
      acquisitionFeePct: number;
      assetMgmtFeePct: number;
      assetMgmtBasis: string;
      constructionMgmtPct: number;
      dispositionFeePct: number;
      refinancingFeePct: number;
    };
    userOverrides: { lpShare: number | null; gpShare: number | null; prefRate: number | null };
  } | null;
  /**
   * Server-side per-year projections from buildProjectionsForExport.
   * Shape mirrors ProjYearExport exactly (backend/src/services/f9-financial-export.service.ts).
   * cfads is aliased from cfbt (cash flow after debt service) at the handler layer.
   * Removed from earlier draft: cfads (now aliased), depreciation, taxableIncome, taxPayable,
   * afterTaxCfads, effectiveTaxRate, rentGrowthPct, opexRatioPct, noiMarginPct, capRatePct,
   * dispositionDocStamps, dispositionTaxPayable, reTaxSource, debtSource — none of these
   * are emitted by buildProjectionsForExport today.
   */
  projections: Array<{
    year: number;
    gpr: number; vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
    nri: number; otherIncome: number; egi: number;
    payroll: number; repairs: number; turnover: number; contractSvc: number;
    marketing: number; utilities: number; gAndA: number; mgmtFee: number;
    insurance: number; reTaxes: number; reserves: number;
    totalOpex: number; noi: number;
    opMargin: number | null; noiPerUnit: number | null;
    interest: number; principal: number; annualDS: number;
    capexDraw: number;
    cfbt: number; cfads: number; netCF: number;
    coc: number | null; dscr: number | null; debtYield: number | null;
    occupancy: number | null;
    exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
    sellingCosts: number | null; loanPayoff: number; netSaleProceeds: number | null;
    outstandingBalance: number;
    cumulativeEM: number | null;
  }> | null;
  /** Capital tranche configuration + server-side computed distribution schedule */
  capital: {
    tranches: Array<{
      id: string;
      label: string;
      role: string;
      pct: number;
      prefRate: number;
      compounding: string;
      cumulative: boolean;
      participatePromote: boolean;
    }>;
    schedule: Array<{
      period: string;
      year: number;
      cfads: number;
      activeTier: string;
      lpDist: number;
      gpDist: number;
      gpPromote: number;
      gpFees: number;
      prefAccrued: number;
      prefPaid: number;
      lpIrr: number | null;
      lpEm: number;
      isExit: boolean;
    }>;
    metrics: {
      lpIrr: number | null;
      lpEquityMultiple: number | null;
      gpEquityMultiple: number | null;
      totalLpDistributions: number;
      totalGpDistributions: number;
      totalGpPromote: number;
      totalGpFees: number;
    };
  } | null;
  /**
   * Platform capital structure defaults — seeded at deal creation.
   * Populated from deal_assumptions.year1._capital_structure_defaults.
   * Present for every deal immediately after creation (no extraction required).
   */
  capitalStructureDefaults?: {
    ltv_pct: number;
    gp_equity_pct: number;
    lp_equity_pct: number;
    preferred_return_pct: number;
    gp_promote_threshold_pct: number;
    gp_promote_pct: number;
    gp_catchup_pct: number;
    amortization_years: number;
    io_period_months: number;
    loan_term_years: number;
    debt_rate: number;
    seeded_at: string;
    resolution: 'platform';
  } | null;
  /**
   * Capital structure optimization result from the Cashflow Agent.
   * Populated after an agent run that called optimize_capital_structure.
   * Null until the first agent run completes.
   */
  capitalStructureOptimization?: {
    primary_metric: 'irr' | 'cash_on_cash' | 'stabilized_value' | 'profit_at_exit';
    optimal_ltv: number | null;
    optimal_debt_amount: number | null;
    optimal_rate: number;
    resulting_dscr_min: number | null;
    resulting_breakeven_occ: number | null;
    primary_metric_value: number | null;
    evidence_narrative: string;
    constraints_binding: string[];
    confidence: 'high' | 'medium' | 'low';
    infeasible: boolean;
    infeasibility_reason: string | null;
    equity_at_optimal: number | null;
    gp_equity: number | null;
    lp_equity: number | null;
    pareto_frontier?: Array<{
      bundle_id: string;
      bundle_name: string;
      optimal_ltv: number | null;
      trade_off_summary: string;
      primary_metric: string;
      primary_metric_value: number | null;
      gp_irr?: number | null;
      dscr_min: number | null;
      breakeven_occ?: number | null;
      optimal_rate: number;
      equity_at_optimal?: number | null;
      lp_equity?: number | null;
      lp_irr?: number | null;
      lp_distribution_yield?: number | null;
      plausibility_score: number;
      plausibility_band: string;
      plausibility_color?: 'green' | 'amber' | 'red';
      feasible: boolean;
      infeasibility_reason?: string | null;
      role_rank: number;
    }>;
  } | null;
  /** Subject property traffic history — M07 §6.  Null until first rent roll uploaded for this deal. */
  subjectHistory?: F9SubjectHistory | null;
  /** Lease Velocity Engine output — null until backend LV engine ships (M07 prereq). */
  leaseVelocity?: F9LeaseVelocity | null;
  /**
   * Concession amortization recognition schedule.
   * Populated by the backend ConcessionAmortizationEngine when ConcessionRecord[] are available.
   * Null until Task #573 wires LV engine output → concession_records[].
   *
   * EARNED-VS-RECOGNIZED-DISTINCTION (§14):
   *   This shape holds "recognized" dollars only — never mix with earned (cash_value) amounts
   *   or display them in the same Projections row.
   *
   * Recomputed on: LV engine output update, leasing_cost_treatment change,
   *   subject_history update, fiscal_year_start_month change.
   */
  concessionRecognition?: F9ConcessionRecognition | null;
  /**
   * User-added other income lines — passed through from the proforma seed so
   * the Projections tab can render per-line ramp schedules (Task #1160).
   * Adoption block included so the frontend can compute year-by-year values
   * using the same formula as the backend proforma-seeder (computeUserLineAnnual).
   */
  otherIncomeUserLines?: Array<{
    id: string;
    label: string;
    monthly: number;
    note?: string;
    adoption?: {
      ramp_start_period: number;
      ramp_duration_months: number;
      steady_state_monthly: number;
      probability_adopted: number;
    } | null;
  }>;
}

/**
 * Lease Velocity Engine output shape — mirrors backend lease-velocity-types.ts.
 * Populated by GET /financials when the LV backend engine is present;
 * null until M07 schema extension + backend LV engine ship.
 */
export interface F9LeaseVelocity {
  /**
   * Engine-resolved leasing mode for this deal.
   * VALUE_ADD / REDEVELOPMENT may arrive as V2_PENDING_VALUE_ADD from older backends;
   * use resolveLeaseMode() (AssumptionsTab) to normalize to the canonical five-mode set.
   */
  resolvedMode: 'LEASE_UP_NEW_CONSTRUCTION' | 'STABILIZED_MAINTENANCE' | 'OCCUPANCY_RECOVERY'
    | 'VALUE_ADD' | 'REDEVELOPMENT' | 'V2_PENDING_VALUE_ADD';
  /** Data confidence — drives JEDI Position sub-score adjustment */
  confidence: 'high' | 'medium' | 'low';
  /** Month index (1-based) when 95% occupancy stabilization threshold is reached */
  stabilizationMonth: number | null;
  /**
   * Peak cumulative negative operating cash position during lease-up.
   * Used as the S&U lease-up reserve line amount per LEASE-UP-RESERVE-IS-S&U rule.
   * Null when mode is not LEASE_UP_NEW_CONSTRUCTION.
   */
  peakCumulativeReserve: number | null;
  /** Leasing cost treatment applied when the engine computed monthly cash flows */
  costTreatmentInEffect: 'OPERATING' | 'CAPITALIZED' | 'HYBRID';
  /**
   * Post-stabilization NOI clarity signal: 0–1.
   * 1.0 = fully calibrated with S2+ subject history, zero collisions.
   * 0.0 = no subject history, low confidence.
   * Used by the JEDI Score Position sub-score.
   */
  stabilizedNoiClarity: number | null;
  /** Subject property traffic history tier feeding this engine run */
  subjectHistoryTier: 'S1' | 'S2' | 'S3' | 'S4' | null;
}

/** Subject property traffic history — M07 §6.  Populated when ≥1 rent roll has been uploaded. */
export interface F9SubjectHistory {
  tier: 'S1' | 'S2' | 'S3' | 'S4';
  snapshot_count: number;
  coverage_months: number | null;
  current_state: {
    occupancy_rate: number;
    unit_count: number;
    occupied_count: number;
    vacant_count: number;
    notice_count: number;
    loss_to_lease: number | null;
    avg_concession_value: number | null;
    avg_contract_rent: number | null;
    avg_market_rent: number | null;
    signing_velocity: number | null;
    expiration_waterfall: Array<{ months_out: number; expiring_units: number; expiring_pct: number }>;
  } | null;
  observed_dynamics: {
    renewal_rate: number | null;
    turnover_rate: number | null;
    new_lease_trade_out_pct: number | null;
    renewal_trade_out_pct: number | null;
    signing_velocity: number | null;
    days_vacant_median: number | null;
    concession_trend: 'increasing' | 'stable' | 'decreasing' | null;
    loss_to_lease: number | null;
    diff_period_count: number;
  } | null;
  confidence_weights: Record<string, { n_obs: number; n_required: number; weight: number }>;
  peer_collisions: Array<{ coefficient: string; subject_value: number; peer_value: number; sigma_deviation: number }>;
  /**
   * Platform peer-set posterior for every resolved coefficient — populated by
   * the financials-composer from the CoefficientResolver platform values.
   * Allows the SubjectHistoryPanel to show a non-null PEER SET column for ALL
   * coefficient rows, not just those that triggered a peer collision.
   */
  peer_set_values: Record<string, number>;
  updated_at: string;
}

export type F9ProFormaRow = F9DealFinancials['proforma']['year1'][number];
export type F9IntegrityCheck = F9DealFinancials['proforma']['integrityChecks'][number];

// ─── F9 Tax data ──────────────────────────────────────────────────────────────

export interface F9TaxYear {
  year: number;
  assessedValue: number;
  millageRate: number;
  taxAmount: number;
  sohCapBinding: boolean;
  reassessmentEvent: boolean;
}

export interface F9TaxData {
  /** Jurisdiction string, e.g. "GA-Fulton", "FL-Miami-Dade", "TX-Harris" */
  jurisdiction?: string;
  /** Human-readable county label, e.g. "Fulton County" or null for statewide */
  countyLabel?: string | null;
  /** Annual assessment growth rate used by this ruleset (e.g. 0.04 for GA, 0.12 for FL market) */
  assessmentGrowthPct?: number;
  /**
   * Where the millage rate originated:
   *   'live'      — fetched from a live government API this request
   *   'user'      — manually overridden by the user in the UI
   *   'hardcoded' — ruleset default (no live data available for this jurisdiction)
   */
  millageSource?: 'live' | 'user' | 'hardcoded';
  reTax: {
    t12AssessedValue: number | null;
    t12MillageRate: number | null;
    t12AnnualTax: number | null;
    platformAssessedValue: number | null;
    platformAnnualTax: number | null;
    isMiamiDade: boolean;
    sohCapPct: number;
    perYear: F9TaxYear[];
    deltaVsT12Pct: number | null;
  };
  /**
   * Provenance: server-provided LayeredValue metadata for the key Section A fields.
   * Populated from taxForecast.provenance by proforma-adjustment.service.ts.
   * Used by TaxesTab PLATFORM column tooltips.
   */
  provenance?: {
    assessedValue: { source: string; confidence: 'high' | 'medium' | 'low'; formula?: string; computedAt?: string; rulesetVersion?: string };
    millageRate: { source: string; confidence: 'high' | 'medium' | 'low'; formula?: string; rulesetVersion?: string };
    platformAnnualTax: { source: string; confidence: 'high' | 'medium' | 'low'; formula?: string };
    parcelSource?: string | null;
    parcelConfidence?: 'high' | 'medium' | 'low' | null;
    rulesetVersion: string;
    computedAt: string;
  } | null;
  tpp: {
    broker: number | null;
    platform: number | null;
    /** Annual TPP tax from state ruleset tppTax() — 0 when jurisdiction does not tax TPP */
    tppAnnualTax?: number | null;
    /** Statutory exemption threshold in dollars (e.g. $25,000 FL) */
    tppExemption?: number | null;
    /** True when this state/county taxes tangible personal property */
    tppTaxed?: boolean;
    /** Filing requirement: form name, deadline, penalty fraction */
    tppFilingRequirement?: { formName: string; deadline: string; penaltyPct: number } | null;
  };
  incomeTax: {
    purchasePrice: number | null;
    landValuePct: number;
    depreciableBase: number | null;
    annualDepreciation: number | null;
    bonusDepreciationCurrentYearPct: number;
    costSegAvailablePct: number;
    /** Blended marginal income tax rate sourced from taxes engine (default 0.37 top bracket) */
    marginalTaxRate: number;
    /** State income tax rate for this entity type (0 for TX/FL; ~5.39% for GA) */
    stateIncomeTaxRate?: number;
    /** Federal income tax rate for this entity type */
    federalIncomeTaxRate?: number;
  };
  transferTax: {
    purchasePrice: number | null;
    isMiamiDade: boolean;
    miamiDadeRatePct: number;
    statewideFlatRatePct: number;
    appliedRatePct: number;
    docStampAmount: number | null;
    intangibleTaxAmount: number | null;
    loanAmount: number | null;
    totalTransferTax: number | null;
    refi: {
      enabled: boolean;
      triggerYear: number;
      newLoanType: string | null;
      refiLoanAmount: number | null;
      refiDocStampAmount: number | null;
      refiIntangibleTaxAmount: number | null;
      refiTotalTax: number | null;
    } | null;
  };
  userOverrides: {
    taxAssessedValue: number | null;
    taxMillageRate: number | null;
    tppAmount: number | null;
    taxCounty: boolean | null;
  };
}

export interface F9NarrativeBlock {
  id: string;
  label: string;
  summary: string;
  detail: string | null;
  status: 'ok' | 'warn' | 'info';
}

import type { SourceDocument } from '../../../hooks/useSourceDocuments';
export type { SourceDocument };

/** Per-field evidence metadata from the underwriting evidence system */
export interface EvidenceFieldMeta {
  tier: number;
  confidence: string;
  has_collision: boolean;
  collision_magnitude: 'minor' | 'material' | 'severe' | null;
  plausibility_band?: string;
  plausibility_score?: number;
  plausibility_color?: 'green' | 'amber' | 'red';
}

/**
 * Per-period cohort breakdown for the drilldown modal (Task #575).
 * One entry per YYYYMM key in F9ConcessionRecognition.monthly_detail.
 */
export interface F9ConcessionMonthlyDetail {
  new_lease_count: number;
  new_lease_dollars: number;
  new_lease_earned: number;
  renewal_count: number;
  renewal_dollars: number;
  renewal_earned: number;
  continuing_count: number;
  continuing_dollars: number;
  earliest_commencement?: string;
  latest_commencement?: string;
  methods: string[];
  method_by_type: Record<string, string[]>;
  write_offs: Array<{ amount: number; reason: string; concession_id: string }>;
}

/**
 * Concession amortization recognition schedule — frontend projection of
 * backend DealConcessionRecognition (backend/src/types/concessions.ts).
 *
 * EARNED-VS-RECOGNIZED-DISTINCTION (§14):
 *   monthly/by_calendar_year/by_fiscal_year hold "recognized" dollars only.
 *   Never display alongside earned (cash_value) amounts in the same P&L row.
 */
export interface F9ConcessionRecognition {
  /** Per-month recognized dollars. Key: YYYYMM e.g. "202501" */
  monthly: Record<string, number>;
  /** Calendar year totals. Key: YYYY e.g. "2025" */
  by_calendar_year: Record<string, number>;
  /** Fiscal year totals. Key: YYYY (fiscal year label) */
  by_fiscal_year: Record<string, number>;
  /** Write-off dollars recognized in the current calendar year */
  write_offs_year_to_date: number;
  /** ISO timestamp of last engine run */
  last_recomputed: string;
  /**
   * Sum of amount_total for lease-up-period concession records under CAPITALIZED
   * treatment (= AmortizationOutput.lease_up_reserve_required). Populated by backend.
   * Used by the S&U "Capitalized Lease-up Concessions" line (Task #574).
   */
  capitalized_lease_up_total?: number;
  /**
   * Per-period cohort breakdown for the drilldown modal (Task #575).
   * Key: YYYYMM. Populated by backend fresh-compute and cache-hit paths.
   */
  monthly_detail?: Record<string, F9ConcessionMonthlyDetail>;
}

/**
 * Leasing-cost-treatment classification for the Lease Velocity Engine.
 * Defined here so FinancialEngineTabProps can reference it without importing
 * from LeaseVelocitySection (which would create a circular-dep risk).
 */
export type LeasingCostTreatment = 'OPERATING' | 'CAPITALIZED' | 'HYBRID';

export interface FinancialEngineTabProps {
  dealId: string;
  deal?: Record<string, unknown>;
  dealType: DealType;
  assumptions: ModelAssumptions | null;
  modelResults: ModelResults | null;
  onAssumptionsChange?: (a: Partial<ModelAssumptions>) => void;
  onBuildModel?: () => void;
  building?: boolean;
  versions?: ModelVersion[];
  activeVersion?: ModelVersion | null;
  /** Fires when Pro Forma integrity checks load; hasErrors=true blocks Projections tab */
  onIntegrityChange?: (hasErrors: boolean) => void;
  /** F9 DealFinancials (from /api/v1/deals/:id/financials) shared across F1/F8/F10 tabs */
  f9Financials?: F9DealFinancials | null;
  /** True when Pro Forma integrity checks contain errors — tab shows warning banner but remains accessible */
  integrityWarning?: boolean;
  /** Navigate to a sibling tab by index */
  onTabChange?: (tabIndex: number) => void;
  /** Refetch f9Financials from the server (e.g. after a PATCH override) */
  onF9Refresh?: () => void;
  /**
   * Shared top-bar leasing-cost-treatment view override.
   * Set by either Location A (Assumptions, persists to deal) or Location B
   * (ProForma top-bar, view-state only).  Passed to every tab so Projections,
   * Pro Forma, and Returns all re-fetch with the same treatment in one cycle.
   */
  lvCostTreatmentView?: LeasingCostTreatment;
  /**
   * Update the shared treatment view override.  Triggers a full F9 re-fetch
   * (parent re-fetches /financials — backend reads treatment from operator_stance) so all sibling
   * tabs reflect the change without duplicated fetch calls.
   */
  onLvTreatmentViewChange?: (t: LeasingCostTreatment) => void;
  /** Called when the Projections tab timeline (hold period) changes, so parent can re-fetch with ?hold=N */
  onHoldChange?: (years: number) => void;
  /** Active summary-bar filter — passed into tabs that support per-row filtering */
  evidenceFilter?: { type: 'collision' | 'confidence' | 'tier'; value: string } | null;
  /**
   * Per-field evidence metadata from the underwriting evidence system.
   * Keyed by field_path (e.g. 'income.gpr', 'gpr').
   * Used to render collision indicators and tier badges on ProForma rows.
   */
  evidenceFieldMap?: Record<string, EvidenceFieldMeta>;
  /** Field paths that have collision data — used by collision filter to narrow grid to flagged rows */
  collisionFields?: string[] | null;
  /** Field paths with severe collisions only — used when SEV pill is clicked */
  severeCollisionFields?: string[] | null;
  /** Field paths with material collisions only — used when MAT pill is clicked */
  materialCollisionFields?: string[] | null;
  /** Field paths with minor collisions only — used when MIN pill is clicked */
  minorCollisionFields?: string[] | null;
  /** Source documents catalogue from GET /api/v1/deals/:dealId/source-documents */
  sourceDocuments?: SourceDocument[];
  /**
   * Platform role of the viewing user (Task #878).
   * 'sponsor' = full GP view (default).
   * 'lp'      = LP-centric returns view: preferred return, IRR, distribution schedule prominently.
   * 'lender'  = Lender DSCR/LTV panel prominently.
   */
  platformRole?: 'sponsor' | 'lp' | 'lender';
  /** True while the async version-history fetch is in flight (Task #864). */
  isLoadingVersions?: boolean;
}

// ─── F9 Debt Stack (v2) ───────────────────────────────────────────────────────

export type PrepayType = 'lockout' | 'yield_maintenance' | 'defeasance' | 'stepdown' | 'open';

export interface F9DebtLoan {
  /** Unique id within the stack, e.g. 'senior' | 'mezz' */
  id: string;
  /** Display label */
  name: string;
  /** Bridge | Agency | CMBS | HUD | LifeCo | Mezz */
  loanTypeLabel: string;
  /** Fixed | Floating */
  rateType: 'Fixed' | 'Floating';
  /** 4-column values — null means source has no data for this field */
  loanAmount: { broker: number|null; platform: number|null };
  ltcPct:     { broker: number|null; platform: number|null };
  ltv:        { platform: number|null };
  interestRate: { broker: number|null; platform: number|null };
  sofr:       { platform: number|null };
  spread:     { broker: number|null; platform: number|null };
  capRate:    { broker: number|null; platform: number|null };
  termYears:  { broker: number|null; platform: number|null };
  amortYears: { broker: number|null; platform: number|null };
  ioMonths:   { broker: number|null; platform: number|null };
  origFee:    { broker: number|null; platform: number|null };
  exitFee:    { platform: number|null };
  rateCapCost:{ broker: number|null; platform: number|null };
  minDscr:    { platform: number|null };
  minDebtYield: { platform: number|null };
  minOccupancy: { platform: number|null };
  maxLtv:     { platform: number|null };
  cashTrapDscr: { platform: number|null };
  tiEscrowMonths:      { platform: number|null };
  replacementReserve:  { platform: number|null };
  operatingReserveMonths: { platform: number|null };
  prepayType: PrepayType;
  /** Derived annual DS at platform rate/amount */
  derivedAnnualDS: number | null;
  /** SOFR forward curve (5 years), pct decimal e.g. 0.05 */
  sofrCurve: number[];
  /** Extension options text (persisted, senior only) */
  extensionOptions: string | null;
  /** Refi event configuration (persisted, senior only) */
  refiEnabled: boolean;
  refiTriggerYear: number;
  refiNewLoanType: string | null;
}

export interface F9DebtStack {
  loans: F9DebtLoan[];
  /** Aggregate totals across all loans */
  aggregate: {
    totalLoanAmount: number|null;
    blendedRatePct:  number|null;
    combinedLtcPct:  number|null;
    totalAnnualDS:   number|null;
    aggregateDscr:   number|null;
  };
}

export const fmt$ = (n: number): string => {
  const v = Number(n);
  if (isNaN(v)) return '—';
  if (v === 0) return '$0';
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};

export const fmtPct = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${v.toFixed(1)}%`; };
export const fmtPctRaw = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${(v * 100).toFixed(2)}%`; };
export const fmtX = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : `${v.toFixed(2)}×`; };
export const fmtN = (n: number): string => { const v = Number(n); return isNaN(v) ? '—' : v.toLocaleString(); };
