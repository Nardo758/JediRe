// ============================================================================
// LeasingAssumptionsTab — Leasing sub-tab for F9 Assumptions
// ============================================================================
//
// Renders the full Leasing assumptions inventory per LEASING_ASSUMPTIONS_UI_SPEC.
// Categories A-I, tier-gated (Beginner/Advanced/Expert), mode-conditional.
//
// ARCHITECTURAL RULES (codified from spec §15):
//   - EDITABILITY-IS-INTENTIONAL: Fields are only shown because they appear in
//     leasing-fields.config.ts. No ad-hoc editable fields in this component.
//   - TIER-DEFAULTS-PROTECT-USERS: Beginner fields ≤12 total across all categories.
//   - SUBJECT-CALIBRATION-PRESERVED: Overrides apply only on top of the
//     existing layered value chain; they do not erase subject calibration.
//   - MAX 3 SUB-TABS under Assumptions. Do not add a 4th — put new concerns
//     on their own F-key page.
//   - PATH-KEYED OVERRIDES: leasingPathOverrides uses field.path as the key
//     (same namespace as backend dealContext), not fieldId. This ensures the
//     migration map and the edit surface read from the same data.
// ============================================================================

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Lock, Info, AlertCircle } from 'lucide-react';
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

function formatFieldValue(field: LeasingFieldDef, raw: number | string | null | undefined): string {
  if (raw == null) {
    if (field.platformDefault != null) {
      const pd = field.platformDefault;
      if (field.type === 'percent') return pctFmt(typeof pd === 'number' ? pd : null);
      if (field.type === 'currency') return currFmt(typeof pd === 'number' ? pd : null);
      if (typeof pd === 'string') return pd;
    }
    return '—';
  }
  if (typeof raw === 'string') return raw;
  switch (field.type) {
    case 'percent':   return pctFmt(raw);
    case 'currency':  return currFmt(raw);
    case 'days':
    case 'months':
    case 'integer':   return numFmt(raw);
    case 'enum':      return String(raw);
    default:          return String(raw);
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  error?: string;
}

function validateInput(rawInput: string, field: LeasingFieldDef): ValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, error: 'Empty input' };
  if (field.type === 'enum') {
    const valid = field.enumValues?.includes(trimmed);
    return valid ? { ok: true } : { ok: false, error: `Must be one of: ${field.enumValues?.join(', ')}` };
  }
  const raw = trimmed.replace('%', '').replace('$', '').replace(/,/g, '');
  const num = parseFloat(raw);
  if (isNaN(num)) return { ok: false, error: 'Not a number' };
  // Convert to the field's native unit (percent fields: user enters 95 → 0.95)
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
  return (
    <span style={{ fontFamily: MONO, fontSize: 7, color, flexShrink: 0 }}>{level}</span>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: 'advanced' | 'expert' }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 7, color: '#475569', flexShrink: 0 }}>
      {tier === 'advanced' ? '[ADV]' : '[EXP]'}
    </span>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────────

