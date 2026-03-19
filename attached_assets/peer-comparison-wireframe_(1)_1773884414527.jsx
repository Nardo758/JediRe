import { useState } from "react";

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  borderS: "#1E2538", borderM: "#2A3348",
};
const mono = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans = { fontFamily: "'IBM Plex Sans',sans-serif" };

const MSA_DATA = [
  { name:"Atlanta, GA", props:1028, units:"250K", jedi:87, d30:"+4", trend:[78,80,81,82,83,84,85,86,87], rent:"$2,150", rentD:"+4.2%", vac:"5.8%", absorb:"2,840", pipeline:"15.8%", constraint:58, jobs:5.8, pop:"+2.1%", medInc:"$72,400", cap:"5.2%", cycle:"EXPANSION" },
  { name:"Raleigh, NC", props:480, units:"98K", jedi:85, d30:"+3", trend:[77,78,80,81,82,83,84,84,85], rent:"$1,740", rentD:"+3.9%", vac:"6.2%", absorb:"1,120", pipeline:"11.8%", constraint:72, jobs:5.5, pop:"+2.8%", medInc:"$78,200", cap:"5.0%", cycle:"EXPANSION" },
  { name:"Tampa, FL", props:892, units:"215K", jedi:82, d30:"+2", trend:[74,75,76,77,78,79,80,81,82], rent:"$1,908", rentD:"+3.0%", vac:"6.5%", absorb:"2,150", pipeline:"13.4%", constraint:64, jobs:5.2, pop:"+1.9%", medInc:"$65,800", cap:"5.4%", cycle:"LATE EXP" },
  { name:"Orlando, FL", props:714, units:"178K", jedi:78, d30:"+1", trend:[72,73,74,74,75,76,77,77,78], rent:"$1,820", rentD:"+2.4%", vac:"7.1%", absorb:"1,680", pipeline:"16.2%", constraint:48, jobs:4.9, pop:"+1.7%", medInc:"$62,400", cap:"5.6%", cycle:"PEAK" },
  { name:"Miami, FL", props:1245, units:"310K", jedi:74, d30:"-2", trend:[80,79,78,77,76,75,75,74,74], rent:"$2,480", rentD:"+1.2%", vac:"8.4%", absorb:"1,920", pipeline:"18.6%", constraint:38, jobs:4.4, pop:"+0.8%", medInc:"$58,900", cap:"4.8%", cycle:"PEAK" },
  { name:"Jacksonville, FL", props:386, units:"82K", jedi:80, d30:"+5", trend:[70,72,73,74,75,76,77,79,80], rent:"$1,580", rentD:"+3.8%", vac:"5.4%", absorb:"980", pipeline:"9.2%", constraint:76, jobs:5.1, pop:"+2.4%", medInc:"$64,200", cap:"5.8%", cycle:"EXPANSION" },
];

