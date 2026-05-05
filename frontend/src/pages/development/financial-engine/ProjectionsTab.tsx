import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BT, Bd } from '../../../components/deal/bloomberg-ui';
import type {
  FinancialEngineTabProps, F9NarrativeBlock,
  F9DealFinancials, F9TrafficYear, F9GprDecomposition, F9ProFormaRow, F9IntegrityCheck,
  F9SubjectHistory,
} from './types';
import { fmt$, fmtPct } from './types';
import { ConcessionDrilldownModal, aggregateConcessionDetail } from './ConcessionDrilldownModal';
import type { AggregatedConcessionDetail } from './ConcessionDrilldownModal';
import { apiClient } from '../../../services/api.client';
import { useDealStore } from '../../../stores/dealStore';
import {
  LeaseVelocitySection,
  type LVInputs,
  type LeaseVelocityResult,
  type LeaseMode,
} from './LeaseVelocitySection';

const MONO = BT.font.mono;
type TimelineOption = 3 | 5 | 7 | 10;
type ViewMode = 'annual' | 'quarterly' | 'monthly';

// Type aliases — use shared types from types.ts (single source of truth)
type DealFinancials     = F9DealFinancials;
type TrafficYear        = F9TrafficYear;
type GprDecomposition   = F9GprDecomposition;
type OSRow              = F9ProFormaRow;
type IntegrityCheckItem = F9IntegrityCheck;

// ─── Projection row type — matches backend DealFinancials['projections'][number] ──────────────────
export type ProjYear = NonNullable<F9DealFinancials['projections']>[number];

// ─── Drilldown formula path entry ─────────────────────────────────────────
interface DrilldownEntry {
  label: string;
  value: string;
  sourceTab: string;
  tabIndex: number;
  formula?: string;
}

interface DrilldownInfo {
  rowLabel: string;
  year: number;
  value: string;
  entries: DrilldownEntry[];
}

// ─── Row / section definitions ────────────────────────────────────────────
interface RowDef {
  label: string;
  key: keyof ProjYear;
  isTotal?: boolean;
  indent?: boolean;
  sign?: -1;
  fmt?: 'dollar' | 'pct' | 'x' | 'raw';
  afterTaxOnly?: boolean;
  sourceKey?: 'reTaxSource' | 'debtSource';
  tabLink?: number;
  /** If true, sub-period view shows the annual value unchanged (not prorated). Use for ratios, %s, balances, and exit/disposition rows */
  noSubPeriod?: boolean;
}
interface SectionDef {
  label: string;
  key: string;
  color: string;
  rows: RowDef[];
}

const fmtCell = (
  val: number | null | undefined,
  fmt: RowDef['fmt'] = 'dollar',
  sign?: -1,
): string => {
  if (val == null || isNaN(val as number)) return '—';
  const v = sign === -1 ? -Math.abs(val) : val;
  switch (fmt) {
    case 'pct': return `${(val * 100).toFixed(2)}%`;
    case 'x':   return `${val.toFixed(2)}×`;
    case 'raw': return val.toFixed(0);
    default:    return fmt$(v);
  }
};

const SECTIONS: SectionDef[] = [
  {
    label: 'REVENUE', key: 'revenue', color: BT.met.financial,
    rows: [
      { label: 'Gross Potential Rent',       key: 'gpr',           isTotal: true },
      { label: 'Vacancy Loss',               key: 'vacancyLoss',   indent: true, sign: -1 },
      { label: 'Loss to Lease',              key: 'lossToLease',   indent: true, sign: -1 },
      { label: 'Concessions',                key: 'concessions',   indent: true, sign: -1 },
      { label: 'Bad Debt / Collection Loss', key: 'badDebt',       indent: true, sign: -1 },
      { label: 'Non-Revenue Units',          key: 'nru',           indent: true, sign: -1 },
      { label: 'Net Rental Income',          key: 'nri',           isTotal: true },
      { label: 'Other Income',               key: 'otherIncome',   indent: true },
      { label: 'Effective Gross Income',     key: 'egi',           isTotal: true },
    ],
  },
  {
    label: 'EXPENSES', key: 'expense', color: BT.text.red,
    rows: [
      { label: 'Payroll / Personnel',        key: 'payroll',       indent: true, sign: -1 },
      { label: 'Repairs & Maintenance',      key: 'repairs',       indent: true, sign: -1 },
      { label: 'Turnover / Make-Ready',      key: 'turnover',      indent: true, sign: -1 },
      { label: 'Contract Services',          key: 'contractSvc',   indent: true, sign: -1 },
      { label: 'Marketing & Leasing',        key: 'marketing',     indent: true, sign: -1 },
      { label: 'Utilities',                  key: 'utilities',     indent: true, sign: -1 },
      { label: 'G&A / Administrative',       key: 'gAndA',         indent: true, sign: -1 },
      { label: 'Management Fee',             key: 'mgmtFee',       indent: true, sign: -1 },
      { label: 'Insurance',                  key: 'insurance',     indent: true, sign: -1 },
      { label: 'Real Estate Taxes',          key: 'reTaxes',       indent: true, sign: -1, sourceKey: 'reTaxSource', tabLink: 4 },
      { label: 'Replacement Reserves',       key: 'reserves',      indent: true, sign: -1 },
      { label: 'Total Operating Expenses',   key: 'totalOpex',     isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'NOI', key: 'noi', color: BT.text.cyan,
    rows: [
      { label: 'Net Operating Income',       key: 'noi',           isTotal: true },
      { label: 'Operating Margin',           key: 'opMargin',      fmt: 'pct', noSubPeriod: true },
      { label: 'NOI / Unit',                 key: 'noiPerUnit',                noSubPeriod: true },
    ],
  },
  {
    label: 'DEBT SERVICE', key: 'debt', color: BT.text.orange,
    rows: [
      { label: 'Interest',                   key: 'interest',      indent: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
      { label: 'Principal Paydown',          key: 'principal',     indent: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
      { label: 'Total Debt Service',         key: 'annualDS',      isTotal: true, sign: -1, sourceKey: 'debtSource', tabLink: 6 },
    ],
  },
  {
    label: 'CASH FLOW', key: 'cashflow', color: BT.met.financial,
    rows: [
      { label: 'Cash Flow Before Tax',       key: 'cfbt',          isTotal: true },
      { label: 'CFADS (After Distributions)', key: 'cfads',        isTotal: true },
    ],
  },
  {
    label: 'AFTER-TAX', key: 'aftertax', color: BT.text.purple,
    rows: [
      { label: 'Depreciation',               key: 'depreciation',  indent: true, sign: -1, afterTaxOnly: true, tabLink: 4 },
      { label: 'Taxable Income',             key: 'taxableIncome', indent: true, afterTaxOnly: true },
      { label: 'Tax Payable',               key: 'taxPayable',    indent: true, sign: -1, afterTaxOnly: true },
      { label: 'After-Tax CFADS',            key: 'afterTaxCfads', isTotal: true, afterTaxOnly: true },
    ],
  },
  {
    label: 'SALE-YEAR DISPOSITION', key: 'exit', color: BT.text.amber,
    rows: [
      { label: 'Forward NOI (Exit)',              key: 'exitNoi',                                          noSubPeriod: true },
      { label: 'Exit Cap Rate',                   key: 'exitCap',                fmt: 'pct',               noSubPeriod: true },
      { label: 'Gross Sale Value',                key: 'grossSaleValue',                                   noSubPeriod: true },
      { label: '(–) Selling Costs (1.5%)',        key: 'sellingCosts',            indent: true, sign: -1,   noSubPeriod: true },
      { label: '(–) Doc Stamps / Transfer Tax',  key: 'dispositionDocStamps',    indent: true, sign: -1, tabLink: 4, noSubPeriod: true },
      { label: '(–) Loan Payoff',                key: 'loanPayoff',              indent: true, sign: -1,   noSubPeriod: true },
      { label: '(–) Disposition Tax (Est.)',      key: 'dispositionTaxPayable',   indent: true, sign: -1, afterTaxOnly: true, tabLink: 4, noSubPeriod: true },
      { label: 'Net Sale Proceeds',               key: 'netSaleProceeds',         isTotal: true,            noSubPeriod: true },
    ],
  },
];

// Key metrics strip — fixed bottom row (not a collapsible section)
interface MetricDef { label: string; key: keyof ProjYear; fmt: 'pct' | 'x' | 'dollar'; }
const METRICS_STRIP: MetricDef[] = [
  { label: 'OCC',      key: 'occupancy',     fmt: 'pct' },
  { label: 'DSCR',     key: 'dscr',          fmt: 'x'   },
  { label: 'DY',       key: 'debtYield',     fmt: 'pct' },
  { label: 'CoC',      key: 'coc',           fmt: 'pct' },
  { label: 'EM',       key: 'cumulativeEM',  fmt: 'x'   },
  { label: 'Cap',      key: 'capRatePct',    fmt: 'pct' },
  { label: 'NOI Margin', key: 'noiMarginPct',fmt: 'pct' },
  { label: 'OER',      key: 'opexRatioPct',  fmt: 'pct' },
  { label: 'RG',       key: 'rentGrowthPct', fmt: 'pct' },
];

// Source badge label
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  taxes_tab: { label: 'TAX', color: BT.text.purple },
  proforma:  { label: 'PF',  color: BT.met.financial },
  estimate:  { label: 'EST', color: BT.text.muted },
  debt_tab:  { label: 'DEBT', color: BT.text.orange },
  capital_stack: { label: 'CS', color: BT.text.cyan },
};

// ─── GPR Decomposition Panel ──────────────────────────────────────────────
function GprDecompPanel({ decomp, totalUnits }: { decomp: GprDecomposition; totalUnits: number }) {
  const rows = [
    { label: 'RESOLVED', annual: decomp.resolvedAnnual, perUnit: decomp.resolvedPerUnitMo, color: BT.text.cyan, bold: true },
    { label: 'PLATFORM', annual: decomp.platformAnnual, perUnit: decomp.platformPerUnitMo, color: '#22D3EE' },
    { label: 'BROKER',   annual: decomp.brokerAnnual,   perUnit: decomp.brokerPerUnitMo,   color: BT.text.amber },
    { label: 'T12 ACTUAL', annual: decomp.t12Annual,    perUnit: decomp.t12PerUnitMo,      color: BT.met.physTraffic },
    { label: 'RENT ROLL', annual: decomp.rentRollAnnual, perUnit: null,                    color: BT.text.secondary },
  ];
  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel, padding: '6px 10px', flexShrink: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 1, fontFamily: MONO, marginBottom: 4 }}>
        GPR SOURCE DECOMPOSITION
        <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted }}>({totalUnits} units)</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 100 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{r.label}</span>
            <span style={{ fontSize: 11, fontWeight: r.bold ? 700 : 500, color: r.annual != null ? r.color : BT.text.muted, fontFamily: MONO }}>
              {r.annual != null ? fmt$(r.annual) : '—'}
            </span>
            {r.perUnit != null && (
              <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO }}>
                ${Math.round(r.perUnit).toLocaleString()}/unit/mo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Integrity Banner ─────────────────────────────────────────────────────