interface EditableCellProps {
  field: LeasingFieldDef;
  /** Current resolved value (override if set, else platform default) */
  displayValue: number | string | null | undefined;
  hasOverride: boolean;
  /** onCommit passes raw input string; validation and parsing happens in parent */
  onCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

function EditableCell({ field, displayValue, hasOverride, onCommit }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleStartEdit = () => {
    if (field.readonly) return;
    // Seed the draft with the current value in user-friendly format
    if (typeof displayValue === 'number') {
      if (field.type === 'percent') {
        setDraft(String((displayValue * 100).toFixed(2)));
      } else {
        setDraft(String(Math.round(displayValue)));
      }
    } else if (typeof displayValue === 'string') {
      setDraft(displayValue);
    } else {
      setDraft('');
    }
    setValidationError(null);
    setEditing(true);
  };

  const handleCommit = () => {
    if (!draft.trim()) {
      setEditing(false);
      return;
    }
    const result = validateInput(draft, field);
    if (!result.ok) {
      setValidationError(result.error ?? 'Invalid');
      return;
    }
    setValidationError(null);
    setEditing(false);
    onCommit(field.path, draft.trim(), field);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <input
          autoFocus
          value={draft}
          onChange={e => { setDraft(e.target.value); setValidationError(null); }}
          onBlur={handleCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCommit();
            if (e.key === 'Escape') { setEditing(false); setValidationError(null); }
          }}
          style={{
            fontFamily: MONO, fontSize: 10,
            background: validationError ? '#2d1010' : '#1a2a3a',
            color: validationError ? '#fca5a5' : '#bfdbfe',
            border: `1px solid ${validationError ? '#b91c1c' : '#3b82f6'}`,
            borderRadius: 2, padding: '2px 6px',
            width: 90, outline: 'none',
          }}
        />
        {validationError && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#fca5a5' }}>
            {validationError}
          </span>
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
        padding: '1px 4px',
        borderRadius: 2,
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
  /** The path-keyed override value for this field (leasingPathOverrides[field.path]) */
  overrideValue: number | string | null;
  onCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

function FieldRow({ field, showTierBadge, overrideValue, onCommit }: FieldRowProps) {
  const [hovered, setHovered] = useState(false);
  const hasOverride = overrideValue != null;

  // Resolved display value: override → platform default → null
  const displayValue: number | string | null | undefined = hasOverride
    ? overrideValue
    : (field.platformDefault ?? null);

  // Infer source badge from override + default source text
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
      {field.readonly && (
        <Lock style={{ width: 9, height: 9, color: '#334155', flexShrink: 0 }} />
      )}

      <span style={{
        fontFamily: MONO, fontSize: 10, color: '#94a3b8',
        width: 280, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {field.label}
      </span>

      {showTierBadge && field.tier !== 'beginner' && (
        <TierBadge tier={field.tier as 'advanced' | 'expert'} />
      )}

      <div style={{ flex: 1 }} />

      <EditableCell
        field={field}
        displayValue={displayValue}
        hasOverride={hasOverride}
        onCommit={onCommit}
      />

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

  // Per-field mode enforcement (not just category-level)
  const visibleFields = cat.fields.filter(f => {
    // Mode filter (field-level)
    if (f.modes !== 'all' && leaseMode != null && !f.modes.includes(leaseMode)) return false;
    // Tier filter
    if (f.tier === 'beginner') return true;
    if (f.tier === 'advanced') return showAdvanced || showExpert;
    if (f.tier === 'expert') return showExpert;
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
          cursor: 'pointer', userSelect: 'none',
          minHeight: 32,
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
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#2a2a2a' }}>
          {visibleFields.length}
        </span>
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
// Exported so AssumptionsTab renders it in place of Section 5-traf rows.
// This MUST remain read-only. Cost Treatment toggle MUST NOT appear here.
// Dual-location-only principle (spec §6): Cost Treatment lives in Deal Settings
// and the F9 top bar only.

export interface LeasingSummaryCardProps {
  financials: F9DealFinancials | null;
  /** Path-keyed override map (same keys as field.path in leasing-fields.config.ts) */
  leasingPathOverrides: Record<string, number | string | null>;
  onGoToLeasing: () => void;
}

export function LeasingSummaryCard({ financials, leasingPathOverrides, onGoToLeasing }: LeasingSummaryCardProps) {
  const sig = financials?.trafficProjection?.leasingSignals;
  const yr1 = financials?.trafficProjection?.yearly?.[0];

  const currentOcc = yr1?.occupancyPct ?? null;
  // Path-keyed reads — same paths as field.path in leasing-fields.config.ts
  const targetOcc = (leasingPathOverrides['traffic.stabilization.ceiling_occupancy'] as number | null) ?? 0.95;
  const rentGrowth = yr1?.rentGrowthPct ?? (leasingPathOverrides['traffic.coefficients.blended_rent_growth'] as number | null);
  const concStrategy = (leasingPathOverrides['lease_velocity.inputs.concession_strategy'] as string | null) ?? 'MARKET';

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
      source: (leasingPathOverrides['lease_velocity.inputs.concession_strategy'] != null ? 'EDIT' : 'PLAT') as 'PLAT' | 'EDIT',
    },
  ];

  return (
    <div style={{
      background: '#0e0e0e',
      border: '1px solid #1e1e1e',
      borderRadius: 4,
      margin: '8px 12px',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', background: '#141414', borderBottom: '1px solid #1e1e1e',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#475569', letterSpacing: '0.1em' }}>
          LEASING SNAPSHOT
        </span>
        {sig?.confidence != null && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#22d3ee80' }}>
            M07 · {sig.confidence}% conf
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#1a1a1a' }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#0e0e0e', padding: '7px 12px' }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: '#475569', marginBottom: 2, letterSpacing: '0.05em' }}>
              {m.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                {m.value}
              </span>
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
  /** Resolved lease mode (computed from financials in AssumptionsTab, passed as prop) */
  leaseMode: LeaseMode | null;
  /**
   * Path-keyed override map — same keys as LeasingFieldDef.path.
   * Backed by existing overrides state in AssumptionsTab (not a separate state).
   * Keys that are string enum values coexist with numeric year-0 values.
   */
  leasingPathOverrides: Record<string, number | string | null>;
  /**
   * Called when the user commits an edit.
   * path     = field.path (backend dealContext path)
   * rawInput = raw user input string (e.g. "95" for 95%)
   * field    = full field def (for type, min, max, readonly)
   */
  onFieldCommit: (path: string, rawInput: string, field: LeasingFieldDef) => void;
}

export function LeasingAssumptionsTab({
  financials,
  leaseMode,
  leasingPathOverrides,
  onFieldCommit,
}: LeasingAssumptionsTabProps) {
  // ── Tier preferences (per-user, not per-deal) ─────────────────────────────
  const [tierPrefs, setTierPrefs] = useState<LeasingTierPrefs>(() => {
    try {
      const raw = localStorage.getItem(LEASING_TIER_PREFS_KEY);
      return raw ? { ...DEFAULT_TIER_PREFS, ...JSON.parse(raw) } : DEFAULT_TIER_PREFS;
    } catch {
      return DEFAULT_TIER_PREFS;
    }
  });

  const setTierPref = useCallback((key: keyof LeasingTierPrefs, val: boolean) => {
    setTierPrefs(prev => {
      const next = { ...prev, [key]: val };
      // Expert on → advanced must also be on
      if (key === 'show_expert' && val) next.show_advanced = true;
      if (key === 'show_advanced' && !val) next.show_expert = false;
      try { localStorage.setItem(LEASING_TIER_PREFS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Mode-conditional category visibility ──────────────────────────────────
  // Category-level: categories E and F are entirely mode-conditional.
  // Field-level: per-field mode filtering happens inside CategoryBlock.
  const visibleCats = LEASING_CATEGORIES.filter(cat => {
    if (cat.visibleIn === 'all') return true;
    if (leaseMode == null) return true; // show all when mode pending
    return cat.visibleIn.includes(leaseMode);
  });

  // ── Count fields for toggle labels ────────────────────────────────────────
  const advCount = visibleCats.reduce((n, cat) =>
    n + cat.fields.filter(f => {
      if (f.tier !== 'advanced') return false;
      if (f.modes !== 'all' && leaseMode != null && !f.modes.includes(leaseMode)) return false;
      return true;
    }).length, 0);
  const expCount = visibleCats.reduce((n, cat) =>
    n + cat.fields.filter(f => {
      if (f.tier !== 'expert') return false;
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
              : leaseMode === 'OCCUPANCY_RECOVERY' ? '#78350f44' : '#14532d44',
            color: leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? '#a5b4fc'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? '#fcd34d' : '#86efac',
            border: `1px solid ${leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? '#3730a3'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? '#78350f' : '#14532d'}44`,
          }}>
            {leaseMode === 'LEASE_UP_NEW_CONSTRUCTION' ? 'LEASE-UP'
              : leaseMode === 'OCCUPANCY_RECOVERY' ? 'RECOVERY' : 'STABILIZED'}
          </span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>MODE PENDING</span>
        )}

        <div style={{ flex: 1 }} />

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
      </div>

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

      {/* ── Categories ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visibleCats.map(cat => (
          <CategoryBlock
            key={cat.id}
            cat={cat}
            leaseMode={leaseMode}
            showAdvanced={tierPrefs.show_advanced}
            showExpert={tierPrefs.show_expert}
            leasingPathOverrides={leasingPathOverrides}
            onCommit={onFieldCommit}
          />
        ))}

        {/* ── Advanced toggle prompt (when not yet expanded) ── */}
        {!tierPrefs.show_advanced && advCount > 0 && (
          <div
            onClick={() => setTierPref('show_advanced', true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', background: '#0e0e0e',
              borderTop: '1px solid #1a1a1a',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>
              ▸ Show advanced assumptions ({advCount} additional fields)
            </span>
          </div>
        )}

        {/* ── Expert toggle prompt (when advanced shown but not expert) ── */}
        {tierPrefs.show_advanced && !tierPrefs.show_expert && expCount > 0 && (
          <div
            onClick={() => setTierPref('show_expert', true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', background: '#0e0e0e',
              borderTop: '1px solid #1a1a1a',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 8, color: '#334155' }}>
              ▸ Show expert overrides ({expCount} additional fields — array editors, decay curves)
            </span>
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export type { LeasingFieldDef, FieldType };
export default LeasingAssumptionsTab;
