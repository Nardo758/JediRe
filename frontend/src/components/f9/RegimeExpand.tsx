/**
 * RegimeExpand — Pattern B expand component
 *
 * Two sub-rows for line items with a regime split but no per-floor-plan
 * variation: turnover, R&M, marketing, vacancy, concessions,
 * contract_services, bad_debt, other_income, utilities.
 *
 * Sub-rows (per spec § 2.2):
 *   Pre-Renovation  — in-progress renovation environment (Y1 through
 *                     stabilization year − 1). Sourced from T12 trailing
 *                     actuals when cashflow agent has not yet run.
 *   Post-Stabilization — normalized stabilized economics (Y3 onward).
 *                     Always shows the proforma resolved value when agent
 *                     data is absent.
 *   Transition Year — optional; rendered when agent produces a phased
 *                     bridge value between the two regimes.
 *
 * Props:
 *   t12Value      — trailing 12-month actual value; used as pre-renovation
 *                   baseline when regimeData is null (meaningful even before
 *                   the agent runs).
 *   postStabView  — when true, hides the pre-renovation row (post-stab
 *                   column view for the parent Pro Forma surface).
 *   regimeData    — rich per-regime values from the cashflow agent. When
 *                   present, overrides the derived fallback display.
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── Data shapes ──────────────────────────────────────────────────────────────

export interface RegimeValue {
  value: number | null;
  source: string | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  note?: string | null;
}

export interface RegimeData {
  pre_renovation: RegimeValue;
  post_stabilization: RegimeValue;
  transition_year?: RegimeValue | null;
  /**
   * Human-readable timing label sourced from M22 capex_schedule.transition_month
   * by the cashflow agent. Examples: "Y3", "Month 28", "Post unit-#-completion".
   * When present, displayed in the regime sub-header so the operator can see
   * exactly when the pre-renovation regime ends without navigating to M22.
   */
  transition_timing_label?: string | null;
}

