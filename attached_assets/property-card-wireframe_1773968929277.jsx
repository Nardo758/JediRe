import { useState } from "react";

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  blue: "#3B82F6", blueBg: "#1e3a5f",
  borderS: "#1E2538", borderM: "#2A3348",
};
const mono = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans = { fontFamily: "'IBM Plex Sans',sans-serif" };

// ─── PROPERTY DATA ──────────────────────────────────────────
const PROP = {
  name: "Summit Ridge Apartments", addr: "4200 Summit Ridge Pkwy, Tampa, FL 33615",
  sub: "Westshore", msa: "Tampa, FL", county: "Hillsborough",
  type: "240-Unit Class B+ Multifamily", year: 1998, stories: 3, buildings: 12,
  parcel: "A-09-29-18-3DB-000000-00025.0", lotAc: 8.0, lotSf: "348,480",
  zoning: "RM-24 (Residential Multi-Family)", assessedVal: "$38.2M",
  lastSale: "$32.4M (2019)", parking: "380 spaces (1.58/unit) · Surface",
  owner: "Greystone Capital Partners", manager: "Lincoln Property Co.",
  acquired: "Mar 2019", acqPrice: "$32.4M", estDebt: "$22.7M (Agency)", debtMat: "Mar 2029",
  jedi: 86, d30: "+3", confidence: 87, dataComplete: 78,
  pcs: 82, pcsRank: 8, pcsSub: 47, pcsMove: "↑3",
  rent: "$1,385", rentD: "+3.8%", rentPsf: "$1.92", rentPrem: "+1.4%",
  occ: "92.4%", econOcc: "89.8%", revpau: "$1,312",
  noi: "$2.34M", cap: "5.2%", ppu: "$188K", psf: "$227",
  vac: "7.6%", absorb: "2.1%/qtr", concession: "2.8%",
  irr: "18.4%", em: "2.1x", coc: "8.2%", dscr: "1.32x",
  units: 240, sqft: "198,000", review: 4.1, reviewCt: 187,
  strat: "RENTAL", arbGap: 8,
};

const SIGNALS = [
  { id: "D", name: "DEMAND", score: 82, delta: "+3", weight: 30, color: T.green, desc: "Amazon HQ expansion +2K jobs. Net migration +3,200 HH/yr." },
  { id: "S", name: "SUPPLY", score: 64, delta: "-2", weight: 25, color: T.red, desc: "1,200 pipeline units within 3mi. 15.8% of existing stock." },
  { id: "M", name: "MOMENTUM", score: 78, delta: "+5", weight: 20, color: T.orange, desc: "Rent growth accelerating +3.8% YoY. Txn velocity up 14%." },
  { id: "P", name: "POSITION", score: 72, delta: "+1", weight: 15, color: T.purple, desc: "PCS rank #8 of 47 in submarket. Review score 4.1/5." },
  { id: "R", name: "RISK", score: 28, delta: "-4", weight: 10, color: T.muted, desc: "Insurance risk rising. FL wind zone but inland. Score inverted." },
];

const RENT_HISTORY = [1180,1200,1220,1240,1250,1265,1280,1300,1320,1340,1360,1385];
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const COMPS = [
  { name: "Summit Ridge Apts", sub: "Westshore", units: 240, year: 1998, rent: "$1,385", rentD: "+3.8%", occ: "92.4%", cap: "5.2%", ppu: "$188K", review: 4.1, isSubject: true },
  { name: "Westshore Landings", sub: "Westshore", units: 312, year: 2004, rent: "$1,520", rentD: "+2.4%", occ: "94.8%", cap: "4.8%", ppu: "$215K", review: 4.3 },
  { name: "Bay Crest Park", sub: "Westshore", units: 198, year: 1996, rent: "$1,290", rentD: "+4.2%", occ: "93.2%", cap: "5.6%", ppu: "$172K", review: 3.8 },
  { name: "Camden Westchase", sub: "Westchase", units: 408, year: 2018, rent: "$1,820", rentD: "+1.8%", occ: "95.4%", cap: "4.4%", ppu: "$268K", review: 4.5 },
  { name: "Arbor Reserve", sub: "Westshore", units: 176, year: 2001, rent: "$1,340", rentD: "+3.2%", occ: "91.8%", cap: "5.4%", ppu: "$178K", review: 3.9 },
  { name: "The Cove at Rocky Pt", sub: "Rocky Point", units: 284, year: 2010, rent: "$1,680", rentD: "+2.8%", occ: "94.2%", cap: "4.6%", ppu: "$232K", review: 4.2 },
  { name: "Palms at Gandy", sub: "S Tampa", units: 220, year: 1994, rent: "$1,260", rentD: "+5.1%", occ: "90.4%", cap: "5.8%", ppu: "$158K", review: 3.5 },
  { name: "Avana Bayshore", sub: "S Tampa", units: 352, year: 2020, rent: "$2,140", rentD: "+0.8%", occ: "93.6%", cap: "4.2%", ppu: "$298K", review: 4.6 },
];

