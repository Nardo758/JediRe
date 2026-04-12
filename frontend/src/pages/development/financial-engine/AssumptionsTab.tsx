import React, { useState, useMemo } from 'react';
import { Lock, Edit2, Download, AlertTriangle, TrendingUp, Building2, DollarSign, BarChart3, ChevronRight } from 'lucide-react';
import { BT } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';

type Page = 'OVERVIEW' | 'DEBT' | 'TAXES';
type HoldYears = '5 YR' | '7 YR' | '10 YR';

const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';
const fmtK = (n: number) => '$' + Math.round(n / 1000).toLocaleString() + 'K';
const fmtPct2 = (n: number, dec = 1) => (n * 100).toFixed(dec) + '%';

// ─── Shared cell renderer ──────────────────────────────────────────────────────

type CellType = 'normal' | 'ai' | 'override' | 'm07' | 'locked' | 'flagged' | 'computed' | 'warn' | 'good' | 'header';

function Cell({ v, type = 'normal', span, align = 'right', tooltip }: {
  v: string; type?: CellType;
  span?: number; align?: 'right' | 'left' | 'center'; tooltip?: string;
}) {
  const base = 'relative px-2 py-1 text-[10px] font-mono tabular-nums border-r border-[#1e1e1e] group ';
  const alignCls = align === 'left' ? 'text-left ' : align === 'center' ? 'text-center ' : 'text-right ';
  const variants: Record<CellType, string> = {
    normal:   'text-slate-300 hover:border hover:border-blue-500/50 hover:bg-[#1e1e1e] cursor-text ',
    ai:       'text-cyan-400 ',
    override: 'text-blue-400 bg-[#1e293b]/30 ',
    m07:      'text-purple-400 ',
    locked:   'text-slate-500 bg-[#0f0f0f] ',
    flagged:  'text-amber-500 bg-amber-900/20 ',
    computed: 'text-slate-200 font-bold ',
    warn:     'text-amber-400 bg-amber-900/10 ',
    good:     'text-green-400 ',
    header:   'text-slate-400 font-bold bg-[#111111] ',
  };
  const icons: Partial<Record<CellType, React.ReactNode>> = {
    ai:       <sup className="absolute top-[2px] right-[2px] text-[6px] text-cyan-500">AI</sup>,
    override: <Edit2 className="absolute top-[2px] left-[2px] w-2 h-2 text-blue-500 opacity-0 group-hover:opacity-100" />,
    m07:      <sup className="absolute top-[2px] right-[2px] text-[6px] text-purple-500">M07</sup>,
    locked:   <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-600" />,
    flagged:  <AlertTriangle className="absolute top-[2px] left-[2px] w-2 h-2 text-amber-500" />,
  };
  return (
    <td className={base + alignCls + variants[type]} colSpan={span} title={tooltip}>
      {icons[type]}
      {v}
    </td>
  );
}

function SectionHeader({ label, colSpan = 12 }: { label: string; colSpan?: number }) {
  return (
    <tr className="bg-[#1e1e1e]/50 border-y border-[#1e1e1e]">
      <td colSpan={colSpan} className="px-3 py-1 text-[11px] font-bold text-[#e2e8f0] sticky left-0">{label}</td>
    </tr>
  );
}

function Row({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#1e1e1e]/50 hover:bg-[#111111] h-[22px]">
      <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]">
        <span className="flex items-center gap-1">
          {locked && <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />}
          {label}
        </span>
      </td>
      {children}
    </tr>
  );
}

// ─── Debt schedule builder ─────────────────────────────────────────────────────

interface DebtYear {
  yr: number; begBalance: number; annualPayment: number;
  interest: number; principal: number; endBalance: number;
  noi: number; dscr: number; ltv: number;
}

