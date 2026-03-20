import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Deal Capsule: REDEVELOPMENT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
// 9-Section layout for Redevelopment deals. The hybrid: existing operations
// + development scope. User needs to understand what they're buying, what
// zoning allows, what renovation + expansion costs, and the combined
// stabilized outcome.
//
// SECTIONS:
//  §1  Acquisition + As-Is Metrics
//  §2  NOI Transformation (the redev-specific hero)
//  §3  Site + Zoning Capacity
//  §4  Renovation + Expansion Scope
//  §5  Unit Mix Program
//  §6  Development Budget + Timeline
//  §7  Capital Structure
//  §8  Value Bridge + Returns
//  §9  Due Diligence + Module Access
//
// API ENDPOINTS:
//  Deal data:           GET /api/v1/deals/:id
//  JEDI Score:          GET /api/v1/jedi/score/:dealId
//  Entitlements:        GET /api/v1/entitlements/deal/:dealId
//  Capital Stack:       POST /api/v1/capital-structure/stack
//  Timeline Benchmarks: GET /api/v1/benchmark-timeline/benchmarks?county=&state=
//  Strategy Analysis:   dealAnalysisService (cached/mock)
//  Zoning Envelope:     zoningModuleStore (Zoning Agent output)
//  Research Agent:      DealContext.parcelId, yearBuilt, assessedValue, etc.
// ═══════════════════════════════════════════════════════════════════════════════

