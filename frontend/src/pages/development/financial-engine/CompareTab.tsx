import React, { useState, useEffect, useRef } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, ModelVersion } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

function diffColor(a: number | undefined, b: number | undefined): string {
  if (a == null || b == null) return BT.text.muted;
  if (a === b) return BT.text.secondary;
  return a > b ? BT.met.financial : BT.text.red;
}

function diffArrow(a: number | undefined, b: number | undefined): string {
  if (a == null || b == null) return '';
  if (a === b) return '=';
  return a > b ? '▲' : '▼';
}

interface CompareField {
  label: string;
  path: string[];
  format: (v: any) => string;
  higherIsBetter?: boolean;
}

const COMPARE_FIELDS: CompareField[] = [
  { label: 'PURCHASE PRICE', path: ['assumptions', 'acquisition', 'purchasePrice'], format: fmt$ },
  { label: 'CAP RATE', path: ['assumptions', 'acquisition', 'capRate'], format: (v: number) => fmtPct(v * 100) },
  { label: 'EXIT CAP RATE', path: ['assumptions', 'disposition', 'exitCapRate'], format: (v: number) => fmtPct(v * 100) },
  { label: 'HOLD PERIOD', path: ['assumptions', 'holdPeriod'], format: (v: number) => `${v} yr` },
  { label: 'STABILIZED OCC', path: ['assumptions', 'revenue', 'stabilizedOccupancy'], format: (v: number) => fmtPct(v * 100), higherIsBetter: true },
  { label: 'LOAN AMOUNT', path: ['assumptions', 'financing', 'loanAmount'], format: fmt$ },
  { label: 'INTEREST RATE', path: ['assumptions', 'financing', 'interestRate'], format: (v: number) => fmtPct(v * 100) },
  { label: 'OPEX GROWTH % / YR', path: ['assumptions', 'opexGrowthPct'], format: (v: number) => fmtPct(v * 100) },
  { label: 'CONCESSION BURN-OFF %', path: ['assumptions', 'concessionBurnOffPct'], format: (v: number) => fmtPct(v * 100) },
  { label: '—', path: [], format: () => '—' },
  { label: 'IRR', path: ['results', 'summary', 'irr'], format: (v: number) => fmtPct(v), higherIsBetter: true },
  { label: 'EQUITY MULTIPLE', path: ['results', 'summary', 'equityMultiple'], format: fmtX, higherIsBetter: true },
  { label: 'CASH-ON-CASH', path: ['results', 'summary', 'cashOnCash'], format: (v: number) => fmtPct(v), higherIsBetter: true },
  { label: 'NOI', path: ['results', 'summary', 'noi'], format: fmt$, higherIsBetter: true },
  { label: 'DSCR', path: ['results', 'summary', 'dscr'], format: (v: number) => `${v?.toFixed(2)}×`, higherIsBetter: true },
  { label: 'LP IRR', path: ['results', 'summary', 'lpIrr'], format: (v: number) => fmtPct(v), higherIsBetter: true },
  { label: 'GP IRR', path: ['results', 'summary', 'gpIrr'], format: (v: number) => fmtPct(v), higherIsBetter: true },
];