function buildDebtSchedule(
  loanAmt: number, rateAnn: number, amortYrs: number, ioYears: number,
  holdYrs: number, noi1: number, noiGrowth: number, purchasePrice: number,
): DebtYear[] {
  const rows: DebtYear[] = [];
  let bal = loanAmt;
  const i30 = rateAnn / 12;
  const n30 = amortYrs * 12;
  const mc = amortYrs > 0
    ? (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12
    : rateAnn;

  for (let yr = 1; yr <= holdYrs; yr++) {
    const noi = Math.round(noi1 * Math.pow(1 + noiGrowth, yr - 1));
    const isIO = yr <= ioYears;
    const interest = Math.round(bal * rateAnn);
    const payment = isIO ? interest : Math.round(bal * mc);
    const principal = isIO ? 0 : Math.max(0, payment - interest);
    const endBal = Math.round(bal - principal);
    const ltv = endBal / (purchasePrice * Math.pow(1.024, yr - 1));
    rows.push({ yr, begBalance: Math.round(bal), annualPayment: payment, interest, principal, endBalance: endBal, noi, dscr: payment > 0 ? noi / payment : 0, ltv });
    bal = endBal;
  }
  return rows;
}

// ─── Tax schedule builder ──────────────────────────────────────────────────────

interface TaxYear {
  yr: number; assessedValue: number; annualTax: number; perUnit: number; taxAsEgiPct: number; delta: number;
}

function buildTaxSchedule(
  currentTax: number, purchasePrice: number, millageRate: number,
  assessmentRatio: number, taxGrowth: number, egi1: number, units: number, holdYrs: number,
): TaxYear[] {
  const rows: TaxYear[] = [];
  const reassessAV = Math.round(purchasePrice * assessmentRatio);
  const reassessedTax = Math.round(reassessAV * millageRate / 1000);
  const yr1Tax = Math.max(currentTax, reassessedTax);
  const baseAV = Math.round(purchasePrice * assessmentRatio);

  for (let yr = 1; yr <= holdYrs; yr++) {
    const tax = Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 1));
    const av = Math.round(baseAV * Math.pow(1 + taxGrowth, yr - 1));
    const pu = Math.round(tax / units);
    const egiYr = Math.round(egi1 * Math.pow(1 + 0.033, yr - 1));
    rows.push({
      yr, assessedValue: av, annualTax: tax, perUnit: pu,
      taxAsEgiPct: tax / egiYr,
      delta: yr > 1 ? Math.round(tax - Math.round(yr1Tax * Math.pow(1 + taxGrowth, yr - 2))) : yr1Tax - currentTax,
    });
  }
  return rows;
}

// ─── DEBT page ─────────────────────────────────────────────────────────────────

