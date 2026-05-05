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
//   - MAX 3 SUB-TABS under Assumptions. Do not add a 4th. If another concern
//     grows large enough, it belongs on its own F-key page.
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Lock, Info } from 'lucide-react';
import {
  LEASING_CATEGORIES,
  getVisibleCategories,
  LEASING_TIER_PREFS_KEY,
  DEFAULT_TIER_PREFS,
  type LeasingFieldDef,
  type LeasingCategoryDef,
  type LeaseMode,
  type LeasingTierPrefs,
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
  currentValue: string | number | null | undefined;
  overrideValue: string | number | null;
  onCommit: (fieldId: string, value: string) => void;
  disabled?: boolean;
}

function EditableCell({ field, currentValue, overrideValue, onCommit, disabled }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const hasOverride = overrideValue != null;
  const displayVal = hasOverride ? overrideValue : currentValue;

  const handleStartEdit = () => {
    if (field.readonly || disabled) return;
    const val = displayVal;
    if (field.type === 'percent' && typeof val === 'number') {
      setDraft(String((val * 100).toFixed(2)));
    } else {
      setDraft(val != null ? String(val) : '');
    }
    setEditing(true);
  };

  const handleCommit = () => {
    setEditing(false);
    if (draft.trim() === '') return;
    onCommit(field.id, draft.trim());
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={e => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          fontFamily: MONO, fontSize: 10, background: '#1a2a3a', color: '#bfdbfe',
          border: '1px solid #3b82f6', borderRadius: 2, padding: '2px 6px',
          width: 90, outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={handleStartEdit}
      title={field.tooltip}
      style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 600,
        color: hasOverride ? '#3b82f6' : '#e2e8f0',
        cursor: field.readonly || disabled ? 'default' : 'pointer',
        padding: '1px 4px',
        borderRadius: 2,
        borderBottom: field.readonly ? 'none' : '1px dashed #2a2a2a',
        minWidth: 60, display: 'inline-block', textAlign: 'right',
      }}
    >
      {formatFieldValue(field, displayVal as number | string | null)}
      {hasOverride && (
        <span style={{ fontFamily: MONO, fontSize: 6, color: '#3b82f6', marginLeft: 2 }}>✎</span>
      )}
    </span>
  );
}

// ── Single field row ──────────────────────────────────────────────────────────

interface FieldRowProps {
  field: LeasingFieldDef;
  showTier: boolean;
  currentValue: string | number | null | undefined;
  overrideValue: string | number | null;
  onCommit: (fieldId: string, value: string) => void;
}

