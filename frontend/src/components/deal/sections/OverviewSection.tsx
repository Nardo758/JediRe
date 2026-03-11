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

function scoreToVerdict(score: number): { verdict: string; verdictColor: string } {
  if (score >= 85) return { verdict: 'STRONG BUY', verdictColor: 'text-emerald-400' };
  if (score >= 70) return { verdict: 'OPPORTUNITY', verdictColor: 'text-amber-400' };
  if (score >= 55) return { verdict: 'HOLD / MONITOR', verdictColor: 'text-stone-400' };
  return { verdict: 'CAUTION', verdictColor: 'text-red-400' };
}

function buildSignalsFromBreakdown(breakdown: any): SignalScore[] {
  const signalDefs = [
    { id: 'demand', name: 'Demand', color: 'bg-emerald-500', bgColor: 'bg-emerald-50', moduleLink: 'demand' },
    { id: 'supply', name: 'Supply', color: 'bg-amber-500', bgColor: 'bg-amber-50', moduleLink: 'supply' },
    { id: 'momentum', name: 'Momentum', color: 'bg-blue-500', bgColor: 'bg-blue-50', moduleLink: 'market' },
    { id: 'position', name: 'Position', color: 'bg-violet-500', bgColor: 'bg-violet-50', moduleLink: 'market' },
    { id: 'risk', name: 'Risk', color: 'bg-stone-500', bgColor: 'bg-stone-50', moduleLink: 'risk' },
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
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  deal,
  onStrategySelected,
  onTabChange,
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
    loadMarketData();
    loadEntitlementBenchmarks();
    return () => { stopPolling?.(); };
  }, [deal?.id]);

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

  const loadMarketData = async () => {
    if (!deal?.id) return;
    try {
      const res = await apiClient.get(`/api/v1/deals/${deal.id}/geographic-context`);
      const geo = res.data?.data || res.data;
      if (geo?.submarket?.avgCapRate) {
        setMarketCapRate(geo.submarket.avgCapRate);
      } else if (geo?.msa?.avgCapRate) {
        setMarketCapRate(geo.msa.avgCapRate);
      }
    } catch (err) {
      console.warn('Could not load market data:', err);
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
    <div className="space-y-5">
      {dataSource !== 'loading' && (
        <div className="flex items-center justify-between">
          {/* Deal type badge - read-only, set at deal creation */}
          <div className="inline-flex items-center gap-2">
            <span className={`px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-lg border ${
              isDev
                ? isRedevelopment
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {isRedevelopment ? 'REDEVELOPMENT' : isDev ? 'GROUND-UP DEVELOPMENT' : 'ACQUISITION'}
            </span>
            <span className="text-[9px] text-stone-400 font-medium">Set at deal creation</span>
          </div>
          {dataSource === 'live' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE DATA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-amber-100 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
        ? <ExistingOverview deal={deal} navigateToTab={navigateToTab} capitalStructure={capitalStructure} financial={financial} market={market} capitalStackData={capitalStackData} marketCapRate={marketCapRate} />
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
}> = ({ title, right, accentColor = 'border-amber-500' }) => (
  <div className={`flex items-center justify-between px-4 py-2.5 bg-stone-50 border-y border-stone-200 border-l-[3px] ${accentColor}`}>
    <span className="text-[10px] font-mono text-stone-500 tracking-widest font-bold uppercase">{title}</span>
    {right && <span className="text-[10px] text-stone-400">{right}</span>}
  </div>
);

const KVCard: React.FC<{
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  noteColor?: string;
  compact?: boolean;
}> = ({ label, value, note, valueColor = 'text-amber-600', noteColor = 'text-stone-400', compact = false }) => (
  <div className={`bg-white ${compact ? 'p-2' : 'p-3'}`}>
    <div className="text-[9px] font-mono text-stone-400 tracking-widest uppercase mb-1">{label}</div>
    <div className={`${compact ? 'text-base' : 'text-lg'} font-bold font-mono ${valueColor}`}>{value}</div>
    {note && <div className={`text-[10px] ${compact ? 'mt-0.5' : 'mt-1'} ${noteColor}`}>{note}</div>}
  </div>
);

const DDItem: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <div className="flex items-center gap-2.5 py-2 border-b border-stone-100 last:border-0">
    <span className={`text-sm flex-shrink-0 ${done ? 'text-emerald-500' : 'text-stone-300'}`}>{done ? '✓' : '○'}</span>
    <span className={`text-xs ${done ? 'text-stone-700' : 'text-stone-400'}`}>{label}</span>
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
    <div className="space-y-0">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-stone-900 rounded-xl p-5 text-white">
          {jediScore ? (
          <div className="flex items-start gap-5">
            <JEDIScoreGauge score={jediScore.score} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-sm font-bold tracking-wide ${jediScore.verdictColor}`}>
                  {jediScore.verdict}
                </span>
                {jediScore.delta30d !== 0 && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    jediScore.delta30d > 0 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {jediScore.delta30d > 0 ? '+' : ''}{jediScore.delta30d} pts (30d)
                  </span>
                )}
              </div>
              <p className="text-stone-400 text-xs mb-3">
                Confidence: {jediScore.confidenceLabel} ({jediScore.confidence}%)
              </p>

              {signals.length > 0 ? (
              <div className="mb-3">
                <div className="text-[9px] font-mono text-stone-500 tracking-wider mb-1.5">5 MASTER SIGNALS</div>
                <div className="space-y-1.5">
                  {signals.map((s) => {
                    const barColor = s.score >= 80 ? 'bg-emerald-500' : s.score >= 60 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <button key={s.id} onClick={() => navigateToTab(s.moduleLink)} className="w-full group">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-stone-500 w-20 text-left group-hover:text-stone-300 transition-colors">
                            {s.name.toUpperCase()} <span className="text-stone-600">({s.weight}%)</span>
                          </span>
                          <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all duration-500`}
                              style={{ width: `${s.score}%` }} />
                          </div>
                          <span className={`text-xs font-bold font-mono w-6 text-right ${
                            s.score >= 80 ? 'text-emerald-400' : s.score >= 60 ? 'text-amber-400' : 'text-red-400'
                          }`}>{s.score}</span>
                          <span className={`text-[9px] font-mono w-6 text-right ${
                            s.trendDelta > 0 ? 'text-emerald-400' : s.trendDelta < 0 ? 'text-red-400' : 'text-stone-600'
                          }`}>
                            {s.trendDelta > 0 ? `+${s.trendDelta}` : s.trendDelta < 0 ? `${s.trendDelta}` : '--'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              ) : (
              <div className="mb-3">
                <div className="text-[9px] font-mono text-stone-500 tracking-wider mb-1.5">5 MASTER SIGNALS</div>
                <p className="text-xs text-stone-500">Signal breakdown not yet available. Run analysis to populate.</p>
              </div>
              )}
            </div>
          </div>
          ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-stone-500 mb-2">—</div>
              <div className="text-[10px] font-mono text-stone-500 tracking-wider">JEDI SCORE</div>
              <p className="text-xs text-stone-400 mt-2">Score will populate after analysis completes</p>
            </div>
          </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-2">STRATEGY VERDICT</div>
          {strategyVerdict ? (
          <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold text-stone-900">{strategyVerdict.recommendedLabel}</span>
            {strategyVerdict.score > 0 && <span className="text-sm font-mono text-amber-600">{strategyVerdict.score}</span>}
          </div>
          {strategyVerdict.secondBestLabel ? (
          <div className="text-xs text-stone-500 mb-2">
            vs {strategyVerdict.secondBestLabel}: {strategyVerdict.secondBestScore}
          </div>
          ) : (
          <div className="text-xs text-stone-400 mb-2">{strategyVerdict.insight}</div>
          )}

          {strategyVerdict.isArbitrage && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-amber-600 font-bold text-[10px] tracking-wider">ARBITRAGE</span>
                <span className="text-amber-700 text-xs font-mono">+{strategyVerdict.arbitrageGap}pt gap</span>
              </div>
              <p className="text-[10px] text-amber-800 leading-relaxed">{strategyVerdict.insight}</p>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between text-xs border-t border-stone-100 pt-2">
            <div>
              <span className="text-stone-400">{strategyVerdict.roiLabel}: </span>
              <span className="font-bold text-stone-700">{strategyVerdict.roiEstimate}</span>
            </div>
            <button className="text-amber-600 hover:text-amber-700 font-medium text-[10px]"
              onClick={() => navigateToTab('strategy')}>
              Compare All &rarr;
            </button>
          </div>
          </>
          ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <p className="text-xs text-stone-400 mb-2">Analysis in progress...</p>
            <button className="text-amber-600 hover:text-amber-700 font-medium text-[10px]"
              onClick={() => navigateToTab('strategy')}>
              View Strategy Tab &rarr;
            </button>
          </div>
          )}

          {ddTotal > 0 && (
            <div className="mt-3 pt-2 border-t border-stone-100">
              <div className="flex justify-between text-[9px] font-mono text-stone-400 tracking-wider mb-1">
                <span>DUE DILIGENCE</span>
                <span className={ddDone === ddTotal ? 'text-emerald-500' : 'text-amber-500'}>{ddDone}/{ddTotal}</span>
              </div>
              <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${ddDone === ddTotal ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${(ddDone / ddTotal) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {riskAlert?.show && (
        <div className={`mt-4 rounded-lg border px-4 py-3 flex items-center justify-between ${
          riskAlert.severity === 'high' ? 'bg-red-50 border-red-200' :
          riskAlert.severity === 'medium' ? 'bg-amber-50 border-amber-200' :
          'bg-stone-50 border-stone-200'
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold font-mono tracking-wider ${
                riskAlert.severity === 'high' ? 'text-red-600' : riskAlert.severity === 'medium' ? 'text-amber-600' : 'text-stone-600'
              }`}>
                {riskAlert.severity === 'high' ? 'HIGH RISK' : 'RISK ALERT'} · {riskAlert.category} {riskAlert.score}/{riskAlert.maxScore}
              </span>
            </div>
            <p className={`text-xs ${
              riskAlert.severity === 'high' ? 'text-red-800' : riskAlert.severity === 'medium' ? 'text-amber-800' : 'text-stone-700'
            }`}>{riskAlert.detail}</p>
            {riskAlert.mitigationAvailable && (
              <p className="text-[10px] text-stone-500 mt-0.5">Offset: {riskAlert.mitigationText}</p>
            )}
          </div>
          <button className="text-[10px] font-medium text-stone-500 hover:text-stone-700 flex-shrink-0 ml-4"
            onClick={() => navigateToTab('risk')}>
            Risk Dashboard &rarr;
          </button>
        </div>
      )}
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
}

const ExistingOverview: React.FC<ExistingOverviewProps> = ({ deal, navigateToTab, capitalStructure, financial, market, capitalStackData, marketCapRate }) => {
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
    <div className="space-y-0">
      <SectionHead
        title="Acquisition Metrics"
        right={`${deal.propertyTypeKey || 'Multifamily'} · ${units > 0 ? `${units}u` : '—'} · ${deal.address ? deal.address.split(',')[1]?.trim() || '' : ''}`}
        accentColor="border-cyan-500"
      />
      <div className="grid grid-cols-6 gap-px bg-stone-200">
        <KVCard label="Ask Price" value={price} valueColor="text-stone-900" />
        <KVCard label="Price / Unit" value={ppu} note={units > 0 ? `${units} units` : undefined} />
        <KVCard label="Cap Rate (Going-In)" value={capRate} note="Market: —" />
        <KVCard label="DSCR" value={dscrValue} valueColor={dscrColor} note="Min: 1.25x" noteColor="text-emerald-500" />
        <KVCard label="Yield on Cost" value={yocValue} valueColor="text-amber-600" note="BTS scenario" />
        <KVCard label="Days in Pipeline" value={deal.daysInStage ? `${deal.daysInStage}d` : deal.daysInStation ? `${deal.daysInStation}d` : '—'} valueColor="text-cyan-600" note={deal.state || deal.stage || ''} />
      </div>

      <SectionHead title="Operating Intelligence" right="M05 Market · M09 ProForma" accentColor="border-emerald-500" />
      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">OCCUPANCY & RENT</div>
          {[
            { l: 'Physical Occupancy', v: occ, c: 'text-emerald-600' },
            { l: 'Economic Occupancy', v: occ !== '—' ? occ : '—', c: 'text-emerald-600' },
            { l: 'Effective Rent / Unit', v: effectiveRent, c: 'text-amber-600' },
            { l: 'Submarket Market Rent', v: market?.avgRent ? `$${Math.round(market.avgRent * 1.03).toLocaleString()}` : '—', c: 'text-stone-600' },
            { l: 'Rent vs Market', v: market?.avgRent ? `${((market.avgRent / (market.avgRent * 1.03) - 1) * 100).toFixed(1)}%` : '—', c: 'text-orange-500', note: market?.avgRent ? 'Upside capture opportunity' : undefined },
            { l: 'Expense Ratio', v: expenseRatio, c: 'text-stone-600' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-start py-1.5 border-b border-stone-100 last:border-0">
              <span className="text-xs text-stone-600">{r.l}</span>
              <div className="text-right">
                <span className={`text-sm font-bold ${r.c}`}>{r.v}</span>
                {r.note && <div className="text-[9px] text-stone-400">{r.note}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">NOI INTELLIGENCE</div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
            <div className="text-[9px] font-bold text-orange-600 tracking-wider mb-2">PLATFORM ADJUSTMENT ACTIVE</div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-stone-500">Broker NOI</span>
              <span className="text-xs text-stone-400 line-through">{noiValue !== '—' ? noiValue : '—'}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-stone-800">Platform NOI</span>
              <span className="text-sm font-bold text-amber-600">{noiValue}</span>
            </div>
            <div className="text-[9px] text-stone-400 pt-2 border-t border-orange-200 leading-relaxed">
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
              { l: 'Going-In Cap Rate', v: capRate, c: 'text-amber-600' },
              { l: 'Market Cap Rate', v: mktCap, c: 'text-stone-600' },
              { l: 'Implied Value at Mkt Cap', v: impliedVal, c: 'text-emerald-600', note: impliedVsAsk },
            ];
          })().map((r, i) => (
            <div key={i} className="flex justify-between items-start py-1.5 border-b border-stone-100 last:border-0">
              <span className="text-xs text-stone-600">{r.l}</span>
              <div className="text-right">
                <span className={`text-sm font-bold ${r.c}`}>{r.v}</span>
                {r.note && <div className="text-[9px] text-emerald-500">{r.note}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SectionHead title="Capital Structure" right="M11 · Exit target" accentColor="border-violet-500" />
      <div className="grid grid-cols-3 gap-px bg-stone-200">
        {(() => {
          const stack = capitalStackData?.stack || capitalStackData?.layers || [];
          const senior = stack.find?.((l: any) => l.type === 'senior_debt' || l.name?.toLowerCase().includes('senior'));
          const mezz = stack.find?.((l: any) => l.type === 'mezzanine' || l.name?.toLowerCase().includes('mezz'));
          const equity = stack.find?.((l: any) => l.type === 'equity' || l.name?.toLowerCase().includes('equity'));
          return [
            { 
              tier: 'Senior Debt', c: 'border-blue-400', tc: 'text-blue-600', 
              amt: senior?.amount ? `$${(senior.amount / 1_000_000).toFixed(1)}M` : capitalStructure?.loanBalance?.[0] ? `$${(capitalStructure.loanBalance[0] / 1_000_000).toFixed(1)}M` : '—', 
              ltc: senior?.ltc ? `${senior.ltc}%` : capitalStructure?.ltc ? `${capitalStructure.ltc}%` : '—', 
              rate: senior?.rate ? `${senior.rate}%` : capitalStructure?.interestRate ? `${capitalStructure.interestRate}%` : '—' 
            },
            { 
              tier: 'Mezzanine', c: 'border-cyan-400', tc: 'text-cyan-600', 
              amt: mezz?.amount ? `$${(mezz.amount / 1_000_000).toFixed(1)}M` : '—', 
              ltc: mezz?.ltc ? `${mezz.ltc}%` : '—', 
              rate: mezz?.rate ? `${mezz.rate}%` : '—' 
            },
            { 
              tier: 'Equity', c: 'border-emerald-400', tc: 'text-emerald-600', 
              amt: equity?.amount ? `$${(equity.amount / 1_000_000).toFixed(1)}M` : capitalStructure?.totalEquity ? `$${(capitalStructure.totalEquity / 1_000_000).toFixed(1)}M` : '—', 
              ltc: equity?.ltc ? `${equity.ltc}%` : capitalStructure?.ltc ? `${100 - capitalStructure.ltc}%` : '—', 
              rate: equity?.targetReturn ? `${equity.targetReturn}%` : '—' 
            },
          ];
        })().map((t, i) => (
          <div key={i} className={`bg-white p-4 border-t-2 ${t.c}`}>
            <div className={`text-[10px] font-bold tracking-wider mb-2 ${t.tc}`}>
              {t.tier} <span className="text-stone-400 font-normal">({t.ltc} LTC)</span>
            </div>
            <div className="text-xl font-bold text-stone-900 font-mono mb-1">{t.amt}</div>
            <div className="text-[10px] text-stone-400">{t.rate}</div>
          </div>
        ))}
      </div>

      <SectionHead title="Due Diligence + Module Access" accentColor="border-amber-500" />
      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">DD CHECKLIST</div>
          {deal?.stateData?.ddItems && deal.stateData.ddItems.length > 0 ? (
            deal.stateData.ddItems.map((item: any, i: number) => (
              <DDItem key={i} label={item.l} done={item.done} />
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-stone-400 mb-1">No checklist items added yet</p>
              <button onClick={() => navigateToTab('dd-checklist')} className="text-[10px] text-amber-600 hover:text-amber-700 font-medium">
                Add DD Items &rarr;
              </button>
            </div>
          )}
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">MODULE ACCESS</div>
          {[
            { key: 'F2', label: 'PROPERTY & ZONING', hint: 'Parcels · Entitlement · Setbacks', tab: 'zoning' },
            { key: 'F3', label: 'MARKET & DEMAND', hint: 'Trade area · Absorption · Rents', tab: 'market' },
            { key: 'F4', label: 'SUPPLY PIPELINE', hint: 'Pipeline · Threat level · Capacity', tab: 'supply' },
            { key: 'F6', label: 'PRO FORMA', hint: '3-layer NOI model · Sensitivity', tab: 'proforma' },
            { key: 'F7', label: 'CAPITAL STRUCTURE', hint: 'Debt · Equity waterfall', tab: 'capital-structure' },
            { key: 'F8', label: 'RISK ASSESSMENT', hint: 'Monte Carlo · Insurance · Supply', tab: 'risk' },
            { key: 'F9', label: 'SALE COMPS', hint: 'Transaction intelligence', tab: 'comps' },
          ].map((m, i) => (
            <button key={i} onClick={() => navigateToTab(m.tab)}
              className="w-full flex items-center gap-3 py-2 px-2 border-b border-stone-100 last:border-0 hover:bg-stone-50 transition-colors text-left group">
              <span className="text-[9px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">{m.key}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">{m.label}</div>
                <div className="text-[9px] text-stone-400">{m.hint}</div>
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
    <div className="space-y-0">
      <SectionHead
        title="Site + Zoning Constraints"
        right={`${lotSize} · ${deal.address ? deal.address.split(',').slice(1, 3).join(',').trim() : ''}`}
        accentColor="border-cyan-500"
      />
      <div className="grid grid-cols-6 gap-px bg-stone-200">
        <KVCard label="Max Units (Zoned)" value={maxUnits > 0 ? `${maxUnits}u` : '—'} valueColor="text-cyan-600" note={`${lotSize}`} compact />
        <KVCard label="FAR" value={farValue} note={maxUnits > 0 && activeScenario?.parkingRequired ? `Parking: ${(activeScenario.parkingRequired / maxUnits).toFixed(1)} / unit` : undefined} compact />
        <KVCard label="Entitlement ETA" value={entitlementBenchmarks?.p50 ? `${entitlementBenchmarks.p50}-${entitlementBenchmarks.p75 || entitlementBenchmarks.p50 + 2} mo` : '—'} valueColor="text-amber-600" note={entitlementBenchmarks?.p50 ? `Based on ${entitlementBenchmarks.municipality || 'local'} benchmarks` : 'No benchmark data'} compact />
        <KVCard label="Target IRR (BTS)" value={buildingConfig.btsIrr} valueColor="text-emerald-600" note={`${buildingConfig.btsEm} equity multiple`} noteColor="text-emerald-500" compact />
        <KVCard label="TDC / Unit" value={buildingConfig.tdcUnit} note={`${buildingConfig.units} planned units`} compact />
        <KVCard label="Zoning" value={zoningProfile?.baseDistrictCode || '—'} valueColor="text-stone-700" compact />
      </div>

      <SectionHead title="Entitlement Pipeline" right="M02 Zoning Intelligence" accentColor="border-amber-500" />
      <div className="bg-white p-5">
        {hasEntitlements ? (
        <div className="flex items-center relative">
          <div className="absolute top-3 left-[10%] right-[10%] h-0.5 bg-stone-200 z-0" />
          {entitlementSteps.map((step, i) => {
            const c = step.done ? 'border-emerald-500 bg-emerald-50' : step.active ? 'border-amber-500 bg-amber-50' : 'border-stone-300 bg-stone-50';
            const tc = step.done ? 'text-emerald-600' : step.active ? 'text-amber-600' : 'text-stone-400';
            return (
              <div key={i} className="flex-1 flex flex-col items-center z-10">
                <div className={`w-7 h-7 rounded-full border-2 ${c} flex items-center justify-center ${step.active ? 'ring-2 ring-amber-200 ring-offset-1' : ''}`}>
                  <span className={`text-xs font-bold ${tc}`}>{step.done ? '✓' : i + 1}</span>
                </div>
                <div className={`text-[9px] mt-2 text-center leading-tight max-w-[70px] ${tc} font-medium`}>{step.n}</div>
              </div>
            );
          })}
        </div>
        ) : (
        <div className="text-center py-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            {entitlementSteps.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-7 h-7 rounded-full border-2 border-stone-200 bg-stone-50 flex items-center justify-center">
                  <span className="text-xs font-bold text-stone-300">{i + 1}</span>
                </div>
                <div className="text-[9px] mt-1 text-stone-300 font-medium">{step.n}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-2">No entitlements filed yet</p>
          <button onClick={() => navigateToTab('zoning')} className="text-[10px] text-amber-600 hover:text-amber-700 font-medium mt-1">
            Start Entitlement Process &rarr;
          </button>
        </div>
        )}
      </div>

      <SectionHead 
        title="Building Configuration" 
        right={
          <button 
            onClick={() => navigateToTab('design')} 
            className="text-[10px] text-violet-600 hover:text-violet-700 font-medium"
          >
            Edit in 3D Design →
          </button>
        } 
        accentColor="border-violet-500" 
      />
      
      {/* Selected configuration from Dev Capacity + 3D Module */}
      <div className="bg-white border border-stone-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-stone-900">{buildingConfig.label}</span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
              {buildingConfig.units} UNITS
            </span>
          </div>
          {buildingConfig.design3DStatus === 'configured' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              3D Design Configured
            </span>
          ) : (
            <button 
              onClick={() => navigateToTab('design')}
              className="text-[10px] font-medium text-amber-600 hover:text-amber-700"
            >
              Configure 3D Design →
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-px bg-stone-200">
          {[
            { l: 'Floors', v: `${buildingConfig.floors} stories`, c: 'text-stone-700' },
            { l: 'Height', v: buildingConfig.height, c: 'text-stone-700' },
            { l: 'Construction', v: buildingConfig.constructionType, c: 'text-stone-600', small: true },
            { l: 'Parking', v: `${buildingConfig.parkingSpaces} spaces`, c: 'text-stone-600' },
          ].map((m, i) => (
            <div key={i} className="bg-white p-3">
              <div className="text-[9px] font-mono text-stone-400 tracking-wider uppercase">{m.l}</div>
              <div className={`${m.small ? 'text-xs' : 'text-sm'} font-bold ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-4 gap-px bg-stone-200">
          {[
            { l: 'Total Dev Cost', v: buildingConfig.tdc, c: 'text-amber-600' },
            { l: 'TDC / Unit', v: buildingConfig.tdcUnit, c: 'text-amber-600' },
            { l: 'BTS IRR', v: buildingConfig.btsIrr, c: 'text-emerald-600' },
            { l: 'BTS EM', v: buildingConfig.btsEm, c: 'text-emerald-600' },
          ].map((m, i) => (
            <div key={i} className="bg-white p-3">
              <div className="text-[9px] font-mono text-stone-400 tracking-wider uppercase">{m.l}</div>
              <div className={`text-sm font-bold font-mono ${m.c}`}>{m.v}</div>
            </div>
          ))}
        </div>
        
        {(buildingConfig.grossSqft || buildingConfig.efficiency) && (
          <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-4 text-[10px] text-stone-500">
            {buildingConfig.grossSqft && <span>Gross SF: <strong className="text-stone-700">{buildingConfig.grossSqft.toLocaleString()}</strong></span>}
            {buildingConfig.efficiency && <span>Efficiency: <strong className="text-stone-700">{(buildingConfig.efficiency * 100).toFixed(0)}%</strong></span>}
          </div>
        )}
      </div>

      <SectionHead title="Unit Mix Program" right={unitMix.length > 0 ? `${buildingConfig.units} units · Based on ${buildingConfig.label}` : 'No data yet'} accentColor="border-cyan-500" />
      <div className="bg-white border border-stone-200">
        {unitMix.length > 0 ? (
        <>
        <div className="flex border-b border-stone-200">
          {unitMix.map((u, i) => (
            <div key={i} className="flex-1 py-2 px-3 text-center border-r border-stone-200 last:border-r-0" style={{ flex: parseInt(u.pct) }}>
              <div className={`text-[10px] font-bold ${u.color}`}>{u.type}</div>
              <div className="text-xs text-stone-500">{u.pct} · {u.units}u</div>
            </div>
          ))}
        </div>
        <div className="flex h-2">
          {unitMix.map((u, i) => (
            <div key={i} className={`${u.bg} opacity-40`} style={{ flex: parseInt(u.pct) }} />
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                {['UNIT TYPE', 'COUNT', 'MIX %', 'AVG SQFT', 'TARGET RENT', 'RENT PSF', 'MONTHLY REV', 'ANN. REVENUE'].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-[9px] font-mono text-stone-400 tracking-wider font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unitMix.map((u, i) => (
                <tr key={i} className={`border-b border-stone-100 ${i % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`}>
                  <td className={`px-3 py-2 font-bold ${u.color}`}>{u.type}</td>
                  <td className="px-3 py-2 text-stone-600">{u.units}</td>
                  <td className="px-3 py-2 text-stone-600">{u.pct}</td>
                  <td className="px-3 py-2 text-stone-600">{u.sqft.toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold text-amber-600">${u.targetRent.toLocaleString()}</td>
                  <td className="px-3 py-2 text-stone-500">${u.rentPsf.toFixed(2)}</td>
                  <td className="px-3 py-2 font-bold text-stone-700">${(u.targetRent * u.units).toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold text-stone-700">${(u.targetRent * u.units * 12).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-stone-100 border-t-2 border-stone-300 font-bold">
                <td className="px-3 py-2 text-stone-800">TOTAL / AVG</td>
                <td className="px-3 py-2 text-stone-800">{totalUnitCount}</td>
                <td className="px-3 py-2 text-stone-800">100%</td>
                <td className="px-3 py-2 text-stone-800">{avgSqft.toLocaleString()}</td>
                <td className="px-3 py-2 text-amber-600">${avgRent.toLocaleString()}</td>
                <td className="px-3 py-2 text-stone-500">${avgPsf}</td>
                <td className="px-3 py-2 text-amber-600">${totalRevMo.toLocaleString()}</td>
                <td className="px-3 py-2 text-amber-600">${(totalRevMo * 12).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </>
        ) : (
        <div className="text-center py-6">
          <p className="text-xs text-stone-400 mb-1">No unit mix data available</p>
          <p className="text-[10px] text-stone-300 mb-2">Run the Development Capacity Builder or upload a proforma to generate unit mix</p>
          <button onClick={() => navigateToTab('unit-mix')} className="text-[10px] text-cyan-600 hover:text-cyan-700 font-medium">
            Configure Unit Mix &rarr;
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
              <SectionHead title="Competitive Set" right="No comps" accentColor="border-emerald-500" />
              <div className="bg-white border border-stone-200 text-center py-6">
                <p className="text-xs text-stone-400 mb-1">No rent comps data available</p>
                <p className="text-[10px] text-stone-300 mb-2">Comps are sourced from the Unit Mix Intelligence module</p>
                <button onClick={() => navigateToTab('unit-mix')} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium">
                  Analyze Rent Comps &rarr;
                </button>
              </div>
            </>
          );
        }

        return (
          <>
            <SectionHead title="Competitive Set · Ranked by $/SF" right={`#${subjectRank} of ${allRows.length} · ${rentComps.length} comps`} accentColor="border-emerald-500" />
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['#', 'PROPERTY', 'DIST', 'UNITS', 'AVG RENT', 'AVG SF', '$/SF', 'OCC', 'ANN. TRAFFIC'].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-[9px] font-mono text-stone-400 tracking-wider font-bold ${i <= 1 ? 'text-left' : 'text-right'} ${i === 1 ? 'min-w-[160px]' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row, ri) => (
                    <tr key={ri} className={row.isSubject
                      ? 'bg-blue-50/70 border-b border-blue-200 border-l-2 border-l-blue-500'
                      : `border-b border-stone-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'}`
                    }>
                      <td className={`px-3 py-2 font-bold font-mono ${row.isSubject ? 'text-blue-700' : 'text-stone-400'}`}>{ri + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className={`text-xs font-semibold ${row.isSubject ? 'text-blue-800' : 'text-stone-800'}`}>{row.name}</div>
                            {row.isSubject ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[7px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded tracking-wider">SUBJECT</span>
                                <span className="text-[8px] text-blue-500">{row.note}</span>
                              </div>
                            ) : (
                              <div className="text-[9px] text-stone-400">{row.units}u · {row.vintage}{row.note ? ` · ${row.note}` : ''}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-2 text-right ${row.isSubject ? 'text-blue-600' : 'text-stone-500'}`}>{row.dist}</td>
                      <td className={`px-3 py-2 text-right ${row.isSubject ? 'text-blue-700 font-bold' : 'text-stone-600'}`}>{row.units}</td>
                      <td className={`px-3 py-2 text-right font-bold ${row.isSubject ? 'text-blue-700' : 'text-amber-600'}`}>${row.avgRent.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right ${row.isSubject ? 'text-blue-600' : 'text-stone-600'}`}>{row.avgSf.toLocaleString()}</td>
                      <td className={`px-3 py-2 text-right font-bold ${row.isSubject ? 'text-blue-800' : 'text-stone-800'}`}>${row.psf.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        {row.occ === '—' ? (
                          <span className={row.isSubject ? 'text-blue-400' : 'text-stone-300'}>—</span>
                        ) : (
                          <span className={`font-bold ${parseFloat(row.occ) >= 95 ? 'text-emerald-600' : parseFloat(row.occ) >= 90 ? 'text-amber-600' : 'text-orange-500'}`}>{row.occ}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right ${row.isSubject ? 'text-blue-600' : 'text-stone-500'}`}>{row.traffic.toLocaleString()}</td>
                    </tr>
                  ))}

                  <tr className="bg-stone-100 border-t-2 border-stone-300 font-bold">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-stone-700">COMP AVERAGE</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-stone-600">{compAvgUnits}</td>
                    <td className="px-3 py-2 text-right text-amber-600">${compAvgRent.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-stone-600">{compAvgSf.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-stone-800">${compAvgPsf.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {compAvgOcc === '—' ? <span className="text-stone-300">—</span> : <span className="text-stone-600">{compAvgOcc}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-stone-500">{compAvgTraffic.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        );
      })()}

      <SectionHead title="Development Budget + Timeline" right={hasTimelineData ? `TDC ${buildingConfig.tdc} · ${constructionDur}mo build · ${absorptionDur}mo absorption` : `TDC ${buildingConfig.tdc}`} accentColor="border-amber-500" />
      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-4">BUDGET STACK</div>
          {(() => {
            const landAmt = financial?.landCost || deal.purchasePrice || 0;
            const hardAmt = financial?.hardCosts || 0;
            const softAmt = financial?.softCosts || 0;
            const tdc = financial?.totalDevelopmentCost || (landAmt + hardAmt + softAmt) || 0;
            const contingency = tdc > 0 && hardAmt > 0 ? Math.round(tdc * 0.08) : 0;
            const hasReal = tdc > 0 && hardAmt > 0;
            const items = hasReal ? [
              { l: 'Land / Acquisition', v: `$${(landAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((landAmt / tdc) * 100), c: 'bg-violet-500' },
              { l: 'Hard Costs', v: `$${(hardAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((hardAmt / tdc) * 100), c: 'bg-amber-500' },
              { l: 'Soft Costs', v: `$${(softAmt / 1_000_000).toFixed(1)}M`, pct: Math.round((softAmt / tdc) * 100), c: 'bg-cyan-500' },
              { l: 'Contingency (8%)', v: `$${(contingency / 1_000_000).toFixed(1)}M`, pct: 8, c: 'bg-orange-500' },
            ] : [
              { l: 'Land / Acquisition', v: landCost !== '—' ? landCost : '—', pct: 25, c: 'bg-violet-500' },
              { l: 'Hard Costs', v: '—', pct: 25, c: 'bg-amber-500' },
              { l: 'Soft Costs', v: '—', pct: 25, c: 'bg-cyan-500' },
              { l: 'Contingency', v: '—', pct: 25, c: 'bg-orange-500' },
            ];
            return items;
          })().map((r, i) => (
            <div key={i} className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-stone-600">{r.l}</span>
                <span className="text-xs font-bold text-stone-800">{r.v}</span>
              </div>
              <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-3 border-t border-stone-200 mt-2">
            <span className="text-xs font-bold text-stone-800">TOTAL DEV COST</span>
            <span className="text-lg font-bold text-amber-600 font-mono">
              {financial?.totalDevelopmentCost ? `$${(financial.totalDevelopmentCost / 1_000_000).toFixed(1)}M` : buildingConfig.tdc}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 mt-1">{buildingConfig.tdcUnit}/unit{constructionDur > 0 ? ` · ${constructionDur}mo construction` : ''}</div>
        </div>

        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-4">DEVELOPMENT TIMELINE</div>
          {hasTimelineData ? timeline.map((ph, i) => {
            const left = (ph.start / TOTAL_MO) * 100;
            const width = (ph.dur / TOTAL_MO) * 100;
            const barColor = ph.status === 'done' ? 'bg-emerald-500' : ph.status === 'active' ? 'bg-amber-500' : 'bg-stone-300';
            const textColor = ph.status === 'done' ? 'text-emerald-600' : ph.status === 'active' ? 'text-amber-600' : 'text-stone-400';
            return (
              <div key={i} className="flex items-center gap-3 mb-2">
                <span className="text-[10px] text-stone-600 w-28 text-right flex-shrink-0">{ph.phase}</span>
                <div className="flex-1 h-5 bg-stone-100 relative rounded overflow-hidden">
                  <div className={`absolute h-full ${barColor} opacity-30 rounded`}
                    style={{ left: `${left}%`, width: `${width}%` }} />
                  <div className={`absolute h-full border-l-2 ${ph.status === 'done' ? 'border-emerald-500' : ph.status === 'active' ? 'border-amber-500' : 'border-stone-300'} flex items-center pl-1.5`}
                    style={{ left: `${left}%`, width: `${width}%` }}>
                    <span className={`text-[8px] font-bold ${textColor}`}>{ph.dur}mo</span>
                  </div>
                </div>
                <span className={`text-[8px] font-bold w-12 text-right ${textColor}`}>
                  {ph.status === 'done' ? '✓' : ph.status === 'active' ? 'ACTIVE' : ''}
                </span>
              </div>
            );
          }) : (
            <div className="text-center py-4">
              <p className="text-xs text-stone-400 mb-1">Timeline data not available</p>
              <p className="text-[10px] text-stone-300">Add entitlement benchmarks and deal assumptions to generate timeline</p>
            </div>
          )}
          {hasTimelineData && (
          <div className="flex gap-0 mt-3 border-t border-stone-100 pt-2 pl-[124px] pr-12">
            {[0, 6, 12, 18, 24, 30, 36, 42, 48].filter(m => m <= TOTAL_MO + 6).map(m => (
              <div key={m} className="flex-1 text-[8px] text-stone-400 font-mono">M{m}</div>
            ))}
          </div>
          )}
        </div>
      </div>

      <SectionHead title="Returns Comparison + Site Diligence" right="M09 ProForma · M11 Capital" accentColor="border-amber-500" />
      <div className="grid grid-cols-2 gap-px bg-stone-200">
        <div className="bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-amber-700 tracking-wider">BUILD-TO-SELL</span>
                <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">WIN</span>
              </div>
              {[
                { l: 'Revenue', v: '$52.8M' },
                { l: 'Margin', v: '30.4%' },
                { l: 'IRR', v: financial?.irr ? `${financial.irr.toFixed(1)}%` : buildingConfig.btsIrr, c: 'text-emerald-600' },
                { l: 'EM', v: financial?.equityMultiple ? `${financial.equityMultiple.toFixed(1)}x` : buildingConfig.btsEm, c: 'text-emerald-600' },
              ].map((r, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span className="text-[10px] text-stone-500">{r.l}</span>
                  <span className={`text-xs font-bold ${r.c || 'text-amber-600'}`}>{r.v}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
              <div className="text-[10px] font-semibold text-stone-500 tracking-wider mb-3">HOLD AS RENTAL</div>
              {[
                { l: 'Stab. NOI', v: financial?.noi ? `$${financial.noi.toLocaleString()}` : '$2,890,000' },
                { l: 'YOC', v: buildingConfig.yoc || "—" },
                { l: 'Hold IRR', v: '18.4%' },
              ].map((r, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span className="text-[10px] text-stone-500">{r.l}</span>
                  <span className="text-xs font-semibold text-stone-600">{r.v}</span>
                </div>
              ))}
              <div className="text-[9px] text-stone-400 mt-3 leading-relaxed border-t border-stone-200 pt-2">
                BTS outperforms · Exit cap 5.0%
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-3">SITE DILIGENCE ITEMS</div>
          {(deal?.stateData?.ddItems || [
            { l: 'Site Control / Title', done: true },
            { l: 'Zoning Pre-Application', done: true },
            { l: 'Geotech / Survey', done: false },
            { l: 'HOA / CDD Review', done: false },
            { l: 'Utility Capacity Confirm', done: true },
            { l: 'Soft Cost Budget', done: false },
          ]).map((item: any, i: number) => (
            <DDItem key={i} label={item.l} done={item.done} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewSection;
