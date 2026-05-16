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
 * Positioning options per spec § 2.1: P25 / P40 / P50 / P60 / P75 / P90 / Custom
 *   Custom: user enters post-reno target rent directly.
 *
 * Evidence-pill semantics (spec § 4):
 *   - Platform-suggested value shown as subtle hint below editable cells
 *   - Yellow highlight when user override deviates >100bps (% field) or
 *     >5% (dollar field) from platform suggestion
 *   - Error indicator on reno cost cell when M22 writeback fails
 *
 * Input modes (spec § 2.1):
 *   Accept Platform Grid — applies P50 positioning to all rows
 *   Global Positioning Override — single dropdown above the grid
 *   Per-row Override — individual row controls
 *   Reset Capture Rate — reverts to portfolio default
 *
 * Data sources (in priority order):
 *   1. gprUnitMix — cashflow agent output (rich, all columns populated)
 *   2. rentRollMix — rent roll unit mix (current market rent only)
 *   3. null       — shows "grid unavailable" message
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

// 0 is sentinel for Custom mode (user enters target rent directly)
type PositioningPct = 25 | 40 | 50 | 60 | 75 | 90 | 0;

interface RowState {
  positioningPercentile: PositioningPct;
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
  /**
   * Operator-configured yield-on-cost threshold below which a warning is shown.
   * Read from deal.target_yield_threshold when available; defaults to 10% (0.10).
   * Per spec § 4 the threshold must come from deal configuration, not be hardcoded.
   */
  targetYieldThreshold?: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIONING_OPTIONS: { label: string; value: PositioningPct }[] = [
  { label: 'P25', value: 25 },
  { label: 'P40', value: 40 },
  { label: 'P50', value: 50 },
  { label: 'P60', value: 60 },
  { label: 'P75', value: 75 },
  { label: 'P90', value: 90 },
  { label: 'Custom', value: 0 },
];

const DEFAULT_CAPTURE_RATE = 0.78;
const DEFAULT_POSITIONING: PositioningPct = 50;
const DEFAULT_YOC_THRESHOLD = 0.10; // fallback when deal config not available
// Deviation thresholds per spec § 4
const PCT_DEVIATION_BPS = 0.01;  // 100 bps
const DOLLAR_DEVIATION_PCT = 0.05; // 5%

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
  percentile: PositioningPct,
): number | null {
  if (!ceiling || percentile === 0) return null;
  if (percentile <= 25) return ceiling.p25;
  if (percentile <= 40) {
    // Interpolate between P25 and P50
    const p25 = ceiling.p25;
    const p50 = ceiling.p50;
    if (p25 == null) return p50;
    if (p50 == null) return p25;
    return p25 + (p50 - p25) * 0.6;
  }
  if (percentile <= 50) return ceiling.p50 ?? ceiling.p25;
  if (percentile <= 60) {
    // Interpolate between P50 and P75
    const p50 = ceiling.p50;
    const p75 = ceiling.p75;
    if (p50 == null) return p75;
    if (p75 == null) return p50;
    return p50 + (p75 - p50) * 0.4;
  }
  if (percentile <= 75) return ceiling.p75 ?? ceiling.p50 ?? ceiling.p25;
  if (percentile <= 90) {
    const p75 = ceiling.p75;
    const p50 = ceiling.p50;
    if (p75 == null || p50 == null) return p75 ?? p50;
    return p75 + (p75 - p50) * 0.5;
  }
  return ceiling.p75;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FloorPlanGrid({
  gprUnitMix,
  rentRollMix,
  totalUnits = 0,
  postStabilizationView = false,
  dealId,
  renovationScope,
  scopeUniformity,
  targetYieldThreshold,
}: Props) {
  // Resolve effective YoC threshold from deal config (spec § 4); fallback to 10%
  const YOC_THRESHOLD = targetYieldThreshold ?? DEFAULT_YOC_THRESHOLD;

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
      const rawPct = r.positioning_percentile;
      const pct: PositioningPct = (rawPct === 25 || rawPct === 40 || rawPct === 50 ||
        rawPct === 60 || rawPct === 75 || rawPct === 90) ? rawPct : DEFAULT_POSITIONING;
      init[r.floor_plan_id] = {
        positioningPercentile: pct,
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
        if (!prev[r.floor_plan_id]) {
          const rawPct = r.positioning_percentile;
          const pct: PositioningPct = (rawPct === 25 || rawPct === 40 || rawPct === 50 ||
            rawPct === 60 || rawPct === 75 || rawPct === 90) ? rawPct : DEFAULT_POSITIONING;
          next[r.floor_plan_id] = {
            positioningPercentile: pct,
            captureRate: r.capture_rate ?? DEFAULT_CAPTURE_RATE,
            renoCostPerUnit: r.renovation_cost ?? null,
            postRenoTargetRent: r.post_reno_target_rent ?? null,
          };
        } else {
          next[r.floor_plan_id] = prev[r.floor_plan_id];
        }
      }
      return next;
    });
  }, [sourceRows]);

  // ── Global positioning override ───────────────────────────────────────────────

  const [globalPositioning, setGlobalPositioning] = useState<PositioningPct | null>(null);

  function applyGlobalPositioning(pct: PositioningPct) {
    setGlobalPositioning(pct);
    setRowStates(prev => {
      const next = { ...prev };
      for (const r of sourceRows) {
        const id = r.floor_plan_id;
        const target = pct === 0 ? null : computePostRenoTarget(r.comp_ceiling, pct);
        next[id] = { ...next[id], positioningPercentile: pct, postRenoTargetRent: target };
      }
      return next;
    });
  }

  function acceptPlatformGrid() {
    applyGlobalPositioning(50);
  }

  // ── M22 write-back (debounced 800ms, with error tracking) ────────────────────

  const writebackTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [writebackErrors, setWritebackErrors] = useState<Record<string, boolean>>({});

  const scheduleWriteback = useCallback((floorPlanId: string, cost: number | null) => {
    if (!dealId) return;
    if (writebackTimers.current[floorPlanId]) clearTimeout(writebackTimers.current[floorPlanId]);
    writebackTimers.current[floorPlanId] = setTimeout(async () => {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/m22/floor-plan-cost`, {
          floor_plan_id: floorPlanId,
          cost_per_unit: cost,
        });
        setWritebackErrors(prev => ({ ...prev, [floorPlanId]: false }));
      } catch {
        // Surface the failure — user needs to know the M22 write did not persist
        setWritebackErrors(prev => ({ ...prev, [floorPlanId]: true }));
      }
    }, 800);
  }, [dealId]);

  useEffect(() => {
    const timers = writebackTimers.current;
    return () => { Object.values(timers).forEach(t => clearTimeout(t)); };
  }, []);

  // ── Row update helpers ────────────────────────────────────────────────────────

  function updatePositioning(id: string, pct: PositioningPct, ceiling: CompCeiling | null) {
    setGlobalPositioning(null);
    const target = pct === 0 ? null : computePostRenoTarget(ceiling, pct);
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], positioningPercentile: pct, postRenoTargetRent: pct === 0 ? prev[id].postRenoTargetRent : target } }));
  }

  function updateCustomTarget(id: string, target: number | null) {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], postRenoTargetRent: target } }));
  }

  function updateCaptureRate(id: string, rate: number) {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], captureRate: rate } }));
  }

  function resetAllCaptureRates() {
    setRowStates(prev => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], captureRate: DEFAULT_CAPTURE_RATE };
      }
      return next;
    });
  }

  function updateRenoCost(id: string, cost: number | null) {
    setRowStates(prev => ({ ...prev, [id]: { ...prev[id], renoCostPerUnit: cost } }));
    setWritebackErrors(prev => ({ ...prev, [id]: false }));
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
      const target = rs.postRenoTargetRent ?? (rs.positioningPercentile !== 0 ? computePostRenoTarget(r.comp_ceiling, rs.positioningPercentile) : null);
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
  const anyCaptureRateCustomized = Object.values(rowStates).some(rs => Math.abs(rs.captureRate - DEFAULT_CAPTURE_RATE) > 0.001);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              ⚠ Mixed-scope program — grid shows weighted-avg cost. Per-scope detail in M22.
            </span>
          )}
          {!hasCeilingData && (
            <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569', fontStyle: 'italic' }}>
              · Comp ceiling unavailable — run Cashflow Agent to populate
            </span>
          )}
          {aggregate.missingCostCount > 0 && (
            <span style={{
              fontFamily: MONO, fontSize: 8, color: '#f59e0b',
              background: '#1a1200', border: '1px solid #f59e0b44',
              borderRadius: 2, padding: '1px 5px',
            }}>
              Missing cost data for {aggregate.missingCostCount}/{sourceRows.length} floor plan{sourceRows.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Header controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Accept platform grid */}
          {hasCeilingData && (
            <button
              onClick={acceptPlatformGrid}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700,
                padding: '2px 8px', borderRadius: 2, cursor: 'pointer',
                background: '#0a1e2e', border: '1px solid #0891b2',
                color: '#06b6d4',
              }}
              title="Apply platform grid with P50 positioning across all floor plans"
            >
              ACCEPT PLATFORM GRID (P50)
            </button>
          )}

          {/* Global positioning override */}
          {hasCeilingData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontFamily: LABEL, fontSize: 8, color: '#475569' }}>Global:</span>
              {POSITIONING_OPTIONS.filter(o => o.value !== 0).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyGlobalPositioning(opt.value)}
                  style={{
                    fontFamily: MONO, fontSize: 8, fontWeight: 700,
                    padding: '2px 5px', borderRadius: 2, border: 'none', cursor: 'pointer',
                    background: globalPositioning === opt.value ? '#0891b2' : '#0c1a26',
                    color: globalPositioning === opt.value ? '#fff' : '#475569',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Reset capture rate */}
          {anyCaptureRateCustomized && (
            <button
              onClick={resetAllCaptureRates}
              style={{
                fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
                padding: '2px 6px', borderRadius: 2, cursor: 'pointer',
                background: '#0c1220', border: '1px solid #334155',
                color: '#64748b',
              }}
              title={`Reset all capture rates to portfolio default (${fmtPct(DEFAULT_CAPTURE_RATE, 0)})`}
            >
              RESET CAPTURE RATE → {fmtPct(DEFAULT_CAPTURE_RATE, 0)}
            </button>
          )}
        </div>
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
              const isCustom = rs.positioningPercentile === 0;
              const computedTarget = isCustom
                ? null
                : computePostRenoTarget(r.comp_ceiling, rs.positioningPercentile);
              const target = rs.postRenoTargetRent ?? computedTarget ?? r.post_reno_target_rent;
              const current = r.current_market_rent;
              const grossPremium = (target != null && current != null) ? target - current : null;
              const capturedPremium = grossPremium != null ? grossPremium * rs.captureRate : null;
              const yoc = computeYoC(current, target, rs.captureRate, rs.renoCostPerUnit);
              const yocBelowThreshold = yoc != null && yoc < YOC_THRESHOLD;
              const rowBg = idx % 2 === 0 ? '#060c14' : '#050a10';

              // Evidence-pill deviation flags (spec § 4)
              const platformTarget = r.post_reno_target_rent ?? computePostRenoTarget(r.comp_ceiling, 50);
              const targetDeviates = target != null && platformTarget != null &&
                Math.abs((target - platformTarget) / Math.max(platformTarget, 1)) > DOLLAR_DEVIATION_PCT;
              const platformCaptureRate = r.capture_rate ?? DEFAULT_CAPTURE_RATE;
              const captureDeviates = Math.abs(rs.captureRate - platformCaptureRate) > PCT_DEVIATION_BPS;
              const platformRenoCost = r.renovation_cost;
              const costDeviates = rs.renoCostPerUnit != null && platformRenoCost != null &&
                Math.abs((rs.renoCostPerUnit - platformRenoCost) / Math.max(platformRenoCost, 1)) > DOLLAR_DEVIATION_PCT;
              const hasWritebackError = !!writebackErrors[r.floor_plan_id];

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <select
                        value={rs.positioningPercentile}
                        onChange={e => updatePositioning(r.floor_plan_id, Number(e.target.value) as PositioningPct, r.comp_ceiling)}
                        style={{
                          background: '#0a1a26', border: '1px solid #1e3a4a',
                          color: '#06b6d4', fontFamily: MONO, fontSize: 8,
                          borderRadius: 2, padding: '1px 3px', cursor: 'pointer',
                          width: isCustom ? 60 : 60,
                        }}
                      >
                        {POSITIONING_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {/* Custom: show direct target rent input */}
                      {isCustom && (
                        <CustomTargetInput
                          value={rs.postRenoTargetRent}
                          onChange={v => updateCustomTarget(r.floor_plan_id, v)}
                        />
                      )}
                    </div>
                  </td>

                  {/* Post-Reno Target */}
                  <td style={{
                    ...cellStyle,
                    color: '#22c55e', fontWeight: 600,
                    background: targetDeviates ? '#0d1a0a' : undefined,
                    outline: targetDeviates ? '1px solid #f59e0b22' : undefined,
                  }}>
                    <div>
                      {!isCustom && (target != null ? fmtRent(target) : (hasCeilingData ? '—' : <span style={{ color: '#1e3a2a', fontStyle: 'italic' }}>no comps</span>))}
                      {isCustom && (
                        <span style={{ fontStyle: rs.postRenoTargetRent == null ? 'italic' : 'normal', color: rs.postRenoTargetRent != null ? '#22c55e' : '#334155' }}>
                          {rs.postRenoTargetRent != null ? fmtRent(rs.postRenoTargetRent) : 'edit above'}
                        </span>
                      )}
                      {/* Platform suggestion always shown as subtle hint (spec § 4 3-layer model):
                          - Deviating: amber warning with platform anchor
                          - Non-deviating: muted ghost to confirm the platform basis */}
                      {platformTarget != null && (
                        <div style={{ fontSize: 7, marginTop: 1, color: targetDeviates ? '#f59e0b' : '#1e3a2a' }}>
                          {targetDeviates ? '⚠ P50: ' : 'P50: '}{fmtRent(platformTarget)}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Premium */}
                  <td style={{ ...cellStyle, color: grossPremium != null && grossPremium > 0 ? '#34d399' : '#64748b' }}>
                    {grossPremium != null ? fmtRent(grossPremium) : '—'}
                  </td>

                  {/* Capture Rate — editable */}
                  <td style={{
                    ...cellStyle, padding: '2px 4px',
                    background: captureDeviates ? '#0d1a0a' : undefined,
                    outline: captureDeviates ? '1px solid #f59e0b22' : undefined,
                  }}>
                    <CaptureRateInput
                      value={rs.captureRate}
                      platformDefault={platformCaptureRate}
                      deviates={captureDeviates}
                      onChange={v => updateCaptureRate(r.floor_plan_id, v)}
                    />
                  </td>

                  {/* Reno Cost per Unit — editable + M22 write-back */}
                  {!postStabilizationView && (
                    <td style={{
                      ...cellStyle, padding: '2px 4px',
                      background: costDeviates ? '#0d0a14' : undefined,
                      outline: costDeviates ? '1px solid #f59e0b22' : undefined,
                    }}>
                      <RenoCostInput
                        value={rs.renoCostPerUnit}
                        platformDefault={platformRenoCost}
                        deviates={costDeviates}
                        hasWritebackError={hasWritebackError}
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
                        <span title={yocBelowThreshold ? 'Yield-on-cost below threshold — reno cost may exceed achievable premium' : undefined}>
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
              <td style={{ ...footerStyle, color: '#64748b', fontSize: 8 }}>—</td>
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

// ─── Custom Target Rent inline editor ─────────────────────────────────────────

function CustomTargetInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
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
        placeholder="$rent"
        style={{
          width: 56, background: '#0a1a26', border: '1px solid #22c55e',
          color: '#22c55e', fontFamily: MONO, fontSize: 8, borderRadius: 2, padding: '1px 3px',
        }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value != null ? String(Math.round(value)) : ''); setEditing(true); }}
      title="Enter custom post-reno target rent"
      style={{
        cursor: 'pointer',
        color: value != null ? '#22c55e' : '#334155',
        borderBottom: '1px dotted #1a3a2a',
        fontStyle: value == null ? 'italic' : 'normal',
        fontSize: 8,
      }}
    >
      {value != null ? fmtRent(value) : 'set $'}
    </span>
  );
}

// ─── Capture Rate inline editor ───────────────────────────────────────────────

function CaptureRateInput({
  value,
  platformDefault,
  deviates,
  onChange,
}: {
  value: number;
  platformDefault: number;
  deviates: boolean;
  onChange: (v: number) => void;
}) {
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
    <div>
      <span
        onClick={() => { setDraft((value * 100).toFixed(0)); setEditing(true); }}
        title="Click to edit capture rate"
        style={{
          cursor: 'pointer',
          color: deviates ? '#f59e0b' : '#94a3b8',
          borderBottom: `1px dotted ${deviates ? '#f59e0b55' : '#334155'}`,
          fontSize: 9,
        }}
      >
        {fmtPct(value, 0)}
      </span>
      {/* Platform suggestion hint when deviating */}
      {deviates && (
        <div style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>
          platform: {fmtPct(platformDefault, 0)}
        </div>
      )}
    </div>
  );
}

// ─── Reno Cost inline editor ──────────────────────────────────────────────────

function RenoCostInput({
  value,
  platformDefault,
  deviates,
  hasWritebackError,
  onChange,
}: {
  value: number | null;
  platformDefault: number | null;
  deviates: boolean;
  hasWritebackError: boolean;
  onChange: (v: number | null) => void;
}) {
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
    <div>
      <span
        onClick={() => { setDraft(value != null ? String(Math.round(value)) : ''); setEditing(true); }}
        title={hasWritebackError
          ? 'M22 write failed — click to retry'
          : 'Click to edit renovation cost per unit — writes back to M22 capex schedule'}
        style={{
          cursor: 'pointer',
          color: hasWritebackError ? '#ef4444' : (deviates ? '#f59e0b' : (value != null ? '#a78bfa' : '#2a1a3a')),
          borderBottom: `1px dotted ${hasWritebackError ? '#ef444455' : (value != null ? '#5b21b6' : '#2a1a3a')}`,
          fontStyle: value == null ? 'italic' : 'normal',
          fontSize: 9,
        }}
      >
        {value != null ? fmtCost(value) : 'set cost'}
        {hasWritebackError && <span style={{ marginLeft: 4, fontSize: 8 }} title="Save to M22 failed — retry">⚠</span>}
      </span>
      {/* Platform suggestion hint when deviating */}
      {deviates && platformDefault != null && (
        <div style={{ fontSize: 7, color: '#64748b', marginTop: 1 }}>
          platform: {fmtCost(platformDefault)}
        </div>
      )}
    </div>
  );
}