function IntegrityBanner({ checks }: { checks: IntegrityCheckItem[] }) {
  const errors = checks.filter(c => c.status === 'error');
  const warns  = checks.filter(c => c.status === 'warn');
  if (errors.length === 0 && warns.length === 0) return null;
  const color   = errors.length > 0 ? BT.text.red : BT.text.amber;
  const bgColor = errors.length > 0 ? `${BT.text.red}12` : `${BT.text.amber}12`;
  const label   = errors.length > 0
    ? `${errors.length} INTEGRITY ERROR${errors.length > 1 ? 'S' : ''}`
    : `${warns.length} WARNING${warns.length > 1 ? 'S' : ''}`;
  const items = [...errors, ...warns].slice(0, 5);
  return (
    <div style={{ background: bgColor, border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, padding: '6px 10px', flexShrink: 0, fontFamily: MONO }}>
      <div style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 0.8, marginBottom: 4 }}>
        ⚠ PRO FORMA {label} — review before relying on projections
      </div>
      {items.map(c => (
        <div key={c.id} style={{ fontSize: 8, color: BT.text.secondary, marginBottom: 1 }}>[{c.id}] {c.message}</div>
      ))}
    </div>
  );
}

// ─── AI Findings Panel ────────────────────────────────────────────────────
const STATUS_COLORS: Record<F9NarrativeBlock['status'], string> = {
  ok:   BT.text.green ?? '#00B050',
  warn: BT.text.amber ?? '#F5A623',
  info: BT.text.cyan  ?? '#00BCD4',
};

