/**
 * Capital Structure Section — M11+ Engine
 *
 * Replaces the basic Debt tab with a full capital structure design engine.
 * 7 tabs: Stack Designer, Debt Selector, Rate Environment,
 * Equity Waterfall, Scenario Comparison, Lifecycle Timeline, Integration.
 *
 * Strategy-aware: when strategy changes, the entire capital structure template reloads.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type {
  StrategyType,
  CapitalLayer,
  CapitalScenario,
  MetricInsight,
} from '../../../types/capital-structure.types';
import { useDealModule } from '../../../contexts/DealModuleContext';
import { apiClient } from '@/services/api.client';
import { BT, BT_CSS, BT_TAB_CSS } from '../bloomberg-ui';
import {
  strategyTemplates,
  defaultCapitalStack,
  debtProducts,
  currentRates,
  rateForecast,
  lockVsFloatAnalysis,
  spreadAnalysis,
  scenarioComparison,
  debtTimeline,
  stackInsights,
  strategyMismatchWarnings,
  calcSourcesEqualsUses,
  calcRateSensitivity,
} from '../../../data/capitalStructureMockData';

const API_BASE = '/api/v1/capital-structure';

// ============================================================================
// Props
// ============================================================================

interface CapitalStructureSectionProps {
  deal: any;
  isPremium?: boolean;
  dealStatus?: 'pipeline' | 'owned';
}

// Note: 'stack' isn't a user-selectable tab (TABS below omits it) but is
// used as a sentinel key for the on-mount stack fetch effect — included
// here so loading/live-source tracking stays in the typed key space.
type TabId = 'stack' | 'debt' | 'rates' | 'scenarios' | 'timeline' | 'integration';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'debt', label: 'Debt Selector', icon: '◇' },
  { id: 'rates', label: 'Rate Environment', icon: '◆' },
  { id: 'scenarios', label: 'Scenarios', icon: '⬡' },
  { id: 'timeline', label: 'Timeline', icon: '◎' },
  { id: 'integration', label: 'Integration', icon: '⬢' },
];

// ============================================================================
// Helpers
// ============================================================================

const fmt = (v: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number): string => `${v.toFixed(2)}%`;

const fmtM = (v: number): string => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return fmt(v);
};

// ============================================================================
// Component
// ============================================================================

export const CapitalStructureSection: React.FC<CapitalStructureSectionProps> = ({
  deal,
  isPremium = false,
  dealStatus = 'pipeline',
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('debt');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('rental_value_add');
  const [layers, setLayers] = useState<CapitalLayer[]>(defaultCapitalStack.layers);

  const [liveStack, setLiveStack] = useState<any>(null);
  const [liveDebtProducts, setLiveDebtProducts] = useState<any>(null);
  const [liveRateData, setLiveRateData] = useState<any>(null);

  const [liveScenarios, setLiveScenarios] = useState<any>(null);
  const [liveTimeline, setLiveTimeline] = useState<any>(null);
  const [liveInsights, setLiveInsights] = useState<any>(null);

  const [tabLoading, setTabLoading] = useState<Record<TabId, boolean>>({
    stack: false, debt: false, rates: false,
    scenarios: false, timeline: false, integration: false,
  });
  const [liveDataSources, setLiveDataSources] = useState<Set<TabId>>(new Set());
  const fetchedTabs = useRef<Set<TabId>>(new Set());

  const {
    financial,
    capitalStructure,
    updateCapitalStructure,
    strategy: strategyCtx,
    emitEvent,
    lastEvent,
  } = useDealModule();

  const template = strategyTemplates[selectedStrategy];
  const stack = liveStack || defaultCapitalStack;

  const markTabLoading = useCallback((tab: TabId, loading: boolean) => {
    setTabLoading(prev => ({ ...prev, [tab]: loading }));
  }, []);

  const markTabLive = useCallback((tab: TabId) => {
    setLiveDataSources(prev => new Set(prev).add(tab));
  }, []);

  useEffect(() => {
    const fetchStack = async () => {
      markTabLoading('stack', true);
      try {
        const res = await apiClient.post(`${API_BASE}/stack`, {
          dealId: deal.id,
          strategy: selectedStrategy,
          layers: defaultCapitalStack.layers,
          uses: defaultCapitalStack.uses,
          noi: financial?.noi || 3000000,
          propertyValue: defaultCapitalStack.uses.acquisitionPrice,
        });
        if (res.data?.stack) {
          setLiveStack(res.data.stack);
          if (res.data.stack.layers) setLayers(res.data.stack.layers);
          markTabLive('stack');
        }
      } catch {
      } finally {
        markTabLoading('stack', false);
      }

      try {
        const insRes = await apiClient.post(`${API_BASE}/insights`, {
          metrics: defaultCapitalStack.metrics,
        });
        if (insRes.data?.insights) {
          setLiveInsights(insRes.data.insights);
        }
      } catch {
      }
    };
    fetchStack();
    fetchedTabs.current.add('stack');
    // Tab-fetch effects (this and the per-tab effects below) are guarded by
    // `fetchedTabs.current.has(tab)` so each tab fetches at most once per
    // deal-load. We intentionally capture the current `selectedStrategy`
    // and `financial?.noi` snapshots at load time rather than re-firing
    // the network call every time those values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id, markTabLive, markTabLoading]);

  useEffect(() => {
    if (activeTab === 'debt' && !fetchedTabs.current.has('debt')) {
      fetchedTabs.current.add('debt');
      const fetchDebt = async () => {
        markTabLoading('debt', true);
        try {
          const res = await apiClient.post(`${API_BASE}/debt-products/recommend`, {
            strategy: selectedStrategy,
            products: debtProducts,
          });
          if (res.data) {
            setLiveDebtProducts(res.data);
            markTabLive('debt');
          }
        } catch {
        } finally {
          markTabLoading('debt', false);
        }
      };
      fetchDebt();
    }
  }, [activeTab, selectedStrategy, markTabLive, markTabLoading]);

  useEffect(() => {
    if (activeTab === 'rates' && !fetchedTabs.current.has('rates')) {
      fetchedTabs.current.add('rates');
      const fetchRates = async () => {
        markTabLoading('rates', true);
        try {
          const [cycleRes, lockFloatRes, sensitivityRes] = await Promise.allSettled([
            apiClient.post(`${API_BASE}/rate/cycle-phase`, {
              fedDirection: currentRates.fedDirection,
              durationMonths: 6,
              yieldCurveSlope: currentRates.treasury10Y - currentRates.treasury2Y,
            }),
            apiClient.post(`${API_BASE}/rate/lock-vs-float`, {
              loanAmount: 33750000,
              lockRate: lockVsFloatAnalysis.lockNow.rate,
              expectedFloatRates: [],
              termMonths: 36,
            }),
            apiClient.post(`${API_BASE}/rate/sensitivity`, {
              loanAmount: 33750000,
              holdYears: 5,
            }),
          ]);
          const rateData: any = {};
          if (cycleRes.status === 'fulfilled' && cycleRes.value.data) {
            rateData.cyclePhase = cycleRes.value.data.cyclePhase;
          }
          if (lockFloatRes.status === 'fulfilled' && lockFloatRes.value.data?.analysis) {
            rateData.lockVsFloat = lockFloatRes.value.data.analysis;
          }
          if (sensitivityRes.status === 'fulfilled' && sensitivityRes.value.data?.sensitivityMatrix) {
            rateData.sensitivityMatrix = sensitivityRes.value.data.sensitivityMatrix;
          }
          if (Object.keys(rateData).length > 0) {
            setLiveRateData(rateData);
            markTabLive('rates');
          }
        } catch {
        } finally {
          markTabLoading('rates', false);
        }
      };
      fetchRates();
    }
  }, [activeTab, markTabLive, markTabLoading]);

  useEffect(() => {
    if (activeTab === 'scenarios' && !fetchedTabs.current.has('scenarios')) {
      fetchedTabs.current.add('scenarios');
      const fetchScenarios = async () => {
        markTabLoading('scenarios', true);
        try {
          const res = await apiClient.post(`${API_BASE}/scenarios/compare`, {
            scenarios: scenarioComparison.scenarios.map(s => ({
              name: s.name,
              layers: s.stack.layers,
              uses: s.stack.uses,
            })),
            noi: financial?.noi || 3000000,
            propertyValue: defaultCapitalStack.uses.acquisitionPrice,
          });
          if (res.data?.comparison) {
            setLiveScenarios(res.data.comparison);
            markTabLive('scenarios');
          }
        } catch {
        } finally {
          markTabLoading('scenarios', false);
        }
      };
      fetchScenarios();
    }
    // `financial?.noi` is intentionally captured at first scenarios-tab open;
    // we don't re-fetch when NOI changes because the ref guard above gates
    // this effect to a single fire per deal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, markTabLive, markTabLoading]);

  useEffect(() => {
    if (activeTab === 'timeline' && !fetchedTabs.current.has('timeline')) {
      fetchedTabs.current.add('timeline');
      const fetchTimeline = async () => {
        markTabLoading('timeline', true);
        try {
          const [refiRes, drawRes] = await Promise.allSettled([
            apiClient.post(`${API_BASE}/lifecycle/refi`, {
              stabilizedValue: defaultCapitalStack.uses.acquisitionPrice * 1.2,
              refiLTV: 0.75,
              existingDebt: defaultCapitalStack.metrics.totalDebt,
            }),
            apiClient.post(`${API_BASE}/lifecycle/draw-progress`, {
              draws: [],
              totalCommitment: defaultCapitalStack.uses.renovationBudget,
            }),
          ]);
          const timelineData: any = {};
          if (refiRes.status === 'fulfilled' && refiRes.value.data) {
            timelineData.refi = refiRes.value.data;
          }
          if (drawRes.status === 'fulfilled' && drawRes.value.data) {
            timelineData.drawProgress = drawRes.value.data;
          }
          if (Object.keys(timelineData).length > 0) {
            setLiveTimeline(timelineData);
            markTabLive('timeline');
          }
        } catch {
        } finally {
          markTabLoading('timeline', false);
        }
      };
      fetchTimeline();
    }
  }, [activeTab, markTabLive, markTabLoading]);

  const isAnyLive = liveDataSources.size > 0;

  const renderTabLoading = () => (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading live data...</span>
      </div>
    </div>
  );

  // ========================================================================
  // Cross-Module Wiring: M08 → M11+ (Strategy → Capital Structure)
  // Listen for strategy-selected events and auto-load matching debt template
  // ========================================================================
  useEffect(() => {
    if (lastEvent?.type === 'strategy-selected' && lastEvent.payload?.strategy) {
      const incoming = lastEvent.payload.strategy as StrategyType;
      if (incoming !== selectedStrategy && strategyTemplates[incoming]) {
        setSelectedStrategy(incoming);
        setLayers(strategyTemplates[incoming].defaultStack?.layers || defaultCapitalStack.layers);
      }
    }
  }, [lastEvent, selectedStrategy]);

  // ========================================================================
  // Cross-Module Wiring: M11+ → M09, M14, M12 (Capital → consumers)
  // Emit capital-updated and push state whenever strategy/layers change
  // ========================================================================
  const emitCapitalUpdate = useCallback(() => {
    const totalDebt = layers
      .filter(l => l.layerType === 'senior' || l.layerType === 'mezz')
      .reduce((s, l) => s + l.amount, 0);
    const totalEquity = layers
      .filter(l => ['lpEquity', 'gpEquity', 'prefEquity'].includes(l.layerType))
      .reduce((s, l) => s + l.amount, 0);
    const seniorLayer = layers.find(l => l.layerType === 'senior');
    const seniorRate = seniorLayer?.rate || 0;
    const seniorTerm = seniorLayer?.term || 0;

    // Calculate annual debt service (interest-only approximation from mock)
    const annualDebtService = totalDebt * (seniorRate / 100);
    // NOI from ProForma context (M09 → M11+)
    const noi = financial?.noi || stack.metrics.dscr * annualDebtService || 0;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
    const totalValue = layers.reduce((s, l) => s + l.amount, 0);
    const ltv = totalValue > 0 ? (totalDebt / totalValue) * 100 : 0;

    const capitalPayload = {
      annualDebtService,
      interestOnlyPeriod: seniorLayer?.ioMonths || 0,
      amortizationSchedule: [],
      totalEquity,
      lpEquity: layers.find(l => l.layerType === 'lpEquity')?.amount || 0,
      gpEquity: layers.find(l => l.layerType === 'gpEquity')?.amount || 0,
      weightedCostOfCapital: stack.metrics.wacc,
      loanMaturityYear: seniorTerm,
      dscr,
      ltv,
      ltc: stack.metrics.ltc,
      debtYield: stack.metrics.debtYield,
      loanBalance: [],
      prepaymentPenalty: 0,
      capitalRiskScore: 0,
      structureSummary: `${ltv.toFixed(0)}% LTV ${template.label} │ ${stack.metrics.cocReturn.toFixed(1)}% CoC │ ${dscr.toFixed(2)}x DSCR`,
    };

    // Push to context state (available to all consumers)
    updateCapitalStructure(capitalPayload);

    // Emit event for reactive listeners (M09, M14, M12, M01)
    emitEvent({
      source: 'M11-capital-structure',
      type: 'capital-updated',
      payload: capitalPayload,
    });
    // `selectedStrategy` is not directly read inside this callback (only
    // `template` is, which is derived from it via the parent closure), so
    // it would be flagged as an unnecessary dep — keep it out.
  }, [layers, financial, template, stack, updateCapitalStructure, emitEvent]);

  // Fire capital-updated on mount and whenever layers/strategy change.
  // `emitCapitalUpdate` is itself a useCallback whose identity changes
  // when its inputs change, so depending on it propagates updates correctly.
  useEffect(() => {
    emitCapitalUpdate();
  }, [selectedStrategy, layers, emitCapitalUpdate]);

  // Sources = Uses validation
  const totalSources = useMemo(() => layers.reduce((s, l) => s + l.amount, 0), [layers]);
  const balance = useMemo(() => calcSourcesEqualsUses(totalSources, stack.uses.total), [totalSources, stack.uses.total]);

  // Filter debt products by strategy
  const filteredProducts = useMemo(
    () => debtProducts.filter((p) => p.bestForStrategies.includes(selectedStrategy)),
    [selectedStrategy],
  );
  const otherProducts = useMemo(
    () => debtProducts.filter((p) => !p.bestForStrategies.includes(selectedStrategy)),
    [selectedStrategy],
  );

  // Mismatch warnings for current strategy
  const activeWarnings = useMemo(
    () => strategyMismatchWarnings.filter((w) => w.strategy === selectedStrategy),
    [selectedStrategy],
  );

  // ========================================================================
  // Render: Strategy Selector (always visible)
  // ========================================================================

  const renderStrategySelector = () => (
    <div className="flex gap-2 flex-wrap">
      {(Object.keys(strategyTemplates) as StrategyType[]).map((key) => {
        const t = strategyTemplates[key];
        const isActive = selectedStrategy === key;
        return (
          <button
            key={key}
            onClick={() => {
              setSelectedStrategy(key);
              setLayers(strategyTemplates[key].defaultStack?.layers || defaultCapitalStack.layers);
              emitEvent({
                source: 'M11-capital-structure',
                type: 'strategy-selected',
                payload: { strategy: key },
              });
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
              isActive
                ? 'border-blue-700 bg-neutral-800 text-blue-300 shadow-sm'
                : 'border-neutral-700 hover:border-neutral-700'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  // ========================================================================
  // Tab 1: Capital Stack Designer
  // ========================================================================

  const renderCapitalStack = () => {
    const totalHeight = stack.uses.total;
    return (
      <div className="space-y-6">
        {/* Sources = Uses Balance Bar */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
          balance.balanced ? 'border-green-700 bg-neutral-800' : 'border-red-700 bg-neutral-800'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${balance.balanced ? 'text-green-400' : 'text-red-400'}`}>
              {balance.balanced ? '=' : '!'}
            </span>
            <div>
              <div className="text-sm font-semibold">
                Sources {fmtM(totalSources)} {balance.balanced ? '=' : '≠'} Uses {fmtM(stack.uses.total)}
              </div>
              {!balance.balanced && (
                <div className="text-xs text-red-400 mt-1">
                  {balance.imbalance > 0 ? `${fmtM(balance.imbalance)} excess sources` : `${fmtM(Math.abs(balance.imbalance))} funding gap`}
                </div>
              )}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            balance.balanced ? 'bg-neutral-800 text-green-400' : 'bg-neutral-800 text-red-400'
          }`}>
            {balance.balanced ? 'BALANCED' : 'IMBALANCED'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Stack Bar */}
          <div className="rounded-lg border p-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Capital Stack</h4>
            <div className="flex rounded-lg overflow-hidden h-12 border">
              {layers.map((layer) => {
                const widthPct = (layer.amount / totalHeight) * 100;
                return (
                  <div
                    key={layer.id}
                    className={`${layer.color} relative group cursor-pointer transition-opacity hover:opacity-90`}
                    style={{ width: `${widthPct}%` }}
                    title={`${layer.name}: ${fmtM(layer.amount)} (${widthPct.toFixed(0)}%)`}
                  >
                    {widthPct > 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-neutral-100 text-xs font-semibold">
                        {widthPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-2">
              {layers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${layer.color}`} />
                    <span className="text-neutral-400">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-neutral-400">{fmtPct(layer.rate)}</span>
                    <span className="font-semibold">{fmtM(layer.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack Metrics */}
          <div className="rounded-lg border p-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Key Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'LTV', value: fmtPct(stack.metrics.ltv), color: stack.metrics.ltv > 75 ? 'text-orange-400' : 'text-green-400' },
                { label: 'LTC', value: fmtPct(stack.metrics.ltc), color: 'text-neutral-400' },
                { label: 'DSCR', value: `${stack.metrics.dscr.toFixed(2)}x`, color: stack.metrics.dscr < 1.25 ? 'text-red-400' : 'text-green-400' },
                { label: 'Debt Yield', value: fmtPct(stack.metrics.debtYield), color: 'text-neutral-400' },
                { label: 'Total Debt', value: fmtM(stack.metrics.totalDebt), color: 'text-blue-300' },
                { label: 'Total Equity', value: fmtM(stack.metrics.totalEquity), color: 'text-green-400' },
                { label: 'WACC', value: fmtPct(stack.metrics.weightedAvgCostOfCapital), color: 'text-neutral-400' },
                { label: 'Cash-on-Cash', value: fmtPct(stack.metrics.cocReturn), color: 'text-purple-300' },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded-lg">
                  <div className="text-xs uppercase">{m.label}</div>
                  <div className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Uses Breakdown */}
        <div className="rounded-lg border p-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Uses of Capital</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Acquisition Price', value: stack.uses.acquisitionPrice },
              { label: 'Closing Costs', value: stack.uses.closingCosts },
              { label: 'Renovation Budget', value: stack.uses.renovationBudget },
              { label: 'Carrying Costs', value: stack.uses.carryingCosts },
              { label: 'Reserves', value: stack.uses.reserves },
              { label: 'Developer Fee', value: stack.uses.developerFee },
            ].map((u) => (
              <div key={u.label} className="flex items-center justify-between p-3 rounded-lg">
                <span className="text-sm">{u.label}</span>
                <span className="text-sm font-semibold">{fmtM(u.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm font-semibold">Total Uses</span>
            <span className="text-lg font-bold">{fmtM(stack.uses.total)}</span>
          </div>
        </div>

        {/* Insights */}
        {renderInsights(liveInsights || stackInsights)}
      </div>
    );
  };

  // ========================================================================
  // Tab 2: Strategy-Aware Debt Selector
  // ========================================================================

  const renderDebtSelector = () => (
    <div className="space-y-6">
      {/* Strategy template info */}
      <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-lg border border-blue-700 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{template.label} Capital Template</h3>
            <p className="text-sm mt-1">{template.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase">Key Metric</div>
            <div className="text-sm font-semibold text-blue-300">{template.keyMetric}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-xs">Primary Debt</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.productType.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-xs">Rate Range</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.rateRange.min}–{template.defaultStack.seniorDebt.rateRange.max}%</div>
          </div>
          <div>
            <div className="text-xs">Hold Period</div>
            <div className="text-sm font-semibold">{template.holdPeriod}</div>
          </div>
          <div>
            <div className="text-xs">Exit</div>
            <div className="text-sm font-semibold">{template.exitStrategy}</div>
          </div>
        </div>
      </div>

      {/* Mismatch warnings */}
      {activeWarnings.map((w, i) => (
        <div key={i} className="p-4 bg-neutral-800 border-2 border-red-700 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-400 text-lg font-bold">!</span>
            <div>
              <div className="text-sm font-semibold text-red-400">Strategy Mismatch: {w.debtProduct}</div>
              <div className="text-sm text-red-400 mt-1">{w.issue}</div>
              <div className="text-sm text-red-400 mt-2 font-medium">Suggestion: {w.suggestion}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Recommended products */}
      <div>
        <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">
          Recommended for {template.label} ({filteredProducts.length} products)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="rounded-lg border-2 border-blue-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-xs">{product.lender}</div>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-neutral-800 text-blue-300">
                  {product.rateType === 'fixed' ? 'Fixed' : 'Floating'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <div className="text-xs">Rate</div>
                  <div className="text-sm font-semibold">{product.rateRange.min}–{product.rateRange.max}%</div>
                </div>
                <div>
                  <div className="text-xs">Max LTV</div>
                  <div className="text-sm font-semibold">{product.ltvMax}%</div>
                </div>
                <div>
                  <div className="text-xs">Term</div>
                  <div className="text-sm font-semibold">{product.term.min}–{product.term.max}mo</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-neutral-800 rounded text-xs text-green-400">{product.keyBenefit}</div>
              <div className="mt-2 p-3 bg-neutral-800 rounded text-xs text-red-400">{product.keyRisk}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Other products (greyed out) */}
      {otherProducts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">
            Not Recommended for {template.label} ({otherProducts.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            {otherProducts.map((product) => (
              <div key={product.id} className=" rounded-lg border p-4">
                <div className="font-semibold">{product.name}</div>
                <div className="text-xs">{product.lender} — {product.rateRange.min}–{product.rateRange.max}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ========================================================================
  // Tab 3: Rate Environment & Cycle Position
  // ========================================================================

  const renderRateEnvironment = () => (
    <div className="space-y-6">
      {/* Current rates */}
      <div className="bg-gradient-to-r from-neutral-800 to-neutral-900 rounded-lg border border-blue-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Current Rate Environment</h3>
          <span className="text-xs">Updated: {currentRates.lastUpdated}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Fed Funds', value: fmtPct(currentRates.fedFunds), color: 'text-blue-300' },
            { label: '10Y Treasury', value: fmtPct(currentRates.treasury10Y), color: 'text-purple-300' },
            { label: 'SOFR', value: fmtPct(currentRates.sofr), color: 'text-indigo-300' },
            { label: 'Prime', value: fmtPct(currentRates.prime), color: 'text-green-400' },
          ].map((r) => (
            <div key={r.label} className="rounded-lg p-4 border">
              <div className="text-xs uppercase">{r.label}</div>
              <div className={`text-2xl font-bold mt-1 ${r.color}`}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cycle Phase + Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">Cycle Position</h4>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
              currentRates.cyclePhase === 'easing' ? 'bg-neutral-800 text-green-400' :
              currentRates.cyclePhase === 'tightening' ? 'bg-neutral-800 text-red-400' :
              currentRates.cyclePhase === 'peak' ? 'bg-neutral-700 text-orange-400' :
              'bg-neutral-800 text-blue-300'
            }`}>
              {currentRates.cyclePhase === 'easing' ? '↓' : currentRates.cyclePhase === 'tightening' ? '↑' : '→'}
            </div>
            <div>
              <div className="text-lg font-semibold capitalize">{currentRates.cyclePhase}</div>
              <div className="text-sm">Fed {currentRates.fedDirection} — Next meeting: {currentRates.nextFedMeeting}</div>
              <div className="text-sm mt-1">{currentRates.cutProbability6mo}% probability of cut within 6mo</div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg text-sm">
            {currentRates.marketSentiment}
          </div>
        </div>

        {/* Lock vs Float */}
        <div className="rounded-lg border p-6">
          <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">Lock vs Float Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'lock' ? 'border-blue-700 bg-neutral-800' : 'border-neutral-700'}`}>
              <div className="text-xs uppercase">Lock Now</div>
              <div className="text-xl font-bold mt-1">{fmtPct(lockVsFloatAnalysis.lockNow.rate)}</div>
              <div className="text-sm mt-1">NPV: {fmtM(lockVsFloatAnalysis.lockNow.npv)}</div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'float' ? 'border-green-700 bg-neutral-800' : 'border-neutral-700'}`}>
              <div className="text-xs uppercase">Float & Wait</div>
              <div className="text-xl font-bold mt-1">{fmtPct(lockVsFloatAnalysis.floatAndWait.expectedRate)}</div>
              <div className="text-sm mt-1">NPV: {fmtM(lockVsFloatAnalysis.floatAndWait.npv)}</div>
            </div>
          </div>
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            lockVsFloatAnalysis.recommendation === 'float' ? 'bg-neutral-800 text-green-400 border border-green-700' : 'bg-neutral-800 text-blue-300 border border-blue-700'
          }`}>
            <span className="font-semibold">Recommendation: {lockVsFloatAnalysis.recommendation === 'float' ? 'Float' : 'Lock'}</span>
            <span className="ml-1">— {lockVsFloatAnalysis.rationale.slice(0, 120)}...</span>
          </div>
        </div>
      </div>

      {/* Spread Analysis */}
      <div className="rounded-lg border p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">Spread Analysis vs 5-Year Average</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {spreadAnalysis.map((s) => (
            <div key={s.productType} className="p-4 rounded-lg">
              <div className="text-xs uppercase">{s.productType}</div>
              <div className="text-xl font-bold mt-1">{s.currentSpread} bps</div>
              <div className="text-xs mt-1">5yr avg: {s.fiveYearAvg} bps</div>
              <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold inline-block ${
                s.position === 'tight' ? 'bg-neutral-800 text-green-400' :
                s.position === 'wide' ? 'bg-neutral-800 text-red-400' :
                'bg-neutral-800'
              }`}>
                {s.position.toUpperCase()} ({s.percentile}th pctl)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Forecast */}
      <div className="rounded-lg border p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide mb-3">Rate Forecast</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Horizon</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">10Y Treasury</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">SOFR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Confidence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase">Rate Impact ($33.75M loan)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rateForecast.map((f) => {
                const rateDelta = (currentRates.treasury10Y - f.treasury10Y) * 100;
                const impact = calcRateSensitivity(33750000, rateDelta, f.months / 12);
                return (
                  <tr key={f.months} className="">
                    <td className="px-4 py-3 text-sm font-medium">{f.months}mo</td>
                    <td className="px-4 py-3 text-sm text-right">{fmtPct(f.treasury10Y)}</td>
                    <td className="px-4 py-3 text-sm text-right">{fmtPct(f.sofr)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        f.confidence >= 60 ? 'bg-neutral-800 text-green-400' : 'bg-neutral-700 text-yellow-300'
                      }`}>
                        {f.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-400">
                      {impact > 0 ? `Save ${fmtM(impact)}` : `Cost ${fmtM(Math.abs(impact))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // ========================================================================
  // Tab 5: Scenario Comparison
  // ========================================================================

  const renderScenarios = () => (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Capital Structure Scenarios</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className=" border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Metric</th>
                {scenarioComparison.scenarios.map((s) => (
                  <th key={s.id} className={`px-4 py-3 text-center text-xs font-semibold uppercase ${
                    s.isActive ? 'text-blue-300 bg-neutral-800' : 'text-neutral-400'
                  }`}>
                    {s.name}
                    {s.isActive && <div className="text-[10px] mt-1 text-blue-300">ACTIVE</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {renderScenarioRow('IRR', (s: CapitalScenario) => fmtPct(s.returns.irr), 'bestIRR')}
              {renderScenarioRow('Equity Multiple', (s: CapitalScenario) => `${s.returns.equityMultiple.toFixed(2)}x`)}
              {renderScenarioRow('Cash-on-Cash', (s: CapitalScenario) => fmtPct(s.returns.cocReturn))}
              {renderScenarioRow('DSCR', (s: CapitalScenario) => `${s.returns.dscr.toFixed(2)}x`)}
              {renderScenarioRow('LTV', (s: CapitalScenario) => fmtPct(s.stack.metrics.ltv))}
              {renderScenarioRow('Total Debt', (s: CapitalScenario) => fmtM(s.stack.metrics.totalDebt))}
              {renderScenarioRow('Equity Required', (s: CapitalScenario) => fmtM(s.stack.metrics.equityRequired))}
              {renderScenarioRow('Refi Risk', (s: CapitalScenario) => (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  s.risks.refinanceRisk === 'low' ? 'bg-neutral-800 text-green-400' :
                  s.risks.refinanceRisk === 'medium' ? 'bg-neutral-700 text-yellow-300' :
                  'bg-neutral-800 text-red-400'
                }`}>{s.risks.refinanceRisk}</span>
              ))}
              {renderScenarioRow('Rate Risk', (s: CapitalScenario) => (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  s.risks.interestRateRisk === 'low' ? 'bg-neutral-800 text-green-400' :
                  s.risks.interestRateRisk === 'medium' ? 'bg-neutral-700 text-yellow-300' :
                  'bg-neutral-800 text-red-400'
                }`}>{s.risks.interestRateRisk}</span>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation */}
      <div className="p-6 bg-neutral-800 border-2 border-blue-700 rounded-lg">
        <div className="text-sm font-semibold text-blue-300 mb-1">Recommendation</div>
        <div className="text-sm text-blue-300">{scenarioComparison.recommendation}</div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-blue-300">IRR Spread</div>
            <div className="text-lg font-bold text-blue-300">{fmtPct(scenarioComparison.delta.irr)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-blue-300">Multiple Spread</div>
            <div className="text-lg font-bold text-blue-300">{scenarioComparison.delta.equityMultiple.toFixed(2)}x</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-blue-300">DSCR Spread</div>
            <div className="text-lg font-bold text-blue-300">{scenarioComparison.delta.dscr.toFixed(2)}x</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScenarioRow = (label: string, getter: (s: CapitalScenario) => React.ReactNode, bestKey?: string) => (
    <tr className="">
      <td className="px-4 py-3 text-sm font-medium">{label}</td>
      {scenarioComparison.scenarios.map((s) => (
        <td key={s.id} className={`px-4 py-3 text-sm text-center ${
          s.isActive ? 'bg-neutral-800 font-semibold' : ''
        } ${bestKey && s.id === (scenarioComparison as any)[bestKey] ? 'text-green-400 font-bold' : 'text-neutral-400'}`}>
          {getter(s)}
        </td>
      ))}
    </tr>
  );

  // ========================================================================
  // Tab 6: Debt Lifecycle Timeline
  // ========================================================================

  const renderTimeline = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Financing Timeline</h4>

        {/* Horizontal timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5" />
          <div className="space-y-6 pl-12">
            {debtTimeline.events.map((event) => (
              <div key={event.id} className="relative">
                <div className={`absolute -left-[2.15rem] w-4 h-4 rounded-full border-2 ${
                  event.isKeyEvent
                    ? 'bg-neutral-800 border-blue-700'
                    : event.isPast
                    ? 'bg-neutral-800'
                    : 'bg-neutral-900'
                }`} />
                <div className={`p-4 rounded-lg border ${event.isKeyEvent ? 'border-blue-700 bg-neutral-800' : 'border-neutral-700'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold">{event.title}</div>
                      <div className="text-xs mt-0.5">{event.date}</div>
                      <div className="text-sm mt-1">{event.description}</div>
                    </div>
                    {event.amount && (
                      <span className="text-sm font-semibold">{fmtM(event.amount)}</span>
                    )}
                  </div>
                  <span className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    event.type === 'origination' ? 'bg-neutral-800 text-blue-300' :
                    event.type === 'draw' ? 'bg-neutral-800 text-green-400' :
                    event.type === 'refinance' ? 'bg-neutral-800 text-purple-300' :
                    event.type === 'maturity' ? 'bg-neutral-800 text-red-400' :
                    event.type === 'milestone' ? 'bg-neutral-700 text-yellow-300' :
                    'bg-neutral-800'
                  }`}>
                    {event.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase">Interest Reserve</div>
          <div className="text-xl font-bold mt-1">{fmtM(debtTimeline.interestReserve)}</div>
          <div className="text-xs mt-1">Budgeted for carry period</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase">Key Events</div>
          <div className="text-xl font-bold mt-1">{debtTimeline.events.filter((e) => e.isKeyEvent).length}</div>
          <div className="text-xs mt-1">Major financing milestones</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase">Total Draws Planned</div>
          <div className="text-xl font-bold mt-1">
            {fmtM(debtTimeline.events.filter((e) => e.type === 'draw').reduce((s, e) => s + (e.amount || 0), 0))}
          </div>
          <div className="text-xs mt-1">Across {debtTimeline.events.filter((e) => e.type === 'draw').length} draws</div>
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // Tab 7: Cross-Module Integration
  // ========================================================================

  const renderIntegration = () => (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide mb-4">Cross-Module Data Flow</h4>
        <div className="space-y-4">
          {[
            { from: 'M08 Strategy', to: 'M11 Capital Structure', direction: 'incoming', description: 'Strategy selection loads capital template', event: 'strategy.selected', status: 'active' },
            { from: 'M11 Capital Structure', to: 'M09 ProForma', direction: 'outgoing', description: 'Debt service feeds NOI calculation', event: 'capital.stack.updated', status: 'active' },
            { from: 'M09 ProForma', to: 'M11 Capital Structure', direction: 'incoming', description: 'NOI updates recalculate DSCR constraints', event: 'proforma.noi.updated', status: 'active' },
            { from: 'M11 Capital Structure', to: 'M14 Risk', direction: 'outgoing', description: 'Financial risk subscore from capital structure', event: 'capital.structure.risk', status: 'planned' },
            { from: 'M11 Capital Structure', to: 'M01 Overview', direction: 'outgoing', description: 'Return metrics for deal summary', event: 'capital.returns.updated', status: 'planned' },
            { from: 'M11 Capital Structure', to: 'M12 Exit', direction: 'outgoing', description: 'Debt payoff and refi proceeds for exit analysis', event: 'capital.stack.updated', status: 'planned' },
          ].map((flow, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${flow.status === 'active' ? 'bg-neutral-800' : 'bg-neutral-700'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{flow.from}</span>
                  <span className="text-neutral-400">{flow.direction === 'incoming' ? '→' : '←'}</span>
                  <span className="text-sm font-semibold">{flow.to}</span>
                </div>
                <div className="text-xs mt-0.5">{flow.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs px-2 py-0.5 rounded">{flow.event}</code>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  flow.status === 'active' ? 'bg-neutral-800 text-green-400' : 'bg-neutral-700 text-yellow-300'
                }`}>
                  {flow.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-neutral-800 border border-blue-700 rounded-lg text-sm text-blue-300">
        Phase 1 uses mock data. Phase 2 backend services will power real calculations. Phase 3 will wire live cross-module events via the Event Bus.
      </div>
    </div>
  );

  // ========================================================================
  // Shared: Insights renderer
  // ========================================================================

  const renderInsights = (insights: MetricInsight[]) => (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div key={i} className={`p-4 rounded-lg border ${
          insight.severity === 'success' ? 'border-green-700 bg-neutral-800' :
          insight.severity === 'warning' ? 'border-yellow-700 bg-neutral-700' :
          insight.severity === 'danger' ? 'border-red-700 bg-neutral-800' :
          'border-blue-700 bg-neutral-800'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">{insight.metric}: {insight.value}</div>
              <div className="text-sm mt-1">{insight.insight}</div>
            </div>
            {insight.action && (
              <button className="text-xs text-blue-300 font-semibold hover:text-blue-300 whitespace-nowrap ml-4">
                {insight.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // ========================================================================
  // Main Render
  // ========================================================================

  return (
    <div className="bt-tab-wrap space-y-6" style={{ background: BT.bg.terminal, color: BT.text.primary, padding: 16 }}>
      <style>{BT_CSS + BT_TAB_CSS}</style>
      {/* Strategy Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {renderStrategySelector()}
          {isAnyLive && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-green-400 border border-green-700 animate-pulse">
              LIVE DATA
            </span>
          )}
        </div>
        <div className="text-xs">
          Template: <span className="font-semibold">{template.label}</span> — {template.holdPeriod}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-700 text-blue-300'
                : 'text-neutral-400 '
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'debt' && (tabLoading.debt ? renderTabLoading() : renderDebtSelector())}
      {activeTab === 'rates' && (tabLoading.rates ? renderTabLoading() : renderRateEnvironment())}
      {activeTab === 'scenarios' && (tabLoading.scenarios ? renderTabLoading() : renderScenarios())}
      {activeTab === 'timeline' && (tabLoading.timeline ? renderTabLoading() : renderTimeline())}
      {activeTab === 'integration' && renderIntegration()}
    </div>
  );
};

export default CapitalStructureSection;
