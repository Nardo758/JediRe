import React from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, AnnualCashFlowRow } from './types';
import { fmt$ } from './types';

const MONO = BT.font.mono;

const LINE_ITEMS = [
  { key: 'gpr',          label: 'GROSS POTENTIAL RENT',       section: 'revenue', sign: 1 },
  { key: 'vacancy',      label: '  Less: Vacancy & Loss',     section: 'revenue', sign: -1 },
  { key: 'egr',          label: 'EFFECTIVE GROSS REVENUE',     section: 'revenue', sign: 1, isTotal: true },
  { key: 'otherIncome',  label: '  Plus: Other Income',        section: 'revenue', sign: 1 },
  { key: 'totalRevenue', label: 'TOTAL REVENUE',               section: 'revenue', sign: 1, isTotal: true },
  { key: 'opex',         label: '  Less: Operating Expenses',  section: 'expense', sign: -1 },
  { key: 'noi',          label: 'NET OPERATING INCOME',        section: 'noi',     sign: 1, isTotal: true, highlight: true },
  { key: 'debtService',  label: '  Less: Debt Service',        section: 'debt',    sign: -1 },
  { key: 'cashFlow',     label: 'CASH FLOW BEFORE TAX',        section: 'cf',      sign: 1, isTotal: true, highlight: true },
] as const;

export function ProFormaSummaryTab({ dealId, assumptions, modelResults }: FinancialEngineTabProps) {
  const cf = modelResults?.annualCashFlow ?? [];
  const holdPeriod = assumptions?.holdPeriod ?? 5;
  const years = cf.length > 0 ? cf.slice(0, holdPeriod) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '6px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>
          SUMMARY OPERATING STATEMENT · {holdPeriod}-YEAR HOLD · ANNUAL
        </span>
        <Bd c={BT.text.cyan}>QUICK SCAN</Bd>
      </div>

      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${BT.border.medium}` }}>
              <th style={{ padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500, letterSpacing: 0.5, minWidth: 200, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 1 }}>LINE ITEM</th>
              {years.length > 0 ? years.map((_, i) => (
                <th key={i} style={{ padding: '5px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, letterSpacing: 0.5, minWidth: 90 }}>YEAR {i + 1}</th>
              )) : Array.from({ length: holdPeriod }, (_, i) => (
                <th key={i} style={{ padding: '5px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, letterSpacing: 0.5, minWidth: 90 }}>YEAR {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINE_ITEMS.map((item, ri) => {
              const isHighlight = item.highlight;
              const isTotal = item.isTotal;
              return (
                <tr key={item.key} style={{
                  background: isHighlight ? `${BT.met.financial}10` : ri % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  borderBottom: isTotal ? `2px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}`,
                }}>
                  <td style={{
                    padding: '4px 8px',
                    color: isHighlight ? BT.text.white : isTotal ? BT.text.primary : BT.text.secondary,
                    fontWeight: isTotal ? 700 : 400,
                    position: 'sticky', left: 0,
                    background: isHighlight ? `${BT.met.financial}10` : ri % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                    zIndex: 1,
                  }}>
                    {item.label}
                  </td>
                  {years.length > 0 ? years.map((row: AnnualCashFlowRow, ci: number) => {
                    const val = (row as any)[item.key] as number | undefined;
                    const displayVal = val != null ? item.sign < 0 ? fmt$(-Math.abs(val)) : fmt$(val) : '—';
                    const cellColor = isHighlight ? BT.met.financial
                      : item.sign < 0 ? BT.text.red
                      : isTotal ? BT.text.white : BT.text.primary;
                    return (
                      <td key={ci} style={{ padding: '4px 8px', textAlign: 'right', color: cellColor, fontWeight: isTotal ? 700 : 400 }}>
                        {displayVal}
                      </td>
                    );
                  }) : Array.from({ length: holdPeriod }, (_, ci) => (
                    <td key={ci} style={{ padding: '4px 8px', textAlign: 'right', color: BT.text.muted }}>—</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {years.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          Build model in Assumptions tab to populate the summary operating statement
        </div>
      )}
    </div>
  );
}

export default ProFormaSummaryTab;
