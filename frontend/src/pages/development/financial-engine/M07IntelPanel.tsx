// ============================================================================
// M07IntelPanel — Read-only M07 Traffic Engine intelligence panel
// Mounted at top of LEASING sub-tab, above Cat A–J assumption schedule.
// ============================================================================
//
// ARCHITECTURAL RULES:
//   - READ-ONLY: no patch handlers, no dealStore writes, no editable fields.
//   - DATA SOURCE: consumes F9DealFinancials.trafficProjection directly.
//   - MODE RESOLUTION: trafficProjection.mode.effective → leaseVelocity.resolvedMode
//     (matches precedence in AssumptionsTab.tsx:resolveLeaseMode).
//   - STYLE: raw hex only — matches LeasingAssumptionsTab palette, no BT tokens.
//   - LABELING: T-06 here = "Current Lease Velocity" (point-in-time leasingSignals).
//     Projections tab Y1 Leases column = per-year projection. Different time slices.
//   - PEER BENCHMARK: peerBenchmark.peerDistribution P50 = city market avg; P25/P75
//     are null until per-property distribution data is seeded. Chips show '—' gracefully.
// ============================================================================

import React, { useState } from 'react';
import type { F9DealFinancials } from './types';

const MONO = "'JetBrains Mono','Fira Code',monospace";

// ─── Palette (matches LeasingAssumptionsTab raw hex) ──────────────────────────

