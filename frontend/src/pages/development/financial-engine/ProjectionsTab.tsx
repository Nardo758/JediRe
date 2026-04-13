import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BT, Bd } from '../../../components/deal/bloomberg-ui';
import type { FinancialEngineTabProps } from './types';
import { fmt$, fmtPct } from './types';
import { apiClient } from '../../../services/api.client';
import { exportFinancialsToExcel } from './excel-export';

const MONO = BT.font.mono;
type TimelineOption = 3 | 5 | 7 | 10;

// ─── Backend contract (mirrors AssumptionsTab) ─────────────────────────────
interface OSRow {
  field: string; label: string;
  broker: number|null; platform: number|null; t12: number|null;
  rentRoll: number|null; taxBill: number|null;
  resolved: number|null; resolution: string|null; perUnit: number|null;
}
interface TrafficYear {
  year: number; vacancyPct: number|null; occupancyPct: number|null;
  effRent: number|null; rentGrowthPct: number|null;
  t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null;
}
interface GprDecomposition {
  brokerAnnual: number|null; platformAnnual: number|null; t12Annual: number|null;
  rentRollAnnual: number|null; resolvedAnnual: number|null;
  brokerPerUnitMo: number|null; platformPerUnitMo: number|null;
  t12PerUnitMo: number|null; resolvedPerUnitMo: number|null;
}
interface DealFinancials {
  dealId: string; dealName: string; totalUnits: number;
  proforma: { year1: OSRow[]; integrityChecks: unknown[]; unitEconomics: Record<string,number|null> };
  capitalStack: { purchasePrice: number|null; loanAmount: number|null; equityAtClose: number|null; ltcPct: number|null; interestRate: number|null; ioPeriodMonths: number|null; amortizationYears: number|null; dscrMin: number|null; originationFeePct: number|null; pricePerUnit: number|null };
  rentRollSummary: { avgInPlaceRent: number|null; weightedOccupancyPct: number|null }|null;
  trafficProjection: {
    yearly: TrafficYear[];
    leaseUp: { weeksTo90: number|null; weeksTo93: number|null; weeksTo95: number|null }|null;
    calibrated: { vacancyPct: number|null; rentGrowthPct: number|null; exitCap: number|null; lastCalibrated: string|null };
    leasingSignals: { t01WeeklyTours: number|null; t05ClosingRatio: number|null; t06WeeklyLeases: number|null; t07LeaseUpWeeksTo95: number|null; stabilizedOccupancyPct: number|null; confidence: number|null }|null;
  }|null;
  assumptions: {
    holdYears: number; exitCap: number|null; rentGrowthYr1: number|null; rentGrowthStabilized: number|null;
    perYear: Array<{ year: number; rentGrowthPct: number|null; vacancyPct: number|null; exitCapIfLastYear: number|null }>;
    gprDecomposition: GprDecomposition|null;
    narrative: string|null;
  };
  userOverrides: Record<string, Record<number, number|null>>;
  meta: { seeded: boolean; updatedAt: string|null };
}

// ─── Projection row (one year of computed data) ────────────────────────────
export interface ProjYear {
  year: number;
  gpr: number;
  vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
  nri: number; otherIncome: number; egi: number;
  payroll: number; repairs: number; turnover: number; contractSvc: number;
  marketing: number; utilities: number; gAndA: number; mgmtFee: number;
  insurance: number; reTaxes: number; reserves: number;
  totalOpex: number; noi: number;
  opMargin: number|null; noiPerUnit: number|null;
  interest: number; principal: number; annualDS: number;
  cfbt: number; capexReserves: number; netCF: number;
  coc: number|null; dscr: number|null; debtYield: number|null; occupancy: number|null;
  exitNoi: number|null; exitCap: number|null; grossSaleValue: number|null;
  sellingCosts: number|null; loanPayoff: number; netSaleProceeds: number|null;
  outstandingBalance: number;
}

