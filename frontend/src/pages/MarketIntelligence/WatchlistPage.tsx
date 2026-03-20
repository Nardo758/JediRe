import React, { useState } from "react";

const T = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810", input: "#0D1117",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  borderS: "#1E2538", borderM: "#2A3348",
};
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

// ─── Available items to watch ─────────────────────────────────────────────────
type WatchItemType = "MSA" | "SUB";
interface WatchItem {
  id: string; type: WatchItemType; name: string; parent?: string;
  jedi: number; d30: string; trend: number[];
  rent: string; rentD: string; vac: string; metric1: string; metric1Label: string;
  cycle: string; cap: string; note?: string;
}

const ALL_AVAILABLE: WatchItem[] = [
  // MSAs
  { id:"atlanta-ga",    type:"MSA", name:"Atlanta, GA",      jedi:87, d30:"+4", trend:[78,80,81,82,83,84,85,86,87], rent:"$2,150", rentD:"+4.2%", vac:"5.8%", metric1:"2,840", metric1Label:"ABSORB", cycle:"EXPANSION", cap:"5.2%" },
  { id:"raleigh-nc",    type:"MSA", name:"Raleigh, NC",       jedi:85, d30:"+3", trend:[77,78,80,81,82,83,84,84,85], rent:"$1,740", rentD:"+3.9%", vac:"6.2%", metric1:"1,120", metric1Label:"ABSORB", cycle:"EXPANSION", cap:"5.0%" },
  { id:"charlotte-nc",  type:"MSA", name:"Charlotte, NC",     jedi:83, d30:"+2", trend:[76,77,78,79,80,81,82,82,83], rent:"$1,860", rentD:"+3.1%", vac:"6.0%", metric1:"1,540", metric1Label:"ABSORB", cycle:"EXPANSION", cap:"5.1%" },
  { id:"tampa-fl",      type:"MSA", name:"Tampa, FL",         jedi:82, d30:"+2", trend:[74,75,76,77,78,79,80,81,82], rent:"$1,908", rentD:"+3.0%", vac:"6.5%", metric1:"2,150", metric1Label:"ABSORB", cycle:"LATE EXP",  cap:"5.4%" },
  { id:"orlando-fl",    type:"MSA", name:"Orlando, FL",       jedi:78, d30:"+1", trend:[72,73,74,74,75,76,77,77,78], rent:"$1,820", rentD:"+2.4%", vac:"7.1%", metric1:"1,680", metric1Label:"ABSORB", cycle:"PEAK",      cap:"5.6%" },
  { id:"miami-fl",      type:"MSA", name:"Miami, FL",         jedi:74, d30:"-2", trend:[80,79,78,77,76,75,75,74,74], rent:"$2,480", rentD:"+1.2%", vac:"8.4%", metric1:"1,920", metric1Label:"ABSORB", cycle:"PEAK",      cap:"4.8%" },
  { id:"nashville-tn",  type:"MSA", name:"Nashville, TN",     jedi:86, d30:"+3", trend:[79,80,81,82,83,84,85,85,86], rent:"$1,980", rentD:"+4.0%", vac:"5.5%", metric1:"2,210", metric1Label:"ABSORB", cycle:"EXPANSION", cap:"5.1%" },
  { id:"austin-tx",     type:"MSA", name:"Austin, TX",        jedi:80, d30:"-1", trend:[84,83,83,82,81,81,80,80,80], rent:"$2,120", rentD:"+0.8%", vac:"7.8%", metric1:"2,050", metric1Label:"ABSORB", cycle:"PEAK",      cap:"5.0%" },
  { id:"phoenix-az",    type:"MSA", name:"Phoenix, AZ",       jedi:76, d30:"+1", trend:[72,73,73,74,74,75,75,75,76], rent:"$1,740", rentD:"+1.9%", vac:"8.2%", metric1:"3,120", metric1Label:"ABSORB", cycle:"PEAK",      cap:"5.5%" },
  // Submarkets — Atlanta
  { id:"atl-midtown",     type:"SUB", parent:"Atlanta, GA", name:"Midtown",      jedi:88, d30:"+3", trend:[80,82,83,84,85,86,86,87,88], rent:"$2,056", rentD:"+4.8%", vac:"5.1%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"12 mo", cap:"4.8%" },
  { id:"atl-buckhead",    type:"SUB", parent:"Atlanta, GA", name:"Buckhead",     jedi:84, d30:"+1", trend:[78,79,80,81,82,82,83,83,84], rent:"$1,883", rentD:"+2.1%", vac:"6.2%", metric1:"BALANCED", metric1Label:"PRESS", cycle:"11 mo", cap:"5.0%" },
  { id:"atl-westend",     type:"SUB", parent:"Atlanta, GA", name:"West End",     jedi:79, d30:"+6", trend:[68,70,72,73,74,75,76,78,79], rent:"$1,977", rentD:"+5.2%", vac:"6.8%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"8 mo",  cap:"5.4%", note:"High momentum" },
  { id:"atl-eastatlanta", type:"SUB", parent:"Atlanta, GA", name:"East Atlanta", jedi:72, d30:"-1", trend:[74,74,73,73,72,72,72,72,72], rent:"$2,031", rentD:"-0.6%", vac:"8.4%", metric1:"SELLER",   metric1Label:"PRESS", cycle:"22 mo", cap:"5.8%", note:"Oversupply risk" },
  { id:"atl-downtown",    type:"SUB", parent:"Atlanta, GA", name:"Downtown ATL", jedi:76, d30:"+2", trend:[70,71,72,73,73,74,75,75,76], rent:"$1,542", rentD:"+2.8%", vac:"7.2%", metric1:"BALANCED", metric1Label:"PRESS", cycle:"18 mo", cap:"5.6%" },
  { id:"atl-sandy",       type:"SUB", parent:"Atlanta, GA", name:"Sandy Springs",jedi:81, d30:"+2", trend:[74,75,76,77,78,79,79,80,81], rent:"$1,920", rentD:"+3.4%", vac:"5.8%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"12 mo", cap:"5.2%" },
  // Submarkets — Raleigh
  { id:"ral-dtowntn",   type:"SUB", parent:"Raleigh, NC", name:"Downtown Raleigh",jedi:83, d30:"+4", trend:[76,77,78,79,80,81,81,82,83], rent:"$1,920", rentD:"+4.1%", vac:"5.4%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"10 mo", cap:"4.9%" },
  { id:"ral-northhills", type:"SUB", parent:"Raleigh, NC", name:"North Hills",   jedi:80, d30:"+2", trend:[74,75,76,77,77,78,79,79,80], rent:"$1,740", rentD:"+2.8%", vac:"6.1%", metric1:"BALANCED", metric1Label:"PRESS", cycle:"13 mo", cap:"5.2%" },
  // Submarkets — Charlotte
  { id:"clt-uptown",    type:"SUB", parent:"Charlotte, NC", name:"Uptown",       jedi:82, d30:"+3", trend:[75,76,77,78,79,80,80,81,82], rent:"$2,050", rentD:"+3.6%", vac:"5.5%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"9 mo",  cap:"4.7%" },
  { id:"clt-southend",  type:"SUB", parent:"Charlotte, NC", name:"South End",    jedi:85, d30:"+5", trend:[78,79,80,81,82,83,84,84,85], rent:"$1,950", rentD:"+5.0%", vac:"4.8%", metric1:"BUYER",    metric1Label:"PRESS", cycle:"7 mo",  cap:"4.5%", note:"Hot supply gap" },
];

const DEFAULT_WATCHLIST_IDS = ["atlanta-ga","raleigh-nc","atl-midtown","atl-buckhead","atl-westend","clt-southend"];

function Spark({ data, color = T.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

function TypeBadge({ type }: { type: WatchItemType }) {
  return (
    <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: type === "MSA" ? T.amber : T.cyan, background: type === "MSA" ? T.amber + "18" : T.cyan + "18", border: `1px solid ${type === "MSA" ? T.amber + "44" : T.cyan + "44"}`, padding: "1px 4px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
      {type}
    </span>
  );
}

function CycleBadge({ label, type }: { label: string; type: WatchItemType }) {
  const c: Record<string, string> = { EXPANSION: T.green, "LATE EXP": T.amber, PEAK: T.orange, CONTRACTION: T.red };
  const color = type === "MSA" ? (c[label] || T.muted) : T.secondary;
  return <span style={{ ...mono, fontSize: 8, color, fontWeight: 600 }}>{label}</span>;
}

function PressureColor(p: string) {
  return p === "BUYER" ? T.green : p === "BALANCED" ? T.amber : p === "SELLER" ? T.cyan : T.secondary;
}

function ScoreCell({ value }: { value: number }) {
  const c = value >= 80 ? T.green : value >= 65 ? T.amber : T.red;
  return <span style={{ fontSize: 13, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string }) {
  const positive = value.startsWith("+"), negative = value.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: positive ? T.green : negative ? T.red : T.muted, ...mono }}>{value}</span>;
}

interface WatchlistPageProps { embedded?: boolean; }

export default function WatchlistPage({ embedded = false }: WatchlistPageProps) {
  const [watchIds, setWatchIds] = useState<string[]>(DEFAULT_WATCHLIST_IDS);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState<"ALL" | "MSA" | "SUB">("ALL");
  const [pickerSearch, setPickerSearch] = useState("");
  const [sortKey, setSortKey] = useState<"jedi" | "name" | "rentD" | "vac">("jedi");
  const [sortAsc, setSortAsc] = useState(false);

  const watchList = ALL_AVAILABLE.filter(i => watchIds.includes(i.id));
  const sorted = [...watchList].sort((a, b) => {
    if (sortKey === "jedi") return sortAsc ? a.jedi - b.jedi : b.jedi - a.jedi;
    if (sortKey === "name") return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    if (sortKey === "rentD") {
      const an = parseFloat(a.rentD.replace(/[^0-9.-]/g, "")) * (a.rentD.startsWith("-") ? -1 : 1);
      const bn = parseFloat(b.rentD.replace(/[^0-9.-]/g, "")) * (b.rentD.startsWith("-") ? -1 : 1);
      return sortAsc ? an - bn : bn - an;
    }
    if (sortKey === "vac") {
      const an = parseFloat(a.vac), bn = parseFloat(b.vac);
      return sortAsc ? an - bn : bn - an;
    }
    return 0;
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(v => !v); else { setSortKey(key); setSortAsc(false); }
  };

  const remove = (id: string) => setWatchIds(prev => prev.filter(i => i !== id));
  const add = (id: string) => { setWatchIds(prev => prev.includes(id) ? prev : [...prev, id]); };

  const available = ALL_AVAILABLE.filter(i =>
    !watchIds.includes(i.id) &&
    (pickerFilter === "ALL" || i.type === pickerFilter) &&
    (pickerSearch === "" || i.name.toLowerCase().includes(pickerSearch.toLowerCase()) || (i.parent||"").toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  const SortBtn = ({ label, k }: { label: string; k: typeof sortKey }) => (
    <button onClick={() => toggleSort(k)} style={{ background: "transparent", border: "none", color: sortKey === k ? T.amber : T.muted, fontSize: 7, fontWeight: 700, cursor: "pointer", padding: "2px 6px", letterSpacing: 0.5, ...mono, display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      {label}{sortKey === k && <span>{sortAsc ? "▲" : "▼"}</span>}
    </button>
  );

  return (
    <div style={{ background: T.bg, display: "flex", flexDirection: "column", color: T.primary, overflow: "hidden", ...(embedded ? { flex: 1 } : { height: "100vh" }), ...mono }}>

      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 28, background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: T.amber, fontWeight: 700, letterSpacing: 1 }}>WATCHLIST</span>
        <span style={{ fontSize: 9, color: T.muted }}>·</span>
        <span style={{ fontSize: 9, color: T.secondary }}>{watchIds.length} tracked</span>
        <div style={{ flex: 1 }} />
        {/* Sort pills */}
        <span style={{ fontSize: 7, color: T.muted, letterSpacing: 0.5 }}>SORT</span>
        <SortBtn label="JEDI" k="jedi" />
        <SortBtn label="NAME" k="name" />
        <SortBtn label="RENT Δ" k="rentD" />
        <SortBtn label="VAC" k="vac" />
        <div style={{ width: 1, height: 14, background: T.borderM, margin: "0 4px" }} />
        {/* Add button */}
        <button
          onClick={() => { setShowPicker(v => !v); setPickerSearch(""); setPickerFilter("ALL"); }}
          style={{ background: showPicker ? T.amber : "transparent", color: showPicker ? T.bg : T.amber, border: `1px solid ${T.amber}`, fontSize: 9, fontWeight: 700, padding: "2px 10px", cursor: "pointer", letterSpacing: 0.5, ...mono }}
        >
          {showPicker ? "✕ CLOSE" : "+ ADD"}
        </button>
      </div>

      {/* PICKER PANEL */}
      {showPicker && (
        <div style={{ background: T.panel, borderBottom: `1px solid ${T.borderM}`, padding: "8px 10px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 8, color: T.muted, letterSpacing: 0.5 }}>TYPE</span>
            {(["ALL", "MSA", "SUB"] as const).map(f => (
              <button key={f} onClick={() => setPickerFilter(f)} style={{ background: pickerFilter === f ? T.amber + "22" : "transparent", color: pickerFilter === f ? T.amber : T.secondary, border: `1px solid ${pickerFilter === f ? T.amber : T.borderS}`, fontSize: 8, fontWeight: pickerFilter === f ? 700 : 400, padding: "1px 7px", cursor: "pointer", ...mono }}>
                {f === "SUB" ? "SUBMARKET" : f}
              </button>
            ))}
            <input
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Search..."
              style={{ background: T.input, border: `1px solid ${T.borderS}`, color: T.primary, fontSize: 9, padding: "2px 8px", outline: "none", ...mono, flex: "0 1 180px" }}
            />
            <span style={{ fontSize: 8, color: T.muted, marginLeft: "auto" }}>{available.length} available</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 80, overflowY: "auto" }}>
            {available.length === 0 && (
              <span style={{ fontSize: 9, color: T.muted }}>All matching items already on watchlist.</span>
            )}
            {available.map(item => (
              <button
                key={item.id}
                onClick={() => { add(item.id); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: T.hover, border: `1px solid ${T.borderS}`, color: T.primary, fontSize: 9, padding: "3px 8px", cursor: "pointer", ...mono, whiteSpace: "nowrap" }}
              >
                <TypeBadge type={item.type} />
                {item.parent && <span style={{ color: T.muted, fontSize: 8 }}>{item.parent} ›</span>}
                {item.name}
                <span style={{ color: T.green, fontSize: 8 }}>+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* COLUMN HEADERS */}
      <div style={{ display: "flex", alignItems: "center", background: T.header, borderBottom: `1px solid ${T.borderM}`, flexShrink: 0, height: 22 }}>
        <div style={{ width: 28, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>PIN</div>
        <div style={{ width: 36, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>TYPE</div>
        <div style={{ flex: 1, minWidth: 120, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, letterSpacing: 0.5 }}>NAME</div>
        <div style={{ width: 50, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, textAlign: "center", flexShrink: 0 }}>JEDI</div>
        <div style={{ width: 36, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, textAlign: "center", flexShrink: 0 }}>Δ30</div>
        <div style={{ width: 60, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>TREND</div>
        <div style={{ width: 64, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>RENT</div>
        <div style={{ width: 52, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>RENT Δ</div>
        <div style={{ width: 48, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>VAC</div>
        <div style={{ width: 80, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>METRIC</div>
        <div style={{ width: 80, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>CYCLE / MO S</div>
        <div style={{ width: 44, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>CAP</div>
        <div style={{ width: 80, padding: "0 6px", fontSize: 7, color: T.muted, fontWeight: 700, flexShrink: 0 }}>NOTE</div>
        <div style={{ width: 28, flexShrink: 0 }} />
      </div>

      {/* ROWS */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sorted.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Your watchlist is empty</div>
            <div style={{ fontSize: 9, color: T.muted }}>Click + ADD above to track markets and submarkets</div>
          </div>
        )}
        {sorted.map((item, i) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", background: i % 2 === 0 ? T.panel : T.panelAlt, borderBottom: `1px solid ${T.borderS}`, minHeight: 36, borderLeft: item.type === "MSA" ? `2px solid ${T.amber}44` : `2px solid ${T.cyan}44` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.hover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? T.panel : T.panelAlt; }}
          >
            {/* Pin icon */}
            <div style={{ width: 28, padding: "0 6px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: T.amber }}>★</span>
            </div>
            {/* Type badge */}
            <div style={{ width: 36, padding: "0 6px", flexShrink: 0 }}>
              <TypeBadge type={item.type} />
            </div>
            {/* Name */}
            <div style={{ flex: 1, minWidth: 120, padding: "0 6px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...sans }}>{item.name}</div>
              {item.type === "SUB" && item.parent && (
                <div style={{ fontSize: 8, color: T.muted }}>{item.parent}</div>
              )}
            </div>
            {/* JEDI */}
            <div style={{ width: 50, padding: "0 6px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ScoreCell value={item.jedi} />
            </div>
            {/* D30 */}
            <div style={{ width: 36, padding: "0 6px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DeltaCell value={item.d30} />
            </div>
            {/* Trend sparkline */}
            <div style={{ width: 60, padding: "0 6px", flexShrink: 0, display: "flex", alignItems: "center" }}>
              <Spark data={item.trend} color={item.jedi >= 80 ? T.green : item.jedi >= 65 ? T.amber : T.red} w={48} h={14} />
            </div>
            {/* Rent */}
            <div style={{ width: 64, padding: "0 6px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.primary, ...mono }}>{item.rent}</span>
            </div>
            {/* Rent Δ */}
            <div style={{ width: 52, padding: "0 6px", flexShrink: 0 }}>
              <DeltaCell value={item.rentD} />
            </div>
            {/* Vac */}
            <div style={{ width: 48, padding: "0 6px", flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: parseFloat(item.vac) <= 6 ? T.green : parseFloat(item.vac) <= 8 ? T.amber : T.red, ...mono, fontWeight: 600 }}>{item.vac}</span>
            </div>
            {/* Context metric */}
            <div style={{ width: 80, padding: "0 6px", flexShrink: 0 }}>
              <div style={{ fontSize: 7, color: T.muted, letterSpacing: 0.4 }}>{item.metric1Label}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: item.metric1Label === "PRESS" ? PressureColor(item.metric1) : T.secondary, ...mono }}>{item.metric1}</div>
            </div>
            {/* Cycle / Mo supply */}
            <div style={{ width: 80, padding: "0 6px", flexShrink: 0 }}>
              <CycleBadge label={item.cycle} type={item.type} />
            </div>
            {/* Cap */}
            <div style={{ width: 44, padding: "0 6px", flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: T.secondary, ...mono }}>{item.cap}</span>
            </div>
            {/* Note */}
            <div style={{ width: 80, padding: "0 6px", flexShrink: 0, overflow: "hidden" }}>
              {item.note && <span style={{ fontSize: 8, color: T.orange, ...mono, whiteSpace: "nowrap" }}>{item.note}</span>}
            </div>
            {/* Remove */}
            <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button onClick={() => remove(item.id)} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 11, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.red}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted}
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 10px", background: T.topBar, borderTop: `1px solid ${T.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: T.muted, ...mono }}>★ = watching · ✕ = remove · + ADD to pin new markets or submarkets</span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 8, color: T.amber + "88", ...mono }}>{sorted.filter(i => i.type === "MSA").length} MSA</span>
          <span style={{ fontSize: 8, color: T.cyan + "88", ...mono }}>{sorted.filter(i => i.type === "SUB").length} SUBMARKETS</span>
        </div>
      </div>
    </div>
  );
}
