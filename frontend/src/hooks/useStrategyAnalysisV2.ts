import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/api.client';

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
  ultimateReturn: {
    irr: number;
    equityMultiple: number;
    holdMonths: number;
    exitCapRate: number;
  };
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
  strategyAssumptions: Record<string, any>;
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

export interface PlanHoldStructure {
  targetHoldMonths: number;
  rationale: string;
  exitWindows: string[];
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
  analysis: StrategyAnalysisV2 | null;
  loading: boolean;
  error: string | null;
  confirmDetection: (confirmed: boolean) => Promise<void>;
  overrideClassification: (assetClass: string) => Promise<void>;
  refresh: () => void;
}

export function useStrategyAnalysisV2(dealId: string): UseStrategyAnalysisV2Result {
  const [analysis, setAnalysis] = useState<StrategyAnalysisV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(0);

  const fetchAnalysis = useCallback(async () => {
    if (!dealId) return;
    const token = ++fetchRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/strategies`);
      if (token !== fetchRef.current) return;
      const data = res.data?.data ?? res.data;
      setAnalysis(data as StrategyAnalysisV2);
    } catch (err: any) {
      if (token !== fetchRef.current) return;
      setError(err?.response?.data?.error || err?.message || 'Failed to load strategy analysis');
    } finally {
      if (token === fetchRef.current) setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const confirmDetection = useCallback(async (confirmed: boolean) => {
    if (!dealId) return;
    await apiClient.patch(`/api/v1/deals/${dealId}/detection-confirmation`, {
      userConfirmed: confirmed,
    });
    fetchAnalysis();
  }, [dealId, fetchAnalysis]);

  const overrideClassification = useCallback(async (assetClass: string) => {
    if (!dealId) return;
    await apiClient.patch(`/api/v1/deals/${dealId}/detection-confirmation`, {
      userConfirmed: true,
      userOverrideClassification: assetClass,
    });
    fetchAnalysis();
  }, [dealId, fetchAnalysis]);

  return {
    analysis,
    loading,
    error,
    confirmDetection,
    overrideClassification,
    refresh: fetchAnalysis,
  };
}
