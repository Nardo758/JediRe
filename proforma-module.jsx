import { useState, useMemo } from "react";

/*
  JEDI RE — ProForma Module (M09) with Deal-Type Adaptation
  
  SUB-TABS (9 total):
    Overview | Pro Forma | Projections | Assumptions | Debt | Waterfall | Sensitivity | Decision | Compare
  
  This file provides:
    1. ProFormaRouter — tab bar + dispatch to sub-tab components
    2. ProFormaOverview — the missing "first thing you see" executive summary
    3. ProFormaSummary — the quick operating statement (GPR → NOI → CF)
    4. Template switching infrastructure for all sub-tabs
  
  The Overview page is the KEY addition — it answers "should I keep reading?" before
  the user dives into 40+ line items. It changes COMPLETELY by deal type.
*/

// ── DESIGN TOKENS (Bloomberg aesthetic) ────────────────────
const K = {
  bg: "#0B0E13", s: "rgba(255,255,255,0.025)", sh: "rgba(255,255,255,0.04)",
  b: "rgba(255,255,255,0.06)", bh: "rgba(255,255,255,0.12)",
  t: "#E8E6E1", tm: "rgba(232,230,225,0.5)", td: "rgba(232,230,225,0.22)",
  a: "#63B3ED", ad: "rgba(99,179,237,0.08)",
  g: "#68D391", gd: "rgba(104,211,145,0.08)",
  r: "#FC8181", rd: "rgba(252,129,129,0.08)",
  y: "#F6E05E", yd: "rgba(246,224,94,0.08)",
  p: "#B794F4", pd: "rgba(183,148,244,0.08)",
  o: "#F6AD55", od: "rgba(246,173,85,0.08)",
  c: "#4FD1C5", cd: "rgba(79,209,197,0.08)",
  m: "'JetBrains Mono', monospace", f: "'DM Sans', sans-serif",
};

