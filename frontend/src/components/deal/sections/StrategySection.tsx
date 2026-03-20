/**
 * Strategy Section - Dual-Mode (Acquisition & Performance)
 * Investment strategy planning and execution tracking
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { useDealModule } from '../../../contexts/DealModuleContext';
import type { StrategyType } from '../../../contexts/DealModuleContext';
import { apiClient } from '../../../services/api.client';
import { getDealType, getAvailableStrategies, type StrategyId, type DealType } from '../../../shared/config/deal-type-visibility';
import CustomScreenTab from './CustomScreenTab';
import {
  strategyScores as mockStrategyScores,
  heatmapData as mockHeatmapData,
  signalNames as mockSignalNames,
  strategyNames as mockStrategyNames,
  roiHeadToHead as mockRoiHeadToHead,
  arbitrageAlert as mockArbitrageAlert,
  type StrategyScore as EnhancedStrategyScore,
  type HeatmapCell,
  type ROIMetric,
  type ArbitrageAlert,
} from '../../../data/enhancedStrategyMockData';
import {
  acquisitionStats as mockAcquisitionStats,
  performanceStats as mockPerformanceStats,
  strategyCards as mockStrategyCards,
  acquisitionImplementationTasks as mockAcquisitionImplementationTasks,
  performanceImplementationTasks as mockPerformanceImplementationTasks,
  acquisitionTimeline as mockAcquisitionTimeline,
  performanceStrategyProgress as mockPerformanceStrategyProgress,
  roiProjections as mockRoiProjections,
  riskFactors as mockRiskFactors,
  performanceRiskFactors as mockPerformanceRiskFactors,
  performanceOptimizations as mockPerformanceOptimizations,
  exitScenarios as mockExitScenarios,
  QuickStat,
  StrategyCard,
  ImplementationTask,
  TimelinePhase,
  StrategyProgress
} from '../../../data/strategyMockData';

interface StrategySectionProps {
  deal: Deal;
}

type TrafficGateStatus = 'qualified' | 'marginal' | 'disqualified';

interface TrafficGateData {
  status: TrafficGateStatus;
  trafficScore: number;
  threshold: number;
  reason: string;
}

interface QuadrantInfluence {
  quadrant: 'Hidden Gem' | 'Validated Winner' | 'Hype Risk' | 'Dead Weight';
  weightShift: number;
  direction: 'boost' | 'penalty' | 'neutral';
  explanation: string;
}

const MOCK_TRAFFIC_GATES: Record<string, TrafficGateData> = {
  'core': { status: 'qualified', trafficScore: 82, threshold: 60, reason: 'Strong walk-in traffic supports stable occupancy thesis' },
  'value-add': { status: 'qualified', trafficScore: 82, threshold: 55, reason: 'Current traffic volume validates post-renovation demand potential' },
  'opportunistic': { status: 'marginal', trafficScore: 82, threshold: 80, reason: 'Traffic barely meets threshold — high risk if post-reno traffic dips' },
  'development': { status: 'disqualified', trafficScore: 82, threshold: 90, reason: 'Insufficient foot traffic for ground-up lease-up timeline' },
  'bts': { status: 'qualified', trafficScore: 82, threshold: 50, reason: 'Submarket traffic supports rapid absorption on delivery' },
  'rental': { status: 'qualified', trafficScore: 82, threshold: 60, reason: 'Healthy traffic volume supports stabilized occupancy' },
  'flip': { status: 'marginal', trafficScore: 82, threshold: 75, reason: 'Traffic adequate but thin margin for quick resale positioning' },
  'str': { status: 'disqualified', trafficScore: 82, threshold: 85, reason: 'Digital traffic & tourist footfall below STR viability threshold' },
};

const MOCK_QUADRANT_INFLUENCES: Record<string, QuadrantInfluence> = {
  'core': { quadrant: 'Validated Winner', weightShift: 5, direction: 'boost', explanation: 'High traffic + high rent signals de-risk core thesis' },
  'value-add': { quadrant: 'Hidden Gem', weightShift: 12, direction: 'boost', explanation: 'Low rent but high traffic = untapped upside for value-add' },
  'opportunistic': { quadrant: 'Hype Risk', weightShift: -8, direction: 'penalty', explanation: 'High rent but declining traffic erodes repositioning play' },
  'development': { quadrant: 'Dead Weight', weightShift: -15, direction: 'penalty', explanation: 'Low traffic + low rent makes ground-up unlikely to pencil' },
  'bts': { quadrant: 'Hidden Gem', weightShift: 10, direction: 'boost', explanation: 'Underpriced submarket with strong foot traffic — ideal BTS exit' },
  'rental': { quadrant: 'Validated Winner', weightShift: 3, direction: 'boost', explanation: 'Strong traffic confirms rental demand sustainability' },
  'flip': { quadrant: 'Hype Risk', weightShift: -6, direction: 'penalty', explanation: 'Overpriced relative to traffic — flip margins compressed' },
  'str': { quadrant: 'Dead Weight', weightShift: -12, direction: 'penalty', explanation: 'Low digital visibility + weak tourism traffic kills STR thesis' },
};

// Map M08 strategy IDs → M11+ StrategyType for cross-module events
const STRATEGY_ID_TO_TYPE: Record<string, StrategyType> = {
  'core': 'rental_stabilized',
  'value-add': 'rental_value_add',
  'opportunistic': 'flip',
  'development': 'build_to_sell',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter strategy data based on available strategies for deal type
 */