const COMP_MEDIAN = { rent: "$1,500", rentD: "+3.0%", occ: "93.4%", cap: "5.1%", ppu: "$205K", review: 4.1 };

const NEWS = [
  { time: "2d", src: "TBB", hl: "Amazon announces 2,000-job Tampa HQ expansion near Westshore", impact: "+DEMAND", pts: "+3.2" },
  { time: "5d", src: "CBRE", hl: "Greystar breaks ground 380-unit tower 1.2mi from subject", impact: "+SUPPLY", pts: "-1.8" },
  { time: "1w", src: "GOV", hl: "FL Legislature passes insurance reform, 8% rate cap", impact: "RISK DN", pts: "+1.2" },
  { time: "2w", src: "CRE", hl: "Westshore District vacancy falls to 5.8% — 3yr low", impact: "+POSITION", pts: "+0.8" },
  { time: "3w", src: "BLS", hl: "Tampa MSA employment +2.8% YoY, 14th consecutive month positive", impact: "+DEMAND", pts: "+1.4" },
];

// ─── HELPERS ────────────────────────────────────────────────
function Spark({ data, color = T.green, w = 52, h = 14 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}
function Badge({ label, color }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}
function ScoreCell({ value, size = 11 }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? T.green : n >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}
function DeltaCell({ value }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith("+"); const neg = s.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? T.green : neg ? T.red : T.muted, ...mono }}>{s}</span>;
}
function MiniChart({ data, color = T.green, w = "100%", h = 80 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = h - 8 - ((v - mn) / r) * (h - 16);
    return `${x}%,${y}`;
  }).join(" ");
  const area = pts + ` 100%,${h} 0%,${h}`;
  return (
    <svg width={w} height={h} style={{ display: "block" }} preserveAspectRatio="none" viewBox={`0 0 100 ${h}`}>
      <polygon points={area} fill={color + "12"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
function KV({ label, value, valueColor, mono: useMono }) {
  return (
    <div style={{ padding: "5px 0", borderBottom: `1px solid ${T.borderS}` }}>
      <span style={{ fontSize: 9, color: T.muted, ...mono }}>{label}</span>
      <div style={{ fontSize: 12, fontWeight: 600, color: valueColor || T.primary, ...(useMono ? mono : sans) }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW — Bloomberg [1] OVERVIEW equivalent
// ═══════════════════════════════════════════════════════════════
function OverviewTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.borderS, flex: 1, overflow: "auto" }}>
      {/* ── SUMMARY PRIMER (like Bloomberg's BI Research Primer) ── */}
      <div style={{ background: T.panel, padding: "12px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.amber, marginBottom: 6, ...mono }}>PROPERTY PRIMER</div>
        <p style={{ fontSize: 11, color: T.secondary, lineHeight: 1.7, margin: 0, ...sans }}>
          Summit Ridge is a <span style={{ color: T.primary, fontWeight: 600 }}>240-unit Class B+ multifamily</span> asset in Tampa's Westshore submarket, built in 1998 across 12 buildings on 8 acres.
          Current rents average <span style={{ color: T.green }}>$1,385/mo (+3.8% YoY)</span> with <span style={{ color: T.amber }}>92.4% physical occupancy</span>.
          The property trades at a <span style={{ color: T.primary }}>+1.4% rent premium</span> to submarket median, justified by recent $3.2M renovation ($13.3K/unit).
          The submarket is in <span style={{ color: T.green }}>expansion phase</span> — Amazon's 2,000-job HQ expansion is the primary demand catalyst, though 1,200 pipeline units within 3mi present moderate supply risk.
          Platform recommends <span style={{ color: T.purple }}>Rental hold strategy</span> with a projected <span style={{ color: T.green }}>18.4% IRR</span> and 2.1x equity multiple over 5yr hold.
          <span style={{ color: T.amber }}> Arbitrage gap is 8pts</span> — no alternative strategy significantly outperforms rental for this stabilized asset.
        </p>
      </div>

      {/* ── ROW: Rent Chart + Key Metrics + Corporate Info ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
        {/* 8) Rent Chart (like Price Chart) */}
        <div style={{ background: T.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>RENT HISTORY · 12MO</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["6M","1Y","3Y","5Y"].map((p,i) => (
                <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 1 ? T.amber : "transparent", color: i === 1 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>
              ))}
            </div>
          </div>
          <MiniChart data={RENT_HISTORY} color={T.green} h={100} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {MONTHS.filter((_,i)=>i%3===0).map((m,i) => <span key={i} style={{ fontSize: 7, color: T.muted, ...mono }}>{m}</span>)}
          </div>
          <div style={{ marginTop: 8, borderTop: `1px solid ${T.borderS}`, paddingTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {[
                { l: "Rent/Unit (Current)", v: PROP.rent },
                { l: "52wk High", v: "$1,395" },
                { l: "Rent/SF", v: PROP.rentPsf },
                { l: "52wk Low", v: "$1,180" },
                { l: "YTD Change", v: PROP.rentD, c: T.green },
                { l: "vs Submarket", v: PROP.rentPrem, c: T.green },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span style={{ fontSize: 9, color: T.muted, ...mono }}>{m.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: m.c || T.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 9) Estimates / Operating Metrics (like Estimates | EE) */}
        <div style={{ background: T.panel, padding: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.cyan, borderBottom: `1px solid ${T.cyan}`, paddingBottom: 2, ...mono }}>OPERATING METRICS</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0 }}>
            {[
              { l: "NOI", v: PROP.noi },
              { l: "Cap Rate", v: PROP.cap },
              { l: "DSCR", v: PROP.dscr },
              { l: "Physical Occ", v: PROP.occ },
              { l: "Economic Occ", v: PROP.econOcc },
              { l: "RevPAU", v: PROP.revpau },
              { l: "Concession Rate", v: PROP.concession },
            ].map((m,i) => (
              <React.Fragment key={i}>
                <div style={{ padding: "4px 8px 4px 0", fontSize: 9, color: T.secondary, borderBottom: `1px solid ${T.borderS}`, ...sans }}>{m.l}</div>
                <div style={{ padding: "4px 0", fontSize: 10, fontWeight: 600, color: T.primary, textAlign: "right", borderBottom: `1px solid ${T.borderS}`, ...mono }}>{m.v}</div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 10, padding: "8px 0", borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.amber, ...mono }}>RETURNS</span>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0, marginTop: 4 }}>
              {[
                { l: "Proj. IRR", v: PROP.irr, c: T.green },
                { l: "Equity Multiple", v: PROP.em, c: T.green },
                { l: "Cash-on-Cash", v: PROP.coc, c: T.green },
              ].map((m,i) => (
                <React.Fragment key={i}>
                  <div style={{ padding: "3px 8px 3px 0", fontSize: 9, color: T.secondary, ...sans }}>{m.l}</div>
                  <div style={{ padding: "3px 0", fontSize: 10, fontWeight: 700, color: m.c, textAlign: "right", ...mono }}>{m.v}</div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 13-17) Corporate Info / Ownership (like Corporate Info + Management) */}
        <div style={{ background: T.panel, padding: 14 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>PROPERTY INFO</span>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 0, marginTop: 6 }}>
            {[
              { l: "Address", v: PROP.addr },
              { l: "County", v: PROP.county },
              { l: "Parcel ID", v: PROP.parcel },
              { l: "Zoning", v: PROP.zoning },
              { l: "Year Built", v: String(PROP.year) },
              { l: "Units / SF", v: `${PROP.units} / ${PROP.sqft}` },
              { l: "Lot Size", v: `${PROP.lotAc} ac (${PROP.lotSf} SF)` },
              { l: "Parking", v: PROP.parking },
              { l: "Assessed Value", v: PROP.assessedVal },
              { l: "Last Sale", v: PROP.lastSale },
            ].map((m,i) => (
              <React.Fragment key={i}>
                <div style={{ padding: "3px 8px 3px 0", fontSize: 8, color: T.muted, borderBottom: `1px solid ${T.borderS}`, ...mono }}>{m.l}</div>
                <div style={{ padding: "3px 0", fontSize: 9, color: T.primary, borderBottom: `1px solid ${T.borderS}`, ...mono }}>{m.v}</div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.borderM}` }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.purple, ...mono }}>OWNERSHIP & MGMT</span>
            <div style={{ marginTop: 6 }}>
              {[
                { l: "Owner", v: PROP.owner },
                { l: "Manager", v: PROP.manager },
                { l: "Acquired", v: PROP.acquired },
                { l: "Acq. Price", v: PROP.acqPrice },
                { l: "Est. Debt", v: PROP.estDebt },
                { l: "Debt Maturity", v: PROP.debtMat },
              ].map((m,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.borderS}` }}>
                  <span style={{ fontSize: 8, color: T.muted, ...mono }}>{m.l}</span>
                  <span style={{ fontSize: 9, color: T.primary, ...mono }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── JEDI Score + Signals ── */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 1 }}>
        <div style={{ background: T.panel, padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 8, color: T.muted, letterSpacing: 1.5, ...mono }}>JEDI SCORE</div>
          <div style={{ width: 80, height: 80, borderRadius: "50%", border: `3px solid ${T.green}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 16px ${T.green}33` }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: T.green }}>{PROP.jedi}</span>
            <span style={{ fontSize: 8, color: T.green, fontWeight: 600, ...mono }}>{PROP.d30} 30d</span>
          </div>
          <span style={{ fontSize: 8, color: T.muted, ...mono }}>Conf: {PROP.confidence}%</span>
          <Spark data={RENT_HISTORY} color={T.green} w={100} h={20} />
        </div>
        <div style={{ background: T.panel, padding: 12 }}>
          {SIGNALS.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 8, color: T.muted, minWidth: 80, ...mono }}>{s.name} ({s.weight}%)</span>
              <div style={{ flex: 1, height: 5, background: T.bg, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: s.score >= 70 ? T.green : s.score >= 50 ? T.amber : T.red, borderRadius: 1 }} />
              </div>
              <ScoreCell value={s.score} size={10} />
              <DeltaCell value={s.delta} />
              <span style={{ fontSize: 8, color: T.muted, flex: 1.5, ...sans }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── NEWS FEED (like Bloomberg bottom news) ── */}
      <div style={{ background: T.panel }}>
        <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>RELATED NEWS · {NEWS.length} ITEMS</span>
        </div>
        {NEWS.map((n,i) => (
          <div key={i} style={{ display: "flex", gap: 8, padding: "5px 12px", borderBottom: `1px solid ${T.borderS}`, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = T.hover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontSize: 8, color: T.muted, minWidth: 24, ...mono }}>{n.time}</span>
            <span style={{ fontSize: 8, color: T.cyan, minWidth: 28, ...mono }}>{n.src}</span>
            <span style={{ fontSize: 9, color: T.primary, flex: 1, ...sans }}>{n.hl}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: n.impact.includes("+") || n.impact.includes("DN") ? T.green : T.red, minWidth: 56, textAlign: "right", ...mono }}>{n.impact}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: n.pts.startsWith("+") ? T.green : T.red, minWidth: 32, textAlign: "right", ...mono }}>{n.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: REL VALUE — Bloomberg [4] REL VALUE equivalent
// ═══════════════════════════════════════════════════════════════
function RelValueTab() {
  // Normalized rent overlay data (indexed to 100)
  const compLines = [
    { name: "Summit Ridge", color: T.amber, data: [100,101.7,103.4,105.1,105.9,107.2,108.5,110.2,111.9,113.6,115.3,117.4] },
    { name: "Westshore Land.", color: T.cyan, data: [100,100.8,101.6,102.4,102.8,103.6,104.4,105.2,106.0,106.8,107.2,108.0] },
    { name: "Bay Crest Park", color: T.green, data: [100,101.2,102.8,104.2,105.4,106.8,108.2,109.8,111.2,112.8,114.2,116.0] },
    { name: "Camden Westchase", color: T.purple, data: [100,100.4,100.8,101.2,101.4,101.8,102.2,102.6,103.0,103.4,103.6,104.0] },
    { name: "Arbor Reserve", color: T.orange, data: [100,101.0,102.0,103.0,103.6,104.6,105.6,106.6,107.6,108.6,109.6,110.8] },
    { name: "Submarket Avg", color: T.muted, data: [100,100.8,101.6,102.6,103.2,104.2,105.2,106.2,107.2,108.2,109.2,110.4] },
  ];
  const allVals = compLines.flatMap(c => c.data);
  const mx = Math.max(...allVals), mn = Math.min(...allVals);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.borderS, flex: 1, overflow: "auto" }}>
      {/* Normalized Rent Overlay */}
      <div style={{ background: T.panel, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>NORMALIZED RENT OVERLAY (Base 100) · 12MO</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["6M","1Y","3Y"].map((p,i) => (
              <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 1 ? T.amber : "transparent", color: i === 1 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>
            ))}
          </div>
        </div>
        <svg width="100%" height={140} viewBox="0 0 400 140" preserveAspectRatio="none" style={{ display: "block" }}>
          {/* Grid lines */}
          {[100,105,110,115,120].map((v,i) => {
            const y = 130 - ((v - mn) / (mx - mn)) * 120;
            return <React.Fragment key={i}>
              <line x1="0" y1={y} x2="400" y2={y} stroke={T.borderS} strokeWidth="0.5" />
              <text x="2" y={y - 2} fill={T.muted} fontSize="6" fontFamily="JetBrains Mono">{v}</text>
            </React.Fragment>;
          })}
          {/* Lines */}
          {compLines.map((c, ci) => {
            const pts = c.data.map((v,i) => `${(i / 11) * 396 + 2},${130 - ((v - mn) / (mx - mn)) * 120}`).join(" ");
            return <polyline key={ci} points={pts} fill="none" stroke={c.color} strokeWidth={c.name === "Summit Ridge" ? "2" : "1"} strokeDasharray={c.name === "Submarket Avg" ? "4 2" : "none"} opacity={c.name === "Summit Ridge" ? 1 : 0.7} />;
          })}
        </svg>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {compLines.map((c,i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 12, height: 2, background: c.color, borderRadius: 1 }} />
              <span style={{ fontSize: 8, color: c.color, ...mono }}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Peer Comparison Table (like Bloomberg's) */}
      <div style={{ background: T.panel }}>
        <div style={{ padding: "6px 12px", borderBottom: `1px solid ${T.borderS}` }}>
          <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>PEER COMPARISON · {COMPS.length} COMPS</span>
        </div>
        {/* Header */}
        <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}` }}>
          {[{ l: "Name (Comp Set)", w: 160 },{ l: "Units", w: 48 },{ l: "Year", w: 44 },{ l: "Rent", w: 60 },{ l: "Rent Δ", w: 52 },{ l: "Occ", w: 48 },{ l: "Cap", w: 44 },{ l: "$/Unit", w: 56 },{ l: "Review", w: 44 }].map((c,i) => (
            <div key={i} style={{ width: c.w, minWidth: c.w, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, ...mono, flexShrink: 0 }}>{c.l}</div>
          ))}
        </div>
        {/* Median row */}
        <div style={{ display: "flex", background: T.amber + "08", borderBottom: `1px solid ${T.amber}33` }}>
          <div style={{ width: 160, minWidth: 160, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>Median</span></div>
          <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></div>
          <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></div>
          {[COMP_MEDIAN.rent, COMP_MEDIAN.rentD, COMP_MEDIAN.occ, COMP_MEDIAN.cap, COMP_MEDIAN.ppu, COMP_MEDIAN.review].map((v,i) => (
            <div key={i} style={{ width: [60,52,48,44,56,44][i], minWidth: [60,52,48,44,56,44][i], padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: T.amber, ...mono }}>{v}</span>
            </div>
          ))}
        </div>
        {/* Comp rows */}
        {COMPS.map((c,i) => (
          <div key={i} style={{ display: "flex", background: c.isSubject ? T.amber + "0A" : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, borderLeft: c.isSubject ? `2px solid ${T.amber}` : "2px solid transparent", cursor: "pointer" }}
            onMouseEnter={e => { if (!c.isSubject) e.currentTarget.style.background = T.hover; }}
            onMouseLeave={e => { if (!c.isSubject) e.currentTarget.style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}>
            <div style={{ width: 160, minWidth: 160, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}>
              <span style={{ fontSize: 8, color: T.muted, ...mono }}>{String(100 + i + 1).padStart(3, '0')}) </span>
              <span style={{ fontSize: 9, fontWeight: c.isSubject ? 700 : 500, color: c.isSubject ? T.amberBright : T.primary, ...sans }}>{c.name}</span>
            </div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.units}</span></div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.year}</span></div>
            <div style={{ width: 60, minWidth: 60, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{c.rent}</span></div>
            <div style={{ width: 52, minWidth: 52, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><DeltaCell value={c.rentD} /></div>
            <div style={{ width: 48, minWidth: 48, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.occ}</span></div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.cap}</span></div>
            <div style={{ width: 56, minWidth: 56, padding: "4px 6px", borderRight: `1px solid ${T.borderS}` }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.ppu}</span></div>
            <div style={{ width: 44, minWidth: 44, padding: "4px 6px" }}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{c.review}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: REL INDEX — Bloomberg [3] REL INDEX equivalent
// ═══════════════════════════════════════════════════════════════
function RelIndexTab() {
  // Scatter data: X = submarket rent growth, Y = property rent growth (monthly)
  const scatterPts = [
    {x:-2.1,y:-3.4},{x:-0.8,y:-1.2},{x:0.2,y:0.4},{x:0.4,y:0.8},{x:0.6,y:1.2},
    {x:0.8,y:0.6},{x:1.0,y:1.8},{x:1.2,y:2.2},{x:0.4,y:0.2},{x:1.4,y:2.8},
    {x:0.6,y:1.0},{x:1.8,y:3.2},{x:0.8,y:1.4},{x:2.0,y:3.6},{x:1.2,y:1.8},
    {x:2.2,y:4.0},{x:1.6,y:2.4},{x:1.0,y:1.6},{x:2.4,y:3.8},{x:0.2,y:-0.4},
    {x:1.8,y:2.6},{x:2.6,y:4.4},{x:-1.4,y:-2.8},{x:0.8,y:1.2},
  ];

  const stats = [
    { l: "Y =", v: "Property (Summit Ridge)" },
    { l: "X =", v: "Submarket (Westshore)" },
    { l: "", v: "" },
    { l: "Linear Beta", v: "1.62" },
    { l: "Raw Beta", v: "1.58" },
    { l: "Adjusted Beta", v: "1.39" },
    { l: "Alpha (Intercept)", v: "+0.42%" },
    { l: "R² (Correlation²)", v: "0.82" },
    { l: "R (Correlation)", v: "0.91" },
    { l: "Std Dev of Error", v: "0.48" },
    { l: "t-Test", v: "9.84" },
    { l: "Significance", v: "<0.001" },
    { l: "Number of Points", v: "24" },
  ];

  const chartW = 340, chartH = 240, padL = 40, padB = 24, padT = 10, padR = 10;
  const xMin = -3, xMax = 3, yMin = -4, yMax = 5;
  const toX = (v) => padL + ((v - xMin) / (xMax - xMin)) * (chartW - padL - padR);
  const toY = (v) => padT + ((yMax - v) / (yMax - yMin)) * (chartH - padT - padB);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.borderS, flex: 1, overflow: "auto" }}>
      {/* Scatter + Stats panel */}
      <div style={{ display: "flex", gap: 1 }}>
        {/* Scatter plot */}
        <div style={{ flex: 1, background: T.panel, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 9, letterSpacing: 1, color: T.muted, ...mono }}>RENT GROWTH REGRESSION · PROPERTY vs SUBMARKET</span>
            <div style={{ display: "flex", gap: 4 }}>
              {["6M","1Y","2Y"].map((p,i) => (
                <span key={i} style={{ fontSize: 7, padding: "1px 4px", background: i === 1 ? T.amber : "transparent", color: i === 1 ? T.bg : T.muted, ...mono, cursor: "pointer" }}>{p}</span>
              ))}
            </div>
          </div>
          {/* Regression equation */}
          <div style={{ display: "inline-block", padding: "3px 8px", background: T.amber + "15", border: `1px solid ${T.amber}40`, marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: T.amber, fontWeight: 600, ...mono }}>Y = 1.62·X + 0.42</span>
          </div>
          <svg width={chartW} height={chartH} style={{ display: "block" }}>
            {/* Grid */}
            {[-2,-1,0,1,2].map(v => <line key={`gx${v}`} x1={toX(v)} y1={padT} x2={toX(v)} y2={chartH-padB} stroke={T.borderS} strokeWidth="0.5" />)}
            {[-2,0,2,4].map(v => <line key={`gy${v}`} x1={padL} y1={toY(v)} x2={chartW-padR} y2={toY(v)} stroke={T.borderS} strokeWidth="0.5" />)}
            {/* Axis labels */}
            {[-2,-1,0,1,2].map(v => <text key={`lx${v}`} x={toX(v)} y={chartH - 4} fill={T.muted} fontSize="7" textAnchor="middle" fontFamily="JetBrains Mono">{v}%</text>)}
            {[-2,0,2,4].map(v => <text key={`ly${v}`} x={padL - 4} y={toY(v) + 3} fill={T.muted} fontSize="7" textAnchor="end" fontFamily="JetBrains Mono">{v}%</text>)}
            {/* Zero lines */}
            <line x1={toX(0)} y1={padT} x2={toX(0)} y2={chartH-padB} stroke={T.borderM} strokeWidth="1" />
            <line x1={padL} y1={toY(0)} x2={chartW-padR} y2={toY(0)} stroke={T.borderM} strokeWidth="1" />
            {/* Regression line */}
            <line x1={toX(xMin)} y1={toY(1.62 * xMin + 0.42)} x2={toX(xMax)} y2={toY(1.62 * xMax + 0.42)} stroke={T.red} strokeWidth="1.5" />
            {/* Points */}
            {scatterPts.map((p,i) => (
              <circle key={i} cx={toX(p.x)} cy={toY(p.y)} r={3} fill={T.amber} opacity={0.85} />
            ))}
            {/* Axis titles */}
            <text x={chartW / 2} y={chartH - 0} fill={T.secondary} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono">Westshore Submarket Rent Growth (%)</text>
            <text x={10} y={chartH / 2} fill={T.secondary} fontSize="8" textAnchor="middle" fontFamily="JetBrains Mono" transform={`rotate(-90, 10, ${chartH/2})`}>Summit Ridge Rent Growth (%)</text>
          </svg>
        </div>

        {/* Stats panel (right side like Bloomberg) */}
        <div style={{ width: 220, background: T.blueBg, padding: 14, flexShrink: 0 }}>
          {stats.map((s,i) => {
            if (!s.l && !s.v) return <div key={i} style={{ height: 8 }} />;
            const isHeader = s.l === "Y =" || s.l === "X =";
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: i > 1 ? `1px solid ${T.borderS}` : "none" }}>
                <span style={{ fontSize: 9, color: isHeader ? T.cyan : T.secondary, fontWeight: isHeader ? 600 : 400, ...mono }}>{s.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: isHeader ? T.green : T.primary, ...mono }}>{s.v}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Normalized Rent Overlay (bottom chart like Bloomberg) */}
      <div style={{ background: T.panel, padding: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 1, color: T.muted, marginBottom: 8, ...mono }}>NORMALIZED RENT OVERLAY (Base 100) · Monthly 1Y · {MONTHS[0]}/25 – {MONTHS[11]}/26</div>
        <svg width="100%" height={60} viewBox="0 0 400 60" preserveAspectRatio="none" style={{ display: "block" }}>
          {/* Subject line (property) */}
          <polyline points={[100,101.7,103.4,105.1,105.9,107.2,108.5,110.2,111.9,113.6,115.3,117.4].map((v,i) => `${(i/11)*396+2},${55-((v-98)/22)*50}`).join(" ")} fill="none" stroke={T.amber} strokeWidth="2" />
          {/* Submarket line */}
          <polyline points={[100,100.8,101.6,102.6,103.2,104.2,105.2,106.2,107.2,108.2,109.2,110.4].map((v,i) => `${(i/11)*396+2},${55-((v-98)/22)*50}`).join(" ")} fill="none" stroke={T.muted} strokeWidth="1" />
        </svg>
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 2, background: T.amber }} />
            <span style={{ fontSize: 8, color: T.amber, ...mono }}>Summit Ridge (Base 100)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 12, height: 2, background: T.muted }} />
            <span style={{ fontSize: 8, color: T.muted, ...mono }}>Westshore Submarket (Base 100)</span>
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div style={{ background: T.amber + "08", borderLeft: `3px solid ${T.amber}`, padding: 12 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>INTERPRETATION: </span>
        <span style={{ fontSize: 10, color: T.secondary, ...sans }}>
          Beta of 1.62 means Summit Ridge amplifies submarket rent movements by 62% — when Westshore rents rise 1%, this property rises 1.62%.
          Alpha of +0.42% indicates persistent outperformance vs submarket (management premium or location premium).
          R² of 0.82 = strong correlation — this property tracks its submarket closely.
          <span style={{ color: T.green, fontWeight: 600 }}> High beta + positive alpha = aggressive growth asset.</span>
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PROPERTY CARD
// ═══════════════════════════════════════════════════════════════
const PROP_TABS = [
  { id: "overview", label: "[1] Overview" },
  { id: "relvalue", label: "[4] Rel Value" },
  { id: "relindex", label: "[3] Rel Index" },
];

export default function PropertyCard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column", color: T.primary, overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');*{scrollbar-width:thin;scrollbar-color:${T.borderM} ${T.bg}}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.borderM}}`}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, padding: "0 10px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, letterSpacing: 2, ...mono }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.secondary, ...mono }}>PROPERTY CARD</span>
        </div>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>Power Rankings → Property Detail</span>
      </div>

      {/* PROPERTY QUOTE BAR (like Bloomberg's stock quote line) */}
      <div style={{ padding: "4px 10px", background: T.panel, borderBottom: `1px solid ${T.borderM}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: T.amberBright, ...sans }}>{PROP.name}</span>
        <span style={{ fontSize: 10, color: T.secondary, ...sans }}>{PROP.type}</span>
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.green, ...mono }}>{PROP.rent}</span>
        <DeltaCell value={PROP.rentD} />
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>PCS Rank</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.amber, ...mono }}>#{PROP.pcsRank}</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>of {PROP.pcsSub}</span>
        <span style={{ fontSize: 9, color: T.green, fontWeight: 600, ...mono }}>{PROP.pcsMove}</span>
        <span style={{ fontSize: 8, color: T.muted }}>|</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>JEDI</span>
        <ScoreCell value={PROP.jedi} size={12} />
        <DeltaCell value={PROP.d30} />
        <div style={{ flex: 1 }} />
        <Badge label={PROP.strat} color={T.purple} />
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>Arb: {PROP.arbGap}pts</span>
      </div>

      {/* TAB BAR (like Bloomberg's [0] HOME [1] OVERVIEW [2] ANALYSIS ...) */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, background: T.header }}>
        {PROP_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            ...mono, fontSize: 9, fontWeight: 600, padding: "0 14px", height: 28, cursor: "pointer",
            background: activeTab === tab.id ? T.amber : "transparent",
            color: activeTab === tab.id ? T.bg : T.secondary,
            border: "none", whiteSpace: "nowrap",
          }}>{tab.label}</button>
        ))}
        {["[2] Analysis", "[5] News", "[6] Ownership"].map((l,i) => (
          <button key={i} style={{ ...mono, fontSize: 9, fontWeight: 600, padding: "0 14px", height: 28, cursor: "pointer", background: "transparent", color: T.muted, border: "none", whiteSpace: "nowrap" }}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted, padding: "0 10px", ...mono }}>Press 0-6 to navigate · Type address to search</span>
      </div>

      {/* TAB CONTENT */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "relvalue" && <RelValueTab />}
        {activeTab === "relindex" && <RelIndexTab />}
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>📍 {PROP.addr} · {PROP.sub}, {PROP.msa} · {PROP.county} County</span>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>PCS #{PROP.pcsRank}/{PROP.pcsSub} · JEDI {PROP.jedi} · {PROP.units} units · Built {PROP.year}</span>
      </div>
    </div>
  );
}