function FieldRow({ field, showTier, currentValue, overrideValue, onCommit }: FieldRowProps) {
  const [hovered, setHovered] = useState(false);
  const hasOverride = overrideValue != null;

  // Infer source badge: EDIT if override, SUBJ/PEER/PLAT heuristic from default source
  const sourceBadge: 'SUBJ' | 'PEER' | 'PLAT' | 'EDIT' | null = hasOverride ? 'EDIT'
    : field.defaultSource.startsWith('Subject') ? 'SUBJ'
    : field.defaultSource.startsWith('Peer') || field.defaultSource.includes('peer') ? 'PEER'
    : field.defaultSource.startsWith('Platform') || field.defaultSource.startsWith('Mode') ? 'PLAT'
    : null;

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
      {/* Lock icon for read-only */}
      {field.readonly && (
        <Lock style={{ width: 9, height: 9, color: '#334155', flexShrink: 0 }} />
      )}

      {/* Label */}
      <span style={{
        fontFamily: MONO, fontSize: 10, color: '#94a3b8',
        width: 280, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {field.label}
      </span>

      {/* Tier badge (ADV/EXP) — shown when in mixed-tier view */}
      {showTier && field.tier !== 'beginner' && (
        <TierBadge tier={field.tier as 'advanced' | 'expert'} />
      )}

      {/* Value / edit cell */}
      <div style={{ flex: 1 }} />
      <EditableCell
        field={field}
        currentValue={currentValue}
        overrideValue={overrideValue}
        onCommit={onCommit}
        disabled={false}
      />

      {/* Source + confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 110, justifyContent: 'flex-end' }}>
        <SourceBadge source={sourceBadge} />
        {/* Confidence is not per-field yet — show HIGH for SUBJ-sourced, MED for PEER, LOW/null for PLAT */}
        <ConfBadge level={sourceBadge === 'SUBJ' ? 'HIGH' : sourceBadge === 'PEER' ? 'MED' : sourceBadge === 'PLAT' ? 'LOW' : null} />
      </div>

      {/* Tooltip icon */}
      {hovered && (
        <Info style={{ width: 9, height: 9, color: '#334155', flexShrink: 0 }} title={field.tooltip} />
      )}
    </div>
  );
}

// ── Category block ────────────────────────────────────────────────────────────

interface CategoryBlockProps {
  cat: LeasingCategoryDef;
  showAdvanced: boolean;
  showExpert: boolean;
  fieldOverrides: Record<string, string | number | null>;
  financials: F9DealFinancials | null;
  onCommit: (fieldId: string, value: string) => void;
}

function CategoryBlock({ cat, showAdvanced, showExpert, fieldOverrides, onCommit }: CategoryBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleFields = cat.fields.filter(f => {
    if (f.tier === 'beginner') return true;
    if (f.tier === 'advanced') return showAdvanced || showExpert;
    if (f.tier === 'expert') return showExpert;
    return false;
  });

  if (visibleFields.length === 0) return null;

  const showTierBadges = showAdvanced || showExpert;

  return (
    <div style={{ marginBottom: 1 }}>
      {/* Category header */}
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
          {visibleFields.length} fields
        </span>
      </div>

      {/* Fields */}
      {!collapsed && visibleFields.map(field => (
        <FieldRow
          key={field.id}
          field={field}
          showTier={showTierBadges}
          currentValue={field.platformDefault as number | string | null}
          overrideValue={fieldOverrides[field.id] ?? null}
          onCommit={onCommit}
        />
      ))}
    </div>
  );
}

// ── Leasing summary card (rendered in General tab when activeSubTab === 'GENERAL') ──
// Exported so AssumptionsTab can render it in place of Section 5.
// Read-only: 4 key metrics + "→ Edit in Leasing tab" button.
// DO NOT add edit affordances here — this violates the dual-surface-only rule.

export interface LeasingSummaryCardProps {
  financials: F9DealFinancials | null;
  overrides: Record<string, number | string | null>;
  onGoToLeasing: () => void;
}

export function LeasingSummaryCard({ financials, overrides, onGoToLeasing }: LeasingSummaryCardProps) {
  const sig = financials?.trafficProjection?.leasingSignals;
  const yr1 = financials?.trafficProjection?.yearly?.[0];

  // Derive the 4 metrics
  const currentOcc = yr1?.occupancyPct ?? null;
  const targetOcc = (overrides?.['a_stabilized_occ'] as number | null) ?? 0.95;
  const rentGrowth = yr1?.rentGrowthPct ?? null;
  const concStrategy = (overrides?.['d_concession_strategy'] as string | null) ?? 'MARKET';

  const metrics = [
    {
      label: 'Current Occupancy',
      value: currentOcc != null ? pctFmt(currentOcc) : '—',
      source: currentOcc != null ? 'SUBJ' : 'PLAT',
    },
    {
      label: 'Target Stabilized Occ.',
      value: pctFmt(targetOcc),
      source: overrides?.['a_stabilized_occ'] != null ? 'EDIT' : 'PLAT',
    },
    {
      label: 'Blended Rent Growth',
      value: rentGrowth != null ? pctFmt(rentGrowth) : '—',
      source: rentGrowth != null ? 'SUBJ' : 'PLAT',
    },
    {
      label: 'Concession Strategy',
      value: concStrategy,
      source: overrides?.['d_concession_strategy'] != null ? 'EDIT' : 'PLAT',
    },
  ] as const;

  return (
    <div style={{
      background: '#0e0e0e',
      border: '1px solid #1e1e1e',
      borderRadius: 4,
      margin: '8px 12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
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

      {/* 4 metrics */}
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
              <SourceBadge source={m.source as 'SUBJ' | 'PEER' | 'PLAT' | 'EDIT'} />
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
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
  /** Leasing field overrides — keyed by LeasingFieldDef.id */
  fieldOverrides: Record<string, string | number | null>;
  onFieldCommit: (fieldId: string, rawInput: string) => void;
}

export function LeasingAssumptionsTab({ financials, fieldOverrides, onFieldCommit }: LeasingAssumptionsTabProps) {
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

  // ── Resolve lease mode from financials ────────────────────────────────────
  const leaseMode: LeaseMode | null = (financials?.leaseVelocity?.resolvedMode as LeaseMode | null) ?? null;
  const visibleCatIds = getVisibleCategories(leaseMode);

  const visibleCats = LEASING_CATEGORIES.filter(cat => visibleCatIds.includes(cat.id));

  // ── Count fields for toggle labels ────────────────────────────────────────
  const advCount = visibleCats.reduce((n, cat) =>
    n + cat.fields.filter(f => f.tier === 'advanced' && visibleCatIds.includes(cat.id)).length, 0);
  const expCount = visibleCats.reduce((n, cat) =>
    n + cat.fields.filter(f => f.tier === 'expert' && visibleCatIds.includes(cat.id)).length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#0a0a0a' }}>
      {/* ── Top bar: mode indicator + tier toggles ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 16px', background: '#111', borderBottom: '1px solid #1e1e1e',
        flexShrink: 0,
      }}>
        {/* Mode badge */}
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

        {/* Tier toggles */}
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
            showAdvanced={tierPrefs.show_advanced}
            showExpert={tierPrefs.show_expert}
            fieldOverrides={fieldOverrides}
            financials={financials}
            onCommit={onFieldCommit}
          />
        ))}

        {/* ── Advanced toggle prompt (when not yet expanded) ── */}
        {!tierPrefs.show_advanced && (
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
        {tierPrefs.show_advanced && !tierPrefs.show_expert && (
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

        {/* ── Bottom padding ── */}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export default LeasingAssumptionsTab;
