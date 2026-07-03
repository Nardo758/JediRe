/**
 * MonthlyScheduleGrid — shared monthly timeline editor
 *
 * Used by:
 *   1. Section 5A (M07 Traffic Intel) in AssumptionsTab GENERAL view
 *   2. LEASING sub-tab SCHEDULE view in LeasingAssumptionsTab
 *
 * Props:
 *   rows       — row definitions (label, key, unit, getBaseline, ...)
 *   holdMonths — total columns = holdYears × 12
 *   overrides  — { [fieldKey]: { [absMonth]: string } }
 *   onCellChange(fieldKey, absMonth, value | null) — null clears the override
 *
 * Layout:
 *   Sticky label column (220px) + horizontal scroll for month columns (48px each).
 *   Year group header row coloured by year index.
 *   Month sub-header row shows M1–M12 repeated.
 *   Baseline values shown in muted gray; overrides in cyan; editing shows an input.
 *   Numeric: click → inline input, Enter/blur → commit.
 *   Enum:    click → cycles to next value; right-click (or long-press) → clear.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';

const MONO = "'JetBrains Mono','Fira Code',monospace";

export type MonthlyUnit = 'pct' | 'per_wk' | 'days' | 'dollar' | 'enum';

export interface MonthlyScheduleRow {
  key: string;
  label: string;
  unit: MonthlyUnit;
  readonly?: boolean;
  enumValues?: string[];
  /** Abbreviated enum labels for display (same order as enumValues) */
  enumLabels?: string[];
  /** Returns the baseline value for absMonth (1-based). Baseline = annual value repeated. */
  getBaseline: (absMonth: number) => number | string | null;
  /** Optional color for row label */
  labelColor?: string;
}

export interface MonthlyScheduleGridProps {
  rows: MonthlyScheduleRow[];
  holdMonths: number;
  overrides: Record<string, Record<number, string>>;
  onCellChange: (fieldKey: string, absMonth: number, value: string | null) => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function displayValue(val: number | string | null, unit: MonthlyUnit, enumLabels?: string[], enumValues?: string[]): string {
  if (val == null) return '—';
  if (unit === 'enum') {
    if (typeof val === 'string') {
      if (enumLabels && enumValues) {
        const idx = enumValues.indexOf(val);
        return idx >= 0 ? (enumLabels[idx] ?? val.slice(0, 4)) : val.slice(0, 4);
      }
      return val.slice(0, 4);
    }
    return String(val).slice(0, 4);
  }
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n as number)) return String(val);
  if (unit === 'pct') return (n as number * 100).toFixed(1);
  if (unit === 'per_wk') return (n as number).toFixed(2);
  if (unit === 'days') return String(Math.round(n as number));
  if (unit === 'dollar') return Math.round(n as number) >= 1000
    ? `${(Math.round(n as number) / 1000).toFixed(0)}k`
    : String(Math.round(n as number));
  return String(n);
}

function unitSuffix(unit: MonthlyUnit): string {
  if (unit === 'pct') return '%';
  if (unit === 'per_wk') return '/wk';
  if (unit === 'days') return 'd';
  if (unit === 'dollar') return '$';
  return '';
}

function parseStorageValue(raw: string, unit: MonthlyUnit): string | null {
  if (unit === 'enum') return raw.toUpperCase();
  const trimmed = raw.replace('%', '').replace('$', '').replace(/,/g, '').trim();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return null;
  if (unit === 'pct') return String(+(num / 100).toFixed(6));
  return String(num);
}

// ── Year header colours ────────────────────────────────────────────────────────

const YEAR_COLORS = [
  '#0e4a6e',  // Y1 — teal-navy
  '#1a3a4a',  // Y2
  '#1a2e4a',  // Y3
  '#1f2d4a',  // Y4
  '#1a1f4a',  // Y5
  '#271a4a',  // Y6
  '#2d1a4a',  // Y7
  '#321a4a',  // Y8
  '#2a1a4a',  // Y9
  '#1a2a4a',  // Y10
];

const YEAR_TEXT_COLORS = [
  '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc',
  '#e879f9', '#f472b6', '#fb7185', '#fb923c', '#facc15',
];

const CELL_W = 48;
const LABEL_W = 220;
const HEADER_H = 18;
const ROW_H = 26;

// ── EditingCell state ─────────────────────────────────────────────────────────

