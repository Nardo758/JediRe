// ============================================================================
// LeasingAssumptionsTab — Leasing sub-tab for F9 Assumptions
// ============================================================================
//
// ARCHITECTURAL RULES (codified from spec §15):
//   - EDITABILITY-IS-INTENTIONAL: Fields are only shown because they appear in
//     leasing-fields.config.ts. No ad-hoc editable fields in this component.
//   - TIER-DEFAULTS-PROTECT-USERS: Beginner fields ≤ 12 across all categories.
//   - PATH-KEYED OVERRIDES: leasingPathOverrides uses field.path as the key.
//     Enum fields are stored as their index in field.enumValues by the backend
//     pipeline; decoded back to strings on hydration in AssumptionsTab.
//   - MODE-TRANSITION ANIMATION: 200ms fade-in, 150ms fade-out for category
//     blocks when leaseMode changes. Implemented via AnimatedCategoryWrapper.
//   - MAX 3 SUB-TABS under Assumptions. Do not add a 4th.
// ============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Lock, Info } from 'lucide-react';
import { M07IntelPanel } from './M07IntelPanel';
import {
  LEASING_CATEGORIES,
  LEASING_TIER_PREFS_KEY,
  DEFAULT_TIER_PREFS,
  type LeasingFieldDef,
  type LeasingCategoryDef,
  type LeaseMode,
  type LeasingTierPrefs,
  type FieldType,
} from '../../../config/leasing-fields.config';
import type { F9DealFinancials } from './types';
import { MonthlyScheduleGrid } from './MonthlyScheduleGrid';
import type { MonthlyScheduleRow } from './MonthlyScheduleGrid';
import { useDealStore } from '../../../stores/dealStore';

