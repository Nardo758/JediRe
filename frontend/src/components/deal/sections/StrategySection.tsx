/**
 * Strategy Section - Dual-Mode (Acquisition & Performance)
 * Investment strategy planning and execution tracking
 */

import { T as BT, mono as bMono, sans as bSans } from '../bloomberg-tokens';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Deal } from '../../../types/deal';
import { useDealMode } from '../../../hooks/useDealMode';
import { useDealModule } from '../../../contexts/DealModuleContext';
import type { StrategyType } from '../../../contexts/DealModuleContext';
import { apiClient } from '../../../services/api.client';
import { getDealType, getAvailableStrategies, type StrategyId, type DealType } from '../../../shared/config/deal-type-visibility';
import CustomScreenTab from './CustomScreenTab';
import type { M08StrategyScore, M08ArbitrageResult } from '../../../stores/dealStore';
import { useStrategyArbitrage } from '../../../hooks/useStrategyArbitrageM08';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ─── Inline types (removed mock file imports) ──────────────────────────────

interface QuickStat {
  label: string;
  value: number | string;
  format: 'currency' | 'percentage' | 'years' | 'number' | 'string';
  icon: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; value: string };
  subtext?: string;
}

interface StrategyCard {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  riskLevel: string;
  description: string;
  targetIRR: number;
  holdPeriod: string;
  capexRequired: number;
  timeToStabilize: string;
  keyFeatures: string[];
  exitStrategy: string[];
}

interface ImplementationTask {
  id: string;
  task: string;
  status: 'completed' | 'in-progress' | 'pending';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  dueDate?: string;
}

interface TimelinePhase {
  name: string;
  duration: string;
  durationMonths: number;
  startMonth: number;
  tasks: string[];
  color: string;
}

interface StrategyProgress {
  phase: string;
  status: 'completed' | 'active' | 'upcoming';
  percentage: number;
  completedTasks: number;
  totalTasks: number;
}

// ─── Static defaults (no longer imported from mock files) ──────────────────

const STATIC_ACQUISITION_STATS: QuickStat[] = [
  { label: 'Purchase Price', value: 4200000, format: 'currency', icon: '🏠', subtext: 'Negotiated' },
  { label: 'Target IRR', value: 18.5, format: 'percentage', icon: '📈', trend: { direction: 'up', value: '+2.1%' } },
  { label: 'Hold Period', value: 5, format: 'years', icon: '⏳' },
  { label: 'Cap Rate', value: 6.8, format: 'percentage', icon: '💰', subtext: 'Going-in' },
  { label: 'Units', value: 120, format: 'number', icon: '🏢' },
];

const STATIC_PERFORMANCE_STATS: QuickStat[] = [
  { label: 'Current NOI', value: 385000, format: 'currency', icon: '💵', trend: { direction: 'up', value: '+8.2%' } },
  { label: 'Occupancy', value: 94.2, format: 'percentage', icon: '🏠', trend: { direction: 'up', value: '+1.8%' } },
  { label: 'Avg Rent', value: 1850, format: 'currency', icon: '📊', subtext: '/unit/mo' },
  { label: 'Equity Value', value: 5800000, format: 'currency', icon: '📈', trend: { direction: 'up', value: '+38%' } },
  { label: 'Cash-on-Cash', value: 8.5, format: 'percentage', icon: '💰' },
];

const STATIC_STRATEGY_CARDS: StrategyCard[] = [
  {
    id: 'value-add', name: 'Value-Add Repositioning', icon: '🔨', color: 'text-amber-400',
    bgColor: 'bg-amber-900/20', borderColor: 'border-amber-400',
    riskLevel: 'medium', description: 'Light renovation + rent mark-to-market over 24–36 months.',
    targetIRR: 18.5, holdPeriod: '4–6 years', capexRequired: 800000, timeToStabilize: '24 months',
    keyFeatures: ['Unit interior upgrades', 'Amenity enhancement', 'Operational efficiency'],
    exitStrategy: ['Institutional sale', 'Recap to core buyer'],
  },
  {
    id: 'core', name: 'Core-Plus Hold', icon: '🏆', color: 'text-blue-400',
    bgColor: 'bg-blue-900/20', borderColor: 'border-blue-400',
    riskLevel: 'low', description: 'Stabilized asset with modest lease-up upside.',
    targetIRR: 12.0, holdPeriod: '7–10 years', capexRequired: 250000, timeToStabilize: '6 months',
    keyFeatures: ['Minimal capex', 'Strong cash yield', 'Below-market leases rolling'],
    exitStrategy: ['Core buyer', 'Public REIT'],
  },
];

const STATIC_ACQ_TASKS: ImplementationTask[] = [
  { id: '1', task: 'Complete Phase I Environmental', status: 'completed', priority: 'high' },
  { id: '2', task: 'Finalize renovation bids', status: 'in-progress', priority: 'high', assignee: 'PM Team' },
  { id: '3', task: 'Secure construction financing', status: 'pending', priority: 'medium' },
  { id: '4', task: 'Kick off unit renovation Phase 1', status: 'pending', priority: 'medium' },
];

const STATIC_PERF_TASKS: ImplementationTask[] = [
  { id: '1', task: 'Complete lease renewal campaign', status: 'completed', priority: 'high' },
  { id: '2', task: 'Install smart-home technology', status: 'in-progress', priority: 'medium', assignee: 'Ops' },
  { id: '3', task: 'Refinance at favorable rate', status: 'pending', priority: 'high' },
];

const STATIC_TIMELINE: TimelinePhase[] = [
  { name: 'Acquisition', duration: '3 months', durationMonths: 3, startMonth: 0, tasks: ['Due diligence', 'Financing close'], color: 'bg-blue-500' },
  { name: 'Renovation', duration: '18 months', durationMonths: 18, startMonth: 3, tasks: ['Unit upgrades', 'Amenity build-out'], color: 'bg-amber-500' },
  { name: 'Stabilization', duration: '12 months', durationMonths: 12, startMonth: 21, tasks: ['Lease-up', 'Rent optimization'], color: 'bg-green-500' },
  { name: 'Hold & Optimize', duration: '24 months', durationMonths: 24, startMonth: 33, tasks: ['NOI growth', 'Exit prep'], color: 'bg-purple-500' },
  { name: 'Exit', duration: '3 months', durationMonths: 3, startMonth: 57, tasks: ['Marketing', 'Close'], color: 'bg-red-500' },
];

