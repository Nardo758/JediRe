/**
 * F9 Financial Export Service
 * Builds per-year projections and XLSX workbook for F9 Financial Engine exports.
 * Sheets: Pro Forma | Traffic Projection | Assumptions
 */

import * as XLSX from 'xlsx';
import type { DealFinancials } from './proforma-adjustment.service';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProjYearExport {
  year: number;
  gpr: number;
  vacancyLoss: number; lossToLease: number; concessions: number; badDebt: number; nru: number;
  nri: number; otherIncome: number; egi: number;
  payroll: number; repairs: number; turnover: number; contractSvc: number;
  marketing: number; utilities: number; gAndA: number; mgmtFee: number;
  insurance: number; reTaxes: number; reserves: number;
  totalOpex: number; noi: number;
  opMargin: number | null; noiPerUnit: number | null;
  interest: number; principal: number; annualDS: number;
  /** CapEx draw this year (total $). Sourced from user capexPerYear override or 40/35/25 fallback. */
  capexDraw: number;
  cfbt: number; netCF: number;
  coc: number | null; dscr: number | null; debtYield: number | null; occupancy: number | null;
  exitNoi: number | null; exitCap: number | null; grossSaleValue: number | null;
  sellingCosts: number | null; loanPayoff: number; netSaleProceeds: number | null;
  outstandingBalance: number;
  cumulativeEM: number | null;
}

// ─── Projection builder ─────────────────────────────────────────────────────

