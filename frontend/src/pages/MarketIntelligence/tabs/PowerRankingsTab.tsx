import React, { useState, useMemo, useEffect } from 'react';
import { apiClient } from '../../../api/client';
import { BT } from '@/components/deal/bloomberg-ui';

interface PowerRankingsTabProps {
  marketId: string;
}

interface PropertyRanking {
  id: number | string;
  name: string;
  address?: string;
  submarket: string;
  units: number;
  yearBuilt: number;
  class: string;
  owner?: string;
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

function scoreColorStyle(score: number): React.CSSProperties {
  if (score >= 85) return { background: `${BT.text.green}22`, color: BT.text.green };
  if (score >= 70) return { background: `${BT.text.green}15`, color: BT.text.green };
  if (score >= 55) return { background: `${BT.text.amber}22`, color: BT.text.amber };
  return { background: `${BT.text.red}22`, color: BT.text.red };
}

function componentBarBg(score: number): string {
  if (score >= 85) return BT.text.green;
  if (score >= 70) return BT.text.green;
  if (score >= 55) return BT.text.amber;
  return BT.text.red;
}

const PowerRankingsTab: React.FC<PowerRankingsTabProps> = ({ marketId }) => {
  const [classFilter, setClassFilter] = useState<string>('All');
  const [vintageFilter, setVintageFilter] = useState<string>('All');
  const [sizeFilter, setSizeFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | string | null>(null);
  const [rankings, setRankings] = useState<PropertyRanking[]>(MOCK_RANKINGS);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [totalProperties, setTotalProperties] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const response: any = await apiClient.get(`/rankings/${marketId}`);
        const outer = response?.data || response;
        const report = outer?.rankings ? outer : (outer?.data || outer);
        if (!cancelled && report?.rankings && report.rankings.length > 0) {
          setRankings(report.rankings);
          setIsLive(report.source === 'live');
          setTotalProperties(report.total || report.rankings.length);
        } else if (!cancelled) {
          setRankings(MOCK_RANKINGS);
          setIsLive(false);
          setTotalProperties(MOCK_RANKINGS.length);
        }
      } catch {
        if (!cancelled) {
          setRankings(MOCK_RANKINGS);
          setIsLive(false);
          setTotalProperties(MOCK_RANKINGS.length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRankings();
    return () => { cancelled = true; };
  }, [marketId]);

  const filtered = useMemo(() => {
    let data = [...rankings];
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
  }, [rankings, classFilter, vintageFilter, sizeFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'rank');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="ml-1" style={{ color: BT.text.muted }}>{'\u2195'}</span>;
    return <span className="ml-1" style={{ color: BT.text.cyan }}>{sortAsc ? '\u2191' : '\u2193'}</span>;
  };

  const COMPONENT_LABELS: { key: keyof PropertyRanking['components']; label: string; color: string }[] = [
    { key: 'trafficPerformance', label: 'Traffic Performance', color: '#3b82f6' },
    { key: 'revenueStrength', label: 'Revenue Strength', color: '#22c55e' },
    { key: 'operationalQuality', label: 'Operational Quality', color: '#f97316' },
    { key: 'assetCondition', label: 'Asset Condition', color: '#a855f7' },
    { key: 'marketPosition', label: 'Market Position', color: '#14b8a6' },
  ];

  const topMovers = useMemo(() => {
    const sorted = [...rankings].sort((a, b) => b.movement - a.movement);
    const risers = sorted.filter(p => p.movement > 0).slice(0, 3);
    const fallers = sorted.filter(p => p.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 3);
    return { risers, fallers };
  }, [rankings]);

  if (!marketId || marketId === '') {
    return (
      <div className="p-12 text-center" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <span className="text-4xl mb-4 block">{'\uD83C\uDFC6'}</span>
        <h3 className="text-lg font-semibold" style={{ color: BT.text.primary }}>Power Rankings</h3>
        <p className="text-sm mt-2" style={{ color: BT.text.muted }}>Select a market to see property competitive rankings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: BT.text.primary }}>Power Rankings</h2>
          <p className="text-sm" style={{ color: BT.text.secondary }}>
            Property Competitive Score (PCS) {'\u2014'} ranked across {totalProperties} multifamily properties
            {isLive && <span className="font-medium ml-1" style={{ color: BT.text.green }}>(Fulton County records)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="text-xs animate-pulse" style={{ color: BT.text.cyan }}>Loading...</span>
          )}
          {!loading && isLive && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold" style={{ background: `${BT.text.green}22`, color: BT.text.green, borderRadius: 0 }}>
              {'\u25CF'} LIVE DATA
            </span>
          )}
          {!loading && !isLive && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold" style={{ background: BT.bg.header, color: BT.text.secondary, borderRadius: 0 }}>
              SAMPLE DATA
            </span>
          )}
        </div>
      </div>

      <div className="p-5" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: BT.text.secondary }}>Vantage Group Filters</span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: BT.text.secondary }}>Class</label>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="px-3 py-2 text-sm"
              style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.input, color: BT.text.primary }}
            >
              {CLASS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'All Classes' : `Class ${opt}`}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: BT.text.secondary }}>Vintage Decade</label>
            <select
              value={vintageFilter}
              onChange={e => setVintageFilter(e.target.value)}
              className="px-3 py-2 text-sm"
              style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.input, color: BT.text.primary }}
            >
              {VINTAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt === 'All' ? 'All Vintages' : opt}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: BT.text.secondary }}>Size (Units)</label>
            <select
              value={sizeFilter}
              onChange={e => setSizeFilter(e.target.value)}
              className="px-3 py-2 text-sm"
              style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.input, color: BT.text.primary }}
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
                className="px-3 py-2 text-sm underline" style={{ color: BT.text.secondary }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
          <h3 className="text-base font-semibold" style={{ color: BT.text.primary }}>Rankings Table</h3>
          <p className="text-sm mt-0.5" style={{ color: BT.text.secondary }}>
            Showing {filtered.length} of {rankings.length} properties {'\u00B7'} Click a row to view PCS breakdown
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: BT.bg.panelAlt }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer w-16" style={{ color: BT.text.secondary }} onClick={() => handleSort('rank')}>
                  Rank {sortArrow('rank')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-16" style={{ color: BT.text.secondary }}>
                  Move
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider cursor-pointer min-w-[180px]" style={{ color: BT.text.secondary }} onClick={() => handleSort('name')}>
                  Property {sortArrow('name')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20" style={{ color: BT.text.secondary }}>
                  Class
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer w-20" style={{ color: BT.text.secondary }} onClick={() => handleSort('units')}>
                  Units {sortArrow('units')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-24" style={{ color: BT.text.secondary }}>
                  Submarket
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider cursor-pointer w-24" style={{ color: BT.text.secondary }} onClick={() => handleSort('pcsScore')}>
                  PCS Score {sortArrow('pcsScore')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-32" style={{ color: BT.text.secondary }}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(property => (
                <React.Fragment key={property.id}>
                  <tr
                    className="transition-colors cursor-pointer"
                    style={{ background: expandedRow === property.id ? `${BT.text.cyan}15` : undefined, borderBottom: `1px solid ${BT.border.subtle}` }}
                    onClick={() => setExpandedRow(expandedRow === property.id ? null : property.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: BT.text.primary }}>#{property.rank}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {property.movement > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: BT.text.green }}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                          {property.movement}
                        </span>
                      )}
                      {property.movement < 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: BT.text.red }}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          {Math.abs(property.movement)}
                        </span>
                      )}
                      {property.movement === 0 && (
                        <span className="text-xs font-medium" style={{ color: BT.text.muted }}>{'\u2014'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold" style={{ color: BT.text.primary }}>{property.name}</span>
                        <span className="text-xs" style={{ color: BT.text.muted }}>
                          {property.yearBuilt > 0 ? property.yearBuilt : 'N/A'}
                          {property.owner && <span className="ml-2" style={{ color: BT.text.muted }}>{'\u00B7'} {property.owner.length > 30 ? property.owner.slice(0, 28) + '...' : property.owner}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold" style={{
                        borderRadius: 0,
                        background: property.class === 'A' ? `${BT.text.cyan}22` : property.class.startsWith('B') ? `${BT.text.amber}22` : BT.bg.header,
                        color: property.class === 'A' ? BT.text.cyan : property.class.startsWith('B') ? BT.text.amber : BT.text.primary,
                      }}>
                        {property.class}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: BT.text.secondary }}>{property.units.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: BT.text.secondary }}>{property.submarket}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-1 text-sm font-bold" style={{ borderRadius: 0, ...scoreColorStyle(property.pcsScore) }}>
                        {property.pcsScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <svg viewBox="0 0 80 24" className="w-20 h-6 mx-auto">
                        {(() => {
                          const base = property.pcsScore;
                          const idNum = typeof property.id === 'number' ? property.id : (property.units * 7 + property.yearBuilt) % 100;
                          const pts = [
                            base - 4 + Math.round(Math.sin(idNum) * 3),
                            base - 3 + Math.round(Math.cos(idNum * 2) * 2),
                            base - 2 + Math.round(Math.sin(idNum * 3) * 2),
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
                        <div className="px-6 py-5" style={{ background: BT.bg.panelAlt, borderTop: `1px solid ${BT.border.subtle}`, borderBottom: `1px solid ${BT.border.subtle}` }}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="text-sm font-bold" style={{ color: BT.text.primary }}>PCS Score Breakdown {'\u2014'} {property.name}</h4>
                              <p className="text-xs mt-0.5" style={{ color: BT.text.secondary }}>5-component Property Competitive Score</p>
                            </div>
                            <span className="inline-block px-3 py-1 text-lg font-bold" style={{ borderRadius: 0, ...scoreColorStyle(property.pcsScore) }}>
                              {property.pcsScore}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {COMPONENT_LABELS.map(comp => {
                              const value = property.components[comp.key];
                              return (
                                <div key={comp.key} className="flex items-center gap-3">
                                  <span className="w-40 text-xs font-medium flex-shrink-0" style={{ color: BT.text.primary }}>{comp.label}</span>
                                  <div className="flex-1 h-5 overflow-hidden" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
                                    <div
                                      className="h-5 transition-all duration-500"
                                      style={{ width: `${value}%`, background: componentBarBg(value), borderRadius: 0 }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-sm font-bold" style={{ color: BT.text.primary }}>{value}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
                            <div className="flex items-center gap-4 text-xs" style={{ color: BT.text.secondary }}>
                              <span>Class: <strong style={{ color: BT.text.primary }}>{property.class}</strong></span>
                              <span>Units: <strong style={{ color: BT.text.primary }}>{property.units.toLocaleString()}</strong></span>
                              <span>Year: <strong style={{ color: BT.text.primary }}>{property.yearBuilt || 'N/A'}</strong></span>
                              <span>Submarket: <strong style={{ color: BT.text.primary }}>{property.submarket}</strong></span>
                              {property.owner && <span>Owner: <strong style={{ color: BT.text.primary }}>{property.owner}</strong></span>}
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedRow(null); }}
                              className="text-xs font-medium" style={{ color: BT.text.cyan }}
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
                  <td colSpan={8} className="px-4 py-12 text-center" style={{ color: BT.text.muted }}>
                    {loading ? 'Loading rankings...' : 'No properties match the selected filters. Try adjusting your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-5" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: BT.text.teal, borderRadius: 0 }}>
            <span className="text-xs font-bold" style={{ color: BT.bg.terminal }}>AI</span>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1" style={{ color: BT.text.teal }}>Rankings Insight</h4>
            <p className="text-sm leading-relaxed" style={{ color: BT.text.primary }}>
              {topMovers.risers.length > 0 && (
                <>
                  <strong style={{ color: BT.text.teal }}>Top Risers:</strong>{' '}
                  {topMovers.risers.map((p, i) => (
                    <span key={p.id}>{i > 0 ? ', ' : ''}{p.name} (+{p.movement})</span>
                  ))}
                  {' '}showing momentum from strong market position and improving fundamentals.{' '}
                </>
              )}
              {topMovers.fallers.length > 0 && (
                <>
                  <strong style={{ color: BT.text.red }}>Watch:</strong>{' '}
                  {topMovers.fallers.map((p, i) => (
                    <span key={p.id}>{i > 0 ? ', ' : ''}{p.name} ({p.movement})</span>
                  ))}
                  {' '}declining due to supply pressure and competitive dynamics.{' '}
                </>
              )}
              <strong style={{ color: BT.text.cyan }}>Opportunity:</strong> Properties ranked 6-15 with upward movement represent the best value-add targets {'\u2014'} improving fundamentals at lower entry points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerRankingsTab;
