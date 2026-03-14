import { useState, useMemo, useCallback, useRef, useEffect } from "react";

/*
  JEDI RE — Exit & Capital Module (M11 + M12 unified)
  
  Decision cascade: Exit Strategy → Exit Timing → Capital Stack → Debt Market → Sensitivity
  
  Key features:
    - Three-Factor Convergence Chart with DRAGGABLE exit timing marker
    - User-selected exit quarter re-triggers all return calculations
    - Heavy charting on debt market data (SOFR, Treasury, spreads, product comparison)
    - Deal type adaptation (existing/development/redevelopment)
    - NO duplication with ProForma — sensitivity references shared calc engine
    
  The convergence chart is the hero: rent growth (green), interest rates (blue),
  supply delivery (amber bars), and the RSS composite score (bold green line).
  The platform suggests an optimal window; the user can override by clicking a quarter.
*/

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
const fk = n => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
const fpct = n => `${n.toFixed(1)}%`;
const fbps = n => `${Math.round(n)} bps`;

// ── QUARTERLY DATA (16 quarters, 4 years forward) ──────────
const QUARTERS = Array.from({ length: 16 }, (_, i) => {
  const baseYear = 2026;
  const q = (i % 4) + 1;
  const y = baseYear + Math.floor(i / 4);
  return { idx: i, label: `Q${q}'${String(y).slice(2)}`, year: y, quarter: q };
});

// Three factors + composite
const RENT_GROWTH =    [3.2, 3.4, 3.5, 3.7, 3.8, 3.6, 3.3, 3.1, 2.9, 2.7, 2.5, 2.4, 2.3, 2.4, 2.5, 2.6];
const TREASURY_10Y =   [4.3, 4.1, 3.9, 3.7, 3.5, 3.4, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.8, 3.7, 3.6];
const SUPPLY_UNITS =   [0, 180, 320, 0, 0, 420, 0, 280, 0, 0, 560, 0, 0, 0, 380, 0];
const CAP_RATES =      [5.4, 5.3, 5.2, 5.1, 5.0, 5.0, 5.1, 5.2, 5.2, 5.3, 5.4, 5.5, 5.5, 5.4, 5.3, 5.3];
const TXN_VELOCITY =   [45, 52, 58, 62, 68, 65, 60, 55, 50, 48, 45, 42, 40, 43, 46, 48];
const BUYER_PRESSURE = [55, 60, 68, 72, 78, 75, 70, 65, 58, 52, 48, 45, 43, 46, 50, 53];

// RSS sub-scores per quarter
function computeRSS(i) {
  const rg = RENT_GROWTH[i];
  const rate = TREASURY_10Y[i];
  const supply = SUPPLY_UNITS[i];
  const cap = CAP_RATES[i];
  const txn = TXN_VELOCITY[i];
  const bp = BUYER_PRESSURE[i];

  const marketWindow = Math.min(100, (rg / 5 * 40) + ((1 - cap / 7) * 100 * 0.30) + (txn * 0.20) + 10);
  const rateEnv = Math.min(100, ((5.0 - rate) / 2.0 * 100 * 0.40) + ((cap - rate) * 100 * 0.35 / 3) + ((4.5 - rate) / 2.0 * 100 * 0.25));
  const supplyPos = Math.max(0, 100 - supply / 8);
  const opReady = Math.min(100, 50 + i * 4);
  const buyerP = bp;

  const rss = Math.round(marketWindow * 0.35 + rateEnv * 0.25 + supplyPos * 0.20 + opReady * 0.15 + buyerP * 0.05);
  return { rss: Math.max(0, Math.min(100, rss)), marketWindow: Math.round(marketWindow), rateEnv: Math.round(Math.max(0, rateEnv)), supplyPos: Math.round(supplyPos), opReady: Math.round(opReady), buyerP: Math.round(buyerP) };
}

const RSS_DATA = QUARTERS.map((_, i) => computeRSS(i));

// Exit returns per quarter
function computeExitReturns(exitIdx, dealType = "existing") {
  const holdYears = (exitIdx + 1) / 4;
  const baseNOI = dealType === "development" ? 2800000 : 3420000;
  const totalBasis = dealType === "development" ? 52000000 : 46420000;
  const equity = dealType === "development" ? 18200000 : 14920000;
  const annualDS = 2340000;

  const noiGrowth = RENT_GROWTH.slice(0, exitIdx + 1).reduce((a, r) => a * (1 + r / 100), 1);
  const exitNOI = baseNOI * noiGrowth;
  const exitCap = CAP_RATES[exitIdx] / 100;
  const grossValue = exitNOI / exitCap;
  const sellingCosts = grossValue * 0.02;
  const loanPayoff = totalBasis - equity;
  const netProceeds = grossValue - sellingCosts - loanPayoff;
  const totalCF = Array.from({ length: Math.ceil(holdYears) }, (_, y) => baseNOI * Math.pow(1 + RENT_GROWTH[Math.min(y * 4, 15)] / 100, y + 1) - annualDS).reduce((a, b) => a + b, 0);
  const totalReturn = totalCF + netProceeds;
  const em = totalReturn / equity;
  const irr = holdYears > 0 ? (Math.pow(totalReturn / equity, 1 / holdYears) - 1) * 100 : 0;

  return {
    holdYears: holdYears.toFixed(1),
    exitNOI, grossValue, netProceeds, totalReturn,
    irr: Math.max(0, Math.min(50, irr)),
    em: Math.max(0, em),
    exitCap: CAP_RATES[exitIdx],
    rss: RSS_DATA[exitIdx].rss,
  };
}

