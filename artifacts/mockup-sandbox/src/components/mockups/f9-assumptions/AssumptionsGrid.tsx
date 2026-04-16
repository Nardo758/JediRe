import React, { useState } from "react";
import { Lock, Edit2, Download, AlertTriangle, TrendingUp, Building2, DollarSign, BarChart3, ChevronRight } from "lucide-react";

type Page = "OVERVIEW" | "DEBT" | "TAXES";
type HoldYears = "5 YR" | "7 YR" | "10 YR";

// ─── Shared cell renderer ─────────────────────────────────────────────────────

function Cell({
  v, type = "normal", span, align = "right", tooltip,
}: {
  v: string; type?: "normal"|"ai"|"override"|"m07"|"locked"|"flagged"|"computed"|"warn"|"good"|"header";
  span?: number; align?: "right"|"left"|"center"; tooltip?: string;
}) {
  const base = `relative px-2 py-1 text-[10px] font-mono tabular-nums border-r border-[#1e1e1e] group `;
  const alignCls = align === "left" ? "text-left " : align === "center" ? "text-center " : "text-right ";
  const variants: Record<string, string> = {
    normal:   "text-slate-300 hover:border hover:border-blue-500/50 hover:bg-[#1e1e1e] cursor-text ",
    ai:       "text-cyan-400 ",
    override: "text-blue-400 bg-[#1e293b]/30 ",
    m07:      "text-purple-400 ",
    locked:   "text-slate-500 bg-[#0f0f0f] ",
    flagged:  "text-amber-500 bg-amber-900/20 ",
    computed: "text-slate-200 font-bold ",
    warn:     "text-amber-400 bg-amber-900/10 ",
    good:     "text-green-400 ",
    header:   "text-slate-400 font-bold bg-[#111111] ",
  };
  const icons: Partial<Record<string, React.ReactNode>> = {
    ai:       <sup className="absolute top-[2px] right-[2px] text-[6px] text-cyan-500">AI</sup>,
    override: <Edit2 className="absolute top-[2px] left-[2px] w-2 h-2 text-blue-500 opacity-0 group-hover:opacity-100" />,
    m07:      <sup className="absolute top-[2px] right-[2px] text-[6px] text-purple-500">M07</sup>,
    locked:   <Lock className="absolute top-[2px] left-[2px] w-2 h-2 text-slate-600" />,
    flagged:  <AlertTriangle className="absolute top-[2px] left-[2px] w-2 h-2 text-amber-500" />,
  };
  return (
    <td className={base + alignCls + (variants[type] ?? variants.normal)} colSpan={span} title={tooltip}>
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

// ─── Debt maths ──────────────────────────────────────────────────────────────

const LOAN       = 42_500_000;
const RATE_ANN   = 0.0675;
const AMORT_YRS  = 30;
const IO_YEARS   = 2;        // first 2 years interest-only
const HOLD_YRS   = 10;
const ORIG_FEE   = 0.0075;
const SOFR_BASE  = 0.0534;   // 5.34% current SOFR
const SPREAD     = 0.0141;   // 141bps spread → 6.75%

const NOI_YR1    = 3_730_000;
const NOI_GROWTH = 0.034;    // 3.4% annual

// Mortgage constant (annual) for fully-amortizing period
const i30 = RATE_ANN / 12;
const n30 = AMORT_YRS * 12;
const mortgageConstant = (i30 * Math.pow(1 + i30, n30)) / (Math.pow(1 + i30, n30) - 1) * 12;

interface DebtYear {
  yr: number;
  begBalance: number;
  annualPayment: number;
  interest: number;
  principal: number;
  endBalance: number;
  noi: number;
  dscr: number;
  ltv: number;
}

function buildDebtSchedule(): DebtYear[] {
  const rows: DebtYear[] = [];
  let bal = LOAN;
  // Stabilized value year 1 estimate (NOI1 / 5.5% cap)
  const acqValue = 65_000_000;

  for (let yr = 1; yr <= HOLD_YRS; yr++) {
    const noi = Math.round(NOI_YR1 * Math.pow(1 + NOI_GROWTH, yr - 1));
    const isIO = yr <= IO_YEARS;
    const interest = Math.round(bal * RATE_ANN);
    const payment  = isIO ? interest : Math.round(bal * mortgageConstant);
    const principal = isIO ? 0 : payment - interest;
    const endBal   = Math.round(bal - principal);
    const ltv      = endBal / (acqValue * Math.pow(1.024, yr - 1)); // value grows ~2.4%/yr

    rows.push({
      yr, begBalance: Math.round(bal), annualPayment: payment,
      interest, principal, endBalance: endBal,
      noi, dscr: noi / payment, ltv,
    });
    bal = endBal;
  }
  return rows;
}

const DEBT_SCHEDULE = buildDebtSchedule();

// Loan sizing
const MIN_DSCR      = 1.25;
const MAX_LTV       = 0.65;
const PURCHASE      = 65_000_000;
const MAX_DSCR_LOAN = Math.round((NOI_YR1 / MIN_DSCR) / mortgageConstant);
const MAX_LTV_LOAN  = Math.round(PURCHASE * MAX_LTV);
const SIZING_CONST  = Math.min(MAX_DSCR_LOAN, MAX_LTV_LOAN);

// ─── Tax maths ───────────────────────────────────────────────────────────────

const UNITS           = 304;
const ASSESSED_VALUE  = 58_200_000;  // current county assessed value
const MILLAGE_RATE    = 14.19;       // mills (per $1,000 AV)
const CURRENT_TAX     = Math.round(ASSESSED_VALUE * MILLAGE_RATE / 1000); // ~$825,558
const ASSESSMENT_RATIO= 0.40;        // county assesses at 40% of market value
const PURCHASE_PRICE  = 65_000_000;
const REASSESS_AV     = Math.round(PURCHASE_PRICE * ASSESSMENT_RATIO);    // ~$26M
const REASSESSED_TAX  = Math.round(REASSESS_AV * MILLAGE_RATE / 1000);    // actual assessed could be higher — Georgia reassesses partially
const TAX_GROWTH      = 0.040;       // 4.0% annual escalation
const EGI_YR1         = 5_850_000;

interface TaxYear {
  yr: number;
  assessedValue: number;
  annualTax: number;
  perUnit: number;
  taxAsEgiPct: number;
  delta: number;  // change vs prior yr
}

function buildTaxSchedule(): TaxYear[] {
  const rows: TaxYear[] = [];
  // Year 1: if reassessment triggers, use reassessed; else use current + growth
  // Assume county reassesses at sale — Georgia is a full-disclosure state
  // So Yr1 = reassessed × (1 + TAX_GROWTH * partial year blend)
  const yr1Tax = Math.max(CURRENT_TAX, REASSESSED_TAX);
  const egi = EGI_YR1;

  for (let yr = 1; yr <= HOLD_YRS; yr++) {
    const tax = Math.round(yr1Tax * Math.pow(1 + TAX_GROWTH, yr - 1));
    const av  = Math.round(ASSESSED_VALUE * Math.pow(1 + TAX_GROWTH, yr - 1));
    const pu  = Math.round(tax / UNITS);
    const pu_egi = Math.round(egi * Math.pow(1 + 0.033, yr - 1));
    rows.push({
      yr, assessedValue: av, annualTax: tax, perUnit: pu,
      taxAsEgiPct: tax / pu_egi,
      delta: yr > 1 ? Math.round(tax - Math.round(yr1Tax * Math.pow(1 + TAX_GROWTH, yr - 2))) : yr1Tax - CURRENT_TAX,
    });
  }
  return rows;
}

const TAX_SCHEDULE = buildTaxSchedule();

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt$ = (n: number, dec = 0) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: dec, minimumFractionDigits: dec });
const fmtM = (n: number) => "$" + (n / 1_000_000).toFixed(2) + "M";
const fmtK = (n: number) => "$" + Math.round(n / 1000).toLocaleString() + "K";
const fmtPct = (n: number, dec = 2) => (n * 100).toFixed(dec) + "%";
const fmtX = (n: number) => n.toFixed(2) + "×";

