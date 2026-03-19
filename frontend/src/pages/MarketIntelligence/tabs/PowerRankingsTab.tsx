import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../api/client';
import { useTabTheme } from '../../../hooks/useTabTheme';

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

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" };

const MOCK_RANKINGS: PropertyRanking[] = [
  { id: 1, name: 'The Vue at Midtown',  submarket: 'Midtown',    units: 196, yearBuilt: 2018, class: 'A',  pcsScore: 94, rank: 1, movement:  2, components: { trafficPerformance: 96, revenueStrength: 92, operationalQuality: 95, assetCondition: 93, marketPosition: 94 } },
  { id: 2, name: 'Buckhead Grand',       submarket: 'Buckhead',   units: 320, yearBuilt: 2020, class: 'A',  pcsScore: 91, rank: 2, movement:  0, components: { trafficPerformance: 90, revenueStrength: 94, operationalQuality: 88, assetCondition: 96, marketPosition: 87 } },
  { id: 3, name: 'Pines at Midtown',     submarket: 'Midtown',    units: 180, yearBuilt: 1992, class: 'B',  pcsScore: 88, rank: 3, movement:  3, components: { trafficPerformance: 92, revenueStrength: 85, operationalQuality: 84, assetCondition: 78, marketPosition: 91 } },
  { id: 4, name: 'Brookhaven Terrace',   submarket: 'Brookhaven', units: 240, yearBuilt: 1998, class: 'B+', pcsScore: 86, rank: 4, movement: -1, components: { trafficPerformance: 88, revenueStrength: 82, operationalQuality: 86, assetCondition: 84, marketPosition: 90 } },
  { id: 5, name: 'Peachtree Walk',       submarket: 'Midtown',    units: 310, yearBuilt: 2015, class: 'B+', pcsScore: 85, rank: 5, movement:  1, components: { trafficPerformance: 84, revenueStrength: 88, operationalQuality: 82, assetCondition: 86, marketPosition: 85 } },
  { id: 6, name: 'Decatur Station',      submarket: 'Decatur',    units: 156, yearBuilt: 1985, class: 'C+', pcsScore: 83, rank: 6, movement:  4, components: { trafficPerformance: 86, revenueStrength: 78, operationalQuality: 80, assetCondition: 72, marketPosition: 89 } },
];

type SortKey = 'rank' | 'pcsScore' | 'name' | 'units' | 'movement';

const CLASS_OPTIONS   = ['All', 'A', 'B+', 'B', 'B-', 'C+', 'C'] as const;
const VINTAGE_OPTIONS = ['All', '2020s', '2010s', '2000s', '1990s', '1980s', 'Pre-1980'] as const;
const SIZE_OPTIONS    = ['All', '< 150', '150-250', '250-350', '350+'] as const;

function getVintageDecade(year: number): string {
  if (year >= 2020) return '2020s';
  if (year >= 2010) return '2010s';
  if (year >= 2000) return '2000s';
  if (year >= 1990) return '1990s';
  if (year >= 1980) return '1980s';
  return 'Pre-1980';
}

function matchesSize(units: number, filter: string): boolean {
  if (filter === 'All')      return true;
  if (filter === '< 150')    return units < 150;
  if (filter === '150-250')  return units >= 150 && units <= 250;
  if (filter === '250-350')  return units >= 250 && units <= 350;
  if (filter === '350+')     return units > 350;
  return true;
}

