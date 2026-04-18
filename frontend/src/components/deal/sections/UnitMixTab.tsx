import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, Activity, TrendingUp, TrendingDown, Minus, Info, Zap, Edit3, Check, X } from 'lucide-react';
import { BT } from '../bloomberg-ui';
import { apiClient } from '../../../services/api.client';
import { useDealType } from '../../../stores/dealStore';

const MONO = BT.font.mono;
const LABEL = BT.font.label;
const C = {
  bg:       '#080c12',
  panel:    '#0d1520',
  panelAlt: '#0a1018',
  border:   '#1a2535',
  borderHi: '#1e3a5f',
  cyan:     '#00d4ff',
  cyanDim:  '#0a3040',
  amber:    '#f59e0b',
  amberDim: '#2a1a00',
  green:    '#22c55e',
  greenDim: '#0a2010',
  red:      '#ef4444',
  redDim:   '#2a0808',
  purple:   '#a78bfa',
  text:     '#e2e8f0',
  muted:    '#64748b',
  dim:      '#334155',
};

interface RentRollUnitType {
  type: string;
  count: number;
  avgSf: number | null;
  inPlaceRent: number | null;
  marketRent: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
}

interface LeasingSignals {
  t01WeeklyTours: number | null;
  t05ClosingRatio: number | null;
  t06WeeklyLeases: number | null;
  t07LeaseUpWeeksTo95: number | null;
}

interface TrafficProjection {
  leasingSignals: LeasingSignals | null;
  leasingVelocity?: { weeklyLeases: number; annualized: number; confidence: number } | null;
  calibrated?: { vacancyPct: number | null; exitCap: number | null } | null;
  avgLeaseTermYears?: number | null;
}

interface DealFinancials {
  totalUnits: number;
  rentRollSummary: {
    unitMix: RentRollUnitType[] | null;
    avgInPlaceRent: number | null;
    weightedOccupancyPct: number | null;
  } | null;
  trafficProjection: TrafficProjection | null;
}

const fmt$ = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString()}`;
const fmtPct = (v: number | null | undefined, decimals = 1) =>
  v == null ? '—' : `${(v * 100).toFixed(decimals)}%`;
const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : Math.round(v).toLocaleString();

function th(label: string, right = false): React.CSSProperties {
  return {
    padding: '5px 8px',
    fontFamily: LABEL,
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    letterSpacing: '0.06em',
  };
}

function td(right = false, bold = false, color?: string): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontFamily: MONO,
    fontSize: 10,
    color: color ?? C.text,
    fontWeight: bold ? 700 : 400,
    textAlign: right ? 'right' : 'left',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };
}

function MetricPill({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', minWidth: 110 }}>
      <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: color ?? C.cyan }}>{value}</div>
      {sub && <div style={{ fontFamily: LABEL, fontSize: 8, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function TrafficSignal({ label, value, unit, linked }: { label: string; value: string; unit: string; linked: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {linked
          ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 6px ${C.cyan}` }} />
          : <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.muted }} />
        }
        <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: linked ? C.cyan : C.dim }}>{value}</span>
        <span style={{ fontFamily: LABEL, fontSize: 8, color: C.muted }}>{unit}</span>
      </div>
    </div>
  );
}