// ─── Page: DEBT ──────────────────────────────────────────────────────────────

function DebtPage({ holdYears }: { holdYears: number }) {
  const schedule = DEBT_SCHEDULE.slice(0, holdYears);
  const cols = holdYears + 2; // label + N years + summary

  const dscrType = (d: number): "good" | "warn" | "flagged" =>
    d >= 1.40 ? "good" : d >= 1.25 ? "normal" as "good" : d >= 1.15 ? "warn" : "flagged";

  return (
    <div className="flex flex-col gap-0 overflow-auto">
      {/* Loan Terms Card */}
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: "LOAN AMOUNT",     value: fmtM(LOAN),               sub: fmt$(LOAN / UNITS) + " / unit" },
          { label: "INTEREST RATE",   value: (RATE_ANN * 100).toFixed(2) + "%",  sub: `SOFR ${(SOFR_BASE*100).toFixed(2)}% + ${(SPREAD*100).toFixed(0)}bps` },
          { label: "STRUCTURE",       value: `${IO_YEARS}YR I/O → ${AMORT_YRS}YR`,    sub: "Senior fixed-rate" },
          { label: "ORIGINATION FEE", value: (ORIG_FEE * 100).toFixed(2) + "%", sub: fmt$(LOAN * ORIG_FEE) + " at close" },
          { label: "LTC",             value: fmtPct(LOAN / PURCHASE),   sub: `Max ${fmtPct(MAX_LTV)} → ${fmtM(MAX_LTV_LOAN)}` },
          { label: "MAX LOAN (DSCR)", value: fmtM(MAX_DSCR_LOAN),       sub: `@${MIN_DSCR}× min DSCR | constraint: ${SIZING_CONST === MAX_DSCR_LOAN ? "↓ DSCR" : "↓ LTV"}` },
          { label: "SIZING CONSTRAINT",value: fmtM(SIZING_CONST),       sub: `Selected: ${fmtM(LOAN)} (${fmtPct(LOAN/SIZING_CONST)} of max)` },
          { label: "DEBT CONSTANT",   value: fmtPct(mortgageConstant, 3), sub: "Annual payment / loan balance" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>

      {/* Amortization Schedule */}
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">
              DEBT SERVICE SCHEDULE
            </th>
            {schedule.map(r => (
              <th key={r.yr} className={`px-2 py-1.5 text-right text-[10px] font-bold min-w-[84px] border-r border-[#1e1e1e] ${r.yr <= IO_YEARS ? "text-amber-500/70" : "text-slate-500"}`}>
                YR {r.yr} {r.yr <= IO_YEARS ? "·IO" : ""}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / AVG</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. BEGINNING BALANCE" colSpan={cols} />
          <Row label="Outstanding Principal">
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.begBalance)} type="normal" />)}
            <Cell v="—" type="locked" />
          </Row>

          <SectionHeader label="B. DEBT SERVICE" colSpan={cols} />
          <Row label="Interest Payment" locked>
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.interest)} type={r.yr <= IO_YEARS ? "warn" : "normal"} />)}
            <Cell v={fmtM(schedule.reduce((s, r) => s + r.interest, 0))} type="computed" />
          </Row>
          <Row label="Principal Payment" locked>
            {schedule.map(r => <Cell key={r.yr} v={r.principal === 0 ? "—" : fmtM(r.principal)} type={r.principal === 0 ? "locked" : "normal"} />)}
            <Cell v={fmtM(schedule.reduce((s, r) => s + r.principal, 0))} type="computed" />
          </Row>
          <Row label="Total Debt Service">
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.annualPayment)} type="computed" />)}
            <Cell v={fmtM(schedule.reduce((s, r) => s + r.annualPayment, 0))} type="computed" />
          </Row>

          <SectionHeader label="C. NOI vs DEBT SERVICE" colSpan={cols} />
          <Row label="Net Operating Income" locked>
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.noi)} type="locked" />)}
            <Cell v={fmtM(schedule.reduce((s, r) => s + r.noi, 0))} type="computed" />
          </Row>
          <Row label="Debt Service Coverage (DSCR)">
            {schedule.map(r => (
              <Cell key={r.yr} v={fmtX(r.dscr)} type={dscrType(r.dscr)}
                tooltip={`NOI ${fmtM(r.noi)} ÷ DS ${fmtM(r.annualPayment)}`} />
            ))}
            <Cell v={fmtX(schedule.reduce((s, r) => s + r.dscr, 0) / schedule.length)} type="computed" />
          </Row>
          <Row label="NOI ÷ DS Gap ($)">
            {schedule.map(r => {
              const gap = r.noi - r.annualPayment;
              return <Cell key={r.yr} v={(gap > 0 ? "+" : "") + fmtK(gap)} type={gap > 0 ? "good" : "warn"} />;
            })}
            <Cell v="—" type="locked" />
          </Row>

          <SectionHeader label="D. LOAN BALANCE & LTV" colSpan={cols} />
          <Row label="Ending Balance">
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.endBalance)} type="normal" />)}
            <Cell v={fmtM(DEBT_SCHEDULE[holdYears - 1]?.endBalance ?? 0)} type="computed" />
          </Row>
          <Row label="LTV at Year-End">
            {schedule.map(r => (
              <Cell key={r.yr} v={fmtPct(r.ltv)} type={r.ltv > 0.75 ? "warn" : r.ltv > 0.65 ? "normal" : "good"}
                tooltip={`Balance ${fmtM(r.endBalance)} ÷ Projected Value`} />
            ))}
            <Cell v={fmtPct(schedule[schedule.length - 1]?.ltv ?? 0)} type="computed" />
          </Row>

          <SectionHeader label="E. MAX LOAN SIZING" colSpan={cols} />
          <tr className="border-b border-[#1e1e1e]/50 h-[22px] bg-[#0a0a1e]/40">
            <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a1e]/60 border-r border-[#1e1e1e] z-10 min-w-[220px]" />
            <Cell v="CONSTRAINT" type="header" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v="HEADROOM vs ACTUAL" type="header" align="center" span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </tr>
          <Row label="Max Loan by DSCR">
            <Cell v={fmtM(MAX_DSCR_LOAN)} type={MAX_DSCR_LOAN < LOAN ? "warn" : "good"} span={Math.ceil(holdYears / 2)} />
            <Cell v={(MAX_DSCR_LOAN >= LOAN ? "+" : "") + fmtM(MAX_DSCR_LOAN - LOAN) + " vs actual"} type={MAX_DSCR_LOAN >= LOAN ? "good" : "flagged"} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Max Loan by LTV">
            <Cell v={fmtM(MAX_LTV_LOAN)} type={MAX_LTV_LOAN < LOAN ? "warn" : "good"} span={Math.ceil(holdYears / 2)} />
            <Cell v={(MAX_LTV_LOAN >= LOAN ? "+" : "") + fmtM(MAX_LTV_LOAN - LOAN) + " vs actual"} type={MAX_LTV_LOAN >= LOAN ? "good" : "flagged"} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
          <Row label="Binding Constraint">
            <Cell v={SIZING_CONST === MAX_DSCR_LOAN ? "DSCR" : "LTV"} type="computed" align="center" span={Math.ceil(holdYears / 2)} />
            <Cell v={fmtM(SIZING_CONST - LOAN) + " gap to limit"} type={SIZING_CONST >= LOAN ? "good" : "flagged"} span={holdYears - Math.ceil(holdYears / 2) + 1} />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── Page: TAXES ─────────────────────────────────────────────────────────────

function TaxesPage({ holdYears }: { holdYears: number }) {
  const schedule = TAX_SCHEDULE.slice(0, holdYears);
  const cols = holdYears + 2;
  const yearOneShock = schedule[0]?.annualTax ?? 0 - CURRENT_TAX;
  const reassessmentDelta = Math.round(schedule[0]?.annualTax - CURRENT_TAX);

  return (
    <div className="flex flex-col gap-0">
      {/* Tax Context Cards */}
      <div className="grid grid-cols-4 gap-px bg-[#1e1e1e] border-b border-[#1e1e1e]">
        {[
          { label: "CURRENT TAX BILL (T12)", value: fmt$(CURRENT_TAX),        sub: fmt$(Math.round(CURRENT_TAX / UNITS)) + " / unit / yr" },
          { label: "COUNTY ASSESSED VALUE",  value: fmtM(ASSESSED_VALUE),      sub: "Assessment ratio: 40% of market" },
          { label: "MILLAGE RATE",           value: MILLAGE_RATE.toFixed(3) + " mills", sub: "Per $1,000 of assessed value · Fulton Co." },
          { label: "REASSESSED AT PURCHASE", value: fmt$(schedule[0]?.annualTax ?? 0),  sub: reassessmentDelta > 0 ? "+" + fmt$(reassessmentDelta) + " vs T12" : fmt$(Math.abs(reassessmentDelta)) + " savings vs T12", },
          { label: "PURCHASE PRICE",         value: fmtM(PURCHASE_PRICE),      sub: fmtPct(LOAN / PURCHASE_PRICE) + " LTC basis" },
          { label: "REASSESSED AV",          value: fmtM(REASSESS_AV),         sub: "Market × assessment ratio (40%)" },
          { label: "TAX GROWTH RATE",        value: (TAX_GROWTH * 100).toFixed(1) + "% / yr", sub: "Statutory cap 4% · Georgia homestead" },
          { label: "APPEAL STATUS",          value: "NOT FILED",               sub: "Est. savings $48K–$82K if appealed" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="flex flex-col gap-0.5 p-3 bg-[#0a0a0a]">
            <span className="text-[9px] font-bold tracking-wider text-slate-500">{label}</span>
            <span className="text-sm font-mono font-bold text-slate-100">{value}</span>
            <span className="text-[9px] text-slate-600 font-mono">{sub}</span>
          </div>
        ))}
      </div>

      {/* Reassessment Alert */}
      {reassessmentDelta > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-900/20 border-b border-amber-500/20 text-[11px] text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Year-1 Tax Shock:</strong> Purchase triggers reassessment in Fulton County (full-disclosure state).
            Expected Yr1 bill {fmt$(schedule[0]?.annualTax ?? 0)} vs current T12 {fmt$(CURRENT_TAX)} → delta{" "}
            {reassessmentDelta > 0 ? "+" : ""}{fmt$(reassessmentDelta)} ({fmtPct(reassessmentDelta / CURRENT_TAX)} increase).
            <span className="ml-2 text-amber-300 font-bold">Consider tax appeal escrow in operating budget.</span>
          </span>
        </div>
      )}

      {/* Annual Tax Schedule */}
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
        <thead className="sticky top-0 z-10 bg-[#111111]">
          <tr className="border-b border-[#1e1e1e]">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold text-slate-500 w-[220px] sticky left-0 bg-[#111111] z-20 border-r border-[#1e1e1e]">
              REAL ESTATE TAX SCHEDULE
            </th>
            {schedule.map(r => (
              <th key={r.yr} className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[84px] border-r border-[#1e1e1e]">
                YR {r.yr}
              </th>
            ))}
            <th className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-500 min-w-[80px]">TOTAL / CAGR</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="A. ASSESSED VALUE TRAJECTORY" colSpan={cols} />
          <Row label="County Assessed Value" locked>
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue)} type="locked" />)}
            <Cell v={fmtPct(Math.pow(schedule[schedule.length-1].assessedValue / schedule[0].assessedValue, 1 / (holdYears - 1)) - 1)} type="computed" />
          </Row>
          <Row label="Implied Market Value">
            {schedule.map(r => <Cell key={r.yr} v={fmtM(r.assessedValue / ASSESSMENT_RATIO)} type="ai" tooltip="Assessed ÷ 40% assessment ratio" />)}
            <Cell v="—" type="locked" />
          </Row>

          <SectionHeader label="B. ANNUAL TAX BILL" colSpan={cols} />
          <Row label={`Current T12 Bill (baseline)`} locked>
            {schedule.map(r => <Cell key={r.yr} v={r.yr === 1 ? fmt$(CURRENT_TAX) : "—"} type="locked" />)}
            <Cell v={fmt$(CURRENT_TAX)} type="locked" />
          </Row>
          <Row label="Pro Forma Tax Bill">
            {schedule.map((r, i) => (
              <Cell key={r.yr} v={fmt$(r.annualTax)} type={r.yr === 1 && reassessmentDelta > 0 ? "flagged" : "normal"}
                tooltip={r.yr === 1 && reassessmentDelta > 0 ? `+${fmt$(reassessmentDelta)} Yr1 reassessment shock` : undefined} />
            ))}
            <Cell v={fmt$(schedule.reduce((s, r) => s + r.annualTax, 0))} type="computed" />
          </Row>
          <Row label="YoY Tax Increase ($)">
            {schedule.map(r => (
              <Cell key={r.yr} v={r.yr === 1 ? (reassessmentDelta > 0 ? "+" + fmtK(reassessmentDelta) : fmtK(reassessmentDelta)) : "+" + fmtK(r.delta)}
                type={r.yr === 1 && reassessmentDelta > 5000 ? "warn" : "normal"} />
            ))}
            <Cell v={fmtK(schedule[schedule.length - 1].annualTax - schedule[0].annualTax)} type="computed" />
          </Row>
          <Row label="Tax Growth Rate %">
            {schedule.map(r => (
              <Cell key={r.yr} v={r.yr === 1 ? fmtPct(reassessmentDelta / CURRENT_TAX) : fmtPct(TAX_GROWTH)}
                type={r.yr === 1 && reassessmentDelta / CURRENT_TAX > 0.10 ? "warn" : "normal"} />
            ))}
            <Cell v={fmtPct(TAX_GROWTH)} type="computed" />
          </Row>

          <SectionHeader label="C. TAX BURDEN RATIOS" colSpan={cols} />
          <Row label="Tax / Unit / Year">
            {schedule.map(r => <Cell key={r.yr} v={fmt$(r.perUnit)} type="normal" tooltip={`${fmt$(r.annualTax)} ÷ ${UNITS} units`} />)}
            <Cell v={fmt$(schedule[schedule.length - 1].perUnit)} type="computed" />
          </Row>
          <Row label="Tax as % of EGI">
            {schedule.map(r => (
              <Cell key={r.yr} v={fmtPct(r.taxAsEgiPct)}
                type={r.taxAsEgiPct > 0.16 ? "warn" : r.taxAsEgiPct > 0.13 ? "normal" : "good"}
                tooltip={`${fmt$(r.annualTax)} ÷ EGI`} />
            ))}
            <Cell v={fmtPct(schedule.reduce((s, r) => s + r.taxAsEgiPct, 0) / schedule.length)} type="computed" />
          </Row>
          <Row label="Tax as % of NOI">
            {schedule.map((r, i) => {
              const noi = DEBT_SCHEDULE[i]?.noi ?? NOI_YR1;
              return <Cell key={r.yr} v={fmtPct(r.annualTax / noi)}
                type={r.annualTax / noi > 0.23 ? "warn" : "good"}
                tooltip={`${fmt$(r.annualTax)} ÷ NOI ${fmtM(noi)}`} />;
            })}
            <Cell v="—" type="locked" />
          </Row>

          <SectionHeader label="D. T12 vs PRO FORMA RECONCILIATION" colSpan={cols} />
          <tr className="border-b border-[#1e1e1e]/50 h-[22px]">
            <td className="px-3 py-1 text-[11px] text-slate-400 sticky left-0 bg-[#0a0a0a] border-r border-[#1e1e1e] z-10 min-w-[220px]" />
            <Cell v="T12 ACTUAL" type="header" align="center" span={2} />
            <Cell v="PLATFORM ESTIMATE" type="header" align="center" span={2} />
            <Cell v="TAX BILL (FILED)" type="header" align="center" span={2} />
            <Cell v="PRO FORMA (BUY)" type="header" align="center" span={holdYears - 6 >= 1 ? holdYears - 6 : 1} />
            <Cell v="DELTA" type="header" align="center" span={holdYears > 8 ? holdYears - 8 : 1} />
            <Cell v="—" type="header" />
          </tr>
          <Row label="Annual Tax (reconciled)">
            <Cell v={fmt$(CURRENT_TAX)} type="normal" span={2} />
            <Cell v={fmt$(Math.round(PURCHASE_PRICE * 0.0125))} type="ai" span={2} tooltip="Platform: 1.25% of purchase price" />
            <Cell v={fmt$(CURRENT_TAX - 12000)} type="normal" span={2} tooltip="As filed with county assessor" />
            <Cell v={fmt$(schedule[0]?.annualTax ?? 0)} type={reassessmentDelta > 5000 ? "flagged" : "good"} span={holdYears - 6 >= 1 ? holdYears - 6 : 1} />
            <Cell v={(reassessmentDelta > 0 ? "+" : "") + fmt$(reassessmentDelta)} type={reassessmentDelta > 5000 ? "warn" : "good"} span={holdYears > 8 ? holdYears - 8 : 1} />
            <Cell v="—" type="locked" />
          </Row>
        </tbody>
      </table>
    </div>
  );
}

