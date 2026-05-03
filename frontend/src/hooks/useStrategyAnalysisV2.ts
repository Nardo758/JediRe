import { useCallback, useEffect } from 'react';
import { useDealStore } from '../stores/dealStore';

// ─── API response types (mirror backend StrategyAnalysisV2) ──────────────────

export interface DetectionSignal {
  signal: string;
  value: string | number;
  threshold: string;
  contribution: number;
}

export interface AlternateSubStrategy {
  key: string;
  fit: number;
  reason: string;
}

export interface ConfidenceBreakdown {
  assessorCode: number;
  zoningMatch: number;
  rentRollSignal: number;
  naicsSignal: number;
  buildingStructure: number;
}

export interface DetectionResult {
  assetClass: string;
  subType: string;
  detectedDealType: string;
  detectedSubStrategy: string;
  confidence: number;
  requiresUserConfirmation: boolean;
  confidenceBreakdown: ConfidenceBreakdown;
  detectionSignals: DetectionSignal[];
  alternateSubStrategies: AlternateSubStrategy[];
  userConfirmed?: boolean;
  userOverrideClassification?: string;
}

export interface SignalScores {
  demand: number;
  supply: number;
  momentum: number;
  position: number;
  risk: number;
  confidence: number;
}

export interface GateResult {
  qualified: boolean;
  marginal: boolean;
  disqualified: boolean;
  reasons: string[];
}

export interface FinancialPreview {
  irr: number;
  cocReturn: number;
  equityMultiple: number;
  exitCapRate: number;
  holdMonths: number;
}

export interface MetricStackRow {
  label: string;
  subject: string | number;
  benchmark: string | number;
  delta: string | number;
  dollarImpact: string;
  source?: string;
  dataQuality?: string;
  /** Per-row derivation trail — may be included by backend for comp detail */
  mathTrail?: MathTrailStep[];
}

export interface CompPoint {
  name: string;
  x: number;
  y: number;
  isSubject: boolean;
  annotation?: string;
}

export interface MathTrailStep {
  step: string;
  value: string | number;
  formula?: string;
  sourceRef?: string;
  isSubtotal?: boolean;
}

export interface ThesisPrompt {
  headline: string;
  rationale: string;
  keyDrivers: string[];
  riskFactors: string[];
  aiCoordinatorContext: string;
}

export interface EvidenceReport {
  subStrategyKey: string;
  thesis: string;
  thesisPrompt: ThesisPrompt;
  metricStack: MetricStackRow[];
  compEvidence: {
    tradeArea: CompPoint[];
    likeKind: CompPoint[];
    benchmarkLine?: number;
  };
  mathTrail: MathTrailStep[];
  /**
   * Projected returns for the EXPECTED RETURN tile. May be `null` when the
   * backend has no projection for this sub-strategy (e.g. detection
   * incomplete, strategy excluded). The UI renders a "Not yet computed"
   * placeholder in that case rather than relying on the error boundary —
   * the boundary is reserved for unexpected render bugs (Task #427).
   */
  ultimateReturn: {
    irr: number;
    equityMultiple: number;
    holdMonths: number;
    exitCapRate: number;
    rationale?: string;
  } | null;
}

export interface SubStrategyScore {
  key: string;
  family: string;
  name: string;
  isDetectedPrimary: boolean;
  isAdjacent: boolean;
  gate: GateResult;
  baseScore: number;
  timingMultiplier: number;
  gateAdjustment: number;
  finalScore: number;
  disqualified: boolean;
  financialPreview: FinancialPreview;
  strategyAssumptions: Record<string, unknown>;
  /** Per-signal weights from backend SUB_STRATEGY_WEIGHTS — included in API response */
  signalWeights: Record<string, number>;
  appliedCorrelations: string[];
  evidenceReport: EvidenceReport;
}

export interface ArbitrageSummary {
  detected: boolean;
  winner: string;
  detectedPrimary: string;
  deltaPoints: number;
  narrative: string;
}

export interface PlanEntry {
  targetQuarter: string;
  priceCeiling: number;
  rationale: string;
  debtStructure: string;
}

export interface ExitWindow {
  month: number;
  condition: string;
}

export interface PlanHoldStructure {
  targetHoldMonths: number;
  rationale: string;
  exitWindows: Array<string | ExitWindow>;
}

export interface PlanAction {
  phase: number;
  action: string;
  timing: string;
  evidenceRefs: string[];
  correlationRefs: string[];
  costEstimate?: string;
  expectedImpact?: string;
}

export interface PlanCapitalItem {
  item: string;
  amount: number;
  timing: string;
  priority: string;
}

export interface PlanExit {
  targetQuarter: string;
  buyerType: string;
  activeBuyers: string[];
  capRate: number;
  expectedIRR: [number, number];
}

export interface MonitoringItem {
  correlationId: string;
  metric: string;
  currentValue: string;
  triggerThreshold: string;
  severity: 'critical' | 'warning' | 'info';
  action: string;
}

export interface PivotCondition {
  trigger: string;
  pivotTo: string;
  rationale: string;
}

