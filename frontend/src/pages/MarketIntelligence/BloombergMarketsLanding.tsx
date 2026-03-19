import { useState } from "react";
import { useNavigate } from "react-router-dom";

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  borderS: "#1E2538", borderM: "#2A3348",
};
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

const MSA_DATA = [
  { id: "atlanta-ga",     name: "Atlanta, GA",      props: 1028, units: "250K", jedi: 87, d30: "+4", trend: [78,80,81,82,83,84,85,86,87], rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840", pipeline: "15.8%", constraint: 58, jobs: 5.8, pop: "+2.1%", medInc: "$72,400", cap: "5.2%", cycle: "EXPANSION" },
  { id: "raleigh-nc",     name: "Raleigh, NC",      props: 480,  units: "98K",  jedi: 85, d30: "+3", trend: [77,78,80,81,82,83,84,84,85], rent: "$1,740", rentD: "+3.9%", vac: "6.2%", absorb: "1,120", pipeline: "11.8%", constraint: 72, jobs: 5.5, pop: "+2.8%", medInc: "$78,200", cap: "5.0%", cycle: "EXPANSION" },
  { id: "jacksonville-fl",name: "Jacksonville, FL", props: 386,  units: "82K",  jedi: 80, d30: "+5", trend: [70,72,73,74,75,76,77,79,80], rent: "$1,580", rentD: "+3.8%", vac: "5.4%", absorb: "980",   pipeline: "9.2%",  constraint: 76, jobs: 5.1, pop: "+2.4%", medInc: "$64,200", cap: "5.8%", cycle: "EXPANSION" },
  { id: "tampa-fl",       name: "Tampa, FL",         props: 892,  units: "215K", jedi: 82, d30: "+2", trend: [74,75,76,77,78,79,80,81,82], rent: "$1,908", rentD: "+3.0%", vac: "6.5%", absorb: "2,150", pipeline: "13.4%", constraint: 64, jobs: 5.2, pop: "+1.9%", medInc: "$65,800", cap: "5.4%", cycle: "LATE EXP" },
  { id: "charlotte-nc",   name: "Charlotte, NC",    props: 680,  units: "142K", jedi: 82, d30: "+3", trend: [76,77,78,79,80,80,81,81,82], rent: "$1,680", rentD: "+3.5%", vac: "6.0%", absorb: "1,540", pipeline: "12.4%", constraint: 68, jobs: 5.2, pop: "+2.2%", medInc: "$68,400", cap: "5.2%", cycle: "EXPANSION" },
  { id: "orlando-fl",     name: "Orlando, FL",       props: 714,  units: "178K", jedi: 78, d30: "+1", trend: [72,73,74,74,75,76,77,77,78], rent: "$1,820", rentD: "+2.4%", vac: "7.1%", absorb: "1,680", pipeline: "16.2%", constraint: 48, jobs: 4.9, pop: "+1.7%", medInc: "$62,400", cap: "5.6%", cycle: "PEAK" },
  { id: "miami-fl",       name: "Miami, FL",         props: 1245, units: "310K", jedi: 74, d30: "-2", trend: [80,79,78,77,76,75,75,74,74], rent: "$2,480", rentD: "+1.2%", vac: "8.4%", absorb: "1,920", pipeline: "18.6%", constraint: 38, jobs: 4.4, pop: "+0.8%", medInc: "$58,900", cap: "4.8%", cycle: "PEAK" },
];

const MEDIAN = { jedi: 81, rent: "$1,879", rentD: "+3.4%", vac: "6.4%", absorb: "1,800", pipeline: "14.2%", constraint: 60, jobs: 5.2, pop: "+2.0%", cap: "5.3%" };

function Spark({ data, color = T.green, w = 60, h = 18 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 11, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "2px 6px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}

function ScoreCell({ value, size = 13 }: { value: number; size?: number }) {
  const c = value >= 80 ? T.green : value >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 11 }}>—</span>;
  const positive = value.startsWith("+");
  const negative = value.startsWith("-");
  return <span style={{ fontSize: 11, fontWeight: 600, color: positive ? T.green : negative ? T.red : T.muted, ...mono }}>{value}</span>;
}

const COL_W = { rank: 32, msa: 160, props: 58, units: 60, jedi: 52, d30: 44, trend: 68, rent: 76, rentD: 62, vac: 56, absorb: 66, pipe: 66, cnstr: 52, jobs: 52, pop: 52, inc: 80, cap: 52, cycle: 88 };

function HC({ children, w, sorted }: { children: React.ReactNode; w: number; sorted?: boolean }) {
  return (
    <div style={{ width: w, minWidth: w, padding: "4px 8px", fontSize: 9, fontWeight: 700, color: sorted ? T.amber : T.muted, letterSpacing: 0.8, borderRight: `1px solid ${T.borderS}`, userSelect: "none", textTransform: "uppercase", ...mono, flexShrink: 0 }}>
      {children}{sorted && <span style={{ marginLeft: 2 }}>▼</span>}
    </div>
  );
}

function DC({ children, w, style = {} }: { children: React.ReactNode; w: number; style?: React.CSSProperties }) {
  return <div style={{ width: w, minWidth: w, padding: "5px 8px", borderRight: `1px solid ${T.borderS}`, display: "flex", alignItems: "center", flexShrink: 0, ...style }}>{children}</div>;
}

function CycleBadge({ cycle }: { cycle: string }) {
  const c: Record<string, string> = { EXPANSION: T.green, "LATE EXP": T.amber, PEAK: T.orange, CONTRACTION: T.red, TROUGH: T.cyan };
  return <Badge label={cycle} color={c[cycle] || T.muted} />;
}

function ThresholdCell({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c = T.primary;
  if (invert) c = n <= thresholds[0] ? T.green : n <= thresholds[1] ? T.amber : T.red;
  else c = n >= thresholds[0] ? T.green : n >= thresholds[1] ? T.amber : T.red;
  return <span style={{ fontSize: 12, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

export default function BloombergMarketsLanding() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>("jedi");

  const sorted = [...MSA_DATA].sort((a, b) => {
    if (sortKey === "jedi") return b.jedi - a.jedi;
    if (sortKey === "rent") return parseFloat(b.rent.replace(/[^0-9.]/g, "")) - parseFloat(a.rent.replace(/[^0-9.]/g, ""));
    if (sortKey === "vac") return parseFloat(a.vac) - parseFloat(b.vac);
    return b.jedi - a.jedi;
  });

  const totalW = Object.values(COL_W).reduce((a, b) => a + b, 0);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", color: T.primary, ...mono }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { scrollbar-width: thin; scrollbar-color: ${T.borderM} ${T.bg}; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.borderM}; border-radius: 3px; }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 32, padding: "0 16px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 10, color: T.muted }}>|</span>
          <span style={{ fontSize: 10, color: T.secondary }}>F4 MARKETS · MSA INTELLIGENCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: T.muted }}>SORT BY</span>
          {[["jedi", "JEDI"], ["rent", "RENT"], ["vac", "VACANCY"]].map(([k, l]) => (
            <span key={k} onClick={() => setSortKey(k)} style={{ fontSize: 10, fontWeight: sortKey === k ? 700 : 400, color: sortKey === k ? T.bg : T.secondary, background: sortKey === k ? T.amber : "transparent", padding: "3px 8px", cursor: "pointer", border: `1px solid ${sortKey === k ? T.amber : T.borderS}` }}>{l}</span>
          ))}
        </div>
      </div>

      {/* BREADCRUMB BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 34, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "transparent", border: `1px solid ${T.borderS}`, color: T.secondary, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono','Fira Code',monospace", borderRadius: 2, flexShrink: 0 }}
        >
          ◀ BACK
        </button>
        <span style={{ color: T.borderM }}>|</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>MSA INDEX</span>
        <span style={{ color: T.borderM }}>/</span>
        <span style={{ fontSize: 11, color: T.muted }}>SUBMARKET SECTOR</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: T.muted }}>{MSA_DATA.length} markets · {MSA_DATA.reduce((s, m) => s + m.props, 0).toLocaleString()} properties · Double-click row to open market detail</span>
      </div>

      {/* TITLE ROW */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: T.panel, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: T.primary, ...sans }}>Market Intelligence</span>
        <span style={{ fontSize: 11, color: T.muted }}>|</span>
        <span style={{ fontSize: 11, color: T.secondary }}>Peer comparison · Sort by JEDI Score · Double-click to open market overview</span>
      </div>

      {/* TABLE — horizontally scrollable */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ minWidth: totalW }}>
          {/* COLUMN HEADERS */}
          <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}`, position: "sticky", top: 0, zIndex: 10 }}>
            <HC w={COL_W.rank}>#</HC>
            <HC w={COL_W.msa}>MSA</HC>
            <HC w={COL_W.props}>PROPS</HC>
            <HC w={COL_W.units}>UNITS</HC>
            <HC w={COL_W.jedi} sorted={sortKey === "jedi"}>JEDI</HC>
            <HC w={COL_W.d30}>Δ30</HC>
            <HC w={COL_W.trend}>TREND</HC>
            <HC w={COL_W.rent} sorted={sortKey === "rent"}>RENT</HC>
            <HC w={COL_W.rentD}>RENT Δ</HC>
            <HC w={COL_W.vac} sorted={sortKey === "vac"}>VAC</HC>
            <HC w={COL_W.absorb}>ABSORB</HC>
            <HC w={COL_W.pipe}>PIPE %</HC>
            <HC w={COL_W.cnstr}>CNSTR</HC>
            <HC w={COL_W.jobs}>J/APT</HC>
            <HC w={COL_W.pop}>POP Δ</HC>
            <HC w={COL_W.inc}>MED INC</HC>
            <HC w={COL_W.cap}>CAP</HC>
            <HC w={COL_W.cycle}>CYCLE</HC>
          </div>

          {/* MEDIAN ROW */}
          <div style={{ display: "flex", background: T.amber + "0A", borderBottom: `1px solid ${T.amber}33` }}>
            <DC w={COL_W.rank}><span style={{ fontSize: 10, color: T.amber }}>M</span></DC>
            <DC w={COL_W.msa}><span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>Median</span></DC>
            <DC w={COL_W.props}><span style={{ fontSize: 11, color: T.amber }}>—</span></DC>
            <DC w={COL_W.units}><span style={{ fontSize: 11, color: T.amber }}>—</span></DC>
            <DC w={COL_W.jedi}><span style={{ fontSize: 14, fontWeight: 800, color: T.amber }}>{MEDIAN.jedi}</span></DC>
            <DC w={COL_W.d30}><span style={{ fontSize: 11, color: T.amber }}>—</span></DC>
            <DC w={COL_W.trend} />
            <DC w={COL_W.rent}><span style={{ fontSize: 11, fontWeight: 600, color: T.amber }}>{MEDIAN.rent}</span></DC>
            <DC w={COL_W.rentD}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.rentD}</span></DC>
            <DC w={COL_W.vac}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.vac}</span></DC>
            <DC w={COL_W.absorb}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.absorb}</span></DC>
            <DC w={COL_W.pipe}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.pipeline}</span></DC>
            <DC w={COL_W.cnstr}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.constraint}</span></DC>
            <DC w={COL_W.jobs}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.jobs}</span></DC>
            <DC w={COL_W.pop}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.pop}</span></DC>
            <DC w={COL_W.inc}><span style={{ fontSize: 11, color: T.amber }}>—</span></DC>
            <DC w={COL_W.cap}><span style={{ fontSize: 11, color: T.amber }}>{MEDIAN.cap}</span></DC>
            <DC w={COL_W.cycle} />
          </div>

          {/* DATA ROWS */}
          {sorted.map((d, i) => (
            <div
              key={d.id}
              onClick={() => setSel(i)}
              onDoubleClick={() => navigate(`/market-intelligence/markets/${d.id}`)}
              style={{ display: "flex", background: sel === i ? T.active : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer", borderLeft: sel === i ? `3px solid ${T.amber}` : "3px solid transparent" }}
              onMouseEnter={e => { if (sel !== i) (e.currentTarget as HTMLDivElement).style.background = T.hover; }}
              onMouseLeave={e => { if (sel !== i) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}
            >
              <DC w={COL_W.rank}><span style={{ fontSize: 10, color: T.muted }}>{i + 1}</span></DC>
              <DC w={COL_W.msa}><span style={{ fontSize: 12, fontWeight: 600, color: T.primary, ...sans }}>{d.name}</span></DC>
              <DC w={COL_W.props}><span style={{ fontSize: 11, color: T.secondary }}>{d.props.toLocaleString()}</span></DC>
              <DC w={COL_W.units}><span style={{ fontSize: 11, color: T.secondary }}>{d.units}</span></DC>
              <DC w={COL_W.jedi}><ScoreCell value={d.jedi} /></DC>
              <DC w={COL_W.d30}><DeltaCell value={d.d30} /></DC>
              <DC w={COL_W.trend}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DC>
              <DC w={COL_W.rent}><span style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>{d.rent}</span></DC>
              <DC w={COL_W.rentD}><DeltaCell value={d.rentD} /></DC>
              <DC w={COL_W.vac}><ThresholdCell value={d.vac} thresholds={[5, 8]} invert /></DC>
              <DC w={COL_W.absorb}><span style={{ fontSize: 11, color: T.secondary }}>{d.absorb}</span></DC>
              <DC w={COL_W.pipe}><ThresholdCell value={d.pipeline} thresholds={[8, 12]} invert /></DC>
              <DC w={COL_W.cnstr}><ScoreCell value={d.constraint} size={12} /></DC>
              <DC w={COL_W.jobs}><span style={{ fontSize: 11, color: T.secondary }}>{d.jobs}</span></DC>
              <DC w={COL_W.pop}><DeltaCell value={d.pop} /></DC>
              <DC w={COL_W.inc}><span style={{ fontSize: 11, color: T.secondary }}>{d.medInc}</span></DC>
              <DC w={COL_W.cap}><span style={{ fontSize: 11, color: T.secondary }}>{d.cap}</span></DC>
              <DC w={COL_W.cycle}><CycleBadge cycle={d.cycle} /></DC>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 16px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: T.muted }}>Double-click row → Market Overview · Single-click → Select · Click sort buttons to reorder</span>
        <span style={{ fontSize: 10, color: T.muted }}>JEDI RE · MSA INTELLIGENCE · {new Date().toLocaleTimeString("en-US", { hour12: false })}</span>
      </div>
    </div>
  );
}
