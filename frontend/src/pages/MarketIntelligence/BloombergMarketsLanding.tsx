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
  { id: "atlanta-ga", name: "Atlanta, GA", props: 1028, units: "250K", jedi: 87, d30: "+4", trend: [78,80,81,82,83,84,85,86,87], rent: "$2,150", rentD: "+4.2%", vac: "5.8%", absorb: "2,840", pipeline: "15.8%", constraint: 58, jobs: 5.8, pop: "+2.1%", medInc: "$72,400", cap: "5.2%", cycle: "EXPANSION" },
  { id: "raleigh-nc", name: "Raleigh, NC", props: 480, units: "98K", jedi: 85, d30: "+3", trend: [77,78,80,81,82,83,84,84,85], rent: "$1,740", rentD: "+3.9%", vac: "6.2%", absorb: "1,120", pipeline: "11.8%", constraint: 72, jobs: 5.5, pop: "+2.8%", medInc: "$78,200", cap: "5.0%", cycle: "EXPANSION" },
  { id: "jacksonville-fl", name: "Jacksonville, FL", props: 386, units: "82K", jedi: 80, d30: "+5", trend: [70,72,73,74,75,76,77,79,80], rent: "$1,580", rentD: "+3.8%", vac: "5.4%", absorb: "980", pipeline: "9.2%", constraint: 76, jobs: 5.1, pop: "+2.4%", medInc: "$64,200", cap: "5.8%", cycle: "EXPANSION" },
  { id: "tampa-fl", name: "Tampa, FL", props: 892, units: "215K", jedi: 82, d30: "+2", trend: [74,75,76,77,78,79,80,81,82], rent: "$1,908", rentD: "+3.0%", vac: "6.5%", absorb: "2,150", pipeline: "13.4%", constraint: 64, jobs: 5.2, pop: "+1.9%", medInc: "$65,800", cap: "5.4%", cycle: "LATE EXP" },
  { id: "orlando-fl", name: "Orlando, FL", props: 714, units: "178K", jedi: 78, d30: "+1", trend: [72,73,74,74,75,76,77,77,78], rent: "$1,820", rentD: "+2.4%", vac: "7.1%", absorb: "1,680", pipeline: "16.2%", constraint: 48, jobs: 4.9, pop: "+1.7%", medInc: "$62,400", cap: "5.6%", cycle: "PEAK" },
  { id: "miami-fl", name: "Miami, FL", props: 1245, units: "310K", jedi: 74, d30: "-2", trend: [80,79,78,77,76,75,75,74,74], rent: "$2,480", rentD: "+1.2%", vac: "8.4%", absorb: "1,920", pipeline: "18.6%", constraint: 38, jobs: 4.4, pop: "+0.8%", medInc: "$58,900", cap: "4.8%", cycle: "PEAK" },
  { id: "charlotte-nc", name: "Charlotte, NC", props: 680, units: "142K", jedi: 82, d30: "+3", trend: [76,77,78,79,80,80,81,81,82], rent: "$1,680", rentD: "+3.5%", vac: "6.0%", absorb: "1,540", pipeline: "12.4%", constraint: 68, jobs: 5.2, pop: "+2.2%", medInc: "$68,400", cap: "5.2%", cycle: "EXPANSION" },
];

const MEDIAN = { jedi: 81, rent: "$1,879", rentD: "+3.4%", vac: "6.4%", absorb: "1,800", pipeline: "14.2%", constraint: 60, jobs: 5.2, pop: "+2.0%", cap: "5.3%" };

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

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
  if (!value || value === "—") return <span style={{ color: T.muted, fontSize: 9 }}>—</span>;
  const positive = value.startsWith("+");
  const negative = value.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: positive ? T.green : negative ? T.red : T.muted, ...mono }}>{value}</span>;
}

