import { useState, useEffect } from "react";
import { apiClient } from "../../services/api.client";

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

interface Deal {
  id: string;
  name: string;
  address?: string;
  projectType?: string;
  status?: string;
}

interface ProformaRow {
  month: string;
  period: string;
  projNOI: number | null;
  actNOI:  number | null;
  projOcc: number | null;
  actOcc:  number | null;
  projRent: number | null;
  actRent:  number | null;
}

interface TrafficRow {
  period: string;
  projectedLeads: number;
  actualLeads: number;
  leadVariancePct: number;
  projectedMoveIns: number;
  actualMoveIns: number;
  moveInVariancePct: number;
  conversionRate: number;
  benchmarkConversion: number;
}

interface SummaryData {
  varianceSummary: {
    totalNoiVariance: number;
    unfavorableCount: number;
    favorableCount: number;
  };
  healthScore: number;
}

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
    detail: "This deal becomes an internal comp. Purchase price, cap rate, rent at close, and ongoing NOI data now available to comp engine for future deals within 5-mile radius.",
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

function MiniBarChart({ data, keyA, keyB, colorA, colorB, labelA, labelB, height = 80 }: any) {
  const vals = data.filter((d: any) => d[keyA] != null && d[keyB] != null);
  if (vals.length === 0) return null;
  const max = Math.max(...vals.flatMap((d: any) => [d[keyA], d[keyB]]));
  const barW = 100 / (vals.length * 3);

  return (
    <div style={{ position:"relative", height, width:"100%", overflow:"hidden" }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {vals.map((d: any, i: number) => {
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

function MiniLineChart({ data, keyA, keyB, colorA, colorB, height = 70 }: any) {
  const vals = data.filter((d: any) => d[keyA] != null && d[keyB] != null);
  if (vals.length < 2) return null;
  const minV = Math.min(...vals.flatMap((d: any) => [d[keyA], d[keyB]])) * 0.97;
  const maxV = Math.max(...vals.flatMap((d: any) => [d[keyA], d[keyB]])) * 1.03;
  const range = maxV - minV || 1;
  const toY = (v: number) => height - ((v - minV) / range) * (height - 4) - 2;
  const toX = (i: number) => (i / (vals.length - 1)) * 100;

  const pathA = vals.map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[keyA]).toFixed(1)}`).join(" ");
  const pathB = vals.map((d: any, i: number) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d[keyB]).toFixed(1)}`).join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <path d={pathA} fill="none" stroke={colorA} strokeWidth="1.5" />
      <path d={pathB} fill="none" stroke={colorB} strokeWidth="1.5" strokeDasharray="2 1" />
      {vals.map((d: any, i: number) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d[keyA])} r="1.2" fill={colorA} />
          <circle cx={toX(i)} cy={toY(d[keyB])} r="1.2" fill={colorB} />
        </g>
      ))}
    </svg>
  );
}

function AccuracyGauge({ pct, label, size = 64 }: { pct: number; label: string; size?: number }) {
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

function Variance({ proj, act, isPositiveGood = true }: { proj: number | null; act: number | null; isPositiveGood?: boolean }) {
  if (act == null || proj == null) return <span style={{ color:T.textDim, fontSize:10 }}>—</span>;
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
      {sign}{Math.abs(Number(pct))}%
    </span>
  );
}

