import React, { useState, useEffect, useMemo } from 'react';
import { propertyMetricsService, RentComp, MarketSummary } from '../../../services/propertyMetrics.service';

interface CompetitionSectionProps {
  deal?: any;
}

type SortKey = 'buildingName' | 'units' | 'yearBuilt' | 'avgSf' | 'rentPerSf' | 'rentPerUnit' | 'occupancyPct' | 'concessionPct' | 'milesAway' | 'overlapPct';
type SortDir = 'asc' | 'desc';

export const CompetitionSection: React.FC<CompetitionSectionProps> = ({ deal }) => {
  const [rentComps, setRentComps] = useState<RentComp[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('milesAway');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [comps, mktSummary] = await Promise.all([
          propertyMetricsService.getRentComps(),
          propertyMetricsService.getMarketSummary(),
        ]);
        setRentComps(comps);
        setSummary(mktSummary);
      } catch (err: any) {
        setError(err?.message || 'Failed to load rent comp data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedComps = useMemo(() => {
    return [...rentComps].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [rentComps, sortKey, sortDir]);

  const unitMixComps = useMemo(() => {
    return rentComps.filter(
      c => c.studioRent != null || c.oneBedRent != null || c.twoBedRent != null || c.threeBedRent != null ||
           c.studioCount != null || c.oneBedCount != null || c.twoBedCount != null || c.threeBedCount != null
    );
  }, [rentComps]);

  const effectiveRents = useMemo(() => {
    return rentComps
      .filter(c => c.rentPerSf != null && c.occupancyPct != null)
      .map(c => ({
        buildingName: c.buildingName,
        rentPerSf: c.rentPerSf!,
        occupancyPct: c.occupancyPct!,
        effectiveRent: (c.rentPerSf! * c.occupancyPct!) / 100,
      }))
      .sort((a, b) => b.effectiveRent - a.effectiveRent);
  }, [rentComps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading rent comp data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium mb-1">Error loading competition data</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {summary && <QuickStatsRow summary={summary} />}
      <RentCompTable comps={sortedComps} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      {unitMixComps.length > 0 && <UnitMixBreakdown comps={unitMixComps} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScatterPlotCard comps={rentComps} />
        <EffectiveRentCard items={effectiveRents} />
      </div>
    </div>
  );
};

const QuickStatsRow: React.FC<{ summary: MarketSummary }> = ({ summary }) => {
  const cards = [
    { label: 'Avg Rent/SF', value: `$${summary.avgRentPerSf.toFixed(2)}/SF` },
    { label: 'Median Rent/SF', value: `$${summary.medianRentPerSf.toFixed(2)}/SF` },
    { label: 'Avg Occupancy', value: `${summary.avgOccupancy.toFixed(1)}%` },
    { label: 'Avg Concession', value: `${summary.avgConcession.toFixed(1)}%` },
    { label: 'Total Comp Units', value: summary.totalUnits.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-gray-900 mb-1">{c.value}</div>
          <div className="text-sm text-gray-600">{c.label}</div>
        </div>
      ))}
    </div>
  );
};

const occColor = (pct: number | null): string => {
  if (pct == null) return 'text-gray-500';
  if (pct >= 95) return 'text-green-600';
  if (pct >= 90) return 'text-yellow-600';
  return 'text-red-600';
};

const SortHeader: React.FC<{ label: string; field: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }> = ({ label, field, current, dir, onSort }) => {
  const active = current === field;
  return (
    <th
      className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      {label} {active ? (dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );
};

const RentCompTable: React.FC<{ comps: RentComp[]; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void }> = ({ comps, sortKey, sortDir, onSort }) => {
  const fmt = (v: number | null, decimals = 0) => (v != null ? v.toFixed(decimals) : '—');
  const fmtDollar = (v: number | null, decimals = 2) => (v != null ? `$${v.toFixed(decimals)}` : '—');

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Rent Comp Table</h3>
        <p className="text-sm text-gray-500">{comps.length} comparable properties</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="Building Name" field="buildingName" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Units" field="units" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Year Built" field="yearBuilt" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Avg SF" field="avgSf" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Rent/SF" field="rentPerSf" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Rent/Unit" field="rentPerUnit" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Occupancy %" field="occupancyPct" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Concession %" field="concessionPct" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Miles Away" field="milesAway" current={sortKey} dir={sortDir} onSort={onSort} />
              <SortHeader label="Overlap %" field="overlapPct" current={sortKey} dir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {comps.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{c.buildingName}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{c.units}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{c.yearBuilt ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{fmt(c.avgSf)}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{fmtDollar(c.rentPerSf)}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{fmtDollar(c.rentPerUnit, 0)}</td>
                <td className={`px-3 py-2 text-sm font-semibold ${occColor(c.occupancyPct)}`}>{c.occupancyPct != null ? `${c.occupancyPct.toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{c.concessionPct != null ? `${c.concessionPct.toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{c.milesAway != null ? c.milesAway.toFixed(1) : '—'}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{c.overlapPct != null ? `${c.overlapPct.toFixed(0)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const UnitMixBreakdown: React.FC<{ comps: RentComp[] }> = ({ comps }) => {
  const fmtDollar = (v: number | null) => (v != null ? `$${v.toLocaleString()}` : '—');
  const fmtCount = (v: number | null) => (v != null ? v.toString() : '—');

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Unit Mix Breakdown</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Building</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>Studio</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>1BR</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>2BR</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase" colSpan={2}>3BR</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="px-3 py-1"></th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Rent</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Count</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Rent</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Count</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Rent</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Count</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Rent</th>
              <th className="px-3 py-1 text-xs text-gray-500 text-center">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comps.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{c.buildingName}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtDollar(c.studioRent)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtCount(c.studioCount)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtDollar(c.oneBedRent)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtCount(c.oneBedCount)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtDollar(c.twoBedRent)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtCount(c.twoBedCount)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtDollar(c.threeBedRent)}</td>
                <td className="px-3 py-2 text-sm text-gray-700 text-center">{fmtCount(c.threeBedCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ScatterPlotCard: React.FC<{ comps: RentComp[] }> = ({ comps }) => {
  const plotComps = comps.filter(c => c.occupancyPct != null && c.rentPerSf != null);
  const xMin = 85;
  const xMax = 100;
  const yMin = 2;
  const yMax = 6;

  const toPctX = (occ: number) => Math.max(0, Math.min(100, ((occ - xMin) / (xMax - xMin)) * 100));
  const toPctY = (rent: number) => Math.max(0, Math.min(100, 100 - ((rent - yMin) / (yMax - yMin)) * 100));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Rent/SF vs Occupancy</h3>
      <div className="relative w-full h-64 border border-gray-300 rounded bg-gray-50">
        <div className="absolute bottom-0 left-0 text-xs text-gray-400 ml-1 mb-1">85%</div>
        <div className="absolute bottom-0 right-0 text-xs text-gray-400 mr-1 mb-1">100%</div>
        <div className="absolute top-0 left-0 text-xs text-gray-400 ml-1 mt-1">$6</div>
        <div className="absolute bottom-0 left-0 text-xs text-gray-400 ml-1" style={{ bottom: '16px' }}>$2</div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-gray-500 mb-[-18px]">Occupancy %</div>
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -rotate-90 text-xs text-gray-500 ml-[-18px]">Rent/SF</div>
        {plotComps.map((c, i) => (
          <div
            key={i}
            className="absolute w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center -translate-x-1/2 -translate-y-1/2 hover:bg-blue-700 cursor-default"
            style={{ left: `${toPctX(c.occupancyPct!)}%`, top: `${toPctY(c.rentPerSf!)}%` }}
            title={`${c.buildingName}: $${c.rentPerSf!.toFixed(2)}/SF, ${c.occupancyPct!.toFixed(1)}% occ`}
          >
            {c.buildingName.charAt(0)}
          </div>
        ))}
      </div>
    </div>
  );
};

const EffectiveRentCard: React.FC<{ items: { buildingName: string; rentPerSf: number; occupancyPct: number; effectiveRent: number }[] }> = ({ items }) => {
  const maxEff = items.length > 0 ? items[0].effectiveRent : 1;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Effective Rent/SF</h3>
      <p className="text-xs text-gray-500 mb-3">Rent/SF × Occupancy / 100, sorted descending</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((it, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-700 truncate mr-2">{it.buildingName}</span>
              <span className="font-semibold text-gray-900 whitespace-nowrap">${it.effectiveRent.toFixed(2)}/SF</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(it.effectiveRent / maxEff) * 100}%` }}></div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No effective rent data available</p>}
      </div>
    </div>
  );
};
