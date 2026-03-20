import React, { useState } from "react";
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
  { id: "atlanta-ga",      name: "Atlanta, GA",      props: 1028, units: "250K", jedi: 87, d30: "+4", trend: [78,80,81,82,83,84,85,86,87], rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840", pipeline: "15.8%", constraint: 58, jobs: 5.8, pop: "+2.1%", medInc: "$72,400", cap: "5.2%", cycle: "EXPANSION" },
  { id: "raleigh-nc",      name: "Raleigh, NC",      props: 480,  units: "98K",  jedi: 85, d30: "+3", trend: [77,78,80,81,82,83,84,84,85], rent: "$1,740", rentD: "+3.9%", vac: "6.2%", absorb: "1,120", pipeline: "11.8%", constraint: 72, jobs: 5.5, pop: "+2.8%", medInc: "$78,200", cap: "5.0%", cycle: "EXPANSION" },
  { id: "tampa-fl",        name: "Tampa, FL",         props: 892,  units: "215K", jedi: 82, d30: "+2", trend: [74,75,76,77,78,79,80,81,82], rent: "$1,908", rentD: "+3.0%", vac: "6.5%", absorb: "2,150", pipeline: "13.4%", constraint: 64, jobs: 5.2, pop: "+1.9%", medInc: "$65,800", cap: "5.4%", cycle: "LATE EXP" },
  { id: "orlando-fl",      name: "Orlando, FL",       props: 714,  units: "178K", jedi: 78, d30: "+1", trend: [72,73,74,74,75,76,77,77,78], rent: "$1,820", rentD: "+2.4%", vac: "7.1%", absorb: "1,680", pipeline: "16.2%", constraint: 48, jobs: 4.9, pop: "+1.7%", medInc: "$62,400", cap: "5.6%", cycle: "PEAK" },
  { id: "miami-fl",        name: "Miami, FL",         props: 1245, units: "310K", jedi: 74, d30: "-2", trend: [80,79,78,77,76,75,75,74,74], rent: "$2,480", rentD: "+1.2%", vac: "8.4%", absorb: "1,920", pipeline: "18.6%", constraint: 38, jobs: 4.4, pop: "+0.8%", medInc: "$58,900", cap: "4.8%", cycle: "PEAK" },
  { id: "jacksonville-fl", name: "Jacksonville, FL", props: 386,  units: "82K",  jedi: 80, d30: "+5", trend: [70,72,73,74,75,76,77,79,80], rent: "$1,580", rentD: "+3.8%", vac: "5.4%", absorb: "980",   pipeline: "9.2%",  constraint: 76, jobs: 5.1, pop: "+2.4%", medInc: "$64,200", cap: "5.8%", cycle: "EXPANSION" },
];

const MEDIAN = { jedi: 81, rent: "$1,879", rentD: "+3.4%", vac: "6.4%", absorb: "1,800", pipeline: "14.2%", constraint: 60, jobs: 5.2, pop: "+2.0%", cap: "5.3%" };

function Spark({ data, color = T.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}

function ScoreCell({ value, size = 11 }: { value: number; size?: number }) {
  const c = value >= 80 ? T.green : value >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string }) {
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 9, ...mono }}>—</span>;
  const pos = value.startsWith("+"), neg = value.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? T.green : neg ? T.red : T.muted, ...mono }}>{value}</span>;
}

function HeaderCell({ children, width, sorted }: { children: React.ReactNode; width: number; sorted?: boolean }) {
  return (
    <div style={{ width, minWidth: width, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: sorted ? T.amber : T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, userSelect: "none" as const, ...mono, flexShrink: 0 }}>
      {children}{sorted && <span style={{ marginLeft: 2 }}>▼</span>}
    </div>
  );
}