const P = {
  bg:        '#0a0a0a',
  bgPanel:   '#0d0d0d',
  bgHeader:  '#111111',
  border:    '#1e1e1e',
  borderSub: '#161616',
  textMuted: '#334155',
  textSec:   '#475569',
  textPrim:  '#94a3b8',
  textBrt:   '#cbd5e1',
  traffic:   '#22d3ee',  // M07 / traffic accent
  green:     '#10b981',
  amber:     '#f59e0b',
  red:       '#ef4444',
  purple:    '#c4b5fd',
  blue:      '#a5b4fc',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaseMode =
  | 'LEASE_UP_NEW_CONSTRUCTION'
  | 'STABILIZED_MAINTENANCE'
  | 'OCCUPANCY_RECOVERY'
  | 'VALUE_ADD'
  | 'REDEVELOPMENT';

interface Props {
  financials: F9DealFinancials | null;
}

// ─── Mode resolution ──────────────────────────────────────────────────────────

function resolveLeaseMode(financials: F9DealFinancials | null): LeaseMode | null {
  const raw =
    (financials as any)?.trafficProjection?.mode?.effective ??
    (financials as any)?.leaseVelocity?.resolvedMode ??
    null;
  if (!raw) return null;
  if (raw === 'V2_PENDING_VALUE_ADD') return 'VALUE_ADD';
  const VALID: LeaseMode[] = [
    'LEASE_UP_NEW_CONSTRUCTION', 'STABILIZED_MAINTENANCE',
    'OCCUPANCY_RECOVERY', 'VALUE_ADD', 'REDEVELOPMENT',
  ];
  return VALID.includes(raw as LeaseMode) ? (raw as LeaseMode) : null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined, dp = 1): string {
  if (v == null) return '—';
  return (v * 100).toFixed(dp) + '%';
}
function fmtNum(v: number | null | undefined, dp = 1): string {
  if (v == null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(dp);
}
function fmtDlr(v: number | null | undefined): string {
  if (v == null) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function fmtWks(v: number | null | undefined): string {
  if (v == null) return '—';
  return Math.round(v) + ' wks';
}
function relDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const mo = Math.floor(days / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(mo / 12)}yr ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiChip({ label, value, accent = P.textPrim }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      padding: '4px 10px',
      background: P.bgPanel,
      border: `1px solid ${P.border}`,
      borderRadius: 2,
      minWidth: 80,
    }}>
      <span style={{ fontFamily: MONO, fontSize: 6, color: P.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: accent, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

function CollapsiblePanel({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: `1px solid ${P.border}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 12px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 7, color: P.textSec }}>
          {open ? '▾' : '▸'}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textSec, letterSpacing: 0.6 }}>
          {title}
        </span>
      </button>
      {open && (
        <div style={{ padding: '4px 12px 8px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PendingNote({ field }: { field: string }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
      {field}: pending M07 backend wiring
    </span>
  );
}

// ─── Mode label helper ────────────────────────────────────────────────────────

function modeLabelColor(mode: LeaseMode | null): { label: string; color: string; bg: string } {
  switch (mode) {
    case 'LEASE_UP_NEW_CONSTRUCTION': return { label: 'LEASE-UP',     color: P.blue,   bg: '#3730a322' };
    case 'OCCUPANCY_RECOVERY':        return { label: 'RECOVERY',     color: P.amber,  bg: '#78350f22' };
    case 'VALUE_ADD':                 return { label: 'VALUE-ADD',    color: P.purple, bg: '#7c3aed22' };
    case 'REDEVELOPMENT':             return { label: 'REDEVELOPMENT',color: P.purple, bg: '#7c3aed22' };
    case 'STABILIZED_MAINTENANCE':
    default:                          return { label: 'STABILIZED',   color: P.green,  bg: '#14532d22' };
  }
}

// ─── KPI strips by mode ───────────────────────────────────────────────────────

function StabilizedKpis({
  sig, leaseUp,
}: {
  sig: NonNullable<F9DealFinancials['trafficProjection']>['leasingSignals'];
  leaseUp: NonNullable<F9DealFinancials['trafficProjection']>['leaseUp'];
}) {
  const wks95 = leaseUp?.weeksTo95 ?? sig?.t07LeaseUpWeeksTo95;
  return (
    <>
      <KpiChip label="T-01 Walk-Ins/wk" value={fmtNum(sig?.t01WeeklyTours)} accent={P.traffic} />
      <KpiChip label="T-05 Capture %" value={fmtPct(sig?.t05ClosingRatio != null ? (sig.t05ClosingRatio > 1 ? sig.t05ClosingRatio / 100 : sig.t05ClosingRatio) : null)} accent={P.traffic} />
      <KpiChip label="T-06 Curr Lease Vel" value={sig?.t06WeeklyLeases != null ? fmtNum(sig.t06WeeklyLeases) + '/wk' : '—'} accent={P.traffic} />
      <KpiChip label="Stab Occ Target" value={fmtPct(sig?.stabilizedOccupancyPct)} />
      <KpiChip label="Wks to 95% Stab" value={fmtWks(wks95)} />
    </>
  );
}

function LeaseUpKpis({
  sig, leaseUp,
}: {
  sig: NonNullable<F9DealFinancials['trafficProjection']>['leasingSignals'];
  leaseUp: NonNullable<F9DealFinancials['trafficProjection']>['leaseUp'];
}) {
  const velMo = sig?.t06WeeklyLeases != null ? Math.round(sig.t06WeeklyLeases * 4.33) : null;
  return (
    <>
      <KpiChip label="Current Lease Vel" value={velMo != null ? velMo + '/mo' : '—'} accent={P.blue} />
      <KpiChip label="Wks to 90% Occ" value={fmtWks(leaseUp?.weeksTo90)} accent={P.blue} />
      <KpiChip label="Wks to 95% Stab" value={fmtWks(leaseUp?.weeksTo95 ?? sig?.t07LeaseUpWeeksTo95)} accent={P.blue} />
      <KpiChip label="Stab Occ Target" value={fmtPct(sig?.stabilizedOccupancyPct)} />
      <KpiChip label="Pre-Leased %" value={fmtPct(sig?.preLeasedPct)} accent={P.blue} />
    </>
  );
}

function ValueAddKpis({
  sig,
}: {
  sig: NonNullable<F9DealFinancials['trafficProjection']>['leasingSignals'];
}) {
  return (
    <>
      <KpiChip label="T-06 Curr Lease Vel" value={sig?.t06WeeklyLeases != null ? fmtNum(sig.t06WeeklyLeases) + '/wk' : '—'} accent={P.purple} />
      <KpiChip label="Stab Occ Target" value={fmtPct(sig?.stabilizedOccupancyPct)} accent={P.purple} />
      <KpiChip label="Peak Down Units" value={sig?.peakDownUnits != null ? String(sig.peakDownUnits) + ' units' : '—'} accent={P.purple} />
      <KpiChip label="Post-Reno Lag" value={sig?.postRenoAbsorptionLagWks != null ? fmtNum(sig.postRenoAbsorptionLagWks, 1) + ' wks' : '—'} accent={P.amber} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function M07IntelPanel({ financials }: Props) {
  const tp = financials?.trafficProjection ?? null;
  const mode = resolveLeaseMode(financials);
  const ml = modeLabelColor(mode);

  // ── Offline / uncalibrated state ─────────────────────────────────────────
  if (!tp) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: P.bgHeader,
        borderBottom: `1px solid ${P.border}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textMuted, letterSpacing: 0.6 }}>
          M07 TRAFFIC ENGINE
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: P.amber, fontStyle: 'italic' }}>
          Not yet calibrated for this deal — run a traffic prediction to surface leasing signals
        </span>
      </div>
    );
  }

  const sig          = tp.leasingSignals;
  const calibrated   = tp.calibrated;
  const leaseUp      = tp.leaseUp;
  const yr1          = tp.yearly[0] ?? null;
  const peerBenchmark = (tp as any).peerBenchmark ?? null;
  const confPct   = sig?.confidence != null ? Math.round(sig.confidence * 100) : null;
  const confColor = confPct == null ? P.textMuted : confPct >= 75 ? P.green : confPct >= 50 ? P.amber : P.red;

  return (
    <div style={{
      background: P.bgHeader,
      borderBottom: `2px solid ${P.border}`,
      flexShrink: 0,
    }}>
      {/* ── Panel header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px',
        borderBottom: `1px solid ${P.borderSub}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.traffic, letterSpacing: 0.8 }}>
          M07 TRAFFIC ENGINE INTEL
        </span>

        {/* Mode badge */}
        <span style={{
          fontFamily: MONO, fontSize: 6, fontWeight: 700, letterSpacing: 0.5,
          padding: '1px 6px', borderRadius: 2,
          background: ml.bg, color: ml.color,
          border: `1px solid ${ml.color}33`,
        }}>
          {ml.label}
        </span>

        <div style={{ flex: 1 }} />

        {/* Confidence pill */}
        {confPct != null && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: confColor }}>
            {confPct}% confidence
          </span>
        )}

        {/* Last calibrated */}
        {calibrated?.lastCalibrated && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted }}>
            · calibrated {relDate(calibrated.lastCalibrated)}
          </span>
        )}
      </div>

      {/* ── KPI strip ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 6,
        padding: '6px 12px',
        flexWrap: 'wrap',
      }}>
        {(mode === 'LEASE_UP_NEW_CONSTRUCTION')
          ? <LeaseUpKpis sig={sig} leaseUp={leaseUp} />
          : (mode === 'VALUE_ADD' || mode === 'REDEVELOPMENT')
          ? <ValueAddKpis sig={sig} />
          : <StabilizedKpis sig={sig} leaseUp={leaseUp} />
        }
      </div>

      {/* ── Collapsible sub-panels ── */}

      {/* Derived Projections (Y1) */}
      <CollapsiblePanel title="DERIVED PROJECTIONS — YR 1">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {([
            { label: 'Vacancy %',    val: yr1?.vacancyPct   != null ? fmtPct(yr1.vacancyPct)   : '—' },
            { label: 'Eff. Rent',    val: yr1?.effRent      != null ? fmtDlr(yr1.effRent)      : '—' },
            { label: 'Rent Growth',  val: yr1?.rentGrowthPct!= null ? fmtPct(yr1.rentGrowthPct): '—' },
            { label: 'Occupancy %',  val: yr1?.occupancyPct != null ? fmtPct(yr1.occupancyPct) : '—' },
          ] as { label: string; val: string }[]).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: r.val === '—' ? P.textMuted : P.textPrim }}>{r.val}</span>
            </div>
          ))}
          <div style={{ marginTop: 2, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
            <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
              Per-year time-series available in Projections tab (Traffic Funnel panel)
            </span>
          </div>
        </div>
      </CollapsiblePanel>

      {/* Confidence & Calibration detail */}
      <CollapsiblePanel title="CALIBRATION DETAIL">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {([
            { label: 'M07 Confidence',    val: confPct != null ? confPct + '%' : '—', accent: confColor },
            { label: 'Calibrated Vacancy',val: calibrated?.vacancyPct   != null ? fmtPct(calibrated.vacancyPct)    : '—', accent: P.textPrim },
            { label: 'Calibrated Rent Gr',val: calibrated?.rentGrowthPct!= null ? fmtPct(calibrated.rentGrowthPct) : '—', accent: P.textPrim },
            { label: 'Calibrated Exit Cap',val: calibrated?.exitCap      != null ? fmtPct(calibrated.exitCap)       : '—', accent: P.textPrim },
          ] as { label: string; val: string; accent: string }[]).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>{r.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: r.val === '—' ? P.textMuted : r.accent }}>{r.val}</span>
            </div>
          ))}
          {calibrated?.lastCalibrated && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Last Calibrated</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textMuted }}>
                {new Date(calibrated.lastCalibrated).toLocaleDateString()} ({relDate(calibrated.lastCalibrated)})
              </span>
            </div>
          )}
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
            <PendingNote field="Confidence bands (P10/P25/P75/P90)" />
          </div>
        </div>
      </CollapsiblePanel>

      {/* Peer Benchmark */}
      <CollapsiblePanel title="PEER BENCHMARK">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Peer count row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Peer Properties (n)</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: peerBenchmark?.nPeerProperties != null ? P.textPrim : P.textMuted }}>
              {peerBenchmark?.nPeerProperties != null ? peerBenchmark.nPeerProperties + ' props' : '—'}
            </span>
          </div>

          {/* Submarket percentile — rent */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Rent Percentile</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: peerBenchmark?.submarketPercentile?.rent != null ? P.traffic : P.textMuted }}>
              {peerBenchmark?.submarketPercentile?.rent != null ? 'P' + peerBenchmark.submarketPercentile.rent : '—'}
            </span>
          </div>

          {/* Distribution header */}
          <div style={{ marginTop: 3, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
            <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textSec, letterSpacing: 0.4 }}>
              MARKET DISTRIBUTION (P25 · P50 · P75)
            </span>
          </div>

          {/* Vacancy distribution */}
          {(() => {
            const d = peerBenchmark?.peerDistribution?.vacancy;
            const p25 = d?.p25 != null ? fmtPct(d.p25)  : '—';
            const p50 = d?.p50 != null ? fmtPct(d.p50)  : '—';
            const p75 = d?.p75 != null ? fmtPct(d.p75)  : '—';
            const hasData = p25 !== '—' || p50 !== '—' || p75 !== '—';
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Vacancy %</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: hasData ? P.textPrim : P.textMuted }}>
                  {p25} · {p50} · {p75}
                </span>
              </div>
            );
          })()}

          {/* Rent distribution */}
          {(() => {
            const d = peerBenchmark?.peerDistribution?.rent;
            const p25 = d?.p25 != null ? fmtDlr(d.p25)  : '—';
            const p50 = d?.p50 != null ? fmtDlr(d.p50)  : '—';
            const p75 = d?.p75 != null ? fmtDlr(d.p75)  : '—';
            const hasData = p25 !== '—' || p50 !== '—' || p75 !== '—';
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Eff. Rent</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: hasData ? P.textPrim : P.textMuted }}>
                  {p25} · {p50} · {p75}
                </span>
              </div>
            );
          })()}

          {/* Lease velocity distribution */}
          {(() => {
            const d = peerBenchmark?.peerDistribution?.leaseVelocity;
            const fmt = (v: number|null|undefined) => v != null ? fmtNum(v, 2) + '/wk' : '—';
            const p25 = fmt(d?.p25);
            const p50 = fmt(d?.p50);
            const p75 = fmt(d?.p75);
            const hasData = p25 !== '—' || p50 !== '—' || p75 !== '—';
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Lease Velocity</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: hasData ? P.textPrim : P.textMuted }}>
                  {p25} · {p50} · {p75}
                </span>
              </div>
            );
          })()}

          {/* Data source / no-data note */}
          <div style={{ marginTop: 2, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
            {peerBenchmark == null ? (
              <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
                No market snapshot for this deal's city — enter deal city or seed deal_market_data
              </span>
            ) : (
              <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted }}>
                Source: {peerBenchmark.dataSource ?? 'unknown'} · P25/P75 pending per-property distribution
              </span>
            )}
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
