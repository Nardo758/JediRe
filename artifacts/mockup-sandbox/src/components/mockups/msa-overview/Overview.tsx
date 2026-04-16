import { useState, useEffect } from "react";

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  blue: "#3B82F6", blueBg: "#1e3a5f",
  borderS: "#1E2538", borderM: "#2A3348",
};
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}
function ScoreCell({ value, size = 11 }: { value: number | string; size?: number }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? T.green : n >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}
function DeltaCell({ value }: { value?: string }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith("+"); const neg = s.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? T.green : neg ? T.red : T.muted, ...mono }}>{s}</span>;
}
function MiniChart({ data, color = T.green, h = 80 }: { data: number[]; color?: string; h?: number }) {
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
function ThresholdVal({ value, thresholds, invert }: { value: string; thresholds: number[]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? T.green : n <= thresholds[1] ? T.amber : T.red;
  else c = n >= thresholds[0] ? T.green : n >= thresholds[1] ? T.amber : T.red;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}
function PressureBadge({ p }: { p: string }) {
  const c: Record<string, string> = { BUYER: T.green, BALANCED: T.amber, SELLER: T.cyan };
  return <Badge label={p} color={c[p] || T.muted} />;
}

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const fmt = (n: number) => String(n).padStart(2, "0");
  return <span style={{ fontSize: 10, fontWeight: 700, color: T.amberBright, ...mono }}>{fmt(t.getHours())}:{fmt(t.getMinutes())}:{fmt(t.getSeconds())}</span>;
}

const TABS = [
  { key: "OVERVIEW", label: "OVERVIEW", hotkey: "F1" },
  { key: "FINANCIALS", label: "FINANCIALS", hotkey: "F2" },
  { key: "COMPS", label: "COMPS", hotkey: "F3" },
  { key: "TAX", label: "TAX & TITLE", hotkey: "F4" },
  { key: "ZONING", label: "ZONING", hotkey: "F5" },
  { key: "MARKET_PERF", label: "MARKET & PERFORMANCE", hotkey: "F6" },
  { key: "TRAFFIC", label: "TRAFFIC", hotkey: "F7" },
];

const TICKER_ITEMS = [
  { text: "ATL MSA Rent +4.2% YoY", color: T.green },
  { text: "Midtown Vacancy 5.1% (3yr low)", color: T.green },
  { text: "Pipeline: 39,565 units (15.8%)", color: T.orange },
  { text: "Cap Rate Compression -20bps", color: T.cyan },
  { text: "Txn Volume $4.2B TTM", color: T.primary },
  { text: "Amazon HQ2 expansion confirmed", color: T.green },
  { text: "Permit velocity -8.2% YoY", color: T.green },
  { text: "Affordability ratio 30.2%", color: T.orange },
];

const NEWS_STORIES = [
  { time: "14:32", tag: "DEAL", tagColor: T.green, headline: "Cortland Partners closes $182M acquisition of Midtown Luxe (412 units) at $442K/unit — 4.6% cap", source: "Real Capital Analytics" },
  { time: "13:15", tag: "SUPPLY", tagColor: T.orange, headline: "Midtown Union Phase II (380 units) receives TCO — first move-ins expected Q3 2026", source: "CoStar" },
  { time: "11:48", tag: "ECON", tagColor: T.cyan, headline: "Amazon confirms 2,800 new tech jobs at Midtown campus — $450M investment over 5 years", source: "Atlanta Business Chronicle" },
  { time: "10:22", tag: "POLICY", tagColor: T.purple, headline: "Fulton County approves 10-year tax abatement for workforce housing projects >100 units", source: "County Records" },
  { time: "09:45", tag: "MARKET", tagColor: T.amber, headline: "Atlanta MSA rents accelerate for 4th consecutive month — gap vs national avg widens to +12.4%", source: "Apartment Locator AI" },
  { time: "08:30", tag: "RISK", tagColor: T.red, headline: "Insurance premiums up 8.2% across SE region — largest increase in 3 years", source: "REIS" },
  { time: "07:15", tag: "DEAL", tagColor: T.green, headline: "Greystar lists Buckhead Grand (288 units) — asking $68M ($236K/unit), 5.1% cap", source: "Eastdil Secured" },
];

const CORP_HEALTH = [
  { name: "Amazon (HQ2)", sector: "TECH", employees: "12,400", growth: "+18.2%", impact: "HIGH", color: T.green, sentiment: 92 },
  { name: "Delta Air Lines", sector: "TRANSPORT", employees: "38,200", growth: "+3.1%", impact: "HIGH", color: T.green, sentiment: 78 },
  { name: "Home Depot (HQ)", sector: "RETAIL", employees: "8,600", growth: "+1.4%", impact: "MED", color: T.amber, sentiment: 72 },
  { name: "NCR / Voyix", sector: "FINTECH", employees: "4,200", growth: "-2.8%", impact: "MED", color: T.red, sentiment: 58 },
  { name: "Coca-Cola Co.", sector: "CPG", employees: "6,800", growth: "+0.8%", impact: "MED", color: T.amber, sentiment: 74 },
  { name: "Georgia-Pacific", sector: "INDUSTRIAL", employees: "3,400", growth: "+2.2%", impact: "LOW", color: T.green, sentiment: 68 },
  { name: "Anthem / Elevance", sector: "HEALTH", employees: "5,100", growth: "+4.6%", impact: "MED", color: T.green, sentiment: 76 },
];

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

const MSA_SIGNALS = [
  { id: "D", name: "DEMAND", score: 82, delta: "+3", weight: 30, color: T.green, desc: "Pop +2.1%, Employment +2.8%, Net migration +14K HH/yr. Amazon HQ expansion." },
  { id: "S", name: "SUPPLY", score: 64, delta: "-2", weight: 25, color: T.red, desc: "39,565 pipeline units (15.8% of stock). 14.1 mo supply. Past-peak permits." },
  { id: "M", name: "MOMENTUM", score: 78, delta: "+5", weight: 20, color: T.orange, desc: "Rent growth accelerating +4.2% YoY. Txn velocity +14%. Concessions falling." },
  { id: "P", name: "POSITION", score: 72, delta: "+1", weight: 15, color: T.purple, desc: "40th pctl nationally. Top quartile SE region. Institutional capital inflow." },
  { id: "R", name: "RISK", score: 28, delta: "-4", weight: 10, color: T.muted, desc: "Affordability 30.2% approaching threshold. Insurance +8% cap helps. Score inverted." },
];

function MSAOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.borderS, flex: 1, overflow: "auto" }}>
      <div style={{ background: T.panel, padding: "12px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.amber, marginBottom: 6, ...mono }}>MARKET PRIMER · ATLANTA MSA</div>
        <p style={{ fontSize: 11, color: T.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          Atlanta is a <span style={{ color: T.primary, fontWeight: 600 }}>6.2M-person MSA</span> tracking <span style={{ color: T.cyan }}>{MSA.props.toLocaleString()} properties</span> and <span style={{ color: T.cyan }}>{MSA.units} units</span> across 8 submarkets.
          The market is in <span style={{ color: T.green }}>month 38 of an expansion cycle</span> — employment growing <span style={{ color: T.green }}>+2.8% YoY</span> (14th consecutive positive month), population <span style={{ color: T.green }}>+2.1%</span> (3x national avg), and median household income <span style={{ color: T.green }}>+3.4%</span>.
          Average effective rent reached <span style={{ color: T.green }}>$2,150/mo (+4.2% YoY)</span> with vacancy tightening to <span style={{ color: T.green }}>5.8%</span> — a 3-year low.
          <span style={{ color: T.orange }}> Primary risk: </span> supply pipeline is elevated at <span style={{ color: T.orange }}>15.8% of existing stock</span> ({MSA.pipeline} units), translating to <span style={{ color: T.orange }}>14.1 months of supply</span> at current absorption.
          However, absorption remains strong at <span style={{ color: T.green }}>2,840 units/quarter</span> and permit velocity is decelerating — suggesting past-peak supply.
          <span style={{ color: T.amber }}> Affordability watch: </span> rent-to-income at 30.2%, approaching the 30% burdened threshold. Rent growth (+4.2%) is outpacing wage growth (+3.4%) for 2 consecutive quarters.
          Platform JEDI Score: <span style={{ color: T.green, fontWeight: 600 }}>87 (+4 over 30d)</span> — Strong Opportunity. Best submarkets: Midtown (88), Decatur (83), Buckhead (84).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>AVG RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((p,i) => <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 0 ? T.amber : "transparent", color: i === 0 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>)}
            </div>
          </div>
          <MiniChart data={MSA_RENT} color={T.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.borderS}`, paddingTop: 6 }}>
            {[
              { l: "Current Avg Rent", v: MSA.rent }, { l: "Rent Growth YoY", v: MSA.rentD, c: T.green },
              { l: "Avg Rent/SF", v: "$1.92" }, { l: "vs National Avg", v: "+12.4%", c: T.green },
              { l: "Concession Rate", v: "2.4%" }, { l: "RevPAU (Market)", v: "$1,986" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: T.muted, ...mono }}>{m.l}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: T.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.cyan, ...mono }}>SUPPLY-DEMAND BALANCE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Vacancy Rate", v: MSA.vac, c: T.green }, { l: "Net Absorption", v: MSA.absorb },
              { l: "Pipeline Units", v: MSA.pipeline }, { l: "Pipeline %", v: MSA.pipelinePct, c: T.orange },
              { l: "Months of Supply", v: MSA.moSupply, c: T.orange }, { l: "Permit Velocity", v: "-8.2% YoY", c: T.green },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.amber, ...mono }}>TRANSACTION ACTIVITY</span>
            <div style={{ marginTop: 4 }}>
              {[
                { l: "Avg Cap Rate", v: MSA.cap }, { l: "Cap Δ YoY", v: MSA.capD, c: T.green },
                { l: "Avg $/Unit", v: MSA.ppu }, { l: "$/Unit Δ YoY", v: MSA.ppuD, c: T.green },
                { l: "Txn Volume (12mo)", v: "$4.2B" }, { l: "Deals Closed", v: "127" },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.borderS}` }}>
                  <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: T.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>ECONOMIC PROFILE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Population", v: MSA.pop }, { l: "Pop Growth", v: MSA.popD, c: T.green },
              { l: "Employment", v: MSA.jobs }, { l: "Job Growth", v: MSA.jobsD, c: T.green },
              { l: "Median HH Income", v: MSA.medInc }, { l: "Income Growth", v: MSA.incD, c: T.green },
              { l: "Rent/Income Ratio", v: MSA.afford, c: T.orange }, { l: "Jobs/Apt Ratio", v: "5.8x" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.purple, ...mono }}>CYCLE POSITION</span>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Badge label={MSA.cycle} color={T.green} />
              <span style={{ fontSize: 9, color: T.secondary, ...mono }}>Month {MSA.cycleMonth}</span>
            </div>
            <div style={{ marginTop: 6, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: "65%", height: "100%", background: `linear-gradient(90deg, ${T.green}, ${T.amber})`, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              {["Trough","Expansion","Peak","Contraction"].map((l,i) => <span key={i} style={{ fontSize: 7, color: T.muted, ...mono }}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: T.muted, letterSpacing: 1.5, ...mono }}>MARKET JEDI</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${T.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: T.green }}>{MSA.jedi}</span>
            <span style={{ fontSize: 8, color: T.green, fontWeight: 600, ...mono }}>{MSA.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: T.muted, ...mono }}>Conf: {MSA.confidence}%</span>
        </div>
        <div style={{ background: T.panel, padding: 12 }}>
          {MSA_SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: T.muted, minWidth: 78, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 120px", height: 5, background: T.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? T.green : s.score >= 50 ? T.amber : T.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: T.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ background: T.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.amber, ...mono }}>◆ NEWS & INTELLIGENCE</span>
            <span style={{ fontSize: 7, color: T.muted, ...mono }}>{NEWS_STORIES.length} stories today</span>
          </div>
          {NEWS_STORIES.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "5px 12px", borderBottom: `1px solid ${T.borderS}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 8, color: T.muted, minWidth: 32, flexShrink: 0, ...mono }}>{n.time}</span>
              <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: n.tagColor, background: n.tagColor + "18", border: `1px solid ${n.tagColor}33`, padding: "0px 4px", flexShrink: 0, alignSelf: "flex-start", marginTop: 1 }}>{n.tag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: T.primary, lineHeight: 1.4, ...sans }}>{n.headline}</div>
                <div style={{ fontSize: 7, color: T.muted, marginTop: 1, ...mono }}>{n.source}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: T.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.cyan, ...mono }}>◈ CORPORATE HEALTH · TOP EMPLOYERS</span>
            <span style={{ fontSize: 7, color: T.muted, ...mono }}>ATL MSA</span>
          </div>
          <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}` }}>
            {[{ l: "Employer", w: 130 },{ l: "Sector", w: 70 },{ l: "Employees", w: 65 },{ l: "Growth", w: 52 },{ l: "Impact", w: 48 },{ l: "Sent.", w: 38 }].map((c,i) => (
              <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 0.5, borderRight: i < 5 ? `1px solid ${T.borderS}` : "none", ...mono }}>{c.l}</div>
            ))}
          </div>
          {CORP_HEALTH.map((c, i) => (
            <div key={i} style={{ display: "flex", background: i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? T.panel : T.panelAlt)}>
              <div style={{ width: 130, minWidth: 130, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: T.primary, ...sans }}>{c.name}</span>
              </div>
              <div style={{ width: 70, minWidth: 70, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <Badge label={c.sector} color={T.muted} />
              </div>
              <div style={{ width: 65, minWidth: 65, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.primary, ...mono }}>{c.employees}</span>
              </div>
              <div style={{ width: 52, minWidth: 52, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <DeltaCell value={c.growth} />
              </div>
              <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <Badge label={c.impact} color={c.color} />
              </div>
              <div style={{ width: 38, minWidth: 38, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 20, height: 4, background: T.bg, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${c.sentiment}%`, height: "100%", background: c.sentiment >= 75 ? T.green : c.sentiment >= 60 ? T.amber : T.red, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 7, color: T.muted, ...mono }}>{c.sentiment}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 12px", borderTop: `1px solid ${T.borderM}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: T.muted, ...mono }}>Aggregate Employment: 78,700</span>
            <span style={{ fontSize: 8, color: T.green, ...mono }}>Wtd. Growth: +4.8%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  { id: "D", name: "DEMAND", score: 88, delta: "+4", weight: 30, color: T.green, desc: "Tech corridor hiring +4.2%. Piedmont Park proximity. Walk score 92." },
  { id: "S", name: "SUPPLY", score: 68, delta: "-1", weight: 25, color: T.orange, desc: "1,840 pipeline units (12.4%). Midtown Union Phase II delivers Q3 2026." },
  { id: "M", name: "MOMENTUM", score: 84, delta: "+6", weight: 20, color: T.green, desc: "Rent growth +4.8% — fastest in MSA. Concessions at 18-mo low." },
  { id: "P", name: "POSITION", score: 78, delta: "+2", weight: 15, color: T.purple, desc: "Top submarket by PCS. 12 of top-20 MSA properties located here." },
  { id: "R", name: "RISK", score: 32, delta: "-3", weight: 10, color: T.muted, desc: "High price point ($245K/unit) limits exit buyer pool. Score inverted." },
];

const SUB_COMPS = [
  { name: "Midtown", msa: "Atlanta", jedi: 88, rent: "$2,056", rentD: "+4.8%", vac: "5.1%", pipe: "12.4%", opp: 82, cap: "4.8%", isSub: true },
  { name: "Buckhead", msa: "Atlanta", jedi: 84, rent: "$1,883", rentD: "+2.1%", vac: "6.2%", pipe: "8.8%", opp: 78, cap: "5.0%" },
  { name: "Sandy Springs", msa: "Atlanta", jedi: 81, rent: "$1,920", rentD: "+3.4%", vac: "5.8%", pipe: "10.2%", opp: 74, cap: "5.2%" },
  { name: "Decatur", msa: "Atlanta", jedi: 83, rent: "$1,890", rentD: "+3.8%", vac: "4.8%", pipe: "5.4%", opp: 84, cap: "5.0%" },
  { name: "West End", msa: "Atlanta", jedi: 79, rent: "$1,977", rentD: "+5.2%", vac: "6.8%", pipe: "6.2%", opp: 86, cap: "5.4%" },
  { name: "Downtown", msa: "Atlanta", jedi: 76, rent: "$1,542", rentD: "+2.8%", vac: "7.2%", pipe: "14.8%", opp: 68, cap: "5.6%" },
];

const SUB_NEWS = [
  { time: "14:32", tag: "DEAL", tagColor: T.green, headline: "Cortland Partners closes $182M acquisition of Midtown Luxe (412 units) at $442K/unit — 4.6% cap", source: "Real Capital Analytics" },
  { time: "13:15", tag: "SUPPLY", tagColor: T.orange, headline: "Midtown Union Phase II (380 units) receives TCO — first move-ins expected Q3 2026", source: "CoStar" },
  { time: "11:48", tag: "ECON", tagColor: T.cyan, headline: "Amazon confirms 2,800 new tech jobs at Midtown campus — $450M investment over 5 years", source: "Atlanta Business Chronicle" },
  { time: "10:22", tag: "TENANT", tagColor: T.purple, headline: "Google signs 45K SF lease at Midtown West — 200+ new positions expected", source: "Bisnow Atlanta" },
  { time: "09:45", tag: "MARKET", tagColor: T.amber, headline: "Midtown rents +4.8% YoY — fastest growth rate in Atlanta MSA for 3rd consecutive quarter", source: "Apartment Locator AI" },
];

const SUB_CORP = [
  { name: "Amazon (Midtown)", sector: "TECH", employees: "4,200", growth: "+22.4%", impact: "HIGH", color: T.green, sentiment: 94 },
  { name: "Google (Midtown West)", sector: "TECH", employees: "1,800", growth: "+12.1%", impact: "HIGH", color: T.green, sentiment: 88 },
  { name: "Salesforce Tower", sector: "TECH", employees: "2,400", growth: "+6.8%", impact: "HIGH", color: T.green, sentiment: 82 },
  { name: "Emory Midtown Hospital", sector: "HEALTH", employees: "3,100", growth: "+3.2%", impact: "MED", color: T.green, sentiment: 76 },
  { name: "WeWork / Spaces", sector: "COWORK", employees: "850", growth: "-4.2%", impact: "LOW", color: T.red, sentiment: 48 },
];

function SubmarketOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.borderS, flex: 1, overflow: "auto" }}>
      <div style={{ background: T.panel, padding: "12px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.amber, marginBottom: 6, ...mono }}>SUBMARKET PRIMER · MIDTOWN, ATLANTA</div>
        <p style={{ fontSize: 11, color: T.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          Midtown is Atlanta's <span style={{ color: T.primary, fontWeight: 600 }}>premier multifamily submarket</span> with <span style={{ color: T.cyan }}>52 properties</span> totaling <span style={{ color: T.cyan }}>14,856 units</span>.
          The submarket sits at the center of Atlanta's tech corridor with a <span style={{ color: T.green }}>walk score of 92</span> and direct Piedmont Park adjacency — commanding the MSA's highest rents at <span style={{ color: T.green }}>$2,056/mo (+4.8% YoY)</span>, the fastest growth rate in the metro.
          Vacancy at <span style={{ color: T.green }}>5.1%</span> is the tightest in the MSA, and absorption at <span style={{ color: T.green }}>3.2%/quarter</span> is outpacing new deliveries.
          <span style={{ color: T.orange }}> Supply watch: </span> 1,840 pipeline units (12.4% of stock) with Midtown Union Phase II (380 units) delivering Q3 2026 as the largest single project.
          Buyer/seller pressure is firmly <span style={{ color: T.green }}>BUYER-dominated</span> — institutional capital is competing aggressively, compressing cap rates to <span style={{ color: T.primary }}>4.8% (-15bps YoY)</span>.
          The top-ranked property is <span style={{ color: T.amberBright }}>The Metropolitan (PCS 94)</span>. The lowest is <span style={{ color: T.red }}>Midtown Terrace (PCS 42)</span> — a potential <span style={{ color: T.green }}>acquisition target</span> underperforming its vantage group.
          Opportunity Score: <span style={{ color: T.green, fontWeight: 600 }}>82/100</span>. The combination of tight vacancy, accelerating rents, and institutional demand makes this the MSA's strongest deployment submarket.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>SUBMARKET RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((p,i) => <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 0 ? T.amber : "transparent", color: i === 0 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>)}
            </div>
          </div>
          <MiniChart data={SUB_RENT} color={T.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.borderS}`, paddingTop: 6 }}>
            {[
              { l: "Avg Rent", v: SUB.rent }, { l: "Rent Growth YoY", v: SUB.rentD, c: T.green },
              { l: "Rent/SF", v: SUB.rentSf }, { l: "vs MSA Avg", v: "+$106 (+5.4%)", c: T.green },
              { l: "RevPAU", v: "$1,951" }, { l: "Concession Rate", v: "1.8%" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: T.muted, ...mono }}>{m.l}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: T.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.cyan, ...mono }}>SUPPLY-DEMAND</span>
          <div style={{ marginTop: 6 }}>
            {[
              { l: "Vacancy", v: SUB.vac, c: T.green }, { l: "Absorption", v: SUB.absorb },
              { l: "Absorption (units)", v: SUB.absorbUnits }, { l: "Pipeline Units", v: SUB.pipeline },
              { l: "Pipeline %", v: SUB.pipelinePct, c: T.orange }, { l: "Months Supply", v: SUB.moSupply, c: T.orange },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.amber, ...mono }}>TRANSACTIONS</span>
            <div style={{ marginTop: 4 }}>
              {[
                { l: "Avg Cap Rate", v: SUB.cap }, { l: "Cap Δ", v: SUB.capD, c: T.green },
                { l: "Avg $/Unit", v: SUB.ppu }, { l: "$/Unit Δ", v: SUB.ppuD, c: T.green },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.borderS}` }}>
                  <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: T.muted, ...mono }}>Pressure:</span>
              <PressureBadge p={SUB.pressure} />
            </div>
          </div>
        </div>

        <div style={{ background: T.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>DEMOGRAPHICS</span>
          <div style={{ marginTop: 6 }}>
            {[
              { l: "Population", v: SUB.pop }, { l: "Pop Growth", v: SUB.popD, c: T.green },
              { l: "Employment", v: SUB.jobs }, { l: "Job Growth", v: SUB.jobsD, c: T.green },
              { l: "Med. HH Income", v: SUB.medInc }, { l: "Affordability", v: SUB.afford, c: T.green },
              { l: "Avg Review", v: `${SUB.review}/5 (${SUB.reviewCt} reviews)` },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.purple, ...mono }}>POWER RANKINGS</span>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>Top Property</span>
                <span style={{ fontSize: 9, color: T.green, fontWeight: 600, ...mono }}>{SUB.topProp} (PCS {SUB.topPCS})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>Bottom Property</span>
                <span style={{ fontSize: 9, color: T.red, fontWeight: 600, ...mono }}>{SUB.botProp} (PCS {SUB.botPCS})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: 9, color: T.secondary, ...sans }}>Opp Score</span>
                <ScoreCell value={SUB.opp} size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: T.muted, letterSpacing: 1.5, ...mono }}>SUBMARKET JEDI</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${T.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: T.green }}>{SUB.jedi}</span>
            <span style={{ fontSize: 8, color: T.green, fontWeight: 600, ...mono }}>{SUB.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: T.muted, ...mono }}>Conf: {SUB.confidence}%</span>
        </div>
        <div style={{ background: T.panel, padding: 12 }}>
          {SUB_SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: T.muted, minWidth: 78, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 120px", height: 5, background: T.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? T.green : s.score >= 50 ? T.amber : T.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: T.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ background: T.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.amber, ...mono }}>◆ NEWS & INTELLIGENCE · MIDTOWN</span>
            <span style={{ fontSize: 7, color: T.muted, ...mono }}>{SUB_NEWS.length} stories today</span>
          </div>
          {SUB_NEWS.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "5px 12px", borderBottom: `1px solid ${T.borderS}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 8, color: T.muted, minWidth: 32, flexShrink: 0, ...mono }}>{n.time}</span>
              <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: n.tagColor, background: n.tagColor + "18", border: `1px solid ${n.tagColor}33`, padding: "0px 4px", flexShrink: 0, alignSelf: "flex-start", marginTop: 1 }}>{n.tag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: T.primary, lineHeight: 1.4, ...sans }}>{n.headline}</div>
                <div style={{ fontSize: 7, color: T.muted, marginTop: 1, ...mono }}>{n.source}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: T.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.cyan, ...mono }}>◈ CORPORATE HEALTH · MIDTOWN EMPLOYERS</span>
            <span style={{ fontSize: 7, color: T.muted, ...mono }}>Submarket</span>
          </div>
          <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}` }}>
            {[{ l: "Employer", w: 130 },{ l: "Sector", w: 70 },{ l: "Employees", w: 65 },{ l: "Growth", w: 52 },{ l: "Impact", w: 48 },{ l: "Sent.", w: 38 }].map((c,i) => (
              <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 0.5, borderRight: i < 5 ? `1px solid ${T.borderS}` : "none", ...mono }}>{c.l}</div>
            ))}
          </div>
          {SUB_CORP.map((c, i) => (
            <div key={i} style={{ display: "flex", background: i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? T.panel : T.panelAlt)}>
              <div style={{ width: 130, minWidth: 130, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: T.primary, ...sans }}>{c.name}</span>
              </div>
              <div style={{ width: 70, minWidth: 70, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <Badge label={c.sector} color={T.muted} />
              </div>
              <div style={{ width: 65, minWidth: 65, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <span style={{ fontSize: 9, color: T.primary, ...mono }}>{c.employees}</span>
              </div>
              <div style={{ width: 52, minWidth: 52, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <DeltaCell value={c.growth} />
              </div>
              <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
                <Badge label={c.impact} color={c.color} />
              </div>
              <div style={{ width: 38, minWidth: 38, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 20, height: 4, background: T.bg, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${c.sentiment}%`, height: "100%", background: c.sentiment >= 75 ? T.green : c.sentiment >= 60 ? T.amber : T.red, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 7, color: T.muted, ...mono }}>{c.sentiment}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 12px", borderTop: `1px solid ${T.borderM}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: T.muted, ...mono }}>Aggregate Employment: 12,350</span>
            <span style={{ fontSize: 8, color: T.green, ...mono }}>Wtd. Growth: +11.8%</span>
          </div>
        </div>
      </div>

      <div style={{ background: T.panel }}>
        <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>PEER COMPARISON · SUBMARKETS IN MSA</span>
        </div>
        <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}` }}>
          {[{ l: "Submarket", w: 110 },{ l: "JEDI", w: 44 },{ l: "Rent", w: 60 },{ l: "Rent Δ", w: 48 },{ l: "Vac", w: 44 },{ l: "Pipe %", w: 48 },{ l: "Opp", w: 40 },{ l: "Cap", w: 40 }].map((c,i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, ...mono }}>{c.l}</div>
          ))}
        </div>
        {SUB_COMPS.map((c,i) => (
          <div key={i} style={{ display: "flex", background: c.isSub ? T.amber + "0A" : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, borderLeft: c.isSub ? `2px solid ${T.amber}` : "2px solid transparent", cursor: "pointer" }}>
            <div style={{ width: 110, minWidth: 110, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
              <span style={{ fontSize: 9, fontWeight: c.isSub ? 700 : 500, color: c.isSub ? T.amberBright : T.primary, ...sans }}>{c.name}</span>
            </div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><ScoreCell value={c.jedi} /></div>
            <div style={{ width: 60, minWidth: 60, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{c.rent}</span></div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><DeltaCell value={c.rentD} /></div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><ThresholdVal value={c.vac} thresholds={[5,8]} invert /></div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><ThresholdVal value={c.pipe} thresholds={[8,12]} invert /></div>
            <div style={{ width: 40, minWidth: 40, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><ScoreCell value={c.opp} size={9} /></div>
            <div style={{ width: 40, minWidth: 40, padding: "4px 6px" }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.cap}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Overview() {
  const [level, setLevel] = useState("msa");

  const lvl = level === "msa" ? MSA : SUB;
  const isSubmarket = level === "submarket";

  return (
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column", color: T.primary, overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');*{scrollbar-width:thin;scrollbar-color:${T.borderM} ${T.bg};box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.borderM}}@keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 24, padding: "0 10px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.amber, letterSpacing: 1.5, ...mono }}>JediRE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 9, color: T.secondary, ...mono }}>PORTFOLIO</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 9, color: T.amber, fontWeight: 700, ...mono }}>PIPELINE: $237.5M</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 9, color: T.primary, ...mono }}>ACTIVE: 1</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 9, color: T.orange, ...mono }}>ALERTS: 3</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, color: T.green, display: "flex", alignItems: "center", gap: 3, ...mono }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.green, display: "inline-block" }} />5 AGT
          </span>
          <span style={{ fontSize: 9, color: T.cyan, ...mono }}>MAIL: 2</span>
          <span style={{ fontSize: 9, color: T.secondary, ...mono }}>KAFKA: 312/s</span>
          <LiveClock />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", height: 20, background: T.header, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0, overflow: "hidden" }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: T.amber, padding: "0 8px", flexShrink: 0, background: `${T.amber}15`, height: "100%", display: "flex", alignItems: "center", ...mono }}>LIVE</span>
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ display: "flex", gap: 24, whiteSpace: "nowrap", animation: "tickerScroll 40s linear infinite" }}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} style={{ fontSize: 8, color: item.color, ...mono }}>{item.text}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, background: T.header }}>
        <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
          {TABS.map(tab => {
            const isActive = tab.key === "OVERVIEW";
            const activeColor = tab.key === "TRAFFIC" ? T.blue : tab.key === "MARKET_PERF" ? T.green : T.amber;
            return (
              <div key={tab.key} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "5px 12px",
                borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap",
              }}>
                <span style={{ fontSize: 8, color: isActive ? activeColor : T.muted, fontWeight: 600, ...mono }}>{tab.hotkey}</span>
                <span style={{ fontSize: 9, color: isActive ? T.primary : T.secondary, fontWeight: isActive ? 700 : 500, ...mono }}>{tab.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 10px", height: 28, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        {[
          { id: "msa", label: "MSA · Atlanta, GA", icon: "INDEX" },
          { id: "submarket", label: "Submarket · Midtown", icon: "SECTOR" },
        ].map(l => (
          <button key={l.id} onClick={() => setLevel(l.id)} style={{
            ...mono, fontSize: 9, fontWeight: 600, padding: "0 12px", height: 24, cursor: "pointer",
            background: level === l.id ? T.amber : "transparent",
            color: level === l.id ? T.bg : T.secondary,
            border: level === l.id ? "none" : `1px solid ${T.borderS}`,
          }}>
            <span style={{ fontSize: 7, opacity: 0.7, marginRight: 4 }}>{l.icon}</span>
            {l.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>Toggle between MSA and Submarket views</span>
      </div>

      <div style={{ padding: "4px 10px", background: isSubmarket ? T.purple + "15" : T.blueBg, borderBottom: `1px solid ${T.borderM}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {isSubmarket && <span style={{ fontSize: 8, color: T.cyan, cursor: "pointer", ...mono }}>◀ Atlanta, GA</span>}
        <span style={{ fontSize: 14, fontWeight: 800, color: T.amberBright, ...sans }}>{lvl.name}</span>
        <span style={{ fontSize: 10, color: T.secondary, ...sans }}>{isSubmarket ? "Submarket Intelligence" : "Market Intelligence Dashboard"}</span>
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.green, ...mono }}>{lvl.rent}</span>
        <DeltaCell value={lvl.rentD} />
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>Vac</span>
        <ThresholdVal value={lvl.vac} thresholds={[5,8]} invert />
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>JEDI</span>
        <ScoreCell value={lvl.jedi} size={12} />
        <DeltaCell value={lvl.d30} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.green, display: "flex", alignItems: "center", gap: 3, ...mono }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: T.green }} />
          {lvl.props} Properties · {lvl.units} Units
        </span>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {level === "msa" && <MSAOverview />}
        {level === "submarket" && <SubmarketOverview />}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>Sources: Apartment Locator AI · Census ACS · BLS QCEW · County Permits · Google Places</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>F1-F7 Navigate · / Command · JediRE v2.2</span>
      </div>
    </div>
  );
}
