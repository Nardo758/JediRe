import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// JEDI RE — DEAL CAPSULE BLOOMBERG TERMINAL
// All 12 Deal Context F-key pages fully built out
// Transforms DealStub placeholders into data-dense layouts
// ═══════════════════════════════════════════════════════════════

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF",teal:"#00E5A0" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes glowR{0%,100%{box-shadow:0 0 4px #FF475744}50%{box-shadow:0 0 10px #FF475766}}
@keyframes flash{0%{background:transparent}15%{background:#F5A62322}100%{background:transparent}}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes fillBar{from{width:0}to{width:var(--target-width)}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348}
`;

// ─── DEAL DATA ──────────────────────────────────────────────
const DEAL = {
  id:1,name:"Westshore Commons",addr:"4201 W Boy Scout Blvd, Tampa FL 33607",market:"Tampa, FL",sub:"Westshore",score:82,delta:"+4",strat:"BTS",irr:"24.3%",em:"2.8x",units:248,price:"$38.5M",ppu:"$155K",stage:"DD",days:23,risk:"LOW",rs:32,trend:[72,74,73,76,78,77,79,80,82],lat:27.95,lng:-82.52,
  acreage:14.2,lotSqFt:618552,yearBuilt:null,dealType:"Development",
};

const DEAL_NAV = [
  {key:"F1",label:"OVERVIEW",m:"M01"},{key:"F2",label:"PROPERTY",m:"M02"},{key:"F3",label:"MARKET",m:"M05"},
  {key:"F4",label:"SUPPLY",m:"M04"},{key:"F5",label:"STRATEGY",m:"M08"},{key:"F6",label:"PROFORMA",m:"M09"},
  {key:"F7",label:"CAPITAL",m:"M11"},{key:"F8",label:"RISK",m:"M14"},{key:"F9",label:"COMPS",m:"M15"},
  {key:"F10",label:"TRAFFIC",m:"M07"},{key:"F11",label:"DOCS",m:"M18"},{key:"F12",label:"EXIT",m:"M20"},
];

// ─── UTILITY COMPONENTS ──────────────────────────────────────

function Spark({ data, color = T.text.green, w = 56, h = 16 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return (<svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>);
}

function Bd({ children, c, bg, b }) {
  return (<span style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: 700, color: c, background: bg || c + "18", border: `1px solid ${b || c + "33"}`, padding: "1px 5px", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>);
}

function StageBd({ stage }) {
  const m = { DD: T.text.cyan, LOI: T.text.amber, PROSPECT: T.text.secondary, LEAD: T.text.muted };
  return (<Bd c={m[stage] || T.text.muted}>{stage}</Bd>);
}

function StratBd({ s }) {
  return (<Bd c={T.text.purple}>{"^"} {s}</Bd>);
}

function RiskDot({ level }) {
  const c = level === "HIGH" ? T.text.red : level === "MED" ? T.text.orange : T.text.green;
  return (<span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 8, fontFamily: T.font.mono, fontWeight: 600, color: c }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: c, ...(level === "HIGH" ? { animation: "glowR 2s infinite" } : {}) }} />{level}</span>);
}

function PanelHeader({ title, subtitle, right, borderColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, borderTop: borderColor ? `2px solid ${borderColor}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.text.white, letterSpacing: 0.8 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 8, color: T.text.secondary }}>{subtitle}</span>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{right}</div>}
    </div>
  );
}

function MiniBar({ value, max = 100, color, label, showPct = true }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = color || (pct >= 75 ? T.text.green : pct >= 50 ? T.text.amber : T.text.red);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
      {label && <span style={{ fontSize: 7, color: T.text.muted, minWidth: 60, letterSpacing: 0.5 }}>{label}</span>}
      <div style={{ flex: 1, height: 4, background: T.bg.terminal, borderRadius: 1 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 1, transition: "width 0.6s ease" }} />
      </div>
      {showPct && <span style={{ fontSize: 8, fontWeight: 700, color: barColor, minWidth: 20, textAlign: "right" }}>{value}</span>}
    </div>
  );
}

function DataRow({ label, value, valueColor, sub, border = true }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", borderBottom: border ? `1px solid ${T.border.subtle}` : "none" }}>
      <span style={{ fontSize: 8, color: T.text.muted, letterSpacing: 0.5 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: valueColor || T.text.amber }}>{value}</span>
        {sub && <span style={{ fontSize: 7, color: T.text.secondary }}>{sub}</span>}
      </div>
    </div>
  );
}

