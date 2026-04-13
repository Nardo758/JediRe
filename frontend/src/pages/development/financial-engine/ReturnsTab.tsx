import React, { useState, useMemo } from 'react';
import { BT } from '../../../components/deal/bloomberg-ui';
import { SectionPanel, DataRow, Bd, KpiTile } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct, fmtX } from './types';

const MONO = BT.font.mono;

interface SensCell { irr: number | null; em: number | null }

function computeIRR(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;
  let lo = -0.999, hi = 10.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const npv = cashFlows.reduce((s, cf, t) => s + cf / Math.pow(1 + mid, t), 0);
    if (Math.abs(npv) < 0.01) return mid;
    if (npv > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function computeEM(equity: number, cashFlows: number[]): number | null {
  if (equity <= 0) return null;
  const totalIn = cashFlows.filter(c => c > 0).reduce((s, c) => s + c, 0);
  return totalIn / equity;
}

function makeScenarioCashFlows(
  equity: number,
  noi_y1: number,
  rentGrowth: number,
  annualDS: number,
  holdYears: number,
  exitCap: number,
  sellingCostsPct: number,
  loanBalance: number,
): number[] {
  if (equity <= 0 || noi_y1 <= 0) return [];
  const cfs: number[] = [-equity];
  for (let y = 1; y <= holdYears; y++) {
    const noi = noi_y1 * Math.pow(1 + rentGrowth, y - 1);
    const btcf = noi - annualDS;
    if (y < holdYears) {
      cfs.push(btcf);
    } else {
      const exitNoi = noi_y1 * Math.pow(1 + rentGrowth, y);
      const exitSalePrice = exitCap > 0 ? exitNoi / exitCap : 0;
      const netProceeds = exitSalePrice * (1 - sellingCostsPct) - loanBalance;
      cfs.push(btcf + netProceeds);
    }
  }
  return cfs;
}

export function ReturnsTab({ dealId, deal, assumptions, modelResults, f9Financials }: FinancialEngineTabProps) {
  const [showSensitivity, setShowSensitivity] = useState(true);

  const purchasePrice = f9Financials?.capitalStack?.purchasePrice
    ?? assumptions?.acquisition?.purchasePrice
    ?? (typeof deal?.purchase_price === 'number' ? deal.purchase_price as number : 0);

  const loanAmount = f9Financials?.capitalStack?.loanAmount
    ?? assumptions?.financing?.loanAmount
    ?? purchasePrice * 0.65;

  const equity = f9Financials?.capitalStack?.equityAtClose
    ?? (purchasePrice - loanAmount);

  const f9Noi = f9Financials?.proforma?.year1?.find(r => r.field === 'noi')?.resolved ?? null;
  const noi_y1 = f9Noi ?? modelResults?.summary?.noi ?? 0;

  const holdYears   = f9Financials?.assumptions?.holdYears ?? assumptions?.holdPeriod ?? 5;
  const exitCap     = f9Financials?.assumptions?.exitCap ?? assumptions?.disposition?.exitCapRate ?? 0.055;
  const rentGrowth  = f9Financials?.assumptions?.rentGrowthStabilized ?? 0.03;
  const sellingCostsPct = assumptions?.disposition?.sellingCosts ?? 0.03;
  const interestRate = f9Financials?.capitalStack?.interestRate ?? assumptions?.financing?.interestRate ?? 0.07;
  const annualDS = loanAmount * interestRate;

  const f9Returns = f9Financials?.returns;

  const cashFlows = useMemo(() => makeScenarioCashFlows(
    equity, noi_y1, rentGrowth, annualDS, holdYears, exitCap, sellingCostsPct, loanAmount,
  ), [equity, noi_y1, rentGrowth, annualDS, holdYears, exitCap, sellingCostsPct, loanAmount]);

  const derivedIRR = useMemo(() => computeIRR(cashFlows), [cashFlows]);
  const derivedEM  = useMemo(() => computeEM(equity, cashFlows), [equity, cashFlows]);
  const derivedCoC = noi_y1 > 0 && equity > 0 ? ((noi_y1 - annualDS) / equity) : null;

  const irr = f9Returns?.irr ?? derivedIRR;
  const em  = f9Returns?.equityMultiple ?? derivedEM;
  const coc = f9Returns?.cashOnCash ?? derivedCoC;

  const lpShare = assumptions?.waterfall?.lpShare ?? 0.90;
  const gpShare = assumptions?.waterfall?.gpShare ?? 0.10;
  const lpEquity = equity * lpShare;
  const gpEquity = equity * gpShare;

  const prefRate = assumptions?.waterfall?.hurdles?.[0]?.hurdleRate ?? 0.08;
  const promoteRate = assumptions?.waterfall?.hurdles?.[0]?.promoteToGP ?? 0.20;

  const lpIrr  = modelResults?.summary?.lpIrr  ?? null;
  const lpEm   = modelResults?.summary?.lpEm   ?? null;
  const gpIrr  = modelResults?.summary?.gpIrr  ?? null;
  const gpEm   = modelResults?.summary?.gpEm   ?? null;
  const gpPromote = modelResults?.summary?.gpPromoteEarned ?? null;

  const exitSalePrice = holdYears > 0 && exitCap > 0
    ? (noi_y1 * Math.pow(1 + rentGrowth, holdYears)) / exitCap
    : 0;
  const exitNetProceeds = exitSalePrice * (1 - sellingCostsPct) - loanAmount;
  const totalReturn = cashFlows.slice(1).reduce((s, cf) => s + cf, 0);
  const totalProfit = totalReturn - equity;

  const EXIT_CAPS  = [0.040, 0.045, 0.050, 0.055, 0.060, 0.065, 0.070];
  const HOLD_YEARS = [3, 4, 5, 6, 7, 8, 10];

  const sensGrid: SensCell[][] = useMemo(() => {
    return EXIT_CAPS.map(cap => HOLD_YEARS.map(hy => {
      const cfs = makeScenarioCashFlows(equity, noi_y1, rentGrowth, annualDS, hy, cap, sellingCostsPct, loanAmount);
      const irrV = computeIRR(cfs);
      const emV  = computeEM(equity, cfs);
      return { irr: irrV, em: emV };
    }));
  }, [equity, noi_y1, rentGrowth, annualDS, sellingCostsPct, loanAmount]);

  const irrColor = (v: number | null) => {
    if (v == null) return BT.text.muted;
    if (v >= 0.18) return BT.text.cyan;
    if (v >= 0.14) return BT.met.financial;
    if (v >= 0.10) return BT.text.amber;
    return BT.text.red;
  };

  const emColor = (v: number | null) => {
    if (v == null) return BT.text.muted;
    if (v >= 2.0) return BT.text.cyan;
    if (v >= 1.7) return BT.met.financial;
    if (v >= 1.4) return BT.text.amber;
    return BT.text.red;
  };

  const [sensMode, setSensMode] = useState<'irr' | 'em'>('irr');

  const maxBarW = 80;
  const btcfValues = cashFlows.slice(1, -1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>UNLEVERED & LEVERED · LP / GP SPLIT · SENSITIVITY</span>
        <Bd c={BT.met.financial}>RETURNS ANALYSIS</Bd>
        {f9Returns && <Bd c={BT.text.cyan}>F9 ENGINE</Bd>}
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: BT.border.subtle, padding: 1 }}>
        <KpiTile label="LEVERED IRR" value={irr != null ? fmtPct(irr * 100) : '—'} color={irrColor(irr)} />
        <KpiTile label="EQUITY MULTIPLE" value={em != null ? fmtX(em) : '—'} color={emColor(em)} />
        <KpiTile label="CASH-ON-CASH" value={coc != null ? fmtPct(coc * 100) : '—'} color={BT.text.cyan} />
        <KpiTile label="EXIT VALUE" value={exitSalePrice > 0 ? fmt$(exitSalePrice) : '—'} color={BT.text.white} />
        <KpiTile label="TOTAL PROFIT" value={totalProfit > 0 ? fmt$(totalProfit) : '—'} color={BT.met.financial} />
      </div>

      {/* Deal vs LP vs GP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        <SectionPanel title="DEAL-LEVEL RETURNS" subtitle="Levered, before promote" borderColor={BT.met.financial}>
          <DataRow label="EQUITY INVESTED" value={equity > 0 ? fmt$(equity) : '—'} valueColor={BT.text.white} />
          <DataRow label="LEVERED IRR" value={irr != null ? fmtPct(irr * 100) : '—'} valueColor={irrColor(irr)} />
          <DataRow label="EQUITY MULTIPLE" value={em != null ? fmtX(em) : '—'} valueColor={emColor(em)} />
          <DataRow label="CASH-ON-CASH (Y1)" value={coc != null ? fmtPct(coc * 100) : '—'} valueColor={BT.text.cyan} />
          <DataRow label="TOTAL PROFIT" value={totalProfit > 0 ? fmt$(totalProfit) : '—'} valueColor={BT.met.financial} />
          <DataRow label="HOLD PERIOD" value={`${holdYears} years`} valueColor={BT.text.secondary} border={false} />
        </SectionPanel>

        <SectionPanel title="LP RETURNS" subtitle={`${fmtPct(lpShare * 100)} equity · ${fmtPct(prefRate * 100)} pref`} borderColor={BT.text.cyan}>
          <DataRow label="LP EQUITY" value={lpEquity > 0 ? fmt$(lpEquity) : '—'} valueColor={BT.text.white} />
          <DataRow label="LP IRR" value={lpIrr != null ? fmtPct(lpIrr * 100) : (irr != null ? fmtPct(irr * 100) : '—')} valueColor={irrColor(lpIrr ?? irr)} />
          <DataRow label="LP EQUITY MULTIPLE" value={lpEm != null ? fmtX(lpEm) : (em != null ? fmtX(em) : '—')} valueColor={emColor(lpEm ?? em)} />
          <DataRow label="PREF RETURN RATE" value={fmtPct(prefRate * 100)} valueColor={BT.text.amber} />
          <DataRow label="ANNUAL PREF" value={lpEquity > 0 ? fmt$(lpEquity * prefRate) + '/yr' : '—'} valueColor={BT.text.cyan} />
          <DataRow label="LP TOTAL DIST" value={modelResults?.summary?.lpTotalDistributions != null ? fmt$(modelResults.summary.lpTotalDistributions) : '—'} valueColor={BT.text.cyan} border={false} />
        </SectionPanel>

        <SectionPanel title="GP RETURNS" subtitle={`${fmtPct(gpShare * 100)} equity · ${fmtPct(promoteRate * 100)} promote`} borderColor={BT.text.orange}>
          <DataRow label="GP EQUITY" value={gpEquity > 0 ? fmt$(gpEquity) : '—'} valueColor={BT.text.white} />
          <DataRow label="GP IRR" value={gpIrr != null ? fmtPct(gpIrr * 100) : '—'} valueColor={irrColor(gpIrr)} />
          <DataRow label="GP EQUITY MULTIPLE" value={gpEm != null ? fmtX(gpEm) : '—'} valueColor={emColor(gpEm)} />
          <DataRow label="PROMOTE RATE" value={fmtPct(promoteRate * 100)} valueColor={BT.text.amber} />
          <DataRow label="GP PROMOTE EARNED" value={gpPromote != null ? fmt$(gpPromote) : '—'} valueColor={BT.text.orange} />
          <DataRow label="GP TOTAL DIST" value={modelResults?.summary?.gpTotalDistributions != null ? fmt$(modelResults.summary.gpTotalDistributions) : '—'} valueColor={BT.text.orange} border={false} />
        </SectionPanel>
      </div>

      {/* Cash flow timeline */}
      <SectionPanel title="CASH FLOW TIMELINE" subtitle="Annual BTCF by year" borderColor={BT.text.cyan}>
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-end', minHeight: 80 }}>
          {cashFlows.slice(1).map((cf, i) => {
            const isExit = i === cashFlows.length - 2;
            const maxCf = Math.max(...cashFlows.slice(1).map(Math.abs), 1);
            const barH  = Math.max(4, (Math.abs(cf) / maxCf) * 70);
            const color = isExit ? BT.text.amber : (cf >= 0 ? BT.met.financial : BT.text.red);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 7, color }}>{cf >= 0 ? '+' : ''}{fmt$(cf)}</span>
                <div style={{ width: '100%', height: barH, background: color, opacity: 0.8, borderRadius: 2 }} />
                <span style={{ fontFamily: MONO, fontSize: 7, color: BT.text.muted }}>Y{i + 1}{isExit ? '*' : ''}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '4px 12px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
          * Exit year includes sale proceeds ({fmt$(exitNetProceeds)} net after loan payoff + selling costs)
        </div>
      </SectionPanel>

      {/* Sensitivity grid */}
      <div style={{ padding: '4px 10px', background: BT.bg.header, borderBottom: `1px solid ${BT.border.subtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>SENSITIVITY MATRIX — EXIT CAP × HOLD PERIOD</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['irr', 'em'] as const).map(m => (
            <button key={m} onClick={() => setSensMode(m)} style={{
              background: sensMode === m ? `${BT.met.financial}20` : 'transparent',
              border: `1px solid ${sensMode === m ? BT.met.financial : BT.border.medium}`,
              color: sensMode === m ? BT.met.financial : BT.text.muted,
              fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
            }}>{m.toUpperCase()}</button>
          ))}
          <button onClick={() => setShowSensitivity(!showSensitivity)} style={{
            background: 'transparent', border: `1px solid ${BT.border.medium}`, color: BT.text.muted,
            fontFamily: MONO, fontSize: 8, padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
          }}>{showSensitivity ? 'HIDE' : 'SHOW'}</button>
        </div>
      </div>

      {showSensitivity && (
        <div style={{ overflowX: 'auto', background: BT.bg.panel }}>
          <table style={{ borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9, width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${BT.border.medium}`, background: BT.bg.header }}>
                <th style={{ padding: '4px 10px', color: BT.text.muted, textAlign: 'left', fontWeight: 500 }}>EXIT CAP ↓ / HOLD →</th>
                {HOLD_YEARS.map(hy => (
                  <th key={hy} style={{ padding: '4px 10px', color: BT.text.muted, textAlign: 'center', fontWeight: 500 }}>{hy}yr</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXIT_CAPS.map((cap, ci) => (
                <tr key={cap} style={{
                  background: ci % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  outline: Math.abs(cap - exitCap) < 0.0001 ? `1px solid ${BT.border.medium}` : 'none',
                }}>
                  <td style={{ padding: '3px 10px', color: Math.abs(cap - exitCap) < 0.0001 ? BT.text.amber : BT.text.muted, fontWeight: Math.abs(cap - exitCap) < 0.0001 ? 700 : 400 }}>
                    {fmtPct(cap * 100)}{Math.abs(cap - exitCap) < 0.0001 ? ' ◄' : ''}
                  </td>
                  {HOLD_YEARS.map((hy, hi) => {
                    const cell = sensGrid[ci][hi];
                    const v = sensMode === 'irr' ? cell.irr : cell.em;
                    const col = sensMode === 'irr' ? irrColor(v) : emColor(v);
                    const isCurrent = Math.abs(cap - exitCap) < 0.0001 && hy === holdYears;
                    return (
                      <td key={hy} style={{
                        padding: '3px 10px', textAlign: 'center',
                        color: col, fontWeight: isCurrent ? 700 : 400,
                        background: isCurrent ? `${BT.text.amber}15` : 'transparent',
                      }}>
                        {v == null ? '—' : sensMode === 'irr' ? fmtPct(v * 100) : fmtX(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '4px 10px', fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            <span style={{ color: BT.text.cyan }}>■</span> {'>'}18% IRR
            <span style={{ marginLeft: 8, color: BT.met.financial }}>■</span> 14–18%
            <span style={{ marginLeft: 8, color: BT.text.amber }}>■</span> 10–14%
            <span style={{ marginLeft: 8, color: BT.text.red }}>■</span> {'<'}10%
            <span style={{ marginLeft: 12, color: BT.text.amber }}>◄ Current scenario</span>
          </div>
        </div>
      )}

      {/* Exit analysis */}
      <SectionPanel title="EXIT ANALYSIS" subtitle={`Year ${holdYears} disposition`} borderColor={BT.text.amber}>
        <DataRow label="EXIT CAP RATE" value={exitCap > 0 ? fmtPct(exitCap * 100) : '—'} valueColor={BT.text.amber} />
        <DataRow label="TERMINAL NOI" value={noi_y1 > 0 ? fmt$(noi_y1 * Math.pow(1 + rentGrowth, holdYears)) : '—'} valueColor={BT.met.financial} />
        <DataRow label="GROSS SALE PRICE" value={exitSalePrice > 0 ? fmt$(exitSalePrice) : '—'} valueColor={BT.text.white} />
        <DataRow label="SELLING COSTS" value={exitSalePrice > 0 ? fmt$(exitSalePrice * sellingCostsPct) : '—'} valueColor={BT.text.red} sub={fmtPct(sellingCostsPct * 100)} />
        <DataRow label="LOAN PAYOFF" value={loanAmount > 0 ? fmt$(loanAmount) : '—'} valueColor={BT.text.red} />
        <DataRow label="NET SALE PROCEEDS" value={exitNetProceeds > 0 ? fmt$(exitNetProceeds) : '—'} valueColor={BT.text.cyan} border={false} />
      </SectionPanel>
    </div>
  );
}

export default ReturnsTab;
