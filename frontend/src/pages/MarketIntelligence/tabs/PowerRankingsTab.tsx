import React, { useState, useMemo } from 'react';

interface PowerRankingsTabProps {
  marketId: string;
}

interface PropertyRanking {
  id: number;
  name: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: 'A' | 'B+' | 'B' | 'B-' | 'C+' | 'C';
  pcsScore: number;
  rank: number;
  movement: number;
  components: {
    trafficPerformance: number;
    revenueStrength: number;
    operationalQuality: number;
    assetCondition: number;
    marketPosition: number;
  };
}

const MOCK_RANKINGS: PropertyRanking[] = [
  { id: 1, name: 'The Vue at Midtown', submarket: 'Midtown', units: 196, yearBuilt: 2018, class: 'A', pcsScore: 94, rank: 1, movement: 2, components: { trafficPerformance: 96, revenueStrength: 92, operationalQuality: 95, assetCondition: 93, marketPosition: 94 } },
  { id: 2, name: 'Buckhead Grand', submarket: 'Buckhead', units: 320, yearBuilt: 2020, class: 'A', pcsScore: 91, rank: 2, movement: 0, components: { trafficPerformance: 90, revenueStrength: 94, operationalQuality: 88, assetCondition: 96, marketPosition: 87 } },
  { id: 3, name: 'Pines at Midtown', submarket: 'Midtown', units: 180, yearBuilt: 1992, class: 'B', pcsScore: 88, rank: 3, movement: 3, components: { trafficPerformance: 92, revenueStrength: 85, operationalQuality: 84, assetCondition: 78, marketPosition: 91 } },
  { id: 4, name: 'Brookhaven Terrace', submarket: 'Brookhaven', units: 240, yearBuilt: 1998, class: 'B+', pcsScore: 86, rank: 4, movement: -1, components: { trafficPerformance: 88, revenueStrength: 82, operationalQuality: 86, assetCondition: 84, marketPosition: 90 } },
  { id: 5, name: 'Peachtree Walk', submarket: 'Midtown', units: 310, yearBuilt: 2015, class: 'B+', pcsScore: 85, rank: 5, movement: 1, components: { trafficPerformance: 84, revenueStrength: 88, operationalQuality: 82, assetCondition: 86, marketPosition: 85 } },
  { id: 6, name: 'Decatur Station', submarket: 'Decatur', units: 156, yearBuilt: 1985, class: 'C+', pcsScore: 83, rank: 6, movement: 4, components: { trafficPerformance: 86, revenueStrength: 78, operationalQuality: 80, assetCondition: 72, marketPosition: 89 } },
  { id: 7, name: 'Heritage Oaks', submarket: 'Sandy Springs', units: 280, yearBuilt: 2005, class: 'B', pcsScore: 81, rank: 7, movement: -2, components: { trafficPerformance: 78, revenueStrength: 84, operationalQuality: 83, assetCondition: 80, marketPosition: 82 } },
  { id: 8, name: 'Summit Creek', submarket: 'Buckhead', units: 196, yearBuilt: 2010, class: 'B+', pcsScore: 80, rank: 8, movement: 0, components: { trafficPerformance: 82, revenueStrength: 80, operationalQuality: 79, assetCondition: 78, marketPosition: 81 } },
  { id: 9, name: 'Sandy Springs Crossing', submarket: 'Sandy Springs', units: 312, yearBuilt: 2001, class: 'B+', pcsScore: 78, rank: 9, movement: -3, components: { trafficPerformance: 74, revenueStrength: 82, operationalQuality: 78, assetCondition: 76, marketPosition: 80 } },
  { id: 10, name: 'Cascade Heights', submarket: 'East Atlanta', units: 144, yearBuilt: 1988, class: 'C+', pcsScore: 76, rank: 10, movement: 5, components: { trafficPerformance: 80, revenueStrength: 72, operationalQuality: 74, assetCondition: 68, marketPosition: 86 } },
  { id: 11, name: 'Glenwood Gardens', submarket: 'East Atlanta', units: 320, yearBuilt: 1995, class: 'B-', pcsScore: 74, rank: 11, movement: 1, components: { trafficPerformance: 76, revenueStrength: 70, operationalQuality: 75, assetCondition: 72, marketPosition: 77 } },
  { id: 12, name: 'Parkside at Buckhead', submarket: 'Buckhead', units: 280, yearBuilt: 2012, class: 'B+', pcsScore: 73, rank: 12, movement: -4, components: { trafficPerformance: 70, revenueStrength: 78, operationalQuality: 72, assetCondition: 74, marketPosition: 71 } },
  { id: 13, name: 'Midtown 440', submarket: 'Midtown', units: 220, yearBuilt: 2022, class: 'A', pcsScore: 71, rank: 13, movement: -2, components: { trafficPerformance: 68, revenueStrength: 76, operationalQuality: 70, assetCondition: 88, marketPosition: 52 } },
  { id: 14, name: 'Westside Lofts', submarket: 'Midtown', units: 96, yearBuilt: 1978, class: 'C', pcsScore: 68, rank: 14, movement: 0, components: { trafficPerformance: 72, revenueStrength: 64, operationalQuality: 66, assetCondition: 58, marketPosition: 80 } },
  { id: 15, name: 'Buckhead Place', submarket: 'Buckhead', units: 180, yearBuilt: 2003, class: 'B', pcsScore: 66, rank: 15, movement: -1, components: { trafficPerformance: 64, revenueStrength: 68, operationalQuality: 65, assetCondition: 66, marketPosition: 67 } },
  { id: 16, name: 'Cascade Pointe', submarket: 'East Atlanta', units: 148, yearBuilt: 1982, class: 'C', pcsScore: 63, rank: 16, movement: 2, components: { trafficPerformance: 66, revenueStrength: 58, operationalQuality: 62, assetCondition: 54, marketPosition: 75 } },
  { id: 17, name: 'Vinings Glen', submarket: 'Sandy Springs', units: 200, yearBuilt: 1990, class: 'B-', pcsScore: 60, rank: 17, movement: -1, components: { trafficPerformance: 58, revenueStrength: 62, operationalQuality: 60, assetCondition: 56, marketPosition: 64 } },
  { id: 18, name: 'Chamblee Crossings', submarket: 'Brookhaven', units: 168, yearBuilt: 1975, class: 'C', pcsScore: 55, rank: 18, movement: 0, components: { trafficPerformance: 52, revenueStrength: 56, operationalQuality: 54, assetCondition: 48, marketPosition: 65 } },
];