interface Props {
  field: string;
  label: string;
  resolvedValue: number | null;
  t12Value?: number | null;
  regimeData?: RegimeData | null;
  totalUnits?: number;
  egiResolved?: number | null;
  postStabView?: boolean;
  /**
   * Total column count of the parent Pro Forma table.
   * 9 in BUILD_OWN (all data columns); 7 in BROKER_VIEW (T-period + Platform
   * hidden). Sub-header rows use this to avoid colSpan misalignment.
   * Defaults to 9.
   */
  tableColCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(n).toLocaleString()}`;
}

function pctOfEgi(val: number | null, egi: number | null): string {
  if (val == null || egi == null || egi === 0) return '—';
  return `${((Math.abs(val) / Math.abs(egi)) * 100).toFixed(1)}%`;
}

function perUnit(val: number | null, units: number | undefined): string {
  if (val == null || !units || units === 0) return '—';
  return `$${Math.round(Math.abs(val) / units).toLocaleString()}/u`;
}

function fmtDelta(pre: number | null, post: number | null): string {
  if (pre == null || post == null) return '—';
  const d = post - pre;
  const sign = d >= 0 ? '+' : '';
  if (Math.abs(d) >= 1_000_000) return `${sign}$${(d / 1_000_000).toFixed(2)}M`;
  return `${sign}$${Math.round(d).toLocaleString()}`;
}

const SOURCE_COLOR: Record<string, string> = {
  agent: '#a78bfa',
  platform: '#06b6d4',
  broker: '#f59e0b',
  archive: '#60a5fa',
  t12: '#34d399',
  default: '#475569',
};

function sourceColor(src: string | null): string {
  if (!src) return SOURCE_COLOR.default;
  return SOURCE_COLOR[src.toLowerCase()] ?? SOURCE_COLOR.default;
}

const CONFIDENCE_COLORS = {
  high:   '#22c55e',
  medium: '#f59e0b',
  low:    '#ef4444',
};

// ─── Regime row ───────────────────────────────────────────────────────────────

function RegimeRow({
  regimeLabel,
  accentColor,
  rv,
  totalUnits,
  egiResolved,
  isPlaceholder,
}: {
  regimeLabel: string;
  accentColor: string;
  rv: RegimeValue | null;
  totalUnits?: number;
  egiResolved?: number | null;
  isPlaceholder?: boolean;
}) {
  const val = rv?.value ?? null;
  const src = rv?.source ?? null;

  return (
    <tr style={{ background: '#060c14', borderLeft: `2px solid ${accentColor}22` }}>
      {/* Label indent */}
      <td style={{
        padding: '3px 8px 3px 24px', fontFamily: LABEL, fontSize: 8.5,
        color: accentColor, position: 'sticky', left: 0, background: '#060c14',
        whiteSpace: 'nowrap', minWidth: 160,
      }}>
        <span style={{ color: accentColor, marginRight: 4, fontSize: 8 }}>↳</span>
        {regimeLabel}
        {rv?.confidence && (
          <span style={{
            marginLeft: 5, fontFamily: MONO, fontSize: 7, fontWeight: 700,
            color: CONFIDENCE_COLORS[rv.confidence], letterSpacing: '0.04em',
          }}>
            {rv.confidence.toUpperCase()[0]}
          </span>
        )}
      </td>

      {/* Broker placeholder */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#2a2010' }}>—</td>

      {/* T-period placeholder */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#1e2538' }}>—</td>

      {/* Platform placeholder */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#1e2538' }}>—</td>

      {/* Resolved (regime value) */}
      <td style={{
        padding: '3px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 9, fontWeight: 600,
        color: isPlaceholder ? '#334155' : '#e2e8f0',
        fontStyle: isPlaceholder ? 'italic' : 'normal',
        background: '#07101a',
        borderLeft: '1px solid #0e2235', borderRight: '1px solid #0e2235',
      }}>
        {isPlaceholder ? (
          <span style={{ color: '#334155', fontSize: 8 }}>pending agent run</span>
        ) : fmt$(val)}
      </td>

      {/* % of EGI */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#334155' }}>
        {isPlaceholder ? '—' : pctOfEgi(val, egiResolved ?? null)}
      </td>

      {/* Source badge */}
      <td style={{ padding: '3px 8px', textAlign: 'left', fontSize: 7.5 }}>
        {!isPlaceholder && src && (
          <span style={{
            fontFamily: MONO, color: sourceColor(src),
            background: `${sourceColor(src)}14`,
            border: `1px solid ${sourceColor(src)}33`,
            borderRadius: 2, padding: '0px 4px', fontSize: 7,
            fontWeight: 700, letterSpacing: '0.06em',
          }}>
            {src.toUpperCase()}
          </span>
        )}
      </td>

      {/* $/unit */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#334155' }}>
        {isPlaceholder ? '—' : perUnit(val, totalUnits)}
      </td>

      {/* Note */}
      <td style={{ padding: '3px 8px', fontSize: 8, color: '#475569', fontStyle: 'italic', fontFamily: LABEL }}>
        {rv?.note ?? ''}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RegimeExpand({
  field: _field,
  label,
  resolvedValue,
  t12Value,
  regimeData,
  totalUnits,
  egiResolved,
  postStabView = false,
  tableColCount = 9,
}: Props) {
  const hasAgentData = regimeData != null && (
    regimeData.pre_renovation.value != null ||
    regimeData.post_stabilization.value != null
  );

  // Derive pre-renovation proxy from T12 when agent hasn't run yet.
  // T12 trailing actuals represent the current in-place (pre-renovation)
  // operating environment — the best available pre-reno baseline.
  const derivedPreReno: RegimeValue | null = !hasAgentData && t12Value != null
    ? { value: t12Value, source: 't12', note: 'trailing 12-month actual (pre-reno baseline)' }
    : null;

  const preRenoRv: RegimeValue | null = hasAgentData
    ? regimeData!.pre_renovation
    : derivedPreReno;

  const postStabRv: RegimeValue = hasAgentData
    ? regimeData!.post_stabilization
    : { value: resolvedValue, source: 'platform', note: 'pro forma stabilized projection' };

  const transitionRv: RegimeValue | null = hasAgentData && regimeData!.transition_year
    ? regimeData!.transition_year
    : null;

  // Delta between pre-reno and post-stab for the sub-header
  const delta = fmtDelta(preRenoRv?.value ?? null, postStabRv.value);
  const preIsPlaceholder = !hasAgentData && derivedPreReno == null;

  return (
    <>
      {/* Regime sub-header */}
      <tr style={{ background: '#040a10' }}>
        <td colSpan={tableColCount} style={{
          padding: '2px 8px 2px 24px', fontFamily: MONO, fontSize: 7.5,
          color: '#1e3a4a', letterSpacing: '0.04em', borderBottom: '1px solid #0a1520',
        }}>
          PRE-RENOVATION → POST-STABILIZATION
          {/* Transition timing from M22 capex_schedule when available */}
          {regimeData?.transition_timing_label && (
            <span style={{
              marginLeft: 8, fontFamily: MONO, fontSize: 7.5,
              color: '#a78bfa', background: '#1a1030',
              border: '1px solid #a78bfa33', borderRadius: 2,
              padding: '0px 5px', letterSpacing: '0.04em',
            }}>
              M22 → {regimeData.transition_timing_label}
            </span>
          )}
          {!hasAgentData && (
            <span style={{ marginLeft: 8, color: '#1a2a1a', fontStyle: 'italic' }}>
              {derivedPreReno != null
                ? '· pre-reno from T12 actuals · post-stab from platform proforma'
                : '· run Cashflow Agent for per-regime values'}
            </span>
          )}
          {preRenoRv?.value != null && postStabRv.value != null && (
            <span style={{
              marginLeft: 12, fontFamily: MONO, fontSize: 7,
              color: delta.startsWith('+') ? '#1a3a2a' : '#3a1a1a',
            }}>
              Δ {delta}
            </span>
          )}
        </td>
      </tr>

      {/* Pre-renovation row — hidden in post-stab view */}
      {!postStabView && (
        <RegimeRow
          regimeLabel="Pre-Renovation"
          accentColor="#f59e0b"
          rv={preRenoRv}
          totalUnits={totalUnits}
          egiResolved={egiResolved}
          isPlaceholder={preIsPlaceholder}
        />
      )}

      {/* Transition year row (agent data only) */}
      {!postStabView && transitionRv && (
        <RegimeRow
          regimeLabel="Transition Year"
          accentColor="#a78bfa"
          rv={transitionRv}
          totalUnits={totalUnits}
          egiResolved={egiResolved}
        />
      )}

      {/* Post-stabilization row */}
      <RegimeRow
        regimeLabel="Post-Stabilization"
        accentColor="#22c55e"
        rv={postStabRv}
        totalUnits={totalUnits}
        egiResolved={egiResolved}
      />
    </>
  );
}