const PowerRankingsTab: React.FC<PowerRankingsTabProps> = ({ marketId }) => {
  const T = useTabTheme();
  const navigate = useNavigate();

  const pcsColor = (score: number): string => {
    if (score >= 85) return T.green;
    if (score >= 70) return T.amber;
    if (score >= 55) return '#fb923c';
    return T.red;
  };
  const classColor = (cls: string): string => {
    if (cls === 'A') return T.cyan;
    if (cls.startsWith('B')) return T.amber;
    return T.secondary;
  };
  const COMPONENT_LABELS: { key: keyof PropertyRanking['components']; label: string; color: string }[] = [
    { key: 'trafficPerformance', label: 'Traffic Performance', color: T.cyan   },
    { key: 'revenueStrength',    label: 'Revenue Strength',    color: T.green  },
    { key: 'operationalQuality', label: 'Operational Quality', color: T.amber  },
    { key: 'assetCondition',     label: 'Asset Condition',     color: T.violet },
    { key: 'marketPosition',     label: 'Market Position',     color: '#14b8a6'},
  ];
  const sectionCard: React.CSSProperties = {
    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden',
  };
  const sectionHeader = (accentColor: string): React.CSSProperties => ({
    padding: '8px 14px', borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${accentColor}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.dimBg,
  });
  const [classFilter,   setClassFilter]   = useState<string>('All');
  const [vintageFilter, setVintageFilter] = useState<string>('All');
  const [sizeFilter,    setSizeFilter]    = useState<string>('All');
  const [sortKey,       setSortKey]       = useState<SortKey>('rank');
  const [sortAsc,       setSortAsc]       = useState(true);
  const [expandedRow,   setExpandedRow]   = useState<number | string | null>(null);
  const [rankings,      setRankings]      = useState<PropertyRanking[]>(MOCK_RANKINGS);
  const [loading,       setLoading]       = useState(true);
  const [isLive,        setIsLive]        = useState(false);
  const [totalProperties, setTotalProperties] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const response: any = await apiClient.get(`/rankings/${marketId}`);
        const outer  = response?.data || response;
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
    if (classFilter   !== 'All') data = data.filter(p => p.class === classFilter);
    if (vintageFilter !== 'All') data = data.filter(p => getVintageDecade(p.yearBuilt) === vintageFilter);
    if (sizeFilter    !== 'All') data = data.filter(p => matchesSize(p.units, sizeFilter));
    data.sort((a, b) => {
      const cmp = sortKey === 'name'
        ? a.name.localeCompare(b.name)
        : (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? cmp : -cmp;
    });
    return data;
  }, [rankings, classFilter, vintageFilter, sizeFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === 'rank'); }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ color: T.muted, marginLeft: 3 }}>⇅</span>;
    return <span style={{ color: T.amber, marginLeft: 3 }}>{sortAsc ? '↑' : '↓'}</span>;
  };

  const topMovers = useMemo(() => {
    const sorted  = [...rankings].sort((a, b) => b.movement - a.movement);
    const risers  = sorted.filter(p => p.movement > 0).slice(0, 3);
    const fallers = sorted.filter(p => p.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 3);
    return { risers, fallers };
  }, [rankings]);

  const selectStyle: React.CSSProperties = {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 2,
    color: T.text,
    fontSize: 10,
    padding: '4px 8px',
    cursor: 'pointer',
    ...mono,
  };

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'left',
    borderBottom: `1px solid ${T.border}`,
    background: T.dimBg,
    fontSize: 7,
    fontWeight: 700,
    color: T.amber,
    letterSpacing: 1.5,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    ...mono,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px', background: T.bg, minHeight: '100%' }}>

      {/* ── SECTION 1: FILTER BAR ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.amber)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, letterSpacing: 2, ...mono }}>POWER RANKINGS</span>
            <span style={{ fontSize: 9, color: T.secondary, ...mono }}>
              PCS · {filtered.length}/{totalProperties || rankings.length} PROPERTIES
            </span>
            {loading && <span style={{ fontSize: 8, color: T.cyan, ...mono }}>LOADING…</span>}
            {!loading && isLive && (
              <span style={{ fontSize: 7, fontWeight: 700, color: T.green, background: T.green + '18', padding: '1px 5px', borderRadius: 2, ...mono }}>LIVE</span>
            )}
          </div>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>PROPERTY COMPETITIVE SCORE · RANKED</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '10px 14px', flexWrap: 'wrap' }}>
          {([
            { label: 'CLASS',   value: classFilter,   setter: setClassFilter,   options: CLASS_OPTIONS,   fmt: (o: string) => o === 'All' ? 'ALL CLASSES' : `CLASS ${o}` },
            { label: 'VINTAGE', value: vintageFilter,  setter: setVintageFilter, options: VINTAGE_OPTIONS, fmt: (o: string) => o === 'All' ? 'ALL VINTAGES' : o },
            { label: 'SIZE',    value: sizeFilter,     setter: setSizeFilter,    options: SIZE_OPTIONS,    fmt: (o: string) => o === 'All' ? 'ALL SIZES' : `${o} UNITS` },
          ] as const).map(f => (
            <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 2, ...mono }}>{f.label}</span>
              <select value={f.value} onChange={e => (f.setter as (v: string) => void)(e.target.value)} style={selectStyle}>
                {f.options.map((o: string) => <option key={o} value={o}>{f.fmt(o)}</option>)}
              </select>
            </div>
          ))}
          {(classFilter !== 'All' || vintageFilter !== 'All' || sizeFilter !== 'All') && (
            <button
              onClick={() => { setClassFilter('All'); setVintageFilter('All'); setSizeFilter('All'); }}
              style={{ fontSize: 9, color: T.amber, background: 'none', border: `1px solid ${T.amber}40`, borderRadius: 2, padding: '4px 10px', cursor: 'pointer', ...mono, alignSelf: 'flex-end' }}
            >
              CLEAR FILTERS
            </button>
          )}
        </div>
      </div>

      {/* ── SECTION 2: RANKINGS TABLE ── */}
      <div style={sectionCard}>
        <div style={sectionHeader(T.cyan)}>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.cyan, letterSpacing: 2, ...mono }}>RANKINGS TABLE</span>
          <span style={{ fontSize: 9, color: T.muted, ...mono }}>CLICK ROW → PCS BREAKDOWN</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 48, textAlign: 'center' }} onClick={() => handleSort('rank')}>RNK {sortArrow('rank')}</th>
                <th style={{ ...thStyle, width: 44, textAlign: 'center' }}>MVT</th>
                <th style={{ ...thStyle, minWidth: 160 }} onClick={() => handleSort('name')}>PROPERTY {sortArrow('name')}</th>
                <th style={{ ...thStyle, width: 48, textAlign: 'center' }}>CLS</th>
                <th style={{ ...thStyle, width: 64, textAlign: 'center' }} onClick={() => handleSort('units')}>UNITS {sortArrow('units')}</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'center' }}>SUBMARKET</th>
                <th style={{ ...thStyle, width: 80, textAlign: 'center' }} onClick={() => handleSort('pcsScore')}>PCS {sortArrow('pcsScore')}</th>
                <th style={{ ...thStyle, width: 80, textAlign: 'center' }}>TREND</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((property, idx) => {
                const isExpanded = expandedRow === property.id;
                const trendColor = property.movement > 0 ? T.green : property.movement < 0 ? T.red : T.muted;
                const rowBg = isExpanded ? T.cyan + '0A' : idx % 2 === 0 ? T.panel : T.bg;
                const idNum = typeof property.id === 'number' ? property.id : (property.units * 7 + property.yearBuilt) % 100;
                const pts = [
                  property.pcsScore - 4 + Math.round(Math.sin(idNum) * 3),
                  property.pcsScore - 3 + Math.round(Math.cos(idNum * 2) * 2),
                  property.pcsScore - 2 + Math.round(Math.sin(idNum * 3) * 2),
                  property.pcsScore - 1,
                  property.pcsScore + property.movement * 0.3,
                  property.pcsScore,
                ];
                const min = Math.min(...pts) - 2, max = Math.max(...pts) + 2, range = max - min || 1;
                const sparkPoints = pts.map((v, i) => `${(i / (pts.length - 1)) * 76 + 2},${22 - ((v - min) / range) * 18}`).join(' ');

                return (
                  <React.Fragment key={property.id}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : property.id)}
                      style={{ background: rowBg, borderBottom: `1px solid ${T.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                    >
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: property.rank <= 3 ? T.amber : T.secondary, ...mono }}>#{property.rank}</span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        {property.movement > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, ...mono }}>▲{property.movement}</span>
                        )}
                        {property.movement < 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.red, ...mono }}>▼{Math.abs(property.movement)}</span>
                        )}
                        {property.movement === 0 && (
                          <span style={{ fontSize: 10, color: T.muted, ...mono }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <button style={{ fontSize: 11, fontWeight: 600, color: T.cyan, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationStyle: 'dotted', padding: 0, ...mono }}>
                            {property.name}
                          </button>
                          <span style={{ fontSize: 9, color: T.muted, ...mono }}>
                            {property.yearBuilt > 0 ? property.yearBuilt : 'N/A'}
                            {property.owner && <> · {property.owner.length > 28 ? property.owner.slice(0, 26) + '…' : property.owner}</>}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: classColor(property.class), background: classColor(property.class) + '18', padding: '1px 5px', borderRadius: 2, ...mono }}>
                          {property.class}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 11, color: T.secondary, ...mono }}>
                        {property.units.toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: 9, color: T.secondary, ...mono }}>
                        {property.submarket}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: pcsColor(property.pcsScore), ...mono }}>
                          {property.pcsScore}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <svg viewBox="0 0 80 24" style={{ height: '20px', width: 'auto', display: 'block', margin: '0 auto' }}>
                          <polyline points={sparkPoints} fill="none" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ background: T.dimBg, borderLeft: `3px solid ${T.cyan}`, padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: T.cyan, letterSpacing: 1, ...mono }}>PCS BREAKDOWN · </span>
                                <span style={{ fontSize: 10, color: T.text, ...mono }}>{property.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 18, fontWeight: 800, color: pcsColor(property.pcsScore), ...mono }}>{property.pcsScore}</span>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    const propertyId = `P-${marketId.toUpperCase()}-${String(property.id).padStart(5, '0')}`;
                                    navigate(`/market-intelligence/property/${propertyId}`, {
                                      state: { from: 'Power Rankings', propertyRow: { id: property.id, property: property.name, address: property.address || '', submarket: property.submarket, units: property.units, year: property.yearBuilt, class: property.class, owner: property.owner || '', jedi: property.pcsScore } }
                                    });
                                  }}
                                  style={{ fontSize: 9, fontWeight: 700, color: T.amber, background: T.amber + '15', border: `1px solid ${T.amber}50`, borderRadius: 2, padding: '4px 10px', cursor: 'pointer', letterSpacing: 1, ...mono }}
                                >
                                  VIEW PROPERTY →
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); setExpandedRow(null); }}
                                  style={{ fontSize: 9, color: T.secondary, background: 'none', border: 'none', cursor: 'pointer', ...mono }}
                                >
                                  CLOSE ×
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {COMPONENT_LABELS.map(comp => {
                                const value = property.components[comp.key];
                                return (
                                  <div key={comp.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ width: 140, fontSize: 9, color: T.secondary, flexShrink: 0, ...mono }}>{comp.label.toUpperCase()}</span>
                                    <div style={{ flex: 1, background: T.bg, borderRadius: 2, height: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                                      <div style={{ height: '100%', width: `${value}%`, background: comp.color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                                    </div>
                                    <span style={{ width: 28, textAlign: 'right', fontSize: 10, fontWeight: 700, color: comp.color, ...mono }}>{value}</span>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                              {[
                                { label: 'CLASS',     value: property.class },
                                { label: 'UNITS',     value: property.units.toLocaleString() },
                                { label: 'YEAR',      value: property.yearBuilt || 'N/A' },
                                { label: 'SUBMARKET', value: property.submarket },
                                ...(property.owner ? [{ label: 'OWNER', value: property.owner }] : []),
                              ].map(item => (
                                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <span style={{ fontSize: 7, color: T.muted, letterSpacing: 1.5, ...mono }}>{item.label}</span>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: T.text, ...mono }}>{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: T.muted, fontSize: 11, ...mono }}>
                    NO PROPERTIES MATCH THE ACTIVE FILTERS
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: TOP MOVERS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {([
          { title: 'TOP RISERS',  color: T.green,  items: topMovers.risers,  sign: '▲', key: 'rise' },
          { title: 'TOP FALLERS', color: T.red,    items: topMovers.fallers, sign: '▼', key: 'fall' },
        ] as const).map(panel => (
          <div key={panel.key} style={sectionCard}>
            <div style={sectionHeader(panel.color)}>
              <span style={{ fontSize: 10, fontWeight: 700, color: panel.color, letterSpacing: 2, ...mono }}>{panel.title}</span>
              <span style={{ fontSize: 9, color: T.muted, ...mono }}>WoW RANK MOVEMENT</span>
            </div>
            <div style={{ padding: '6px 0' }}>
              {panel.items.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: 10, color: T.muted, textAlign: 'center', ...mono }}>NO MOVEMENT</div>
              ) : (
                panel.items.map((p, i) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderBottom: i < panel.items.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                    <span style={{ fontSize: 9, color: T.muted, width: 16, textAlign: 'right', flexShrink: 0, ...mono }}>#{p.rank}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.text, flex: 1, ...mono }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: panel.color, ...mono }}>{panel.sign}{Math.abs(p.movement)}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pcsColor(p.pcsScore), ...mono }}>{p.pcsScore}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 4: AI VERDICT ── */}
      <div style={{ ...sectionCard, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, background: T.amber + '08', borderColor: T.amber + '30' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: T.amber + '20', border: `1px solid ${T.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: T.amber, ...mono }}>AI</span>
        </div>
        <div>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, letterSpacing: 1, ...mono }}>AI VERDICT · </span>
          <span style={{ fontSize: 10, color: T.text }}>
            <span style={{ fontWeight: 700, color: T.amber }}>The Vue at Midtown</span> leads on traffic-revenue coherence — highest upward mobility.{' '}
            <span style={{ fontWeight: 700, color: T.cyan }}>Buckhead Grand</span> dominates asset quality but shows softer operational metrics.{' '}
            <span style={{ fontWeight: 700, color: T.green }}>Decatur Station</span> is the stealth mover — +4 ranks driven by traffic signal rerating.
          </span>
        </div>
      </div>

    </div>
  );
};

export default PowerRankingsTab;