export interface InvestmentPlan {
  entry: PlanEntry;
  holdStructure: PlanHoldStructure;
  valueCreation: PlanAction[];
  capitalSequencing: PlanCapitalItem[];
  exit: PlanExit;
  monitoring: MonitoringItem[];
  pivotConditions: PivotCondition[];
}

export interface GoldenChain {
  phase: string;
  position: number;
  description: string;
  activeSignals: string[];
}

export interface CorrelationAlert {
  correlationId: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  value: string;
  drivesPlanDimension: string;
}

export interface Indicator {
  id: string;
  label: string;
  value: string;
  direction: 'up' | 'down' | 'flat';
}

export interface BuyerTargeting {
  trafficQuadrant: string;
  institutionalActivity: number;
  suggestedBuyerTypes: string[];
  narrative: string;
}

export interface StrategyAnalysisV2 {
  dealId: string;
  computedAt: string;
  detection: DetectionResult;
  signalScores: SignalScores;
  subStrategies: SubStrategyScore[];
  arbitrage: ArbitrageSummary;
  plan: InvestmentPlan;
  goldenChain: GoldenChain;
  correlationAlerts: CorrelationAlert[];
  indicators: {
    leading: Indicator[];
    concurrent: Indicator[];
    lagging: Indicator[];
  };
  buyerTargeting: BuyerTargeting;
  coordinatorNarrative: string;
}

export interface UseStrategyAnalysisV2Result {
  // Raw analysis object (for backward compat)
  analysis: StrategyAnalysisV2 | null;
  // Flat spec-contract exports (detection-first spec)
  detection: DetectionResult | null;
  subStrategies: SubStrategyScore[];
  arbitrage: ArbitrageSummary | null;
  plan: InvestmentPlan | null;
  correlationAlerts: CorrelationAlert[];
  goldenChain: GoldenChain | null;
  coordinatorNarrative: string | null;
  // Loading state
  loading: boolean;
  error: string | null;
  recalculating: boolean;
  // Actions
  confirmDetection: (confirmed: boolean) => Promise<void>;
  overrideClassification: (assetClass: string) => Promise<void>;
  /** Refines sub-strategy within the detected asset class without changing asset class */
  adjustSubStrategy: (subStrategyKey: string) => Promise<void>;
  refresh: () => void;
  triggerRecalc: () => Promise<void>;
}

/**
 * useStrategyAnalysisV2 — reads from the dealStore's strategyAnalysisV2 slice.
 * On mount, fetches from GET /api/v1/deals/:dealId/strategies.
 * If null response, automatically triggers a recalc via POST and re-fetches.
 * loading remains true through the entire recalc→refetch cycle.
 */
export function useStrategyAnalysisV2(dealId: string): UseStrategyAnalysisV2Result {
  const analysis = useDealStore(s => s.strategyAnalysisV2);
  const loading = useDealStore(s => s.strategyAnalysisV2Loading);
  const error = useDealStore(s => s.strategyAnalysisV2Error);
  const recalculating = useDealStore(s => s.strategyAnalysisV2Recalculating);

  const fetchStrategyAnalysisV2 = useDealStore(s => s.fetchStrategyAnalysisV2);
  const triggerStrategyAnalysisV2Recalc = useDealStore(s => s.triggerStrategyAnalysisV2Recalc);
  const confirmStrategyDetection = useDealStore(s => s.confirmStrategyDetection);
  const overrideStrategyClassification = useDealStore(s => s.overrideStrategyClassification);
  const adjustStrategySubStrategy = useDealStore(s => s.adjustStrategySubStrategy);

  // Fetch on dealId change — store handles null-response recalc internally
  useEffect(() => {
    if (dealId) fetchStrategyAnalysisV2(dealId);
  }, [dealId]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDetection = useCallback(
    (confirmed: boolean) => confirmStrategyDetection(dealId, confirmed),
    [dealId, confirmStrategyDetection],
  );

  const overrideClassification = useCallback(
    (assetClass: string) => overrideStrategyClassification(dealId, assetClass),
    [dealId, overrideStrategyClassification],
  );

  const adjustSubStrategy = useCallback(
    (subStrategyKey: string) => adjustStrategySubStrategy(dealId, subStrategyKey),
    [dealId, adjustStrategySubStrategy],
  );

  const refresh = useCallback(
    () => { fetchStrategyAnalysisV2(dealId); },
    [dealId, fetchStrategyAnalysisV2],
  );

  const triggerRecalc = useCallback(
    () => triggerStrategyAnalysisV2Recalc(dealId),
    [dealId, triggerStrategyAnalysisV2Recalc],
  );

  return {
    analysis,
    // Flat spec-contract fields
    detection: analysis?.detection ?? null,
    subStrategies: analysis?.subStrategies ?? [],
    arbitrage: analysis?.arbitrage ?? null,
    plan: analysis?.plan ?? null,
    correlationAlerts: analysis?.correlationAlerts ?? [],
    goldenChain: analysis?.goldenChain ?? null,
    coordinatorNarrative: analysis?.coordinatorNarrative ?? null,
    // State
    loading,
    error,
    recalculating,
    // Actions
    confirmDetection,
    overrideClassification,
    adjustSubStrategy,
    refresh,
    triggerRecalc,
  };
}