// ─── Overview Page (existing grid) ───────────────────────────────────────────

function OverviewPage({ holdYears }: { holdYears: number }) {
  const years = Array.from({ length: holdYears }, (_, i) => i + 1);

  const renderCell = (
    value: string,
    type: "normal"|"ai"|"override"|"m07"|"locked"|"flagged"|"computed" = "normal",
    tooltip?: string
  ) => <Cell v={value} type={type} tooltip={tooltip} />;

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
          {years.map(y => <Cell key={y} v="304" type="locked" />)}
          <Cell v="—" type="locked" />
        </Row>
        <Row label="Avg Unit SF">
          {years.map(y => <Cell key={y} v="875" type="locked" />)}
          <Cell v="—" type="locked" />
        </Row>
        <Row label="Avg Rent / Unit">
          {["$2,001","$2,061","$2,123","$2,186","$2,252","$2,319","$2,389","$2,461","$2,534","$2,610"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} type={i === 2 ? "override" : "ai"} />
          )}
          <Cell v="3.0%" type="computed" />
        </Row>
        <Row label="Market Rent Growth %">
          {["3.0%","3.0%","3.1%","3.1%","3.2%","3.2%","3.1%","3.0%","3.0%","2.9%"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} type="ai" />
          )}
          <Cell v="3.0%" type="computed" />
        </Row>

        <SectionHeader label="2. REVENUE ASSUMPTIONS" />
        <Row label="Vacancy Rate %">
          {["17.4%","15.8%","14.2%","13.5%","13.0%","12.8%","12.5%","12.3%","12.0%","11.8%"].slice(0, holdYears).map((v, i) =>
            renderCell(v, i === 0 ? "flagged" : "normal", i === 0 ? "Broker: 17.4% | Platform: 14.8%" : undefined)
          )}
          <Cell v="13.5%" type="computed" />
        </Row>
        <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
          <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e] border-r border-purple-900/30 z-10 min-w-[220px]">
            <span className="text-[9px] border border-purple-500/50 rounded px-1 text-purple-500 mr-1">M07</span>Implied Vacancy
          </td>
          {["15.1%","14.6%","14.0%","13.5%","13.2%","12.9%","12.6%","12.4%","12.1%","11.9%"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} type="m07" />
          )}
          <Cell v="13.2%" type="computed" />
        </tr>
        <Row label="Loss to Lease %">
          {years.map(y => <Cell key={y} v="2.2%" type="normal" />)}
          <Cell v="2.2%" type="computed" />
        </Row>
        <Row label="Concessions %">
          {["0.9%","0.8%","0.6%","0.5%","0.4%","0.3%","0.3%","0.3%","0.2%","0.2%"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} />
          )}
          <Cell v="0.4%" type="computed" />
        </Row>
        <Row label="Other Income / Unit">
          {["$65","$67","$69","$71","$73","$75","$77","$80","$82","$85"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} />
          )}
          <Cell v="2.8%" type="computed" />
        </Row>

        <SectionHeader label="3. OPEX ASSUMPTIONS" />
        <Row label="OpEx Growth Rate %">
          {["2.5%","2.5%","2.6%","2.7%","2.7%","2.8%","2.8%","2.9%","3.0%","3.0%"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} />
          )}
          <Cell v="2.7%" type="computed" />
        </Row>
        <Row label="Management Fee %">
          {years.map(y => <Cell key={y} v="3.2%" />)}
          <Cell v="3.2%" type="computed" />
        </Row>
        <Row label="Real Estate Tax Growth" locked>
          {years.map(y => <Cell key={y} v="4.0%" type="locked" />)}
          <Cell v="4.0%" type="computed" />
        </Row>
        <Row label="Insurance Growth">
          {years.map(y => <Cell key={y} v="3.5%" />)}
          <Cell v="3.5%" type="computed" />
        </Row>
        <Row label="Repl. Reserves / Unit" locked>
          {years.map(y => <Cell key={y} v="$250" type="locked" />)}
          <Cell v="$250" type="computed" />
        </Row>

        <SectionHeader label="4. RETURNS SUMMARY" />
        <Row label="NOI" locked>
          {["$3.73M","$3.88M","$4.01M","$4.15M","$4.28M","$4.43M","$4.57M","$4.72M","$4.87M","$5.02M"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} type="locked" />
          )}
          <Cell v="3.4%" type="computed" />
        </Row>
        <Row label="Projected Value" locked>
          {["$67.9M","$70.5M","$72.9M","$75.5M","$77.8M","$77.0M","$79.5M","$82.1M","$84.7M","$83.7M"].slice(0, holdYears).map((v, i) =>
            <Cell key={i} v={v} type="locked" />
          )}
          <Cell v="2.4%" type="computed" />
        </Row>

        <SectionHeader label="5. M07 TRAFFIC SIGNALS" />
        <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
          <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10 min-w-[220px]">M07: Walk-ins/Week</td>
          {["1,847","1,920","1,998","2,081","2,168","-","-","-","-","-"].slice(0, holdYears).map((v, i) => <Cell key={i} v={v} type={i < 5 ? "m07" : "locked"} />)}
          <Cell v="4.1%" type="computed" />
        </tr>
        <tr className="border-b border-purple-900/30 bg-[#1a0a2e]/50 h-[22px]">
          <td className="px-3 py-1 text-[11px] text-purple-400 sticky left-0 bg-[#1a0a2e]/90 border-r border-purple-900/50 z-10 min-w-[220px]">M07: Implied Occupancy</td>
          {["82.6%","84.2%","85.8%","86.5%","87.0%","-","-","-","-","-"].slice(0, holdYears).map((v, i) => <Cell key={i} v={v} type={i < 5 ? "m07" : "locked"} />)}
          <Cell v="—" type="computed" />
        </tr>
      </tbody>
    </table>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