const T = {
  bg: "#0c0a09", bgCard: "#1c1917", bgHover: "#292524",
  border: "#292524", borderLight: "#44403c",
  text: "#fafaf9", tm: "#a8a29e", td: "#78716c",
  amber: "#d97706", amberBg: "#451a03", amberL: "#fbbf24",
  green: "#10b981", greenBg: "#064e3b", greenL: "#34d399",
  red: "#ef4444", redBg: "#7f1d1d", redL: "#f87171",
  blue: "#3b82f6", blueBg: "#1e3a5f", blueL: "#60a5fa",
  violet: "#8b5cf6", violetBg: "#4c1d95", violetL: "#a78bfa",
  cyan: "#06b6d4", cyanBg: "#164e63",
};
const mono = { fontFamily: "'JetBrains Mono', 'SF Mono', monospace" };
const sans = { fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" };

const fmt = (n, prefix = "$") => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${prefix}${(n / 1e3).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};
const pct = (n) => n != null ? `${(n * 100).toFixed(1)}%` : "—";
const num = (n) => n != null ? n.toLocaleString() : "—";

// ─── Mock Deal ───────────────────────────────────────────────────────────────
const DEAL = {
  name: "Harbor Pointe Landing",
  address: "1400 N Harbor City Blvd, Melbourne, FL 32935",
  city: "Melbourne", state: "FL", zip: "32935", county: "Brevard",
  projectType: "redevelopment",
  propertyType: "Multifamily",
  propertyClass: "C → B+",
  parcelId: "25-37-03-00-00124.0-0000.00",
  lotSizeSf: 283140, lotSizeAcres: 6.5,
  zoning: "RU-2-15",
  zoningDesc: "Multi-Family Residential, 15 DU/acre",
  yearBuilt: 1986, stories: 2, buildings: 14,
  assessedValue: 16800000,
  lastSaleDate: "2016-08-22", lastSalePrice: 11200000,
  parking: { spaces: 252, ratio: 1.5, type: "Surface" },
  // §1 Acquisition + As-Is
  askPrice: 18500000,
  existingUnits: 168, existingSqft: 134000,
  existingNoi: 1120000, existingOccupancy: 0.84,
  existingCapRate: 0.0605,
  existingRentPerUnit: 985,
  existingExpenseRatio: 0.52,
  pricePerUnit: 110119, pricePerSf: 138,
  // Condition
  roofAge: 12, hvacAge: 8, plumbingCondition: "Fair", electricalCondition: "Good",
  deferred: 920000,
  // §2 NOI Transformation
  stabilizedNoi: 2640000, stabilizedOccupancy: 0.95,
  stabilizedCapRate: 0.0735,
  stabilizedRentPerUnit: 1410,
  // §3 Zoning
  maxDensity: 15, maxFar: null, maxHeight: 35, maxLotCoverage: 0.60,
  zoningAllows: 97, // 6.5 acres × 15 DU/acre = 97 units max (already 168 existing — grandfathered)
  // NOTE: existing 168 units are legally nonconforming (grandfathered). Expansion 
  // requires variance or rezone to higher density. Zoning allows 97 new units IF rezoned.
  zoningUtilization: 0.6,
  expansionRequiresVariance: true,
  additionalByRight: 0, // can't add by-right under current zoning
  additionalWithVariance: 48, // realistic ask
  additionalIfRezoned: 112, // full rezone to RU-2-25
  // §4 Renovation + Expansion
  renovationBudget: 4800000, renovPerUnit: 28571, unitRenovations: 168,
  renovScope: [
    { item: "Kitchen & Bath", costPerUnit: 12000, percentage: 0.42 },
    { item: "Flooring (LVP)", costPerUnit: 3500, percentage: 0.12 },
    { item: "HVAC Replacement", costPerUnit: 4500, percentage: 0.16 },
    { item: "Exterior / Common", costPerUnit: 3571, percentage: 0.125 },
    { item: "Appliances", costPerUnit: 2500, percentage: 0.088 },
    { item: "Fixtures & Paint", costPerUnit: 2500, percentage: 0.088 },
  ],
  expansionUnits: 48, expansionSqft: 43200,
  expansionCost: 12600000, expansionCostPerUnit: 262500,
  expansionType: "3-Story Garden Walk-Up",
  expansionParkingAdd: 72,
  // §5 Unit Mix
  existingMix: [
    { type: "1BR/1BA", count: 72, avgSf: 680, currentRent: 895, targetRent: 1275 },
    { type: "2BR/1.5BA", count: 72, avgSf: 850, currentRent: 1025, targetRent: 1475 },
    { type: "3BR/2BA", count: 24, avgSf: 1050, currentRent: 1175, targetRent: 1650 },
  ],
  expansionMix: [
    { type: "1BR/1BA", count: 16, avgSf: 740, targetRent: 1350 },
    { type: "2BR/2BA", count: 24, avgSf: 1020, targetRent: 1575 },
    { type: "3BR/2BA", count: 8, avgSf: 1180, targetRent: 1750 },
  ],
  // §6 Budget + Timeline
  totalInvestment: 35900000,
  budgetBreakdown: [
    { category: "Acquisition", amount: 18500000, color: T.amber },
    { category: "Interior Renovations", amount: 4800000, color: T.blue },
    { category: "Deferred Maintenance", amount: 920000, color: T.redL },
    { category: "Expansion (48 units)", amount: 12600000, color: T.violet },
    { category: "Soft Costs & Fees", amount: 1850000, color: T.td },
    { category: "Closing & Reserves", amount: 1230000, color: T.tm },
  ],
  renovationMonths: 14, leaseUpMonths: 6, totalTimelineMonths: 20,
  phases: [
    { label: "Close + Mobilize", months: 2, start: 0 },
    { label: "Phase 1 Reno (84 units)", months: 7, start: 2 },
    { label: "Phase 2 Reno (84 units)", months: 7, start: 9 },
    { label: "Expansion Build", months: 12, start: 4 },
    { label: "Lease-Up", months: 6, start: 16 },
  ],
  // §7 Capital Structure
  seniorDebt: 23100000, ltv: 0.644, rate: 0.0675, term: "3+1+1 Bridge",
  equityRequired: 12800000, equitySplit: "90/10 LP/GP",
  prefReturn: 0.08, promote: "70/30 above 8% pref, 50/50 above 15% IRR",
  lender: "Bridge (Recourse during reno, non-recourse at stabilization)",
  drawSchedule: [
    { milestone: "Closing", amount: 18500000, pctDrawn: 0.51 },
    { milestone: "Reno Phase 1", amount: 3200000, pctDrawn: 0.65 },
    { milestone: "Expansion Start", amount: 5000000, pctDrawn: 0.79 },
    { milestone: "Reno Phase 2", amount: 2800000, pctDrawn: 0.87 },
    { milestone: "Expansion Complete", amount: 4600000, pctDrawn: 1.0 },
  ],
  // §8 Value Bridge + Returns
  exitValue: 48000000, exitCapRate: 0.055,
  valueCreation: 12100000,
  irr: 19.2, equityMultiple: 1.9, cashOnCash: 7.4,
  renovationRoi: null, // calculated
  // §9 DD + Module Access
  ddItems: [
    { module: "M02", label: "Property & Zoning", status: "complete", link: "zoning" },
    { module: "M05", label: "Market Intelligence", status: "in-progress", link: "market-intelligence" },
    { module: "M07", label: "Traffic Intelligence", status: "not-started", link: "traffic-intelligence" },
    { module: "M09", label: "Pro Forma", status: "in-progress", link: "proforma" },
    { module: "M11", label: "Capital Structure", status: "not-started", link: "capital-structure" },
    { module: "M14", label: "Risk Management", status: "not-started", link: "risk" },
    { module: "M15", label: "Competition", status: "in-progress", link: "competition" },
    { module: "M16", label: "Environmental & ESG", status: "not-started", link: "environmental" },
    { module: "M20", label: "Due Diligence", status: "not-started", link: "due-diligence" },
  ],
};

// ─── Shared Components ───────────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle, color }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: color || T.amberL, letterSpacing: 2, ...mono }}>§{number}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text, ...sans }}>{title}</span>
      </div>
      {subtitle && <p style={{ fontSize: 12, color: T.td, marginLeft: 30, ...sans }}>{subtitle}</p>}
    </div>
  );
}

