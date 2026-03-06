import { useState, useEffect } from "react";

// ─── TERMINAL COLOR TOKENS (matches jedi-bloomberg-integrated) ───────────────
const T = {
  bg:        "#0a0c0f",
  surface:   "#0f1117",
  panel:     "#141820",
  border:    "#1e2535",
  borderHi:  "#2a3448",
  amber:     "#f59e0b",
  amberDim:  "#92600a",
  amberGlow: "rgba(245,158,11,0.12)",
  cyan:      "#22d3ee",
  cyanDim:   "#0e7490",
  green:     "#22c55e",
  greenDim:  "#15803d",
  red:       "#ef4444",
  redDim:    "#991b1b",
  blue:      "#3b82f6",
  blueDim:   "#1d4ed8",
  purple:    "#a855f7",
  purpleDim: "#7e22ce",
  yellow:    "#eab308",
  text:      "#e2e8f0",
  textDim:   "#64748b",
  textMid:   "#94a3b8",
  mono:      "'JetBrains Mono', 'Fira Code', monospace",
  sans:      "'IBM Plex Sans', 'Inter', sans-serif",
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const DEAL = {
  id: "DEAL-0047",
  name: "Westshore Vue Apartments",
  address: "4201 W Kennedy Blvd, Tampa FL 33609",
  units: 290,
  purchaseDate: "2023-04-15",
  purchasePrice: 32400000,
  strategy: "VALUE-ADD RENTAL",
  holdPeriod: "5yr",
  jediScoreAtUnderwriting: 74,
  jediScoreNow: 81,
};

const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

// Traffic: Predicted vs Actual walk-ins/week
const TRAFFIC_DATA = [
  { month:"Apr", predicted:14.2, actual:11.8, fdotAadt:22400, realAadt:null,   digitalIndex:68, leaseConversions:3 },
  { month:"May", predicted:15.1, actual:13.4, fdotAadt:22400, realAadt:null,   digitalIndex:72, leaseConversions:5 },
  { month:"Jun", predicted:13.8, actual:14.9, fdotAadt:22400, realAadt:null,   digitalIndex:79, leaseConversions:6 },
  { month:"Jul", predicted:12.6, actual:12.1, fdotAadt:22400, realAadt:null,   digitalIndex:65, leaseConversions:4 },
  { month:"Aug", predicted:12.2, actual:10.8, fdotAadt:22400, realAadt:null,   digitalIndex:61, leaseConversions:3 },
  { month:"Sep", predicted:14.8, actual:15.6, fdotAadt:23100, realAadt:null,   digitalIndex:84, leaseConversions:7 },
  { month:"Oct", predicted:16.4, actual:17.2, fdotAadt:23100, realAadt:null,   digitalIndex:91, leaseConversions:8 },
  { month:"Nov", predicted:15.9, actual:16.8, fdotAadt:23100, realAadt:null,   digitalIndex:88, leaseConversions:9 },
  { month:"Dec", predicted:13.1, actual:11.9, fdotAadt:23100, realAadt:null,   digitalIndex:59, leaseConversions:4 },
  { month:"Jan", predicted:17.2, actual:18.4, fdotAadt:24500, realAadt:24800, digitalIndex:97, leaseConversions:10 },
  { month:"Feb", predicted:18.1, actual:19.6, fdotAadt:24500, realAadt:25100, digitalIndex:102,leaseConversions:12 },
  { month:"Mar", predicted:17.8, actual:null, fdotAadt:24500, realAadt:null,   digitalIndex:null,leaseConversions:null },
];

// ProForma vs Actual
const PROFORMA_DATA = [
  { month:"Apr", projNOI:205000, actNOI:187000, projOcc:91.0, actOcc:88.4, projRent:1820, actRent:1798 },
  { month:"May", projNOI:208000, actNOI:194000, projOcc:91.5, actOcc:89.2, projRent:1832, actRent:1812 },
  { month:"Jun", projNOI:211000, actNOI:203000, projOcc:92.0, actOcc:90.7, projRent:1845, actRent:1835 },
  { month:"Jul", projNOI:213000, actNOI:209000, projOcc:92.5, actOcc:91.8, projRent:1858, actRent:1851 },
  { month:"Aug", projNOI:215000, actNOI:212000, projOcc:93.0, actOcc:92.4, projRent:1871, actRent:1869 },
  { month:"Sep", projNOI:218000, actNOI:221000, projOcc:93.0, actOcc:93.8, projRent:1885, actRent:1892 },
  { month:"Oct", projNOI:220000, actNOI:228000, projOcc:93.5, actOcc:94.5, projRent:1898, actRent:1914 },
  { month:"Nov", projNOI:223000, actNOI:234000, projOcc:93.5, actOcc:94.8, projRent:1912, actRent:1931 },
  { month:"Dec", projNOI:225000, actNOI:229000, projOcc:94.0, actOcc:94.1, projRent:1925, actRent:1924 },
  { month:"Jan", projNOI:228000, actNOI:241000, projOcc:94.0, actOcc:95.2, projRent:1939, actRent:1958 },
  { month:"Feb", projNOI:231000, actNOI:247000, projOcc:94.5, actOcc:95.9, projRent:1953, actRent:1979 },
  { month:"Mar", projNOI:234000, actNOI:null,   projOcc:94.5, actOcc:null,  projRent:1967, actRent:null  },
];

// Platform Intelligence contributions from this deal
const FLYWHEEL_FEEDS = [
  {
    id:"F1", target:"M07 Traffic Model", icon:"📡",
    color: T.cyan,
    contribution: "T-01 Walk-In Calibration",
    detail: "11 months of predicted vs actual walk-ins. Model accuracy: +8.4% avg over-prediction in summer, -7.1% under-prediction in snowbird season (Oct–Feb). FL seasonal curves updated for Class B multifamily, urban arterial category.",
    dataPoints: 11,
    impact: "HIGH",
    calibrationShift: "Snowbird factor +7.1% → applied to 14 properties in Tampa submarket",
    status: "FEEDING",
  },
  {
    id:"F2", target:"M09 ProForma Engine", icon:"📊",
    color: T.green,
    contribution: "Rent Growth & NOI Benchmarks",
    detail: "Actual rent growth: +10.3% over 11 months vs underwritten +6.8%. NOI margin: 63.1% actual vs 60.8% underwritten. Value-add premium $133/unit actual vs $95/unit underwritten.",
    dataPoints: 11,
    impact: "HIGH",
    calibrationShift: "Value-add premium baseline revised upward for Tampa Class B, 1990s vintage",
    status: "FEEDING",
  },
  {
    id:"F3", target:"JEDI Score Engine", icon:"⚡",
    color: T.amber,
    contribution: "Score Accuracy Validation",
    detail: "JEDI Score at underwriting: 74. Predicted 18-month IRR band: 14–19%. Actual trajectory IRR: 22.4% (outperforming). Score 74 with strong traffic position may systematically underweight T-01 accuracy as demand leading indicator.",
    dataPoints: 1,
    impact: "MEDIUM",
    calibrationShift: "Traffic sub-score weight under review: 15% → 18% for urban multifamily",
    status: "UNDER REVIEW",
  },
  {
    id:"F4", target:"M08 Strategy Arbitrage", icon:"🎯",
    color: T.purple,
    contribution: "Value-Add Rental Outcome",
    detail: "Strategy Arbitrage recommended Value-Add Rental (score 82) over BTS (61), Flip (44), STR (38). Actual outcome validating. After 11 months, Rental strategy on track for 22%+ IRR. Confidence in Strategy Arbitrage recommendations for this property profile +12 points.",
    dataPoints: 1,
    impact: "MEDIUM",
    calibrationShift: "Value-Add Rental weight for Class B Tampa urban assets: +5 points",
    status: "VALIDATING",
  },
  {
    id:"F5", target:"M27 Sale Comp Database", icon:"🏢",
    color: T.blue,
    contribution: "Internal Comp Record",
    detail: "This deal (290 units, $32.4M, $111.7k/unit, 5.1% going-in cap, Class B 1992) becomes an internal comp. Purchase price, cap rate, rent at close, and ongoing NOI data now available to comp engine for future deals within 5-mile radius.",
    dataPoints: 1,
    impact: "HIGH",
    calibrationShift: "Added to Tampa/Westshore comp set. 3 future deals have already referenced this comp in underwriting.",
    status: "LIVE",
  },
  {
    id:"F6", target:"M26 Tax Intelligence", icon:"🏛️",
    color: T.yellow,
    contribution: "Post-Sale Reassessment Validation",
    detail: "M26 predicted post-sale assessed value: $31.8M–$33.2M. Actual HCPA assessment post-sale: $32.1M. Millage-derived tax projection accuracy: within 1.2% of actual. Non-homestead cap mechanics validated for Hillsborough County.",
    dataPoints: 1,
    impact: "MEDIUM",
    calibrationShift: "M26 Hillsborough formula confidence upgraded from 87% → 94%",
    status: "VALIDATED",
  },
];

// ─── MINI CHART: Bar pair ─────────────────────────────────────────────────────
function MiniBarChart({ data, keyA, keyB, colorA, colorB, labelA, labelB, fmt, height = 80 }) {
  const vals = data.filter(d => d[keyA] != null && d[keyB] != null);
  const max = Math.max(...vals.flatMap(d => [d[keyA], d[keyB]]));
  const barW = 100 / (vals.length * 3);

  return (
    <div style={{ position:"relative", height, width:"100%", overflow:"hidden" }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {vals.map((d, i) => {
          const x = i * (100 / vals.length);
          const w = barW;
          const hA = (d[keyA] / max) * (height - 12);
          const hB = (d[keyB] / max) * (height - 12);
          return (
            <g key={i}>
              <rect x={x + 0.5} y={height - hA - 4} width={w} height={hA} fill={colorA} opacity={0.7} rx="0.5" />
              <rect x={x + w + 0.8} y={height - hB - 4} width={w} height={hB} fill={colorB} opacity={0.7} rx="0.5" />
            </g>
          );
        })}
      </svg>
      <div style={{ display:"flex", gap:12, marginTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color: T.textDim }}>
          <div style={{ width:8, height:3, background:colorA, borderRadius:1 }} />
          {labelA}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:9, color: T.textDim }}>
          <div style={{ width:8, height:3, background:colorB, borderRadius:1 }} />
          {labelB}
        </div>
      </div>
    </div>
  );
}

