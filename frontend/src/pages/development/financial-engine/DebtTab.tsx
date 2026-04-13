import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, LoanOption } from './types';
import { fmt$, fmtPct } from './types';

const MONO = BT.font.mono;

interface LoanConfig extends LoanOption {
  active: boolean;
  customAmount: string;
}

interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  isIO: boolean;
}

interface AnnualDebtRow {
  year: number;
  openBalance: number;
  annualInterest: number;
  annualPrincipal: number;
  annualPayment: number;
  closeBalance: number;
  dscr: number | null;
  debtYield: number | null;
}

function buildAmortSchedule(loan: LoanConfig, loanAmt: number): AmortRow[] {
  const rows: AmortRow[] = [];
  const monthlyRate = loan.rate / 12;
  const totalMonths = loan.term * 12;
  const amortMonths = loan.amortization * 12;
  let balance = loanAmt;

  for (let m = 1; m <= Math.min(totalMonths, 120); m++) {
    const isIO = m <= loan.ioPeriod;
    const interest = balance * monthlyRate;
    let principal = 0;
    let payment = interest;

    if (!isIO && amortMonths > 0) {
      payment = (loanAmt * monthlyRate * Math.pow(1 + monthlyRate, amortMonths))
              / (Math.pow(1 + monthlyRate, amortMonths) - 1);
      principal = payment - interest;
    }

    balance = Math.max(0, balance - principal);
    rows.push({ month: m, payment, interest, principal, balance, isIO });
  }
  return rows;
}

function buildAnnualDebt(amortRows: AmortRow[], noi_y1: number, rentGrowth: number): AnnualDebtRow[] {
  const annual: AnnualDebtRow[] = [];
  const years = Math.ceil(amortRows.length / 12);
  for (let y = 1; y <= years; y++) {
    const monthRows = amortRows.slice((y - 1) * 12, y * 12);
    if (monthRows.length === 0) break;
    const openBalance    = monthRows[0].balance + monthRows[0].principal;
    const closeBalance   = monthRows[monthRows.length - 1].balance;
    const annualInterest = monthRows.reduce((s, r) => s + r.interest, 0);
    const annualPrincipal = monthRows.reduce((s, r) => s + r.principal, 0);
    const annualPayment   = monthRows.reduce((s, r) => s + r.payment, 0);
    const noi = noi_y1 * Math.pow(1 + rentGrowth, y - 1);
    const dscr = annualPayment > 0 ? noi / annualPayment : null;
    const debtYield = openBalance > 0 ? noi / openBalance : null;
    annual.push({ year: y, openBalance, annualInterest, annualPrincipal, annualPayment, closeBalance, dscr, debtYield });
  }
  return annual;
}

const LOAN_PRESETS: Omit<LoanConfig, 'active' | 'customAmount'>[] = [
  { id: 'bridge',   name: 'Bridge Loan',     type: 'Bridge',        amount: 0, rate: 0.085, spread: 0.035, term: 3,  amortization: 0,  ioPeriod: 36, originationFee: 0.015, rateCapCost: 0.005, prepayPenalty: 0.01, loanType: 'Floating', source: 'platform' },
  { id: 'agency',   name: 'Agency (F/N/MAC)',  type: 'Agency',        amount: 0, rate: 0.055, spread: 0,     term: 10, amortization: 30, ioPeriod: 0,  originationFee: 0.01,  rateCapCost: 0,     prepayPenalty: 0.01, loanType: 'Fixed',    source: 'platform' },
  { id: 'cmbs',     name: 'CMBS',            type: 'CMBS',          amount: 0, rate: 0.065, spread: 0,     term: 10, amortization: 30, ioPeriod: 24, originationFee: 0.01,  rateCapCost: 0,     prepayPenalty: 0.02, loanType: 'Fixed',    source: 'platform' },
  { id: 'life_co',  name: 'Life Co.',        type: 'Life Company',  amount: 0, rate: 0.048, spread: 0,     term: 15, amortization: 30, ioPeriod: 0,  originationFee: 0.005, rateCapCost: 0,     prepayPenalty: 0.03, loanType: 'Fixed',    source: 'platform' },
  { id: 'construg', name: 'Construction',    type: 'Construction',  amount: 0, rate: 0.080, spread: 0.030, term: 3,  amortization: 0,  ioPeriod: 36, originationFee: 0.015, rateCapCost: 0.005, prepayPenalty: 0.00, loanType: 'Floating', source: 'platform' },
];

