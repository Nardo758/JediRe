import React, { useEffect, useState } from 'react';
import { propertyMetricsService, NeighborhoodBenchmark, SubmarketComparison } from '@/services/propertyMetrics.service';

interface ZoningEntitlementsSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const ZoningEntitlementsSection: React.FC<ZoningEntitlementsSectionProps> = ({ deal, dealId }) => {
  const [benchmarks, setBenchmarks] = useState<NeighborhoodBenchmark[]>([]);
  const [submarkets, setSubmarkets] = useState<SubmarketComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [benchmarkData, submarketData] = await Promise.all([
          propertyMetricsService.getNeighborhoodBenchmarks(),
          propertyMetricsService.getSubmarketComparison(),
        ]);
        setBenchmarks(benchmarkData);
        setSubmarkets(submarketData);
      } catch (err: any) {
        setError(err?.message || 'Failed to load density intelligence data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
        <span className="ml-3 text-gray-500 text-sm">Loading density intelligence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Error Loading Data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  const validBenchmarks = benchmarks.filter((b) => b.avgDensity !== null);
  const highestDensity = validBenchmarks.length
    ? validBenchmarks.reduce((a, b) => ((a.avgDensity ?? 0) > (b.avgDensity ?? 0) ? a : b))
    : null;
  const lowestDensity = validBenchmarks.length
    ? validBenchmarks.reduce((a, b) => ((a.avgDensity ?? 0) < (b.avgDensity ?? 0) ? a : b))
    : null;
  const totalProperties = submarkets.reduce((s, m) => s + m.properties, 0);
  const totalUnits = submarkets.reduce((s, m) => s + m.totalUnits, 0);

  const sorted = [...submarkets].sort((a, b) => b.avgDensity - a.avgDensity);

  const densityColor = (d: number) => {
    if (d > 30) return 'text-green-700 bg-green-100';
    if (d >= 15) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  const highTier = submarkets.filter((s) => s.avgDensity > 30);
  const medTier = submarkets.filter((s) => s.avgDensity >= 15 && s.avgDensity <= 30);
  const lowTier = submarkets.filter((s) => s.avgDensity < 15);
  const highUnits = highTier.reduce((s, m) => s + m.totalUnits, 0);
  const medUnits = medTier.reduce((s, m) => s + m.totalUnits, 0);
  const lowUnits = lowTier.reduce((s, m) => s + m.totalUnits, 0);
  const maxTierUnits = Math.max(highUnits, medUnits, lowUnits, 1);

  const highPotential = submarkets.filter((s) => s.avgDensity > 25);
  const highPotentialUnits = highPotential.reduce((s, m) => s + m.totalUnits, 0);

  const fmt = (v: number | null) => (v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🏛️</span>
        <h2 className="text-xl font-bold text-gray-900">Density Intelligence Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Highest Density</p>
          <p className="text-lg font-bold text-green-700 mt-1">{highestDensity?.neighborhoodCode ?? '—'}</p>
          <p className="text-sm text-gray-600">{highestDensity ? `${(highestDensity.avgDensity ?? 0).toFixed(1)} units/acre` : '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Lowest Density</p>
          <p className="text-lg font-bold text-red-700 mt-1">{lowestDensity?.neighborhoodCode ?? '—'}</p>
          <p className="text-sm text-gray-600">{lowestDensity ? `${(lowestDensity.avgDensity ?? 0).toFixed(1)} units/acre` : '—'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Properties</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{totalProperties.toLocaleString()}</p>
          <p className="text-sm text-gray-600">Analyzed</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Units</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{totalUnits.toLocaleString()}</p>
          <p className="text-sm text-gray-600">Tracked</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Density Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Neighborhood</th>
                <th className="px-4 py-2 text-right">Properties</th>
                <th className="px-4 py-2 text-right">Total Units</th>
                <th className="px-4 py-2 text-right">Avg $/Unit</th>
                <th className="px-4 py-2 text-right">Density</th>
                <th className="px-4 py-2 text-right">Land %</th>
                <th className="px-4 py-2 text-right">Avg SF/Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((s) => (
                <tr key={s.neighborhoodCode} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{s.neighborhoodCode}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.properties}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.totalUnits.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{fmt(s.avgValuePerUnit)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${densityColor(s.avgDensity)}`}>
                      {s.avgDensity.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.avgLandPct != null ? `${s.avgLandPct.toFixed(1)}%` : '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{s.avgSfPerUnit != null ? s.avgSfPerUnit.toLocaleString() : '—'}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">No submarket data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Density Distribution</h3>
        <div className="space-y-3">
          {[
            { label: 'High (>30 units/acre)', count: highTier.length, units: highUnits, color: 'bg-green-500' },
            { label: 'Medium (15–30 units/acre)', count: medTier.length, units: medUnits, color: 'bg-yellow-500' },
            { label: 'Low (<15 units/acre)', count: lowTier.length, units: lowUnits, color: 'bg-red-500' },
          ].map((tier) => (
            <div key={tier.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-700 font-medium">{tier.label}</span>
                <span className="text-gray-500">{tier.count} neighborhoods · {tier.units.toLocaleString()} units</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className={`${tier.color} h-3 rounded-full transition-all`}
                  style={{ width: `${(tier.units / maxTierUnits) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Land Utilization Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Neighborhood</th>
                <th className="px-4 py-2 text-right">Land Value Ratio</th>
                <th className="px-4 py-2 text-right">Avg SF/Unit</th>
                <th className="px-4 py-2 text-right">Median $/Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benchmarks.map((b) => {
                const highlight = (b.avgLandValueRatio ?? 0) > 30;
                return (
                  <tr key={b.neighborhoodCode} className={highlight ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {b.neighborhoodCode}
                      {highlight && <span className="ml-2 text-xs text-amber-600 font-normal">⚠ underutilized</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {b.avgLandValueRatio != null ? `${b.avgLandValueRatio.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {b.avgBuildingSfPerUnit != null ? b.avgBuildingSfPerUnit.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">{fmt(b.medianPerUnit)}</td>
                  </tr>
                );
              })}
              {benchmarks.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No benchmark data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
        <h3 className="font-semibold text-purple-900 mb-2">🎯 Zoning Intelligence Insight</h3>
        {highPotential.length > 0 ? (
          <>
            <p className="text-sm text-purple-800">
              <strong>{highPotential.length}</strong> neighborhood{highPotential.length !== 1 ? 's' : ''} ha{highPotential.length !== 1 ? 've' : 's'} density above 25 units/acre, representing{' '}
              <strong>{highPotentialUnits.toLocaleString()}</strong> total units.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {highPotential.map((n) => (
                <span key={n.neighborhoodCode} className="inline-block bg-purple-200 text-purple-800 text-xs font-medium px-2.5 py-1 rounded">
                  {n.neighborhoodCode} ({n.avgDensity.toFixed(1)})
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-purple-700">No neighborhoods currently exceed 25 units/acre density threshold.</p>
        )}
      </div>
    </div>
  );
};

export default ZoningEntitlementsSection;
