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
    { id: 'demand', name: 'Demand', color: 'bg-emerald-500', bgColor: 'bg-emerald-900/10', moduleLink: 'market' },
    { id: 'supply', name: 'Supply', color: 'bg-amber-500', bgColor: 'bg-amber-900/10', moduleLink: 'supply' },
    { id: 'momentum', name: 'Momentum', color: 'bg-blue-500', bgColor: 'bg-blue-900/10', moduleLink: 'market' },
    { id: 'position', name: 'Position', color: 'bg-violet-500', bgColor: 'bg-violet-900/10', moduleLink: 'market' },
    { id: 'risk', name: 'Risk', color: 'bg-[#4B5563]', bgColor: 'bg-[#131920]', moduleLink: 'risk' },
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
  const [viewMode, setViewMode] = useState<'existing' | 'development' | 'redevelopment'>('existing');

  const isDev = deal?.developmentType === 'Ground-Up' ||
    deal?.developmentType === 'new' ||
    deal?.developmentType === 'Redevelopment' ||
    deal?.isDevelopment === true ||
    deal?.projectType === 'land';

  const isRedevelopment = deal?.developmentType === 'Redevelopment';

  useEffect(() => {
    if (isRedevelopment) setViewMode('redevelopment');
    else setViewMode(isDev ? 'development' : 'existing');
  }, [isDev, isRedevelopment]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [deal?.id]);

  useEffect(() => {
    if (!deal?.id) return;
    loadMarketData();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [deal?.id, geographicContext]);

  const loadEntitlements = async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.entitlements.getEntitlementsByDeal(deal.id);
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
      const res = await apiClient.proforma.calculateCapitalStack({
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
      const res = await apiClient.entitlements.getBenchmarkTimeline(county, state);
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
      const response = await apiClient.jedi.getScore(deal.id);
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

      {viewMode === 'redevelopment'
        ? <RedevelopmentOverview deal={deal} navigateToTab={navigateToTab} financial={financial} capitalStructure={capitalStructure} computedReturns={computedReturns} />
        : viewMode === 'existing'
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
    <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{label}</div>
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
                <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, ...bMono }}>5 MASTER SIGNALS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {signals.map((s) => {
                    const sc = s.score >= 80 ? BT.greenL : s.score >= 60 ? BT.amberL : BT.redL;
                    const tc = s.trendDelta > 0 ? BT.greenL : s.trendDelta < 0 ? BT.redL : BT.td;
                    return (
                      <button key={s.id} onClick={() => navigateToTab(s.moduleLink)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9, color: BT.td, width: 72, textAlign: 'left', ...bMono }}>
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
                <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, ...bMono }}>5 MASTER SIGNALS</div>
                <p style={{ fontSize: 10, color: BT.td, ...bSans }}>Signal breakdown not yet available. Run analysis to populate.</p>
              </div>
              )}
            </div>
          </div>
          ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: BT.td, marginBottom: 6, ...bMono }}>—</div>
              <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, ...bMono }}>JEDI SCORE</div>
              <p style={{ fontSize: 10, color: BT.td, ...bSans }}>Score will populate after analysis completes</p>
            </div>
          </div>
          )}
        </div>

        {/* Strategy Verdict Panel */}
        <div style={{ background: BT.bgCard, borderRadius: 10, border: `1px solid ${BT.border}`, padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>STRATEGY VERDICT</div>
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
                <span style={{ fontSize: 9, fontWeight: 700, color: BT.amber, letterSpacing: 1, ...bMono }}>ARBITRAGE</span>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5, ...bMono }}>
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
              onClick={() => navigateToTab('risk')}>
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
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>OCCUPANCY & RENT</div>
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
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>NOI INTELLIGENCE</div>
          <div style={{ background: BT.orangeBg, border: `1px solid ${BT.orange}30`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: BT.orangeL, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, ...bMono }}>PLATFORM ADJUSTMENT ACTIVE</div>
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
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>DD CHECKLIST</div>
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
          <div style={{ fontSize: 9, fontWeight: 700, color: BT.td, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, ...bMono }}>MODULE ACCESS</div>
          {[
            { key: 'F2', label: 'PROPERTY & ZONING', hint: 'Parcels · Entitlement · Setbacks', tab: 'zoning' },
            { key: 'F3', label: 'MARKET & DEMAND', hint: 'Trade area · Absorption · Rents', tab: 'market' },
            { key: 'F4', label: 'SUPPLY PIPELINE', hint: 'Pipeline · Threat level · Capacity', tab: 'supply' },
            { key: 'F6', label: 'STRATEGY & DESIGN', hint: '4-strategy arbitrage · 3D massing', tab: 'strategy' },
            { key: 'F8', label: 'PRO FORMA', hint: '3-layer NOI model · Sensitivity', tab: 'proforma' },
            { key: 'F9', label: 'CAPITAL STRUCTURE', hint: 'Debt · Equity waterfall', tab: 'capital' },
            { key: 'F10', label: 'RISK & DUE DILIGENCE', hint: 'Monte Carlo · Insurance · DD checklist', tab: 'risk' },
            { key: 'F13', label: 'UNIT MIX', hint: 'Floor plans · Absorption · GPR → ProForma', tab: 'unit-mix' },
          ].map((m, i) => (
            <button key={i} onClick={() => navigateToTab(m.tab)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', background: 'none', border: 'none', borderBottom: `1px solid ${BT.border}`, cursor: 'pointer', textAlign: 'left' } satisfies React.CSSProperties}>
              <span style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, background: BT.amberBg, border: `1px solid ${BT.amber}40`, borderRadius: 3, padding: '2px 5px', flexShrink: 0, ...bMono }}>{m.key}</span>
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
                <div style={{ fontSize: 9, marginTop: 6, textAlign: 'center', lineHeight: 1.3, maxWidth: 70, color: textColor, fontWeight: 600, ...bSans }}>{step.n}</div>
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
                <div style={{ fontSize: 9, marginTop: 4, color: BT.td, fontWeight: 500, ...bSans }}>{step.n}</div>
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
            onClick={() => navigateToTab('strategy')}
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
            <span style={{ fontSize: 9, fontWeight: 700, color: BT.violL, background: `${BT.violet}25`, border: `1px solid ${BT.violet}50`, borderRadius: 3, padding: '2px 6px', letterSpacing: 1, ...bMono }}>
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
              <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{m.l}</div>
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
              <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, ...bMono }}>{m.l}</div>
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
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: BT.td, fontWeight: 700, letterSpacing: 1.2 }}>{h}</th>
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

        if (rentComps.length === 0) {
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
                            <span style={{ fontSize: 9, fontWeight: 700, color: BT.blueL, background: `${BT.blue}25`, border: `1px solid ${BT.blue}50`, borderRadius: 2, padding: '1px 4px', letterSpacing: 1 }}>SUBJECT</span>
                            <span style={{ fontSize: 9, color: BT.ts }}>{row.note}</span>
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
                    <span style={{ fontSize: 9, fontWeight: 700, color: textColor, ...bMono }}>{ph.dur}mo</span>
                  </div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, width: 40, textAlign: 'right', color: textColor, ...bMono }}>
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
              <div key={m} style={{ flex: 1, fontSize: 9, color: BT.td, ...bMono }}>M{m}</div>
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
                <span style={{ fontSize: 9, fontWeight: 700, color: BT.greenL, background: `${BT.green}25`, border: `1px solid ${BT.greenL}50`, padding: '1px 5px', borderRadius: 2, letterSpacing: 1 }}>WIN</span>
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
              <div style={{ fontSize: 9, color: BT.td, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BT.border}`, lineHeight: 1.5, ...bSans }}>
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


// ─── Redevelopment Overview shared primitives ──────────────────────────────────

const RSection: React.FC<{ number: string; title: string; subtitle?: string; color?: string }> = ({ number, title, subtitle, color }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: color || BT.amberL, letterSpacing: 2, ...bMono }}>§{number}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: BT.text, ...bSans }}>{title}</span>
    </div>
    {subtitle && <p style={{ fontSize: 11, color: BT.td, marginLeft: 28, ...bSans }}>{subtitle}</p>}
  </div>
);

const RCard: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style: s }) => (
  <div style={{ background: BT.bgCard, borderRadius: 8, border: `1px solid ${BT.border}`, padding: 16, ...s }}>
    {children}
  </div>
);

const RMetric: React.FC<{ label: string; value: string; sub?: string; color?: string; small?: boolean }> = ({ label, value, sub, color, small }) => (
  <div style={{ padding: small ? '6px 0' : '8px 0' }}>
    <div style={{ fontSize: 9, letterSpacing: 1.5, color: BT.td, marginBottom: 3, ...bMono }}>{label}</div>
    <div style={{ fontSize: small ? 15 : 20, fontWeight: 700, color: color || BT.text, ...bMono }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: BT.td, marginTop: 2, ...bSans }}>{sub}</div>}
  </div>
);

const RDataRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: `1px solid ${BT.border}` }}>
    <span style={{ fontSize: 11, color: BT.ts, fontWeight: bold ? 700 : 400, ...bSans }}>{label}</span>
    <span style={{ fontSize: 11, color: bold ? BT.amberL : BT.tm, fontWeight: bold ? 700 : 500, ...bMono }}>{value}</span>
  </div>
);

const RBadge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, padding: '3px 10px', borderRadius: 4, background: bg, color, border: `1px solid ${color}40`, ...bMono, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label}</span>
);

const RStatusDot: React.FC<{ status: string }> = ({ status }) => {
  const c = status === 'complete' ? BT.green : status === 'in-progress' ? BT.amber : BT.td;
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0 }} />;
};

interface RedevelopmentOverviewProps {
  deal: any;
  navigateToTab: (tab: string) => void;
  financial?: any;
  capitalStructure?: any;
  computedReturns?: any;
}

const RedevelopmentOverview: React.FC<RedevelopmentOverviewProps> = ({ deal, navigateToTab, financial, capitalStructure, computedReturns }) => {
  const askPrice = deal.purchasePrice || deal.budget || 0;
  const existingUnits = deal.units || deal.existingUnits || 0;
  const targetUnits = deal.targetUnits || existingUnits;
  const expansionUnits = Math.max(0, targetUnits - existingUnits);
  const totalUnits = existingUnits + expansionUnits;

  const existingNoi = financial?.currentNoi || deal.noi || 0;
  const stabilizedNoi = financial?.noi || financial?.stabilizedNoi || computedReturns?.stabilizedNoi || 0;
  const noiDelta = stabilizedNoi - existingNoi;

  const existingOccupancy: number | null = deal.existingOccupancy ?? deal.occupancy ?? null;
  const stabilizedOccupancy: number | null = deal.stabilizedOccupancy ?? null;
  const existingRentPerUnit = deal.existingRentPerUnit || deal.avgRent || 0;
  const stabilizedRentPerUnit = deal.stabilizedRentPerUnit || deal.targetRent || 0;
  const rentDelta = stabilizedRentPerUnit - existingRentPerUnit;
  const existingCapRate = askPrice > 0 && existingNoi > 0 ? existingNoi / askPrice : (deal.existingCapRate ?? null);
  const existingExpenseRatio: number | null = deal.existingExpenseRatio ?? null;

  const deferred = deal.deferred || 0;
  const renovationBudget = financial?.renovationBudget || deal.renovationBudget || 0;
  const renovPerUnit = existingUnits > 0 && renovationBudget > 0 ? Math.round(renovationBudget / existingUnits) : 0;
  const expansionCost = financial?.expansionCost || deal.expansionCost || 0;
  const expansionCostPerUnit = expansionUnits > 0 && expansionCost > 0 ? Math.round(expansionCost / expansionUnits) : 0;
  const expansionSqft = deal.expansionSqft || expansionUnits * 900;
  const expansionType: string | null = deal.expansionType ?? null;
  const softCosts = financial?.softCosts || 0;
  const totalInvestment = financial?.totalDevelopmentCost
    || deal.totalInvestment
    || (askPrice + renovationBudget + deferred + expansionCost + softCosts)
    || 0;

  const seniorDebt = capitalStructure?.seniorDebt || (totalInvestment * 0.644) || 0;
  const equityRequired = capitalStructure?.equity || capitalStructure?.equityRequired || (totalInvestment * 0.356) || 0;
  const ltv = totalInvestment > 0 ? seniorDebt / totalInvestment : 0;
  const bridgeRate: number | null = capitalStructure?.rate ?? deal.rate ?? null;
  const bridgeTerm: string | null = capitalStructure?.term ?? deal.term ?? null;
  const equitySplit: string | null = capitalStructure?.equitySplit ?? deal.equitySplit ?? null;
  const prefReturn: number | null = capitalStructure?.prefReturn ?? deal.prefReturn ?? null;
  const promote: string | null = capitalStructure?.promote ?? deal.promote ?? null;
  const lenderType: string | null = capitalStructure?.lender ?? deal.lenderType ?? null;

  const exitCapRate = financial?.exitCapRate || deal.exitCapRate || 0.055;
  const exitValue = stabilizedNoi > 0 ? stabilizedNoi / exitCapRate : (deal.exitValue || 0);
  const valueCreation = exitValue > 0 && totalInvestment > 0 ? exitValue - totalInvestment : 0;
  const renovROI = (renovationBudget + expansionCost) > 0 && noiDelta > 0
    ? (noiDelta / exitCapRate) / (renovationBudget + expansionCost) : 0;

  const irrRaw: number | undefined = financial?.irr ?? (computedReturns?.irrLevered != null ? computedReturns.irrLevered * 100 : undefined);
  const irrStr = irrRaw != null ? `${irrRaw.toFixed(1)}%` : deal.irr ? `${deal.irr}%` : '—';
  const emRaw: number | undefined = financial?.equityMultiple ?? computedReturns?.equityMultiple;
  const emStr = emRaw != null ? `${emRaw.toFixed(2)}x` : deal.equityMultiple ? `${deal.equityMultiple}x` : '—';
  const cashOnCash: number | null = deal.cashOnCash || financial?.cashOnCash || null;

  const ppu = existingUnits > 0 && askPrice > 0 ? Math.round(askPrice / existingUnits) : 0;
  const pricePerSf = (deal.existingSqft || 0) > 0 && askPrice > 0 ? Math.round(askPrice / deal.existingSqft) : 0;

  const lotSizeAcres: number = deal.lotSizeAcres || 0;
  const lotSizeSf: number = deal.lotSizeSf || Math.round(lotSizeAcres * 43560);
  const zoning: string = deal.zoning || deal.zoningCode || '—';
  const zoningDesc: string = deal.zoningDesc || deal.zoningDescription || '';
  const maxDensity: number = deal.maxDensity || 0;
  const additionalByRight: number = deal.additionalByRight ?? 0;
  const additionalWithVariance: number = deal.additionalWithVariance || expansionUnits || 0;
  const additionalIfRezoned: number = deal.additionalIfRezoned || expansionUnits || 0;
  const expansionRequiresVariance: boolean = deal.expansionRequiresVariance ?? (expansionUnits > 0);

  const renovScope: { item: string; costPerUnit: number; percentage: number }[] = deal.renovScope || [
    { item: 'Kitchen & Bath', costPerUnit: Math.round(renovPerUnit * 0.42), percentage: 0.42 },
    { item: 'Flooring (LVP)', costPerUnit: Math.round(renovPerUnit * 0.12), percentage: 0.12 },
    { item: 'HVAC Replacement', costPerUnit: Math.round(renovPerUnit * 0.16), percentage: 0.16 },
    { item: 'Exterior / Common', costPerUnit: Math.round(renovPerUnit * 0.125), percentage: 0.125 },
    { item: 'Appliances', costPerUnit: Math.round(renovPerUnit * 0.088), percentage: 0.088 },
    { item: 'Fixtures & Paint', costPerUnit: Math.round(renovPerUnit * 0.088), percentage: 0.088 },
  ];

  const existingMix: { type: string; count: number; avgSf: number; currentRent: number; targetRent: number }[] = deal.existingMix || [];
  const expansionMix: { type: string; count: number; avgSf: number; targetRent: number }[] = deal.expansionMix || [];

  const budgetBreakdown: { category: string; amount: number; color: string }[] = deal.budgetBreakdown || [
    { category: 'Acquisition', amount: askPrice, color: BT.amber },
    { category: 'Interior Renovations', amount: renovationBudget, color: BT.blue },
    { category: 'Deferred Maintenance', amount: deferred, color: BT.redL },
    { category: `Expansion (${expansionUnits} units)`, amount: expansionCost, color: BT.violL },
    { category: 'Soft Costs & Fees', amount: softCosts || Math.round(totalInvestment * 0.05), color: BT.td },
  ].filter(b => b.amount > 0);

  const phases: { label: string; months: number; start: number }[] = deal.phases || [
    { label: 'Close + Mobilize', months: 2, start: 0 },
    { label: 'Phase 1 Reno', months: 7, start: 2 },
    { label: 'Expansion Build', months: 12, start: 4 },
    { label: 'Phase 2 Reno', months: 7, start: 9 },
    { label: 'Lease-Up', months: 6, start: 16 },
  ];
  const totalTimelineMonths: number = deal.totalTimelineMonths || 22;

  const drawSchedule: { milestone: string; amount: number; pctDrawn: number }[] = deal.drawSchedule || [
    { milestone: 'Closing', amount: askPrice, pctDrawn: seniorDebt > 0 ? Math.min(askPrice / seniorDebt, 1) : 0.51 },
    { milestone: 'Reno Phase 1', amount: Math.round(renovationBudget * 0.45), pctDrawn: 0.65 },
    { milestone: 'Expansion Start', amount: Math.round(expansionCost * 0.4), pctDrawn: 0.79 },
    { milestone: 'Reno Phase 2', amount: Math.round(renovationBudget * 0.55), pctDrawn: 0.87 },
    { milestone: 'Expansion Complete', amount: Math.round(expansionCost * 0.6), pctDrawn: 1.0 },
  ].filter(d => d.amount > 0);

  const moduleItems = [
    { module: 'M02', label: 'Property & Zoning', status: 'complete', link: 'zoning' },
    { module: 'M05', label: 'Market Intelligence', status: 'in-progress', link: 'market' },
    { module: 'M07', label: 'Traffic Intelligence', status: 'not-started', link: 'traffic' },
    { module: 'M09', label: 'Pro Forma', status: 'in-progress', link: 'proforma' },
    { module: 'M11', label: 'Capital Structure', status: 'not-started', link: 'capital' },
    { module: 'M13', label: 'Risk Management', status: 'not-started', link: 'risk' },
    { module: 'M15', label: 'Competition', status: 'in-progress', link: 'competition' },
    { module: 'M08', label: 'Strategy', status: 'not-started', link: 'strategy' },
    { module: 'M17', label: 'Execution', status: 'not-started', link: 'execution' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ═══ HEADER ═══ */}
      <div style={{ background: BT.bgCard, borderRadius: 8, border: `1px solid ${BT.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `1px solid ${BT.border}` }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: BT.text, ...bSans }}>{deal.name || deal.projectName || 'Redevelopment Deal'}</span>
              <RBadge label="REDEVELOPMENT" color={BT.violL} bg={BT.violBg} />
              {deal.propertyClass && <RBadge label={deal.propertyClass} color={BT.amberL} bg={BT.amberBg} />}
            </div>
            <div style={{ fontSize: 11, color: BT.tm, ...bSans }}>{deal.address || '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: BT.td, ...bMono }}>ASK PRICE</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: BT.amberL, ...bMono }}>{askPrice > 0 ? `$${(askPrice / 1_000_000).toFixed(1)}M` : '—'}</div>
            {ppu > 0 && <div style={{ fontSize: 10, color: BT.td, ...bMono }}>${ppu.toLocaleString()}/unit{pricePerSf > 0 ? ` · $${pricePerSf}/SF` : ''}</div>}
          </div>
        </div>
        <div style={{ padding: '8px 20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: `1px solid ${BT.border}` }}>
          {[
            { l: 'PARCEL ID', v: deal.parcelId || '—' },
            { l: 'LOT SIZE', v: lotSizeAcres > 0 ? `${lotSizeAcres} ac` : lotSizeSf > 0 ? `${(lotSizeSf / 43560).toFixed(1)} ac` : '—' },
            { l: 'ZONING', v: zoning },
            { l: 'YEAR BUILT', v: String(deal.yearBuilt || '—') },
            { l: 'BUILDINGS', v: deal.buildings ? `${deal.buildings} bldgs · ${deal.stories || '—'}-story` : deal.stories ? `${deal.stories}-story` : '—' },
            { l: 'PARKING', v: deal.parking?.spaces ? `${deal.parking.spaces} spaces (${deal.parking.ratio || '—'}/unit)` : '—' },
          ].map((f, i) => (
            <div key={i} style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1, ...bMono }}>{f.l}</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: BT.text, marginTop: 2, ...bSans }}>{f.v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 20px', display: 'flex', gap: 20, background: BT.bg }}>
          {deal.assessedValue > 0 && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>Assessed: <span style={{ color: BT.text }}>${(deal.assessedValue / 1_000_000).toFixed(1)}M</span></span>}
          {deal.lastSalePrice > 0 && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>Last Sale: <span style={{ color: BT.text }}>${(deal.lastSalePrice / 1_000_000).toFixed(1)}M{deal.lastSaleDate ? ` (${new Date(deal.lastSaleDate).getFullYear()})` : ''}</span></span>}
          {zoningDesc && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>Zoning: <span style={{ color: BT.text }}>{zoningDesc}</span></span>}
        </div>
      </div>

      {/* ═══ §1 — ACQUISITION + AS-IS METRICS ═══ */}
      <div>
        <RSection number="1" title="Acquisition + As-Is Metrics" subtitle="What you're buying today — current operations baseline" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
          <RCard><RMetric label="GOING-IN CAP RATE" value={existingCapRate > 0 ? `${(existingCapRate * 100).toFixed(2)}%` : '—'} sub="Based on trailing 12mo NOI" /></RCard>
          <RCard><RMetric label="CURRENT NOI" value={existingNoi > 0 ? `$${(existingNoi / 1_000).toFixed(0)}K` : '—'} sub={existingExpenseRatio != null ? `Expense ratio: ${(existingExpenseRatio * 100).toFixed(0)}%` : undefined} /></RCard>
          <RCard><RMetric label="OCCUPANCY" value={existingOccupancy != null ? `${(existingOccupancy * 100).toFixed(0)}%` : '—'} sub="Physical occupancy" color={existingOccupancy != null && existingOccupancy < 0.9 ? BT.amberL : BT.text} /></RCard>
          <RCard><RMetric label="AVG RENT / UNIT" value={existingRentPerUnit > 0 ? `$${existingRentPerUnit.toLocaleString()}/mo` : '—'} sub="All unit types blended" /></RCard>
        </div>
        <RCard>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { l: 'Roof Age', v: deal.roofAge ? `${deal.roofAge} yrs` : '—', warn: (deal.roofAge || 0) > 10 },
                { l: 'HVAC Age', v: deal.hvacAge ? `${deal.hvacAge} yrs` : '—', warn: (deal.hvacAge || 0) > 10 },
                { l: 'Plumbing', v: deal.plumbingCondition || '—', warn: deal.plumbingCondition === 'Poor' },
                { l: 'Electrical', v: deal.electricalCondition || '—', warn: false },
              ].map((c, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1, ...bMono }}>{c.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.warn ? BT.amberL : BT.text, ...bSans }}>{c.v}</div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, color: BT.td, letterSpacing: 1, ...bMono }}>DEFERRED MAINTENANCE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: deferred > 0 ? BT.redL : BT.td, ...bMono }}>{deferred > 0 ? `$${(deferred / 1_000).toFixed(0)}K` : '—'}</div>
            </div>
          </div>
        </RCard>
      </div>

      {/* ═══ §2 — NOI TRANSFORMATION ═══ */}
      <div>
        <RSection number="2" title="NOI Transformation" subtitle="The value story — from as-is to stabilized" color={BT.greenL} />
        <RCard style={{ background: `linear-gradient(135deg, ${BT.bgCard} 0%, ${BT.greenBg}50 100%)`, border: `1px solid ${BT.green}25` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 9, color: BT.td, marginBottom: 4, ...bMono }}>AS-IS NOI</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.text, ...bMono }}>{existingNoi > 0 ? `$${(existingNoi / 1_000).toFixed(0)}K` : '—'}</div>
              <div style={{ fontSize: 10, color: BT.tm, marginTop: 4, ...bSans }}>
                {existingUnits > 0 ? `${existingUnits} units` : ''}{existingOccupancy != null ? ` · ${(existingOccupancy * 100).toFixed(0)}% occ` : ''}{existingRentPerUnit > 0 ? ` · $${existingRentPerUnit.toLocaleString()}/mo` : ''}
              </div>
            </div>
            <div style={{ fontSize: 22, color: BT.td, padding: '0 6px' }}>→</div>
            <div style={{ textAlign: 'center', padding: 16, background: BT.greenBg, borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: BT.greenL, marginBottom: 4, ...bMono }}>STABILIZED NOI</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.greenL, ...bMono }}>{stabilizedNoi > 0 ? `$${(stabilizedNoi / 1_000_000).toFixed(2)}M` : '—'}</div>
              <div style={{ fontSize: 10, color: BT.tm, marginTop: 4, ...bSans }}>
                {totalUnits > 0 ? `${totalUnits} units` : ''}{stabilizedOccupancy != null ? ` · ${(stabilizedOccupancy * 100).toFixed(0)}% occ` : ''}{stabilizedRentPerUnit > 0 ? ` · $${stabilizedRentPerUnit.toLocaleString()}/mo` : ''}
              </div>
            </div>
            <div style={{ fontSize: 22, color: BT.td, padding: '0 6px' }}>=</div>
            <div style={{ textAlign: 'center', padding: 16, background: BT.amberBg, borderRadius: 8 }}>
              <div style={{ fontSize: 9, color: BT.amberL, marginBottom: 4, ...bMono }}>NOI UPLIFT</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: BT.amberL, ...bMono }}>{noiDelta > 0 ? `+$${(noiDelta / 1_000).toFixed(0)}K` : '—'}</div>
              <div style={{ fontSize: 10, color: BT.tm, marginTop: 4, ...bSans }}>
                {existingNoi > 0 && noiDelta > 0 ? `+${((noiDelta / existingNoi) * 100).toFixed(0)}% increase` : ''}{rentDelta > 0 ? ` · +$${rentDelta.toLocaleString()}/unit lift` : ''}
              </div>
            </div>
          </div>
        </RCard>
      </div>

      {/* ═══ §3 — SITE + ZONING CAPACITY ═══ */}
      <div>
        <RSection number="3" title="Site + Zoning Capacity" subtitle="What the zoning allows vs what exists — expansion feasibility" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 10, ...bMono }}>DENSITY ANALYSIS</div>
            {(existingUnits > 0 || additionalIfRezoned > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: BT.tm, ...bSans }}>Existing: {existingUnits} units</span>
                  <span style={{ fontSize: 10, color: BT.tm, ...bSans }}>Max (if rezoned): {existingUnits + additionalIfRezoned} units</span>
                </div>
                <div style={{ height: 20, background: BT.bgPanel, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  {(existingUnits + additionalIfRezoned) > 0 && (
                    <>
                      <div style={{ width: `${(existingUnits / (existingUnits + additionalIfRezoned)) * 100}%`, height: '100%', background: BT.blue, borderRadius: '4px 0 0 4px' }} />
                      {additionalWithVariance > 0 && (
                        <div style={{
                          position: 'absolute', top: 0,
                          left: `${(existingUnits / (existingUnits + additionalIfRezoned)) * 100}%`,
                          width: `${(additionalWithVariance / (existingUnits + additionalIfRezoned)) * 100}%`,
                          height: '100%', background: `${BT.violL}60`,
                        }} />
                      )}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
                  <span style={{ fontSize: 9, color: BT.blueL, ...bMono }}>● Existing ({existingUnits})</span>
                  {additionalWithVariance > 0 && <span style={{ fontSize: 9, color: BT.violL, ...bMono }}>● Expansion ({additionalWithVariance} w/ variance)</span>}
                  {(additionalIfRezoned - additionalWithVariance) > 0 && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>○ Remaining ({additionalIfRezoned - additionalWithVariance} if rezoned)</span>}
                </div>
              </div>
            )}
            <RDataRow label="Current Zoning" value={zoningDesc ? `${zoning} — ${zoningDesc}` : zoning} />
            {maxDensity > 0 && <RDataRow label="Max Density (current)" value={`${maxDensity} DU/acre`} />}
            <RDataRow label="By-Right Additional" value={additionalByRight > 0 ? `+${additionalByRight} units` : '0 — existing may be legally nonconforming'} />
            {additionalWithVariance > 0 && <RDataRow label="With Variance" value={`+${additionalWithVariance} units`} />}
            {additionalIfRezoned > 0 && <RDataRow label="Full Rezone Potential" value={`+${additionalIfRezoned} units`} />}
          </RCard>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 10, ...bMono }}>ZONING ENVELOPE</div>
            {[
              { l: 'Max Height', v: deal.maxHeight ? `${deal.maxHeight} ft` : '—' },
              { l: 'Max Lot Coverage', v: deal.maxLotCoverage ? `${(deal.maxLotCoverage * 100).toFixed(0)}%` : '—' },
              { l: 'Lot Size', v: lotSizeAcres > 0 ? `${lotSizeAcres} acres${lotSizeSf > 0 ? ` (${lotSizeSf.toLocaleString()} SF)` : ''}` : '—' },
              { l: 'Existing Coverage', v: deal.existingCoverage || '~42%' },
              { l: 'Available for Expansion', v: lotSizeSf > 0 ? `~${Math.round(lotSizeSf * 0.18).toLocaleString()} SF` : '—' },
            ].map((r, i) => <RDataRow key={i} label={r.l} value={r.v} />)}
            {expansionRequiresVariance && (
              <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 6, background: BT.amberBg, border: `1px solid ${BT.amber}40` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: BT.amberL, marginBottom: 3, ...bMono }}>⚠ VARIANCE REQUIRED</div>
                <p style={{ fontSize: 10, color: BT.amberL, lineHeight: 1.5, ...bSans }}>
                  Expansion of {expansionUnits > 0 ? expansionUnits : 'planned'} units requires a variance or rezoning. Entitlement timeline: ~6–9 months.
                </p>
              </div>
            )}
          </RCard>
        </div>
      </div>

      {/* ═══ §4 — RENOVATION + EXPANSION SCOPE ═══ */}
      <div>
        <RSection number="4" title="Renovation + Expansion Scope" subtitle="Dual-track: interior upgrades on existing + new construction" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <RCard style={{ borderLeft: `3px solid ${BT.blue}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: BT.blueL, ...bMono }}>RENOVATION</div>
                <div style={{ fontSize: 10, color: BT.tm, marginTop: 2, ...bSans }}>{existingUnits} units · full interior</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: BT.text, ...bMono }}>{renovationBudget > 0 ? `$${(renovationBudget / 1_000_000).toFixed(1)}M` : '—'}</div>
                {renovPerUnit > 0 && <div style={{ fontSize: 10, color: BT.td, ...bMono }}>${renovPerUnit.toLocaleString()}/unit</div>}
              </div>
            </div>
            {renovScope.filter(s => s.costPerUnit > 0).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${BT.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: Math.round(s.percentage * 60), minWidth: 4, height: 5, borderRadius: 2, background: BT.blue, opacity: 0.7 }} />
                  <span style={{ fontSize: 11, color: BT.ts, ...bSans }}>{s.item}</span>
                </div>
                <span style={{ fontSize: 11, color: BT.tm, ...bMono }}>{s.costPerUnit > 0 ? `$${s.costPerUnit.toLocaleString()}/unit` : '—'}</span>
              </div>
            ))}
            {rentDelta > 0 && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: BT.blueBg, borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: BT.blueL, ...bSans }}>Rent uplift after renovation</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: BT.blueL, ...bMono }}>+${rentDelta.toLocaleString()}/mo (+{existingRentPerUnit > 0 ? `${((rentDelta / existingRentPerUnit) * 100).toFixed(0)}%` : '—'})</span>
              </div>
            )}
          </RCard>
          <RCard style={{ borderLeft: `3px solid ${BT.violL}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: BT.violL, ...bMono }}>EXPANSION</div>
                <div style={{ fontSize: 10, color: BT.tm, marginTop: 2, ...bSans }}>+{expansionUnits} new units{expansionType ? ` · ${expansionType}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: BT.text, ...bMono }}>{expansionCost > 0 ? `$${(expansionCost / 1_000_000).toFixed(1)}M` : '—'}</div>
                {expansionCostPerUnit > 0 && <div style={{ fontSize: 10, color: BT.td, ...bMono }}>${expansionCostPerUnit.toLocaleString()}/unit</div>}
              </div>
            </div>
            <RDataRow label="New Units" value={expansionUnits > 0 ? `+${expansionUnits}` : '—'} />
            {expansionSqft > 0 && <RDataRow label="New SF" value={`${expansionSqft.toLocaleString()} SF`} />}
            <RDataRow label="Building Type" value={expansionType ?? '—'} />
            {deal.expansionParkingAdd > 0 && <RDataRow label="Additional Parking" value={`+${deal.expansionParkingAdd} spaces`} />}
            {expansionCost > 0 && expansionSqft > 0 && <RDataRow label="Cost / SF" value={`$${Math.round(expansionCost / expansionSqft).toLocaleString()}`} />}
            <RDataRow label="Entitlement Status" value={expansionRequiresVariance ? 'Variance needed' : 'By-right'} />
            <div style={{ marginTop: 10, padding: '8px 10px', background: BT.violBg, borderRadius: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: BT.violL, ...bSans }}>Total post-expansion</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: BT.violL, ...bMono }}>{totalUnits} units{expansionSqft > 0 && deal.existingSqft > 0 ? ` · ${(deal.existingSqft + expansionSqft).toLocaleString()} SF` : ''}</span>
              </div>
            </div>
          </RCard>
        </div>
      </div>

      {/* ═══ §5 — UNIT MIX PROGRAM ═══ */}
      <div>
        <RSection number="5" title="Unit Mix Program" subtitle="Existing mix + expansion additions → blended stabilized portfolio" />
        <RCard>
          {(existingMix.length > 0 || expansionMix.length > 0) ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', ...bMono }}>
                <thead>
                  <tr style={{ background: BT.bgPanel, borderBottom: `2px solid ${BT.border}` }}>
                    {['Type', 'Count', 'Avg SF', 'Current Rent', 'Target Rent', 'Δ Rent', 'Δ %'].map((h, i) => (
                      <th key={i} style={{ padding: '7px 10px', textAlign: i > 0 ? 'right' : 'left', fontSize: 9, color: BT.td, fontWeight: 700, letterSpacing: 1.2 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {existingMix.length > 0 && (
                    <tr><td colSpan={7} style={{ padding: '5px 10px', fontSize: 9, letterSpacing: 2, color: BT.blueL, background: BT.bg, ...bMono }}>EXISTING ({existingUnits} UNITS)</td></tr>
                  )}
                  {existingMix.map((u, i) => {
                    const delta = u.targetRent - u.currentRent;
                    return (
                      <tr key={`e${i}`} style={{ borderBottom: `1px solid ${BT.border}`, background: i % 2 === 0 ? BT.bgCard : BT.bgPanel }}>
                        <td style={{ padding: '6px 10px', color: BT.ts, ...bSans }}>{u.type}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>{u.count}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>{u.avgSf}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>${u.currentRent.toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.greenL, fontWeight: 600 }}>${u.targetRent.toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.greenL }}>+${delta.toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.greenL }}>+{u.currentRent > 0 ? `${((delta / u.currentRent) * 100).toFixed(0)}%` : '—'}</td>
                      </tr>
                    );
                  })}
                  {expansionMix.length > 0 && (
                    <tr><td colSpan={7} style={{ padding: '5px 10px', fontSize: 9, letterSpacing: 2, color: BT.violL, background: BT.bg, ...bMono }}>EXPANSION (+{expansionUnits} UNITS)</td></tr>
                  )}
                  {expansionMix.map((u, i) => (
                    <tr key={`x${i}`} style={{ borderBottom: `1px solid ${BT.border}`, background: i % 2 === 0 ? BT.bgCard : BT.bgPanel }}>
                      <td style={{ padding: '6px 10px', color: BT.ts, ...bSans }}>{u.type}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.violL }}>+{u.count}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.tm }}>{u.avgSf}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.td }}>—</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.violL, fontWeight: 600 }}>${u.targetRent.toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.td }}>—</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: BT.td }}>—</td>
                    </tr>
                  ))}
                  <tr style={{ background: BT.bgPanel, borderTop: `2px solid ${BT.amber}40` }}>
                    <td colSpan={7} style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: BT.ts, ...bSans }}>Stabilized Portfolio: {totalUnits} units</span>
                        {stabilizedRentPerUnit > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: BT.amberL, ...bMono }}>Blended avg: ${stabilizedRentPerUnit.toLocaleString()}/mo</span>}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 10, color: BT.ts, marginBottom: 4, ...bSans }}>No unit mix data configured</p>
              <p style={{ fontSize: 9, color: BT.td, marginBottom: 8, ...bSans }}>Add existing and expansion unit mix data to your deal to populate this table.</p>
              <button onClick={() => navigateToTab('proforma')} style={{ fontSize: 9, color: BT.amber, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, ...bSans }}>Build ProForma →</button>
            </div>
          )}
        </RCard>
      </div>

      {/* ═══ §6 — DEVELOPMENT BUDGET + TIMELINE ═══ */}
      <div>
        <RSection number="6" title="Development Budget + Timeline" subtitle="Full cost breakdown and phased execution schedule" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 10, ...bMono }}>TOTAL INVESTMENT</div>
            {budgetBreakdown.length > 0 && (
              <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                {budgetBreakdown.map((b, i) => (
                  <div key={i} style={{ width: `${totalInvestment > 0 ? (b.amount / totalInvestment) * 100 : 0}%`, background: b.color, opacity: 0.75 }}
                    title={`${b.category}: $${(b.amount / 1_000_000).toFixed(1)}M`} />
                ))}
              </div>
            )}
            {budgetBreakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${BT.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                  <span style={{ fontSize: 11, color: BT.ts, ...bSans }}>{b.category}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: BT.tm, ...bMono }}>${(b.amount / 1_000_000).toFixed(1)}M</span>
                  {totalInvestment > 0 && <span style={{ fontSize: 9, color: BT.td, ...bMono }}>{((b.amount / totalInvestment) * 100).toFixed(0)}%</span>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: BT.ts, letterSpacing: 1, ...bMono }}>TOTAL INVESTMENT</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: BT.amber, ...bMono }}>{totalInvestment > 0 ? `$${(totalInvestment / 1_000_000).toFixed(1)}M` : '—'}</span>
            </div>
          </RCard>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 12, ...bMono }}>EXECUTION TIMELINE</div>
            <div style={{ position: 'relative', height: phases.length * 30 + 8, marginBottom: 10 }}>
              {phases.map((p, i) => {
                const totalM = totalTimelineMonths + 2;
                const colors = [BT.amber, BT.blue, BT.violL, BT.blue, BT.greenL];
                const c = colors[i % colors.length];
                return (
                  <div key={i} style={{
                    position: 'absolute', left: `${(p.start / totalM) * 100}%`,
                    width: `${(p.months / totalM) * 100}%`, top: i * 28, height: 22,
                    background: `${c}20`, border: `1px solid ${c}50`, borderRadius: 4,
                    display: 'flex', alignItems: 'center', paddingLeft: 6,
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: c, ...bMono, whiteSpace: 'nowrap' }}>{p.label} ({p.months}mo)</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${BT.border}`, paddingTop: 6 }}>
              <span style={{ fontSize: 9, color: BT.td, ...bMono }}>Month 0</span>
              <span style={{ fontSize: 9, color: BT.td, ...bMono }}>Stabilized — Month {totalTimelineMonths + 2}</span>
            </div>
          </RCard>
        </div>
      </div>

      {/* ═══ §7 — CAPITAL STRUCTURE ═══ */}
      <div>
        <RSection number="7" title="Capital Structure" subtitle="Bridge-to-perm with renovation and expansion draw schedules" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 10, ...bMono }}>SOURCES</div>
            <RDataRow label="Senior Debt (Bridge)" value={seniorDebt > 0 ? `$${(seniorDebt / 1_000_000).toFixed(1)}M` : '—'} />
            <RDataRow label="LTV" value={ltv > 0 ? `${(ltv * 100).toFixed(1)}%` : '—'} />
            <RDataRow label="Rate" value={bridgeRate != null && bridgeRate > 0 ? `${(bridgeRate * 100).toFixed(2)}%` : '—'} />
            <RDataRow label="Term" value={bridgeTerm ?? '—'} />
            <RDataRow label="Lender Type" value={lenderType ?? '—'} />
            <div style={{ height: 12 }} />
            <RDataRow label="Sponsor Equity" value={equityRequired > 0 ? `$${(equityRequired / 1_000_000).toFixed(1)}M` : '—'} />
            <RDataRow label="LP/GP Split" value={equitySplit ?? '—'} />
            <RDataRow label="Pref Return" value={prefReturn != null && prefReturn > 0 ? `${(prefReturn * 100).toFixed(0)}%` : '—'} />
            <RDataRow label="Promote" value={promote ?? '—'} />
            <RDataRow label="Total Capitalization" value={totalInvestment > 0 ? `$${(totalInvestment / 1_000_000).toFixed(1)}M` : '—'} bold />
          </RCard>
          <RCard>
            <div style={{ fontSize: 9, letterSpacing: 2, color: BT.td, marginBottom: 10, ...bMono }}>DRAW SCHEDULE</div>
            {drawSchedule.length > 0 ? drawSchedule.map((d, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: BT.ts, ...bSans }}>{d.milestone}</span>
                  <span style={{ fontSize: 10, color: BT.tm, ...bMono }}>{d.amount > 0 ? `$${(d.amount / 1_000_000).toFixed(1)}M` : '—'}</span>
                </div>
                <div style={{ height: 7, background: BT.bgPanel, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(d.pctDrawn * 100, 100)}%`, height: '100%', background: BT.amber, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 9, color: BT.td, marginTop: 2, textAlign: 'right', ...bMono }}>{(d.pctDrawn * 100).toFixed(0)}% drawn</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 10, color: BT.ts, ...bSans }}>Configure capital stack to see draw schedule</p>
                <button onClick={() => navigateToTab('capital')} style={{ fontSize: 9, color: BT.amber, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginTop: 6, ...bSans }}>Configure Capital Stack →</button>
              </div>
            )}
          </RCard>
        </div>
      </div>

      {/* ═══ §8 — VALUE BRIDGE + RETURNS ═══ */}
      <div>
        <RSection number="8" title="Value Bridge + Returns" subtitle="Total basis → stabilized value → value creation" />
        <RCard style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 0, flexWrap: 'wrap' }}>
            {([
              { label: 'Acquisition', value: askPrice, color: BT.amber },
              { op: '+' },
              { label: 'Renovation', value: renovationBudget, color: BT.blue },
              { op: '+' },
              { label: 'Deferred Maint', value: deferred, color: BT.redL },
              { op: '+' },
              { label: 'Expansion', value: expansionCost, color: BT.violL },
              { op: '+' },
              { label: 'Soft + Closing', value: Math.max(0, totalInvestment - askPrice - renovationBudget - deferred - expansionCost), color: BT.td },
              { op: '=' },
              { label: 'Total Basis', value: totalInvestment, color: BT.amberL, bold: true },
              { op: '→' },
              { label: 'Stabilized Value', value: exitValue, color: BT.greenL, bold: true },
            ] as Array<{ op: string } | { label: string; value: number; color: string; bold?: boolean }>).map((step, i) => {
              if ('op' in step) return <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0 4px', fontSize: 14, color: BT.td }}>{step.op}</div>;
              const displayV = step.value > 0 ? `$${(step.value / 1_000_000).toFixed(1)}M` : '—';
              return (
                <div key={i} style={{ textAlign: 'center', padding: '8px 6px', minWidth: 66 }}>
                  <div style={{ fontSize: 9, color: BT.td, marginBottom: 2, ...bMono }}>{step.label}</div>
                  <div style={{ fontSize: step.bold ? 15 : 12, fontWeight: 700, color: step.color, ...bMono }}>{displayV}</div>
                </div>
              );
            })}
          </div>
          {valueCreation > 0 && (
            <div style={{ marginTop: 10, background: BT.greenBg, border: `1px solid ${BT.green}30`, borderRadius: 6, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BT.greenL, ...bSans }}>Value Creation</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: BT.greenL, ...bMono }}>+${(valueCreation / 1_000_000).toFixed(1)}M</span>
            </div>
          )}
        </RCard>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          <RCard><RMetric label="PROJ. IRR" value={irrStr} sub="Levered, 5-year hold" color={BT.greenL} /></RCard>
          <RCard><RMetric label="EQUITY MULTIPLE" value={emStr} sub={equityRequired > 0 ? `On $${(equityRequired / 1_000_000).toFixed(1)}M equity` : undefined} color={BT.greenL} /></RCard>
          <RCard><RMetric label="RENOVATION ROI" value={renovROI > 0 ? `${(renovROI * 100).toFixed(0)}%` : '—'} sub={noiDelta > 0 && (renovationBudget + expansionCost) > 0 ? `$${(noiDelta / 1_000).toFixed(0)}K uplift / $${((renovationBudget + expansionCost) / 1_000_000).toFixed(1)}M spent` : undefined} color={renovROI > 1 ? BT.greenL : BT.amber} /></RCard>
          <RCard><RMetric label="CASH-ON-CASH (Y1)" value={cashOnCash != null ? `${cashOnCash}%` : '—'} sub="Year 1 levered yield" /></RCard>
        </div>
      </div>

      {/* ═══ §9 — DUE DILIGENCE + MODULE ACCESS ═══ */}
      <div>
        <RSection number="9" title="Due Diligence + Module Access" subtitle="Jump into any module — status tracked across the deal lifecycle" />
        <RCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {moduleItems.map((item, i) => (
              <button
                key={i}
                onClick={() => navigateToTab(item.link)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: BT.bg, borderRadius: 6, border: `1px solid ${BT.border}`,
                  cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = BT.amber)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = BT.border)}
              >
                <RStatusDot status={item.status} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: BT.text, ...bSans }}>{item.label}</div>
                  <div style={{ fontSize: 9, color: BT.td, ...bMono }}>{item.module}</div>
                </div>
                <span style={{ fontSize: 9, color: BT.td, textTransform: 'capitalize', flexShrink: 0, ...bSans }}>{item.status.replace('-', ' ')}</span>
              </button>
            ))}
          </div>
        </RCard>
      </div>

    </div>
  );
};

export default OverviewSection;
