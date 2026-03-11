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
  jediScore as mockJediScore,
  signalScores as mockSignalScores,
  strategyVerdict as mockStrategyVerdict,
  topRiskAlert as mockRiskAlert,
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
  const { capitalStructure, strategy: strategyCtx, financial, market, design3D, activeScenario, zoningProfile } = useDealModule();

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [jediScoreData, setJediScoreData] = useState<JEDIScoreData>(mockJediScore);
  const [signals, setSignals] = useState<SignalScore[]>(mockSignalScores);
  const [strategyVerdict, setStrategyVerdict] = useState<StrategyVerdictData>(mockStrategyVerdict);
  const [riskAlert, setRiskAlert] = useState<RiskAlertData>(mockRiskAlert);
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
    return () => { stopPolling?.(); };
  }, [deal?.id]);

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
        setDataSource('sample');
      }
    } catch (err) {
      console.warn('Could not load JEDI score, using sample data:', err);
      setDataSource('sample');
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
    if (!strategyResults?.strategies?.length) return;
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
  }, [strategyResults]);

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

      <PropertyDetailsForm dealId={deal?.id} />

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
        ? <ExistingOverview deal={deal} navigateToTab={navigateToTab} capitalStructure={capitalStructure} financial={financial} market={market} />
        : <DevOverview deal={deal} navigateToTab={navigateToTab} financial={financial} design3D={design3D} activeScenario={activeScenario} zoningProfile={zoningProfile} />
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
  jediScore: JEDIScoreData;
  signals: SignalScore[];
  strategyVerdict: StrategyVerdictData;
  riskAlert: RiskAlertData;
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
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-2">STRATEGY VERDICT</div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold text-stone-900">{strategyVerdict.recommendedLabel}</span>
            <span className="text-sm font-mono text-amber-600">{strategyVerdict.score}</span>
          </div>
          <div className="text-xs text-stone-500 mb-2">
            vs {strategyVerdict.secondBestLabel}: {strategyVerdict.secondBestScore}
          </div>

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

      {riskAlert.show && (
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
}

const ExistingOverview: React.FC<ExistingOverviewProps> = ({ deal, navigateToTab, capitalStructure, financial, market }) => {
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
          {[
            { l: 'Going-In Cap Rate', v: capRate, c: 'text-amber-600' },
            { l: 'Market Cap Rate', v: '—', c: 'text-stone-600' },
            { l: 'Implied Value at Mkt Cap', v: '—', c: 'text-emerald-600', note: 'vs ask' },
          ].map((r, i) => (
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
        {[
          { tier: 'Senior Debt', c: 'border-blue-400', tc: 'text-blue-600', amt: capitalStructure?.loanBalance?.[0] ? `$${(capitalStructure.loanBalance[0] / 1_000_000).toFixed(1)}M` : '—', ltc: capitalStructure?.ltc ? `${capitalStructure.ltc}%` : '—', rate: capitalStructure?.debtYield ? `${capitalStructure.debtYield}%` : '—' },
          { tier: 'Mezzanine', c: 'border-cyan-400', tc: 'text-cyan-600', amt: '—', ltc: '—', rate: '—' },
          { tier: 'Equity', c: 'border-emerald-400', tc: 'text-emerald-600', amt: capitalStructure?.totalEquity ? `$${(capitalStructure.totalEquity / 1_000_000).toFixed(1)}M` : '—', ltc: capitalStructure?.ltc ? `${100 - capitalStructure.ltc}%` : '—', rate: '—' },
        ].map((t, i) => (
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
          {(deal?.stateData?.ddItems || [
            { l: 'Phase I Environmental', done: false },
            { l: 'Structural Inspection', done: false },
            { l: 'Lease Audit', done: false },
            { l: 'Insurance Binder', done: false },
            { l: 'Zoning Confirmation Letter', done: false },
            { l: 'Debt Term Sheet', done: false },
          ]).map((item: any, i: number) => (
            <DDItem key={i} label={item.l} done={item.done} />
          ))}
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
}

const DevOverview: React.FC<DevOverviewProps> = ({ deal, navigateToTab, financial, design3D, activeScenario, zoningProfile }) => {
  const [selectedPathId, setSelectedPathId] = useState('P1');

  const zoningStore = useZoningModuleStore();
  const { comps: unitMixComps, program: unitMixProgram, zoning: unitMixZoning, loading: unitMixLoading } = useUnitMixIntelligence(deal?.id, deal?.tradeAreaId);

  const zoningMaxUnits = activeScenario?.maxUnits || unitMixZoning?.maxUnits || zoningStore.selected_path_data?.maxUnits || null;
  const zoningFar = activeScenario?.appliedFar || zoningProfile?.appliedFar || zoningStore.selected_path_data?.appliedFar || null;

  const maxUnits = zoningMaxUnits || deal.targetUnits || 186;
  const lotSize = deal.acres ? `${deal.acres} ac` : '—';
  const landCost = financial?.landCost
    ? `$${(financial.landCost / 1_000_000).toFixed(1)}M`
    : deal.purchasePrice ? `$${(deal.purchasePrice / 1_000_000).toFixed(1)}M` : '—';
  const farValue = zoningFar ? zoningFar.toFixed(1) : '2.0';

  const devPaths = [
    {
      id: 'P1', label: '5-Over-1 Mid-Rise', recommended: true,
      desc: '5 wood-frame residential floors over 1-story concrete podium. Optimal for FL Class B+ suburban markets.',
      units: maxUnits, floors: 6, height: '63 ft', parking: 'Tuck-under + surface',
      tdc: '$40.5M', tdcUnit: `$${Math.round(40500000 / maxUnits).toLocaleString()}`, btsIrr: '28.1%', btsEm: '3.2x', yoc: '7.1%',
      pros: ['Highest unit count at max density', 'Cost-efficient wood frame above podium', 'Proven absorption in corridor'],
      cons: ['Podium concrete cost premium vs garden', 'Elevator / corridor required'],
      fitScore: 91,
    },
    {
      id: 'P2', label: 'Garden Style (3-Story)',
      desc: '3-story walk-up, surface parking. Lower construction cost but significantly fewer units at this density.',
      units: Math.round(maxUnits * 0.74), floors: 3, height: '38 ft', parking: 'Surface',
      tdc: '$26.8M', tdcUnit: `$${Math.round(26800000 / Math.round(maxUnits * 0.74)).toLocaleString()}`, btsIrr: '21.4%', btsEm: '2.6x', yoc: '6.2%',
      pros: ['Lower hard cost / unit', 'Simpler construction timeline', 'No elevator maintenance'],
      cons: ['18% fewer units vs zoning max', 'Lower revenue ceiling', 'Surface parking consumes lot area'],
      fitScore: 67,
    },
    {
      id: 'P3', label: 'Urban Mid-Rise (8-Story)',
      desc: 'Concrete construction 8-story tower. Requires density waiver; suburban market may not support premium.',
      units: Math.round(maxUnits * 1.13), floors: 8, height: '88 ft', parking: 'Structured garage',
      tdc: '$58.2M', tdcUnit: `$${Math.round(58200000 / Math.round(maxUnits * 1.13)).toLocaleString()}`, btsIrr: '18.8%', btsEm: '2.1x', yoc: '5.8%',
      pros: ['Maximum unit count', 'Premium positioning', 'Future infill option'],
      cons: ['Requires density variance', 'Concrete cost 40% premium', 'Market may not support $2,400+ rents'],
      fitScore: 42,
    },
  ];

  const activePath = devPaths.find(p => p.id === selectedPathId) || devPaths[0];

  const unitMix = (() => {
    const colors: Record<string, { color: string; bg: string }> = {
      studio: { color: 'text-violet-600', bg: 'bg-violet-500' },
      oneBR: { color: 'text-cyan-600', bg: 'bg-cyan-500' },
      twoBR: { color: 'text-emerald-600', bg: 'bg-emerald-500' },
      threeBR: { color: 'text-orange-600', bg: 'bg-orange-500' },
    };
    const labels: Record<string, string> = { studio: 'Studio', oneBR: '1 BR', twoBR: '2 BR', threeBR: '3 BR' };

    if (unitMixProgram?.units && Object.keys(unitMixProgram.units).length > 0) {
      const totalU = unitMixProgram.totalUnits || activePath.units;
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
      const totalU = design3D.totalUnits || activePath.units;
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

    return [
      { type: 'Studio', units: Math.round(activePath.units * 0.10), pct: '10%', sqft: 548, targetRent: 1595, rentPsf: 2.91, ...colors.studio },
      { type: '1 BR', units: Math.round(activePath.units * 0.40), pct: '40%', sqft: 768, targetRent: 1875, rentPsf: 2.44, ...colors.oneBR },
      { type: '2 BR', units: Math.round(activePath.units * 0.40), pct: '40%', sqft: 1082, targetRent: 2295, rentPsf: 2.12, ...colors.twoBR },
      { type: '3 BR', units: Math.round(activePath.units * 0.10), pct: '10%', sqft: 1344, targetRent: 2695, rentPsf: 2.01, ...colors.threeBR },
    ];
  })();

  const totalUnitCount = unitMix.reduce((a, u) => a + u.units, 0) || 1;
  const totalRevMo = unitMix.reduce((a, u) => a + u.targetRent * u.units, 0);
  const avgSqft = Math.round(unitMix.reduce((a, u) => a + u.sqft * u.units, 0) / totalUnitCount);
  const avgRent = Math.round(totalRevMo / totalUnitCount);
  const avgPsf = (unitMix.reduce((a, u) => a + u.rentPsf * u.units, 0) / totalUnitCount).toFixed(2);

  const storeEntitlements = zoningStore.entitlements || [];
  const entitlementSteps = (() => {
    const steps = [
      { n: 'Pre-Application', key: 'pre_application' },
      { n: 'Application Filed', key: 'submitted' },
      { n: 'Staff Review', key: 'under_review' },
      { n: 'Public Hearing', key: 'hearing' },
      { n: 'Approved', key: 'approved' },
    ];
    if (storeEntitlements.length > 0) {
      const latestStatus = storeEntitlements[0]?.status || 'pre_application';
      const statusOrder = ['pre_application', 'submitted', 'under_review', 'hearing', 'approved'];
      const activeIdx = statusOrder.indexOf(latestStatus);
      return steps.map((s, i) => ({
        n: s.n,
        done: i < activeIdx || (i === activeIdx && latestStatus === 'approved'),
        active: i === activeIdx && latestStatus !== 'approved',
      }));
    }
    return [
      { n: 'Pre-Application', done: true, active: false },
      { n: 'Application Filed', done: false, active: true },
      { n: 'Staff Review', done: false, active: false },
      { n: 'Public Hearing', done: false, active: false },
      { n: 'Approved', done: false, active: false },
    ];
  })();

  const timeline = [
    { phase: 'LOI / Contract', start: 0, dur: 2, status: 'active' },
    { phase: 'Entitlement', start: 2, dur: 9, status: 'pending' },
    { phase: 'Permits + GMP', start: 11, dur: 3, status: 'pending' },
    { phase: 'Construction', start: 14, dur: 22, status: 'pending' },
    { phase: 'Absorption / Sale', start: 36, dur: 14, status: 'pending' },
  ];
  const TOTAL_MO = 50;

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
    return [
      { name: 'Comp A — Nearest', dist: '0.4mi', units: 232, vintage: 2021, occ: '96%', mix: { Studio: { rent: 1565, sqft: 540 }, '1 BR': { rent: 1845, sqft: 760 }, '2 BR': { rent: 2250, sqft: 1070 }, '3 BR': { rent: 2640, sqft: 1330 } }, note: 'Lease-up stabilized 11mo' },
      { name: 'Comp B — 1mi radius', dist: '1.2mi', units: 288, vintage: 2022, occ: '94%', mix: { Studio: { rent: 1580, sqft: 552 }, '1 BR': { rent: 1860, sqft: 775 }, '2 BR': { rent: 2275, sqft: 1095 }, '3 BR': { rent: 2670, sqft: 1355 } }, note: '2BR demand strongest' },
      { name: 'Comp C — 2mi radius', dist: '2.1mi', units: 196, vintage: 2020, occ: '97%', mix: { Studio: { rent: 1490, sqft: 530 }, '1 BR': { rent: 1780, sqft: 745 }, '2 BR': { rent: 2190, sqft: 1055 }, '3 BR': { rent: 2580, sqft: 1310 } }, note: 'Fully leased. Waitlisted' },
      { name: 'Comp D — 3mi radius', dist: '3.4mi', units: 340, vintage: 2019, occ: '93%', mix: { Studio: { rent: 1450, sqft: 515 }, '1 BR': { rent: 1720, sqft: 730 }, '2 BR': { rent: 2120, sqft: 1035 }, '3 BR': { rent: 2490, sqft: 1285 } }, note: 'Older vintage' },
      { name: 'Comp E — Newest', dist: '4.1mi', units: 174, vintage: 2023, occ: '89%', mix: { Studio: { rent: 1640, sqft: 565 }, '1 BR': { rent: 1920, sqft: 790 }, '2 BR': { rent: 2340, sqft: 1110 }, '3 BR': { rent: 2750, sqft: 1370 } }, note: 'Sets market ceiling' },
    ];
  })();

  return (
    <div className="space-y-0">
      <SectionHead
        title="Site + Zoning Constraints"
        right={`${lotSize} · ${deal.address ? deal.address.split(',').slice(1, 3).join(',').trim() : ''}`}
        accentColor="border-cyan-500"
      />
      <div className="grid grid-cols-6 gap-px bg-stone-200">
        <KVCard label="Max Units (Zoned)" value={`${maxUnits}u`} valueColor="text-cyan-600" note={`${lotSize}`} compact />
        <KVCard label="FAR" value={farValue} note={`Parking: ${activeScenario?.parkingRequired ? (activeScenario.parkingRequired / maxUnits).toFixed(1) : '1.5'} / unit`} compact />
        <KVCard label="Entitlement ETA" value="8-10 mo" valueColor="text-amber-600" note="72% confidence" compact />
        <KVCard label="Target IRR (BTS)" value={activePath.btsIrr} valueColor="text-emerald-600" note={`${activePath.btsEm} equity multiple`} noteColor="text-emerald-500" compact />
        <KVCard label="TDC / Unit" value={activePath.tdcUnit} note={`${activePath.units} planned units`} compact />
        <KVCard label="Land Cost" value={landCost} valueColor="text-stone-900" compact />
      </div>

      <SectionHead title="Entitlement Pipeline" right="M02 Zoning Intelligence" accentColor="border-amber-500" />
      <div className="bg-white p-5">
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
      </div>

      <SectionHead title="Recommended Development Path" right={`${devPaths.length} paths evaluated · AI recommendation active`} accentColor="border-violet-500" />
      <div className="flex gap-px bg-stone-200">
        {devPaths.map(p => (
          <button key={p.id} onClick={() => setSelectedPathId(p.id)}
            className={`flex-1 py-2.5 px-3 text-center transition-all border-t-[3px] ${
              selectedPathId === p.id
                ? `${p.recommended ? 'border-emerald-500' : 'border-amber-500'} bg-stone-50`
                : 'border-transparent bg-white hover:bg-stone-50'
            }`}>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`text-xs font-bold ${selectedPathId === p.id ? 'text-stone-900' : 'text-stone-500'}`}>{p.label}</span>
              {p.recommended && (
                <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded tracking-wider">AI PICK</span>
              )}
              <span className={`text-sm font-bold font-mono ${
                p.fitScore >= 80 ? 'text-emerald-600' : p.fitScore >= 60 ? 'text-amber-600' : 'text-stone-400'
              }`}>{p.fitScore}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-200 p-4">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-xs text-stone-600 leading-relaxed mb-4">{activePath.desc}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: 'Units', v: activePath.units, c: 'text-cyan-600', bc: 'border-cyan-300' },
                { l: 'Floors', v: `${activePath.floors} stories`, c: 'text-stone-700', bc: 'border-stone-300' },
                { l: 'Height', v: activePath.height, c: 'text-stone-700', bc: 'border-stone-300' },
                { l: 'Parking', v: activePath.parking, c: 'text-stone-500', bc: 'border-stone-300', small: true },
                { l: 'Total Dev Cost', v: activePath.tdc, c: 'text-amber-600', bc: 'border-amber-300' },
                { l: 'TDC / Unit', v: activePath.tdcUnit, c: 'text-amber-600', bc: 'border-amber-300' },
                { l: 'BTS IRR', v: activePath.btsIrr, c: 'text-emerald-600', bc: 'border-emerald-300' },
                { l: 'BTS EM', v: activePath.btsEm, c: 'text-emerald-600', bc: 'border-emerald-300' },
              ].map((m, i) => (
                <div key={i} className={`p-2 bg-stone-50 border-l-2 ${m.bc}`}>
                  <div className="text-[9px] font-mono text-stone-400 tracking-wider">{m.l}</div>
                  <div className={`${m.small ? 'text-xs' : 'text-sm'} font-bold font-mono ${m.c}`}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-600 tracking-wider mb-2">ADVANTAGES</div>
            {activePath.pros.map((p, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-stone-100 last:border-0 items-start">
                <span className="text-emerald-500 text-xs flex-shrink-0">+</span>
                <span className="text-xs text-stone-600">{p}</span>
              </div>
            ))}
            <div className="text-[10px] font-bold text-red-500 tracking-wider mt-4 mb-2">TRADE-OFFS</div>
            {activePath.cons.map((c, i) => (
              <div key={i} className="flex gap-2 py-1.5 border-b border-stone-100 last:border-0 items-start">
                <span className="text-orange-400 text-xs flex-shrink-0">—</span>
                <span className="text-xs text-stone-400">{c}</span>
              </div>
            ))}

            <div className="mt-4">
              <div className="text-[9px] font-mono text-stone-400 tracking-widest font-bold mb-2">PATH COMPARISON</div>
              {devPaths.map(p => (
                <button key={p.id} onClick={() => setSelectedPathId(p.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded text-left transition-colors ${
                    selectedPathId === p.id ? 'bg-stone-100 border border-stone-300' : 'bg-stone-50 border border-stone-200 hover:bg-stone-100'
                  }`}>
                  <span className="text-xs text-stone-600 flex-1">{p.label}</span>
                  <span className="text-[10px] text-stone-400 font-mono">{p.units}u</span>
                  <span className="text-[10px] font-bold text-emerald-600 font-mono">{p.btsIrr}</span>
                  <span className={`text-xs font-bold font-mono ${p.fitScore >= 80 ? 'text-emerald-600' : p.fitScore >= 60 ? 'text-amber-600' : 'text-stone-400'}`}>{p.fitScore}</span>
                  {p.recommended && <span className="text-[7px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionHead title="Unit Mix Program" right={`${activePath.units} units · Based on ${activePath.label}`} accentColor="border-cyan-500" />
      <div className="bg-white border border-stone-200">
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

        const subjectRow = { name: deal.name || 'Subject Property', dist: '—', units: subjectTotalUnits, vintage: 0, occ: subjectOcc, avgRent: subjectWtdRent, avgSf: subjectWtdSf, psf: subjectPsf, note: `${activePath.label} · ${unitMix.length} unit types`, traffic: subjectTraffic, isSubject: true };

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

      <SectionHead title="Development Budget + Timeline" right={`TDC ${activePath.tdc} · 22mo build · 14mo absorption`} accentColor="border-amber-500" />
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
              { l: 'Land / Acquisition', v: landCost, pct: 10, c: 'bg-violet-500' },
              { l: 'Hard Costs', v: '$28.4M', pct: 70, c: 'bg-amber-500' },
              { l: 'Soft Costs', v: '$4.6M', pct: 11, c: 'bg-cyan-500' },
              { l: 'Contingency (10%)', v: '$3.3M', pct: 8, c: 'bg-orange-500' },
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
              {financial?.totalDevelopmentCost ? `$${(financial.totalDevelopmentCost / 1_000_000).toFixed(1)}M` : activePath.tdc}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 mt-1">{activePath.tdcUnit}/unit · 22mo construction</div>
        </div>

        <div className="bg-white p-4">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest font-bold mb-4">DEVELOPMENT TIMELINE</div>
          {timeline.map((ph, i) => {
            const left = (ph.start / TOTAL_MO) * 100;
            const width = (ph.dur / TOTAL_MO) * 100;
            const barColor = ph.status === 'active' ? 'bg-amber-500' : 'bg-stone-300';
            const textColor = ph.status === 'active' ? 'text-amber-600' : 'text-stone-400';
            return (
              <div key={i} className="flex items-center gap-3 mb-2">
                <span className="text-[10px] text-stone-600 w-28 text-right flex-shrink-0">{ph.phase}</span>
                <div className="flex-1 h-5 bg-stone-100 relative rounded overflow-hidden">
                  <div className={`absolute h-full ${barColor} opacity-30 rounded`}
                    style={{ left: `${left}%`, width: `${width}%` }} />
                  <div className={`absolute h-full border-l-2 ${ph.status === 'active' ? 'border-amber-500' : 'border-stone-300'} flex items-center pl-1.5`}
                    style={{ left: `${left}%`, width: `${width}%` }}>
                    <span className={`text-[8px] font-bold ${textColor}`}>{ph.dur}mo</span>
                  </div>
                </div>
                <span className={`text-[8px] font-bold w-12 text-right ${textColor}`}>
                  {ph.status === 'active' ? 'ACTIVE' : ''}
                </span>
              </div>
            );
          })}
          <div className="flex gap-0 mt-3 border-t border-stone-100 pt-2 pl-[124px] pr-12">
            {[0, 6, 12, 18, 24, 30, 36, 42, 48].map(m => (
              <div key={m} className="flex-1 text-[8px] text-stone-400 font-mono">M{m}</div>
            ))}
          </div>
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
                { l: 'IRR', v: financial?.irr ? `${financial.irr.toFixed(1)}%` : activePath.btsIrr, c: 'text-emerald-600' },
                { l: 'EM', v: financial?.equityMultiple ? `${financial.equityMultiple.toFixed(1)}x` : activePath.btsEm, c: 'text-emerald-600' },
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
                { l: 'YOC', v: activePath.yoc },
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