// ── DEBT MARKET DATA ───────────────────────────────────────
const RATE_HISTORY = Array.from({ length: 24 }, (_, i) => {
  const mo = new Date(2024, 3 + i, 1);
  const sofr = 5.3 - i * 0.07 + Math.sin(i * 0.3) * 0.15;
  const t10 = 4.4 - i * 0.04 + Math.sin(i * 0.2) * 0.1;
  return { month: mo.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), sofr: Math.max(2.5, sofr), t10: Math.max(2.8, t10), agency: Math.max(3.5, sofr + 1.5), cmbs: Math.max(4.0, sofr + 2.1), bridge: Math.max(5.5, sofr + 3.0) };
});

const DEBT_PRODUCTS = [
  { name: "Agency (Fannie/Freddie)", type: "permanent", rate: "SOFR+175-225", ltv: "75%", term: "7-12yr", io: "2-5yr", dscr: "1.25x", speed: "45-60 days", best: "Stabilized hold", color: K.a },
  { name: "CMBS", type: "permanent", rate: "T10+200-275", ltv: "70%", term: "5-10yr", io: "1-3yr", dscr: "1.30x", speed: "60-90 days", best: "Stabilized, non-recourse", color: K.p },
  { name: "Bridge / Value-Add", type: "bridge", rate: "SOFR+300-450", ltv: "80% LTC", term: "2-3yr+ext", io: "Full term", dscr: "1.10x", speed: "21-30 days", best: "Value-add, repositioning", color: K.o },
  { name: "Construction", type: "construction", rate: "SOFR+350-500", ltv: "60-65% LTC", term: "24-36mo", io: "Full term", dscr: "N/A", speed: "60-90 days", best: "Ground-up development", color: K.r },
  { name: "Bank/Portfolio", type: "flexible", rate: "SOFR+200-300", ltv: "65-70%", term: "5-7yr", io: "1-2yr", dscr: "1.25x", speed: "30-45 days", best: "Relationship, flexible terms", color: K.c },
  { name: "Mezzanine", type: "mezz", rate: "10-14% fixed", ltv: "80-85% LTC", term: "Coterminous", io: "Full term", dscr: "1.10x", speed: "30-45 days", best: "Gap capital, promote enhancement", color: K.y },
];

const LENDER_QUOTES = [
  { lender: "Wells Fargo", product: "Agency", rate: "5.85%", spread: "+185", ltv: "75%", term: "10yr", io: "3yr", fee: "1.0%", received: "3 days ago" },
  { lender: "JP Morgan", product: "CMBS", rate: "6.25%", spread: "+215", ltv: "70%", term: "7yr", io: "2yr", fee: "1.5%", received: "5 days ago" },
  { lender: "Ready Capital", product: "Bridge", rate: "8.50%", spread: "+390", ltv: "80% LTC", term: "3yr+1+1", io: "Full", fee: "1.5%", received: "1 day ago" },
  { lender: "Arbor", product: "Agency", rate: "5.95%", spread: "+195", ltv: "75%", term: "12yr", io: "5yr", fee: "0.75%", received: "2 days ago" },
];

// ── CAPITAL STACK PRESETS BY EXIT STRATEGY ──────────────────
const STACK_PRESETS = {
  "sell-stabilized": { senior: { pct: 65, type: "Bridge", rate: 8.5, term: "3yr", io: true }, mezz: null, equity: 35, label: "Sell at Stabilization" },
  "refi-hold": { senior: { pct: 75, type: "Agency", rate: 5.85, term: "10yr", io: false }, mezz: null, equity: 25, label: "Refinance & Hold" },
  "merchant-build": { senior: { pct: 65, type: "Construction", rate: 8.75, term: "24mo", io: true }, mezz: { pct: 10, type: "Mezz", rate: 12.0 }, equity: 25, label: "Merchant Build" },
  "build-to-hold": { senior: { pct: 65, type: "Construction→Agency", rate: 8.75, term: "24mo→10yr", io: true }, mezz: null, equity: 35, label: "Build-to-Hold" },
  "1031-exchange": { senior: { pct: 70, type: "Agency", rate: 5.85, term: "10yr", io: false }, mezz: null, equity: 30, label: "1031 Exchange" },
};

// ═══════════════════════════════════════════════════════════════
// THREE-FACTOR CONVERGENCE CHART (Interactive)
// ═══════════════════════════════════════════════════════════════

