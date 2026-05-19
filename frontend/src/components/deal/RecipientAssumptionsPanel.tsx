/**
 * RecipientAssumptionsPanel — Task #907 Phase 1
 *
 * Shown only in recipient mode (inside RecipientProvider).
 * Calls useRecipient() to read and write the session overlay.
 * Demonstrates the full overlay round-trip:
 *   edit → patchOverlay (PATCH /shares/:sc/overlay) → overlay saved in DB
 *   reset → resetOverlay (DELETE /shares/:sc/overlay?path=...) → reverts to sender value
 *
 * Key recipient-mode invariant: edits ONLY touch the recipient's session overlay.
 * The sender's deal_capsules record is never modified.
 */

import React, { useState } from 'react';
import { useRecipient } from '../../contexts/RecipientContext';

const MONO = '"JetBrains Mono","Fira Mono",monospace';
const AMBER  = '#F0B429';
const BG_NAV = '#0D1117';
const BORDER = '#1E2A3B';
const TEXT_DIM  = '#5A6A7E';
const TEXT_BASE = '#C9D1D9';

// ─── Single editable assumption field ─────────────────────────────────────────

interface FieldProps {
  label: string;
  path: string;
  baseValue: number | null;
  overlayValue: number | undefined;
  suffix: string;
  decimals: number;
  patchOverlay: (path: string, value: number) => Promise<void>;
  resetOverlay: (path?: string) => Promise<void>;
}

function AssumptionField({
  label, path, baseValue, overlayValue, suffix, decimals,
  patchOverlay, resetOverlay,
}: FieldProps) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState('');
  const [saving,  setSaving]    = useState(false);
  const [resetting, setResetting] = useState(false);

  const isOverridden  = overlayValue !== undefined;
  const displayValue  = isOverridden ? overlayValue : baseValue;
  const displayStr    = displayValue != null ? `${displayValue.toFixed(decimals)}${suffix}` : '—';

  const handleEdit = () => {
    setDraft(displayValue != null ? String(displayValue) : '');
    setEditing(true);
  };

  const handleSave = async () => {
    const n = parseFloat(draft);
    if (isNaN(n)) { setEditing(false); return; }
    setSaving(true);
    try { await patchOverlay(path, n); } finally { setSaving(false); setEditing(false); }
  };

  const handleReset = async () => {
    setResetting(true);
    try { await resetOverlay(path); } finally { setResetting(false); }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 12px',
      borderLeft: `2px solid ${isOverridden ? AMBER : BORDER}`,
      background: isOverridden ? `${AMBER}08` : 'transparent',
      borderRadius: '0 3px 3px 0',
    }}>
      <span style={{
        fontSize: 9, color: TEXT_DIM, fontFamily: MONO, letterSpacing: 0.8,
        textTransform: 'uppercase', minWidth: 84,
      }}>
        {label}
      </span>

      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleSave();
              if (e.key === 'Escape') setEditing(false);
            }}
            style={{
              width: 56, background: '#111820', border: `1px solid ${AMBER}`,
              color: AMBER, fontFamily: MONO, fontSize: 12,
              padding: '2px 6px', borderRadius: 3, outline: 'none',
            }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ fontSize: 9, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}
          >
            {saving ? '…' : 'SAVE'}
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{ fontSize: 9, color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}
          >
            ESC
          </button>
        </>
      ) : (
        <>
          <span style={{
            fontSize: 13, fontFamily: MONO,
            color:      isOverridden ? AMBER     : TEXT_BASE,
            fontWeight: isOverridden ? 700       : 400,
            minWidth:   54,
          }}>
            {displayStr}
          </span>

          <button
            onClick={handleEdit}
            style={{
              fontSize: 9, color: TEXT_DIM, background: 'none',
              border: `1px solid ${BORDER}`, cursor: 'pointer',
              fontFamily: MONO, padding: '1px 6px', borderRadius: 2,
            }}
          >
            EDIT
          </button>

          {isOverridden && (
            <button
              onClick={handleReset}
              disabled={resetting}
              title="Reset to sender's live value"
              style={{
                fontSize: 9, color: TEXT_DIM, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: MONO,
              }}
            >
              {resetting ? '…' : '↺ RESET'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const FIELDS: Array<{ label: string; path: string; suffix: string; decimals: number }> = [
  { label: 'Exit Cap Rate', path: 'exit_cap',    suffix: '%',   decimals: 2 },
  { label: 'IRR Target',    path: 'irr_target',  suffix: '%',   decimals: 1 },
  { label: 'Hold Period',   path: 'hold_period', suffix: ' yrs', decimals: 0 },
];

export function RecipientAssumptionsPanel() {
  const { overlay, patchOverlay, resetOverlay, dealBook } = useRecipient();
  const [collapsed, setCollapsed] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);

  if (!dealBook) return null;

  const assumptions = (
    (dealBook.capsule.deal_data?.assumptions as Record<string, number> | undefined) ?? {}
  );

  const overlaidCount = FIELDS.filter(f => overlay[f.path] !== undefined).length;

  const handleResetAll = async () => {
    setResettingAll(true);
    try { await resetOverlay(); } finally { setResettingAll(false); }
  };

  return (
    <div style={{
      background: BG_NAV,
      borderBottom: `1px solid ${BORDER}`,
      padding: '7px 16px',
      flexShrink: 0,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: collapsed ? 0 : 8 }}>
        <span style={{ fontSize: 9, fontFamily: MONO, color: TEXT_DIM, letterSpacing: 1, textTransform: 'uppercase' }}>
          YOUR ASSUMPTIONS
          {overlaidCount > 0 && (
            <span style={{ color: AMBER, marginLeft: 6 }}>· {overlaidCount} OVERRIDE{overlaidCount !== 1 ? 'S' : ''}</span>
          )}
        </span>

        {overlaidCount > 0 && (
          <button
            onClick={handleResetAll}
            disabled={resettingAll}
            style={{
              fontSize: 9, color: TEXT_DIM, background: 'none',
              border: `1px solid ${BORDER}`, cursor: 'pointer',
              fontFamily: MONO, padding: '1px 8px', borderRadius: 2,
            }}
          >
            {resettingAll ? '…' : 'RESET ALL'}
          </button>
        )}

        <span style={{ fontSize: 9, fontFamily: MONO, color: TEXT_DIM, marginLeft: 'auto' }}>
          edits apply only to your view · sender&apos;s deal is unchanged
        </span>

        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ fontSize: 9, color: TEXT_DIM, background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO }}
          aria-label={collapsed ? 'Show assumptions' : 'Hide assumptions'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {FIELDS.map(f => (
            <AssumptionField
              key={f.path}
              label={f.label}
              path={f.path}
              baseValue={assumptions[f.path] ?? null}
              overlayValue={overlay[f.path] as number | undefined}
              suffix={f.suffix}
              decimals={f.decimals}
              patchOverlay={patchOverlay}
              resetOverlay={resetOverlay}
            />
          ))}
        </div>
      )}
    </div>
  );
}
