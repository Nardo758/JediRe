/**
 * DataCoveragePanel — Corpus Coverage Widget
 *
 * Header widget on each deal page showing the empirical calibration
 * substrate coverage status per HISTORICAL_OBSERVATIONS_SPEC.md §9.3.
 *
 * Five sections:
 *   1. Subject Property Performance — FULLY WIRED (Phase 1)
 *   2. Submarket Context (CoStar) — skeleton, Phase 4 placeholder
 *   3. Market Surveys — skeleton, Phase 4 placeholder
 *   4. Comp Performance Tracking — skeleton, Phase 4 placeholder
 *   5. External Signals (LODES / QCEW / FRED / Veraset) — skeleton
 *
 * Data: GET /api/v1/historical-observations/deals/:dealId/coverage
 */

import React, { useEffect, useState, useCallback } from 'react';

// ─── Types (mirrors the /deals/:dealId/coverage endpoint response) ────────────

interface ExternalSignal {
  name: string;
  status: 'awaiting_ingestion' | 'pending_subscription' | 'available' | 'partial';
  note?: string;
}

interface CoverageData {
  dealName: string;
  propertyId: string;
  parcelId: string;
  propertyPerformance: {
    status: 'current' | 'stale' | 'missing';
    totalMonths: number;
    lastUpload: string | null;
    firstUpload: string | null;
    daysSinceUpload: number;
    gaps: number;
    coveragePct: number;
  };
  submarketContext: {
    status: 'strong' | 'partial' | 'sparse' | 'missing';
    totalMonths: number;
    submarketId: string | null;
  };
  externalSignals: ExternalSignal[];
  confidence: 'high' | 'medium' | 'low';
  yearBuilt: number | null;
  propertyClass: string | null;
}

// ─── Styles / tokens ─────────────────────────────────────────────────────────

const token = {
  bg: '#0a0f1a',
  surface: '#111827',
  border: '#1f2937',
  text: '#e5e7eb',
  muted: '#6b7280',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  indigo: '#6366f1',
};

function statusColor(status: 'current' | 'stale' | 'missing' | string): string {
  if (status === 'current') return token.green;
  if (status === 'stale') return token.amber;
  if (status === 'missing') return token.red;
  return token.muted;
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return token.green;
  if (c === 'medium') return token.amber;
  return token.red;
}

