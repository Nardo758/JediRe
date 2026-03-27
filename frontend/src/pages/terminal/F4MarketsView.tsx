import React, { useState } from "react";
import BloombergMarketDetail from "../MarketIntelligence/BloombergMarketDetail";
import PeerComparisonPage from "../MarketIntelligence/PeerComparisonPage";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

const C = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  blue: "#3B82F6", blueBg: "#1e3a5f",
  borderS: "#1E2538", borderM: "#2A3348",
};

interface SubComp {
  name: string; msa: string; jedi: number; rent: string; rentD: string;
  vac: string; pipe: string; opp: number; cap: string; isSub?: boolean;
}

interface CorpHealthData {
  alerts?: Array<{ id: string; text: string; severity: string }>;
  sectors?: Array<{ name: string; score: number }>;
  submarketHealth?: Record<string, number>;
  loaded?: boolean;
  loading?: boolean;
}

function Spark({ data, color = C.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}

function ScoreCell({ value, size = 11 }: { value: number | string; size?: number }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? C.green : n >= 65 ? C.amber : C.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string | undefined }) {
  if (!value || value === "—") return <span style={{ color: C.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith("+"); const neg = s.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? C.green : neg ? C.red : C.muted, ...mono }}>{s}</span>;
}

function MiniChart({ data, color = C.green, h = 80 }: { data: number[]; color?: string; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100}%,${h - 8 - ((v - mn) / r) * (h - 16)}`).join(" ");
  const area = pts + ` 100%,${h} 0%,${h}`;
  return (
    <svg width="100%" height={h} style={{ display: "block" }} preserveAspectRatio="none" viewBox={`0 0 100 ${h}`}>
      <polygon points={area} fill={color + "12"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ThresholdVal({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? C.green : n <= thresholds[1] ? C.amber : C.red;
  else c = n >= thresholds[0] ? C.green : n >= thresholds[1] ? C.amber : C.red;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

function PressureBadge({ p }: { p: string }) {
  const colors: Record<string, string> = { BUYER: C.green, BALANCED: C.amber, SELLER: C.cyan };
  return <Badge label={p} color={colors[p] || C.muted} />;
}

const MSA = {
  name: "Atlanta, GA", full: "Atlanta-Sandy Springs-Roswell MSA",
  props: 1028, units: "250,412", jedi: 87, d30: "+4", confidence: 84,
  rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840/qtr",
  pipeline: "39,565", pipelinePct: "15.8%", moSupply: "14.1",
  pop: "6.2M", popD: "+2.1%", jobs: "3.1M", jobsD: "+2.8%",
  medInc: "$72,400", incD: "+3.4%", afford: "30.2%",
  cap: "5.2%", capD: "-20bps", ppu: "$218K", ppuD: "+8.4%",
  cycle: "EXPANSION", cycleMonth: 38,
};

const MSA_RENT = [1820,1840,1860,1880,1920,1950,1980,2010,2050,2080,2120,2150];
const MSA_VAC = [6.8,6.6,6.4,6.2,6.0,5.9,5.8,5.7,5.6,5.6,5.7,5.8];

const MSA_SIGNALS = [
  { id: "D", name: "DEMAND", score: 82, delta: "+3", weight: 30, color: C.green, desc: "Pop +2.1%, Employment +2.8%, Net migration +14K HH/yr. Amazon HQ expansion." },
  { id: "S", name: "SUPPLY", score: 64, delta: "-2", weight: 25, color: C.red, desc: "39,565 pipeline units (15.8% of stock). 14.1 mo supply. Past-peak permits." },
  { id: "M", name: "MOMENTUM", score: 78, delta: "+5", weight: 20, color: C.orange, desc: "Rent growth accelerating +4.2% YoY. Txn velocity +14%. Concessions falling." },
  { id: "P", name: "POSITION", score: 72, delta: "+1", weight: 15, color: C.purple, desc: "40th pctl nationally. Top quartile SE region. Institutional capital inflow." },
  { id: "R", name: "RISK", score: 28, delta: "-4", weight: 10, color: C.muted, desc: "Affordability 30.2% approaching threshold. Insurance +8% cap helps. Score inverted." },
];

const SUB = {
  name: "Midtown", msa: "Atlanta, GA", props: 52, units: "14,856",
  jedi: 88, d30: "+3", confidence: 82,
  rent: "$2,056", rentD: "+4.8%", rentSf: "$2.14", vac: "5.1%",
  absorb: "3.2%/qtr", absorbUnits: "476/qtr",
  pipeline: "1,840", pipelinePct: "12.4%", moSupply: "14",
  opp: 82, pressure: "BUYER",
  cap: "4.8%", capD: "-15bps", ppu: "$245K", ppuD: "+11.2%",
  pop: "48,200", popD: "+3.8%", jobs: "142K", jobsD: "+4.2%",
  medInc: "$86,400", afford: "28.6%", review: 4.2, reviewCt: 2840,
  topProp: "The Metropolitan", topPCS: 94, botProp: "Midtown Terrace", botPCS: 42,
};

const SUB_RENT = [1860,1880,1900,1920,1940,1960,1975,1990,2010,2025,2040,2056];

const SUB_SIGNALS = [
  { id: "D", name: "DEMAND", score: 88, delta: "+4", weight: 30, color: C.green, desc: "Tech corridor hiring +4.2%. Piedmont Park proximity. Walk score 92." },
  { id: "S", name: "SUPPLY", score: 68, delta: "-1", weight: 25, color: C.orange, desc: "1,840 pipeline units (12.4%). Midtown Union Phase II delivers Q3 2026." },
  { id: "M", name: "MOMENTUM", score: 84, delta: "+6", weight: 20, color: C.green, desc: "Rent growth +4.8% — fastest in MSA. Concessions at 18-mo low." },
  { id: "P", name: "POSITION", score: 78, delta: "+2", weight: 15, color: C.purple, desc: "Top submarket by PCS. 12 of top-20 MSA properties located here." },
  { id: "R", name: "RISK", score: 32, delta: "-3", weight: 10, color: C.muted, desc: "High price point ($245K/unit) limits exit buyer pool. Score inverted." },
];

const SUB_COMPS: SubComp[] = [
  { name: "Midtown", msa: "Atlanta", jedi: 88, rent: "$2,056", rentD: "+4.8%", vac: "5.1%", pipe: "12.4%", opp: 82, cap: "4.8%", isSub: true },
  { name: "Buckhead", msa: "Atlanta", jedi: 84, rent: "$1,883", rentD: "+2.1%", vac: "6.2%", pipe: "8.8%", opp: 78, cap: "5.0%" },
  { name: "Sandy Springs", msa: "Atlanta", jedi: 81, rent: "$1,920", rentD: "+3.4%", vac: "5.8%", pipe: "10.2%", opp: 74, cap: "5.2%" },
  { name: "Decatur", msa: "Atlanta", jedi: 83, rent: "$1,890", rentD: "+3.8%", vac: "4.8%", pipe: "5.4%", opp: 84, cap: "5.0%" },
  { name: "West End", msa: "Atlanta", jedi: 79, rent: "$1,977", rentD: "+5.2%", vac: "6.8%", pipe: "6.2%", opp: 86, cap: "5.4%" },
  { name: "Downtown", msa: "Atlanta", jedi: 76, rent: "$1,542", rentD: "+2.8%", vac: "7.2%", pipe: "14.8%", opp: 68, cap: "5.6%" },
];

const MSA_OPTIONS = [
  { id: "atlanta-ga", name: "Atlanta, GA" },
  { id: "raleigh-nc", name: "Raleigh, NC" },
  { id: "charlotte-nc", name: "Charlotte, NC" },
  { id: "tampa-fl", name: "Tampa, FL" },
  { id: "orlando-fl", name: "Orlando, FL" },
  { id: "miami-fl", name: "Miami, FL" },
  { id: "jacksonville-fl", name: "Jacksonville, FL" },
];

function MSAOverview({ onDrillToSubmarket }: { onDrillToSubmarket: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.borderS, flex: 1, overflow: "auto" }}>
      <div style={{ background: C.panel, padding: "12px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: C.amber, marginBottom: 6, ...mono }}>MARKET PRIMER · ATLANTA MSA</div>
        <p style={{ fontSize: 11, color: C.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          Atlanta is a <span style={{ color: C.primary, fontWeight: 600 }}>6.2M-person MSA</span> tracking <span style={{ color: C.cyan }}>{MSA.props.toLocaleString()} properties</span> and <span style={{ color: C.cyan }}>{MSA.units} units</span> across 8 submarkets.
          The market is in <span style={{ color: C.green }}>month 38 of an expansion cycle</span> — employment growing <span style={{ color: C.green }}>+2.8% YoY</span> (14th consecutive positive month), population <span style={{ color: C.green }}>+2.1%</span> (3x national avg), and median household income <span style={{ color: C.green }}>+3.4%</span>.
          Average effective rent reached <span style={{ color: C.green }}>$2,150/mo (+4.2% YoY)</span> with vacancy tightening to <span style={{ color: C.green }}>5.8%</span> — a 3-year low.
          <span style={{ color: C.orange }}> Primary risk: </span> supply pipeline is elevated at <span style={{ color: C.orange }}>15.8% of existing stock</span> ({MSA.pipeline} units), translating to <span style={{ color: C.orange }}>14.1 months of supply</span> at current absorption.
          However, absorption remains strong at <span style={{ color: C.green }}>2,840 units/quarter</span> and permit velocity is decelerating — suggesting past-peak supply.
          <span style={{ color: C.amber }}> Affordability watch: </span> rent-to-income at 30.2%, approaching the 30% burdened threshold. Rent growth (+4.2%) is outpacing wage growth (+3.4%) for 2 consecutive quarters.
          Platform JEDI Score: <span style={{ color: C.green, fontWeight: 600 }}>87 (+4 over 30d)</span> — Strong Opportunity. Best submarkets: Midtown (88), Decatur (83), Buckhead (84).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <div style={{ background: C.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.muted, ...mono }}>AVG RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((p,i) => <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 0 ? C.amber : "transparent", color: i === 0 ? C.bg : C.muted, ...mono, cursor: "pointer" }}>{p}</span>)}
            </div>
          </div>
          <MiniChart data={MSA_RENT} color={C.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${C.borderS}`, paddingTop: 6 }}>
            {[
              { l: "Current Avg Rent", v: MSA.rent }, { l: "Rent Growth YoY", v: MSA.rentD, c: C.green },
              { l: "Avg Rent/SF", v: "$1.92" }, { l: "vs National Avg", v: "+12.4%", c: C.green },
              { l: "Concession Rate", v: "2.4%" }, { l: "RevPAU (Market)", v: "$1,986" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: C.muted, ...mono }}>{m.l}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.cyan, ...mono }}>SUPPLY-DEMAND BALANCE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Vacancy Rate", v: MSA.vac, c: C.green, spark: MSA_VAC as number[] | undefined }, { l: "Net Absorption", v: MSA.absorb },
              { l: "Pipeline Units", v: MSA.pipeline }, { l: "Pipeline %", v: MSA.pipelinePct, c: C.orange },
              { l: "Months of Supply", v: MSA.moSupply, c: C.orange }, { l: "Permit Velocity", v: "-8.2% YoY", c: C.green },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {m.spark && <Spark data={m.spark} color={m.c || C.green} />}
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.amber, ...mono }}>TRANSACTION ACTIVITY</span>
            <div style={{ marginTop: 4 }}>
              {[
                { l: "Avg Cap Rate", v: MSA.cap }, { l: "Cap Δ YoY", v: MSA.capD, c: C.green },
                { l: "Avg $/Unit", v: MSA.ppu }, { l: "$/Unit Δ YoY", v: MSA.ppuD, c: C.green },
                { l: "Txn Volume (12mo)", v: "$4.2B" }, { l: "Deals Closed", v: "127" },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.borderS}` }}>
                  <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: C.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.muted, ...mono }}>ECONOMIC PROFILE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Population", v: MSA.pop }, { l: "Pop Growth", v: MSA.popD, c: C.green },
              { l: "Employment", v: MSA.jobs }, { l: "Job Growth", v: MSA.jobsD, c: C.green },
              { l: "Median HH Income", v: MSA.medInc }, { l: "Income Growth", v: MSA.incD, c: C.green },
              { l: "Rent/Income Ratio", v: MSA.afford, c: C.orange }, { l: "Jobs/Apt Ratio", v: "5.8x" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.purple, ...mono }}>CYCLE POSITION</span>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={MSA.cycle} color={C.green} />
              <span style={{ fontSize: 9, color: C.secondary, ...mono }}>Month {MSA.cycleMonth}</span>
            </div>
            <div style={{ marginTop: 6, height: 6, background: C.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: "65%", height: "100%", background: `linear-gradient(90deg, ${C.green}, ${C.amber})`, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              {["Trough","Expansion","Peak","Contraction"].map((l,i) => <span key={i} style={{ fontSize: 7, color: C.muted, ...mono }}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: C.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1.5, ...mono }}>MARKET JEDI</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${C.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{MSA.jedi}</span>
            <span style={{ fontSize: 8, color: C.green, fontWeight: 600, ...mono }}>{MSA.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: C.muted, ...mono }}>Conf: {MSA.confidence}%</span>
        </div>
        <div style={{ background: C.panel, padding: 12 }}>
          {MSA_SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: C.muted, minWidth: 78, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 120px", height: 5, background: C.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? C.green : s.score >= 50 ? C.amber : C.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: C.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ background: C.panel, padding: "8px 12px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onDrillToSubmarket} style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: C.bg, background: C.amber, border: "none", padding: "4px 12px", cursor: "pointer" }}>DRILL TO SUBMARKETS ▸</button>
        </div>
      </div>
    </div>
  );
}

function SubmarketOverview({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.borderS, flex: 1, overflow: "auto" }}>
      <div style={{ background: C.panel, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 9, letterSpacing: 2, color: C.amber, ...mono }}>SUBMARKET PRIMER · MIDTOWN, ATLANTA</span>
          <button onClick={onBack} style={{ ...mono, fontSize: 8, fontWeight: 700, letterSpacing: 1, color: C.amber, background: "transparent", border: `1px solid ${C.amber}44`, padding: "3px 10px", cursor: "pointer" }}>◂ BACK TO MSA</button>
        </div>
        <p style={{ fontSize: 11, color: C.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          Midtown is Atlanta's <span style={{ color: C.primary, fontWeight: 600 }}>premier multifamily submarket</span> with <span style={{ color: C.cyan }}>52 properties</span> totaling <span style={{ color: C.cyan }}>14,856 units</span>.
          The submarket sits at the center of Atlanta's tech corridor with a <span style={{ color: C.green }}>walk score of 92</span> and direct Piedmont Park adjacency — commanding the MSA's highest rents at <span style={{ color: C.green }}>$2,056/mo (+4.8% YoY)</span>, the fastest growth rate in the metro.
          Vacancy at <span style={{ color: C.green }}>5.1%</span> is the tightest in the MSA, and absorption at <span style={{ color: C.green }}>3.2%/quarter</span> is outpacing new deliveries.
          <span style={{ color: C.orange }}> Supply watch: </span> 1,840 pipeline units (12.4% of stock) with Midtown Union Phase II (380 units) delivering Q3 2026 as the largest single project.
          Buyer/seller pressure is firmly <span style={{ color: C.green }}>BUYER-dominated</span> — institutional capital is competing aggressively, compressing cap rates to <span style={{ color: C.primary }}>4.8% (-15bps YoY)</span>.
          The top-ranked property is <span style={{ color: C.amberBright }}>The Metropolitan (PCS 94)</span>. The lowest is <span style={{ color: C.red }}>Midtown Terrace (PCS 42)</span> — a potential <span style={{ color: C.green }}>acquisition target</span> underperforming its vantage group.
          Opportunity Score: <span style={{ color: C.green, fontWeight: 600 }}>82/100</span>. The combination of tight vacancy, accelerating rents, and institutional demand makes this the MSA's strongest deployment submarket.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <div style={{ background: C.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.muted, ...mono }}>SUBMARKET RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((p,i) => <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 0 ? C.amber : "transparent", color: i === 0 ? C.bg : C.muted, ...mono, cursor: "pointer" }}>{p}</span>)}
            </div>
          </div>
          <MiniChart data={SUB_RENT} color={C.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${C.borderS}`, paddingTop: 6 }}>
            {[
              { l: "Avg Rent", v: SUB.rent }, { l: "Rent Growth YoY", v: SUB.rentD, c: C.green },
              { l: "Rent/SF", v: SUB.rentSf }, { l: "vs MSA Avg", v: "+$106 (+5.4%)", c: C.green },
              { l: "RevPAU", v: "$1,951" }, { l: "Concession Rate", v: "1.8%" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: C.muted, ...mono }}>{m.l}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.cyan, ...mono }}>SUPPLY-DEMAND</span>
          <div style={{ marginTop: 6 }}>
            {[
              { l: "Vacancy", v: SUB.vac, c: C.green }, { l: "Absorption", v: SUB.absorb },
              { l: "Absorption (units)", v: SUB.absorbUnits }, { l: "Pipeline Units", v: SUB.pipeline },
              { l: "Pipeline %", v: SUB.pipelinePct, c: C.orange }, { l: "Months Supply", v: SUB.moSupply, c: C.orange },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.amber, ...mono }}>TRANSACTIONS</span>
            <div style={{ marginTop: 4 }}>
              {[
                { l: "Avg Cap Rate", v: SUB.cap }, { l: "Cap Δ", v: SUB.capD, c: C.green },
                { l: "Avg $/Unit", v: SUB.ppu }, { l: "$/Unit Δ", v: SUB.ppuD, c: C.green },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.borderS}` }}>
                  <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: C.muted, ...mono }}>Pressure:</span>
              <PressureBadge p={SUB.pressure} />
            </div>
          </div>
        </div>

        <div style={{ background: C.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.muted, ...mono }}>DEMOGRAPHICS</span>
          <div style={{ marginTop: 6 }}>
            {[
              { l: "Population", v: SUB.pop }, { l: "Pop Growth", v: SUB.popD, c: C.green },
              { l: "Employment", v: SUB.jobs }, { l: "Job Growth", v: SUB.jobsD, c: C.green },
              { l: "Med. HH Income", v: SUB.medInc }, { l: "Affordability", v: SUB.afford, c: C.green },
              { l: "Avg Review", v: `${SUB.review}/5 (${SUB.reviewCt} reviews)` },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || C.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: C.purple, ...mono }}>POWER RANKINGS</span>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>Top Property</span>
                <span style={{ fontSize: 9, color: C.green, fontWeight: 600, ...mono }}>{SUB.topProp} (PCS {SUB.topPCS})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>Bottom Property</span>
                <span style={{ fontSize: 9, color: C.red, fontWeight: 600, ...mono }}>{SUB.botProp} (PCS {SUB.botPCS})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 9, color: C.secondary, ...sans }}>Opp Score</span>
                <ScoreCell value={SUB.opp} size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: C.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: 1.5, ...mono }}>SUBMARKET JEDI</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${C.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.green }}>{SUB.jedi}</span>
            <span style={{ fontSize: 8, color: C.green, fontWeight: 600, ...mono }}>{SUB.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: C.muted, ...mono }}>Conf: {SUB.confidence}%</span>
        </div>
        <div style={{ background: C.panel, padding: 12 }}>
          {SUB_SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: C.muted, minWidth: 78, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 120px", height: 5, background: C.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? C.green : s.score >= 50 ? C.amber : C.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: C.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.panel }}>
        <div style={{ padding: "6px 12px", borderBottom: `1px solid ${C.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: C.muted, ...mono }}>PEER COMPARISON · SUBMARKETS IN MSA</span>
        </div>
        <div style={{ display: "flex", background: C.header, borderBottom: `1px solid ${C.borderM}` }}>
          {[{ l: "Submarket", w: 110 },{ l: "JEDI", w: 44 },{ l: "Rent", w: 60 },{ l: "Rent Δ", w: 48 },{ l: "Vac", w: 44 },{ l: "Pipe %", w: 48 },{ l: "Opp", w: 40 },{ l: "Cap", w: 40 }].map((c,i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: C.muted, letterSpacing: 0.5, borderRight: `1px solid ${C.borderS}`, ...mono }}>{c.l}</div>
          ))}
        </div>
        {SUB_COMPS.map((c,i) => (
          <div key={i} style={{ display: "flex", background: c.isSub ? C.amber + "0A" : i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, borderLeft: c.isSub ? `2px solid ${C.amber}` : "2px solid transparent", cursor: "pointer" }}
            onMouseEnter={e => { if (!c.isSub) (e.currentTarget as HTMLDivElement).style.background = C.hover; }}
            onMouseLeave={e => { if (!c.isSub) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}>
            <div style={{ width: 110, minWidth: 110, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}>
              <span style={{ fontSize: 9, fontWeight: c.isSub ? 700 : 500, color: c.isSub ? C.amberBright : C.primary, ...sans }}>{c.name}</span>
            </div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><ScoreCell value={c.jedi} /></div>
            <div style={{ width: 60, minWidth: 60, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><span style={{ fontSize: 10, fontWeight: 600, color: C.primary, ...mono }}>{c.rent}</span></div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><DeltaCell value={c.rentD} /></div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><ThresholdVal value={c.vac} thresholds={[5,8]} invert /></div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><ThresholdVal value={c.pipe} thresholds={[8,12]} invert /></div>
            <div style={{ width: 40, minWidth: 40, padding: "4px 6px", borderRight: `1px solid ${C.borderS}` }}><ScoreCell value={c.opp} size={9} /></div>
            <div style={{ width: 40, minWidth: 40, padding: "4px 6px" }}><span style={{ fontSize: 9, color: C.secondary, ...mono }}>{c.cap}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface F4MarketsViewProps {
  corpHealthData?: CorpHealthData;
}

type F4Level = "msa" | "submarket" | "detail" | "peers";

export default function F4MarketsView({ corpHealthData }: F4MarketsViewProps) {
  const [level, setLevel] = useState<F4Level>("msa");
  const [selectedMsaId, setSelectedMsaId] = useState("atlanta-ga");

  const isSubmarket = level === "submarket";
  const lvl = isSubmarket ? SUB : MSA;

  return (
    <div style={{ flex: 1, overflow: "hidden", animation: "fadeIn 0.15s", display: "flex", flexDirection: "column", background: C.bg, color: C.primary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 10px", height: 28, background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
        {[
          { id: "msa" as F4Level, label: "MSA · Atlanta, GA", icon: "INDEX" },
          { id: "submarket" as F4Level, label: "Submarket · Midtown", icon: "SECTOR" },
        ].map(l => (
          <button key={l.id} onClick={() => setLevel(l.id)} style={{
            ...mono, fontSize: 9, fontWeight: 600, padding: "0 12px", height: 24, cursor: "pointer",
            background: level === l.id ? C.amber : "transparent",
            color: level === l.id ? C.bg : C.secondary,
            border: level === l.id ? "none" : `1px solid ${C.borderS}`,
          }}>
            <span style={{ fontSize: 7, opacity: 0.7, marginRight: 4 }}>{l.icon}</span>
            {l.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {(level === "detail" || level === "peers") && (
          <div style={{ display: "flex", gap: 2 }}>
            {([["detail","MARKET DETAIL"],["peers","PEER COMP"]] as [F4Level, string][]).map(([v,label]) => (
              <button key={v} onClick={() => setLevel(v)} style={{ background: level === v ? C.active : "transparent", color: level === v ? C.amber : C.secondary, border: `1px solid ${level === v ? C.amber : C.borderS}`, fontSize: 8, ...mono, fontWeight: level === v ? 700 : 400, padding: "2px 8px", cursor: "pointer", letterSpacing: 0.5 }}>
                {label}
              </button>
            ))}
          </div>
        )}
        {(level === "msa" || level === "submarket") && (
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => setLevel("detail")} style={{ ...mono, fontSize: 8, fontWeight: 600, background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}44`, padding: "2px 8px", cursor: "pointer", letterSpacing: 0.5 }}>
              FULL INTEL →
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "4px 10px", background: isSubmarket ? C.purple + "15" : C.blueBg, borderBottom: `1px solid ${C.borderM}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {isSubmarket && <span onClick={() => setLevel("msa")} style={{ fontSize: 8, color: C.cyan, cursor: "pointer", ...mono }}>◀ Atlanta, GA</span>}
        <span style={{ fontSize: 14, fontWeight: 800, color: C.amberBright, ...sans }}>{lvl.name}</span>
        <span style={{ fontSize: 10, color: C.secondary, ...sans }}>{isSubmarket ? "Submarket Intelligence" : "Market Intelligence Dashboard"}</span>
        <span style={{ fontSize: 8, color: C.muted }}>|</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.green, ...mono }}>{lvl.rent}</span>
        <DeltaCell value={lvl.rentD} />
        <span style={{ fontSize: 8, color: C.muted }}>|</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>Vac</span>
        <ThresholdVal value={lvl.vac} thresholds={[5,8]} invert />
        <span style={{ fontSize: 8, color: C.muted }}>|</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>JEDI</span>
        <ScoreCell value={lvl.jedi} size={12} />
        <DeltaCell value={lvl.d30} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: C.green, display: "flex", alignItems: "center", gap: 3, ...mono }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.green, display: "inline-block" }} />
          {lvl.props} Properties · {lvl.units} Units
        </span>
      </div>

      {(level === "detail" || level === "peers") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px", height: 28, background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => setLevel("msa")} style={{ ...mono, fontSize: 8, fontWeight: 600, background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}44`, padding: "2px 8px", cursor: "pointer", letterSpacing: 0.5 }}>← OVERVIEW</button>
          <span style={{ fontSize: 9, color: C.muted, ...mono, letterSpacing: 1 }}>MARKET</span>
          <select
            value={selectedMsaId}
            onChange={e => setSelectedMsaId(e.target.value)}
            style={{ background: C.panel, color: C.amber, border: `1px solid ${C.borderM}`, fontSize: 10, ...mono, fontWeight: 700, padding: "2px 6px", cursor: "pointer", outline: "none" }}
          >
            {MSA_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {level === "msa" && <MSAOverview onDrillToSubmarket={() => setLevel("submarket")} />}
        {level === "submarket" && <SubmarketOverview onBack={() => setLevel("msa")} />}
        {level === "detail" && (
          <BloombergMarketDetail embedded marketId={selectedMsaId} corpHealthData={corpHealthData} />
        )}
        {level === "peers" && (
          <PeerComparisonPage embedded onViewDetail={() => setLevel("detail")} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: C.topBar, borderTop: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>Sources: Apartment Locator AI · Census ACS · BLS QCEW · County Permits · Google Places</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>{lvl.name} · JEDI {lvl.jedi} · {isSubmarket ? "Submarket" : "MSA"} Level</span>
      </div>
    </div>
  );
}
