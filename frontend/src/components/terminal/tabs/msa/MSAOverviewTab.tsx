import React from 'react';
import { BT } from '../../theme';

interface MSAOverviewTabProps {
  msaId: string;
  msa: any;
}

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

function OvBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}
function OvScore({ value, size = 11 }: { value: number | string; size?: number }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? BT.text.green : n >= 65 ? BT.text.amber : BT.text.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}
function OvDelta({ value }: { value?: string }) {
  if (!value || value === "—") return <span style={{ color: BT.text.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith("+"); const neg = s.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? BT.text.green : neg ? BT.text.red : BT.text.muted, ...mono }}>{s}</span>;
}
function OvChart({ data, color = BT.text.green, h = 80 }: { data: number[]; color?: string; h?: number }) {
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

const NEWS_STORIES = [
  { time: "14:32", tag: "DEAL", tagColor: BT.text.green, headline: "Cortland Partners closes $182M acquisition of Midtown Luxe (412 units) at $442K/unit — 4.6% cap", source: "Real Capital Analytics" },
  { time: "13:15", tag: "SUPPLY", tagColor: BT.accent.amber, headline: "Midtown Union Phase II (380 units) receives TCO — first move-ins expected Q3 2026", source: "CoStar" },
  { time: "11:48", tag: "ECON", tagColor: BT.text.cyan, headline: "Amazon confirms 2,800 new tech jobs at Midtown campus — $450M investment over 5 years", source: "Atlanta Business Chronicle" },
  { time: "10:22", tag: "POLICY", tagColor: BT.text.purple, headline: "Fulton County approves 10-year tax abatement for workforce housing projects >100 units", source: "County Records" },
  { time: "09:45", tag: "MARKET", tagColor: BT.text.amber, headline: "Atlanta MSA rents accelerate for 4th consecutive month — gap vs national avg widens to +12.4%", source: "Apartment Locator AI" },
  { time: "08:30", tag: "RISK", tagColor: BT.text.red, headline: "Insurance premiums up 8.2% across SE region — largest increase in 3 years", source: "REIS" },
  { time: "07:15", tag: "DEAL", tagColor: BT.text.green, headline: "Greystar lists Buckhead Grand (288 units) — asking $68M ($236K/unit), 5.1% cap", source: "Eastdil Secured" },
];

const CORP_HEALTH = [
  { name: "Amazon (HQ2)", sector: "TECH", employees: "12,400", growth: "+18.2%", impact: "HIGH", color: BT.text.green, sentiment: 92 },
  { name: "Delta Air Lines", sector: "TRANSPORT", employees: "38,200", growth: "+3.1%", impact: "HIGH", color: BT.text.green, sentiment: 78 },
  { name: "Home Depot (HQ)", sector: "RETAIL", employees: "8,600", growth: "+1.4%", impact: "MED", color: BT.text.amber, sentiment: 72 },
  { name: "NCR / Voyix", sector: "FINTECH", employees: "4,200", growth: "-2.8%", impact: "MED", color: BT.text.red, sentiment: 58 },
  { name: "Coca-Cola Co.", sector: "CPG", employees: "6,800", growth: "+0.8%", impact: "MED", color: BT.text.amber, sentiment: 74 },
  { name: "Georgia-Pacific", sector: "INDUSTRIAL", employees: "3,400", growth: "+2.2%", impact: "LOW", color: BT.text.green, sentiment: 68 },
  { name: "Anthem / Elevance", sector: "HEALTH", employees: "5,100", growth: "+4.6%", impact: "MED", color: BT.text.green, sentiment: 76 },
];

const MSA_SIGNALS = [
  { id: "D", name: "DEMAND", score: 82, delta: "+3", weight: 30, desc: "Pop +2.1%, Employment +2.8%, Net migration +14K HH/yr. Amazon HQ expansion." },
  { id: "S", name: "SUPPLY", score: 64, delta: "-2", weight: 25, desc: "39,565 pipeline units (15.8% of stock). 14.1 mo supply. Past-peak permits." },
  { id: "M", name: "MOMENTUM", score: 78, delta: "+5", weight: 20, desc: "Rent growth accelerating +4.2% YoY. Txn velocity +14%. Concessions falling." },
  { id: "P", name: "POSITION", score: 72, delta: "+1", weight: 15, desc: "40th pctl nationally. Top quartile SE region. Institutional capital inflow." },
  { id: "R", name: "RISK", score: 28, delta: "-4", weight: 10, desc: "Affordability 30.2% approaching threshold. Insurance +8% cap helps. Score inverted." },
];

const MSA_RENT_DATA = [1820,1840,1860,1880,1920,1950,1980,2010,2050,2080,2120,2150];

const MSA_METRICS = {
  jedi: 87, d30: "+4", confidence: 84,
  rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840/qtr",
  pipeline: "39,565", pipelinePct: "15.8%", moSupply: "14.1",
  pop: "6.2M", popD: "+2.1%", jobs: "3.1M", jobsD: "+2.8%",
  medInc: "$72,400", incD: "+3.4%", afford: "30.2%",
  cap: "5.2%", capD: "-20bps", ppu: "$218K", ppuD: "+8.4%",
  cycle: "EXPANSION", cycleMonth: 38,
};


export const MSAOverviewTab: React.FC<MSAOverviewTabProps> = ({ msaId, msa }) => {
  const msaName = msa?.name || msaId || 'Atlanta';
  const msaState = msa?.state || 'GA';
  const jediScore = msa?.healthScore || MSA_METRICS.jedi;
  const props = msa?.totalProperties || 1028;
  const units = msa?.totalUnits?.toLocaleString() || "250,412";

  const M = MSA_METRICS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: BT.border.subtle }}>
      {/* MARKET PRIMER */}
      <div style={{ background: BT.bg.panel, padding: "12px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: BT.text.amber, marginBottom: 6, ...mono }}>MARKET PRIMER · {msaName.toUpperCase()}, {msaState} MSA</div>
        <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          {msaName} is a <span style={{ color: BT.text.primary, fontWeight: 600 }}>{M.pop}-person MSA</span> tracking <span style={{ color: BT.text.cyan }}>{props.toLocaleString()} properties</span> and <span style={{ color: BT.text.cyan }}>{units} units</span> across 8 submarkets.
          The market is in <span style={{ color: BT.text.green }}>month {M.cycleMonth} of an expansion cycle</span> — employment growing <span style={{ color: BT.text.green }}>{M.jobsD} YoY</span> (14th consecutive positive month), population <span style={{ color: BT.text.green }}>{M.popD}</span> (3x national avg), and median household income <span style={{ color: BT.text.green }}>{M.incD}</span>.
          Average effective rent reached <span style={{ color: BT.text.green }}>{M.rent}/mo ({M.rentD} YoY)</span> with vacancy tightening to <span style={{ color: BT.text.green }}>{M.vac}</span> — a 3-year low.
          <span style={{ color: BT.accent.amber }}> Primary risk: </span> supply pipeline is elevated at <span style={{ color: BT.accent.amber }}>{M.pipelinePct} of existing stock</span> ({M.pipeline} units), translating to <span style={{ color: BT.accent.amber }}>{M.moSupply} months of supply</span> at current absorption.
          However, absorption remains strong at <span style={{ color: BT.text.green }}>{M.absorb}</span> and permit velocity is decelerating — suggesting past-peak supply.
          <span style={{ color: BT.text.amber }}> Affordability watch: </span> rent-to-income at {M.afford}, approaching the 30% burdened threshold. Rent growth ({M.rentD}) is outpacing wage growth ({M.incD}) for 2 consecutive quarters.
          Platform JEDI Score: <span style={{ color: BT.text.green, fontWeight: 600 }}>{jediScore} ({M.d30} over 30d)</span> — Strong Opportunity. Best submarkets: Midtown (88), Decatur (83), Buckhead (84).
        </p>
      </div>

      {/* 3-COLUMN: Rent Chart | Supply-Demand | Economic Profile */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        <div style={{ background: BT.bg.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.muted, ...mono }}>AVG RENT · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["1Y","3Y","5Y"].map((pr,i) => <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 0 ? BT.text.amber : "transparent", color: i === 0 ? BT.bg.terminal : BT.text.muted, ...mono, cursor: "pointer" }}>{pr}</span>)}
            </div>
          </div>
          <OvChart data={MSA_RENT_DATA} color={BT.text.green} h={90} />
          <div style={{ marginTop: 8, borderTop: `1px solid ${BT.border.subtle}`, paddingTop: 6 }}>
            {[
              { l: "Current Avg Rent", v: M.rent }, { l: "Rent Growth YoY", v: M.rentD, c: BT.text.green },
              { l: "Avg Rent/SF", v: "$1.92" }, { l: "vs National Avg", v: "+12.4%", c: BT.text.green },
              { l: "Concession Rate", v: "2.4%" }, { l: "RevPAU (Market)", v: "$1,986" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                <span style={{ fontSize: 9, color: BT.text.muted, ...mono }}>{m.l}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: m.c || BT.text.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: BT.bg.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.cyan, ...mono }}>SUPPLY-DEMAND BALANCE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Vacancy Rate", v: M.vac, c: BT.text.green }, { l: "Net Absorption", v: M.absorb },
              { l: "Pipeline Units", v: M.pipeline }, { l: "Pipeline %", v: M.pipelinePct, c: BT.accent.amber },
              { l: "Months of Supply", v: M.moSupply, c: BT.accent.amber }, { l: "Permit Velocity", v: "-8.2% YoY", c: BT.text.green },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontSize: 9, color: BT.text.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || BT.text.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BT.border.medium}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.amber, ...mono }}>TRANSACTION ACTIVITY</span>
            <div style={{ marginTop: 4 }}>
              {[
                { l: "Avg Cap Rate", v: M.cap }, { l: "Cap Δ YoY", v: M.capD, c: BT.text.green },
                { l: "Avg $/Unit", v: M.ppu }, { l: "$/Unit Δ YoY", v: M.ppuD, c: BT.text.green },
                { l: "Txn Volume (12mo)", v: "$4.2B" }, { l: "Deals Closed", v: "127" },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${BT.border.subtle}` }}>
                  <span style={{ fontSize: 9, color: BT.text.secondary, ...sans }}>{m.l}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.c || BT.text.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: BT.bg.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.muted, ...mono }}>ECONOMIC PROFILE</span>
          <div style={{ marginTop: 8 }}>
            {[
              { l: "Population", v: M.pop }, { l: "Pop Growth", v: M.popD, c: BT.text.green },
              { l: "Employment", v: M.jobs }, { l: "Job Growth", v: M.jobsD, c: BT.text.green },
              { l: "Median HH Income", v: M.medInc }, { l: "Income Growth", v: M.incD, c: BT.text.green },
              { l: "Rent/Income Ratio", v: M.afford, c: BT.accent.amber }, { l: "Jobs/Apt Ratio", v: "5.8x" },
            ].map((m,i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontSize: 9, color: BT.text.secondary, ...sans }}>{m.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: m.c || BT.text.primary, ...mono }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${BT.border.medium}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.purple, ...mono }}>CYCLE POSITION</span>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <OvBadge label={M.cycle} color={BT.text.green} />
              <span style={{ fontSize: 9, color: BT.text.secondary, ...mono }}>Month {M.cycleMonth}</span>
            </div>
            <div style={{ marginTop: 6, height: 6, background: BT.bg.terminal, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: "65%", height: "100%", background: `linear-gradient(90deg, ${BT.text.green}, ${BT.text.amber})`, borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              {["Trough","Expansion","Peak","Contraction"].map((l,i) => <span key={i} style={{ fontSize: 7, color: BT.text.muted, ...mono }}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* JEDI Score Ring + Signal Bars */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: BT.bg.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: BT.text.muted, letterSpacing: 1.5, ...mono }}>MARKET JEDI</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${BT.text.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${BT.text.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: BT.text.green }}>{jediScore}</span>
            <span style={{ fontSize: 8, color: BT.text.green, fontWeight: 600, ...mono }}>{M.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>Conf: {M.confidence}%</span>
        </div>
        <div style={{ background: BT.bg.panel, padding: 12 }}>
          {MSA_SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: BT.text.muted, minWidth: 78, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: "0 0 120px", height: 5, background: BT.bg.terminal, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? BT.text.green : s.score >= 50 ? BT.text.amber : BT.text.red, borderRadius: 1 }} />
              </div>
              <OvScore value={s.score} size={10} />
              <OvDelta value={s.delta} />
              <span style={{ fontSize: 8, color: BT.text.muted, flex: 1, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* NEWS & INTELLIGENCE + CORPORATE HEALTH — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
        <div style={{ background: BT.bg.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${BT.border.subtle}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.amber, ...mono }}>◆ NEWS & INTELLIGENCE</span>
            <span style={{ fontSize: 7, color: BT.text.muted, ...mono }}>{NEWS_STORIES.length} stories today</span>
          </div>
          {NEWS_STORIES.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "5px 12px", borderBottom: `1px solid ${BT.border.subtle}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ fontSize: 8, color: BT.text.muted, minWidth: 32, flexShrink: 0, ...mono }}>{n.time}</span>
              <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: n.tagColor, background: n.tagColor + "18", border: `1px solid ${n.tagColor}33`, padding: "0px 4px", flexShrink: 0, alignSelf: "flex-start", marginTop: 1 }}>{n.tag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: BT.text.primary, lineHeight: 1.4, ...sans }}>{n.headline}</div>
                <div style={{ fontSize: 7, color: BT.text.muted, marginTop: 1, ...mono }}>{n.source}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: BT.bg.panel }}>
          <div style={{ padding: "6px 12px", borderBottom: `1px solid ${BT.border.subtle}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: BT.text.cyan, ...mono }}>◈ CORPORATE HEALTH · TOP EMPLOYERS</span>
            <span style={{ fontSize: 7, color: BT.text.muted, ...mono }}>{msaName} MSA</span>
          </div>
          <div style={{ display: "flex", background: BT.bg.header, borderBottom: `1px solid ${BT.border.medium}` }}>
            {[{ l: "Employer", w: 130 },{ l: "Sector", w: 70 },{ l: "Employees", w: 65 },{ l: "Growth", w: 52 },{ l: "Impact", w: 48 },{ l: "Sent.", w: 38 }].map((c,i) => (
              <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: BT.text.muted, letterSpacing: 0.5, borderRight: i < 5 ? `1px solid ${BT.border.subtle}` : "none", ...mono }}>{c.l}</div>
            ))}
          </div>
          {CORP_HEALTH.map((c, i) => (
            <div key={i} style={{ display: "flex", background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}`, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt)}>
              <div style={{ width: 130, minWidth: 130, padding: "4px 6px", borderRight: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: BT.text.primary, ...sans }}>{c.name}</span>
              </div>
              <div style={{ width: 70, minWidth: 70, padding: "4px 6px", borderRight: `1px solid ${BT.border.subtle}` }}>
                <OvBadge label={c.sector} color={BT.text.muted} />
              </div>
              <div style={{ width: 65, minWidth: 65, padding: "4px 6px", borderRight: `1px solid ${BT.border.subtle}` }}>
                <span style={{ fontSize: 9, color: BT.text.primary, ...mono }}>{c.employees}</span>
              </div>
              <div style={{ width: 52, minWidth: 52, padding: "4px 6px", borderRight: `1px solid ${BT.border.subtle}` }}>
                <OvDelta value={c.growth} />
              </div>
              <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${BT.border.subtle}` }}>
                <OvBadge label={c.impact} color={c.color} />
              </div>
              <div style={{ width: 38, minWidth: 38, padding: "4px 6px", display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 20, height: 4, background: BT.bg.terminal, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${c.sentiment}%`, height: "100%", background: c.sentiment >= 75 ? BT.text.green : c.sentiment >= 60 ? BT.text.amber : BT.text.red, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 7, color: BT.text.muted, ...mono }}>{c.sentiment}</span>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 12px", borderTop: `1px solid ${BT.border.medium}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 8, color: BT.text.muted, ...mono }}>Aggregate Employment: 78,700</span>
            <span style={{ fontSize: 8, color: BT.text.green, ...mono }}>Wtd. Growth: +4.8%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MSAOverviewTab;
