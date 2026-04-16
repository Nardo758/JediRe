import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Calendar, ArrowUpRight, ArrowDownRight, Minus, Building2, MapPin, Percent, Loader2 } from 'lucide-react';
import { propertyMetricsService, RentComp, MarketSummary, NeighborhoodBenchmark } from '@/services/propertyMetrics.service';
import { BT } from '@/components/deal/bloomberg-ui';

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
        <Loader2 className="w-6 h-6 animate-spin mr-2" style={{ color: BT.text.cyan }} />
        <span style={{ color: BT.text.secondary }}>Loading market trends data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center" style={{ background: `${BT.text.red}11`, border: `1px solid ${BT.border.medium}`, borderRadius: 0 }}>
        <p className="font-medium" style={{ color: BT.text.red }}>Failed to load data</p>
        <p className="text-sm mt-1" style={{ color: BT.text.red }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>Trends Analysis</h2>
          <p className="text-sm" style={{ color: BT.text.secondary }}>Market metrics from {rentComps.length} rent comps & property records</p>
        </div>
        <div className="flex items-center gap-2">
          {(['1Y', '3Y', '5Y', '10Y'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                borderRadius: 0,
                background: timeframe === tf ? BT.text.cyan : BT.bg.panelAlt,
                color: timeframe === tf ? BT.bg.terminal : BT.text.secondary,
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {marketSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} style={{ color: BT.text.cyan }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Avg Rent/SF</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>${marketSummary.avgRentPerSf.toFixed(2)}</div>
            <div className="text-xs mt-1" style={{ color: BT.text.muted }}>Range: ${marketSummary.rentRange.min.toFixed(2)} – ${marketSummary.rentRange.max.toFixed(2)}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={14} style={{ color: BT.text.green }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Avg Occupancy</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{marketSummary.avgOccupancy.toFixed(1)}%</div>
            <div className="text-xs mt-1" style={{ color: BT.text.muted }}>Range: {marketSummary.occupancyRange.min.toFixed(1)}% – {marketSummary.occupancyRange.max.toFixed(1)}%</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} style={{ color: BT.text.purple }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Avg Unit Size</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{Math.round(marketSummary.avgUnitSize)} SF</div>
            <div className="text-xs mt-1" style={{ color: BT.text.muted }}>Avg Year Built: {Math.round(marketSummary.avgYearBuilt)}</div>
          </div>
          <div className="p-4" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} style={{ color: BT.text.amber }} />
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: BT.text.secondary, fontFamily: BT.font.label }}>Total Properties</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: BT.text.primary, fontFamily: BT.font.mono }}>{marketSummary.propertyCount}</div>
            <div className="text-xs mt-1" style={{ color: BT.text.muted }}>{marketSummary.totalUnits.toLocaleString()} total units</div>
          </div>
        </div>
      )}

      {vintageGroups.length > 0 && (
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <Calendar size={16} style={{ color: BT.text.secondary }} />
            Rent by Vintage Analysis
          </h3>
          <div className="space-y-3">
            {vintageGroups.map(group => (
              <div key={group.decade} className="flex items-center gap-4">
                <div className="w-16 text-sm font-medium" style={{ color: BT.text.secondary }}>{group.decade}</div>
                <div className="w-12 text-xs text-right" style={{ color: BT.text.muted }}>{group.count} props</div>
                <div className="flex-1 relative h-7">
                  <div
                    className="absolute left-0 top-0 h-full flex items-center"
                    style={{ width: `${(group.avgRentPerSf / maxRentPerSf) * 100}%`, minWidth: '2rem', background: BT.text.cyan, borderRadius: 0 }}
                  >
                    <span className="text-xs font-medium pl-2 whitespace-nowrap" style={{ color: BT.bg.terminal }}>${group.avgRentPerSf.toFixed(2)}/SF</span>
                  </div>
                </div>
                <div className="w-20 text-xs text-right" style={{ color: BT.text.muted }}>{group.avgOccupancy.toFixed(1)}% occ</div>
                <div className="w-16 text-xs text-right" style={{ color: BT.text.muted }}>{Math.round(group.avgUnitSize)} SF</div>
              </div>
            ))}
          </div>
          {vintagePremium !== null && (
            <div className="mt-4 p-3" style={{ background: `${BT.text.cyan}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <p className="text-xs" style={{ color: BT.text.cyan }}>
                <TrendingUp size={12} className="inline mr-1" />
                Newer vintage (2020s) commands <span className="font-semibold">${vintagePremium.toFixed(2)}</span> premium over older stock
              </p>
            </div>
          )}
        </div>
      )}

      {ageBuckets.length > 0 && (
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <BarChart3 size={16} style={{ color: BT.text.secondary }} />
            Occupancy by Building Age
          </h3>
          <div className="space-y-3">
            {ageBuckets.map(bucket => (
              <div key={bucket.label} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium" style={{ color: BT.text.secondary }}>{bucket.label}</div>
                <div className="w-12 text-xs text-right" style={{ color: BT.text.muted }}>{bucket.count} props</div>
                <div className="flex-1 relative h-7" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
                  <div
                    className="absolute left-0 top-0 h-full flex items-center"
                    style={{ width: `${(bucket.avgOccupancy / maxOccupancy) * 100}%`, minWidth: '3rem', background: BT.text.green, borderRadius: 0 }}
                  >
                    <span className="text-xs font-medium pl-2 whitespace-nowrap" style={{ color: BT.bg.terminal }}>{bucket.avgOccupancy.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedBenchmarks.length > 0 && (
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <MapPin size={16} style={{ color: BT.text.secondary }} />
            Neighborhood Value Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th className="text-left py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Neighborhood</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Properties</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Total Units</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Median $/Unit</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Avg Density</th>
                </tr>
              </thead>
              <tbody>
                {sortedBenchmarks.map(b => (
                  <tr
                    key={b.neighborhoodCode}
                    style={{ borderBottom: `1px solid ${BT.border.subtle}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2 px-3 font-medium" style={{ color: BT.text.primary }}>{b.neighborhoodCode}</td>
                    <td className="py-2 px-3 text-right" style={{ color: BT.text.secondary }}>{b.propertyCount}</td>
                    <td className="py-2 px-3 text-right" style={{ color: BT.text.secondary }}>{b.totalUnits.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right" style={{ color: BT.text.secondary }}>
                      {b.medianPerUnit != null ? `$${b.medianPerUnit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right" style={{ color: BT.text.secondary }}>
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
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: BT.text.primary, fontFamily: BT.font.display }}>
            <Percent size={16} style={{ color: BT.text.secondary }} />
            Concession Analysis
          </h3>
          <div className="text-xs mb-3" style={{ color: BT.text.muted }}>
            Market avg concession: <span className="font-semibold" style={{ color: BT.text.secondary }}>{avgConcession.toFixed(1)}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th className="text-left py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Property</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Concession %</th>
                  <th className="text-right py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>Occupancy %</th>
                  <th className="text-center py-2 px-3 text-xs font-medium uppercase" style={{ color: BT.text.secondary }}>vs Market</th>
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
                        style={{
                          borderBottom: `1px solid ${BT.border.subtle}`,
                          background: aboveAvg ? `${BT.text.amber}11` : 'transparent',
                        }}
                        onMouseEnter={e => { if (!aboveAvg) e.currentTarget.style.background = BT.bg.hover; }}
                        onMouseLeave={e => { if (!aboveAvg) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="py-2 px-3">
                          <div className="font-medium" style={{ color: BT.text.primary }}>{comp.buildingName}</div>
                          <div className="text-xs" style={{ color: BT.text.muted }}>{comp.address}</div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="font-medium" style={{ color: aboveAvg ? BT.text.amber : BT.text.secondary }}>
                            {(comp.concessionPct || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right" style={{ color: BT.text.secondary }}>
                          {comp.occupancyPct != null ? `${comp.occupancyPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {aboveAvg ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5" style={{ background: `${BT.text.amber}22`, color: BT.text.amber, borderRadius: 0, border: `1px solid ${BT.text.amber}44` }}>
                              <ArrowUpRight size={10} /> Above Avg
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5" style={{ background: `${BT.text.green}22`, color: BT.text.green, borderRadius: 0, border: `1px solid ${BT.text.green}44` }}>
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
            <div className="mt-4 p-3" style={{ background: `${BT.text.amber}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
              <p className="text-xs" style={{ color: BT.text.amber }}>
                <TrendingDown size={12} className="inline mr-1" />
                Properties highlighted above are offering concessions above the market average — potential negotiation leverage for acquisition pricing.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="p-4" style={{ background: `${BT.text.cyan}11`, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ background: `${BT.text.cyan}22`, borderRadius: 0 }}>
            <TrendingUp size={16} style={{ color: BT.text.cyan }} />
          </div>
          <div>
            <h4 className="text-sm font-semibold" style={{ color: BT.text.cyan }}>Market Data Insight</h4>
            <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>
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
