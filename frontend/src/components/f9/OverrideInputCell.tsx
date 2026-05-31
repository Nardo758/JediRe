/**
 * OverrideInputCell — Bloomberg Terminal-style override pin for underwriting assumption fields.
 *
 * Self-contained component that:
 *   1. On mount, fetches active_override from GET /assumptions/:fieldPath/evidence
 *   2. Shows a pin-icon button when no override is active
 *   3. Opens an inline input on click
 *   4. On save: calls POST /assumptions/:fieldPath/override and shows the OVERRIDE badge
 *   5. On clear (✕): calls DELETE /assumptions/:fieldPath/override and restores computed/agent value
 *
 * This component writes to the deal_context_fields underwriting override layer,
 * which is distinct from the proforma year-1 PATCH /financials/override pipeline.
 * The backend get-field-value service reads both layers for divergence analysis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Pin, X } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';

const MONO = BT.font.mono;

interface Props {
  dealId: string;
  fieldPath: string;
  fieldLabel: string;
  currentValue?: number | null;
  onOverrideApplied?: (value: number) => void;
  onOverrideCleared?: () => void;
}

interface ActiveOverride {
  value: number;
  overridden_at: string;
  reason: string | null;
}

export function OverrideInputCell({
  dealId, fieldPath, fieldLabel, currentValue, onOverrideApplied, onOverrideCleared,
}: Props) {
  const [activeOverride, setActiveOverride] = useState<ActiveOverride | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/evidence`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        const ao = d.active_override;
        if (ao?.value != null) {
          const v = parseFloat(String(ao.value));
          if (!isNaN(v)) {
            setActiveOverride({ value: v, overridden_at: ao.overridden_at, reason: ao.reason });
          }
        }
        setLoading(false);
      })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [dealId, fieldPath]);

  const startEditing = useCallback(() => {
    const base = activeOverride?.value ?? currentValue;
    setDraft(base != null ? String(Math.round(base)) : '');
    setEditing(true);
  }, [activeOverride, currentValue]);

  const handleSave = useCallback(async () => {
    const v = parseFloat(draft);
    if (isNaN(v)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/override`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value: v }),
        },
      );
      if (res.ok) {
        const ao: ActiveOverride = { value: v, overridden_at: new Date().toISOString(), reason: null };
        setActiveOverride(ao);
        setEditing(false);
        onOverrideApplied?.(v);
      }
    } finally {
      setSaving(false);
    }
  }, [dealId, fieldPath, draft, onOverrideApplied]);

  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch(
        `/api/v1/deals/${dealId}/assumptions/${encodeURIComponent(fieldPath)}/override`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (res.ok) {
        setActiveOverride(null);
        onOverrideCleared?.();
      }
    } finally {
      setClearing(false);
    }
  }, [dealId, fieldPath, onOverrideCleared]);

  if (loading) return null;

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { void handleSave(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => {
            if (draft.trim() !== '') void handleSave();
            else setEditing(false);
          }}
          placeholder="$"
          style={{
            width: 76, background: '#0f172a',
            border: '1px solid #c084fc',
            color: '#f8fafc', fontFamily: MONO, fontSize: 8,
            padding: '1px 4px', borderRadius: 2, textAlign: 'right',
          }}
        />
        <button
          title="Save override"
          onMouseDown={e => { e.preventDefault(); void handleSave(); }}
          style={{
            background: '#1e1065', border: '1px solid #c084fc66', borderRadius: 2,
            color: '#c084fc', fontFamily: MONO, fontSize: 8, padding: '1px 4px',
            cursor: 'pointer', lineHeight: 1, fontWeight: 700,
          }}
        >
          {saving ? '…' : '✓'}
        </button>
        <button
          title="Cancel"
          onMouseDown={e => { e.preventDefault(); setEditing(false); }}
          style={{
            background: 'none', border: 'none', borderRadius: 2,
            color: '#475569', fontFamily: MONO, fontSize: 9, padding: '1px 2px',
            cursor: 'pointer', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </span>
    );
  }

  if (activeOverride != null) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <button
          onClick={startEditing}
          title={`Operator override: $${Math.round(activeOverride.value).toLocaleString()} · set ${new Date(activeOverride.overridden_at).toLocaleDateString()} · click to edit`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: '1px 5px', borderRadius: 2,
            fontFamily: MONO, fontSize: 7, letterSpacing: 0.3, fontWeight: 700,
            color: '#c084fc', background: '#2e1065',
            cursor: 'pointer', border: '1px solid #c084fc44',
          }}
        >
          <Pin size={7} />
          OVERRIDE
        </button>
        <button
          onClick={() => { void handleClear(); }}
          disabled={clearing}
          title="Clear override — restore computed/agent value"
          style={{
            background: 'none', border: 'none', cursor: clearing ? 'wait' : 'pointer',
            color: '#475569', padding: '0px 1px',
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <X size={8} />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={startEditing}
      title={`Pin a manual override for ${fieldLabel} — bypasses computed/agent value`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#334155', padding: '1px 2px',
        display: 'inline-flex', alignItems: 'center',
      }}
    >
      <Pin size={9} />
    </button>
  );
}
