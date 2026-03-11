import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Calendar, ArrowUpRight, ArrowDownRight, Minus, Building2, MapPin, Percent, Loader2 } from 'lucide-react';
import { propertyMetricsService, RentComp, MarketSummary, NeighborhoodBenchmark } from '@/services/propertyMetrics.service';

interface TrendsAnalysisSectionProps {
  deal?: any;
  onUpdate?: () => void;
  onBack?: () => void;
}

interface VintageGroup {
  decade: string;
  count: number;
  avgRentPerSf: number;
  avgOccupancy: number;
  avgUnitSize: number;
}

interface AgeBucket {
  label: string;
  count: number;
  avgOccupancy: number;
}

const currentYear = new Date().getFullYear();

function getDecadeLabel(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

function getAgeBucket(yearBuilt: number): string {
  const age = currentYear - yearBuilt;
  if (age <= 5) return '0-5 years';
  if (age <= 10) return '6-10 years';
  if (age <= 20) return '11-20 years';
  return '20+ years';
}

const AGE_BUCKET_ORDER = ['0-5 years', '6-10 years', '11-20 years', '20+ years'];

export const TrendsAnalysisSection: React.FC<TrendsAnalysisSectionProps> = ({ deal }) => {
  const [timeframe, setTimeframe] = useState<'1Y' | '3Y' | '5Y' | '10Y'>('3Y');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rentComps, setRentComps] = useState<RentComp[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [benchmarks, setBenchmarks] = useState<NeighborhoodBenchmark[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [comps, summary, neighborhoods] = await Promise.all([
          propertyMetricsService.getRentComps(),
          propertyMetricsService.getMarketSummary(),
          propertyMetricsService.getNeighborhoodBenchmarks(),
        ]);
        setRentComps(comps);
        setMarketSummary(summary);
        setBenchmarks(neighborhoods);
      } catch (err: any) {
        setError(err?.message || 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const vintageGroups = useMemo<VintageGroup[]>(() => {
    const groups: Record<string, { rents: number[]; occupancies: number[]; sizes: number[] }> = {};
    for (const comp of rentComps) {
      if (!comp.yearBuilt) continue;
      const decade = getDecadeLabel(comp.yearBuilt);
      if (!groups[decade]) groups[decade] = { rents: [], occupancies: [], sizes: [] };
      if (comp.rentPerSf != null) groups[decade].rents.push(comp.rentPerSf);
      if (comp.occupancyPct != null) groups[decade].occupancies.push(comp.occupancyPct);
      if (comp.avgSf != null) groups[decade].sizes.push(comp.avgSf);
    }
    return Object.entries(groups)
      .map(([decade, g]) => ({
        decade,
        count: g.rents.length || g.occupancies.length || g.sizes.length,
        avgRentPerSf: g.rents.length ? g.rents.reduce((a, b) => a + b, 0) / g.rents.length : 0,
        avgOccupancy: g.occupancies.length ? g.occupancies.reduce((a, b) => a + b, 0) / g.occupancies.length : 0,
        avgUnitSize: g.sizes.length ? g.sizes.reduce((a, b) => a + b, 0) / g.sizes.length : 0,
      }))
      .sort((a, b) => b.decade.localeCompare(a.decade));
  }, [rentComps]);

  const ageBuckets = useMemo<AgeBucket[]>(() => {
    const buckets: Record<string, number[]> = {};
    for (const comp of rentComps) {
      if (!comp.yearBuilt || comp.occupancyPct == null) continue;
      const bucket = getAgeBucket(comp.yearBuilt);
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(comp.occupancyPct);
    }
    return AGE_BUCKET_ORDER
      .filter(label => buckets[label])
      .map(label => ({
        label,
        count: buckets[label].length,
        avgOccupancy: buckets[label].reduce((a, b) => a + b, 0) / buckets[label].length,
      }));
  }, [rentComps]);

  const sortedBenchmarks = useMemo(() => {
    return [...benchmarks].sort((a, b) => b.totalUnits - a.totalUnits);
  }, [benchmarks]);

  const avgConcession = useMemo(() => {
    const withConcession = rentComps.filter(c => c.concessionPct != null);
    if (!withConcession.length) return 0;
    return withConcession.reduce((s, c) => s + (c.concessionPct || 0), 0) / withConcession.length;
  }, [rentComps]);

  const vintagePremium = useMemo(() => {
    const newest = vintageGroups.find(g => g.decade === '2020s');
    const older = vintageGroups.filter(g => g.decade !== '2020s' && g.avgRentPerSf > 0);
    if (!newest || !older.length) return null;
    const olderAvg = older.reduce((s, g) => s + g.avgRentPerSf, 0) / older.length;
    return newest.avgRentPerSf - olderAvg;
  }, [vintageGroups]);

  const maxRentPerSf = useMemo(() => Math.max(...vintageGroups.map(g => g.avgRentPerSf), 1), [vintageGroups]);
  const maxOccupancy = useMemo(() => Math.max(...ageBuckets.map(b => b.avgOccupancy), 1), [ageBuckets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-slate-500">Loading market trends data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Trends Analysis</h2>
          <p className="text-sm text-slate-500">Market metrics from {rentComps.length} rent comps & property records</p>
        </div>
        <div className="flex items-center gap-2">
          {(['1Y', '3Y', '5Y', '10Y'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                timeframe === tf
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {marketSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Rent/SF</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">${marketSummary.avgRentPerSf.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">Range: ${marketSummary.rentRange.min.toFixed(2)} – ${marketSummary.rentRange.max.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={14} className="text-green-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Occupancy</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{marketSummary.avgOccupancy.toFixed(1)}%</div>
            <div className="text-xs text-slate-400 mt-1">Range: {marketSummary.occupancyRange.min.toFixed(1)}% – {marketSummary.occupancyRange.max.toFixed(1)}%</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-purple-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Unit Size</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{Math.round(marketSummary.avgUnitSize)} SF</div>
            <div className="text-xs text-slate-400 mt-1">Avg Year Built: {Math.round(marketSummary.avgYearBuilt)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-amber-500" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Properties</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{marketSummary.propertyCount}</div>
            <div className="text-xs text-slate-400 mt-1">{marketSummary.totalUnits.toLocaleString()} total units</div>
          </div>
        </div>
      )}

      {vintageGroups.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            Rent by Vintage Analysis
          </h3>
          <div className="space-y-3">
            {vintageGroups.map(group => (
              <div key={group.decade} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium text-slate-700">{group.decade}</div>
                <div className="w-12 text-xs text-slate-500 text-right">{group.count} props</div>
                <div className="flex-1 relative h-7">
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-500 rounded-r flex items-center"
                    style={{ width: `${(group.avgRentPerSf / maxRentPerSf) * 100}%`, minWidth: '2rem' }}
                  >
                    <span className="text-xs text-white font-medium pl-2 whitespace-nowrap">${group.avgRentPerSf.toFixed(2)}/SF</span>
                  </div>
                </div>
                <div className="w-20 text-xs text-slate-500 text-right">{group.avgOccupancy.toFixed(1)}% occ</div>
                <div className="w-16 text-xs text-slate-500 text-right">{Math.round(group.avgUnitSize)} SF</div>
              </div>
            ))}
          </div>
          {vintagePremium !== null && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <TrendingUp size={12} className="inline mr-1" />
                Newer vintage (2020s) commands <span className="font-semibold">${vintagePremium.toFixed(2)}</span> premium over older stock
              </p>
            </div>
          )}
        </div>
      )}

      {ageBuckets.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-slate-500" />
            Occupancy by Building Age
          </h3>
          <div className="space-y-3">
            {ageBuckets.map(bucket => (
              <div key={bucket.label} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium text-slate-700">{bucket.label}</div>
                <div className="w-12 text-xs text-slate-500 text-right">{bucket.count} props</div>
                <div className="flex-1 relative h-7 bg-slate-100 rounded">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 rounded flex items-center"
                    style={{ width: `${(bucket.avgOccupancy / maxOccupancy) * 100}%`, minWidth: '3rem' }}
                  >
                    <span className="text-xs text-white font-medium pl-2 whitespace-nowrap">{bucket.avgOccupancy.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedBenchmarks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-slate-500" />
            Neighborhood Value Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Neighborhood</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Properties</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Total Units</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Median $/Unit</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Avg Density</th>
                </tr>
              </thead>
              <tbody>
                {sortedBenchmarks.map(b => (
                  <tr key={b.neighborhoodCode} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-700">{b.neighborhoodCode}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{b.propertyCount}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{b.totalUnits.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {b.medianPerUnit != null ? `$${b.medianPerUnit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {b.avgDensity != null ? b.avgDensity.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rentComps.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Percent size={16} className="text-slate-500" />
            Concession Analysis
          </h3>
          <div className="text-xs text-slate-500 mb-3">
            Market avg concession: <span className="font-semibold text-slate-700">{avgConcession.toFixed(1)}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">Property</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Concession %</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">Occupancy %</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 uppercase">vs Market</th>
                </tr>
              </thead>
              <tbody>
                {rentComps
                  .filter(c => c.concessionPct != null)
                  .sort((a, b) => (b.concessionPct || 0) - (a.concessionPct || 0))
                  .map((comp, idx) => {
                    const aboveAvg = (comp.concessionPct || 0) > avgConcession;
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-100 ${aboveAvg ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-700">{comp.buildingName}</div>
                          <div className="text-xs text-slate-400">{comp.address}</div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className={`font-medium ${aboveAvg ? 'text-amber-700' : 'text-slate-600'}`}>
                            {(comp.concessionPct || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {comp.occupancyPct != null ? `${comp.occupancyPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {aboveAvg ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              <ArrowUpRight size={10} /> Above Avg
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                              <ArrowDownRight size={10} /> Below Avg
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {rentComps.some(c => (c.concessionPct || 0) > avgConcession) && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs text-amber-700">
                <TrendingDown size={12} className="inline mr-1" />
                Properties highlighted above are offering concessions above the market average — potential negotiation leverage for acquisition pricing.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">Market Data Insight</h4>
            <p className="text-sm text-blue-700 mt-1">
              Analysis based on {rentComps.length} comparable properties totaling {marketSummary?.totalUnits.toLocaleString() || '—'} units.
              {marketSummary && ` Average rent of $${marketSummary.avgRentPerSf.toFixed(2)}/SF with ${marketSummary.avgOccupancy.toFixed(1)}% market occupancy.`}
              {vintagePremium !== null && vintagePremium > 0 && ` Newer vintage commands a $${vintagePremium.toFixed(2)}/SF premium.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsAnalysisSection;