// ─── MINI LINE CHART ──────────────────────────────────────────────────────────
function MiniLineChart({ data, keyA, keyB, colorA, colorB, height = 70 }) {
  const vals = data.filter(d => d[keyA] != null && d[keyB] != null);
  if (vals.length < 2) return null;
  const minV = Math.min(...vals.flatMap(d => [d[keyA], d[keyB]])) * 0.97;
  const maxV = Math.max(...vals.flatMap(d => [d[keyA], d[keyB]])) * 1.03;
  const range = maxV - minV;
  const toY = v => height - ((v - minV) / range) * (height - 4) - 2;
  const toX = i => (i / (vals.length - 1)) * 100;

  const pathA = vals.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[keyA]).toFixed(1)}`).join(" ");
  const pathB = vals.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[keyB]).toFixed(1)}`).join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <path d={pathA} fill="none" stroke={colorA} strokeWidth="1.5" />
      <path d={pathB} fill="none" stroke={colorB} strokeWidth="1.5" strokeDasharray="2 1" />
      {vals.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d[keyA])} r="1.2" fill={colorA} />
          <circle cx={toX(i)} cy={toY(d[keyB])} r="1.2" fill={colorB} />
        </g>
      ))}
    </svg>
  );
}

// ─── ACCURACY GAUGE ───────────────────────────────────────────────────────────
function AccuracyGauge({ pct, label, size = 64 }) {
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color = pct >= 90 ? T.green : pct >= 75 ? T.amber : T.red;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth="3" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{ transform:`rotate(-90deg)`, transformOrigin:`${cx}px ${cy}px` }} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size * 0.18} fontFamily={T.mono} fontWeight="700">
          {pct}%
        </text>
      </svg>
      <div style={{ fontSize:9, color:T.textDim, textAlign:"center", fontFamily:T.mono }}>{label}</div>
    </div>
  );
}

