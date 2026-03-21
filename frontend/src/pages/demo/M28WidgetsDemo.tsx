/**
 * M28 Widgets Demo Page
 * Showcase all 12 M28 Cycle Intelligence widgets with live data
 */

import React from 'react';
import {
  CyclePhaseBadge,
  DivergenceChip,
  RateEnvironmentStrip,
  MiniCycleRing,
  TimingVerdict,
  PatternMatchCard,
  PhaseStrategyBadge,
  MacroRiskGauge,
  CycleCompass,
  ValueForecastBand,
  ExitWindowGauge,
  PredictedJEDIScore,
} from '../../components/m28/widgets';

export const M28WidgetsDemo: React.FC = () => {
  // Demo data
  const testMarketId = 'tampa-msa';
  const testMarketIds = ['tampa-msa', 'atlanta-msa', 'orlando-msa', 'miami-msa'];
  const testDealValue = 50000000; // $50M
  const testCurrentJEDI = 75;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          M28 Cycle Intelligence Widgets
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Complete widget library showcase with live data
        </p>
      </div>

      {/* Rate environment strip (full width) */}
      <RateEnvironmentStrip />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Section 1: Inline Badges */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. Inline Badges
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-wrap items-center gap-4">
              <CyclePhaseBadge marketId={testMarketId} />
              <DivergenceChip marketId={testMarketId} />
              <PhaseStrategyBadge marketId={testMarketId} />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Use these inline badges in deal cards, market lists, and dashboards
            </div>
          </div>
        </section>

        {/* Section 2: Visual Indicators */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            2. Visual Indicators
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Mini Cycle Ring
              </h3>
              <MiniCycleRing marketId={testMarketId} size={100} showLabel />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Macro Risk Gauge
              </h3>
              <MacroRiskGauge />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Exit Window Gauge
              </h3>
              <ExitWindowGauge marketId={testMarketId} size={180} />
            </div>
          </div>
        </section>

        {/* Section 3: Analysis Cards */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            3. Analysis Cards
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimingVerdict marketId={testMarketId} />
            <PatternMatchCard limit={3} />
          </div>
        </section>

        {/* Section 4: Forecast Widgets */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            4. Forecast Widgets
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ValueForecastBand
              marketId={testMarketId}
              currentValue={testDealValue}
              showLegend
            />
            <PredictedJEDIScore
              marketId={testMarketId}
              currentJEDI={testCurrentJEDI}
            />
          </div>
        </section>

        {/* Section 5: Dashboard Widget */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            5. Multi-Market Dashboard
          </h2>
          <CycleCompass marketIds={testMarketIds} size={400} />
        </section>

        {/* Section 6: Compact Variations */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            6. Compact Variations
          </h2>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-32">
                  Small badges:
                </span>
                <CyclePhaseBadge marketId={testMarketId} size="sm" />
                <DivergenceChip marketId={testMarketId} size="sm" />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-32">
                  Compact forecast:
                </span>
                <ValueForecastBand
                  marketId={testMarketId}
                  currentValue={testDealValue}
                  compact
                  showLegend={false}
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-32">
                  Small ring:
                </span>
                <MiniCycleRing marketId={testMarketId} size={60} />
              </div>
            </div>
          </div>
        </section>

        {/* Usage Guide */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-3">
            📚 Usage Guide
          </h2>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Import widgets:</strong>
              <code className="ml-2 px-2 py-0.5 bg-blue-100 rounded text-xs">
                import {'{ CyclePhaseBadge, ... }'} from '@/components/m28/widgets'
              </code>
            </p>
            <p>
              <strong>All widgets are:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Self-contained (fetch their own data)</li>
              <li>Error-tolerant (graceful fallbacks)</li>
              <li>Responsive (mobile-friendly)</li>
              <li>Accessible (keyboard + screen reader support)</li>
            </ul>
            <p className="pt-2">
              <strong>Next:</strong> Integrate into M09 ProForma, M11 Capital
              Structure, M05 Market Intelligence, and Dashboard
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default M28WidgetsDemo;
