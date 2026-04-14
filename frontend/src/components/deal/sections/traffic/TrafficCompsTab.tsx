import { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, Download, Building2, AlertCircle, CheckCircle2, Database, Filter } from 'lucide-react';
import { apiClient } from '@/services/api.client';
import { BT } from '../../bloomberg-ui';

const MONO = BT.font.mono;

interface CompProperty {
  property_id: string;
  property_name: string;
  property_address: string;
  units: number;
  occupancy_pct: number;
  weekly_traffic: number;
  weekly_tours: number;
  closing_ratio: number;
  net_leases_per_week: number;
  web_sessions: number;
  visibility_score: number;
  adt: number;
  distance_miles: number;
  data_sources: string[];
  is_subject: boolean;
}

interface CompAverages {
  avg_units: number;
  avg_occupancy_pct?: number;
  avg_occupancy?: number;
  avg_weekly_traffic?: number;
  avg_traffic?: number;
  avg_weekly_tours?: number;
  avg_tours?: number;
  avg_closing_ratio: number;
  avg_net_leases_per_week?: number;
  avg_net_leases?: number;
  avg_web_sessions: number;
  avg_visibility_score?: number;
  avg_visibility?: number;
  avg_adt: number;
}

interface DealWithData {
  deal_id: string;
  deal_name: string;
  address: string;
  total_units: number;
  snapshot_count: number;
  earliest_week: string;
  latest_week: string;
  avg_traffic: number;
  avg_tours: number;
  avg_closing_ratio: number;
  avg_occ_pct: number;
  is_selected: boolean;
}

interface TrafficCompsTabProps {
  dealId: string;
  onSelectionChange?: () => void;
}