function Card({ children, style: extraStyle }) {
  return (
    <div style={{ background: T.bgCard, borderRadius: 10, border: `1px solid ${T.border}`, padding: 20, ...extraStyle }}>
      {children}
    </div>
  );
}

function Metric({ label, value, sub, color, small }) {
  return (
    <div style={{ padding: small ? "8px 0" : "10px 0" }}>
      <div style={{ fontSize: 9, letterSpacing: 1.5, color: T.td, marginBottom: 3, ...mono }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight: 700, color: color || T.text, ...sans }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.td, marginTop: 2, ...sans }}>{sub}</div>}
    </div>
  );
}

function DataRow({ label, value, bold, borderColor }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "7px 0", borderBottom: `1px solid ${borderColor || T.border}`,
    }}>
      <span style={{ fontSize: 12, color: T.text, fontWeight: bold ? 700 : 400, ...sans }}>{label}</span>
      <span style={{ fontSize: 12, color: bold ? T.amberL : T.text, fontWeight: bold ? 700 : 500, ...mono }}>{value}</span>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.5, padding: "3px 10px", borderRadius: 4,
      background: bg, color: color, border: `1px solid ${color}40`, ...mono, display: "inline-flex", alignItems: "center", gap: 4,
    }}>{label}</span>
  );
}