const PAGE_NAV: Array<{ id: Page; label: string; icon: React.ReactNode; color: string }> = [
  { id: "OVERVIEW", label: "Overview",     icon: <BarChart3 className="w-3.5 h-3.5" />, color: "text-slate-300" },
  { id: "DEBT",     label: "Debt",         icon: <DollarSign className="w-3.5 h-3.5" />, color: "text-blue-400" },
  { id: "TAXES",    label: "Real Estate Tax", icon: <Building2 className="w-3.5 h-3.5" />, color: "text-amber-400" },
];

export function AssumptionsGrid() {
  const [page, setPage]     = useState<Page>("OVERVIEW");
  const [holdTab, setHoldTab] = useState<HoldYears>("10 YR");

  const holdYears = holdTab === "5 YR" ? 5 : holdTab === "7 YR" ? 7 : 10;

  const active = PAGE_NAV.find(p => p.id === page)!;

  return (
    <div className="flex flex-col w-full h-full min-h-[600px] bg-[#0a0a0a] text-slate-300 font-sans text-xs border border-[#1e1e1e]">
      {/* ── Header Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#111111] border-b border-[#1e1e1e] sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-100 tracking-wider">F9 ASSUMPTIONS</span>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1e1e1e] rounded text-[11px]">
            <span className="text-slate-400">Sentosa Apartments</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">304 Units</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Atlanta, GA</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#1e1e1e] p-0.5 rounded">
            {(["5 YR","7 YR","10 YR"] as HoldYears[]).map(tab => (
              <button key={tab} onClick={() => setHoldTab(tab)}
                className={`px-3 py-1 text-[10px] font-bold rounded-sm ${holdTab === tab ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                {tab} {holdTab === tab && "✓"}
              </button>
            ))}
          </div>
          <button className="px-3 py-1 text-[10px] font-bold bg-purple-900/40 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-900/60">
            APPLY TRAFFIC [M07]
          </button>
          <button className="px-3 py-1 text-[10px] font-bold bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-900/60">
            RECALCULATE
          </button>
          <button className="p-1 text-slate-400 hover:text-slate-200 bg-[#1e1e1e] rounded">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Page Nav ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-4 py-0 bg-[#0d0d0d] border-b border-[#1e1e1e]">
        {PAGE_NAV.map((p, i) => (
          <React.Fragment key={p.id}>
            <button
              onClick={() => setPage(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold border-b-2 transition-colors ${
                page === p.id
                  ? `border-blue-500 ${p.color}`
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              <span className={page === p.id ? p.color : "text-slate-600"}>{p.icon}</span>
              {p.label.toUpperCase()}
            </button>
            {i < PAGE_NAV.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700" />}
          </React.Fragment>
        ))}

        {/* Page-specific breadcrumb / context hint */}
        <div className="ml-auto flex items-center gap-3 pr-2 text-[10px] text-slate-600">
          {page === "DEBT" && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">
                {IO_YEARS}YR I/O
              </span>
              <span>Mortgage constant: {fmtPct(mortgageConstant, 3)}</span>
              <span className="text-green-500">DSCR avg: {fmtX(DEBT_SCHEDULE.slice(0, holdYears).reduce((s, r) => s + r.dscr, 0) / holdYears)}</span>
            </>
          )}
          {page === "TAXES" && (
            <>
              <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 border border-amber-700/30 rounded font-mono">
                FULTON CO. · {MILLAGE_RATE} MILLS
              </span>
              <span>T12 bill: {fmt$(CURRENT_TAX)}</span>
              <span className={reassessmentDelta > 5000 ? "text-amber-500" : "text-green-500"}>
                {reassessmentDelta > 0 ? "↑ REASSESS +" + fmt$(reassessmentDelta) : "No reassessment delta"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {page === "OVERVIEW" && <OverviewPage holdYears={holdYears} />}
        {page === "DEBT"     && <DebtPage     holdYears={holdYears} />}
        {page === "TAXES"    && <TaxesPage    holdYears={holdYears} />}
      </div>

      {/* ── Bottom Summary Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1e1e1e] sticky bottom-0 z-20">
        <div className="flex items-center gap-8">
          {page === "OVERVIEW" && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">IRR LEVERED</span>
                <span className="text-sm font-mono text-green-400">18.7%</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EQUITY MULTIPLE</span>
                <span className="text-sm font-mono text-slate-200">2.34×</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">STABILIZED VALUE</span>
                <span className="text-sm font-mono text-slate-200">$67.9M</span>
              </div>
            </>
          )}
          {page === "DEBT" && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL DEBT SERVICE</span>
                <span className="text-sm font-mono text-slate-200">{fmtM(DEBT_SCHEDULE.slice(0, holdYears).reduce((s, r) => s + r.annualPayment, 0))}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">MIN DSCR</span>
                <span className={`text-sm font-mono ${Math.min(...DEBT_SCHEDULE.slice(0, holdYears).map(r => r.dscr)) >= 1.25 ? "text-green-400" : "text-amber-400"}`}>
                  {fmtX(Math.min(...DEBT_SCHEDULE.slice(0, holdYears).map(r => r.dscr)))} YR{DEBT_SCHEDULE.slice(0, holdYears).reduce((mi, r, i) => r.dscr < DEBT_SCHEDULE.slice(0, holdYears)[mi].dscr ? i : mi, 0) + 1}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">ENDING BALANCE</span>
                <span className="text-sm font-mono text-slate-200">{fmtM(DEBT_SCHEDULE[holdYears - 1]?.endBalance ?? 0)}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EXIT LTV</span>
                <span className="text-sm font-mono text-slate-200">{fmtPct(DEBT_SCHEDULE[holdYears - 1]?.ltv ?? 0)}</span>
              </div>
            </>
          )}
          {page === "TAXES" && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">TOTAL TAX HOLD</span>
                <span className="text-sm font-mono text-slate-200">{fmtM(TAX_SCHEDULE.slice(0, holdYears).reduce((s, r) => s + r.annualTax, 0))}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">YR1 TAX SHOCK</span>
                <span className={`text-sm font-mono ${reassessmentDelta > 5000 ? "text-amber-400" : "text-green-400"}`}>
                  {reassessmentDelta > 0 ? "+" : ""}{fmt$(reassessmentDelta)}
                </span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">EXIT YR TAX / UNIT</span>
                <span className="text-sm font-mono text-slate-200">{fmt$(TAX_SCHEDULE[holdYears - 1]?.perUnit ?? 0)}</span>
              </div>
              <div className="w-px h-8 bg-[#1e1e1e]" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 font-bold tracking-wider">AVG TAX AS % EGI</span>
                <span className="text-sm font-mono text-slate-200">
                  {fmtPct(TAX_SCHEDULE.slice(0, holdYears).reduce((s, r) => s + r.taxAsEgiPct, 0) / holdYears)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="text-[10px] text-slate-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50 block" />
          MODEL SYNCED
        </div>
      </div>
    </div>
  );
}

