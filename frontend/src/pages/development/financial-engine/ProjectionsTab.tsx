import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, AnnualCashFlowRow } from './types';
import { fmt$, fmtPct } from './types';

const MONO = BT.font.mono;

type TimelineOption = 3 | 5 | 7 | 10;
type ViewMode = 'annual' | 'monthly';

interface ProjectionSection {
  label: string;
  key: string;
  color: string;
  rows: { label: string; key: string; isTotal?: boolean; sign?: number; indent?: boolean }[];
}

const SECTIONS: ProjectionSection[] = [
  {
    label: 'REVENUE', key: 'revenue', color: BT.met.financial,
    rows: [
      { label: 'Gross Potential Rent', key: 'gpr' },
      { label: 'Loss to Lease', key: 'lossToLease', indent: true, sign: -1 },
      { label: 'Vacancy Loss', key: 'vacancy', indent: true, sign: -1 },
      { label: 'Concessions', key: 'concessions', indent: true, sign: -1 },
      { label: 'Collection Loss', key: 'collectionLoss', indent: true, sign: -1 },
      { label: 'Net Rental Income', key: 'netRentalIncome', isTotal: true },
      { label: 'Other Income', key: 'otherIncome', indent: true },
      { label: 'RUBS', key: 'rubs', indent: true },
      { label: 'Effective Gross Revenue', key: 'egr', isTotal: true },
    ],
  },
  {
    label: 'EXPENSES', key: 'expense', color: BT.text.red,
    rows: [
      { label: 'Repairs & Maintenance', key: 'repairs', indent: true },
      { label: 'Personnel / Payroll', key: 'payroll', indent: true },
      { label: 'Insurance', key: 'insurance', indent: true },
      { label: 'Utilities', key: 'utilities', indent: true },
      { label: 'Management Fee', key: 'mgmtFee', indent: true },
      { label: 'Real Estate Taxes', key: 'reTaxes', indent: true },
      { label: 'Marketing & Leasing', key: 'marketing', indent: true },
      { label: 'Administrative / G&A', key: 'admin', indent: true },
      { label: 'Contract Services', key: 'contractSvc', indent: true },
      { label: 'Other Operating', key: 'otherOpex', indent: true },
      { label: 'Total Operating Expenses', key: 'opex', isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'NOI', key: 'noi', color: BT.text.cyan,
    rows: [
      { label: 'Net Operating Income', key: 'noi', isTotal: true },
      { label: 'Operating Margin', key: 'opMargin' },
      { label: 'NOI / Unit', key: 'noiPerUnit' },
    ],
  },
  {
    label: 'DEBT SERVICE', key: 'debt', color: BT.text.orange,
    rows: [
      { label: 'Interest Expense', key: 'interestExpense', indent: true },
      { label: 'Principal Paydown', key: 'principalPaydown', indent: true },
      { label: 'Total Debt Service', key: 'debtService', isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'CASH FLOW', key: 'cashflow', color: BT.met.financial,
    rows: [
      { label: 'Cash Flow Before Tax', key: 'cashFlow', isTotal: true },
      { label: 'CapEx / Reserves', key: 'capexReserves', indent: true, sign: -1 },
      { label: 'Net Cash Flow', key: 'netCashFlow', isTotal: true },
    ],
  },
  {
    label: 'METRICS', key: 'metrics', color: BT.text.purple,
    rows: [
      { label: 'Cash-on-Cash Return', key: 'coc' },
      { label: 'DSCR', key: 'dscr' },
      { label: 'Debt Yield', key: 'debtYield' },
      { label: 'Occupancy', key: 'occupancy' },
    ],
  },
  {
    label: 'EXIT / REVERSION', key: 'exit', color: BT.text.amber,
    rows: [
      { label: 'Exit NOI (Forward 12mo)', key: 'exitNoi' },
      { label: 'Exit Cap Rate', key: 'exitCapRate' },
      { label: 'Gross Sale Value', key: 'grossSaleValue' },
      { label: 'Less: Selling Costs', key: 'sellingCosts', indent: true, sign: -1 },
      { label: 'Less: Loan Payoff', key: 'loanPayoff', indent: true, sign: -1 },
      { label: 'Net Sale Proceeds', key: 'netSaleProceeds', isTotal: true },
    ],
  },
];

export function ProjectionsTab({ dealId, assumptions, modelResults }: FinancialEngineTabProps) {
  const [timeline, setTimeline] = useState<TimelineOption>(5);
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SECTIONS.map(s => s.key)));
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const cf = modelResults?.annualCashFlow ?? [];
  const displayYears = cf.slice(0, timeline);
  const holdPeriod = assumptions?.holdPeriod ?? 5;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const colCount = displayYears.length > 0 ? displayYears.length : timeline;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TIMELINE:</span>
        {([3, 5, 7, 10] as TimelineOption[]).map(t => (
          <button key={t} onClick={() => setTimeline(t)} style={{
            background: timeline === t ? BT.bg.active : 'transparent',
            color: timeline === t ? BT.met.financial : BT.text.muted,
            border: timeline === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
            padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>{t}YR</button>
        ))}
        <div style={{ width: 1, height: 14, background: BT.border.medium, margin: '0 4px' }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>VIEW:</span>
        {(['annual', 'monthly'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => setViewMode(m)} style={{
            background: viewMode === m ? BT.bg.active : 'transparent',
            color: viewMode === m ? BT.met.financial : BT.text.muted,
            border: viewMode === m ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
            padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
          }}>{m}</button>
        ))}
        <Bd c={BT.text.purple}>INSTITUTIONAL DETAIL</Bd>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header, zIndex: 2 }}>
              <th style={{ padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500, minWidth: 220, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 3 }}>
                OPERATING STATEMENT
              </th>
              {displayYears.length > 0 ? displayYears.map((_, i) => (
                <th key={i} style={{ padding: '5px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 90 }}>
                  {viewMode === 'monthly' ? (
                    <button onClick={() => toggleYear(i + 1)} style={{ background: 'none', border: 'none', color: BT.text.muted, fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}>
                      {expandedYears.has(i + 1) ? '▾' : '▸'} YR {i + 1}
                    </button>
                  ) : `YR ${i + 1}`}
                </th>
              )) : Array.from({ length: colCount }, (_, i) => (
                <th key={i} style={{ padding: '5px 8px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 90 }}>YR {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(section => {
              const isExpanded = expandedSections.has(section.key);
              return (
                <React.Fragment key={section.key}>
                  <tr
                    onClick={() => toggleSection(section.key)}
                    style={{ cursor: 'pointer', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}
                  >
                    <td colSpan={colCount + 1} style={{
                      padding: '5px 8px', color: section.color, fontWeight: 700, letterSpacing: 0.8,
                      position: 'sticky', left: 0, background: BT.bg.header, zIndex: 1,
                    }}>
                      {isExpanded ? '▾' : '▸'} {section.label}
                    </td>
                  </tr>
                  {isExpanded && section.rows.map((row, ri) => (
                    <tr key={row.key} style={{
                      background: row.isTotal ? `${section.color}08` : ri % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                      borderBottom: row.isTotal ? `2px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}`,
                    }}>
                      <td style={{
                        padding: `3px 8px 3px ${row.indent ? 20 : 8}px`,
                        color: row.isTotal ? BT.text.white : BT.text.secondary,
                        fontWeight: row.isTotal ? 700 : 400,
                        position: 'sticky', left: 0,
                        background: row.isTotal ? `${section.color}08` : ri % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                        zIndex: 1,
                      }}>
                        {row.label}
                      </td>
                      {displayYears.length > 0 ? displayYears.map((yr: AnnualCashFlowRow, ci: number) => {
                        const val = (yr as any)[row.key] as number | undefined;
                        const display = val != null ? (row.sign === -1 ? fmt$(-Math.abs(val)) : fmt$(val)) : '—';
                        return (
                          <td key={ci} style={{
                            padding: '3px 8px', textAlign: 'right',
                            color: row.isTotal ? section.color : val != null && (row.sign === -1) ? BT.text.red : BT.text.primary,
                            fontWeight: row.isTotal ? 700 : 400,
                          }}>{display}</td>
                        );
                      }) : Array.from({ length: colCount }, (_, ci) => (
                        <td key={ci} style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.muted }}>—</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {cf.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', fontFamily: MONO, fontSize: 10, color: BT.text.muted }}>
          Build model to populate the full institutional operating statement
        </div>
      )}
    </div>
  );
}

export default ProjectionsTab;
