/**
 * FloorPlanGrid — Pattern A expand component
 *
 * Renders the per-floor-plan underwriting grid for GPR on value-add and
 * redevelopment deals. 10 columns per spec v1.1:
 *   Floor Plan | Units | Current Market | Comp Ceiling (P25/P50/P75) |
 *   Positioning Percentile | Post-Reno Target | Premium | Capture Rate |
 *   Reno Cost per Unit | Yield on Cost
 *
 * Live math: YoC = (captured_premium × 12) / reno_cost
 * Aggregate footer: property-level YoC = total_premium_revenue / total_reno_budget
 *
 * Data sources (in priority order):
 *   1. gprUnitMix — cashflow agent output (rich, all columns populated)
 *   2. rentRollMix — rent roll unit mix (current market rent only; other cols empty)
 *   3. null       — shows "grid unavailable" message
 *
 * Edit semantics:
 *   - Positioning Percentile: dropdown (P25/P50/P75/P90) — recalcs target + YoC immediately
 *   - Capture Rate: numeric input — recalcs YoC immediately
 *   - Reno Cost per Unit: numeric input — recalcs YoC immediately; writes back to
 *     M22 capex_schedule on blur / after 800ms idle (PATCH /api/v1/deals/:id/m22/floor-plan-cost)
 *
 * Post-stabilization view: hides Reno Cost + Yield columns per spec § 6.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BT } from '../deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── Data shapes ─────────────────────────────────────────────────────────────

export interface CompCeiling {
  p25: number | null;
  p50: number | null;
  p75: number | null;
  sample_size?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface LayeredNum {
  resolved: number | null;
  baseline?: number | null;
  platform?: number | null;
  override?: number | null;
  source?: string;
}

export interface GprUnitMixEntry {
  floor_plan_id: string;
  floor_plan_label: string;
  unit_count: number;
  current_market_rent: number | null;
  comp_ceiling: CompCeiling | null;
  positioning_percentile: number | null;
  post_reno_target_rent: number | null;
  gross_premium: number | null;
  capture_rate: number | null;
  captured_premium: number | null;
  renovation_cost: number | null;
  renovation_scope?: string;
  scope_id?: string;
  yield_on_cost: number | null;
}

export interface RentRollUnitRow {
  type: string;
  count: number;
  avgSf: number | null;
  inPlaceRent: number | null;
  marketRent: number | null;
  occupancyPct: number | null;
  concessionPct: number | null;
}

interface RowState {
  positioningPercentile: number;
  captureRate: number;
  renoCostPerUnit: number | null;
  postRenoTargetRent: number | null;
}

interface Props {
  gprUnitMix?: GprUnitMixEntry[] | null;
  rentRollMix?: RentRollUnitRow[] | null;
  totalUnits?: number;
  postStabilizationView?: boolean;
  dealId?: string | null;
  renovationScope?: string | null;
  scopeUniformity?: 'uniform' | 'mixed' | null;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtRent(n: number | null): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number | null, decimals = 1): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtCost(n: number | null): string {
  if (n == null) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtYoC(n: number | null): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtBudget(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ─── Comp ceiling display ─────────────────────────────────────────────────────

function CompCeilingCell({ ceiling }: { ceiling: CompCeiling | null }) {
  if (!ceiling || (ceiling.p25 == null && ceiling.p50 == null && ceiling.p75 == null)) {
    return <span style={{ color: '#334155' }}>—</span>;
  }
  return (
    <span style={{ fontSize: 8.5, letterSpacing: 0 }}>
      <span style={{ color: '#64748b' }}>{ceiling.p25 != null ? `$${Math.round(ceiling.p25).toLocaleString()}` : '—'}</span>
      <span style={{ color: '#334155' }}> / </span>
      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{ceiling.p50 != null ? `$${Math.round(ceiling.p50).toLocaleString()}` : '—'}</span>
      <span style={{ color: '#334155' }}> / </span>
      <span style={{ color: '#64748b' }}>{ceiling.p75 != null ? `$${Math.round(ceiling.p75).toLocaleString()}` : '—'}</span>
    </span>
  );
}

// ─── YoC computation ─────────────────────────────────────────────────────────

function computeYoC(
  currentMarket: number | null,
  postRenoTarget: number | null,
  captureRate: number,
  renoCost: number | null,
): number | null {
  if (postRenoTarget == null || currentMarket == null || renoCost == null || renoCost === 0) return null;
  const grossPremium = postRenoTarget - currentMarket;
  const capturedPremium = grossPremium * captureRate;
  return (capturedPremium * 12) / renoCost;
}

function computePostRenoTarget(
  ceiling: CompCeiling | null,
  percentile: number,
): number | null {
  if (!ceiling) return null;
  if (percentile <= 25) return ceiling.p25;
  if (percentile <= 50) return ceiling.p50 ?? ceiling.p25;
  if (percentile <= 75) return ceiling.p75 ?? ceiling.p50 ?? ceiling.p25;
  if (percentile <= 90) {
    const p75 = ceiling.p75;
    const p50 = ceiling.p50;
    if (p75 == null || p50 == null) return p75 ?? p50;
    return p75 + (p75 - p50) * 0.5;
  }
  return ceiling.p75;
}

const POSITIONING_OPTIONS = [
  { label: 'P25', value: 25 },
  { label: 'P50', value: 50 },
  { label: 'P75', value: 75 },
  { label: 'P90', value: 90 },
];

const DEFAULT_CAPTURE_RATE = 0.78;
const DEFAULT_POSITIONING = 50;
const YOC_THRESHOLD = 0.10;

// ─── Main component ───────────────────────────────────────────────────────────

export function FloorPlanGrid({
  gprUnitMix,
  rentRollMix,
  totalUnits = 0,
  postStabilizationView = false,
  dealId,
  renovationScope,
  scopeUniformity,
}: Props) {

  // ── Derive row list ──────────────────────────────────────────────────────────

  const sourceRows: GprUnitMixEntry[] = React.useMemo(() => {
    if (gprUnitMix && gprUnitMix.length > 0) return gprUnitMix;
    if (rentRollMix && rentRollMix.length > 0) {
      return rentRollMix.map((r) => ({
        floor_plan_id: r.type.toLowerCase().replace(/\s+/g, '_'),
        floor_plan_label: r.type,
        unit_count: r.count,
        current_market_rent: r.marketRent ?? r.inPlaceRent,
        comp_ceiling: null,
        positioning_percentile: null,
        post_reno_target_rent: null,
        gross_premium: null,
        capture_rate: null,
        captured_premium: null,
        renovation_cost: null,
        yield_on_cost: null,
      }));
    }
    return [];
  }, [gprUnitMix, rentRollMix]);

  // ── Per-row local state (user overrides seeded from source data) ──────────────

  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const r of sourceRows) {
      init[r.floor_plan_id] = {
        positioningPercentile: r.positioning_percentile ?? DEFAULT_POSITIONING,
        captureRate: r.capture_rate ?? DEFAULT_CAPTURE_RATE,
        renoCostPerUnit: r.renovation_cost ?? null,
        postRenoTargetRent: r.post_reno_target_rent ?? null,
      };
    }
    return init;
  });

  useEffect(() => {
    setRowStates(prev => {
      const next: Record<string, RowState> = {};
      for (const r of sourceRows) {
        next[r.floor_plan_id] = prev[r.floor_plan_id] ?? {
          positioningPercentile: r.positioning_percentile ?? DEFAULT_POSITIONING,
          captureRate: r.capture_rate ?? DEFAULT_CAPTURE_RATE,
          renoCostPerUnit: r.renovation_cost ?? null,
          postRenoTargetRent: r.post_reno_target_rent ?? null,
        };
      }
      return next;
    });
  }, [sourceRows]);

  // ── Global positioning override ───────────────────────────────────────────────

  const [globalPositioning, setGlobalPositioning] = useState<number | null>(null);

  function applyGlobalPositioning(pct: number) {
    setGlobalPositioning(pct);
    setRowStates(prev => {
      const next = { ...prev };
      for (const r of sourceRows) {
        const id = r.floor_plan_id;
        const target = computePostRenoTarget(r.comp_ceiling, pct);
        next[id] = { ...next[id], positioningPercentile: pct, postRenoTargetRent: target };
      }
      return next;
    });
  }

  // ── M22 write-back (debounced 800ms) ─────────────────────────────────────────

  const writebackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleWriteback = useCallback((floorPlanId: string, cost: number | null) => {
    if (!dealId) return;
    if (writebackTimers.current[floorPlanId]) clearTimeout(writebackTimers.current[floorPlanId]);
    writebackTimers.current[floorPlanId] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/m22/floor-plan-cost`, {
          floor_plan_id: floorPlanId,
          cost_per_unit: cost,
        });
      } catch {
        // Non-fatal — endpoint may not exist in v1; grid still reflects local state
      }
    }, 800);
  }, [dealId]);

  useEffect(() => {
    const timers = writebackTimers.current;
    return () => { Object.values(timers).forEach(t => clearTimeout(t)); };
  }, []);

  // ── Row update helpers ────────────────────────────────────────────────────────

  function updatePositioning(id: string, pct: number, ceiling: CompCeiling | null) {
    setGlobalPositioning(null);
    const target = computePostRenoTarget(ceiling, pct);
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], positioningPercentile: pct, postRenoTargetRent: target } }));
  }

  function updateCaptureRate(id: string, rate: number) {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], captureRate: rate } }));
  }

  function updateRenoCost(id: string, cost: number | null) {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], renoCostPerUnit: cost } }));
    scheduleWriteback(id, cost);
  }

  // ── Aggregate computation ─────────────────────────────────────────────────────

  const aggregate = React.useMemo(() => {
    let totalUnitsSum = 0;
    let weightedCurrentRent = 0;
    let weightedTargetRent = 0;
    let weightedPremium = 0;
    let totalRevenueAnnualized = 0;
    let totalRenoBudget = 0;
    let unitsWithCost = 0;

    for (const r of sourceRows) {
      const rs = rowStates[r.floor_plan_id];
      if (!rs) continue;
      const target = rs.postRenoTargetRent ?? computePostRenoTarget(r.comp_ceiling, rs.positioningPercentile);
      const current = r.current_market_rent;
      const units = r.unit_count;
      totalUnitsSum += units;
      if (current != null) weightedCurrentRent += current * units;
      if (target != null) weightedTargetRent += target * units;
      if (current != null && target != null) {
        const gross = target - current;
        const captured = gross * rs.captureRate;
        weightedPremium += gross * units;
        totalRevenueAnnualized += captured * 12 * units;
      }
      if (rs.renoCostPerUnit != null) {
        totalRenoBudget += rs.renoCostPerUnit * units;
        unitsWithCost += units;
      }
    }

    const avgCurrentRent = totalUnitsSum > 0 ? weightedCurrentRent / totalUnitsSum : null;
    const avgTargetRent  = totalUnitsSum > 0 ? weightedTargetRent  / totalUnitsSum : null;
    const avgPremium     = totalUnitsSum > 0 ? weightedPremium     / totalUnitsSum : null;
    const propertyYoC    = totalRenoBudget > 0 ? totalRevenueAnnualized / totalRenoBudget : null;
    const missingCostCount = sourceRows.filter(r => (rowStates[r.floor_plan_id]?.renoCostPerUnit ?? null) == null).length;

    return { totalUnitsSum, avgCurrentRent, avgTargetRent, avgPremium, totalRevenueAnnualized, totalRenoBudget, propertyYoC, missingCostCount, unitsWithCost };
  }, [sourceRows, rowStates]);

  // ── No data fallback ──────────────────────────────────────────────────────────

  if (sourceRows.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontFamily: MONO, fontSize: 9, color: '#334155', fontStyle: 'italic' }}>
        Per-floor-plan grid unavailable — rent roll did not provide unit mix detail.
      </div>
    );
  }

  const hasCeilingData = sourceRows.some(r => r.comp_ceiling != null);
  const hasCostData = sourceRows.some(r => r.renovation_cost != null);

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const hdrStyle: React.CSSProperties = {
    padding: '3px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 8,
    color: '#475569', fontWeight: 700, letterSpacing: '0.04em', borderBottom: '1px solid #1e2538',
    whiteSpace: 'nowrap', background: '#080e14',
  };
  const hdrLeftStyle: React.CSSProperties = { ...hdrStyle, textAlign: 'left', position: 'sticky', left: 0 };
  const cellStyle: React.CSSProperties = {
    padding: '3px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 9,
    borderBottom: '1px solid #0d1520', color: '#94a3b8', whiteSpace: 'nowrap',
  };
  const cellLeftStyle: React.CSSProperties = {
    ...cellStyle, textAlign: 'left', position: 'sticky', left: 0,
    background: 'inherit', color: '#e2e8f0', fontWeight: 600, minWidth: 100,
  };
  const footerStyle: React.CSSProperties = {
    padding: '4px 6px', textAlign: 'right', fontFamily: MONO, fontSize: 9,
    borderTop: '1px solid #1e2538', fontWeight: 700, color: '#94a3b8', whiteSpace: 'nowrap',
    background: '#080e14',
  };
  const footerLeftStyle: React.CSSProperties = {
    ...footerStyle, textAlign: 'left', position: 'sticky', left: 0, color: '#e2e8f0',
  };

  return (
    <div style={{ background: '#050d14', borderTop: '1px solid #0e2235' }}>

      {/* ── Header bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #0e2235', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: '#06b6d4' }}>
            FLOOR-PLAN GPR GRID
          </span>
          <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155' }}>
            Renovation Scope:{' '}
            <span style={{ color: '#64748b', fontStyle: renovationScope ? 'normal' : 'italic' }}>
              {renovationScope ?? '[not specified — set in M22]'}
            </span>
          </span>
          {scopeUniformity === 'mixed' && (
            <span style={{
              fontFamily: MONO, fontSize: 8, color: '#f59e0b',
              background: '#1a1200', border: '1px solid #f59e0b44',
              borderRadius: 2, padding: '1px 5px',
            }}>
              ⚠ Mixed-scope program detected — grid shows weighted-avg cost. Per-scope detail in M22.
            </span>
          )}
          {!hasCeilingData && (
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', fontStyle: 'italic' }}>
              · Comp ceiling data unavailable — run Cashflow Agent to populate
            </span>
          )}
          {aggregate.missingCostCount > 0 && (
            <span style={{
              fontFamily: MONO, fontSize: 8, color: '#f59e0b',
              background: '#1a1200', border: '1px solid #f59e0b44',
              borderRadius: 2, padding: '1px 5px',
            }}>
              Missing cost data for {aggregate.missingCostCount} of {sourceRows.length} floor plan{sourceRows.length !== 1 ? 's' : ''} — aggregate yield reflects partial coverage
            </span>
          )}
        </div>

        {/* Global positioning override */}
        {hasCeilingData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569' }}>Global positioning:</span>
            {POSITIONING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => applyGlobalPositioning(opt.value)}
                style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 2, border: 'none', cursor: 'pointer',
                  background: globalPositioning === opt.value ? '#0891b2' : '#0c1a26',
                  color: globalPositioning === opt.value ? '#fff' : '#475569',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Grid table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr>
              <th style={hdrLeftStyle}>FLOOR PLAN</th>
              <th style={hdrStyle}>UNITS</th>
              <th style={hdrStyle}>CURRENT<br/>MARKET</th>
              <th style={{ ...hdrStyle, color: '#0891b2' }}>COMP CEILING<br/>P25 / P50 / P75</th>
              <th style={hdrStyle}>POSITION<br/>PERCENTILE</th>
              <th style={{ ...hdrStyle, color: '#22c55e' }}>POST-RENO<br/>TARGET</th>
              <th style={hdrStyle}>PREMIUM<br/>/MO</th>
              <th style={hdrStyle}>CAPTURE<br/>RATE</th>
              {!postStabilizationView && <th style={{ ...hdrStyle, color: '#a78bfa' }}>RENO COST<br/>PER UNIT</th>}
              {!postStabilizationView && <th style={{ ...hdrStyle, color: '#f59e0b' }}>YIELD<br/>ON COST</th>}
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((r, idx) => {
              const rs = rowStates[r.floor_plan_id] ?? {
                positioningPercentile: DEFAULT_POSITIONING,
                captureRate: DEFAULT_CAPTURE_RATE,
                renoCostPerUnit: null,
                postRenoTargetRent: null,
              };
              const target = rs.postRenoTargetRent ?? computePostRenoTarget(r.comp_ceiling, rs.positioningPercentile) ?? r.post_reno_target_rent;
              const current = r.current_market_rent;
              const grossPremium = (target != null && current != null) ? target - current : null;
              const capturedPremium = grossPremium != null ? grossPremium * rs.captureRate : null;
              const yoc = computeYoC(current, target, rs.captureRate, rs.renoCostPerUnit);
              const yocBelowThreshold = yoc != null && yoc < YOC_THRESHOLD;
              const rowBg = idx % 2 === 0 ? '#060c14' : '#050a10';

              return (
                <tr key={r.floor_plan_id} style={{ background: rowBg }}>
                  {/* Floor Plan label */}
                  <td style={{ ...cellLeftStyle, background: rowBg }}>
                    {r.floor_plan_label}
                  </td>

                  {/* Units */}
                  <td style={{ ...cellStyle, color: '#64748b' }}>{r.unit_count}</td>

                  {/* Current Market Rent */}
                  <td style={{ ...cellStyle, color: '#94a3b8' }}>
                    {fmtRent(current)}
                  </td>

                  {/* Comp Ceiling P25/P50/P75 */}
                  <td style={{ ...cellStyle, minWidth: 140 }}>
                    <CompCeilingCell ceiling={r.comp_ceiling} />
                  </td>

                  {/* Positioning Percentile — editable dropdown */}
                  <td style={{ ...cellStyle, padding: '2px 4px' }}>
                    <select
                      value={rs.positioningPercentile}
                      onChange={e => updatePositioning(r.floor_plan_id, Number(e.target.value), r.comp_ceiling)}
                      style={{
                        background: '#0a1a26', border: '1px solid #1e3a4a',
                        color: '#06b6d4', fontFamily: MONO, fontSize: 8,
                        borderRadius: 2, padding: '1px 3px', cursor: 'pointer',
                        width: 52,
                      }}
                    >
                      {POSITIONING_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* Post-Reno Target */}
                  <td style={{ ...cellStyle, color: '#22c55e', fontWeight: 600 }}>
                    {target != null ? fmtRent(target) : (hasCeilingData ? '—' : <span style={{ color: '#1e3a2a', fontStyle: 'italic' }}>no comps</span>)}
                  </td>

                  {/* Premium */}
                  <td style={{ ...cellStyle, color: grossPremium != null && grossPremium > 0 ? '#34d399' : '#64748b' }}>
                    {grossPremium != null ? fmtRent(grossPremium) : '—'}
                  </td>

                  {/* Capture Rate — editable */}
                  <td style={{ ...cellStyle, padding: '2px 4px' }}>
                    <CaptureRateInput
                      value={rs.captureRate}
                      onChange={v => updateCaptureRate(r.floor_plan_id, v)}
                    />
                  </td>

                  {/* Reno Cost per Unit — editable + M22 write-back */}
                  {!postStabilizationView && (
                    <td style={{ ...cellStyle, padding: '2px 4px' }}>
                      <RenoCostInput
                        value={rs.renoCostPerUnit}
                        onChange={v => updateRenoCost(r.floor_plan_id, v)}
                      />
                    </td>
                  )}

                  {/* Yield on Cost */}
                  {!postStabilizationView && (
                    <td style={{
                      ...cellStyle,
                      color: yocBelowThreshold ? '#f59e0b' : (yoc != null ? '#fbbf24' : '#334155'),
                      fontWeight: yoc != null ? 700 : 400,
                    }}>
                      {yoc != null ? (
                        <span title={yocBelowThreshold ? 'Yield-on-cost below threshold — renovation cost may exceed achievable premium' : undefined}>
                          {fmtYoC(yoc)}
                          {yocBelowThreshold && <span style={{ marginLeft: 3, fontSize: 8 }}>⚠</span>}
                        </span>
                      ) : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* ── Aggregate footer ── */}
          <tfoot>
            <tr>
              <td style={footerLeftStyle}>AGGREGATE</td>
              <td style={{ ...footerStyle, color: '#64748b' }}>{aggregate.totalUnitsSum || totalUnits}</td>
              <td style={footerStyle}>{fmtRent(aggregate.avgCurrentRent)}</td>
              <td style={{ ...footerStyle, color: '#334155', fontSize: 8, fontStyle: 'italic' }}>weighted avg</td>
              <td style={{ ...footerStyle, color: '#0891b2', fontSize: 8 }}>wt'd</td>
              <td style={{ ...footerStyle, color: '#22c55e' }}>{fmtRent(aggregate.avgTargetRent)}</td>
              <td style={{ ...footerStyle, color: '#34d399' }}>{fmtRent(aggregate.avgPremium)}</td>
              <td style={{ ...footerStyle, color: '#64748b' }}>—</td>
              {!postStabilizationView && (
                <td style={{ ...footerStyle, color: '#a78bfa' }}>{fmtBudget(aggregate.totalRenoBudget) || '—'}</td>
              )}
              {!postStabilizationView && (
                <td style={{ ...footerStyle, color: '#f59e0b', fontSize: 10 }}>
                  {aggregate.propertyYoC != null ? fmtYoC(aggregate.propertyYoC) : '—'}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Property-level YoC callout (only when cost data exists) ── */}
      {!postStabilizationView && aggregate.propertyYoC != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          padding: '8px 12px', borderTop: '1px solid #0e2235',
          background: '#060c12',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Property Yield-on-Cost
            </span>
            <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
              {fmtYoC(aggregate.propertyYoC)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155' }}>Total Reno Budget</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#a78bfa' }}>
              {fmtBudget(aggregate.totalRenoBudget)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#334155' }}>Total Premium Revenue (ann.)</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: '#34d399' }}>
              {fmtBudget(aggregate.totalRevenueAnnualized)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Capture Rate inline editor ───────────────────────────────────────────────

function CaptureRateInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft);
          if (!isNaN(v) && v >= 0 && v <= 1) onChange(v);
          else if (!isNaN(v) && v > 1 && v <= 100) onChange(v / 100);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          width: 44, background: '#0a1a26', border: '1px solid #0891b2',
          color: '#06b6d4', fontFamily: MONO, fontSize: 8, borderRadius: 2, padding: '1px 3px',
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft((value * 100).toFixed(0)); setEditing(true); }}
      title="Click to edit capture rate"
      style={{ cursor: 'pointer', color: '#94a3b8', borderBottom: '1px dotted #334155', fontSize: 9 }}
    >
      {fmtPct(value, 0)}
    </span>
  );
}

// ─── Reno Cost inline editor ──────────────────────────────────────────────────

function RenoCostInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const raw = draft.replace(/[$,]/g, '');
          const v = parseFloat(raw);
          onChange(isNaN(v) || v <= 0 ? null : v);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        placeholder="e.g. 22400"
        style={{
          width: 68, background: '#12091a', border: '1px solid #7c3aed',
          color: '#a78bfa', fontFamily: MONO, fontSize: 8, borderRadius: 2, padding: '1px 3px',
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value != null ? String(Math.round(value)) : ''); setEditing(true); }}
      title="Click to edit renovation cost per unit — writes back to M22 capex schedule"
      style={{
        cursor: 'pointer',
        color: value != null ? '#a78bfa' : '#2a1a3a',
        borderBottom: `1px dotted ${value != null ? '#5b21b6' : '#2a1a3a'}`,
        fontStyle: value == null ? 'italic' : 'normal',
        fontSize: 9,
      }}
    >
      {value != null ? fmtCost(value) : 'set cost'}
    </span>
  );
}