export function buildProjectionsForExport(
  f: DealFinancials,
  holdYears: number,
): ProjYearExport[] {
  const { totalUnits, proforma, capitalStack, trafficProjection, assumptions } = f;

  const y1 = (field: string): number | null => {
    const row = proforma.year1.find(r => r.field === field);
    return row?.resolved ?? row?.platform ?? null;
  };
  const tyr = (yr: number) => trafficProjection?.yearly.find(t => t.year === yr);
  const pyr = (yr: number) => assumptions.perYear.find(p => p.year === yr);

  const loan = capitalStack.loanAmount ?? 0;
  const rate = capitalStack.interestRate ?? 0.07;
  const ioPeriodYrs = Math.max(0, Math.round((capitalStack.ioPeriodMonths ?? 0) / 12));
  const amortYrs = capitalStack.amortizationYears ?? 30;
  const monthlyRate = rate / 12;
  const numPmts = amortYrs * 12;
  const monthlyPayment =
    loan > 0 && monthlyRate > 0
      ? (loan * monthlyRate * Math.pow(1 + monthlyRate, numPmts)) /
        (Math.pow(1 + monthlyRate, numPmts) - 1)
      : loan > 0
        ? loan / numPmts
        : 0;

  // GPR Year 1: use resolvedAnnual from GPR decomposition (highest-fidelity)
  const gprY1 =
    assumptions.gprDecomposition?.resolvedAnnual ?? y1('gpr') ?? 0;
  const lossToLeasePctY1 = y1('loss_to_lease_pct') ?? 0;
  const concPctY1        = y1('concessions_pct') ?? 0;
  const badDebtPctY1     = y1('bad_debt_pct') ?? 0;
  const nruPctY1         = y1('non_revenue_units_pct') ?? 0;
  const otherIncY1       = y1('other_income_per_unit') ?? 0;
  const mgmtFeePctY1     = y1('management_fee_pct') ?? 0.05;
  const payrollY1        = y1('payroll') ?? 0;
  const repairsY1        = y1('repairs_maintenance') ?? 0;
  const turnoverY1       = y1('turnover') ?? 0;
  const contractY1       = y1('contract_services') ?? 0;
  const marketingY1      = y1('marketing') ?? 0;
  const utilitiesY1      = y1('utilities') ?? 0;
  const gAndAY1          = y1('g_and_a') ?? 0;
  const insuranceY1      = y1('insurance') ?? 0;
  const reTaxY1          = y1('real_estate_tax') ?? 0;
  const reservesY1       = y1('replacement_reserves') ?? totalUnits * 350;

  let outstandingBalance = loan;
  let cumulativeCF = 0;
  const equityAtClose = capitalStack.equityAtClose ?? 0;
  const years: ProjYearExport[] = [];

  // Pre-compute total Y1 capex for the 40/35/25 fallback schedule.
  // Falls back to 0 when no capex budget is set, leaving CFBT unchanged for
  // existing deals that have never configured capex.
  const capexTotalY1 = y1('capex') ?? 0;

  // Concession burn-off: accumulator tracks how much of Y1 concession has been
  // phased out. Each year's rate is read per-year (stepped) or flat (year-1-only),
  // falling back to assumptions.concessionBurnOffPct → 0.
  // This makes concession burn-off truly trajectory-sensitive (Section B).
  // TODO(agent): concessionBurnOffPct — agent integration out of scope here.
  let accumulatedBurnOff = 0; // grows each year; concessions = Y1 × max(0, 1 - accumulated)

  for (let yr = 1; yr <= holdYears; yr++) {
    const tv = tyr(yr);
    const pv = pyr(yr);

    // Compound rent growth from Year 1 base
    let rentMult = 1;
    for (let y = 1; y < yr; y++) {
      const g = pyr(y)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03;
      rentMult *= 1 + (g ?? 0.03);
    }

    // Compound OpEx growth from user override (per-year or flat), falling back
    // to the DB-seeded platform value (assumptions.opexGrowthPct), then to 3%.
    // Replaces the former hardcoded Math.pow(1.03, yr-1) so that user inputs
    // from the Assumptions tab Section B actually affect Y2+ projections.
    // TODO(M36): opexGrowthPct is a Section B trajectory driver — add to covariance matrix when M36 integrates.
    let opexMult = 1;
    let insMult  = 1;
    for (let y = 1; y < yr; y++) {
      const opexG = f.userOverrides['growthOpexPct']?.[y] ?? assumptions.opexGrowthPct ?? 0.03;
      const insG  = f.userOverrides['growthInsurancePct']?.[y] ?? 0.035;
      opexMult *= 1 + opexG;
      insMult  *= 1 + insG;
    }

    // GPR = resolvedAnnual × compound rent growth (vacancy handled separately)
    const gpr = Math.round(gprY1 * rentMult);

    // Vacancy: per-year traffic data wins when available
    const vacPct      = tv?.vacancyPct ?? pv?.vacancyPct ?? y1('vacancy_pct') ?? 0.05;
    const vacancyLoss = Math.round(gpr * (vacPct ?? 0.05));
    const lossToLease = Math.round(gpr * lossToLeasePctY1);
    // Concession burn-off: Y1 concessions × (1 - accumulatedBurnOff).
    // accumulatedBurnOff = 0 in Y1 → full Y1 concession (existing behavior preserved).
    // Each year's rate is read per-year (stepped UI) or flat (falls back to Y1 override
    // → assumptions field → 0), making this genuinely year-sensitive / Section B.
    const concessions = Math.round(gpr * concPctY1 * Math.max(0, 1 - accumulatedBurnOff));
    // Accumulate this year's burn-off rate so next year's concession is further reduced.
    const burnOffThisYr = f.userOverrides['concessionBurnOffPct']?.[yr]
      ?? assumptions.concessionBurnOffPct
      ?? 0;
    accumulatedBurnOff = Math.min(1, accumulatedBurnOff + burnOffThisYr);
    const badDebt     = Math.round(gpr * badDebtPctY1);
    const nru         = Math.round(gpr * nruPctY1);
    const nri         = gpr - vacancyLoss - lossToLease - concessions - badDebt - nru;

    const otherIncome = Math.round(otherIncY1 * rentMult * totalUnits * 12);
    const egi         = nri + otherIncome;

    const payroll    = Math.round(payrollY1    * opexMult);
    const repairs    = Math.round(repairsY1    * opexMult);
    const turnover   = Math.round(turnoverY1   * opexMult);
    const contractSvc = Math.round(contractY1  * opexMult);
    const marketing  = Math.round(marketingY1  * opexMult);
    const utilities  = Math.round(utilitiesY1  * opexMult);
    const gAndA      = Math.round(gAndAY1      * opexMult);
    const mgmtFee    = Math.round(egi          * (mgmtFeePctY1 ?? 0.05));
    const insurance  = Math.round(insuranceY1  * insMult);
    const reTaxes    = Math.round(reTaxY1      * opexMult);
    const reserves   = Math.round(reservesY1   * opexMult);
    const totalOpex  = payroll + repairs + turnover + contractSvc + marketing +
                       utilities + gAndA + mgmtFee + insurance + reTaxes + reserves;
    const noi        = egi - totalOpex;

    let interest = 0, principal = 0, annualDS = 0;
    if (loan > 0) {
      if (yr <= ioPeriodYrs || amortYrs === 0) {
        interest = Math.round(outstandingBalance * rate);
        principal = 0;
        annualDS  = interest;
      } else {
        let yi = 0, yp = 0;
        for (let m = 0; m < 12; m++) {
          const mi = outstandingBalance * monthlyRate;
          const mp = monthlyPayment - mi;
          yi += mi;
          yp += mp;
          outstandingBalance = Math.max(0, outstandingBalance - mp);
        }
        interest  = Math.round(yi);
        principal = Math.round(yp);
        annualDS  = interest + principal;
      }
    }

    // Per-year CapEx draw: read from assumptions.perYear[yr].capexDraw (populated by the
    // financials assembly from per_year_overrides['capexPerYear:yr{n}'], $/unit) → then
    // fall back to the 40/35/25 front-loaded schedule derived from Y1 total capex.
    // Falls back to 0 when no capex budget is set, preserving existing behavior.
    const capexDraw = (() => {
      if (pv?.capexDraw != null) return Math.round(pv.capexDraw * totalUnits);
      if (yr === 1) return Math.round(capexTotalY1 * 0.40);
      if (yr === 2) return Math.round(capexTotalY1 * 0.35);
      if (yr === 3) return Math.round(capexTotalY1 * 0.25);
      return 0;
    })();

    const cfbt  = noi - annualDS - capexDraw;
    const netCF = cfbt;
    cumulativeCF += netCF;

    const coc       = equityAtClose > 0 ? cfbt / equityAtClose : null;
    const dscr      = annualDS > 0 ? noi / annualDS : null;
    const debtYield = outstandingBalance > 0 ? noi / outstandingBalance : null;
    const occupancy = tv?.occupancyPct ?? (1 - (vacPct ?? 0.05));

    const exitCap =
      pv?.exitCapIfLastYear ??
      trafficProjection?.calibrated.exitCap ??
      assumptions.exitCap ??
      0.055;
    const exitNoi =
      Math.round(noi * (1 + (pyr(yr)?.rentGrowthPct ?? assumptions.rentGrowthStabilized ?? 0.03)));
    const grossSaleValue =
      exitCap && exitCap > 0 ? Math.round(exitNoi / exitCap) : null;
    const sellingCosts   = grossSaleValue ? Math.round(grossSaleValue * 0.015) : null;
    const loanPayoff     = Math.round(outstandingBalance);
    const netSaleProceeds =
      grossSaleValue != null && sellingCosts != null
        ? grossSaleValue - sellingCosts - loanPayoff
        : null;

    const cumulativeEM =
      equityAtClose > 0 && netSaleProceeds != null
        ? (cumulativeCF + netSaleProceeds) / equityAtClose
        : null;

    years.push({
      year: yr,
      gpr, vacancyLoss, lossToLease, concessions, badDebt, nru,
      nri, otherIncome, egi,
      payroll, repairs, turnover, contractSvc, marketing, utilities,
      gAndA, mgmtFee, insurance, reTaxes, reserves,
      totalOpex, noi,
      opMargin:   egi > 0 ? noi / egi : null,
      noiPerUnit: totalUnits > 0 ? noi / totalUnits : null,
      interest, principal, annualDS,
      capexDraw,
      cfbt, netCF,
      coc, dscr, debtYield, occupancy,
      exitNoi, exitCap, grossSaleValue, sellingCosts, loanPayoff, netSaleProceeds,
      outstandingBalance,
      cumulativeEM,
    });
  }
  return years;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function colLetter(col: number): string {
  let letter = '';
  let c = col + 1;
  while (c > 0) {
    const mod = (c - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}

function addr(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function fmtDollar(v: number | null): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(2)}%`;
}

function setComment(ws: XLSX.WorkSheet, cellAddr: string, text: string): void {
  if (!ws[cellAddr]) return;
  if (!ws[cellAddr].c) ws[cellAddr].c = [];
  (ws[cellAddr].c as Array<{ a: string; t: string }>).push({ a: 'JediRE F9', t: text });
}

// ─── Cell style helpers ──────────────────────────────────────────────────
// Color semantics (standard Excel audit convention):
//   Black    = formula / derived row (computed from inputs)  (000000 bold)
//   Blue     = user override cell    (value differs from platform) (0070C0)
//   Green    = cross-sheet link      (sourced from M07 Traffic / another sheet) (00B050)

type CellStyle = {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number; name?: string };
  fill?: { fgColor?: { rgb: string }; patternType?: string };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
  };
  alignment?: { horizontal?: string; vertical?: string };
  numFmt?: string;
};

function styleCell(ws: XLSX.WorkSheet, cellAddr: string, s: CellStyle): void {
  if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
  ws[cellAddr].s = s;
}

function styleRow(
  ws: XLSX.WorkSheet,
  rowIdx: number,
  numCols: number,
  s: CellStyle,
): void {
  for (let c = 0; c <= numCols; c++) {
    styleCell(ws, addr(rowIdx, c), s);
  }
}

// Styles
const S = {
  title:   { font: { bold: true, sz: 12, name: 'Calibri', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F1319' }, patternType: 'solid' } },
  header:  { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1B2A4A' }, patternType: 'solid' }, alignment: { horizontal: 'center' } },
  section: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: 'F5A623' } }, fill: { fgColor: { rgb: '0F1319' }, patternType: 'solid' }, border: { bottom: { style: 'thin', color: { rgb: '2A3A5A' } } } },
  formula:  { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '000000' } }, border: { top: { style: 'thin', color: { rgb: '2A3A5A' } }, bottom: { style: 'double', color: { rgb: '2A3A5A' } } } },
  override: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: '0070C0' } } },
  linked:   { font: { sz: 10, name: 'Calibri', color: { rgb: '00B050' } } },
  input:    { font: { sz: 10, name: 'Calibri', color: { rgb: '000000' } } },
} as const;

// ─── Sheet builders ──────────────────────────────────────────────────────────

// Row index constants (0-based array index → Excel row = idx + 1)
const R = {
  TITLE:    0,
  SUBTITLE: 1,
  HDRS:     3,
  GPR:      4,
  VAC:      5,
  LTL:      6,
  CONC:     7,
  BADDEBT:  8,
  NRU:      9,
  NRI:      10,
  OTH:      11,
  EGI:      12,
  // Row 13: empty
  // Row 14: EXPENSES section header (but we span it)
  PAYROLL:  15,
  REPAIRS:  16,
  TURNOVER: 17,
  CONTRACT: 18,
  MKTG:     19,
  UTIL:     20,
  GANDA:    21,
  MGMT:     22,
  INS:      23,
  RETAX:    24,
  RESV:     25,
  TOPEX:    26,
  // Row 27: empty
  NOI:      28,
  OPMARGIN: 29,
  NOIPU:    30,
  // Row 31: empty
  // Row 32: DEBT SERVICE header
  INTEREST: 33,
  PRINC:    34,
  TOTALDS:  35,
  CAPEX:    36,
  CFBT:     37,
  NETCF:    38,
  // Row 39: empty
  // Row 40: METRICS header
  COC:      41,
  DSCR:     42,
  DY:       43,
  OCC:      44,
  CEM:      45,
  // Row 46: empty
  // Row 47: EXIT header
  EXNOI:    48,
  EXCAP:    49,
  GROSSSALE:50,
  SELLING:  51,
  LOANPAY:  52,
  NETSALE:  53,
};

function buildProFormaSheet(
  f: DealFinancials,
  projs: ProjYearExport[],
  holdYears: number,
): XLSX.WorkSheet {
  const N = holdYears;
  const yearCols = Array.from({ length: N }, (_, i) => i + 1);

  // Build AoA — initialize with empty rows
  const totalRows = 55;
  const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () => []);

  // Title
  aoa[R.TITLE] = [`Pro Forma  |  ${f.dealName}  |  ${f.totalUnits} Units`];
  aoa[R.SUBTITLE] = [`Hold Period: ${holdYears} Years  |  Generated: ${new Date().toLocaleDateString()}`];

  // Headers row
  aoa[R.HDRS] = ['OPERATING STATEMENT', ...yearCols.map(y => `YR ${y}`)];

  // Section label rows
  aoa[13]  = [''];
  aoa[14]  = ['EXPENSES'];
  aoa[27]  = [''];
  aoa[31]  = [''];
  aoa[32]  = ['DEBT SERVICE'];
  aoa[36]  = [''];
  aoa[39]  = [''];
  aoa[40]  = ['METRICS'];
  aoa[46]  = [''];
  aoa[47]  = ['EXIT / REVERSION'];

  type NumRow = [string, ...number[]];

  const mkRow = (
    label: string,
    key: keyof ProjYearExport,
  ): NumRow => [
    label,
    ...projs.map(p => (p[key] as number | null) ?? 0),
  ];

  aoa[R.GPR]     = mkRow('GROSS POTENTIAL RENT', 'gpr');
  aoa[R.VAC]     = mkRow('  Vacancy Loss', 'vacancyLoss');
  aoa[R.LTL]     = mkRow('  Loss to Lease', 'lossToLease');
  aoa[R.CONC]    = mkRow('  Concessions', 'concessions');
  aoa[R.BADDEBT] = mkRow('  Bad Debt / Collection Loss', 'badDebt');
  aoa[R.NRU]     = mkRow('  Non-Revenue Units', 'nru');
  aoa[R.NRI]     = mkRow('NET RENTAL INCOME', 'nri');
  aoa[R.OTH]     = mkRow('  Other Income', 'otherIncome');
  aoa[R.EGI]     = mkRow('EFFECTIVE GROSS INCOME', 'egi');
  aoa[R.PAYROLL] = mkRow('  Payroll / Personnel', 'payroll');
  aoa[R.REPAIRS] = mkRow('  Repairs & Maintenance', 'repairs');
  aoa[R.TURNOVER]= mkRow('  Turnover / Make-Ready', 'turnover');
  aoa[R.CONTRACT]= mkRow('  Contract Services', 'contractSvc');
  aoa[R.MKTG]    = mkRow('  Marketing & Leasing', 'marketing');
  aoa[R.UTIL]    = mkRow('  Utilities', 'utilities');
  aoa[R.GANDA]   = mkRow('  G&A / Administrative', 'gAndA');
  aoa[R.MGMT]    = mkRow('  Management Fee', 'mgmtFee');
  aoa[R.INS]     = mkRow('  Insurance', 'insurance');
  aoa[R.RETAX]   = mkRow('  Real Estate Taxes', 'reTaxes');
  aoa[R.RESV]    = mkRow('  Replacement Reserves', 'reserves');
  aoa[R.TOPEX]   = mkRow('TOTAL OPERATING EXPENSES', 'totalOpex');
  aoa[R.NOI]     = mkRow('NET OPERATING INCOME', 'noi');
  aoa[R.OPMARGIN]= ['  Operating Margin %', ...projs.map(p => p.opMargin ?? 0)];
  aoa[R.NOIPU]   = ['  NOI / Unit', ...projs.map(p => p.noiPerUnit ?? 0)];
  aoa[R.INTEREST]= mkRow('  Interest', 'interest');
  aoa[R.PRINC]   = mkRow('  Principal Paydown', 'principal');
  aoa[R.TOTALDS] = mkRow('TOTAL DEBT SERVICE', 'annualDS');
  aoa[R.CAPEX]   = mkRow('  (–) CapEx Draw', 'capexDraw');
  aoa[R.CFBT]    = mkRow('CASH FLOW BEFORE TAX', 'cfbt');
  aoa[R.NETCF]   = mkRow('  Net Cash Flow', 'netCF');
  aoa[R.COC]     = ['  Cash-on-Cash Return', ...projs.map(p => p.coc ?? 0)];
  aoa[R.DSCR]    = ['  DSCR', ...projs.map(p => p.dscr ?? 0)];
  aoa[R.DY]      = ['  Debt Yield', ...projs.map(p => p.debtYield ?? 0)];
  aoa[R.OCC]     = ['  Occupancy %', ...projs.map(p => p.occupancy ?? 0)];
  aoa[R.CEM]     = ['  Cumulative Equity Multiple', ...projs.map(p => p.cumulativeEM ?? 0)];
  aoa[R.EXNOI]   = mkRow('  Forward NOI (Exit)', 'exitNoi');
  aoa[R.EXCAP]   = ['  Exit Cap Rate', ...projs.map(p => p.exitCap ?? 0)];
  aoa[R.GROSSSALE]= mkRow('  Gross Sale Value', 'grossSaleValue');
  aoa[R.SELLING] = mkRow('  (–) Selling Costs (1.5%)', 'sellingCosts');
  aoa[R.LOANPAY] = mkRow('  (–) Loan Payoff', 'loanPayoff');
  aoa[R.NETSALE] = mkRow('NET SALE PROCEEDS', 'netSaleProceeds');

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Overlay formula cells ─────────────────────────────────────────────────
  for (let y = 0; y < N; y++) {
    const col = y + 1;         // col 0=A (labels), col 1=B (YR1)...
    const C   = colLetter(col);

    // NRI = GPR - VAC - LTL - CONC - BADDEBT - NRU
    ws[addr(R.NRI, col)] = {
      t: 'n',
      f: `=${C}${R.GPR+1}-${C}${R.VAC+1}-${C}${R.LTL+1}-${C}${R.CONC+1}-${C}${R.BADDEBT+1}-${C}${R.NRU+1}`,
      v: projs[y].nri,
    };
    // EGI = NRI + OtherIncome
    ws[addr(R.EGI, col)] = {
      t: 'n',
      f: `=${C}${R.NRI+1}+${C}${R.OTH+1}`,
      v: projs[y].egi,
    };
    // Total OpEx = SUM(PAYROLL:RESV)
    ws[addr(R.TOPEX, col)] = {
      t: 'n',
      f: `=SUM(${C}${R.PAYROLL+1}:${C}${R.RESV+1})`,
      v: projs[y].totalOpex,
    };
    // NOI = EGI - TOPEX
    ws[addr(R.NOI, col)] = {
      t: 'n',
      f: `=${C}${R.EGI+1}-${C}${R.TOPEX+1}`,
      v: projs[y].noi,
    };
    // Op Margin = NOI / EGI
    ws[addr(R.OPMARGIN, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+1}/${C}${R.EGI+1}`,
      v: projs[y].opMargin ?? 0,
      z: '0.00%',
    };
    // NOI/Unit = NOI / totalUnits
    if (f.totalUnits > 0) {
      ws[addr(R.NOIPU, col)] = {
        t: 'n',
        f: `=${C}${R.NOI+1}/${f.totalUnits}`,
        v: projs[y].noiPerUnit ?? 0,
      };
    }
    // Total DS = INTEREST + PRINC
    ws[addr(R.TOTALDS, col)] = {
      t: 'n',
      f: `=${C}${R.INTEREST+1}+${C}${R.PRINC+1}`,
      v: projs[y].annualDS,
    };
    // CFBT = NOI - DS - CapEx Draw (formula now consistent with TS engine computation)
    ws[addr(R.CFBT, col)] = {
      t: 'n',
      f: `=${C}${R.NOI+1}-${C}${R.TOTALDS+1}-${C}${R.CAPEX+1}`,
      v: projs[y].cfbt,
    };
    // Net Sale Proceeds = GrossSale - Selling - LoanPayoff
    ws[addr(R.NETSALE, col)] = {
      t: 'n',
      f: `=${C}${R.GROSSSALE+1}-${C}${R.SELLING+1}-${C}${R.LOANPAY+1}`,
      v: projs[y].netSaleProceeds ?? 0,
    };

    // ── Cross-sheet formula: Vacancy Loss references M07 Traffic Projection sheet ──
    // Traffic Projection data rows start at Excel row 5 (row index 4) for Year 1.
    // Column C (index 2) = Vacancy % in the Traffic Projection sheet.
    const tvYr = f.trafficProjection?.yearly.find(t => t.year === y + 1);
    if (tvYr?.vacancyPct != null) {
      const trafficVacRow = 4 + (y + 1);   // Excel row in Traffic sheet for Year (y+1)
      ws[addr(R.VAC, col)] = {
        t: 'n',
        // Vacancy Loss = GPR × vacancy % pulled from Traffic Projection sheet
        f: `=${C}${R.GPR + 1}*'Traffic Projection'!C${trafficVacRow}`,
        v: projs[y].vacancyLoss,
      };
    }

    // ── Layer metadata cell comments on GPR row ──────────────────────────
    const gpd = f.assumptions.gprDecomposition;
    if (gpd) {
      const gprCell = addr(R.GPR, col);
      const commentLines = [
        `GPR Layer Sources (Annual):`,
        `  Resolved:  ${fmtDollar(gpd.resolvedAnnual)} (${fmtDollar(gpd.resolvedPerUnitMo ? gpd.resolvedPerUnitMo * 12 / 12 : null)}/mo/unit)`,
        gpd.platformAnnual != null ? `  Platform: ${fmtDollar(gpd.platformAnnual)}` : null,
        gpd.brokerAnnual   != null ? `  Broker:   ${fmtDollar(gpd.brokerAnnual)}` : null,
        gpd.t12Annual      != null ? `  T12 Actual: ${fmtDollar(gpd.t12Annual)}` : null,
        gpd.rentRollAnnual != null ? `  Rent Roll: ${fmtDollar(gpd.rentRollAnnual)}` : null,
      ].filter((l): l is string => l !== null).join('\n');
      setComment(ws, gprCell, commentLines);
    }

    // ── Layer metadata comment on Vacancy row ────────────────────────────
    if (tvYr?.vacancyPct != null) {
      const vacCell = addr(R.VAC, col);
      setComment(ws, vacCell,
        `Vacancy Source: M07 Traffic Engine\n  Year ${y + 1} vacancy: ${fmtPct(tvYr.vacancyPct)}\n  Occupancy: ${fmtPct(tvYr.occupancyPct)}`,
      );
    }
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 32 },                                              // Label column
    ...Array.from({ length: N }, () => ({ wch: 14 })),       // Year columns
  ];

  // Set sheet range
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: totalRows - 1, c: N },
  });

  // ── Apply cell styles (black=formula rows, blue=user overrides, green=cross-sheet M07 link) ──
  styleRow(ws, R.TITLE,   N, S.title);
  styleRow(ws, R.SUBTITLE, N, S.title);
  styleRow(ws, R.HDRS,    N, S.header);

  // Section headers
  for (const secRow of [14, 32, 40, 47]) {
    styleRow(ws, secRow, N, S.section);
  }
  styleCell(ws, addr(R.GPR, 0), S.section);

  // Formula/derived rows (black bold): NRI, EGI, TOPEX, NOI, TOTALDS, CFBT, NETSALE
  for (const fRow of [R.NRI, R.EGI, R.TOPEX, R.NOI, R.TOTALDS, R.CFBT, R.NETSALE]) {
    for (let c = 0; c <= N; c++) {
      styleCell(ws, addr(fRow, c), S.formula);
    }
  }

  // Cross-sheet linked rows (green): Vacancy cells sourced from M07 Traffic sheet
  for (let c = 1; c <= N; c++) {
    const yr = c;
    const tvYr = f.trafficProjection?.yearly.find(t => t.year === yr);
    if (tvYr?.vacancyPct != null) {
      styleCell(ws, addr(R.VAC, c), S.linked);
    }
  }

  // User override cells (blue): any cell where userOverrides[field][year] is set
  const rowFieldMap: Record<number, string> = {
    [R.GPR]: 'gpr', [R.VAC]: 'vacancy_pct', [R.LTL]: 'loss_to_lease_pct',
    [R.CONC]: 'concessions_pct', [R.BADDEBT]: 'bad_debt_pct', [R.NRU]: 'non_revenue_units_pct',
    [R.OTH]: 'other_income_per_unit', [R.PAYROLL]: 'payroll', [R.REPAIRS]: 'repairs_maintenance',
    [R.TURNOVER]: 'turnover', [R.CONTRACT]: 'contract_services', [R.MKTG]: 'marketing',
    [R.UTIL]: 'utilities', [R.GANDA]: 'g_and_a', [R.MGMT]: 'management_fee_pct',
    [R.INS]: 'insurance', [R.RETAX]: 'real_estate_tax', [R.RESV]: 'replacement_reserves',
  };
  for (const [rowStr, field] of Object.entries(rowFieldMap)) {
    const rowIdx = Number(rowStr);
    const fieldOverrides = f.userOverrides[field];
    if (!fieldOverrides) continue;
    for (let c = 1; c <= N; c++) {
      const yr = c;
      if (fieldOverrides[yr] != null) {
        styleCell(ws, addr(rowIdx, c), S.override);
      }
    }
  }

  return ws;
}