type SortKey = 'rank' | 'pcsScore' | 'name' | 'units' | 'movement';

const CLASS_OPTIONS = ['All', 'A', 'B+', 'B', 'B-', 'C+', 'C'] as const;
const VINTAGE_OPTIONS = ['All', '2020s', '2010s', '2000s', '1990s', '1980s', 'Pre-1980'] as const;
const SIZE_OPTIONS = ['All', '< 150', '150-250', '250-350', '350+'] as const;

function getVintageDecade(year: number): string {
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'Pre-1980';
}

function matchesSize(units: number, filter: string): boolean {
  if (filter === 'All') return true;
  if (filter === '< 150') return units < 150;
  if (filter === '150-250') return units >= 150 && units <= 250;
  if (filter === '250-350') return units >= 250 && units <= 350;
  if (filter === '350+') return units > 350;
  return true;
}

function scoreColor(score: number): string {
  if (score >= 85) return 'bg-green-100 text-green-800';
  if (score >= 70) return 'bg-emerald-50 text-emerald-700';
  if (score >= 55) return 'bg-yellow-50 text-yellow-700';
  return 'bg-red-50 text-red-700';
}

function componentBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500';
  if (score >= 70) return 'bg-emerald-400';
  if (score >= 55) return 'bg-yellow-400';
  return 'bg-red-400';
}