function StatusDot({ status }) {
  const colors = { complete: T.green, "in-progress": T.amber, "not-started": T.td };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[status] || T.td, display: "inline-block" }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RedevelopmentOverview() {
  const deal = DEAL;
  const [expandedPhase, setExpandedPhase] = useState(null);

  const noiDelta = deal.stabilizedNoi - deal.existingNoi;
  const rentDelta = deal.stabilizedRentPerUnit - deal.existingRentPerUnit;
  const totalUnits = deal.existingUnits + deal.expansionUnits;
  const renovROI = noiDelta / (deal.renovationBudget + deal.expansionCost);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: "20px 24px", color: T.text, ...sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ═══ HEADER — Property Identity ═══ */}
        <div style={{ background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          {/* Top bar */}
          <div style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: T.text, ...sans }}>{deal.name}</span>
                <Badge label="REDEVELOPMENT" color={T.violetL} bg={T.violetBg} />
                <Badge label={deal.propertyClass} color={T.amberL} bg={T.amberBg} />
              </div>
              <div style={{ fontSize: 12, color: T.tm, ...sans }}>
                📍 {deal.address} · {deal.county} County, {deal.state}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: T.td, ...mono }}>ASK PRICE</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: T.amberL, ...sans }}>{fmt(deal.askPrice)}</div>
              <div style={{ fontSize: 11, color: T.td, ...mono }}>{fmt(deal.pricePerUnit)}/unit · {fmt(deal.pricePerSf)}/SF</div>
            </div>
          </div>
          {/* Property detail grid */}
          <div style={{ padding: "10px 24px", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0, borderBottom: `1px solid ${T.border}` }}>
            {[
              { l: "PARCEL ID", v: deal.parcelId },
              { l: "LOT SIZE", v: `${deal.lotSizeAcres} ac (${num(deal.lotSizeSf)} SF)` },
              { l: "ZONING", v: `${deal.zoning}` },
              { l: "YEAR BUILT", v: deal.yearBuilt },
              { l: "BUILDINGS", v: `${deal.buildings} bldgs · ${deal.stories}-story` },
              { l: "PARKING", v: `${deal.parking.spaces} spaces (${deal.parking.ratio}/unit)` },
            ].map((f, i) => (
              <div key={i} style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: T.text, marginTop: 2, ...sans }}>{f.v || "—"}</div>
              </div>
            ))}
          </div>
          {/* Assessed / Last sale bar */}
          <div style={{ padding: "8px 24px", display: "flex", gap: 24, background: T.bg }}>
            <span style={{ fontSize: 10, color: T.td, ...mono }}>Assessed: <span style={{ color: T.text }}>{fmt(deal.assessedValue)}</span></span>
            <span style={{ fontSize: 10, color: T.td, ...mono }}>Last Sale: <span style={{ color: T.text }}>{fmt(deal.lastSalePrice)} ({new Date(deal.lastSaleDate).getFullYear()})</span></span>
            <span style={{ fontSize: 10, color: T.td, ...mono }}>Zoning Desc: <span style={{ color: T.text }}>{deal.zoningDesc}</span></span>
          </div>
        </div>

        {/* ═══ §1 — ACQUISITION + AS-IS METRICS ═══ */}
        <div>
          <SectionHeader number="1" title="Acquisition + As-Is Metrics" subtitle="What you're buying today — current operations baseline" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Card><Metric label="GOING-IN CAP RATE" value={pct(deal.existingCapRate)} sub="Based on trailing 12mo NOI" /></Card>
            <Card><Metric label="CURRENT NOI" value={fmt(deal.existingNoi)} sub={`Expense ratio: ${pct(deal.existingExpenseRatio)}`} /></Card>
            <Card><Metric label="OCCUPANCY" value={pct(deal.existingOccupancy)} sub="Physical occupancy" color={deal.existingOccupancy < 0.9 ? T.amberL : T.text} /></Card>
            <Card><Metric label="AVG RENT / UNIT" value={`${fmt(deal.existingRentPerUnit)}/mo`} sub="All unit types blended" /></Card>
          </div>
          {/* Condition assessment */}
          <div style={{ marginTop: 12 }}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 24 }}>
                  {[
                    { l: "Roof Age", v: `${deal.roofAge} yrs`, warn: deal.roofAge > 10 },
                    { l: "HVAC Age", v: `${deal.hvacAge} yrs`, warn: deal.hvacAge > 10 },
                    { l: "Plumbing", v: deal.plumbingCondition, warn: deal.plumbingCondition === "Poor" },
                    { l: "Electrical", v: deal.electricalCondition, warn: false },
                  ].map((c, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>{c.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.warn ? T.amberL : T.text, ...sans }}>{c.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: T.td, letterSpacing: 1, ...mono }}>DEFERRED MAINTENANCE</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.redL, ...sans }}>{fmt(deal.deferred)}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ═══ §2 — NOI TRANSFORMATION (Hero section) ═══ */}
        <div>
          <SectionHeader number="2" title="NOI Transformation" subtitle="The value story — from as-is to stabilized" color={T.greenL} />
          <Card style={{ background: `linear-gradient(135deg, ${T.bgCard} 0%, ${T.greenBg}30 100%)`, border: `1px solid ${T.green}25` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: 0 }}>
              {/* As-Is */}
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ fontSize: 10, color: T.td, marginBottom: 6, ...mono }}>AS-IS NOI</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.text, ...sans }}>{fmt(deal.existingNoi)}</div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  {deal.existingUnits} units · {pct(deal.existingOccupancy)} occ · {fmt(deal.existingRentPerUnit)}/mo
                </div>
              </div>
              <div style={{ fontSize: 28, color: T.td, padding: "0 8px" }}>→</div>
              {/* Stabilized */}
              <div style={{ textAlign: "center", padding: 20, background: T.greenBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: T.greenL, marginBottom: 6, ...mono }}>STABILIZED NOI</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.greenL, ...sans }}>{fmt(deal.stabilizedNoi)}</div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  {totalUnits} units · {pct(deal.stabilizedOccupancy)} occ · {fmt(deal.stabilizedRentPerUnit)}/mo
                </div>
              </div>
              <div style={{ fontSize: 28, color: T.td, padding: "0 8px" }}>=</div>
              {/* Delta */}
              <div style={{ textAlign: "center", padding: 20, background: T.amberBg, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: T.amberL, marginBottom: 6, ...mono }}>NOI UPLIFT</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: T.amberL, ...sans }}>+{fmt(noiDelta)}</div>
                <div style={{ fontSize: 11, color: T.tm, marginTop: 6, ...sans }}>
                  +{pct(noiDelta / deal.existingNoi)} increase · +{fmt(rentDelta)}/unit rent lift
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ §3 — SITE + ZONING CAPACITY ═══ */}
        <div>
          <SectionHeader number="3" title="Site + Zoning Capacity" subtitle="What the zoning allows vs what exists — expansion feasibility" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>DENSITY ANALYSIS</div>
              {/* Density utilization bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: T.tm, ...sans }}>Existing: {deal.existingUnits} units</span>
                  <span style={{ fontSize: 11, color: T.tm, ...sans }}>Max (if rezoned): {deal.existingUnits + deal.additionalIfRezoned} units</span>
                </div>
                <div style={{ height: 24, background: T.bg, borderRadius: 6, overflow: "hidden", position: "relative" }}>
                  <div style={{
                    width: `${(deal.existingUnits / (deal.existingUnits + deal.additionalIfRezoned)) * 100}%`,
                    height: "100%", background: T.blue, borderRadius: "6px 0 0 6px",
                  }} />
                  <div style={{
                    position: "absolute", left: `${(deal.existingUnits / (deal.existingUnits + deal.additionalIfRezoned)) * 100}%`,
                    width: `${(deal.additionalWithVariance / (deal.existingUnits + deal.additionalIfRezoned)) * 100}%`,
                    height: "100%", background: `${T.violet}60`, top: 0,
                  }} />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: T.blueL, ...mono }}>● Existing ({deal.existingUnits})</span>
                  <span style={{ fontSize: 10, color: T.violetL, ...mono }}>● Expansion ({deal.additionalWithVariance} w/ variance)</span>
                  <span style={{ fontSize: 10, color: T.td, ...mono }}>○ Remaining ({deal.additionalIfRezoned - deal.additionalWithVariance} if full rezone)</span>
                </div>
              </div>
              <DataRow label="Current Zoning" value={`${deal.zoning} — ${deal.zoningDesc}`} />
              <DataRow label="Max Density (current)" value={`${deal.maxDensity} DU/acre`} />
              <DataRow label="By-Right Additional" value={deal.additionalByRight > 0 ? `+${deal.additionalByRight} units` : "0 — existing is legally nonconforming"} />
              <DataRow label="With Variance" value={`+${deal.additionalWithVariance} units`} />
              <DataRow label="Full Rezone (RU-2-25)" value={`+${deal.additionalIfRezoned} units`} />
            </Card>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>ZONING ENVELOPE</div>
              {[
                { l: "Max Height", v: deal.maxHeight ? `${deal.maxHeight} ft` : "—" },
                { l: "Max Lot Coverage", v: deal.maxLotCoverage ? pct(deal.maxLotCoverage) : "—" },
                { l: "Lot Size", v: `${deal.lotSizeAcres} acres (${num(deal.lotSizeSf)} SF)` },
                { l: "Existing Coverage", v: "~42%" },
                { l: "Available for Expansion", v: `~${num(Math.round(deal.lotSizeSf * 0.18))} SF` },
              ].map((r, i) => <DataRow key={i} label={r.l} value={r.v} />)}

              {deal.expansionRequiresVariance && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: 8,
                  background: T.amberBg, border: `1px solid ${T.amber}40`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.amberL, marginBottom: 4, ...mono }}>⚠ VARIANCE REQUIRED</div>
                  <p style={{ fontSize: 11, color: T.amberL, lineHeight: 1.5, ...sans }}>
                    Existing {deal.existingUnits} units are legally nonconforming under current {deal.zoning} zoning.
                    Expansion of {deal.expansionUnits} units requires a variance. Entitlement timeline: ~6-9 months.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* ═══ §4 — RENOVATION + EXPANSION SCOPE ═══ */}
        <div>
          <SectionHeader number="4" title="Renovation + Expansion Scope" subtitle="Dual-track: interior upgrades on existing + new construction" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Renovation */}
            <Card style={{ borderLeft: `3px solid ${T.blue}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: T.blueL, ...mono }}>RENOVATION</div>
                  <div style={{ fontSize: 11, color: T.tm, marginTop: 2, ...sans }}>{deal.unitRenovations} of {deal.existingUnits} units</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{fmt(deal.renovationBudget)}</div>
                  <div style={{ fontSize: 11, color: T.td, ...mono }}>{fmt(deal.renovPerUnit)}/unit</div>
                </div>
              </div>
              {deal.renovScope.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: `${s.percentage * 100}%`, minWidth: 4, maxWidth: 60, height: 6, borderRadius: 3, background: T.blue }} />
                    <span style={{ fontSize: 12, color: T.text, ...sans }}>{s.item}</span>
                  </div>
                  <span style={{ fontSize: 12, color: T.text, ...mono }}>{fmt(s.costPerUnit)}/unit</span>
                </div>
              ))}
              {/* Rent uplift */}
              <div style={{ marginTop: 12, padding: "10px 12px", background: T.blueBg, borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: T.blueL, ...sans }}>Rent uplift after renovation</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.blueL, ...mono }}>+{fmt(rentDelta)}/mo (+{pct(rentDelta / deal.existingRentPerUnit)})</span>
              </div>
            </Card>
            {/* Expansion */}
            <Card style={{ borderLeft: `3px solid ${T.violet}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: T.violetL, ...mono }}>EXPANSION</div>
                  <div style={{ fontSize: 11, color: T.tm, marginTop: 2, ...sans }}>+{deal.expansionUnits} new units · {deal.expansionType}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{fmt(deal.expansionCost)}</div>
                  <div style={{ fontSize: 11, color: T.td, ...mono }}>{fmt(deal.expansionCostPerUnit)}/unit</div>
                </div>
              </div>
              <DataRow label="New Units" value={`+${deal.expansionUnits}`} />
              <DataRow label="New SF" value={`${num(deal.expansionSqft)} SF`} />
              <DataRow label="Building Type" value={deal.expansionType} />
              <DataRow label="Additional Parking" value={`+${deal.expansionParkingAdd} spaces`} />
              <DataRow label="Cost / SF" value={fmt(Math.round(deal.expansionCost / deal.expansionSqft))} />
              <DataRow label="Entitlement Status" value={deal.expansionRequiresVariance ? "Variance needed" : "By-right"} />
              {/* Combined */}
              <div style={{ marginTop: 12, padding: "10px 12px", background: T.violetBg, borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: T.violetL, ...sans }}>Total post-expansion</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.violetL, ...mono }}>{totalUnits} units · {num(deal.existingSqft + deal.expansionSqft)} SF</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* ═══ §5 — UNIT MIX PROGRAM ═══ */}
        <div>
          <SectionHeader number="5" title="Unit Mix Program" subtitle="Existing mix + expansion additions → blended stabilized portfolio" />
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr 1fr 1fr", gap: 0 }}>
              {/* Header */}
              {["Type", "Count", "Avg SF", "Current Rent", "Target Rent", "Δ Rent", "Δ %"].map((h, i) => (
                <div key={i} style={{ padding: "8px 10px", fontSize: 10, color: T.td, borderBottom: `2px solid ${T.border}`, textAlign: i > 0 ? "right" : "left", ...mono }}>{h}</div>
              ))}
              {/* Existing */}
              <div style={{ gridColumn: "1 / -1", padding: "6px 10px", fontSize: 9, letterSpacing: 2, color: T.blueL, background: T.bg, ...mono }}>EXISTING ({deal.existingUnits} UNITS)</div>
              {deal.existingMix.map((u, i) => {
                const delta = u.targetRent - u.currentRent;
                return [
                  <div key={`t${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, borderBottom: `1px solid ${T.border}`, ...sans }}>{u.type}</div>,
                  <div key={`c${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{u.count}</div>,
                  <div key={`s${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{u.avgSf}</div>,
                  <div key={`r${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{fmt(u.currentRent)}</div>,
                  <div key={`tr${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.greenL, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{fmt(u.targetRent)}</div>,
                  <div key={`d${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.greenL, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>+{fmt(delta)}</div>,
                  <div key={`p${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.greenL, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>+{pct(delta / u.currentRent)}</div>,
                ];
              })}
              {/* Expansion */}
              <div style={{ gridColumn: "1 / -1", padding: "6px 10px", fontSize: 9, letterSpacing: 2, color: T.violetL, background: T.bg, ...mono }}>EXPANSION (+{deal.expansionUnits} UNITS)</div>
              {deal.expansionMix.map((u, i) => [
                <div key={`et${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, borderBottom: `1px solid ${T.border}`, ...sans }}>{u.type}</div>,
                <div key={`ec${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.violetL, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>+{u.count}</div>,
                <div key={`es${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{u.avgSf}</div>,
                <div key={`er${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.td, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>—</div>,
                <div key={`etr${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.violetL, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>{fmt(u.targetRent)}</div>,
                <div key={`ed${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.td, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>—</div>,
                <div key={`ep${i}`} style={{ padding: "6px 10px", fontSize: 12, color: T.td, textAlign: "right", borderBottom: `1px solid ${T.border}`, ...mono }}>—</div>,
              ])}
              {/* Total row */}
              <div style={{ gridColumn: "1 / -1", padding: "8px 10px", display: "flex", justifyContent: "space-between", borderTop: `2px solid ${T.amber}`, background: T.bg }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, ...sans }}>Stabilized Portfolio: {totalUnits} units</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.amberL, ...mono }}>Blended avg: {fmt(deal.stabilizedRentPerUnit)}/mo</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ §6 — DEVELOPMENT BUDGET + TIMELINE ═══ */}
        <div>
          <SectionHeader number="6" title="Development Budget + Timeline" subtitle="Full cost breakdown and phased execution schedule" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Budget */}
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>TOTAL INVESTMENT</div>
              {/* Stacked bar */}
              <div style={{ display: "flex", height: 24, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                {deal.budgetBreakdown.map((b, i) => (
                  <div key={i} style={{ width: `${(b.amount / deal.totalInvestment) * 100}%`, background: b.color, opacity: 0.75 }}
                    title={`${b.category}: ${fmt(b.amount)}`} />
                ))}
              </div>
              {deal.budgetBreakdown.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: b.color }} />
                    <span style={{ fontSize: 12, color: T.text, ...sans }}>{b.category}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, ...mono }}>{fmt(b.amount)}</span>
                    <span style={{ fontSize: 10, color: T.td, ...mono }}>{pct(b.amount / deal.totalInvestment)}</span>
                  </div>
                </div>
              ))}
              <DataRow label="Total Investment" value={fmt(deal.totalInvestment)} bold />
            </Card>
            {/* Timeline */}
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>EXECUTION TIMELINE</div>
              <div style={{ position: "relative", height: deal.phases.length * 32 + 10, marginBottom: 12 }}>
                {deal.phases.map((p, i) => {
                  const totalM = 22;
                  const colors = [T.amber, T.blue, T.blue, T.violet, T.green];
                  return (
                    <div key={i} style={{
                      position: "absolute", left: `${(p.start / totalM) * 100}%`,
                      width: `${(p.months / totalM) * 100}%`, top: i * 30, height: 24,
                      background: colors[i] + "25", border: `1px solid ${colors[i]}50`, borderRadius: 5,
                      display: "flex", alignItems: "center", paddingLeft: 8,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: colors[i], ...mono, whiteSpace: "nowrap" }}>
                        {p.label} ({p.months}mo)
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                <span style={{ fontSize: 10, color: T.td, ...mono }}>Month 0</span>
                <span style={{ fontSize: 10, color: T.td, ...mono }}>Stabilized — Month {deal.totalTimelineMonths + 2}</span>
              </div>
              {/* Key milestones */}
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["Close (M0)", "Reno P1 Start (M2)", "Expansion GMP (M4)", "Reno P2 Start (M9)", "CO Expansion (M16)", "Stabilized (M22)"].map((m, i) => (
                  <span key={i} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: T.bg, color: T.tm, border: `1px solid ${T.border}`, ...mono }}>{m}</span>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ═══ §7 — CAPITAL STRUCTURE ═══ */}
        <div>
          <SectionHeader number="7" title="Capital Structure" subtitle="Bridge-to-perm with renovation and expansion draw schedules" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>SOURCES</div>
              <DataRow label="Senior Debt (Bridge)" value={fmt(deal.seniorDebt)} />
              <DataRow label="LTV" value={pct(deal.ltv)} />
              <DataRow label="Rate" value={pct(deal.rate)} />
              <DataRow label="Term" value={deal.term} />
              <DataRow label="Lender Type" value={deal.lender} />
              <div style={{ height: 16 }} />
              <DataRow label="Sponsor Equity" value={fmt(deal.equityRequired)} />
              <DataRow label="LP/GP Split" value={deal.equitySplit} />
              <DataRow label="Pref Return" value={pct(deal.prefReturn)} />
              <DataRow label="Promote" value={deal.promote} />
              <DataRow label="Total Capitalization" value={fmt(deal.seniorDebt + deal.equityRequired)} bold />
            </Card>
            <Card>
              <div style={{ fontSize: 10, letterSpacing: 2, color: T.td, marginBottom: 12, ...mono }}>DRAW SCHEDULE</div>
              {/* Draw progress visualization */}
              {deal.drawSchedule.map((d, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text, ...sans }}>{d.milestone}</span>
                    <span style={{ fontSize: 11, color: T.text, ...mono }}>{fmt(d.amount)}</span>
                  </div>
                  <div style={{ height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${d.pctDrawn * 100}%`, height: "100%", background: T.amber, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ fontSize: 9, color: T.td, marginTop: 2, textAlign: "right", ...mono }}>{pct(d.pctDrawn)} drawn</div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* ═══ §8 — VALUE BRIDGE + RETURNS ═══ */}
        <div>
          <SectionHeader number="8" title="Value Bridge + Returns" subtitle="Total basis → stabilized value → value creation" />
          {/* Value bridge */}
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 0, flexWrap: "wrap" }}>
              {[
                { label: "Acquisition", value: deal.askPrice, color: T.amber },
                { op: "+" },
                { label: "Renovation", value: deal.renovationBudget, color: T.blue },
                { op: "+" },
                { label: "Deferred Maint", value: deal.deferred, color: T.redL },
                { op: "+" },
                { label: "Expansion", value: deal.expansionCost, color: T.violet },
                { op: "+" },
                { label: "Soft + Closing", value: deal.totalInvestment - deal.askPrice - deal.renovationBudget - deal.deferred - deal.expansionCost, color: T.td },
                { op: "=" },
                { label: "Total Basis", value: deal.totalInvestment, color: T.amberL, bold: true },
                { op: "→" },
                { label: "Stabilized Value", value: deal.exitValue, color: T.greenL, bold: true },
              ].map((step, i) => step.op ? (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "0 6px", fontSize: 18, color: T.td }}>{step.op}</div>
              ) : (
                <div key={i} style={{ textAlign: "center", padding: "10px 8px", minWidth: 80 }}>
                  <div style={{ fontSize: 9, color: T.td, marginBottom: 3, ...mono }}>{step.label}</div>
                  <div style={{ fontSize: step.bold ? 18 : 14, fontWeight: 700, color: step.color, ...sans }}>{fmt(step.value)}</div>
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 12, background: T.greenBg, border: `1px solid ${T.green}30`, borderRadius: 8,
              padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.greenL, ...sans }}>Value Creation</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: T.greenL, ...mono }}>+{fmt(deal.exitValue - deal.totalInvestment)}</span>
            </div>
          </Card>
          {/* Return metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Card><Metric label="PROJ. IRR" value={deal.irr + "%"} sub="Levered, 5-year hold" color={T.greenL} /></Card>
            <Card><Metric label="EQUITY MULTIPLE" value={deal.equityMultiple + "x"} sub={`On ${fmt(deal.equityRequired)} equity`} color={T.greenL} /></Card>
            <Card><Metric label="RENOVATION ROI" value={pct(renovROI)} sub={`${fmt(noiDelta)} uplift / ${fmt(deal.renovationBudget + deal.expansionCost)} spent`} color={T.greenL} /></Card>
            <Card><Metric label="CASH-ON-CASH (Y1)" value={deal.cashOnCash + "%"} sub="Year 1 levered yield" /></Card>
          </div>
        </div>

        {/* ═══ §9 — DUE DILIGENCE + MODULE ACCESS ═══ */}
        <div>
          <SectionHeader number="9" title="Due Diligence + Module Access" subtitle="Jump into any module — status tracked across the deal lifecycle" />
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {deal.ddItems.map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: T.bg, borderRadius: 8, border: `1px solid ${T.border}`,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = T.amber}
                  onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                >
                  <StatusDot status={item.status} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, ...sans }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: T.td, ...mono }}>{item.module}</div>
                  </div>
                  <span style={{ fontSize: 10, color: T.td, textTransform: "capitalize", ...sans }}>{item.status.replace("-", " ")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