function buildTrafficSheet(f: DealFinancials, holdYears: number): XLSX.WorkSheet {
  const yearly = f.trafficProjection?.yearly ?? [];
  // T07 is a scalar from leasingSignals; repeated across all years to satisfy per-year column requirement
  const t07Scalar = f.trafficProjection?.leasingSignals?.t07LeaseUpWeeksTo95 ?? null;

  const aoa: (string | number | null)[][] = [
    ['Traffic Projection — M07 Engine', null, null, null, null, null, null, null, null],
    [`Deal: ${f.dealName}  |  ${f.totalUnits} Units  |  Hold: ${holdYears} Yrs  |  Generated: ${new Date().toLocaleDateString()}`],
    [],
    // T07 column added per-year (repeats scalar value; per-year trajectory not yet in M07 output)
    ['Year', 'Occupancy %', 'Vacancy %', 'Eff Rent/Mo', 'Rent Growth %',
     'T01 Weekly Tours', 'T05 Closing Ratio', 'T06 Weekly Leases', 'T07 Lease-Up Wks (to 95%)'],
    ...Array.from({ length: holdYears }, (_, i) => {
      const yr = i + 1;
      const tv = yearly.find(t => t.year === yr);
      return [
        yr,
        tv?.occupancyPct ?? null,
        tv?.vacancyPct   ?? null,
        tv?.effRent      ?? null,
        tv?.rentGrowthPct ?? null,
        tv?.t01WeeklyTours ?? null,
        tv?.t05ClosingRatio ?? null,
        tv?.t06WeeklyLeases ?? null,
        t07Scalar,   // scalar, repeated per year (trajectory data not available per-year)
      ];
    }),
    [],
    ['— Calibrated Signals —'],
    ['Last Calibrated', f.trafficProjection?.calibrated.lastCalibrated ?? '—'],
    ['Platform Vacancy', f.trafficProjection?.calibrated.vacancyPct ?? null],
    ['Platform Rent Growth', f.trafficProjection?.calibrated.rentGrowthPct ?? null],
    ['Platform Exit Cap', f.trafficProjection?.calibrated.exitCap ?? null],
    [],
    ['— Leasing Velocity —'],
    ['T01 Weekly Tours', f.trafficProjection?.leasingSignals?.t01WeeklyTours ?? null],
    ['T05 Closing Ratio', f.trafficProjection?.leasingSignals?.t05ClosingRatio ?? null],
    ['T06 Weekly Leases', f.trafficProjection?.leasingSignals?.t06WeeklyLeases ?? null],
    ['T07 Lease-Up to 95% (wks)', t07Scalar],
    ['Stabilized Occupancy', f.trafficProjection?.leasingSignals?.stabilizedOccupancyPct ?? null],
    ['Model Confidence', f.trafficProjection?.leasingSignals?.confidence != null
      ? `${f.trafficProjection.leasingSignals.confidence}%` : '—'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 },
  ];

  // ── Apply styles to traffic sheet ────────────────────────────────────────
  const numDataCols = 8;
  styleRow(ws, 0, numDataCols, S.title);
  styleRow(ws, 1, numDataCols, S.title);
  styleRow(ws, 3, numDataCols, S.header);

  return ws;
}

