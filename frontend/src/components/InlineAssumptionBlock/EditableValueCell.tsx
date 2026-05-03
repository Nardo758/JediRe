import React, {
  useState, useRef, useCallback, useImperativeHandle, forwardRef,
} from 'react';
import { T } from './tokens';
import type { FieldFormat } from './types';
import { formatValue } from './formatHelpers';

// ─── Formatting helpers ────────────────────────────────────────────────────

function parseRaw(raw: string, format: FieldFormat): number | null {
  const cleaned = raw.replace(/[%$,\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  if (format === 'pct') return n / 100;
  return n;
}

function draftOf(value: number, format: FieldFormat): string {
  switch (format) {
    case 'pct':      return (value * 100).toFixed(2);
    case 'currency': return String(Math.round(value));
    case 'months':   return value.toFixed(1);
    case 'days':     return value.toFixed(1);
    case 'ratio':    return value.toFixed(2);
    case 'num':
    default:         return value.toFixed(2);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export interface EditableValueCellRef {
  focusEdit: () => void;
}

interface EditableValueCellProps {
  value: number | null;
  format: FieldFormat;
  precision: number;
  min?: number;
  max?: number;
  hasOverride: boolean;
  fieldId: string;
  fieldLabel: string;
  onCommit: (value: number) => void;
  onRevert: () => void;
  /** Called after commit when Tab is pressed — moves focus to next EFFECTIVE cell */
  onTabNext?: () => void;
  /** Called after commit when Shift+Tab is pressed — moves focus to prev EFFECTIVE cell */
  onTabPrev?: () => void;
}

export const EditableValueCell = forwardRef<EditableValueCellRef, EditableValueCellProps>(
  function EditableValueCell(
    { value, format, precision, min, max, hasOverride, fieldId, fieldLabel, onCommit, onRevert, onTabNext, onTabPrev },
    ref,
  ) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [rejected, setRejected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = useCallback(() => {
      // Allow editing even when value is null (2-col mode, no effective yet).
      // Initialize draft from current value, or fall back to min, then 0.
      const startValue = value ?? (min ?? 0);
      setDraft(draftOf(startValue, format));
      setEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }, [value, format, min]);

    useImperativeHandle(ref, () => ({ focusEdit: startEdit }), [startEdit]);

    const commitDraft = useCallback(() => {
      const parsed = parseRaw(draft, format);
      if (parsed == null) { setEditing(false); return; }
      if (min != null && parsed < min) { flash(); return; }
      if (max != null && parsed > max) { flash(); return; }
      setEditing(false);
      onCommit(parsed);
    }, [draft, format, min, max, onCommit]);

    const flash = () => {
      setRejected(true);
      setTimeout(() => setRejected(false), 400);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { commitDraft(); return; }
      if (e.key === 'Escape') { setEditing(false); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        commitDraft();
        // Move focus to next (Tab) or previous (Shift+Tab) EFFECTIVE cell —
        // read-only columns (PEER SET, SUBJECT, CONF) are skipped by design.
        if (e.shiftKey) onTabPrev?.();
        else            onTabNext?.();
        return;
      }

      const step = e.shiftKey ? precision * 10 : precision;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const parsed = parseRaw(draft, format);
        if (parsed != null) {
          const next = parsed + (format === 'pct' ? step / 100 : step);
          if (max == null || next <= max) setDraft(draftOf(next, format));
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const parsed = parseRaw(draft, format);
        if (parsed != null) {
          const next = parsed - (format === 'pct' ? step / 100 : step);
          if (min == null || next >= min) setDraft(draftOf(next, format));
        }
        return;
      }
    };

    const displayColor = hasOverride ? T.accent.user : T.text.cyan;

    if (editing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            ref={inputRef}
            autoFocus
            role="textbox"
            aria-label={`Edit ${fieldLabel}`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
            style={{
              fontFamily: T.font.mono,
              fontSize: T.fontSize.value,
              fontVariantNumeric: 'tabular-nums',
              color: rejected ? T.text.red : T.accent.user,
              fontWeight: 700,
              background: rejected ? `${T.text.red}18` : T.bg.input,
              border: `1px solid ${rejected ? T.text.red : T.accent.user}60`,
              borderRadius: 2,
              padding: '1px 4px',
              width: 72,
              textAlign: 'right',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          />
          {hasOverride && (
            <button
              onClick={e => { e.stopPropagation(); onRevert(); }}
              title="Revert to effective value"
              style={{
                fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                color: T.text.muted, background: 'none',
                border: `1px solid ${T.border.subtle}`, borderRadius: 2,
                padding: '1px 3px', cursor: 'pointer',
              }}
            >↩</button>
          )}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          onClick={startEdit}
          role="textbox"
          aria-label={`${fieldLabel} — click to edit`}
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') startEdit(); }}
          style={{
            fontFamily: T.font.mono,
            fontSize: T.fontSize.value,
            fontVariantNumeric: 'tabular-nums',
            color: displayColor,
            fontWeight: hasOverride ? 700 : 600,
            cursor: 'pointer',
            borderBottom: `1px dashed ${displayColor}50`,
            padding: '0 2px',
            userSelect: 'none',
          }}
          title="Click to edit (Up/Down to increment, Shift×10)"
        >
          {formatValue(value, format)}
        </span>
        {hasOverride && (
          <>
            <span style={{
              fontFamily: T.font.mono, fontSize: T.fontSize.badge,
              color: T.accent.user, background: `${T.accent.user}18`,
              border: `1px solid ${T.accent.user}44`, borderRadius: 2,
              padding: '0 3px', lineHeight: '12px', height: 12, display: 'inline-flex',
              alignItems: 'center', userSelect: 'none',
            }}>EDIT</span>
            <button
              onClick={e => { e.stopPropagation(); onRevert(); }}
              title="Revert override"
              style={{
                fontFamily: T.font.mono, fontSize: T.fontSize.badge,
                color: T.text.muted, background: 'none',
                border: `1px solid ${T.border.subtle}`, borderRadius: 2,
                padding: '1px 3px', cursor: 'pointer',
              }}
            >↩</button>
          </>
        )}
      </div>
    );
  },
);