function ConvergenceChart({ selectedQ, onSelectQ, optimalQ }) {
  const svgRef = useRef(null);
  const W = 720, H = 320;
  const pad = { t: 30, r: 50, b: 60, l: 50 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const barW = iW / 16;

  const x = i => pad.l + i * barW + barW / 2;
  const yRent = v => pad.t + iH - ((v - 1.5) / (4.5 - 1.5)) * iH;
  const yRate = v => pad.t + iH - ((v - 2.5) / (5.5 - 2.5)) * iH;
  const yRSS = v => pad.t + iH - (v / 100) * iH;

  const maxSupply = Math.max(...SUPPLY_UNITS);

  const handleClick = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    const idx = Math.round((mx - pad.l - barW / 2) / barW);
    if (idx >= 0 && idx < 16) onSelectQ(idx);
  };

  const rentPath = RENT_GROWTH.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${yRent(v)}`).join(" ");
  const ratePath = TREASURY_10Y.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${yRate(v)}`).join(" ");
  const rssPath = RSS_DATA.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${yRSS(d.rss)}`).join(" ");

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} onClick={handleClick} style={{ cursor: "crosshair", display: "block" }}>
      {/* Optimal window zone */}
      {(() => {
        let start = null, end = null;
        RSS_DATA.forEach((d, i) => { if (d.rss >= 70) { if (start === null) start = i; end = i; } });
        if (start !== null) return (
          <rect x={x(start) - barW / 2} y={pad.t - 4} width={(end - start + 1) * barW} height={iH + 8}
            fill="rgba(104,211,145,0.06)" stroke={K.g} strokeWidth={1} strokeDasharray="6,4" rx={4} />
        );
      })()}

      {/* Supply bars */}
      {SUPPLY_UNITS.map((v, i) => {
        if (v === 0) return null;
        const h = (v / maxSupply) * iH * 0.5;
        return <g key={`s${i}`}>
          <rect x={x(i) - barW * 0.3} y={pad.t + iH - h} width={barW * 0.6} height={h}
            fill="rgba(246,173,85,0.15)" stroke={K.o} strokeWidth={0.5} rx={2} />
          <text x={x(i)} y={pad.t + iH - h - 4} textAnchor="middle" fill={K.o} fontSize={8} fontFamily={K.m} fontWeight={600}>{v}</text>
        </g>;
      })}

      {/* Rent growth line */}
      <path d={rentPath} fill="none" stroke={K.g} strokeWidth={1.5} />
      {RENT_GROWTH.map((v, i) => <circle key={`r${i}`} cx={x(i)} cy={yRent(v)} r={2.5} fill={K.g} />)}

      {/* Treasury rate line */}
      <path d={ratePath} fill="none" stroke={K.a} strokeWidth={1.5} />
      {TREASURY_10Y.map((v, i) => <circle key={`t${i}`} cx={x(i)} cy={yRate(v)} r={2.5} fill={K.a} />)}

      {/* RSS composite line (bold) */}
      <path d={rssPath} fill="none" stroke="#10b981" strokeWidth={2.5} />
      {RSS_DATA.map((d, i) => <circle key={`rss${i}`} cx={x(i)} cy={yRSS(d.rss)} r={i === optimalQ ? 5 : 3} fill="#10b981" />)}

      {/* Optimal marker */}
      <line x1={x(optimalQ)} y1={pad.t} x2={x(optimalQ)} y2={pad.t + iH} stroke={K.g} strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
      <text x={x(optimalQ)} y={pad.t - 8} textAnchor="middle" fill={K.g} fontSize={9} fontFamily={K.m} fontWeight={700}>OPTIMAL</text>

      {/* User-selected marker */}
      <line x1={x(selectedQ)} y1={pad.t - 2} x2={x(selectedQ)} y2={pad.t + iH + 2} stroke={K.t} strokeWidth={2} />
      <rect x={x(selectedQ) - 20} y={pad.t - 18} width={40} height={16} rx={3} fill={K.t} />
      <text x={x(selectedQ)} y={pad.t - 7} textAnchor="middle" fill={K.bg} fontSize={9} fontFamily={K.m} fontWeight={700}>{QUARTERS[selectedQ].label}</text>

      {/* RSS value at selected point */}
      <text x={x(selectedQ)} y={yRSS(RSS_DATA[selectedQ].rss) - 10} textAnchor="middle" fill="#10b981" fontSize={11} fontFamily={K.m} fontWeight={800}>
        {RSS_DATA[selectedQ].rss}
      </text>

      {/* Quarter labels */}
      {QUARTERS.map((q, i) => (
        <text key={i} x={x(i)} y={pad.t + iH + 16} textAnchor="middle" fill={i === selectedQ ? K.t : K.td} fontSize={8} fontFamily={K.m} fontWeight={i === selectedQ ? 700 : 400}>{q.label}</text>
      ))}

      {/* Y-axis labels */}
      <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fill={K.td} fontSize={8} fontFamily={K.m}>4.5%</text>
      <text x={pad.l - 6} y={pad.t + iH} textAnchor="end" fill={K.td} fontSize={8} fontFamily={K.m}>1.5%</text>
      <text x={W - pad.r + 6} y={pad.t + 4} textAnchor="start" fill={K.td} fontSize={8} fontFamily={K.m}>100</text>
      <text x={W - pad.r + 6} y={pad.t + iH} textAnchor="start" fill={K.td} fontSize={8} fontFamily={K.m}>0</text>

      {/* Legend */}
      <g transform={`translate(${pad.l}, ${H - 18})`}>
        <line x1={0} y1={0} x2={12} y2={0} stroke={K.g} strokeWidth={1.5} /><circle cx={6} cy={0} r={2} fill={K.g} />
        <text x={16} y={3} fill={K.td} fontSize={8}>Rent growth</text>
        <line x1={90} y1={0} x2={102} y2={0} stroke={K.a} strokeWidth={1.5} /><circle cx={96} cy={0} r={2} fill={K.a} />
        <text x={106} y={3} fill={K.td} fontSize={8}>10Y Treasury</text>
        <rect x={190} y={-4} width={10} height={8} fill="rgba(246,173,85,0.15)" stroke={K.o} strokeWidth={0.5} rx={1} />
        <text x={204} y={3} fill={K.td} fontSize={8}>Supply delivery</text>
        <line x1={296} y1={0} x2={308} y2={0} stroke="#10b981" strokeWidth={2.5} />
        <text x={312} y={3} fill={K.td} fontSize={8}>RSS score (0-100)</text>
        <rect x={410} y={-4} width={10} height={8} fill="rgba(104,211,145,0.06)" stroke={K.g} strokeWidth={0.5} strokeDasharray="2,2" rx={1} />
        <text x={424} y={3} fill={K.td} fontSize={8}>Sell window</text>
        <line x1={500} y1={-4} x2={500} y2={4} stroke={K.t} strokeWidth={2} />
        <text x={506} y={3} fill={K.td} fontSize={8}>Your selection</text>
      </g>
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════
// RATE HISTORY CHART (Debt Market tab)
// ═══════════════════════════════════════════════════════════════

function RateHistoryChart({ data, highlightSeries }) {
  const W = 680, H = 220;
  const pad = { t: 20, r: 40, b: 30, l: 40 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;

  const allVals = data.flatMap(d => [d.sofr, d.t10, d.agency, d.cmbs, d.bridge]);
  const minV = Math.floor(Math.min(...allVals) * 2) / 2;
  const maxV = Math.ceil(Math.max(...allVals) * 2) / 2;

  const x = i => pad.l + (i / (data.length - 1)) * iW;
  const y = v => pad.t + iH - ((v - minV) / (maxV - minV)) * iH;

  const series = [
    { key: "sofr", label: "SOFR", color: K.a },
    { key: "t10", label: "10Y Treasury", color: K.p },
    { key: "agency", label: "Agency", color: K.g },
    { key: "cmbs", label: "CMBS", color: K.o },
    { key: "bridge", label: "Bridge", color: K.r },
  ];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {/* Grid lines */}
      {Array.from({ length: Math.ceil((maxV - minV) / 0.5) + 1 }, (_, i) => minV + i * 0.5).map(v => (
        <g key={v}>
          <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fill={K.td} fontSize={8} fontFamily={K.m}>{v.toFixed(1)}%</text>
        </g>
      ))}
      {/* Lines */}
      {series.map(s => {
        const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[s.key])}`).join(" ");
        const active = !highlightSeries || highlightSeries === s.key;
        return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth={active ? 1.5 : 0.5} opacity={active ? 1 : 0.2} />;
      })}
      {/* X labels */}
      {data.filter((_, i) => i % 4 === 0).map((d, i) => (
        <text key={i} x={x(i * 4)} y={H - 6} textAnchor="middle" fill={K.td} fontSize={8} fontFamily={K.m}>{d.month}</text>
      ))}
      {/* Legend */}
      <g transform={`translate(${pad.l}, ${H - 2})`}>
        {series.map((s, i) => (
          <g key={s.key} transform={`translate(${i * 110}, 0)`}>
            <line x1={0} y1={0} x2={10} y2={0} stroke={s.color} strokeWidth={1.5} />
            <text x={14} y={3} fill={K.td} fontSize={7.5}>{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════
// SPREAD COMPARISON CHART
// ═══════════════════════════════════════════════════════════════

function SpreadChart() {
  const products = [
    { name: "Agency", spread: 185, color: K.a },
    { name: "CMBS", spread: 225, color: K.p },
    { name: "Bank", spread: 250, color: K.c },
    { name: "Bridge", spread: 375, color: K.o },
    { name: "Construction", spread: 425, color: K.r },
    { name: "Mezz", spread: 650, color: K.y },
  ];
  const maxSpread = 700;

  return (
    <div>
      {products.map(p => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: K.tm, minWidth: 76, textAlign: "right" }}>{p.name}</span>
          <div style={{ flex: 1, height: 14, background: "rgba(255,255,255,0.03)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${p.spread / maxSpread * 100}%`, background: `${p.color}40`, borderRadius: 3, borderRight: `2px solid ${p.color}` }} />
          </div>
          <span style={{ fontSize: 10, fontFamily: K.m, fontWeight: 600, color: p.color, minWidth: 50 }}>+{p.spread}</span>
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: "exit", label: "Exit Strategy", icon: "◉" },
  { id: "stack", label: "Capital Stack", icon: "◇" },
  { id: "market", label: "Debt Market", icon: "◆" },
  { id: "timing", label: "Exit Timing", icon: "⊕" },
  { id: "sensitivity", label: "Sensitivity", icon: "∿" },
];

export default function ExitCapitalModule({ dealType = "existing" }) {
  const [activeTab, setActiveTab] = useState("exit");
  const [selectedExitQ, setSelectedExitQ] = useState(5); // Q2'27 default
  const [selectedExitStrategy, setSelectedExitStrategy] = useState("sell-stabilized");
  const [rateSeriesHighlight, setRateSeriesHighlight] = useState(null);

  // Find platform-recommended optimal quarter (highest RSS)
  const optimalQ = useMemo(() => {
    let best = 0;
    RSS_DATA.forEach((d, i) => { if (d.rss > RSS_DATA[best].rss) best = i; });
    return best;
  }, []);

  // Compute returns at user-selected exit point
  const exitReturns = useMemo(() => computeExitReturns(selectedExitQ, dealType), [selectedExitQ, dealType]);
  const optimalReturns = useMemo(() => computeExitReturns(optimalQ, dealType), [optimalQ, dealType]);

  // Exit strategy options per deal type
  const exitOptions = useMemo(() => {
    if (dealType === "development") return [
      { id: "merchant-build", label: "Merchant Build — Sell at CO", desc: "Build and sell at certificate of occupancy", timeline: "18-24 months" },
      { id: "sell-stabilized", label: "Stabilize & Sell", desc: "Complete lease-up, sell at stabilization", timeline: "30-36 months" },
      { id: "build-to-hold", label: "Build-to-Hold", desc: "Develop, stabilize, refinance into permanent debt", timeline: "7+ years" },
    ];
    if (dealType === "redevelopment") return [
      { id: "sell-stabilized", label: "Sell at Completion", desc: "Renovate, re-lease, sell at repositioned cap rate", timeline: "24-30 months" },
      { id: "refi-hold", label: "Renovate & Hold", desc: "Reposition, refinance into permanent, hold for cash flow", timeline: "5-7 years" },
      { id: "1031-exchange", label: "1031 Exchange", desc: "Sell and defer capital gains into replacement property", timeline: "24-36 months" },
    ];
    return [
      { id: "sell-stabilized", label: "Sell at Stabilization", desc: "Value-add renovate, stabilize, sell at compressed cap", timeline: "24-36 months" },
      { id: "refi-hold", label: "Refinance & Hold", desc: "Renovate, refi into agency permanent, hold for cash flow", timeline: "7-10 years" },
      { id: "1031-exchange", label: "1031 Exchange", desc: "Sell and defer capital gains into replacement property", timeline: "24-36 months" },
    ];
  }, [dealType]);

  const currentStack = STACK_PRESETS[selectedExitStrategy] || STACK_PRESETS["sell-stabilized"];
  const rssNow = RSS_DATA[selectedExitQ];
  const rssVerdict = rssNow.rss >= 85 ? "Strong sell window" : rssNow.rss >= 70 ? "Favorable — prepare to execute" : rssNow.rss >= 55 ? "Neutral — monitor closely" : "Weak — hold unless forced";
  const rssColor = rssNow.rss >= 85 ? K.g : rssNow.rss >= 70 ? K.a : rssNow.rss >= 55 ? K.y : K.r;

  return (
    <div style={{ background: K.bg, color: K.t, fontFamily: K.f, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${K.b}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m }}>M11+M12</span>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Exit & Capital Structure</h2>
          <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: `${rssColor}15`, color: rssColor }}>
            RSS {rssNow.rss} — {rssVerdict}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: K.g }}>{QUARTERS[selectedExitQ].label}</div>
            <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>TARGET EXIT</div>
          </div>
          <div style={{ width: 1, height: 30, background: K.b }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: exitReturns.irr >= 15 ? K.g : K.y }}>{exitReturns.irr.toFixed(1)}%</div>
            <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>IRR</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: K.a }}>{exitReturns.em.toFixed(2)}x</div>
            <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>EQUITY MULTIPLE</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: "0 24px", borderBottom: `1px solid ${K.b}`, display: "flex", gap: 0 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "10px 16px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
            border: "none", fontFamily: K.f, display: "flex", alignItems: "center", gap: 5,
            background: "transparent", borderBottom: `2px solid ${activeTab === tab.id ? K.a : "transparent"}`,
            color: activeTab === tab.id ? K.t : K.td, transition: "all 0.12s",
          }}>
            <span style={{ fontSize: 11, opacity: 0.6 }}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 24px 24px" }}>

        {/* ═══ TAB 1: EXIT STRATEGY ═══ */}
        {activeTab === "exit" && (
          <div>
            {/* Convergence Chart */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>THREE-FACTOR CONVERGENCE — CLICK TO SET EXIT TIMING</span>
                  <div style={{ fontSize: 10, color: K.tm, marginTop: 2 }}>Rent growth + rates + supply delivery = optimal exit window. Click any quarter to override.</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: K.td, fontFamily: K.m }}>PLATFORM RECOMMENDS</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: K.m, color: K.g }}>{QUARTERS[optimalQ].label}</div>
                  {selectedExitQ !== optimalQ && (
                    <div style={{ fontSize: 9, color: K.y, fontFamily: K.m, marginTop: 2 }}>
                      Your selection: {QUARTERS[selectedExitQ].label} (RSS {rssNow.rss} vs {RSS_DATA[optimalQ].rss})
                    </div>
                  )}
                </div>
              </div>
              <ConvergenceChart selectedQ={selectedExitQ} onSelectQ={setSelectedExitQ} optimalQ={optimalQ} />
            </div>

            {/* RSS Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
              {[
                { l: "Market Window", v: rssNow.marketWindow, w: "35%", c: K.g },
                { l: "Rate Environment", v: rssNow.rateEnv, w: "25%", c: K.a },
                { l: "Supply Position", v: rssNow.supplyPos, w: "20%", c: K.o },
                { l: "Operational Ready", v: rssNow.opReady, w: "15%", c: K.p },
                { l: "Buyer Pressure", v: rssNow.buyerP, w: "5%", c: K.c },
              ].map(s => (
                <div key={s.l} style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 8.5, color: K.td, fontFamily: K.m }}>{s.l}</span>
                    <span style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>{s.w}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: s.v >= 70 ? K.g : s.v >= 50 ? K.y : K.r }}>{s.v}</div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.v}%`, background: s.c, borderRadius: 2, opacity: 0.5 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Exit Strategy Cards */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${exitOptions.length}, 1fr)`, gap: 12 }}>
              {exitOptions.map(opt => {
                const isSelected = selectedExitStrategy === opt.id;
                const returns = computeExitReturns(selectedExitQ, dealType);
                return (
                  <div key={opt.id} onClick={() => setSelectedExitStrategy(opt.id)} style={{
                    background: isSelected ? `${K.g}08` : K.s, border: `1px solid ${isSelected ? `${K.g}30` : K.b}`,
                    borderRadius: 8, padding: "16px 18px", cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {isSelected && (
                      <div style={{ fontSize: 8, fontWeight: 700, color: K.g, fontFamily: K.m, letterSpacing: 1, marginBottom: 6 }}>SELECTED</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? K.g : K.t, marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, color: K.tm, marginBottom: 10, lineHeight: 1.4 }}>{opt.desc}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[
                        { l: "IRR", v: `${returns.irr.toFixed(1)}%`, c: returns.irr >= 15 ? K.g : K.y },
                        { l: "EM", v: `${returns.em.toFixed(2)}x`, c: K.a },
                        { l: "Exit Cap", v: fpct(returns.exitCap), c: K.tm },
                        { l: "Timeline", v: opt.timeline, c: K.p },
                      ].map(m => (
                        <div key={m.l}>
                          <div style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>{m.l}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: K.m, color: m.c }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ TAB 2: CAPITAL STACK ═══ */}
        {activeTab === "stack" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 10 }}>
                  CAPITAL STACK — {currentStack.label.toUpperCase()}
                </div>
                <div style={{ fontSize: 10, color: K.tm, marginBottom: 12 }}>Pre-configured for your exit strategy. Adjust layers below.</div>

                {/* Visual stack */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
                  {[
                    { label: `Senior Debt — ${currentStack.senior.type}`, pct: currentStack.senior.pct, rate: currentStack.senior.rate, color: K.a },
                    ...(currentStack.mezz ? [{ label: `Mezzanine — ${currentStack.mezz.type}`, pct: currentStack.mezz.pct, rate: currentStack.mezz.rate, color: K.y }] : []),
                    { label: "Sponsor Equity", pct: currentStack.equity, rate: null, color: K.p },
                  ].map((layer, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", background: `${layer.color}10`, borderRadius: 6,
                      border: `1px solid ${layer.color}25`, height: Math.max(36, layer.pct * 0.8),
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: layer.color }}>{layer.label}</div>
                        <div style={{ fontSize: 9, color: K.tm }}>{layer.pct}% of capital</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {layer.rate && <div style={{ fontSize: 13, fontWeight: 700, fontFamily: K.m, color: layer.color }}>{fpct(layer.rate)}</div>}
                        <div style={{ fontSize: 9, color: K.td }}>{currentStack.senior.term}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Key metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "WACC", v: fpct(currentStack.senior.rate * currentStack.senior.pct / 100 + (currentStack.mezz ? currentStack.mezz.rate * currentStack.mezz.pct / 100 : 0)), c: K.a },
                    { l: "LTV / LTC", v: `${currentStack.senior.pct + (currentStack.mezz?.pct || 0)}%`, c: K.tm },
                    { l: "IO Period", v: currentStack.senior.io ? "Full term" : "2-5yr", c: K.p },
                  ].map(m => (
                    <div key={m.l} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.015)", borderRadius: 5 }}>
                      <div style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>{m.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: K.m, color: m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Debt product comparison */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 10 }}>DEBT PRODUCTS COMPARISON</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {DEBT_PRODUCTS.map(p => (
                  <div key={p.name} style={{
                    display: "grid", gridTemplateColumns: "1fr 90px 50px 60px 60px",
                    gap: 6, alignItems: "center", padding: "8px 10px", borderRadius: 5,
                    background: p.type === currentStack.senior.type?.split("/")[0]?.toLowerCase() || p.type === "permanent" && !currentStack.senior.io ? `${p.color}08` : "transparent",
                    border: `1px solid ${K.b}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: p.color }}>{p.name}</div>
                      <div style={{ fontSize: 8.5, color: K.td }}>{p.best}</div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: K.m, color: K.t }}>{p.rate}</span>
                    <span style={{ fontSize: 10, fontFamily: K.m, color: K.tm }}>{p.ltv}</span>
                    <span style={{ fontSize: 10, fontFamily: K.m, color: K.td }}>{p.term}</span>
                    <span style={{ fontSize: 10, fontFamily: K.m, color: K.td }}>{p.dscr}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 50px 60px 60px", gap: 6, padding: "4px 10px", fontSize: 7.5, color: K.td, fontFamily: K.m, marginTop: 2 }}>
                <span>PRODUCT</span><span>RATE</span><span>LTV</span><span>TERM</span><span>DSCR</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 3: DEBT MARKET ═══ */}
        {activeTab === "market" && (
          <div>
            {/* Rate environment hero */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { l: "SOFR", v: "4.58%", delta: "-12 bps (30d)", c: K.a, dir: "down" },
                { l: "10Y TREASURY", v: "4.12%", delta: "-8 bps (30d)", c: K.p, dir: "down" },
                { l: "AGENCY SPREAD", v: "+185 bps", delta: "Tight", c: K.g, dir: "flat" },
                { l: "CMBS SPREAD", v: "+225 bps", delta: "Widening +10", c: K.o, dir: "up" },
                { l: "BRIDGE SPREAD", v: "+375 bps", delta: "Compressing -15", c: K.c, dir: "down" },
              ].map(r => (
                <div key={r.l} style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 7, padding: "10px 12px" }}>
                  <div style={{ fontSize: 8, color: K.td, fontFamily: K.m, letterSpacing: 0.6, marginBottom: 4 }}>{r.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: r.c }}>{r.v}</div>
                  <div style={{ fontSize: 9, color: r.dir === "down" ? K.g : r.dir === "up" ? K.r : K.tm, marginTop: 2 }}>
                    {r.dir === "down" ? "▼" : r.dir === "up" ? "▲" : "─"} {r.delta}
                  </div>
                </div>
              ))}
            </div>

            {/* Rate history chart */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>RATE HISTORY — 24 MONTHS</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {[null, "sofr", "t10", "agency", "bridge"].map(s => (
                    <button key={s || "all"} onClick={() => setRateSeriesHighlight(s)} style={{
                      padding: "2px 8px", borderRadius: 4, fontSize: 8, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${K.b}`, fontFamily: K.m,
                      background: rateSeriesHighlight === s ? "rgba(255,255,255,0.06)" : "transparent",
                      color: rateSeriesHighlight === s ? K.t : K.td,
                    }}>{s ? s.toUpperCase() : "ALL"}</button>
                  ))}
                </div>
              </div>
              <RateHistoryChart data={RATE_HISTORY} highlightSeries={rateSeriesHighlight} />
            </div>

            {/* Spread comparison + Lender quotes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>SPREAD COMPARISON (bps over index)</span>
                <div style={{ marginTop: 12 }}><SpreadChart /></div>
              </div>

              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>LENDER QUOTES — EMAIL EXTRACTED</span>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {LENDER_QUOTES.map(q => (
                    <div key={q.lender} style={{ display: "grid", gridTemplateColumns: "1fr 70px 54px 56px 48px 70px", gap: 4, alignItems: "center", padding: "7px 10px", borderRadius: 5, border: `1px solid ${K.b}`, background: K.s }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: K.t }}>{q.lender}</div>
                        <div style={{ fontSize: 8, color: K.td }}>{q.product}</div>
                      </div>
                      <span style={{ fontSize: 11, fontFamily: K.m, fontWeight: 700, color: K.g }}>{q.rate}</span>
                      <span style={{ fontSize: 9, fontFamily: K.m, color: K.a }}>{q.spread}</span>
                      <span style={{ fontSize: 9, fontFamily: K.m, color: K.tm }}>{q.ltv}</span>
                      <span style={{ fontSize: 9, fontFamily: K.m, color: K.td }}>{q.term}</span>
                      <span style={{ fontSize: 8, color: K.td }}>{q.received}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 54px 56px 48px 70px", gap: 4, padding: "2px 10px", fontSize: 7, color: K.td, fontFamily: K.m, marginTop: 2 }}>
                  <span>LENDER</span><span>RATE</span><span>SPREAD</span><span>LTV</span><span>TERM</span><span>RECEIVED</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 4: EXIT TIMING ═══ */}
        {activeTab === "timing" && (
          <div>
            {/* Hold vs Sell NPV by quarter */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>HOLD vs SELL — IRR BY EXIT QUARTER</span>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, marginTop: 12 }}>
                {QUARTERS.map((q, i) => {
                  const ret = computeExitReturns(i, dealType);
                  const h = Math.max(4, (ret.irr / 30) * 130);
                  const isSelected = i === selectedExitQ;
                  const isOptimal = i === optimalQ;
                  const col = isSelected ? K.t : isOptimal ? K.g : ret.irr >= 15 ? K.g : ret.irr >= 10 ? K.a : K.r;
                  return (
                    <div key={i} onClick={() => setSelectedExitQ(i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                      <span style={{ fontSize: 8, fontFamily: K.m, fontWeight: isSelected ? 700 : 400, color: isSelected ? K.t : K.td }}>{ret.irr.toFixed(0)}%</span>
                      <div style={{
                        width: "100%", height: h, borderRadius: 3,
                        background: isSelected ? K.t : `${col}40`,
                        border: isOptimal ? `1px solid ${K.g}` : isSelected ? `1px solid ${K.t}` : "none",
                        transition: "all 0.15s",
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                {QUARTERS.map((q, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 7.5, fontFamily: K.m, color: i === selectedExitQ ? K.t : K.td, fontWeight: i === selectedExitQ ? 700 : 400 }}>{q.label}</div>
                ))}
              </div>
            </div>

            {/* Selected exit detail vs optimal */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: K.s, border: `1px solid ${K.t}30`, borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.t, fontFamily: K.m, marginBottom: 10 }}>YOUR SELECTION — {QUARTERS[selectedExitQ].label}</div>
                {[
                  { l: "Hold period", v: `${exitReturns.holdYears} years` },
                  { l: "Exit NOI", v: fk(exitReturns.exitNOI), c: K.g },
                  { l: "Exit cap rate", v: fpct(exitReturns.exitCap), c: K.a },
                  { l: "Gross value", v: fk(exitReturns.grossValue), c: K.g },
                  { l: "Net proceeds", v: fk(exitReturns.netProceeds), c: K.g },
                  { sep: true },
                  { l: "IRR", v: fpct(exitReturns.irr), c: exitReturns.irr >= 15 ? K.g : K.y, big: true },
                  { l: "Equity multiple", v: `${exitReturns.em.toFixed(2)}x`, c: K.a, big: true },
                  { l: "RSS at exit", v: String(exitReturns.rss), c: rssColor, big: true },
                ].map((r, i) => {
                  if (r.sep) return <div key={i} style={{ height: 1, background: K.bh, margin: "6px 0" }} />;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 10, color: K.tm }}>{r.l}</span>
                      <span style={{ fontSize: r.big ? 14 : 11, fontWeight: r.big ? 800 : 600, fontFamily: K.m, color: r.c || K.t }}>{r.v}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: K.s, border: `1px solid ${K.g}20`, borderRadius: 8, padding: "16px 20px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.g, fontFamily: K.m, marginBottom: 10 }}>PLATFORM OPTIMAL — {QUARTERS[optimalQ].label}</div>
                {[
                  { l: "Hold period", v: `${optimalReturns.holdYears} years` },
                  { l: "Exit NOI", v: fk(optimalReturns.exitNOI), c: K.g },
                  { l: "Exit cap rate", v: fpct(optimalReturns.exitCap), c: K.a },
                  { l: "Gross value", v: fk(optimalReturns.grossValue), c: K.g },
                  { l: "Net proceeds", v: fk(optimalReturns.netProceeds), c: K.g },
                  { sep: true },
                  { l: "IRR", v: fpct(optimalReturns.irr), c: K.g, big: true },
                  { l: "Equity multiple", v: `${optimalReturns.em.toFixed(2)}x`, c: K.a, big: true },
                  { l: "RSS at exit", v: String(optimalReturns.rss), c: K.g, big: true },
                ].map((r, i) => {
                  if (r.sep) return <div key={i} style={{ height: 1, background: K.bh, margin: "6px 0" }} />;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 10, color: K.tm }}>{r.l}</span>
                      <span style={{ fontSize: r.big ? 14 : 11, fontWeight: r.big ? 800 : 600, fontFamily: K.m, color: r.c || K.t }}>{r.v}</span>
                    </div>
                  );
                })}
                {selectedExitQ !== optimalQ && (
                  <div style={{ marginTop: 10, padding: "8px 10px", background: K.yd, borderRadius: 6, border: `1px solid ${K.y}20` }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: K.y }}>
                      Delta: {(exitReturns.irr - optimalReturns.irr).toFixed(1)}% IRR / {(exitReturns.em - optimalReturns.em).toFixed(2)}x EM
                    </div>
                    <div style={{ fontSize: 9, color: K.tm, marginTop: 2 }}>
                      {exitReturns.irr < optimalReturns.irr ? "Your timing leaves returns on the table" : "Your timing exceeds the platform recommendation"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB 5: SENSITIVITY ═══ */}
        {activeTab === "sensitivity" && (
          <div>
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>IRR SENSITIVITY — EXIT CAP RATE × RENT GROWTH</span>
                <span style={{ fontSize: 8, color: K.tm, fontFamily: K.m }}>Computed from ProForma engine (shared calculation — not duplicated)</span>
              </div>
              {/* Heatmap grid */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: 2 }}>
                  <div style={{ padding: "4px 8px", fontSize: 8, color: K.td, fontFamily: K.m }}>CAP \ RENT</div>
                  {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(rg => (
                    <div key={rg} style={{ padding: "4px 6px", textAlign: "center", fontSize: 8.5, fontFamily: K.m, color: K.tm, background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>{rg}%</div>
                  ))}
                  {[4.75, 5.00, 5.25, 5.50, 5.75, 6.00, 6.25].map(cap => (
                    <React.Fragment key={cap}>
                      <div style={{ padding: "4px 8px", fontSize: 8.5, fontFamily: K.m, color: K.tm, display: "flex", alignItems: "center" }}>{cap}%</div>
                      {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].map(rg => {
                        const baseIRR = exitReturns.irr;
                        const adj = baseIRR + (3.0 - rg) * -1.5 + (5.25 - cap) * 3;
                        const irr = Math.max(0, Math.min(40, adj));
                        const isBase = Math.abs(cap - exitReturns.exitCap) < 0.1 && Math.abs(rg - 3.0) < 0.1;
                        const bg = irr >= 20 ? "rgba(104,211,145,0.2)" : irr >= 15 ? "rgba(104,211,145,0.1)" : irr >= 10 ? "rgba(246,224,94,0.1)" : "rgba(252,129,129,0.1)";
                        const col = irr >= 20 ? K.g : irr >= 15 ? K.g : irr >= 10 ? K.y : K.r;
                        return (
                          <div key={`${cap}-${rg}`} style={{
                            padding: "6px 4px", textAlign: "center", borderRadius: 3,
                            background: bg, border: isBase ? `2px solid ${K.t}` : "1px solid transparent",
                          }}>
                            <span style={{ fontSize: 10, fontFamily: K.m, fontWeight: isBase ? 800 : 500, color: col }}>{irr.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 9, color: K.td }}>
                <span>Base case highlighted with border</span>
                <span style={{ color: K.g }}>Green: IRR ≥ 15%</span>
                <span style={{ color: K.y }}>Yellow: 10-15%</span>
                <span style={{ color: K.r }}>Red: &lt; 10%</span>
              </div>
            </div>

            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 18px" }}>
              <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.5 }}>
                This sensitivity analysis uses the <b style={{ color: K.a }}>same ProForma calculation engine</b> as the M09 Pro Forma tab — not a separate model. Exit cap rate and rent growth are the two variables; all other assumptions (vacancy, expenses, debt terms) come from the active ProForma version. Changes in the ProForma Assumptions tab flow through here automatically.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