const PowerRankingsTab: React.FC<PowerRankingsTabProps> = ({ marketId }) => {
  const [classFilter, setClassFilter] = useState<string>('All');
  const [vintageFilter, setVintageFilter] = useState<string>('All');
  const [sizeFilter, setSizeFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const isAtlanta = marketId === 'atlanta';

  const filtered = useMemo(() => {
    let data = [...MOCK_RANKINGS];
    if (classFilter !== 'All') data = data.filter(p => p.class === classFilter);
    if (vintageFilter !== 'All') data = data.filter(p => getVintageDecade(p.yearBuilt) === vintageFilter);
    if (sizeFilter !== 'All') data = data.filter(p => matchesSize(p.units, sizeFilter));

    data.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [classFilter, vintageFilter, sizeFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  const COMPONENT_LABELS: { key: keyof PropertyRanking['components']; label: string; color: string }[] = [
    { key: 'trafficPerformance', label: 'Traffic Performance', color: '#3b82f6' },
    { key: 'revenueStrength', label: 'Revenue Strength', color: '#22c55e' },
    { key: 'operationalQuality', label: 'Operational Quality', color: '#f97316' },
    { key: 'assetCondition', label: 'Asset Condition', color: '#a855f7' },
    { key: 'marketPosition', label: 'Market Position', color: '#14b8a6' },
  ];

  if (!isAtlanta) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <span className="text-4xl mb-4 block">🏆</span>
        <h3 className="text-lg font-semibold text-gray-700">Power Rankings</h3>
        <p className="text-sm text-gray-400 mt-2">Connect market data to see property competitive rankings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Power Rankings</h2>
          <p className="text-sm text-gray-500">Property Competitive Score (PCS) — ranked across {MOCK_RANKINGS.length} properties</p>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          MOCK DATA
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vantage Group Filters</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Class</label>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CLASS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'All Classes' : `Class ${opt}`}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Vintage Decade</label>
            <select
              value={vintageFilter}
              onChange={e => setVintageFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {VINTAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'All Vintages' : opt}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Size (Units)</label>
            <select
              value={sizeFilter}
              onChange={e => setSizeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'All Sizes' : `${opt} units`}</option>
              ))}
            </select>
          </div>
          {(classFilter !== 'All' || vintageFilter !== 'All' || sizeFilter !== 'All') && (
            <div className="flex items-end">
              <button
                onClick={() => { setClassFilter('All'); setVintageFilter('All'); setSizeFilter('All'); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Rankings Table</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Showing {filtered.length} of {MOCK_RANKINGS.length} properties · Click a row to view PCS breakdown
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 w-16"
                  onClick={() => handleSort('rank')}
                >
                  Rank {sortArrow('rank')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  Move
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 min-w-[180px]"
                  onClick={() => handleSort('name')}
                >
                  Property {sortArrow('name')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Class
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 w-20"
                  onClick={() => handleSort('units')}
                >
                  Units {sortArrow('units')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  Submarket
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 w-24"
                  onClick={() => handleSort('pcsScore')}
                >
                  PCS Score {sortArrow('pcsScore')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(property => (
                <React.Fragment key={property.id}>
                  <tr
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedRow === property.id ? 'bg-blue-50/40' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === property.id ? null : property.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-gray-700">#{property.rank}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {property.movement > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-green-600">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                          {property.movement}
                        </span>
                      )}
                      {property.movement < 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {Math.abs(property.movement)}
                        </span>
                      )}
                      {property.movement === 0 && (
                        <span className="text-xs font-medium text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900">{property.name}</span>
                        <span className="text-xs text-gray-400">{property.yearBuilt}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        property.class === 'A' ? 'bg-blue-100 text-blue-800' :
                        property.class.startsWith('B') ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {property.class}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{property.units}</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600">{property.submarket}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-bold ${scoreColor(property.pcsScore)}`}>
                        {property.pcsScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <svg viewBox="0 0 80 24" className="w-20 h-6 mx-auto">
                        {(() => {
                          const base = property.pcsScore;
                          const pts = [
                            base - 4 + Math.round(Math.sin(property.id) * 3),
                            base - 3 + Math.round(Math.cos(property.id * 2) * 2),
                            base - 2 + Math.round(Math.sin(property.id * 3) * 2),
                            base - 1,
                            base + property.movement * 0.3,
                            base,
                          ];
                          const min = Math.min(...pts) - 2;
                          const max = Math.max(...pts) + 2;
                          const range = max - min || 1;
                          const points = pts.map((v, i) => `${(i / (pts.length - 1)) * 76 + 2},${22 - ((v - min) / range) * 18}`).join(' ');
                          const trendColor = property.movement > 0 ? '#22c55e' : property.movement < 0 ? '#ef4444' : '#9ca3af';
                          return <polyline points={points} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;
                        })()}
                      </svg>
                    </td>
                  </tr>
                  {expandedRow === property.id && (
                    <tr>
                      <td colSpan={8} className="px-0 py-0">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-t border-b border-blue-100 px-6 py-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">PCS Score Breakdown — {property.name}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">5-component Property Competitive Score</p>
                            </div>
                            <span className={`inline-block px-3 py-1 rounded-lg text-lg font-bold ${scoreColor(property.pcsScore)}`}>
                              {property.pcsScore}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {COMPONENT_LABELS.map(comp => {
                              const value = property.components[comp.key];
                              return (
                                <div key={comp.key} className="flex items-center gap-3">
                                  <span className="w-40 text-xs font-medium text-gray-700 flex-shrink-0">{comp.label}</span>
                                  <div className="flex-1 bg-white/60 rounded-full h-5 overflow-hidden border border-gray-200/60">
                                    <div
                                      className={`h-5 rounded-full transition-all duration-500 ${componentBarColor(value)}`}
                                      style={{ width: `${value}%` }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-sm font-bold text-gray-800">{value}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 border-t border-blue-200/40 flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Class: <strong className="text-gray-700">{property.class}</strong></span>
                              <span>Units: <strong className="text-gray-700">{property.units}</strong></span>
                              <span>Year: <strong className="text-gray-700">{property.yearBuilt}</strong></span>
                              <span>Submarket: <strong className="text-gray-700">{property.submarket}</strong></span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedRow(null); }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No properties match the selected filters. Try adjusting your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-teal-800 mb-1">Rankings Insight</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              <strong className="text-teal-700">Top Movers:</strong> Cascade Heights (+5) and Decatur Station (+4) are surging driven by strong market position scores in underserved submarkets.{' '}
              <strong className="text-red-600">Watch:</strong> Sandy Springs Crossing (-3) and Parkside at Buckhead (-4) declining due to increased supply pressure and traffic competition.{' '}
              <strong className="text-blue-700">Opportunity:</strong> Properties ranked 6-10 with upward movement represent the best value-add targets — improving fundamentals at lower entry points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerRankingsTab;