const f = n => n?.toLocaleString("en-US") ?? "—";
const fc = n => `$${n?.toLocaleString("en-US") ?? "0"}`;
const fk = n => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1000).toFixed(0)}K`;
const fpct = n => `${n.toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════
// MOCK DATA — Replace with dealStore / API props
// ═══════════════════════════════════════════════════════════════

const MOCK_EXISTING = {
  dealType: "existing",
  propertyName: "Exchange at Holly Springs",
  units: 320, purchasePrice: 42000000, closingCosts: 840000,
  renovationBudget: 3580000, renoUnitsScope: 209,
  totalBasis: 46420000,
  // Revenue
  gpr: 6552000, otherIncome: 471500, vacancy: 5.8, concessions: 1.2, badDebt: 0.5,
  egi: 6540000,
  // Expenses
  management: 3.5, payroll: 380000, insurance: 420000, taxes: 680000,
  rm: 185000, utilities: 210000, marketing: 65000, admin: 95000, reserves: 250,
  totalOpex: 2360000,
  // Returns (pre-strategy)
  preNOI: 3420000, preCapRate: 8.14,
  // Returns (post-strategy)
  postNOI: 4180000, postCapRate: 9.07,
  exitCap: 5.25, holdYears: 5,
  debtAmount: 31500000, debtRate: 6.25, debtTerm: 10, debtIO: 2,
  annualDebtService: 2340000,
  // Computed
  goingInCap: null, cashOnCash: null, irr: null, equityMultiple: null, dscr: null,
};

const MOCK_DEVELOPMENT = {
  dealType: "development",
  propertyName: "Nocatee Parcel 14-C",
  units: 280, totalSF: 285600,
  // Cost stack
  landCost: 4200000, impactFees: 1490000, sitePrep: 380000, landClosing: 126000,
  hardCostPerSF: 215, softCostPerSF: 35,
  totalDevCost: null, // computed
  // Revenue
  avgRent: 1820, otherIncomePerUnit: 125, vacancy: 6.0,
  gpr: null, egi: null,
  // Expenses
  expenseRatio: 38,
  totalOpex: null, noi: null,
  // Timeline
  preDev: 4, entitlement: 6, construction: 18, leaseUp: 12, totalTimeline: 40,
  absorptionRate: 18, preLeasePct: 15,
  // Returns
  yieldOnCost: null, exitCap: 5.25, devSpread: null,
  stabilizedValue: null, profit: null, profitMargin: null,
  // Debt
  constructionLoanPct: 65, constructionRate: 7.5, takeoutCap: 5.5,
};

const MOCK_REDEVELOPMENT = {
  dealType: "redevelopment",
  propertyName: "Westshore Commons Repositioning",
  units: 196, currentUnits: 196, targetUnits: 196,
  purchasePrice: 28500000, closingCosts: 570000,
  renovationBudget: 5880000, newConstructionBudget: 0,
  demolitionAbatement: 420000, tenantRelocation: 180000, lostRevenue: 840000,
  totalBasis: null,
  // Current operations
  currentNOI: 1850000, currentCapRate: 6.49,
  // Stabilized
  stabilizedNOI: 2820000, stabilizedCapRate: null,
  // Timeline
  acquisition: 2, renovation: 14, releasePhase: 8, totalTimeline: 24,
  // Returns
  yieldOnCost: null, valueCreation: null, exitCap: 5.0,
  debtAmount: 21375000, debtRate: 6.75,
};


// ═══════════════════════════════════════════════════════════════
// SOURCES & USES TABLE — Shared pattern, different content
// ═══════════════════════════════════════════════════════════════

function SourcesAndUses({ sources, uses, totalLabel = "TOTAL" }) {
  const totalSources = sources.reduce((s, r) => s + r.amount, 0);
  const totalUses = uses.reduce((s, r) => s + r.amount, 0);

  const Row = ({ label, amount, pct, color, bold: isBold }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "5px 0", borderBottom: `1px solid rgba(255,255,255,0.03)`,
    }}>
      <span style={{ fontSize: 10.5, color: isBold ? K.t : K.tm, fontWeight: isBold ? 700 : 400 }}>{label}</span>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {pct !== undefined && <span style={{ fontSize: 9, fontFamily: K.m, color: K.td, minWidth: 40, textAlign: "right" }}>{fpct(pct)}</span>}
        <span style={{ fontSize: 11, fontFamily: K.m, fontWeight: 600, color: color || K.t, minWidth: 80, textAlign: "right" }}>
          {fk(amount)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* SOURCES */}
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 8 }}>SOURCES</div>
        {sources.map((r, i) => <Row key={i} {...r} />)}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${K.bh}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: K.t }}>{totalLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.g }}>{fk(totalSources)}</span>
        </div>
      </div>
      {/* USES */}
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 8 }}>USES</div>
        {uses.map((r, i) => <Row key={i} {...r} />)}
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${K.bh}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: K.t }}>{totalLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.a }}>{fk(totalUses)}</span>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// KPI CARD — Reusable metric display
// ═══════════════════════════════════════════════════════════════

