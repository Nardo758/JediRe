import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Deal Capsule Overview (3 Variants + Deal Creation)
// ═══════════════════════════════════════════════════════════════════════════════
// Router switches between Existing / Development / Redevelopment based on
// deal.projectType. Each variant shares: JEDI Score hero, 5-signal breakdown,
// risk alert, signal detail cards. Each diverges on: hero KPIs, financial
// snapshot, strategy options, deal-specific intelligence sections.
//
// Also includes DealCreationFlow — the 3-type fork with conditional fields
// that feeds projectType into the deal record at creation time.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Color System (Bloomberg Terminal tokens) ────────────────────────────────
const T = {
  bg: "#0c0a09", bgCard: "#1c1917", bgCardHover: "#292524",
  border: "#292524", borderLight: "#44403c",
  text: "#fafaf9", textMuted: "#a8a29e", textDim: "#78716c",
  amber: "#d97706", amberBg: "#451a03", amberLight: "#fbbf24",
  green: "#10b981", greenBg: "#064e3b", greenLight: "#34d399",
  red: "#ef4444", redBg: "#7f1d1d", redLight: "#f87171",
  blue: "#3b82f6", blueBg: "#1e3a5f", blueLight: "#60a5fa",
  violet: "#8b5cf6", violetBg: "#4c1d95",
  cyan: "#06b6d4", cyanBg: "#164e63",
};