function getNestedValue(obj: any, path: string[]): any {
  let current = obj;
  for (const key of path) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

export function CompareTab({ dealId, versions = [] }: FinancialEngineTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    versions.length >= 2 ? [versions[0].id, versions[1].id] : versions.length === 1 ? [versions[0].id] : []
  );

  // Ref guard: ensures auto-selection fires at most once per tab mount, even if
  // `versions` later updates (e.g. a new version is saved while the tab is open).
  // Without this, clearing the selection and triggering a versions refresh would
  // re-auto-select — which is not what the analyst expects after a deliberate clear.
  const hasAutoSelected = useRef(false);

  // Auto-select the two most recent versions when `versions` first populates
  // after an async fetch. The useState initializer above only runs at mount,
  // when versions is typically still empty, so nothing gets selected without this.
  useEffect(() => {
    if (hasAutoSelected.current || versions.length === 0) return;
    hasAutoSelected.current = true;
    setSelectedIds(prev => {
      if (prev.length > 0) return prev;
      return versions.length >= 2
        ? [versions[0].id, versions[1].id]
        : [versions[0].id];
    });
  }, [versions]);

  const toggleVersion = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(v => v !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const selectedVersions = selectedIds.map(id => versions.find(v => v.id === id)).filter(Boolean) as ModelVersion[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>SIDE-BY-SIDE VERSION COMPARISON</span>
        <Bd c={BT.text.purple}>{selectedVersions.length} SELECTED</Bd>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>SOURCE: ENGINE + AI</span>
      </div>

      <div style={{ padding: '6px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${BT.border.subtle}` }}>
        {versions.length > 0 ? versions.map(v => {
          const isSelected = selectedIds.includes(v.id);
          return (
            <button key={v.id} onClick={() => toggleVersion(v.id)} style={{
              background: isSelected ? `${BT.met.financial}15` : BT.bg.panel,
              border: `1px solid ${isSelected ? BT.met.financial : BT.border.medium}`,
              color: isSelected ? BT.met.financial : BT.text.muted,
              padding: '3px 10px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>
              {v.name}
              <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.6 }}>
                {v.source === 'user' ? '(User)' : `(${v.source})`}
              </span>
            </button>
          );
        }) : (
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>No saved versions — save a version from the header to enable comparison</span>
        )}
      </div>

      {selectedVersions.length >= 2 && (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header, zIndex: 2 }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500, minWidth: 180, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 3 }}>
                  FIELD
                </th>
                {selectedVersions.map(v => (
                  <th key={v.id} style={{ padding: '5px 8px', textAlign: 'right', color: BT.met.financial, fontWeight: 600, minWidth: 120 }}>
                    {v.name}
                  </th>
                ))}
                {selectedVersions.length === 2 && (
                  <th style={{ padding: '5px 8px', textAlign: 'right', color: BT.text.purple, fontWeight: 500, minWidth: 80 }}>DIFF</th>
                )}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FIELDS.map((field, fi) => {
                if (field.path.length === 0) {
                  return (
                    <tr key={fi} style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                      <td colSpan={selectedVersions.length + (selectedVersions.length === 2 ? 2 : 1)} style={{ padding: '4px 8px', color: BT.text.muted, letterSpacing: 0.5 }}>
                        OUTPUTS
                      </td>
                    </tr>
                  );
                }

                const values = selectedVersions.map(v => getNestedValue(v, field.path));
                const isDiff = values.some(val => val !== values[0]);

                return (
                  <tr key={fi} style={{
                    background: isDiff ? `${BT.text.amber}08` : fi % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}>
                    <td style={{
                      padding: '3px 8px', color: isDiff ? BT.text.amber : BT.text.secondary,
                      fontWeight: isDiff ? 600 : 400,
                      position: 'sticky', left: 0,
                      background: isDiff ? `${BT.text.amber}08` : fi % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                      zIndex: 1,
                    }}>
                      {isDiff && '● '}{field.label}
                    </td>
                    {values.map((val, vi) => (
                      <td key={vi} style={{ padding: '3px 8px', textAlign: 'right', color: isDiff ? BT.text.white : BT.text.primary }}>
                        {val != null ? field.format(val) : '—'}
                      </td>
                    ))}
                    {selectedVersions.length === 2 && (
                      <td style={{ padding: '3px 8px', textAlign: 'right', color: isDiff ? diffColor(values[1], values[0]) : BT.text.muted, fontWeight: isDiff ? 600 : 400 }}>
                        {isDiff ? diffArrow(values[1], values[0]) : '='}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedVersions.length < 2 && versions.length > 0 && (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          Select at least 2 versions above to compare side-by-side
        </div>
      )}

      {versions.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          No saved versions yet. Save a model version using the header controls to enable comparison.
        </div>
      )}
    </div>
  );
}

export default CompareTab;
