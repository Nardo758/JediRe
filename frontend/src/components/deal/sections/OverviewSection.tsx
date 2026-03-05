/**
 * Overview Section - Enhanced Deal Intelligence Dashboard (M01)
 *
 * Single-glance deal assessment following the Data → Insight → Action pattern.
 * Shows JEDI Score verdict, 5-signal breakdown, strategy recommendation,
 * top risk alert, and contextual quick stats.
 *
 * Decision this page drives: "Should I spend 5 more minutes on this deal?"
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDealModule } from '../../../contexts/DealModuleContext';
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
  enhancedQuickStats as mockQuickStats,
  type JEDIScoreData,
  type SignalScore,
  type StrategyVerdictData,
  type RiskAlertData,
  type EnhancedQuickStat,
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
      description: `${def.name} signal score: ${Math.round(score)}/100`,
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
  const { capitalStructure, strategy: strategyCtx } = useDealModule();

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [jediScoreData, setJediScoreData] = useState<JEDIScoreData>(mockJediScore);
  const [signals, setSignals] = useState<SignalScore[]>(mockSignalScores);
  const [strategyVerdict] = useState<StrategyVerdictData>(mockStrategyVerdict);
  const [riskAlert] = useState<RiskAlertData>(mockRiskAlert);
  const [quickStats] = useState<EnhancedQuickStat[]>(mockQuickStats);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'loading' | 'live' | 'sample'>('loading');

  useEffect(() => {
    if (!deal?.id) return;

    let stopPolling: (() => void) | undefined;

    const runAnalysis = async () => {
      stopPolling = await startAnalysis();
    };
    runAnalysis();
    loadJediScore();

    return () => {
      stopPolling?.();
    };
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
        (results) => {
          setStrategyResults(results);
          setAnalysisComplete(true);
        },
        2000
      );

      return stopPolling;
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisStatus({
        phase: 'error',
        progress: 0,
        message: 'Failed to start analysis',
        error: (error as Error).message,
      });
    }
  };

  const handleStrategySelection = useCallback((strategyId: string) => {
    onStrategySelected?.(strategyId);
  }, [onStrategySelected]);

  const navigateToTab = useCallback((tabId: string) => {
    onTabChange?.(tabId);
  }, [onTabChange]);

  return (
    <div className="space-y-5">
      {/* Data Source Badge */}
      {dataSource !== 'loading' && (
        <div className="flex justify-end">
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

      {/* Property Details Form - Essential Inputs */}
      <PropertyDetailsForm dealId={deal?.id} />

      {/* Analysis Status (only during loading) */}
      {!analysisComplete && (
        <ActionStatusPanel
          status={analysisStatus}
          dealType={deal.developmentType || 'Development'}
          propertyType={deal.propertyTypeKey || 'Multifamily'}
          onComplete={() => setAnalysisComplete(true)}
        />
      )}

      {/* Row 1: JEDI Score Hero + Strategy Verdict */}
      <div className="grid grid-cols-3 gap-5">
        {/* JEDI Score Hero (2 cols) */}
        <div className="col-span-2 bg-stone-900 rounded-xl p-6 text-white">
          <div className="flex items-start gap-6">
            {/* Score Gauge */}
            <JEDIScoreGauge score={jediScoreData.score} />

            {/* Score Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-sm font-bold tracking-wide ${jediScoreData.verdictColor}`}>
                  {jediScoreData.verdict}
                </span>
                {jediScoreData.delta30d !== 0 && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                    jediScoreData.delta30d > 0 ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {jediScoreData.delta30d > 0 ? '+' : ''}{jediScoreData.delta30d} pts (30d)
                  </span>
                )}
              </div>

              <p className="text-stone-400 text-xs mb-4">
                Score trending {jediScoreData.delta30d > 0 ? 'UP' : 'DOWN'} because{' '}
                {jediScoreData.delta30d > 0
                  ? '2 demand events hit this trade area in 30 days'
                  : 'supply pipeline increased'}.
                Confidence: {jediScoreData.confidenceLabel} ({jediScoreData.confidence}%)
              </p>

              {/* 5-Signal Breakdown Bar */}
              <div className="mb-3">
                <div className="flex h-3 rounded-full overflow-hidden">
                  {signals.map((s) => (
                    <button
                      key={s.id}
                      className={`${s.color} transition-opacity hover:opacity-80`}
                      style={{ width: `${s.weight}%` }}
                      onClick={() => navigateToTab(s.moduleLink)}
                      title={`${s.name}: ${s.score}/100 (${s.weight}% weight)`}
                    />
                  ))}
                </div>
              </div>

              {/* Signal Labels */}
              <div className="flex gap-1">
                {signals.map((s) => (
                  <button
                    key={s.id}
                    className="flex-1 text-center group"
                    onClick={() => navigateToTab(s.moduleLink)}
                  >
                    <div className="text-[10px] text-stone-500 group-hover:text-stone-300 transition-colors">
                      {s.name} ({s.weight}%)
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm font-bold text-stone-200">{s.score}</span>
                      {s.trend !== 'flat' && (
                        <span className={`text-[9px] ${s.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {s.trend === 'up' ? '+' : ''}{s.trendDelta}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Verdict Card (1 col) */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="text-[10px] font-mono text-stone-400 tracking-widest mb-2">STRATEGY VERDICT</div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold text-stone-900">{strategyVerdict.recommendedLabel}</span>
            <span className="text-sm font-mono text-amber-600">{strategyVerdict.score}</span>
          </div>

          <div className="text-xs text-stone-500 mb-3">
            vs {strategyVerdict.secondBestLabel}: {strategyVerdict.secondBestScore}
          </div>

          {strategyVerdict.isArbitrage && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-amber-600 font-bold text-xs">ARBITRAGE</span>
                <span className="text-amber-700 text-xs font-mono">+{strategyVerdict.arbitrageGap}pt gap</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">{strategyVerdict.insight}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs border-t border-stone-100 pt-3">
            <div>
              <span className="text-stone-400">{strategyVerdict.roiLabel}: </span>
              <span className="font-bold text-stone-700">{strategyVerdict.roiEstimate}</span>
            </div>
            <button
              className="text-amber-600 hover:text-amber-700 font-medium"
              onClick={() => navigateToTab('strategy')}
            >
              Compare All 4 &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Top Risk Alert (conditional) */}
      {riskAlert.show && <TopRiskAlertBanner alert={riskAlert} onNavigate={navigateToTab} />}

      {/* Capital Structure Summary (M11+ → M01) */}
      {capitalStructure?.structureSummary && (
        <button
          className="w-full bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-indigo-300 transition-colors text-left group"
          onClick={() => navigateToTab('capital-structure')}
        >
          <div>
            <div className="text-[10px] font-mono text-indigo-500 tracking-widest mb-0.5">CAPITAL STRUCTURE</div>
            <div className="text-sm font-semibold text-indigo-900 group-hover:text-indigo-700">
              {capitalStructure.structureSummary}
            </div>
          </div>
          <div className="text-indigo-400 text-xs font-medium">View Details →</div>
        </button>
      )}

      {/* Row 3: Quick Stats Grid (4 columns with context) */}
      <div className="grid grid-cols-4 gap-4">
        {quickStats.map((stat, idx) => (
          <button
            key={idx}
            className="bg-white rounded-lg border border-stone-200 p-4 text-left hover:border-stone-300 transition-colors group"
            onClick={() => stat.moduleLink && navigateToTab(stat.moduleLink)}
          >
            <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{stat.label}</div>
            <div className="text-xl font-bold text-stone-900 mb-1 group-hover:text-amber-700 transition-colors">
              {stat.value}
            </div>
            <div className={`text-[11px] leading-snug ${
              stat.contextColor === 'green' ? 'text-emerald-600' :
              stat.contextColor === 'amber' ? 'text-amber-600' :
              stat.contextColor === 'red' ? 'text-red-600' :
              'text-stone-500'
            }`}>
              {stat.context}
            </div>
          </button>
        ))}
      </div>

      {/* Row 4: Strategy Results (from analysis engine) */}
      {strategyResults && (
        <StrategyAnalysisResults
          results={strategyResults}
          dealType={deal.developmentType || 'Development'}
          onChooseStrategy={handleStrategySelection}
        />
      )}

      {/* Row 5: Signal Detail Cards */}
      <div className="grid grid-cols-5 gap-3">
        {signals.map((signal) => (
          <SignalDetailCard key={signal.id} signal={signal} onNavigate={navigateToTab} />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

/** Circular JEDI Score gauge */
const JEDIScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const scoreColor = score >= 85 ? '#10b981' : score >= 70 ? '#d97706' : score >= 55 ? '#a8a29e' : '#ef4444';

  return (
    <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" className="-rotate-90">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="#292524" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={radius} fill="none"
          stroke={scoreColor} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-[9px] text-stone-500 font-mono tracking-wider">JEDI SCORE</span>
      </div>
    </div>
  );
};

/** Top Risk Alert Banner */
const TopRiskAlertBanner: React.FC<{
  alert: RiskAlertData;
  onNavigate: (tab: string) => void;
}> = ({ alert, onNavigate }) => {
  const severityColors = {
    low: 'bg-stone-50 border-stone-200 text-stone-700',
    medium: 'bg-amber-50 border-amber-200 text-amber-800',
    high: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className={`rounded-xl border p-4 ${severityColors[alert.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wide">
              {alert.severity === 'high' ? 'HIGH RISK' : 'RISK ALERT'}
            </span>
            <span className="text-xs font-mono opacity-75">
              {alert.category}: {alert.score}/{alert.maxScore}
            </span>
          </div>
          <p className="text-sm mb-1">{alert.detail}</p>
          {alert.mitigationAvailable && (
            <p className="text-xs opacity-75">
              Offset: {alert.mitigationText}
            </p>
          )}
        </div>
        <button
          className="text-xs font-medium hover:underline flex-shrink-0 ml-4"
          onClick={() => onNavigate('risk')}
        >
          Risk Dashboard &rarr;
        </button>
      </div>
    </div>
  );
};

/** Signal Detail Card */
const SignalDetailCard: React.FC<{
  signal: SignalScore;
  onNavigate: (tab: string) => void;
}> = ({ signal, onNavigate }) => (
  <button
    className={`${signal.bgColor} rounded-lg p-3 text-left hover:ring-1 hover:ring-stone-300 transition-all group`}
    onClick={() => onNavigate(signal.moduleLink)}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-mono text-stone-400 tracking-wider">{signal.name.toUpperCase()}</span>
      <span className={`text-[9px] font-mono ${
        signal.trend === 'up' ? 'text-emerald-600' : signal.trend === 'down' ? 'text-red-500' : 'text-stone-400'
      }`}>
        {signal.trend === 'up' ? '+' : signal.trend === 'down' ? '' : ''}{signal.trendDelta !== 0 ? signal.trendDelta : '--'}
      </span>
    </div>
    <div className="text-lg font-bold text-stone-800 mb-1">{signal.score}</div>
    <p className="text-[10px] text-stone-500 leading-relaxed line-clamp-2 group-hover:text-stone-700 transition-colors">
      {signal.description}
    </p>
  </button>
);

export default OverviewSection;
