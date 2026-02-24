import React, { useState } from 'react';
import { useDevelopmentCapacity } from '../../../hooks/useDevelopmentCapacity';
import type { CapacityScenario, StrategyArbitrageImpact } from '../../../types/zoning.types';
import SourceCitation, { ViewSourceBadge } from '../SourceCitation';
import type { SourceCitationData } from '../SourceCitation';

interface MatrixSection {
  label: string;
  rows: { key: keyof CapacityScenario; label: string; format?: (v: any) => string }[];
}

const CAPACITY_CITATIONS: Record<string, SourceCitationData> = {
  density: { section: '§16-18A.007', url: '#', sourceType: 'code' as const, lastVerified: '2025-11-14' },
  height: { section: '§16-18A.009', url: '#', sourceType: 'code' as const, lastVerified: '2025-11-14' },
  far: { section: '§16-18A.010', url: '#', sourceType: 'code' as const, lastVerified: '2025-11-14' },
  parking: { section: '§16-18A.015', url: '#', sourceType: 'code' as const, lastVerified: '2025-11-14' },
  openSpace: { section: '§16-18A.012', url: '#', sourceType: 'code' as const, lastVerified: '2025-11-14' },
};

const MATRIX_SECTIONS: MatrixSection[] = [
  {
    label: 'Development Parameters',
    rows: [
      { key: 'maxUnits', label: 'Max Units', format: (v) => v?.toLocaleString() ?? '—' },
      { key: 'maxHeight', label: 'Max Height', format: (v) => v != null ? `${v} ft` : '—' },
      { key: 'maxFar', label: 'Max FAR', format: (v) => v != null ? v.toFixed(2) : '—' },
      { key: 'maxGfa', label: 'Max GFA', format: (v) => v != null ? `${v.toLocaleString()} SF` : '—' },
      { key: 'parkingRequired', label: 'Parking Req' },
      { key: 'openSpace', label: 'Open Space', format: (v) => v != null ? `${v.toLocaleString()} SF` : '—' },
    ],
  },
  {
    label: 'Entitlement Risk',
    rows: [
      { key: 'timeline', label: 'Timeline' },
      { key: 'cost', label: 'Cost' },
      { key: 'riskLevel', label: 'Risk', format: (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : '—' },
      { key: 'successPercent', label: 'Success %', format: (v) => v != null ? `${v}%` : '—' },
    ],
  },
  {
    label: 'Value Impact',
    rows: [
      { key: 'estimatedValue', label: 'Est. Value', format: (v) => v != null ? `$${v.toLocaleString()}` : '—' },
      { key: 'deltaVsByRight', label: 'Delta vs By-Right', format: (v) => v != null ? `${v >= 0 ? '+' : ''}$${v.toLocaleString()}` : 'baseline' },
    ],
  },
];

function getRiskColor(risk: string): string {
  switch (risk) {
    case 'low': return 'text-green-600';
    case 'medium': return 'text-yellow-600';
    case 'high': return 'text-red-600';
    default: return 'text-gray-500';
  }
}

function getScenarioByType(scenarios: CapacityScenario[], type: string): CapacityScenario | undefined {
  return scenarios.find((s) => s.scenarioType === type);
}

interface DevelopmentCapacityTabProps {
  dealId?: string;
  deal?: any;
}

export default function DevelopmentCapacityTab({ dealId, deal }: DevelopmentCapacityTabProps = {}) {
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

  const scenarioHeaders = [
    { label: 'CURRENT ZONING', sub: byRight ? `(${byRight.scenarioType === 'by_right' ? 'by-right' : byRight.scenarioType})` : '(by-right)' },
    { label: 'VARIANCE PATH', sub: variance ? `(${variance.scenarioType})` : '(variance)' },
    { label: 'REZONE PATH', sub: rezone ? `(→ rezone)` : '(rezone)' },
  ];

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-4">
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
          {data.parcelInfo && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Parcel:</span>
                <span className="text-gray-900 font-semibold">{data.parcelInfo.address || address}</span>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Lot:</span>
                <span className="text-gray-900">{data.parcelInfo.lotSize || '—'}</span>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Current:</span>
                <span className="text-gray-900 font-semibold">{data.parcelInfo.currentZoning || '—'}</span>
              </div>
            </div>
          )}

          {!data.parcelInfo && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-3 flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Parcel:</span>
                <span className="text-gray-900 font-semibold">{address}</span>
              </div>
              <div className="w-px h-5 bg-gray-200" />
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium">Scenarios:</span>
                <span className="text-gray-900">{data.scenarios.length} analyzed</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Capacity Comparison Matrix</h3>
              <p className="text-xs text-gray-500 mt-0.5">Side-by-side analysis of development potential across entitlement paths</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left px-5 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider w-[22%]"></th>
                    {scenarioHeaders.map((h, i) => (
                      <th key={i} className="text-center px-4 py-3 w-[26%]">
                        <div className="text-xs font-bold text-gray-900 uppercase tracking-wide">{h.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{h.sub}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATRIX_SECTIONS.map((section, sIdx) => (
                    <React.Fragment key={section.label}>
                      <tr>
                        <td colSpan={4} className="px-5 pt-4 pb-1">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
                            {section.label}
                          </div>
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr key={row.key} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 text-gray-600 font-medium text-xs">
                            {row.label}
                            {row.key === 'maxUnits' && <span className="ml-1"><SourceCitation {...CAPACITY_CITATIONS.density} /></span>}
                            {row.key === 'maxHeight' && <span className="ml-1"><SourceCitation {...CAPACITY_CITATIONS.height} /></span>}
                            {row.key === 'maxFar' && <span className="ml-1"><SourceCitation {...CAPACITY_CITATIONS.far} /></span>}
                            {row.key === 'parkingRequired' && <span className="ml-1"><SourceCitation {...CAPACITY_CITATIONS.parking} /></span>}
                            {row.key === 'openSpace' && <span className="ml-1"><SourceCitation {...CAPACITY_CITATIONS.openSpace} /></span>}
                          </td>
                          {scenarios.map((scenario, i) => {
                            const value = scenario ? scenario[row.key] : null;
                            const formatted = row.format ? row.format(value) : (value ?? '—');
                            let cellClass = 'text-gray-900';

                            if (row.key === 'riskLevel' && scenario) {
                              cellClass = getRiskColor(scenario.riskLevel);
                            }
                            if (row.key === 'deltaVsByRight' && scenario) {
                              cellClass = scenario.deltaVsByRight > 0 ? 'text-green-600 font-semibold' : scenario.deltaVsByRight < 0 ? 'text-red-600' : 'text-gray-500';
                            }
                            if (row.key === 'successPercent' && scenario) {
                              cellClass = scenario.successPercent >= 80 ? 'text-green-600 font-medium' : scenario.successPercent >= 50 ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium';
                            }

                            return (
                              <td key={i} className={`text-center px-4 py-2.5 text-xs ${cellClass}`}>
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {sIdx < MATRIX_SECTIONS.length - 1 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-0">
                            <div className="border-b border-gray-100" />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.aiRecommendation && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">AI Recommendation</h3>
              </div>
              <div className="p-5">
                <blockquote className="text-sm text-gray-700 leading-relaxed italic border-l-3 border-blue-400 pl-4 mb-4">
                  "{data.aiRecommendation.reasoning}"
                </blockquote>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {data.aiRecommendation.confidence != null && (
                      <span>Confidence: <strong className="text-gray-700">{data.aiRecommendation.confidence}%</strong></span>
                    )}
                    <span className="w-px h-4 bg-gray-200" />
                    <span>Based on: <strong className="text-gray-700">{data.aiRecommendation.evidenceCount} comparable rezones</strong></span>
                  </div>
                  <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                    Recommended: {data.aiRecommendation.recommendedPath}
                  </span>
                </div>
              </div>
            </div>
          )}

          {data.strategyImpacts && data.strategyImpacts.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Strategy Arbitrage Impact</h3>
                <p className="text-xs text-gray-500 mt-0.5">How does zoning capacity affect each strategy?</p>
              </div>
              <div className="p-5 space-y-4">
                {data.strategyImpacts.map((impact) => (
                  <StrategyImpactRow key={impact.strategy} impact={impact} />
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                  <span>📊</span> Full Strategy Arbitrage Report
                </button>
                <button className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                  <span>📎</span> Attach to Deal Capsule
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StrategyImpactRow({ impact }: { impact: StrategyArbitrageImpact }) {
  const strategyNames: Record<string, string> = {
    BTS: 'BUILD-TO-SELL',
    Rental: 'RENTAL (Hold)',
    Flip: 'FLIP',
    STR: 'STR',
  };

  if (!impact.applicable) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-500 py-2 px-1">
        <span className="font-bold text-xs text-gray-700 uppercase w-32">{strategyNames[impact.strategy] || impact.strategy}</span>
        <span className="text-xs italic text-gray-400">{impact.reason || 'Not applicable'}</span>
      </div>
    );
  }

  const bestScenario = impact.scenarios.reduce<{ label: string; irr: number | null; capRate: number | null; units: number } | null>((best, s) => {
    if (s.irr == null) return best;
    if (!best || (best.irr != null && s.irr > best.irr)) return s;
    return best;
  }, null);

  return (
    <div>
      <div className="font-bold text-xs text-gray-900 uppercase tracking-wide mb-2">
        {strategyNames[impact.strategy] || impact.strategy}
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {impact.scenarios.map((scenario) => {
            const isBest = bestScenario && scenario.label === bestScenario.label;
            return (
              <div key={scenario.label} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">{scenario.label} ({scenario.units}u):</span>
                {scenario.irr != null && (
                  <span className={`font-semibold ${scenario.irr >= 15 ? 'text-green-600' : scenario.irr >= 10 ? 'text-yellow-600' : 'text-gray-700'}`}>
                    IRR {scenario.irr.toFixed(1)}%
                  </span>
                )}
                {scenario.capRate != null && (
                  <span className="text-gray-600">
                    Cap {scenario.capRate.toFixed(1)}%
                  </span>
                )}
                {isBest && <span className="text-sm" title="Best scenario">🏆</span>}
              </div>
            );
          })}
        </div>
        {impact.bestPath && (
          <div className="mt-2 text-[10px] text-blue-600 font-medium">
            🏆 Best: {impact.bestPath}
          </div>
        )}
      </div>
    </div>
  );
}