const STATIC_PROGRESS: StrategyProgress[] = [
  { phase: 'Acquisition & Due Diligence', status: 'completed', percentage: 100, completedTasks: 8, totalTasks: 8 },
  { phase: 'Renovation & Value-Add', status: 'active', percentage: 65, completedTasks: 13, totalTasks: 20 },
  { phase: 'Stabilization', status: 'upcoming', percentage: 0, completedTasks: 0, totalTasks: 6 },
];

const STATIC_ROI_PROJECTIONS = [
  { strategy: 'Value-Add', year1: -2.1, year3: 8.4, year5: 14.2, exit: 18.5, totalReturn: 67.3 },
  { strategy: 'Core-Plus', year1: 5.8, year3: 7.2, year5: 8.1, exit: 12.0, totalReturn: 48.6 },
  { strategy: 'Opportunistic', year1: -8.5, year3: 12.3, year5: 19.8, exit: 24.5, totalReturn: 89.2 },
];

const STATIC_RISKS = [
  { category: 'Market Risk', level: 'medium', description: 'Softening demand amid new supply deliveries.', mitigation: 'Concession strategy + amenity differentiation.' },
  { category: 'Construction Risk', level: 'high', description: 'Material cost inflation may exceed budget.', mitigation: 'Fixed-price GC contract with 10% contingency.' },
  { category: 'Interest Rate Risk', level: 'medium', description: 'Floating rate debt exposure.', mitigation: 'Rate cap in place through Year 3.' },
  { category: 'Lease-up Risk', level: 'low', description: 'Submarket absorption historically strong.', mitigation: 'Pre-marketing campaign underway.' },
];

const STATIC_OPTIMIZATIONS = [
  { action: 'Solar carport installation', category: 'Revenue', status: 'implemented', annualSavings: 48000, impact: '$48K/yr utility savings' },
  { action: 'Utility bill-back program', category: 'Revenue', status: 'implemented', annualSavings: 62000, impact: '$62K/yr in RUBS income' },
  { action: 'Amenity fee rollout', category: 'Revenue', status: 'in-progress', impact: 'Projected $36/unit/mo' },
];