function KPICard({ label, value, sublabel, color = K.t, large = false }) {
  return (
    <div style={{ padding: "10px 14px", background: K.s, borderRadius: 7, border: `1px solid ${K.b}` }}>
      <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.8, color: K.td, fontFamily: K.m, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: large ? 22 : 16, fontWeight: 800, fontFamily: K.m, color }}>{value}</div>
      {sublabel && <div style={{ fontSize: 9, color: K.tm, marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// OVERVIEW: EXISTING ACQUISITION
// ═══════════════════════════════════════════════════════════════

function ExistingOverview({ data }) {
  const d = data;
  const goingInCap = (d.preNOI / d.purchasePrice * 100);
  const postCap = (d.postNOI / d.totalBasis * 100);
  const cashOnCash = ((d.postNOI - d.annualDebtService) / (d.totalBasis - d.debtAmount) * 100);
  const exitValue = d.postNOI / (d.exitCap / 100);
  const totalReturn = exitValue - d.totalBasis;
  const renoROI = ((d.postNOI - d.preNOI) * 12 / d.renovationBudget * 100); // annualized
  const equityIn = d.totalBasis - d.debtAmount;
  const dscr = d.postNOI / d.annualDebtService;
  const ltv = (d.debtAmount / d.totalBasis * 100);

  return (
    <div>
      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPICard label="GOING-IN CAP" value={fpct(goingInCap)} color={K.a} large />
        <KPICard label="STABILIZED CAP" value={fpct(postCap)} sublabel="post-renovation" color={K.g} large />
        <KPICard label="CASH-ON-CASH (Y1)" value={fpct(cashOnCash)} color={cashOnCash > 8 ? K.g : K.y} large />
        <KPICard label="EXIT VALUE" value={fk(exitValue)} sublabel={`@ ${fpct(d.exitCap)} exit cap`} color={K.g} large />
        <KPICard label="TOTAL RETURN" value={fk(totalReturn)} sublabel={fpct(totalReturn / equityIn * 100) + " on equity"} color={K.g} large />
        <KPICard label="DSCR" value={dscr.toFixed(2) + "x"} sublabel={dscr >= 1.25 ? "Comfortable" : "Tight"} color={dscr >= 1.25 ? K.g : K.r} large />
      </div>

      {/* Two-column: S&U + NOI Waterfall */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Sources & Uses */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>SOURCES & USES</div>
          <SourcesAndUses
            sources={[
              { label: "Senior Debt", amount: d.debtAmount, pct: ltv, color: K.a },
              { label: "Sponsor Equity", amount: equityIn, pct: 100 - ltv, color: K.p },
            ]}
            uses={[
              { label: "Purchase Price", amount: d.purchasePrice, pct: d.purchasePrice / d.totalBasis * 100 },
              { label: "Closing Costs", amount: d.closingCosts, pct: d.closingCosts / d.totalBasis * 100 },
              { label: "Renovation Budget", amount: d.renovationBudget, pct: d.renovationBudget / d.totalBasis * 100, color: K.o },
            ]}
          />
        </div>

        {/* NOI Waterfall */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>NOI WATERFALL — PRE vs POST STRATEGY</div>
          {[
            { l: "Gross Potential Rent", pre: d.gpr, post: d.gpr * 1.12, delta: true },
            { l: "Other Income", pre: d.otherIncome, post: d.otherIncome * 1.08 },
            { l: "Less: Vacancy & Loss", pre: -(d.gpr * d.vacancy / 100), post: -(d.gpr * 1.12 * 0.05), neg: true },
            { l: "Effective Gross Income", pre: d.egi, post: d.egi * 1.10, bold: true },
            { sep: true },
            { l: "Total Operating Expenses", pre: -d.totalOpex, post: -d.totalOpex * 1.02, neg: true },
            { sep: true },
            { l: "Net Operating Income", pre: d.preNOI, post: d.postNOI, bold: true, hero: true },
            { l: "Less: Debt Service", pre: -d.annualDebtService, post: -d.annualDebtService, neg: true },
            { l: "Before-Tax Cash Flow", pre: d.preNOI - d.annualDebtService, post: d.postNOI - d.annualDebtService, bold: true, color: K.g },
          ].map((row, i) => {
            if (row.sep) return <div key={i} style={{ height: 1, background: K.bh, margin: "4px 0" }} />;
            const delta = row.post - row.pre;
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 80px 80px 70px",
                gap: 6, alignItems: "center", padding: "4px 0",
                borderBottom: row.hero ? `1px solid ${K.bh}` : undefined,
              }}>
                <span style={{ fontSize: 10, color: row.bold ? K.t : K.tm, fontWeight: row.bold ? 700 : 400 }}>{row.l}</span>
                <span style={{ fontSize: 10, fontFamily: K.m, color: K.tm, textAlign: "right" }}>{fk(row.pre)}</span>
                <span style={{ fontSize: 10, fontFamily: K.m, color: row.hero ? K.g : K.t, fontWeight: row.hero ? 700 : 500, textAlign: "right" }}>{fk(row.post)}</span>
                <span style={{ fontSize: 9, fontFamily: K.m, textAlign: "right",
                  color: delta > 0 ? K.g : delta < 0 ? K.r : K.td,
                }}>
                  {delta > 0 ? "+" : ""}{fk(delta)}
                </span>
              </div>
            );
          })}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 70px", gap: 6, padding: "2px 0", marginTop: 4 }}>
            <span /><span style={{ fontSize: 8, color: K.td, fontFamily: K.m, textAlign: "right" }}>PRE</span>
            <span style={{ fontSize: 8, color: K.td, fontFamily: K.m, textAlign: "right" }}>POST</span>
            <span style={{ fontSize: 8, color: K.td, fontFamily: K.m, textAlign: "right" }}>DELTA</span>
          </div>
        </div>
      </div>

      {/* Renovation ROI + Value Creation */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ background: K.gd, border: `1px solid ${K.g}20`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 8, color: `${K.g}80`, fontFamily: K.m, letterSpacing: 0.8, marginBottom: 4 }}>RENOVATION ROI</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: K.m, color: K.g }}>{fpct(renoROI)}</div>
          <div style={{ fontSize: 9, color: K.tm, marginTop: 2 }}>Annual NOI uplift / reno spend</div>
          <div style={{ fontSize: 9, color: K.tm }}>{fc(Math.round(d.renovationBudget / d.renoUnitsScope))}/unit across {d.renoUnitsScope} units</div>
        </div>
        <div style={{ background: K.ad, border: `1px solid ${K.a}20`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 8, color: `${K.a}80`, fontFamily: K.m, letterSpacing: 0.8, marginBottom: 4 }}>CAP RATE COMPRESSION</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: K.m, color: K.a }}>
            {fpct(goingInCap)} → {fpct(d.exitCap)}
          </div>
          <div style={{ fontSize: 9, color: K.tm, marginTop: 2 }}>{Math.round((goingInCap - d.exitCap) * 100)} bps compression = value creation</div>
        </div>
        <div style={{ background: K.pd, border: `1px solid ${K.p}20`, borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ fontSize: 8, color: `${K.p}80`, fontFamily: K.m, letterSpacing: 0.8, marginBottom: 4 }}>EQUITY INVESTED</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: K.m, color: K.p }}>{fk(equityIn)}</div>
          <div style={{ fontSize: 9, color: K.tm, marginTop: 2 }}>{fpct(100 - ltv)} of total basis · LTV {fpct(ltv)}</div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// OVERVIEW: DEVELOPMENT
