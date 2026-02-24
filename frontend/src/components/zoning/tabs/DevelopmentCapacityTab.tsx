import React, { useState } from 'react';
import { useDevelopmentCapacity } from '../../../hooks/useDevelopmentCapacity';
import type { CapacityScenario, StrategyArbitrageImpact } from '../../../types/zoning.types';

const MATRIX_ROWS: { key: keyof CapacityScenario; label: string; format?: (v: any) => string }[] = [
  { key: 'maxUnits', label: 'Max Units', format: (v) => v?.toLocaleString() ?? '—' },
  { key: 'maxHeight', label: 'Max Height (ft)', format: (v) => v != null ? `${v}'` : '—' },
  { key: 'maxFar', label: 'FAR', format: (v) => v != null ? v.toFixed(2) : '—' },
  { key: 'maxGfa', label: 'Gross Floor Area (sf)', format: (v) => v != null ? v.toLocaleString() : '—' },
  { key: 'parkingRequired', label: 'Parking Required' },
  { key: 'openSpace', label: 'Open Space (%)', format: (v) => v != null ? `${v}%` : '—' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'cost', label: 'Estimated Cost' },
  { key: 'riskLevel', label: 'Risk Level', format: (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '—' },
  { key: 'successPercent', label: 'Success %', format: (v) => v != null ? `${v}%` : '—' },
  { key: 'estimatedValue', label: 'Estimated Value', format: (v) => v != null ? `$${v.toLocaleString()}` : '—' },
  { key: 'deltaVsByRight', label: 'Delta vs By-Right', format: (v) => v != null ? `${v >= 0 ? '+' : ''}$${v.toLocaleString()}` : '—' },
];

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low': return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'high': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getScenarioByType(scenarios: CapacityScenario[], type: string): CapacityScenario | undefined {
  return scenarios.find((s) => s.scenarioType === type);
}

export default function DevelopmentCapacityTab() {
  const { data, loading, error, analyzeByAddress, clear } = useDevelopmentCapacity();
  const [address, setAddress] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    analyzeByAddress(address);
  };

  const byRight = data ? getScenarioByType(data.scenarios, 'by_right') : undefined;
  const variance = data ? getScenarioByType(data.scenarios, 'variance') : undefined;
  const rezone = data ? getScenarioByType(data.scenarios, 'rezone') : undefined;
  const scenarios = [byRight, variance, rezone];
  const scenarioLabels = ['Current Zoning (By-Right)', 'Variance Path', 'Rezone Path'];

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex items-center gap-3 bg-white rounded-lg p-4">
        <div className="flex-1">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter parcel address or select from deal..."
            className="w-full bg-gray-50 text-gray-900 rounded-md px-4 py-2.5 text-sm border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
        >
          {loading ? 'Analyzing...' : 'Analyze Capacity'}
        </button>
        {data && (
          <button
            type="button"
            onClick={() => { clear(); setAddress(''); }}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-600 text-sm">Analyzing development capacity...</span>
        </div>
      )}

      {!loading && !data && !error && (
        <div className="text-center py-16 text-gray-600">
          <svg className="mx-auto h-12 w-12 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm">Enter a parcel address to analyze development capacity across zoning scenarios</p>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Capacity Comparison Matrix</h3>
              <p className="text-xs text-gray-600 mt-1">Side-by-side analysis of development potential across entitlement paths</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-gray-700 font-medium w-1/4">Metric</th>
                    {scenarioLabels.map((label, i) => (
                      <th key={i} className="text-center px-4 py-3 text-gray-700 font-medium w-1/4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700 font-medium">{row.label}</td>
                      {scenarios.map((scenario, i) => {
                        const value = scenario ? scenario[row.key] : null;
                        const formatted = row.format ? row.format(value) : (value ?? '—');
                        let cellClass = 'text-gray-900';

                        if (row.key === 'riskLevel' && scenario) {
                          cellClass = getRiskColor(scenario.riskLevel);
                        }
                        if (row.key === 'deltaVsByRight' && scenario) {
                          cellClass = scenario.deltaVsByRight > 0 ? 'text-green-600' : scenario.deltaVsByRight < 0 ? 'text-red-600' : 'text-gray-600';
                        }
                        if (row.key === 'successPercent' && scenario) {
                          cellClass = scenario.successPercent >= 80 ? 'text-green-600' : scenario.successPercent >= 50 ? 'text-yellow-600' : 'text-red-600';
                        }

                        return (
                          <td key={i} className={`text-center px-4 py-3 ${cellClass}`}>
                            {formatted}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.aiRecommendation && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900">AI Recommendation</h3>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">
                      {data.aiRecommendation.evidenceCount} evidence points
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">
                    {data.aiRecommendation.reasoning}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Recommended Path:</span>
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                      {data.aiRecommendation.recommendedPath}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.strategyImpacts && data.strategyImpacts.length > 0 && (
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Strategy Arbitrage Impact</h3>
                <p className="text-xs text-gray-600 mt-1">IRR and cap rate projections for each investment strategy across entitlement scenarios</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.strategyImpacts.map((impact) => (
                  <StrategyImpactCard key={impact.strategy} impact={impact} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StrategyImpactCard({ impact }: { impact: StrategyArbitrageImpact }) {
  const strategyIcons: Record<string, string> = {
    BTS: '🏗️',
    Rental: '🏢',
    Flip: '🔄',
    STR: '🏠',
  };

  return (
    <div className={`bg-white rounded-lg border ${impact.applicable ? 'border-gray-200' : 'border-gray-200 opacity-60'} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{strategyIcons[impact.strategy] || '📊'}</span>
          <h4 className="font-semibold text-gray-900 text-sm">{impact.strategy}</h4>
        </div>
        {!impact.applicable && (
          <span className="text-[10px] text-red-700 bg-red-50 px-2 py-0.5 rounded">N/A</span>
        )}
      </div>

      {impact.applicable && impact.bestPath && (
        <div className="mb-3">
          <span className="text-[10px] text-gray-600">Best Path</span>
          <p className="text-xs font-medium text-blue-700">{impact.bestPath}</p>
        </div>
      )}

      {!impact.applicable && (
        <p className="text-xs text-gray-600 mb-3">{impact.reason}</p>
      )}

      {impact.applicable && impact.scenarios.length > 0 && (
        <div className="space-y-2">
          {impact.scenarios.map((scenario) => (
            <div key={scenario.label} className="bg-gray-50 rounded px-3 py-2">
              <div className="text-[10px] text-gray-600 mb-1">{scenario.label}</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-600">IRR </span>
                  <span className={`text-xs font-medium ${scenario.irr != null && scenario.irr >= 15 ? 'text-green-600' : scenario.irr != null && scenario.irr >= 10 ? 'text-yellow-600' : 'text-gray-700'}`}>
                    {scenario.irr != null ? `${scenario.irr.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-600">Cap </span>
                  <span className="text-xs font-medium text-gray-700">
                    {scenario.capRate != null ? `${scenario.capRate.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-600">Units </span>
                  <span className="text-xs font-medium text-gray-700">
                    {scenario.units}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