function statusLabel(status: string): string {
  if (status === 'current') return 'CURRENT';
  if (status === 'stale') return 'STALE';
  if (status === 'missing') return 'MISSING';
  if (status === 'strong') return 'STRONG';
  if (status === 'partial') return 'PARTIAL';
  if (status === 'sparse') return 'SPARSE';
  return status.toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: 10,
      fontFamily: 'monospace',
      fontWeight: 700,
      letterSpacing: '0.05em',
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

function SectionRow({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${token.border}` }}>
      <span style={{ fontSize: 11, color: token.muted, fontFamily: 'monospace' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: color ?? token.text, fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
        {sub && <div style={{ fontSize: 10, color: token.muted, fontFamily: 'monospace' }}>{sub}</div>}
      </div>
    </div>
  );
}

function PhaseLabel({ phase }: { phase: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 8px',
      background: '#1f293760',
      borderRadius: 4,
      border: `1px dashed ${token.border}`,
      marginTop: 4,
    }}>
      <span style={{ fontSize: 10, color: token.muted, fontFamily: 'monospace' }}>⏳ {phase} — awaiting ingestion pipeline</span>
    </div>
  );
}

// ─── Section: Subject Property Performance ────────────────────────────────────

function SubjectPropertySection({ data }: { data: CoverageData }) {
  const pp = data.propertyPerformance;
  const color = statusColor(pp.status);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: token.muted, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>SUBJECT PROPERTY</span>
        <Badge color={color} label={statusLabel(pp.status)} />
      </div>
      <SectionRow label="COVERAGE" value={`${pp.coveragePct}%`} sub={`${pp.totalMonths} months`} color={color} />
      <SectionRow label="LAST UPLOAD" value={formatDate(pp.lastUpload)} color={pp.daysSinceUpload > 60 ? token.amber : token.text} />
      <SectionRow label="FIRST UPLOAD" value={formatDate(pp.firstUpload)} />
      {pp.gaps > 0 && (
        <SectionRow label="GAPS" value={`${pp.gaps}`} color={token.amber} />
      )}
      {pp.status === 'missing' && (
        <div style={{ marginTop: 6, fontSize: 10, color: token.amber, fontFamily: 'monospace' }}>
          Upload a T12 or rent roll to begin tracking
        </div>
      )}
    </div>
  );
}

// ─── Section: Submarket Context ───────────────────────────────────────────────

function SubmarketSection({ data }: { data: CoverageData }) {
  const sc = data.submarketContext;

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: token.muted, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>SUBMARKET</span>
        <Badge color={sc.totalMonths > 0 ? statusColor(sc.status) : token.muted} label={statusLabel(sc.status)} />
      </div>
      <SectionRow
        label="COSTAR DATA"
        value={sc.totalMonths > 0 ? `${sc.totalMonths} months` : '—'}
        color={sc.totalMonths === 0 ? token.muted : undefined}
      />
      {sc.submarketId && (
        <SectionRow label="SUBMARKET ID" value={sc.submarketId} />
      )}
      <PhaseLabel phase="Phase 4" />
    </div>
  );
}

// ─── Section: External Signals ────────────────────────────────────────────────

function ExternalSignalsSection({ data }: { data: CoverageData }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: token.muted, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em' }}>EXTERNAL SIGNALS</span>
      </div>
      {data.externalSignals.map((sig) => (
        <SectionRow
          key={sig.name}
          label={sig.name.toUpperCase()}
          value={sig.status === 'available' ? 'LIVE' : sig.note ?? 'PENDING'}
          color={sig.status === 'available' ? token.green : token.muted}
        />
      ))}
    </div>
  );
}

// ─── Confidence Rollup ────────────────────────────────────────────────────────

function ConfidenceRollup({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const color = confidenceColor(confidence);
  const bars = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 80, padding: '0 12px', borderLeft: `1px solid ${token.border}` }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
        {[1, 2, 3].map((b) => (
          <div key={b} style={{
            width: 6,
            height: 20,
            borderRadius: 2,
            background: b <= bars ? color : token.border,
          }} />
        ))}
      </div>
      <span style={{ fontSize: 9, color, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>
        {confidence.toUpperCase()}
      </span>
      <span style={{ fontSize: 8, color: token.muted, fontFamily: 'monospace', marginTop: 1 }}>CONFIDENCE</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DataCoveragePanelProps {
  dealId: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function DataCoveragePanel({ dealId, collapsed = false, onToggle }: DataCoveragePanelProps) {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!collapsed);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/historical-observations/deals/${dealId}/coverage`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json as CoverageData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  const toggle = () => {
    setOpen((o) => !o);
    onToggle?.();
  };

  // ─── Header bar (always visible) ─────────────────────────────────────────

  const headerPerfStatus = data?.propertyPerformance.status ?? 'missing';
  const headerColor = statusColor(headerPerfStatus);

  return (
    <div style={{
      background: token.surface,
      border: `1px solid ${token.border}`,
      borderRadius: 6,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={toggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: token.text,
        }}
      >
        <span style={{ fontSize: 10, color: token.muted, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.12em' }}>DATA CORPUS</span>
        {!loading && data && (
          <>
            <Badge color={headerColor} label={statusLabel(headerPerfStatus)} />
            <span style={{ fontSize: 10, color: token.muted, fontFamily: 'monospace' }}>
              {data.propertyPerformance.totalMonths}mo · {data.propertyPerformance.coveragePct}% coverage
            </span>
          </>
        )}
        {loading && <span style={{ fontSize: 10, color: token.muted, fontFamily: 'monospace' }}>loading…</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: token.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px' }}>
          {loading && (
            <div style={{ padding: '16px 0', textAlign: 'center', color: token.muted, fontSize: 11, fontFamily: 'monospace' }}>
              Loading corpus coverage…
            </div>
          )}

          {error && (
            <div style={{ padding: '8px 0', color: token.red, fontSize: 11, fontFamily: 'monospace' }}>
              {error} — <button onClick={load} style={{ background: 'none', border: 'none', color: token.blue, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}>retry</button>
            </div>
          )}

          {data && !loading && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <SubjectPropertySection data={data} />
              <SubmarketSection data={data} />
              <ExternalSignalsSection data={data} />
              <ConfidenceRollup confidence={data.confidence} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataCoveragePanel;
