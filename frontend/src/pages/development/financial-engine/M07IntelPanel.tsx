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
//   - MARKET DATA: fetched independently from /api/v1/market-research/report/:dealId.
//     Shows demand_indicators (occupancy, avg rent by bedroom type, comparable count).
//     Refresh button triggers POST /api/v1/market-research/generate/:dealId when stale.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
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

interface DemandIndicators {
  avg_occupancy_rate: number | null;
  occupancy_trend: 'UP' | 'STABLE' | 'DOWN' | 'UNKNOWN' | null;
  avg_rent_studio: number | null;
  avg_rent_1br: number | null;
  avg_rent_2br: number | null;
  avg_rent_3br: number | null;
  rent_growth_6mo: number | null;
  rent_growth_12mo: number | null;
  properties_in_market: number | null;
  competitive_pressure: 'LOW' | 'MEDIUM' | 'HIGH' | null;
}

interface MarketDataState {
  status: 'idle' | 'loading' | 'ok' | 'error' | 'refreshing';
  indicators: DemandIndicators | null;
  generatedAt: string | null;
  hoursOld: number | null;
  error: string | null;
}

interface Props {
  financials: F9DealFinancials | null;
  dealId?: string | null;
  hasLatLng?: boolean;
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

// ─── Market Data section ──────────────────────────────────────────────────────

function MarketDataPanel({ dealId, hasLatLng = true }: { dealId: string; hasLatLng?: boolean }) {
  const [state, setState] = useState<MarketDataState>({
    status: 'idle',
    indicators: null,
    generatedAt: null,
    hoursOld: null,
    error: null,
  });

  const fetchReport = useCallback(async (forceRefresh = false) => {
    setState(prev => ({
      ...prev,
      status: forceRefresh ? 'refreshing' : 'loading',
      error: null,
    }));
    try {
      let res: Response;
      if (forceRefresh) {
        // Backend route is POST /generate/:dealId — generates a fresh report
        res = await fetch(`/api/v1/market-research/generate/${dealId}`, { method: 'POST' });
      } else {
        // Pass maxAge=876000 (~100 years) so we always get the latest cached report
        // regardless of age, then compute staleness client-side from generated_at.
        res = await fetch(`/api/v1/market-research/report/${dealId}?maxAge=876000`);
      }

      if (res.status === 404) {
        if (!forceRefresh && hasLatLng) {
          // No report yet — auto-generate on first view when the deal has coordinates
          fetchReport(true);
          return;
        }
        setState({ status: 'ok', indicators: null, generatedAt: null, hoursOld: null, error: null });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState(prev => ({ ...prev, status: 'error', error: body?.error ?? `HTTP ${res.status}` }));
        return;
      }

      const body = await res.json();
      // GET /report/:dealId returns { success, report, generated_at, cached }
      //   where `report` is the MarketResearchReport JSONB object and
      //   `generated_at` is a top-level field from the DB row.
      // POST /generate/:dealId also returns { success, report } — fall back to
      //   report.generated_at if the top-level field is absent (generate route).
      const report = body?.report ?? body;
      const indicators: DemandIndicators = report?.demand_indicators ?? null;
      const generatedAt: string | null =
        body?.generated_at ?? report?.generated_at ?? null;

      let hoursOld: number | null = null;
      if (generatedAt) {
        hoursOld = (Date.now() - new Date(generatedAt).getTime()) / 3_600_000;
      }

      setState({ status: 'ok', indicators, generatedAt, hoursOld, error: null });
    } catch (err: any) {
      setState(prev => ({ ...prev, status: 'error', error: err?.message ?? 'Network error' }));
    }
  }, [dealId, hasLatLng]);

  useEffect(() => {
    fetchReport(false);
  }, [fetchReport]);

  const isStale = state.hoursOld != null && state.hoursOld > 24;
  const isLoading = state.status === 'loading' || state.status === 'refreshing';

  const handleDownloadPdf = useCallback(() => {
    const ind = state.indicators;
    if (!ind) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentW = W - margin * 2;
    let y = margin;

    const LINE_H = 14;
    const SECTION_GAP = 10;

    const dateStr = state.generatedAt
      ? new Date(state.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, W, 56, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(203, 213, 225);
    doc.text('MARKET INTELLIGENCE REPORT', margin, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Deal ID: ${dealId}   ·   Generated: ${dateStr}`, margin, 42);

    y = 72;

    const drawSectionHeader = (title: string) => {
      doc.setFillColor(240, 244, 248);
      doc.rect(margin, y - 10, contentW, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(title, margin + 4, y + 2);
      y += LINE_H + 2;
    };

    const drawRow = (label: string, value: string, valueColor?: [number, number, number]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin + 4, y);
      doc.setFont('helvetica', 'bold');
      if (valueColor) doc.setTextColor(...valueColor);
      else doc.setTextColor(51, 65, 85);
      doc.text(value, W - margin - 4, y, { align: 'right' });
      doc.setTextColor(51, 65, 85);
      y += LINE_H;
    };

    const drawDivider = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 2, W - margin, y - 2);
    };

    const occupancyColor: [number, number, number] = ind.avg_occupancy_rate != null
      ? (ind.avg_occupancy_rate >= 92 ? [16, 185, 129] : ind.avg_occupancy_rate >= 85 ? [245, 158, 11] : [239, 68, 68])
      : [100, 116, 139];

    const pressureColor: [number, number, number] = ind.competitive_pressure === 'LOW' ? [16, 185, 129]
      : ind.competitive_pressure === 'MEDIUM' ? [245, 158, 11]
      : ind.competitive_pressure === 'HIGH' ? [239, 68, 68]
      : [100, 116, 139];

    drawSectionHeader('DEMAND INDICATORS');
    drawRow(
      'Comparable Properties',
      ind.properties_in_market != null ? `${ind.properties_in_market} properties` : '—',
    );
    drawRow(
      'Competitive Pressure',
      ind.competitive_pressure ?? '—',
      pressureColor,
    );
    const trendSymbol = ind.occupancy_trend === 'UP' ? ' ↑' : ind.occupancy_trend === 'DOWN' ? ' ↓' : ind.occupancy_trend === 'STABLE' ? ' →' : '';
    drawRow(
      'Avg Occupancy Rate',
      ind.avg_occupancy_rate != null ? `${ind.avg_occupancy_rate.toFixed(1)}%${trendSymbol}` : '—',
      occupancyColor,
    );

    y += SECTION_GAP;
    drawDivider();
    y += SECTION_GAP;

    drawSectionHeader('AVG RENT BY BEDROOM TYPE');
    const rentRows: { label: string; val: number | null }[] = [
      { label: 'Studio', val: ind.avg_rent_studio },
      { label: '1 Bedroom', val: ind.avg_rent_1br },
      { label: '2 Bedroom', val: ind.avg_rent_2br },
      { label: '3 Bedroom', val: ind.avg_rent_3br },
    ];
    rentRows.forEach(r => {
      drawRow(r.label, r.val != null ? `$${r.val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—');
    });

    if (ind.rent_growth_6mo != null || ind.rent_growth_12mo != null) {
      y += SECTION_GAP;
      drawDivider();
      y += SECTION_GAP;

      drawSectionHeader('RENT GROWTH');
      if (ind.rent_growth_6mo != null) {
        const c6: [number, number, number] = ind.rent_growth_6mo >= 0 ? [16, 185, 129] : [239, 68, 68];
        drawRow('6-Month', `${ind.rent_growth_6mo.toFixed(1)}%`, c6);
      }
      if (ind.rent_growth_12mo != null) {
        const c12: [number, number, number] = ind.rent_growth_12mo >= 0 ? [16, 185, 129] : [239, 68, 68];
        drawRow('12-Month', `${ind.rent_growth_12mo.toFixed(1)}%`, c12);
      }
    }

    y += SECTION_GAP * 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`JEDI RE — Market Intelligence   ·   Confidential   ·   ${dateStr}`, margin, y);

    const filename = `market-report-${dealId}-${state.generatedAt ? state.generatedAt.slice(0, 10) : 'latest'}.pdf`;
    doc.save(filename);
  }, [dealId, state.indicators, state.generatedAt]);

  if (state.status === 'loading') {
    return (
      <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
        Loading market data…
      </span>
    );
  }

  if (state.status === 'error') {
    return (
      <span style={{ fontFamily: MONO, fontSize: 7, color: P.red, fontStyle: 'italic' }}>
        Failed to load: {state.error}
      </span>
    );
  }

  // No indicators: covers "generating for the first time" (refreshing + null),
  // "no lat/lng so auto-gen was skipped" (ok + null + !hasLatLng), and the
  // fallback manual case — never dereference null indicators.
  if (!state.indicators) {
    if (state.status === 'refreshing') {
      return (
        <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
          Generating market data…
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: P.textMuted, fontStyle: 'italic' }}>
          {!hasLatLng
            ? 'No location data — add lat/lng to this deal to enable auto-generation'
            : 'No market report found — generate one to see comparable data'}
        </span>
        <button
          onClick={() => fetchReport(true)}
          disabled={isLoading}
          style={{
            alignSelf: 'flex-start',
            fontFamily: MONO, fontSize: 7, fontWeight: 700,
            color: P.traffic, background: 'transparent',
            border: `1px solid ${P.traffic}44`, borderRadius: 2,
            padding: '2px 8px', cursor: 'pointer', letterSpacing: 0.4,
          }}
        >
          GENERATE REPORT
        </button>
      </div>
    );
  }