export function DebtTab({ dealId, deal, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const baseLoanAmt = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? (typeof deal?.purchase_price === 'number' ? (deal.purchase_price as number) * 0.65 : 0);

  const f9Ltv  = f9Financials?.capitalStack?.ltcPct ?? null;
  const f9Rate = f9Financials?.capitalStack?.interestRate ?? null;
  const f9IO   = f9Financials?.capitalStack?.ioPeriodMonths ?? null;
  const f9DSCR = f9Financials?.capitalStack?.dscrMin ?? null;
  const f9PP   = f9Financials?.capitalStack?.purchasePrice ?? null;

  const f9Noi = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? null;
  const noi_y1 = f9Noi ?? modelResults?.summary?.noi ?? 0;
  const rentGrowth = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const holdYears  = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;

  const [loans, setLoans] = useState<LoanConfig[]>(
    LOAN_PRESETS.map(p => ({ ...p, amount: baseLoanAmt, active: p.id === 'bridge', customAmount: '' }))
  );
  const [selectedId, setSelectedId] = useState<string>('bridge');
  const [showAmort, setShowAmort] = useState(false);
  const [showAnnual, setShowAnnual] = useState(true);
  const [view, setView] = useState<'compare' | 'detail'>('compare');

  const selectedLoan = loans.find(l => l.id === selectedId) ?? loans[0];
  const activeLoan   = loans.find(l => l.active) ?? selectedLoan;

  const loanAmt = (customAmt: string, fallback: number) => {
    const v = parseFloat(customAmt);
    return isNaN(v) ? fallback : v;
  };

  const amortSchedule  = useMemo(() => buildAmortSchedule(selectedLoan, loanAmt(selectedLoan.customAmount, baseLoanAmt)), [selectedLoan, baseLoanAmt]);
  const annualDebtRows = useMemo(() => buildAnnualDebt(amortSchedule, noi_y1, rentGrowth), [amortSchedule, noi_y1, rentGrowth]);

  const dscrColor = (v: number | null) => {
    if (v == null) return BT.text.muted;
    if (v >= 1.35) return BT.met.financial;
    if (v >= 1.20) return BT.text.amber;
    return BT.text.red;
  };

  const ltvColor = (v: number | null) => {
    if (v == null) return BT.text.muted;
    if (v <= 0.60) return BT.met.financial;
    if (v <= 0.70) return BT.text.amber;
    return BT.text.red;
  };

  const toggleActive = (id: string) => {
    setLoans(prev => prev.map(l => ({ ...l, active: l.id === id })));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>MULTI-LOAN STACK · SELECT ACTIVE · PER-YEAR DSCR</span>
        <Bd c={BT.text.cyan}>ACTIVE: {activeLoan.name.toUpperCase()}</Bd>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['compare', 'detail'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              background: view === v ? `${BT.text.cyan}20` : 'transparent',
              border: `1px solid ${view === v ? BT.text.cyan : BT.border.medium}`,
              color: view === v ? BT.text.cyan : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2, textTransform: 'uppercase',
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* F9 signal bar */}
      {(f9Ltv != null || f9Rate != null || baseLoanAmt > 0) && (
        <div style={{ padding: '4px 10px', background: `${BT.met.financial}08`, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>F9 CAPITAL STACK ▸</span>
          {baseLoanAmt > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial }}>LOAN {fmt$(baseLoanAmt)}</span>}
          {f9Ltv  != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan   }}>LTC {fmtPct(f9Ltv * 100)}</span>}
          {f9Rate != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber  }}>RATE {fmtPct(f9Rate * 100)}</span>}
          {f9IO   != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.orange }}>IO {f9IO}mo</span>}
          {f9DSCR != null && <span style={{ fontFamily: MONO, fontSize: 9, color: dscrColor(f9DSCR) }}>DSCR {f9DSCR.toFixed(2)}×</span>}
          {f9PP   != null && baseLoanAmt > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: ltvColor(baseLoanAmt / f9PP) }}>LTV {fmtPct((baseLoanAmt / f9PP) * 100)}</span>}
        </div>
      )}

      {/* Loan comparison grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9, width: '100%', minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
              <th style={{ padding: '4px 8px', color: BT.text.muted, textAlign: 'left', fontWeight: 500, minWidth: 130 }}>METRIC</th>
              {loans.map(l => (
                <th key={l.id} style={{ padding: '4px 8px', textAlign: 'center', minWidth: 140 }}>
                  <div
                    onClick={() => { setSelectedId(l.id); }}
                    style={{
                      cursor: 'pointer', padding: '3px 6px', borderRadius: 2,
                      background: l.id === selectedId ? `${BT.met.financial}15` : 'transparent',
                      border: `1px solid ${l.id === selectedId ? BT.met.financial : BT.border.subtle}`,
                    }}
                  >
                    <div style={{ color: l.id === selectedId ? BT.met.financial : BT.text.primary, fontWeight: 700, fontSize: 9 }}>{l.name.toUpperCase()}</div>
                    <div style={{ color: l.active ? BT.text.cyan : BT.text.muted, fontSize: 8 }}>
                      {l.active ? '● ACTIVE' : '○ compare'}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'type',     label: 'TYPE',           fmt: (l: LoanConfig) => l.type,                                      color: (_: LoanConfig) => BT.text.secondary },
              { key: 'loanType', label: 'RATE TYPE',      fmt: (l: LoanConfig) => l.loanType,                                  color: (l: LoanConfig) => l.loanType === 'Floating' ? BT.text.amber : BT.met.financial },
              { key: 'amount',   label: 'LOAN AMOUNT',    fmt: (l: LoanConfig) => fmt$(loanAmt(l.customAmount, baseLoanAmt)),   color: (_: LoanConfig) => BT.text.cyan },
              { key: 'rate',     label: 'INTEREST RATE',  fmt: (l: LoanConfig) => fmtPct(l.rate * 100),                        color: (l: LoanConfig) => l.loanType === 'Floating' ? BT.text.amber : BT.met.financial },
              { key: 'spread',   label: 'SPREAD (FLOAT)', fmt: (l: LoanConfig) => l.spread > 0 ? `+${fmtPct(l.spread * 100)} over SOFR` : '—', color: (_: LoanConfig) => BT.text.secondary },
              { key: 'term',     label: 'TERM',           fmt: (l: LoanConfig) => `${l.term} years`,                           color: (_: LoanConfig) => BT.text.secondary },
              { key: 'amort',    label: 'AMORTIZATION',   fmt: (l: LoanConfig) => l.amortization > 0 ? `${l.amortization}yr` : 'IO only', color: (_: LoanConfig) => BT.text.secondary },
              { key: 'io',       label: 'IO PERIOD',      fmt: (l: LoanConfig) => l.ioPeriod > 0 ? `${l.ioPeriod} months` : '—', color: (l: LoanConfig) => l.ioPeriod > 0 ? BT.text.amber : BT.text.muted },
              { key: 'origFee',  label: 'ORIGINATION FEE', fmt: (l: LoanConfig) => fmtPct(l.originationFee * 100),             color: (_: LoanConfig) => BT.text.secondary },
              { key: 'rateCap',  label: 'RATE CAP COST',  fmt: (l: LoanConfig) => l.rateCapCost > 0 ? fmtPct(l.rateCapCost * 100) : '—', color: (_: LoanConfig) => BT.text.amber },
              { key: 'prepay',   label: 'PREPAY PENALTY', fmt: (l: LoanConfig) => fmtPct(l.prepayPenalty * 100),               color: (_: LoanConfig) => BT.text.red },
              { key: 'annualDS', label: 'ANNUAL DEBT SVC', fmt: (l: LoanConfig) => fmt$(loanAmt(l.customAmount, baseLoanAmt) * l.rate), color: (_: LoanConfig) => BT.text.red },
              { key: 'ltv',      label: 'LTV',            fmt: (l: LoanConfig) => f9PP != null && f9PP > 0 ? fmtPct((loanAmt(l.customAmount, baseLoanAmt) / f9PP) * 100) : '—', color: (l: LoanConfig) => ltvColor(f9PP != null && f9PP > 0 ? loanAmt(l.customAmount, baseLoanAmt) / f9PP : null) },
              { key: 'dscr',     label: 'DSCR (Y1 DERIV)', fmt: (l: LoanConfig) => { const ds = loanAmt(l.customAmount, baseLoanAmt) * l.rate; return noi_y1 > 0 && ds > 0 ? `${(noi_y1 / ds).toFixed(2)}×` : '—'; }, color: (l: LoanConfig) => { const ds = loanAmt(l.customAmount, baseLoanAmt) * l.rate; return dscrColor(noi_y1 > 0 && ds > 0 ? noi_y1 / ds : null); } },
              { key: 'debtYld',  label: 'DEBT YIELD',     fmt: (l: LoanConfig) => { const la = loanAmt(l.customAmount, baseLoanAmt); return noi_y1 > 0 && la > 0 ? fmtPct((noi_y1 / la) * 100) : '—'; }, color: (_: LoanConfig) => BT.text.amber },
            ].map((row, ri) => (
              <tr key={row.key} style={{ background: ri % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                <td style={{ padding: '3px 8px', color: BT.text.muted }}>{row.label}</td>
                {loans.map(l => (
                  <td key={l.id} style={{ padding: '3px 8px', textAlign: 'center', color: row.color(l), fontWeight: l.active ? 600 : 400 }}>
                    {row.fmt(l)}
                  </td>
                ))}
              </tr>
            ))}
            {/* Set active row */}
            <tr style={{ background: `${BT.text.cyan}08`, borderTop: `2px solid ${BT.border.medium}` }}>
              <td style={{ padding: '4px 8px', color: BT.text.muted, fontSize: 8 }}>SET ACTIVE</td>
              {loans.map(l => (
                <td key={l.id} style={{ padding: '4px 8px', textAlign: 'center' }}>
                  <button onClick={() => toggleActive(l.id)} style={{
                    background: l.active ? `${BT.text.cyan}20` : 'transparent',
                    border: `1px solid ${l.active ? BT.text.cyan : BT.border.medium}`,
                    color: l.active ? BT.text.cyan : BT.text.muted,
                    fontFamily: MONO, fontSize: 8, padding: '2px 10px', cursor: 'pointer', borderRadius: 2,
                  }}>{l.active ? 'ACTIVE ●' : 'SELECT'}</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-year DSCR grid */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>ANNUAL DEBT SERVICE — {selectedLoan.name.toUpperCase()}</span>
          <Bd c={BT.text.cyan}>SELECTED</Bd>
        </div>
        <button onClick={() => setShowAnnual(!showAnnual)} style={{
          background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
          fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
        }}>{showAnnual ? 'HIDE' : 'SHOW'}</button>
      </div>

      {showAnnual && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                {['YEAR', 'OPEN BALANCE', 'INTEREST', 'PRINCIPAL', 'DEBT SERVICE', 'CLOSE BALANCE', 'NOI', 'DSCR', 'DEBT YIELD'].map(h => (
                  <th key={h} style={{ padding: '4px 8px', color: BT.text.muted, textAlign: h === 'YEAR' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annualDebtRows.filter(r => r.year <= holdYears).map((row, i) => {
                const noi = noi_y1 * Math.pow(1 + rentGrowth, i);
                return (
                  <tr key={row.year} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '3px 8px', color: BT.text.secondary }}>Y{row.year}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.openBalance)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.annualInterest)}</td>
                    <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.annualPrincipal)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.red, textAlign: 'right', fontWeight: 700 }}>{fmt$(row.annualPayment)}</td>
                    <td style={{ padding: '3px 8px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.closeBalance)}</td>
                    <td style={{ padding: '3px 8px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(noi)}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', color: dscrColor(row.dscr), fontWeight: 700 }}>{row.dscr != null ? `${row.dscr.toFixed(2)}×` : '—'}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', color: BT.text.amber }}>{row.debtYield != null ? fmtPct(row.debtYield * 100) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Covenants */}
      <SectionPanel title="LOAN COVENANTS & TESTS" subtitle="Lender underwriting thresholds" borderColor={BT.text.amber}>
        {(() => {
          const ds = loanAmt(selectedLoan.customAmount, baseLoanAmt) * selectedLoan.rate;
          const dscrY1 = noi_y1 > 0 && ds > 0 ? noi_y1 / ds : null;
          const ltv = f9PP != null && f9PP > 0 ? loanAmt(selectedLoan.customAmount, baseLoanAmt) / f9PP : null;
          const debtYield = loanAmt(selectedLoan.customAmount, baseLoanAmt) > 0 ? noi_y1 / loanAmt(selectedLoan.customAmount, baseLoanAmt) : null;
          const DSCR_MIN = selectedLoan.type === 'Agency' ? 1.25 : selectedLoan.type === 'Bridge' ? 1.15 : 1.20;
          const LTV_MAX  = selectedLoan.type === 'Agency' ? 0.75 : selectedLoan.type === 'Bridge' ? 0.80 : 0.70;
          const DY_MIN   = 0.07;
          return (
            <>
              <DataRow label="DSCR COVENANT" value={`Min ${DSCR_MIN.toFixed(2)}×`} valueColor={BT.text.muted} sub={selectedLoan.type} />
              <DataRow label="DSCR (DERIVED Y1)" value={dscrY1 != null ? `${dscrY1.toFixed(2)}×` : '—'} valueColor={dscrColor(dscrY1)} sub={dscrY1 != null ? (dscrY1 >= DSCR_MIN ? '✓ PASSES' : '✗ FAILS covenant') : undefined} />
              <DataRow label="MAX LTV COVENANT" value={fmtPct(LTV_MAX * 100)} valueColor={BT.text.muted} />
              <DataRow label="LTV (DERIVED)" value={ltv != null ? fmtPct(ltv * 100) : '—'} valueColor={ltvColor(ltv)} sub={ltv != null ? (ltv <= LTV_MAX ? '✓ PASSES' : '✗ FAILS covenant') : undefined} />
              <DataRow label="MIN DEBT YIELD" value={fmtPct(DY_MIN * 100)} valueColor={BT.text.muted} />
              <DataRow label="DEBT YIELD (DERIVED)" value={debtYield != null ? fmtPct(debtYield * 100) : '—'} valueColor={debtYield != null ? (debtYield >= DY_MIN ? BT.met.financial : BT.text.red) : BT.text.muted} sub={debtYield != null ? (debtYield >= DY_MIN ? '✓ PASSES' : '✗ FAILS covenant') : undefined} border={false} />
            </>
          );
        })()}
      </SectionPanel>

      {/* Amortization schedule toggle */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>MONTHLY AMORT SCHEDULE — {selectedLoan.name.toUpperCase()}</span>
        <button onClick={() => setShowAmort(!showAmort)} style={{
          background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
          fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
        }}>{showAmort ? 'HIDE' : 'SHOW'} SCHEDULE</button>
      </div>

      {showAmort && (
        <div style={{ overflowX: 'auto', maxHeight: 400 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BT.border.medium}`, position: 'sticky', top: 0, background: BT.bg.header }}>
                {['MONTH', 'PAYMENT', 'INTEREST', 'PRINCIPAL', 'BALANCE', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '4px 6px', color: BT.text.muted, textAlign: h === 'MONTH' || h === 'STATUS' ? 'left' : 'right', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amortSchedule.map((row, i) => {
                const isTransition = i > 0 && row.isIO !== amortSchedule[i - 1].isIO;
                return (
                  <tr key={row.month} style={{
                    background: isTransition ? `${BT.text.amber}15` : i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                    borderBottom: isTransition ? `2px solid ${BT.text.amber}` : `1px solid ${BT.border.subtle}`,
                  }}>
                    <td style={{ padding: '2px 6px', color: BT.text.secondary }}>{row.month}</td>
                    <td style={{ padding: '2px 6px', color: BT.text.primary, textAlign: 'right' }}>{fmt$(row.payment)}</td>
                    <td style={{ padding: '2px 6px', color: BT.text.red, textAlign: 'right' }}>{fmt$(row.interest)}</td>
                    <td style={{ padding: '2px 6px', color: BT.met.financial, textAlign: 'right' }}>{fmt$(row.principal)}</td>
                    <td style={{ padding: '2px 6px', color: BT.text.cyan, textAlign: 'right' }}>{fmt$(row.balance)}</td>
                    <td style={{ padding: '2px 6px' }}>
                      {row.isIO ? <Bd c={BT.text.amber}>IO</Bd> : <Bd c={BT.met.financial}>AMORT</Bd>}
                      {isTransition && <span style={{ marginLeft: 4, fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>← TRANSITION</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DebtTab;