const SOURCE_CFG: Record<string, { label: string; color: string }> = {
  ga:                 { label: 'GA',     color: BT.met.digTraffic },
  google_analytics:   { label: 'GA',     color: BT.met.digTraffic },
  predictions:        { label: 'PRED',   color: BT.met.physTraffic },
  apartment_locator:  { label: 'AL',     color: BT.text.purple },
  uploaded:           { label: 'UPLOAD', color: BT.text.amber },
  visibility:         { label: 'VIS',    color: BT.text.green },
  dot_adt:            { label: 'DOT',    color: BT.text.cyan },
  adt:                { label: 'DOT',    color: BT.text.cyan },
  estimate:           { label: 'EST',    color: BT.text.muted },
};

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CFG[source] || SOURCE_CFG.estimate;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, fontWeight: 700, color: cfg.color,
      background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`,
      padding: '1px 4px', letterSpacing: 0.5,
      whiteSpace: 'nowrap' as const,
    }}>
      {cfg.label}
    </span>
  );
}

function fmtWeekRange(earliest: string, latest: string) {
  const fmt = (d: string) => {
    if (!d) return '–';
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  return `${fmt(earliest)} → ${fmt(latest)}`;
}

function ColHeader({ field, label, sortBy, sortDir, onSort }: {
  field: string; label: string; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (f: string) => void;
}) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '4px 8px', textAlign: 'right', cursor: 'pointer',
        background: active ? BT.bg.active : BT.bg.header,
        color: active ? BT.text.amber : BT.text.muted,
        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
        borderBottom: `1px solid ${BT.border.medium}`,
        userSelect: 'none' as const,
        whiteSpace: 'nowrap' as const,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active && <ArrowUpDown size={9} style={{ color: BT.text.amber }} />}
      </span>
    </th>
  );
}

export default function TrafficCompsTab({ dealId, onSelectionChange }: TrafficCompsTabProps) {
  const [comps, setComps] = useState<CompProperty[]>([]);
  const [averages, setAverages] = useState<CompAverages | null>(null);
  const [dealsWithData, setDealsWithData] = useState<DealWithData[]>([]);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('distance_miles');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState({ minUnits: '', maxUnits: '', minOccupancy: '', maxDistance: '' });

  const loadData = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const [compsRes, avgRes, dealsRes] = await Promise.all([
        apiClient.get(`/api/v1/traffic-comps/${dealId}`, {
          params: {
            sortBy, sortDir,
            minUnits: filters.minUnits || undefined,
            maxUnits: filters.maxUnits || undefined,
            minOccupancy: filters.minOccupancy || undefined,
            maxDistance: filters.maxDistance || undefined,
          },
        }),
        apiClient.get(`/api/v1/traffic-comps/${dealId}/averages`),
        apiClient.get(`/api/v1/traffic-comps/${dealId}/deals-with-data`),
      ]);
      setComps(compsRes.data.comps || []);
      setAverages(avgRes.data.averages || null);
      const deals: DealWithData[] = dealsRes.data.deals || [];
      setDealsWithData(deals);
      setSelectedDealIds(new Set(deals.filter(d => d.is_selected).map(d => d.deal_id)));
    } catch (err) {
      console.error('[Comps] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [dealId, sortBy, sortDir, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleDealSelection = async (deal: DealWithData) => {
    const next = new Set(selectedDealIds);
    next.has(deal.deal_id) ? next.delete(deal.deal_id) : next.add(deal.deal_id);
    setSelectedDealIds(next);
    setSavingSelection(true);
    try {
      const selections = Array.from(next).map(id => {
        const d = dealsWithData.find(x => x.deal_id === id);
        return { comp_deal_id: id, comp_deal_name: d?.deal_name };
      });
      await apiClient.put(`/api/v1/traffic-comps/${dealId}/selections`, { selections });
      onSelectionChange?.();
    } catch (err) {
      console.error('[Comps] Selection save failed:', err);
      setSelectedDealIds(selectedDealIds);
    } finally {
      setSavingSelection(false);
    }
  };

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const exportCSV = () => {
    const headers = ['Property', 'Units', 'Occ %', 'Traffic/Wk', 'Tours/Wk', 'Close %', 'Net/Wk', 'Web Sessions', 'Vis', 'ADT', 'Dist'];
    const rows = comps.map(c => [
      c.property_name, c.units, (c.occupancy_pct * 100).toFixed(1),
      c.weekly_traffic, c.weekly_tours, (c.closing_ratio * 100).toFixed(1),
      c.net_leases_per_week.toFixed(1), c.web_sessions, c.visibility_score,
      c.adt, c.distance_miles.toFixed(1),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comp-grid-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const avgOcc = averages?.avg_occupancy ?? averages?.avg_occupancy_pct ?? 0;
  const avgTraffic = averages?.avg_weekly_traffic ?? averages?.avg_traffic ?? 0;
  const avgTours = averages?.avg_weekly_tours ?? averages?.avg_tours ?? 0;
  const avgNetLeases = averages?.avg_net_leases_per_week ?? averages?.avg_net_leases ?? 0;
  const avgVis = averages?.avg_visibility_score ?? averages?.avg_visibility ?? 0;
  const selectedCount = selectedDealIds.size;

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: BT.bg.terminal }}>
        <div style={{ width: 28, height: 28, border: `2px solid ${BT.text.amber}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 11, color: BT.text.muted, fontFamily: MONO }}>LOADING COMP TRAFFIC DATA...</p>
      </div>
    );
  }

  const thStyle: React.CSSProperties = {
    padding: '4px 8px', textAlign: 'left', background: BT.bg.header,
    color: BT.text.muted, fontFamily: MONO, fontSize: 9, fontWeight: 700,
    letterSpacing: 0.8, borderBottom: `1px solid ${BT.border.medium}`,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ background: BT.bg.terminal, display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* ── SECTION 1: Regional Pattern Sources ── */}
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{
          padding: '6px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Database size={11} color={BT.met.compTraffic} />
          <span style={{ fontSize: 9, color: BT.text.white, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8 }}>
            REGIONAL PATTERN SOURCES
          </span>
          {selectedCount > 0 && (
            <span style={{ fontSize: 9, color: BT.text.green, fontFamily: MONO, background: `${BT.text.green}15`, border: `1px solid ${BT.text.green}40`, padding: '1px 6px' }}>
              {selectedCount} ACTIVE
            </span>
          )}
          {savingSelection && (
            <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>SAVING...</span>
          )}
          <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginLeft: 'auto' }}>
            Check deals to use their historical patterns as the projection baseline
          </span>
        </div>

        {dealsWithData.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Building2 size={24} style={{ color: BT.text.muted, margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 4 }}>NO DEALS WITH TRAFFIC HISTORY FOUND</p>
            <p style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>Upload weekly reports for comparable deals to enable comp-calibrated projections.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 32 }} />
                  <th style={{ ...thStyle }}>DEAL / PROPERTY</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>UNITS</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>DATA RANGE</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>WKS</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AVG TRAFFIC/WK</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AVG TOURS/WK</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AVG CLOSE %</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>AVG OCC %</th>
                </tr>
              </thead>
              <tbody>
                {dealsWithData.map((deal, i) => {
                  const isSelected = selectedDealIds.has(deal.deal_id);
                  const bg = isSelected
                    ? `${BT.text.green}0d`
                    : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt;
                  const borderColor = isSelected ? `${BT.text.green}30` : BT.border.subtle;
                  return (
                    <tr
                      key={deal.deal_id}
                      onClick={() => toggleDealSelection(deal)}
                      style={{ background: bg, borderBottom: `1px solid ${borderColor}`, cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = isSelected ? `${BT.text.green}18` : BT.bg.hover)}
                      onMouseLeave={e => (e.currentTarget.style.background = bg)}
                    >
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{
                          width: 14, height: 14, border: `1px solid ${isSelected ? BT.text.green : BT.border.bright}`,
                          background: isSelected ? BT.text.green : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <span style={{ color: BT.bg.terminal, fontSize: 10, fontWeight: 900 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: isSelected ? BT.text.green : BT.text.primary, fontFamily: MONO }}>{deal.deal_name}</div>
                        {deal.address && <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>{deal.address.substring(0, 40)}</div>}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{deal.total_units || '–'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>{fmtWeekRange(deal.earliest_week, deal.latest_week)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{deal.snapshot_count}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.amber }}>{deal.avg_traffic.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.amber }}>{deal.avg_tours.toFixed(1)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{deal.avg_closing_ratio ? `${(deal.avg_closing_ratio * 100).toFixed(1)}%` : '–'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.secondary }}>{deal.avg_occ_pct ? `${(deal.avg_occ_pct * 100).toFixed(1)}%` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedCount > 0 && (
          <div style={{ padding: '6px 12px', background: `${BT.text.green}0a`, borderTop: `1px solid ${BT.text.green}30`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={11} color={BT.text.green} />
            <span style={{ fontSize: 9, color: BT.text.green, fontFamily: MONO }}>
              PROJECTION BASELINE CALIBRATED FROM {selectedCount} COMP DEAL{selectedCount !== 1 ? 'S' : ''} — traffic, seasonal patterns, and trend rates derived and scaled to this deal's unit count.
            </span>
          </div>
        )}
      </div>

      {/* ── SECTION 2: Trade Area Comp Grid ── */}
      <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
        <div style={{
          padding: '6px 12px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Building2 size={11} color={BT.met.physTraffic} />
          <span style={{ fontSize: 9, color: BT.text.white, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.8 }}>
            TRADE AREA COMP GRID
          </span>
          {comps.length > 0 && (
            <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>
              {comps.length} PROPERTIES
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                background: showFilters ? BT.bg.active : 'transparent',
                border: `1px solid ${BT.border.medium}`,
                color: showFilters ? BT.text.amber : BT.text.muted,
                cursor: 'pointer', padding: '2px 8px', fontFamily: MONO, fontSize: 9,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Filter size={9} /> FILTERS
            </button>
            {comps.length > 0 && (
              <button
                onClick={exportCSV}
                style={{
                  background: 'transparent', border: `1px solid ${BT.border.medium}`,
                  color: BT.text.muted, cursor: 'pointer', padding: '2px 8px',
                  fontFamily: MONO, fontSize: 9, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Download size={9} /> EXPORT
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div style={{
            padding: '8px 12px', background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
          }}>
            {[
              { label: 'MIN UNITS', key: 'minUnits', placeholder: '0' },
              { label: 'MAX UNITS', key: 'maxUnits', placeholder: '500' },
              { label: 'MIN OCC %', key: 'minOccupancy', placeholder: '0' },
              { label: 'MAX DIST (mi)', key: 'maxDistance', placeholder: '5' },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.8, marginBottom: 3 }}>{f.label}</div>
                <input
                  type="number"
                  value={(filters as any)[f.key]}
                  onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', background: BT.bg.input, border: `1px solid ${BT.border.medium}`,
                    color: BT.text.white, fontFamily: MONO, fontSize: 10, padding: '3px 6px',
                    outline: 'none', boxSizing: 'border-box' as const, colorScheme: 'dark',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {comps.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <AlertCircle size={24} style={{ color: BT.text.muted, margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO, marginBottom: 4 }}>NO TRADE AREA COMP DATA</p>
            <p style={{ fontSize: 9, color: BT.text.secondary, fontFamily: MONO }}>Use the snapshot action to pull traffic data for nearby properties.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{
                    ...thStyle, position: 'sticky', left: 0, zIndex: 10,
                    minWidth: 160, textAlign: 'left',
                  }}>PROPERTY</th>
                  <ColHeader field="units" label="UNITS" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="occupancy_pct" label="OCC %" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="weekly_traffic" label="TRAFFIC/WK" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="weekly_tours" label="TOURS/WK" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="closing_ratio" label="CLOSE %" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="net_leases_per_week" label="NET/WK" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="web_sessions" label="WEB" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="visibility_score" label="VIS" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="adt" label="ADT" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ColHeader field="distance_miles" label="DIST" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th style={{ ...thStyle, textAlign: 'right' }}>SOURCES</th>
                </tr>
              </thead>
              <tbody>
                {comps.map((comp, i) => {
                  const isSubject = comp.is_subject;
                  const bg = isSubject
                    ? `${BT.text.amber}0d`
                    : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt;
                  const tdStyle: React.CSSProperties = {
                    padding: '4px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10,
                    color: isSubject ? BT.text.amberBright : BT.text.secondary,
                    borderBottom: `1px solid ${isSubject ? BT.text.amber + '30' : BT.border.subtle}`,
                  };
                  const visColor = comp.visibility_score >= 70 ? BT.text.green : comp.visibility_score >= 50 ? BT.text.amber : BT.text.red;

                  return (
                    <tr key={comp.property_id} style={{ background: bg }}>
                      <td style={{
                        padding: '5px 8px', position: 'sticky', left: 0, zIndex: 1,
                        background: bg,
                        borderBottom: `1px solid ${isSubject ? BT.text.amber + '30' : BT.border.subtle}`,
                        borderRight: `1px solid ${BT.border.subtle}`,
                      }}>
                        <div style={{ fontSize: 10, fontWeight: isSubject ? 700 : 400, color: isSubject ? BT.text.amberBright : BT.text.primary, fontFamily: MONO, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {comp.property_name}
                        </div>
                        {isSubject && (
                          <span style={{ fontSize: 8, color: BT.text.amber, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.5 }}>SUBJECT</span>
                        )}
                      </td>
                      <td style={tdStyle}>{comp.units || '–'}</td>
                      <td style={tdStyle}>{comp.occupancy_pct ? `${(comp.occupancy_pct * 100).toFixed(1)}%` : '–'}</td>
                      <td style={{ ...tdStyle, color: isSubject ? BT.text.amberBright : BT.text.amber }}>{comp.weekly_traffic || '–'}</td>
                      <td style={tdStyle}>{comp.weekly_tours || '–'}</td>
                      <td style={tdStyle}>{comp.closing_ratio ? `${(comp.closing_ratio * 100).toFixed(1)}%` : '–'}</td>
                      <td style={tdStyle}>{comp.net_leases_per_week ? comp.net_leases_per_week.toFixed(1) : '–'}</td>
                      <td style={tdStyle}>{comp.web_sessions ? comp.web_sessions.toLocaleString() : '–'}</td>
                      <td style={{ ...tdStyle, color: comp.visibility_score ? visColor : BT.text.muted }}>
                        {comp.visibility_score || '–'}
                      </td>
                      <td style={tdStyle}>{comp.adt ? `${(comp.adt / 1000).toFixed(0)}K` : '–'}</td>
                      <td style={tdStyle}>{comp.distance_miles ? `${comp.distance_miles.toFixed(1)}mi` : '–'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {(comp.data_sources || []).map((s, j) => <SourceBadge key={j} source={s} />)}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Averages footer */}
                {averages && (
                  <tr style={{ background: BT.bg.active, borderTop: `2px solid ${BT.border.bright}` }}>
                    <td style={{
                      padding: '5px 8px', position: 'sticky', left: 0, zIndex: 1,
                      background: BT.bg.active, borderTop: `2px solid ${BT.border.bright}`,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, fontFamily: MONO, letterSpacing: 0.5 }}>TRADE AREA AVG</span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{averages.avg_units ? Math.round(averages.avg_units) : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{avgOcc ? `${(avgOcc * 100).toFixed(1)}%` : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.amber, fontWeight: 700 }}>{avgTraffic ? Math.round(avgTraffic) : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{avgTours ? Math.round(avgTours) : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{averages.avg_closing_ratio ? `${(averages.avg_closing_ratio * 100).toFixed(1)}%` : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{avgNetLeases ? avgNetLeases.toFixed(1) : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{averages.avg_web_sessions ? averages.avg_web_sessions.toLocaleString() : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{avgVis ? Math.round(avgVis) : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.white }}>{averages.avg_adt ? `${(averages.avg_adt / 1000).toFixed(0)}K` : '–'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>—</td>
                    <td style={{ padding: '5px 8px' }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Source legend */}
      <div style={{ background: BT.bg.header, padding: '4px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {Object.entries(SOURCE_CFG).slice(0, 6).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, fontFamily: MONO, color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}33`, padding: '0 3px' }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginLeft: 'auto' }}>
          Click column headers to sort · Subject property shown in amber
        </span>
      </div>
    </div>
  );
}