function HC({ children, width, sorted, align = "left" }: { children: React.ReactNode; width: number; sorted?: boolean; align?: string }) {
  return (
    <div style={{ width, minWidth: width, padding: "3px 6px", fontSize: 7, fontWeight: 700, color: sorted ? T.amber : T.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.borderS}`, userSelect: "none", textAlign: align as "left" | "right", ...mono, flexShrink: 0 }}>
      {children}{sorted && <span style={{ marginLeft: 2 }}>▼</span>}
    </div>
  );
}

function DC({ children, width, align = "left", style = {} }: { children: React.ReactNode; width: number; align?: string; style?: React.CSSProperties }) {
  return <div style={{ width, minWidth: width, padding: "4px 6px", borderRight: `1px solid ${T.borderS}`, display: "flex", alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start", flexShrink: 0, ...style }}>{children}</div>;
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
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
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

  const handleDrill = (msa: typeof MSA_DATA[0]) => {
    navigate(`/market-intelligence/markets/${msa.id}`);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 22, padding: "0 12px", background: T.topBar, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.secondary }}>F4 MARKETS · MSA INTELLIGENCE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 8, color: T.muted }}>SORT BY</span>
          {[["jedi", "JEDI"], ["rent", "RENT"], ["vac", "VACANCY"]].map(([k, l]) => (
            <span key={k} onClick={() => setSortKey(k)} style={{ fontSize: 8, fontWeight: sortKey === k ? 700 : 400, color: sortKey === k ? T.bg : T.secondary, background: sortKey === k ? T.amber : "transparent", padding: "2px 6px", cursor: "pointer", border: `1px solid ${sortKey === k ? T.amber : T.borderS}` }}>{l}</span>
          ))}
        </div>
      </div>

      {/* CONTEXT BAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", height: 28, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: T.amber, ...mono }}>MSA INDEX</span>
        <span style={{ color: T.borderM, fontSize: 9 }}>/</span>
        <span style={{ fontSize: 9, color: T.muted, cursor: "pointer" }}>SUBMARKET SECTOR</span>
        <span style={{ color: T.borderM, fontSize: 9 }}>/</span>
        <span style={{ fontSize: 9, color: T.muted, cursor: "pointer" }}>PROPERTY STOCK</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted }}>{MSA_DATA.length} tracked markets · {MSA_DATA.reduce((s, m) => s + m.props, 0).toLocaleString()} properties · Double-click row to open market detail</span>
      </div>

      {/* TITLE ROW */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: T.panel, borderBottom: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.primary, ...sans }}>Market Intelligence</span>
        <span style={{ fontSize: 9, color: T.muted }}>|</span>
        <span style={{ fontSize: 9, color: T.secondary }}>Peer comparison · Sort by JEDI Score · Double-click to open market overview</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: T.muted }}>18 columns</span>
      </div>

      {/* COLUMN HEADERS */}
      <div style={{ display: "flex", background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, overflowX: "auto" }}>
        <HC width={28}>#</HC>
        <HC width={144}>MSA</HC>
        <HC width={48}>PROPS</HC>
        <HC width={52}>UNITS</HC>
        <HC width={44} sorted={sortKey === "jedi"}>JEDI</HC>
        <HC width={36}>Δ30</HC>
        <HC width={56}>TREND</HC>
        <HC width={64}>RENT</HC>
        <HC width={52}>RENT Δ</HC>
        <HC width={48} sorted={sortKey === "vac"}>VAC</HC>
        <HC width={56}>ABSORB</HC>
        <HC width={56}>PIPE %</HC>
        <HC width={44}>CNSTR</HC>
        <HC width={44}>J/APT</HC>
        <HC width={44}>POP Δ</HC>
        <HC width={60}>MED INC</HC>
        <HC width={44}>CAP</HC>
        <HC width={68}>CYCLE</HC>
      </div>

      {/* MEDIAN ROW */}
      <div style={{ display: "flex", background: T.amber + "08", borderBottom: `1px solid ${T.amber}33`, flexShrink: 0, overflowX: "auto" }}>
        <DC width={28}><span style={{ fontSize: 8, color: T.amber }}>M</span></DC>
        <DC width={144}><span style={{ fontSize: 9, fontWeight: 700, color: T.amber, ...mono }}>Median</span></DC>
        <DC width={48}><span style={{ fontSize: 9, color: T.amber }}>—</span></DC>
        <DC width={52}><span style={{ fontSize: 9, color: T.amber }}>—</span></DC>
        <DC width={44}><span style={{ fontSize: 11, fontWeight: 800, color: T.amber }}>{MEDIAN.jedi}</span></DC>
        <DC width={36}><span style={{ fontSize: 9, color: T.amber }}>—</span></DC>
        <DC width={56} />
        <DC width={64}><span style={{ fontSize: 9, fontWeight: 600, color: T.amber }}>{MEDIAN.rent}</span></DC>
        <DC width={52}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.rentD}</span></DC>
        <DC width={48}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.vac}</span></DC>
        <DC width={56}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.absorb}</span></DC>
        <DC width={56}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.pipeline}</span></DC>
        <DC width={44}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.constraint}</span></DC>
        <DC width={44}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.jobs}</span></DC>
        <DC width={44}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.pop}</span></DC>
        <DC width={60}><span style={{ fontSize: 9, color: T.amber }}>—</span></DC>
        <DC width={44}><span style={{ fontSize: 9, color: T.amber }}>{MEDIAN.cap}</span></DC>
        <DC width={68} />
      </div>

      {/* DATA ROWS */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        {sorted.map((d, i) => (
          <div
            key={d.id}
            onClick={() => setSel(i)}
            onDoubleClick={() => handleDrill(d)}
            style={{ display: "flex", background: sel === i ? T.active : i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, cursor: "pointer", borderLeft: sel === i ? `2px solid ${T.amber}` : "2px solid transparent", transition: "background 0.1s" }}
            onMouseEnter={e => { if (sel !== i) (e.currentTarget as HTMLDivElement).style.background = T.hover; }}
            onMouseLeave={e => { if (sel !== i) (e.currentTarget as HTMLDivElement).style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}
          >
            <DC width={28}><span style={{ fontSize: 8, color: T.muted }}>{i + 1}</span></DC>
            <DC width={144}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...sans }}>{d.name}</span></DC>
            <DC width={48}><span style={{ fontSize: 9, color: T.secondary }}>{d.props.toLocaleString()}</span></DC>
            <DC width={52}><span style={{ fontSize: 9, color: T.secondary }}>{d.units}</span></DC>
            <DC width={44}><ScoreCell value={d.jedi} /></DC>
            <DC width={36}><DeltaCell value={d.d30} /></DC>
            <DC width={56}><Spark data={d.trend} color={d.jedi >= 80 ? T.green : T.amber} /></DC>
            <DC width={64}><span style={{ fontSize: 10, fontWeight: 600, color: T.primary }}>{d.rent}</span></DC>
            <DC width={52}><DeltaCell value={d.rentD} /></DC>
            <DC width={48}><ThresholdCell value={d.vac} thresholds={[5, 8]} invert /></DC>
            <DC width={56}><span style={{ fontSize: 9, color: T.secondary }}>{d.absorb}</span></DC>
            <DC width={56}><ThresholdCell value={d.pipeline} thresholds={[8, 12]} invert /></DC>
            <DC width={44}><ScoreCell value={d.constraint} size={10} /></DC>
            <DC width={44}><span style={{ fontSize: 9, color: T.secondary }}>{d.jobs}</span></DC>
            <DC width={44}><DeltaCell value={d.pop} /></DC>
            <DC width={60}><span style={{ fontSize: 9, color: T.secondary }}>{d.medInc}</span></DC>
            <DC width={44}><span style={{ fontSize: 9, color: T.secondary }}>{d.cap}</span></DC>
            <DC width={68}><CycleBadge cycle={d.cycle} /></DC>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted }}>Double-click row → Market Overview · Single-click → Select · Sort by column header</span>
        <span style={{ fontSize: 8, color: T.muted }}>JEDI RE · MSA INTELLIGENCE · {new Date().toLocaleTimeString("en-US", { hour12: false })}</span>
      </div>
    </div>
  );
}
