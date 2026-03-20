import React, { useEffect, useState, useCallback } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import { useUnitMixIntelligence, type CompProperty } from '../../../hooks/useUnitMixIntelligence';
import { ActionStatusPanel } from '../ActionStatusPanel';
import { StrategyAnalysisResults } from '../StrategyAnalysisResults';
import { PropertyDetailsForm } from '../PropertyDetailsForm';
import {
  dealAnalysisService,
  AnalysisStatus,
  StrategyResults,
} from '@/services/dealAnalysis.service';
import { apiClient } from '@/services/api.client';
import {
  type JEDIScoreData,
  type SignalScore,
  type StrategyVerdictData,
  type RiskAlertData,
} from '@/data/enhancedOverviewMockData';
import { T as BT, mono as bMono, sans as bSans, UnderwritingComparison } from '../bloomberg-tokens';

function scoreToVerdict(score: number): { verdict: string; verdictColor: string } {
  if (score >= 85) return { verdict: 'STRONG BUY', verdictColor: 'text-emerald-400' };
  if (score >= 70) return { verdict: 'OPPORTUNITY', verdictColor: 'text-amber-400' };
  if (score >= 55) return { verdict: 'HOLD / MONITOR', verdictColor: 'text-stone-400' };
  return { verdict: 'CAUTION', verdictColor: 'text-red-400' };
}

function buildSignalsFromBreakdown(breakdown: any): SignalScore[] {
  const signalDefs = [
    { id: 'demand', name: 'Demand', color: 'bg-emerald-500', bgColor: 'bg-emerald-900/10', moduleLink: 'market-intelligence' },
    { id: 'supply', name: 'Supply', color: 'bg-amber-500', bgColor: 'bg-amber-900/10', moduleLink: 'supply' },
    { id: 'momentum', name: 'Momentum', color: 'bg-blue-500', bgColor: 'bg-blue-900/10', moduleLink: 'market-intelligence' },
    { id: 'position', name: 'Position', color: 'bg-violet-500', bgColor: 'bg-violet-900/10', moduleLink: 'market-intelligence' },
    { id: 'risk', name: 'Risk', color: 'bg-[#4B5563]', bgColor: 'bg-[#131920]', moduleLink: 'risk-management' },
  ];

  return signalDefs.map(def => {
    const data = breakdown?.[def.id];
    const score = data?.score ?? 50;
    const weight = Math.round((data?.weight ?? 0.2) * 100);
    return {
      ...def,
      weight,
      score: Math.round(score),
      weighted: Math.round(score * (weight / 100) * 10) / 10,
      trend: 'flat' as const,
      trendDelta: 0,
      description: data?.note || `${def.name} signal score: ${Math.round(score)}/100`,
    };
  });
}

interface OverviewSectionProps {
  deal: any;
  onStrategySelected?: (strategyId: string) => void;
  onTabChange?: (tabId: string) => void;
  geographicContext?: any;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  deal,
  onStrategySelected,
  onTabChange,
  geographicContext,
}) => {
  const { 
    capitalStructure, strategy: strategyCtx, financial, market, design3D, 
    activeScenario, zoningProfile, siteData, dealInputs, canonicalData,
    assumptions, computedReturns, fullContext, assumptionsLoading 
  } = useDealModule();

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [jediScoreData, setJediScoreData] = useState<JEDIScoreData | null>(null);
  const [signals, setSignals] = useState<SignalScore[]>([]);
  const [strategyVerdict, setStrategyVerdict] = useState<StrategyVerdictData | null>(null);
  const [riskAlert, setRiskAlert] = useState<RiskAlertData | null>(null);
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [capitalStackData, setCapitalStackData] = useState<any>(null);
  const [marketCapRate, setMarketCapRate] = useState<number | null>(null);
  const [entitlementBenchmarks, setEntitlementBenchmarks] = useState<any>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'loading' | 'live' | 'sample'>('loading');
  const [viewMode, setViewMode] = useState<'existing' | 'development'>('existing');

  const isDev = deal?.developmentType === 'Ground-Up' ||
    deal?.developmentType === 'new' ||
    deal?.developmentType === 'Redevelopment' ||
    deal?.isDevelopment === true ||
    deal?.projectType === 'land';

  const isRedevelopment = deal?.developmentType === 'Redevelopment';

  useEffect(() => {
    setViewMode(isDev ? 'development' : 'existing');
  }, [isDev]);

  useEffect(() => {
    if (!deal?.id) return;
    let stopPolling: (() => void) | undefined;
    const runAnalysis = async () => { stopPolling = await startAnalysis(); };
    runAnalysis();
    loadJediScore();
    loadEntitlements();
    loadCapitalStack();
    loadEntitlementBenchmarks();
    return () => { stopPolling?.(); };
  }, [deal?.id]);

  useEffect(() => {
    if (!deal?.id) return;
    loadMarketData();
  }, [deal?.id, geographicContext]);

  const loadEntitlements = async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.get(`/api/v1/entitlements/deal/${deal.id}`);
      if (res.data?.data && Array.isArray(res.data.data)) {
        setEntitlements(res.data.data);
      } else if (Array.isArray(res.data)) {
        setEntitlements(res.data);
      }
    } catch (err) {
      console.warn('Could not load entitlements:', err);
    }
  };

  const loadCapitalStack = async () => {
    if (!deal?.id) return;
    const strategy = deal.strategyType || deal.strategy || 'value_add';
    const totalCost = deal.purchasePrice || deal.budget || 0;
    const noi = deal.noi || deal.strategyDefaults?.assumptions?.noi || 0;
    if (!totalCost) return;
    try {
      const res = await apiClient.post(`/api/v1/capital-structure/stack`, {
        dealId: deal.id,
        strategy,
        layers: [
          { type: 'senior_debt', amount: totalCost * 0.65 },
          { type: 'equity', amount: totalCost * 0.35 },
        ],
        uses: { acquisition: totalCost },
        noi,
      });
      if (res.data?.data) {
        setCapitalStackData(res.data.data);
      } else if (res.data?.stack || res.data?.layers) {
        setCapitalStackData(res.data);
      }
    } catch (err) {
      console.warn('Could not load capital stack:', err);
    }
  };

  const loadMarketData = () => {
    if (!deal?.id || !geographicContext) return;
    if (geographicContext?.submarket?.avgCapRate) {
      setMarketCapRate(geographicContext.submarket.avgCapRate);
    } else if (geographicContext?.msa?.avgCapRate) {
      setMarketCapRate(geographicContext.msa.avgCapRate);
    }
  };

  const loadEntitlementBenchmarks = async () => {
    const county = deal?.county || deal?.tradeArea?.county || '';
    const state = deal?.state || deal?.tradeArea?.state || '';
    if (!county || !state) return;
    try {
      const res = await apiClient.get(`/api/v1/benchmark-timeline/benchmarks`, {
        params: { county, state },
      });
      const summaries = res.data?.summaries || [];
      if (summaries.length > 0) {
        const primary = summaries[0];
        setEntitlementBenchmarks({
          p50: primary.medianMonths,
          p75: primary.p75Months,
          p25: primary.p25Months,
          p90: primary.p90Months,
          municipality: res.data?.county || county,
          sampleSize: primary.sampleSize,
          dataSource: primary.dataSource,
        });
      }
    } catch (err) {
      console.warn('Could not load entitlement benchmarks:', err);
    }
  };

  const loadJediScore = async () => {
    if (!deal?.id) return;
    setScoreLoading(true);
    try {
      const response = await apiClient.get(`/api/v1/jedi/score/${deal.id}`);
      const scoreData = response.data?.data;
      if (scoreData?.score) {
        const s = scoreData.score;
        const total = s.totalScore ?? s.total_score ?? 0;
        const delta = s.scoreDelta ?? s.score_delta ?? 0;
        const { verdict, verdictColor } = scoreToVerdict(total);
        setJediScoreData({
          score: Math.round(total),
          delta30d: Math.round(delta),
          verdict,
          verdictColor,
          confidence: 85,
          confidenceLabel: total >= 70 ? 'High' : 'Medium',
          dataCompleteness: 85,
          lastUpdated: 'Just now',
        });
        if (scoreData.breakdown) {
          setSignals(buildSignalsFromBreakdown(scoreData.breakdown));
        }
        setDataSource('live');
      } else {
        setDataSource('live');
      }
    } catch (err) {
      console.warn('Could not load JEDI score:', err);
      setDataSource('live');
    } finally {
      setScoreLoading(false);
    }
  };

  const startAnalysis = async (): Promise<(() => void) | undefined> => {
    try {
      const existingAnalysis = await dealAnalysisService.getLatestAnalysis(deal.id);
      if (existingAnalysis) {
        setStrategyResults(existingAnalysis);
        setAnalysisComplete(true);
        setAnalysisStatus({ phase: 'complete', progress: 100, message: 'Analysis complete' });
        return;
      }
      setAnalysisStatus({ phase: 'initializing', progress: 0, message: 'Starting analysis...' });
      await dealAnalysisService.triggerAnalysis(deal.id);
      const stopPolling = dealAnalysisService.pollAnalysisStatus(
        deal.id,
        (status) => setAnalysisStatus(status),
        (results) => { setStrategyResults(results); setAnalysisComplete(true); },
        2000
      );
      return stopPolling;
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisStatus({ phase: 'error', progress: 0, message: 'Failed to start analysis', error: (error as Error).message });
    }
  };

  const handleStrategySelection = useCallback((strategyId: string) => {
    onStrategySelected?.(strategyId);
  }, [onStrategySelected]);

  useEffect(() => {
    if (!strategyResults) return;

    if (strategyResults.strategies?.length) {
      const strategies = strategyResults.strategies;
      const recId = strategyResults.recommendedStrategyId;
      const recommended = strategies.find(s => s.id === recId) || strategies[0];
      const sorted = [...strategies].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      const secondBest = sorted.find(s => s.id !== recommended.id);
      const gap = secondBest ? Math.round(recommended.confidence - secondBest.confidence) : 0;

      setStrategyVerdict({
        recommended: recommended.id,
        recommendedLabel: recommended.name,
        score: Math.round(recommended.confidence),
        secondBest: secondBest?.id || '',
        secondBestLabel: secondBest?.name || '',
        secondBestScore: secondBest ? Math.round(secondBest.confidence) : 0,
        arbitrageGap: gap,
        isArbitrage: gap >= 10,
        roiEstimate: recommended.projectedROI ? `${recommended.projectedROI.toFixed(1)}%` : '—',
        roiLabel: 'Projected ROI',
        insight: recommended.description || `${recommended.name} scores highest with ${Math.round(recommended.confidence)}/100 confidence.`,
      });
    } else if (deal) {
      const strategyType = deal.strategyType || deal.strategy || 'value_add';
      const strategyLabels: Record<string, string> = {
        'value_add': 'Value-Add',
        'core': 'Core',
        'core_plus': 'Core Plus',
        'opportunistic': 'Opportunistic',
        'development': 'Ground-Up Development',
        'ground_up': 'Ground-Up Development',
        'stabilized': 'Stabilized Hold',
        'distressed': 'Distressed / Turnaround',
      };
      const label = strategyLabels[strategyType] || strategyType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      setStrategyVerdict({
        recommended: strategyType,
        recommendedLabel: label,
        score: 0,
        secondBest: '',
        secondBestLabel: '',
        secondBestScore: 0,
        arbitrageGap: 0,
        isArbitrage: false,
        roiEstimate: '—',
        roiLabel: 'Projected ROI',
        insight: `Based on deal classification. Run full strategy analysis for detailed scoring.`,
      });
    }
  }, [strategyResults, deal]);

  useEffect(() => {
    if (dataSource !== 'live' || !signals.length) return;
    const worstSignal = [...signals].sort((a, b) => a.score - b.score)[0];
    if (!worstSignal) return;

    const score = worstSignal.score;
    const severity: 'low' | 'medium' | 'high' = score < 40 ? 'high' : score < 60 ? 'medium' : 'low';

    setRiskAlert({
      show: score < 70,
      category: worstSignal.name,
      score: Math.round(score),
      maxScore: 100,
      detail: worstSignal.description,
      mitigationAvailable: severity !== 'high',
      mitigationText: severity === 'medium'
        ? `${worstSignal.name} signal at ${Math.round(score)}/100 — monitor closely.`
        : severity === 'high'
        ? `Critical: ${worstSignal.name} signal below threshold.`
        : '',
      severity,
    });
  }, [signals, dataSource]);

  const navigateToTab = useCallback((tabId: string) => {
    onTabChange?.(tabId);
  }, [onTabChange]);

  return (
    <div style={{ background: BT.bg, minHeight: '100%', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dataSource !== 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '4px 12px', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', borderRadius: 6,
              color: isDev ? (isRedevelopment ? BT.amberL : BT.violL) : BT.blueL,
              background: isDev ? (isRedevelopment ? BT.amberBg : BT.violBg) : BT.blueBg,
              border: `1px solid ${isDev ? (isRedevelopment ? BT.amber : BT.violet) : BT.blue}40`,
              ...bMono,
            }}>
              {isRedevelopment ? 'REDEVELOPMENT' : isDev ? 'GROUND-UP DEVELOPMENT' : 'ACQUISITION'}
            </span>
            <span style={{ fontSize: 9, color: BT.td, ...bSans }}>Set at deal creation</span>
          </div>
          {dataSource === 'live' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 700, color: BT.greenL, background: BT.greenBg, border: `1px solid ${BT.green}40`, ...bMono }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BT.green }} />
              LIVE DATA
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 9, fontWeight: 700, color: BT.amberL, background: BT.amberBg, border: `1px solid ${BT.amber}40`, ...bMono }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BT.amber }} />
              SAMPLE DATA
            </span>
          )}
        </div>
      )}

      <PropertyDetailsForm dealId={deal?.id} deal={deal} />

      {!analysisComplete && (
        <ActionStatusPanel
          status={analysisStatus}
          dealType={deal.developmentType || 'Development'}
          propertyType={deal.propertyTypeKey || 'Multifamily'}
          onComplete={() => setAnalysisComplete(true)}
        />
      )}

      <DealHeader
        jediScore={jediScoreData}
        signals={signals}
        strategyVerdict={strategyVerdict}
        riskAlert={riskAlert}
        deal={deal}
        navigateToTab={navigateToTab}
        capitalStructure={capitalStructure}
      />

      {strategyResults && (
        <StrategyAnalysisResults
          results={strategyResults}
          dealType={deal.developmentType || 'Development'}
          onChooseStrategy={handleStrategySelection}
        />
      )}

      {viewMode === 'existing'
        ? <ExistingOverview deal={deal} navigateToTab={navigateToTab} capitalStructure={capitalStructure} financial={financial} market={market} capitalStackData={capitalStackData} marketCapRate={marketCapRate} computedReturns={computedReturns} />
        : <DevOverview deal={deal} navigateToTab={navigateToTab} financial={financial} design3D={design3D} activeScenario={activeScenario} zoningProfile={zoningProfile} entitlements={entitlements} entitlementBenchmarks={entitlementBenchmarks} />
      }
    </div>
  );
};

const JEDIScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const scoreColor = score >= 85 ? '#10b981' : score >= 70 ? '#d97706' : score >= 55 ? '#a8a29e' : '#ef4444';

  return (
    <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#292524" strokeWidth="8" />
        <circle cx="55" cy="55" r={radius} fill="none" stroke={scoreColor} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-[9px] text-stone-500 font-mono tracking-wider">JEDI SCORE</span>
      </div>
    </div>
  );
};

const SectionHead: React.FC<{
  title: string;
  right?: string;
  accentColor?: string;
  accent?: string;
}> = ({ title, right, accent = BT.amber }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: BT.bgPanel, borderTop: `1px solid ${BT.border}`, borderBottom: `1px solid ${BT.border}`, borderLeft: `3px solid ${accent}` }}>
    <span style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 2, textTransform: 'uppercase', ...bMono }}>{title}</span>
    {right && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>{right}</span>}
  </div>
);

const KVCard: React.FC<{
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  noteColor?: string;
  compact?: boolean;
}> = ({ label, value, note, compact = false }) => (
  <div style={{ background: BT.bgCard, padding: compact ? '8px 12px' : '12px 14px' }}>
    <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{label}</div>
    <div style={{ fontSize: compact ? 14 : 17, fontWeight: 700, color: BT.amberL, ...bMono }}>{value}</div>
    {note && <div style={{ fontSize: 9, color: BT.td, marginTop: 3, ...bMono }}>{note}</div>}
  </div>
);

