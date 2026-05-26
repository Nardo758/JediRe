/**
 * SaveStatusBadge — reusable auto-save indicator.
 *
 * Renders a compact inline badge that cycles through four states:
 *   idle    → nothing rendered
 *   saving  → gray animated pulse "Saving…"
 *   saved   → green "Saved ✓"
 *   error   → red "Save failed"
 *
 * Designed to match the F3 ProgrammingTab reference implementation.
 * Supports two visual variants:
 *   'tailwind' — uses Tailwind classes (default, for Tailwind-styled pages)
 *   'inline'   — uses inline styles via BT tokens (for Bloomberg-terminal pages)
 *
 * Usage:
 *   const [saveStatus, setSaveStatus] = useSaveStatus();
 *   <SaveStatusBadge status={saveStatus} />
 *
 * Helper hook useSaveStatus() returns [status, withSave] where withSave wraps
 * any async save function and drives the status automatically.
 */

import React, { useCallback, useRef, useState } from 'react';
import { BT } from '../deal/bloomberg-ui';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// ─── Tailwind variant (matches ProgrammingTab exactly) ───────────────────────

function TailwindBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return <span className="text-xs text-gray-400 animate-pulse">Saving…</span>;
  }
  if (status === 'saved') {
    return <span className="text-xs text-emerald-400">Saved ✓</span>;
  }
  return <span className="text-xs text-red-400">Save failed</span>;
}

// ─── Inline variant (matches Bloomberg terminal token system) ────────────────

const MONO = BT.font.mono;

function InlineBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 8,
        color: BT.text.cyan,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>
        SAVING...
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.green }}>
        SAVED ✓
      </span>
    );
  }
  return (
    <span style={{ fontFamily: MONO, fontSize: 8, color: '#FF4757' }}>
      SAVE FAILED
    </span>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export interface SaveStatusBadgeProps {
  status: SaveStatus;
  /** Visual variant. 'tailwind' (default) or 'inline' for Bloomberg terminal pages. */
  variant?: 'tailwind' | 'inline';
}

export function SaveStatusBadge({ status, variant = 'tailwind' }: SaveStatusBadgeProps) {
  if (variant === 'inline') return <InlineBadge status={status} />;
  return <TailwindBadge status={status} />;
}

// ─── useSaveStatus hook ───────────────────────────────────────────────────────

const SAVED_DISPLAY_MS = 2000;

/**
 * Returns [status, withSave] where withSave is a wrapper that accepts any
 * async save function, drives the status state, and auto-resets to 'idle'
 * after SAVED_DISPLAY_MS milliseconds.
 *
 * Example:
 *   const [saveStatus, withSave] = useSaveStatus();
 *   const handleSave = () => withSave(() => apiClient.patch(...));
 */
export function useSaveStatus(): [SaveStatus, (fn: () => Promise<unknown>) => Promise<void>] {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const withSave = useCallback(async (fn: () => Promise<unknown>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    try {
      await fn();
      setStatus('saved');
      timerRef.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS);
    } catch {
      setStatus('error');
      timerRef.current = setTimeout(() => setStatus('idle'), SAVED_DISPLAY_MS * 2);
    }
  }, []);

  return [status, withSave];
}