export function UnitMixTab({ dealId, deal }: { dealId: string; deal?: any }) {
  const dealType = useDealType();
  const [data, setData] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRent, setEditingRent] = useState<{ idx: number; field: 'inPlace' | 'market'; val: string } | null>(null);
  const [rentOverrides, setRentOverrides] = useState<Record<string, { inPlace?: number; market?: number }>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: DealFinancials }>(`/api/v1/deals/${dealId}/financials`);
      if (res.data.success) setData(res.data.data);
      else setError('Failed to load unit mix data');
    } catch (e: any) {
      setError(e?.message ?? 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const unitMix = data?.rentRollSummary?.unitMix ?? [];
  const totalUnits = data?.totalUnits ?? 0;
  const ls = data?.trafficProjection?.leasingSignals;
  const hasTraffic = ls != null && (ls.t06WeeklyLeases != null || ls.t07LeaseUpWeeksTo95 != null);
  const lv = data?.trafficProjection?.leasingVelocity;

  const getEffectiveRent = (u: RentRollUnitType, idx: number) =>
    rentOverrides[u.type]?.inPlace ?? u.inPlaceRent;
  const getMarketRent = (u: RentRollUnitType, idx: number) =>
    rentOverrides[u.type]?.market ?? u.marketRent;

  const totalGprAnnual = unitMix.reduce((s, u) => {
    const r = getEffectiveRent(u, 0) ?? 0;
    return s + u.count * r * 12;
  }, 0);

  const totalMarketGprAnnual = unitMix.reduce((s, u) => {
    const r = getMarketRent(u, 0) ?? 0;
    return s + u.count * r * 12;
  }, 0);

  const totalLtl = totalMarketGprAnnual - totalGprAnnual;

  const weightedOcc = unitMix.length > 0
    ? unitMix.reduce((s, u) => s + (u.occupancyPct ?? 0) * u.count, 0) / totalUnits
    : (data?.rentRollSummary?.weightedOccupancyPct ?? null);

  const physicalVacancy = weightedOcc != null ? 1 - weightedOcc : null;

  const leaseUpWeeks = ls?.t07LeaseUpWeeksTo95;
  const weeklyLeases = ls?.t06WeeklyLeases ?? lv?.weeklyLeases;

  const currentOcc = weightedOcc ?? 0;
  const vacantUnits = Math.round((1 - currentOcc) * totalUnits);
  const leaseUpMonths = leaseUpWeeks != null ? +(leaseUpWeeks / 4.33).toFixed(1) : null;

  const stabilizedVac = data?.trafficProjection?.calibrated?.vacancyPct ?? 0.05;

  const isExisting = dealType === 'existing';
  const isValueAdd = dealType === 'redevelopment' || dealType === 'value-add';
  const isDeveopment = dealType === 'development';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, background: C.bg }}>
        <Loader2 size={20} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontFamily: LABEL, fontSize: 11, color: C.muted, marginLeft: 10 }}>Loading unit mix...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: C.red, fontFamily: LABEL, fontSize: 11 }}>{error}</div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100%', overflowY: 'auto' }}>

      {/* ── Header bar ── */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: LABEL, fontSize: 10, fontWeight: 700, color: C.cyan, letterSpacing: '0.1em' }}>F13 · UNIT MIX</span>
          <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted, marginLeft: 12 }}>
            {isDeveopment ? 'Target program · absorption model' : isValueAdd ? 'In-place · renovation upside · absorption' : 'In-place rents · floor plan economics · absorption link'}
          </span>
        </div>
        <button
          onClick={load}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontFamily: LABEL, fontSize: 9 }}
        >
          <RefreshCw size={11} /> REFRESH
        </button>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
        <MetricPill label="TOTAL UNITS" value={totalUnits > 0 ? totalUnits.toLocaleString() : '—'} color={C.cyan} sub={`${unitMix.length} floor plan types`} />
        <MetricPill label="IN-PLACE GPR" value={totalGprAnnual > 0 ? fmt$(totalGprAnnual) : '—'} color={C.green} sub="annualized · feeds ProForma" />
        {totalMarketGprAnnual > 0 && <MetricPill label="MARKET GPR" value={fmt$(totalMarketGprAnnual)} color={C.amber} sub="at full market rents" />}
        {totalLtl > 0 && <MetricPill label="LOSS-TO-LEASE" value={fmt$(totalLtl)} color={C.red} sub={fmtPct(totalMarketGprAnnual > 0 ? totalLtl / totalMarketGprAnnual : null) + ' of mkt GPR'} />}
        <MetricPill label="OCCUPANCY" value={fmtPct(weightedOcc)} color={weightedOcc != null && weightedOcc >= 0.90 ? C.green : weightedOcc != null && weightedOcc >= 0.80 ? C.amber : C.red} sub={vacantUnits > 0 ? `${vacantUnits} vacant units` : undefined} />
        <MetricPill
          label="LEASING VELOCITY"
          value={weeklyLeases != null ? `${weeklyLeases.toFixed(1)}/wk` : '—'}
          color={hasTraffic ? C.cyan : C.dim}
          sub={hasTraffic ? 'M07 TRAFFIC ENGINE' : 'no traffic data'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 1, padding: '0 20px 20px' }}>

        {/* ── LEFT: floor plan table ── */}
        <div>
          {/* GPR Feed Banner */}
          <div style={{ background: C.greenDim, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '8px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={13} color={C.green} />
            <span style={{ fontFamily: LABEL, fontSize: 9, color: C.green }}>
              THIS TABLE IS THE SINGLE SOURCE OF TRUTH FOR PROFORMA GPR — edits here propagate to the Financial Engine (F9)
            </span>
          </div>

          {unitMix.length === 0 ? (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 32, textAlign: 'center' }}>
              <div style={{ fontFamily: LABEL, fontSize: 10, color: C.muted, marginBottom: 6 }}>NO UNIT MIX DATA</div>
              <div style={{ fontFamily: LABEL, fontSize: 9, color: C.dim }}>Upload and process a rent roll document to populate unit mix</div>
            </div>
          ) : (
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>FLOOR PLAN BREAKDOWN</span>
                {isValueAdd && (
                  <span style={{ fontFamily: LABEL, fontSize: 8, color: C.purple, background: '#2a1a3a', border: `1px solid ${C.purple}44`, borderRadius: 3, padding: '2px 6px' }}>
                    VALUE-ADD · EDIT STABILIZED RENTS
                  </span>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panelAlt }}>
                      <th style={th('TYPE')}>TYPE</th>
                      <th style={th('', true)}>UNITS</th>
                      <th style={th('', true)}>MIX %</th>
                      <th style={th('', true)}>AVG SF</th>
                      <th style={th('', true)}>IN-PLACE RENT</th>
                      <th style={th('', true)}>MARKET RENT</th>
                      <th style={th('', true)}>L-T-L</th>
                      <th style={th('', true)}>OCC %</th>
                      <th style={th('', true)}>ANNUAL GPR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitMix.map((u, idx) => {
                      const effRent = getEffectiveRent(u, idx);
                      const mktRent = getMarketRent(u, idx);
                      const ltlAmt = mktRent != null && effRent != null ? mktRent - effRent : null;
                      const ltlPct = mktRent != null && ltlAmt != null && mktRent > 0 ? ltlAmt / mktRent : null;
                      const gpr = effRent != null ? u.count * effRent * 12 : null;
                      const mixPct = totalUnits > 0 ? u.count / totalUnits : 0;
                      const occ = u.occupancyPct;
                      const isEditing = editingRent?.idx === idx;

                      return (
                        <tr key={u.type} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                          <td style={{ ...td(), fontWeight: 700, color: C.cyan }}>{u.type}</td>
                          <td style={td(true)}>{u.count}</td>
                          <td style={td(true, false, C.muted)}>{(mixPct * 100).toFixed(1)}%</td>
                          <td style={td(true, false, C.muted)}>{u.avgSf != null ? `${u.avgSf.toLocaleString()}` : '—'}</td>

                          {/* In-place rent — editable */}
                          <td style={{ ...td(true), position: 'relative' }}>
                            {isEditing && editingRent.field === 'inPlace' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  autoFocus
                                  type="number"
                                  value={editingRent.val}
                                  onChange={e => setEditingRent({ ...editingRent, val: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setRentOverrides(prev => ({ ...prev, [u.type]: { ...(prev[u.type] ?? {}), inPlace: +editingRent.val } }));
                                      setEditingRent(null);
                                    } else if (e.key === 'Escape') setEditingRent(null);
                                  }}
                                  style={{ width: 72, background: C.panelAlt, border: `1px solid ${C.cyan}`, borderRadius: 3, color: C.cyan, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button onClick={() => { setRentOverrides(prev => ({ ...prev, [u.type]: { ...(prev[u.type] ?? {}), inPlace: +editingRent.val } })); setEditingRent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}><Check size={11} /></button>
                                <button onClick={() => setEditingRent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}><X size={11} /></button>
                              </div>
                            ) : (
                              <div
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer' }}
                                onClick={() => setEditingRent({ idx, field: 'inPlace', val: String(effRent ?? '') })}
                              >
                                <span style={{ color: rentOverrides[u.type]?.inPlace != null ? C.amber : C.text }}>{fmt$(effRent)}</span>
                                <Edit3 size={9} color={C.dim} />
                              </div>
                            )}
                          </td>

                          {/* Market rent — editable */}
                          <td style={{ ...td(true), position: 'relative' }}>
                            {isEditing && editingRent.field === 'market' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  autoFocus
                                  type="number"
                                  value={editingRent.val}
                                  onChange={e => setEditingRent({ ...editingRent, val: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      setRentOverrides(prev => ({ ...prev, [u.type]: { ...(prev[u.type] ?? {}), market: +editingRent.val } }));
                                      setEditingRent(null);
                                    } else if (e.key === 'Escape') setEditingRent(null);
                                  }}
                                  style={{ width: 72, background: C.panelAlt, border: `1px solid ${C.amber}`, borderRadius: 3, color: C.amber, fontFamily: MONO, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
                                />
                                <button onClick={() => { setRentOverrides(prev => ({ ...prev, [u.type]: { ...(prev[u.type] ?? {}), market: +editingRent.val } })); setEditingRent(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.green }}><Check size={11} /></button>
                                <button onClick={() => setEditingRent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.red }}><X size={11} /></button>
                              </div>
                            ) : (
                              <div
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, cursor: 'pointer' }}
                                onClick={() => setEditingRent({ idx, field: 'market', val: String(mktRent ?? '') })}
                              >
                                <span style={{ color: rentOverrides[u.type]?.market != null ? C.amber : mktRent != null ? C.text : C.dim }}>{fmt$(mktRent)}</span>
                                {mktRent == null && <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>ENTER</span>}
                                <Edit3 size={9} color={C.dim} />
                              </div>
                            )}
                          </td>

                          <td style={td(true, false, ltlAmt != null && ltlAmt > 0 ? C.red : C.muted)}>
                            {ltlAmt != null && ltlAmt > 0 ? `(${fmt$(ltlAmt)})` : '—'}
                            {ltlPct != null && ltlPct > 0 && (
                              <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim, marginLeft: 3 }}>{fmtPct(ltlPct)}</span>
                            )}
                          </td>
                          <td style={td(true, false, occ == null ? C.dim : occ >= 0.90 ? C.green : occ >= 0.80 ? C.amber : C.red)}>
                            {fmtPct(occ)}
                          </td>
                          <td style={td(true, false, C.green)}>{fmt$(gpr)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#050a0f', borderTop: `2px solid ${C.borderHi}` }}>
                      <td style={{ ...td(), fontWeight: 700, color: C.text }}>TOTALS / WTD AVG</td>
                      <td style={{ ...td(true), fontWeight: 700 }}>{totalUnits}</td>
                      <td style={{ ...td(true), color: C.muted }}>100%</td>
                      <td style={{ ...td(true), color: C.muted }}>
                        {totalUnits > 0 && unitMix.some(u => u.avgSf != null)
                          ? Math.round(unitMix.reduce((s, u) => s + (u.avgSf ?? 0) * u.count, 0) / totalUnits).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: C.text }}>
                        {totalUnits > 0 && totalGprAnnual > 0 ? fmt$(Math.round(totalGprAnnual / totalUnits / 12)) : '—'}/mo
                      </td>
                      <td style={{ ...td(true), color: C.muted }}>
                        {totalMarketGprAnnual > 0 && totalUnits > 0 ? fmt$(Math.round(totalMarketGprAnnual / totalUnits / 12)) : '—'}/mo
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: totalLtl > 0 ? C.red : C.muted }}>
                        {totalLtl > 0 ? `(${fmt$(totalLtl)})` : '—'}
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: weightedOcc != null && weightedOcc >= 0.90 ? C.green : weightedOcc != null && weightedOcc >= 0.80 ? C.amber : C.red }}>
                        {fmtPct(weightedOcc)}
                      </td>
                      <td style={{ ...td(true), fontWeight: 700, color: C.green }}>{fmt$(totalGprAnnual)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* GPR → ProForma link */}
              <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.green }}>ANNUAL GPR → FINANCIAL ENGINE (F9 PRO FORMA)</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.green }}>{fmt$(totalGprAnnual)}</span>
              </div>
            </div>
          )}

          {/* ── Value-Add Renovation Upside ── */}
          {isValueAdd && unitMix.length > 0 && (
            <div style={{ background: C.panel, border: `1px solid ${C.purple}44`, borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: '#1a0a2a' }}>
                <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.purple, letterSpacing: '0.06em' }}>RENOVATION UPSIDE — FLOOR PLAN PRIORITY RANKING</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.panelAlt }}>
                    <th style={th('FLOOR PLAN')}>FLOOR PLAN</th>
                    <th style={th('', true)}>UNITS</th>
                    <th style={th('', true)}>IN-PLACE</th>
                    <th style={th('', true)}>MARKET</th>
                    <th style={th('', true)}>PREMIUM/UNIT</th>
                    <th style={th('', true)}>ANNUAL UPSIDE</th>
                    <th style={th('', true)}>PRIORITY</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unitMix]
                    .map(u => ({
                      ...u,
                      premium: (getMarketRent(u, 0) ?? 0) - (getEffectiveRent(u, 0) ?? 0),
                      annualUpside: u.count * ((getMarketRent(u, 0) ?? 0) - (getEffectiveRent(u, 0) ?? 0)) * 12,
                    }))
                    .filter(u => u.premium > 0)
                    .sort((a, b) => b.premium - a.premium)
                    .map((u, idx) => (
                      <tr key={u.type} style={{ background: idx % 2 === 0 ? C.panel : C.panelAlt }}>
                        <td style={{ ...td(), fontWeight: 700, color: C.purple }}>{u.type}</td>
                        <td style={td(true)}>{u.count}</td>
                        <td style={td(true)}>{fmt$(getEffectiveRent(u, 0))}</td>
                        <td style={td(true, false, C.amber)}>{fmt$(getMarketRent(u, 0))}</td>
                        <td style={td(true, true, C.green)}>+{fmt$(u.premium)}/mo</td>
                        <td style={td(true, false, C.green)}>{fmt$(u.annualUpside)}</td>
                        <td style={{ ...td(true) }}>
                          <span style={{ fontFamily: LABEL, fontSize: 7, fontWeight: 700, color: idx === 0 ? C.cyan : idx <= 2 ? C.green : C.amber, background: idx === 0 ? C.cyanDim : idx <= 2 ? C.greenDim : C.amberDim, border: `1px solid ${idx === 0 ? C.cyan : idx <= 2 ? C.green : C.amber}44`, borderRadius: 3, padding: '2px 6px' }}>
                            {idx === 0 ? '★ TOP' : idx <= 2 ? 'HIGH' : 'MED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── RIGHT: Traffic Absorption Engine panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* M07 Absorption Engine */}
          <div style={{ background: C.panel, border: hasTraffic ? `1px solid ${C.cyan}44` : `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: hasTraffic ? C.cyanDim : C.panelAlt, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={12} color={hasTraffic ? C.cyan : C.muted} />
              <div>
                <div style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: hasTraffic ? C.cyan : C.muted, letterSpacing: '0.06em' }}>M07 TRAFFIC ENGINE · ABSORPTION</div>
                <div style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>linked from F6 Traffic module</div>
              </div>
              {hasTraffic && (
                <Zap size={10} color={C.cyan} style={{ marginLeft: 'auto' }} />
              )}
            </div>
            <div style={{ padding: '10px 12px' }}>
              <TrafficSignal label="T01 WEEKLY TOURS" value={ls?.t01WeeklyTours != null ? ls.t01WeeklyTours.toFixed(1) : '—'} unit="/wk" linked={ls?.t01WeeklyTours != null} />
              <TrafficSignal label="T05 CAPTURE RATE" value={ls?.t05ClosingRatio != null ? `${(ls.t05ClosingRatio * 100).toFixed(1)}` : '—'} unit="%" linked={ls?.t05ClosingRatio != null} />
              <TrafficSignal label="T06 NET LEASES" value={weeklyLeases != null ? weeklyLeases.toFixed(1) : '—'} unit="/wk" linked={weeklyLeases != null} />
              <TrafficSignal label="T07 LEASE-UP TO 95%" value={leaseUpWeeks != null ? leaseUpWeeks.toFixed(0) : '—'} unit="wks" linked={leaseUpWeeks != null} />
            </div>
            {!hasTraffic && (
              <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, background: '#0a0a10' }}>
                <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Info size={10} />
                  Configure traffic data in F6 to activate absorption signals
                </div>
              </div>
            )}
          </div>

          {/* Lease-Up Timeline */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>LEASE-UP TIMELINE</span>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'CURRENT OCC.', value: fmtPct(currentOcc), color: currentOcc >= 0.90 ? C.green : currentOcc >= 0.80 ? C.amber : C.red },
                { label: 'VACANT UNITS', value: vacantUnits > 0 ? String(vacantUnits) : '0', color: C.muted },
                { label: 'STABILIZED TARGET', value: fmtPct(1 - stabilizedVac), color: C.green },
                { label: 'UNITS TO STABILIZE', value: fmtNum(Math.round((1 - stabilizedVac - currentOcc) * totalUnits)), color: C.amber },
                { label: 'VELOCITY', value: weeklyLeases != null ? `${weeklyLeases.toFixed(1)}/wk` : '—', color: hasTraffic ? C.cyan : C.dim },
                { label: 'EXP. LEASE-UP', value: leaseUpMonths != null ? `${leaseUpMonths} months` : '—', color: hasTraffic ? C.purple : C.dim },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}

              {/* Lease-up progress bar */}
              {totalUnits > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>NOW {fmtPct(currentOcc)}</span>
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>TARGET {fmtPct(1 - stabilizedVac)}</span>
                  </div>
                  <div style={{ height: 6, background: C.panelAlt, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(currentOcc * 100, 100)}%`, background: currentOcc >= 0.90 ? C.green : currentOcc >= 0.80 ? C.amber : C.red, borderRadius: 3, transition: 'width 0.4s ease' }} />
                    <div style={{ position: 'absolute', left: `${(1 - stabilizedVac) * 100}%`, top: 0, height: '100%', width: 1, background: C.green, opacity: 0.5 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: hasTraffic ? C.cyan : C.dim }} />
                    <span style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>
                      {hasTraffic ? 'Velocity sourced from M07 traffic engine (F6)' : 'Link M07 traffic data to get velocity projections'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Occupancy Bridge */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: LABEL, fontSize: 9, fontWeight: 700, color: C.text, letterSpacing: '0.06em' }}>VACANCY WATERFALL</span>
            </div>
            <div style={{ padding: 12 }}>
              {[
                { label: 'MARKET GPR', value: fmt$(totalMarketGprAnnual > 0 ? totalMarketGprAnnual : null), color: C.amber },
                { label: '– LOSS-TO-LEASE', value: totalLtl > 0 ? `(${fmt$(totalLtl)})` : '—', color: C.red },
                { label: '– PHYSICAL VACANCY', value: physicalVacancy != null && totalMarketGprAnnual > 0 ? `(${fmt$(physicalVacancy * totalMarketGprAnnual)})` : '—', color: C.red },
                { label: '= IN-PLACE GPR', value: fmt$(totalGprAnnual > 0 ? totalGprAnnual : null), color: C.green, bold: true },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: i < 3 ? `1px solid ${C.border}` : undefined }}>
                  <span style={{ fontFamily: LABEL, fontSize: 9, color: C.muted }}>{row.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: (row as any).bold ? 700 : 400, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deal type badge */}
          <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 12px' }}>
            <div style={{ fontFamily: LABEL, fontSize: 8, color: C.dim, marginBottom: 6 }}>DEAL TYPE MODE</div>
            {[
              { id: 'existing', label: 'EXISTING · STABILIZED', desc: 'Rent roll extracted, in-place analytics active' },
              { id: 'redevelopment', label: 'VALUE-ADD · RENOVATION', desc: 'Upside ranking + renovation tracker active' },
              { id: 'development', label: 'GROUND-UP', desc: 'Target program + absorption ramp active' },
            ].map(dt => (
              <div key={dt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: dealType === dt.id || (dt.id === 'existing' && isExisting) || (dt.id === 'redevelopment' && isValueAdd) || (dt.id === 'development' && isDeveopment) ? C.cyan : C.dim, marginTop: 3, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: LABEL, fontSize: 8, fontWeight: 700, color: (dealType === dt.id || (dt.id === 'existing' && isExisting) || (dt.id === 'redevelopment' && isValueAdd) || (dt.id === 'development' && isDeveopment)) ? C.cyan : C.dim }}>{dt.label}</div>
                  <div style={{ fontFamily: LABEL, fontSize: 7, color: C.dim }}>{dt.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