function KPICard({ label, value, sub, color = T.amber, small = false }: any) {
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

function TabBar({ tabs, active, onChange }: any) {
  return (
    <div style={{ display:"flex", gap:1, background:T.surface, borderRadius:6, padding:2, border:`1px solid ${T.border}` }}>
      {tabs.map((t: any) => (
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

function SectionHeader({ label, tag, color = T.amber }: { label: string; tag?: string; color?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
      <div style={{ width:3, height:14, background:color, borderRadius:2 }} />
      <div style={{ fontSize:10, fontWeight:700, color, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</div>
      {tag && <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, background:T.surface, border:`1px solid ${T.border}`, borderRadius:3, padding:"1px 6px" }}>{tag}</div>}
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"60px 20px", gap:10, background:T.panel, border:`1px solid ${T.border}`,
      borderRadius:8, textAlign:"center",
    }}>
      <div style={{ fontSize:28 }}>📭</div>
      <div style={{ fontSize:12, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{message}</div>
      {sub && <div style={{ fontSize:10, color:T.textDim, maxWidth:400 }}>{sub}</div>}
    </div>
  );
}

function PerformanceTab({ proformaData }: { proformaData: ProformaRow[] }) {
  if (proformaData.length === 0) {
    return <EmptyState message="No Performance Data" sub="Upload monthly actuals and proforma projections to track performance here." />;
  }

  const completed = proformaData.filter(d => d.actNOI != null);
  const fmtK = (v: number | null) => v != null ? `$${(v/1000).toFixed(0)}K` : "—";

  if (completed.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Full Actuals Log" tag={`${proformaData.length} PROJECTED MONTHS`} />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:T.mono }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  {["Month","Proj NOI","Proj Occ","Proj Rent"].map(h => (
                    <th key={h} style={{ padding:"6px 8px", color:T.textDim, fontWeight:600, textAlign:"right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proformaData.map((d, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, opacity:0.7 }}>
                    <td style={{ padding:"5px 8px", color:T.amber, fontWeight:700 }}>{d.month}</td>
                    <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{fmtK(d.projNOI)}</td>
                    <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{d.projOcc != null ? `${d.projOcc.toFixed(1)}%` : "—"}</td>
                    <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{d.projRent != null ? `$${d.projRent.toLocaleString()}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, padding:"10px 14px", background:"rgba(245,158,11,0.06)", border:`1px solid ${T.amberDim}`, borderRadius:5 }}>
            <div style={{ fontSize:10, color:T.amber, fontFamily:T.mono, fontWeight:600 }}>No Actuals Uploaded Yet</div>
            <div style={{ fontSize:9, color:T.textMid, marginTop:4 }}>Upload actuals via the F3 Upload Actuals panel to begin tracking actual vs projected performance.</div>
          </div>
        </div>
      </div>
    );
  }

  const totalProjNOI = completed.reduce((s, d) => s + (d.projNOI ?? 0), 0);
  const totalActNOI  = completed.reduce((s, d) => s + (d.actNOI ?? 0), 0);
  const withOcc      = completed.filter(d => d.projOcc != null && d.actOcc != null);
  const avgProjOcc   = withOcc.length > 0 ? withOcc.reduce((s, d) => s + (d.projOcc ?? 0), 0) / withOcc.length : null;
  const avgActOcc    = withOcc.length > 0 ? withOcc.reduce((s, d) => s + (d.actOcc ?? 0), 0) / withOcc.length : null;
  const lastRow      = completed[completed.length - 1];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        <KPICard label="Cumulative NOI" value={fmtK(totalActNOI)} sub={`Proj: ${fmtK(totalProjNOI)}`} color={totalActNOI > totalProjNOI ? T.green : T.red} />
        <KPICard label="NOI Variance" value={totalProjNOI > 0 ? `${((totalActNOI/totalProjNOI - 1)*100) >= 0 ? "+" : ""}${((totalActNOI/totalProjNOI - 1)*100).toFixed(1)}%` : "—"} sub="vs underwritten model" color={totalActNOI >= totalProjNOI ? T.green : T.red} />
        <KPICard label="Avg Occupancy" value={avgActOcc != null ? `${avgActOcc.toFixed(1)}%` : "—"} sub={avgProjOcc != null ? `Proj: ${avgProjOcc.toFixed(1)}%` : undefined} color={avgActOcc != null && avgProjOcc != null && avgActOcc > avgProjOcc ? T.green : T.amber} />
        <KPICard label="Current Rent" value={lastRow.actRent != null ? `$${lastRow.actRent.toLocaleString()}` : "—"} sub={lastRow.projRent != null && lastRow.actRent != null ? `${((lastRow.actRent/lastRow.projRent - 1)*100) >= 0 ? "+" : ""}${((lastRow.actRent/lastRow.projRent - 1)*100).toFixed(1)}% vs model` : undefined} color={T.green} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Monthly NOI — Actual vs ProForma" color={T.green} />
          <MiniBarChart data={completed} keyA="projNOI" keyB="actNOI" colorA={T.textDim} colorB={T.green} labelA="Projected" labelB="Actual" height={90} />
          <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
            {completed.map((d, i) => (
              <div key={i} style={{ fontSize:9, fontFamily:T.mono, textAlign:"center" }}>
                <div style={{ color:T.textDim }}>{d.month}</div>
                <div style={{ color: (d.actNOI ?? 0) >= (d.projNOI ?? 0) ? T.green : T.red, fontWeight:600 }}>
                  {(d.actNOI ?? 0) >= (d.projNOI ?? 0) ? "▲" : "▼"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Occupancy & Rent Growth" color={T.cyan} />
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono, marginBottom:4 }}>OCCUPANCY TREND</div>
            <MiniLineChart data={completed} keyA="projOcc" keyB="actOcc" colorA={T.textDim} colorB={T.cyan} height={55} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:8 }}>
            {completed.slice(-3).map((d, i) => (
              <div key={i} style={{ background:T.surface, borderRadius:4, padding:"6px 8px", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{d.month}</div>
                <div style={{ fontSize:11, color:T.text, fontFamily:T.mono, fontWeight:600 }}>{d.actOcc != null ? `${d.actOcc.toFixed(1)}%` : "—"}</div>
                <Variance proj={d.projOcc} act={d.actOcc} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Full Actuals Log" tag={`${completed.length} MONTHS`} />
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
              {proformaData.map((d, i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}`, opacity: d.actNOI ? 1 : 0.4 }}>
                  <td style={{ padding:"5px 8px", color:T.amber, fontWeight:700 }}>{d.month}</td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{fmtK(d.projNOI)}</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right", fontWeight:600 }}>{d.actNOI != null ? fmtK(d.actNOI) : "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}><Variance proj={d.projNOI} act={d.actNOI} /></td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{d.projOcc != null ? `${d.projOcc.toFixed(1)}%` : "—"}</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right" }}>{d.actOcc != null ? `${d.actOcc.toFixed(1)}%` : "—"}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}><Variance proj={d.projOcc} act={d.actOcc} /></td>
                  <td style={{ padding:"5px 8px", color:T.textDim, textAlign:"right" }}>{d.projRent != null ? `$${d.projRent.toLocaleString()}` : "—"}</td>
                  <td style={{ padding:"5px 8px", color:T.text, textAlign:"right", fontWeight:600 }}>{d.actRent != null ? `$${d.actRent.toLocaleString()}` : "—"}</td>
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

function TrafficValidationTab({ trafficData }: { trafficData: TrafficRow[] }) {
  if (trafficData.length === 0) {
    return <EmptyState message="No Traffic Data" sub="Import traffic funnel data via the operations API to track predicted vs actual lead volume." />;
  }

  const avgPred  = trafficData.reduce((s, d) => s + d.projectedLeads, 0) / trafficData.length;
  const avgAct   = trafficData.reduce((s, d) => s + d.actualLeads, 0) / trafficData.length;
  const errors   = trafficData.map(d => d.leadVariancePct);
  const avgError = errors.reduce((s, v) => s + v, 0) / errors.length;
  const accuracy = 100 - Math.abs(avgError);

  const shortMonth = (period: string) => {
    const d = new Date(period + "-01");
    return d.toLocaleString("default", { month:"short" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        <KPICard label="Overall Accuracy" value={`${accuracy.toFixed(1)}%`} sub="Predicted vs actual leads" color={accuracy >= 85 ? T.green : T.amber} />
        <KPICard label="Avg Error" value={`${avgError > 0 ? "+" : ""}${avgError.toFixed(1)}%`} sub={avgError > 0 ? "Under-predicted" : "Over-predicted"} color={Math.abs(avgError) < 8 ? T.green : T.amber} />
        <KPICard label="Avg Predicted" value={avgPred.toFixed(0)} sub="Leads/period projected" color={T.textMid} />
        <KPICard label="Avg Actual" value={avgAct.toFixed(0)} sub="Leads/period actual" color={avgAct >= avgPred ? T.green : T.amber} />
      </div>

      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Traffic — Predicted vs Actual Leads" color={T.cyan} />
        <MiniBarChart
          data={trafficData.map(d => ({ ...d, month: shortMonth(d.period) }))}
          keyA="projectedLeads" keyB="actualLeads"
          colorA={T.textDim} colorB={T.cyan}
          labelA="Predicted" labelB="Actual"
          height={100}
        />
      </div>

      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
        <SectionHeader label="Month-by-Month Traffic Log" />
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, fontFamily:T.mono }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Period","Predicted Leads","Actual Leads","Error %","Proj Move-ins","Act Move-ins","Δ Move-ins","Conversion"].map(h => (
                <th key={h} style={{ padding:"5px 8px", color:T.textDim, fontWeight:600, textAlign:"right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trafficData.map((d, i) => {
              const err = d.leadVariancePct;
              return (
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:"5px 8px", color:T.amber, fontWeight:700 }}>{d.period}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textDim }}>{d.projectedLeads.toFixed(0)}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.text, fontWeight:600 }}>{d.actualLeads.toFixed(0)}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}>
                    <span style={{ color: Math.abs(err) < 8 ? T.green : T.amber }}>
                      {err > 0 ? "+" : ""}{err.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.textDim }}>{d.projectedMoveIns.toFixed(0)}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.text }}>{d.actualMoveIns.toFixed(0)}</td>
                  <td style={{ padding:"5px 8px", textAlign:"right" }}>
                    <Variance proj={d.projectedMoveIns} act={d.actualMoveIns} />
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:T.cyan }}>{d.conversionRate.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformFeedTab() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const impactColor: Record<string, string> = { HIGH: T.green, MEDIUM: T.amber, LOW: T.textDim };
  const statusColor: Record<string, string> = { FEEDING: T.green, VALIDATED: T.cyan, "VALIDATING": T.amber, "UNDER REVIEW": T.purple, LIVE: T.blue };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
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
            Every deal that completes the full pipeline — underwriting → close → post-close reporting — becomes a <strong style={{ color:T.text }}>live training asset</strong> for the platform. Actual NOI, traffic, rent growth, and tax data feed back into M07 traffic calibration, M09 ProForma benchmarks, JEDI Score accuracy, Strategy Arbitrage validation, and the comp database.
          </div>
        </div>
        <div style={{ marginLeft:"auto", textAlign:"center", flexShrink:0 }}>
          <div style={{ fontSize:28, fontWeight:800, color:T.green, fontFamily:T.mono, lineHeight:1 }}>6</div>
          <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>ACTIVE FEEDS</div>
        </div>
      </div>

      <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
        <SectionHeader label="Platform Feed Channels" />
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
                    fontSize: 9, fontFamily:T.mono, fontWeight:700,
                    color:impactColor[feed.impact], background:`${impactColor[feed.impact]}18`,
                    borderRadius:3, padding:"1px 5px",
                  }}>{feed.impact}</span>
                  <span style={{
                    fontSize: 9, fontFamily:T.mono, fontWeight:700,
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
  );
}

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
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Underwriting Assumptions Archive" color={T.amber} />
          <div style={{ fontSize:10, color:T.textMid, fontFamily:T.mono }}>
            Frozen underwriting assumptions are stored with each deal's original documents and model outputs. Select a deal with completed underwriting to view the full assumption archive.
          </div>
        </div>
      )}

      {section === "decisions" && (
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Decision Log" />
          <div style={{ fontSize:10, color:T.textMid, fontFamily:T.mono }}>
            Decision log entries are recorded as deal milestones are completed. Decisions will appear here as they are logged.
          </div>
        </div>
      )}

      {section === "capital" && (
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Capital Stack" color={T.blue} />
          <div style={{ fontSize:10, color:T.textMid, fontFamily:T.mono }}>
            Capital stack details are pulled from deal underwriting data. Complete the financing module to populate this section.
          </div>
        </div>
      )}

      {section === "exits" && (
        <div style={{ background:T.panel, border:`1px solid ${T.border}`, borderRadius:6, padding:14 }}>
          <SectionHeader label="Exit Scenario Analysis" color={T.red} />
          <div style={{ fontSize:10, color:T.textMid, fontFamily:T.mono }}>
            Exit scenarios are computed from the deal's proforma and current market data. Add actuals to generate live exit analysis.
          </div>
        </div>
      )}
    </div>
  );
}