const mono = { fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" };
const sans = { fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" };

// ─── Mock Data ───────────────────────────────────────────────────────────────

// ─── API ENDPOINTS (annotations for wiring) ─────────────────────────────────
// Deal data:           GET /api/v1/deals/:id
//   → address, name, project_type, units, acres, purchase_price, occupancy,
//     cap_rate, renovation_budget, boundary (GeoJSON), status, state
// JEDI Score:          GET /api/v1/jedi/score/:dealId
//   → score.totalScore, score.scoreDelta, breakdown.{demand,supply,momentum,position,risk}
// Entitlements:        GET /api/v1/entitlements/deal/:dealId
//   → permits[], entitlement status, timeline
// Capital Stack:       POST /api/v1/capital-structure/stack
//   → layers[], ltc, rate, total_sources, total_uses
// Timeline Benchmarks: GET /api/v1/benchmark-timeline/benchmarks?county=&state=
//   → p25, p50, p75, p90 months by county
// Geographic Context:  GET /api/v1/deals/:id/geographic-context
//   → trade_area.stats, submarket.stats, msa.stats
// Strategy Analysis:   dealAnalysisService (in-memory / cached)
//
// PROPERTY DETAIL FIELDS — source mapping:
// Parcel ID / Folio:   Research Agent → DealContext.parcelId (county records API)
// Lot Size (SF/acres):  deal.acres (deals table) or DealContext.lotAreaSf
// Zoning Designation:  Zoning Agent → /api/v1/zoning/:dealId or deal.zoning
// Year Built:          Research Agent → DealContext.yearBuilt (county records)
// Max Density/FAR/Ht:  Zoning Agent → zoningModuleStore.selected_envelope
// Assessed Value:      Research Agent → DealContext.assessedValue (property appraiser)
// Last Sale Date/Price: Research Agent → DealContext.lastSaleDate, lastSalePrice
// ─────────────────────────────────────────────────────────────────────────────

const DEALS = {
  existing: {
    id: "deal-001",
    name: "Summit Ridge Apartments",
    address: "4200 Summit Ridge Pkwy, Tampa, FL 33615",
    city: "Tampa", state: "FL", zip: "33615", county: "Hillsborough",
    projectType: "existing",
    propertyType: "240-Unit Class B+ Multifamily",
    // Property details
    parcelId: "A-09-29-18-3DB-000000-00025.0",
    lotSizeSf: 348480,
    lotSizeAcres: 8.0,
    zoning: "RM-24 (Residential Multi-Family)",
    yearBuilt: 1998,
    lastSaleDate: "2019-03-15",
    lastSalePrice: 32400000,
    assessedValue: 38200000,
    stories: 3,
    buildings: 12,
    parking: { spaces: 380, ratio: 1.58, type: "Surface" },
    // Deal metrics
    askPrice: 45000000,
    units: 240,
    sqft: 198000,
    occupancy: 0.924,
    noi: 2340000,
    capRate: 0.052,
    pricePerUnit: 187500,
    pricePerSf: 227,
    dscr: 1.32,
    debtAmount: 31500000,
    equityRequired: 13500000,
    renovationBudget: 3200000,
    renovPerUnit: 13333,
    stabilizedNoi: 2890000,
    stabilizedCap: 0.064,
    exitValue: 52000000,
    irr: 18.4,
    equityMultiple: 2.1,
    cashOnCash: 8.2,
    rentPerUnit: 1385,
    marketRent: 1520,
    rentGap: 0.097,
    // Unit mix snapshot
    unitMix: [
      { type: "1BR/1BA", count: 96, avgSf: 720, avgRent: 1250 },
      { type: "2BR/2BA", count: 108, avgSf: 980, avgRent: 1450 },
      { type: "3BR/2BA", count: 36, avgSf: 1210, avgRent: 1650 },
    ],
  },
  development: {
    id: "deal-002",
    name: "Westshore Innovation District",
    address: "2800 W Kennedy Blvd, Tampa, FL 33609",
    city: "Tampa", state: "FL", zip: "33609", county: "Hillsborough",
    projectType: "development",
    propertyType: "312-Unit Class A Podium Mixed-Use",
    // Property details
    parcelId: "A-13-29-18-ZZZ-000000-00148.0",
    lotSizeSf: 156000,
    lotSizeAcres: 3.58,
    zoning: "PD-A (Planned Development — Activity Center)",
    yearBuilt: null,
    lastSaleDate: null,
    lastSalePrice: null,
    assessedValue: 4200000, // land only
    stories: null,
    buildings: null,
    parking: { spaces: 468, ratio: 1.5, type: "Podium Garage (2 levels)" },
    landPrice: 8500000,
    // Zoning envelope — from Zoning Agent
    entitled: true,
    maxDensity: 75,
    maxFar: 3.5,
    maxHeight: 85,
    maxLotCoverage: 0.80,
    setbacks: { front: 10, side: 5, rear: 15 },
    buildableAreaSf: 132600,
    // Dev metrics
    units: 312,
    sqft: 298000,
    retailSqft: 12000,
    totalDevCost: 78400000,
    hardCosts: 52800000,
    softCosts: 10600000,
    contingency: 3200000,
    constructionLoan: 58800000,
    equityRequired: 19600000,
    yieldOnCost: 0.068,
    devSpread: 125,
    stabilizedNoi: 5330000,
    exitCapRate: 0.048,
    exitValue: 111000000,
    irr: 22.7,
    equityMultiple: 2.6,
    profitMargin: 0.286,
    timelineMonths: 30,
    constructionMonths: 18,
    leaseUpMonths: 8,
    costPerUnit: 251282,
    costPerSf: 263,
    rentPerUnit: 2150,
    // Proposed unit mix
    unitMix: [
      { type: "Studio", count: 48, avgSf: 520, avgRent: 1650 },
      { type: "1BR/1BA", count: 132, avgSf: 740, avgRent: 2050 },
      { type: "2BR/2BA", count: 108, avgSf: 1080, avgRent: 2550 },
      { type: "3BR/2BA", count: 24, avgSf: 1340, avgRent: 3100 },
    ],
  },
  redevelopment: {
    id: "deal-003",
    name: "Harbor Pointe Landing",
    address: "1400 N Harbor City Blvd, Melbourne, FL 32935",
    city: "Melbourne", state: "FL", zip: "32935", county: "Brevard",
    projectType: "redevelopment",
    propertyType: "168-Unit Class C → B+ Value-Add + Expansion",
    // Property details
    parcelId: "25-37-03-00-00124.0-0000.00",
    lotSizeSf: 283140,
    lotSizeAcres: 6.5,
    zoning: "RU-2-15 (Multi-Family Residential, 15 DU/acre)",
    yearBuilt: 1986,
    lastSaleDate: "2016-08-22",
    lastSalePrice: 11200000,
    assessedValue: 16800000,
    stories: 2,
    buildings: 14,
    parking: { spaces: 252, ratio: 1.5, type: "Surface" },
    // Existing state
    askPrice: 18500000,
    existingUnits: 168,
    existingSqft: 134000,
    existingNoi: 1120000,
    existingOccupancy: 0.84,
    existingCapRate: 0.0605,
    existingRentPerUnit: 985,
    unitMix: [
      { type: "1BR/1BA", count: 72, avgSf: 680, avgRent: 895 },
      { type: "2BR/1.5BA", count: 72, avgSf: 850, avgRent: 1025 },
      { type: "3BR/2BA", count: 24, avgSf: 1050, avgRent: 1175 },
    ],
    // Renovation scope
    renovationBudget: 4800000,
    renovPerUnit: 28571,
    unitRenovations: 168,
    // Expansion scope — Zoning Agent data
    expansionUnits: 48,
    expansionSqft: 43200,
    expansionCost: 12600000,
    expansionCostPerUnit: 262500,
    zoningAllows: 280,
    maxDensity: 15,
    currentDensity: 168,
    additionalCapacity: 112,
    zoningUtilization: 0.6,
    // Combined post-reno + expansion
    totalUnits: 216,
    totalInvestment: 35900000,
    stabilizedNoi: 2640000,
    stabilizedCapRate: 0.0735,
    stabilizedRentPerUnit: 1410,
    exitValue: 48000000,
    valueCreation: 12100000,
    irr: 19.2,
    equityMultiple: 1.9,
    equityRequired: 12800000,
    debtAmount: 23100000,
    // Timeline
    renovationMonths: 14,
    leaseUpMonths: 6,
    totalTimelineMonths: 20,
  },
};

const JEDI_SCORE = {
  score: 82, delta30d: 4, verdict: "OPPORTUNITY", confidence: 87,
  confidenceLabel: "High", dataCompleteness: 87,
};

const SIGNALS = [
  { id: "demand", name: "Demand", weight: 30, score: 88, trend: "up", delta: 5, color: T.green, bg: T.greenBg, desc: "Amazon announced 2,000 jobs in trade area. Net absorption exceeds pipeline." },
  { id: "supply", name: "Supply", weight: 25, score: 72, trend: "down", delta: -3, color: T.amber, bg: T.amberBg, desc: "1,200 units in pipeline within 3mi. But demand absorbing at 1.3x rate." },
  { id: "momentum", name: "Momentum", weight: 20, score: 85, trend: "up", delta: 2, color: T.blue, bg: T.blueBg, desc: "Rent growth accelerating at +3.2% YoY. DOM declining — market tightening." },
  { id: "position", name: "Position", weight: 15, score: 79, trend: "flat", delta: 0, color: T.violet, bg: T.violetBg, desc: "78th percentile submarket rank. Top quartile for amenity density." },
  { id: "risk", name: "Risk", weight: 10, score: 81, trend: "up", delta: 3, color: T.textDim, bg: T.bgCard, desc: "Low demand risk. Supply risk elevated but offset by absorption." },
];

const RISK_ALERT = {
  show: true, severity: "medium", category: "Supply Risk", score: 68,
  detail: "1,200 units delivering 2026–2027 within 3mi radius",
  mitigation: "Demand absorption rate exceeds pipeline at 1.3x. Net supply pressure: MANAGEABLE.",
};

// ─── Strategy sets per deal type ─────────────────────────────────────────────
const STRATEGIES = {
  existing: [
    { id: "value_add", name: "Value-Add Hold", score: 84, irr: "18.4%", equity: "$13.5M", hold: "5 yr", confidence: 88, winner: true },
    { id: "flip", name: "Flip (Renovate & Sell)", score: 71, irr: "22.7%", equity: "$13.5M", hold: "24 mo", confidence: 72, winner: false },
    { id: "rental", name: "Stabilized Rental", score: 69, irr: "13.5%", equity: "$13.5M", hold: "7 yr", confidence: 91, winner: false },
    { id: "str", name: "STR / Airbnb", score: 43, irr: "9.1%", equity: "$13.5M", hold: "5 yr", confidence: 43, winner: false },
  ],
  development: [
    { id: "bts", name: "Build-to-Sell", score: 87, irr: "22.7%", equity: "$19.6M", hold: "30 mo", confidence: 82, winner: true },
    { id: "btr", name: "Build-to-Rent", score: 74, irr: "16.3%", equity: "$19.6M", hold: "7 yr", confidence: 88, winner: false },
    { id: "entitle_sell", name: "Entitle & Sell", score: 68, irr: "34.0%", equity: "$8.5M", hold: "12 mo", confidence: 65, winner: false },
  ],
  redevelopment: [
    { id: "renovate_expand", name: "Renovate + Expand", score: 82, irr: "19.2%", equity: "$12.8M", hold: "5 yr", confidence: 85, winner: true },
    { id: "renovate_sell", name: "Renovate & Sell", score: 74, irr: "24.1%", equity: "$12.8M", hold: "24 mo", confidence: 78, winner: false },
    { id: "renovate_hold", name: "Renovate & Hold", score: 71, irr: "15.8%", equity: "$12.8M", hold: "7 yr", confidence: 90, winner: false },
    { id: "reposition", name: "Full Reposition", score: 65, irr: "21.3%", equity: "$15.2M", hold: "36 mo", confidence: 62, winner: false },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n, prefix = "$") => {
  if (n >= 1e9) return `${prefix}${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${prefix}${(n / 1e3).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const bps = (n) => `${n} bps`;

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function JEDIScoreGauge({ score }) {
  const r = 46, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? T.green : score >= 70 ? T.amber : score >= 55 ? T.textDim : T.red;
  return (
    <div style={{ position: "relative", width: 116, height: 116, flexShrink: 0 }}>
      <svg width="116" height="116" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="58" cy="58" r={r} fill="none" stroke={T.border} strokeWidth="8" />
        <circle cx="58" cy="58" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: T.text }}>{score}</span>
        <span style={{ fontSize: 9, color: T.textDim, letterSpacing: 2, ...mono }}>JEDI SCORE</span>
      </div>
    </div>
  );
}

function SignalBar({ signals }) {
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
        {signals.map(s => (
          <div key={s.id} style={{ width: `${s.weight}%`, background: s.color, opacity: 0.9 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {signals.map(s => (
          <div key={s.id} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: T.textDim, ...mono }}>{s.name} ({s.weight}%)</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{s.score}</span>
              {s.delta !== 0 && (
                <span style={{ fontSize: 9, color: s.delta > 0 ? T.green : T.red, ...mono }}>
                  {s.delta > 0 ? "+" : ""}{s.delta}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JEDIScoreHero({ signals, onNavigate }) {
  const verdictColor = JEDI_SCORE.score >= 85 ? T.green : JEDI_SCORE.score >= 70 ? T.amber : T.textDim;
  return (
    <div style={{ background: T.bgCard, borderRadius: 12, padding: 24, border: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
        <JEDIScoreGauge score={JEDI_SCORE.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: verdictColor, ...mono }}>
              {JEDI_SCORE.verdict}
            </span>
            {JEDI_SCORE.delta30d !== 0 && (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4, ...mono,
                background: JEDI_SCORE.delta30d > 0 ? T.greenBg : T.redBg,
                color: JEDI_SCORE.delta30d > 0 ? T.greenLight : T.redLight,
              }}>
                {JEDI_SCORE.delta30d > 0 ? "+" : ""}{JEDI_SCORE.delta30d} pts (30d)
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.5, ...sans }}>
            Confidence: {JEDI_SCORE.confidenceLabel} ({JEDI_SCORE.confidence}%) · Data completeness: {JEDI_SCORE.dataCompleteness}%
          </p>
          <SignalBar signals={signals} />
        </div>
      </div>
    </div>
  );
}

function StrategyVerdictCard({ strategies, onNavigate }) {
  const winner = strategies.find(s => s.winner) || strategies[0];
  const second = strategies.filter(s => !s.winner).sort((a, b) => b.score - a.score)[0];
  const gap = winner.score - (second?.score || 0);
  const isArbitrage = gap >= 15;

  return (
    <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: T.textDim, marginBottom: 8, ...mono }}>STRATEGY VERDICT</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{winner.name}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.amber, ...mono }}>{winner.score}</span>
      </div>
      {second && (
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 12, ...sans }}>
          vs {second.name}: {second.score}
        </div>
      )}
      {isArbitrage && (
        <div style={{ background: T.amberBg, border: `1px solid ${T.amber}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.amberLight, ...mono }}>⚡ ARBITRAGE</span>
            <span style={{ fontSize: 11, color: T.amber, ...mono }}>+{gap}pt gap</span>
          </div>
          <p style={{ fontSize: 11, color: T.amberLight, lineHeight: 1.5, ...sans }}>
            Platform identifies a {gap}-point strategy divergence. Most would miss this.
          </p>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {strategies.map(s => (
          <div key={s.id} style={{
            flex: 1, minWidth: 90, padding: "8px 10px", borderRadius: 8,
            background: s.winner ? `${T.amber}15` : T.bg,
            border: `1px solid ${s.winner ? T.amber + "40" : T.border}`,
          }}>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 2, ...mono }}>{s.name}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.winner ? T.amberLight : T.text }}>{s.score}</div>
            <div style={{ fontSize: 10, color: T.textDim, ...mono }}>IRR {s.irr}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskAlertBanner({ alert }) {
  if (!alert.show) return null;
  const colors = {
    low: { bg: T.bgCard, border: T.border, text: T.textMuted },
    medium: { bg: T.amberBg, border: `${T.amber}40`, text: T.amberLight },
    high: { bg: T.redBg, border: `${T.red}40`, text: T.redLight },
  };
  const c = colors[alert.severity];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: c.text, ...mono }}>
            {alert.severity === "high" ? "⚠ HIGH RISK" : "RISK ALERT"}
          </span>
          <span style={{ fontSize: 11, color: T.textDim, ...mono }}>{alert.category}: {alert.score}/100</span>
        </div>
        <p style={{ fontSize: 12, color: c.text, ...sans }}>{alert.detail}</p>
        <p style={{ fontSize: 11, color: T.textDim, marginTop: 4, ...sans }}>{alert.mitigation}</p>
      </div>
    </div>
  );
}