const STATIC_EXIT_SCENARIOS = [
  { name: 'Bull Case', timing: 'Year 4', exitCap: 4.75, projectedNOI: 485000, salePrice: 10200000, equityMultiple: 2.4, irr: 22.3 },
  { name: 'Base Case', timing: 'Year 5', exitCap: 5.25, projectedNOI: 450000, salePrice: 8570000, equityMultiple: 2.0, irr: 18.5 },
  { name: 'Bear Case', timing: 'Year 6', exitCap: 5.75, projectedNOI: 410000, salePrice: 7130000, equityMultiple: 1.6, irr: 12.8 },
];

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
  const [activeTab, setActiveTab] = useState<StrategyTab>('signals');
  const [customStrategies, setCustomStrategies] = useState<CustomStrategy[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [scoreDealResult, setScoreDealResult] = useState<any[]>([]);
  const [scoreDealLoading, setScoreDealLoading] = useState(false);
  const { emitEvent, updateStrategy } = useDealModule();

  // Deal type (kept for module event mapping)
  const dealType = useMemo(() => getDealType({ projectType: deal.projectType, dealType: deal.dealType }), [deal.projectType, deal.dealType]);

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<'scores' | 'heatmap' | 'roi' | 'custom'>('scores');

  // M08 live data via dedicated hook (handles fetch + auto-recalculate on mount)
  const {
    scores: m08Scores,
    arbitrage: m08Arbitrage,
    loading: strategyScoresLoading,
    recalculate: recalculateM08,
  } = useStrategyArbitrage(deal.id);

  // Static data replacing former mock imports
  const acquisitionStats = STATIC_ACQUISITION_STATS;
  const performanceStats = STATIC_PERFORMANCE_STATS;
  const strategyCards = STATIC_STRATEGY_CARDS;
  const acquisitionImplementationTasks = STATIC_ACQ_TASKS;
  const performanceImplementationTasks = STATIC_PERF_TASKS;
  const acquisitionTimeline = STATIC_TIMELINE;
  const performanceStrategyProgress = STATIC_PROGRESS;
  const roiProjections = STATIC_ROI_PROJECTIONS;
  const riskFactors = STATIC_RISKS;
  const performanceRiskFactors = STATIC_RISKS;
  const performanceOptimizations = STATIC_OPTIMIZATIONS;
  const exitScenarios = STATIC_EXIT_SCENARIOS;

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

  // Derive signal names from live M08 scores
  const m08SignalNames = useMemo(() => {
    if (!m08Scores || m08Scores.length === 0) return ['Demand Growth', 'Supply Pressure', 'Rent Momentum', 'Job Growth', 'Cap Rate Spread'];
    const keys = Object.keys(m08Scores[0]?.sub_scores ?? {});
    return keys.map(k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  }, [m08Scores]);

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

  const isLiveData = m08Scores && m08Scores.length > 0;

  const TABS: { id: StrategyTab; label: string; emoji: string }[] = [
    { id: 'overview', label: 'Overview', emoji: '📊' },
    { id: 'signals', label: 'Signals', emoji: '🔥' },
    { id: 'returns', label: 'Returns', emoji: '💰' },
    { id: 'custom', label: 'Custom Screen', emoji: '⚙️' },
  ];

  const BT2_MONO_S = "'JetBrains Mono','Fira Code','SF Mono',monospace";
  const BT2_AMBER_S = '#F5A623', BT2_PURPLE = '#A78BFA', BT2_TEXT_S = '#E8ECF1', BT2_SEC_S = '#8B95A5', BT2_HDR = '#1A1F2E', BT2_BDR = '#1E2538', BT2_MED = '#2A3348';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0E17' }}>

      {/* Bloomberg v0.34 PanelHeader */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', background: BT2_HDR,
        borderBottom: `1px solid ${BT2_BDR}`, borderTop: `2px solid ${BT2_PURPLE}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: BT2_TEXT_S, letterSpacing: 0.8, fontFamily: BT2_MONO_S }}>STRATEGY ARBITRAGE</span>
          <span style={{ fontSize: 8, color: BT2_SEC_S, fontFamily: BT2_MONO_S }}>M08 | BTS · Flip · Rental · STR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLiveData ? (
            <span style={{ fontSize: 7, fontWeight: 700, color: '#00D26A', background: '#022c22', border: '1px solid #00D26A40', padding: '1px 5px', fontFamily: BT2_MONO_S }}>LIVE</span>
          ) : (
            <span style={{ fontSize: 7, fontWeight: 700, color: BT2_AMBER_S, background: '#1a1200', border: `1px solid ${BT2_AMBER_S}40`, padding: '1px 5px', fontFamily: BT2_MONO_S }}>SAMPLE</span>
          )}
        </div>
      </div>

      {/* Bloomberg v0.34 sub-tab bar */}
      <div style={{
        display: 'flex', background: BT2_HDR,
        borderBottom: `1px solid ${BT2_MED}`, flexShrink: 0, height: 28, alignItems: 'stretch',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              fontFamily: BT2_MONO_S, fontSize: 8, fontWeight: activeTab === tab.id ? 700 : 500,
              padding: '0 14px', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${BT2_PURPLE}` : '2px solid transparent',
              color: activeTab === tab.id ? BT2_PURPLE : BT2_SEC_S,
              cursor: 'pointer', whiteSpace: 'nowrap' as const, letterSpacing: 0.5,
            }}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPipeline 
              ? 'bg-blue-900/20 text-blue-300' 
              : 'bg-green-900/20 text-green-300'
          }`}>
            {isPipeline ? '🎯 Strategy Planning' : '📊 Strategy Execution'}
          </div>
          {isLiveData ? (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/20 text-emerald-300 border border-emerald-300 tracking-wider">
              LIVE DATA
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/20 text-amber-300 border border-amber-300 tracking-wider">
              SAMPLE DATA
            </div>
          )}
          {isOwned && (
            <div className="text-xs text-[#6b7f94]">
              Acquired: {new Date(deal.actualCloseDate || deal.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStatsGrid stats={stats} />

      {/* Mock data notice */}
      {!isLiveData && (
        <div className="mx-4 mb-1 px-3 py-2 bg-amber-900/20 border border-amber-200 rounded-lg flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-amber-300">Showing sample data — strategy scores will update when market intelligence modules are connected.</span>
        </div>
      )}

      {/* ======== SIGNALS TAB: M08 Live Strategy Intelligence ======== */}
      {activeTab === 'signals' && (
        <>
          {/* M08 Arbitrage Banner */}
          {m08Arbitrage?.arbitrage_detected && (
            <M08ArbitrageBanner arbitrage={m08Arbitrage} scores={m08Scores} />
          )}

          {/* Strategy Analysis Sub-tabs */}
          <div className="bg-[#0d1f35] rounded-lg border border-[#1e2a3d]">
            <div className="border-b border-[#1e2a3d] flex">
              {([
                { id: 'scores' as const, label: 'Score Matrix', icon: '📊' },
                { id: 'heatmap' as const, label: 'Signal Heatmap', icon: '🔥' },
                { id: 'roi' as const, label: 'ROI Comparison', icon: '📈' },
                { id: 'custom' as const, label: 'Custom Screen', icon: '⚙️' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`flex-1 px-4 py-3 font-medium transition-all text-sm flex items-center justify-center gap-2 ${
                    activeSubTab === tab.id
                      ? 'border-b-2 border-[#A78BFA] text-[#A78BFA] bg-[#A78BFA]/10'
                      : 'text-[#7f8ea3] hover:text-[#e8e9ea] hover:bg-[#0a1628]'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Loading skeleton */}
              {strategyScoresLoading && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-[#1a2233] rounded w-1/3" />
                  <div className="h-3 bg-[#1a2233] rounded w-1/2" />
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="h-10 bg-[#1a2233] rounded flex-1" />
                      <div className="h-10 bg-[#1a2233] rounded flex-1" />
                      <div className="h-10 bg-[#1a2233] rounded flex-1" />
                      <div className="h-10 bg-[#1a2233] rounded flex-1" />
                    </div>
                  ))}
                </div>
              )}

              {!strategyScoresLoading && (
                <>
                  {/* Score Matrix */}
                  {activeSubTab === 'scores' && (
                    <M08ScoreMatrix scores={m08Scores} onRecalculate={recalculateM08} />
                  )}

                  {/* Signal Heatmap */}
                  {activeSubTab === 'heatmap' && (
                    <M08SignalHeatmap scores={m08Scores} signalNames={m08SignalNames} />
                  )}

                  {/* ROI Comparison (live roi_estimate per strategy) */}
                  {activeSubTab === 'roi' && (
                    <ROIComparison scores={m08Scores} />
                  )}

                  {/* Custom Screen */}
                  {activeSubTab === 'custom' && (
                    <CustomScreenTab dealId={deal.id} />
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ======== OVERVIEW TAB: Strategy Cards ======== */}
      {isPipeline && activeTab === 'overview' && (
        <>
          <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
            <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
              📋 Strategy Options
            </h3>
            <p className="text-sm text-[#7f8ea3] mb-6">
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
            <div className="bg-blue-900/20 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-3xl mb-3">💰</div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Exit Scenario Analysis</h3>
              <p className="text-sm text-blue-300">
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
              <h3 className="text-lg font-bold text-[#e8e9ea]">Custom Strategy Screen</h3>
              <p className="text-sm text-[#6b7f94] mt-0.5">
                Your saved strategies scored against this deal's market data
              </p>
            </div>
            {(customLoading || scoreDealLoading) && (
              <div className="flex items-center gap-2 text-sm text-[#6b7f94]">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            )}
          </div>

          {!customLoading && customStrategies.length === 0 ? (
            <div className="bg-[#0a1628] border border-[#1e2a3d] rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <h4 className="text-base font-semibold text-[#a0b0c0] mb-2">No strategies configured.</h4>
              <p className="text-sm text-[#6b7f94]">
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
                    className={`bg-[#0d1f35] rounded-lg border-2 p-4 flex items-start gap-4 ${
                      matched === true
                        ? 'border-emerald-300'
                        : matched === false
                        ? 'border-red-200'
                        : 'border-[#1e2a3d]'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base font-bold ${
                      matched === true ? 'bg-emerald-900/20 text-emerald-300' :
                      matched === false ? 'bg-red-900/20 text-red-600' :
                      'bg-[#1a2a3a] text-[#6b7f94]'
                    }`}>
                      {matched === true ? '✓' : matched === false ? '✗' : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#e8e9ea] text-sm">{strategy.name}</span>
                        {strategy.isPreset && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-300 tracking-wider">
                            PRESET
                          </span>
                        )}
                      </div>
                      {strategy.description && (
                        <p className="text-xs text-[#6b7f94] mb-2">{strategy.description}</p>
                      )}
                      {score !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#1e2a3d] rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(score, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#7f8ea3] w-10 text-right">
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
          className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-4 hover:shadow-md transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{stat.icon}</span>
            {stat.trend && (
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                stat.trend.direction === 'up' 
                  ? 'bg-green-900/20 text-green-300'
                  : stat.trend.direction === 'down'
                  ? 'bg-red-900/20 text-red-300'
                  : 'bg-[#1a2a3a] text-[#a0b0c0]'
              }`}>
                {stat.trend.value}
              </span>
            )}
          </div>
          <div className="text-sm text-[#7f8ea3] mb-1">{stat.label}</div>
          <div className="text-2xl font-bold text-[#e8e9ea]">{formatValue(stat)}</div>
          {stat.subtext && (
            <div className="text-xs text-[#6b7f94] mt-1">{stat.subtext}</div>
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
    qualified: { icon: '✅', label: 'Qualified', bg: 'bg-emerald-900/20', text: 'text-emerald-300', border: 'border-emerald-300' },
    marginal: { icon: '⚠️', label: 'Marginal', bg: 'bg-amber-900/20', text: 'text-amber-800', border: 'border-amber-300' },
    disqualified: { icon: '❌', label: 'Disqualified', bg: 'bg-red-900/20', text: 'text-red-300', border: 'border-red-300' },
  }[gate.status];

  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${config.bg} ${config.text} border ${config.border}`}>
        <span>{config.icon}</span>
        <span>TRAFFIC: {config.label.toUpperCase()}</span>
      </div>
      <div className="absolute z-20 bottom-full left-0 mb-1 w-64 p-3 bg-[#050d1a] text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="font-semibold mb-1">Traffic Gate Evaluation</div>
        <div className="flex justify-between mb-1">
          <span>Score:</span>
          <span className="font-mono">{gate.trafficScore}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Threshold:</span>
          <span className="font-mono">{gate.threshold}</span>
        </div>
        <div className="text-[#a0b0c0] leading-relaxed">{gate.reason}</div>
      </div>
    </div>
  );
};

const T04QuadrantInfluencer: React.FC<{ strategyId: string }> = ({ strategyId }) => {
  const influence = MOCK_QUADRANT_INFLUENCES[strategyId];
  if (!influence) return null;

  const quadrantColors: Record<string, string> = {
    'Hidden Gem': 'bg-emerald-900/20 text-emerald-300 border-emerald-200',
    'Validated Winner': 'bg-blue-900/20 text-blue-300 border-blue-200',
    'Hype Risk': 'bg-orange-50 text-orange-300 border-orange-200',
    'Dead Weight': 'bg-red-50 text-red-300 border-red-200',
  };

  const shiftColor = influence.direction === 'boost'
    ? 'text-emerald-600'
    : influence.direction === 'penalty'
    ? 'text-red-600'
    : 'text-[#6b7f94]';

  const shiftPrefix = influence.weightShift > 0 ? '+' : '';

  return (
    <div className="relative group">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${quadrantColors[influence.quadrant] || 'bg-[#0a1628] text-[#a0b0c0] border-[#1e2a3d]'}`}>
        <span>T-04</span>
        <span>{influence.quadrant}</span>
        <span className={`font-mono ${shiftColor}`}>{shiftPrefix}{influence.weightShift}%</span>
      </div>
      <div className="absolute z-20 bottom-full left-0 mb-1 w-64 p-3 bg-[#050d1a] text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="font-semibold mb-1">T-04 Quadrant Influence</div>
        <div className="flex justify-between mb-1">
          <span>Quadrant:</span>
          <span className="font-semibold">{influence.quadrant}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span>Weight Shift:</span>
          <span className={`font-mono font-semibold ${shiftColor}`}>{shiftPrefix}{influence.weightShift}%</span>
        </div>
        <div className="text-[#a0b0c0] leading-relaxed">{influence.explanation}</div>
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
      case 'low': return 'bg-green-900/20 text-green-300';
      case 'medium': return 'bg-yellow-900/20 text-yellow-300';
      case 'high': return 'bg-orange-900/20 text-orange-300';
      case 'very-high': return 'bg-red-900/20 text-red-300';
      default: return 'bg-[#1a2a3a] text-[#a0b0c0]';
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

      <p className="text-sm text-[#a0b0c0] mb-4">{strategy.description}</p>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#7f8ea3]">Target IRR:</span>
          <span className="font-semibold text-[#e8e9ea]">{strategy.targetIRR}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#7f8ea3]">Hold Period:</span>
          <span className="font-semibold text-[#e8e9ea]">{strategy.holdPeriod}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#7f8ea3]">Capex Required:</span>
          <span className="font-semibold text-[#e8e9ea]">
            ${(strategy.capexRequired / 1000000).toFixed(1)}M
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#7f8ea3]">Stabilization:</span>
          <span className="font-semibold text-[#e8e9ea]">{strategy.timeToStabilize}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-[#a0b0c0] mb-2">Key Features:</div>
        <ul className="space-y-1">
          {strategy.keyFeatures.map((feature, idx) => (
            <li key={idx} className="text-xs text-[#7f8ea3] flex items-start">
              <span className="mr-1">•</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs font-semibold text-[#a0b0c0] mb-2">Exit Strategies:</div>
        <div className="flex flex-wrap gap-1">
          {strategy.exitStrategy.map((exit, idx) => (
            <span
              key={idx}
              className="text-xs bg-[#0d1f35] px-2 py-1 rounded border border-[#2a3a4d]"
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
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
        📊 ROI Comparison by Strategy
      </h3>
      <p className="text-sm text-[#7f8ea3] mb-6">
        Projected returns across different timeframes
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#1e2a3d]">
              <th className="text-left py-3 px-4 font-semibold text-[#a0b0c0]">Strategy</th>
              <th className="text-right py-3 px-4 font-semibold text-[#a0b0c0]">Year 1</th>
              <th className="text-right py-3 px-4 font-semibold text-[#a0b0c0]">Year 3</th>
              <th className="text-right py-3 px-4 font-semibold text-[#a0b0c0]">Year 5</th>
              <th className="text-right py-3 px-4 font-semibold text-[#a0b0c0]">At Exit</th>
              <th className="text-right py-3 px-4 font-semibold text-[#a0b0c0]">Total Return</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((proj, idx) => (
              <tr key={idx} className="border-b border-[#1a2a3a] hover:bg-[#0a1628]">
                <td className="py-3 px-4 font-medium text-[#e8e9ea]">{proj.strategy}</td>
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
                <td className="text-right py-3 px-4 text-green-300 font-bold">
                  {proj.totalReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-200">
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
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
        📅 Implementation Timeline
      </h3>
      <p className="text-sm text-[#7f8ea3] mb-6">
        5-7 year value-add strategy execution plan
      </p>

      <div className="space-y-4">
        {timeline.map((phase, idx) => (
          <div key={idx} className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${phase.color}`}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#e8e9ea]">{phase.name}</span>
                  <span className="text-sm text-[#7f8ea3]">{phase.duration}</span>
                </div>
              </div>
            </div>
            
            <div className="ml-6 pl-3 border-l-2 border-[#1e2a3d] pb-2">
              <ul className="space-y-1">
                {phase.tasks.map((task, taskIdx) => (
                  <li key={taskIdx} className="text-sm text-[#7f8ea3] flex items-start">
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
      <div className="mt-6 relative h-12 bg-[#1a2a3a] rounded-lg overflow-hidden">
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
      <div className="flex justify-between mt-2 text-xs text-[#6b7f94]">
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
      case 'completed': return 'bg-green-900/20 border-green-200';
      case 'in-progress': return 'bg-blue-900/20 border-blue-200';
      case 'pending': return 'bg-[#0a1628] border-[#1e2a3d]';
      default: return 'bg-[#0a1628] border-[#1e2a3d]';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-900/20 text-red-300';
      case 'medium': return 'bg-yellow-900/20 text-yellow-300';
      case 'low': return 'bg-[#1a2a3a] text-[#7f8ea3]';
      default: return 'bg-[#1a2a3a] text-[#7f8ea3]';
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionPercent = (completedTasks / totalTasks) * 100;

  return (
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#e8e9ea]">
          ✅ Implementation Checklist
        </h3>
        <div className="text-sm font-semibold text-[#a0b0c0]">
          {completedTasks} / {totalTasks} Complete ({completionPercent.toFixed(0)}%)
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="w-full bg-[#1e2a3d] rounded-full h-3">
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
                  <div className="font-medium text-[#e8e9ea]">{task.task}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[#7f8ea3]">
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
      case 'low': return 'bg-green-900/20 text-green-300 border-green-300';
      case 'medium': return 'bg-yellow-900/20 text-yellow-300 border-yellow-300';
      case 'high': return 'bg-red-900/20 text-red-300 border-red-300';
      default: return 'bg-[#1a2a3a] text-[#a0b0c0] border-[#2a3a4d]';
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
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
        ⚠️ Risk Assessment
      </h3>
      <p className="text-sm text-[#7f8ea3] mb-6">
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
                <h4 className="font-bold text-[#e8e9ea]">{risk.category}</h4>
                <span className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${getRiskColor(risk.level)}`}>
                  {risk.level.toUpperCase()} RISK
                </span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-[#a0b0c0]">Risk:</span>
                <p className="text-[#7f8ea3] mt-1">{risk.description}</p>
              </div>
              <div>
                <span className="font-semibold text-[#a0b0c0]">Mitigation:</span>
                <p className="text-[#7f8ea3] mt-1">{risk.mitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-[#0a1628] rounded-lg border border-[#1e2a3d]">
        <div className="text-sm text-[#a0b0c0]">
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
      case 'completed': return 'bg-green-900/20 text-green-300';
      case 'active': return 'bg-blue-900/20 text-blue-300';
      case 'upcoming': return 'bg-[#1a2a3a] text-[#a0b0c0]';
      default: return 'bg-[#1a2a3a] text-[#a0b0c0]';
    }
  };

  return (
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
        📊 Strategy Progress Tracker
      </h3>
      <p className="text-sm text-[#7f8ea3] mb-6">
        Track execution across major strategy phases
      </p>

      <div className="space-y-4">
        {progress.map((phase, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[#e8e9ea]">{phase.phase}</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(phase.status)}`}>
                  {phase.status.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-[#7f8ea3]">
                {phase.completedTasks} / {phase.totalTasks} tasks
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="w-full bg-[#1e2a3d] rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-300 ${getStatusColor(phase.status)}`}
                    style={{ width: `${phase.percentage}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-semibold text-[#a0b0c0] w-12 text-right">
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
      case 'implemented': return 'bg-green-900/20 border-green-200';
      case 'in-progress': return 'bg-blue-900/20 border-blue-200';
      case 'planned': return 'bg-[#0a1628] border-[#1e2a3d]';
      default: return 'bg-[#0a1628] border-[#1e2a3d]';
    }
  };

  const totalSavings = optimizations
    .filter(opt => opt.annualSavings && opt.status === 'implemented')
    .reduce((sum, opt) => sum + opt.annualSavings, 0);

  return (
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#e8e9ea]">
          💡 Active Optimizations
        </h3>
        <div className="text-right">
          <div className="text-sm text-[#7f8ea3]">Annual Impact (Implemented)</div>
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
                  <span className="font-semibold text-[#e8e9ea]">{opt.action}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    opt.category === 'Revenue' ? 'bg-green-900/20 text-green-300' : 'bg-blue-900/20 text-blue-300'
                  }`}>
                    {opt.category}
                  </span>
                </div>
                <div className="text-sm text-[#a0b0c0] font-medium">{opt.impact}</div>
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
    <div className="bg-[#0d1f35] rounded-lg  border border-[#1e2a3d] p-6">
      <h3 className="text-lg font-bold text-[#e8e9ea] mb-4">
        🎯 Exit Scenario Analysis
      </h3>
      <p className="text-sm text-[#7f8ea3] mb-6">
        Projected returns under different exit timing and market conditions
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className={`rounded-lg border-2 p-5 ${
              scenario.name === 'Base Case' 
                ? 'border-blue-400 bg-blue-900/20'
                : 'border-[#1e2a3d] bg-[#0d1f35]'
            }`}
          >
            <h4 className="font-bold text-[#e8e9ea] text-lg mb-3">{scenario.name}</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7f8ea3]">Timing:</span>
                <span className="font-semibold text-[#e8e9ea]">{scenario.timing}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7f8ea3]">Exit Cap:</span>
                <span className="font-semibold text-[#e8e9ea]">{scenario.exitCap}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7f8ea3]">Proj. NOI:</span>
                <span className="font-semibold text-[#e8e9ea]">
                  ${(scenario.projectedNOI / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7f8ea3]">Sale Price:</span>
                <span className="font-semibold text-[#e8e9ea]">
                  ${(scenario.salePrice / 1000000).toFixed(1)}M
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#1e2a3d]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-[#7f8ea3]">Equity Multiple:</span>
                <span className="text-xl font-bold text-green-600">{scenario.equityMultiple}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#7f8ea3]">IRR:</span>
                <span className="text-xl font-bold text-green-600">{scenario.irr}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          💡 <span className="font-semibold">Recommendation:</span> Base case provides balanced risk/return profile. Monitor market conditions for opportunistic early exit if cap rates compress further.
        </div>
      </div>
    </div>
  );
};

// ─── M08 Live Components ────────────────────────────────────────────────────

/** M08 Arbitrage Banner — shows when backend detects a strategy gap */
const M08ArbitrageBanner: React.FC<{ arbitrage: M08ArbitrageResult; scores?: M08StrategyScore[] }> = ({ arbitrage, scores }) => {
  const winnerScore = scores?.find(s => s.strategy_id === arbitrage.winning_strategy_id);
  const runnerScore = scores?.find(s => s.strategy_id === arbitrage.runner_up_strategy_id);

  const roiCallout = (() => {
    const wRoi = normalizeRoiEstimate(winnerScore?.roi_estimate);
    const rRoi = normalizeRoiEstimate(runnerScore?.roi_estimate);
    if (!wRoi && !rRoi) return null;
    const wIrr  = wRoi?.irr;
    const rIrr  = rRoi?.irr;
    const wYoc  = wRoi?.yoc;
    const rYoc  = rRoi?.yoc;
    const parts: string[] = [];
    if (wIrr != null && rIrr != null && Math.abs(wIrr - rIrr) > 0.1)
      parts.push(`IRR delta +${(wIrr - rIrr).toFixed(1)}%`);
    if (wYoc != null && rYoc != null && Math.abs(wYoc - rYoc) > 0.1)
      parts.push(`YoC delta +${(wYoc - rYoc).toFixed(1)}%`);
    return parts.length ? parts.join(' · ') : null;
  })();

  return (
    <div className="border-2 border-[#F5A623] rounded-xl p-5 mx-4 mb-3"
      style={{ background: 'linear-gradient(135deg, #1a1000 0%, #0f1a00 100%)' }}>
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">⚡</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#F5A623] tracking-widest font-mono">STRATEGY ARBITRAGE DETECTED</span>
            <span className="text-xs font-mono bg-[#F5A623]/20 text-[#F5A623] px-2 py-0.5 rounded border border-[#F5A623]/30">
              +{arbitrage.delta.toFixed(1)}pt gap
            </span>
            <span className="text-[9px] font-mono text-[#8B95A5] tracking-widest">F24 CONFIDENCE SIGNAL</span>
          </div>
          <p className="text-sm text-[#E8ECF1] mb-2">
            <span className="font-semibold text-[#A78BFA]">{arbitrage.winning_strategy_name ?? 'Recommended'}</span>
            {' '}outscores{' '}
            <span className="font-semibold text-[#8B95A5]">{arbitrage.runner_up_strategy_name ?? 'Current'}</span>
            {' '}by <span className="font-bold text-[#F5A623]">{arbitrage.delta.toFixed(1)} points</span>.
            {' '}Most investors would default to the lower-scoring strategy — the platform sees the arbitrage.
          </p>
          <div className="text-[10px] font-mono border-t border-[#F5A623]/20 pt-2 mt-1">
            {roiCallout
              ? <span className="text-[#F5A623]">MISSED ROI: {roiCallout} — switching strategies captures this delta</span>
              : <span className="text-[#5a6a7a]">ROI DELTA: run pro forma inputs to quantify IRR/yield impact of this arbitrage</span>
            }
          </div>
        </div>
        <div className="flex-shrink-0 flex gap-4 text-right">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold font-mono text-[#A78BFA]">{arbitrage.winning_score.toFixed(1)}</span>
            <span className="text-[9px] text-[#5a6a7a] font-mono">
              {arbitrage.winning_strategy_name?.split(' ')[0] ?? 'WINNER'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold font-mono text-[#8B95A5]">{arbitrage.runner_up_score?.toFixed(1) ?? '—'}</span>
            <span className="text-[9px] text-[#5a6a7a] font-mono">
              {arbitrage.runner_up_strategy_name?.split(' ')[0] ?? 'RUNNER-UP'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Derive the canonical top-5 signal keys across all strategies */
function top5Signals(scores: M08StrategyScore[]): string[] {
  const allKeys = new Set<string>();
  scores.forEach(s => Object.keys(s.sub_scores ?? {}).forEach(k => allKeys.add(k)));
  const ranked = [...allKeys]
    .map(k => ({ k, avg: scores.reduce((sum, s) => sum + (s.sub_scores?.[k] ?? 0), 0) / scores.length }))
    .sort((a, b) => b.avg - a.avg);
  return ranked.slice(0, 5).map(r => r.k);
}

const M08ScoreMatrix: React.FC<{ scores: M08StrategyScore[]; onRecalculate: () => void }> = ({ scores, onRecalculate }) => {
  const [gatedExpanded, setGatedExpanded] = useState(false);

  const allSorted = [...scores].sort((a, b) => b.overall_score - a.overall_score);
  // Primary matrix: only strategies that have not been gated (N/A excluded)
  const primaryScores = allSorted.filter(s => s.gate_result !== 'N/A');
  // Gated (N/A) strategies shown only in the collapsed section below
  const gatedScores = allSorted.filter(s => s.gate_result === 'N/A');
  const winner = primaryScores[0] ?? allSorted[0];

  const STRATEGY_COLORS: Record<number, string> = {
    0: '#A78BFA', 1: '#00BCD4', 2: '#00D26A', 3: '#F5A623', 4: '#FF8C42',
  };
  const scoreColor = (s: number) =>
    s >= 75 ? '#00D26A' : s >= 50 ? '#F5A623' : '#FF4757';

  // Derive top-5 signals from all strategies (for stability), display against primary only
  const signalKeys = top5Signals(allSorted);
  const signalLabel = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (!scores || scores.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="text-4xl">📊</div>
        <div className="text-sm text-[#6b7f94]">No strategies configured.</div>
        <button
          onClick={onRecalculate}
          className="text-xs font-mono font-bold px-4 py-2 rounded border border-[#A78BFA] text-[#A78BFA] hover:bg-[#A78BFA]/10 transition-colors"
        >
          RECALCULATE SCORES
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-[#e8e9ea] tracking-wide">STRATEGY SCORE MATRIX</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#5a6a7a] tracking-widest">F23 × STRATEGY WEIGHTS</span>
          <button
            onClick={onRecalculate}
            className="text-[10px] font-mono px-2 py-1 rounded border border-[#1e2a3d] text-[#8B95A5] hover:border-[#A78BFA] hover:text-[#A78BFA] transition-colors"
          >
            ↻ RECALC
          </button>
        </div>
      </div>
      <p className="text-xs text-[#6b7f94] mb-4">
        N-column comparison: rows = score / gate / 5 signals / confidence; columns = strategies ranked by score
      </p>

      {/* True N-column matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-[#1e2a3d]">
              <th className="text-left py-2 px-3 font-mono text-[#5a6a7a] w-28">METRIC</th>
              {primaryScores.map((s, idx) => {
                const isWin = winner && s.strategy_id === winner.strategy_id;
                const col = STRATEGY_COLORS[idx] ?? '#8B95A5';
                return (
                  <th key={s.strategy_id} className="py-2 px-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {isWin && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full tracking-wider"
                          style={{ background: '#F5A623', color: '#0A0E17' }}>
                          ★ TOP
                        </span>
                      )}
                      <span className="font-semibold" style={{ color: col }}>
                        {s.strategy_name.length > 14 ? s.strategy_name.slice(0, 14) + '…' : s.strategy_name}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Overall Score row */}
            <tr className="border-b border-[#1e2a3d] bg-[#0a1628]/50">
              <td className="py-2 px-3 font-mono text-[#8B95A5] font-bold text-[10px] tracking-widest">OVERALL</td>
              {primaryScores.map(s => (
                <td key={s.strategy_id} className="py-2 px-3 text-center">
                  <span className="text-lg font-bold font-mono" style={{ color: scoreColor(s.overall_score) }}>
                    {s.overall_score.toFixed(0)}
                  </span>
                </td>
              ))}
            </tr>

            {/* Gate row */}
            <tr className="border-b border-[#1e2a3d]">
              <td className="py-2 px-3 font-mono text-[#8B95A5] font-bold text-[10px] tracking-widest">GATE</td>
              {primaryScores.map(s => (
                <td key={s.strategy_id} className="py-2 px-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold border ${
                    s.gate_result === 'PASS'
                      ? 'bg-emerald-900/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-red-900/20 text-red-400 border-red-400/30'
                  }`}>
                    {s.gate_result}
                  </span>
                </td>
              ))}
            </tr>

            {/* 5 signal rows — weighted contribution: signal_score × strategy_weight */}
            {signalKeys.map((key, i) => (
              <tr key={key} className={`border-b border-[#1a2a3a] ${i % 2 === 0 ? '' : 'bg-[#0a1628]/30'}`}>
                <td className="py-1.5 px-3 font-medium text-[#8B95A5] text-[10px] max-w-[7rem] truncate" title={signalLabel(key)}>
                  {signalLabel(key)}
                </td>
                {primaryScores.map((s, idx) => {
                  const signalScore = s.sub_scores?.[key] ?? 0;
                  const weight = s.signal_weights?.[key] ?? 1;
                  const contribution = signalScore * weight;
                  const col = STRATEGY_COLORS[idx] ?? '#A78BFA';
                  return (
                    <td key={s.strategy_id} className="py-1.5 px-3 text-center">
                      <div
                        className="flex flex-col items-center gap-0.5"
                        title={`${key}: signal=${signalScore.toFixed(1)} × weight=${weight.toFixed(2)} = ${contribution.toFixed(1)}`}
                      >
                        <span className="font-mono font-semibold text-[11px]" style={{ color: col }}>
                          {contribution.toFixed(0)}
                        </span>
                        <div className="w-10 bg-[#1e2a3d] rounded-full h-0.5">
                          <div className="h-0.5 rounded-full" style={{ width: `${Math.min(contribution, 100)}%`, background: col }} />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Confidence row */}
            <tr className="border-t-2 border-[#2a3a4d]">
              <td className="py-2 px-3 font-mono text-[#8B95A5] font-bold text-[10px] tracking-widest">CONF %</td>
              {primaryScores.map(s => (
                <td key={s.strategy_id} className="py-2 px-3 text-center font-mono text-[11px] text-[#8B95A5]">
                  {s.confidence != null ? `${s.confidence.toFixed(0)}%` : '—'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Gated strategies — collapsed section below main matrix */}
      {gatedScores.length > 0 && (
        <div className="mt-4 border border-red-900/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setGatedExpanded(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-red-900/10 hover:bg-red-900/20 transition-colors"
          >
            <span className="text-xs font-bold text-red-400 font-mono tracking-widest">
              GATED STRATEGIES ({gatedScores.length})
            </span>
            <span className="text-[10px] text-[#5a6a7a]">{gatedExpanded ? '▲ HIDE' : '▼ SHOW'}</span>
          </button>
          {gatedExpanded && (
            <div className="p-3 space-y-1">
              {gatedScores.map(s => (
                <div key={s.strategy_id} className="text-xs text-[#8B95A5]">
                  <span className="text-red-400 font-semibold">{s.strategy_name}</span>
                  {s.gate_failures?.length > 0 && (
                    <span className="text-[#5a6a7a]"> — failed: {s.gate_failures.join(', ')}</span>
                  )}
                  <span className="ml-2 font-mono text-[#5a6a7a]">score: {s.overall_score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** M08 Signal Heatmap — 5 signals × N strategies live data */
const M08SignalHeatmap: React.FC<{ scores: M08StrategyScore[]; signalNames: string[] }> = ({ scores, signalNames }) => {
  if (!scores || scores.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[#6b7f94]">
        No signal data available. Run a recalculation to populate the heatmap.
      </div>
    );
  }

  // Spec thresholds: green ≥ 80, amber 50–79, red < 50
  const cellColor = (val: number) => {
    if (val >= 80) return { bg: 'rgba(0, 210, 106, 0.15)', text: '#00D26A' };
    if (val >= 50) return { bg: 'rgba(245, 166, 35, 0.12)', text: '#F5A623' };
    return { bg: 'rgba(255, 71, 87, 0.10)', text: '#FF4757' };
  };

  // Enforce exactly 5 signal rows using the canonical top-5 across all strategies
  const signalKeys = top5Signals(scores);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-[#e8e9ea] tracking-wide">SIGNAL HEATMAP</h3>
        <span className="text-[10px] font-mono text-[#5a6a7a] tracking-widest">
          5 SIGNALS × {scores.length} STRATEGIES
        </span>
      </div>
      <p className="text-xs text-[#6b7f94] mb-4">
        Cell value = signal_score × strategy_weight — color intensity indicates weighted contribution to overall score
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-[#1e2a3d]">
              <th className="text-left py-2 px-3 font-mono text-[#5a6a7a]">SIGNAL</th>
              {scores.map(s => (
                <th key={s.strategy_id} className="text-center py-2 px-3 font-mono text-[#8B95A5]">
                  {s.strategy_name.length > 12 ? s.strategy_name.slice(0, 12) + '…' : s.strategy_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signalKeys.map((key, i) => (
              <tr key={key} className="border-b border-[#1a2a3a]">
                <td className="py-2 px-3 font-medium text-[#a0b0c0]">
                  {(signalNames[i] ?? key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}
                </td>
                {scores.map(s => {
                  const signalScore = s.sub_scores?.[key] ?? 0;
                  const weight = s.signal_weights?.[key] ?? 1;
                  const val = signalScore * weight;
                  const c = cellColor(val);
                  return (
                    <td key={s.strategy_id} className="py-1 px-1 text-center">
                      <div
                        className="rounded px-2 py-1.5 font-mono font-semibold"
                        style={{ background: c.bg, color: c.text }}
                        title={`${s.strategy_name}: ${key} signal=${signalScore.toFixed(1)} × weight=${weight.toFixed(2)} = ${val.toFixed(1)}`}
                      >
                        {val.toFixed(0)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-[#2a3a4d] font-bold">
              <td className="py-2 px-3 font-mono text-[#8B95A5]">TOTAL</td>
              {scores.map(s => (
                <td key={s.strategy_id} className="py-2 px-3 text-center font-bold text-[#E8ECF1]">
                  {s.overall_score.toFixed(1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex gap-4 text-[10px] font-mono text-[#5a6a7a]">
        <span className="text-[#00D26A]">■</span> Strong (≥80)
        <span className="text-[#F5A623]">■</span> Moderate (50–79)
        <span className="text-[#FF4757]">■</span> Weak (&lt;50)
      </div>
    </div>
  );
};

/** Normalize roi_estimate to handle backend field name variants (e.g. revpar vs rev_par) */
function normalizeRoiEstimate(raw: M08StrategyScore['roi_estimate']): NonNullable<M08StrategyScore['roi_estimate']> | null {
  if (!raw) return null;
  const r = raw as Record<string, number | undefined>;
  return {
    irr: r['irr'] ?? r['irr_pct'] ?? r['IRR'],
    yoc: r['yoc'] ?? r['yield_on_cost'] ?? r['YOC'],
    profit_margin: r['profit_margin'] ?? r['profitMargin'] ?? r['margin'],
    rev_par: r['rev_par'] ?? r['revpar'] ?? r['RevPAR'] ?? r['rev_PAR'],
  };
}

/** Infer the primary ROI metric key for a strategy based on its type or name keywords */
function roiKeyForStrategy(s: M08StrategyScore): { key: keyof NonNullable<M08StrategyScore['roi_estimate']>; label: string; unit: string } {
  const t = (s.strategy_type ?? '').toLowerCase();
  const n = s.strategy_name.toLowerCase();
  if (t === 'str' || n.includes('str') || n.includes('short-term') || n.includes('airbnb') || n.includes('vacation'))
    return { key: 'rev_par', label: 'RevPAR', unit: '$' };
  if (t === 'flip' || n.includes('flip') || n.includes('fix') || n.includes('value-add'))
    return { key: 'profit_margin', label: 'Profit Margin', unit: '%' };
  if (t === 'bts' || n.includes('bts') || n.includes('build-to') || n.includes('ground-up') || n.includes('development'))
    return { key: 'yoc', label: 'Yield-on-Cost', unit: '%' };
  return { key: 'irr', label: 'IRR', unit: '%' };
}

/** ROI Comparison — one strategy-type-specific metric per strategy, null shown as placeholder bar */
const ROIComparison: React.FC<{ scores: M08StrategyScore[] }> = ({ scores }) => {
  if (!scores || scores.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[#6b7f94]">
        No strategies configured.
      </div>
    );
  }

  const COLORS = ['#A78BFA', '#00BCD4', '#00D26A', '#F5A623', '#FF8C42'];
  const sorted = [...scores].sort((a, b) => b.overall_score - a.overall_score);

  const chartData = sorted.map((s, i) => {
    const { key, label, unit } = roiKeyForStrategy(s);
    const normalized = normalizeRoiEstimate(s.roi_estimate);
    const raw = normalized?.[key];
    return {
      name: s.strategy_name.length > 12 ? s.strategy_name.slice(0, 12) + '…' : s.strategy_name,
      value: raw ?? 0,
      hasData: raw != null,
      label,
      unit,
      gate: s.gate_result,
      color: s.gate_result === 'PASS' ? (COLORS[i] ?? '#A78BFA') : '#FF4757',
    };
  });

  const hasAnyData = chartData.some(d => d.hasData);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#e8e9ea] tracking-wide">ROI COMPARISON</h3>
        <span className="text-[10px] font-mono text-[#5a6a7a] tracking-widest">PRIMARY METRIC PER STRATEGY TYPE</span>
      </div>
      <p className="text-xs text-[#6b7f94]">
        Each strategy is evaluated on its type-appropriate metric: Rental→IRR · BTS→Yield-on-Cost · Flip→Profit Margin · STR→RevPAR
      </p>

      {!hasAnyData ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="text-3xl opacity-30">📊</div>
          <div className="text-xs text-[#5a6a7a] font-mono">ROI ESTIMATES PENDING</div>
          <div className="text-[10px] text-[#4a5568]">Run a recalculation or add pro forma inputs to populate ROI metrics</div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3d" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#8B95A5', fontSize: 9, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                angle={-20}
                textAnchor="end"
              />
              <YAxis tick={{ fill: '#8B95A5', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0d1f35', border: '1px solid #1e2a3d', borderRadius: 6, color: '#E8ECF1', fontSize: 10 }}
                formatter={(val: number, _name: string, item: { payload: { hasData: boolean; unit: string; label: string } }) => {
                  const d = item.payload;
                  return d.hasData
                    ? [`${(val as number).toFixed(1)}${d.unit}`, d.label]
                    : ['— (no data)', d.label];
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    fillOpacity={entry.hasData ? (entry.gate === 'PASS' ? 0.85 : 0.4) : 0.12}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(chartData.length, 4)}, 1fr)` }}>
            {chartData.map((d, i) => (
              <div key={i} className="bg-[#0a1628] border border-[#1e2a3d] rounded-lg p-3 text-center">
                <div className="text-[9px] font-mono text-[#5a6a7a] mb-1 truncate">{d.name}</div>
                <div className="text-base font-bold font-mono" style={{ color: d.color }}>
                  {d.hasData ? `${d.value.toFixed(1)}${d.unit}` : '—'}
                </div>
                <div className="text-[8px] font-mono text-[#4a5568] mt-0.5">{d.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 text-[9px] font-mono text-[#4a5568]">
            <span><span className="text-[#A78BFA]">■</span> Gate PASS</span>
            <span><span className="text-[#FF4757]">■</span> Gated (N/A)</span>
            <span><span className="opacity-20">■</span> No ROI data</span>
          </div>
        </>
      )}
    </div>
  );
};

export default StrategySection;
