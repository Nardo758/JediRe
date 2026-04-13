import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps, LoanOption } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

const DEFAULT_LOANS: LoanOption[] = [
  { id: 'bridge', name: 'Bridge', type: 'Bridge', amount: 0, rate: 0.085, spread: 0.035, term: 3, amortization: 0, ioPeriod: 36, originationFee: 0.015, rateCapCost: 0, prepayPenalty: 0.01, loanType: 'Floating', source: 'platform' },
  { id: 'agency', name: 'Agency', type: 'Agency', amount: 0, rate: 0.055, spread: 0, term: 10, amortization: 30, ioPeriod: 0, originationFee: 0.01, rateCapCost: 0, prepayPenalty: 0.01, loanType: 'Fixed', source: 'platform' },
  { id: 'cmbs', name: 'CMBS', type: 'CMBS', amount: 0, rate: 0.065, spread: 0, term: 10, amortization: 30, ioPeriod: 24, originationFee: 0.01, rateCapCost: 0, prepayPenalty: 0.02, loanType: 'Fixed', source: 'platform' },
];

interface AmortRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
  isIO: boolean;
}

function buildAmortSchedule(loan: LoanOption, loanAmt: number): AmortRow[] {
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
      payment = (loanAmt * monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1);
      principal = payment - interest;
    }

    balance = Math.max(0, balance - principal);
    rows.push({ month: m, payment, interest, principal, balance, isIO });
  }

  return rows;
}

export function DebtTab({ dealId, deal, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('bridge');
  const [showAmort, setShowAmort] = useState(false);

  // F8 wiring: prefer F9 engine capital stack for loan amount
  const loanAmt = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? (typeof deal?.purchase_price === 'number' ? (deal.purchase_price as number) * 0.65 : 0);
  const f9Ltv = f9Financials?.capitalStack?.ltcPct ?? null;
  const f9Rate = f9Financials?.capitalStack?.interestRate ?? null;

  const loans = useMemo(() => {
    return DEFAULT_LOANS.map(l => ({ ...l, amount: loanAmt }));
  }, [loanAmt]);

  const selectedLoan = loans.find(l => l.id === selectedLoanId) ?? loans[0];
  const amortSchedule = useMemo(() => buildAmortSchedule(selectedLoan, loanAmt), [selectedLoan, loanAmt]);

  const annualDS = (amt: number, rate: number) => amt * rate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>MULTI-LOAN COMPARISON · CLICK TO SELECT</span>
        <Bd c={BT.text.cyan}>ACTIVE: {selectedLoan.name.toUpperCase()}</Bd>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${loans.length}, 1fr)`, gap: 1, background: BT.border.subtle, padding: 1 }}>
        {loans.map(loan => {
          const isSelected = loan.id === selectedLoanId;
          const ds = annualDS(loan.amount, loan.rate);
          return (
            <div
              key={loan.id}
              onClick={() => setSelectedLoanId(loan.id)}
              style={{
                background: isSelected ? `${BT.met.financial}10` : BT.bg.panel,
                border: isSelected ? `1px solid ${BT.met.financial}40` : `1px solid transparent`,
                cursor: 'pointer', padding: 0,
              }}
            >
              <div style={{
                padding: '6px 8px', borderBottom: `2px solid ${isSelected ? BT.met.financial : BT.border.subtle}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: isSelected ? BT.met.financial : BT.text.primary, fontWeight: 700 }}>
                  {loan.name.toUpperCase()}
                </span>
                {isSelected && <Bd c={BT.met.financial}>SELECTED</Bd>}
              </div>
              <DataRow label="TYPE" value={loan.type} valueColor={BT.text.secondary} />
              <DataRow label="AMOUNT" value={fmt$(loan.amount)} valueColor={BT.text.cyan} />
              <DataRow label="RATE" value={fmtPct(loan.rate * 100)} valueColor={loan.loanType === 'Floating' ? BT.text.amber : BT.met.financial} />
              <DataRow label="TERM" value={`${loan.term} yr`} valueColor={BT.text.secondary} />
              <DataRow label="AMORTIZATION" value={loan.amortization > 0 ? `${loan.amortization} yr` : 'IO ONLY'} valueColor={BT.text.secondary} />
              <DataRow label="IO PERIOD" value={loan.ioPeriod > 0 ? `${loan.ioPeriod} mo` : '—'} valueColor={loan.ioPeriod > 0 ? BT.text.amber : BT.text.muted} />
              <DataRow label="RATE TYPE" value={loan.loanType} valueColor={loan.loanType === 'Floating' ? BT.text.amber : BT.met.financial} />
              <DataRow label="ANNUAL DS" value={fmt$(ds)} valueColor={BT.text.red} />
              <DataRow label="ORIGINATION" value={fmtPct(loan.originationFee * 100)} valueColor={BT.text.secondary} border={false} />
            </div>
          );
        })}
      </div>

      {/* F8 wiring: F9 capital stack signal row */}
      {(f9Ltv != null || f9Rate != null || loanAmt > 0) && (
        <div style={{ padding: '4px 10px', background: `${BT.met.financial}08`, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5 }}>F9 CAPITAL STACK ▸</span>
          {loanAmt > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.met.financial }}>LOAN {fmt$(loanAmt)}</span>}
          {f9Ltv != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>LTC {fmtPct(f9Ltv * 100)}</span>}
          {f9Rate != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>RATE {fmtPct(f9Rate * 100)}</span>}
        </div>
      )}

      <div style={{ padding: '6px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>AMORTIZATION SCHEDULE</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>{selectedLoan.name}</span>
        </div>
        <button onClick={() => setShowAmort(!showAmort)} style={{
          background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
          fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
        }}>{showAmort ? 'HIDE' : 'SHOW'} SCHEDULE</button>
      </div>

      {/* F8 wiring: F9 debt metrics — DSCR, debt yield, LTV, implied cap */}
      {f9Financials && (() => {
        const noi    = f9Financials.proforma.year1.find(r => r.field === 'noi')?.resolved ?? null;
        const pp     = f9Financials.capitalStack.purchasePrice;
        const loan   = f9Financials.capitalStack.loanAmount;
        const dscr   = f9Financials.capitalStack.dscrMin;
        const ltv    = f9Financials.capitalStack.ltcPct;
        const debtYield = noi != null && loan != null && loan > 0 ? noi / loan : null;
        const impliedCap = noi != null && pp != null && pp > 0 ? noi / pp : null;
        return (
          <div style={{ padding: '6px 10px', background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, letterSpacing: 0.5, marginBottom: 4 }}>F9 DEBT METRICS · M07 CALIBRATED</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {dscr != null && <span style={{ fontFamily: MONO, fontSize: 9, color: dscr >= 1.25 ? BT.met.financial : BT.text.red }}>DSCR {dscr.toFixed(2)}×</span>}
              {ltv != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.cyan }}>LTV {fmtPct(ltv * 100)}</span>}
              {debtYield != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.amber }}>DEBT YIELD {fmtPct(debtYield * 100)}</span>}
              {impliedCap != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>IMPLIED CAP {fmtPct(impliedCap * 100)}</span>}
              {noi != null && <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>NOI {fmt$(noi)}</span>}
            </div>
          </div>
        );
      })()}

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