const MONO = "'JetBrains Mono','Fira Code',monospace";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctFmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—';
  return (v * 100).toFixed(decimals) + '%';
}
function currFmt(v: number | null | undefined): string {
  if (v == null) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function numFmt(v: number | null | undefined): string {
  if (v == null) return '—';
  return String(Math.round(v));
}

/**
 * Decode a stored override value for display.
 * Enum fields are stored as an index (number) via the existing patch pipeline;
 * decode that index back to the enum string using field.enumValues.
 * All other fields: pass through unchanged.
 */
function decodeOverrideValue(
  field: LeasingFieldDef,
  raw: number | string | null | undefined,
): number | string | null | undefined {
  if (raw == null) return raw;
  if (field.type === 'enum' && typeof raw === 'number' && field.enumValues) {
    return field.enumValues[raw] ?? raw;
  }
  return raw;
}

function formatFieldValue(field: LeasingFieldDef, raw: number | string | null | undefined): string {
  const decoded = decodeOverrideValue(field, raw);
  if (decoded == null) {
    if (field.platformDefault != null) {
      const pd = field.platformDefault;
      if (field.type === 'percent') return pctFmt(typeof pd === 'number' ? pd : null);
      if (field.type === 'currency') return currFmt(typeof pd === 'number' ? pd : null);
      if (typeof pd === 'string') return pd;
    }
    return '—';
  }
  if (typeof decoded === 'string') return decoded;
  switch (field.type) {
    case 'percent':  return pctFmt(decoded);
    case 'currency': return currFmt(decoded);
    case 'days':
    case 'months':
    case 'integer':  return numFmt(decoded);
    default:         return String(decoded);
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult { ok: boolean; error?: string; }

function validateInput(rawInput: string, field: LeasingFieldDef): ValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, error: 'Empty input' };
  if (field.type === 'enum') {
    const valid = field.enumValues?.includes(trimmed);
    return valid ? { ok: true } : { ok: false, error: `One of: ${field.enumValues?.join(', ')}` };
  }
  const raw = trimmed.replace('%', '').replace('$', '').replace(/,/g, '');
  const num = parseFloat(raw);
  if (isNaN(num)) return { ok: false, error: 'Not a number' };
  const native = field.type === 'percent' ? num / 100 : num;
  if (field.min != null && native < field.min) {
    const minDisplay = field.type === 'percent' ? pctFmt(field.min) : String(field.min);
    return { ok: false, error: `Min: ${minDisplay}` };
  }
  if (field.max != null && native > field.max) {
    const maxDisplay = field.type === 'percent' ? pctFmt(field.max) : String(field.max);
    return { ok: false, error: `Max: ${maxDisplay}` };
  }
  return { ok: true };
}

// ── Mode-transition animation wrapper ────────────────────────────────────────
// 200ms fade-in when visible becomes true; 150ms fade-out before unmount.

function AnimatedCategoryWrapper({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  const [opacity, setOpacity] = useState(visible ? 1 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (visible) {
      setMounted(true);
      // One animation frame delay so the browser applies opacity: 0 before
      // transitioning to opacity: 1 (otherwise the transition is skipped).
      timerRef.current = setTimeout(() => setOpacity(1), 16);
    } else {
      setOpacity(0);
      timerRef.current = setTimeout(() => setMounted(false), 150);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  if (!mounted) return null;
  return (
    <div style={{
      opacity,
      transition: visible ? 'opacity 200ms ease' : 'opacity 150ms ease',
    }}>
      {children}
    </div>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'SUBJ' | 'PEER' | 'PLAT' | 'EDIT' | null }) {
  if (!source) return null;
  const colors: Record<string, string> = {
    SUBJ: '#f59e0b', PEER: '#22d3ee', PLAT: '#475569', EDIT: '#3b82f6',
  };
  return (
    <span style={{
      fontFamily: MONO, fontSize: 7, color: colors[source] ?? '#475569',
      border: `1px solid ${colors[source] ?? '#2a2a2a'}44`,
      borderRadius: 2, padding: '0 3px', flexShrink: 0,
    }}>
      {source}
    </span>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfBadge({ level }: { level: 'HIGH' | 'MED' | 'LOW' | null }) {
  if (!level) return null;
  const color = level === 'HIGH' ? '#10b981' : level === 'MED' ? '#f59e0b' : '#ef4444';
  return <span style={{ fontFamily: MONO, fontSize: 7, color, flexShrink: 0 }}>{level}</span>;
}

// ── Tier badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: 'advanced' | 'expert' }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, color: '#475569', flexShrink: 0 }}>
      {tier === 'advanced' ? '[ADV]' : '[EXP]'}
    </span>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────────

interface EditableCellProps {
  field: LeasingFieldDef;
  displayValue: number | string | null | undefined;
  hasOverride: boolean;
  onCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

function EditableCell({ field, displayValue, hasOverride, onCommit }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Decoded display value (enum index → string)
  const decoded = decodeOverrideValue(field, displayValue);

  const handleStartEdit = () => {
    if (field.readonly) return;
    if (typeof decoded === 'number') {
      setDraft(field.type === 'percent' ? String((decoded * 100).toFixed(2)) : String(Math.round(decoded)));
    } else if (typeof decoded === 'string') {
      setDraft(decoded);
    } else {
      setDraft('');
    }
    setValidationError(null);
    setEditing(true);
  };

  const handleCommit = () => {
    if (!draft.trim()) { setEditing(false); return; }
    const result = validateInput(draft, field);
    if (!result.ok) { setValidationError(result.error ?? 'Invalid'); return; }
    setValidationError(null);
    setEditing(false);
    onCommit(field.path, draft.trim(), field);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        {field.type === 'enum' && field.enumValues ? (
          <select
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              fontFamily: MONO, fontSize: 10,
              background: '#1a2a3a', color: '#bfdbfe',
              border: '1px solid #3b82f6', borderRadius: 2,
              padding: '2px 6px', outline: 'none',
            }}
          >
            {field.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={e => { setDraft(e.target.value); setValidationError(null); }}
            onBlur={handleCommit}
            onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') { setEditing(false); setValidationError(null); } }}
            style={{
              fontFamily: MONO, fontSize: 10,
              background: validationError ? '#2d1010' : '#1a2a3a',
              color: validationError ? '#fca5a5' : '#bfdbfe',
              border: `1px solid ${validationError ? '#b91c1c' : '#3b82f6'}`,
              borderRadius: 2, padding: '2px 6px',
              width: 90, outline: 'none',
            }}
          />
        )}
        {validationError && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#fca5a5' }}>{validationError}</span>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={handleStartEdit}
      title={field.readonly ? '(read-only — computed value)' : field.tooltip}
      style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 600,
        color: hasOverride ? '#3b82f6' : '#e2e8f0',
        cursor: field.readonly ? 'default' : 'pointer',
        padding: '1px 4px', borderRadius: 2,
        borderBottom: field.readonly ? 'none' : '1px dashed #2a2a2a',
        minWidth: 60, display: 'inline-block', textAlign: 'right',
      }}
    >
      {formatFieldValue(field, displayValue)}
      {hasOverride && !field.readonly && (
        <span style={{ fontFamily: MONO, fontSize: 6, color: '#3b82f6', marginLeft: 2 }}>✎</span>
      )}
    </span>
  );
}

// ── Single field row ──────────────────────────────────────────────────────────

interface FieldRowProps {
  field: LeasingFieldDef;
  showTierBadge: boolean;
  overrideValue: number | string | null;
  onCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

function FieldRow({ field, showTierBadge, overrideValue, onCommit }: FieldRowProps) {
  const [hovered, setHovered] = useState(false);
  const hasOverride = overrideValue != null;
  const displayValue: number | string | null | undefined = hasOverride ? overrideValue : (field.platformDefault ?? null);

  const sourceBadge: 'SUBJ' | 'PEER' | 'PLAT' | 'EDIT' | null = hasOverride ? 'EDIT'
    : field.defaultSource.startsWith('Subject') || field.defaultSource.startsWith('From') ? 'SUBJ'
    : field.defaultSource.includes('peer') ? 'PEER'
    : 'PLAT';
  const confLevel: 'HIGH' | 'MED' | 'LOW' | null =
    sourceBadge === 'SUBJ' ? 'HIGH' : sourceBadge === 'PEER' ? 'MED' : 'LOW';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 16px',
        background: hovered ? '#0f0f0f' : 'transparent',
        borderBottom: '1px solid #1a1a1a',
        minHeight: 28,
        transition: 'background 0.1s',
      }}
    >
      {field.readonly && <Lock style={{ width: 9, height: 9, color: '#334155', flexShrink: 0 }} />}
      <span style={{
        fontFamily: MONO, fontSize: 10, color: '#94a3b8',
        width: 280, flexShrink: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {field.label}
      </span>
      {showTierBadge && field.tier !== 'beginner' && (
        <TierBadge tier={field.tier as 'advanced' | 'expert'} />
      )}
      <div style={{ flex: 1 }} />
      <EditableCell field={field} displayValue={displayValue} hasOverride={hasOverride} onCommit={onCommit} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 110, justifyContent: 'flex-end' }}>
        <SourceBadge source={sourceBadge} />
        <ConfBadge level={hasOverride ? null : confLevel} />
      </div>
      {hovered && !field.readonly && (
        <Info style={{ width: 9, height: 9, color: '#334155', flexShrink: 0 }} title={field.tooltip} />
      )}
    </div>
  );
}

// ── Category block ────────────────────────────────────────────────────────────

interface CategoryBlockProps {
  cat: LeasingCategoryDef;
  leaseMode: LeaseMode | null;
  showAdvanced: boolean;
  showExpert: boolean;
  leasingPathOverrides: Record<string, number | string | null>;
  onCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

function CategoryBlock({ cat, leaseMode, showAdvanced, showExpert, leasingPathOverrides, onCommit }: CategoryBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Per-field mode enforcement (field-level, not just category-level)
  const visibleFields = cat.fields.filter(f => {
    if (f.modes !== 'all' && leaseMode != null && !f.modes.includes(leaseMode)) return false;
    if (f.tier === 'beginner') return true;
    if (f.tier === 'advanced') return showAdvanced || showExpert;
    if (f.tier === 'expert')   return showExpert;
    return false;
  });

  if (visibleFields.length === 0) return null;
  const showTierBadges = showAdvanced || showExpert;

  return (
    <div style={{ marginBottom: 1 }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 16px', background: '#161616',
          borderBottom: '1px solid #1e1e1e',
          cursor: 'pointer', userSelect: 'none', minHeight: 32,
        }}
      >
        {collapsed
          ? <ChevronRight style={{ width: 10, height: 10, color: '#475569', flexShrink: 0 }} />
          : <ChevronDown style={{ width: 10, height: 10, color: '#475569', flexShrink: 0 }} />
        }
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {cat.label}
        </span>
        <div style={{ flex: 1, borderTop: '1px solid #1e1e1e', marginLeft: 8 }} />
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#2a2a2a' }}>{visibleFields.length}</span>
      </div>
      {!collapsed && visibleFields.map(field => (
        <FieldRow
          key={field.id}
          field={field}
          showTierBadge={showTierBadges}
          overrideValue={leasingPathOverrides[field.path] ?? null}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}

// ── Leasing summary card — read-only 4-metric snapshot for General tab ────────
// Exported for use in AssumptionsTab in place of Section 5-traf raw T-code rows.
// MUST remain read-only. Cost Treatment toggle MUST NOT appear here (spec §6).

export interface LeasingSummaryCardProps {
  financials: F9DealFinancials | null;
  leasingPathOverrides: Record<string, number | string | null>;
  onGoToLeasing: () => void;
}

export function LeasingSummaryCard({ financials, leasingPathOverrides, onGoToLeasing }: LeasingSummaryCardProps) {
  const yr1 = financials?.trafficProjection?.yearly?.[0];
  const sig = financials?.trafficProjection?.leasingSignals;

  const currentOcc  = yr1?.occupancyPct ?? null;
  const targetOcc   = (leasingPathOverrides['traffic.stabilization.ceiling_occupancy'] as number | null) ?? 0.95;
  const rentGrowth  = yr1?.rentGrowthPct ?? (leasingPathOverrides['traffic.coefficients.blended_rent_growth'] as number | null);
  // Concession strategy may be stored as enum string or as index → decode
  const rawConcStrat = leasingPathOverrides['lease_velocity.inputs.concession_strategy'];
  const concStrategy = typeof rawConcStrat === 'number'
    ? (['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'][rawConcStrat] ?? 'MARKET')
    : (rawConcStrat as string | null) ?? 'MARKET';

  const metrics = [
    {
      label: 'Current Occupancy',
      value: currentOcc != null ? pctFmt(currentOcc) : '—',
      source: (currentOcc != null ? 'SUBJ' : 'PLAT') as 'SUBJ' | 'PLAT' | 'EDIT',
    },
    {
      label: 'Target Stabilized Occ.',
      value: pctFmt(targetOcc),
      source: (leasingPathOverrides['traffic.stabilization.ceiling_occupancy'] != null ? 'EDIT' : 'PLAT') as 'PLAT' | 'EDIT',
    },
    {
      label: 'Blended Rent Growth',
      value: rentGrowth != null ? pctFmt(rentGrowth) : '—',
      source: (yr1?.rentGrowthPct != null ? 'SUBJ' : leasingPathOverrides['traffic.coefficients.blended_rent_growth'] != null ? 'EDIT' : 'PLAT') as 'SUBJ' | 'PLAT' | 'EDIT',
    },
    {
      label: 'Concession Strategy',
      value: concStrategy,
      source: (rawConcStrat != null ? 'EDIT' : 'PLAT') as 'PLAT' | 'EDIT',
    },
  ];

  return (
    <div style={{ background: '#0e0e0e', border: '1px solid #1e1e1e', borderRadius: 4, margin: '8px 12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', background: '#141414', borderBottom: '1px solid #1e1e1e' }}>
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>LEASING SNAPSHOT</span>
        {sig?.confidence != null && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#22d3ee80' }}>M07 · {sig.confidence}% conf</span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1a1a1a' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#0e0e0e', padding: '7px 12px' }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: '#475569', marginBottom: 2, letterSpacing: '0.05em' }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{m.value}</span>
              <SourceBadge source={m.source} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onGoToLeasing}
          style={{
            fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#22d3ee',
            background: 'none', border: '1px solid #22d3ee33', borderRadius: 3,
            padding: '3px 10px', cursor: 'pointer', letterSpacing: '0.06em',
          }}
        >
          → Edit in Leasing tab
        </button>
      </div>
    </div>
  );
}

// ── Main LeasingAssumptionsTab component ──────────────────────────────────────

export interface LeasingAssumptionsTabProps {
  financials: F9DealFinancials | null;
  leaseMode: LeaseMode | null;
  /** Deal ID — passed to M07IntelPanel so it can fetch market research data */
  dealId?: string | null;
  /** Whether the deal has lat/lng set — gates auto-generation of the market report */
  hasLatLng?: boolean;
  /**
   * Path-keyed override map — keyed by LeasingFieldDef.path.
   * Numeric enum fields are stored by their index in field.enumValues (backend contract).
   * The decodeOverrideValue helper and EditableCell handle the index → string decode.
   */
  leasingPathOverrides: Record<string, number | string | null>;
  onFieldCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
  /** Monthly schedule props — passed from AssumptionsTab */
  holdYears?: number;
  monthlyOverrides?: Record<string, Record<number, string>>;
  onMonthlyChange?: (field: string, month: number, value: string | null) => void;
}

// ── Monthly leasing rows config ────────────────────────────────────────────────
// These are the time-varying leasing fields that benefit from monthly granularity.
// Keyed field_key → leasingPathOverrides.path for baseline resolution.
interface MonthlyLeasingRowDef {
  key: string;
  label: string;
  unit: 'pct' | 'days' | 'dollar' | 'enum';
  enumValues?: string[];
  enumLabels?: string[];
  pathKey?: string;           // leasingPathOverrides key for baseline
  platformDefault?: number | string | null;
  labelColor?: string;
}

const MONTHLY_LEASING_ROWS: MonthlyLeasingRowDef[] = [
  {
    key: 'leasing_renewal_rate',
    label: 'Renewal rate',
    unit: 'pct',
    pathKey: 'traffic.renewal_rate',
    platformDefault: 0.55,
    labelColor: '#60a5fa',
  },
  {
    key: 'leasing_days_vacant',
    label: 'Days vacant (median)',
    unit: 'days',
    pathKey: 'traffic.days_vacant_median',
    platformDefault: 21,
    labelColor: '#60a5fa',
  },
  {
    key: 'leasing_rent_growth',
    label: 'Blended rent growth',
    unit: 'pct',
    pathKey: 'traffic.coefficients.blended_rent_growth',
    platformDefault: 0.030,
    labelColor: '#86efac',
  },
  {
    key: 'leasing_conc_strategy',
    label: 'Concession strategy',
    unit: 'enum',
    enumValues: ['CONSERVATIVE', 'MARKET', 'AGGRESSIVE'],
    enumLabels: ['CON', 'MKT', 'AGG'],
    pathKey: 'lease_velocity.inputs.concession_strategy',
    platformDefault: 'MARKET',
    labelColor: '#fcd34d',
  },
  {
    key: 'leasing_mkt_intensity',
    label: 'Marketing intensity',
    unit: 'enum',
    enumValues: ['LOW', 'MARKET', 'AGGRESSIVE'],
    enumLabels: ['LOW', 'MKT', 'AGG'],
    pathKey: 'lease_velocity.inputs.marketing_intensity',
    platformDefault: 'MARKET',
    labelColor: '#fcd34d',
  },
  {
    key: 'leasing_conc_new_unit',
    label: 'New lease concession ($/unit)',
    unit: 'dollar',
    pathKey: 'traffic.concession_environment.new_lease_onetime_per_unit',
    platformDefault: 0,
    labelColor: '#f472b6',
  },
];

export function LeasingAssumptionsTab({
  financials, leaseMode, dealId, hasLatLng, leasingPathOverrides, onFieldCommit,
  holdYears = 5, monthlyOverrides = {}, onMonthlyChange,
}: LeasingAssumptionsTabProps) {
  // ── View mode: ANNUAL (category form) or SCHEDULE (monthly grid) ──────────
  const [viewMode, setViewMode] = useState<'ANNUAL' | 'SCHEDULE'>('ANNUAL');

  // ── Derive hasLatLng from deal context store (authoritative source) ────────
  // The deal API response does not include lat/lng fields; the deal context
  // store (populated by fetchDealContext) is the reliable source of coordinates.
  // The prop is accepted as an external hint but the store takes precedence
  // when it contains valid (non-zero) coordinates.
  const storeCoords = useDealStore(s => s.coordinates);
  const storeHasLatLng =
    storeCoords != null &&
    Number(storeCoords.lat) !== 0 && !isNaN(Number(storeCoords.lat)) &&
    Number(storeCoords.lng) !== 0 && !isNaN(Number(storeCoords.lng));
  const resolvedHasLatLng = storeHasLatLng ? true : (hasLatLng ?? false);

  // ── Tier preferences (per-user, persisted in localStorage) ───────────────
  const [tierPrefs, setTierPrefs] = useState<LeasingTierPrefs>(() => {
    try {
      const raw = localStorage.getItem(LEASING_TIER_PREFS_KEY);
      return raw ? { ...DEFAULT_TIER_PREFS, ...JSON.parse(raw) } : DEFAULT_TIER_PREFS;
    } catch { return DEFAULT_TIER_PREFS; }
  });

  const setTierPref = useCallback((key: keyof LeasingTierPrefs, val: boolean) => {
    setTierPrefs(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'show_expert' && val) next.show_advanced = true;
      if (key === 'show_advanced' && !val) next.show_expert = false;
      try { localStorage.setItem(LEASING_TIER_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Category-level visibility (for AnimatedCategoryWrapper) ──────────────
  // Category-level visibility: whether the category can ever show in this mode.
  // Field-level mode filtering happens inside CategoryBlock.
  const isCatVisible = useCallback((cat: { visibleIn: LeaseMode[] | 'all' }) => {
    if (cat.visibleIn === 'all') return true;
    if (leaseMode == null) return true; // show all when mode unknown
    return cat.visibleIn.includes(leaseMode);
  }, [leaseMode]);

  // ── Counts for tier toggle labels ─────────────────────────────────────────
  const advCount = LEASING_CATEGORIES.reduce((n, cat) =>
    n + cat.fields.filter(f => {
      if (f.tier !== 'advanced') return false;
      if (!isCatVisible(cat)) return false;
      if (f.modes !== 'all' && leaseMode != null && !f.modes.includes(leaseMode)) return false;
      return true;
    }).length, 0);
  const expCount = LEASING_CATEGORIES.reduce((n, cat) =>
    n + cat.fields.filter(f => {
      if (f.tier !== 'expert') return false;
      if (!isCatVisible(cat)) return false;
      if (f.modes !== 'all' && leaseMode != null && !f.modes.includes(leaseMode)) return false;
      return true;
    }).length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
      {/* ── Top bar: mode indicator + tier toggles ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 16px', background: '#111', borderBottom: '1px solid #1e1e1e',
        flexShrink: 0,
      }}>
        {leaseMode ? (
          <span style={{
            fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 2,
            background: leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? '#3730a344'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? '#78350f44'
              : (leaseMode === 'VALUE_ADD' || leaseMode === 'REDEVELOPMENT') ? '#7c3aed44'
              : '#14532d44',
            color: leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? '#a5b4fc'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? '#fcd34d'
              : (leaseMode === 'VALUE_ADD' || leaseMode === 'REDEVELOPMENT') ? '#c4b5fd'
              : '#86efac',
            border: '1px solid transparent',
          }}>
            {leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? 'LEASE-UP'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? 'RECOVERY'
              : leaseMode === 'VALUE_ADD' ? 'VALUE-ADD'
              : leaseMode === 'REDEVELOPMENT' ? 'REDEVELOPMENT'
              : 'STABILIZED'}
          </span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>MODE PENDING</span>
        )}
        <div style={{ flex: 1 }} />

        {/* ── View toggle: ANNUAL | SCHEDULE ── */}
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#475569', letterSpacing: '0.05em' }}>VIEW:</span>
        {(['ANNUAL', 'SCHEDULE'] as const).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(v)}
            style={{
              fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
              padding: '3px 10px', borderRadius: 3, cursor: 'pointer', border: 'none',
              background: viewMode === v ? (v === 'SCHEDULE' ? '#1a2e1a' : '#1e3a5f') : '#1a1a1a',
              color: viewMode === v ? (v === 'SCHEDULE' ? '#86efac' : '#bfdbfe') : '#475569',
              transition: 'all 0.15s',
            }}
          >
            {v}
          </button>
        ))}

        {viewMode === 'ANNUAL' && (
          <>
            <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155', marginLeft: 6 }}>|</span>
            <span style={{ fontFamily: MONO, fontSize: 7, color: '#475569' }}>SHOW:</span>
            <button
              onClick={() => setTierPref('show_advanced', !tierPrefs.show_advanced)}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                padding: '3px 10px', borderRadius: 3, cursor: 'pointer', border: 'none',
                background: tierPrefs.show_advanced ? '#1e3a5f' : '#1a1a1a',
                color: tierPrefs.show_advanced ? '#bfdbfe' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {tierPrefs.show_advanced ? '▾' : '▸'} Advanced ({advCount})
            </button>
            <button
              onClick={() => setTierPref('show_expert', !tierPrefs.show_expert)}
              style={{
                fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                padding: '3px 10px', borderRadius: 3, cursor: 'pointer', border: 'none',
                background: tierPrefs.show_expert ? '#3b1f6d' : '#1a1a1a',
                color: tierPrefs.show_expert ? '#d8b4fe' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {tierPrefs.show_expert ? '▾' : '▸'} Expert ({expCount})
            </button>
          </>
        )}
      </div>

      {/* ── M07 Traffic Engine Intel Panel ── always above ANNUAL / SCHEDULE content ── */}
      <M07IntelPanel financials={financials} dealId={dealId} hasLatLng={resolvedHasLatLng} />

      {/* ── SCHEDULE view: monthly timeline grid ──────────────────────────────── */}
      {viewMode === 'SCHEDULE' && onMonthlyChange && (() => {
        const holdMonths = holdYears * 12;
        const scheduleRows: MonthlyScheduleRow[] = MONTHLY_LEASING_ROWS.map(def => ({
          key: def.key,
          label: def.label,
          unit: def.unit,
          enumValues: def.enumValues,
          enumLabels: def.enumLabels,
          labelColor: def.labelColor,
          getBaseline: (_absMonth) => {
            if (!def.pathKey) return def.platformDefault ?? null;
            const ov = leasingPathOverrides[def.pathKey];
            if (ov != null) {
              if (def.unit === 'enum' && typeof ov === 'number' && def.enumValues) {
                return def.enumValues[ov] ?? def.platformDefault ?? null;
              }
              return ov as number | string;
            }
            return def.platformDefault ?? null;
          },
        }));
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Schedule header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 16px', background: '#0d0d0d', borderBottom: '1px solid #141414', flexShrink: 0,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>
                MONTHLY SCHEDULE — {holdMonths} months · baseline from ANNUAL tab values
              </span>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>
                {holdYears}yr hold
              </span>
            </div>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
              <MonthlyScheduleGrid
                rows={scheduleRows}
                holdMonths={holdMonths}
                overrides={monthlyOverrides}
                onCellChange={onMonthlyChange}
              />
            </div>
          </div>
        );
      })()}

      {/* ── ANNUAL view: column header + category blocks ───────────────────────── */}
      {viewMode === 'ANNUAL' && (
        <>
      {/* ── Column header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '3px 16px', background: '#0d0d0d', borderBottom: '1px solid #141414',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155', width: 280, flexShrink: 0 }}>ASSUMPTION</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155', textAlign: 'right', minWidth: 90 }}>VALUE</span>
        <div style={{ width: 110, textAlign: 'right' }}>
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>SOURCE · CONF</span>
        </div>
        <div style={{ width: 9 }} />
      </div>

      {/* ── Categories A–J with mode-transition animations ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {LEASING_CATEGORIES.map(cat => (
          <AnimatedCategoryWrapper key={cat.id} visible={isCatVisible(cat)}>
            <CategoryBlock
              cat={cat}
              leaseMode={leaseMode}
              showAdvanced={tierPrefs.show_advanced}
              showExpert={tierPrefs.show_expert}
              leasingPathOverrides={leasingPathOverrides}
              onCommit={onFieldCommit}
            />
          </AnimatedCategoryWrapper>
        ))}

        {!tierPrefs.show_advanced && advCount > 0 && (
          <div
            onClick={() => setTierPref('show_advanced', true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#0e0e0e', borderTop: '1px solid #1a1a1a', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>
              ▸ Show advanced assumptions ({advCount} additional fields)
            </span>
          </div>
        )}
        {tierPrefs.show_advanced && !tierPrefs.show_expert && expCount > 0 && (
          <div
            onClick={() => setTierPref('show_expert', true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#0e0e0e', borderTop: '1px solid #1a1a1a', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>
              ▸ Show expert overrides ({expCount} additional fields — array editors, decay curves)
            </span>
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
      </>
    )}
    </div>
  );
}

export type { LeasingFieldDef, FieldType };
export default LeasingAssumptionsTab;
