/**
 * ReconciliationChip — Task #805
 *
 * Surfaces the math engine v1.1 hierarchical_resolutions data for a single
 * Pro Forma field. Renders nothing for within_tolerance / no_conflict; a
 * yellow ⓘ chip for minor_mismatch; a red ⚠ chip for major_mismatch.
 *
 * Clicking the chip opens an inline popover showing:
 *   • Resolved value + source pill
 *   • Alternative (aggregate) value + source pill
 *   • Delta $ and %
 *   • Resolution method and status badge
 *   • One-line human-readable footnote
 */

import React, { useState, useRef, useEffect } from 'react';
import { BT } from '../deal/bloomberg-ui';

const MONO = BT.font.mono;
const LABEL = BT.font.label;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HierarchicalResolution {
  resolved_value: number;
  resolution_source: string;
  resolution_method: 'breakdown_sum' | 'aggregate' | 'fallback';
  breakdown_sum?: number;
  aggregate_value?: number;
  reconciliation_delta?: number;
  reconciliation_delta_pct?: number;
  reconciliation_status: 'no_conflict' | 'within_tolerance' | 'minor_mismatch' | 'major_mismatch';
}

interface Props {
  resolution: HierarchicalResolution | null | undefined;
  /** Compact mode: smaller chip, for inline row label use */
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function fmtDelta(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}$${Math.round(n).toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function humanMethod(method: string): string {
  if (method === 'breakdown_sum') return 'Breakdown sum (rent roll line items)';
  if (method === 'aggregate')     return 'Aggregate (T-12 total)';
  if (method === 'fallback')      return 'Fallback (platform estimate)';
  return method;
}

function humanSource(src: string): string {
  const map: Record<string, string> = {
    rent_roll:        'Rent Roll',
    t12:              'T-12 Actuals',
    om:               'Offering Memorandum',
    platform:         'Platform',
    platform_fallback:'Platform (fallback)',
    agent:            'AI Agent',
    broker:           'Broker',
    archive:          'Archive',
  };
  return map[src] ?? src;
}

const SOURCE_COLOR: Record<string, string> = {
  rent_roll:         '#06b6d4',
  t12:               '#34d399',
  om:                '#f59e0b',
  platform:          '#06b6d4',
  platform_fallback: '#475569',
  agent:             '#a78bfa',
  broker:            '#f59e0b',
  archive:           '#60a5fa',
};

function sourceColor(src: string): string {
  return SOURCE_COLOR[src] ?? '#6b7a8d';
}

// ─── Status badge colours ─────────────────────────────────────────────────────

const STATUS_CONFIG = {
  minor_mismatch: {
    chipColor:  '#d97706',
    chipBg:     '#1a0f00',
    chipBorder: '#7c2d12',
    label:      'ⓘ',
    title:      'Minor reconciliation mismatch — click for detail',
    headerColor:'#d97706',
    headerLabel:'MINOR MISMATCH',
    headerBg:   '#1a0f00',
  },
  major_mismatch: {
    chipColor:  '#ef4444',
    chipBg:     '#1a0000',
    chipBorder: '#7f1d1d',
    label:      '⚠',
    title:      'Major reconciliation mismatch — review required',
    headerColor:'#ef4444',
    headerLabel:'MAJOR MISMATCH',
    headerBg:   '#1a0000',
  },
} as const;

// ─── Popover ──────────────────────────────────────────────────────────────────

function Popover({
  resolution,
  status,
  onClose,
}: {
  resolution: HierarchicalResolution;
  status: 'minor_mismatch' | 'major_mismatch';
  onClose: () => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const altValue = resolution.resolution_method === 'breakdown_sum'
    ? resolution.aggregate_value
    : resolution.breakdown_sum;
  const altLabel = resolution.resolution_method === 'breakdown_sum'
    ? 'T-12 Aggregate'
    : 'Breakdown Sum';
  const altSrc = resolution.resolution_method === 'breakdown_sum'
    ? 't12'
    : 'rent_roll';

  const delta    = resolution.reconciliation_delta;
  const deltaPct = resolution.reconciliation_delta_pct;

  const footnote = resolution.resolution_method === 'breakdown_sum'
    ? `Reconciled from ${humanSource(resolution.resolution_source)} detail; ${altLabel} ${fmt$(altValue)} ${deltaPct != null ? `within ${Math.abs(deltaPct * 100).toFixed(1)}% tolerance` : ''}`
    : `Resolved from ${humanSource(resolution.resolution_source)} aggregate; breakdown detail ${altValue != null ? `${fmt$(altValue)}` : 'unavailable'}`;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 9999,
        top: '100%',
        left: 0,
        marginTop: 4,
        width: 300,
        background: '#07101a',
        border: `1px solid ${cfg.chipBorder}`,
        borderTop: `2px solid ${cfg.chipColor}`,
        borderRadius: 4,
        boxShadow: `0 4px 20px rgba(0,0,0,0.7)`,
        fontFamily: MONO,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '5px 10px',
        background: cfg.headerBg,
        borderBottom: `1px solid ${cfg.chipBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: cfg.headerColor, letterSpacing: '0.08em' }}>
          {cfg.headerLabel} · OTHER INCOME
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12, padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Resolved row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#6b7a8d' }}>RESOLVED VALUE</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee' }}>{fmt$(resolution.resolved_value)}</span>
            <span style={{
              fontSize: 7, fontWeight: 700, color: sourceColor(resolution.resolution_source),
              background: `${sourceColor(resolution.resolution_source)}18`,
              border: `1px solid ${sourceColor(resolution.resolution_source)}33`,
              borderRadius: 2, padding: '0 4px', letterSpacing: '0.06em',
            }}>
              {humanSource(resolution.resolution_source).toUpperCase()}
            </span>
          </span>
        </div>

        {/* Alternative row */}
        {altValue != null && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, color: '#6b7a8d' }}>{altLabel.toUpperCase()}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{fmt$(altValue)}</span>
              <span style={{
                fontSize: 7, fontWeight: 700, color: sourceColor(altSrc),
                background: `${sourceColor(altSrc)}18`,
                border: `1px solid ${sourceColor(altSrc)}33`,
                borderRadius: 2, padding: '0 4px', letterSpacing: '0.06em',
              }}>
                {altSrc.replace('_', ' ').toUpperCase()}
              </span>
            </span>
          </div>
        )}

        {/* Divider */}
        <div style={{ borderTop: '1px solid #0e2235', margin: '2px 0' }} />

        {/* Delta row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#6b7a8d' }}>DELTA</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: delta != null && delta > 0 ? '#22c55e' : '#f59e0b' }}>
              {fmtDelta(delta)}
            </span>
            <span style={{ fontSize: 8, color: '#475569' }}>
              {fmtPct(deltaPct)}
            </span>
          </span>
        </div>

        {/* Method row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#6b7a8d' }}>METHOD</span>
          <span style={{ fontSize: 8, color: '#94a3b8' }}>{humanMethod(resolution.resolution_method)}</span>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #0e2235', margin: '2px 0' }} />

        {/* Footnote */}
        <div style={{ fontSize: 7.5, color: '#475569', fontFamily: LABEL, fontStyle: 'italic', lineHeight: 1.4 }}>
          {footnote}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReconciliationChip({ resolution, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!resolution) return null;
  const status = resolution.reconciliation_status;
  if (status === 'no_conflict' || status === 'within_tolerance') return null;
  if (status !== 'minor_mismatch' && status !== 'major_mismatch') return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title={cfg.title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? 2 : 3,
          background: open ? `${cfg.chipColor}22` : cfg.chipBg,
          border: `1px solid ${open ? cfg.chipColor : cfg.chipBorder}`,
          borderRadius: 3,
          padding: compact ? '0px 3px' : '1px 5px',
          cursor: 'pointer',
          marginLeft: compact ? 4 : 6,
          transition: 'all 0.1s',
        }}
      >
        <span style={{
          fontFamily: MONO,
          fontSize: compact ? 7.5 : 8,
          fontWeight: 700,
          color: cfg.chipColor,
          letterSpacing: '0.02em',
          lineHeight: 1.2,
        }}>
          {cfg.label}
        </span>
        {!compact && (
          <span style={{
            fontFamily: MONO,
            fontSize: 7,
            color: cfg.chipColor,
            letterSpacing: '0.06em',
            opacity: 0.85,
          }}>
            RECONCILED
          </span>
        )}
      </button>

      {open && (
        <Popover
          resolution={resolution}
          status={status}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