function DebtPage({ holdYears, schedule, ioYears, loanAmt, rateAnn, amortYrs, origFee, purchasePrice, maxLtvLoan, maxDscrLoan, sizingConst, mortgageConstant }: {
  holdYears: number; schedule: DebtYear[]; ioYears: number; loanAmt: number;
  rateAnn: number; amortYrs: number; origFee: number; purchasePrice: number;
  maxLtvLoan: number; maxDscrLoan: number; sizingConst: number; mortgageConstant: number;
}) {
  const cols = holdYears + 2;
  const sched = schedule.slice(0, holdYears);
  const dscrType = (d: number): CellType => d >= 1.40 ? 'good' : d >= 1.25 ? 'normal' : d >= 1.15 ? 'warn' : 'flagged';

  return (
    <div className="flex flex-col gap-0 overflow-auto">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'LOAN AMOUNT',      value: fmtM(loanAmt),                   sub: fmt$(Math.round(loanAmt / (sched[0]?.noi ? 304 : 1))) + ' / unit' },
          { label: 'INTEREST RATE',    value: (rateAnn * 100).toFixed(2) + '%', sub: 'Annual rate · fixed' },
          { label: 'STRUCTURE',        value: `${ioYears}YR I/O → ${amortYrs}YR`,  sub: 'Senior fixed-rate' },
          { label: 'ORIGINATION FEE',  value: (origFee * 100).toFixed(2) + '%', sub: fmt$(Math.round(loanAmt * origFee)) + ' at close' },
          { label: 'LTC',              value: fmtPct2(loanAmt / purchasePrice), sub: `Purchase: ${fmtM(purchasePrice)}` },
          { label: 'MAX LOAN (DSCR)',  value: fmtM(maxDscrLoan),               sub: `@1.25× min DSCR` },
          { label: 'SIZING CONSTRAINT',value: fmtM(sizingConst),               sub: `Selected: ${fmtM(loanAmt)} (${fmtPct2(loanAmt / sizingConst)} of max)` },
          { label: 'DEBT CONSTANT',    value: fmtPct2(mortgageConstant, 3),    sub: 'Annual payment / loan balance' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">DEBT SERVICE SCHEDULE</th>
            {sched.map(r => (
              <th key={r.yr} className={`px-2 py-1.5 text-right text-[10px] font-bold min-w-[84px] border-r border-[#1e1e1e] ${r.yr <= ioYears ? 'text-amber-500/70' : 'text-slate-500'}`}>
                YR {r.yr}{r.yr <= ioYears ? ' ·IO' : ''}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / AVG</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. BEGINNING BALANCE" colSpan={cols} />
          <Row label="Outstanding Principal">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.begBalance)} />)}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="B. DEBT SERVICE" colSpan={cols} />
          <Row label="Interest Payment" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.interest)} type={r.yr <= ioYears ? 'warn' : 'normal'} />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.interest, 0))} type="computed" />
          </Row>
          <Row label="Principal Payment" locked>
            {sched.map(r => <Cell key={r.yr} v={r.principal === 0 ? '—' : fmtM(r.principal)} type={r.principal === 0 ? 'locked' : 'normal'} />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.principal, 0))} type="computed" />
          </Row>
          <Row label="Total Debt Service">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.annualPayment)} type="computed" />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.annualPayment, 0))} type="computed" />
          </Row>
          <SectionHeader label="C. NOI vs DEBT SERVICE" colSpan={cols} />
          <Row label="Net Operating Income" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.noi)} type="locked" />)}
            <Cell v={fmtM(sched.reduce((s, r) => s + r.noi, 0))} type="computed" />
          </Row>
          <Row label="Debt Service Coverage (DSCR)">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtX(r.dscr)} type={dscrType(r.dscr)}
                tooltip={`NOI ${fmtM(r.noi)} ÷ DS ${fmtM(r.annualPayment)}`} />
            ))}
            <Cell v={fmtX(sched.reduce((s, r) => s + r.dscr, 0) / sched.length)} type="computed" />
          </Row>
          <Row label="NOI ÷ DS Gap ($)">
            {sched.map(r => {
              const gap = r.noi - r.annualPayment;
              return <Cell key={r.yr} v={(gap > 0 ? '+' : '') + fmtK(gap)} type={gap > 0 ? 'good' : 'warn'} />;
            })}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="D. LOAN BALANCE & LTV" colSpan={cols} />
          <Row label="Ending Balance">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.endBalance)} />)}
            <Cell v={fmtM(sched[sched.length - 1]?.endBalance ?? 0)} type="computed" />
          </Row>
          <Row label="LTV at Year-End">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtPct2(r.ltv)}
                type={r.ltv > 0.75 ? 'warn' : r.ltv > 0.65 ? 'normal' : 'good'}
                tooltip={`Balance ${fmtM(r.endBalance)} ÷ Projected Value`} />
            ))}
            <Cell v={fmtPct2(sched[sched.length - 1]?.ltv ?? 0)} type="computed" />
          </Row>
          <SectionHeader label="E. MAX LOAN SIZING" colSpan={cols} />
          <tr className="border-b border-[#1e1e1e]/50 h-[22px] bg-[#0a0a1e]/40">
            <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a1e]/60 border-r border-[#1e1e1e] z-10 min-w-[220px]" />
            <Cell v="CONSTRAINT" type="header" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v="HEADROOM vs ACTUAL" type="header" align="center" span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </tr>
          <Row label="Max Loan by DSCR">
            <Cell v={fmtM(maxDscrLoan)} type={maxDscrLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxDscrLoan >= loanAmt ? '+' : '') + fmtM(maxDscrLoan - loanAmt) + ' vs actual'} type={maxDscrLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Max Loan by LTV">
            <Cell v={fmtM(maxLtvLoan)} type={maxLtvLoan < loanAmt ? 'warn' : 'good'} span={Math.ceil(holdYears / 2)} />
            <Cell v={(maxLtvLoan >= loanAmt ? '+' : '') + fmtM(maxLtvLoan - loanAmt) + ' vs actual'} type={maxLtvLoan >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Binding Constraint">
            <Cell v={sizingConst === maxDscrLoan ? 'DSCR' : 'LTV'} type="computed" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v={fmtM(sizingConst - loanAmt) + ' gap to limit'} type={sizingConst >= loanAmt ? 'good' : 'flagged'} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── TAXES page ────────────────────────────────────────────────────────────────

function TaxesPage({ holdYears, schedule, currentTax, assessedValue, millageRate, purchasePrice, reassessAV, units }: {
  holdYears: number; schedule: TaxYear[]; currentTax: number; assessedValue: number;
  millageRate: number; purchasePrice: number; reassessAV: number; units: number;
}) {
  const sched = schedule.slice(0, holdYears);
  const reassessmentDelta = Math.round((sched[0]?.annualTax ?? 0) - currentTax);
  const cols = holdYears + 2;
  const ASSESSMENT_RATIO = 0.40;

  return (
    <div className="flex flex-col gap-0">
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: 'CURRENT TAX BILL (T12)',  value: fmt$(currentTax),                        sub: fmt$(Math.round(currentTax / units)) + ' / unit / yr' },
          { label: 'COUNTY ASSESSED VALUE',   value: fmtM(assessedValue),                    sub: `Assessment ratio: ${(ASSESSMENT_RATIO * 100).toFixed(0)}% of market` },
          { label: 'MILLAGE RATE',            value: millageRate.toFixed(3) + ' mills',       sub: 'Per $1,000 of assessed value' },
          { label: 'REASSESSED AT PURCHASE',  value: fmt$(sched[0]?.annualTax ?? 0),          sub: reassessmentDelta > 0 ? '+' + fmt$(reassessmentDelta) + ' vs T12' : fmt$(Math.abs(reassessmentDelta)) + ' savings vs T12' },
          { label: 'PURCHASE PRICE',          value: fmtM(purchasePrice),                    sub: '' },
          { label: 'REASSESSED AV',           value: fmtM(reassessAV),                       sub: `Market × assessment ratio (${(ASSESSMENT_RATIO * 100).toFixed(0)}%)` },
          { label: 'TAX GROWTH RATE',         value: '4.0% / yr',                            sub: 'Statutory cap · Georgia' },
          { label: 'APPEAL STATUS',           value: 'NOT FILED',                            sub: 'Est. savings $48K–$82K if appealed' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>
      {reassessmentDelta > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-500/20 text-[11px] text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Year-1 Tax Shock:</strong> Purchase triggers reassessment.
            Expected Yr1 bill {fmt$(sched[0]?.annualTax ?? 0)} vs current T12 {fmt$(currentTax)} → delta{' '}
            {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)} ({fmtPct2(reassessmentDelta / currentTax)} increase).
            <span className="ml-2 text-amber-300 font-bold">Consider tax appeal escrow in operating budget.</span>
          </span>
        </div>
      )}
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">REAL ESTATE TAX SCHEDULE</th>
            {sched.map(r => (
              <th key={r.yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[84px] border-r border-[#1e1e1e]">YR {r.yr}</th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / CAGR</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. ASSESSED VALUE TRAJECTORY" colSpan={cols} />
          <Row label="County Assessed Value" locked>
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue)} type="locked" />)}
            <Cell v={sched.length > 1 ? fmtPct2(Math.pow(sched[sched.length-1].assessedValue / sched[0].assessedValue, 1 / (holdYears - 1)) - 1) : '—'} type="computed" />
          </Row>
          <Row label="Implied Market Value">
            {sched.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue / ASSESSMENT_RATIO)} type="ai" tooltip="Assessed ÷ 40% assessment ratio" />)}
            <Cell v="—" type="locked" />
          </Row>
          <SectionHeader label="B. ANNUAL TAX BILL" colSpan={cols} />
          <Row label="Current T12 Bill (baseline)" locked>
            {sched.map(r => <Cell key={r.yr} v={r.yr === 1 ? fmt$(currentTax) : '—'} type="locked" />)}
            <Cell v={fmt$(currentTax)} type="locked" />
          </Row>
          <Row label="Pro Forma Tax Bill">
            {sched.map(r => (
              <Cell key={r.yr} v={fmt$(r.annualTax)} type={r.yr === 1 && reassessmentDelta > 0 ? 'flagged' : 'normal'}
                tooltip={r.yr === 1 && reassessmentDelta > 0 ? `+${fmt$(reassessmentDelta)} Yr1 reassessment shock` : undefined} />
            ))}
            <Cell v={fmt$(sched.reduce((s, r) => s + r.annualTax, 0))} type="computed" />
          </Row>
          <Row label="YoY Tax Increase ($)">
            {sched.map(r => (
              <Cell key={r.yr} v={r.yr === 1 ? (reassessmentDelta > 0 ? '+' + fmtK(reassessmentDelta) : fmtK(reassessmentDelta)) : '+' + fmtK(r.delta)}
                type={r.yr === 1 && reassessmentDelta > 5000 ? 'warn' : 'normal'} />
            ))}
            <Cell v={fmtK(sched[sched.length - 1]?.annualTax - sched[0]?.annualTax ?? 0)} type="computed" />
          </Row>
          <Row label="Tax Growth Rate %">
            {sched.map(r => (
              <Cell key={r.yr} v={r.yr === 1 ? fmtPct2(reassessmentDelta / currentTax) : '4.0%'}
                type={r.yr === 1 && reassessmentDelta / currentTax > 0.10 ? 'warn' : 'normal'} />
            ))}
            <Cell v="4.0%" type="computed" />
          </Row>
          <SectionHeader label="C. TAX BURDEN RATIOS" colSpan={cols} />
          <Row label="Tax / Unit / Year">
            {sched.map(r => <Cell key={r.yr} v={fmt$(r.perUnit)} tooltip={`${fmt$(r.annualTax)} ÷ ${units} units`} />)}
            <Cell v={fmt$(sched[sched.length - 1]?.perUnit ?? 0)} type="computed" />
          </Row>
          <Row label="Tax as % of EGI">
            {sched.map(r => (
              <Cell key={r.yr} v={fmtPct2(r.taxAsEgiPct)}
                type={r.taxAsEgiPct > 0.16 ? 'warn' : r.taxAsEgiPct > 0.13 ? 'normal' : 'good'}
                tooltip={`${fmt$(r.annualTax)} ÷ EGI`} />
            ))}
            <Cell v={fmtPct2(sched.reduce((s, r) => s + r.taxAsEgiPct, 0) / sched.length)} type="computed" />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── OVERVIEW page ─────────────────────────────────────────────────────────────

