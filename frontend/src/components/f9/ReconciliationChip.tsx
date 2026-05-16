/**
 * ReconciliationChip — Task #805
 *
 * Surfaces the math engine v1.1 hierarchical_resolutions data for a single
 * Pro Forma field. Renders nothing for within_tolerance / no_conflict; a
 * yellow ⓘ chip for minor_mismatch; a red ⚠ chip for major_mismatch.
 *
 * Chip label shows inline delta: e.g. "ⓘ +$8,088 / +2.5%"
 *
 * Clicking the chip opens an inline popover showing:
 *   • Resolved value + source pill
 *   • Alternative (aggregate) value + source pill
 *   • Delta $ and %
 *   • Tolerance bands (what each status level means)
 *   • Canonical footnote
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
  /** Compact mode: smaller chip for inline row label use (shows icon + delta only) */
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
  return `${n >= 0 ? '+' : ''}${(Math.abs(n) * 100).toFixed(1)}%`;
}

/** Inline chip label: "+$8,088 / +2.5%" */
function deltaLabel(resolution: HierarchicalResolution): string {
  const d = resolution.reconciliation_delta;
  const p = resolution.reconciliation_delta_pct;
  if (d == null && p == null) return '';
  if (d == null) return fmtPct(p);
  if (p == null) return fmtDelta(d);
  return `${fmtDelta(d)} / ${fmtPct(p)}`;
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  minor_mismatch: {
    chipColor:   '#d97706',
    chipBg:      '#1a0f00',
    chipBorder:  '#7c2d12',
    icon:        'ⓘ',
    title:       'Minor reconciliation mismatch — click for detail',
    headerColor: '#d97706',
    headerLabel: 'MINOR MISMATCH',
    headerBg:    '#1a0f00',
    statusDesc:  '5–25% delta or $5k–$25k difference',
  },
  major_mismatch: {
    chipColor:   '#ef4444',
    chipBg:      '#1a0000',
    chipBorder:  '#7f1d1d',
    icon:        '⚠',
    title:       'Major reconciliation mismatch — review required',
    headerColor: '#ef4444',
    headerLabel: 'MAJOR MISMATCH',
    headerBg:    '#1a0000',
    statusDesc:  '>25% delta or >$25k difference',
  },
} as const;

// ─── Tolerance bands table ────────────────────────────────────────────────────

function ToleranceBands() {
  const row = (status: string, color: string, desc: string) => (
    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1px 0' }}>
      <span style={{ fontSize: 7, fontFamily: MONO, color, fontWeight: 700, letterSpacing: '0.04em', minWidth: 90 }}>{status}</span>
      <span style={{ fontSize: 7, color: '#475569', fontFamily: LABEL }}>{desc}</span>
    </div>
  );
  return (
    <div style={{ background: '#040c14', border: '1px solid #0e2235', borderRadius: 3, padding: '4px 8px' }}>
      <div style={{ fontSize: 7, color: '#334155', fontFamily: MONO, letterSpacing: '0.06em', marginBottom: 3 }}>TOLERANCE BANDS</div>
      {row('WITHIN TOLERANCE', '#22c55e', '≤5% delta and ≤$5k — no badge shown')}
      {row('MINOR MISMATCH', '#d97706', '5–25% delta or $5k–$25k')}
      {row('MAJOR MISMATCH', '#ef4444', '>25% delta or >$25k — review required')}
    </div>
  );
}

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
  const isBreakdownPrimary = resolution.resolution_method === 'breakdown_sum';
  const altValue  = isBreakdownPrimary ? resolution.aggregate_value  : resolution.breakdown_sum;
  const altLabel  = isBreakdownPrimary ? 'T-12 Aggregate'            : 'Breakdown Sum';
  const altSrc    = isBreakdownPrimary ? 't12'                       : 'rent_roll';

  const delta    = resolution.reconciliation_delta;
  const deltaPct = resolution.reconciliation_delta_pct;

  // Canonical footnote text per spec: explains why breakdown vs aggregate was chosen
  const canonicalFootnote = isBreakdownPrimary
    ? `T-12 publishes an aggregate only — no per-category breakdown. ` +
      `Rent roll detail sum (${fmt$(resolution.breakdown_sum ?? resolution.resolved_value)}) ` +
      `is the higher-fidelity source at ${deltaPct != null ? Math.abs(deltaPct * 100).toFixed(1) + '% delta' : 'unknown delta'}. ` +
      `Resolved value uses breakdown sum as primary.`
    : `Breakdown sum unavailable or lower-confidence. ` +
      `T-12 aggregate (${fmt$(resolution.aggregate_value ?? resolution.resolved_value)}) ` +
      `used as primary source. ` +
      `${altValue != null ? `Breakdown detail ${fmt$(altValue)} noted for reference.` : ''}`;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 9999,
        top: '100%',
        left: 0,
        marginTop: 4,
        width: 320,
        background: '#07101a',
        border: `1px solid ${cfg.chipBorder}`,
        borderTop: `2px solid ${cfg.chipColor}`,
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
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
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>

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

        {/* Delta row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #0e2235', paddingTop: 4 }}>
          <span style={{ fontSize: 8, color: '#6b7a8d' }}>DELTA</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: delta != null && delta > 0 ? '#22c55e' : '#f59e0b' }}>
              {fmtDelta(delta)}
            </span>
            <span style={{ fontSize: 8, color: '#6b7a8d' }}>
              {fmtPct(deltaPct)}
            </span>
          </span>
        </div>

        {/* Resolution method */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 8, color: '#6b7a8d' }}>METHOD</span>
          <span style={{ fontSize: 8, color: '#94a3b8' }}>{humanMethod(resolution.resolution_method)}</span>
        </div>

        {/* Tolerance bands */}
        <div style={{ marginTop: 2 }}>
          <ToleranceBands />
        </div>

        {/* Canonical footnote */}
        <div style={{
          fontSize: 7.5, color: '#475569', fontFamily: LABEL, fontStyle: 'italic',
          lineHeight: 1.45, borderTop: '1px solid #0e2235', paddingTop: 5,
        }}>
          {canonicalFootnote}
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
  const dl  = deltaLabel(resolution);

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        title={cfg.title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          background: open ? `${cfg.chipColor}22` : cfg.chipBg,
          border: `1px solid ${open ? cfg.chipColor : cfg.chipBorder}`,
          borderRadius: 3,
          padding: compact ? '0px 4px' : '1px 5px',
          cursor: 'pointer',
          marginLeft: compact ? 4 : 6,
          transition: 'background 0.1s, border-color 0.1s',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Icon */}
        <span style={{
          fontFamily: MONO,
          fontSize: compact ? 7.5 : 8,
          fontWeight: 700,
          color: cfg.chipColor,
          letterSpacing: '0.02em',
          lineHeight: 1.2,
        }}>
          {cfg.icon}
        </span>
        {/* Delta inline — always shown; compact hides the RECONCILED label */}
        {dl && (
          <span style={{
            fontFamily: MONO,
            fontSize: compact ? 7 : 7.5,
            color: cfg.chipColor,
            letterSpacing: '0.03em',
            opacity: 0.9,
          }}>
            {dl}
          </span>
        )}
        {/* "RECONCILED" label only in non-compact mode */}
        {!compact && (
          <span style={{
            fontFamily: MONO,
            fontSize: 7,
            color: cfg.chipColor,
            letterSpacing: '0.06em',
            opacity: 0.7,
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