const SUB_DATA = [
  { name:"Midtown", props:52, units:"14,856", jedi:88, d30:"+3", trend:[80,82,83,84,85,86,86,87,88], rent:"$2,056", rentD:"+4.8%", rentSf:"$2.14", vac:"5.1%", absorb:"3.2%", pipeline:"12.4%", moSupply:14, opp:82, pressure:"BUYER", cap:"4.8%", ppu:"$245K", afford:"28%", review:4.2 },
  { name:"Buckhead", props:39, units:"14,338", jedi:84, d30:"+1", trend:[78,79,80,81,82,82,83,83,84], rent:"$1,883", rentD:"+2.1%", rentSf:"$1.92", vac:"6.2%", absorb:"2.1%", pipeline:"8.8%", moSupply:11, opp:78, pressure:"BALANCED", cap:"5.0%", ppu:"$228K", afford:"31%", review:4.0 },
  { name:"West End", props:53, units:"5,924", jedi:79, d30:"+6", trend:[68,70,72,73,74,75,76,78,79], rent:"$1,977", rentD:"+5.2%", rentSf:"$1.88", vac:"6.8%", absorb:"2.8%", pipeline:"6.2%", moSupply:8, opp:86, pressure:"BUYER", cap:"5.4%", ppu:"$185K", afford:"26%", review:3.8 },
  { name:"East Atlanta", props:23, units:"6,789", jedi:72, d30:"-1", trend:[74,74,73,73,72,72,72,72,72], rent:"$2,031", rentD:"-0.6%", rentSf:"$1.95", vac:"8.4%", absorb:"0.8%", pipeline:"15.4%", moSupply:22, opp:62, pressure:"SELLER", cap:"5.8%", ppu:"$198K", afford:"33%", review:3.5 },
  { name:"Downtown", props:35, units:"8,473", jedi:76, d30:"+2", trend:[70,71,72,73,73,74,75,75,76], rent:"$1,542", rentD:"+2.8%", rentSf:"$1.72", vac:"7.2%", absorb:"1.9%", pipeline:"14.8%", moSupply:18, opp:68, pressure:"BALANCED", cap:"5.6%", ppu:"$172K", afford:"24%", review:3.9 },
  { name:"Sandy Springs", props:28, units:"9,120", jedi:81, d30:"+2", trend:[74,75,76,77,78,79,79,80,81], rent:"$1,920", rentD:"+3.4%", rentSf:"$1.98", vac:"5.8%", absorb:"2.4%", pipeline:"10.2%", moSupply:12, opp:74, pressure:"BUYER", cap:"5.2%", ppu:"$215K", afford:"27%", review:4.1 },
];

const PROP_DATA = [
  { name:"Summit Ridge Apts", addr:"4200 Summit Ridge Pkwy", sub:"Midtown", jedi:86, d30:"+3", trend:[78,80,81,82,83,84,85,85,86], strat:"RENTAL", arbGap:8, units:240, year:1998, rent:"$1,385", rentD:"+3.8%", vsMkt:"+1.4%", revpau:"$1,312", occ:"92.4%", noi:"$2.34M", cap:"5.2%", ppu:"$188K", psf:"$227", irr:"18.4%", traffic:74, review:4.1, risk:"LOW", stage:"DD" },
  { name:"Westshore Innovation", addr:"2800 W Kennedy Blvd", sub:"Midtown", jedi:91, d30:"+5", trend:[82,83,85,86,87,88,89,90,91], strat:"BTS", arbGap:22, units:312, year:0, rent:"$2,180", rentD:"—", vsMkt:"+6.0%", revpau:"—", occ:"—", noi:"—", cap:"—", ppu:"—", psf:"—", irr:"24.3%", traffic:68, review:"—", risk:"MED", stage:"LOI" },
  { name:"Piedmont Station", addr:"1400 Piedmont Ave", sub:"Midtown", jedi:82, d30:"+2", trend:[75,76,77,78,79,80,81,81,82], strat:"RENTAL", arbGap:5, units:186, year:2015, rent:"$2,240", rentD:"+2.1%", vsMkt:"+10.2%", revpau:"$2,128", occ:"95.1%", noi:"$4.12M", cap:"4.6%", ppu:"$265K", psf:"$298", irr:"15.2%", traffic:82, review:4.4, risk:"LOW", stage:"PROSPECT" },
  { name:"Colony Square Living", addr:"1197 Peachtree St", sub:"Midtown", jedi:79, d30:"-1", trend:[82,81,81,80,80,79,79,79,79], strat:"RENTAL", arbGap:3, units:420, year:2021, rent:"$2,580", rentD:"+0.4%", vsMkt:"+26.8%", revpau:"$2,451", occ:"93.8%", noi:"$8.64M", cap:"4.2%", ppu:"$312K", psf:"$342", irr:"12.8%", traffic:88, review:4.6, risk:"LOW", stage:"LEAD" },
  { name:"The Locale on 10th", addr:"1075 10th St NW", sub:"Midtown", jedi:84, d30:"+4", trend:[76,77,78,79,80,81,82,83,84], strat:"FLIP", arbGap:12, units:148, year:2002, rent:"$1,680", rentD:"+4.2%", vsMkt:"-17.4%", revpau:"$1,546", occ:"91.2%", noi:"$2.18M", cap:"5.8%", ppu:"$168K", psf:"$204", irr:"21.5%", traffic:62, review:3.6, risk:"MED", stage:"DD" },
  { name:"Skyline Lofts", addr:"880 Spring St NW", sub:"Midtown", jedi:77, d30:"+1", trend:[73,74,74,75,75,76,76,77,77], strat:"STR", arbGap:4, units:64, year:2008, rent:"$1,920", rentD:"+1.8%", vsMkt:"-5.6%", revpau:"$1,766", occ:"89.4%", noi:"$1.02M", cap:"6.2%", ppu:"$195K", psf:"$248", irr:"12.4%", traffic:56, review:3.9, risk:"HIGH", stage:"LEAD" },
];

