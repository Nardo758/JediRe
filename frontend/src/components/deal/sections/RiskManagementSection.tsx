import React, { useEffect, useState } from 'react';
import { propertyMetricsService } from '@/services/propertyMetrics.service';
import type { RentComp, MarketSummary, OwnerPortfolio, NeighborhoodBenchmark } from '@/services/propertyMetrics.service';

interface RiskManagementSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const RiskManagementSection: React.FC<RiskManagementSectionProps> = ({ deal, dealId }) => {
  const [rentComps, setRentComps] = useState<RentComp[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [topOwners, setTopOwners] = useState<OwnerPortfolio[]>([]);
  const [benchmarks, setBenchmarks] = useState<NeighborhoodBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [comps, summary, owners, neighborhoods] = await Promise.all([
          propertyMetricsService.getRentComps(),
          propertyMetricsService.getMarketSummary(),
          propertyMetricsService.getTopOwners(10),
          propertyMetricsService.getNeighborhoodBenchmarks(),
        ]);
        setRentComps(comps);
        setMarketSummary(summary);
        setTopOwners(owners);
        setBenchmarks(neighborhoods);
      } catch (err: any) {
        setError(err?.message || 'Failed to load market risk data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading market risk data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700 font-medium">Error loading risk data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  const newSupplyComps = rentComps.filter(c => c.yearBuilt !== null && c.yearBuilt >= 2020);
  const newSupplyUnits = newSupplyComps.reduce((s, c) => s + (c.units || 0), 0);

  const occupancies = rentComps.map(c => c.occupancyPct).filter((v): v is number => v !== null);
  const occMin = occupancies.length ? Math.min(...occupancies) : 0;
  const occMax = occupancies.length ? Math.max(...occupancies) : 0;
  const occSpread = occMax - occMin;

  const avgConcession = marketSummary?.avgConcession ?? 0;

  const allOwnerUnits = topOwners.reduce((s, o) => s + o.totalUnits, 0);
  const top5Units = topOwners.slice(0, 5).reduce((s, o) => s + o.totalUnits, 0);
  const top5Pct = allOwnerUnits > 0 ? (top5Units / allOwnerUnits) * 100 : 0;

  const riskColor = (value: number, thresholds: [number, number]) => {
    if (value < thresholds[0]) return 'bg-green-100 text-green-800 border-green-300';
    if (value <= thresholds[1]) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const occColor = (pct: number | null) => {
    if (pct === null) return 'text-gray-400';
    if (pct >= 95) return 'text-green-700 bg-green-50';
    if (pct >= 90) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  const sortedComps = [...rentComps].sort((a, b) => (a.occupancyPct ?? 999) - (b.occupancyPct ?? 999));

  const pipelineComps = rentComps
    .filter(c => c.yearBuilt !== null && c.yearBuilt >= 2018)
    .sort((a, b) => (b.yearBuilt ?? 0) - (a.yearBuilt ?? 0));
  const pipelineUnits = pipelineComps.reduce((s, c) => s + (c.units || 0), 0);
  const totalCompUnits = rentComps.reduce((s, c) => s + (c.units || 0), 0);
  const pipelinePct = totalCompUnits > 0 ? (pipelineUnits / totalCompUnits) * 100 : 0;

  const maxOwnerUnits = topOwners.length ? Math.max(...topOwners.map(o => o.totalUnits)) : 1;

  const benchmarkRiskScores = benchmarks.map(b => {
    const densityScore = b.avgDensity !== null ? Math.min(b.avgDensity / 50, 1) : 0.5;
    const valueScore = b.avgPerUnit !== null && b.avgPerUnit > 0 ? Math.max(1 - b.avgPerUnit / 200000, 0) : 0.5;
    const risk = (densityScore * 0.5 + valueScore * 0.5) * 100;
    return { ...b, riskScore: risk };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const benchRiskColor = (score: number) => {
    if (score >= 60) return 'bg-red-50 border-l-4 border-l-red-400';
    if (score >= 40) return 'bg-amber-50 border-l-4 border-l-amber-400';
    return 'bg-green-50 border-l-4 border-l-green-400';
  };

  const fmt = (v: number | null, decimals = 1) => v !== null ? v.toFixed(decimals) : '—';
  const fmtDollar = (v: number | null) => v !== null ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">🛡️</span>
        <h2 className="text-xl font-bold text-gray-900">Market Risk Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Supply Risk</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{newSupplyComps.length} <span className="text-base font-normal">properties</span></p>
          <p className="text-sm text-blue-700 mt-1">New Construction (2020+): {newSupplyUnits.toLocaleString()} units</p>
        </div>

        <div className={`rounded-lg border p-4 ${riskColor(occSpread, [10, 15])}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Occupancy Risk</p>
          <p className="text-2xl font-bold mt-1">{fmt(occMin, 1)}% – {fmt(occMax, 1)}%</p>
          <p className="text-sm mt-1">Spread: {fmt(occSpread, 1)} pts</p>
        </div>

        <div className={`rounded-lg border p-4 ${riskColor(avgConcession, [2, 5])}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Concession Risk</p>
          <p className="text-2xl font-bold mt-1">{fmt(avgConcession, 2)}%</p>
          <p className="text-sm mt-1">Avg concession across comps</p>
        </div>

        <div className="rounded-lg border p-4 bg-purple-50 border-purple-200">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Owner Concentration</p>
          <p className="text-2xl font-bold text-purple-900 mt-1">{fmt(top5Pct, 1)}%</p>
          <p className="text-sm text-purple-700 mt-1">Top 5 owners share of tracked units</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Occupancy Distribution</h3>
          <p className="text-xs text-gray-500">Sorted by occupancy (worst first)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2 text-right">Units</th>
                <th className="px-4 py-2 text-right">Occupancy</th>
                <th className="px-4 py-2 text-right">Concession %</th>
                <th className="px-4 py-2 text-right">Eff Rent/SF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedComps.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{c.buildingName || c.address}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.units}</td>
                  <td className={`px-4 py-2 text-right font-medium rounded ${occColor(c.occupancyPct)}`}>
                    {c.occupancyPct !== null ? `${c.occupancyPct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.concessionPct !== null ? `${c.concessionPct.toFixed(1)}%` : '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.effectiveRentPerSf !== null ? `$${c.effectiveRentPerSf.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              {marketSummary && (
                <tr className="bg-blue-50 font-semibold">
                  <td className="px-4 py-2 text-blue-900">Market Average</td>
                  <td className="px-4 py-2 text-right text-blue-800">{marketSummary.totalUnits.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-blue-800">{fmt(marketSummary.avgOccupancy, 1)}%</td>
                  <td className="px-4 py-2 text-right text-blue-800">{fmt(marketSummary.avgConcession, 1)}%</td>
                  <td className="px-4 py-2 text-right text-blue-800">${fmt(marketSummary.avgRentPerSf, 2)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Owner Concentration Analysis</h3>
          <p className="text-xs text-gray-500">Top 10 owners by portfolio size</p>
        </div>
        <div className="p-4 space-y-3">
          {topOwners.map((o, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-40 truncate text-sm font-medium text-gray-900">{o.ownerName}</div>
              <div className="flex-1">
                <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-purple-500 rounded"
                    style={{ width: `${(o.totalUnits / maxOwnerUnits) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-800">
                    {o.totalUnits} units · {o.propertyCount} props · {fmtDollar(o.totalAssessedValue)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-purple-50 border-t border-purple-200 text-sm text-purple-800 font-medium">
          Top 5 owners control {fmt(top5Pct, 1)}% of tracked units
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Submarket Risk Heatmap</h3>
          <p className="text-xs text-gray-500">Risk score: high density + low $/unit = higher risk</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Neighborhood</th>
                <th className="px-4 py-2 text-right">Properties</th>
                <th className="px-4 py-2 text-right">Avg $/Unit</th>
                <th className="px-4 py-2 text-right">Avg Density</th>
                <th className="px-4 py-2 text-right">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benchmarkRiskScores.map((b, i) => (
                <tr key={i} className={benchRiskColor(b.riskScore)}>
                  <td className="px-4 py-2 font-medium text-gray-900">{b.neighborhoodCode}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{b.propertyCount}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmtDollar(b.avgPerUnit)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{b.avgDensity !== null ? b.avgDensity.toFixed(1) : '—'}</td>
                  <td className="px-4 py-2 text-right font-bold">{b.riskScore.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">New Supply Pipeline</h3>
          <p className="text-xs text-gray-500">Properties built since 2018</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Property</th>
                <th className="px-4 py-2 text-right">Units</th>
                <th className="px-4 py-2 text-right">Year Built</th>
                <th className="px-4 py-2 text-right">Rent/SF</th>
                <th className="px-4 py-2 text-right">Occupancy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pipelineComps.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 max-w-[200px] truncate">{c.buildingName || c.address}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.units}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.yearBuilt ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.rentPerSf !== null ? `$${c.rentPerSf.toFixed(2)}` : '—'}</td>
                  <td className={`px-4 py-2 text-right font-medium ${occColor(c.occupancyPct)}`}>
                    {c.occupancyPct !== null ? `${c.occupancyPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-200 text-sm text-blue-800 font-medium">
          {pipelineUnits.toLocaleString()} units delivered since 2018, representing {fmt(pipelinePct, 1)}% of total comp set
        </div>
      </div>
    </div>
  );
};

export default RiskManagementSection;
