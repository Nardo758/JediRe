import React, { useState, useCallback } from 'react';
import { BT } from './bloomberg-ui';
import { useAssumptions, SENSITIVITY_COEFFICIENTS, SENSITIVITY_PATHS } from '../../stores/dealStore';
import type { LayeredValue, AlertLevel } from '../../stores/dealContext.types';

const MONO = BT.font.mono;
const TOP_N = 5;

const ALERT_COLORS: Record<AlertLevel, string> = {
  none: BT.text.muted,
  info: BT.text.cyan,
  warn: BT.text.amber,
  block: BT.text.red,
};

const SOURCE_COLORS: Record<string, string> = {
  broker: BT.text.cyan,
  platform: BT.text.purple,
  user: BT.text.amber,
  agent: BT.met.financial,
  computed: BT.text.teal,
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, padding: '1px 4px', borderRadius: 2,
      color: SOURCE_COLORS[source] ?? BT.text.muted,
      border: `1px solid ${(SOURCE_COLORS[source] ?? BT.text.muted)}40`,
      letterSpacing: 0.5, textTransform: 'uppercase',
    }}>{source}</span>
  );
}

function AlertDot({ level }: { level: AlertLevel }) {
  if (level === 'none') return null;
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: 3,
      background: ALERT_COLORS[level],
      boxShadow: level === 'block' ? `0 0 4px ${BT.text.red}88` : undefined,
    }} title={`Alert: ${level}`} />
  );
}

function formatFieldValue(value: number, path: string): string {
  const meta = SENSITIVITY_COEFFICIENTS[path];
  if (!meta) return String(value);
  if (meta.unit === '%') return `${(value * meta.formatMultiplier).toFixed(2)}%`;
  if (meta.unit === '$') return `$${Math.round(value).toLocaleString()}`;
  if (meta.unit === 'yrs') return `${value} yrs`;
  return String(value);
}

function parseFieldInput(raw: string, path: string): number | null {
  const cleaned = raw.replace(/[%$,\s]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  const meta = SENSITIVITY_COEFFICIENTS[path];
  if (!meta) return n;
  if (meta.formatMultiplier > 1) return n / meta.formatMultiplier;
  return n;
}

interface EditableFieldProps {
  path: string;
  lv: LayeredValue<number>;
  onUpdate: (path: string, value: number) => void;
  onRevert: (path: string) => void;
}

function EditableField({ path, lv, onUpdate, onRevert }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const meta = SENSITIVITY_COEFFICIENTS[path];
  if (!meta) return null;

  const hasNonUserFallback = !!(lv.layers?.platform || lv.layers?.broker);
  const hasUserLayer = !!lv.layers?.user && hasNonUserFallback;
  const platformValue = lv.layers?.platform?.value ?? lv.layers?.broker?.value;
  const displayValue = formatFieldValue(lv.value, path);

  const handleStartEdit = () => {
    const raw = meta.unit === '%' ? (lv.value * meta.formatMultiplier).toFixed(2)
      : meta.unit === '$' ? String(Math.round(lv.value))
      : String(lv.value);
    setDraft(raw);
    setEditing(true);
  };

  const handleCommit = () => {
    const parsed = parseFieldInput(draft, path);
    if (parsed !== null && parsed !== lv.value) {
      onUpdate(path, parsed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', borderBottom: `1px solid ${BT.border.subtle}`,
      background: hasUserLayer ? `${BT.text.amber}06` : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <AlertDot level={lv.alertLevel} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, minWidth: 90 }}>
          {meta.label.toUpperCase()}
        </span>
        <SourceBadge source={lv.resolvedFrom} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {hasUserLayer && platformValue !== undefined && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, textDecoration: 'line-through' }}>
            {formatFieldValue(platformValue, path)}
          </span>
        )}

        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            style={{
              fontFamily: MONO, fontSize: 10, color: BT.text.amber, fontWeight: 700,
              background: BT.bg.input, border: `1px solid ${BT.text.amber}60`,
              borderRadius: 2, padding: '1px 4px', width: 70, textAlign: 'right',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={handleStartEdit}
            style={{
              fontFamily: MONO, fontSize: 10,
              color: hasUserLayer ? BT.text.amber : BT.text.cyan,
              fontWeight: 600, cursor: 'pointer',
              borderBottom: `1px dashed ${hasUserLayer ? BT.text.amber : BT.text.cyan}40`,
              padding: '0 2px',
            }}
            title="Click to edit"
          >
            {displayValue}
          </span>
        )}

        {hasUserLayer && (
          <button
            onClick={() => onRevert(path)}
            style={{
              fontFamily: MONO, fontSize: 7, color: BT.text.muted, background: 'none',
              border: `1px solid ${BT.border.subtle}`, borderRadius: 2, padding: '1px 3px',
              cursor: 'pointer', letterSpacing: 0.5,
            }}
            title="Revert to platform default"
          >
            ↩
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: BT.bg.panel, border: `1px solid ${BT.text.amber}40`, borderRadius: 4,
        padding: 16, maxWidth: 360, fontFamily: MONO,
      }}>
        <div style={{ fontSize: 9, color: BT.text.amber, marginBottom: 8, letterSpacing: 0.5 }}>
          ⚠ JEDI SCORE IMPACT
        </div>
        <div style={{ fontSize: 10, color: BT.text.primary, marginBottom: 12, lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontFamily: MONO, fontSize: 9, color: BT.text.muted, background: BT.bg.header,
              border: `1px solid ${BT.border.medium}`, borderRadius: 2, padding: '4px 10px', cursor: 'pointer',
            }}
          >CANCEL</button>
          <button
            onClick={onConfirm}
            style={{
              fontFamily: MONO, fontSize: 9, color: BT.bg.terminal, background: BT.text.amber,
              border: 'none', borderRadius: 2, padding: '4px 10px', cursor: 'pointer', fontWeight: 700,
            }}
          >APPLY CHANGE</button>
        </div>
      </div>
    </div>
  );
}