function SignalDetailCards({ signals }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
      {signals.map(s => (
        <div key={s.id} style={{ background: s.bg, borderRadius: 10, padding: 14, border: `1px solid ${s.color}20` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: T.textDim, ...mono }}>{s.name.toUpperCase()}</span>
            {s.delta !== 0 && (
              <span style={{ fontSize: 9, color: s.delta > 0 ? T.green : T.red, ...mono }}>
                {s.delta > 0 ? "+" : ""}{s.delta}
              </span>
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>{s.score}</div>
          <p style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5, ...sans }}>{s.desc}</p>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, context, contextColor, large }) {
  const cColors = { green: T.green, amber: T.amber, red: T.red, gray: T.textDim };
  return (
    <div style={{ background: T.bgCard, borderRadius: 10, padding: large ? 20 : 14, border: `1px solid ${T.border}` }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: T.textDim, marginBottom: 6, ...mono }}>{label}</div>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 700, color: T.text, marginBottom: 4, ...sans }}>{value}</div>
      {context && <div style={{ fontSize: 11, color: cColors[contextColor] || T.textDim, lineHeight: 1.5, ...sans }}>{context}</div>}
    </div>
  );
}

function SectionLabel({ label, color }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: color || T.amber, marginBottom: 10, ...mono }}>
      {label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY DETAILS STRIP
// ═══════════════════════════════════════════════════════════════════════════════
// Renders at the top of every overview variant. Shared identity row + variant
// detail rows. Shows "—" for fields not yet populated by Research Agent.
// Source: GET /api/v1/deals/:id + Zoning Agent + Research Agent DealContext

function PropertyIdentityStrip({ deal }) {
  const typeColors = {
    existing: { bg: T.blueBg, border: T.blue, text: T.blueLight, label: "EXISTING ACQUISITION" },
    development: { bg: T.greenBg, border: T.green, text: T.greenLight, label: "GROUND-UP DEVELOPMENT" },
    redevelopment: { bg: T.violetBg, border: T.violet, text: T.violet, label: "REDEVELOPMENT" },
  };
  const tc = typeColors[deal.projectType] || typeColors.existing;

  return (
    <div style={{ background: T.bgCard, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      {/* Top bar: Name + Type + Address */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{deal.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, padding: "3px 10px", borderRadius: 4,
              background: tc.bg, color: tc.text, border: `1px solid ${tc.border}40`, ...mono,
            }}>{tc.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: T.textMuted, ...sans }}>📍 {deal.address}</span>
            {deal.county && <span style={{ fontSize: 11, color: T.textDim, ...mono }}>· {deal.county} County</span>}
          </div>
        </div>
        {/* Pricing hero — right aligned */}
        <div style={{ textAlign: "right" }}>
          {deal.askPrice && (
            <>
              <div style={{ fontSize: 10, color: T.textDim, ...mono }}>
                {deal.projectType === "development" ? "LAND PRICE" : "ASK PRICE"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: T.amberLight, ...sans }}>
                {fmt(deal.projectType === "development" ? deal.landPrice : deal.askPrice)}
              </div>
            </>
          )}
          {deal.totalDevCost && deal.projectType === "development" && (
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, ...mono }}>
              Total dev cost: {fmt(deal.totalDevCost)}
            </div>
          )}
        </div>
      </div>

      {/* Property details grid */}
      <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 0 }}>
        {/* Shared fields — all variants */}
        <PropField label="Parcel ID" value={deal.parcelId} mono />
        <PropField label="Lot Size" value={deal.lotSizeAcres ? `${deal.lotSizeAcres} ac (${deal.lotSizeSf?.toLocaleString()} SF)` : null} />
        <PropField label="Zoning" value={deal.zoning} />
        <PropField label="Property Type" value={deal.propertyType?.split(" ").slice(-1)[0] || deal.propertyType} />
        
        {/* Variant-specific fields */}
        {(deal.projectType === "existing" || deal.projectType === "redevelopment") && (
          <>
            <PropField label="Year Built" value={deal.yearBuilt} />
            <PropField label="Units" value={deal.units || deal.existingUnits} />
            <PropField label="Total SF" value={deal.sqft?.toLocaleString() || deal.existingSqft?.toLocaleString()} />
            <PropField label="Stories / Buildings" value={deal.stories && deal.buildings ? `${deal.stories}-story · ${deal.buildings} bldgs` : null} />
          </>
        )}
        
        {deal.projectType === "development" && (
          <>
            <PropField label="Proposed Units" value={deal.units} />
            <PropField label="Proposed SF" value={deal.sqft?.toLocaleString()} />
            {deal.retailSqft > 0 && <PropField label="Retail SF" value={deal.retailSqft?.toLocaleString()} />}
            <PropField label="Entitled" value={deal.entitled ? "✓ Yes" : "✗ Not yet"} highlight={deal.entitled ? "green" : "amber"} />
          </>
        )}
        
        {deal.projectType === "redevelopment" && (
          <>
            <PropField label="Zoning Allows" value={deal.zoningAllows ? `${deal.zoningAllows} units` : null} />
            <PropField label="Capacity Used" value={deal.zoningUtilization ? pct(deal.zoningUtilization) : null} highlight={deal.zoningUtilization < 0.7 ? "green" : "gray"} />
          </>
        )}

        <PropField label="Parking" value={deal.parking ? `${deal.parking.spaces} spaces (${deal.parking.ratio}/unit) · ${deal.parking.type}` : null} />
        <PropField label="Assessed Value" value={deal.assessedValue ? fmt(deal.assessedValue) : null} />
        {deal.lastSaleDate && <PropField label="Last Sale" value={`${fmt(deal.lastSalePrice)} (${new Date(deal.lastSaleDate).getFullYear()})`} />}
      </div>

      {/* Zoning envelope bar — development & redevelopment */}
      {(deal.projectType === "development" || deal.projectType === "redevelopment") && deal.maxDensity && (
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: T.textDim, flexShrink: 0, ...mono }}>ZONING ENVELOPE</span>
            <div style={{ display: "flex", gap: 16, flex: 1 }}>
              {[
                { label: "Density", value: `${deal.maxDensity} DU/ac` },
                deal.maxFar && { label: "FAR", value: deal.maxFar.toFixed(1) },
                deal.maxHeight && { label: "Height", value: `${deal.maxHeight} ft` },
                deal.maxLotCoverage && { label: "Lot Coverage", value: pct(deal.maxLotCoverage) },
                deal.setbacks && { label: "Setbacks", value: `${deal.setbacks.front}/${deal.setbacks.side}/${deal.setbacks.rear} ft` },
                deal.buildableAreaSf && { label: "Buildable", value: `${deal.buildableAreaSf.toLocaleString()} SF` },
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 10, color: T.textDim, ...mono }}>{item.label}:</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.text, ...mono }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unit mix snapshot — all variants */}
      {deal.unitMix && deal.unitMix.length > 0 && (
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 9, letterSpacing: 2, color: T.textDim, flexShrink: 0, ...mono }}>
              {deal.projectType === "development" ? "PROPOSED UNIT MIX" : "UNIT MIX"}
            </span>
            <div style={{ display: "flex", gap: 2, flex: 1 }}>
              {deal.unitMix.map((u, i) => {
                const totalUnits = deal.unitMix.reduce((s, x) => s + x.count, 0);
                return (
                  <div key={i} style={{
                    flex: u.count / totalUnits, height: 20, borderRadius: 3,
                    background: [T.blue, T.green, T.amber, T.violet][i % 4] + "50",
                    border: `1px solid ${[T.blue, T.green, T.amber, T.violet][i % 4]}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    minWidth: 60,
                  }}>
                    <span style={{ fontSize: 9, color: T.text, fontWeight: 500, ...mono }}>
                      {u.type} × {u.count}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {deal.unitMix.map((u, i) => (
                <span key={i} style={{ fontSize: 9, color: T.textDim, ...mono }}>
                  {u.type}: {u.avgSf}SF · {fmt(u.avgRent)}/mo
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropField({ label, value, mono: useMono, highlight }) {
  const highlightColors = { green: T.greenLight, amber: T.amberLight, gray: T.textMuted };
  return (
    <div style={{ padding: "6px 12px 6px 0" }}>
      <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1, marginBottom: 2, ...mono }}>{label.toUpperCase()}</div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        color: highlight ? highlightColors[highlight] : T.text,
        ...(useMono ? mono : sans),
      }}>
        {value || "—"}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING ACQUISITION OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ExistingOverview({ deal, onNavigate }) {
  const strategies = STRATEGIES.existing;

  const noiWaterfall = [
    { label: "Gross Potential Rent", current: 3990000, stabilized: 4377600, isBold: false },
    { label: "Vacancy & Concessions", current: -303240, stabilized: -218880, isBold: false },
    { label: "Other Income", current: 192000, stabilized: 264000, isBold: false },
    { label: "Effective Gross Income", current: 3878760, stabilized: 4422720, isBold: true },
    { label: "Operating Expenses", current: -1538760, stabilized: -1532720, isBold: false },
    { label: "Net Operating Income", current: deal.noi, stabilized: deal.stabilizedNoi, isBold: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Property Details Strip */}
      <PropertyIdentityStrip deal={deal} />

      {/* Row 1: JEDI Score + Strategy Verdict */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <JEDIScoreHero signals={SIGNALS} onNavigate={onNavigate} />
        <StrategyVerdictCard strategies={strategies} onNavigate={onNavigate} />
      </div>

      {/* Risk Alert */}
      <RiskAlertBanner alert={RISK_ALERT} />

      {/* Row 2: Hero KPIs — Acquisition metrics */}
      <SectionLabel label="ACQUISITION SNAPSHOT" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard label="GOING-IN CAP RATE" value={pct(deal.capRate)} context="In line with market — no hidden discount" contextColor="gray" />
        <MetricCard label="CURRENT NOI" value={fmt(deal.noi)} context={`${pct(deal.stabilizedNoi / deal.askPrice)} stabilized cap`} contextColor="green" />
        <MetricCard label="PRICE / UNIT" value={fmt(deal.pricePerUnit)} context="12% above submarket median" contextColor="amber" />
        <MetricCard label="OCCUPANCY" value={pct(deal.occupancy)} context={`Market avg 94.1% — ${deal.occupancy > 0.941 ? "outperforming" : "underperforming"}`} contextColor={deal.occupancy > 0.94 ? "green" : "amber"} />
      </div>

      {/* Row 3: Sources & Uses + NOI Waterfall */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Sources & Uses */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="SOURCES & USES" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8, ...mono }}>SOURCES</div>
              {[
                { label: "Senior Debt", value: deal.debtAmount, pct: deal.debtAmount / deal.askPrice },
                { label: "Sponsor Equity", value: deal.equityRequired, pct: deal.equityRequired / deal.askPrice },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.text, ...sans }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: T.text, ...mono }}>{fmt(row.value)} <span style={{ color: T.textDim }}>({pct(row.pct)})</span></span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${T.amber}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, ...sans }}>Total Sources</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, ...mono }}>{fmt(deal.askPrice)}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 8, ...mono }}>USES</div>
              {[
                { label: "Purchase Price", value: deal.askPrice },
                { label: "Renovation Budget", value: deal.renovationBudget },
                { label: "Closing Costs", value: Math.round(deal.askPrice * 0.015) },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 12, color: T.text, ...sans }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: T.text, ...mono }}>{fmt(row.value)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: `2px solid ${T.amber}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text, ...sans }}>Total Uses</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, ...mono }}>{fmt(deal.askPrice + deal.renovationBudget + Math.round(deal.askPrice * 0.015))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* NOI Waterfall */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="NOI WATERFALL — CURRENT → STABILIZED" />
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: 0 }}>
            {/* Header */}
            {["", "Current", "Stabilized", "Delta"].map((h, i) => (
              <div key={i} style={{ padding: "6px 10px", fontSize: 10, color: T.textDim, borderBottom: `1px solid ${T.border}`, textAlign: i > 0 ? "right" : "left", ...mono }}>
                {h}
              </div>
            ))}
            {/* Rows */}
            {noiWaterfall.map((row, i) => {
              const delta = row.stabilized - row.current;
              return [
                <div key={`l${i}`} style={{ padding: "8px 10px", fontSize: 12, color: T.text, fontWeight: row.isBold ? 700 : 400, borderBottom: `1px solid ${T.border}`, ...sans }}>
                  {row.label}
                </div>,
                <div key={`c${i}`} style={{ padding: "8px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, fontWeight: row.isBold ? 700 : 400, ...mono }}>
                  {fmt(row.current)}
                </div>,
                <div key={`s${i}`} style={{ padding: "8px 10px", fontSize: 12, color: T.text, textAlign: "right", borderBottom: `1px solid ${T.border}`, fontWeight: row.isBold ? 700 : 400, ...mono }}>
                  {fmt(row.stabilized)}
                </div>,
                <div key={`d${i}`} style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", borderBottom: `1px solid ${T.border}`, fontWeight: row.isBold ? 700 : 400, color: delta > 0 ? T.green : delta < 0 ? T.red : T.text, ...mono }}>
                  {delta > 0 ? "+" : ""}{fmt(delta)}
                </div>,
              ];
            })}
          </div>
        </div>
      </div>

      {/* Row 4: Return metrics + Value-Add intel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard label="PROJ. IRR" value={deal.irr + "%"} context="Exceeds 15% threshold" contextColor="green" />
        <MetricCard label="EQUITY MULTIPLE" value={deal.equityMultiple + "x"} context={`${deal.equityMultiple}x on ${fmt(deal.equityRequired)} equity`} contextColor="green" />
        <MetricCard label="CASH-ON-CASH" value={deal.cashOnCash + "%"} context="Year 1 levered yield" contextColor="green" />
        <MetricCard label="DSCR" value={deal.dscr + "x"} context="7bps above 1.25x minimum" contextColor="amber" />
      </div>

      {/* Rent Gap Intelligence */}
      <div style={{ background: T.blueBg, border: `1px solid ${T.blue}30`, borderRadius: 12, padding: 20 }}>
        <SectionLabel label="VALUE-ADD INTELLIGENCE" color={T.blueLight} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: T.blueLight, marginBottom: 2, ...sans }}>Current Avg Rent</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{fmt(deal.rentPerUnit)}/mo</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.blueLight, marginBottom: 2, ...sans }}>Market Rent (Comp Avg)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>{fmt(deal.marketRent)}/mo</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.blueLight, marginBottom: 2, ...sans }}>Rent Gap (Upside)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.greenLight }}>+{pct(deal.rentGap)}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2, ...sans }}>
              = +{fmt(Math.round((deal.marketRent - deal.rentPerUnit) * deal.units * 12))}/yr NOI potential
            </div>
          </div>
        </div>
      </div>

      {/* Signal Detail Cards */}
      <SignalDetailCards signals={SIGNALS} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPMENT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function DevelopmentOverview({ deal, onNavigate }) {
  const strategies = STRATEGIES.development;
  const phases = [
    { label: "Pre-Dev", months: 4, color: T.violet, start: 0 },
    { label: "Construction", months: deal.constructionMonths, color: T.blue, start: 4 },
    { label: "Lease-Up", months: deal.leaseUpMonths, color: T.green, start: 4 + deal.constructionMonths },
  ];
  const totalMonths = phases.reduce((a, p) => Math.max(a, p.start + p.months), 0);

  const costStack = [
    { label: "Land Acquisition", value: deal.landPrice, color: T.amber },
    { label: "Hard Costs", value: deal.hardCosts, color: T.blue },
    { label: "Soft Costs", value: deal.softCosts, color: T.violet },
    { label: "Contingency", value: deal.contingency, color: T.textDim },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Property Details Strip */}
      <PropertyIdentityStrip deal={deal} />

      {/* Row 1: JEDI Score + Strategy Verdict */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <JEDIScoreHero signals={SIGNALS} onNavigate={onNavigate} />
        <StrategyVerdictCard strategies={strategies} onNavigate={onNavigate} />
      </div>

      <RiskAlertBanner alert={RISK_ALERT} />

      {/* Row 2: Dev KPIs */}
      <SectionLabel label="DEVELOPMENT SNAPSHOT" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard label="YIELD ON COST" value={pct(deal.yieldOnCost)} large
          context={`Dev spread: +${deal.devSpread}bps over market cap`} contextColor="green" />
        <MetricCard label="TOTAL DEV COST" value={fmt(deal.totalDevCost)} large
          context={`${fmt(deal.costPerUnit)}/unit · ${fmt(deal.costPerSf)}/SF`} contextColor="gray" />
        <MetricCard label="PROFIT MARGIN" value={pct(deal.profitMargin)} large
          context={`${fmt(deal.exitValue - deal.totalDevCost)} value creation`} contextColor="green" />
        <MetricCard label="TIMELINE" value={`${deal.timelineMonths} mo`} large
          context={`${deal.constructionMonths}mo build + ${deal.leaseUpMonths}mo lease-up`} contextColor="gray" />
      </div>

      {/* Row 3: Cost Stack + Zoning/Entitlement Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Cost Stack */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="DEVELOPMENT COST STACK" />
          {/* Stacked bar */}
          <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
            {costStack.map((c, i) => (
              <div key={i} style={{ width: `${(c.value / deal.totalDevCost) * 100}%`, background: c.color, opacity: 0.8 }}
                title={`${c.label}: ${fmt(c.value)}`} />
            ))}
          </div>
          {/* Line items */}
          {costStack.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
                <span style={{ fontSize: 12, color: T.text, ...sans }}>{c.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text, ...mono }}>{fmt(c.value)}</span>
                <span style={{ fontSize: 10, color: T.textDim, ...mono }}>{pct(c.value / deal.totalDevCost)}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${T.amber}`, marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text, ...sans }}>Total Development Cost</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, ...mono }}>{fmt(deal.totalDevCost)}</span>
          </div>
        </div>

        {/* Zoning & Entitlement Status */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="ZONING & ENTITLEMENT STATUS" />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, marginBottom: 16,
            background: deal.entitled ? T.greenBg : T.amberBg,
            border: `1px solid ${deal.entitled ? T.green : T.amber}40`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: deal.entitled ? T.green : T.amber }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: deal.entitled ? T.greenLight : T.amberLight, ...mono }}>
              {deal.entitled ? "ENTITLED" : "ENTITLEMENT PENDING"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Zoning", value: deal.zoning },
              { label: "Max Density", value: `${deal.maxDensity} DU/acre` },
              { label: "Max FAR", value: deal.maxFar.toFixed(1) },
              { label: "Max Height", value: `${deal.maxHeight} ft` },
              { label: "Land Area", value: `${(deal.landArea / 43560).toFixed(2)} acres` },
              { label: "Proposed Units", value: `${deal.units} units` },
            ].map((item, i) => (
              <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, ...mono }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, ...sans }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Sources & Uses compact */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: T.textDim, marginBottom: 8, ...mono }}>CAPITAL STACK</div>
            {[
              { label: "Construction Loan", value: deal.constructionLoan, pct: deal.constructionLoan / deal.totalDevCost },
              { label: "Sponsor Equity", value: deal.equityRequired, pct: deal.equityRequired / deal.totalDevCost },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.text, ...sans }}>{row.label}</span>
                <span style={{ fontSize: 12, color: T.text, ...mono }}>{fmt(row.value)} <span style={{ color: T.textDim }}>({pct(row.pct)})</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Timeline Gantt */}
      <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <SectionLabel label="PROJECT TIMELINE" />
        <div style={{ position: "relative", height: 80 }}>
          {phases.map((p, i) => {
            const left = `${(p.start / totalMonths) * 100}%`;
            const width = `${(p.months / totalMonths) * 100}%`;
            return (
              <div key={i} style={{
                position: "absolute", left, width, top: i * 26, height: 22,
                background: p.color + "30", border: `1px solid ${p.color}60`, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.color, ...mono }}>
                  {p.label} ({p.months}mo)
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: T.textDim, ...mono }}>Start</span>
          <span style={{ fontSize: 10, color: T.textDim, ...mono }}>Month {totalMonths} — Stabilized</span>
        </div>
      </div>

      {/* Row 5: Return metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard label="PROJ. IRR" value={deal.irr + "%"} context="Exceeds 18% dev threshold" contextColor="green" />
        <MetricCard label="EQUITY MULTIPLE" value={deal.equityMultiple + "x"} context={`${deal.equityMultiple}x on ${fmt(deal.equityRequired)}`} contextColor="green" />
        <MetricCard label="STABILIZED NOI" value={fmt(deal.stabilizedNoi)} context={`Exit cap: ${pct(deal.exitCapRate)}`} contextColor="gray" />
        <MetricCard label="EXIT VALUE" value={fmt(deal.exitValue)} context={`Profit: ${fmt(deal.exitValue - deal.totalDevCost)}`} contextColor="green" />
      </div>

      <SignalDetailCards signals={SIGNALS} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REDEVELOPMENT OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════

function RedevelopmentOverview({ deal, onNavigate }) {
  const strategies = STRATEGIES.redevelopment;
  const noiDelta = deal.stabilizedNoi - deal.existingNoi;
  const valueDelta = deal.exitValue - deal.askPrice;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Property Details Strip */}
      <PropertyIdentityStrip deal={deal} />

      {/* Row 1: JEDI Score + Strategy Verdict */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <JEDIScoreHero signals={SIGNALS} onNavigate={onNavigate} />
        <StrategyVerdictCard strategies={strategies} onNavigate={onNavigate} />
      </div>

      <RiskAlertBanner alert={RISK_ALERT} />

      {/* Row 2: NOI Transformation — the hero section for redev */}
      <div style={{ background: T.bgCard, borderRadius: 12, padding: 24, border: `1px solid ${T.border}` }}>
        <SectionLabel label="NOI TRANSFORMATION" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 0, alignItems: "center" }}>
          {/* As-Is */}
          <div style={{ textAlign: "center", padding: 16 }}>
            <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, ...mono }}>AS-IS NOI</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: T.text, ...sans }}>{fmt(deal.existingNoi)}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, ...sans }}>
              {deal.existingUnits} units · {pct(deal.existingOccupancy)} occ · {pct(deal.existingCapRate)} cap
            </div>
          </div>
          {/* Arrow */}
          <div style={{ fontSize: 28, color: T.amber, padding: "0 12px" }}>→</div>
          {/* Stabilized */}
          <div style={{ textAlign: "center", padding: 16, background: T.greenBg, borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: T.greenLight, marginBottom: 4, ...mono }}>STABILIZED NOI</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: T.greenLight, ...sans }}>{fmt(deal.stabilizedNoi)}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, ...sans }}>
              {deal.totalUnits} units · 95% target · {pct(deal.stabilizedCapRate)} cap
            </div>
          </div>
          {/* = sign */}
          <div style={{ fontSize: 28, color: T.textDim, padding: "0 12px" }}>=</div>
          {/* Delta */}
          <div style={{ textAlign: "center", padding: 16, background: T.amberBg, borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: T.amberLight, marginBottom: 4, ...mono }}>NOI UPLIFT</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: T.amberLight, ...sans }}>+{fmt(noiDelta)}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, ...sans }}>
              +{pct(noiDelta / deal.existingNoi)} increase
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Dual-scope breakdown (Renovation + Expansion) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Renovation Scope */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="RENOVATION SCOPE" color={T.blueLight} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Units Renovated", value: `${deal.unitRenovations} of ${deal.existingUnits}` },
              { label: "Renovation Budget", value: fmt(deal.renovationBudget) },
              { label: "Cost / Unit", value: fmt(deal.renovPerUnit) },
              { label: "Current Rent", value: `${fmt(deal.existingRentPerUnit)}/mo` },
              { label: "Target Rent", value: `${fmt(deal.stabilizedRentPerUnit)}/mo` },
              { label: "Rent Uplift", value: `+${fmt(deal.stabilizedRentPerUnit - deal.existingRentPerUnit)}/mo (+${pct((deal.stabilizedRentPerUnit - deal.existingRentPerUnit) / deal.existingRentPerUnit)})` },
            ].map((item, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, ...mono }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, ...sans }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Expansion Scope */}
        <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
          <SectionLabel label="EXPANSION SCOPE" color={T.violet} />
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 6, marginBottom: 12,
            background: T.greenBg, border: `1px solid ${T.green}40`,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.greenLight, ...mono }}>
              ZONING ALLOWS +{deal.additionalCapacity} UNITS
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "New Units", value: `+${deal.expansionUnits} units` },
              { label: "Expansion Cost", value: fmt(deal.expansionCost) },
              { label: "Cost / New Unit", value: fmt(deal.expansionCostPerUnit) },
              { label: "New Sqft", value: `${deal.expansionSqft.toLocaleString()} SF` },
              { label: "Zoning Utilization", value: `${deal.existingUnits}/${deal.zoningAllows} (${pct(deal.zoningUtilization)})` },
              { label: "Post-Expansion", value: `${deal.totalUnits} total units` },
            ].map((item, i) => (
              <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textDim, ...mono }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, ...sans }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Value Bridge */}
      <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <SectionLabel label="VALUE BRIDGE" />
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {[
            { label: "As-Is Value", value: deal.askPrice, color: T.textDim, sublabel: `${pct(deal.existingCapRate)} cap` },
            { label: "+", value: null, isOp: true },
            { label: "Renovation", value: deal.renovationBudget, color: T.blue, sublabel: `${deal.unitRenovations} units` },
            { label: "+", value: null, isOp: true },
            { label: "Expansion", value: deal.expansionCost, color: T.violet, sublabel: `+${deal.expansionUnits} units` },
            { label: "=", value: null, isOp: true },
            { label: "Total Basis", value: deal.totalInvestment, color: T.amber, sublabel: "all-in cost" },
            { label: "→", value: null, isOp: true },
            { label: "Stabilized Value", value: deal.exitValue, color: T.green, sublabel: `${pct(deal.stabilizedCapRate)} cap` },
          ].map((step, i) => step.isOp ? (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "0 8px", fontSize: 20, color: T.textDim }}>
              {step.label}
            </div>
          ) : (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: 12 }}>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4, ...mono }}>{step.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: step.color, ...sans }}>{fmt(step.value)}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, ...sans }}>{step.sublabel}</div>
            </div>
          ))}
        </div>
        {/* Value creation callout */}
        <div style={{
          marginTop: 12, background: T.greenBg, border: `1px solid ${T.green}30`, borderRadius: 8,
          padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.greenLight, ...sans }}>Value Creation</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: T.greenLight, ...mono }}>
            +{fmt(deal.exitValue - deal.totalInvestment)}
          </span>
        </div>
      </div>

      {/* Row 5: Timeline — Acquire → Renovate → Lease-Up */}
      <div style={{ background: T.bgCard, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <SectionLabel label="REDEVELOPMENT TIMELINE" />
        <div style={{ position: "relative", height: 56 }}>
          {[
            { label: "Acquire & Plan", months: 2, color: T.amber, start: 0 },
            { label: "Renovation + Expansion", months: deal.renovationMonths, color: T.blue, start: 2 },
            { label: "Lease-Up", months: deal.leaseUpMonths, color: T.green, start: 2 + deal.renovationMonths },
          ].map((p, i) => {
            const totalM = deal.totalTimelineMonths + 2;
            return (
              <div key={i} style={{
                position: "absolute", left: `${(p.start / totalM) * 100}%`, width: `${(p.months / totalM) * 100}%`,
                top: i * 18, height: 16, background: p.color + "30", border: `1px solid ${p.color}60`, borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: p.color, ...mono }}>{p.label} ({p.months}mo)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 6: Return metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard label="PROJ. IRR" value={deal.irr + "%"} context="Blended renovation + expansion" contextColor="green" />
        <MetricCard label="EQUITY MULTIPLE" value={deal.equityMultiple + "x"} context={`On ${fmt(deal.equityRequired)} equity`} contextColor="green" />
        <MetricCard label="VALUE CREATION" value={fmt(deal.exitValue - deal.totalInvestment)} context={`${pct((deal.exitValue - deal.totalInvestment) / deal.totalInvestment)} return on basis`} contextColor="green" />
        <MetricCard label="RENOVATION ROI" value={pct(noiDelta / deal.renovationBudget)} context={`${fmt(noiDelta)} NOI uplift / ${fmt(deal.renovationBudget)} cost`} contextColor="green" />
      </div>

      <SignalDetailCards signals={SIGNALS} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEAL CREATION FLOW
// ═══════════════════════════════════════════════════════════════════════════════

function DealCreationFlow({ onDealCreated }) {
  const [step, setStep] = useState(1); // 1 = type selection, 2 = fields
  const [projectType, setProjectType] = useState(null);
  const [fields, setFields] = useState({});

  const types = [
    {
      id: "existing", label: "Existing Acquisition",
      icon: "🏢", desc: "Stabilized or value-add property with in-place tenants and operating history",
      example: "240-unit Class B apartment, 92% occupied, $2.3M NOI",
    },
    {
      id: "development", label: "Ground-Up Development",
      icon: "🏗️", desc: "Vacant land or teardown. New construction from entitlement through lease-up",
      example: "3.6-acre entitled site, PD zoning, 312-unit podium",
    },
    {
      id: "redevelopment", label: "Redevelopment",
      icon: "🔄", desc: "Existing property with renovation, expansion, or repositioning scope. Zoning allows more density",
      example: "168-unit Class C, zoning allows 280 units — renovate + add 48",
    },
  ];

  const fieldDefs = {
    existing: [
      { key: "propertyAddress", label: "Property Address", type: "text", required: true },
      { key: "askPrice", label: "Ask Price ($)", type: "number", required: true },
      { key: "units", label: "Units", type: "number", required: true },
      { key: "sqft", label: "Total SF", type: "number", required: false },
      { key: "yearBuilt", label: "Year Built", type: "number", required: true },
      { key: "occupancy", label: "Occupancy (%)", type: "number", required: true },
      { key: "noi", label: "Current NOI ($)", type: "number", required: true },
      { key: "capRate", label: "Going-In Cap Rate (%)", type: "number", required: false },
      { key: "avgRent", label: "Avg Rent / Unit ($/mo)", type: "number", required: false },
      { key: "renovationBudget", label: "Renovation Budget ($)", type: "number", required: false },
    ],
    development: [
      { key: "propertyAddress", label: "Site Address", type: "text", required: true },
      { key: "landArea", label: "Land Area (SF)", type: "number", required: true },
      { key: "landPrice", label: "Land Price ($)", type: "number", required: true },
      { key: "zoning", label: "Zoning Designation", type: "text", required: true },
      { key: "entitled", label: "Entitled?", type: "select", options: ["Yes", "No", "In Process"], required: true },
      { key: "proposedUnits", label: "Proposed Units", type: "number", required: true },
      { key: "proposedSqft", label: "Proposed SF", type: "number", required: false },
      { key: "hardCosts", label: "Estimated Hard Costs ($)", type: "number", required: false },
      { key: "softCosts", label: "Estimated Soft Costs ($)", type: "number", required: false },
      { key: "constructionMonths", label: "Construction Timeline (months)", type: "number", required: false },
    ],
    redevelopment: [
      { key: "propertyAddress", label: "Property Address", type: "text", required: true },
      { key: "askPrice", label: "Acquisition Price ($)", type: "number", required: true },
      { key: "existingUnits", label: "Existing Units", type: "number", required: true },
      { key: "yearBuilt", label: "Year Built", type: "number", required: true },
      { key: "existingOccupancy", label: "Current Occupancy (%)", type: "number", required: true },
      { key: "existingNoi", label: "Current NOI ($)", type: "number", required: true },
      { key: "existingRent", label: "Current Avg Rent ($/mo)", type: "number", required: false },
      { key: "renovationBudget", label: "Renovation Budget ($)", type: "number", required: false },
      { key: "expansionUnits", label: "Expansion Units (if any)", type: "number", required: false },
      { key: "expansionBudget", label: "Expansion Budget ($)", type: "number", required: false },
      { key: "zoning", label: "Zoning Designation", type: "text", required: false },
    ],
  };

  const updateField = (key, value) => setFields(prev => ({ ...prev, [key]: value }));

  const handleCreate = () => {
    const deal = { projectType, ...fields, id: `deal-${Date.now()}` };
    onDealCreated?.(deal);
  };

  if (step === 1) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.amber, marginBottom: 8, ...mono }}>NEW DEAL CAPSULE</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: T.text, ...sans }}>What type of deal is this?</div>
          <p style={{ fontSize: 13, color: T.textDim, marginTop: 8, ...sans }}>
            This determines which modules activate, which financial models apply, and which strategies are evaluated.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {types.map(t => (
            <button key={t.id} onClick={() => { setProjectType(t.id); setStep(2); }}
              style={{
                background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: 24, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "flex-start", gap: 16,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.background = T.bgCardHover; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bgCard; }}
            >
              <span style={{ fontSize: 32 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4, ...sans }}>{t.label}</div>
                <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, marginBottom: 8, ...sans }}>{t.desc}</p>
                <div style={{ fontSize: 11, color: T.textDim, fontStyle: "italic", ...sans }}>e.g. {t.example}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Conditional fields
  const currentFields = fieldDefs[projectType] || [];
  const typeLabel = types.find(t => t.id === projectType)?.label;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => { setStep(1); setFields({}); }}
          style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 14px", color: T.textMuted, cursor: "pointer", fontSize: 12, ...mono }}>
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 2, color: T.amber, ...mono }}>NEW {projectType.toUpperCase()} DEAL</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, ...sans }}>{typeLabel}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {currentFields.map(f => (
          <div key={f.key} style={{ gridColumn: f.key === "propertyAddress" ? "1 / -1" : "auto" }}>
            <label style={{ display: "block", fontSize: 11, color: T.textDim, marginBottom: 4, ...mono }}>
              {f.label} {f.required && <span style={{ color: T.red }}>*</span>}
            </label>
            {f.type === "select" ? (
              <select value={fields[f.key] || ""} onChange={e => updateField(f.key, e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13,
                  background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, ...sans,
                }}>
                <option value="">Select...</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type} value={fields[f.key] || ""} onChange={e => updateField(f.key, e.target.value)}
                placeholder={f.type === "number" ? "0" : ""}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13, boxSizing: "border-box",
                  background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, ...sans,
                }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button onClick={handleCreate}
          style={{
            flex: 1, padding: "14px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
            background: T.amber, color: T.bg, border: "none", cursor: "pointer", ...sans,
          }}>
          Create Deal Capsule →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP — Router + Demo
// ═══════════════════════════════════════════════════════════════════════════════

export default function DealCapsuleOverviewApp() {
  const [view, setView] = useState("selector"); // selector | existing | development | redevelopment | create
  const [createdDeal, setCreatedDeal] = useState(null);

  const handleDealCreated = (deal) => {
    setCreatedDeal(deal);
    setView(deal.projectType);
  };

  const navBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, background: T.bgCard, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
      {[
        { id: "selector", label: "Demo Selector" },
        { id: "existing", label: "Existing" },
        { id: "development", label: "Development" },
        { id: "redevelopment", label: "Redevelopment" },
        { id: "create", label: "+ New Deal" },
      ].map(tab => (
        <button key={tab.id} onClick={() => setView(tab.id)}
          style={{
            flex: 1, padding: "12px 16px", background: view === tab.id ? T.amber + "20" : "transparent",
            border: "none", borderBottom: view === tab.id ? `2px solid ${T.amber}` : "2px solid transparent",
            color: view === tab.id ? T.amberLight : T.textDim,
            fontSize: 12, fontWeight: view === tab.id ? 700 : 400, cursor: "pointer",
            ...mono, transition: "all 0.15s",
          }}>
          {tab.label}
        </button>
      ))}
    </div>
  );

  const selectorView = (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: T.amber, marginBottom: 12, ...mono }}>DEAL CAPSULE OVERVIEW</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.text, marginBottom: 8, ...sans }}>3 Overview Variants</div>
      <p style={{ fontSize: 14, color: T.textDim, maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.6, ...sans }}>
        Each deal type gets a purpose-built overview. Same JEDI Score engine and signal framework, different hero metrics, financial snapshots, and strategy sets.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 680, margin: "0 auto" }}>
        {[
          { id: "existing", icon: "🏢", label: "Existing Acquisition", desc: "Cap rate · NOI waterfall · Rent gap · Value-add intel", color: T.blue },
          { id: "development", icon: "🏗️", label: "Ground-Up Development", desc: "Yield on cost · Cost stack · Gantt timeline · Zoning status", color: T.green },
          { id: "redevelopment", icon: "🔄", label: "Redevelopment", desc: "NOI transformation · Value bridge · Dual-scope breakdown", color: T.violet },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 24, cursor: "pointer", textAlign: "center", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{t.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6, ...sans }}>{t.label}</div>
            <p style={{ fontSize: 11, color: T.textDim, lineHeight: 1.5, ...sans }}>{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", padding: 20, color: T.text, ...sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus, select:focus, button:focus { outline: 2px solid ${T.amber}40; outline-offset: 1px; }
        ::placeholder { color: ${T.textDim}; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: T.amber, ...mono }}>JEDI RE</div>
            <div style={{ width: 1, height: 16, background: T.border }} />
            <div style={{ fontSize: 10, letterSpacing: 2, color: T.textDim, ...mono }}>DEAL CAPSULE</div>
          </div>
          {view !== "selector" && view !== "create" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 4,
                background: view === "existing" ? T.blueBg : view === "development" ? T.greenBg : T.violetBg,
                color: view === "existing" ? T.blueLight : view === "development" ? T.greenLight : T.violet,
                border: `1px solid ${view === "existing" ? T.blue : view === "development" ? T.green : T.violet}40`,
                ...mono, fontWeight: 600, letterSpacing: 1,
              }}>
                {view.toUpperCase()}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text, ...sans }}>
                {DEALS[view]?.name || createdDeal?.propertyAddress || "New Deal"}
              </span>
            </div>
          )}
        </div>

        {navBar}

        {/* Content */}
        {view === "selector" && selectorView}
        {view === "existing" && <ExistingOverview deal={DEALS.existing} onNavigate={() => {}} />}
        {view === "development" && <DevelopmentOverview deal={DEALS.development} onNavigate={() => {}} />}
        {view === "redevelopment" && <RedevelopmentOverview deal={DEALS.redevelopment} onNavigate={() => {}} />}
        {view === "create" && <DealCreationFlow onDealCreated={handleDealCreated} />}
      </div>
    </div>
  );
}
