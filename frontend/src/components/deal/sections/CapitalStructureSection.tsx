/**
 * Capital Structure Section — M11+ Engine
 *
 * Replaces the basic Debt tab with a full capital structure design engine.
 * 7 tabs: Stack Designer, Debt Selector, Rate Environment,
 * Equity Waterfall, Scenario Comparison, Lifecycle Timeline, Integration.
 *
 * Strategy-aware: when strategy changes, the entire capital structure template reloads.
 */

import React, { useState, useMemo } from 'react';
import type {
  StrategyType,
  CapitalLayer,
  CapitalScenario,
  MetricInsight,
} from '../../../types/capital-structure.types';
import {
  strategyTemplates,
  defaultCapitalStack,
  debtProducts,
  currentRates,
  rateForecast,
  lockVsFloatAnalysis,
  spreadAnalysis,
  defaultWaterfall,
  waterfallResult,
  scenarioComparison,
  debtTimeline,
  stackInsights,
  strategyMismatchWarnings,
  calcSourcesEqualsUses,
  calcRateSensitivity,
} from '../../../data/capitalStructureMockData';

// ============================================================================
// Props
// ============================================================================

interface CapitalStructureSectionProps {
  deal: any;
  isPremium?: boolean;
  dealStatus?: 'pipeline' | 'owned';
}

