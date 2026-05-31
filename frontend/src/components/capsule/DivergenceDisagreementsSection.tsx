/**
 * DivergenceDisagreementsSection — Deal Capsule Source Disagreements panel
 *
 * Renders a collapsible "SOURCE DISAGREEMENTS" section listing fields where
 * source layers disagree beyond the materiality threshold. Designed for both
 * the internal Deal Capsule view and the Share modal (with an include/exclude
 * toggle for the freeze-on-share pattern).
 *
 * Props:
 *   dealId        — The deal UUID. Used to fetch field divergences.
 *   isInternal    — true = show all source names (including restricted vendors).
 *                   false = redact restricted vendor labels for external shares.
 *   showIncludeToggle  — When true, renders an "INCLUDE IN SHARE" toggle button.
 *   onIncludeChange    — Callback when include toggle changes.
 *   included      — Controlled state for the include toggle.
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../services/api.client';

const MONO = "'JetBrains Mono','Fira Code','IBM Plex Mono',monospace";
const BG_PANEL  = '#0f172a';
const BG_ROW    = '#0a0f1a';
const BG_HEADER = '#111827';
const BORDER    = '#1e2a3a';
const BORDER_MID = '#2a3441';
const TEXT      = '#e8e6e1';
const TEXT_MID  = '#9ea8b4';
const TEXT_DIM  = '#6b7585';
const AMBER     = '#F5A623';
const RED       = '#FF5252';
const GREEN     = '#00D26A';

// ── Types ────────────────────────────────────────────────────────────────────

interface DivergencePoint {
  layer: string;
  label: string;
  value: number;
  deltaAbsolute?: number;
  deltaRelative?: number | null;
  directionVsResolved?: 'above' | 'below' | 'equal';
}

interface DivergenceSignature {
  points: DivergencePoint[];
  maxAbsDelta: number;
  alertLevel: 'none' | 'info' | 'warn' | 'block';
  exceeds: boolean;
  threshold: number;
  fieldName: string;
  unit: string;
  isPct: boolean;
  interpretationHint?: string;
}

interface DivergenceEntry {
  fieldName: string;
  divergence: DivergenceSignature;
}

// Vendor source labels that should be redacted for external shares.
const RESTRICTED_VENDOR_LABELS = new Set([
  'CoStar', 'Yardi Matrix', 'CBRE Research', 'JLL Research', 'Cushman & Wakefield',
]);

function redactLabel(label: string, isInternal: boolean): string {
  if (isInternal) return label;
  if (RESTRICTED_VENDOR_LABELS.has(label)) return 'Market Data Provider';
  return label;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtFieldName(n: string): string {
  const MAP: Record<string, string> = {
    loss_to_lease:   'Loss to Lease',
    vacancy:         'Vacancy Rate',
    gpr:             'Gross Potential Rent',
    noi:             'Net Operating Income',
    exit_cap:        'Exit Cap Rate',
    rent_growth_yr1: 'Rent Growth Y1',
    concessions:     'Concessions',
    bad_debt:        'Bad Debt',
    other_income:    'Other Income',
    real_estate_tax: 'Real Estate Tax',
    insurance:       'Insurance',
    management_fee:  'Management Fee',
    repairs_maintenance: 'Repairs & Maintenance',
    utilities:       'Utilities',
    payroll:         'Payroll',
    administrative:  'Administrative',
    marketing:       'Marketing',
    contract_services: 'Contract Services',
  };
  return MAP[n] ?? n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmtVal(v: number, isPct: boolean): string {
  if (isPct) return `${(v * 100).toFixed(2)}%`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDelta(pt: DivergencePoint, isPct: boolean): string {
  if (!pt.deltaAbsolute || pt.deltaAbsolute === 0) return '—';
  const sign = pt.directionVsResolved === 'above' ? '+' : pt.directionVsResolved === 'below' ? '−' : '';
  if (isPct) return `${sign}${Math.round(pt.deltaAbsolute * 10000)} bps`;
  if (pt.deltaAbsolute >= 1e6) return `${sign}$${(pt.deltaAbsolute / 1e6).toFixed(2)}M`;
  if (pt.deltaAbsolute >= 1e3) return `${sign}$${Math.round(pt.deltaAbsolute / 1e3)}K`;
  return `${sign}$${Math.round(pt.deltaAbsolute)}`;
}

// ── Alert level styling ───────────────────────────────────────────────────────

function alertColor(lvl: string): string {
  if (lvl === 'block') return RED;
  return AMBER;
}

// ── Single field row ──────────────────────────────────────────────────────────

function FieldDisagreementRow({
  entry,
  isInternal,
}: {
  entry: DivergenceEntry;
  isInternal: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { fieldName, divergence } = entry;
  const color = alertColor(divergence.alertLevel);
  const deltaLabel = divergence.isPct
    ? `${Math.round(divergence.maxAbsDelta * 10000)} bps`
    : (() => {
        const d = divergence.maxAbsDelta;
        if (d >= 1e6) return `$${(d / 1e6).toFixed(2)}M`;
        if (d >= 1e3) return `$${Math.round(d / 1e3)}K`;
        return `$${Math.round(d)}`;
      })();

  return (
    <div style={{
      borderBottom: `1px solid ${BORDER}`,
    }}>
      {/* Row header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '14px 1fr auto auto auto',
          gap: '0 8px',
          alignItems: 'center',
          width: '100%',
          padding: '5px 12px',
          background: expanded ? `${color}0a` : 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          borderLeft: `2px solid ${color}`,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 8, color, lineHeight: 1 }}>⚡</span>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: TEXT, fontWeight: 600 }}>
          {fmtFieldName(fieldName)}
        </span>
        <span style={{
          fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.3,
          color, padding: '1px 5px',
          background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 2,
          whiteSpace: 'nowrap',
        }}>
          {divergence.alertLevel.toUpperCase()}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_MID, whiteSpace: 'nowrap' }}>
          Δ {deltaLabel}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_DIM }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ background: BG_ROW, padding: '6px 12px 8px 26px' }}>
          {/* Sources table */}
          <div style={{ marginBottom: 6 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: '0 8px', padding: '1px 0 4px 0',
              borderBottom: `1px solid ${BORDER}`,
              marginBottom: 3,
            }}>
              <span style={{ fontFamily: MONO, fontSize: 6.5, color: TEXT_DIM, letterSpacing: 0.4 }}>SOURCE</span>
              <span style={{ fontFamily: MONO, fontSize: 6.5, color: TEXT_DIM, letterSpacing: 0.4, textAlign: 'right' }}>VALUE</span>
              <span style={{ fontFamily: MONO, fontSize: 6.5, color: TEXT_DIM, letterSpacing: 0.4, textAlign: 'right', minWidth: 80 }}>Δ VS RESOLVED</span>
            </div>

            {divergence.points.map((pt, i) => {
              const isResolved = !pt.directionVsResolved || pt.directionVsResolved === 'equal';
              const dLabel = fmtDelta(pt, divergence.isPct);
              const dColor = pt.directionVsResolved === 'above' ? GREEN
                : pt.directionVsResolved === 'below' ? RED
                : TEXT_DIM;
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                  gap: '0 8px', padding: '2px 0',
                  borderTop: i > 0 ? `1px solid ${BORDER}` : undefined,
                  alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 7.5, color: TEXT_MID }}>
                      {redactLabel(pt.label, isInternal)}
                    </span>
                    {isResolved && (
                      <span style={{
                        fontFamily: MONO, fontSize: 6, letterSpacing: 0.3,
                        color: GREEN, background: '#00D26A14',
                        border: '1px solid #00D26A33',
                        padding: '0 3px', borderRadius: 1,
                      }}>IN USE</span>
                    )}
                  </div>
                  <span style={{
                    fontFamily: MONO, fontSize: 7.5, color: '#60a5fa', fontWeight: 700,
                    textAlign: 'right', whiteSpace: 'nowrap',
                  }}>
                    {fmtVal(pt.value, divergence.isPct)}
                  </span>
                  <span style={{
                    fontFamily: MONO, fontSize: 7, color: dColor, fontWeight: dLabel !== '—' ? 600 : 400,
                    textAlign: 'right', whiteSpace: 'nowrap', minWidth: 80,
                  }}>
                    {dLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Interpretation hint */}
          {divergence.interpretationHint && (
            <div style={{
              marginTop: 4, padding: '5px 8px',
              background: `${AMBER}08`,
              border: `1px solid ${AMBER}22`,
              borderRadius: 2,
              fontFamily: MONO, fontSize: 7, color: TEXT_MID, lineHeight: 1.5,
            }}>
              <span style={{ color: AMBER, fontWeight: 700 }}>WHY: </span>
              {divergence.interpretationHint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DivergenceDisagreementsSectionProps {
  dealId: string;
  isInternal?: boolean;
  showIncludeToggle?: boolean;
  included?: boolean;
  onIncludeChange?: (included: boolean) => void;
}

export function DivergenceDisagreementsSection({
  dealId,
  isInternal = true,
  showIncludeToggle = false,
  included = false,
  onIncludeChange,
}: DivergenceDisagreementsSectionProps) {
  const [entries, setEntries]     = useState<DivergenceEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setFetchError(null);
    apiClient
      .get<{ success: boolean; data: DivergenceEntry[] }>(`/api/v1/deals/${dealId}/field-divergences`)
      .then(res => {
        const raw = res?.data?.data ?? [];
        const material = raw.filter(
          e => e.divergence?.exceeds && (e.divergence.alertLevel === 'warn' || e.divergence.alertLevel === 'block'),
        );
        // Sort: block-level first, then by maxAbsDelta descending
        material.sort((a, b) => {
          if (a.divergence.alertLevel === 'block' && b.divergence.alertLevel !== 'block') return -1;
          if (b.divergence.alertLevel === 'block' && a.divergence.alertLevel !== 'block') return 1;
          return b.divergence.maxAbsDelta - a.divergence.maxAbsDelta;
        });
        setEntries(material);
      })
      .catch(err => {
        const msg = err?.response?.status === 404
          ? 'Divergence analysis unavailable — deal data not found.'
          : err?.response?.status === 403
          ? 'Access denied to divergence data.'
          : 'Failed to load source disagreements. Check connection and try again.';
        setFetchError(msg);
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  if (loading) {
    return (
      <div style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 8, color: TEXT_DIM }}>
        Loading divergence analysis…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{
        padding: '8px 12px',
        background: '#1a0a0a',
        border: `1px solid #FF525244`,
        borderRadius: 2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: RED }}>⚠</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_MID }}>
          {fetchError}
        </span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{
        padding: '8px 12px',
        background: `${GREEN}0a`,
        border: `1px solid ${GREEN}22`,
        borderRadius: 2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: GREEN }}>✓</span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: TEXT_MID }}>
          No material source disagreements — all tracked fields agree within thresholds.
        </span>
      </div>
    );
  }

  const blockCount = entries.filter(e => e.divergence.alertLevel === 'block').length;
  const warnCount  = entries.filter(e => e.divergence.alertLevel === 'warn').length;

  return (
    <div style={{
      background: BG_PANEL,
      border: `1px solid ${BORDER_MID}`,
      borderRadius: 2,
    }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        background: BG_HEADER,
        borderBottom: collapsed ? undefined : `1px solid ${BORDER}`,
        cursor: 'pointer',
      }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span style={{ fontFamily: MONO, fontSize: 7.5, color: AMBER, lineHeight: 1 }}>⚡</span>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: AMBER, letterSpacing: 0.6, flex: 1 }}>
          SOURCE DISAGREEMENTS
        </span>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 4 }}>
          {blockCount > 0 && (
            <span style={{
              fontFamily: MONO, fontSize: 6.5, fontWeight: 700,
              color: RED, background: `${RED}14`, border: `1px solid ${RED}44`,
              padding: '1px 5px', borderRadius: 2, whiteSpace: 'nowrap',
            }}>
              {blockCount} EXTREME
            </span>
          )}
          {warnCount > 0 && (
            <span style={{
              fontFamily: MONO, fontSize: 6.5, fontWeight: 700,
              color: AMBER, background: `${AMBER}14`, border: `1px solid ${AMBER}44`,
              padding: '1px 5px', borderRadius: 2, whiteSpace: 'nowrap',
            }}>
              {warnCount} MATERIAL
            </span>
          )}
        </div>

        {/* Include toggle (share flow) */}
        {showIncludeToggle && !collapsed && (
          <button
            onClick={e => { e.stopPropagation(); onIncludeChange?.(!included); }}
            style={{
              fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.4,
              padding: '2px 7px', borderRadius: 2, cursor: 'pointer',
              color:      included ? '#0f172a' : TEXT_DIM,
              background: included ? AMBER : 'transparent',
              border:     `1px solid ${included ? AMBER : BORDER_MID}`,
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            title={included ? 'Exclude this section from the share' : 'Include this section in the share'}
          >
            {included ? '✓ INCLUDED IN SHARE' : 'INCLUDE IN SHARE'}
          </button>
        )}

        <span style={{ fontFamily: MONO, fontSize: 7, color: TEXT_DIM }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {/* Field rows */}
      {!collapsed && (
        <div>
          {entries.map(entry => (
            <FieldDisagreementRow
              key={entry.fieldName}
              entry={entry}
              isInternal={isInternal}
            />
          ))}

          {/* Footer note */}
          <div style={{
            padding: '5px 12px',
            background: BG_HEADER,
            borderTop: `1px solid ${BORDER}`,
            fontFamily: MONO, fontSize: 7, color: TEXT_DIM, lineHeight: 1.5,
          }}>
            Expand any row to see all source layers and their deltas vs the resolved value.
            {!isInternal && (
              <span style={{ color: AMBER }}> · Restricted vendor names have been redacted for this view.</span>
            )}
            {' '}Review in <a
              href="#"
              onClick={e => e.preventDefault()}
              style={{ color: '#60a5fa', textDecoration: 'none' }}
            >Validation Grid (F9 → VALIDATION)</a> to override source preferences.
          </div>
        </div>
      )}
    </div>
  );
}