function Spark({ data, color = T.green, w = 52, h = 14 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return (<svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>);
}

function Badge({ label, color }) {
  return (<span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>);
}

function ScoreCell({ value, size = 11 }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? T.green : n >= 65 ? T.amber : T.red;
  return (<span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>);
}

function DeltaCell({ value }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 9 }}>—</span>;
  const positive = value.startsWith("+");
  const negative = value.startsWith("-");
  return (<span style={{ fontSize: 9, fontWeight: 600, color: positive ? T.green : negative ? T.red : T.muted, ...mono }}>{value}</span>);
}

function HeaderCell({ children, width, sortable, sorted, onClick, align = "left" }) {
  return (
    <div onClick={onClick} style={{ width, minWidth: width, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: sorted ? T.amber : T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, cursor: sortable ? "pointer" : "default", userSelect: "none", textAlign: align, ...mono, flexShrink: 0 }}>
      {children}{sorted && <span style={{ marginLeft: 2 }}>▼</span>}
    </div>
  );
}

function DataCell({ children, width, align = "left", style = {} }) {
  return (<div style={{ width, minWidth: width, padding: "4px 6px", borderRight: `1px solid ${T.borderS}`, display: "flex", alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start", flexShrink: 0, ...style }}>{children}</div>);
}

function CycleBadge({ cycle }) {
  const c = { EXPANSION: T.green, "LATE EXP": T.amber, PEAK: T.orange, CONTRACTION: T.red, TROUGH: T.cyan };
  return <Badge label={cycle} color={c[cycle] || T.muted} />;
}

function PressureBadge({ p }) {
  const c = { BUYER: T.green, BALANCED: T.amber, SELLER: T.cyan };
  return <Badge label={p} color={c[p] || T.muted} />;
}

function StratBadge({ s }) {
  const c = { BTS: T.purple, FLIP: T.cyan, RENTAL: T.green, STR: T.orange };
  return <Badge label={s} color={c[s] || T.muted} />;
}

function RiskBadge({ r }) {
  const c = { LOW: T.green, MED: T.orange, HIGH: T.red };
  return <Badge label={r} color={c[r] || T.muted} />;
}

function StageBadge({ s }) {
  const c = { DD: T.cyan, LOI: T.amber, PROSPECT: T.secondary, LEAD: T.muted, CLOSED: T.green };
  return <Badge label={s} color={c[s] || T.muted} />;
}

function ThresholdCell({ value, thresholds, invert }) {
  const n = parseFloat(value);
  let c = T.primary;
  if (invert) {
    c = n <= thresholds[0] ? T.green : n <= thresholds[1] ? T.amber : T.red;
  } else {
    c = n >= thresholds[0] ? T.green : n >= thresholds[1] ? T.amber : T.red;
  }
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

function MedianRow({ data, cols }) {
  return (
    <div style={{ display: "flex", background: T.amber + "08", borderBottom: `1px solid ${T.amber}33`, position: "sticky", top: 0, zIndex: 2 }}>
      {cols.map((col, i) => (
        <DataCell key={i} width={col.w}>
          <span style={{ fontSize: col.isMed ? 10 : 9, fontWeight: 700, color: col.isMed ? T.amber : T.muted, ...mono }}>{col.isMed ? data[col.key] || "—" : col.label || ""}</span>
        </DataCell>
      ))}
    </div>
  );
}

function MSAGrid({ onDrill }) {
  const [sel, setSel] = useState(null);
  const median = { name: "Median", jedi: 81, rent: "$1,879", rentD: "+3.4%", vac: "6.4%", absorb: "1,800", pipeline: "14.2%", constraint: 60, jobs: 5.2, pop: "+2.0%", cap: "5.3%" };
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <HeaderCell width={28}>#</HeaderCell>
        <HeaderCell width={140}>MSA</HeaderCell>
        <HeaderCell width={48}>PROPS</HeaderCell>
        <HeaderCell width={52}>UNITS</HeaderCell>
        <HeaderCell width={44} sorted>JEDI</HeaderCell>
        <HeaderCell width={36}>Δ30</HeaderCell>
        <HeaderCell width={56}>TREND</HeaderCell>
        <HeaderCell width={64}>RENT</HeaderCell>
        <HeaderCell width={52}>RENT Δ</HeaderCell>
        <HeaderCell width={48}>VAC</HeaderCell>
        <HeaderCell width={56}>ABSORB</HeaderCell>
        <HeaderCell width={56}>PIPE %</HeaderCell>
        <HeaderCell width={44}>CNSTR</HeaderCell>
        <HeaderCell width={44}>J/APT</HeaderCell>
        <HeaderCell width={44}>POP Δ</HeaderCell>
        <HeaderCell width={56}>MED INC</HeaderCell>
        <HeaderCell width={44}>CAP</HeaderCell>
        <HeaderCell width={64}>CYCLE</HeaderCell>
      </div>
      <div style={{ display: "flex", background: T.amber + "08", borderBottom: `1px solid ${T.amber}33` }}>
        <DataCell width={28}><span style={{ fontSize: 8, color: T.amber, ...mono }}>M</span></DataCell>
        <DataCell width={140}><span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>Median</span></DataCell>
        <DataCell width={48}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
        <DataCell width={52}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
        <DataCell width={44}><span style={{ fontSize: 11, fontWeight: 800, color: T.amber, ...mono }}>{median.jedi}</span></DataCell>
        <DataCell width={36}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
        <DataCell width={56} />
        <DataCell width={64}><span style={{ fontSize: 9, fontWeight: 600, color: T.amber, ...mono }}>{median.rent}</span></DataCell>
        <DataCell width={52}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.rentD}</span></DataCell>
        <DataCell width={48}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.vac}</span></DataCell>
        <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.absorb}</span></DataCell>
        <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.pipeline}</span></DataCell>
        <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.constraint}</span></DataCell>
        <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.jobs}</span></DataCell>
        <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.pop}</span></DataCell>
        <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
        <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{median.cap}</span></DataCell>
        <DataCell width={64} />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {MSA_DATA.map((d, i) => (
          <div key={i} onDoubleClick={() => onDrill(d.name)} onClick={() => setSel(i)} style={{ display: "flex", background: sel === i ? T.active : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer", borderLeft: sel === i ? `2px solid ${T.amber}` : "2px solid transparent" }}
            onMouseEnter={e => { if (sel !== i) e.currentTarget.style.background = T.hover; }}
            onMouseLeave={e => { if (sel !== i) e.currentTarget.style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}>
            <DataCell width={28}><span style={{ fontSize: 8, color: T.muted, ...mono }}>{i + 1}</span></DataCell>
            <DataCell width={140}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...sans }}>{d.name}</span></DataCell>
            <DataCell width={48}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.props.toLocaleString()}</span></DataCell>
            <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.units}</span></DataCell>
            <DataCell width={44}><ScoreCell value={d.jedi} /></DataCell>
            <DataCell width={36}><DeltaCell value={d.d30} /></DataCell>
            <DataCell width={56}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DataCell>
            <DataCell width={64}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{d.rent}</span></DataCell>
            <DataCell width={52}><DeltaCell value={d.rentD} /></DataCell>
            <DataCell width={48}><ThresholdCell value={d.vac} thresholds={[5, 8]} invert /></DataCell>
            <DataCell width={56}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.absorb}</span></DataCell>
            <DataCell width={56}><ThresholdCell value={d.pipeline} thresholds={[8, 12]} invert /></DataCell>
            <DataCell width={44}><ScoreCell value={d.constraint} size={10} /></DataCell>
            <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.jobs}</span></DataCell>
            <DataCell width={44}><DeltaCell value={d.pop} /></DataCell>
            <DataCell width={56}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.medInc}</span></DataCell>
            <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.cap}</span></DataCell>
            <DataCell width={64}><CycleBadge cycle={d.cycle} /></DataCell>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubmarketGrid({ market, onDrill, onBack }) {
  const [sel, setSel] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <HeaderCell width={28}>#</HeaderCell>
        <HeaderCell width={120}>SUBMARKET</HeaderCell>
        <HeaderCell width={40}>PROPS</HeaderCell>
        <HeaderCell width={52}>UNITS</HeaderCell>
        <HeaderCell width={44} sorted>JEDI</HeaderCell>
        <HeaderCell width={36}>Δ30</HeaderCell>
        <HeaderCell width={52}>TREND</HeaderCell>
        <HeaderCell width={60}>RENT</HeaderCell>
        <HeaderCell width={48}>RENT Δ</HeaderCell>
        <HeaderCell width={44}>R/SF</HeaderCell>
        <HeaderCell width={44}>VAC</HeaderCell>
        <HeaderCell width={44}>ABSRB</HeaderCell>
        <HeaderCell width={48}>PIPE %</HeaderCell>
        <HeaderCell width={40}>MO S</HeaderCell>
        <HeaderCell width={40}>OPP</HeaderCell>
        <HeaderCell width={56}>PRESS</HeaderCell>
        <HeaderCell width={40}>CAP</HeaderCell>
        <HeaderCell width={52}>$/UNIT</HeaderCell>
        <HeaderCell width={40}>AFF</HeaderCell>
        <HeaderCell width={36}>REV</HeaderCell>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {SUB_DATA.map((d, i) => (
          <div key={i} onDoubleClick={() => onDrill(d.name)} onClick={() => setSel(i)} style={{ display: "flex", background: sel === i ? T.active : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer", borderLeft: sel === i ? `2px solid ${T.amber}` : "2px solid transparent" }}
            onMouseEnter={e => { if (sel !== i) e.currentTarget.style.background = T.hover; }}
            onMouseLeave={e => { if (sel !== i) e.currentTarget.style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}>
            <DataCell width={28}><span style={{ fontSize: 8, color: T.muted, ...mono }}>{i + 1}</span></DataCell>
            <DataCell width={120}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...sans }}>{d.name}</span></DataCell>
            <DataCell width={40}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.props}</span></DataCell>
            <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.units}</span></DataCell>
            <DataCell width={44}><ScoreCell value={d.jedi} /></DataCell>
            <DataCell width={36}><DeltaCell value={d.d30} /></DataCell>
            <DataCell width={52}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DataCell>
            <DataCell width={60}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{d.rent}</span></DataCell>
            <DataCell width={48}><DeltaCell value={d.rentD} /></DataCell>
            <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.rentSf}</span></DataCell>
            <DataCell width={44}><ThresholdCell value={d.vac} thresholds={[5, 8]} invert /></DataCell>
            <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.absorb}</span></DataCell>
            <DataCell width={48}><ThresholdCell value={d.pipeline} thresholds={[8, 12]} invert /></DataCell>
            <DataCell width={40}><ThresholdCell value={String(d.moSupply)} thresholds={[12, 18]} invert /></DataCell>
            <DataCell width={40}><ScoreCell value={d.opp} size={10} /></DataCell>
            <DataCell width={56}><PressureBadge p={d.pressure} /></DataCell>
            <DataCell width={40}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.cap}</span></DataCell>
            <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.ppu}</span></DataCell>
            <DataCell width={40}><ThresholdCell value={d.afford} thresholds={[30, 35]} invert /></DataCell>
            <DataCell width={36}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.review}</span></DataCell>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyGrid({ submarket, onBack }) {
  const [sel, setSel] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, overflowX: "auto" }}>
        <HeaderCell width={28}>#</HeaderCell>
        <HeaderCell width={150}>PROPERTY</HeaderCell>
        <HeaderCell width={44} sorted>JEDI</HeaderCell>
        <HeaderCell width={36}>Δ30</HeaderCell>
        <HeaderCell width={52}>TREND</HeaderCell>
        <HeaderCell width={48}>STRAT</HeaderCell>
        <HeaderCell width={32}>ARB</HeaderCell>
        <HeaderCell width={36}>UNIT</HeaderCell>
        <HeaderCell width={36}>YR</HeaderCell>
        <HeaderCell width={56}>RENT</HeaderCell>
        <HeaderCell width={44}>R Δ</HeaderCell>
        <HeaderCell width={44}>v MKT</HeaderCell>
        <HeaderCell width={52}>RevPAU</HeaderCell>
        <HeaderCell width={44}>OCC</HeaderCell>
        <HeaderCell width={52}>NOI</HeaderCell>
        <HeaderCell width={40}>CAP</HeaderCell>
        <HeaderCell width={48}>$/UNIT</HeaderCell>
        <HeaderCell width={40}>IRR</HeaderCell>
        <HeaderCell width={40}>TRAF</HeaderCell>
        <HeaderCell width={36}>REV</HeaderCell>
        <HeaderCell width={40}>RISK</HeaderCell>
        <HeaderCell width={44}>STAGE</HeaderCell>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {PROP_DATA.map((d, i) => {
          const isSubject = i === 0;
          return (
            <div key={i} onClick={() => setSel(i)} style={{ display: "flex", background: sel === i ? T.active : isSubject ? T.amber + "0A" : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer", borderLeft: isSubject ? `2px solid ${T.amber}` : sel === i ? `2px solid ${T.amber}` : "2px solid transparent" }}
              onMouseEnter={e => { if (sel !== i && !isSubject) e.currentTarget.style.background = T.hover; }}
              onMouseLeave={e => { if (sel !== i) e.currentTarget.style.background = isSubject ? T.amber + "0A" : i % 2 === 0 ? T.panel : T.panelAlt; }}>
              <DataCell width={28}><span style={{ fontSize: 8, color: isSubject ? T.amber : T.muted, ...mono }}>{isSubject ? "▸" : i + 1}</span></DataCell>
              <DataCell width={150}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: isSubject ? T.amberBright : T.primary, ...sans }}>{d.name}</div>
                  <div style={{ fontSize: 7, color: T.muted }}>{d.addr}</div>
                </div>
              </DataCell>
              <DataCell width={44}><ScoreCell value={d.jedi} /></DataCell>
              <DataCell width={36}><DeltaCell value={d.d30} /></DataCell>
              <DataCell width={52}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DataCell>
              <DataCell width={48}><StratBadge s={d.strat} /></DataCell>
              <DataCell width={32}>{d.arbGap >= 15 ? <span style={{ fontSize: 10, color: T.amber }}>⚡</span> : <span style={{ fontSize: 9, color: T.muted, ...mono }}>{d.arbGap}</span>}</DataCell>
              <DataCell width={36}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.units}</span></DataCell>
              <DataCell width={36}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.year || "—"}</span></DataCell>
              <DataCell width={56}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{d.rent}</span></DataCell>
              <DataCell width={44}><DeltaCell value={d.rentD} /></DataCell>
              <DataCell width={44}><DeltaCell value={d.vsMkt} /></DataCell>
              <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.revpau}</span></DataCell>
              <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.occ}</span></DataCell>
              <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.noi}</span></DataCell>
              <DataCell width={40}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.cap}</span></DataCell>
              <DataCell width={48}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.ppu}</span></DataCell>
              <DataCell width={40}><DeltaCell value={d.irr !== "—" ? d.irr : "—"} /></DataCell>
              <DataCell width={40}><ScoreCell value={d.traffic} size={9} /></DataCell>
              <DataCell width={36}><span style={{ fontSize: 9, color: T.secondary, ...mono }}>{d.review}</span></DataCell>
              <DataCell width={40}><RiskBadge r={d.risk} /></DataCell>
              <DataCell width={44}><StageBadge s={d.stage} /></DataCell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PeerComparisonWireframe() {
  const [level, setLevel] = useState("msa");
  const [context, setContext] = useState("All Markets");

  const handleDrill = (name) => {
    if (level === "msa") { setLevel("submarket"); setContext(name); }
    else if (level === "submarket") { setLevel("property"); setContext(name); }
  };
  const handleBack = () => {
    if (level === "property") { setLevel("submarket"); setContext("Atlanta, GA"); }
    else if (level === "submarket") { setLevel("msa"); setContext("All Markets"); }
  };

  return (
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column", color: T.primary, ...mono, overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');*{scrollbar-width:thin;scrollbar-color:${T.borderM} ${T.bg}}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.borderM}}`}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, padding: "0 10px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.secondary }}>PEER COMPARISON</span>
        </div>
        <span style={{ fontSize: 8, color: T.secondary }}>WIREFRAME · 3 ZOOM LEVELS</span>
      </div>

      {/* CONTEXT BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 28, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        {level !== "msa" && (
          <button onClick={handleBack} style={{ background: "transparent", border: `1px solid ${T.borderS}`, color: T.secondary, padding: "1px 8px", fontSize: 9, cursor: "pointer", ...mono, borderRadius: 2 }}>◀ BACK</button>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          <span onClick={() => { setLevel("msa"); setContext("All Markets"); }} style={{ fontSize: 9, color: level === "msa" ? T.amber : T.cyan, cursor: "pointer", textDecoration: level !== "msa" ? "underline" : "none" }}>MSA</span>
          {level !== "msa" && <><span style={{ color: T.muted }}>/</span><span onClick={() => { setLevel("submarket"); setContext("Atlanta, GA"); }} style={{ fontSize: 9, color: level === "submarket" ? T.amber : T.cyan, cursor: "pointer", textDecoration: level === "property" ? "underline" : "none" }}>Atlanta, GA</span></>}
          {level === "property" && <><span style={{ color: T.muted }}>/</span><span style={{ fontSize: 9, color: T.amber }}>{context}</span></>}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {["MSA INDEX", "SUBMARKET SECTOR", "PROPERTY STOCK"].map((l, i) => {
            const lvl = ["msa", "submarket", "property"][i];
            return (<span key={i} style={{ fontSize: 8, fontWeight: level === lvl ? 700 : 400, color: level === lvl ? T.bg : T.secondary, background: level === lvl ? T.amber : "transparent", padding: "2px 8px", cursor: "pointer", border: `1px solid ${level === lvl ? T.amber : T.borderS}` }} onClick={() => { setLevel(lvl); setContext(lvl === "msa" ? "All Markets" : lvl === "submarket" ? "Atlanta, GA" : "Midtown"); }}>{l}</span>);
          })}
        </div>
      </div>

      {/* LEVEL INDICATOR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.panel, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, ...sans }}>{context}</span>
        <span style={{ fontSize: 9, color: T.muted }}>|</span>
        <span style={{ fontSize: 9, color: T.secondary }}>
          {level === "msa" && "6 tracked markets · Peer Comparison · Sort by JEDI Score · Double-click to drill"}
          {level === "submarket" && "6 submarkets · Sector Comparison · Double-click for properties"}
          {level === "property" && "6 properties · Stock Comparison · ▸ = subject property"}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted }}>
          {level === "msa" && "18 columns"}
          {level === "submarket" && "20 columns"}
          {level === "property" && "22 columns"}
        </span>
      </div>

      {/* GRID */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {level === "msa" && <MSAGrid onDrill={handleDrill} />}
        {level === "submarket" && <SubmarketGrid market={context} onDrill={handleDrill} onBack={handleBack} />}
        {level === "property" && <PropertyGrid submarket={context} onBack={handleBack} />}
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted }}>Double-click row → drill down · Click column → sort · ▸ = subject property</span>
        <span style={{ fontSize: 8, color: T.muted }}>JEDI RE Peer Comparison Grid · {level.toUpperCase()} LEVEL</span>
      </div>
    </div>
  );
}