const DDItem: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${BT.border}` }}>
    <span style={{ fontSize: 13, flexShrink: 0, color: done ? BT.greenL : BT.borderX }}>{done ? '✓' : '○'}</span>
    <span style={{ fontSize: 11, color: done ? BT.tm : BT.td, ...bSans }}>{label}</span>
  </div>
);

interface DealHeaderProps {
  jediScore: JEDIScoreData | null;
  signals: SignalScore[];
  strategyVerdict: StrategyVerdictData | null;
  riskAlert: RiskAlertData | null;
  deal: any;
  navigateToTab: (tab: string) => void;
  capitalStructure?: any;
}

const DealHeader: React.FC<DealHeaderProps> = ({
  jediScore, signals, strategyVerdict, riskAlert, deal, navigateToTab,
}) => {
  const ddItems = deal?.stateData?.ddItems || [];
  const ddDone = ddItems.filter((i: any) => i.done).length;
  const ddTotal = ddItems.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        {/* JEDI Score Panel */}
        <div style={{ background: BT.bgCard, borderRadius: 10, border: `1px solid ${BT.border}`, padding: '18px 20px' }}>
          {jediScore ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <JEDIScoreGauge score={jediScore.score} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: jediScore.score >= 85 ? BT.greenL : jediScore.score >= 70 ? BT.amberL : jediScore.score >= 55 ? BT.tm : BT.redL, ...bSans }}>
                  {jediScore.verdict}
                </span>
                {jediScore.delta30d !== 0 && (
                  <span style={{ fontSize: 10, color: jediScore.delta30d > 0 ? BT.greenL : BT.redL, background: jediScore.delta30d > 0 ? BT.greenBg : BT.redBg, border: `1px solid ${jediScore.delta30d > 0 ? BT.green : BT.red}30`, borderRadius: 4, padding: '2px 7px', ...bMono }}>
                    {jediScore.delta30d > 0 ? '+' : ''}{jediScore.delta30d} pts (30d)
                  </span>
                )}
              </div>
              <p style={{ fontSize: 10, color: BT.td, marginBottom: 12, ...bSans }}>
                Confidence: {jediScore.confidenceLabel} ({jediScore.confidence}%)
              </p>

              {signals.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, ...bMono }}>5 MASTER SIGNALS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {signals.map((s) => {
                    const sc = s.score >= 80 ? BT.greenL : s.score >= 60 ? BT.amberL : BT.redL;
                    const tc = s.trendDelta > 0 ? BT.greenL : s.trendDelta < 0 ? BT.redL : BT.td;
                    return (
                      <button key={s.id} onClick={() => navigateToTab(s.moduleLink)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 8, color: BT.td, width: 72, textAlign: 'left', ...bMono }}>
                            {s.name.toUpperCase()} <span style={{ color: BT.borderX }}>({s.weight}%)</span>
                          </span>
                          <div style={{ flex: 1, height: 5, background: BT.border, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${s.score}%`, background: sc, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sc, width: 22, textAlign: 'right', ...bMono }}>{s.score}</span>
                          <span style={{ fontSize: 9, color: tc, width: 22, textAlign: 'right', ...bMono }}>
                            {s.trendDelta > 0 ? `+${s.trendDelta}` : s.trendDelta < 0 ? `${s.trendDelta}` : '—'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              ) : (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, ...bMono }}>5 MASTER SIGNALS</div>
                <p style={{ fontSize: 10, color: BT.td, ...bSans }}>Signal breakdown not yet available. Run analysis to populate.</p>
              </div>
              )}
            </div>
          </div>
          ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: BT.td, marginBottom: 6, ...bMono }}>—</div>
              <div style={{ fontSize: 8, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, ...bMono }}>JEDI SCORE</div>
              <p style={{ fontSize: 10, color: BT.td, ...bSans }}>Score will populate after analysis completes</p>
            </div>
          </div>
          )}
        </div>

        {/* Strategy Verdict Panel */}
        <div style={{ background: BT.bgCard, borderRadius: 10, border: `1px solid ${BT.border}`, padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>STRATEGY VERDICT</div>
          {strategyVerdict ? (
          <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: BT.text, ...bSans }}>{strategyVerdict.recommendedLabel}</span>
            {strategyVerdict.score > 0 && <span style={{ fontSize: 12, color: BT.amberL, ...bMono }}>{strategyVerdict.score}</span>}
          </div>
          {strategyVerdict.secondBestLabel ? (
          <div style={{ fontSize: 10, color: BT.td, marginBottom: 8, ...bSans }}>
            vs {strategyVerdict.secondBestLabel}: {strategyVerdict.secondBestScore}
          </div>
          ) : (
          <div style={{ fontSize: 10, color: BT.td, marginBottom: 8, ...bSans }}>{strategyVerdict.insight}</div>
          )}

          {strategyVerdict.isArbitrage && (
            <div style={{ background: BT.amberBg, border: `1px solid ${BT.amber}30`, borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 8, fontWeight: 700, color: BT.amber, letterSpacing: 1, ...bMono }}>ARBITRAGE</span>
                <span style={{ fontSize: 10, color: BT.amberL, ...bMono }}>+{strategyVerdict.arbitrageGap}pt gap</span>
              </div>
              <p style={{ fontSize: 9, color: BT.amberL, lineHeight: 1.5, margin: 0, ...bSans }}>{strategyVerdict.insight}</p>
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${BT.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 10, color: BT.td, ...bSans }}>
              {strategyVerdict.roiLabel}: <span style={{ fontWeight: 700, color: BT.amberL }}>{strategyVerdict.roiEstimate}</span>
            </div>
            <button style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, background: 'none', border: 'none', cursor: 'pointer', ...bMono }}
              onClick={() => navigateToTab('strategy')}>
              Compare All →
            </button>
          </div>
          </>
          ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: 10, color: BT.td, marginBottom: 8, ...bSans }}>Analysis in progress...</p>
            <button style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, background: 'none', border: 'none', cursor: 'pointer', ...bMono }}
              onClick={() => navigateToTab('strategy')}>
              View Strategy Tab →
            </button>
          </div>
          )}

          {ddTotal > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${BT.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, ...bMono }}>
                <span>DUE DILIGENCE</span>
                <span style={{ color: ddDone === ddTotal ? BT.greenL : BT.amberL }}>{ddDone}/{ddTotal}</span>
              </div>
              <div style={{ height: 4, background: BT.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(ddDone / ddTotal) * 100}%`, background: ddDone === ddTotal ? BT.green : BT.amber, borderRadius: 2, transition: 'all 0.3s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {riskAlert?.show && (() => {
        const alertColor = riskAlert.severity === 'high' ? BT.redL : riskAlert.severity === 'medium' ? BT.amberL : BT.tm;
        const alertBg = riskAlert.severity === 'high' ? BT.redBg : riskAlert.severity === 'medium' ? BT.amberBg : BT.bgPanel;
        const alertBorder = riskAlert.severity === 'high' ? BT.red : riskAlert.severity === 'medium' ? BT.amber : BT.border;
        return (
          <div style={{ background: alertBg, border: `1px solid ${alertBorder}30`, borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: alertColor, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>
                {riskAlert.severity === 'high' ? 'HIGH RISK' : 'RISK ALERT'} · {riskAlert.category} {riskAlert.score}/{riskAlert.maxScore}
              </div>
              <p style={{ fontSize: 11, color: alertColor, margin: 0, ...bSans }}>{riskAlert.detail}</p>
              {riskAlert.mitigationAvailable && (
                <p style={{ fontSize: 9, color: BT.td, marginTop: 3, ...bSans }}>Offset: {riskAlert.mitigationText}</p>
              )}
            </div>
            <button style={{ fontSize: 9, fontWeight: 700, color: alertColor, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 16, ...bMono }}
              onClick={() => navigateToTab('risk-management')}>
              Risk Dashboard →
            </button>
          </div>
        );
      })()}
    </div>
  );
};

interface ExistingOverviewProps {
  deal: any;
  navigateToTab: (tab: string) => void;
  capitalStructure?: any;
  financial?: any;
  market?: any;
  capitalStackData?: any;
  marketCapRate?: number | null;
  computedReturns?: any;
}

const ExistingOverview: React.FC<ExistingOverviewProps> = ({ deal, navigateToTab, capitalStructure, financial, market, capitalStackData, marketCapRate, computedReturns }) => {
  const price = deal.purchasePrice ? `$${(deal.purchasePrice / 1_000_000).toFixed(1)}M` : deal.budget ? `$${(deal.budget / 1_000_000).toFixed(1)}M` : '—';
  const units = deal.units || deal.targetUnits || 0;
  const ppu = units > 0 && deal.purchasePrice ? `$${Math.round(deal.purchasePrice / units).toLocaleString()}` : '—';
  const capRate = deal.capRate ? `${deal.capRate}%` : deal.strategyDefaults?.assumptions?.capRate ? `${deal.strategyDefaults.assumptions.capRate}%` : '—';
  const occ = market?.occupancy ? `${market.occupancy}%` : deal.occupancy ? `${deal.occupancy}%` : '—';
  const noiValue = financial?.noi ? `$${financial.noi.toLocaleString()}` : '—';
  const dscrValue = capitalStructure?.dscr ? `${capitalStructure.dscr.toFixed(2)}x` : '—';
  const dscrColor = capitalStructure?.dscr && capitalStructure.dscr >= 1.25 ? 'text-emerald-600' : capitalStructure?.dscr ? 'text-orange-500' : 'text-stone-400';
  const yocValue = financial?.noi && financial?.totalDevelopmentCost
    ? `${((financial.noi / financial.totalDevelopmentCost) * 100).toFixed(1)}%`
    : '—';
  const effectiveRent = market?.avgRent ? `$${Math.round(market.avgRent).toLocaleString()}` : deal.rentPerSf ? `$${deal.rentPerSf}/sf` : '—';
  const expenseRatio = financial?.noi && deal.purchasePrice
    ? `${(((deal.purchasePrice * (parseFloat(capRate) / 100 || 0.05) - financial.noi) / (deal.purchasePrice * (parseFloat(capRate) / 100 || 0.05))) * 100).toFixed(0)}%`
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead
        title="Acquisition Metrics"
        right={`${deal.propertyTypeKey || 'Multifamily'} · ${units > 0 ? `${units}u` : '—'} · ${deal.address ? deal.address.split(',')[1]?.trim() || '' : ''}`}
        accent={BT.cyan}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, background: BT.border }}>
        <KVCard label="Ask Price" value={price} />
        <KVCard label="Price / Unit" value={ppu} note={units > 0 ? `${units} units` : undefined} />
        <KVCard label="Cap Rate (Going-In)" value={capRate} note="Market: —" />
        <KVCard label="DSCR" value={dscrValue} note="Min: 1.25x" />
        <KVCard label="Yield on Cost" value={yocValue} note="BTS scenario" />
        <KVCard label="Days in Pipeline" value={deal.daysInStage ? `${deal.daysInStage}d` : deal.daysInStation ? `${deal.daysInStation}d` : '—'} note={deal.state || deal.stage || ''} />
      </div>

      <SectionHead title="Operating Intelligence" right="M05 Market · M09 ProForma" accent={BT.green} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT.border }}>
        <div style={{ background: BT.bgCard, padding: '14px 16px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>OCCUPANCY & RENT</div>
          {[
            { l: 'Physical Occupancy', v: occ, c: BT.greenL },
            { l: 'Economic Occupancy', v: occ !== '—' ? occ : '—', c: BT.greenL },
            { l: 'Effective Rent / Unit', v: effectiveRent, c: BT.amberL },
            { l: 'Submarket Market Rent', v: market?.avgRent ? `$${Math.round(market.avgRent * 1.03).toLocaleString()}` : '—', c: BT.tm },
            { l: 'Rent vs Market', v: market?.avgRent ? `${((market.avgRent / (market.avgRent * 1.03) - 1) * 100).toFixed(1)}%` : '—', c: BT.orangeL, note: market?.avgRent ? 'Upside capture opportunity' : undefined },
            { l: 'Expense Ratio', v: expenseRatio, c: BT.tm },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${BT.border}` }}>
              <span style={{ fontSize: 11, color: BT.tm, ...bSans }}>{r.l}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.c, ...bMono }}>{r.v}</span>
                {r.note && <div style={{ fontSize: 9, color: BT.td, ...bSans }}>{r.note}</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: BT.bgCard, padding: '14px 16px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>NOI INTELLIGENCE</div>
          <div style={{ background: BT.orangeBg, border: `1px solid ${BT.orange}30`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: BT.orangeL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, ...bMono }}>PLATFORM ADJUSTMENT ACTIVE</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: BT.td, ...bSans }}>Broker NOI</span>
              <span style={{ fontSize: 11, color: BT.td, textDecoration: 'line-through', ...bMono }}>{noiValue !== '—' ? noiValue : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: BT.tm, ...bSans }}>Platform NOI</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: BT.amberL, ...bMono }}>{noiValue}</span>
            </div>
            <div style={{ fontSize: 9, color: BT.td, paddingTop: 8, borderTop: `1px solid ${BT.orange}20`, ...bSans }}>
              {noiValue !== '—' ? 'Platform adjustments applied to broker underwriting' : 'Upload an OM to see NOI adjustments'}
            </div>
          </div>
          {(() => {
            const mktCap = typeof marketCapRate === 'number' && !isNaN(marketCapRate) ? `${marketCapRate.toFixed(1)}%` : '—';
            const impliedVal = marketCapRate && financial?.noi 
              ? `$${(financial.noi / (marketCapRate / 100) / 1_000_000).toFixed(1)}M` 
              : '—';
            const impliedVsAsk = marketCapRate && financial?.noi && deal.purchasePrice
              ? `${(((financial.noi / (marketCapRate / 100)) / deal.purchasePrice - 1) * 100).toFixed(1)}% vs ask`
              : undefined;
            return [
              { l: 'Going-In Cap Rate', v: capRate, c: BT.amberL },
              { l: 'Market Cap Rate', v: mktCap, c: BT.tm },
              { l: 'Implied Value at Mkt Cap', v: impliedVal, c: BT.greenL, note: impliedVsAsk },
            ];
          })().map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${BT.border}` }}>
              <span style={{ fontSize: 11, color: BT.tm, ...bSans }}>{r.l}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.c, ...bMono }}>{r.v}</span>
                {r.note && <div style={{ fontSize: 9, color: BT.greenL, ...bSans }}>{r.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionHead title="Capital Structure" right="M11 · Exit target" accent={BT.violet} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: BT.border }}>
        {(() => {
          const stack = capitalStackData?.stack || capitalStackData?.layers || [];
          const senior = stack.find?.((l: any) => l.type === 'senior_debt' || l.name?.toLowerCase().includes('senior'));
          const mezz = stack.find?.((l: any) => l.type === 'mezzanine' || l.name?.toLowerCase().includes('mezz'));
          const equity = stack.find?.((l: any) => l.type === 'equity' || l.name?.toLowerCase().includes('equity'));
          return [
            { tier: 'Senior Debt', tc: BT.blueL, border: BT.blue,
              amt: senior?.amount ? `$${(senior.amount / 1_000_000).toFixed(1)}M` : capitalStructure?.loanBalance?.[0] ? `$${(capitalStructure.loanBalance[0] / 1_000_000).toFixed(1)}M` : '—',
              ltc: senior?.ltc ? `${senior.ltc}%` : capitalStructure?.ltc ? `${capitalStructure.ltc}%` : '—',
              rate: senior?.rate ? `${senior.rate}%` : capitalStructure?.interestRate ? `${capitalStructure.interestRate}%` : '—' },
            { tier: 'Mezzanine', tc: BT.cyanL, border: BT.cyan,
              amt: mezz?.amount ? `$${(mezz.amount / 1_000_000).toFixed(1)}M` : '—',
              ltc: mezz?.ltc ? `${mezz.ltc}%` : '—', rate: mezz?.rate ? `${mezz.rate}%` : '—' },
            { tier: 'Equity', tc: BT.greenL, border: BT.green,
              amt: equity?.amount ? `$${(equity.amount / 1_000_000).toFixed(1)}M` : capitalStructure?.totalEquity ? `$${(capitalStructure.totalEquity / 1_000_000).toFixed(1)}M` : '—',
              ltc: equity?.ltc ? `${equity.ltc}%` : capitalStructure?.ltc ? `${100 - capitalStructure.ltc}%` : '—',
              rate: equity?.targetReturn ? `${equity.targetReturn}%` : '—' },
          ];
        })().map((t, i) => (
          <div key={i} style={{ background: BT.bgCard, padding: '12px 14px', borderTop: `3px solid ${t.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: t.tc, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, ...bMono }}>
              {t.tier} <span style={{ color: BT.td, fontWeight: 400 }}>({t.ltc} LTC)</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: BT.text, marginBottom: 4, ...bMono }}>{t.amt}</div>
            <div style={{ fontSize: 9, color: BT.td, ...bMono }}>{t.rate}</div>
          </div>
        ))}
      </div>

      {/* Underwriting Comparison — Broker · Platform · User */}
      {(() => {
        // Layer 1 — Broker: raw deal fields from the OM/listing
        const brokerCapRateNum = deal.capRate ? parseFloat(String(deal.capRate)) : deal.deal_data?.broker_cap_rate ?? null;
        const brokerNOI = deal.deal_data?.noi ?? deal.noi ?? null;
        const brokerPrice = deal.purchasePrice ?? deal.deal_data?.asking_price ?? null;
        const brokerCapRateStr = brokerCapRateNum ? `${brokerCapRateNum.toFixed(2)}%` : null;
        // Layer 2 — Platform: computed/assumed values from the analysis engine
        const platCapRate = (marketCapRate && !isNaN(marketCapRate)) ? `${marketCapRate.toFixed(2)}%` : null;
        const platNOI = financial?.noi ? `$${Math.round(financial.noi).toLocaleString()}` : null;
        const platDscr = capitalStructure?.dscr ? `${capitalStructure.dscr.toFixed(2)}x` : null;
        const platPrice = computedReturns?.purchasePrice ?? null;
        // Layer 3 — User: user-editable overrides from strategyDefaults/assumptions
        const userCapRate = deal.strategyDefaults?.assumptions?.capRate ? `${parseFloat(String(deal.strategyDefaults.assumptions.capRate)).toFixed(2)}%` : null;
        const userNOI = deal.strategyDefaults?.assumptions?.noi ? `$${Math.round(deal.strategyDefaults.assumptions.noi).toLocaleString()}` : null;
        const uwRows = [
          { label: 'Purchase Price', broker: brokerPrice ? `$${(brokerPrice / 1_000_000).toFixed(1)}M` : null, platform: platPrice ? `$${(platPrice / 1_000_000).toFixed(1)}M` : null, user: null },
          { label: 'Going-In Cap Rate', broker: brokerCapRateStr, platform: platCapRate, user: userCapRate },
          { label: 'NOI (T-12)', broker: brokerNOI ? `$${Math.round(brokerNOI).toLocaleString()}` : null, platform: platNOI, user: userNOI },
          { label: 'Price / Unit', broker: ppu !== '—' ? ppu : null, platform: null, user: null },
          { label: 'DSCR', broker: null, platform: platDscr, user: null },
        ].filter(r => r.broker || r.platform || r.user);
        if (uwRows.length === 0) return null;
        return (
          <>
            <SectionHead title="Underwriting Comparison" right="Broker · Platform · User" accent={BT.violet} />
            <UnderwritingComparison rows={uwRows} />
          </>
        );
      })()}

      <SectionHead title="Due Diligence + Module Access" accent={BT.amber} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT.border }}>
        <div style={{ background: BT.bgCard, padding: '14px 16px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>DD CHECKLIST</div>
          {deal?.stateData?.ddItems && deal.stateData.ddItems.length > 0 ? (
            deal.stateData.ddItems.map((item: any, i: number) => (
              <DDItem key={i} label={item.l} done={item.done} />
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: 11, color: BT.td, marginBottom: 6, ...bSans }}>No checklist items added yet</p>
              <button onClick={() => navigateToTab('due-diligence')} style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, background: 'none', border: 'none', cursor: 'pointer', ...bMono }}>
                Add DD Items →
              </button>
            </div>
          )}
        </div>
        <div style={{ background: BT.bgCard, padding: '14px 16px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>MODULE ACCESS</div>
          {[
            { key: 'F2', label: 'PROPERTY & ZONING', hint: 'Parcels · Entitlement · Setbacks', tab: 'zoning' },
            { key: 'F3', label: 'MARKET & DEMAND', hint: 'Trade area · Absorption · Rents', tab: 'market-intelligence' },
            { key: 'F4', label: 'SUPPLY PIPELINE', hint: 'Pipeline · Threat level · Capacity', tab: 'supply' },
            { key: 'F6', label: 'PRO FORMA', hint: '3-layer NOI model · Sensitivity', tab: 'proforma' },
            { key: 'F7', label: 'CAPITAL STRUCTURE', hint: 'Debt · Equity waterfall', tab: 'debt' },
            { key: 'F8', label: 'RISK ASSESSMENT', hint: 'Monte Carlo · Insurance · Supply', tab: 'risk-management' },
            { key: 'F9', label: 'SALE COMPS', hint: 'Transaction intelligence', tab: 'comps' },
          ].map((m, i) => (
            <button key={i} onClick={() => navigateToTab(m.tab)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', background: 'none', border: 'none', borderBottom: `1px solid ${BT.border}`, cursor: 'pointer', textAlign: 'left' } satisfies React.CSSProperties}>
              <span style={{ fontSize: 8, fontWeight: 700, color: BT.amberL, background: BT.amberBg, border: `1px solid ${BT.amber}40`, borderRadius: 3, padding: '2px 5px', flexShrink: 0, ...bMono }}>{m.key}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: BT.tm, ...bSans }}>{m.label}</div>
                <div style={{ fontSize: 9, color: BT.td, ...bSans }}>{m.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface DevOverviewProps {
  deal: any;
  navigateToTab: (tab: string) => void;
  financial?: any;
  design3D?: any;
  activeScenario?: any;
  zoningProfile?: any;
  entitlements?: any[];
  entitlementBenchmarks?: any;
}

const DevOverview: React.FC<DevOverviewProps> = ({ deal, navigateToTab, financial, design3D, activeScenario, zoningProfile, entitlements = [], entitlementBenchmarks }) => {
  const { siteData, canonicalData, assumptions, computedReturns } = useDealModule();
  const zoningStore = useZoningModuleStore();
  const { comps: unitMixComps, program: unitMixProgram, zoning: unitMixZoning, loading: unitMixLoading } = useUnitMixIntelligence(deal?.id, deal?.tradeAreaId);

  const zoningMaxUnits = activeScenario?.maxUnits || unitMixZoning?.maxUnits || zoningStore.selected_path_data?.maxUnits || null;
  const zoningFar = activeScenario?.appliedFar || zoningProfile?.appliedFar || zoningStore.selected_path_data?.appliedFar || null;

  const maxUnits = zoningMaxUnits || deal.targetUnits || 0;
  const lotSizeAcres = siteData?.lotSizeAcres ?? canonicalData?.computed?.lotSizeAcres;
  const lotSize = lotSizeAcres ? `${lotSizeAcres.toFixed(2)} ac` : '—';
  const landCost = financial?.landCost
    ? `$${(financial.landCost / 1_000_000).toFixed(1)}M`
    : deal.purchasePrice ? `$${(deal.purchasePrice / 1_000_000).toFixed(1)}M` : '—';
  const farValue = zoningFar ? zoningFar.toFixed(1) : '—';

  // Building configuration from Dev Capacity Builder + 3D Module + API Assumptions
  const buildingConfig = {
    // From activeScenario (Development Capacity Builder) or API assumptions
    label: activeScenario?.name || zoningStore.selected_path_data?.name || 'Selected Configuration',
    units: assumptions?.totalUnits || activeScenario?.maxUnits || design3D?.totalUnits || maxUnits,
    floors: assumptions?.stories || activeScenario?.maxStories || design3D?.floors || zoningStore.selected_path_data?.maxStories || 6,
    height: assumptions?.stories ? `${Math.round(assumptions.stories * 11)} ft` : activeScenario?.maxStories ? `${Math.round(activeScenario.maxStories * 11)} ft` : design3D?.floors ? `${Math.round(design3D.floors * 11)} ft` : '63 ft',
    parking: activeScenario?.parkingRequired ? `${activeScenario.parkingRequired} spaces` : 'TBD',
    parkingSpaces: activeScenario?.parkingRequired || design3D?.parkingSpaces || Math.round(maxUnits * 1.5),
    constructionType: assumptions?.constructionType || (activeScenario?.maxStories && activeScenario.maxStories <= 4 ? 'Wood frame' : activeScenario?.maxStories && activeScenario.maxStories <= 6 ? 'Wood over podium' : 'Concrete'),
    // Financial metrics - prefer API computed returns
    tdc: computedReturns?.tdc 
      ? `$${(computedReturns.tdc / 1_000_000).toFixed(1)}M` 
      : assumptions?.tdc 
        ? `$${(assumptions.tdc / 1_000_000).toFixed(1)}M`
        : financial?.totalDevelopmentCost 
          ? `$${(financial.totalDevelopmentCost / 1_000_000).toFixed(1)}M` 
          : '—',
    tdcUnit: computedReturns?.tdcPerUnit 
      ? `$${Math.round(computedReturns.tdcPerUnit).toLocaleString()}`
      : assumptions?.tdcPerUnit
        ? `$${Math.round(assumptions.tdcPerUnit).toLocaleString()}`
        : financial?.totalDevelopmentCost && maxUnits
          ? `$${Math.round(financial.totalDevelopmentCost / maxUnits).toLocaleString()}`
          : '—',
    btsIrr: computedReturns?.irrLevered 
      ? `${(computedReturns.irrLevered * 100).toFixed(1)}%` 
      : assumptions?.irrLevered 
        ? `${(assumptions.irrLevered * 100).toFixed(1)}%`
        : financial?.irr 
          ? `${financial.irr.toFixed(1)}%` 
          : '—',
    btsEm: computedReturns?.equityMultiple 
      ? `${computedReturns.equityMultiple.toFixed(2)}x` 
      : assumptions?.equityMultiple 
        ? `${assumptions.equityMultiple.toFixed(2)}x`
        : financial?.equityMultiple 
          ? `${financial.equityMultiple.toFixed(2)}x` 
          : '—',
    yoc: computedReturns?.yieldOnCost 
      ? `${(computedReturns.yieldOnCost * 100).toFixed(1)}%` 
      : assumptions?.yieldOnCost 
        ? `${(assumptions.yieldOnCost * 100).toFixed(1)}%`
        : financial?.yieldOnCost 
          ? `${financial.yieldOnCost.toFixed(1)}%` 
          : '—',
    // 3D Design recommendations
    design3DStatus: design3D ? 'configured' : 'pending',
    grossSqft: assumptions?.grossSf || design3D?.grossSqft || activeScenario?.grossSqft || null,
    efficiency: assumptions?.efficiency || design3D?.efficiency || activeScenario?.efficiency || null,
    // Land cost from assumptions
    landCost: assumptions?.landCost 
      ? `$${(assumptions.landCost / 1_000_000).toFixed(1)}M`
      : landCost,
    // Rent from assumptions
    avgRent: assumptions?.avgRentPerUnit 
      ? `$${assumptions.avgRentPerUnit.toLocaleString()}/mo`
      : '—',
  };

  const unitMix = (() => {
    const colors: Record<string, { color: string; bg: string }> = {
      studio: { color: 'text-violet-600', bg: 'bg-violet-500' },
      oneBR: { color: 'text-cyan-600', bg: 'bg-cyan-500' },
      twoBR: { color: 'text-emerald-600', bg: 'bg-emerald-500' },
      threeBR: { color: 'text-orange-600', bg: 'bg-orange-500' },
    };
    const labels: Record<string, string> = { studio: 'Studio', oneBR: '1 BR', twoBR: '2 BR', threeBR: '3 BR' };

    if (unitMixProgram?.units && Object.keys(unitMixProgram.units).length > 0) {
      const totalU = unitMixProgram.totalUnits || buildingConfig.units;
      return Object.entries(unitMixProgram.units).map(([key, u]) => {
        const pctNum = Math.round((u.mix || 0) * 100);
        const unitCount = Math.round(totalU * (u.mix || 0));
        const psf = u.sf > 0 ? u.rent / u.sf : 0;
        return {
          type: labels[key] || key,
          units: unitCount,
          pct: `${pctNum}%`,
          sqft: Math.round(u.sf),
          targetRent: Math.round(u.rent),
          rentPsf: parseFloat(psf.toFixed(2)),
          ...(colors[key] || { color: 'text-stone-600', bg: 'bg-stone-500' }),
        };
      });
    }

    if (design3D?.unitMix) {
      const dm = design3D.unitMix;
      const totalU = design3D.totalUnits || buildingConfig.units;
      const entries = [
        { key: 'studio', count: dm.studio, sf: 548, rent: 1595 },
        { key: 'oneBR', count: dm.oneBed, sf: 768, rent: 1875 },
        { key: 'twoBR', count: dm.twoBed, sf: 1082, rent: 2295 },
        { key: 'threeBR', count: dm.threeBed, sf: 1344, rent: 2695 },
      ].filter(e => e.count > 0);
      if (entries.length > 0) {
        return entries.map(e => ({
          type: labels[e.key],
          units: e.count,
          pct: `${Math.round((e.count / totalU) * 100)}%`,
          sqft: e.sf,
          targetRent: e.rent,
          rentPsf: parseFloat((e.rent / e.sf).toFixed(2)),
          ...(colors[e.key] || { color: 'text-stone-600', bg: 'bg-stone-500' }),
        }));
      }
    }

    return [];
  })();

  const totalUnitCount = unitMix.reduce((a, u) => a + u.units, 0) || 1;
  const totalRevMo = unitMix.reduce((a, u) => a + u.targetRent * u.units, 0);
  const avgSqft = Math.round(unitMix.reduce((a, u) => a + u.sqft * u.units, 0) / totalUnitCount);
  const avgRent = Math.round(totalRevMo / totalUnitCount);
  const avgPsf = (unitMix.reduce((a, u) => a + u.rentPsf * u.units, 0) / totalUnitCount).toFixed(2);

  const allEntitlements = entitlements.length > 0 ? entitlements : (zoningStore.entitlements || []);
  const hasEntitlements = allEntitlements.length > 0;
  const entitlementSteps = (() => {
    const steps = [
      { n: 'Pre-Application', key: 'pre_application' },
      { n: 'Application Filed', key: 'submitted' },
      { n: 'Staff Review', key: 'under_review' },
      { n: 'Public Hearing', key: 'hearing' },
      { n: 'Approved', key: 'approved' },
    ];
    if (hasEntitlements) {
      const latestStatus = allEntitlements[0]?.status || 'pre_application';
      const statusOrder = ['pre_application', 'submitted', 'under_review', 'hearing', 'approved'];
      const activeIdx = statusOrder.indexOf(latestStatus);
      return steps.map((s, i) => ({
        n: s.n,
        done: i < activeIdx || (i === activeIdx && latestStatus === 'approved'),
        active: i === activeIdx && latestStatus !== 'approved',
      }));
    }
    return steps.map((s) => ({
      n: s.n,
      done: false,
      active: false,
    }));
  })();

  const entitlementDur = entitlementBenchmarks?.p50 || 0;
  const constructionDur = assumptions?.constructionMonths || deal.strategyDefaults?.assumptions?.constructionMonths || 0;
  const permitDur = entitlementDur > 0 ? Math.max(2, Math.round(entitlementDur * 0.3)) : 0;
  const absorptionDur = assumptions?.absorptionMonths || deal.strategyDefaults?.assumptions?.absorptionMonths || 0;
  const hasTimelineData = entitlementDur > 0 || constructionDur > 0;

  const timeline = hasTimelineData ? [
    { phase: 'LOI / Contract', start: 0, dur: 2, status: hasEntitlements ? 'done' as const : 'active' as const },
    { phase: 'Entitlement', start: 2, dur: entitlementDur, status: 'pending' as const },
    { phase: 'Permits + GMP', start: 2 + entitlementDur, dur: permitDur, status: 'pending' as const },
    { phase: 'Construction', start: 2 + entitlementDur + permitDur, dur: constructionDur, status: 'pending' as const },
    { phase: 'Absorption / Sale', start: 2 + entitlementDur + permitDur + constructionDur, dur: absorptionDur, status: 'pending' as const },
  ] : [];
  const TOTAL_MO = hasTimelineData ? timeline[timeline.length - 1].start + timeline[timeline.length - 1].dur : 1;

  const rentComps = (() => {
    if (unitMixComps && unitMixComps.length > 0) {
      return unitMixComps.slice(0, 5).map((comp: CompProperty, idx: number) => {
        const mix: Record<string, { rent: number; sqft: number }> = {};
        const typeMap: Record<string, string> = { studio: 'Studio', oneBR: '1 BR', twoBR: '2 BR', threeBR: '3 BR' };
        Object.entries(comp.units || {}).forEach(([key, u]) => {
          const label = typeMap[key] || key;
          mix[label] = { rent: Math.round(u.rent), sqft: Math.round(u.sf) };
        });
        return {
          name: comp.name || `Comp ${String.fromCharCode(65 + idx)}`,
          dist: '—',
          units: comp.total || 0,
          vintage: comp.built || 0,
          occ: '—',
          mix,
          note: `Class ${comp.cls || '—'} · ${comp.built || '—'}`,
        };
      });
    }
    return [];
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <SectionHead
        title="Site + Zoning Constraints"
        right={`${lotSize} · ${deal.address ? deal.address.split(',').slice(1, 3).join(',').trim() : ''}`}
        accent={BT.cyanL}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, background: BT.border }}>
        <KVCard label="Max Units (Zoned)" value={maxUnits > 0 ? `${maxUnits}u` : '—'} valueColor="text-cyan-600" note={`${lotSize}`} compact />
        <KVCard label="FAR" value={farValue} note={maxUnits > 0 && activeScenario?.parkingRequired ? `Parking: ${(activeScenario.parkingRequired / maxUnits).toFixed(1)} / unit` : undefined} compact />
        <KVCard label="Entitlement ETA" value={entitlementBenchmarks?.p50 ? `${entitlementBenchmarks.p50}-${entitlementBenchmarks.p75 || entitlementBenchmarks.p50 + 2} mo` : '—'} valueColor="text-amber-600" note={entitlementBenchmarks?.p50 ? `Based on ${entitlementBenchmarks.municipality || 'local'} benchmarks` : 'No benchmark data'} compact />
        <KVCard label="Target IRR (BTS)" value={buildingConfig.btsIrr} valueColor="text-emerald-600" note={`${buildingConfig.btsEm} equity multiple`} noteColor="text-emerald-500" compact />
        <KVCard label="TDC / Unit" value={buildingConfig.tdcUnit} note={`${buildingConfig.units} planned units`} compact />
        <KVCard label="Zoning" value={zoningProfile?.baseDistrictCode || '—'} valueColor="text-stone-700" compact />
      </div>

      <SectionHead title="Entitlement Pipeline" right="M02 Zoning Intelligence" accent={BT.amber} />
      <div style={{ background: BT.bgCard, padding: '16px 20px' }}>
        {hasEntitlements ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 14, left: '10%', right: '10%', height: 1, background: BT.border, zIndex: 0 }} />
          {entitlementSteps.map((step, i) => {
            const dotColor = step.done ? BT.greenL : step.active ? BT.amber : BT.border;
            const textColor = step.done ? BT.greenL : step.active ? BT.amber : BT.td;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${dotColor}`, background: step.done ? `${BT.green}20` : step.active ? `${BT.amber}20` : BT.bgPanel, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: step.active ? `0 0 8px ${BT.amber}60` : 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: textColor, ...bMono }}>{step.done ? '✓' : i + 1}</span>
                </div>
                <div style={{ fontSize: 8, marginTop: 6, textAlign: 'center', lineHeight: 1.3, maxWidth: 70, color: textColor, fontWeight: 600, ...bSans }}>{step.n}</div>
              </div>
            );
          })}
        </div>
        ) : (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            {entitlementSteps.map((step, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${BT.border}`, background: BT.bgPanel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: BT.td, ...bMono }}>{i + 1}</span>
                </div>
                <div style={{ fontSize: 8, marginTop: 4, color: BT.td, fontWeight: 500, ...bSans }}>{step.n}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: BT.td, marginBottom: 6, ...bSans }}>No entitlements filed yet</p>
          <button onClick={() => navigateToTab('zoning')} style={{ fontSize: 10, color: BT.amber, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, ...bSans }}>
            Start Entitlement Process →
          </button>
        </div>
        )}
      </div>

      <SectionHead 
        title="Building Configuration" 
        right={
          <button 
            onClick={() => navigateToTab('3d-design')} 
            className="text-[10px] text-violet-600 hover:text-violet-700 font-medium"
          >
            Edit in 3D Design →
          </button>
        } 
        accent={BT.violL} 
      />
      
      {/* Selected configuration from Dev Capacity + 3D Module */}
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${BT.border}`, background: BT.bgPanel }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BT.tm, ...bSans }}>{buildingConfig.label}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: BT.violL, background: `${BT.violet}25`, border: `1px solid ${BT.violet}50`, borderRadius: 3, padding: '2px 6px', letterSpacing: 1, ...bMono }}>
              {buildingConfig.units} UNITS
            </span>
          </div>
          {buildingConfig.design3DStatus === 'configured' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 600, color: BT.greenL, ...bSans }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BT.greenL }} />
              3D Design Configured
            </span>
          ) : (
            <button onClick={() => navigateToTab('3d-design')} style={{ fontSize: 9, fontWeight: 600, color: BT.amber, background: 'none', border: 'none', cursor: 'pointer', ...bSans }}>
              Configure 3D Design →
            </button>
          )}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BT.border }}>
          {[
            { l: 'Floors', v: `${buildingConfig.floors} stories`, c: BT.tm },
            { l: 'Height', v: buildingConfig.height, c: BT.tm },
            { l: 'Construction', v: buildingConfig.constructionType, c: BT.ts, small: true },
            { l: 'Parking', v: `${buildingConfig.parkingSpaces} spaces`, c: BT.ts },
          ].map((m, i) => (
            <div key={i} style={{ background: BT.bgCard, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: BT.td, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{m.l}</div>
              <div style={{ fontSize: m.small ? 11 : 13, fontWeight: 700, color: m.c, ...bSans }}>{m.v}</div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: BT.border }}>
          {[
            { l: 'Total Dev Cost', v: buildingConfig.tdc, c: BT.amber },
            { l: 'TDC / Unit', v: buildingConfig.tdcUnit, c: BT.amber },
            { l: 'BTS IRR', v: buildingConfig.btsIrr, c: BT.greenL },
            { l: 'BTS EM', v: buildingConfig.btsEm, c: BT.greenL },
          ].map((m, i) => (
            <div key={i} style={{ background: BT.bgCard, padding: '10px 12px' }}>
              <div style={{ fontSize: 8, color: BT.td, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{m.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.c, ...bMono }}>{m.v}</div>
            </div>
          ))}
        </div>
        
        {(buildingConfig.grossSqft || buildingConfig.efficiency) && (
          <div style={{ padding: '6px 14px', background: BT.bgPanel, borderTop: `1px solid ${BT.border}`, display: 'flex', alignItems: 'center', gap: 16, fontSize: 9, color: BT.td, ...bMono }}>
            {buildingConfig.grossSqft && <span>Gross SF: <strong style={{ color: BT.tm }}>{buildingConfig.grossSqft.toLocaleString()}</strong></span>}
            {buildingConfig.efficiency && <span>Efficiency: <strong style={{ color: BT.tm }}>{(buildingConfig.efficiency * 100).toFixed(0)}%</strong></span>}
          </div>
        )}
      </div>

      <SectionHead title="Unit Mix Program" right={unitMix.length > 0 ? `${buildingConfig.units} units · Based on ${buildingConfig.label}` : 'No data yet'} accent={BT.cyanL} />
      <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}` }}>
        {unitMix.length > 0 ? (
        <>
        <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border}` }}>
          {unitMix.map((u, i) => (
            <div key={i} style={{ flex: parseInt(u.pct), padding: '8px 10px', textAlign: 'center', borderRight: i < unitMix.length - 1 ? `1px solid ${BT.border}` : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: BT.cyanL, ...bSans }}>{u.type}</div>
              <div style={{ fontSize: 9, color: BT.td, ...bSans }}>{u.pct} · {u.units}u</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', height: 3 }}>
          {(() => {
            const colors = [BT.violL, BT.cyanL, BT.greenL, BT.orangeL];
            return unitMix.map((u, i) => (
              <div key={i} style={{ flex: parseInt(u.pct), background: colors[i % colors.length], opacity: 0.6 }} />
            ));
          })()}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', ...bMono }}>
            <thead>
              <tr style={{ background: BT.bgPanel, borderBottom: `1px solid ${BT.border}` }}>
                {['UNIT TYPE', 'COUNT', 'MIX %', 'AVG SQFT', 'TARGET RENT', 'RENT PSF', 'MONTHLY REV', 'ANN. REVENUE'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, color: BT.td, fontWeight: 700, letterSpacing: 1.2 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unitMix.map((u, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BT.border}`, background: i % 2 === 0 ? BT.bgCard : BT.bgPanel }}>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: BT.cyanL }}>{u.type}</td>
                  <td style={{ padding: '6px 10px', color: BT.tm }}>{u.units}</td>
                  <td style={{ padding: '6px 10px', color: BT.ts }}>{u.pct}</td>
                  <td style={{ padding: '6px 10px', color: BT.ts }}>{u.sqft.toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: BT.amber }}>${u.targetRent.toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', color: BT.ts }}>${u.rentPsf.toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: BT.tm }}>${(u.targetRent * u.units).toLocaleString()}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: BT.greenL }}>${(u.targetRent * u.units * 12).toLocaleString()}</td>
                </tr>
              ))}
              <tr style={{ background: BT.bgPanel, borderTop: `2px solid ${BT.border}`, fontWeight: 700 }}>
                <td style={{ padding: '6px 10px', color: BT.ts, fontSize: 9, letterSpacing: 1 }}>TOTAL / AVG</td>
                <td style={{ padding: '6px 10px', color: BT.tm }}>{totalUnitCount}</td>
                <td style={{ padding: '6px 10px', color: BT.tm }}>100%</td>
                <td style={{ padding: '6px 10px', color: BT.tm }}>{avgSqft.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: BT.amber }}>${avgRent.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: BT.ts }}>${avgPsf}</td>
                <td style={{ padding: '6px 10px', color: BT.amber }}>${totalRevMo.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: BT.amber }}>${(totalRevMo * 12).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </>
        ) : (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: 11, color: BT.ts, marginBottom: 4, ...bSans }}>No unit mix data available</p>
          <p style={{ fontSize: 9, color: BT.td, marginBottom: 8, ...bSans }}>Run the Development Capacity Builder or upload a proforma to generate unit mix</p>
          <button onClick={() => navigateToTab('unit-mix-intelligence')} style={{ fontSize: 10, color: BT.cyanL, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, ...bSans }}>
            Configure Unit Mix →
          </button>
        </div>
        )}
      </div>

      {(() => {
        const subjectUnitsRaw = unitMix.reduce((s, u) => s + u.units, 0);
        const subjectTotalUnits = subjectUnitsRaw || 0;
        const denom = Math.max(subjectUnitsRaw, 1);
        const subjectWtdRent = Math.round(unitMix.reduce((s, u) => s + (Number.isFinite(u.targetRent) && u.targetRent > 0 ? u.targetRent : 0) * u.units, 0) / denom);
        const subjectWtdSf = Math.round(unitMix.reduce((s, u) => s + (Number.isFinite(u.sqft) && u.sqft > 0 ? u.sqft : 0) * u.units, 0) / denom);
        const subjectPsf = subjectWtdSf > 0 ? +(subjectWtdRent / subjectWtdSf).toFixed(2) : 0;
        const subjectOcc = '—';
        const subjectTraffic = Math.round((subjectTotalUnits / 290) * 11 * 52);

        const compRows = rentComps.map(comp => {
          const mixEntries = Object.values(comp.mix).filter(m => m && Number.isFinite(m.rent) && m.rent > 0 && Number.isFinite(m.sqft) && m.sqft > 0);
          const avgRent = mixEntries.length > 0 ? Math.round(mixEntries.reduce((s, m) => s + m.rent, 0) / mixEntries.length) : 0;
          const avgSf = mixEntries.length > 0 ? Math.round(mixEntries.reduce((s, m) => s + m.sqft, 0) / mixEntries.length) : 0;
          const psf = avgSf > 0 ? +(avgRent / avgSf).toFixed(2) : 0;
          const estTraffic = comp.units > 0 ? Math.round((comp.units / 290) * 11 * 52) : 0;
          return { name: comp.name, dist: comp.dist, units: comp.units, vintage: comp.vintage, occ: comp.occ, avgRent, avgSf, psf, note: comp.note, traffic: estTraffic, isSubject: false };
        });

        const subjectRow = { name: deal.name || 'Subject Property', dist: '—', units: subjectTotalUnits, vintage: 0, occ: subjectOcc, avgRent: subjectWtdRent, avgSf: subjectWtdSf, psf: subjectPsf, note: `${buildingConfig.label} · ${unitMix.length} unit types`, traffic: subjectTraffic, isSubject: true };

        const allRows = [subjectRow, ...compRows].sort((a, b) => b.psf - a.psf);

        const compOnlyRows = compRows.filter(c => c.avgRent > 0);
        const compAvgRent = compOnlyRows.length > 0 ? Math.round(compOnlyRows.reduce((s, c) => s + c.avgRent, 0) / compOnlyRows.length) : 0;
        const compAvgSf = compOnlyRows.length > 0 ? Math.round(compOnlyRows.reduce((s, c) => s + c.avgSf, 0) / compOnlyRows.length) : 0;
        const compAvgPsf = compAvgSf > 0 ? +(compAvgRent / compAvgSf).toFixed(2) : 0;
        const compAvgOcc = (() => {
          const valid = compOnlyRows.filter(c => c.occ !== '—');
          if (valid.length === 0) return '—';
          const avg = Math.round(valid.reduce((s, c) => s + parseFloat(c.occ), 0) / valid.length);
          return `${avg}%`;
        })();
        const compAvgUnits = compOnlyRows.length > 0 ? Math.round(compOnlyRows.reduce((s, c) => s + c.units, 0) / compOnlyRows.length) : 0;
        const compAvgTraffic = compOnlyRows.length > 0 ? Math.round(compOnlyRows.reduce((s, c) => s + c.traffic, 0) / compOnlyRows.length) : 0;

        const subjectRank = allRows.findIndex(r => r.isSubject) + 1;

        if (rentComps.length === 0 && unitMix.length === 0) {
          return (
            <>
              <SectionHead title="Competitive Set" right="No comps" accent={BT.greenL} />
              <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 10, color: BT.ts, marginBottom: 4, ...bSans }}>No rent comps data available</p>
                <p style={{ fontSize: 9, color: BT.td, marginBottom: 8, ...bSans }}>Build your competitive set from Trade Area, Submarket, and MSA comps</p>
                <button onClick={() => navigateToTab('competition')} style={{ fontSize: 10, color: BT.greenL, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, ...bSans }}>
                  Analyze Rent Comps →
                </button>
              </div>
            </>
          );
        }

        return (
          <>
            <SectionHead title="Competitive Set · Ranked by $/SF" right={`#${subjectRank} of ${allRows.length} · ${rentComps.length} comps`} accent={BT.greenL} />
            <div style={{ background: BT.bgCard, border: `1px solid ${BT.border}`, overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', ...bMono }}>
                <thead>
                  <tr style={{ background: BT.bgPanel, borderBottom: `1px solid ${BT.border}` }}>
                    {['#', 'PROPERTY', 'DIST', 'UNITS', 'AVG RENT', 'AVG SF', '$/SF', 'OCC', 'ANN. TRAFFIC'].map((h, i) => (
                      <th key={i} style={{ padding: '7px 10px', fontSize: 9, color: BT.td, fontWeight: 700, letterSpacing: 1.2, textAlign: i <= 1 ? 'left' : 'right', minWidth: i === 1 ? 160 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row, ri) => (
                    <tr key={ri} style={{
                      borderBottom: `1px solid ${BT.border}`,
                      borderLeft: row.isSubject ? `3px solid ${BT.blueL}` : undefined,
                      background: row.isSubject ? BT.blueBg : ri % 2 === 0 ? BT.bgCard : BT.bgPanel,
                    }}>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: row.isSubject ? BT.blueL : BT.td }}>{ri + 1}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: row.isSubject ? BT.blueL : BT.tm }}>{row.name}</div>
                        {row.isSubject ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: BT.blueL, background: `${BT.blue}25`, border: `1px solid ${BT.blue}50`, borderRadius: 2, padding: '1px 4px', letterSpacing: 1 }}>SUBJECT</span>
                            <span style={{ fontSize: 8, color: BT.ts }}>{row.note}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: BT.td }}>{row.units}u · {row.vintage}{row.note ? ` · ${row.note}` : ''}</div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: row.isSubject ? BT.blueL : BT.ts }}>{row.dist}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: row.isSubject ? BT.blueL : BT.tm, fontWeight: row.isSubject ? 700 : 400 }}>{row.units}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: row.isSubject ? BT.blueL : BT.amber }}>${row.avgRent.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: row.isSubject ? BT.blueL : BT.ts }}>{row.avgSf.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: row.isSubject ? BT.tm : BT.tm }}>${row.psf.toFixed(2)}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        {row.occ === '—' ? (
                          <span style={{ color: BT.td }}>—</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: parseFloat(row.occ) >= 95 ? BT.greenL : parseFloat(row.occ) >= 90 ? BT.amber : BT.orangeL }}>{row.occ}</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: row.isSubject ? BT.blueL : BT.ts }}>{row.traffic.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr style={{ background: BT.bgPanel, borderTop: `2px solid ${BT.border}`, fontWeight: 700 }}>
                    <td style={{ padding: '6px 10px' }} />
                    <td style={{ padding: '6px 10px', color: BT.ts, fontSize: 9, letterSpacing: 1 }}>COMP AVERAGE</td>
                    <td style={{ padding: '6px 10px' }} />
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>{compAvgUnits}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.amber }}>${compAvgRent.toLocaleString()}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>{compAvgSf.toLocaleString()}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>${compAvgPsf.toFixed(2)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {compAvgOcc === '—' ? <span style={{ color: BT.td }}>—</span> : <span style={{ color: BT.ts }}>{compAvgOcc}</span>}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.ts }}>{compAvgTraffic.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      <SectionHead title="Development Budget + Timeline" right={hasTimelineData ? `TDC ${buildingConfig.tdc} · ${constructionDur}mo build · ${absorptionDur}mo absorption` : `TDC ${buildingConfig.tdc}`} accent={BT.amber} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT.border }}>
        <div style={{ background: BT.bgCard, padding: 16 }}>
          <div style={{ fontSize: 9, color: BT.td, letterSpacing: 2, fontWeight: 700, marginBottom: 14, ...bMono }}>BUDGET STACK</div>
          {(() => {
            const landAmt = financial?.landCost || deal.purchasePrice || 0;
            const hardAmt = financial?.hardCosts || 0;
            const softAmt = financial?.softCosts || 0;
            const tdc = financial?.totalDevelopmentCost || (landAmt + hardAmt + softAmt) || 0;
            const contingency = tdc > 0 && hardAmt > 0 ? Math.round(tdc * 0.08) : 0;
            const hasReal = tdc > 0 && hardAmt > 0;
            const items = hasReal ? [
              { l: 'Land / Acquisition', v: `$${(landAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((landAmt / tdc) * 100), c: BT.violL },
              { l: 'Hard Costs', v: `$${(hardAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((hardAmt / tdc) * 100), c: BT.amber },
              { l: 'Soft Costs', v: `$${(softAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((softAmt / tdc) * 100), c: BT.cyanL },
              { l: 'Contingency (8%)', v: `$${(contingency / 1_000_000).toFixed(1)}M`, pct: 8, c: BT.orangeL },
            ] : [
              { l: 'Land / Acquisition', v: landCost !== '—' ? landCost : '—', pct: 25, c: BT.violL },
              { l: 'Hard Costs', v: '—', pct: 25, c: BT.amber },
              { l: 'Soft Costs', v: '—', pct: 25, c: BT.cyanL },
              { l: 'Contingency', v: '—', pct: 25, c: BT.orangeL },
            ];
            return items;
          })().map((r, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: BT.ts, ...bSans }}>{r.l}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: BT.tm, ...bMono }}>{r.v}</span>
              </div>
              <div style={{ height: 3, background: BT.bgPanel, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: r.c, width: `${r.pct}%`, opacity: 0.8 }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${BT.border}`, marginTop: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: BT.ts, letterSpacing: 1, ...bMono }}>TOTAL DEV COST</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: BT.amber, ...bMono }}>
              {financial?.totalDevelopmentCost ? `$${(financial.totalDevelopmentCost / 1_000_000).toFixed(1)}M` : buildingConfig.tdc}
            </span>
          </div>
          <div style={{ fontSize: 9, color: BT.td, marginTop: 4, ...bMono }}>{buildingConfig.tdcUnit}/unit{constructionDur > 0 ? ` · ${constructionDur}mo construction` : ''}</div>
        </div>

        <div style={{ background: BT.bgCard, padding: 16 }}>
          <div style={{ fontSize: 9, color: BT.td, letterSpacing: 2, fontWeight: 700, marginBottom: 14, ...bMono }}>DEVELOPMENT TIMELINE</div>
          {hasTimelineData ? timeline.map((ph, i) => {
            const left = (ph.start / TOTAL_MO) * 100;
            const width = (ph.dur / TOTAL_MO) * 100;
            const barColor = ph.status === 'done' ? BT.greenL : ph.status === 'active' ? BT.amber : BT.border;
            const textColor = ph.status === 'done' ? BT.greenL : ph.status === 'active' ? BT.amber : BT.td;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: BT.ts, width: 100, textAlign: 'right', flexShrink: 0, ...bSans }}>{ph.phase}</span>
                <div style={{ flex: 1, height: 16, background: BT.bgPanel, position: 'relative', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', height: '100%', background: barColor, opacity: 0.25, left: `${left}%`, width: `${width}%` }} />
                  <div style={{ position: 'absolute', height: '100%', borderLeft: `2px solid ${barColor}`, display: 'flex', alignItems: 'center', paddingLeft: 4, left: `${left}%`, width: `${width}%` }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: textColor, ...bMono }}>{ph.dur}mo</span>
                  </div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, width: 40, textAlign: 'right', color: textColor, ...bMono }}>
                  {ph.status === 'done' ? '✓' : ph.status === 'active' ? 'ACTIVE' : ''}
                </span>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <p style={{ fontSize: 10, color: BT.ts, marginBottom: 4, ...bSans }}>Timeline data not available</p>
              <p style={{ fontSize: 9, color: BT.td, ...bSans }}>Add entitlement benchmarks and deal assumptions to generate timeline</p>
            </div>
          )}
          {hasTimelineData && (
          <div style={{ display: 'flex', marginTop: 8, borderTop: `1px solid ${BT.border}`, paddingTop: 6, paddingLeft: 108, paddingRight: 48 }}>
            {[0, 6, 12, 18, 24, 30, 36, 42, 48].filter(m => m <= TOTAL_MO + 6).map(m => (
              <div key={m} style={{ flex: 1, fontSize: 8, color: BT.td, ...bMono }}>M{m}</div>
            ))}
          </div>
          )}
        </div>
      </div>

      <SectionHead title="Returns Comparison + Site Diligence" right="M09 ProForma · M11 Capital" accent={BT.amber} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: BT.border }}>
        <div style={{ background: BT.bgCard, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: '10px 12px', background: BT.amberBg, border: `1px solid ${BT.amber}40`, borderRadius: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, letterSpacing: 1, ...bMono }}>BUILD-TO-SELL</span>
                <span style={{ fontSize: 7, fontWeight: 700, color: BT.greenL, background: `${BT.green}25`, border: `1px solid ${BT.greenL}50`, padding: '1px 5px', borderRadius: 2, letterSpacing: 1 }}>WIN</span>
              </div>
              {[
                { l: 'Revenue', v: computedReturns?.totalRevenue ? `$${(computedReturns.totalRevenue / 1_000_000).toFixed(1)}M` : assumptions?.totalRevenue ? `$${(assumptions.totalRevenue / 1_000_000).toFixed(1)}M` : '—' },
                { l: 'Margin', v: computedReturns?.profitMargin ? `${(computedReturns.profitMargin * 100).toFixed(1)}%` : '—' },
                { l: 'IRR', v: financial?.irr ? `${financial.irr.toFixed(1)}%` : buildingConfig.btsIrr, c: BT.greenL },
                { l: 'EM', v: financial?.equityMultiple ? `${financial.equityMultiple.toFixed(1)}x` : buildingConfig.btsEm, c: BT.greenL },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 9, color: BT.td, ...bSans }}>{r.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ('c' in r ? r.c : undefined) || BT.amber, ...bMono }}>{r.v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 12px', background: BT.bgPanel, border: `1px solid ${BT.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: BT.ts, letterSpacing: 1, marginBottom: 10, ...bMono }}>HOLD AS RENTAL</div>
              {[
                { l: 'Stab. NOI', v: financial?.noi ? `$${financial.noi.toLocaleString()}` : computedReturns?.stabilizedNoi ? `$${computedReturns.stabilizedNoi.toLocaleString()}` : '—' },
                { l: 'YOC', v: buildingConfig.yoc || (computedReturns?.yieldOnCost ? `${(computedReturns.yieldOnCost * 100).toFixed(1)}%` : '—') },
                { l: 'Hold IRR', v: computedReturns?.irrLevered ? `${(computedReturns.irrLevered * 100).toFixed(1)}%` : assumptions?.targetIRR ? `${assumptions.targetIRR.toFixed(1)}%` : '—' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 9, color: BT.td, ...bSans }}>{r.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: BT.ts, ...bMono }}>{r.v}</span>
                </div>
              ))}
              <div style={{ fontSize: 8, color: BT.td, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BT.border}`, lineHeight: 1.5, ...bSans }}>
                BTS outperforms · Exit cap 5.0%
              </div>
            </div>
          </div>
        </div>
        <div style={{ background: BT.bgCard, padding: 14 }}>
          <div style={{ fontSize: 9, color: BT.td, letterSpacing: 2, fontWeight: 700, marginBottom: 10, ...bMono }}>SITE DILIGENCE ITEMS</div>
          {deal?.stateData?.ddItems && deal.stateData.ddItems.length > 0
            ? deal.stateData.ddItems.map((item: any, i: number) => (
                <DDItem key={i} label={item.l} done={item.done} />
              ))
            : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p style={{ fontSize: 10, color: BT.ts, marginBottom: 4, ...bSans }}>No diligence items added</p>
                <button onClick={() => navigateToTab('due-diligence')} style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, background: 'none', border: 'none', cursor: 'pointer', ...bMono }}>
                  Add Site Diligence Items →
                </button>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