export function M22PostCloseIntelligence() {
  const [tab, setTab]               = useState("performance");
  const [deals, setDeals]           = useState<Deal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [proformaData, setProformaData]     = useState<ProformaRow[]>([]);
  const [trafficData, setTrafficData]       = useState<TrafficRow[]>([]);
  const [summaryData, setSummaryData]       = useState<SummaryData | null>(null);
  const [loadingDeals, setLoadingDeals]     = useState(true);
  const [loadingData, setLoadingData]       = useState(false);
  const [dealError, setDealError]           = useState<string | null>(null);

  useEffect(() => {
    apiClient.get("/api/v1/deals")
      .then(r => {
        const list: Deal[] = r.data.deals ?? [];
        setDeals(list);
        if (list.length > 0) setSelectedDealId(list[0].id);
      })
      .catch(() => setDealError("Failed to load deals"))
      .finally(() => setLoadingDeals(false));
  }, []);

  useEffect(() => {
    if (!selectedDealId) return;
    setLoadingData(true);
    setProformaData([]);
    setTrafficData([]);
    setSummaryData(null);

    const headers = apiClient.defaults.headers.common;
    const pva = apiClient.get(`/api/v1/operations/${selectedDealId}/projected-vs-actual`);
    const traffic = apiClient.get(`/api/v1/operations/${selectedDealId}/traffic`, { params: { months: 24 } });
    const summary = apiClient.get(`/api/v1/operations/${selectedDealId}/summary`);

    Promise.allSettled([pva, traffic, summary]).then(([pvaRes, trafficRes, summaryRes]) => {
      if (pvaRes.status === "fulfilled") {
        setProformaData(pvaRes.value.data?.data ?? []);
      }
      if (trafficRes.status === "fulfilled") {
        setTrafficData(trafficRes.value.data?.traffic ?? []);
      }
      if (summaryRes.status === "fulfilled") {
        setSummaryData(summaryRes.value.data ?? null);
      }
    }).finally(() => setLoadingData(false));
  }, [selectedDealId]);

  const selectedDeal = deals.find(d => d.id === selectedDealId);
  const healthScore  = summaryData?.healthScore ?? null;

  const tabs = [
    { id:"performance", label:"PERFORMANCE" },
    { id:"traffic",     label:"TRAFFIC VALIDATION" },
    { id:"flywheel",    label:"PLATFORM FEED" },
    { id:"bible",       label:"DEAL BIBLE" },
  ];

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.text, fontFamily:T.sans, padding:0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        button { cursor:pointer; }
      `}</style>

      {/* ── HEADER BAR ─── */}
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

        {/* Deal selector */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>DEAL</div>
          {loadingDeals ? (
            <div style={{ fontSize:10, color:T.textDim, fontFamily:T.mono }}>Loading…</div>
          ) : dealError ? (
            <div style={{ fontSize:10, color:T.red, fontFamily:T.mono }}>{dealError}</div>
          ) : (
            <select
              value={selectedDealId}
              onChange={e => setSelectedDealId(e.target.value)}
              style={{
                background:T.panel, border:`1px solid ${T.borderHi}`, borderRadius:4,
                color:T.text, fontFamily:T.mono, fontSize:11, padding:"3px 8px",
                cursor:"pointer", outline:"none",
              }}
            >
              {deals.length === 0 && <option value="">No deals found</option>}
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>

        {selectedDeal && (
          <>
            <div style={{ width:1, height:20, background:T.border }} />
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{selectedDeal.name}</div>
              <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>{selectedDeal.id} · {selectedDeal.address ?? selectedDeal.projectType}</div>
            </div>
          </>
        )}

        <div style={{ marginLeft:"auto", display:"flex", gap:16, alignItems:"center" }}>
          {healthScore != null && (
            <>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize: 9, color:T.textDim, fontFamily:T.mono }}>OPS HEALTH</div>
                <div style={{ fontSize:14, fontWeight:700, color:healthScore >= 80 ? T.green : healthScore >= 60 ? T.amber : T.red, fontFamily:T.mono }}>{healthScore}</div>
              </div>
              <div style={{ width:1, height:20, background:T.border }} />
            </>
          )}
          {loadingData && (
            <div style={{ fontSize:9, color:T.textDim, fontFamily:T.mono }}>● LOADING DATA…</div>
          )}
          {!loadingData && selectedDealId && (
            <div style={{
              fontSize:9, fontFamily:T.mono, fontWeight:700,
              color:T.cyan, background:"rgba(34,211,238,0.1)", border:`1px solid rgba(34,211,238,0.3)`,
              borderRadius:4, padding:"3px 10px",
            }}>● LIVE DATA</div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ─── */}
      <div style={{ maxWidth:1400, margin:"0 auto", padding:"16px 20px" }}>
        {!selectedDealId && !loadingDeals ? (
          <EmptyState message="No Deal Selected" sub="Select a deal from the dropdown above to view post-close intelligence." />
        ) : (
          <>
            <div style={{ marginBottom:16 }}>
              <TabBar tabs={tabs} active={tab} onChange={setTab} />
            </div>
            {tab === "performance" && <PerformanceTab proformaData={proformaData} />}
            {tab === "traffic"     && <TrafficValidationTab trafficData={trafficData} />}
            {tab === "flywheel"    && <PlatformFeedTab />}
            {tab === "bible"       && <DealBibleTab />}
          </>
        )}
      </div>
    </div>
  );
}

const DealFlywheelDashboard = M22PostCloseIntelligence;
export default DealFlywheelDashboard;
