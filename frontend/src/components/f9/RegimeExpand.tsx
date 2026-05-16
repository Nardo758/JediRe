/**
 * RegimeExpand — Pattern B expand component
 *
 * Two sub-rows for line items with a regime split but no per-floor-plan
 * variation: turnover, R&M, marketing, vacancy, concessions,
 * contract_services.
 *
 * Sub-rows:
 *   Pre-Renovation  — in-progress renovation environment (elevated costs,
 *                     displacement loss, active construction)
 *   Post-Stabilization — normalized stabilized economics
 *
 * Data: consumed from regimeData prop when cashflow agent has produced
 * per-regime values. Falls back to the single proforma row resolved value
 * with a placeholder note when regime split is not yet available.
 */

import React from 'react';
import { BT } from '../deal/bloomberg-ui';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── Data shape ───────────────────────────────────────────────────────────────

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
}

interface Props {
  field: string;
  label: string;
  resolvedValue: number | null;
  regimeData?: RegimeData | null;
  totalUnits?: number;
  egiResolved?: number | null;
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
        {isPlaceholder ? 'pending agent run' : fmt$(val)}
      </td>

      {/* % of EGI */}
      <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 8.5, color: '#334155' }}>
        {isPlaceholder ? '—' : pctOfEgi(val, egiResolved ?? null)}
      </td>

      {/* Source badge */}
      <td style={{ padding: '3px 8px', textAlign: 'left', fontSize: 7.5 }}>
        {src && (
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
      <td style={{ padding: '3px 8px', fontSize: 8, color: '#334155', fontStyle: 'italic', fontFamily: LABEL }}>
        {rv?.note ?? ''}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RegimeExpand({ field: _field, label, resolvedValue, regimeData, totalUnits, egiResolved }: Props) {
  const hasData = regimeData != null && (
    regimeData.pre_renovation.value != null ||
    regimeData.post_stabilization.value != null
  );

  if (!hasData) {
    return (
      <>
        {/* Pre-renovation row — placeholder */}
        <RegimeRow
          regimeLabel="Pre-Renovation"
          accentColor="#f59e0b"
          rv={{ value: null, source: null }}
          totalUnits={totalUnits}
          egiResolved={egiResolved}
          isPlaceholder
        />

        {/* Post-stabilization row — show resolved value as proxy */}
        <RegimeRow
          regimeLabel="Post-Stabilization"
          accentColor="#22c55e"
          rv={{
            value: resolvedValue,
            source: 'platform',
            note: 'stabilized projection',
          }}
          totalUnits={totalUnits}
          egiResolved={egiResolved}
        />

        {/* Hint */}
        <tr style={{ background: '#040a0e' }}>
          <td colSpan={9} style={{
            padding: '2px 8px 2px 28px', fontSize: 7.5, color: '#1e2a38',
            fontFamily: LABEL, fontStyle: 'italic',
          }}>
            Run Cashflow Agent to populate per-regime values for {label}
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <RegimeRow
        regimeLabel="Pre-Renovation"
        accentColor="#f59e0b"
        rv={regimeData.pre_renovation}
        totalUnits={totalUnits}
        egiResolved={egiResolved}
      />

      {regimeData.transition_year && (
        <RegimeRow
          regimeLabel="Transition Year"
          accentColor="#a78bfa"
          rv={regimeData.transition_year}
          totalUnits={totalUnits}
          egiResolved={egiResolved}
        />
      )}

      <RegimeRow
        regimeLabel="Post-Stabilization"
        accentColor="#22c55e"
        rv={regimeData.post_stabilization}
        totalUnits={totalUnits}
        egiResolved={egiResolved}
      />
    </>
  );
}