  const ind = state.indicators;

  // avg_occupancy_rate is stored as 0–100 (e.g., 91 means 91%), not 0–1
  const occupancyColor = ind.avg_occupancy_rate != null
    ? (ind.avg_occupancy_rate >= 92 ? P.green : ind.avg_occupancy_rate >= 85 ? P.amber : P.red)
    : P.textMuted;

  const pressureColor = ind.competitive_pressure === 'LOW' ? P.green
    : ind.competitive_pressure === 'MEDIUM' ? P.amber
    : ind.competitive_pressure === 'HIGH' ? P.red
    : P.textMuted;

  const rentRows: { label: string; val: number | null }[] = [
    { label: 'Studio', val: ind.avg_rent_studio },
    { label: '1 BR',   val: ind.avg_rent_1br },
    { label: '2 BR',   val: ind.avg_rent_2br },
    { label: '3 BR',   val: ind.avg_rent_3br },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Comparables + occupancy */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Comparable Properties</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: ind.properties_in_market != null ? P.textPrim : P.textMuted }}>
          {ind.properties_in_market != null ? ind.properties_in_market + ' props' : '—'}
          {ind.competitive_pressure && (
            <span style={{ marginLeft: 4, color: pressureColor }}>
              [{ind.competitive_pressure}]
            </span>
          )}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Avg Occupancy Rate</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: occupancyColor }}>
          {ind.avg_occupancy_rate != null ? ind.avg_occupancy_rate.toFixed(1) + '%' : '—'}
          {ind.occupancy_trend && ind.occupancy_trend !== 'UNKNOWN' && (
            <span style={{ marginLeft: 4, color: P.textMuted }}>
              {ind.occupancy_trend === 'UP' ? '↑' : ind.occupancy_trend === 'DOWN' ? '↓' : '→'}
            </span>
          )}
        </span>
      </div>

      {/* Avg rent by bed type */}
      <div style={{ marginTop: 2, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textSec, letterSpacing: 0.4 }}>
          AVG RENT BY BEDROOM TYPE
        </span>
      </div>
      {rentRows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>{r.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: r.val != null ? P.textPrim : P.textMuted }}>
            {fmtDlr(r.val)}
          </span>
        </div>
      ))}

      {/* Rent growth */}
      {(ind.rent_growth_12mo != null || ind.rent_growth_6mo != null) && (
        <>
          <div style={{ marginTop: 2, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
            <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textSec, letterSpacing: 0.4 }}>
              RENT GROWTH
            </span>
          </div>
          {ind.rent_growth_6mo != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>6-Month</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: ind.rent_growth_6mo >= 0 ? P.green : P.red }}>
                {ind.rent_growth_6mo.toFixed(1)}%
              </span>
            </div>
          )}
          {ind.rent_growth_12mo != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>12-Month</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: ind.rent_growth_12mo >= 0 ? P.green : P.red }}>
                {ind.rent_growth_12mo.toFixed(1)}%
              </span>
            </div>
          )}
        </>
      )}

      {/* Footer: freshness + action buttons */}
      <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px solid ${P.borderSub}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: isStale ? P.amber : P.textMuted }}>
          {state.generatedAt
            ? (isStale ? '⚠ stale — ' : '') + 'as of ' + relDate(state.generatedAt)
            : 'Source: market research engine'}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            onClick={() => {
              const payload = {
                deal_id: dealId,
                generated_at: state.generatedAt,
                demand_indicators: state.indicators,
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `market-report-${dealId}-${state.generatedAt ? state.generatedAt.slice(0, 10) : 'latest'}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Download market report as JSON"
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700,
              color: P.textSec, background: 'transparent',
              border: `1px solid ${P.border}`,
              borderRadius: 2,
              padding: '1px 6px', cursor: 'pointer', letterSpacing: 0.4,
            }}
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDownloadPdf}
            title="Download market report as formatted PDF"
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700,
              color: P.blue, background: 'transparent',
              border: `1px solid ${P.blue}44`,
              borderRadius: 2,
              padding: '1px 6px', cursor: 'pointer', letterSpacing: 0.4,
            }}
          >
            ↓ PDF
          </button>
          <button
            onClick={() => fetchReport(true)}
            disabled={isLoading}
            title="Re-fetch market data from the apartment database"
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700,
              color: isStale ? P.amber : P.traffic,
              background: 'transparent',
              border: `1px solid ${isStale ? P.amber + '44' : P.traffic + '44'}`,
              borderRadius: 2,
              padding: '1px 6px', cursor: isLoading ? 'wait' : 'pointer', letterSpacing: 0.4,
            }}
          >
            {state.status === 'refreshing' ? 'REFRESHING…' : 'REFRESH'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function M07IntelPanel({ financials, dealId, hasLatLng }: Props) {
  const tp = financials?.trafficProjection ?? null;
  const mode = resolveLeaseMode(financials);
  const ml = modeLabelColor(mode);

  const peerBenchmark = financials?.peerBenchmark ?? tp?.peerBenchmark ?? null;

  // ── Offline / uncalibrated state ─────────────────────────────────────────
  if (!tp) {
    return (
      <div style={{
        background: P.bgHeader,
        borderBottom: `2px solid ${P.border}`,
        flexShrink: 0,
      }}>
        {/* Banner row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          borderBottom: dealId ? `1px solid ${P.border}` : undefined,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textMuted, letterSpacing: 0.6 }}>
            M07 TRAFFIC ENGINE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 7, color: P.amber, fontStyle: 'italic' }}>
            Not yet calibrated for this deal — run a traffic prediction to surface leasing signals
          </span>
        </div>

        {/* Market Data — shown even before a prediction is run */}
        {dealId && (
          <CollapsiblePanel title="MARKET DATA" defaultOpen>
            <MarketDataPanel dealId={dealId} />
          </CollapsiblePanel>
        )}

        {/* Peer Benchmark — shown even before a prediction is run */}
        <CollapsiblePanel title="PEER BENCHMARK">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Peer Properties (n)</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: peerBenchmark?.nPeerProperties != null ? P.textPrim : P.textMuted }}>
                {peerBenchmark?.nPeerProperties != null ? peerBenchmark.nPeerProperties + ' props' : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: P.textSec }}>Rent Percentile</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: peerBenchmark?.submarketPercentile?.rent != null ? P.traffic : P.textMuted }}>
                {peerBenchmark?.submarketPercentile?.rent != null ? 'P' + peerBenchmark.submarketPercentile.rent : '—'}
              </span>
            </div>
            <div style={{ marginTop: 3, paddingTop: 4, borderTop: `1px solid ${P.borderSub}` }}>
              <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: P.textSec, letterSpacing: 0.4 }}>
                MARKET DISTRIBUTION (P25 · P50 · P75)
              </span>
            </div>
            {(() => {
              const d = peerBenchmark?.peerDistribution?.vacancy;
              const p25 = d?.p25 != null ? fmtPct(d.p25) : '—';
              const p50 = d?.p50 != null ? fmtPct(d.p50) : '—';
              const p75 = d?.p75 != null ? fmtPct(d.p75) : '—';
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
            {(() => {
              const d = peerBenchmark?.peerDistribution?.rent;
              const p25 = d?.p25 != null ? fmtDlr(d.p25) : '—';
              const p50 = d?.p50 != null ? fmtDlr(d.p50) : '—';
              const p75 = d?.p75 != null ? fmtDlr(d.p75) : '—';
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

  const sig          = tp.leasingSignals;
  const calibrated   = tp.calibrated;
  const leaseUp      = tp.leaseUp;
  const yr1          = tp.yearly[0] ?? null;
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

      {/* Market Data — real occupancy + rent from apartment database */}
      {dealId && (
        <CollapsiblePanel title="MARKET DATA" defaultOpen>
          <MarketDataPanel dealId={dealId} hasLatLng={hasLatLng} />
        </CollapsiblePanel>
      )}

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