// ═══════════════════════════════════════════════════════════════

function DevelopmentOverview({ data }) {
  const d = data;
  const landTotal = d.landCost + d.impactFees + d.sitePrep + d.landClosing;
  const hardTotal = d.hardCostPerSF * d.totalSF;
  const softTotal = d.softCostPerSF * d.totalSF;
  const totalDevCost = landTotal + hardTotal + softTotal;
  const gpr = d.avgRent * d.units * 12;
  const egi = gpr * (1 - d.vacancy / 100) + (d.otherIncomePerUnit * d.units * 12);
  const noi = egi * (1 - d.expenseRatio / 100);
  const yoc = (noi / totalDevCost * 100);
  const devSpread = yoc - d.exitCap;
  const stabilizedValue = noi / (d.exitCap / 100);
  const profit = stabilizedValue - totalDevCost;
  const profitMargin = (profit / totalDevCost * 100);
  const costPerUnit = Math.round(totalDevCost / d.units);
  const costPerSF = Math.round(totalDevCost / d.totalSF);
  const constructionLoan = totalDevCost * d.constructionLoanPct / 100;
  const equity = totalDevCost - constructionLoan;

  return (
    <div>
      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPICard label="YIELD ON COST" value={fpct(yoc)} color={yoc >= 6 ? K.g : yoc >= 5 ? K.y : K.r} large />
        <KPICard label="DEV SPREAD" value={`${devSpread > 0 ? "+" : ""}${Math.round(devSpread * 100)} bps`} color={devSpread > 0 ? K.g : K.r} large />
        <KPICard label="TOTAL DEV COST" value={fk(totalDevCost)} sublabel={`${fc(costPerUnit)}/unit · $${costPerSF}/SF`} color={K.a} large />
        <KPICard label="STABILIZED NOI" value={fk(noi)} sublabel={`${fc(Math.round(noi / d.units))}/unit`} color={K.g} large />
        <KPICard label="PROFIT" value={fk(profit)} sublabel={fpct(profitMargin) + " margin"} color={profit > 0 ? K.g : K.r} large />
        <KPICard label="TIMELINE" value={`${d.totalTimeline} mo`} sublabel={`${(d.totalTimeline / 12).toFixed(1)} years`} color={K.p} large />
      </div>

      {/* Two-column: S&U + Cost Stack */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Sources & Uses */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>SOURCES & USES</div>
          <SourcesAndUses
            sources={[
              { label: "Construction Loan", amount: constructionLoan, pct: d.constructionLoanPct, color: K.a },
              { label: "Sponsor Equity", amount: equity, pct: 100 - d.constructionLoanPct, color: K.p },
            ]}
            uses={[
              { label: "Land & Site", amount: landTotal, pct: landTotal / totalDevCost * 100, color: K.a },
              { label: "Hard Costs", amount: hardTotal, pct: hardTotal / totalDevCost * 100, color: K.p },
              { label: "Soft Costs", amount: softTotal, pct: softTotal / totalDevCost * 100, color: K.o },
            ]}
          />
        </div>

        {/* Cost Stack Breakdown with bars */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>COST STACK BREAKDOWN</div>

          {/* Stacked bar */}
          <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
            {[
              { v: landTotal, c: K.a, l: "Land" },
              { v: hardTotal, c: K.p, l: "Hard" },
              { v: softTotal, c: K.o, l: "Soft" },
            ].map(seg => (
              <div key={seg.l} style={{
                width: `${seg.v / totalDevCost * 100}%`, background: `${seg.c}60`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 8, fontWeight: 700, fontFamily: K.m, color: K.t }}>{seg.l} {(seg.v / totalDevCost * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          {/* Detail rows */}
          {[
            { cat: "LAND & SITE", items: [
              { l: "Land acquisition", v: d.landCost },
              { l: "Impact fees", v: d.impactFees },
              { l: "Site preparation", v: d.sitePrep },
              { l: "Closing costs", v: d.landClosing },
            ], total: landTotal, c: K.a },
            { cat: "HARD COSTS", items: [
              { l: "Vertical construction", v: 185 * d.totalSF, s: "$185/SF" },
              { l: "Site infrastructure", v: 22 * d.totalSF, s: "$22/SF" },
              { l: "Landscaping", v: 8 * d.totalSF, s: "$8/SF" },
            ], total: hardTotal, c: K.p },
            { cat: "SOFT COSTS", items: [
              { l: "Architecture & engineering", v: 12 * d.totalSF, s: "$12/SF" },
              { l: "Permits & government", v: 8 * d.totalSF, s: "$8/SF" },
              { l: "Interest reserve", v: 0, s: "Capitalized" },
              { l: "Developer fee", v: 4 * d.totalSF, s: "$4/SF" },
              { l: "Marketing & lease-up", v: 5 * d.totalSF, s: "$5/SF" },
              { l: "Contingency", v: 3 * d.totalSF, s: "$3/SF" },
            ], total: softTotal, c: K.o },
          ].map(group => (
            <div key={group.cat} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.8, color: group.c, fontFamily: K.m }}>{group.cat}</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: K.m, color: group.c }}>{fk(group.total)}</span>
              </div>
              {group.items.map(item => (
                <div key={item.l} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0 2px 12px" }}>
                  <span style={{ fontSize: 9.5, color: K.tm }}>{item.l}</span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {item.s && <span style={{ fontSize: 8.5, fontFamily: K.m, color: K.td }}>{item.s}</span>}
                    <span style={{ fontSize: 9.5, fontFamily: K.m, color: K.t, minWidth: 60, textAlign: "right" }}>{fk(item.v)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline + Yield gauge */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Construction + Absorption Timeline */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>DEVELOPMENT TIMELINE</div>
          {[
            { l: "Pre-development", mo: d.preDev, start: 0, c: K.td },
            { l: "Entitlement", mo: d.entitlement, start: d.preDev - 2, c: K.y },
            { l: "Construction", mo: d.construction, start: d.preDev + d.entitlement, c: K.p },
            { l: "Pre-leasing", mo: Math.round(d.construction * 0.3), start: d.preDev + d.entitlement + Math.round(d.construction * 0.7), c: K.a },
            { l: "Lease-up", mo: d.leaseUp, start: d.preDev + d.entitlement + d.construction, c: K.g },
          ].map((phase, i) => {
            const left = (phase.start / d.totalTimeline) * 100;
            const width = (phase.mo / d.totalTimeline) * 100;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 9, color: K.tm, minWidth: 90, textAlign: "right" }}>{phase.l}</span>
                <div style={{ flex: 1, position: "relative", height: 18 }}>
                  <div style={{ position: "absolute", top: 7, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
                  <div style={{
                    position: "absolute", top: 2, left: `${left}%`, width: `${width}%`, height: 14,
                    background: `${phase.c}30`, borderRadius: 5, border: `1px solid ${phase.c}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 8, fontFamily: K.m, color: phase.c, fontWeight: 600 }}>{phase.mo}mo</span>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Key milestones */}
          <div style={{ display: "flex", gap: 12, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${K.b}` }}>
            {[
              { l: "CO issued", mo: d.preDev + d.entitlement + d.construction, c: K.p },
              { l: `${d.preLeasePct}% pre-leased`, mo: d.preDev + d.entitlement + d.construction, c: K.a },
              { l: "93%+ stabilized", mo: d.totalTimeline, c: K.g },
            ].map(ms => (
              <div key={ms.l} style={{ padding: "4px 10px", background: `${ms.c}10`, borderRadius: 5, border: `1px solid ${ms.c}20` }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: ms.c, fontFamily: K.m }}>Mo {ms.mo}</div>
                <div style={{ fontSize: 9, color: K.tm }}>{ms.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Yield target */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>YIELD ANALYSIS</div>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: K.m, color: yoc >= 6 ? K.g : K.y }}>{yoc.toFixed(2)}%</div>
            <div style={{ fontSize: 9, color: K.td }}>Yield on Cost</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${K.b}` }}>
            <span style={{ fontSize: 10, color: K.tm }}>Market cap rate</span>
            <span style={{ fontSize: 11, fontFamily: K.m, fontWeight: 600, color: K.a }}>{fpct(d.exitCap)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${K.b}` }}>
            <span style={{ fontSize: 10, color: K.tm }}>Dev spread</span>
            <span style={{ fontSize: 11, fontFamily: K.m, fontWeight: 700, color: devSpread > 0 ? K.g : K.r }}>
              {devSpread > 0 ? "+" : ""}{Math.round(devSpread * 100)} bps
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid ${K.b}` }}>
            <span style={{ fontSize: 10, color: K.tm }}>Stabilized value</span>
            <span style={{ fontSize: 11, fontFamily: K.m, fontWeight: 600, color: K.g }}>{fk(stabilizedValue)}</span>
          </div>
          <div style={{ marginTop: 10, padding: "8px 10px", background: devSpread > 100 ? K.gd : K.yd, borderRadius: 6, border: `1px solid ${devSpread > 100 ? K.g : K.y}20` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: devSpread > 100 ? K.g : K.y }}>
              {devSpread > 100 ? "Strong development economics" : devSpread > 0 ? "Marginal spread — stress test carefully" : "Negative spread — reconsider assumptions"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// OVERVIEW: REDEVELOPMENT
// ═══════════════════════════════════════════════════════════════

function RedevelopmentOverview({ data }) {
  const d = data;
  const totalBasis = d.purchasePrice + d.closingCosts + d.renovationBudget + d.demolitionAbatement + d.tenantRelocation + d.lostRevenue;
  const yoc = (d.stabilizedNOI / totalBasis * 100);
  const valueCreation = d.stabilizedNOI / (d.exitCap / 100) - totalBasis;
  const equityIn = totalBasis - d.debtAmount;
  const noiLift = d.stabilizedNOI - d.currentNOI;
  const noiLiftPct = (noiLift / d.currentNOI * 100);

  return (
    <div>
      {/* Hero KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
        <KPICard label="CURRENT NOI" value={fk(d.currentNOI)} sublabel={`${fpct(d.currentCapRate)} cap (as-is)`} color={K.tm} large />
        <KPICard label="STABILIZED NOI" value={fk(d.stabilizedNOI)} sublabel={`+${fpct(noiLiftPct)} lift`} color={K.g} large />
        <KPICard label="NOI DELTA" value={`+${fk(noiLift)}`} sublabel="Annual uplift" color={K.g} large />
        <KPICard label="TOTAL BASIS" value={fk(totalBasis)} sublabel={`${fc(Math.round(totalBasis / d.units))}/unit`} color={K.a} large />
        <KPICard label="YIELD ON COST" value={fpct(yoc)} color={yoc >= 6 ? K.g : K.y} large />
        <KPICard label="VALUE CREATION" value={fk(valueCreation)} sublabel={`@ ${fpct(d.exitCap)} exit cap`} color={valueCreation > 0 ? K.g : K.r} large />
      </div>

      {/* Two-column: S&U + Value Bridge */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>SOURCES & USES</div>
          <SourcesAndUses
            sources={[
              { label: "Bridge / Construction Loan", amount: d.debtAmount, pct: d.debtAmount / totalBasis * 100, color: K.a },
              { label: "Sponsor Equity", amount: equityIn, pct: equityIn / totalBasis * 100, color: K.p },
            ]}
            uses={[
              { label: "Purchase Price", amount: d.purchasePrice, pct: d.purchasePrice / totalBasis * 100 },
              { label: "Closing Costs", amount: d.closingCosts },
              { label: "Renovation Budget", amount: d.renovationBudget, color: K.o },
              { label: "Demo & Abatement", amount: d.demolitionAbatement },
              { label: "Tenant Relocation", amount: d.tenantRelocation },
              { label: "Lost Revenue (Downtime)", amount: d.lostRevenue, color: K.r },
            ]}
          />
        </div>

        {/* Value Bridge: Current → Stabilized */}
        <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>VALUE BRIDGE — CURRENT TO STABILIZED</div>
          {[
            { l: "As-Is Value", v: d.purchasePrice, c: K.tm, note: `@ ${fpct(d.currentCapRate)} cap` },
            { l: "+ Renovation Investment", v: d.renovationBudget + d.demolitionAbatement, c: K.o },
            { l: "+ Tenant Relocation & Downtime", v: d.tenantRelocation + d.lostRevenue, c: K.r },
            { l: "= Total Basis", v: totalBasis, c: K.a, bold: true },
            { sep: true },
            { l: "Stabilized Value", v: d.stabilizedNOI / (d.exitCap / 100), c: K.g, bold: true, note: `@ ${fpct(d.exitCap)} cap` },
            { sep: true },
            { l: "Value Creation", v: valueCreation, c: valueCreation > 0 ? K.g : K.r, bold: true, hero: true },
          ].map((row, i) => {
            if (row.sep) return <div key={i} style={{ height: 1, background: K.bh, margin: "6px 0" }} />;
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
                <div>
                  <span style={{ fontSize: 10, color: row.bold ? K.t : K.tm, fontWeight: row.bold ? 700 : 400 }}>{row.l}</span>
                  {row.note && <span style={{ fontSize: 8.5, color: K.td, marginLeft: 6 }}>{row.note}</span>}
                </div>
                <span style={{ fontSize: row.hero ? 14 : 11, fontWeight: row.bold ? 800 : 600, fontFamily: K.m, color: row.c }}>{fk(row.v)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: K.td, fontFamily: K.m, marginBottom: 12 }}>REDEVELOPMENT TIMELINE</div>
        <div style={{ display: "flex", height: 32, borderRadius: 6, overflow: "hidden" }}>
          {[
            { l: "Acquire", mo: d.acquisition, c: K.a },
            { l: "Renovate", mo: d.renovation, c: K.o },
            { l: "Re-lease", mo: d.releasePhase, c: K.g },
          ].map(phase => (
            <div key={phase.l} style={{
              width: `${phase.mo / d.totalTimeline * 100}%`, background: `${phase.c}30`,
              borderRight: `1px solid ${K.bg}`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: phase.c, fontFamily: K.m }}>{phase.l}</span>
              <span style={{ fontSize: 8, color: K.tm }}>{phase.mo}mo</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: K.td }}>
          <span>Month 0</span>
          <span>Total: {d.totalTimeline} months ({(d.totalTimeline / 12).toFixed(1)} years)</span>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// PROFORMA ROUTER — The main export
// ═══════════════════════════════════════════════════════════════

const PROFORMA_TABS = [
  { key: "overview",     label: "Overview",     icon: "⊞" },
  { key: "proforma",     label: "Pro Forma",    icon: "≡" },
  { key: "projections",  label: "Projections",  icon: "⋮" },
  { key: "assumptions",  label: "Assumptions",  icon: "⊕" },
  { key: "debt",         label: "Debt",         icon: "⊙" },
  { key: "waterfall",    label: "Waterfall",    icon: "◈" },
  { key: "sensitivity",  label: "Sensitivity",  icon: "∿" },
  { key: "decision",     label: "Decision",     icon: "✓" },
  { key: "compare",      label: "Compare",      icon: "⇔" },
];

export default function ProFormaModule({ dealType = "existing", productType = "mf_garden" }) {
  const [activeTab, setActiveTab] = useState("overview");

  // Select mock data based on deal type
  const data = dealType === "development" ? MOCK_DEVELOPMENT
    : dealType === "redevelopment" ? MOCK_REDEVELOPMENT
    : MOCK_EXISTING;

  return (
    <div style={{ background: K.bg, color: K.t, fontFamily: K.f, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }
      `}</style>

      {/* Module Header */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${K.b}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m }}>M09</span>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Pro Forma Engine</h2>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 12,
            background: dealType === "development" ? K.gd : dealType === "redevelopment" ? K.od : K.ad,
            color: dealType === "development" ? K.g : dealType === "redevelopment" ? K.o : K.a,
          }}>
            {dealType === "development" ? "Development Template" : dealType === "redevelopment" ? "Redevelopment Template" : "Acquisition Template"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "5px 12px", borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: "pointer", border: `1px solid ${K.b}`, background: "transparent", color: K.tm, fontFamily: K.m }}>Export XLSX</button>
          <button style={{ padding: "5px 12px", borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: "pointer", border: `1px solid ${K.g}40`, background: K.gd, color: K.g, fontFamily: K.m }}>Save Version</button>
        </div>
      </div>

      {/* Sub-tab Bar */}
      <div style={{ padding: "0 24px", borderBottom: `1px solid ${K.b}`, display: "flex", gap: 0 }}>
        {PROFORMA_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: "10px 14px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
            border: "none", fontFamily: K.f, display: "flex", alignItems: "center", gap: 5,
            background: "transparent",
            borderBottom: `2px solid ${activeTab === tab.key ? K.a : "transparent"}`,
            color: activeTab === tab.key ? K.t : K.td,
            transition: "all 0.12s",
          }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "20px 24px" }}>
        {activeTab === "overview" && (
          dealType === "development" ? <DevelopmentOverview data={data} />
          : dealType === "redevelopment" ? <RedevelopmentOverview data={data} />
          : <ExistingOverview data={data} />
        )}

        {activeTab === "proforma" && (
          <div style={{ padding: "40px", textAlign: "center", color: K.td }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Summary Operating Statement</div>
            <div style={{ fontSize: 11 }}>GPR → Vacancy → EGI → OpEx → NOI → Debt Service → Cash Flow</div>
            <div style={{ fontSize: 10, color: K.tm, marginTop: 8 }}>Quick view with {dealType === "development" ? "phased revenue ramp" : "pre/post renovation"} columns</div>
          </div>
        )}

        {activeTab === "projections" && (
          <div style={{ padding: "40px", textAlign: "center", color: K.td }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Full Institutional Operating Statement</div>
            <div style={{ fontSize: 11 }}>40-60 line items · Timeline selector (3/5/7/10yr) · Monthly toggle</div>
            <div style={{ fontSize: 10, color: K.tm, marginTop: 8 }}>
              {dealType === "development" ? "Construction draw schedule → Lease-up phase → Stabilized operations" 
              : dealType === "redevelopment" ? "Current operations → Renovation downtime → Repositioned operations"
              : "Year 1 in-place → Renovation phasing → Stabilized with rent bumps"}
            </div>
          </div>
        )}

        {activeTab === "assumptions" && (
          <div style={{ padding: "40px", textAlign: "center", color: K.td }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>3-Layer Assumption Panel</div>
            <div style={{ fontSize: 11 }}>Layer 1: Broker/Historical · Layer 2: Platform-Adjusted · Layer 3: Your Override</div>
            <div style={{ fontSize: 10, color: K.tm, marginTop: 8 }}>Every input shows source badge + confidence. Yellow highlight when override deviates {'>'}100bps from platform.</div>
          </div>
        )}

        {["debt", "waterfall", "sensitivity", "decision", "compare"].includes(activeTab) && (
          <div style={{ padding: "40px", textAlign: "center", color: K.td }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>{PROFORMA_TABS.find(t => t.key === activeTab)?.label} Tab</div>
            <div style={{ fontSize: 11, color: K.tm }}>Placeholder — wire to existing components</div>
          </div>
        )}
      </div>
    </div>
  );
}