export function AssumptionsPanel({ compact = false }: { compact?: boolean }) {
  const {
    assumptions, zoning, scores, cascadeStatus,
    updateAssumption, revertAssumption, revertAllAssumptions,
  } = useAssumptions();

  const [showAll, setShowAll] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ path: string; value: number } | null>(null);

  const visiblePaths = showAll ? SENSITIVITY_PATHS : SENSITIVITY_PATHS.slice(0, TOP_N);

  const hasAnyUserOverride = SENSITIVITY_PATHS.some(p => {
    const parts = p.split('.');
    let current: any = { financial: { assumptions } };
    for (const part of parts) current = current?.[part];
    return current?.layers?.user && (current?.layers?.platform || current?.layers?.broker);
  });

  const getLV = useCallback((path: string): LayeredValue<number> | null => {
    const parts = path.split('.');
    let current: any = { financial: { assumptions } };
    for (const part of parts) current = current?.[part];
    return current ?? null;
  }, [assumptions]);

  const handleUpdate = useCallback((path: string, value: number) => {
    const currentScore = scores.overall;
    const exitCapLV = getLV('financial.assumptions.exitCapRate');
    const rentGrowthLV = getLV('financial.assumptions.rentGrowth');

    let estimatedDelta = 0;
    if (path === 'financial.assumptions.exitCapRate' && exitCapLV) {
      estimatedDelta = Math.abs(value - exitCapLV.value) * 300;
    } else if (path === 'financial.assumptions.rentGrowth' && rentGrowthLV) {
      estimatedDelta = Math.abs(value - rentGrowthLV.value) * 200;
    }

    if (estimatedDelta > 10 && currentScore > 0) {
      setPendingEdit({ path, value });
      return;
    }

    updateAssumption(path, value);
  }, [scores, getLV, updateAssumption]);

  const handleConfirmEdit = () => {
    if (pendingEdit) {
      updateAssumption(pendingEdit.path, pendingEdit.value);
      setPendingEdit(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: compact ? 'auto' : '100%', overflow: 'auto' }}>
      <div style={{
        padding: '4px 8px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.medium}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>
            ASSUMPTIONS · SENSITIVITY RANKED
          </span>
          {cascadeStatus === 'computing' && (
            <span style={{
              fontFamily: MONO, fontSize: 8, color: BT.met.financial,
              animation: 'bt-pulse 1s infinite',
            }}>RECOMPUTING…</span>
          )}
          {cascadeStatus === 'error' && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.red }}>CASCADE ERR</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {hasAnyUserOverride && (
            <button
              onClick={revertAllAssumptions}
              style={{
                fontFamily: MONO, fontSize: 8, color: BT.text.red, background: 'none',
                border: `1px solid ${BT.text.red}40`, borderRadius: 2, padding: '1px 6px',
                cursor: 'pointer', letterSpacing: 0.5,
              }}
            >REVERT ALL</button>
          )}
        </div>
      </div>

      {zoning.varianceAssumed && (
        <div style={{
          padding: '4px 8px', background: `${BT.text.amber}12`,
          borderBottom: `1px solid ${BT.text.amber}30`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>
            ⚠ VARIANCE ASSUMED — Zoning overrides active. Entitlement risk applies.
          </span>
        </div>
      )}

      {visiblePaths.map(path => {
        const lv = getLV(path);
        if (!lv) return null;
        return (
          <EditableField
            key={path}
            path={path}
            lv={lv}
            onUpdate={handleUpdate}
            onRevert={revertAssumption}
          />
        );
      })}

      {SENSITIVITY_PATHS.length > TOP_N && (
        <div
          onClick={() => setShowAll(!showAll)}
          style={{
            padding: '4px 8px', cursor: 'pointer', textAlign: 'center',
            borderBottom: `1px solid ${BT.border.subtle}`,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.cyan, letterSpacing: 0.5 }}>
            {showAll ? '▴ SHOW TOP 5' : `▾ SHOW ALL ${SENSITIVITY_PATHS.length} ASSUMPTIONS`}
          </span>
        </div>
      )}

      <div style={{
        padding: '3px 8px', display: 'flex', gap: 8,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          LAYERS: <span style={{ color: SOURCE_COLORS.broker }}>■ BROKER</span>
          {' '}<span style={{ color: SOURCE_COLORS.platform }}>■ PLATFORM</span>
          {' '}<span style={{ color: SOURCE_COLORS.user }}>■ USER</span>
        </span>
      </div>

      {pendingEdit && (
        <ConfirmModal
          message={`This change may significantly shift the JEDI Score (est. >10 pts). The model will recompute IRR, Equity Multiple, and Cash-on-Cash returns. Continue?`}
          onConfirm={handleConfirmEdit}
          onCancel={() => setPendingEdit(null)}
        />
      )}
    </div>
  );
}

export default AssumptionsPanel;