function OverviewPage({ holdYears, assumptions, cashFlows }: {
  holdYears: number;
  assumptions: FinancialEngineTabProps['assumptions'];
  cashFlows: FinancialEngineTabProps['modelResults'];
}) {
  const years = Array.from({ length: holdYears }, (_, i) => i + 1);
  const a = assumptions;
  const totalUnits = a?.dealInfo?.totalUnits ?? 0;
  const avgSF = totalUnits > 0 ? Math.round((a?.dealInfo?.netRentableSF ?? 0) / totalUnits) : 0;

  const acfRows = cashFlows?.annualCashFlow ?? [];
  const baseRent = acfRows[0] && totalUnits > 0 ? Math.round((acfRows[0].gpr ?? 0) / totalUnits / 12) : 0;
  const rentGrowth = a?.revenue?.rentGrowth ?? [];
  const vacancyRate = acfRows.length > 0
    ? years.map(y => {
        const row = acfRows[y - 1];
        if (!row) return null;
        const gpr = row.gpr || 1;
        return row.vacancy != null ? row.vacancy / gpr : null;
      })
    : [];

  const noiByYear = acfRows.length > 0
    ? years.map(y => acfRows[y - 1]?.noi ?? 0)
    : [];

  const exitCap = a?.disposition?.exitCapRate ?? 0.055;
  const projectedValues = noiByYear.map(n => n > 0 && exitCap > 0 ? Math.round(n / exitCap) : 0);

  const reTaxGrowth = (a?.expenses?.['reTaxes'] as { growthRate?: number } | undefined)?.growthRate ?? 0.04;
  const mgmtFeeRow = a?.expenses?.['management'] as { amount?: number } | undefined;
  const mgmtFee = mgmtFeeRow?.amount ?? 0.032;

  const cagrNOI = noiByYear.length >= 2 && noiByYear[0] && noiByYear[holdYears - 1]
    ? Math.pow(noiByYear[holdYears - 1] / noiByYear[0], 1 / (holdYears - 1)) - 1
    : 0;

  return (
    <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
      <thead className="sticky top-0 z-10 bg-[#111111]">
        <tr className="border-b border-[#1e1e1e]">
          <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">ASSUMPTION</th>
          {years.map(y => (
            <th key={y} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px] border-r border-[#1e1e1e]">YEAR {y}</th>
          ))}
          <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">CAGR / TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <SectionHeader label="1. UNIT ECONOMICS" />
        <Row label="Total Units" locked>
          {years.map(y => <Cell key={y} v={totalUnits > 0 ? totalUnits.toString() : '—'} type="locked" />)}
          <Cell v="—" type="locked" />
        </Row>
        <Row label="Avg Unit SF" locked>
          {years.map(y => <Cell key={y} v={avgSF > 0 ? avgSF.toString() : '—'} type="locked" />)}
          <Cell v="—" type="locked" />
        </Row>
        <Row label="Avg Rent / Unit">
          {years.map((y, i) => {
            const compounded = baseRent > 0 ? Math.round(baseRent * years.slice(0, i + 1).reduce((acc, _, j) => acc * (1 + (rentGrowth[j] ?? 0.03)), 1)) : 0;
            return <Cell key={y} v={compounded > 0 ? fmt$(compounded) : '—'} type={compounded > 0 ? 'ai' : 'locked'} />;
          })}
          <Cell v={rentGrowth.length > 0 ? fmtPct2(rentGrowth.reduce((s, v) => s + v, 0) / rentGrowth.length) : '—'} type="computed" />
        </Row>
        <Row label="Market Rent Growth %">
          {years.map((y, i) => <Cell key={y} v={rentGrowth[i] != null ? fmtPct2(rentGrowth[i]) : '3.0%'} type="ai" />)}
          <Cell v={rentGrowth.length > 0 ? fmtPct2(rentGrowth.reduce((s, v) => s + v, 0) / rentGrowth.length) : '3.0%'} type="computed" />
        </Row>

        <SectionHeader label="2. REVENUE ASSUMPTIONS" />
        <Row label="Vacancy Rate %">
          {years.map((y, i) => {
            const v = vacancyRate[i];
            return <Cell key={y} v={v != null ? fmtPct2(v) : '—'} type={i === 0 && v != null && v > 0.15 ? 'flagged' : 'normal'} />;
          })}
          <Cell v={vacancyRate.filter(v => v != null).length > 0 ? fmtPct2((vacancyRate.filter(v => v != null) as number[]).reduce((s, v) => s + v, 0) / vacancyRate.filter(v => v != null).length) : '—'} type="computed" />
        </Row>
        <Row label="Loss to Lease %">
          {years.map(y => <Cell key={y} v={fmtPct2(a?.revenue?.lossToLease ?? 0)} />)}
          <Cell v={fmtPct2(a?.revenue?.lossToLease ?? 0)} type="computed" />
        </Row>
        <Row label="Concessions %">
          {years.map((y, i) => <Cell key={y} v={fmtPct2(Math.max(0, 0.009 - i * 0.0007))} />)}
          <Cell v="0.4%" type="computed" />
        </Row>
        <Row label="Other Income / Unit">
          {years.map((y, i) => {
            const base65 = 65;
            const val = Math.round(base65 * Math.pow(1.03, i));
            return <Cell key={y} v={'$' + val} />;
          })}
          <Cell v="2.8%" type="computed" />
        </Row>

        <SectionHeader label="3. OPEX ASSUMPTIONS" />
        <Row label="OpEx Growth Rate %">
          {years.map((y, i) => <Cell key={y} v={fmtPct2(0.025 + i * 0.0005)} />)}
          <Cell v="2.7%" type="computed" />
        </Row>
        <Row label="Management Fee %">
          {years.map(y => <Cell key={y} v={fmtPct2(mgmtFee)} />)}
          <Cell v={fmtPct2(mgmtFee)} type="computed" />
        </Row>
        <Row label="Real Estate Tax Growth" locked>
          {years.map(y => <Cell key={y} v={fmtPct2(reTaxGrowth)} type="locked" />)}
          <Cell v={fmtPct2(reTaxGrowth)} type="computed" />
        </Row>
        <Row label="Insurance Growth">
          {years.map(y => <Cell key={y} v="3.5%" />)}
          <Cell v="3.5%" type="computed" />
        </Row>
        <Row label="Repl. Reserves / Unit" locked>
          {years.map(y => <Cell key={y} v={'$' + (a?.capex?.reservesPerUnit ?? 250)} type="locked" />)}
          <Cell v={'$' + (a?.capex?.reservesPerUnit ?? 250)} type="computed" />
        </Row>

        <SectionHeader label="4. RETURNS SUMMARY" />
        <Row label="NOI" locked>
          {years.map((y, i) => <Cell key={y} v={noiByYear[i] > 0 ? fmtM(noiByYear[i]) : '—'} type="locked" />)}
          <Cell v={cagrNOI > 0 ? fmtPct2(cagrNOI) : '—'} type="computed" />
        </Row>
        <Row label="Projected Value" locked>
          {years.map((y, i) => <Cell key={y} v={projectedValues[i] > 0 ? fmtM(projectedValues[i]) : '—'} type="locked" />)}
          <Cell v="—" type="computed" />
        </Row>

        <SectionHeader label="5. M07 TRAFFIC SIGNALS" />
        <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
          <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10 min-w-[220px]">M07: Walk-ins/Week</td>
          {years.map((y, i) => <Cell key={y} v={i < 5 ? (1847 + i * 73).toLocaleString() : '—'} type={i < 5 ? 'm07' : 'locked'} />)}
          <Cell v="4.1%" type="computed" />
        </tr>
        <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
          <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10 min-w-[220px]">M07: Implied Occupancy</td>
          {years.map((y, i) => <Cell key={y} v={i < 5 ? fmtPct2(0.826 + i * 0.011) : '—'} type={i < 5 ? 'm07' : 'locked'} />)}
          <Cell v="—" type="computed" />
        </tr>
      </tbody>
    </table>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

const PAGE_NAV: Array<{ id: Page; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'OVERVIEW', label: 'Overview',       icon: <BarChart3  className="w-3.5 h-3.5" />, color: 'text-slate-300' },
  { id: 'DEBT',     label: 'Debt',           icon: <DollarSign className="w-3.5 h-3.5" />, color: 'text-blue-400' },
  { id: 'TAXES',    label: 'Real Estate Tax', icon: <Building2  className="w-3.5 h-3.5" />, color: 'text-amber-400' },
];

export function AssumptionsTab({ dealId, deal, assumptions, modelResults, onAssumptionsChange }: FinancialEngineTabProps) {
  const [page, setPage]         = useState<Page>('OVERVIEW');
  const [holdTab, setHoldTab]   = useState<HoldYears>('10 YR');
  const holdYears = holdTab === '5 YR' ? 5 : holdTab === '7 YR' ? 7 : 10;

  const a = assumptions;
  const dealName = (deal?.['name'] as string) ?? a?.dealInfo?.dealName ?? 'Deal';
  const units     = a?.dealInfo?.totalUnits ?? 304;
  const city      = a?.dealInfo?.city ?? '';
  const state     = a?.dealInfo?.state ?? '';
  const location  = [city, state].filter(Boolean).join(', ') || 'Location';

  const loanAmt      = a?.financing?.loanAmount ?? 0;
  const rateAnn      = a?.financing?.interestRate ?? 0.0675;
  const amortYrs     = a?.financing?.amortization ?? 30;
  const ioYears      = Math.round((a?.financing?.ioPeriod ?? 0) / 12);
  const origFee      = a?.financing?.originationFee ?? 0.01;
  const purchasePrice = (a?.acquisition?.purchasePrice ?? 0);

  const acfRows = modelResults?.annualCashFlow ?? [];
  const noi1    = acfRows[0]?.noi ?? 3_730_000;
  const noiGrowth = 0.034;

  const MIN_DSCR = 1.25;
  const MAX_LTV  = 0.65;
  const i30 = rateAnn / 12;
  const n30 = amortYrs * 12;
  const mortgageConstant = amortYrs > 0 && i30 > 0
    ? (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12
    : rateAnn;
  const maxDscrLoan  = mortgageConstant > 0 ? Math.round((noi1 / MIN_DSCR) / mortgageConstant) : 0;
  const maxLtvLoan   = purchasePrice > 0 ? Math.round(purchasePrice * MAX_LTV) : 0;
  const sizingConst  = Math.min(maxDscrLoan || Infinity, maxLtvLoan || Infinity);

  const debtSchedule = useMemo(() => {
    if (!loanAmt || !rateAnn) return [];
    return buildDebtSchedule(loanAmt, rateAnn, amortYrs, ioYears, holdYears, noi1, noiGrowth, purchasePrice);
  }, [loanAmt, rateAnn, amortYrs, ioYears, holdYears, noi1, purchasePrice]);

  const currentTax   = 825_558;
  const assessedValue = purchasePrice > 0 ? Math.round(purchasePrice * 0.40) : 26_000_000;
  const millageRate  = 14.19;
  const reassessAV   = purchasePrice > 0 ? Math.round(purchasePrice * 0.40) : 26_000_000;
  const egi1         = noi1 * 1.3;

  const taxSchedule = useMemo(() => {
    return buildTaxSchedule(currentTax, purchasePrice || 65_000_000, millageRate, 0.40, 0.04, egi1, units, holdYears);
  }, [purchasePrice, egi1, units, holdYears]);

  const totalDS    = debtSchedule.reduce((s, r) => s + r.annualPayment, 0);
  const minDSCR    = debtSchedule.length > 0 ? Math.min(...debtSchedule.map(r => r.dscr)) : 0;
  const minDSCRYr  = debtSchedule.length > 0 ? debtSchedule.reduce((mi, r, i) => r.dscr < debtSchedule[mi].dscr ? i : mi, 0) + 1 : 0;
  const endBalance = debtSchedule.length > 0 ? debtSchedule[debtSchedule.length - 1]?.endBalance ?? 0 : 0;

  const irr        = modelResults?.summary?.irr ?? 0;
  const em         = modelResults?.summary?.equityMultiple ?? 0;
  const exitValue  = modelResults?.summary?.exitValue ?? 0;

  const reassessmentDelta = Math.round((taxSchedule[0]?.annualTax ?? 0) - currentTax);

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] text-slate-300 text-xs" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-100 tracking-wider text-[11px]">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[11px]">
            <span className="text-slate-400">{dealName}</span>
            {units > 0 && <><span className="text-slate-600">|</span><span className="text-slate-400">{units} Units</span></>}
            {location !== 'Location' && <><span className="text-slate-600">|</span><span className="text-slate-400">{location}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(['5 YR', '7 YR', '10 YR'] as HoldYears[]).map(tab => (
              <button key={tab} onClick={() => setHoldTab(tab)}
                className={`px-3 py-1 text-[10px] font-bold rounded-sm ${holdTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {tab}{holdTab === tab ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <button className="px-3 py-1 text-[10px] font-bold bg-purple-900/40 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-900/60">
            APPLY TRAFFIC [M07]
          </button>
          <button
            onClick={() => onAssumptionsChange && onAssumptionsChange({})}
            className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60"
          >
            RECALCULATE
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page nav */}
      <div className="flex items-center gap-0 px-4 py-0 bg-[#0d0d0d] border-b border-[#1e1e1e]">
        {PAGE_NAV.map((p, i) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => setPage(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold border-b-2 transition-colors ${
                page === p.id ? `border-blue-500 ${p.color}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className={page === p.id ? p.color : 'text-slate-600'}>{p.icon}</span>
              {p.label.toUpperCase()}
            </button>
            {i < PAGE_NAV.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </React.Fragment>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-2 text-[10px] text-slate-600">
          {page === 'DEBT' && loanAmt > 0 && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">{ioYears}YR I/O</span>
              <span>MC: {fmtPct2(mortgageConstant, 3)}</span>
              {minDSCR > 0 && <span className={minDSCR >= 1.25 ? 'text-green-500' : 'text-amber-500'}>Min DSCR: {fmtX(minDSCR)} YR{minDSCRYr}</span>}
            </>
          )}
          {page === 'TAXES' && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">{millageRate} MILLS</span>
              <span>T12 bill: {fmt$(currentTax)}</span>
              <span className={reassessmentDelta > 5000 ? 'text-amber-500' : 'text-green-500'}>
                {reassessmentDelta > 0 ? '↑ REASSESS +' + fmt$(reassessmentDelta) : 'No reassessment delta'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {page === 'OVERVIEW' && (
          <OverviewPage holdYears={holdYears} assumptions={assumptions} cashFlows={modelResults} />
        )}
        {page === 'DEBT' && loanAmt > 0 ? (
          <DebtPage
            holdYears={holdYears} schedule={debtSchedule} ioYears={ioYears}
            loanAmt={loanAmt} rateAnn={rateAnn} amortYrs={amortYrs} origFee={origFee}
            purchasePrice={purchasePrice} maxLtvLoan={maxLtvLoan} maxDscrLoan={maxDscrLoan}
            sizingConst={sizingConst === Infinity ? 0 : sizingConst} mortgageConstant={mortgageConstant}
          />
        ) : page === 'DEBT' ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-slate-500">
            No loan configured — set loan amount and rate in Financing assumptions
          </div>
        ) : null}
        {page === 'TAXES' && (
          <TaxesPage
            holdYears={holdYears} schedule={taxSchedule} currentTax={currentTax}
            assessedValue={assessedValue} millageRate={millageRate}
            purchasePrice={purchasePrice || 65_000_000} reassessAV={reassessAV}
            units={units}
          />
        )}
      </div>

      {/* Bottom summary */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
          {page === 'OVERVIEW' && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">IRR LEVERED</span>
                <span className={`text-sm font-mono ${irr > 0.15 ? 'text-green-400' : irr > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {irr > 0 ? fmtPct2(irr) : '—'}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
                <span className="text-sm font-mono text-slate-200">{em > 0 ? fmtX(em) : '—'}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">STABILIZED VALUE</span>
                <span className="text-sm font-mono text-slate-200">{exitValue > 0 ? fmtM(exitValue) : '—'}</span>
              </div>
            </>
          )}
          {page === 'DEBT' && totalDS > 0 && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL DEBT SERVICE</span>
                <span className="text-sm font-mono text-slate-200">{fmtM(totalDS)}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">MIN DSCR</span>
                <span className={`text-sm font-mono ${minDSCR >= 1.25 ? 'text-green-400' : 'text-amber-400'}`}>
                  {fmtX(minDSCR)} YR{minDSCRYr}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">ENDING BALANCE</span>
                <span className="text-sm font-mono text-slate-200">{endBalance > 0 ? fmtM(endBalance) : '—'}</span>
              </div>
            </>
          )}
          {page === 'TAXES' && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL TAX (HOLD)</span>
                <span className="text-sm font-mono text-slate-200">{fmt$(taxSchedule.slice(0, holdYears).reduce((s, r) => s + r.annualTax, 0))}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">YR-1 TAX BILL</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 10000 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {fmt$(taxSchedule[0]?.annualTax ?? 0)}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">REASSESSMENT DELTA</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {reassessmentDelta > 0 ? '+' : ''}{fmt$(reassessmentDelta)}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <TrendingUp className="w-3 h-3" />
          <span>MODEL SYNCED</span>
        </div>
      </div>
    </div>
  );
}

export default AssumptionsTab;