interface EditState {
  fieldKey: string;
  absMonth: number;
  draft: string;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MonthlyScheduleGrid({
  rows,
  holdMonths,
  overrides,
  onCellChange,
}: MonthlyScheduleGridProps) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const months = Array.from({ length: holdMonths }, (_, i) => i + 1);
  const years  = Array.from({ length: Math.ceil(holdMonths / 12) }, (_, i) => i + 1);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const row = rows.find(r => r.key === editing.fieldKey);
    if (!row) { setEditing(null); return; }
    const stored = parseStorageValue(editing.draft, row.unit);
    if (stored !== null) {
      onCellChange(editing.fieldKey, editing.absMonth, stored);
    }
    setEditing(null);
  }, [editing, rows, onCellChange]);

  const clearCell = useCallback((fieldKey: string, absMonth: number) => {
    onCellChange(fieldKey, absMonth, null);
    if (editing?.fieldKey === fieldKey && editing?.absMonth === absMonth) setEditing(null);
  }, [editing, onCellChange]);

  const cycleEnum = useCallback((row: MonthlyScheduleRow, absMonth: number) => {
    if (!row.enumValues?.length) return;
    const current = overrides[row.key]?.[absMonth]
      ?? String(row.getBaseline(absMonth) ?? row.enumValues[0]);
    const idx = row.enumValues.indexOf(current);
    const next = row.enumValues[(idx + 1) % row.enumValues.length];
    onCellChange(row.key, absMonth, next);
  }, [overrides, onCellChange]);

  const cellStyle = (hasOverride: boolean, isEditing: boolean, readonly: boolean): React.CSSProperties => ({
    width: CELL_W,
    minWidth: CELL_W,
    maxWidth: CELL_W,
    height: ROW_H,
    padding: 0,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: hasOverride ? 700 : 400,
    color: isEditing ? '#fff'
      : hasOverride ? '#22d3ee'
      : '#334155',
    background: isEditing ? '#0c2a3a'
      : hasOverride ? '#0d1f2a'
      : 'transparent',
    cursor: readonly ? 'default' : 'pointer',
    borderRight: '1px solid #1a1a1a',
    borderBottom: '1px solid #1a1a1a',
    position: 'relative',
    userSelect: 'none',
    transition: 'background 0.1s',
  });

  return (
    <div
      ref={containerRef}
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        background: BT.bg.terminal,
        borderTop: '1px solid #1e1e1e',
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: LABEL_W + CELL_W * holdMonths,
          minWidth: '100%',
        }}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {months.map(m => <col key={m} style={{ width: CELL_W }} />)}
        </colgroup>
        <thead>
          {/* Year header row */}
          <tr style={{ height: HEADER_H }}>
            <th
              style={{
                position: 'sticky', left: 0, zIndex: 3,
                background: BT.bg.header, width: LABEL_W,
                borderBottom: '1px solid #1e1e1e', borderRight: '1px solid #1e1e1e',
                fontFamily: MONO, fontSize: 7, color: '#334155',
                textAlign: 'left', paddingLeft: 10,
              }}
            >
              FIELD
            </th>
            {years.map(yr => {
              const yearMonths = Math.min(12, holdMonths - (yr - 1) * 12);
              return (
                <th
                  key={yr}
                  colSpan={yearMonths}
                  style={{
                    background: YEAR_COLORS[(yr - 1) % YEAR_COLORS.length],
                    borderRight: '1px solid #1e1e1e',
                    borderBottom: '1px solid #1e1e1e',
                    fontFamily: MONO, fontSize: 7, fontWeight: 700,
                    color: YEAR_TEXT_COLORS[(yr - 1) % YEAR_TEXT_COLORS.length],
                    letterSpacing: '0.08em',
                    textAlign: 'center',
                    height: HEADER_H,
                    padding: 0,
                  }}
                >
                  Y{yr}
                </th>
              );
            })}
          </tr>
          {/* Month header row */}
          <tr style={{ height: HEADER_H }}>
            <th
              style={{
                position: 'sticky', left: 0, zIndex: 3,
                background: '#080808', width: LABEL_W,
                borderBottom: '1px solid #1e1e1e', borderRight: '1px solid #1e1e1e',
                fontFamily: MONO, fontSize: 6, color: '#334155',
                textAlign: 'left', paddingLeft: 10,
              }}
            >
              MONTH →
            </th>
            {months.map(m => {
              const moInYr = ((m - 1) % 12) + 1;
              return (
                <th
                  key={m}
                  style={{
                    background: BT.bg.header,
                    borderRight: '1px solid #1a1a1a',
                    borderBottom: '1px solid #1e1e1e',
                    fontFamily: MONO, fontSize: 7,
                    color: moInYr === 1 ? '#475569' : '#1e3347',
                    textAlign: 'center',
                    height: HEADER_H, padding: 0,
                    fontWeight: moInYr === 1 ? 700 : 400,
                  }}
                >
                  {moInYr}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} style={{ height: ROW_H }}>
              {/* Sticky label cell */}
              <td
                style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: BT.bg.panel,
                  borderRight: '1px solid #1e1e1e',
                  borderBottom: '1px solid #141414',
                  fontFamily: MONO, fontSize: 9,
                  color: row.labelColor ?? '#64748b',
                  paddingLeft: 10, paddingRight: 6,
                  whiteSpace: 'nowrap', overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={row.label}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {row.readonly && (
                    <span style={{ fontSize: 7, color: '#1e3347' }}>🔒</span>
                  )}
                  {row.label}
                  {row.unit !== 'enum' && (
                    <span style={{ fontSize: 7, color: '#1e3347', flexShrink: 0 }}>
                      {unitSuffix(row.unit)}
                    </span>
                  )}
                </span>
              </td>

              {/* Month data cells */}
              {months.map(absMonth => {
                const override = overrides[row.key]?.[absMonth];
                const baseline = row.getBaseline(absMonth);
                const displayVal = override != null
                  ? displayValue(override, row.unit, row.enumLabels, row.enumValues)
                  : displayValue(baseline, row.unit, row.enumLabels, row.enumValues);
                const hasOverride = override != null;
                const isEditingThis = editing?.fieldKey === row.key && editing?.absMonth === absMonth;

                return (
                  <td
                    key={absMonth}
                    style={cellStyle(hasOverride, isEditingThis, row.readonly ?? false)}
                    onClick={() => {
                      if (row.readonly) return;
                      if (row.unit === 'enum') {
                        cycleEnum(row, absMonth);
                        return;
                      }
                      const currentRaw = override != null ? override : (baseline != null ? String(baseline) : '');
                      const displayInput = row.unit === 'pct' && currentRaw !== ''
                        ? String(+(parseFloat(currentRaw) * 100).toFixed(4))
                        : currentRaw;
                      setEditing({ fieldKey: row.key, absMonth, draft: displayInput });
                    }}
                    onContextMenu={e => {
                      if (row.readonly || !hasOverride) return;
                      e.preventDefault();
                      clearCell(row.key, absMonth);
                    }}
                    title={hasOverride ? `Override: ${displayVal} (right-click to clear)` : `Baseline: ${displayVal}`}
                  >
                    {isEditingThis ? (
                      <input
                        ref={inputRef}
                        value={editing!.draft}
                        onChange={e => setEditing(prev => prev ? { ...prev, draft: e.target.value } : null)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditing(null);
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            commitEdit();
                            const nextMonth = absMonth + 1;
                            if (nextMonth <= holdMonths) {
                              const currentRaw = overrides[row.key]?.[nextMonth] != null
                                ? String(overrides[row.key][nextMonth])
                                : (row.getBaseline(nextMonth) != null ? String(row.getBaseline(nextMonth)) : '');
                              const displayInput = row.unit === 'pct' && currentRaw !== ''
                                ? String(+(parseFloat(currentRaw) * 100).toFixed(4))
                                : currentRaw;
                              setTimeout(() => setEditing({ fieldKey: row.key, absMonth: nextMonth, draft: displayInput }), 10);
                            }
                          }
                        }}
                        style={{
                          width: CELL_W - 4,
                          textAlign: 'center',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontFamily: MONO,
                          fontSize: 9,
                          color: '#fff',
                          caretColor: '#22d3ee',
                          padding: 0,
                        }}
                      />
                    ) : (
                      <span style={{ color: 'inherit' }}>{displayVal}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '4px 12px', background: '#080808', borderTop: '1px solid #141414',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#1e3347' }}>
          Click numeric cells to edit · Tab to move right · Enter/Blur to commit
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#1e3347' }}>
          Right-click to clear override
        </span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#22d3ee' }}>■ OVERRIDE</span>
        <span style={{ fontFamily: MONO, fontSize: 7, color: '#334155' }}>■ BASELINE</span>
        {rows.some(r => r.unit === 'enum') && (
          <span style={{ fontFamily: MONO, fontSize: 7, color: '#1e3347' }}>
            Click enum cells to cycle values
          </span>
        )}
      </div>
    </div>
  );
}

export default MonthlyScheduleGrid;