function SectionPanel({ title, subtitle, borderColor, children }) {
  return (
    <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, borderTop: borderColor ? `2px solid ${borderColor}` : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.text.white, letterSpacing: 0.5 }}>{title}</span>
          {subtitle && <span style={{ fontSize: 7, color: T.text.secondary }}>{subtitle}</span>}
        </div>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function VerifiedLink({ source, code }) {
  return (
    <span style={{ fontSize: 7, color: T.text.teal, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>
      {source}{code && ` ${code}`} ✓
    </span>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────

export default function DealCapsuleBloomberg() {
  const [time, setTime] = useState(new Date());
  const [fkey, setFkey] = useState("F1");
  const [cmd, setCmd] = useState("");
  const [subTab, setSubTab] = useState(0);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const d = DEAL;
  const tickers = ["^ TAMPA CAP 5.2% (-15bps)", "* MIAMI ABS 94.7%", "v ORL PIPELINE +2400", "^ JAX EMPL +3.2%", "* FL HOME $412K", "^ RENT TPA +3.7%", "* FDOT I-275 148.2K", "v INS +18% YoY", "^ NOCATEE +42%", "* TPA JOBS #3"];

  // ═══════════════════════════════════════════════════════════
  // F1 — DEAL OVERVIEW (M01)
  // ═══════════════════════════════════════════════════════════
  const DealOverview = () => {
    const sc = d.score >= 80 ? T.text.green : d.score >= 65 ? T.text.amber : T.text.red;
    const signals = [{ l: "DEMAND", v: 88, w: "30%" }, { l: "SUPPLY", v: 72, w: "25%" }, { l: "MOMENTUM", v: 85, w: "20%" }, { l: "POSITION", v: 79, w: "15%" }, { l: "RISK", v: 81, w: "10%" }];
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 1, background: T.border.subtle }}>
          <div style={{ background: T.bg.panel, padding: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1.5, marginBottom: 6 }}>JEDI SCORE</div>
            <div style={{ width: 100, height: 100, borderRadius: "50%", border: `3px solid ${sc}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 20px ${sc}33` }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: sc }}>{d.score}</span>
              <span style={{ fontSize: 9, color: d.delta.startsWith("+") ? T.text.green : T.text.red, fontWeight: 600 }}>{d.delta} 30d</span>
            </div>
            <div style={{ fontSize: 8, color: T.text.muted, marginTop: 6 }}>Confidence: 87%</div>
            <Spark data={d.trend} color={sc} w={120} h={24} />
          </div>
          <div style={{ background: T.bg.panel, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 8 }}>5 MASTER SIGNALS</div>
            {signals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 8, color: T.text.muted, minWidth: 70, letterSpacing: 0.5 }}>{s.l} <span style={{ fontSize: 7 }}>({s.w})</span></span>
                <div style={{ flex: 1, height: 6, background: T.bg.terminal }}><div style={{ height: "100%", width: `${s.v}%`, background: s.v >= 80 ? T.text.green : s.v >= 60 ? T.text.amber : T.text.red }} /></div>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.v >= 80 ? T.text.green : s.v >= 60 ? T.text.amber : T.text.red, minWidth: 24 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.border.subtle }}>
          {[{ l: "BTS", v: 84, win: true }, { l: "FLIP", v: 58 }, { l: "RENTAL", v: 69 }, { l: "STR", v: 45 }].map((s, i) => (
            <div key={i} style={{ background: T.bg.panel, padding: 10, borderTop: s.win ? `2px solid ${T.text.amber}` : "2px solid transparent", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1 }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.win ? T.text.amber : T.text.secondary }}>{s.v}</div>
              {s.win && <Bd c={T.text.amber}>RECOMMENDED</Bd>}
            </div>
          ))}
        </div>
        <div style={{ padding: 8, background: T.text.amber + "08", borderLeft: `3px solid ${T.text.amber}`, margin: "1px 0" }}>
          <span style={{ fontSize: 9, color: T.text.amber, fontWeight: 600 }}>ARBITRAGE DETECTED:</span>
          <span style={{ fontSize: 9, color: T.text.secondary }}> BTS outscores Rental by 15pts. Zoning allows 3x density, supply pipeline thin for new construction.</span>
        </div>
        {/* AI Intelligence Brief */}
        <div style={{ background: T.bg.panel, margin: "1px 0", padding: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.text.cyan, letterSpacing: 0.8, marginBottom: 6 }}>AI INTELLIGENCE BRIEF</div>
          {[
            { cat: "DEMAND", msg: "Amazon 2,000-job HQ expansion confirmed 1.8mi away. Absorption 95.2% 2nd month. Population inflow accelerating.", c: T.text.green },
            { cat: "RISK", msg: "Insurance reform caps rate increases at 8%. Execution risk flagged: first dev in submarket. GC partnership mitigates.", c: T.text.orange },
            { cat: "ACTION", msg: "Accelerate LOI. BTS at 18 DU/ac captures zoning upside before 860-unit pipeline delivers Q1 2027.", c: T.text.amber },
          ].map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <Bd c={b.c}>{b.cat}</Bd>
              <span style={{ fontSize: 8, color: T.text.secondary, lineHeight: 1.4 }}>{b.msg}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F2 — PROPERTY & ZONING (M02)
  // ═══════════════════════════════════════════════════════════
  const DealProperty = () => {
    const tabs = ["BOUNDARY & ZONING", "DEV CAPACITY", "REGULATORY RISK", "ZONING COMP", "TIME-TO-SHOVEL"];
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s", display: "flex", flexDirection: "column" }}>
        <PanelHeader title="PROPERTY & ZONING" subtitle="M02 | Verification-First Model" borderColor={T.text.cyan} />
        {/* Sub-tabs */}
        <div style={{ display: "flex", background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, flexShrink: 0 }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setSubTab(i)} style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: 600, padding: "4px 10px", background: subTab === i ? T.text.cyan + "22" : "transparent", color: subTab === i ? T.text.cyan : T.text.muted, border: "none", borderBottom: subTab === i ? `2px solid ${T.text.cyan}` : "2px solid transparent", cursor: "pointer" }}>{t}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
          {/* Tab 0: Boundary & Zoning */}
          {subTab === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.border.subtle }}>
              {/* Left: Parcel Identity */}
              <div style={{ background: T.bg.panel }}>
                <SectionPanel title="PARCEL IDENTITY" subtitle="County Records" borderColor={T.text.teal}>
                  <DataRow label="PARCEL ID" value="A-08-29-19-5RY-000001-00001.0" />
                  <DataRow label="FOLIO" value="195286.0100" />
                  <DataRow label="LOT SIZE" value="14.2 ac" sub="618,552 SF" />
                  <DataRow label="FRONTAGE" value="420 ft" sub="Boy Scout Blvd" />
                  <DataRow label="DEPTH" value="1,472 ft" sub="avg" />
                  <DataRow label="SHAPE FACTOR" value="0.92" sub="near-rectangular" valueColor={T.text.green} />
                  <DataRow label="FLOOD ZONE" value="Zone X" sub="minimal risk" valueColor={T.text.green} />
                  <DataRow label="OWNER" value="WESTSHORE DEV LLC" />
                  <DataRow label="ACQUIRED" value="06/2019" sub="$18.2M" />
                  <DataRow label="ASSESSED" value="$22.4M" sub="2025" border={false} />
                </SectionPanel>
              </div>
              {/* Right: Zoning */}
              <div style={{ background: T.bg.panel }}>
                <SectionPanel title="ZONING DESIGNATION" subtitle="Verified Chain" borderColor={T.text.amber}>
                  <div style={{ padding: "6px 8px", background: T.text.amber + "08", borderBottom: `1px solid ${T.border.subtle}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.text.amber }}>PD-C</span>
                      <Bd c={T.text.green}>VERIFIED 10/10</Bd>
                    </div>
                    <div style={{ fontSize: 8, color: T.text.secondary, marginTop: 2 }}>Planned Development — Commercial</div>
                  </div>
                  <DataRow label="MAX DENSITY" value="18 DU/ac" sub="= 255 units" />
                  <DataRow label="MAX FAR" value="2.0" sub="= 1,237,104 SF" />
                  <DataRow label="MAX HEIGHT" value="65 ft" sub="~5 stories" />
                  <DataRow label="LOT COVERAGE" value="60%" sub="= 371,131 SF" />
                  <DataRow label="SETBACK FRONT" value="25 ft" />
                  <DataRow label="SETBACK SIDE" value="10 ft" />
                  <DataRow label="SETBACK REAR" value="20 ft" />
                  <DataRow label="PARKING REQ" value="1.5/unit" sub="= 383 spaces" />
                  <div style={{ padding: "4px 8px" }}>
                    <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1, marginBottom: 3 }}>SOURCE CHAIN</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {["Municode 27-156", "27-156.4(b)", "27-157", "27-158.2", "County GIS", "Planning Dept", "Comp Plan", "CRA Overlay", "FDOT Access", "Utilities"].map((s, i) => (
                        <VerifiedLink key={i} source={s} />
                      ))}
                    </div>
                  </div>
                </SectionPanel>
              </div>
              {/* Binding Constraints */}
              <div style={{ gridColumn: "1/-1", background: T.bg.panel }}>
                <SectionPanel title="BINDING CONSTRAINT ANALYSIS" subtitle="Simultaneous computation — minimum governs">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1, background: T.border.subtle }}>
                    {[
                      { constraint: "DENSITY", limit: "255 units", usage: "248", pct: 97, binding: true },
                      { constraint: "FAR", limit: "1.24M SF", usage: "842K SF", pct: 68, binding: false },
                      { constraint: "HEIGHT", limit: "65 ft", usage: "58 ft", pct: 89, binding: false },
                      { constraint: "COVERAGE", limit: "371K SF", usage: "298K SF", pct: 80, binding: false },
                      { constraint: "PARKING", limit: "383 req", usage: "396 built", pct: 103, binding: true },
                    ].map((c, i) => (
                      <div key={i} style={{ background: T.bg.panel, padding: 8, borderTop: c.binding ? `2px solid ${T.text.red}` : "2px solid transparent" }}>
                        <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1, marginBottom: 4 }}>{c.constraint}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.binding ? T.text.red : T.text.green }}>{c.pct}%</div>
                        <div style={{ fontSize: 8, color: T.text.secondary }}>{c.usage} / {c.limit}</div>
                        {c.binding && <Bd c={T.text.red}>BINDING</Bd>}
                        <div style={{ marginTop: 4 }}><MiniBar value={c.pct} color={c.pct >= 95 ? T.text.red : c.pct >= 80 ? T.text.amber : T.text.green} showPct={false} /></div>
                      </div>
                    ))}
                  </div>
                </SectionPanel>
              </div>
            </div>
          )}

          {/* Tab 1: Dev Capacity */}
          {subTab === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: T.border.subtle }}>
              {[
                { typology: "GARDEN (3-STORY)", units: 180, density: "12.7 DU/ac", gsf: "216,000", efficiency: "88%", parking: "Surface", cost: "$42M", timeline: "18mo", feasibility: 85 },
                { typology: "PODIUM 5-OVER-1", units: 248, density: "17.5 DU/ac", gsf: "298,000", efficiency: "82%", parking: "Podium 1-level", cost: "$62M", timeline: "24mo", feasibility: 92 },
                { typology: "WRAP (5-STORY)", units: 220, density: "15.5 DU/ac", gsf: "264,000", efficiency: "80%", parking: "Wrapped garage", cost: "$55M", timeline: "22mo", feasibility: 78 },
              ].map((typ, i) => (
                <div key={i} style={{ background: T.bg.panel, borderTop: typ.feasibility >= 90 ? `2px solid ${T.text.amber}` : "2px solid transparent" }}>
                  <div style={{ padding: "8px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: typ.feasibility >= 90 ? T.text.amber : T.text.secondary, letterSpacing: 0.8 }}>{typ.typology}</div>
                    {typ.feasibility >= 90 && <Bd c={T.text.amber}>BEST FIT</Bd>}
                  </div>
                  <div style={{ padding: 8 }}>
                    <DataRow label="UNITS" value={typ.units} />
                    <DataRow label="DENSITY" value={typ.density} />
                    <DataRow label="GSF" value={typ.gsf} />
                    <DataRow label="EFFICIENCY" value={typ.efficiency} />
                    <DataRow label="PARKING" value={typ.parking} />
                    <DataRow label="EST. COST" value={typ.cost} valueColor={T.text.amber} />
                    <DataRow label="TIMELINE" value={typ.timeline} />
                    <div style={{ padding: "6px 8px" }}>
                      <MiniBar value={typ.feasibility} label="FEASIBILITY" color={typ.feasibility >= 90 ? T.text.green : typ.feasibility >= 75 ? T.text.amber : T.text.red} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Regulatory Risk */}
          {subTab === 2 && (
            <div style={{ padding: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.border.subtle }}>
                {[
                  { risk: "CONCURRENCY", score: 22, status: "PASS", detail: "Water, sewer, drainage capacity verified. Traffic concurrency pending FDOT review.", source: "Municode 27-205" },
                  { risk: "ENVIRONMENTAL", score: 18, status: "PASS", detail: "Phase I ESA clean. No wetlands. No endangered species habitat. NPDES required.", source: "DEP Records" },
                  { risk: "HISTORIC OVERLAY", score: 0, status: "N/A", detail: "Property not in historic district. No structures on National Register.", source: "SHPO Database" },
                  { risk: "TREE PRESERVATION", score: 35, status: "CAUTION", detail: "14 specimen oaks >24\" DBH. Mitigation plan required, est. $180K.", source: "City Arborist" },
                  { risk: "IMPACT FEES", score: 15, status: "KNOWN", detail: "Transportation: $2,841/unit. Parks: $1,200/unit. Schools: $3,456/unit. Total: $1.86M.", source: "Fee Schedule 2026" },
                  { risk: "MORATORIUM", score: 0, status: "CLEAR", detail: "No active development moratorium in Westshore subarea. Last moratorium expired 2023.", source: "City Council" },
                ].map((r, i) => (
                  <div key={i} style={{ background: T.bg.panel, padding: 8, borderLeft: `3px solid ${r.score >= 30 ? T.text.orange : r.score > 0 ? T.text.green : T.text.muted}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.text.white }}>{r.risk}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Bd c={r.score >= 30 ? T.text.orange : r.score > 0 ? T.text.green : T.text.muted}>{r.status}</Bd>
                        <span style={{ fontSize: 10, fontWeight: 800, color: r.score >= 30 ? T.text.orange : T.text.green }}>{r.score}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 8, color: T.text.secondary, lineHeight: 1.4, marginBottom: 3 }}>{r.detail}</div>
                    <VerifiedLink source={r.source} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Zoning Comparator */}
          {subTab === 3 && (
            <div style={{ padding: 1 }}>
              <div style={{ fontSize: 8, color: T.text.muted, padding: "6px 10px", background: T.bg.header }}>Comparing zoning within 2-mile radius — what else could be built nearby?</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr repeat(4, 1fr)", gap: 0 }}>
                {/* Header row */}
                {["PARAMETER", "PD-C (SUBJECT)", "RM-24", "CI", "PD-A"].map((h, i) => (
                  <div key={i} style={{ padding: "4px 8px", fontSize: 7, fontWeight: 700, color: i === 1 ? T.text.amber : T.text.muted, letterSpacing: 0.5, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
                ))}
                {[
                  { p: "MAX DENSITY", vals: ["18 DU/ac", "24 DU/ac", "N/A", "12 DU/ac"] },
                  { p: "MAX HEIGHT", vals: ["65 ft", "75 ft", "45 ft", "45 ft"] },
                  { p: "FAR", vals: ["2.0", "2.5", "1.5", "1.0"] },
                  { p: "PARKING REQ", vals: ["1.5/unit", "1.25/unit", "3.0/1K SF", "2.0/unit"] },
                  { p: "SETBACK FRONT", vals: ["25 ft", "20 ft", "30 ft", "30 ft"] },
                  { p: "RESIDENTIAL", vals: ["YES", "YES", "NO", "YES"] },
                ].map((row, ri) => (
                  [row.p, ...row.vals].map((cell, ci) => (
                    <div key={`${ri}-${ci}`} style={{ padding: "4px 8px", fontSize: 8, fontWeight: ci === 0 ? 600 : (ci === 1 ? 700 : 400), color: ci === 0 ? T.text.muted : (ci === 1 ? T.text.amber : T.text.secondary), background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`, borderRight: `1px solid ${T.border.subtle}` }}>
                      {cell}
                    </div>
                  ))
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Time-to-Shovel */}
          {subTab === 4 && (
            <div style={{ padding: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {[
                  { phase: "PRE-APPLICATION", duration: "2-4 wk", status: "COMPLETE", pct: 100, detail: "Pre-app meeting held 2/15. No red flags." },
                  { phase: "SITE PLAN REVIEW", duration: "8-12 wk", status: "IN PROGRESS", pct: 40, detail: "Submitted 2/28. DRC review cycle 1 expected 4/1." },
                  { phase: "ZONING COMPLIANCE", duration: "2-4 wk", status: "PENDING", pct: 0, detail: "Conditional on site plan approval. PD-C conditions attached." },
                  { phase: "BUILDING PERMIT", duration: "4-8 wk", status: "PENDING", pct: 0, detail: "Structural drawings 60% complete. MEP pending." },
                  { phase: "UTILITY CONNECT", duration: "4-6 wk", status: "PENDING", pct: 0, detail: "Water/sewer capacity letter obtained. Connection pending." },
                  { phase: "CLEAR TO BUILD", duration: "—", status: "EST. Q4 2026", pct: 0, detail: "Monte Carlo p50: 10mo from today. p90: 14mo." },
                ].map((ph, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 0, background: T.bg.panel }}>
                    <div style={{ width: 160, padding: "8px 10px", borderRight: `1px solid ${T.border.subtle}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: ph.status === "COMPLETE" ? T.text.green : ph.status === "IN PROGRESS" ? T.text.amber : T.text.muted }}>{ph.phase}</div>
                      <div style={{ fontSize: 7, color: T.text.secondary, marginTop: 1 }}>{ph.duration}</div>
                    </div>
                    <div style={{ width: 90, padding: "0 8px" }}><Bd c={ph.status === "COMPLETE" ? T.text.green : ph.status === "IN PROGRESS" ? T.text.amber : T.text.muted}>{ph.status}</Bd></div>
                    <div style={{ width: 80, padding: "0 8px" }}><MiniBar value={ph.pct} showPct={true} color={ph.pct === 100 ? T.text.green : ph.pct > 0 ? T.text.amber : T.text.muted} /></div>
                    <div style={{ flex: 1, padding: "4px 8px", fontSize: 8, color: T.text.secondary }}>{ph.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F3 — MARKET & DEMAND (M05 + M06)
  // ═══════════════════════════════════════════════════════════
  const DealMarket = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="MARKET & DEMAND INTELLIGENCE" subtitle="M05+M06 | Trade Area Analysis" borderColor={T.text.green} />
        {/* KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: T.border.subtle }}>
          {[
            { l: "AVG EFF. RENT", v: "$1,908", sub: "/mo", chg: "+3.0%", dir: "up", data: [1780,1800,1820,1840,1860,1880,1890,1900,1908] },
            { l: "VACANCY", v: "8.5%", sub: "", chg: "-0.8%", dir: "down", data: [10.2,9.8,9.5,9.3,9.1,9.0,8.8,8.6,8.5] },
            { l: "ABSORPTION", v: "95.2%", sub: "", chg: "+1.4%", dir: "up", data: [90,91,92,92,93,93,94,95,95.2] },
            { l: "POP GROWTH", v: "+2.1%", sub: "YoY", chg: "Accelerating", dir: "up", data: [1.2,1.4,1.5,1.6,1.7,1.8,1.9,2.0,2.1] },
            { l: "DEMAND SCORE", v: "88", sub: "/100", chg: "+3 30d", dir: "up", data: [78,80,82,83,84,85,86,87,88] },
          ].map((m, i) => (
            <div key={i} style={{ background: T.bg.panel, padding: "8px 10px" }}>
              <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1, fontWeight: 600 }}>{m.l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: T.text.amber }}>{m.v}</span>
                <span style={{ fontSize: 8, color: T.text.secondary }}>{m.sub}</span>
              </div>
              <div style={{ fontSize: 8, fontWeight: 600, color: m.dir === "up" ? T.text.green : m.dir === "down" ? T.text.green : T.text.secondary, marginTop: 1 }}>{m.chg}</div>
              <Spark data={m.data} color={m.dir === "up" ? T.text.green : T.text.amber} w={80} h={14} />
            </div>
          ))}
        </div>
        {/* Two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.border.subtle, marginTop: 1 }}>
          {/* Demand Drivers */}
          <SectionPanel title="DEMAND DRIVERS" subtitle="3-mile trade area" borderColor={T.text.green}>
            {[
              { driver: "EMPLOYMENT", impact: "+3.2% YoY", score: 91, detail: "Amazon HQ +2,000 jobs. MacDill AFB stable 15K. Healthcare corridor expanding.", icon: "▲" },
              { driver: "POPULATION", impact: "+2.1% YoY", score: 85, detail: "42,000 residents. Net domestic migration +1,400/yr. Median age 34.", icon: "▲" },
              { driver: "HOUSEHOLD INCOME", impact: "$78,200 avg", score: 78, detail: "Renter pct 58%. Income-to-rent ratio 3.4x. Growing professional class.", icon: "►" },
              { driver: "INFRASTRUCTURE", impact: "BRT funded", score: 72, detail: "Colonial Dr BRT Phase 1. Selmon Extension. Howard Frankland replacement.", icon: "▲" },
            ].map((drv, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 8px", borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ minWidth: 28, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: drv.score >= 85 ? T.text.green : drv.score >= 70 ? T.text.amber : T.text.red }}>{drv.score}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: T.text.primary }}>{drv.driver}</span>
                    <span style={{ fontSize: 8, fontWeight: 600, color: T.text.green }}>{drv.impact}</span>
                  </div>
                  <div style={{ fontSize: 8, color: T.text.secondary, lineHeight: 1.4, marginTop: 2 }}>{drv.detail}</div>
                </div>
              </div>
            ))}
          </SectionPanel>
          {/* Rent Comps */}
          <SectionPanel title="RENT COMP MATRIX" subtitle="Apartments.com + RentCast" borderColor={T.text.amber}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.7fr 0.7fr 0.7fr 0.7fr", gap: 0 }}>
              {["PROPERTY", "STUDIO", "1BR", "2BR", "3BR"].map((h, i) => (
                <div key={i} style={{ padding: "3px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
              ))}
              {[
                { name: "Camden Westshore", vals: ["$1,650", "$1,890", "$2,240", "$2,680"] },
                { name: "MAA Westshore", vals: ["$1,580", "$1,820", "$2,150", "—"] },
                { name: "Channelside Apts", vals: ["$1,720", "$1,950", "$2,310", "$2,750"] },
                { name: "Post Harbour Place", vals: ["$1,480", "$1,710", "$2,050", "—"] },
                { name: "SUBMARKET AVG", vals: ["$1,608", "$1,843", "$2,188", "$2,715"], bold: true },
              ].map((r, ri) => (
                [r.name, ...r.vals].map((cell, ci) => (
                  <div key={`${ri}-${ci}`} style={{ padding: "3px 6px", fontSize: ci === 0 ? 8 : 9, fontWeight: r.bold ? 700 : (ci === 0 ? 500 : 600), color: r.bold ? T.text.amber : (ci === 0 ? T.text.primary : T.text.secondary), background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`, borderRight: `1px solid ${T.border.subtle}` }}>
                    {cell}
                  </div>
                ))
              ))}
            </div>
          </SectionPanel>
        </div>
        {/* Demand Events Feed */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 8 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.text.cyan, letterSpacing: 1, marginBottom: 4 }}>DEMAND EVENT FEED</div>
          {[
            { time: "2d", event: "Amazon announces 2,000-job Tampa HQ expansion", impact: "+3.2 JEDI pts", type: "JOBS" },
            { time: "1w", event: "Nocatee named #2 top-selling MPC nationally", impact: "+2.4 JEDI pts", type: "DEMAND" },
            { time: "2w", event: "Tampa Bay absorption hits 95.2%, 2nd consecutive month", impact: "+1.1 JEDI pts", type: "MARKET" },
          ].map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
              <span style={{ fontSize: 7, color: T.text.muted, minWidth: 20 }}>{ev.time}</span>
              <Bd c={T.text.cyan}>{ev.type}</Bd>
              <span style={{ flex: 1, fontSize: 8, color: T.text.secondary }}>{ev.event}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: T.text.green }}>{ev.impact}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F4 — SUPPLY PIPELINE (M04)
  // ═══════════════════════════════════════════════════════════
  const DealSupply = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="SUPPLY PIPELINE INTELLIGENCE" subtitle="M04 | Trade Area + 5mi Radius" borderColor={T.text.orange} />
        {/* Threat Meter */}
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 1, background: T.border.subtle }}>
          <div style={{ background: T.bg.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1.5 }}>SUPPLY PRESSURE</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: T.text.amber, marginTop: 4 }}>4.2%</div>
            <div style={{ fontSize: 8, color: T.text.secondary }}>Pipeline-to-Stock</div>
            <Bd c={T.text.amber}>MODERATE</Bd>
            <div style={{ fontSize: 7, color: T.text.muted, marginTop: 6 }}>Threshold: 5.0%</div>
            <MiniBar value={42} max={100} color={T.text.amber} showPct={false} />
          </div>
          <div style={{ background: T.bg.panel, padding: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { l: "ACTIVE PIPELINE", v: "1,240", sub: "units", c: T.text.amber },
                { l: "EXISTING STOCK", v: "14,200", sub: "units", c: T.text.secondary },
                { l: "ANNUAL DEMAND", v: "1,680", sub: "units/yr", c: T.text.green },
                { l: "ABSORPTION RATE", v: "18", sub: "mo avg", c: T.text.cyan },
              ].map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 0.5 }}>{m.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.v}</div>
                  <div style={{ fontSize: 7, color: T.text.secondary }}>{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Pipeline Grid */}
        <div style={{ marginTop: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.5fr 0.7fr 0.6fr 0.6fr 0.7fr 0.5fr", gap: 0, background: T.bg.header }}>
            {["PROJECT", "UNITS", "DELIVERY", "DISTANCE", "SEGMENT", "DEVELOPER", "THREAT"].map((h, i) => (
              <div key={i} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, letterSpacing: 0.5, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
            ))}
          </div>
          {[
            { name: "Greystar Tower DT", units: 380, delivery: "Q3 2026", dist: "2.1 mi", seg: "LUXURY", dev: "Greystar", threat: "MED" },
            { name: "Altis Grand Central", units: 280, delivery: "Q1 2027", dist: "3.4 mi", seg: "CLASS A", dev: "Altman", threat: "HIGH" },
            { name: "NovaStar Westshore", units: 320, delivery: "Q1 2027", dist: "0.8 mi", seg: "CLASS A", dev: "NovaStar", threat: "HIGH" },
            { name: "Camden Preserve II", units: 160, delivery: "Q4 2027", dist: "4.2 mi", seg: "GARDEN", dev: "Camden", threat: "LOW" },
            { name: "Encore Phase 3", units: 100, delivery: "Q2 2027", dist: "5.0 mi", seg: "AFFORD", dev: "THA/Related", threat: "LOW" },
          ].map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.5fr 0.7fr 0.6fr 0.6fr 0.7fr 0.5fr", background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}` }}>
              <div style={{ padding: "4px 6px", fontSize: 9, fontWeight: 600, color: T.text.primary, borderRight: `1px solid ${T.border.subtle}` }}>{p.name}</div>
              <div style={{ padding: "4px 6px", fontSize: 9, fontWeight: 700, color: T.text.amber, borderRight: `1px solid ${T.border.subtle}` }}>{p.units}</div>
              <div style={{ padding: "4px 6px", fontSize: 8, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{p.delivery}</div>
              <div style={{ padding: "4px 6px", fontSize: 8, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{p.dist}</div>
              <div style={{ padding: "4px 6px", borderRight: `1px solid ${T.border.subtle}` }}><Bd c={T.text.cyan}>{p.seg}</Bd></div>
              <div style={{ padding: "4px 6px", fontSize: 8, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{p.dev}</div>
              <div style={{ padding: "4px 6px" }}><RiskDot level={p.threat} /></div>
            </div>
          ))}
        </div>
        {/* Delivery Timeline */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>DELIVERY TIMELINE — CUMULATIVE UNITS</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
            {[
              { q: "Q2'26", u: 0, cum: 0 }, { q: "Q3'26", u: 380, cum: 380 }, { q: "Q4'26", u: 0, cum: 380 },
              { q: "Q1'27", u: 600, cum: 980 }, { q: "Q2'27", u: 100, cum: 1080 }, { q: "Q3'27", u: 0, cum: 1080 },
              { q: "Q4'27", u: 160, cum: 1240 },
            ].map((bar, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", background: bar.u > 300 ? T.text.red + "66" : bar.u > 0 ? T.text.amber + "66" : T.border.subtle, height: `${Math.max((bar.u / 600) * 50, 2)}px`, borderRadius: 1, transition: "height 0.4s ease" }} />
                <div style={{ fontSize: 6, color: T.text.muted, marginTop: 2 }}>{bar.q}</div>
                {bar.u > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: T.text.amber }}>{bar.u}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F5 — STRATEGY ARBITRAGE (M08)
  // ═══════════════════════════════════════════════════════════
  const DealStrategy = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="STRATEGY ARBITRAGE" subtitle="M08 | 4-Strategy Comparison" borderColor={T.text.purple} />
      <div style={{ padding: 8, background: T.text.purple + "08", borderLeft: `3px solid ${T.text.purple}` }}>
        <span style={{ fontSize: 9, color: T.text.purple, fontWeight: 600 }}>ARBITRAGE ALERT:</span>
        <span style={{ fontSize: 9, color: T.text.secondary }}> BTS outscores RENTAL by 15pts. Broker recommends Rental — platform sees 3x density upside for new construction. Delta exceeds 15pt threshold.</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.border.subtle, marginTop: 1 }}>
        {[
          { s: "BUILD-TO-SELL", sc: 84, irr: "24.3%", yoc: "7.2%", em: "2.8x", time: "24mo", coc: "—", win: true, signals: { D: 88, S: 72, M: 85, P: 79, R: 81 }, verdict: "Strong zoning density, thin new supply, Amazon demand catalyst. Best risk-adjusted return." },
          { s: "FLIP", sc: 58, irr: "21.5%", yoc: "N/A", em: "1.6x", time: "8mo", coc: "—", signals: { D: 60, S: 55, M: 72, P: 52, R: 48 }, verdict: "No existing structure to flip. Land-only deal. Strategy not applicable." },
          { s: "RENTAL", sc: 69, irr: "18.7%", yoc: "5.8%", em: "2.1x", time: "Hold", coc: "6.2%", signals: { D: 75, S: 68, M: 62, P: 70, R: 72 }, verdict: "Viable but suboptimal. BTS captures more of the zoning density premium. Rental better at lower density." },
          { s: "STR", sc: 45, irr: "12.4%", yoc: "4.4%", em: "1.3x", time: "Hold", coc: "3.8%", signals: { D: 42, S: 40, M: 55, P: 48, R: 38 }, verdict: "Regulatory uncertainty in Tampa for 248-unit STR. Not viable at this scale." },
        ].map((col, ci) => (
          <div key={ci} style={{ background: T.bg.panel, borderTop: col.win ? `3px solid ${T.text.amber}` : "3px solid transparent" }}>
            <div style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: col.win ? T.text.amber : T.text.secondary, letterSpacing: 1 }}>{col.s}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: col.win ? T.text.amber : T.text.muted, marginTop: 2 }}>{col.sc}</div>
              {col.win && <Bd c={T.text.amber}>WINNER +15</Bd>}
            </div>
            <div style={{ padding: 8 }}>
              {[{ l: "IRR", v: col.irr }, { l: "EM", v: col.em }, { l: "YOC", v: col.yoc }, { l: "COC", v: col.coc }, { l: "TIMELINE", v: col.time }].map((m, mi) => (
                <div key={mi} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
                  <span style={{ fontSize: 8, color: T.text.muted }}>{m.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.text.amber }}>{m.v}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, fontSize: 8, color: T.text.muted, letterSpacing: 1 }}>SIGNALS</div>
              {Object.entries(col.signals).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 7, color: T.text.muted, minWidth: 14 }}>{k}</span>
                  <div style={{ flex: 1, height: 4, background: T.bg.terminal }}><div style={{ height: "100%", width: `${v}%`, background: v >= 75 ? T.text.green : v >= 55 ? T.text.amber : T.text.red }} /></div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: v >= 75 ? T.text.green : v >= 55 ? T.text.amber : T.text.red }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 7, color: T.text.secondary, lineHeight: 1.4, fontStyle: "italic" }}>{col.verdict}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // F6 — PRO FORMA ENGINE (M09)
  // ═══════════════════════════════════════════════════════════
  const DealProforma = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="PRO FORMA ENGINE" subtitle="M09 | 3-Layer Assumption Model" borderColor={T.text.amber}
          right={<div style={{ display: "flex", gap: 4 }}><Bd c={T.text.cyan}>LAYER 1: BROKER</Bd><Bd c={T.text.green}>LAYER 2: PLATFORM</Bd><Bd c={T.text.purple}>LAYER 3: USER</Bd></div>}
        />
        {/* 3-Column Assumption Comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr", gap: 0 }}>
          {["ASSUMPTION", "BROKER", "PLATFORM", "YOU"].map((h, i) => (
            <div key={i} style={{ padding: "4px 8px", fontSize: 7, fontWeight: 700, color: [T.text.muted, T.text.cyan, T.text.green, T.text.purple][i], letterSpacing: 0.8, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
          ))}
          {[
            { a: "RENT GROWTH", broker: "4.0%", platform: "3.0%", user: "3.5%", flag: true, note: "Broker +100bps vs market. Platform uses 90d trailing avg." },
            { a: "VACANCY", broker: "5.0%", platform: "8.5%", user: "7.0%", flag: true, note: "Broker understates by 350bps. Platform uses current submarket." },
            { a: "EXIT CAP", broker: "5.0%", platform: "5.5%", user: "5.25%", flag: false, note: "50bps spread. Platform uses trailing 12mo transaction avg." },
            { a: "EXPENSE GROWTH", broker: "2.5%", platform: "3.8%", user: "3.5%", flag: true, note: "Insurance +18% YoY not reflected in broker model." },
            { a: "INSURANCE $/U", broker: "$1,200", platform: "$1,850", user: "$1,600", flag: true, note: "FL insurance crisis. Broker uses pre-reform rates." },
            { a: "RENT PSF", broker: "$2.12", platform: "$1.94", user: "$2.00", flag: false, note: "Broker uses asking rent. Platform uses effective (net of concessions)." },
            { a: "HOLD PERIOD", broker: "5yr", platform: "5yr", user: "5yr", flag: false, note: "" },
          ].map((row, ri) => (
            <React.Fragment key={ri}>
              <div style={{ padding: "4px 8px", fontSize: 8, fontWeight: 600, color: T.text.primary, background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderRight: `1px solid ${T.border.subtle}`, borderBottom: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center", gap: 4 }}>
                {row.a}
                {row.flag && <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.text.orange }} />}
              </div>
              {[row.broker, row.platform, row.user].map((v, ci) => (
                <div key={ci} style={{ padding: "4px 8px", fontSize: 9, fontWeight: 700, color: [T.text.cyan, T.text.green, T.text.purple][ci], background: ri % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderRight: `1px solid ${T.border.subtle}`, borderBottom: `1px solid ${T.border.subtle}` }}>
                  {v}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        {/* Returns Comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: T.border.subtle, marginTop: 1 }}>
          {["BROKER RETURNS", "PLATFORM-ADJUSTED", "YOUR MODEL"].map((h, i) => {
            const data = [
              { irr: "28.1%", em: "3.2x", noi: "$2,840K", coc: "8.2%" },
              { irr: "22.4%", em: "2.5x", noi: "$2,680K", coc: "6.8%" },
              { irr: "24.3%", em: "2.8x", noi: "$2,740K", coc: "7.4%" },
            ][i];
            const colors = [T.text.cyan, T.text.green, T.text.purple];
            return (
              <div key={i} style={{ background: T.bg.panel, padding: 10, borderTop: `2px solid ${colors[i]}` }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: colors[i], letterSpacing: 0.8, marginBottom: 6 }}>{h}</div>
                <DataRow label="IRR" value={data.irr} valueColor={colors[i]} />
                <DataRow label="EQUITY MULTIPLE" value={data.em} valueColor={colors[i]} />
                <DataRow label="YEAR 1 NOI" value={data.noi} valueColor={colors[i]} />
                <DataRow label="CASH-ON-CASH" value={data.coc} valueColor={colors[i]} border={false} />
              </div>
            );
          })}
        </div>
        {/* Collision Alert */}
        <div style={{ padding: 8, background: T.text.orange + "08", borderLeft: `3px solid ${T.text.orange}`, marginTop: 1 }}>
          <span style={{ fontSize: 9, color: T.text.orange, fontWeight: 600 }}>COLLISION DETECTED:</span>
          <span style={{ fontSize: 9, color: T.text.secondary }}> Broker's IRR is 28.1% but platform adjusts to 22.4% (-570bps). Main driver: broker understates vacancy by 350bps and insurance by $650/unit. Your model splits the difference at 24.3%.</span>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F7 — CAPITAL STRUCTURE (M11)
  // ═══════════════════════════════════════════════════════════
  const DealCapital = () => {
    const stack = [
      { layer: "SENIOR DEBT", amount: "$28.8M", pct: 75, rate: "SOFR+275", term: "36mo", io: "24mo", color: T.text.cyan },
      { layer: "MEZZANINE", amount: "$3.8M", pct: 10, rate: "12.0% Fixed", term: "36mo", io: "Current Pay", color: T.text.orange },
      { layer: "PREF EQUITY", amount: "$1.9M", pct: 5, rate: "10.0% Pref", term: "—", io: "Accrued", color: T.text.purple },
      { layer: "COMMON EQUITY", amount: "$3.9M", pct: 10, rate: "Target 24%", term: "—", io: "Residual", color: T.text.amber },
    ];
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="CAPITAL STRUCTURE" subtitle="M11 | Stack Visualization + DSCR Analysis" borderColor={T.text.cyan} />
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 1, background: T.border.subtle }}>
          {/* Visual Stack */}
          <div style={{ background: T.bg.panel, padding: 12 }}>
            <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, marginBottom: 8 }}>CAPITAL STACK</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stack.map((s, i) => (
                <div key={i} style={{ height: `${Math.max(s.pct * 0.7, 16)}px`, background: s.color + "22", border: `1px solid ${s.color}44`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px" }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: s.color }}>{s.layer}</span>
                  <span style={{ fontSize: 8, fontWeight: 700, color: s.color }}>{s.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <DataRow label="TOTAL COST" value="$38.5M" />
              <DataRow label="LTC" value="75.0%" />
              <DataRow label="WACC" value="8.2%" valueColor={T.text.green} border={false} />
            </div>
          </div>
          {/* Detail Grid */}
          <div style={{ background: T.bg.panel }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.5fr 0.8fr 0.6fr 0.6fr", gap: 0 }}>
              {["TRANCHE", "AMOUNT", "% CAP", "RATE", "TERM", "I/O"].map((h, i) => (
                <div key={i} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
              ))}
              {stack.map((s, i) => (
                [s.layer, s.amount, `${s.pct}%`, s.rate, s.term, s.io].map((cell, ci) => (
                  <div key={`${i}-${ci}`} style={{ padding: "4px 6px", fontSize: ci === 0 ? 9 : 8, fontWeight: ci <= 1 ? 700 : 500, color: ci === 0 ? s.color : T.text.secondary, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`, borderRight: `1px solid ${T.border.subtle}` }}>
                    {cell}
                  </div>
                ))
              ))}
            </div>
            {/* DSCR Analysis */}
            <div style={{ padding: 8, borderTop: `1px solid ${T.border.medium}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>DEBT SERVICE COVERAGE</div>
              {[
                { yr: "YR 1", noi: "$2,680K", ds: "$1,920K", dscr: "1.40x", color: T.text.green },
                { yr: "YR 2", noi: "$2,760K", ds: "$2,280K", dscr: "1.21x", color: T.text.amber },
                { yr: "YR 3", noi: "$2,843K", ds: "$2,280K", dscr: "1.25x", color: T.text.green },
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr 80px", gap: 8, padding: "3px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: T.text.muted }}>{r.yr}</span>
                  <span style={{ fontSize: 8, color: T.text.secondary }}>NOI: {r.noi}</span>
                  <span style={{ fontSize: 8, color: T.text.secondary }}>DS: {r.ds}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: r.color }}>{r.dscr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F8 — RISK ASSESSMENT (M14)
  // ═══════════════════════════════════════════════════════════
  const DealRisk = () => {
    const risks = [
      { cat: "SUPPLY", score: 28, trend: "+2", data: [20,22,24,24,25,26,27,28,28], detail: "Pipeline 4.2% of stock. 600u delivering within 12mo at 0.8mi. Offset by strong absorption.", mitigate: "Phase delivery to avoid Q1 2027 cluster." },
      { cat: "EXECUTION", score: 42, trend: "+4", data: [30,32,34,36,38,39,40,41,42], detail: "First development in Westshore. Complex PD-C entitlement. GC partnership mitigates.", mitigate: "GC guaranteed max price contract. Phase 1 milestone gates." },
      { cat: "MARKET", score: 35, trend: "-2", data: [40,39,38,37,36,36,35,35,35], detail: "Tampa MSA slowing from 2024 peak but still above national avg. Rate sensitivity moderate.", mitigate: "Rate lock on construction financing. Conservative rent growth at 3.0%." },
      { cat: "INSURANCE", score: 38, trend: "0", data: [38,38,38,38,38,38,38,38,38], detail: "FL wind zone but inland location. Reform caps increases at 8%/yr. Currently $1,850/unit.", mitigate: "8% cap locks max exposure. Shopping 3 carriers." },
      { cat: "REGULATORY", score: 18, trend: "-1", data: [22,21,20,20,19,19,18,18,18], detail: "PD-C well-established. No moratorium risk. Impact fees known and budgeted.", mitigate: "Pre-application meeting confirms no new restrictions." },
      { cat: "CLIMATE", score: 24, trend: "0", data: [24,24,24,24,24,24,24,24,24], detail: "Zone X flood. 15mi from coast. No surge risk. Wind zone inland classification.", mitigate: "Structural hardening in design. Wind insurance included." },
    ];
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="RISK ASSESSMENT" subtitle="M14 | 6 Risk Categories + Monte Carlo" borderColor={T.text.red}
          right={<div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 8, color: T.text.muted }}>COMPOSITE</span><span style={{ fontSize: 16, fontWeight: 800, color: T.text.green }}>32</span><Bd c={T.text.green}>LOW</Bd></div>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border.subtle }}>
          {risks.map((r, i) => {
            const c = r.score >= 50 ? T.text.red : r.score >= 35 ? T.text.orange : T.text.green;
            return (
              <div key={i} style={{ background: T.bg.panel, padding: 8, borderLeft: `3px solid ${c}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.text.white }}>{r.cat}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: c }}>{r.score}</span>
                    <span style={{ fontSize: 8, fontWeight: 600, color: r.trend.startsWith("+") ? T.text.red : r.trend.startsWith("-") ? T.text.green : T.text.muted }}>{r.trend}</span>
                  </div>
                </div>
                <Spark data={r.data} color={c} w={100} h={16} />
                <div style={{ fontSize: 8, color: T.text.secondary, lineHeight: 1.4, marginTop: 4 }}>{r.detail}</div>
                <div style={{ fontSize: 7, color: T.text.teal, marginTop: 3 }}>MITIGATION: {r.mitigate}</div>
              </div>
            );
          })}
        </div>
        {/* Monte Carlo */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 10, borderTop: `2px solid ${T.text.purple}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.text.purple, letterSpacing: 0.8, marginBottom: 6 }}>MONTE CARLO SIMULATION — 1,000 RUNS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { l: "P10 (BEAR)", v: "18.4%", c: T.text.red },
              { l: "P50 (BASE)", v: "24.3%", c: T.text.amber },
              { l: "P90 (BULL)", v: "31.2%", c: T.text.green },
              { l: "PROB ≥ TARGET", v: "94%", c: T.text.green },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 0.5 }}>{m.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F9 — COMPS (M15)
  // ═══════════════════════════════════════════════════════════
  const DealComps = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="COMP INTELLIGENCE" subtitle="M15 | Sale Comps + Rent Comps + Like-Kind" borderColor={T.text.teal} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0 }}>
          {["PROPERTY", "SALE DATE", "PRICE", "$/UNIT", "CAP RATE", "DISTANCE"].map((h, i) => (
            <div key={i} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
          ))}
          {[
            { name: "Camden Westshore 320u", date: "11/2025", price: "$57.6M", ppu: "$180K", cap: "5.1%", dist: "0.4 mi" },
            { name: "MAA Westshore 280u", date: "08/2025", price: "$44.8M", ppu: "$160K", cap: "5.4%", dist: "0.8 mi" },
            { name: "Altis Grand 242u", date: "06/2025", price: "$38.7M", ppu: "$160K", cap: "5.3%", dist: "2.1 mi" },
            { name: "Post Harbour 196u", date: "03/2025", price: "$29.4M", ppu: "$150K", cap: "5.6%", dist: "1.4 mi" },
            { name: "Channelside 186u", date: "01/2025", price: "$33.5M", ppu: "$180K", cap: "4.9%", dist: "3.2 mi" },
          ].map((c, i) => (
            [c.name, c.date, c.price, c.ppu, c.cap, c.dist].map((cell, ci) => (
              <div key={`${i}-${ci}`} style={{ padding: "4px 6px", fontSize: ci === 0 ? 8 : 9, fontWeight: ci === 0 ? 600 : (ci >= 2 ? 700 : 400), color: ci === 0 ? T.text.primary : (ci === 3 ? T.text.amber : T.text.secondary), background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`, borderRight: `1px solid ${T.border.subtle}` }}>
                {cell}
              </div>
            ))
          ))}
        </div>
        {/* Comp Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: T.border.subtle, marginTop: 1 }}>
          {[
            { l: "AVG $/UNIT", v: "$166K", sub: "5 comps", c: T.text.amber },
            { l: "MEDIAN CAP", v: "5.3%", sub: "trailing 12mo", c: T.text.amber },
            { l: "SUBJECT $/UNIT", v: "$155K", sub: "-6.6% vs avg", c: T.text.green },
            { l: "SUBJECT CAP", v: "5.2%", sub: "going-in", c: T.text.green },
          ].map((m, i) => (
            <div key={i} style={{ background: T.bg.panel, padding: 8 }}>
              <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 0.5 }}>{m.l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.v}</div>
              <div style={{ fontSize: 7, color: T.text.secondary }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: 8, background: T.text.green + "08", borderLeft: `3px solid ${T.text.green}`, marginTop: 1 }}>
          <span style={{ fontSize: 9, color: T.text.green, fontWeight: 600 }}>COMP VERDICT:</span>
          <span style={{ fontSize: 9, color: T.text.secondary }}> Subject at $155K/unit is 6.6% below comparable avg. Going-in cap of 5.2% is 10bps tighter than market but justified by BTS premium and demand catalyst. Entry basis supports strong relative value.</span>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F10 — TRAFFIC INTELLIGENCE (M07)
  // ═══════════════════════════════════════════════════════════
  const DealTraffic = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="TRAFFIC INTELLIGENCE" subtitle="M07 | Physical + Digital + Fusion Score" borderColor={T.text.teal} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.border.subtle }}>
          {[
            { l: "T-02 PHYSICAL", v: 74, sub: "Walk-in proxy", c: T.text.green, data: [60,62,64,66,68,70,72,73,74] },
            { l: "T-03 DIGITAL", v: 82, sub: "Online engagement", c: T.text.cyan, data: [70,72,74,76,78,79,80,81,82] },
            { l: "T-04 QUADRANT", v: "WINNER", sub: "High phys + high digital", c: T.text.amber, data: null },
            { l: "T-07 TRAJECTORY", v: "▲ +8", sub: "90d trend", c: T.text.green, data: [66,68,70,72,74,76,78,80,82] },
          ].map((m, i) => (
            <div key={i} style={{ background: T.bg.panel, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1 }}>{m.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.c, marginTop: 2 }}>{m.v}</div>
              <div style={{ fontSize: 7, color: T.text.secondary, marginTop: 1 }}>{m.sub}</div>
              {m.data && <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}><Spark data={m.data} color={m.c} w={80} h={16} /></div>}
              {!m.data && <Bd c={T.text.amber}>VALIDATED</Bd>}
            </div>
          ))}
        </div>
        {/* FDOT + Google Reviews */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.border.subtle, marginTop: 1 }}>
          <SectionPanel title="FDOT TRAFFIC COUNTS" subtitle="Continuous Stations" borderColor={T.text.orange}>
            {[
              { road: "Boy Scout Blvd", aadt: "42,800", trend: "+3.2%", station: "270148" },
              { road: "I-275 (adjacent)", aadt: "148,200", trend: "+1.8%", station: "100042" },
              { road: "Westshore Blvd", aadt: "38,400", trend: "+2.4%", station: "270156" },
              { road: "Kennedy Blvd", aadt: "35,600", trend: "+1.1%", station: "270162" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}` }}>
                <div>
                  <div style={{ fontSize: 9, color: T.text.primary, fontWeight: 600 }}>{r.road}</div>
                  <div style={{ fontSize: 7, color: T.text.muted }}>Station #{r.station}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.text.amber }}>{r.aadt}</div>
                  <div style={{ fontSize: 7, color: T.text.green }}>{r.trend} YoY</div>
                </div>
              </div>
            ))}
          </SectionPanel>
          <SectionPanel title="GOOGLE REVIEWS SENTIMENT" subtitle="Area Aggregate (2mi)" borderColor={T.text.purple}>
            {[
              { cat: "MANAGEMENT", score: 3.8, sentiment: "MIXED", count: 847, trend: "+0.2" },
              { cat: "MAINTENANCE", score: 4.1, sentiment: "POSITIVE", count: 632, trend: "+0.3" },
              { cat: "AMENITIES", score: 4.3, sentiment: "POSITIVE", count: 521, trend: "+0.1" },
              { cat: "LOCATION", score: 4.6, sentiment: "STRONG", count: 1204, trend: "0.0" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderBottom: `1px solid ${T.border.subtle}` }}>
                <span style={{ fontSize: 8, color: T.text.muted, minWidth: 80 }}>{r.cat}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: r.score >= 4.0 ? T.text.green : r.score >= 3.5 ? T.text.amber : T.text.red }}>{r.score}</span>
                <Bd c={r.score >= 4.0 ? T.text.green : r.score >= 3.5 ? T.text.amber : T.text.red}>{r.sentiment}</Bd>
                <span style={{ fontSize: 7, color: T.text.muted, marginLeft: "auto" }}>{r.count} reviews</span>
              </div>
            ))}
          </SectionPanel>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F11 — DOCUMENTS (M18)
  // ═══════════════════════════════════════════════════════════
  const DealDocs = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="DOCUMENT CENTER" subtitle="M18 | Deal Room + AI Extraction" borderColor={T.text.cyan}
          right={<Bd c={T.text.green}>12 FILES</Bd>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.6fr 0.6fr 0.8fr 0.6fr 0.5fr", gap: 0 }}>
          {["DOCUMENT", "TYPE", "SIZE", "UPLOADED", "STATUS", "AI"].map((h, i) => (
            <div key={i} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
          ))}
          {[
            { name: "Purchase & Sale Agreement", type: "LEGAL", size: "2.4 MB", date: "03/01/26", status: "EXECUTED", ai: "PARSED" },
            { name: "Phase I ESA Report", type: "ENV", size: "8.1 MB", date: "02/28/26", status: "COMPLETE", ai: "PARSED" },
            { name: "ALTA Survey", type: "SURVEY", size: "12.3 MB", date: "02/25/26", status: "FINAL", ai: "PARSED" },
            { name: "Appraisal Report", type: "FINANCE", size: "4.7 MB", date: "02/20/26", status: "DRAFT", ai: "PENDING" },
            { name: "Title Commitment", type: "LEGAL", size: "1.8 MB", date: "02/18/26", status: "REVIEW", ai: "PARSED" },
            { name: "Geotechnical Report", type: "ENV", size: "6.2 MB", date: "02/15/26", status: "COMPLETE", ai: "PARSED" },
            { name: "Broker OM", type: "MARKET", size: "3.5 MB", date: "02/10/26", status: "RECEIVED", ai: "PARSED" },
            { name: "Insurance Quote (3 carriers)", type: "FINANCE", size: "890 KB", date: "03/05/26", status: "ACTIVE", ai: "PARSED" },
            { name: "Construction Budget", type: "FINANCE", size: "1.2 MB", date: "03/02/26", status: "V3", ai: "PARSED" },
            { name: "Site Plan (DRC Rev 1)", type: "DESIGN", size: "15.4 MB", date: "02/28/26", status: "IN REVIEW", ai: "—" },
          ].map((doc, i) => {
            const tc = { LEGAL: T.text.purple, ENV: T.text.green, FINANCE: T.text.amber, SURVEY: T.text.cyan, MARKET: T.text.orange, DESIGN: T.text.teal };
            return [doc.name, doc.type, doc.size, doc.date, doc.status, doc.ai].map((cell, ci) => (
              <div key={`${i}-${ci}`} style={{ padding: "4px 6px", fontSize: ci === 0 ? 8 : 8, fontWeight: ci === 0 ? 600 : 400, color: ci === 0 ? T.text.primary : (ci === 1 ? (tc[cell] || T.text.secondary) : T.text.secondary), background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}`, borderRight: `1px solid ${T.border.subtle}` }}>
                {ci === 4 ? <Bd c={cell === "EXECUTED" || cell === "COMPLETE" || cell === "FINAL" ? T.text.green : cell === "DRAFT" || cell === "IN REVIEW" || cell === "REVIEW" ? T.text.amber : T.text.secondary}>{cell}</Bd> :
                 ci === 5 ? <Bd c={cell === "PARSED" ? T.text.teal : T.text.muted}>{cell}</Bd> :
                 cell}
              </div>
            ));
          })}
        </div>
        {/* DD Checklist */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 8, borderTop: `2px solid ${T.text.amber}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.text.amber, letterSpacing: 0.8, marginBottom: 4 }}>DD CHECKLIST — 18/24 COMPLETE (75%)</div>
          <MiniBar value={75} color={T.text.amber} label="PROGRESS" />
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {["PSA ✓", "ESA ✓", "Survey ✓", "Title ✓", "Geotech ✓", "Appraisal ○", "Zoning ✓", "Insurance ✓", "Financing ○"].map((item, i) => (
              <Bd key={i} c={item.includes("✓") ? T.text.green : T.text.orange}>{item}</Bd>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // F12 — EXIT STRATEGY (M20)
  // ═══════════════════════════════════════════════════════════
  const DealExit = () => {
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <PanelHeader title="EXIT STRATEGY & TIMING" subtitle="M20 | Disposition Analysis" borderColor={T.text.amberBright} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: T.border.subtle }}>
          {[
            { exit: "CONDO CONVERSION", timeline: "Month 26", price: "$52.2M", irr: "28.1%", em: "3.2x", score: 88, win: true },
            { exit: "BULK SALE", timeline: "Month 24", price: "$46.4M", irr: "24.3%", em: "2.8x", score: 82, win: false },
            { exit: "REFI + HOLD", timeline: "Month 36", price: "N/A", irr: "22.1%", em: "3.4x", score: 75, win: false },
            { exit: "1031 EXCHANGE", timeline: "Month 24", price: "$46.4M", irr: "24.3%", em: "2.8x", score: 71, win: false },
          ].map((e, i) => (
            <div key={i} style={{ background: T.bg.panel, borderTop: e.win ? `3px solid ${T.text.amber}` : "3px solid transparent" }}>
              <div style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: e.win ? T.text.amber : T.text.secondary, letterSpacing: 0.8 }}>{e.exit}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: e.win ? T.text.amber : T.text.muted, marginTop: 2 }}>{e.score}</div>
                {e.win && <Bd c={T.text.amber}>OPTIMAL</Bd>}
              </div>
              <div style={{ padding: 8 }}>
                <DataRow label="TIMELINE" value={e.timeline} />
                <DataRow label="EXIT PRICE" value={e.price} valueColor={T.text.amber} />
                <DataRow label="IRR" value={e.irr} valueColor={T.text.green} />
                <DataRow label="EM" value={e.em} />
              </div>
            </div>
          ))}
        </div>
        {/* Optimal Window */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 10, borderTop: `2px solid ${T.text.amber}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.text.amber, letterSpacing: 0.8, marginBottom: 6 }}>EXIT TIMING OPTIMIZATION</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 50 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const mo = (i + 1) * 3;
              const irr = [8, 12, 16, 19, 22, 24, 26, 27, 24, 22, 20, 18][i];
              const optimal = i === 7;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", height: `${irr * 1.8}px`, background: optimal ? T.text.amber : T.text.amber + "44", borderRadius: 1, border: optimal ? `1px solid ${T.text.amber}` : "none" }} />
                  <div style={{ fontSize: 6, color: optimal ? T.text.amber : T.text.muted, marginTop: 2, fontWeight: optimal ? 800 : 400 }}>M{mo}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 8, color: T.text.muted }}>Peak IRR window: Month 21–27</span>
            <span style={{ fontSize: 8, color: T.text.amber, fontWeight: 700 }}>OPTIMAL: Month 24 at 27% IRR</span>
          </div>
        </div>
        {/* Market Conditions at Exit */}
        <div style={{ background: T.bg.panel, marginTop: 1, padding: 8 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: T.text.white, marginBottom: 4 }}>PROJECTED CONDITIONS AT EXIT (M24)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { l: "PROJ CAP RATE", v: "5.0%", note: "Compression expected" },
              { l: "PROJ VACANCY", v: "7.2%", note: "Supply absorption complete" },
              { l: "RATE ENVIRONMENT", v: "4.25%", note: "Fed easing cycle" },
              { l: "BUYER POOL", v: "DEEP", note: "Institutional + 1031" },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 0.5 }}>{m.l}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text.green }}>{m.v}</div>
                <div style={{ fontSize: 7, color: T.text.secondary }}>{m.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────

  const renderContent = () => {
    switch (fkey) {
      case "F1": return (<DealOverview />);
      case "F2": return (<DealProperty />);
      case "F3": return (<DealMarket />);
      case "F4": return (<DealSupply />);
      case "F5": return (<DealStrategy />);
      case "F6": return (<DealProforma />);
      case "F7": return (<DealCapital />);
      case "F8": return (<DealRisk />);
      case "F9": return (<DealComps />);
      case "F10": return (<DealTraffic />);
      case "F11": return (<DealDocs />);
      case "F12": return (<DealExit />);
      default: return null;
    }
  };

  return (
    <div style={{ background: T.bg.terminal, height: "100vh", fontFamily: T.font.mono, color: T.text.primary, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)" }} />

      {/* ═══ TOP STATUS BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 24, background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: T.font.display, fontSize: 12, fontWeight: 800, color: T.text.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.text.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.text.amber, fontWeight: 600 }}>DEAL CAPSULE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 8, color: T.text.green, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: T.text.green, animation: "glow 2s infinite" }} />5 AGENTS</span>
          <span style={{ fontSize: 8, color: T.text.secondary }}>KAFKA: 312/s</span>
          <span style={{ fontSize: 8, color: T.text.amber, fontWeight: 600 }}>{time.toLocaleTimeString("en-US", { hour12: false })}</span>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <div style={{ height: 18, background: "#06080E", borderBottom: `1px solid ${T.border.subtle}`, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 20, whiteSpace: "nowrap", animation: "ticker 45s linear infinite", fontSize: 8, lineHeight: "18px" }}>
          {[...tickers, ...tickers].map((t, i) => (<span key={i} style={{ color: t.startsWith("^") ? T.text.green : t.startsWith("v") ? T.text.red : T.text.amber }}>{t}</span>))}
        </div>
      </div>

      {/* ═══ DEAL CONTEXT BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 26, background: T.text.amber + "08", borderBottom: `1px solid ${T.text.amber}22`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: T.font.mono, fontSize: 7, color: T.text.muted, background: T.bg.input, border: `1px solid ${T.border.subtle}`, padding: "1px 5px", fontWeight: 700 }}>ESC</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text.amber }}>{d.name}</span>
          <span style={{ fontSize: 8, color: T.text.secondary }}>{d.addr}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: d.score >= 80 ? T.text.green : T.text.amber }}>{d.score}</span>
          <span style={{ fontSize: 8, color: T.text.green }}>{d.delta}</span>
          <StratBd s={d.strat} />
          <StageBd stage={d.stage} />
          <RiskDot level={d.risk} />
        </div>
      </div>

      {/* ═══ F-KEY NAV BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${T.border.medium}`, flexShrink: 0, background: T.bg.header }}>
        <div style={{ display: "flex", flex: 1, overflow: "auto" }}>
          {DEAL_NAV.map(n => (
            <button key={n.key} onClick={() => { setFkey(n.key); setSubTab(0); }} style={{
              fontFamily: T.font.mono, fontSize: 9, fontWeight: 600, padding: "0 10px", height: 28, cursor: "pointer",
              background: fkey === n.key ? T.text.amber : "transparent",
              color: fkey === n.key ? T.bg.terminal : T.text.secondary,
              border: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <span style={{ fontSize: 7, fontWeight: 700, opacity: 0.6, color: fkey === n.key ? T.bg.terminal : T.text.muted }}>{n.key}</span>
              {n.label}
              <span style={{ fontSize: 6, opacity: 0.5, marginLeft: 1 }}>{n.m}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: "0 8px", borderLeft: `1px solid ${T.border.medium}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: T.bg.input, border: `1px solid ${T.border.subtle}`, padding: "0 6px", height: 20, width: 180 }}>
            <span style={{ color: T.text.amber, fontSize: 8, fontWeight: 700 }}>{">"}</span>
            <input value={cmd} onChange={e => setCmd(e.target.value)} placeholder="CMD (/ to focus)" style={{ background: "transparent", border: "none", outline: "none", fontFamily: T.font.mono, fontSize: 9, color: T.text.primary, flex: 1, width: "100%" }} />
            <span style={{ width: 6, height: 11, background: T.text.amber, animation: "blink 1s infinite" }} />
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {renderContent()}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 16, background: T.bg.topBar, borderTop: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 7, color: T.text.muted }}>JEDI RE v0.32</span>
          <span style={{ fontSize: 7, color: T.text.muted }}>DEAL CAPSULE — {DEAL_NAV.find(n => n.key === fkey)?.m}</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 7, color: T.text.green }}>DB OK</span>
          <span style={{ fontSize: 7, color: T.text.green }}>REDIS OK</span>
          <span style={{ fontSize: 7, color: T.text.muted }}>{time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