function FindingsPanel({ narrative, blocks, loading }: { narrative: string | null; blocks: F9NarrativeBlock[]; loading: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ borderTop: `1px solid ${BT.border.subtle}`, background: `${BT.text.purple}0A`, flexShrink: 0 }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', cursor: 'pointer', borderBottom: expanded ? `1px solid ${BT.border.subtle}` : 'none' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.purple, fontFamily: MONO, letterSpacing: 1 }}>AI MARKET FINDINGS</span>
        <Bd c={BT.text.purple}>M07</Bd>
        {loading && <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO }}>analyzing…</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {loading && blocks.length === 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>…loading</span>}
          {blocks.map(b => (
            <div key={b.id} style={{ background: BT.bg.panel, border: `1px solid ${STATUS_COLORS[b.status]}33`, borderLeft: `2px solid ${STATUS_COLORS[b.status]}`, borderRadius: 2, padding: '4px 8px', minWidth: 140 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5, marginBottom: 2 }}>{b.label.toUpperCase()}</div>
              <div style={{ fontSize: 9, color: STATUS_COLORS[b.status], fontFamily: MONO }}>{b.summary}</div>
              {b.detail && <div style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, marginTop: 2 }}>{b.detail}</div>}
            </div>
          ))}
          {!loading && blocks.length === 0 && narrative && (
            <p style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{narrative}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drilldown Drawer ─────────────────────────────────────────────────────
function DrilldownDrawer({
  info,
  onClose,
  onTabChange,
}: {
  info: DrilldownInfo;
  onClose: () => void;
  onTabChange?: (i: number) => void;
}) {
  return (
    <div style={{
      width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: BT.bg.panel, borderLeft: `2px solid ${BT.met.financial}`,
      overflow: 'auto',
    }}>
      {/* Header */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.medium}`, display: 'flex', alignItems: 'center', gap: 6, background: BT.bg.header }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.white, flex: 1 }}>
          FORMULA DRILLDOWN
        </span>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: BT.text.muted, cursor: 'pointer', fontFamily: MONO, fontSize: 11 }}>✕</button>
      </div>
      {/* Row label + value */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 2 }}>
          {info.rowLabel} · YR {info.year}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: BT.met.financial }}>{info.value}</div>
      </div>
      {/* Formula path entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {info.entries.map((e, i) => (
          <div key={i} style={{ padding: '6px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, flex: 1 }}>{e.label}</span>
              {onTabChange && e.tabIndex >= 0 && (
                <button
                  onClick={() => onTabChange(e.tabIndex)}
                  style={{
                    background: 'transparent', border: `1px solid ${BT.met.financial}40`,
                    color: BT.met.financial, fontFamily: MONO, fontSize: 7, padding: '1px 5px',
                    cursor: 'pointer', borderRadius: 2,
                  }}
                >
                  {e.sourceTab} ↗
                </button>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: BT.text.white }}>{e.value}</div>
            {e.formula && (
              <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 2, fontStyle: 'italic' }}>
                {e.formula}
              </div>
            )}
          </div>
        ))}
        {info.entries.length === 0 && (
          <div style={{ padding: '20px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            No formula path available for this cell.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Build drilldown info for a row+year ──────────────────────────────────
function buildDrilldown(
  row: RowDef,
  proj: ProjYear,
  f: DealFinancials | null,
): DrilldownInfo {
  const rawVal = proj[row.key] as number | null;
  const display = fmtCell(rawVal, row.fmt, row.sign);

  const entries: DrilldownEntry[] = [];

  switch (row.key) {
    case 'gpr': {
      const gprDecomp = f?.assumptions?.gprDecomposition;
      if (gprDecomp?.resolvedAnnual != null) {
        entries.push({ label: 'Y1 Resolved GPR (M07)', value: fmt$(gprDecomp.resolvedAnnual), sourceTab: 'PRO FORMA', tabIndex: 1, formula: 'Max(broker, platform, t12, rentRoll)' });
      }
      entries.push({ label: `Rent Growth Multiplier (YR ${proj.year})`, value: `×${(rawVal != null && gprDecomp?.resolvedAnnual ? rawVal / gprDecomp.resolvedAnnual : 1).toFixed(4)}`, sourceTab: 'ASSUMPTIONS', tabIndex: 3, formula: 'Compound(rentGrowthPct per year)' });
      break;
    }
    case 'reTaxes': {
      const src = proj.reTaxSource;
      const taxYr = f?.taxes?.reTax?.perYear?.find(t => t.year === proj.year);
      if (src === 'taxes_tab' && taxYr) {
        entries.push({ label: 'Taxes Tab · Per-Year RE Tax', value: fmt$(taxYr.taxAmount), sourceTab: 'TAXES', tabIndex: 4, formula: `assessedValue × millageRate (${(taxYr.millageRate * 100).toFixed(2)}%)` });
        entries.push({ label: 'Assessed Value', value: fmt$(taxYr.assessedValue), sourceTab: 'TAXES', tabIndex: 4 });
        entries.push({ label: 'SOH Cap Binding?', value: taxYr.sohCapBinding ? 'YES — growth capped' : 'NO', sourceTab: 'TAXES', tabIndex: 4 });
      } else if (src === 'proforma') {
        entries.push({ label: 'Pro Forma Y1 RE Tax', value: fmt$(rawVal ?? 0), sourceTab: 'PRO FORMA', tabIndex: 1, formula: 'Y1 RE Tax × opexGrowthMultiplier' });
      } else {
        entries.push({ label: 'Estimate (no tax data)', value: '—', sourceTab: 'TAXES', tabIndex: 4, formula: 'Seed deal data to compute' });
      }
      break;
    }
    case 'annualDS':
    case 'interest':
    case 'principal': {
      const src = proj.debtSource;
      if (src === 'debt_tab') {
        const aggDS = f?.debt?.aggregate?.totalAnnualDS;
        entries.push({ label: 'Debt Tab · Aggregate Annual DS', value: aggDS != null ? fmt$(aggDS) : '—', sourceTab: 'DEBT', tabIndex: 6, formula: 'Sum(allLoans.derivedAnnualDS)' });
        const sen = f?.debt?.loans?.find(l => l.id === 'senior');
        if (sen) {
          entries.push({ label: 'Senior Loan Amount', value: fmt$(sen.loanAmount?.platform ?? 0), sourceTab: 'DEBT', tabIndex: 6 });
          entries.push({ label: 'Interest Rate', value: `${((sen.interestRate?.platform ?? 0) * 100).toFixed(2)}%`, sourceTab: 'DEBT', tabIndex: 6 });
          entries.push({ label: 'IO Period', value: `${sen.ioMonths?.platform ?? 0} mo`, sourceTab: 'DEBT', tabIndex: 6 });
        }
      } else {
        entries.push({ label: 'Capital Stack · Loan Amount', value: fmt$(f?.capitalStack?.loanAmount ?? 0), sourceTab: 'DEBT', tabIndex: 6, formula: 'Standard amortizing schedule' });
        entries.push({ label: 'Interest Rate', value: `${((f?.capitalStack?.interestRate ?? 0) * 100).toFixed(2)}%`, sourceTab: 'DEBT', tabIndex: 6 });
      }
      break;
    }
    case 'cfads': {
      const capRow = f?.capital?.schedule?.find(r => r.year === proj.year);
      if (capRow) {
        entries.push({ label: 'Capital Schedule CFADS', value: fmt$(capRow.cfads), sourceTab: 'CAP & WFALL', tabIndex: 7, formula: 'NOI - DebtService - Distributions' });
        entries.push({ label: 'LP Distributions', value: fmt$(capRow.lpDist), sourceTab: 'CAP & WFALL', tabIndex: 7 });
        entries.push({ label: 'GP Distributions', value: fmt$(capRow.gpDist), sourceTab: 'CAP & WFALL', tabIndex: 7 });
      } else {
        entries.push({ label: 'Cash Flow Before Tax (fallback)', value: fmt$(proj.cfbt), sourceTab: 'CASH FLOW', tabIndex: -1, formula: 'NOI - Annual Debt Service' });
      }
      break;
    }
    case 'taxableIncome':
    case 'taxPayable':
    case 'afterTaxCfads':
    case 'depreciation': {
      const depr = f?.taxes?.incomeTax?.annualDepreciation;
      const base = f?.taxes?.incomeTax?.depreciableBase;
      entries.push({ label: 'Depreciable Base', value: base != null ? fmt$(base) : '—', sourceTab: 'TAXES', tabIndex: 4, formula: 'purchasePrice × (1 − landValuePct)' });
      entries.push({ label: 'Annual Depreciation (39yr)', value: depr != null ? fmt$(depr) : '—', sourceTab: 'TAXES', tabIndex: 4 });
      const mtr = f?.taxes?.incomeTax?.marginalTaxRate;
      entries.push({ label: 'Effective Tax Rate', value: mtr != null ? `${(mtr * 100).toFixed(2)}%` : '37.00%', sourceTab: 'TAXES', tabIndex: 4, formula: 'Sourced from taxes.incomeTax.marginalTaxRate' });
      break;
    }
    case 'noi': {
      entries.push({ label: 'EGI', value: fmt$(proj.egi), sourceTab: 'PROJECTIONS', tabIndex: 2, formula: 'NRI + OtherIncome' });
      entries.push({ label: 'Total OpEx', value: fmt$(proj.totalOpex), sourceTab: 'PROJECTIONS', tabIndex: 2, formula: 'Sum(all expense lines)' });
      entries.push({ label: 'NOI Formula', value: fmt$(proj.noi), sourceTab: 'PROJECTIONS', tabIndex: 2, formula: 'EGI − TotalOpEx' });
      break;
    }
    case 'grossSaleValue': {
      entries.push({ label: 'Exit NOI', value: fmt$(proj.exitNoi ?? 0), sourceTab: 'ASSUMPTIONS', tabIndex: 3, formula: `NOI × (1 + rentGrowth)` });
      entries.push({ label: 'Exit Cap Rate', value: fmtCell(proj.exitCap, 'pct'), sourceTab: 'ASSUMPTIONS', tabIndex: 3 });
      entries.push({ label: 'Gross Sale Value', value: fmt$(proj.grossSaleValue ?? 0), sourceTab: 'EXIT', tabIndex: -1, formula: 'ExitNOI ÷ ExitCap' });
      break;
    }
    default: {
      entries.push({ label: row.label, value: display, sourceTab: 'PROJECTIONS', tabIndex: 2 });
    }
  }

  return { rowLabel: row.label, year: proj.year, value: display, entries };
}

// ─── Sub-period columns for monthly/quarterly views ───────────────────────
interface SubColHeader {
  label: string;
  periodKey: string; // 'Q1Y1', 'M01Y1', etc.
  projYear: number;
  fraction: number; // 0.25 for quarterly, 1/12 for monthly
}

function buildSubCols(holdYears: number, mode: 'quarterly' | 'monthly'): SubColHeader[] {
  const cols: SubColHeader[] = [];
  const count = mode === 'quarterly' ? 4 : 12;
  const frac  = mode === 'quarterly' ? 0.25 : 1 / 12;
  const prefix = mode === 'quarterly' ? 'Q' : 'M';
  for (let yr = 1; yr <= holdYears; yr++) {
    for (let p = 1; p <= count; p++) {
      cols.push({
        label:     `${prefix}${p}Y${yr}`,
        periodKey: `${prefix}${p.toString().padStart(2, '0')}Y${yr}`,
        projYear:  yr,
        fraction:  frac,
      });
    }
  }
  return cols;
}

function yyyymmFromClose(closeDate: string | null | undefined, offsetMonths: number): string | null {
  if (!closeDate) return null;
  const d = new Date(closeDate + 'T00:00:00');
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Subject History Inline Assumption Block ──────────────────────────────
// Renders when f9Financials.subjectHistory is present (≥S1 tier).
// Shows a four-column comparison: Peer Set | Subject | Effective | Confidence.

const SUBJ_TEAL  = '#2DD4BF';
const SUBJ_TEAL2 = '#14B8A6';

interface SubjRow {
  label: string;
  key: string;
  peer: number | null;
  subject: number | null;
  effective: number | null;
  weight: number | null;
  fmt: 'pct' | 'dollar' | 'num';
}

function fmtSubj(val: number | null, fmt: SubjRow['fmt']): string {
  if (val == null || isNaN(val)) return '—';
  switch (fmt) {
    case 'pct':    return `${(val * 100).toFixed(1)}%`;
    case 'dollar': return fmt$(val);
    case 'num':    return val.toFixed(1);
  }
}

function SubjectHistoryPanel({ history }: { history: F9SubjectHistory }) {
  const [expanded, setExpanded] = useState(false);
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const cs  = history.current_state;
  const dyn = history.observed_dynamics;
  const cw  = history.confidence_weights;
  const collisions = history.peer_collisions ?? [];

  // Build collision lookup — peer_value from collision data is the platform posterior.
  // This is the only source of peer-set values available to the frontend.
  const collisionByKey = new Map(collisions.map(c => [c.coefficient, c]));

  // Helper: compute blended effective value from subject + peer + weight.
  // Peer resolution order:
  //   1. peer_set_values[key]  — platform posterior for this coefficient (always available
  //      after M07 wiring when traffic_calibration_factors is populated)
  //   2. collision.peer_value  — set only for coefficients that exceeded σ threshold
  // When peer is resolved, effective = w * subject + (1-w) * peer.
  // When peer is unknown, effective falls back to subject.
  const peerSetValues = history.peer_set_values ?? {};

  const blendedEffective = (subject: number, key: string): { peer: number | null; effective: number } => {
    const col  = collisionByKey.get(key);
    const w    = cw[key]?.weight ?? null;
    // Prefer platform peer-set posterior; fall back to collision.peer_value if absent
    const peer: number | null = peerSetValues[key] ?? col?.peer_value ?? null;
    if (peer != null && w != null) {
      if (w === 0) {
        // Insufficient subject evidence — effective is peer-only (matches resolver w=0 path)
        return { peer, effective: peer };
      }
      if (w < 1) {
        return { peer, effective: w * subject + (1 - w) * peer };
      }
    }
    // w===1 (full confidence) or no peer available — effective equals subject
    return { peer, effective: subject };
  };

  // Direction indicator: ▲ subject > peer, ▼ subject < peer, = within ±0.5σ
  // σ ≈ 15% of the peer value (conservative prior consistent with resolver).
  // ±0.5σ threshold means "not meaningfully different from platform posterior".
  const direction = (subject: number | null, peer: number | null): string => {
    if (subject == null || peer == null || peer === 0) return '';
    const peerSigma = Math.abs(peer) * 0.15;
    const halfSigma = peerSigma * 0.5;
    const diff = subject - peer;
    if (Math.abs(diff) < halfSigma) return '=';
    return diff > 0 ? '▲' : '▼';
  };
  const dirColor = (dir: string): string =>
    dir === '▲' ? SUBJ_TEAL : dir === '▼' ? '#f87171' : BT.text.muted;

  // Build rows from available data — populate peer + effective from collision map
  const rows: SubjRow[] = [];

  if (cs) {
    rows.push({
      label: 'Occupancy Rate', key: 'occupancy_rate',
      peer: null, subject: cs.occupancy_rate,
      effective: cs.occupancy_rate,
      weight: 1, fmt: 'pct',
    });
    if (cs.loss_to_lease != null) {
      const w = cw['loss_to_lease']?.weight ?? null;
      const be = blendedEffective(cs.loss_to_lease, 'loss_to_lease');
      rows.push({
        label: 'Loss-to-Lease', key: 'loss_to_lease',
        peer: be.peer, subject: cs.loss_to_lease,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (cs.avg_contract_rent != null) {
      rows.push({
        label: 'Avg Contract Rent', key: 'avg_contract_rent',
        peer: null, subject: cs.avg_contract_rent,
        effective: cs.avg_contract_rent,
        weight: 1, fmt: 'dollar',
      });
    }
    if (cs.avg_market_rent != null) {
      rows.push({
        label: 'Avg Market Rent', key: 'avg_market_rent',
        peer: null, subject: cs.avg_market_rent,
        effective: cs.avg_market_rent,
        weight: 1, fmt: 'dollar',
      });
    }
    if (cs.signing_velocity != null) {
      const w = cw['signing_velocity']?.weight ?? null;
      const be = blendedEffective(cs.signing_velocity, 'signing_velocity');
      rows.push({
        label: 'Signing Velocity (mo)', key: 'signing_velocity',
        peer: be.peer, subject: cs.signing_velocity,
        effective: be.effective,
        weight: w, fmt: 'num',
      });
    }
  }

  if (dyn) {
    if (dyn.renewal_rate != null) {
      const w = cw['renewal_rate']?.weight ?? null;
      const be = blendedEffective(dyn.renewal_rate, 'renewal_rate');
      rows.push({
        label: 'Renewal Rate', key: 'renewal_rate',
        peer: be.peer, subject: dyn.renewal_rate,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.turnover_rate != null) {
      const w = cw['turnover_rate']?.weight ?? null;
      const be = blendedEffective(dyn.turnover_rate, 'turnover_rate');
      rows.push({
        label: 'Turnover Rate', key: 'turnover_rate',
        peer: be.peer, subject: dyn.turnover_rate,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.new_lease_trade_out_pct != null) {
      const w = cw['new_lease_trade_out_pct']?.weight ?? null;
      const be = blendedEffective(dyn.new_lease_trade_out_pct, 'new_lease_trade_out_pct');
      rows.push({
        label: 'New Lease Trade-Out', key: 'new_lease_trade_out_pct',
        peer: be.peer, subject: dyn.new_lease_trade_out_pct,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.renewal_trade_out_pct != null) {
      const w = cw['renewal_trade_out_pct']?.weight ?? null;
      const be = blendedEffective(dyn.renewal_trade_out_pct, 'renewal_trade_out_pct');
      rows.push({
        label: 'Renewal Trade-Out', key: 'renewal_trade_out_pct',
        peer: be.peer, subject: dyn.renewal_trade_out_pct,
        effective: be.effective,
        weight: w, fmt: 'pct',
      });
    }
    if (dyn.days_vacant_median != null) {
      const w = cw['days_vacant_median']?.weight ?? null;
      const be = blendedEffective(dyn.days_vacant_median, 'days_vacant_median');
      rows.push({
        label: 'Days Vacant (median)', key: 'days_vacant_median',
        peer: be.peer, subject: dyn.days_vacant_median,
        effective: be.effective,
        weight: w, fmt: 'num',
      });
    }
  }

  const tierColor = history.tier === 'S2' ? SUBJ_TEAL2 : SUBJ_TEAL;

  return (
    <div style={{
      flexShrink: 0,
      borderBottom: `1px solid ${SUBJ_TEAL}30`,
      background: `${SUBJ_TEAL}08`,
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px', cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${SUBJ_TEAL}20` : 'none',
        }}
      >
        <span style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 700,
          color: tierColor, letterSpacing: 1,
          background: `${tierColor}18`, border: `1px solid ${tierColor}40`,
          padding: '1px 5px', borderRadius: 2,
        }}>
          SUBJ·{history.tier}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: SUBJ_TEAL, fontWeight: 600 }}>
          SUBJECT HISTORY
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          {history.snapshot_count} snapshot{history.snapshot_count !== 1 ? 's' : ''}
          {history.coverage_months != null ? ` · ${history.coverage_months.toFixed(1)} mo coverage` : ''}
        </span>
        {cs && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.secondary }}>
            {cs.unit_count}u · {(cs.occupancy_rate * 100).toFixed(1)}% occ
          </span>
        )}
        {collisions.length > 0 && (
          <span style={{
            fontFamily: MONO, fontSize: 8, color: BT.text.amber,
            background: `${BT.text.amber}15`, border: `1px solid ${BT.text.amber}40`,
            padding: '1px 5px', borderRadius: 2, marginLeft: 4,
          }}>
            {collisions.length} PEER COLLISION{collisions.length > 1 ? 'S' : ''}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {dyn && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            {dyn.diff_period_count} diff period{dyn.diff_period_count !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded: comparison table */}
      {expanded && (
        <div style={{ padding: '0 0 6px 0' }}>
          {rows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 8 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <th style={{ padding: '3px 10px', textAlign: 'left',  color: BT.text.muted, fontWeight: 500, minWidth: 200 }}>COEFFICIENT</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted, fontWeight: 500 }}>PEER SET</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: SUBJ_TEAL,     fontWeight: 600 }}>SUBJECT</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.secondary, fontWeight: 500 }}>EFFECTIVE</th>
                  <th style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 80 }}>CONF</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const collision = collisionByKey.get(row.key);
                  const dir = direction(row.subject, row.peer);
                  const isBlended = row.peer != null && row.weight != null && row.weight < 1 && row.weight > 0;
                  const isDrilled = drillKey === row.key;
                  const weightEntry = cw[row.key];
                  return (
                    <React.Fragment key={row.key}>
                      <tr
                        onClick={() => setDrillKey(isDrilled ? null : row.key)}
                        style={{
                          borderBottom: isDrilled ? 'none' : `1px solid ${BT.border.subtle}20`,
                          cursor: 'pointer',
                          background: isDrilled ? `${SUBJ_TEAL}08` : 'transparent',
                        }}
                      >
                        <td style={{ padding: '3px 10px', color: collision ? BT.text.amber : BT.text.secondary }}>
                          {row.label}
                          {collision && (
                            <span style={{ marginLeft: 6, color: BT.text.amber, fontSize: 7 }}>
                              {collision.sigma_deviation.toFixed(1)}σ
                            </span>
                          )}
                          <span style={{ marginLeft: 5, color: BT.text.muted, fontSize: 7 }}>{isDrilled ? '▴' : '▾'}</span>
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: BT.text.muted }}>
                          {fmtSubj(row.peer, row.fmt)}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: SUBJ_TEAL, fontWeight: 600 }}>
                          {dir && (
                            <span style={{ marginRight: 4, color: dirColor(dir), fontSize: 7 }}>{dir}</span>
                          )}
                          {fmtSubj(row.subject, row.fmt)}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right', color: isBlended ? BT.text.secondary : BT.text.muted, fontStyle: isBlended ? 'normal' : 'italic' }}>
                          {fmtSubj(row.effective, row.fmt)}
                          {isBlended && (
                            <span style={{ marginLeft: 4, fontSize: 7, color: BT.text.muted }}>blended</span>
                          )}
                        </td>
                        <td style={{ padding: '3px 10px', textAlign: 'right' }}>
                          {row.weight != null ? (
                            <span style={{
                              color: row.weight >= 0.8 ? SUBJ_TEAL : row.weight >= 0.5 ? BT.text.amber : BT.text.muted,
                              fontWeight: row.weight >= 0.8 ? 600 : 400,
                            }}>
                              {(row.weight * 100).toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                      {isDrilled && (
                        <tr style={{ borderBottom: `1px solid ${BT.border.subtle}20` }}>
                          <td colSpan={5} style={{ padding: '4px 14px 8px', background: `${SUBJ_TEAL}06` }}>
                            {/* Blend formula detail */}
                            <div style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, lineHeight: 1.6 }}>
                              {isBlended && row.subject != null && row.peer != null && row.weight != null ? (
                                <>
                                  <span style={{ color: BT.text.secondary }}>BLEND FORMULA</span>
                                  {'  '}
                                  <span style={{ color: SUBJ_TEAL }}>w={( row.weight * 100).toFixed(0)}%</span>
                                  {' × '}
                                  <span style={{ color: SUBJ_TEAL }}>subj={fmtSubj(row.subject, row.fmt)}</span>
                                  {' + (1−w) × '}
                                  <span style={{ color: BT.text.muted }}>peer={fmtSubj(row.peer, row.fmt)}</span>
                                  {' = '}
                                  <span style={{ color: BT.text.secondary, fontWeight: 600 }}>{fmtSubj(row.effective, row.fmt)}</span>
                                  {weightEntry && (
                                    <>
                                      {'  ·  '}
                                      <span style={{ color: BT.text.muted }}>n={weightEntry.n_obs}/{weightEntry.n_required} obs</span>
                                    </>
                                  )}
                                </>
                              ) : row.subject != null ? (
                                <>
                                  <span style={{ color: BT.text.secondary }}>SUBJECT</span>
                                  {' = '}
                                  <span style={{ color: SUBJ_TEAL }}>{fmtSubj(row.subject, row.fmt)}</span>
                                  {row.peer == null && '  ·  no peer SET value available (platform not calibrated)'}
                                  {row.weight === 1 && '  ·  w=100% (full confidence)'}
                                  {row.weight === 0 && '  ·  w=0% (insufficient sample — subject bypassed)'}
                                  {weightEntry && (
                                    <>
                                      {'  ·  '}
                                      <span>n={weightEntry.n_obs}/{weightEntry.n_required} obs</span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span>No subject observation available — using {row.peer != null ? 'platform peer SET' : 'baseline'}.</span>
                              )}
                              {collision && (
                                <span style={{ marginLeft: 8, color: BT.text.amber }}>
                                  ⚠ PEER COLLISION: {collision.sigma_deviation.toFixed(1)}σ from platform posterior
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Peer collision detail */}
          {collisions.length > 0 && (
            <div style={{ padding: '6px 10px 2px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {collisions.map(c => (
                <span key={c.coefficient} style={{
                  fontFamily: MONO, fontSize: 7,
                  color: BT.text.amber,
                  background: `${BT.text.amber}10`,
                  border: `1px solid ${BT.text.amber}30`,
                  padding: '2px 6px', borderRadius: 2,
                }}>
                  {c.coefficient.toUpperCase()}: subject {fmtSubj(c.subject_value, 'pct')} vs peer {fmtSubj(c.peer_value, 'pct')} ({c.sigma_deviation.toFixed(1)}σ)
                </span>
              ))}
            </div>
          )}

          {/* S2 concession trend */}
          {dyn?.concession_trend && (
            <div style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              CONCESSION TREND:&nbsp;
              <span style={{ color: dyn.concession_trend === 'increasing' ? BT.text.red : dyn.concession_trend === 'decreasing' ? SUBJ_TEAL : BT.text.secondary, fontWeight: 600 }}>
                {dyn.concession_trend.toUpperCase()}
              </span>
            </div>
          )}

          <div style={{ padding: '2px 10px', fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>
            Updated {new Date(history.updated_at).toLocaleDateString()} · M07 §6 subject-first calibration
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export function ProjectionsTab({
  dealId,
  deal,
  integrityWarning,
  f9Financials,
  onTabChange,
  onHoldChange,
  onF9Refresh,
  lvCostTreatmentView,
}: FinancialEngineTabProps) {
  const [timeline, setTimeline] = useState<TimelineOption>(5);

  const handleTimeline = useCallback((yr: TimelineOption) => {
    setTimeline(yr);
    onHoldChange?.(yr);
  }, [onHoldChange]);
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.map(s => s.key)),
  );
  const [showAfterTax, setShowAfterTax] = useState(false);
  const [showGprDecomp,        setShowGprDecomp]        = useState(true);
  const [showFindings,         setShowFindings]          = useState(true);
  const [showSubjectHistory,   setShowSubjectHistory]    = useState(true);

  // ── Lease Velocity Engine state ──────────────────────────────────────────
  const DEFAULT_LV_INPUTS: LVInputs = {
    total_units: 100,
    target_occupancy: 0.95,
    current_occupancy: 0,
    mode: 'LEASE_UP_NEW_CONSTRUCTION' as LeaseMode,
    avg_market_rent: 1500,
    avg_in_place_rent: 1500,
    property_class: 'B',
    time_horizon_months: 36,
    concession_strategy: 'MARKET',
    marketing_intensity: 'MARKET',
    pre_leased_count: 0,
    leasing_cost_treatment: 'OPERATING',
  };
  const [lvInputs,     setLvInputs]     = useState<LVInputs>(DEFAULT_LV_INPUTS);
  const [lvResult,     setLvResult]     = useState<LeaseVelocityResult | null>(null);
  const [lvLoading,    setLvLoading]    = useState(false);
  const [lvError,      setLvError]      = useState<string | null>(null);
  const [lvShowConfig, setLvShowConfig] = useState(false);
  /** Auto-detected mode from deal data — used to show MODE OVERRIDDEN badge */
  const [lvResolvedMode, setLvResolvedMode] = useState<LeaseMode>('LEASE_UP_NEW_CONSTRUCTION');
  /**
   * Track the last f9Financials reference we seeded from so we can re-run the
   * LV engine whenever the parent refreshes financials (e.g., after a treatment
   * change).  We intentionally use object-identity (ref) not deal-ID so that
   * a treatment toggle → onF9Refresh → new f9Financials object triggers a
   * re-run even within the same deal.
   */
  const lvLastSeedRef = useRef<typeof f9Financials>(null);

  // Core engine runner — accepts inputs directly (no closure over stale state)
  // emitEvent=true only for user-triggered runs (mode override, clear override, manual Run
  // button).  The auto-seed effect passes false (default) to avoid an infinite loop:
  //   auto-seed → emit → fetchF9Financials → new f9Financials ref → auto-seed → …
  const runLvEngine = useCallback(async (inputs: LVInputs, emitEvent = false) => {
    if (!dealId) return;
    setLvLoading(true);
    setLvError(null);
    try {
      const resp = await apiClient.post<{ success: boolean; data: LeaseVelocityResult; error?: string }>(
        '/api/v1/lease-velocity/run',
        { inputs },
      );
      if (resp.data?.success) {
        setLvResult(resp.data.data);
        if (emitEvent) {
          // Notify downstream F9 consumers (S&U reserve, Returns IRR, JEDI Position
          // sub-score) via the dealStore event bus so they re-fetch /financials.
          // Only fired for user-triggered runs to prevent f9Financials→LV feedback loop.
          useDealStore.getState().emitLeaseVelocityUpdated();
        }
      } else {
        setLvError(resp.data?.error ?? 'Engine returned an error');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })
        ?.response?.data?.error
        ?? (err as { message?: string }).message
        ?? 'Request failed';
      setLvError(msg);
    } finally {
      setLvLoading(false);
    }
  }, [dealId]);

  // Re-seed and re-run the LV engine whenever f9Financials is a new object
  // (including after onF9Refresh / treatment changes), not just on deal-ID change.
  // Using object-identity avoids the one-shot anti-pattern that prevented re-runs
  // after upstream refreshes.
  useEffect(() => {
    if (!f9Financials || !dealId) return;
    // Skip if we already processed this exact reference (prevents double-fire
    // in React StrictMode double-invoke without blocking legitimate re-fetches).
    if (lvLastSeedRef.current === f9Financials) return;
    lvLastSeedRef.current = f9Financials;

    const occ = f9Financials.rentRollSummary?.weightedOccupancyPct ?? null;
    const autoMode: LeaseMode =
      occ == null || occ < 0.5  ? 'LEASE_UP_NEW_CONSTRUCTION'
      : occ < 0.85              ? 'OCCUPANCY_RECOVERY'
      :                           'STABILIZED_MAINTENANCE';
    const gprRow = f9Financials.proforma?.year1?.find((r: { field: string }) => r.field === 'gpr');
    const autoMktRent = gprRow?.resolved != null && f9Financials.totalUnits > 0
      ? Math.round(gprRow.resolved / f9Financials.totalUnits / 12)
      : 1500;

    const seedInputs: LVInputs = {
      ...DEFAULT_LV_INPUTS,
      total_units:           f9Financials.totalUnits || DEFAULT_LV_INPUTS.total_units,
      avg_market_rent:       autoMktRent,
      avg_in_place_rent:     Math.round(f9Financials.rentRollSummary?.avgInPlaceRent ?? autoMktRent),
      current_occupancy:     occ ?? 0,
      mode:                  autoMode,
      // Inherit the shared top-bar treatment so the LV engine uses the same
      // classification as the Pro Forma / Projections numbers.
      leasing_cost_treatment: lvCostTreatmentView ?? DEFAULT_LV_INPUTS.leasing_cost_treatment,
    };
    setLvResolvedMode(autoMode);
    setLvInputs(seedInputs);
    void runLvEngine(seedInputs);
  }, [f9Financials, dealId, runLvEngine]);

  // Mode override: user changes mode in the panel → write deal.lease_mode_override + re-run engine
  const handleModeOverride = useCallback(async (mode: LeaseMode) => {
    const next = { ...lvInputs, mode };
    setLvInputs(next);
    if (dealId) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/context`, { lease_mode_override: mode });
      } catch (err) {
        console.error('[LV] Failed to save lease_mode_override:', err);
      }
    }
    void runLvEngine(next, true); // user-triggered: emit event to refresh F9 consumers
  }, [lvInputs, dealId, runLvEngine]);

  // Clear override: resets deal.lease_mode_override to null → engine returns to
  // auto-detected mode (heuristic from occupancy in lvResolvedMode).
  const handleClearModeOverride = useCallback(async () => {
    const next = { ...lvInputs, mode: lvResolvedMode };
    setLvInputs(next);
    if (dealId) {
      try {
        await apiClient.patch(`/api/v1/deals/${dealId}/context`, { lease_mode_override: null });
      } catch (err) {
        console.error('[LV] Failed to clear lease_mode_override:', err);
      }
    }
    void runLvEngine(next, true); // user-triggered: emit event to refresh F9 consumers
  }, [lvInputs, lvResolvedMode, dealId, runLvEngine]);

  const [narrative,        setNarrative]       = useState<string | null>(null);
  const [narrativeBlocks,  setNarrativeBlocks] = useState<F9NarrativeBlock[]>([]);
  const [narrativeLoading, setNarrativeLoading]= useState(false);
  const [exporting,        setExporting]       = useState(false);
  const [error,            setError]           = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownInfo | null>(null);
  const [concessionDrill, setConcessionDrill] = useState<{
    open: boolean;
    periodLabel: string;
    recognizedAmount: number | null;
    earnedAmount: number | null;
    detail: AggregatedConcessionDetail | null;
    source: 'earned' | 'recognized';
    calendarYearTotal: number | null;
    fiscalYearTotal: number | null;
  }>({ open: false, periodLabel: '', recognizedAmount: null, earnedAmount: null, detail: null, source: 'recognized', calendarYearTotal: null, fiscalYearTotal: null });

  // Narrative load — non-critical, fires once
  const loadNarrative = useCallback(async () => {
    if (!dealId) return;
    setNarrativeLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { narrative: string | null; blocks: F9NarrativeBlock[]; cachedAt: string; source: string; fresh: boolean };
      }>(`/api/v1/deals/${dealId}/financials/narrative`);
      const d = res.data?.data;
      if (d) { setNarrative(d.narrative ?? null); setNarrativeBlocks(d.blocks ?? []); }
    } catch {
      // Non-fatal
    } finally {
      setNarrativeLoading(false);
    }
  }, [dealId]);

  React.useEffect(() => { loadNarrative(); }, [loadNarrative]);

  // Use f9Financials from parent (no separate fetch needed — avoids dual fetching)
  const financials = f9Financials ?? null;

  const holdYears  = timeline;
  // Consume backend-resolved projections; the server is the single source of truth
  const projections: ProjYear[] = useMemo(
    () => (financials?.projections ?? []).slice(0, holdYears),
    [financials, holdYears],
  );

  // Current calendar year for recognized-concessions row (§14 earned-vs-recognized)
  const currentCalendarYear = new Date().getFullYear();
  const closeYear = financials?.closeDate
    ? new Date(financials.closeDate).getFullYear()
    : currentCalendarYear;

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Export
  const handleExport = useCallback(async () => {
    if (!financials || !dealId) return;
    setExporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const url   = `/api/v1/deals/${dealId}/financials/export?hold=${timeline}`;
      const resp  = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) throw new Error(`Export failed: ${resp.status}`);
      const blob    = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      const safeName = financials.dealName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
      a.href         = blobUrl;
      a.download     = `${safeName}_ProForma_${holdYears}yr.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [financials, dealId, timeline, holdYears]);

  const hasGprDecomp   = financials?.assumptions.gprDecomposition != null;
  const hasNarrative   = narrative != null && narrative.length > 0;
  const integrityChecks = financials?.proforma.integrityChecks ?? [];
  const hasAfterTaxData = projections.some(p => p.depreciation != null);

  // Sub-period columns for monthly/quarterly
  const subCols = useMemo(
    () => viewMode !== 'annual' ? buildSubCols(Math.min(holdYears, viewMode === 'monthly' ? 2 : holdYears), viewMode) : [],
    [viewMode, holdYears],
  );

  // Annual column headers
  const annualYears = Array.from({ length: holdYears }, (_, i) => i + 1);

  // Active columns
  const isAnnual = viewMode === 'annual';
  const colCount  = isAnnual ? holdYears : subCols.length;

  return (
    <>
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header controls ────────────────────────────────────────────── */}
        <div style={{
          padding: '4px 10px', background: BT.bg.header,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        }}>
          {/* Timeline */}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>HOLD:</span>
          {([3, 5, 7, 10] as TimelineOption[]).map(t => (
            <button key={t} onClick={() => handleTimeline(t)} style={{
              background: timeline === t ? BT.bg.active : 'transparent',
              color:      timeline === t ? BT.met.financial : BT.text.muted,
              border:     timeline === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>{t}YR</button>
          ))}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {/* View mode */}
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>VIEW:</span>
          {(['annual', 'quarterly', 'monthly'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              background: viewMode === v ? BT.bg.active : 'transparent',
              color:      viewMode === v ? BT.text.cyan : BT.text.muted,
              border:     viewMode === v ? `1px solid ${BT.text.cyan}40` : '1px solid transparent',
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>{v.toUpperCase()}</button>
          ))}

          <div style={{ width: 1, height: 14, background: BT.border.medium }} />

          {/* After-tax toggle */}
          {hasAfterTaxData && (
            <button onClick={() => setShowAfterTax(v => !v)} style={{
              background: showAfterTax ? `${BT.text.purple}20` : 'transparent',
              color:      showAfterTax ? BT.text.purple : BT.text.muted,
              border: `1px solid ${showAfterTax ? BT.text.purple : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>AFTER-TAX</button>
          )}

          {hasGprDecomp && (
            <button onClick={() => setShowGprDecomp(v => !v)} style={{
              background: showGprDecomp ? `${BT.met.financial}15` : 'transparent',
              color:      showGprDecomp ? BT.met.financial : BT.text.muted,
              border: `1px solid ${showGprDecomp ? BT.met.financial : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>GPR DECOMP</button>
          )}

          {hasNarrative && (
            <button onClick={() => setShowFindings(v => !v)} style={{
              background: showFindings ? `${BT.text.purple}15` : 'transparent',
              color:      showFindings ? BT.text.purple : BT.text.muted,
              border: `1px solid ${showFindings ? BT.text.purple : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>FINDINGS</button>
          )}
          {financials?.subjectHistory && (
            <button onClick={() => setShowSubjectHistory(v => !v)} style={{
              background: showSubjectHistory ? `${SUBJ_TEAL}18` : 'transparent',
              color:      showSubjectHistory ? SUBJ_TEAL : BT.text.muted,
              border: `1px solid ${showSubjectHistory ? SUBJ_TEAL : BT.border.subtle}`,
              padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
            }}>SUBJ·{financials.subjectHistory.tier}</button>
          )}

          <div style={{ flex: 1 }} />

          {financials && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              {financials.totalUnits} UNITS · {financials.dealName}
            </span>
          )}

          <button
            onClick={() => { void handleExport(); }}
            disabled={!financials || projections.length === 0 || exporting}
            style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`,
              color:    financials && !exporting ? BT.text.secondary : BT.text.muted,
              fontFamily: MONO, fontSize: 9, padding: '2px 8px',
              cursor:   financials && !exporting ? 'pointer' : 'default',
              borderRadius: 2, opacity: financials && !exporting ? 1 : 0.4,
            }}
          >
            {exporting ? 'EXPORTING...' : 'EXPORT XLSX'}
          </button>
        </div>

        {/* ── Integrity banners ──────────────────────────────────────────── */}
        {integrityWarning && (
          <div style={{ background: '#1c0a0a', borderBottom: '1px solid #ef4444', borderLeft: '4px solid #ef4444', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#ef4444', fontWeight: 700 }}>PRO FORMA INTEGRITY ERRORS DETECTED</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#fca5a5' }}>Projections may reflect unresolved field conflicts. Review Pro Forma tab for details.</span>
          </div>
        )}
        {integrityChecks.length > 0 && <IntegrityBanner checks={integrityChecks} />}

        {/* ── AI Findings ────────────────────────────────────────────────── */}
        {showFindings && (narrativeLoading || hasNarrative) && (
          <FindingsPanel narrative={narrative} blocks={narrativeBlocks} loading={narrativeLoading} />
        )}

        {/* ── Subject History (M07 §6) ────────────────────────────────────── */}
        {showSubjectHistory && financials?.subjectHistory && (
          <SubjectHistoryPanel history={financials.subjectHistory} />
        )}



        {/* ── Export error ───────────────────────────────────────────────── */}
        {error && (
          <div style={{ padding: '4px 10px', background: `${BT.text.red}12`, fontFamily: MONO, fontSize: 8, color: BT.text.red, flexShrink: 0 }}>
            {error}
          </div>
        )}

        {/* ── Operating Statement Table ──────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header, zIndex: 2 }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500, minWidth: 220, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 3 }}>
                  OPERATING STATEMENT
                  {financials && <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted, fontSize: 8 }}>· {financials.totalUnits} units · M07</span>}
                </th>
                {isAnnual
                  ? annualYears.map(yr => (
                      <th key={yr} style={{ padding: '5px 8px', textAlign: 'right', color: yr === holdYears ? BT.text.amber : BT.text.muted, fontWeight: yr === holdYears ? 700 : 500, minWidth: 90, borderLeft: yr === holdYears ? `2px solid ${BT.text.amber}40` : undefined }}>
                        {yr === holdYears ? `YR ${yr} ★` : `YR ${yr}`}
                      </th>
                    ))
                  : subCols.map(c => (
                      <th key={c.periodKey} style={{ padding: '5px 6px', textAlign: 'right', color: BT.text.muted, fontWeight: 500, minWidth: 80, fontSize: 8 }}>
                        {c.label}
                      </th>
                    ))
                }
              </tr>
            </thead>

            <tbody>
              {SECTIONS.map(section => {
                const isExpanded = expandedSections.has(section.key);
                // Hide after-tax section unless toggle active
                if (section.key === 'aftertax' && !showAfterTax) return null;

                return (
                  <React.Fragment key={section.key}>
                    <tr onClick={() => toggleSection(section.key)} style={{ cursor: 'pointer', background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
                      <td colSpan={colCount + 1} style={{ padding: '5px 8px', color: section.color, fontWeight: 700, letterSpacing: 0.8, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 1 }}>
                        {isExpanded ? '▾' : '▸'} {section.label}
                      </td>
                    </tr>

                    {isExpanded && section.rows.map((row, ri) => {
                      // Hide after-tax rows unless toggle active
                      if (row.afterTaxOnly && !showAfterTax) return null;

                      const isEven = ri % 2 === 0;
                      const rowBg  = row.isTotal ? `${section.color}08` : isEven ? BT.bg.panel : BT.bg.terminal;

                      const rowEl = (
                        <tr key={row.key} style={{ background: rowBg, borderBottom: row.isTotal ? `2px solid ${BT.border.medium}` : `1px solid ${BT.border.subtle}` }}>
                          <td style={{ padding: `3px 8px 3px ${row.indent ? 20 : 8}px`, color: row.isTotal ? BT.text.white : BT.text.secondary, fontWeight: row.isTotal ? 700 : 400, position: 'sticky', left: 0, background: rowBg, zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{row.label}</span>
                              {row.tabLink != null && (
                                <button
                                  onClick={e => { e.stopPropagation(); onTabChange?.(row.tabLink!); }}
                                  style={{ background: 'transparent', border: `1px solid ${BT.border.subtle}`, color: BT.text.muted, fontFamily: MONO, fontSize: 7, padding: '0 4px', cursor: 'pointer', borderRadius: 2 }}
                                >
                                  ↗
                                </button>
                              )}
                            </div>
                          </td>

                          {isAnnual
                            ? annualYears.map(yr => {
                                const isSaleYear = section.key === 'exit' && yr === holdYears;
                                const proj    = projections[yr - 1];
                                const rawVal  = proj ? (proj[row.key] as number | null) : null;
                                const display = fmtCell(rawVal, row.fmt, row.sign);
                                const isNeg   = rawVal != null && rawVal < 0;
                                const textColor = isSaleYear && row.isTotal
                                  ? BT.text.amber
                                  : row.isTotal ? section.color
                                  : isNeg ? BT.text.red
                                  : row.sign === -1 && rawVal != null && rawVal > 0 ? BT.text.red
                                  : BT.text.primary;
                                // Source badge
                                const srcKey  = row.sourceKey ? (proj?.[row.sourceKey] as string | undefined) : undefined;
                                const srcBadge = srcKey ? SOURCE_LABELS[srcKey] : null;
                                return (
                                  <td
                                    key={yr}
                                    onClick={() => {
                                      if (!proj) return;
                                      const recog = financials?.concessionRecognition;
                                      if (row.key === 'concessions' && recog?.monthly_detail) {
                                        const calYr = closeYear + (yr - 1);
                                        const yyyymms = Array.from({ length: 12 }, (_, i) => `${calYr}${String(i + 1).padStart(2, '0')}`);
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `YR ${calYr}`,
                                          recognizedAmount: recog.by_calendar_year[String(calYr)] ?? null,
                                          earnedAmount: (proj.concessions as number | null | undefined) ?? null,
                                          detail: aggregateConcessionDetail(recog.monthly_detail, yyyymms),
                                          source: 'earned',
                                          calendarYearTotal: recog.by_calendar_year[String(calYr)] ?? null,
                                          fiscalYearTotal: recog.by_fiscal_year?.[String(calYr)] ?? null,
                                        });
                                      } else {
                                        setDrilldown(buildDrilldown(row, proj, financials));
                                      }
                                    }}
                                    style={{ padding: '3px 8px', textAlign: 'right', color: textColor, fontWeight: row.isTotal ? 700 : 400, cursor: proj ? 'pointer' : 'default', borderLeft: isSaleYear ? `2px solid ${BT.text.amber}40` : undefined, background: isSaleYear ? `${BT.text.amber}06` : undefined }}
                                    title={proj ? (isSaleYear ? `SALE YEAR — Click for formula drilldown` : row.key === 'concessions' ? 'Click for concession breakdown' : `Click for formula drilldown`) : undefined}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                      {srcBadge && (
                                        <span style={{ fontSize: 7, color: srcBadge.color, fontFamily: MONO, padding: '0 2px', border: `1px solid ${srcBadge.color}40`, borderRadius: 2 }}>
                                          {srcBadge.label}
                                        </span>
                                      )}
                                      <span>{display}</span>
                                    </div>
                                  </td>
                                );
                              })
                            : subCols.map(c => {
                                const proj    = projections[c.projYear - 1];
                                const rawVal  = proj ? (proj[row.key] as number | null) : null;
                                // noSubPeriod rows (ratios, %, balances, exit/disposition) show annual value unchanged
                                // flow rows get divided by period count
                                const subVal  = rawVal != null
                                  ? (row.noSubPeriod ? rawVal : rawVal * c.fraction)
                                  : null;
                                const display = fmtCell(subVal, row.fmt, row.sign);
                                const isNeg   = subVal != null && subVal < 0;
                                const textColor = row.isTotal ? section.color : isNeg ? BT.text.red : row.sign === -1 && subVal != null && subVal > 0 ? BT.text.red : BT.text.primary;
                                const periodLabel = row.noSubPeriod ? `YR ${c.projYear} (annual, not prorated)` : `YR ${c.projYear} ÷ ${viewMode === 'quarterly' ? 4 : 12}`;
                                return (
                                  <td
                                    key={c.periodKey}
                                    onClick={() => {
                                      if (!proj) return;
                                      const recog = financials?.concessionRecognition;
                                      if (row.key === 'concessions' && recog?.monthly_detail && viewMode === 'monthly') {
                                        const monthNum = parseInt(c.periodKey.slice(1, 3), 10);
                                        const yearNum  = parseInt(c.periodKey.slice(4), 10);
                                        const offset   = (yearNum - 1) * 12 + (monthNum - 1);
                                        const yyyymm   = yyyymmFromClose(financials?.closeDate, offset);
                                        if (yyyymm) {
                                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                          const mLabel = `${MONTHS[parseInt(yyyymm.slice(4), 10) - 1]} ${yyyymm.slice(0, 4)}`;
                                          const mYr = yyyymm.slice(0, 4);
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: mLabel,
                                            recognizedAmount: recog.monthly[yyyymm] ?? null,
                                            earnedAmount: subVal,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, [yyyymm]),
                                            source: 'earned',
                                            calendarYearTotal: recog.by_calendar_year?.[mYr] ?? null,
                                            fiscalYearTotal: recog.by_fiscal_year?.[mYr] ?? null,
                                          });
                                          return;
                                        }
                                      }
                                      if (row.key === 'concessions' && recog?.monthly_detail && viewMode === 'quarterly') {
                                        const qNum    = parseInt(c.periodKey.slice(1, 3), 10);
                                        const yearNum = parseInt(c.periodKey.slice(4), 10);
                                        const baseOffset = (yearNum - 1) * 12 + (qNum - 1) * 3;
                                        const yyyymms = ([0, 1, 2]
                                          .map(i => yyyymmFromClose(financials?.closeDate, baseOffset + i))
                                          .filter(Boolean)) as string[];
                                        if (yyyymms.length > 0) {
                                          const qLabel = `Q${qNum} YR${yearNum}`;
                                          const qYr = yyyymms[0].slice(0, 4);
                                          const hasQRecog = yyyymms.some(k => k in recog.monthly);
                                          const recognizedQ = hasQRecog ? yyyymms.reduce((s, k) => s + (recog.monthly[k] ?? 0), 0) : null;
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: qLabel,
                                            recognizedAmount: recognizedQ,
                                            earnedAmount: subVal,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, yyyymms),
                                            source: 'earned',
                                            calendarYearTotal: recog.by_calendar_year?.[qYr] ?? null,
                                            fiscalYearTotal: recog.by_fiscal_year?.[qYr] ?? null,
                                          });
                                          return;
                                        }
                                      }
                                      setDrilldown(buildDrilldown(row, proj, financials));
                                    }}
                                    style={{ padding: '3px 6px', textAlign: 'right', color: textColor, fontWeight: row.isTotal ? 700 : 400, cursor: proj ? 'pointer' : 'default', fontSize: 8 }}
                                    title={proj ? (row.key === 'concessions' && viewMode === 'monthly' ? 'Click for concession breakdown' : periodLabel) : undefined}
                                  >
                                    {display}
                                  </td>
                                );
                              })
                          }
                        </tr>
                      );

                      // "Current Year (YYYY) Concessions" — recognized (amortized) row,
                      // injected after the earned concessions row in REVENUE section.
                      if (
                        section.key === 'revenue' &&
                        row.key === 'concessions' &&
                        financials?.concessionRecognition != null
                      ) {
                        const recog = financials.concessionRecognition;
                        const recognizedAmt = recog.by_calendar_year[String(currentCalendarYear)] ?? null;
                        const horizonYears = annualYears.map(yr => closeYear + (yr - 1));
                        const currentYearInHorizon = horizonYears.includes(currentCalendarYear);
                        if (!currentYearInHorizon) return rowEl;

                        const recBg = `${BT.text.amber}07`;
                        const recognizedRowEl = (
                          <tr
                            key="__recognized_concessions__"
                            style={{ background: recBg, borderBottom: `1px solid ${BT.border.subtle}` }}
                          >
                            <td
                              style={{ padding: '3px 8px 3px 20px', color: BT.text.amber, fontWeight: 400, position: 'sticky', left: 0, background: recBg, zIndex: 1 }}
                              title={`Recognized (straight-line amortized) concessions for calendar year ${currentCalendarYear}. Distinct from earned (cash) concessions above — §14 EARNED-VS-RECOGNIZED-DISTINCTION.`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: BT.text.amber }}>
                                  Current Year ({currentCalendarYear}) Concessions
                                </span>
                                <span style={{ fontSize: 7, color: BT.text.amber, fontFamily: MONO, padding: '0 2px', border: `1px solid ${BT.text.amber}40`, borderRadius: 2 }}>
                                  AMORT
                                </span>
                              </div>
                            </td>
                            {isAnnual
                              ? annualYears.map(yr => {
                                  const calYear = closeYear + (yr - 1);
                                  const val = recog.by_calendar_year[String(calYear)] ?? null;
                                  const display = val != null ? fmt$(-Math.abs(val)) : '—';
                                  return (
                                    <td
                                      key={yr}
                                      onClick={() => {
                                        if (val == null || !financials?.concessionRecognition?.monthly_detail) return;
                                        const recogInner = financials.concessionRecognition;
                                        const yyyymms = Array.from({ length: 12 }, (_, i) => `${calYear}${String(i + 1).padStart(2, '0')}`);
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `YR ${calYear} RECOGNIZED`,
                                          recognizedAmount: val,
                                          earnedAmount: null,
                                          detail: aggregateConcessionDetail(recogInner.monthly_detail, yyyymms),
                                          source: 'recognized',
                                          calendarYearTotal: recogInner.by_calendar_year?.[String(calYear)] ?? null,
                                          fiscalYearTotal: recogInner.by_fiscal_year?.[String(calYear)] ?? null,
                                        });
                                      }}
                                      style={{ padding: '3px 8px', textAlign: 'right', color: val != null ? BT.text.amber : BT.text.muted, fontWeight: 400, cursor: val != null ? 'pointer' : 'default' }}
                                      title={val != null
                                        ? `Click for concession recognition breakdown — ${calYear}`
                                        : `No recognition data for ${calYear}`}
                                    >
                                      {display}
                                    </td>
                                  );
                                })
                              : subCols.map(c => {
                                  const prefix = c.periodKey[0]; // 'M' or 'Q'
                                  const periodNum = parseInt(c.periodKey.slice(1, 3), 10);
                                  const yearNum   = parseInt(c.periodKey.slice(4), 10);
                                  if (prefix === 'M') {
                                    const offset = (yearNum - 1) * 12 + (periodNum - 1);
                                    const yyyymm = yyyymmFromClose(financials?.closeDate, offset);
                                    const mVal   = yyyymm ? (recog.monthly[yyyymm] ?? null) : null;
                                    const mYr    = yyyymm ? yyyymm.slice(0, 4) : null;
                                    return (
                                      <td
                                        key={c.periodKey}
                                        onClick={() => {
                                          if (mVal == null || !yyyymm || !recog.monthly_detail) return;
                                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                          const mLabel = `${MONTHS[parseInt(yyyymm.slice(4), 10) - 1]} ${yyyymm.slice(0, 4)}`;
                                          setConcessionDrill({
                                            open: true,
                                            periodLabel: `${mLabel} RECOGNIZED`,
                                            recognizedAmount: mVal,
                                            earnedAmount: null,
                                            detail: aggregateConcessionDetail(recog.monthly_detail, [yyyymm]),
                                            source: 'recognized',
                                            calendarYearTotal: null,
                                            fiscalYearTotal: null,
                                          });
                                        }}
                                        style={{ padding: '3px 6px', textAlign: 'right', color: mVal != null ? BT.text.amber : BT.text.muted, fontSize: 8, cursor: mVal != null ? 'pointer' : 'default' }}
                                        title={mVal != null ? 'Click for recognized concession breakdown' : undefined}
                                      >
                                        {mVal != null ? fmt$(-Math.abs(mVal)) : '—'}
                                      </td>
                                    );
                                  }
                                  // quarterly
                                  const baseOffset = (yearNum - 1) * 12 + (periodNum - 1) * 3;
                                  const qMms = ([0, 1, 2].map(i => yyyymmFromClose(financials?.closeDate, baseOffset + i)).filter(Boolean)) as string[];
                                  const hasQData = qMms.some(k => k in recog.monthly);
                                  const qVal  = hasQData ? qMms.reduce((s, k) => s + (recog.monthly[k] ?? 0), 0) : null;
                                  return (
                                    <td
                                      key={c.periodKey}
                                      onClick={() => {
                                        if (qVal == null || qMms.length === 0 || !recog.monthly_detail) return;
                                        setConcessionDrill({
                                          open: true,
                                          periodLabel: `Q${periodNum} YR${yearNum} RECOGNIZED`,
                                          recognizedAmount: qVal,
                                          earnedAmount: null,
                                          detail: aggregateConcessionDetail(recog.monthly_detail, qMms),
                                          source: 'recognized',
                                          calendarYearTotal: null,
                                          fiscalYearTotal: null,
                                        });
                                      }}
                                      style={{ padding: '3px 6px', textAlign: 'right', color: qVal != null ? BT.text.amber : BT.text.muted, fontSize: 8, cursor: qVal != null ? 'pointer' : 'default' }}
                                      title={qVal != null ? 'Click for recognized concession breakdown' : undefined}
                                    >
                                      {qVal != null ? fmt$(-Math.abs(qVal)) : '—'}
                                    </td>
                                  );
                                })
                            }
                          </tr>
                        );
                        return (
                          <React.Fragment key={`${row.key}_frag`}>
                            {rowEl}
                            {recognizedRowEl}
                          </React.Fragment>
                        );
                      }

                      return rowEl;
                    })}
                  </React.Fragment>
                );
              })}

              {/* ── Traffic signal footnote ──────────────────────────────── */}
              {isAnnual && financials?.trafficProjection?.yearly && financials.trafficProjection.yearly.length > 0 && (
                <tr style={{ background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '4px 8px', color: BT.text.muted, fontSize: 8, fontStyle: 'italic', position: 'sticky', left: 0, background: BT.bg.header }}>
                    Traffic signals: T01/T05/T06 integrated via M07 Engine
                  </td>
                  {annualYears.map(yr => {
                    const tv = financials.trafficProjection?.yearly.find(t => t.year === yr);
                    return (
                      <td key={yr} style={{ padding: '4px 8px', textAlign: 'right', fontSize: 8 }}>
                        {tv?.occupancyPct != null
                          ? <span style={{ color: BT.text.cyan }}>{(tv.occupancyPct * 100).toFixed(1)}% occ</span>
                          : <span style={{ color: BT.text.muted }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              )}

              {/* ── Data source legend ───────────────────────────────────── */}
              {projections.length > 0 && (
                <tr style={{ background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}` }}>
                  <td colSpan={colCount + 1} style={{ padding: '4px 10px', position: 'sticky', left: 0, background: BT.bg.header }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>DATA SOURCES:</span>
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 7, color: v.color, fontFamily: MONO, padding: '0 2px', border: `1px solid ${v.color}40`, borderRadius: 2 }}>{v.label}</span>
                          <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>{k.replace('_', ' ')}</span>
                        </span>
                      ))}
                      <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted, marginLeft: 'auto' }}>Click any cell for formula drilldown</span>
                    </div>
                  </td>
                </tr>
              )}

              {/* ── Key metrics strip (pinned bottom row) ─────────────────── */}
              {isAnnual && projections.length > 0 && METRICS_STRIP.map((m, mi) => (
                <tr key={m.key} style={{ background: mi % 2 === 0 ? `${BT.text.amber}08` : BT.bg.panel, borderBottom: mi === METRICS_STRIP.length - 1 ? `2px solid ${BT.text.amber}40` : `1px solid ${BT.border.subtle}` }}>
                  <td style={{ padding: '3px 8px', color: BT.text.amber, fontWeight: 500, fontSize: 8, position: 'sticky', left: 0, background: mi % 2 === 0 ? `${BT.text.amber}08` : BT.bg.panel, zIndex: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                    {m.label}
                  </td>
                  {annualYears.map(yr => {
                    const proj = projections[yr - 1];
                    const rawVal = proj ? (proj[m.key] as number | null) : null;
                    const display = fmtCell(rawVal, m.fmt);
                    return (
                      <td key={yr} style={{ padding: '3px 8px', textAlign: 'right', fontFamily: MONO, fontSize: 8, color: rawVal != null ? BT.text.amber : BT.text.muted, fontWeight: 500 }}>
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty state */}
          {projections.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
              <div style={{ marginBottom: 8 }}>No projection data available for this deal.</div>
              <div>Run <strong style={{ color: BT.text.secondary }}>REPARSE</strong> from the Pro Forma tab to seed Year 1 data.</div>
            </div>
          )}
        </div>

        {/* ── Lease Velocity Engine (§12) ─────────────────────────────────────
             Placement: BELOW the projections grid, ABOVE GPR Decomposition.
             Always shown when dealId is present so users can see / configure
             the panel immediately — it renders a pending/empty state while the
             engine is running on first mount. */}
        {!!dealId && (
          <LeaseVelocitySection
            result={lvResult}
            loading={lvLoading}
            inputs={lvInputs}
            onInputsChange={setLvInputs}
            onRun={() => void runLvEngine(lvInputs, true)}
            showConfig={lvShowConfig}
            onToggleConfig={() => setLvShowConfig(v => !v)}
            runError={lvError}
            resolvedMode={lvResolvedMode}
            leaseOverride={
              (deal?.['deal_data'] as Record<string, unknown> | null | undefined)
                ?.['lease_mode_override'] as LeaseMode | null | undefined
            }
            onModeOverride={handleModeOverride}
            onClearOverride={handleClearModeOverride}
          />
        )}

        {/* ── GPR Decomposition ──────────────────────────────────────────────── */}
        {showGprDecomp && hasGprDecomp && (
          <GprDecompPanel decomp={financials!.assumptions.gprDecomposition!} totalUnits={financials!.totalUnits} />
        )}

      </div>

      {/* ── Drilldown Drawer (right side) ──────────────────────────────────── */}
      {drilldown && (
        <DrilldownDrawer
          info={drilldown}
          onClose={() => setDrilldown(null)}
          onTabChange={onTabChange}
        />
      )}

    </div>

    <ConcessionDrilldownModal
      open={concessionDrill.open}
      onClose={() => setConcessionDrill(p => ({ ...p, open: false }))}
      periodLabel={concessionDrill.periodLabel}
      recognizedAmount={concessionDrill.recognizedAmount}
      earnedAmount={concessionDrill.earnedAmount}
      detail={concessionDrill.detail}
      source={concessionDrill.source}
      calendarYearTotal={concessionDrill.calendarYearTotal}
      fiscalYearTotal={concessionDrill.fiscalYearTotal}
    />
    </>
  );
}

export default ProjectionsTab;