// ─── VARIANCE PILL ────────────────────────────────────────────────────────────
function Variance({ proj, act, fmt = (v) => v, isPositiveGood = true }) {
  if (act == null) return <span style={{ color:T.textDim, fontSize:10 }}>—</span>;
  const delta = act - proj;
  const pct = ((delta / proj) * 100).toFixed(1);
  const positive = delta > 0;
  const good = isPositiveGood ? positive : !positive;
  const color = good ? T.green : T.red;
  const sign = positive ? "▲" : "▼";
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:2,
      background: good ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${good ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
      borderRadius:3, padding:"1px 5px", fontSize:9, fontFamily:T.mono, color
    }}>
      {sign}{Math.abs(pct)}%
    </span>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color = T.amber, small = false }) {
  return (
    <div style={{
      background: T.panel, border:`1px solid ${T.border}`, borderRadius:6,
      padding: small ? "8px 10px" : "12px 14px",
    }}>
      <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 22, fontWeight:700, color, fontFamily:T.mono, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:9, color:T.textMid, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

// ─── TAB BAR ─────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:1, background:T.surface, borderRadius:6, padding:2, border:`1px solid ${T.border}` }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex:1, padding:"6px 10px", borderRadius:5, border:"none", cursor:"pointer",
          background: active === t.id ? T.panel : "transparent",
          color: active === t.id ? T.amber : T.textDim,
          fontSize:10, fontFamily:T.mono, fontWeight: active === t.id ? 700 : 400,
          transition:"all 0.15s",
          borderBottom: active === t.id ? `2px solid ${T.amber}` : "2px solid transparent",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({ label, tag, color = T.amber }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <div style={{ width:3, height:14, background:color, borderRadius:2 }} />
      <div style={{ fontSize:10, fontWeight:700, color, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</div>
      {tag && <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, background:T.surface, border:`1px solid ${T.border}`, borderRadius:3, padding:"1px 6px" }}>{tag}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 1: PERFORMANCE — Actuals vs ProForma
// ════════════════════════════════════════════════════════════════
function PerformanceTab() {
  const completed = PROFORMA_DATA.filter(d => d.actNOI != null);
  const totalProjNOI = completed.reduce((s,d) => s + d.projNOI, 0);
  const totalActNOI  = completed.reduce((s,d) => s + d.actNOI, 0);
  const avgProjOcc   = completed.reduce((s,d) => s + d.projOcc, 0) / completed.length;
  const avgActOcc    = completed.reduce((s,d) => s + d.actOcc, 0) / completed.length;
  const lastRow      = completed[completed.length - 1];
  const rentVariance = ((lastRow.actRent - lastRow.projRent) / lastRow.projRent * 100).toFixed(1);

  const fmtK = v => `$${(v/1000).toFixed(0)}K`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        <KPICard label="Cumulative NOI" value={fmtK(totalActNOI)} sub={`Proj: ${fmtK(totalProjNOI)}`} color={totalActNOI > totalProjNOI ? T.green : T.red} />
        <KPICard label="NOI Variance" value={`+${((totalActNOI/totalProjNOI - 1)*100).toFixed(1)}%`} sub="vs underwritten model" color={T.green} />
        <KPICard label="Avg Occupancy" value={`${avgActOcc.toFixed(1)}%`} sub={`Proj: ${avgProjOcc.toFixed(1)}%`} color={avgActOcc > avgProjOcc ? T.green : T.red} />
        <KPICard label="Current Rent" value={`$${lastRow.actRent.toLocaleString()}`} sub={`+${rentVariance}% vs model`} color={T.green} />
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {/* NOI Chart */}
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Monthly NOI — Actual vs ProForma" color={T.green} />
          <MiniBarChart
            data={completed} keyA="projNOI" keyB="actNOI"
            colorA={T.textDim} colorB={T.green}
            labelA="Projected" labelB="Actual"
            height={90}
          />
          <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
            {completed.map((d, i) => (
              <div key={i} style={{ fontSize:9, fontFamily:T.mono, textAlign:"center" }}>
                <div style={{ color:T.textDim }}>{d.month}</div>
                <div style={{ color: d.actNOI >= d.projNOI ? T.green : T.red, fontWeight:600 }}>
                  {d.actNOI >= d.projNOI ? "▲" : "▼"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Occupancy + Rent */}
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Occupancy & Rent Growth" color={T.cyan} />
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, marginBottom:4 }}>OCCUPANCY TREND</div>
            <MiniLineChart data={completed} keyA="projOcc" keyB="actOcc" colorA={T.textDim} colorB={T.cyan} height={55} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:8 }}>
            {completed.slice(-3).map((d,i) => (
              <div key={i} style={{ background:T.surface, borderRadius:4, padding:"6px 8px", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{d.month}</div>
                <div style={{ fontSize:11, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{d.actOcc}%</div>
                <Variance proj={d.projOcc} act={d.actOcc} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Full Actuals Log" tag="11 MONTHS" />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:T.mono }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Month","Proj NOI","Act NOI","Δ NOI","Proj Occ","Act Occ","Δ Occ","Proj Rent","Act Rent","Δ Rent"].map(h => (
                  <th key={h} style={{ padding:"6px 8px", color:T.textDim, fontWeight:600, textAlign:"right", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROFORMA_DATA.map((d, i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, opacity: d.actNOI ? 1 : 0.4 }}>
                  <td style={{ padding:"5px 8px", color:T.amber, fontWeight:700 }}>{d.month}</td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{fmtK(d.projNOI)}</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right", fontWeight:600 }}>{d.actNOI ? fmtK(d.actNOI) : "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}><Variance proj={d.projNOI} act={d.actNOI} /></td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{d.projOcc}%</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right" }}>{d.actOcc ? `${d.actOcc}%` : "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}><Variance proj={d.projOcc} act={d.actOcc} /></td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>${d.projRent}</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right", fontWeight:600 }}>{d.actRent ? `$${d.actRent}` : "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}><Variance proj={d.projRent} act={d.actRent} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 2: TRAFFIC VALIDATION — Predicted vs Actual
// ════════════════════════════════════════════════════════════════
function TrafficValidationTab() {
  const completed = TRAFFIC_DATA.filter(d => d.actual != null);
  const avgPred  = completed.reduce((s,d) => s + d.predicted, 0) / completed.length;
  const avgAct   = completed.reduce((s,d) => s + d.actual, 0) / completed.length;
  const errors   = completed.map(d => ((d.actual - d.predicted) / d.predicted * 100));
  const avgError = errors.reduce((s,v) => s + v, 0) / errors.length;
  const accuracy = 100 - Math.abs(avgError);

  const summerErr  = errors.slice(0,5).reduce((s,v)=>s+v,0)/5;
  const snowbirdErr= errors.slice(5).reduce((s,v)=>s+v,0)/errors.slice(5).length;

  const fdotComplete = TRAFFIC_DATA.filter(d => d.realAadt != null);
  const fdotAccuracy = fdotComplete.length > 0
    ? fdotComplete.map(d => (1 - Math.abs(d.realAadt - d.fdotAadt) / d.fdotAadt) * 100).reduce((s,v)=>s+v,0) / fdotComplete.length
    : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Accuracy KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
        <KPICard label="Overall Accuracy" value={`${accuracy.toFixed(1)}%`} sub="T-01 vs actual walk-ins" color={accuracy >= 85 ? T.green : T.amber} />
        <KPICard label="Avg Error" value={`${avgError > 0 ? "+" : ""}${avgError.toFixed(1)}%`} sub={avgError > 0 ? "Under-predicted" : "Over-predicted"} color={Math.abs(avgError) < 8 ? T.green : T.amber} />
        <KPICard label="Summer Bias" value={`${summerErr.toFixed(1)}%`} sub="Apr–Aug, over-predicted" color={T.amber} />
        <KPICard label="Snowbird Lift" value={`${snowbirdErr > 0 ? "+" : ""}${snowbirdErr.toFixed(1)}%`} sub="Oct–Feb, under-predicted" color={T.cyan} />
        <KPICard label="FDOT AADT" value={fdotAccuracy ? `${fdotAccuracy.toFixed(1)}%` : "—"} sub={fdotComplete.length > 0 ? `${fdotComplete.length} mo validated` : "Pending update"} color={T.blue} />
      </div>

      {/* Main chart */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
        <SectionHeader label="Walk-In Predictions vs Actuals" tag="T-01 WEEKLY WALK-INS" color={T.cyan} />
        <div style={{ position:"relative", height:120, width:"100%" }}>
          {(() => {
            const h = 100;
            const max = Math.max(...completed.flatMap(d => [d.predicted, d.actual])) * 1.1;
            const min = Math.min(...completed.flatMap(d => [d.predicted, d.actual])) * 0.9;
            const range = max - min;
            const toY = v => h - ((v - min) / range) * (h - 8) - 4;
            const toX = i => (i / (completed.length - 1)) * 100;

            const pathPred = completed.map((d,i) => `${i===0?"M":"L"}${toX(i).toFixed(1)},${toY(d.predicted).toFixed(1)}`).join(" ");
            const pathAct  = completed.map((d,i) => `${i===0?"M":"L"}${toX(i).toFixed(1)},${toY(d.actual).toFixed(1)}`).join(" ");

            // Error fill between curves
            const areaTop = completed.map((d,i) => `${i===0?"M":"L"}${toX(i).toFixed(1)},${toY(Math.max(d.predicted,d.actual)).toFixed(1)}`).join(" ");
            const areaBot = [...completed].reverse().map((d,i,arr) => {
              const j = arr.length-1-i;
              return `${j===completed.length-1?"M":"L"}${toX(j).toFixed(1)},${toY(Math.min(d.predicted,d.actual)).toFixed(1)}`;
            }).join(" ");

            return (
              <svg width="100%" height={h+20} viewBox={`0 0 100 ${h+20}`} preserveAspectRatio="none">
                {/* Grid */}
                {[0.25,0.5,0.75].map(p => (
                  <line key={p} x1="0" y1={h*p} x2="100" y2={h*p}
                    stroke={T.border} strokeWidth="0.3" strokeDasharray="1 1" />
                ))}
                {/* Error area */}
                <path d={`${areaTop} ${areaBot} Z`} fill="rgba(245,158,11,0.07)" />
                {/* Lines */}
                <path d={pathPred} fill="none" stroke={T.textDim} strokeWidth="1.5" strokeDasharray="2 1" />
                <path d={pathAct}  fill="none" stroke={T.cyan} strokeWidth="2" />
                {/* Dots */}
                {completed.map((d,i) => (
                  <g key={i}>
                    <circle cx={toX(i)} cy={toY(d.predicted)} r="1.5" fill={T.textDim} />
                    <circle cx={toX(i)} cy={toY(d.actual)}    r="2"   fill={T.cyan} />
                    {/* Month label */}
                    <text x={toX(i)} y={h+14} textAnchor="middle" fill={T.textDim}
                      fontSize="3.5" fontFamily={T.mono}>{d.month}</text>
                  </g>
                ))}
              </svg>
            );
          })()}
        </div>
        <div style={{ display:"flex", gap:16, marginTop:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:T.textDim, fontFamily:T.mono }}>
            <div style={{ width:16, height:2, background:T.textDim, borderRadius:1, borderTop:"1px dashed" }} /> T-01 Predicted
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:T.cyan, fontFamily:T.mono }}>
            <div style={{ width:16, height:2, background:T.cyan, borderRadius:1 }} /> Actual Walk-Ins (Leasing Log)
          </div>
          <div style={{ marginLeft:"auto", fontSize:9, color:T.amber, fontFamily:T.mono }}>
            Shaded area = prediction error magnitude
          </div>
        </div>
      </div>

      {/* Error analysis + calibration */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Error Pattern Analysis" color={T.amber} />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[
              { label:"Summer Season (Apr–Aug)", err:summerErr, cause:"FDOT seasonal factor assumes tourist traffic. Multifamily seekers not on vacation schedule.", fix:"Reduce summer seasonal multiplier by 0.06 for Class B multifamily in urban Tampa." },
              { label:"Snowbird Season (Oct–Feb)", err:snowbirdErr, cause:"Inbound migration demand not fully captured in FDOT AADT historical baseline.", fix:"Apply +7.1% inbound migration demand overlay for Oct–Feb in SW Florida coastal submarkets." },
              { label:"Weekend Spikes (Sat)", err:2.8, cause:"Saturday walk-in capture higher than DOW curve predicts.", fix:"Saturday DOW factor: 0.138 → 0.152 for urban multifamily leasing offices." },
            ].map((item, i) => (
              <div key={i} style={{ background:T.surface, borderRadius:5, padding:10, border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:10, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{item.label}</div>
                  <span style={{
                    fontSize:10, fontFamily:T.mono, fontWeight:700,
                    color: item.err > 0 ? T.cyan : T.amber,
                    background: item.err > 0 ? "rgba(34,211,238,0.1)" : "rgba(245,158,11,0.1)",
                    border:`1px solid ${item.err > 0 ? "rgba(34,211,238,0.25)" : "rgba(245,158,11,0.25)"}`,
                    borderRadius:3, padding:"1px 6px",
                  }}>{item.err > 0 ? "+" : ""}{item.err.toFixed(1)}%</span>
                </div>
                <div style={{ fontSize:9, color:T.textDim, marginBottom:4 }}><strong style={{ color:T.textMid }}>Why:</strong> {item.cause}</div>
                <div style={{ fontSize:9, color:T.green }}><strong>Fix →</strong> {item.fix}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Model Calibration Status" tag="T-10 VALIDATION" color={T.green} />

          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
            <AccuracyGauge pct={Math.round(accuracy)} label="Overall" />
            <AccuracyGauge pct={Math.round(100-Math.abs(summerErr))} label="Summer" />
            <AccuracyGauge pct={Math.round(100-Math.abs(snowbirdErr < 0 ? summerErr : snowbirdErr))} label="Snowbird" />
          </div>

          <div style={{ background:T.surface, borderRadius:5, padding:10, border:`1px solid ${T.borderHi}`, marginBottom:10 }}>
            <div style={{ fontSize:9, color:T.amber, fontFamily:T.mono, fontWeight:700, marginBottom:6 }}>
              ⚡ CALIBRATION PUSHED TO PLATFORM
            </div>
            <div style={{ fontSize:9, color:T.textMid, lineHeight:1.6 }}>
              Westshore Vue validation data has been applied to M07 seasonal curves for <strong style={{ color:T.text }}>Tampa Bay urban arterial, Class B multifamily</strong> category. Affects <strong style={{ color:T.cyan }}>14 active deals</strong> in this submarket.
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              { param:"Summer seasonal factor",    before:"1.12", after:"1.06", status:"APPLIED" },
              { param:"Snowbird overlay (Oct–Feb)", before:"none", after:"+7.1%", status:"APPLIED" },
              { param:"Saturday DOW factor",        before:"0.138", after:"0.152", status:"PENDING REVIEW" },
            ].map((r, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, alignItems:"center", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textMid, fontFamily:T.mono }}>{r.param}</div>
                <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{r.before}</div>
                <div style={{ fontSize:9, color:T.green, fontFamily:T.mono, fontWeight:700 }}>→ {r.after}</div>
                <div style={{
                  fontSize:8, fontFamily:T.mono, fontWeight:700,
                  color: r.status === "APPLIED" ? T.green : T.amber,
                  background: r.status === "APPLIED" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                  borderRadius:3, padding:"1px 5px",
                }}>{r.status}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop:12, padding:"8px 10px", background:"rgba(34,211,238,0.05)", border:`1px solid rgba(34,211,238,0.2)`, borderRadius:5 }}>
            <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, marginBottom:3 }}>FDOT AADT VALIDATION</div>
            <div style={{ fontSize:9, color:T.text, lineHeight:1.5 }}>
              Jan–Feb FDOT published update confirms W Kennedy Blvd AADT 24,800–25,100 vpd vs model baseline 24,500 vpd. <span style={{ color:T.cyan }}>+1.2–2.4% above baseline</span>. Road growth confirming digital demand surge.
            </div>
          </div>
        </div>
      </div>

      {/* Month-by-month table */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Month-by-Month Traffic Log" />
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:T.mono }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Month","T-01 Predicted","Actual Walk-ins","Error %","FDOT AADT","Live AADT","Digital Index","Lease Conversions"].map(h => (
                <th key={h} style={{ padding:"5px 8px", color:T.textDim, fontWeight:600, textAlign:"right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRAFFIC_DATA.map((d, i) => {
              const err = d.actual ? ((d.actual - d.predicted) / d.predicted * 100) : null;
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, opacity: d.actual ? 1 : 0.4 }}>
                  <td style={{ padding:"5px 8px", color:T.amber, fontWeight:700 }}>{d.month}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textDim }}>{d.predicted.toFixed(1)}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.text, fontWeight:600 }}>{d.actual?.toFixed(1) ?? "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}>
                    {err != null ? (
                      <span style={{ color: Math.abs(err) < 8 ? T.green : T.amber }}>
                        {err > 0 ? "+" : ""}{err.toFixed(1)}%
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textDim }}>{d.fdotAadt?.toLocaleString()}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:d.realAadt ? T.cyan : T.textDim }}>{d.realAadt?.toLocaleString() ?? "Pending"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}>
                    {d.digitalIndex != null ? (
                      <span style={{ color: d.digitalIndex > 90 ? T.green : d.digitalIndex > 70 ? T.amber : T.textMid }}>{d.digitalIndex}</span>
                    ) : "—"}
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.text }}>{d.leaseConversions ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 3: PLATFORM FEED — The Flywheel
// ════════════════════════════════════════════════════════════════
function PlatformFeedTab() {
  const [expanded, setExpanded] = useState(null);

  const impactColor = { HIGH: T.green, MEDIUM: T.amber, LOW: T.textDim };
  const statusColor = { FEEDING: T.green, VALIDATED: T.cyan, "VALIDATING": T.amber, "UNDER REVIEW": T.purple, LIVE: T.blue };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Concept banner */}
      <div style={{
        background:"linear-gradient(135deg, rgba(245,158,11,0.08), rgba(34,211,238,0.08))",
        border:`1px solid ${T.borderHi}`, borderRadius:8, padding:16,
        display:"flex", alignItems:"flex-start", gap:14,
      }}>
        <div style={{ fontSize:28, lineHeight:1 }}>⚙️</div>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:T.amber, fontFamily:T.mono, marginBottom:4 }}>
            THE PLATFORM INTELLIGENCE FLYWHEEL
          </div>
          <div style={{ fontSize:11, color:T.textMid, lineHeight:1.7, maxWidth:700 }}>
            Every deal that completes the full pipeline — underwriting → close → post-close reporting — becomes a <strong style={{ color:T.text }}>live training asset</strong> for the platform. Actual NOI, traffic, rent growth, and tax data feed back into M07 traffic calibration, M09 ProForma benchmarks, JEDI Score accuracy, Strategy Arbitrage validation, and the comp database. The platform gets smarter with every deal closed.
          </div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:28, fontWeight:800, color:T.green, fontFamily:T.mono, lineHeight:1 }}>6</div>
          <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>ACTIVE FEEDS</div>
        </div>
      </div>

      {/* Flywheel diagram */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
        <SectionHeader label="Data Flow Map — This Deal → Platform" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:0, alignItems:"center" }}>
          {/* Source */}
          <div style={{ background:T.surface, borderRadius:6, padding:12, border:`1px solid ${T.borderHi}` }}>
            <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, marginBottom:8 }}>THIS DEAL (WESTSHORE VUE)</div>
            {[
              { icon:"📋", label:"Monthly NOI actuals", freq:"Monthly" },
              { icon:"🚶", label:"Walk-in leasing log", freq:"Monthly" },
              { icon:"🏠", label:"Actual rent + occupancy", freq:"Monthly" },
              { icon:"🏛️", label:"HCPA assessed value", freq:"Annual" },
              { icon:"📈", label:"CapEx + renovation outcomes", freq:"Per event" },
              { icon:"🎯", label:"Strategy arbitrage result", freq:"Hold period" },
            ].map((item, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:12 }}>{item.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:T.text, fontFamily:T.mono }}>{item.label}</div>
                </div>
                <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono, background:T.panel, borderRadius:3, padding:"1px 5px" }}>{item.freq}</div>
              </div>
            ))}
          </div>

          {/* Arrow */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"0 20px", gap:4 }}>
            <div style={{ fontSize:24, color:T.amber }}>⟹</div>
            <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono, textAlign:"center" }}>FEEDS</div>
          </div>

          {/* Destinations */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {FLYWHEEL_FEEDS.map((feed, i) => (
              <div key={i} style={{
                background: expanded === i ? `${feed.color}10` : T.surface,
                border:`1px solid ${expanded === i ? feed.color : T.border}`,
                borderRadius:5, padding:"8px 10px", cursor:"pointer",
                transition:"all 0.15s",
              }} onClick={() => setExpanded(expanded === i ? null : i)}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:14 }}>{feed.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:10, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{feed.target}</div>
                    <div style={{ fontSize:9, color:T.textDim }}>{feed.contribution}</div>
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    <span style={{
                      fontSize:8, fontFamily:T.mono, fontWeight:700,
                      color:impactColor[feed.impact], background:`${impactColor[feed.impact]}18`,
                      borderRadius:3, padding:"1px 5px",
                    }}>{feed.impact}</span>
                    <span style={{
                      fontSize:8, fontFamily:T.mono, fontWeight:700,
                      color:statusColor[feed.status], background:`${statusColor[feed.status]}18`,
                      borderRadius:3, padding:"1px 5px",
                    }}>{feed.status}</span>
                  </div>
                  <div style={{ color:T.textDim, fontSize:10 }}>{expanded === i ? "▲" : "▼"}</div>
                </div>
                {expanded === i && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:9, color:T.textMid, lineHeight:1.6, marginBottom:6 }}>{feed.detail}</div>
                    <div style={{
                      fontSize:9, color:feed.color, fontFamily:T.mono,
                      background:`${feed.color}0d`, borderRadius:4, padding:"5px 8px",
                      border:`1px solid ${feed.color}30`,
                    }}>
                      ⟹ {feed.calibrationShift}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Future deals enriched by this deal */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Future Deals Enriched by Westshore Vue Data" tag="3 DEALS REFERENCED" color={T.blue} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[
            {
              deal:"DEAL-0051", name:"Bay Palms Village", address:"3820 W Bay Ave, Tampa",
              using:"ProForma rent benchmarks (Class B, 1990s vintage)",
              impact:"Rent growth assumption revised from 3.2% → 3.9% based on Westshore Vue actuals",
              color: T.green,
            },
            {
              deal:"DEAL-0054", name:"Kennedy Court Flats", address:"4800 W Kennedy Blvd",
              using:"T-01 traffic calibration (same road segment, urban arterial)",
              impact:"Walk-in prediction accuracy improved ~8% from seasonal correction applied here",
              color: T.cyan,
            },
            {
              deal:"DEAL-0058", name:"Westshore Gateway", address:"4100 W Kennedy Blvd",
              using:"M27 sale comp (same submarket, same road, ±1mi)",
              impact:"Used as primary comp at $111.7K/unit, 5.1% cap rate for underwriting benchmarks",
              color: T.purple,
            },
          ].map((item, i) => (
            <div key={i} style={{ background:T.surface, borderRadius:5, padding:10, border:`1px solid ${item.color}30` }}>
              <div style={{ display:"flex", justify:"space-between", marginBottom:6 }}>
                <div style={{ fontSize:9, color:item.color, fontFamily:T.mono, fontWeight:700 }}>{item.deal}</div>
              </div>
              <div style={{ fontSize:10, color:T.text, fontWeight:600, marginBottom:2 }}>{item.name}</div>
              <div style={{ fontSize:9, color:T.textDim, marginBottom:6 }}>{item.address}</div>
              <div style={{ fontSize:9, color:T.textMid, marginBottom:6 }}>
                <strong style={{ color:item.color }}>Using:</strong> {item.using}
              </div>
              <div style={{ fontSize:9, color:T.text, lineHeight:1.5, background:`${item.color}08`, borderRadius:3, padding:"5px 7px", border:`1px solid ${item.color}20` }}>
                {item.impact}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform health contribution */}
      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Platform Intelligence Health — This Deal's Contribution" color={T.purple} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
          {[
            { module:"M07 Traffic", before:72, after:81, label:"Accuracy" },
            { module:"M09 ProForma", before:68, after:77, label:"Confidence" },
            { module:"JEDI Score", before:74, after:79, label:"Accuracy" },
            { module:"M27 Comps", before:5, after:6, label:"Comp Records" },
            { module:"M08 Strategy", before:71, after:76, label:"Validation" },
            { module:"M26 Tax", before:87, after:94, label:"Accuracy" },
          ].map((item, i) => (
            <div key={i} style={{ background:T.surface, borderRadius:5, padding:10, border:`1px solid ${T.border}`, textAlign:"center" }}>
              <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono, marginBottom:6 }}>{item.module}</div>
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:4, marginBottom:4 }}>
                <span style={{ fontSize:11, color:T.textDim, fontFamily:T.mono }}>{item.before}</span>
                <span style={{ fontSize:9, color:T.green }}>→</span>
                <span style={{ fontSize:14, fontWeight:700, color:T.green, fontFamily:T.mono }}>{item.after}</span>
              </div>
              <div style={{ fontSize:8, color:T.textDim }}>{item.label}</div>
              <div style={{
                marginTop:6, height:3, borderRadius:2, background:T.border, overflow:"hidden"
              }}>
                <div style={{
                  height:"100%", background:T.green, borderRadius:2,
                  width: `${(item.after / (item.module === "M27 Comps" ? 10 : 100)) * 100}%`
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB 4: DEAL BIBLE — Permanent Archive
// ════════════════════════════════════════════════════════════════
function DealBibleTab() {
  const [section, setSection] = useState("underwriting");

  const sections = [
    { id:"underwriting", label:"At Underwriting" },
    { id:"decisions",    label:"Decision Log" },
    { id:"capital",      label:"Capital Stack" },
    { id:"exits",        label:"Exit Scenarios" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ background: "rgba(245,158,11,0.06)", border:`1px solid ${T.amberDim}`, borderRadius:6, padding:12 }}>
        <div style={{ fontSize:10, color:T.amber, fontFamily:T.mono, fontWeight:700, marginBottom:4 }}>
          📚 DEAL BIBLE — PERMANENT ARCHIVE
        </div>
        <div style={{ fontSize:9, color:T.textMid, lineHeight:1.6 }}>
          The Deal Bible is a frozen, immutable record of every assumption, decision, and market condition at time of underwriting. It never changes. As actuals come in, the platform traces every variance back to a specific decision point. <strong style={{ color:T.text }}>This is the institutional memory of the deal.</strong>
        </div>
      </div>

      <div style={{ display:"flex", gap:1, background:T.surface, borderRadius:5, padding:2 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            flex:1, padding:"5px 8px", borderRadius:4, border:"none", cursor:"pointer",
            background: section === s.id ? T.panel : "transparent",
            color: section === s.id ? T.amber : T.textDim,
            fontSize:9, fontFamily:T.mono,
            borderBottom: section === s.id ? `2px solid ${T.amber}` : "2px solid transparent",
          }}>{s.label}</button>
        ))}
      </div>

      {section === "underwriting" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
            <SectionHeader label="Market Conditions at Close — Apr 2023" color={T.amber} />
            {[
              ["Submarket Cap Rate","5.10%","Compressed since →","4.72%"],
              ["Market Vacancy","6.8%","Current →","5.1%"],
              ["YoY Rent Growth","4.2%","Actual achieved →","10.3%"],
              ["FDOT AADT (W Kennedy)","22,400 vpd","Current →","24,800 vpd"],
              ["Digital Demand Index","71","Current →","97–102"],
              ["JEDI Score","74","Current →","81"],
              ["10-yr Treasury","3.85%","Current →","4.15%"],
            ].map(([label, val, arrow, current], i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8, alignItems:"center", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textMid, fontFamily:T.mono }}>{label}</div>
                <div style={{ fontSize:9, color:T.amber, fontFamily:T.mono, fontWeight:600 }}>{val}</div>
                <div style={{ fontSize:8, color:T.textDim }}>→</div>
                <div style={{ fontSize:9, color:T.cyan, fontFamily:T.mono }}>{current}</div>
              </div>
            ))}
          </div>
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
            <SectionHeader label="Underwriting Assumptions Frozen at Close" color={T.blue} />
            {[
              ["Hold Period","5 years","2023–2028"],
              ["Exit Cap Rate","5.25%","Underwritten"],
              ["Rent Growth Yr1–3","3.5%/yr","Model assumed"],
              ["Rent Growth Yr4–5","2.8%/yr","Model assumed"],
              ["Vacancy","6.5%","Stabilized"],
              ["CapEx Budget","$3.2M","140-unit reno"],
              ["Value-Add Premium","$95/unit","Underwritten"],
              ["Entry LTV","65%","$21M senior"],
              ["Interest Rate","5.85%","Fixed, 5yr"],
              ["Target IRR","17.0%","Underwritten"],
            ].map(([label, val, note], i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8, alignItems:"center", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textMid, fontFamily:T.mono }}>{label}</div>
                <div style={{ fontSize:9, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{val}</div>
                <div style={{ fontSize:8, color:T.textDim }}>{note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "decisions" && (
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Decision Timeline — Every Fork in the Road" />
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {[
              { date:"Mar 2023", type:"ACQUISITION", decision:"Offered $32.4M vs ask $34.5M", outcome:"Accepted after 18-day negotiation", jedi:74, status:"✅" },
              { date:"Apr 2023", type:"FINANCING",   decision:"Fixed rate 5.85% vs float bridge at 5.10%", outcome:"Chose fixed. Rates rose to 6.4% by Oct 2023", jedi:74, status:"✅ RIGHT CALL" },
              { date:"Jun 2023", type:"CAPEX",       decision:"Accelerated reno timeline from 24mo → 16mo", outcome:"Completed 138/140 units in 14 months, $133/unit actual premium vs $95 underwritten", jedi:76, status:"✅" },
              { date:"Sep 2023", type:"STRATEGY",    decision:"Considered STR conversion for 20 units", outcome:"Rejected — M08 STR score 38 vs Rental 82. Maintained full rental strategy", jedi:78, status:"✅ PLATFORM VALIDATED" },
              { date:"Jan 2024", type:"LEASING",     decision:"Hold rents vs push 4.2% increase", outcome:"Pushed rents. Occupancy held at 95.2%. Rent premium capturing $19/unit above model", jedi:81, status:"✅" },
              { date:"Mar 2024", type:"EXIT TIMING", decision:"Evaluate early exit vs hold to 2028", outcome:"Exit model shows Q4 2026 optimal window. Holding through rate environment", jedi:81, status:"⏳ MONITORING" },
            ].map((d, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"80px 90px 1fr 1fr 40px 120px", gap:10, alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.amber, fontFamily:T.mono, fontWeight:700 }}>{d.date}</div>
                <div style={{
                  fontSize:8, fontFamily:T.mono, fontWeight:700,
                  color: {ACQUISITION:T.blue,FINANCING:T.purple,CAPEX:T.green,STRATEGY:T.amber,LEASING:T.cyan,EXIT:T.red,"EXIT TIMING":T.red}[d.type] || T.textDim,
                  textAlign:"center",
                }}>{d.type}</div>
                <div style={{ fontSize:9, color:T.textMid }}>{d.decision}</div>
                <div style={{ fontSize:9, color:T.text }}>{d.outcome}</div>
                <div style={{ fontSize:9, color:T.green, fontFamily:T.mono, textAlign:"center" }}>{d.jedi}</div>
                <div style={{ fontSize:8, color:T.green, fontFamily:T.mono }}>{d.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "capital" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
            <SectionHeader label="Capital Stack at Acquisition" color={T.blue} />
            {[
              { label:"Senior Debt (Agency)", amount:21060000, pct:65.0, rate:"5.85% fixed", color:T.blue },
              { label:"LP Equity (Fund III)",  amount:8424000,  pct:26.0, rate:"8% pref / 70:30", color:T.purple },
              { label:"GP Equity / Promote",   amount:2916000,  pct:9.0,  rate:"Promote above 8% hurdle", color:T.amber },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <div style={{ fontSize:10, color:item.color, fontFamily:T.mono, fontWeight:600 }}>{item.label}</div>
                  <div style={{ fontSize:10, color:T.text, fontFamily:T.mono }}>${(item.amount/1e6).toFixed(2)}M</div>
                </div>
                <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden", marginBottom:3 }}>
                  <div style={{ width:`${item.pct}%`, height:"100%", background:item.color, borderRadius:3 }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div style={{ fontSize:9, color:T.textDim }}>{item.pct}% of capital stack</div>
                  <div style={{ fontSize:9, color:T.textDim }}>{item.rate}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
            <SectionHeader label="Current Trajectory vs Underwritten" color={T.green} />
            {[
              { metric:"Projected IRR",      underwritten:"17.0%", current:"22.4%",  good:true },
              { metric:"Equity Multiple",    underwritten:"2.4x",  current:"3.1x est",good:true },
              { metric:"Current DSCR",       underwritten:"1.22x", current:"1.54x",  good:true },
              { metric:"Debt Yield",         underwritten:"8.1%",  current:"9.8%",   good:true },
              { metric:"Exit Cap (targeted)","5.25%",              current:"5.10% market",good:true },
              { metric:"Refi Risk",          underwritten:"LOW",   current:"LOW",    good:true },
            ].map((item, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8, alignItems:"center", padding:"5px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textMid, fontFamily:T.mono }}>{item.metric}</div>
                <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{item.underwritten}</div>
                <div style={{ fontSize:9, color:item.good ? T.green : T.red, fontFamily:T.mono, fontWeight:700 }}>→ {item.current}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === "exits" && (
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Exit Scenario Analysis — Live" color={T.red} />
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
            {[
              { name:"Exit Now (Q2 2026)", cap:"4.72%", noi:2840000, value:60169491, irr:"22.4%", multiple:"2.90x", badge:"SUBOPTIMAL", color:T.textDim, risk:"Prepay penalty $345K. Too early." },
              { name:"Optimal Window (Q4 2026)", cap:"4.85%", noi:2960000, value:61030928, irr:"24.8%", multiple:"3.15x", badge:"OPTIMAL", color:T.green, risk:"After penalty drops. Before supply wave." },
              { name:"Hold to Maturity (2028)", cap:"5.35%", noi:3100000, value:57943925, irr:"21.2%", multiple:"2.88x", badge:"RISK ↑", color:T.amber, risk:"Supply wave 2027 + refi at 6.25%." },
            ].map((s, i) => (
              <div key={i} style={{ background:T.surface, borderRadius:6, padding:12, border:`2px solid ${s.color}40` }}>
                <div style={{ fontSize:9, fontFamily:T.mono, fontWeight:700, color:s.color, marginBottom:8 }}>{s.badge}</div>
                <div style={{ fontSize:11, color:T.text, fontWeight:600, marginBottom:8 }}>{s.name}</div>
                {[
                  ["Exit Cap",s.cap],["Gross Value",`$${(s.value/1e6).toFixed(1)}M`],
                  ["IRR",s.irr],["Equity Multiple",s.multiple],
                ].map(([l,v],j) => (
                  <div key={j} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{l}</div>
                    <div style={{ fontSize:9, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{v}</div>
                  </div>
                ))}
                <div style={{ marginTop:8, fontSize:9, color:T.textDim, lineHeight:1.5 }}>{s.risk}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"rgba(34,197,94,0.06)", border:`1px solid rgba(34,197,94,0.3)`, borderRadius:5, padding:12 }}>
            <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.green, marginBottom:6 }}>
              ⟹ RECOMMENDATION: BEGIN BROKER OUTREACH Q3 2026 — TARGET Q4 CLOSE
            </div>
            <div style={{ fontSize:9, color:T.textMid, lineHeight:1.6 }}>
              Prepayment penalty drops from 1.8% → 1.0% Sept 2026. No major competitive supply until Q3 2027 (Residences at Westshore, 350 units). Rate environment shows signs of stabilization. Institutional buyer activity elevated (12 acquisitions in submarket, 180 days). Current NOI growth trajectory (+12.3% trailing 12mo) supports premium pricing. Platform traffic data shows W Kennedy AADT still accelerating — exit while road growth still priced as upside, before it's priced in.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ════════════════════════════════════════════════════════════════
export default function M22PostCloseIntelligence() {
  const [tab, setTab] = useState("performance");

  const tabs = [
    { id:"performance", label:"PERFORMANCE" },
    { id:"traffic",     label:"TRAFFIC VALIDATION" },
    { id:"flywheel",    label:"PLATFORM FEED" },
    { id:"bible",       label:"DEAL BIBLE" },
  ];

  const elapsed = "11 months";

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.text, fontFamily:T.sans, padding:0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        button { cursor:pointer; }
      `}</style>

      {/* ── DEAL BAR (amber persistent bar like Bloomberg integrated) ─── */}
      <div style={{
        background:"linear-gradient(90deg, #1a1200, #1e1500, #1a1200)",
        borderBottom:`2px solid ${T.amber}`,
        padding:"8px 20px",
        display:"flex", alignItems:"center", gap:20,
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.amber, background:"rgba(245,158,11,0.15)", border:`1px solid ${T.amber}`, borderRadius:3, padding:"2px 8px" }}>M22</div>
          <div style={{ fontSize:10, fontFamily:T.mono, fontWeight:700, color:T.amber }}>POST-CLOSE INTELLIGENCE</div>
        </div>
        <div style={{ width:1, height:20, background:T.border }} />
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{DEAL.name}</div>
          <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{DEAL.id} · {DEAL.address}</div>
        </div>
        <div style={{ width:1, height:20, background:T.border }} />
        <div style={{ display:"flex", gap:20 }}>
          {[
            { label:"Units", value:DEAL.units },
            { label:"Purchase", value:`$${(DEAL.purchasePrice/1e6).toFixed(1)}M` },
            { label:"Strategy", value:DEAL.strategy },
            { label:"Hold", value:DEAL.holdPeriod },
          ].map(k => (
            <div key={k.label}>
              <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono }}>{k.label}</div>
              <div style={{ fontSize:10, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{k.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:16, alignItems:"center" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono }}>JEDI @ UW</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.amber, fontFamily:T.mono }}>{DEAL.jediScoreAtUnderwriting}</div>
          </div>
          <div style={{ fontSize:16, color:T.green }}>→</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono }}>JEDI NOW</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.green, fontFamily:T.mono }}>{DEAL.jediScoreNow}</div>
          </div>
          <div style={{ width:1, height:20, background:T.border }} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:8, color:T.textDim, fontFamily:T.mono }}>ELAPSED</div>
            <div style={{ fontSize:10, color:T.cyan, fontFamily:T.mono, fontWeight:700 }}>{elapsed}</div>
          </div>
          <div style={{
            fontSize:9, fontFamily:T.mono, fontWeight:700,
            color:T.green, background:"rgba(34,197,94,0.12)", border:`1px solid rgba(34,197,94,0.3)`,
            borderRadius:4, padding:"3px 10px",
          }}>● OUTPERFORMING</div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 20px" }}>
        {/* Tab bar */}
        <div style={{ marginBottom:16 }}>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </div>

        {/* Tab content */}
        {tab === "performance" && <PerformanceTab />}
        {tab === "traffic"     && <TrafficValidationTab />}
        {tab === "flywheel"    && <PlatformFeedTab />}
        {tab === "bible"       && <DealBibleTab />}
      </div>
    </div>
  );
}

export default DealFlywheelDashboard;