function DataCell({ children, width }: { children: React.ReactNode; width: number }) {
  return (
    <div style={{ width, minWidth: width, padding: "4px 6px", borderRight: `1px solid ${T.borderS}`, display: "flex", alignItems: "center", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function CycleBadge({ cycle }: { cycle: string }) {
  const c: Record<string, string> = { EXPANSION: T.green, "LATE EXP": T.amber, PEAK: T.orange, CONTRACTION: T.red, TROUGH: T.cyan };
  return <Badge label={cycle} color={c[cycle] || T.muted} />;
}

function ThresholdCell({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? T.green : n <= thresholds[1] ? T.amber : T.red;
  else c = n >= thresholds[0] ? T.green : n >= thresholds[1] ? T.amber : T.red;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

export default function BloombergMarketsLanding() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<number | null>(null);
  const [level, setLevel] = useState<"msa" | "submarket" | "property">("msa");

  const handleDoubleClick = (id: string) => {
    navigate(`/market-intelligence/markets/${id}`);
  };

  return (
    <div style={{ background: T.bg, height: "100vh", display: "flex", flexDirection: "column", color: T.primary, ...mono, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        * { scrollbar-width: thin; scrollbar-color: ${T.borderM} ${T.bg}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.borderM}; }
      `}</style>

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, padding: "0 10px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.secondary }}>MARKET INTELLIGENCE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.primary }}>MSA PEER COMPARISON</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 8, color: T.muted }}>DOUBLE-CLICK ROW → MARKET OVERVIEW</span>
          <button
            onClick={() => navigate("/terminal")}
            style={{ background: "transparent", border: `1px solid ${T.borderS}`, color: T.secondary, padding: "1px 8px", fontSize: 8, cursor: "pointer", ...mono, borderRadius: 2 }}
          >
            ← TERMINAL
          </button>
        </div>
      </div>

      {/* CONTEXT BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 28, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{ fontSize: 9, color: T.amber }}>MSA</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8 }}>
          {(["MSA INDEX", "SUBMARKET SECTOR", "PROPERTY STOCK"] as const).map((l, i) => {
            const lvls = ["msa", "submarket", "property"] as const;
            const lvl = lvls[i];
            const isActive = level === lvl;
            return (
              <span
                key={i}
                onClick={() => setLevel(lvl)}
                style={{ fontSize: 8, fontWeight: isActive ? 700 : 400, color: isActive ? T.bg : T.secondary, background: isActive ? T.amber : "transparent", padding: "2px 8px", cursor: "pointer", border: `1px solid ${isActive ? T.amber : T.borderS}` }}
              >
                {l}
              </span>
            );
          })}
        </div>
      </div>

      {/* LEVEL INDICATOR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.panel, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, ...sans }}>All Markets</span>
        <span style={{ fontSize: 9, color: T.muted }}>|</span>
        <span style={{ fontSize: 9, color: T.secondary }}>
          {MSA_DATA.length} tracked markets · Peer Comparison · Sorted by JEDI Score · Double-click to open detail
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted }}>18 columns</span>
      </div>

      {/* GRID */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* HEADER ROW */}
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

        {/* MEDIAN ROW */}
        <div style={{ display: "flex", background: T.amber + "08", borderBottom: `1px solid ${T.amber}33`, flexShrink: 0 }}>
          <DataCell width={28}><span style={{ fontSize: 8, color: T.amber, ...mono }}>M</span></DataCell>
          <DataCell width={140}><span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>Median</span></DataCell>
          <DataCell width={48}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
          <DataCell width={52}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
          <DataCell width={44}><span style={{ fontSize: 11, fontWeight: 800, color: T.amber, ...mono }}>{MEDIAN.jedi}</span></DataCell>
          <DataCell width={36}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
          <DataCell width={56}></DataCell>
          <DataCell width={64}><span style={{ fontSize: 9, fontWeight: 600, color: T.amber, ...mono }}>{MEDIAN.rent}</span></DataCell>
          <DataCell width={52}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.rentD}</span></DataCell>
          <DataCell width={48}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.vac}</span></DataCell>
          <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.absorb}</span></DataCell>
          <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.pipeline}</span></DataCell>
          <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.constraint}</span></DataCell>
          <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.jobs}</span></DataCell>
          <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.pop}</span></DataCell>
          <DataCell width={56}><span style={{ fontSize: 9, color: T.amber, ...mono }}>—</span></DataCell>
          <DataCell width={44}><span style={{ fontSize: 9, color: T.amber, ...mono }}>{MEDIAN.cap}</span></DataCell>
          <DataCell width={64}></DataCell>
        </div>

        {/* DATA ROWS */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
          {MSA_DATA.map((d, i) => (
            <MsaRow
              key={d.id}
              d={d}
              i={i}
              selected={sel === i}
              onClick={() => setSel(i)}
              onDoubleClick={() => handleDoubleClick(d.id)}
            />
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted }}>Single-click to select · Double-click row to open Market Overview · Amber row = Median benchmark</span>
        <span style={{ fontSize: 8, color: T.muted }}>JEDI RE · MSA PEER COMPARISON · {MSA_DATA.length} MARKETS</span>
      </div>
    </div>
  );
}

interface MsaRowProps {
  d: typeof MSA_DATA[0];
  i: number;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}

function MsaRow({ d, i, selected, onClick, onDoubleClick }: MsaRowProps) {
  const [hov, setHov] = useState(false);
  const bg = selected ? T.active : hov ? T.hover : i % 2 === 0 ? T.panel : T.panelAlt;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        background: bg,
        borderBottom: `1px solid ${T.borderS}`,
        cursor: "pointer",
        borderLeft: selected ? `2px solid ${T.amber}` : "2px solid transparent",
        transition: "background 0.08s",
      }}
    >
      <DataCell width={28}><span style={{ fontSize: 8, color: T.muted, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{i + 1}</span></DataCell>
      <DataCell width={140}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, fontFamily: "'IBM Plex Sans',sans-serif" }}>{d.name}</span></DataCell>
      <DataCell width={48}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.props.toLocaleString()}</span></DataCell>
      <DataCell width={52}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.units}</span></DataCell>
      <DataCell width={44}><ScoreCell value={d.jedi} /></DataCell>
      <DataCell width={36}><DeltaCell value={d.d30} /></DataCell>
      <DataCell width={56}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DataCell>
      <DataCell width={64}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.rent}</span></DataCell>
      <DataCell width={52}><DeltaCell value={d.rentD} /></DataCell>
      <DataCell width={48}><ThresholdCell value={d.vac} thresholds={[5, 8]} invert /></DataCell>
      <DataCell width={56}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.absorb}</span></DataCell>
      <DataCell width={56}><ThresholdCell value={d.pipeline} thresholds={[8, 12]} invert /></DataCell>
      <DataCell width={44}><ScoreCell value={d.constraint} size={10} /></DataCell>
      <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.jobs}</span></DataCell>
      <DataCell width={44}><DeltaCell value={d.pop} /></DataCell>
      <DataCell width={56}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.medInc}</span></DataCell>
      <DataCell width={44}><span style={{ fontSize: 9, color: T.secondary, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>{d.cap}</span></DataCell>
      <DataCell width={64}><CycleBadge cycle={d.cycle} /></DataCell>
    </div>
  );
}