type TabId = 'stack' | 'debt' | 'rates' | 'waterfall' | 'scenarios' | 'timeline' | 'integration';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'stack', label: 'Capital Stack', icon: '◈' },
  { id: 'debt', label: 'Debt Selector', icon: '◇' },
  { id: 'rates', label: 'Rate Environment', icon: '◆' },
  { id: 'waterfall', label: 'Equity Waterfall', icon: '▽' },
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
  const [activeTab, setActiveTab] = useState<TabId>('stack');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('rental_value_add');
  const [layers, setLayers] = useState<CapitalLayer[]>(defaultCapitalStack.layers);

  const template = strategyTemplates[selectedStrategy];
  const stack = defaultCapitalStack;

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
            onClick={() => setSelectedStrategy(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
              isActive
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
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
          balance.balanced ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${balance.balanced ? 'text-green-600' : 'text-red-600'}`}>
              {balance.balanced ? '=' : '!'}
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Sources {fmtM(totalSources)} {balance.balanced ? '=' : '≠'} Uses {fmtM(stack.uses.total)}
              </div>
              {!balance.balanced && (
                <div className="text-xs text-red-600 mt-1">
                  {balance.imbalance > 0 ? `${fmtM(balance.imbalance)} excess sources` : `${fmtM(Math.abs(balance.imbalance))} funding gap`}
                </div>
              )}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            balance.balanced ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
          }`}>
            {balance.balanced ? 'BALANCED' : 'IMBALANCED'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visual Stack Bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Capital Stack</h4>
            <div className="flex rounded-lg overflow-hidden h-12 border border-gray-300">
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
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">
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
                    <span className="text-gray-700">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">{fmtPct(layer.rate)}</span>
                    <span className="font-semibold text-gray-900">{fmtM(layer.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack Metrics */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Key Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'LTV', value: fmtPct(stack.metrics.ltv), color: stack.metrics.ltv > 75 ? 'text-orange-600' : 'text-green-600' },
                { label: 'LTC', value: fmtPct(stack.metrics.ltc), color: 'text-gray-900' },
                { label: 'DSCR', value: `${stack.metrics.dscr.toFixed(2)}x`, color: stack.metrics.dscr < 1.25 ? 'text-red-600' : 'text-green-600' },
                { label: 'Debt Yield', value: fmtPct(stack.metrics.debtYield), color: 'text-gray-900' },
                { label: 'Total Debt', value: fmtM(stack.metrics.totalDebt), color: 'text-blue-600' },
                { label: 'Total Equity', value: fmtM(stack.metrics.totalEquity), color: 'text-green-600' },
                { label: 'WACC', value: fmtPct(stack.metrics.weightedAvgCostOfCapital), color: 'text-gray-900' },
                { label: 'Cash-on-Cash', value: fmtPct(stack.metrics.cocReturn), color: 'text-purple-600' },
              ].map((m) => (
                <div key={m.label} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">{m.label}</div>
                  <div className={`text-xl font-bold mt-1 ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Uses Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Uses of Capital</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Acquisition Price', value: stack.uses.acquisitionPrice },
              { label: 'Closing Costs', value: stack.uses.closingCosts },
              { label: 'Renovation Budget', value: stack.uses.renovationBudget },
              { label: 'Carrying Costs', value: stack.uses.carryingCosts },
              { label: 'Reserves', value: stack.uses.reserves },
              { label: 'Developer Fee', value: stack.uses.developerFee },
            ].map((u) => (
              <div key={u.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{u.label}</span>
                <span className="text-sm font-semibold text-gray-900">{fmtM(u.value)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-900">Total Uses</span>
            <span className="text-lg font-bold text-gray-900">{fmtM(stack.uses.total)}</span>
          </div>
        </div>

        {/* Insights */}
        {renderInsights(stackInsights)}
      </div>
    );
  };

  // ========================================================================
  // Tab 2: Strategy-Aware Debt Selector
  // ========================================================================

  const renderDebtSelector = () => (
    <div className="space-y-6">
      {/* Strategy template info */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{template.label} Capital Template</h3>
            <p className="text-sm text-gray-600 mt-1">{template.description}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase">Key Metric</div>
            <div className="text-sm font-semibold text-blue-700">{template.keyMetric}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-xs text-gray-500">Primary Debt</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.productType.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Rate Range</div>
            <div className="text-sm font-semibold">{template.defaultStack.seniorDebt.rateRange.min}–{template.defaultStack.seniorDebt.rateRange.max}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Hold Period</div>
            <div className="text-sm font-semibold">{template.holdPeriod}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Exit</div>
            <div className="text-sm font-semibold">{template.exitStrategy}</div>
          </div>
        </div>
      </div>

      {/* Mismatch warnings */}
      {activeWarnings.map((w, i) => (
        <div key={i} className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-lg font-bold">!</span>
            <div>
              <div className="text-sm font-semibold text-red-800">Strategy Mismatch: {w.debtProduct}</div>
              <div className="text-sm text-red-700 mt-1">{w.issue}</div>
              <div className="text-sm text-red-600 mt-2 font-medium">Suggestion: {w.suggestion}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Recommended products */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Recommended for {template.label} ({filteredProducts.length} products)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg border-2 border-blue-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.lender}</div>
                </div>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                  {product.rateType === 'fixed' ? 'Fixed' : 'Floating'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                  <div className="text-xs text-gray-500">Rate</div>
                  <div className="text-sm font-semibold">{product.rateRange.min}–{product.rateRange.max}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Max LTV</div>
                  <div className="text-sm font-semibold">{product.ltvMax}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Term</div>
                  <div className="text-sm font-semibold">{product.term.min}–{product.term.max}mo</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-green-50 rounded text-xs text-green-800">{product.keyBenefit}</div>
              <div className="mt-2 p-3 bg-red-50 rounded text-xs text-red-700">{product.keyRisk}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Other products (greyed out) */}
      {otherProducts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Not Recommended for {template.label} ({otherProducts.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
            {otherProducts.map((product) => (
              <div key={product.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="font-semibold text-gray-600">{product.name}</div>
                <div className="text-xs text-gray-400">{product.lender} — {product.rateRange.min}–{product.rateRange.max}%</div>
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Current Rate Environment</h3>
          <span className="text-xs text-gray-500">Updated: {currentRates.lastUpdated}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Fed Funds', value: fmtPct(currentRates.fedFunds), color: 'text-blue-600' },
            { label: '10Y Treasury', value: fmtPct(currentRates.treasury10Y), color: 'text-purple-600' },
            { label: 'SOFR', value: fmtPct(currentRates.sofr), color: 'text-indigo-600' },
            { label: 'Prime', value: fmtPct(currentRates.prime), color: 'text-green-600' },
          ].map((r) => (
            <div key={r.label} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs text-gray-500 uppercase">{r.label}</div>
              <div className={`text-2xl font-bold mt-1 ${r.color}`}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cycle Phase + Sentiment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Cycle Position</h4>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
              currentRates.cyclePhase === 'easing' ? 'bg-green-100 text-green-700' :
              currentRates.cyclePhase === 'tightening' ? 'bg-red-100 text-red-700' :
              currentRates.cyclePhase === 'peak' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {currentRates.cyclePhase === 'easing' ? '↓' : currentRates.cyclePhase === 'tightening' ? '↑' : '→'}
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 capitalize">{currentRates.cyclePhase}</div>
              <div className="text-sm text-gray-600">Fed {currentRates.fedDirection} — Next meeting: {currentRates.nextFedMeeting}</div>
              <div className="text-sm text-gray-600 mt-1">{currentRates.cutProbability6mo}% probability of cut within 6mo</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            {currentRates.marketSentiment}
          </div>
        </div>

        {/* Lock vs Float */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Lock vs Float Analysis</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'lock' ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <div className="text-xs text-gray-500 uppercase">Lock Now</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{fmtPct(lockVsFloatAnalysis.lockNow.rate)}</div>
              <div className="text-sm text-gray-600 mt-1">NPV: {fmtM(lockVsFloatAnalysis.lockNow.npv)}</div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${lockVsFloatAnalysis.recommendation === 'float' ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
              <div className="text-xs text-gray-500 uppercase">Float & Wait</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{fmtPct(lockVsFloatAnalysis.floatAndWait.expectedRate)}</div>
              <div className="text-sm text-gray-600 mt-1">NPV: {fmtM(lockVsFloatAnalysis.floatAndWait.npv)}</div>
            </div>
          </div>
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            lockVsFloatAnalysis.recommendation === 'float' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            <span className="font-semibold">Recommendation: {lockVsFloatAnalysis.recommendation === 'float' ? 'Float' : 'Lock'}</span>
            <span className="ml-1">— {lockVsFloatAnalysis.rationale.slice(0, 120)}...</span>
          </div>
        </div>
      </div>

      {/* Spread Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Spread Analysis vs 5-Year Average</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {spreadAnalysis.map((s) => (
            <div key={s.productType} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 uppercase">{s.productType}</div>
              <div className="text-xl font-bold text-gray-900 mt-1">{s.currentSpread} bps</div>
              <div className="text-xs text-gray-500 mt-1">5yr avg: {s.fiveYearAvg} bps</div>
              <div className={`mt-2 px-2 py-1 rounded text-xs font-semibold inline-block ${
                s.position === 'tight' ? 'bg-green-100 text-green-700' :
                s.position === 'wide' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {s.position.toUpperCase()} ({s.percentile}th pctl)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Forecast */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Rate Forecast</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Horizon</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">10Y Treasury</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">SOFR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Confidence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Rate Impact ($33.75M loan)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rateForecast.map((f) => {
                const rateDelta = (currentRates.treasury10Y - f.treasury10Y) * 100;
                const impact = calcRateSensitivity(33750000, rateDelta, f.months / 12);
                return (
                  <tr key={f.months} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.months}mo</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPct(f.treasury10Y)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPct(f.sofr)}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        f.confidence >= 60 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {f.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
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
  // Tab 4: Equity Waterfall
  // ========================================================================

  const renderEquityWaterfall = () => {
    const wf = defaultWaterfall;
    const result = waterfallResult;
    return (
      <div className="space-y-6">
        {/* Structure overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Equity Structure</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LP Capital ({wf.lpPercentage}%)</span>
                <span className="text-sm font-semibold">{fmtM(wf.lpCapital)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">GP Co-Invest ({wf.gpPercentage}%)</span>
                <span className="text-sm font-semibold">{fmtM(wf.gpCapital)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-semibold text-gray-900">Total Equity</span>
                <span className="text-sm font-bold text-gray-900">{fmtM(wf.totalEquity)}</span>
              </div>
              <div className="mt-2 p-3 bg-blue-50 rounded text-xs text-blue-800">
                Preferred Return: {wf.preferredReturn}% annual
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">LP Returns</h4>
            <div className="text-3xl font-bold text-green-600">{fmtPct(result.lpIRR)} IRR</div>
            <div className="text-lg font-semibold text-gray-700 mt-1">{result.lpEquityMultiple.toFixed(2)}x Multiple</div>
            <div className="text-sm text-gray-600 mt-2">Total: {fmtM(result.lpTotalReturn)}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">GP Returns</h4>
            <div className="text-3xl font-bold text-purple-600">{fmtPct(result.gpIRR)} IRR</div>
            <div className="text-lg font-semibold text-gray-700 mt-1">{(result.gpEffectiveShare * 100).toFixed(0)}% Effective Share</div>
            <div className="text-sm text-gray-600 mt-2">Total: {fmtM(result.gpTotalReturn)}</div>
          </div>
        </div>

        {/* Waterfall visualization */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Distribution Waterfall</h4>
          <div className="space-y-4">
            {result.distributions.map((dist, i) => {
              const total = result.totalDistributed;
              const lpWidth = (dist.lpDistribution / total) * 100;
              const gpWidth = (dist.gpDistribution / total) * 100;
              return (
                <div key={dist.tierId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{dist.tierName}</span>
                    <span className="text-sm text-gray-600">{fmtM(dist.totalDistribution)}</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-8 bg-gray-100">
                    {lpWidth > 0 && (
                      <div className="bg-green-500 flex items-center justify-center" style={{ width: `${lpWidth}%` }}>
                        {lpWidth > 8 && <span className="text-white text-xs font-semibold">LP {fmtM(dist.lpDistribution)}</span>}
                      </div>
                    )}
                    {gpWidth > 0 && (
                      <div className="bg-purple-500 flex items-center justify-center" style={{ width: `${gpWidth}%` }}>
                        {gpWidth > 8 && <span className="text-white text-xs font-semibold">GP {fmtM(dist.gpDistribution)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Insight */}
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-sm text-purple-900">
              <span className="font-semibold">At projected {fmtPct(result.distributions[result.distributions.length - 1].irr)} IRR:</span>{' '}
              GP earns {(result.gpEffectiveShare * 100).toFixed(0)}% effective share on {wf.gpPercentage}% equity contribution.
              LP still nets {fmtPct(result.lpIRR)} IRR and {result.lpEquityMultiple.toFixed(2)}x multiple.
            </div>
          </div>
        </div>

        {/* Tier details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Promote Structure</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">IRR Hurdle</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">LP Split</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">GP Split</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {wf.tiers.map((tier) => (
                  <tr key={tier.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{tier.name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPct(tier.hurdleRate * 100)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{(tier.lpSplit * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-sm text-right text-purple-600 font-semibold">{(tier.gpSplit * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{tier.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ========================================================================
  // Tab 5: Scenario Comparison
  // ========================================================================

  const renderScenarios = () => (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Capital Structure Scenarios</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Metric</th>
                {scenarioComparison.scenarios.map((s) => (
                  <th key={s.id} className={`px-4 py-3 text-center text-xs font-semibold uppercase ${
                    s.isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-600'
                  }`}>
                    {s.name}
                    {s.isActive && <div className="text-[10px] mt-1 text-blue-500">ACTIVE</div>}
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
                  s.risks.refinanceRisk === 'low' ? 'bg-green-100 text-green-700' :
                  s.risks.refinanceRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{s.risks.refinanceRisk}</span>
              ))}
              {renderScenarioRow('Rate Risk', (s: CapitalScenario) => (
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  s.risks.interestRateRisk === 'low' ? 'bg-green-100 text-green-700' :
                  s.risks.interestRateRisk === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{s.risks.interestRateRisk}</span>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation */}
      <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <div className="text-sm font-semibold text-blue-900 mb-1">Recommendation</div>
        <div className="text-sm text-blue-800">{scenarioComparison.recommendation}</div>
        <div className="mt-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-xs text-blue-600">IRR Spread</div>
            <div className="text-lg font-bold text-blue-900">{fmtPct(scenarioComparison.delta.irr)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-blue-600">Multiple Spread</div>
            <div className="text-lg font-bold text-blue-900">{scenarioComparison.delta.equityMultiple.toFixed(2)}x</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-blue-600">DSCR Spread</div>
            <div className="text-lg font-bold text-blue-900">{scenarioComparison.delta.dscr.toFixed(2)}x</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScenarioRow = (label: string, getter: (s: CapitalScenario) => React.ReactNode, bestKey?: string) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{label}</td>
      {scenarioComparison.scenarios.map((s) => (
        <td key={s.id} className={`px-4 py-3 text-sm text-center ${
          s.isActive ? 'bg-blue-50 font-semibold' : ''
        } ${bestKey && s.id === (scenarioComparison as any)[bestKey] ? 'text-green-600 font-bold' : 'text-gray-700'}`}>
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Financing Timeline</h4>

        {/* Horizontal timeline */}
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300" />
          <div className="space-y-6 pl-12">
            {debtTimeline.events.map((event) => (
              <div key={event.id} className="relative">
                <div className={`absolute -left-[2.15rem] w-4 h-4 rounded-full border-2 ${
                  event.isKeyEvent
                    ? 'bg-blue-500 border-blue-600'
                    : event.isPast
                    ? 'bg-gray-400 border-gray-500'
                    : 'bg-white border-gray-300'
                }`} />
                <div className={`p-4 rounded-lg border ${event.isKeyEvent ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{event.date}</div>
                      <div className="text-sm text-gray-600 mt-1">{event.description}</div>
                    </div>
                    {event.amount && (
                      <span className="text-sm font-semibold text-gray-900">{fmtM(event.amount)}</span>
                    )}
                  </div>
                  <span className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    event.type === 'origination' ? 'bg-blue-100 text-blue-700' :
                    event.type === 'draw' ? 'bg-green-100 text-green-700' :
                    event.type === 'refinance' ? 'bg-purple-100 text-purple-700' :
                    event.type === 'maturity' ? 'bg-red-100 text-red-700' :
                    event.type === 'milestone' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase">Interest Reserve</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{fmtM(debtTimeline.interestReserve)}</div>
          <div className="text-xs text-gray-500 mt-1">Budgeted for carry period</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase">Key Events</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{debtTimeline.events.filter((e) => e.isKeyEvent).length}</div>
          <div className="text-xs text-gray-500 mt-1">Major financing milestones</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 uppercase">Total Draws Planned</div>
          <div className="text-xl font-bold text-gray-900 mt-1">
            {fmtM(debtTimeline.events.filter((e) => e.type === 'draw').reduce((s, e) => s + (e.amount || 0), 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across {debtTimeline.events.filter((e) => e.type === 'draw').length} draws</div>
        </div>
      </div>
    </div>
  );

  // ========================================================================
  // Tab 7: Cross-Module Integration
  // ========================================================================

  const renderIntegration = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Cross-Module Data Flow</h4>
        <div className="space-y-4">
          {[
            { from: 'M08 Strategy', to: 'M11 Capital Structure', direction: 'incoming', description: 'Strategy selection loads capital template', event: 'strategy.selected', status: 'active' },
            { from: 'M11 Capital Structure', to: 'M09 ProForma', direction: 'outgoing', description: 'Debt service feeds NOI calculation', event: 'capital.stack.updated', status: 'active' },
            { from: 'M09 ProForma', to: 'M11 Capital Structure', direction: 'incoming', description: 'NOI updates recalculate DSCR constraints', event: 'proforma.noi.updated', status: 'active' },
            { from: 'M11 Capital Structure', to: 'M14 Risk', direction: 'outgoing', description: 'Financial risk subscore from capital structure', event: 'capital.structure.risk', status: 'planned' },
            { from: 'M11 Capital Structure', to: 'M01 Overview', direction: 'outgoing', description: 'Return metrics for deal summary', event: 'capital.returns.updated', status: 'planned' },
            { from: 'M11 Capital Structure', to: 'M12 Exit', direction: 'outgoing', description: 'Debt payoff and refi proceeds for exit analysis', event: 'capital.stack.updated', status: 'planned' },
          ].map((flow, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${flow.status === 'active' ? 'bg-green-500' : 'bg-yellow-400'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{flow.from}</span>
                  <span className="text-gray-400">{flow.direction === 'incoming' ? '→' : '←'}</span>
                  <span className="text-sm font-semibold text-gray-900">{flow.to}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{flow.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-200 px-2 py-0.5 rounded">{flow.event}</code>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  flow.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {flow.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
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
          insight.severity === 'success' ? 'border-green-200 bg-green-50' :
          insight.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
          insight.severity === 'danger' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{insight.metric}: {insight.value}</div>
              <div className="text-sm text-gray-700 mt-1">{insight.insight}</div>
            </div>
            {insight.action && (
              <button className="text-xs text-blue-600 font-semibold hover:text-blue-700 whitespace-nowrap ml-4">
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
    <div className="space-y-6">
      {/* Strategy Selector */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {renderStrategySelector()}
        <div className="text-xs text-gray-500">
          Template: <span className="font-semibold text-gray-700">{template.label}</span> — {template.holdPeriod}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'stack' && renderCapitalStack()}
      {activeTab === 'debt' && renderDebtSelector()}
      {activeTab === 'rates' && renderRateEnvironment()}
      {activeTab === 'waterfall' && renderEquityWaterfall()}
      {activeTab === 'scenarios' && renderScenarios()}
      {activeTab === 'timeline' && renderTimeline()}
      {activeTab === 'integration' && renderIntegration()}
    </div>
  );
};

export default CapitalStructureSection;