function buildAssumptionsSheet(f: DealFinancials): XLSX.WorkSheet {
  const cs  = f.capitalStack;
  const ass = f.assumptions;
  const gpd = ass.gprDecomposition;

  const aoa: (string | number | null)[][] = [
    [`Assumptions  |  ${f.dealName}  |  ${f.totalUnits} Units  |  ${new Date().toLocaleDateString()}`],
    [],
    ['GPR SOURCE DECOMPOSITION'],
    ['Source', 'Annual ($)', 'Per Unit / Mo ($)'],
    ['RESOLVED', gpd?.resolvedAnnual ?? null, gpd?.resolvedPerUnitMo ?? null],
    ['PLATFORM', gpd?.platformAnnual ?? null, gpd?.platformPerUnitMo ?? null],
    ['BROKER',   gpd?.brokerAnnual   ?? null, gpd?.brokerPerUnitMo   ?? null],
    ['T12 ACTUAL',gpd?.t12Annual     ?? null, gpd?.t12PerUnitMo      ?? null],
    ['RENT ROLL', gpd?.rentRollAnnual ?? null, null],
    [],
    ['CAPITAL STACK'],
    ['Purchase Price',    cs.purchasePrice    ?? null],
    ['Loan Amount',       cs.loanAmount       ?? null],
    ['Equity at Close',   cs.equityAtClose    ?? null],
    ['LTC %',             cs.ltcPct           ?? null],
    ['Interest Rate',     cs.interestRate     ?? null],
    ['IO Period (months)',cs.ioPeriodMonths   ?? null],
    ['Amortization (yrs)',cs.amortizationYears ?? null],
    ['DSCR Min',          cs.dscrMin          ?? null],
    ['Origination Fee %', cs.originationFeePct ?? null],
    ['Price Per Unit',    cs.pricePerUnit      ?? null],
    [],
    ['SECTION A — BASE YEAR (Document Sources)'],
    ['Hold Period (yrs)',           ass.holdYears],
    ['Exit Cap Rate',               ass.exitCap         ?? null],
    ['Rent Growth Year 1',          ass.rentGrowthYr1   ?? null],
    ['Rent Growth Stabilized',      ass.rentGrowthStabilized ?? null],
    [],
    ['SECTION B — TRAJECTORY (Y2+ Growth Rates)'],
    ['OpEx Growth % / yr',          ass.opexGrowthPct        ?? null],
    ['Concession Burn-Off % / yr',  ass.concessionBurnOffPct ?? null],
    [],
    ['PER-YEAR ASSUMPTIONS'],
    ['Year', 'Rent Growth %', 'Vacancy %', 'Exit Cap (if last yr)', 'CapEx Draw ($/unit)'],
    ...ass.perYear.map(p => [
      p.year,
      p.rentGrowthPct     ?? null,
      p.vacancyPct        ?? null,
      p.exitCapIfLastYear ?? null,
      p.capexDraw         ?? null,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
  return ws;
}

// ─── Projections sheet (separate tab: Year 1 cross-refs Pro Forma; Y2+ direct) ─

function buildProjectionsSheet(
  f: DealFinancials,
  projs: ProjYearExport[],
  holdYears: number,
): XLSX.WorkSheet {
  const N = holdYears;
  const yearCols = Array.from({ length: N }, (_, i) => i + 1);
  const totalRows = 55;
  const aoa: (string | number | null)[][] = Array.from({ length: totalRows }, () => []);

  // Use same row layout as Pro Forma so column letters align for cross-sheet refs.
  // Year 1 key line items (GPR, EGI, NOI, TOPEX, CFBT) use ='Pro Forma'!B{row}
  // cross-sheet references rather than duplicated formulas.
  aoa[R.TITLE]    = [`Projections  |  ${f.dealName}  |  ${f.totalUnits} Units`];
  aoa[R.SUBTITLE] = [`Hold Period: ${holdYears} Years  |  Generated: ${new Date().toLocaleDateString()}`];
  aoa[R.HDRS]     = ['OPERATING STATEMENT', ...yearCols.map(y => `YR ${y}`)];

  const mkRow = (label: string, key: keyof ProjYearExport): (string | number | null)[] =>
    [label, ...projs.map(p => (p[key] as number | null) ?? null)];

  aoa[R.GPR]     = mkRow('Gross Potential Rent', 'gpr');
  aoa[R.VAC]     = mkRow('  (–) Vacancy Loss', 'vacancyLoss');
  aoa[R.LTL]     = mkRow('  (–) Loss to Lease', 'lossToLease');
  aoa[R.CONC]    = mkRow('  (–) Concessions', 'concessions');
  aoa[R.BADDEBT] = mkRow('  (–) Bad Debt', 'badDebt');
  aoa[R.NRU]     = mkRow('  (–) Non-Revenue Units', 'nru');
  aoa[R.NRI]     = mkRow('Net Rental Income', 'nri');
  aoa[R.OTH]     = mkRow('  Other Income', 'otherIncome');
  aoa[R.EGI]     = mkRow('EFFECTIVE GROSS INCOME', 'egi');
  aoa[14]        = [''];
  aoa[14]        = ['EXPENSES'];
  aoa[R.PAYROLL] = mkRow('  Payroll & Benefits', 'payroll');
  aoa[R.REPAIRS] = mkRow('  R&M / Make-Ready', 'repairs');
  aoa[R.TURNOVER]= mkRow('  Turnover / Make-Ready', 'turnover');
  aoa[R.CONTRACT]= mkRow('  Contract Services', 'contractSvc');
  aoa[R.MKTG]    = mkRow('  Marketing & Leasing', 'marketing');
  aoa[R.UTIL]    = mkRow('  Utilities', 'utilities');
  aoa[R.GANDA]   = mkRow('  G&A / Administrative', 'gAndA');
  aoa[R.MGMT]    = mkRow('  Management Fee', 'mgmtFee');
  aoa[R.INS]     = mkRow('  Insurance', 'insurance');
  aoa[R.RETAX]   = mkRow('  Real Estate Taxes', 'reTaxes');
  aoa[R.RESV]    = mkRow('  Replacement Reserves', 'reserves');
  aoa[R.TOPEX]   = mkRow('TOTAL OPERATING EXPENSES', 'totalOpex');
  aoa[R.NOI]     = mkRow('NET OPERATING INCOME', 'noi');
  aoa[R.INTEREST]= mkRow('  Interest', 'interest');
  aoa[R.PRINC]   = mkRow('  Principal Paydown', 'principal');
  aoa[R.TOTALDS] = mkRow('TOTAL DEBT SERVICE', 'annualDS');
  aoa[R.CAPEX]   = mkRow('  (–) CapEx Draw', 'capexDraw');
  aoa[R.CFBT]    = mkRow('CASH FLOW BEFORE TAX', 'cfbt');
  aoa[R.NETCF]   = mkRow('  Net Cash Flow', 'netCF');

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Year 1 cross-sheet references for the 5 key line items ───────────────
  // 'Pro Forma' column B (col index 1) = Year 1. Row index +1 = Excel row number.
  const Y1_COL = 'B';
  const crossRef = (rowIdx: number) => `='Pro Forma'!${Y1_COL}${rowIdx + 1}`;
  for (const rowIdx of [R.GPR, R.EGI, R.NOI, R.TOPEX, R.CFBT]) {
    ws[addr(rowIdx, 1)] = { t: 'n', f: crossRef(rowIdx), v: projs[0]?.[
      ({ [R.GPR]: 'gpr', [R.EGI]: 'egi', [R.NOI]: 'noi', [R.TOPEX]: 'totalOpex', [R.CFBT]: 'cfbt' } as Record<number, keyof ProjYearExport>)[rowIdx]
    ] as number ?? 0 };
  }

  // ── Y2-YN formula cells (same pattern as Pro Forma sheet) ────────────────
  for (let y = 1; y < N; y++) {    // y=0 is Year 1, already handled above
    const col = y + 1;
    const C   = colLetter(col);
    ws[addr(R.NRI,   col)] = { t: 'n', f: `=${C}${R.GPR+1}-${C}${R.VAC+1}-${C}${R.LTL+1}-${C}${R.CONC+1}-${C}${R.BADDEBT+1}-${C}${R.NRU+1}`, v: projs[y].nri };
    ws[addr(R.EGI,   col)] = { t: 'n', f: `=${C}${R.NRI+1}+${C}${R.OTH+1}`, v: projs[y].egi };
    ws[addr(R.TOPEX, col)] = { t: 'n', f: `=SUM(${C}${R.PAYROLL+1}:${C}${R.RESV+1})`, v: projs[y].totalOpex };
    ws[addr(R.NOI,   col)] = { t: 'n', f: `=${C}${R.EGI+1}-${C}${R.TOPEX+1}`, v: projs[y].noi };
    ws[addr(R.TOTALDS,col)]= { t: 'n', f: `=${C}${R.INTEREST+1}+${C}${R.PRINC+1}`, v: projs[y].annualDS };
    ws[addr(R.CFBT,  col)] = { t: 'n', f: `=${C}${R.NOI+1}-${C}${R.TOTALDS+1}-${C}${R.CAPEX+1}`, v: projs[y].cfbt };
  }

  ws['!cols'] = [{ wch: 32 }, ...Array.from({ length: N }, () => ({ wch: 14 }))];
  ws['!ref']  = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: N } });
  return ws;
}

// ─── Main workbook builder ────────────────────────────────────────────────────

export function buildF9Workbook(f: DealFinancials, holdYears: number): XLSX.WorkBook {
  const projs = buildProjectionsForExport(f, holdYears);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildProFormaSheet(f, projs, holdYears), 'Pro Forma');
  XLSX.utils.book_append_sheet(wb, buildProjectionsSheet(f, projs, holdYears), 'Projections');
  XLSX.utils.book_append_sheet(wb, buildTrafficSheet(f, holdYears), 'Traffic Projection');
  XLSX.utils.book_append_sheet(wb, buildAssumptionsSheet(f), 'Assumptions');

  return wb;
}