function filterStrategyData(
  availableStrategies: StrategyId[],
  scores: EnhancedStrategyScore[],
  heatmap: HeatmapCell[],
  names: string[],
  roi: ROIMetric[]
) {
  const availableIds = availableStrategies.map(s => s.toLowerCase());

  return {
    filteredScores: scores.filter(s => availableIds.includes(s.id)),
    filteredHeatmap: heatmap.filter(h => availableIds.includes(h.strategy.toLowerCase())),
    filteredNames: names.filter(n => {
      const strategyId = scores.find(s => s.label.includes(n))?.id;
      return strategyId && availableIds.includes(strategyId);
    }),
    filteredROI: roi,
  };
}

/**
 * Compute arbitrage alert based on actual strategy scores
 */
function computeArbitrageAlert(
  scores: EnhancedStrategyScore[],
  originalAlert: ArbitrageAlert
): ArbitrageAlert {
  if (scores.length < 2) {
    return { ...originalAlert, show: false };
  }

  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0].score;
  const secondMaxScore = sorted[1].score;
  const delta = maxScore - secondMaxScore;

  if (delta > 15 && maxScore > 70) {
    return {
      ...originalAlert,
      show: true,
      recommended: sorted[0].label,
      delta,
    };
  }

  return { ...originalAlert, show: false };
}

type StrategyTab = 'overview' | 'signals' | 'returns' | 'custom';

interface CustomStrategy {
  id: string;
  name: string;
  description?: string;
  isPreset: boolean;
  conditions?: any[];
  scoreResult?: { matched: boolean; score: number };
}