// ─── Build per-year projections from DealFinancials ──────────────────────
function buildProjections(f: DealFinancials, holdYears: number): ProjYear[] {
  const { totalUnits, proforma, capitalStack, trafficProjection, assumptions } = f;

  const y1 = (field: string): number | null => {
    const row = proforma.year1.find(r => r.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  const tyr = (yr: number): TrafficYear | undefined =>
    trafficProjection?.yearly.find(t => t.year === yr);
  const pyr = (yr: number) => assumptions.perYear.find(p => p.year === yr);

  const loan = capitalStack.loanAmount ?? 0;
  const rate = capitalStack.interestRate ?? 0.07;
  const ioPeriodYrs = Math.max(0, Math.round((capitalStack.ioPeriodMonths ?? 0) / 12));
  const amortYrs = capitalStack.amortizationYears ?? 30;
  const monthlyRate = rate / 12;
  const numPmts = amortYrs * 12;
  const monthlyPayment = loan > 0 && monthlyRate > 0
    ? loan * monthlyRate * Math.pow(1 + monthlyRate, numPmts) / (Math.pow(1 + monthlyRate, numPmts) - 1)
    : (loan > 0 ? loan / numPmts : 0);

  const gprY1 = y1('gpr') ?? 0;
  const lossToLeasePctY1 = y1('loss_to_lease_pct') ?? 0;
  const concPctY1 = y1('concessions_pct') ?? 0;
  const badDebtPctY1 = y1('bad_debt_pct') ?? 0;
  const nruPctY1 = y1('non_revenue_units_pct') ?? 0;
  const otherIncY1 = y1('other_income_per_unit') ?? 0;
  const mgmtFeePctY1 = y1('management_fee_pct') ?? 0.05;
  const payrollY1 = y1('payroll') ?? 0;
  const repairsY1 = y1('repairs_maintenance') ?? 0;
  const turnoverY1 = y1('turnover') ?? 0;
  const contractY1 = y1('contract_services') ?? 0;
  const marketingY1 = y1('marketing') ?? 0;
  const utilitiesY1 = y1('utilities') ?? 0;
  const gAndAY1 = y1('g_and_a') ?? 0;
  const insuranceY1 = y1('insurance') ?? 0;
  const reTaxY1 = y1('real_estate_tax') ?? 0;
  const reservesY1 = y1('replacement_reserves') ?? totalUnits * 350;

  let outstandingBalance = loan;
  const years: ProjYear[] = [];

  for (let yr = 1; yr <= holdYears; yr++) {
    const tv = tyr(yr);
    const pv = pyr(yr);

    // Rent growth compound multiplier from year 1 to year yr
    let rentMult = 1;
    for (let y = 1; y < yr; y++) {
      const g = pyr(y)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03;
      rentMult *= 1 + (g ?? 0.03);
    }
    const opexMult = Math.pow(1.03, yr - 1);
    const insMult = Math.pow(1.035, yr - 1);

    // GPR — traffic effRent wins if available (GPR = market rent × all units × 12)
    const gpr = tv?.effRent != null
      ? Math.round(tv.effRent * totalUnits * 12)
      : Math.round(gprY1 * rentMult);

    // Vacancy
    const vacPct = tv?.vacancyPct ?? pv?.vacancyPct ?? y1('vacancy_pct') ?? 0.05;
    const vacancyLoss = Math.round(gpr * (vacPct ?? 0.05));
    const lossToLease = Math.round(gpr * lossToLeasePctY1);
    const concessions = Math.round(gpr * concPctY1);
    const badDebt = Math.round(gpr * badDebtPctY1);
    const nru = Math.round(gpr * nruPctY1);
    const nri = gpr - vacancyLoss - lossToLease - concessions - badDebt - nru;

    const otherIncome = Math.round(otherIncY1 * rentMult * totalUnits * 12);
    const egi = nri + otherIncome;

    // OpEx
    const payroll = Math.round(payrollY1 * opexMult);
    const repairs = Math.round(repairsY1 * opexMult);
    const turnover = Math.round(turnoverY1 * opexMult);
    const contractSvc = Math.round(contractY1 * opexMult);
    const marketing = Math.round(marketingY1 * opexMult);
    const utilities = Math.round(utilitiesY1 * opexMult);
    const gAndA = Math.round(gAndAY1 * opexMult);
    const mgmtFee = Math.round(egi * (mgmtFeePctY1 ?? 0.05));
    const insurance = Math.round(insuranceY1 * insMult);
    const reTaxes = Math.round(reTaxY1 * opexMult);
    const reserves = Math.round(reservesY1 * opexMult);
    const totalOpex = payroll + repairs + turnover + contractSvc + marketing + utilities + gAndA + mgmtFee + insurance + reTaxes + reserves;
    const noi = egi - totalOpex;

    // Debt service
    let interest = 0, principal = 0, annualDS = 0;
    if (loan > 0) {
      if (yr <= ioPeriodYrs || amortYrs === 0) {
        interest = Math.round(outstandingBalance * rate);
        principal = 0;
        annualDS = interest;
      } else {
        let yi = 0, yp = 0;
        for (let m = 0; m < 12; m++) {
          const mi = outstandingBalance * monthlyRate;
          const mp = monthlyPayment - mi;
          yi += mi;
          yp += mp;
          outstandingBalance = Math.max(0, outstandingBalance - mp);
        }
        interest = Math.round(yi);
        principal = Math.round(yp);
        annualDS = interest + principal;
      }
    }

    const cfbt = noi - annualDS;
    const capexReserves = 0; // captured in replacement_reserves above
    const netCF = cfbt;

    const equityAtClose = capitalStack.equityAtClose ?? (capitalStack.purchasePrice != null && loan ? capitalStack.purchasePrice - loan : null);
    const coc = equityAtClose && equityAtClose > 0 ? cfbt / equityAtClose : null;
    const dscr = annualDS > 0 ? noi / annualDS : null;
    const debtYield = outstandingBalance > 0 ? noi / outstandingBalance : null;
    const occupancy = tv?.occupancyPct ?? (1 - (vacPct ?? 0.05));

    // Exit
    const exitCap = pv?.exitCapIfLastYear ?? trafficProjection?.calibrated.exitCap ?? assumptions.exitCap ?? 0.055;
    const exitNoi = Math.round(noi * (1 + (pyr(yr)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03)));
    const grossSaleValue = exitCap && exitCap > 0 ? Math.round(exitNoi / exitCap) : null;
    const sellingCosts = grossSaleValue ? Math.round(grossSaleValue * 0.015) : null;
    const loanPayoff = Math.round(outstandingBalance);
    const netSaleProceeds = grossSaleValue != null && sellingCosts != null
      ? grossSaleValue - sellingCosts - loanPayoff : null;

    years.push({
      year: yr,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru,
      nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities,
      gAndA, mgmtFee, insurance, reTaxes, reserves,
      totalOpex, noi,
      opMargin: egi > 0 ? noi / egi : null,
      noiPerUnit: totalUnits > 0 ? noi / totalUnits : null,
      interest, principal, annualDS,
      cfbt, capexReserves, netCF,
      coc, dscr, debtYield, occupancy,
      exitNoi, exitCap, grossSaleValue, sellingCosts, loanPayoff, netSaleProceeds,
      outstandingBalance,
    });
  }
  return years;
}

// ─── Row definitions ──────────────────────────────────────────────────────
interface RowDef {
  label: string;
  key: keyof ProjYear;
  isTotal?: boolean;
  indent?: boolean;
  sign?: -1;
  fmt?: 'dollar' | 'pct' | 'x' | 'raw';
}
interface SectionDef {
  label: string;
  key: string;
  color: string;
  rows: RowDef[];
}

const fmtCell = (val: number | null | undefined, fmt: RowDef['fmt'] = 'dollar', sign?: -1): string => {
  if (val == null || isNaN(val as number)) return '—';
  const v = sign === -1 ? -Math.abs(val) : val;
  switch (fmt) {
    case 'pct': return `${(val * 100).toFixed(2)}%`;
    case 'x': return `${val.toFixed(2)}×`;
    case 'raw': return val.toFixed(0);
    default: return fmt$(v);
  }
};

const SECTIONS: SectionDef[] = [
  {
    label: 'REVENUE', key: 'revenue', color: BT.met.financial,
    rows: [
      { label: 'Gross Potential Rent', key: 'gpr', isTotal: true },
      { label: 'Vacancy Loss', key: 'vacancyLoss', indent: true, sign: -1 },
      { label: 'Loss to Lease', key: 'lossToLease', indent: true, sign: -1 },
      { label: 'Concessions', key: 'concessions', indent: true, sign: -1 },
      { label: 'Bad Debt / Collection Loss', key: 'badDebt', indent: true, sign: -1 },
      { label: 'Non-Revenue Units', key: 'nru', indent: true, sign: -1 },
      { label: 'Net Rental Income', key: 'nri', isTotal: true },
      { label: 'Other Income', key: 'otherIncome', indent: true },
      { label: 'Effective Gross Income', key: 'egi', isTotal: true },
    ],
  },
  {
    label: 'EXPENSES', key: 'expense', color: BT.text.red,
    rows: [
      { label: 'Payroll / Personnel', key: 'payroll', indent: true, sign: -1 },
      { label: 'Repairs & Maintenance', key: 'repairs', indent: true, sign: -1 },
      { label: 'Turnover / Make-Ready', key: 'turnover', indent: true, sign: -1 },
      { label: 'Contract Services', key: 'contractSvc', indent: true, sign: -1 },
      { label: 'Marketing & Leasing', key: 'marketing', indent: true, sign: -1 },
      { label: 'Utilities', key: 'utilities', indent: true, sign: -1 },
      { label: 'G&A / Administrative', key: 'gAndA', indent: true, sign: -1 },
      { label: 'Management Fee', key: 'mgmtFee', indent: true, sign: -1 },
      { label: 'Insurance', key: 'insurance', indent: true, sign: -1 },
      { label: 'Real Estate Taxes', key: 'reTaxes', indent: true, sign: -1 },
      { label: 'Replacement Reserves', key: 'reserves', indent: true, sign: -1 },
      { label: 'Total Operating Expenses', key: 'totalOpex', isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'NOI', key: 'noi', color: BT.text.cyan,
    rows: [
      { label: 'Net Operating Income', key: 'noi', isTotal: true },
      { label: 'Operating Margin', key: 'opMargin', fmt: 'pct' },
      { label: 'NOI / Unit', key: 'noiPerUnit' },
    ],
  },
  {
    label: 'DEBT SERVICE', key: 'debt', color: BT.text.orange,
    rows: [
      { label: 'Interest', key: 'interest', indent: true, sign: -1 },
      { label: 'Principal Paydown', key: 'principal', indent: true, sign: -1 },
      { label: 'Total Debt Service', key: 'annualDS', isTotal: true, sign: -1 },
    ],
  },
  {
    label: 'CASH FLOW', key: 'cashflow', color: BT.met.financial,
    rows: [
      { label: 'Cash Flow Before Tax', key: 'cfbt', isTotal: true },
      { label: 'Net Cash Flow', key: 'netCF', isTotal: true },
    ],
  },
  {
    label: 'METRICS', key: 'metrics', color: BT.text.purple,
    rows: [
      { label: 'Cash-on-Cash Return', key: 'coc', fmt: 'pct' },
      { label: 'DSCR', key: 'dscr', fmt: 'x' },
      { label: 'Debt Yield', key: 'debtYield', fmt: 'pct' },
      { label: 'Occupancy', key: 'occupancy', fmt: 'pct' },
    ],
  },
  {
    label: 'EXIT / REVERSION', key: 'exit', color: BT.text.amber,
    rows: [
      { label: 'Forward NOI (Exit)', key: 'exitNoi' },
      { label: 'Exit Cap Rate', key: 'exitCap', fmt: 'pct' },
      { label: 'Gross Sale Value', key: 'grossSaleValue' },
      { label: '(–) Selling Costs (1.5%)', key: 'sellingCosts', indent: true, sign: -1 },
      { label: '(–) Loan Payoff', key: 'loanPayoff', indent: true, sign: -1 },
      { label: 'Net Sale Proceeds', key: 'netSaleProceeds', isTotal: true },
    ],
  },
];

// ─── GPR Decomposition Panel ──────────────────────────────────────────────
function GprDecompPanel({ decomp, totalUnits }: { decomp: GprDecomposition; totalUnits: number }) {
  const rows = [
    { label: 'RESOLVED', annual: decomp.resolvedAnnual, perUnit: decomp.resolvedPerUnitMo, color: BT.text.cyan, bold: true },
    { label: 'PLATFORM', annual: decomp.platformAnnual, perUnit: decomp.platformPerUnitMo, color: '#22D3EE' },
    { label: 'BROKER', annual: decomp.brokerAnnual, perUnit: decomp.brokerPerUnitMo, color: BT.text.amber },
    { label: 'T12 ACTUAL', annual: decomp.t12Annual, perUnit: decomp.t12PerUnitMo, color: BT.met.physTraffic ?? BT.text.secondary },
    { label: 'RENT ROLL', annual: decomp.rentRollAnnual, perUnit: null, color: BT.text.secondary },
  ];
  return (
    <div style={{
      borderBottom: `1px solid ${BT.border.subtle}`,
      background: BT.bg.panel,
      padding: '6px 10px',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: BT.text.white, letterSpacing: 1, fontFamily: MONO, marginBottom: 4 }}>
        GPR SOURCE DECOMPOSITION
        <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted }}>({totalUnits} units)</span>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', flexDirection: 'column', minWidth: 100 }}>
            <span style={{ fontSize: 8, color: BT.text.muted, fontFamily: MONO, letterSpacing: 0.5 }}>{r.label}</span>
            <span style={{
              fontSize: 11, fontWeight: r.bold ? 700 : 500,
              color: r.annual != null ? r.color : BT.text.muted,
              fontFamily: MONO,
            }}>
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

// ─── AI Findings Panel ────────────────────────────────────────────────────
function FindingsPanel({ narrative }: { narrative: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{
      borderTop: `1px solid ${BT.border.subtle}`,
      background: `${BT.text.purple}0A`,
      flexShrink: 0,
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${BT.border.subtle}` : 'none',
        }}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: BT.text.purple, fontFamily: MONO, letterSpacing: 1 }}>
          AI MARKET FINDINGS
        </span>
        <Bd c={BT.text.purple}>M07</Bd>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>
          {expanded ? '▾' : '▸'}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px' }}>
          <p style={{
            fontFamily: MONO, fontSize: 9, color: BT.text.secondary,
            lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap',
          }}>
            {narrative}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────
function SkeletonTable({ cols }: { cols: number }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
      <tbody>
        {Array.from({ length: 14 }, (_, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.terminal }}>
            <td style={{ padding: '5px 8px', width: 220 }}>
              <div style={{ height: 8, width: `${50 + (i % 5) * 10}%`, background: `${BT.border.medium}60`, borderRadius: 2 }} />
            </td>
            {Array.from({ length: cols }, (_, c) => (
              <td key={c} style={{ padding: '5px 8px', textAlign: 'right', minWidth: 90 }}>
                <div style={{ height: 8, width: 70, background: `${BT.border.medium}40`, borderRadius: 2, marginLeft: 'auto' }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export function ProjectionsTab({ dealId, assumptions: legacyAssumptions, modelResults }: FinancialEngineTabProps) {
  const [timeline, setTimeline] = useState<TimelineOption>(5);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(SECTIONS.map(s => s.key)));
  const [showGprDecomp, setShowGprDecomp] = useState(true);
  const [showFindings, setShowFindings] = useState(true);
  const [financials, setFinancials] = useState<DealFinancials | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFinancials = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v1/deals/${dealId}/financials?hold=${timeline}`);
      const data = (res as any)?.data?.data as DealFinancials;
      if (data) setFinancials(data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load projections');
    } finally {
      setLoading(false);
    }
  }, [dealId, timeline]);

  useEffect(() => { loadFinancials(); }, [loadFinancials]);

  const holdYears = financials ? Math.min(timeline, financials.assumptions.holdYears || timeline) : timeline;
  const projections = useMemo(
    () => financials ? buildProjections(financials, holdYears) : [],
    [financials, holdYears],
  );

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = useCallback(() => {
    if (!financials || projections.length === 0) return;
    exportFinancialsToExcel(financials, projections, financials.dealName);
  }, [financials, projections]);

  const colCount = holdYears;
  const years = Array.from({ length: colCount }, (_, i) => i + 1);

  const hasGprDecomp = financials?.assumptions.gprDecomposition != null;
  const hasNarrative = financials?.assumptions.narrative != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header controls */}
      <div style={{
        padding: '4px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, letterSpacing: 0.5 }}>TIMELINE:</span>
        {([3, 5, 7, 10] as TimelineOption[]).map(t => (
          <button key={t} onClick={() => setTimeline(t)} style={{
            background: timeline === t ? BT.bg.active : 'transparent',
            color: timeline === t ? BT.met.financial : BT.text.muted,
            border: timeline === t ? `1px solid ${BT.met.financial}40` : '1px solid transparent',
            padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>{t}YR</button>
        ))}

        <div style={{ width: 1, height: 14, background: BT.border.medium }} />

        {hasGprDecomp && (
          <button onClick={() => setShowGprDecomp(v => !v)} style={{
            background: showGprDecomp ? `${BT.met.financial}15` : 'transparent',
            color: showGprDecomp ? BT.met.financial : BT.text.muted,
            border: `1px solid ${showGprDecomp ? BT.met.financial : BT.border.subtle}`,
            padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>GPR DECOMP</button>
        )}

        {hasNarrative && (
          <button onClick={() => setShowFindings(v => !v)} style={{
            background: showFindings ? `${BT.text.purple}15` : 'transparent',
            color: showFindings ? BT.text.purple : BT.text.muted,
            border: `1px solid ${showFindings ? BT.text.purple : BT.border.subtle}`,
            padding: '2px 8px', fontFamily: MONO, fontSize: 9, cursor: 'pointer', borderRadius: 2,
          }}>FINDINGS</button>
        )}

        <div style={{ flex: 1 }} />

        {financials && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            {financials.totalUnits} UNITS · {financials.dealName}
          </span>
        )}

        {loading && (
          <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>LOADING...</span>
        )}

        <button onClick={handleExport} disabled={!financials || projections.length === 0} style={{
          background: 'transparent', border: `1px solid ${BT.border.medium}`,
          color: financials ? BT.text.secondary : BT.text.muted,
          fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: financials ? 'pointer' : 'default',
          borderRadius: 2, opacity: financials ? 1 : 0.4,
        }}>EXPORT XLSX</button>
      </div>

      {/* GPR Decomposition (below header) */}
      {showGprDecomp && hasGprDecomp && (
        <GprDecompPanel
          decomp={financials!.assumptions.gprDecomposition!}
          totalUnits={financials!.totalUnits}
        />
      )}

      {/* Operating Statement Table */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {error ? (
          <div style={{ padding: 20, fontFamily: MONO, fontSize: 9, color: BT.text.red }}>
            ERROR: {error}
            <button onClick={loadFinancials} style={{
              marginLeft: 12, background: 'transparent', border: `1px solid ${BT.border.medium}`,
              color: BT.text.secondary, fontFamily: MONO, fontSize: 9, padding: '2px 8px', cursor: 'pointer',
            }}>RETRY</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 9 }}>
            <thead>
              <tr style={{
                borderBottom: `2px solid ${BT.border.medium}`,
                position: 'sticky', top: 0,
                background: BT.bg.header, zIndex: 2,
              }}>
                <th style={{
                  padding: '5px 8px', textAlign: 'left', color: BT.text.muted, fontWeight: 500,
                  minWidth: 220, position: 'sticky', left: 0, background: BT.bg.header, zIndex: 3,
                }}>
                  OPERATING STATEMENT
                  {financials && (
                    <span style={{ marginLeft: 8, fontWeight: 400, color: BT.text.muted, fontSize: 8 }}>
                      · {financials.totalUnits} units · Traffic-integrated
                    </span>
                  )}
                </th>
                {years.map(yr => (
                  <th key={yr} style={{
                    padding: '5px 8px', textAlign: 'right',
                    color: BT.text.muted, fontWeight: 500, minWidth: 90,
                  }}>
                    YR {yr}
                  </th>
                ))}
              </tr>
            </thead>

            {loading ? (
              <tbody>
                {Array.from({ length: 28 }, (_, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.terminal }}>
                    <td style={{ padding: '5px 8px', position: 'sticky', left: 0, background: 'inherit' }}>
                      <div style={{ height: 8, width: `${50 + (i % 4) * 12}%`, background: `${BT.border.medium}50`, borderRadius: 2 }} />
                    </td>
                    {years.map(yr => (
                      <td key={yr} style={{ padding: '5px 8px', textAlign: 'right' }}>
                        <div style={{ height: 8, width: 72, background: `${BT.border.medium}30`, borderRadius: 2, marginLeft: 'auto' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : (
              <tbody>
                {SECTIONS.map(section => {
                  const isExpanded = expandedSections.has(section.key);
                  return (
                    <React.Fragment key={section.key}>
                      {/* Section header */}
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

                      {isExpanded && section.rows.map((row, ri) => {
                        const isEven = ri % 2 === 0;
                        const rowBg = row.isTotal
                          ? `${section.color}08`
                          : isEven ? BT.bg.panel : BT.bg.terminal;
                        return (
                          <tr key={row.key} style={{
                            background: rowBg,
                            borderBottom: row.isTotal
                              ? `2px solid ${BT.border.medium}`
                              : `1px solid ${BT.border.subtle}`,
                          }}>
                            <td style={{
                              padding: `3px 8px 3px ${row.indent ? 20 : 8}px`,
                              color: row.isTotal ? BT.text.white : BT.text.secondary,
                              fontWeight: row.isTotal ? 700 : 400,
                              position: 'sticky', left: 0,
                              background: rowBg, zIndex: 1,
                            }}>
                              {row.label}
                            </td>
                            {years.map(yr => {
                              const proj = projections[yr - 1];
                              const rawVal = proj ? (proj[row.key] as number | null) : null;
                              const display = fmtCell(rawVal, row.fmt, row.sign);
                              const isNeg = rawVal != null && rawVal < 0;
                              const textColor = row.isTotal
                                ? section.color
                                : isNeg
                                  ? BT.text.red
                                  : row.sign === -1 && rawVal != null && rawVal > 0
                                    ? BT.text.red
                                    : BT.text.primary;
                              return (
                                <td key={yr} style={{
                                  padding: '3px 8px', textAlign: 'right',
                                  color: textColor,
                                  fontWeight: row.isTotal ? 700 : 400,
                                }}>
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {/* Traffic signal footnote row */}
                {financials?.trafficProjection?.yearly && financials.trafficProjection.yearly.length > 0 && (
                  <tr style={{ background: BT.bg.header, borderTop: `1px solid ${BT.border.subtle}` }}>
                    <td style={{ padding: '4px 8px', color: BT.text.muted, fontSize: 8, fontStyle: 'italic', position: 'sticky', left: 0, background: BT.bg.header }}>
                      Traffic signals: T01/T05/T06 integrated via M07 Engine
                    </td>
                    {years.map(yr => {
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
              </tbody>
            )}
          </table>
        )}

        {/* Empty state */}
        {!loading && !error && projections.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: MONO, fontSize: 9, color: BT.text.muted }}>
            <div style={{ marginBottom: 8 }}>No projection data available for this deal.</div>
            <div>Run <strong style={{ color: BT.text.secondary }}>REPARSE</strong> from the Pro Forma tab to seed Year 1 data.</div>
          </div>
        )}
      </div>

      {/* AI Findings */}
      {showFindings && hasNarrative && (
        <FindingsPanel narrative={financials!.assumptions.narrative!} />
      )}
    </div>
  );
}

export default ProjectionsTab;