export const StrategySection: React.FC<StrategySectionProps> = ({ deal }) => {
  const { mode, isPipeline, isOwned } = useDealMode(deal);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('value-add');
  const [activeTab, setActiveTab] = useState<StrategyTab>('overview');
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [scoreDealResult, setScoreDealResult] = useState<any[]>([]);
  const [scoreDealLoading, setScoreDealLoading] = useState(false);
  const { emitEvent, updateStrategy } = useDealModule();

  // Deal type and strategy filtering
  const dealType = useMemo(() => getDealType({ projectType: deal.projectType, dealType: deal.dealType }), [deal.projectType, deal.dealType]);
  const availableStrategies = useMemo(() => getAvailableStrategies(dealType), [dealType]);

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'scores' | 'heatmap' | 'roi' | 'custom'>('scores');

  // Custom strategies for CustomScreenTab
  interface CustomStrategyScore {
    strategyId: string;
    strategyName: string;
    score: number;
    matched: boolean;
    conditionResults: Array<{ conditionId: string; metricId: string; passed: boolean; score: number }>;
  }
  const [customStrategyScores, setCustomStrategyScores] = useState<CustomStrategyScore[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [strategyScores, setStrategyScores] = useState(mockStrategyScores);
  const [heatmapData, setHeatmapData] = useState(mockHeatmapData);
  const [signalNames, setSignalNames] = useState(mockSignalNames);
  const [strategyNames, setStrategyNames] = useState(mockStrategyNames);
  const [roiHeadToHead, setRoiHeadToHead] = useState(mockRoiHeadToHead);
  const [arbitrageAlert, setArbitrageAlert] = useState(mockArbitrageAlert);
  const [acquisitionStats, setAcquisitionStats] = useState(mockAcquisitionStats);
  const [performanceStats, setPerformanceStats] = useState(mockPerformanceStats);
  const [strategyCards, setStrategyCards] = useState(mockStrategyCards);
  const [acquisitionImplementationTasks, setAcquisitionImplementationTasks] = useState(mockAcquisitionImplementationTasks);
  const [performanceImplementationTasks, setPerformanceImplementationTasks] = useState(mockPerformanceImplementationTasks);
  const [acquisitionTimeline, setAcquisitionTimeline] = useState(mockAcquisitionTimeline);
  const [performanceStrategyProgress, setPerformanceStrategyProgress] = useState(mockPerformanceStrategyProgress);
  const [roiProjections, setRoiProjections] = useState(mockRoiProjections);
  const [riskFactors, setRiskFactors] = useState(mockRiskFactors);
  const [performanceRiskFactors, setPerformanceRiskFactors] = useState(mockPerformanceRiskFactors);
  const [performanceOptimizations, setPerformanceOptimizations] = useState(mockPerformanceOptimizations);
  const [exitScenarios, setExitScenarios] = useState(mockExitScenarios);

  useEffect(() => {
    const dealId = deal.id;
    if (!dealId) return;

    let cancelled = false;
    setIsLoading(true);

    apiClient.get(`/api/v1/strategy-analyses/${dealId}`)
      .then((response) => {
        if (cancelled) return;
        const result = response.data;
        if (result.success && result.data && result.data.length > 0) {
          const analyses = result.data;
          setIsLiveData(true);

          const liveStrategyScores = analyses
            .filter((a: any) => a.roi_metrics?.strategyScore)
            .map((a: any) => a.roi_metrics.strategyScore);
          if (liveStrategyScores.length > 0) {
            // Apply deal-type filtering
            const filtered = filterStrategyData(
              availableStrategies,
              liveStrategyScores,
              analyses.find((a: any) => a.roi_metrics?.heatmapData)?.roi_metrics?.heatmapData || mockHeatmapData,
              analyses.find((a: any) => a.roi_metrics?.strategyNames)?.roi_metrics?.strategyNames || mockStrategyNames,
              analyses.find((a: any) => a.roi_metrics?.roiHeadToHead)?.roi_metrics?.roiHeadToHead || mockRoiHeadToHead
            );
            setStrategyScores(filtered.filteredScores);
            setHeatmapData(filtered.filteredHeatmap);
            setStrategyNames(filtered.filteredNames);

            // Compute arbitrage from actual scores
            const computedAlert = computeArbitrageAlert(filtered.filteredScores, mockArbitrageAlert);
            setArbitrageAlert(computedAlert);
          }

          const liveHeatmap = analyses
            .filter((a: any) => a.roi_metrics?.heatmapData)
            .flatMap((a: any) => a.roi_metrics.heatmapData);
          if (liveHeatmap.length > 0 && liveStrategyScores.length === 0) {
            // Only set heatmap if we didn't already set it above
            setHeatmapData(liveHeatmap);
          }

          const liveSignalNames = analyses
            .find((a: any) => a.roi_metrics?.signalNames);
          if (liveSignalNames && liveStrategyScores.length === 0) setSignalNames(liveSignalNames.roi_metrics.signalNames);

          const liveStrategyNames = analyses
            .find((a: any) => a.roi_metrics?.strategyNames);
          if (liveStrategyNames && liveStrategyScores.length === 0) setStrategyNames(liveStrategyNames.roi_metrics.strategyNames);

          const liveRoiHeadToHead = analyses
            .find((a: any) => a.roi_metrics?.roiHeadToHead);
          if (liveRoiHeadToHead && liveStrategyScores.length === 0) setRoiHeadToHead(liveRoiHeadToHead.roi_metrics.roiHeadToHead);

          const liveAcquisitionStats = analyses
            .find((a: any) => a.assumptions?.acquisitionStats);
          if (liveAcquisitionStats) setAcquisitionStats(liveAcquisitionStats.assumptions.acquisitionStats);

          const livePerformanceStats = analyses
            .find((a: any) => a.assumptions?.performanceStats);
          if (livePerformanceStats) setPerformanceStats(livePerformanceStats.assumptions.performanceStats);

          const liveStrategyCards = analyses
            .filter((a: any) => a.assumptions?.strategyCard)
            .map((a: any) => a.assumptions.strategyCard);
          if (liveStrategyCards.length > 0) setStrategyCards(liveStrategyCards);

          const liveAcqTasks = analyses
            .find((a: any) => a.assumptions?.acquisitionImplementationTasks);
          if (liveAcqTasks) setAcquisitionImplementationTasks(liveAcqTasks.assumptions.acquisitionImplementationTasks);

          const livePerfTasks = analyses
            .find((a: any) => a.assumptions?.performanceImplementationTasks);
          if (livePerfTasks) setPerformanceImplementationTasks(livePerfTasks.assumptions.performanceImplementationTasks);

          const liveTimeline = analyses
            .find((a: any) => a.assumptions?.acquisitionTimeline);
          if (liveTimeline) setAcquisitionTimeline(liveTimeline.assumptions.acquisitionTimeline);

          const liveProgress = analyses
            .find((a: any) => a.assumptions?.performanceStrategyProgress);
          if (liveProgress) setPerformanceStrategyProgress(liveProgress.assumptions.performanceStrategyProgress);

          const liveRoi = analyses
            .find((a: any) => a.roi_metrics?.roiProjections);
          if (liveRoi) setRoiProjections(liveRoi.roi_metrics.roiProjections);

          const liveRisks = analyses
            .find((a: any) => a.assumptions?.riskFactors);
          if (liveRisks) setRiskFactors(liveRisks.assumptions.riskFactors);

          const livePerfRisks = analyses
            .find((a: any) => a.assumptions?.performanceRiskFactors);
          if (livePerfRisks) setPerformanceRiskFactors(livePerfRisks.assumptions.performanceRiskFactors);

          const liveOptimizations = analyses
            .find((a: any) => a.assumptions?.performanceOptimizations);
          if (liveOptimizations) setPerformanceOptimizations(liveOptimizations.assumptions.performanceOptimizations);

          const liveExitScenarios = analyses
            .find((a: any) => a.assumptions?.exitScenarios);
          if (liveExitScenarios) setExitScenarios(liveExitScenarios.assumptions.exitScenarios);
        }
      })
      .catch(() => {
        setIsLiveData(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [deal.id, availableStrategies]);

  // Fetch custom strategies when custom tab is opened
  useEffect(() => {
    if (activeTab !== 'custom') return;
    let cancelled = false;
    setCustomLoading(true);
    apiClient.get('/api/v1/strategies')
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) setCustomStrategies(res.data.strategies || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCustomLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  // Score deal against all strategies when custom tab opened
  useEffect(() => {
    if (activeTab !== 'custom' || !deal.id) return;
    let cancelled = false;
    setScoreDealLoading(true);
    apiClient.post(`/api/v1/strategies/score-deal/${deal.id}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) setScoreDealResult(res.data.data || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setScoreDealLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, deal.id]);

  // Column visibility based on deal project type
  const dealPT = (deal.projectType || '').toLowerCase();
  const showBTS = dealPT !== 'existing';
  const showFLIP = dealPT !== 'development';

  const visibleStrategyScores = strategyScores.filter((s) => {
    if (s.id === 'bts' && !showBTS) return false;
    if (s.id === 'flip' && !showFLIP) return false;
    return true;
  });

  const visibleStrategyNames = strategyNames.filter((name) => {
    const n = name.toLowerCase();
    if (n === 'bts' && !showBTS) return false;
    if (n === 'flip' && !showFLIP) return false;
    return true;
  });

  // M08 → M11+ strategy event: emit when user selects a strategy
  const handleStrategySelect = useCallback((strategyId: string) => {
    setSelectedStrategy(strategyId);
    const mappedType = STRATEGY_ID_TO_TYPE[strategyId] || 'rental_value_add';
    updateStrategy({ selectedStrategy: mappedType });
    emitEvent({
      source: 'M08-strategy-arbitrage',
      type: 'strategy-selected',
      payload: { strategy: mappedType, originalId: strategyId },
    });
  }, [emitEvent, updateStrategy]);

  // Select data based on mode
  const stats = isPipeline ? acquisitionStats : performanceStats;
  const tasks = isPipeline ? acquisitionImplementationTasks : performanceImplementationTasks;
  const risks = isPipeline ? riskFactors : performanceRiskFactors;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading strategy data...</span>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { id: StrategyTab; label: string; emoji: string }[] = [
    { id: 'overview', label: 'Overview', emoji: '📊' },
    { id: 'signals', label: 'Signals', emoji: '🔥' },
    { id: 'returns', label: 'Returns', emoji: '💰' },
    { id: 'custom', label: 'Custom Screen', emoji: '⚙️' },
  ];

  return (
    <div className="space-y-6 p-6">

      {/* Sub-tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{tab.emoji}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {isPipeline ? '🎯 Strategy Planning' : '📊 Strategy Execution'}
          </div>
          {isLiveData ? (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 tracking-wider">
              LIVE DATA
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 tracking-wider">
              SAMPLE DATA
            </div>
          )}
          {isOwned && (
            <div className="text-xs text-gray-500">
              Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Mock data notice */}
      {!isLiveData && (
        <div className="mx-4 mb-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-amber-700">Showing sample data — strategy scores will update when market intelligence modules are connected.</span>
        </div>
      )}

      {/* ======== SIGNALS TAB: Strategy Intelligence Layer ======== */}
      {isPipeline && activeTab === 'signals' && (
        <>
          {/* Arbitrage Alert Banner (conditional) */}
          {arbitrageAlert.show && <ArbitrageAlertBanner alert={arbitrageAlert} />}

          {/* Strategy Analysis Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 flex">
              {[
                { id: 'scores' as const, label: 'Score Matrix', icon: '📊' },
                { id: 'heatmap' as const, label: 'Signal Heatmap', icon: '🔥' },
                { id: 'roi' as const, label: 'ROI Head-to-Head', icon: '💰' },
                { id: 'custom' as const, label: 'Custom Screen', icon: '⚙️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex-1 px-4 py-3 font-medium transition-all text-sm flex items-center justify-center gap-2 ${
                    activeSubTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={tab.label}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* Score Matrix Tab */}
              {activeSubTab === 'scores' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-gray-900">4-Strategy Score Matrix</h3>
                    <span className="text-[10px] font-mono text-gray-400 tracking-widest">F23 × STRATEGY WEIGHTS</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-5">
                    Each strategy scored against 5 JEDI signals with strategy-specific weights
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {strategyScores.map((s) => (
                <div
                  key={s.id}
                  className={`${s.bgColor} rounded-xl p-5 border-2 ${s.rank === 1 ? s.borderColor : 'border-transparent'} relative`}
                >
                  {s.rank === 1 && (
                    <div className="absolute -top-2 left-3 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider">
                      RECOMMENDED
                    </div>
                  )}
                  <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.score}</div>
                  <div className="text-sm font-semibold text-gray-900 mb-2">{s.label}</div>
                  <div className="flex flex-col gap-1 mb-3">
                    <TrafficGateBadge strategyId={s.id} />
                    <T04QuadrantInfluencer strategyId={s.id} />
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>{s.roiLabel}:</span>
                      <span className="font-semibold text-gray-900">{s.roiValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hold:</span>
                      <span className="font-semibold text-gray-900">{s.holdPeriod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk:</span>
                      <span className={`font-semibold ${
                        s.riskLevel === 'low' ? 'text-emerald-600' :
                        s.riskLevel === 'medium' ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {s.riskLevel.charAt(0).toUpperCase() + s.riskLevel.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

                  {/* Insight */}
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Build-to-Sell scores 84 vs Rental at 69 — a 15-point gap that flags an Arbitrage Opportunity.
                      Zoning allows 3x density (M02), supply pipeline is thin for new construction (M04), and demand signals are strong (M06).
                      Most investors would default to Rental — the platform sees the development play.
                    </p>
                  </div>
                </div>
              )}

              {/* Heatmap Tab */}
              {activeSubTab === 'heatmap' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-gray-900">Signal Heatmap</h3>
                    <span className="text-[10px] font-mono text-gray-400 tracking-widest">5 SIGNALS × {strategyNames.length} STRATEGIES</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Weighted signal scores — darker cells indicate stronger contribution to strategy score
                  </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-mono text-gray-400">Signal</th>
                    {visibleStrategyNames.map(name => (
                      <th key={name} className="text-center py-2 px-3 text-xs font-mono text-gray-400">{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signalNames.map(signal => (
                    <tr key={signal} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium text-gray-700 text-xs">{signal}</td>
                      {visibleStrategyNames.map(strategy => {
                        const cell = heatmapData.find(c => c.signal === signal && c.strategy === strategy);
                        if (!cell) return <td key={strategy} />;
                        const bgClass =
                          cell.intensity === 'strong' ? 'bg-emerald-100 text-emerald-800' :
                          cell.intensity === 'moderate' ? 'bg-emerald-50 text-emerald-700' :
                          cell.intensity === 'weak' ? 'bg-gray-50 text-gray-600' :
                          'bg-red-50 text-red-600';
                        return (
                          <td key={strategy} className="py-1 px-1 text-center">
                            <div className={`${bgClass} rounded px-2 py-1.5 font-mono text-xs font-semibold`} title={cell.tooltip}>
                              {cell.weightedScore}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-gray-300 font-bold">
                    <td className="py-2 px-3 text-xs text-gray-700">TOTAL</td>
                    {strategyNames.map(strategy => {
                      const total = heatmapData
                        .filter(c => c.strategy === strategy)
                        .reduce((sum, c) => sum + c.weightedScore, 0);
                      return (
                        <td key={strategy} className="py-2 px-3 text-center text-sm font-bold text-gray-900">
                          {total.toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
                  </div>

                  <div className="mt-3 text-[11px] text-gray-400">
                    Hover any cell to see: raw score × strategy weight = weighted contribution.
                    This strategy dominates on Demand+Supply. Flip wins on Momentum. STR killed by regulatory risk.
                  </div>
                </div>
              )}

              {/* ROI Tab */}
              {activeSubTab === 'roi' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-gray-900">ROI Head-to-Head</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Key return metrics compared across available strategies</p>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-mono text-gray-400">Metric</th>
                  {visibleStrategyScores.map(s => (
                    <th key={s.id} className={`text-center py-2 px-3 text-xs font-semibold ${s.color}`}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roiHeadToHead.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2.5 px-3 text-xs font-medium text-gray-600">{row.label}</td>
                    {showBTS && (
                      <td className={`py-2.5 px-3 text-center text-xs ${row.bestStrategy === 'bts' ? 'font-bold text-amber-700 bg-amber-50' : 'text-gray-700'}`}>
                        {row.bts}
                      </td>
                    )}
                    <td className={`py-2.5 px-3 text-center text-xs ${row.bestStrategy === 'rental' ? 'font-bold text-blue-700 bg-blue-50' : 'text-gray-700'}`}>
                      {row.rental}
                    </td>
                    {showFLIP && (
                      <td className={`py-2.5 px-3 text-center text-xs ${row.bestStrategy === 'flip' ? 'font-bold text-emerald-700 bg-emerald-50' : 'text-gray-700'}`}>
                        {row.flip}
                      </td>
                    )}
                    <td className={`py-2.5 px-3 text-center text-xs ${row.bestStrategy === 'str' ? 'font-bold text-violet-700 bg-violet-50' : 'text-gray-700'}`}>
                      {row.str}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-800 leading-relaxed">
                      BTS yields 7.2% on cost with a 24-month exit to institutional buyer. Rental gives 8.5% CoC but ties up capital for 7+ years.
                      Risk-adjusted, BTS wins because you recycle capital 3x faster.
                    </p>
                  </div>
                </div>
              )}

              {/* Custom Screen Tab */}
              {activeSubTab === 'custom' && (
                <div>
                  <CustomScreenTab dealId={deal.id} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ======== OVERVIEW TAB: Strategy Cards ======== */}
      {isPipeline && activeTab === 'overview' && (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              📋 Strategy Options
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Compare different investment strategies for this opportunity
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategyCards.map((strategy) => (
                <StrategyCardComponent
                  key={strategy.id}
                  strategy={strategy}
                  isSelected={selectedStrategy === strategy.id}
                  onSelect={() => handleStrategySelect(strategy.id)}
                />
              ))}
            </div>
          </div>

          {/* ROI Comparison Chart */}
          <ROIComparisonChart projections={roiProjections} />

          {/* Implementation Timeline */}
          <TimelineVisualization timeline={acquisitionTimeline} />
        </>
      )}

      {/* ======== OVERVIEW TAB: Performance + Checklist + Risk ======== */}
      {isOwned && activeTab === 'overview' && (
        <>
          <StrategyProgressSection progress={performanceStrategyProgress} />
          <OptimizationsSection optimizations={performanceOptimizations} />
        </>
      )}

      {activeTab === 'overview' && (
        <>
          <ImplementationChecklist tasks={tasks} mode={mode} />
          <RiskAssessmentSection risks={risks} />
        </>
      )}

      {/* ======== RETURNS TAB ======== */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <ROIComparisonChart projections={roiProjections} />
          {isOwned && <ExitScenariosSection scenarios={exitScenarios} />}
          {!isOwned && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Exit Scenario Analysis</h3>
              <p className="text-sm text-blue-700">
                Exit scenarios become available once the deal moves to the Owned stage.
                ROI projections above are based on current pipeline assumptions.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ======== CUSTOM SCREEN TAB ======== */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Custom Strategy Screen</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Your saved strategies scored against this deal's market data
              </p>
            </div>
            {(customLoading || scoreDealLoading) && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            )}
          </div>

          {!customLoading && customStrategies.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <h4 className="text-base font-semibold text-gray-700 mb-2">No strategies yet</h4>
              <p className="text-sm text-gray-500">
                Create custom strategies in the Strategy Builder to see them scored here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customStrategies.map((strategy) => {
                const scoreData = scoreDealResult.find((r: any) => r.strategyId === strategy.id);
                const matched = scoreData?.matched ?? null;
                const score = scoreData?.score ?? null;
                return (
                  <div
                    key={strategy.id}
                    className={`bg-white rounded-lg border-2 p-4 flex items-start gap-4 ${
                      matched === true
                        ? 'border-emerald-300'
                        : matched === false
                        ? 'border-red-200'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${
                      matched === true ? 'bg-emerald-100 text-emerald-700' :
                      matched === false ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {matched === true ? '✓' : matched === false ? '✗' : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{strategy.name}</span>
                        {strategy.isPreset && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 tracking-wider">
                            PRESET
                          </span>
                        )}
                      </div>
                      {strategy.description && (
                        <p className="text-xs text-gray-500 mb-2">{strategy.description}</p>
                      )}
                      {score !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                            {score.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

interface QuickStatsGridProps {
  stats: QuickStat[];
}

const QuickStatsGrid: React.FC<QuickStatsGridProps> = ({ stats }) => {
  const formatValue = (stat: QuickStat): string => {
    switch (stat.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(stat.value as number);
      case 'percentage':
        return `${stat.value}%`;
      case 'years':
        return `${stat.value} years`;
      case 'number':
        return stat.value.toString();
      default:
        return stat.value.toString();
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            {stat.trend && (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                stat.trend.direction === 'up' 
                  ? 'bg-green-100 text-green-700'
                  : stat.trend.direction === 'down'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {stat.trend.value}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
          <div className="text-2xl font-bold text-gray-900">{formatValue(stat)}</div>
          {stat.subtext && (
            <div className="text-xs text-gray-500 mt-1">{stat.subtext}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const TrafficGateBadge: React.FC<{ strategyId: string }> = ({ strategyId }) => {
  const gate = MOCK_TRAFFIC_GATES[strategyId];
  if (!gate) return null;

  const config = {
    qualified: { icon: '✅', label: 'Qualified', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    marginal: { icon: '⚠️', label: 'Marginal', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    disqualified: { icon: '❌', label: 'Disqualified', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  }[gate.status];

  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.text} border ${config.border}`}>
        <span>{config.icon}</span>
        <span>TRAFFIC: {config.label.toUpperCase()}</span>
      </div>
      <div className="absolute z-20 bottom-full left-0 mb-1 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="font-semibold mb-1">Traffic Gate Evaluation</div>
        <div className="flex justify-between mb-1">
          <span>Score:</span>
          <span className="font-mono">{gate.trafficScore}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Threshold:</span>
          <span className="font-mono">{gate.threshold}</span>
        </div>
        <div className="text-gray-300 leading-relaxed">{gate.reason}</div>
      </div>
    </div>
  );
};

const T04QuadrantInfluencer: React.FC<{ strategyId: string }> = ({ strategyId }) => {
  const influence = MOCK_QUADRANT_INFLUENCES[strategyId];
  if (!influence) return null;

  const quadrantColors: Record<string, string> = {
    'Hidden Gem': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Validated Winner': 'bg-blue-50 text-blue-700 border-blue-200',
    'Hype Risk': 'bg-orange-50 text-orange-700 border-orange-200',
    'Dead Weight': 'bg-red-50 text-red-700 border-red-200',
  };

  const shiftColor = influence.direction === 'boost'
    ? 'text-emerald-600'
    : influence.direction === 'penalty'
    ? 'text-red-600'
    : 'text-gray-500';

  const shiftPrefix = influence.weightShift > 0 ? '+' : '';

  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${quadrantColors[influence.quadrant] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
        <span>T-04</span>
        <span>{influence.quadrant}</span>
        <span className={`font-mono ${shiftColor}`}>{shiftPrefix}{influence.weightShift}%</span>
      </div>
      <div className="absolute z-20 bottom-full left-0 mb-1 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="font-semibold mb-1">T-04 Quadrant Influence</div>
        <div className="flex justify-between mb-1">
          <span>Quadrant:</span>
          <span className="font-semibold">{influence.quadrant}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Weight Shift:</span>
          <span className={`font-mono font-semibold ${shiftColor}`}>{shiftPrefix}{influence.weightShift}%</span>
        </div>
        <div className="text-gray-300 leading-relaxed">{influence.explanation}</div>
      </div>
    </div>
  );
};

interface StrategyCardComponentProps {
  strategy: StrategyCard;
  isSelected: boolean;
  onSelect: () => void;
}

const StrategyCardComponent: React.FC<StrategyCardComponentProps> = ({
  strategy,
  isSelected,
  onSelect
}) => {
  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'very-high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`${strategy.bgColor} rounded-lg p-5 border-2 cursor-pointer transition ${
        isSelected ? strategy.borderColor : 'border-transparent'
      } hover:shadow-md`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{strategy.icon}</span>
          <div>
            <h4 className={`font-bold ${strategy.color} text-lg`}>{strategy.name}</h4>
            <div className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getRiskBadgeColor(strategy.riskLevel)}`}>
              {strategy.riskLevel.toUpperCase()} RISK
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <TrafficGateBadge strategyId={strategy.id} />
        <T04QuadrantInfluencer strategyId={strategy.id} />
      </div>

      <p className="text-sm text-gray-700 mb-4">{strategy.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Target IRR:</span>
          <span className="font-semibold text-gray-900">{strategy.targetIRR}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Hold Period:</span>
          <span className="font-semibold text-gray-900">{strategy.holdPeriod}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Capex Required:</span>
          <span className="font-semibold text-gray-900">
            ${(strategy.capexRequired / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Stabilization:</span>
          <span className="font-semibold text-gray-900">{strategy.timeToStabilize}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Key Features:</div>
        <ul className="space-y-1">
          {strategy.keyFeatures.map((feature, idx) => (
            <li key={idx} className="text-xs text-gray-600 flex items-start">
              <span className="mr-1">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-700 mb-2">Exit Strategies:</div>
        <div className="flex flex-wrap gap-1">
          {strategy.exitStrategy.map((exit, idx) => (
            <span
              key={idx}
              className="text-xs bg-white px-2 py-1 rounded border border-gray-300"
            >
              {exit}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ROIComparisonChartProps {
  projections: any[];
}

const ROIComparisonChart: React.FC<ROIComparisonChartProps> = ({ projections }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📊 ROI Comparison by Strategy
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Projected returns across different timeframes
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Strategy</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 1</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 3</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Year 5</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">At Exit</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Return</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{proj.strategy}</td>
                <td className={`text-right py-3 px-4 ${proj.year1 < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {proj.year1.toFixed(1)}%
                </td>
                <td className={`text-right py-3 px-4 ${proj.year3 < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {proj.year3.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-600">
                  {proj.year5.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-600 font-semibold">
                  {proj.exit.toFixed(1)}%
                </td>
                <td className="text-right py-3 px-4 text-green-700 font-bold">
                  {proj.totalReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-xs text-blue-900">
          💡 <span className="font-semibold">Note:</span> Negative returns in early years reflect capital deployment phase. Returns accelerate during stabilization and exit.
        </div>
      </div>
    </div>
  );
};

interface TimelineVisualizationProps {
  timeline: TimelinePhase[];
}

const TimelineVisualization: React.FC<TimelineVisualizationProps> = ({ timeline }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📅 Implementation Timeline
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        5-7 year value-add strategy execution plan
      </p>

      <div className="space-y-4">
        {timeline.map((phase, idx) => (
          <div key={idx} className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${phase.color}`}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{phase.name}</span>
                  <span className="text-sm text-gray-600">{phase.duration}</span>
                </div>
              </div>
            </div>
            
            <div className="ml-6 pl-3 border-l-2 border-gray-200 pb-2">
              <ul className="space-y-1">
                {phase.tasks.map((task, taskIdx) => (
                  <li key={taskIdx} className="text-sm text-gray-600 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Visual timeline bar */}
      <div className="mt-6 relative h-12 bg-gray-100 rounded-lg overflow-hidden">
        {timeline.map((phase, idx) => {
          const totalMonths = 72;
          const widthPercent = (phase.durationMonths / totalMonths) * 100;
          const leftPercent = (phase.startMonth / totalMonths) * 100;
          
          return (
            <div
              key={idx}
              className={`absolute top-0 h-full ${phase.color} opacity-80 flex items-center justify-center`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
            >
              <span className="text-xs font-semibold text-white text-center px-1">
                {phase.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Month 0</span>
        <span>Month 36</span>
        <span>Month 72</span>
      </div>
    </div>
  );
};

interface ImplementationChecklistProps {
  tasks: ImplementationTask[];
  mode: string;
}

const ImplementationChecklist: React.FC<ImplementationChecklistProps> = ({ tasks, mode }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in-progress': return '🔄';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'pending': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionPercent = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          ✅ Implementation Checklist
        </h3>
        <div className="text-sm font-semibold text-gray-700">
          {completedTasks} / {totalTasks} Complete ({completionPercent.toFixed(0)}%)
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`rounded-lg border p-4 ${getStatusColor(task.status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xl">{getStatusIcon(task.status)}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{task.task}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {task.assignee && (
                      <span>👤 {task.assignee}</span>
                    )}
                    {task.dueDate && (
                      <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityBadge(task.priority)}`}>
                {task.priority.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RiskAssessmentSectionProps {
  risks: any[];
}

const RiskAssessmentSection: React.FC<RiskAssessmentSectionProps> = ({ risks }) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-700 border-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        ⚠️ Risk Assessment
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Key risks and mitigation strategies
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risks.map((risk, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-4 ${getRiskColor(risk.level)}`}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{getRiskIcon(risk.level)}</span>
              <div>
                <h4 className="font-bold text-gray-900">{risk.category}</h4>
                <span className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getRiskColor(risk.level)}`}>
                  {risk.level.toUpperCase()} RISK
                </span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Risk:</span>
                <p className="text-gray-600 mt-1">{risk.description}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Mitigation:</span>
                <p className="text-gray-600 mt-1">{risk.mitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Overall Risk Profile:</span>
          {' '}Moderate risk with strong mitigation strategies in place. Regular monitoring and proactive management recommended.
        </div>
      </div>
    </div>
  );
};

interface StrategyProgressSectionProps {
  progress: StrategyProgress[];
}

const StrategyProgressSection: React.FC<StrategyProgressSectionProps> = ({ progress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-blue-500';
      case 'upcoming': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'upcoming': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        📊 Strategy Progress Tracker
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Track execution across major strategy phases
      </p>

      <div className="space-y-4">
        {progress.map((phase, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{phase.phase}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(phase.status)}`}>
                  {phase.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {phase.completedTasks} / {phase.totalTasks} tasks
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getStatusColor(phase.status)}`}
                    style={{ width: `${phase.percentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                {phase.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface OptimizationsSectionProps {
  optimizations: any[];
}

const OptimizationsSection: React.FC<OptimizationsSectionProps> = ({ optimizations }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented': return '✅';
      case 'in-progress': return '🔄';
      case 'planned': return '📋';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return 'bg-green-50 border-green-200';
      case 'in-progress': return 'bg-blue-50 border-blue-200';
      case 'planned': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const totalSavings = optimizations
    .filter(opt => opt.annualSavings && opt.status === 'implemented')
    .reduce((sum, opt) => sum + opt.annualSavings, 0);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          💡 Active Optimizations
        </h3>
        <div className="text-right">
          <div className="text-sm text-gray-600">Annual Impact (Implemented)</div>
          <div className="text-2xl font-bold text-green-600">
            +${(totalSavings / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {optimizations.map((opt, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 ${getStatusColor(opt.status)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{getStatusIcon(opt.status)}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">{opt.action}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    opt.category === 'Revenue' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {opt.category}
                  </span>
                </div>
                <div className="text-sm text-gray-700 font-medium">{opt.impact}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ExitScenariosSectionProps {
  scenarios: any[];
}

const ExitScenariosSection: React.FC<ExitScenariosSectionProps> = ({ scenarios }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        🎯 Exit Scenario Analysis
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Projected returns under different exit timing and market conditions
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-5 ${
              scenario.name === 'Base Case' 
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <h4 className="font-bold text-gray-900 text-lg mb-3">{scenario.name}</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Timing:</span>
                <span className="font-semibold text-gray-900">{scenario.timing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exit Cap:</span>
                <span className="font-semibold text-gray-900">{scenario.exitCap}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Proj. NOI:</span>
                <span className="font-semibold text-gray-900">
                  ${(scenario.projectedNOI / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sale Price:</span>
                <span className="font-semibold text-gray-900">
                  ${(scenario.salePrice / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Equity Multiple:</span>
                <span className="text-xl font-bold text-green-600">{scenario.equityMultiple}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">IRR:</span>
                <span className="text-xl font-bold text-green-600">{scenario.irr}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          💡 <span className="font-semibold">Recommendation:</span> Base case provides balanced risk/return profile. Monitor market conditions for opportunistic early exit if cap rates compress further.
        </div>
      </div>
    </div>
  );
};

/** Arbitrage Alert Banner — appears when F24 detects significant strategy gap */
const ArbitrageAlertBanner: React.FC<{ alert: ArbitrageAlert }> = ({ alert }) => (
  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5">
    <div className="flex items-start gap-4">
      <div className="text-3xl flex-shrink-0">&#9889;</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-amber-800 tracking-wide">ARBITRAGE DETECTED</span>
          <span className="text-xs font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
            +{alert.delta}pt gap
          </span>
        </div>
        <p className="text-sm text-amber-900 mb-2">
          <span className="font-semibold">{alert.recommendedLabel}</span> outscores{' '}
          <span className="font-semibold">{alert.defaultLabel}</span> by {alert.delta} points.{' '}
          {alert.insight}
        </p>
        <p className="text-xs text-amber-700">
          {alert.keyUnlock}
        </p>
      </div>
      <button className="flex-shrink-0 bg-amber-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
        Explore Arbitrage &rarr;
      </button>
    </div>
  </div>
);

export default StrategySection;
