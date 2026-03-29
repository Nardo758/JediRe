import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PeerComparisonPage from "../MarketIntelligence/PeerComparisonPage";
import { MSATerminal } from "../../components/terminal/MSATerminal";
import { SubmarketTerminal } from "../../components/terminal/SubmarketTerminal";
import { PropertyTerminal } from "../../components/terminal/PropertyTerminal";
import { BT } from "../../components/terminal/theme";

/**
 * F4 Markets View - Refactored
 * 
 * Structure:
 * - DASHBOARD: KPIs + Market table (tracked) + Alerts + Movers
 * - BROWSE: All markets table with filters
 * - SUBMARKETS: Submarket exploration
 * - PROPERTIES: Property-level data
 * - COMPARE: Peer comparison tool
 * 
 * Click any market row → drills into MSA Terminal
 */

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

const C = {
  bg: BT.bg.terminal,
  panel: BT.bg.panel,
  panelAlt: BT.bg.panelAlt,
  header: BT.bg.hover,
  hover: BT.bg.active,
  active: BT.bg.active,
  primary: BT.text.primary,
  secondary: BT.text.secondary,
  muted: BT.text.muted,
  amber: BT.text.amber,
  amberBright: "#FFD166",
  green: BT.text.green,
  red: BT.text.red,
  cyan: BT.text.cyan,
  orange: "#FF8C42",
  purple: BT.text.purple,
  blue: BT.text.blue,
  borderS: BT.border.subtle,
  borderM: BT.border.medium,
};

// ============================================================================
// Data Types
// ============================================================================

interface TrackedMarket {
  id: string;
  rank: number;
  starred: boolean;
  msa: string;
  props: number;
  units: string;
  jedi: number;
  d30: number;
  trend: number[];
  rent: string;
  rentNum: number;
  rentD: string;
  vac: string;
  vacNum: number;
  absorb: string;
  absorbNum: number;
  pipeline: string;
  pipelineNum: number;
  costs: string;
  costsNum: number;
  dApt: string;
  dAptNum: number;
  popD: string;
  popDNum: number;
  medInc: string;
  medIncNum: number;
  cap: string;
  capNum: number;
  cycle: string;
}

interface Alert {
  id: string;
  market: string;
  message: string;
  type: "positive" | "negative" | "neutral";
  timestamp: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const ALL_MARKETS: TrackedMarket[] = [
  { id: "atlanta-ga", rank: 1, starred: true, msa: "Atlanta, GA", props: 1028, units: "250K", jedi: 87, d30: 4, trend: [78,80,82,83,84,85,86,87], rent: "$2,150", rentNum: 2150, rentD: "+4.2%", vac: "5.8%", vacNum: 5.8, absorb: "2,840", absorbNum: 2840, pipeline: "15.8%", pipelineNum: 15.8, costs: "$8,200", costsNum: 8200, dApt: "58", dAptNum: 58, popD: "+2.1%", popDNum: 2.1, medInc: "$72,400", medIncNum: 72400, cap: "5.2%", capNum: 5.2, cycle: "EXPANSION" },
  { id: "raleigh-nc", rank: 2, starred: true, msa: "Raleigh, NC", props: 480, units: "98K", jedi: 85, d30: 3, trend: [76,78,80,81,82,83,84,85], rent: "$1,740", rentNum: 1740, rentD: "+3.9%", vac: "6.2%", vacNum: 6.2, absorb: "1,120", absorbNum: 1120, pipeline: "11.8%", pipelineNum: 11.8, costs: "$7,200", costsNum: 7200, dApt: "72", dAptNum: 72, popD: "+2.8%", popDNum: 2.8, medInc: "$78,200", medIncNum: 78200, cap: "5.0%", capNum: 5.0, cycle: "EXPANSION" },
  { id: "tampa-fl", rank: 3, starred: true, msa: "Tampa, FL", props: 892, units: "215K", jedi: 82, d30: 2, trend: [74,76,78,79,80,81,81,82], rent: "$1,908", rentNum: 1908, rentD: "+3.0%", vac: "6.5%", vacNum: 6.5, absorb: "2,150", absorbNum: 2150, pipeline: "13.4%", pipelineNum: 13.4, costs: "$9,100", costsNum: 9100, dApt: "64", dAptNum: 64, popD: "+1.9%", popDNum: 1.9, medInc: "$65,800", medIncNum: 65800, cap: "5.4%", capNum: 5.4, cycle: "LATE EXP" },
  { id: "jacksonville-fl", rank: 4, starred: false, msa: "Jacksonville, FL", props: 386, units: "82K", jedi: 80, d30: 5, trend: [68,70,72,74,76,78,79,80], rent: "$1,580", rentNum: 1580, rentD: "+3.8%", vac: "5.4%", vacNum: 5.4, absorb: "980", absorbNum: 980, pipeline: "9.2%", pipelineNum: 9.2, costs: "$6,400", costsNum: 6400, dApt: "76", dAptNum: 76, popD: "+2.4%", popDNum: 2.4, medInc: "$64,200", medIncNum: 64200, cap: "5.8%", capNum: 5.8, cycle: "EXPANSION" },
  { id: "orlando-fl", rank: 5, starred: false, msa: "Orlando, FL", props: 714, units: "178K", jedi: 78, d30: 1, trend: [72,73,74,75,76,77,77,78], rent: "$1,820", rentNum: 1820, rentD: "+2.4%", vac: "7.1%", vacNum: 7.1, absorb: "1,680", absorbNum: 1680, pipeline: "16.2%", pipelineNum: 16.2, costs: "$8,600", costsNum: 8600, dApt: "48", dAptNum: 48, popD: "+1.7%", popDNum: 1.7, medInc: "$62,400", medIncNum: 62400, cap: "5.6%", capNum: 5.6, cycle: "PEAK" },
  { id: "miami-fl", rank: 6, starred: false, msa: "Miami, FL", props: 1245, units: "310K", jedi: 74, d30: -2, trend: [80,79,78,77,76,75,74,74], rent: "$2,480", rentNum: 2480, rentD: "+1.2%", vac: "8.4%", vacNum: 8.4, absorb: "1,920", absorbNum: 1920, pipeline: "18.6%", pipelineNum: 18.6, costs: "$12,200", costsNum: 12200, dApt: "38", dAptNum: 38, popD: "+0.8%", popDNum: 0.8, medInc: "$58,900", medIncNum: 58900, cap: "5.0%", capNum: 5.0, cycle: "PEAK" },
  { id: "charlotte-nc", rank: 7, starred: false, msa: "Charlotte, NC", props: 620, units: "155K", jedi: 83, d30: 3, trend: [75,77,78,79,80,81,82,83], rent: "$1,680", rentNum: 1680, rentD: "+3.6%", vac: "6.0%", vacNum: 6.0, absorb: "1,450", absorbNum: 1450, pipeline: "12.6%", pipelineNum: 12.6, costs: "$7,800", costsNum: 7800, dApt: "65", dAptNum: 65, popD: "+2.3%", popDNum: 2.3, medInc: "$68,500", medIncNum: 68500, cap: "5.3%", capNum: 5.3, cycle: "EXPANSION" },
  { id: "nashville-tn", rank: 8, starred: false, msa: "Nashville, TN", props: 540, units: "132K", jedi: 81, d30: 2, trend: [73,75,76,77,78,79,80,81], rent: "$1,720", rentNum: 1720, rentD: "+3.2%", vac: "6.8%", vacNum: 6.8, absorb: "1,280", absorbNum: 1280, pipeline: "14.2%", pipelineNum: 14.2, costs: "$8,400", costsNum: 8400, dApt: "60", dAptNum: 60, popD: "+1.8%", popDNum: 1.8, medInc: "$67,200", medIncNum: 67200, cap: "5.1%", capNum: 5.1, cycle: "LATE EXP" },
  { id: "austin-tx", rank: 9, starred: false, msa: "Austin, TX", props: 780, units: "195K", jedi: 76, d30: -1, trend: [82,81,80,79,78,77,76,76], rent: "$1,890", rentNum: 1890, rentD: "+1.8%", vac: "8.2%", vacNum: 8.2, absorb: "1,560", absorbNum: 1560, pipeline: "19.4%", pipelineNum: 19.4, costs: "$9,800", costsNum: 9800, dApt: "42", dAptNum: 42, popD: "+2.5%", popDNum: 2.5, medInc: "$76,800", medIncNum: 76800, cap: "4.8%", capNum: 4.8, cycle: "PEAK" },
  { id: "dallas-tx", rank: 10, starred: false, msa: "Dallas, TX", props: 1380, units: "345K", jedi: 79, d30: 1, trend: [74,75,76,76,77,78,78,79], rent: "$1,640", rentNum: 1640, rentD: "+2.6%", vac: "7.4%", vacNum: 7.4, absorb: "2,680", absorbNum: 2680, pipeline: "16.8%", pipelineNum: 16.8, costs: "$7,600", costsNum: 7600, dApt: "52", dAptNum: 52, popD: "+1.6%", popDNum: 1.6, medInc: "$70,100", medIncNum: 70100, cap: "5.4%", capNum: 5.4, cycle: "LATE EXP" },
  { id: "phoenix-az", rank: 11, starred: false, msa: "Phoenix, AZ", props: 920, units: "228K", jedi: 77, d30: 0, trend: [78,78,77,77,77,77,77,77], rent: "$1,560", rentNum: 1560, rentD: "+2.0%", vac: "7.8%", vacNum: 7.8, absorb: "1,840", absorbNum: 1840, pipeline: "15.2%", pipelineNum: 15.2, costs: "$8,200", costsNum: 8200, dApt: "46", dAptNum: 46, popD: "+1.4%", popDNum: 1.4, medInc: "$64,800", medIncNum: 64800, cap: "5.5%", capNum: 5.5, cycle: "PEAK" },
  { id: "denver-co", rank: 12, starred: false, msa: "Denver, CO", props: 680, units: "168K", jedi: 75, d30: -1, trend: [80,79,78,77,76,76,75,75], rent: "$1,780", rentNum: 1780, rentD: "+1.4%", vac: "8.6%", vacNum: 8.6, absorb: "1,120", absorbNum: 1120, pipeline: "17.8%", pipelineNum: 17.8, costs: "$10,200", costsNum: 10200, dApt: "40", dAptNum: 40, popD: "+1.2%", popDNum: 1.2, medInc: "$78,400", medIncNum: 78400, cap: "4.9%", capNum: 4.9, cycle: "CONTRACTION" },
];

const SUBMARKET_INDEX = [
  { name: "Midtown", msa: "Atlanta, GA", msaId: "atlanta-ga", jedi: 88, rent: "$2,056", rentD: "+4.8%", vac: "5.1%", props: 52, units: "14.8K", opp: 82, cap: "4.8%", cycle: "EXPANSION" },
  { name: "Buckhead", msa: "Atlanta, GA", msaId: "atlanta-ga", jedi: 84, rent: "$1,883", rentD: "+2.1%", vac: "6.2%", props: 38, units: "11.2K", opp: 78, cap: "5.0%", cycle: "EXPANSION" },
  { name: "Sandy Springs", msa: "Atlanta, GA", msaId: "atlanta-ga", jedi: 81, rent: "$1,920", rentD: "+3.4%", vac: "5.8%", props: 44, units: "12.6K", opp: 74, cap: "5.2%", cycle: "EXPANSION" },
  { name: "Downtown Tampa", msa: "Tampa, FL", msaId: "tampa-fl", jedi: 80, rent: "$1,850", rentD: "+3.2%", vac: "6.8%", props: 62, units: "18.4K", opp: 72, cap: "5.4%", cycle: "LATE EXP" },
  { name: "Ybor City", msa: "Tampa, FL", msaId: "tampa-fl", jedi: 78, rent: "$1,720", rentD: "+4.1%", vac: "5.6%", props: 28, units: "8.2K", opp: 80, cap: "5.6%", cycle: "EXPANSION" },
  { name: "South Beach", msa: "Miami, FL", msaId: "miami-fl", jedi: 76, rent: "$2,890", rentD: "+0.8%", vac: "9.2%", props: 45, units: "15.6K", opp: 62, cap: "4.6%", cycle: "PEAK" },
  { name: "Brickell", msa: "Miami, FL", msaId: "miami-fl", jedi: 74, rent: "$3,120", rentD: "+0.4%", vac: "8.8%", props: 52, units: "18.2K", opp: 58, cap: "4.4%", cycle: "PEAK" },
  { name: "Downtown Raleigh", msa: "Raleigh, NC", msaId: "raleigh-nc", jedi: 86, rent: "$1,680", rentD: "+4.2%", vac: "5.4%", props: 32, units: "9.8K", opp: 84, cap: "5.2%", cycle: "EXPANSION" },
];

const PROPERTY_INDEX = [
  { name: "The Metropolitan", submarket: "Midtown", msa: "Atlanta, GA", jedi: 94, units: 412, rent: "$2,450", occ: "96.2%", capRate: "4.6%", vintage: 2019, owner: "Greystar" },
  { name: "Avalon Buckhead", submarket: "Buckhead", msa: "Atlanta, GA", jedi: 91, units: 380, rent: "$2,280", occ: "95.8%", capRate: "4.8%", vintage: 2017, owner: "AvalonBay" },
  { name: "Camden Midtown", submarket: "Midtown", msa: "Atlanta, GA", jedi: 89, units: 305, rent: "$2,120", occ: "94.6%", capRate: "5.0%", vintage: 2015, owner: "Camden" },
  { name: "Channel District Lofts", submarket: "Downtown Tampa", msa: "Tampa, FL", jedi: 85, units: 248, rent: "$1,920", occ: "93.4%", capRate: "5.2%", vintage: 2018, owner: "ZOM Living" },
  { name: "Soleste Grand Central", submarket: "Brickell", msa: "Miami, FL", jedi: 82, units: 360, rent: "$3,280", occ: "91.2%", capRate: "4.4%", vintage: 2021, owner: "Estate" },
  { name: "The Edison", submarket: "Downtown Raleigh", msa: "Raleigh, NC", jedi: 88, units: 280, rent: "$1,780", occ: "95.2%", capRate: "5.0%", vintage: 2020, owner: "Crescent" },
  { name: "Midtown Terrace", submarket: "Midtown", msa: "Atlanta, GA", jedi: 42, units: 180, rent: "$1,420", occ: "88.4%", capRate: "6.2%", vintage: 1998, owner: "Local LLC" },
  { name: "Nocatee Town Center", submarket: "Nocatee", msa: "Jacksonville, FL", jedi: 84, units: 320, rent: "$1,650", occ: "96.8%", capRate: "5.4%", vintage: 2022, owner: "NexMetro" },
];

const MOCK_ALERTS: Alert[] = [
  { id: "1", market: "Jacksonville", message: "JEDI +5 pts (30d)", type: "positive", timestamp: "2h ago" },
  { id: "2", market: "Atlanta", message: "Rent growth +4.2% YoY", type: "positive", timestamp: "4h ago" },
  { id: "3", market: "Miami", message: "Vacancy hit 8.4%", type: "negative", timestamp: "6h ago" },
  { id: "4", market: "Denver", message: "Entering contraction", type: "negative", timestamp: "1d ago" },
];

// ============================================================================
// Helper Components
// ============================================================================

function Spark({ data, color = C.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 9, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}

function ScoreCell({ value, size = 11 }: { value: number | string; size?: number }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? C.green : n >= 65 ? C.amber : C.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string | number | undefined }) {
  if (value === undefined || value === "—") return <span style={{ color: C.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value);
  const pos = s.startsWith("+") || (typeof value === "number" && value > 0);
  const neg = s.startsWith("-") || (typeof value === "number" && value < 0);
  const display = typeof value === "number" ? (value >= 0 ? `+${value}` : `${value}`) : s;
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? C.green : neg ? C.red : C.muted, ...mono }}>{display}</span>;
}

function ThresholdVal({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? C.green : n <= thresholds[1] ? C.amber : C.red;
  else c = n >= thresholds[0] ? C.green : n >= thresholds[1] ? C.amber : C.red;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

function KPICard({ label, value, subtext, color }: { label: string; value: string | number; subtext?: string; color?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.borderS}`, padding: "8px 12px", textAlign: "center", minWidth: 90 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, letterSpacing: 0.5, ...mono, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || C.primary, ...mono }}>{value}</div>
      {subtext && <div style={{ fontSize: 9, color: C.secondary, ...mono, marginTop: 2 }}>{subtext}</div>}
    </div>
  );
}

const cycleColor = (c: string) => {
  if (c === "EXPANSION") return C.green;
  if (c === "LATE EXP") return C.amber;
  if (c === "PEAK") return C.orange;
  if (c === "CONTRACTION") return C.red;
  return C.muted;
};

// ============================================================================
// Styles
// ============================================================================

const hdrCell: React.CSSProperties = {
  padding: "4px 6px", fontSize: 9, fontWeight: 700, color: "#4A5568",
  letterSpacing: 0.5, borderRight: "1px solid #1E2538", borderBottom: "1px solid #2A3348",
  textAlign: "center", cursor: "pointer", whiteSpace: "nowrap", ...mono,
};

const dataCell: React.CSSProperties = {
  padding: "4px 6px", textAlign: "center", borderRight: "1px solid #1E2538", ...mono, whiteSpace: "nowrap",
};

// ============================================================================
// Types
// ============================================================================

type ActiveTab = "dashboard" | "browse" | "submarkets" | "properties" | "compare";
type DrillLevel = "landing" | "msa-terminal" | "submarket-terminal" | "property-terminal";
type SortKey = "rank" | "msa" | "jedi" | "d30" | "rentNum" | "vacNum" | "absorbNum" | "pipelineNum" | "capNum" | "cycle";
type CycleFilter = "all" | "EXPANSION" | "LATE EXP" | "PEAK" | "CONTRACTION";

// ============================================================================
// Main Component
// ============================================================================

export default function F4MarketsView() {
  const nav = useNavigate();
  
  // Tab & drill state
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [level, setLevel] = useState<DrillLevel>("landing");
  const [drillMsaId, setDrillMsaId] = useState("");
  const [drillMsaName, setDrillMsaName] = useState("");
  const [drillSubmarketId, setDrillSubmarketId] = useState("");
  const [drillSubmarketName, setDrillSubmarketName] = useState("");
  
  // Filter & sort state
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>("all");
  const [sortCol, setSortCol] = useState<SortKey>("jedi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Computed data
  const trackedMarkets = useMemo(() => ALL_MARKETS.filter(m => m.starred), []);
  
  const filteredMarkets = useMemo(() => {
    let markets = activeTab === "dashboard" && trackedOnly 
      ? ALL_MARKETS.filter(m => m.starred)
      : ALL_MARKETS;
    
    if (cycleFilter !== "all") {
      markets = markets.filter(m => m.cycle === cycleFilter);
    }
    
    if (searchQuery) {
      markets = markets.filter(m => m.msa.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    markets.sort((a, b) => {
      const av = a[sortCol as keyof TrackedMarket];
      const bv = b[sortCol as keyof TrackedMarket];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return 0;
    });
    
    return markets;
  }, [activeTab, trackedOnly, cycleFilter, searchQuery, sortCol, sortDir]);

  const kpis = useMemo(() => {
    const markets = trackedMarkets;
    const avgJedi = Math.round(markets.reduce((s, m) => s + m.jedi, 0) / markets.length);
    const avgRent = Math.round(markets.reduce((s, m) => s + m.rentNum, 0) / markets.length);
    const avgVac = (markets.reduce((s, m) => s + m.vacNum, 0) / markets.length).toFixed(1);
    const expanding = markets.filter(m => m.cycle === "EXPANSION" || m.cycle === "LATE EXP").length;
    const alerts = MOCK_ALERTS.filter(a => a.type === "negative").length;
    return { count: markets.length, avgJedi, avgRent, avgVac, expanding, alerts };
  }, [trackedMarkets]);

  const median = useMemo(() => {
    const markets = filteredMarkets;
    if (markets.length === 0) return null;
    const med = (vals: number[]) => {
      const s = [...vals].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    return {
      jedi: Math.round(med(markets.map(m => m.jedi))),
      rent: `$${Math.round(med(markets.map(m => m.rentNum))).toLocaleString()}`,
      rentD: `+${med(markets.map(m => parseFloat(m.rentD))).toFixed(1)}%`,
      vac: `${med(markets.map(m => m.vacNum)).toFixed(1)}%`,
      absorb: Math.round(med(markets.map(m => m.absorbNum))).toLocaleString(),
      pipeline: `${med(markets.map(m => m.pipelineNum)).toFixed(1)}%`,
      costs: `$${Math.round(med(markets.map(m => m.costsNum))).toLocaleString()}`,
      dApt: Math.round(med(markets.map(m => m.dAptNum))).toString(),
      popD: `+${med(markets.map(m => m.popDNum)).toFixed(1)}%`,
      medInc: `$${Math.round(med(markets.map(m => m.medIncNum))).toLocaleString()}`,
      cap: `${med(markets.map(m => m.capNum)).toFixed(1)}%`,
    };
  }, [filteredMarkets]);

  const topMovers = useMemo(() => {
    return [...ALL_MARKETS].sort((a, b) => Math.abs(b.d30) - Math.abs(a.d30)).slice(0, 4);
  }, []);

  // Handlers
  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const handleDrillToMsa = (market: TrackedMarket) => {
    setDrillMsaId(market.id);
    setDrillMsaName(market.msa);
    setLevel("msa-terminal");
  };

  const handleSubmarketSelect = (submarketId: string) => {
    setDrillSubmarketId(submarketId);
    const sub = SUBMARKET_INDEX.find(s => s.name.toLowerCase().replace(/\s+/g, "-") === submarketId);
    setDrillSubmarketName(sub?.name || submarketId);
    setLevel("submarket-terminal");
  };

  const handlePropertySelect = (propertyId: string) => {
    nav(`/property-card/${propertyId.toLowerCase().replace(/\s+/g, "-")}`);
  };

  // ============================================================================
  // Drill Views
  // ============================================================================

  if (level === "msa-terminal") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => setLevel("landing")} style={{ ...mono, fontSize: 9, fontWeight: 700, background: "transparent", color: C.amber, border: `1px solid ${C.amber}44`, padding: "3px 10px", cursor: "pointer" }}>
            ← BACK
          </button>
          <span style={{ ...mono, fontSize: 9, color: C.muted }}>{activeTab.toUpperCase()}</span>
          <span style={{ ...mono, fontSize: 9, color: C.muted }}>›</span>
          <span style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{drillMsaName.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <MSATerminal msaId={drillMsaId} onSubmarketSelect={handleSubmarketSelect} onPropertySelect={handlePropertySelect} onBackToMarkets={() => setLevel("landing")} embedded />
        </div>
      </div>
    );
  }

  if (level === "submarket-terminal") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => setLevel("msa-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 700, background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}44`, padding: "3px 10px", cursor: "pointer" }}>
            ← BACK
          </button>
          <span style={{ ...mono, fontSize: 9, color: C.muted }}>{activeTab.toUpperCase()}</span>
          <span style={{ ...mono, fontSize: 9, color: C.muted }}>›</span>
          <button onClick={() => setLevel("msa-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 600, background: "transparent", color: C.amber, border: "none", padding: "2px 6px", cursor: "pointer" }}>
            {drillMsaName.toUpperCase()}
          </button>
          <span style={{ ...mono, fontSize: 9, color: C.muted }}>›</span>
          <span style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{drillSubmarketName.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <SubmarketTerminal submarketId={drillSubmarketId} onPropertySelect={handlePropertySelect} onMsaNavigate={() => setLevel("msa-terminal")} embedded />
        </div>
      </div>
    );
  }

  // ============================================================================
  // Market Table
  // ============================================================================

  const renderMarketTable = () => (
    <div style={{ flex: 1, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
            <th style={{ ...hdrCell, width: 28 }}>#</th>
            <th style={{ ...hdrCell, width: 20 }}>★</th>
            <th style={{ ...hdrCell, width: 120, textAlign: "left" }} onClick={() => handleSort("msa")}>MSA {sortCol === "msa" && (sortDir === "desc" ? "▼" : "▲")}</th>
            <th style={{ ...hdrCell, width: 48 }}>PROPS</th>
            <th style={{ ...hdrCell, width: 44 }}>UNITS</th>
            <th style={{ ...hdrCell, width: 44, color: C.amber }} onClick={() => handleSort("jedi")}>JEDI {sortCol === "jedi" && (sortDir === "desc" ? "▼" : "▲")}</th>
            <th style={{ ...hdrCell, width: 32 }} onClick={() => handleSort("d30")}>Δ30</th>
            <th style={{ ...hdrCell, width: 50 }}>TREND</th>
            <th style={{ ...hdrCell, width: 56 }} onClick={() => handleSort("rentNum")}>RENT</th>
            <th style={{ ...hdrCell, width: 44 }}>RENT Δ</th>
            <th style={{ ...hdrCell, width: 40 }} onClick={() => handleSort("vacNum")}>VAC</th>
            <th style={{ ...hdrCell, width: 50 }}>ABSORB</th>
            <th style={{ ...hdrCell, width: 50 }}>PIPELN</th>
            <th style={{ ...hdrCell, width: 52 }}>COSTS</th>
            <th style={{ ...hdrCell, width: 40 }}>$/APT</th>
            <th style={{ ...hdrCell, width: 44 }}>POP Δ</th>
            <th style={{ ...hdrCell, width: 56 }}>MED INC</th>
            <th style={{ ...hdrCell, width: 40 }}>CAP</th>
            <th style={{ ...hdrCell, width: 76 }}>CYCLE</th>
          </tr>
        </thead>
        <tbody>
          {/* Median Row */}
          {median && (
            <tr style={{ background: C.panelAlt, borderBottom: `1px solid ${C.borderM}` }}>
              <td style={dataCell}><span style={{ color: C.muted, fontStyle: "italic" }}>—</span></td>
              <td style={dataCell}></td>
              <td style={{ ...dataCell, textAlign: "left" }}><span style={{ color: C.muted }}>Median</span></td>
              <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
              <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
              <td style={dataCell}><ScoreCell value={median.jedi} size={10} /></td>
              <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
              <td style={dataCell}><span style={{ color: C.muted }}>───</span></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.rent}</span></td>
              <td style={dataCell}><DeltaCell value={median.rentD} /></td>
              <td style={dataCell}><ThresholdVal value={median.vac} thresholds={[5, 8]} invert /></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.absorb}</span></td>
              <td style={dataCell}><ThresholdVal value={median.pipeline} thresholds={[8, 14]} invert /></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.costs}</span></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.dApt}</span></td>
              <td style={dataCell}><DeltaCell value={median.popD} /></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.medInc}</span></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{median.cap}</span></td>
              <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
            </tr>
          )}
          {/* Data Rows */}
          {filteredMarkets.map((m, i) => (
            <tr
              key={m.id}
              onClick={() => handleDrillToMsa(m)}
              style={{
                background: i % 2 === 0 ? C.panel : C.panelAlt,
                borderBottom: `1px solid ${C.borderS}`,
                cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.hover; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}
            >
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.rank}</span></td>
              <td style={dataCell}><span style={{ color: m.starred ? C.amber : C.muted, fontSize: 10 }}>{m.starred ? "★" : "☆"}</span></td>
              <td style={{ ...dataCell, textAlign: "left" }}><span style={{ color: C.primary, fontWeight: 600, ...sans }}>{m.msa}</span></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.props.toLocaleString()}</span></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.units}</span></td>
              <td style={dataCell}><ScoreCell value={m.jedi} size={10} /></td>
              <td style={dataCell}><DeltaCell value={m.d30} /></td>
              <td style={dataCell}><Spark data={m.trend} color={m.d30 >= 0 ? C.green : C.red} w={40} h={12} /></td>
              <td style={dataCell}><span style={{ color: C.primary, fontWeight: 600 }}>{m.rent}</span></td>
              <td style={dataCell}><DeltaCell value={m.rentD} /></td>
              <td style={dataCell}><ThresholdVal value={m.vac} thresholds={[5, 8]} invert /></td>
              <td style={dataCell}><span style={{ color: C.primary }}>{m.absorb}</span></td>
              <td style={dataCell}><ThresholdVal value={m.pipeline} thresholds={[8, 14]} invert /></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.costs}</span></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.dApt}</span></td>
              <td style={dataCell}><DeltaCell value={m.popD} /></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.medInc}</span></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.cap}</span></td>
              <td style={dataCell}><Badge label={m.cycle} color={cycleColor(m.cycle)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  const renderDashboard = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* KPI Strip */}
      <div style={{ display: "flex", gap: 1, background: C.borderS, padding: 0, flexShrink: 0 }}>
        <KPICard label="TRACKED" value={kpis.count} subtext="markets" />
        <KPICard label="AVG JEDI" value={kpis.avgJedi} subtext={kpis.avgJedi >= 80 ? "▲ strong" : "● moderate"} color={kpis.avgJedi >= 80 ? C.green : C.amber} />
        <KPICard label="AVG RENT" value={`$${kpis.avgRent.toLocaleString()}`} />
        <KPICard label="AVG VAC" value={`${kpis.avgVac}%`} color={parseFloat(kpis.avgVac) <= 6 ? C.green : C.amber} />
        <KPICard label="EXPANDING" value={`${kpis.expanding}/${kpis.count}`} color={C.green} />
        <KPICard label="ALERTS" value={kpis.alerts} subtext="unread" color={kpis.alerts > 0 ? C.red : C.muted} />
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", background: C.panel, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={trackedOnly} onChange={e => setTrackedOnly(e.target.checked)} style={{ cursor: "pointer" }} />
          <span style={{ fontSize: 9, color: C.secondary, ...mono }}>★ Tracked Only</span>
        </label>
        <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value as CycleFilter)} style={{ ...mono, fontSize: 9, background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, padding: "2px 6px" }}>
          <option value="all">All Cycles</option>
          <option value="EXPANSION">Expansion</option>
          <option value="LATE EXP">Late Expansion</option>
          <option value="PEAK">Peak</option>
          <option value="CONTRACTION">Contraction</option>
        </select>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...mono, fontSize: 9, background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, padding: "3px 8px", width: 160 }}
        />
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>{filteredMarkets.length} markets</span>
      </div>

      {/* Main Table - Full Width */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {renderMarketTable()}
      </div>

      {/* Bottom Panels: Alerts + Top Movers (side by side) */}
      <div style={{ display: "flex", height: 140, borderTop: `1px solid ${C.borderM}`, flexShrink: 0 }}>
        {/* Recent Alerts */}
        <div style={{ flex: 1, borderRight: `1px solid ${C.borderM}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.red, ...mono }}>RECENT ALERTS</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
            {MOCK_ALERTS.map(alert => (
              <div key={alert.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.borderS}` }}>
                <span style={{ color: alert.type === "positive" ? C.green : alert.type === "negative" ? C.red : C.muted, fontSize: 10 }}>●</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.primary, ...mono }}>{alert.market}</span>
                  <span style={{ fontSize: 9, color: C.secondary, ...mono, marginLeft: 6 }}>{alert.message}</span>
                </div>
                <span style={{ fontSize: 8, color: C.muted, ...mono }}>{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Movers */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.cyan, ...mono }}>TOP MOVERS (30D)</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
            {topMovers.map(m => (
              <div 
                key={m.id} 
                onClick={() => handleDrillToMsa(m)} 
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
              >
                <span style={{ color: m.d30 >= 0 ? C.green : C.red, fontSize: 10 }}>{m.d30 >= 0 ? "▲" : "▼"}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: C.primary, ...mono, flex: 1 }}>{m.msa.split(",")[0]}</span>
                <Badge label={m.cycle} color={cycleColor(m.cycle)} />
                <DeltaCell value={m.d30} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderBrowse = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Filter Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 12px", background: C.panel, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>All Markets</span>
        <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value as CycleFilter)} style={{ ...mono, fontSize: 9, background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, padding: "2px 6px" }}>
          <option value="all">All Cycles</option>
          <option value="EXPANSION">Expansion</option>
          <option value="LATE EXP">Late Expansion</option>
          <option value="PEAK">Peak</option>
          <option value="CONTRACTION">Contraction</option>
        </select>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...mono, fontSize: 9, background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, padding: "3px 8px", width: 180 }}
        />
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>{filteredMarkets.length} markets · Click to drill</span>
      </div>
      {renderMarketTable()}
    </div>
  );

  const renderSubmarkets = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Submarket Index</span>
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {SUBMARKET_INDEX.length} submarkets · Click to drill</span>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...mono }}>
          <thead>
            <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
              {["SUBMARKET", "MSA", "JEDI", "RENT", "RENT Δ", "VAC", "PROPS", "UNITS", "OPP", "CAP", "CYCLE"].map(h => (
                <th key={h} style={hdrCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUBMARKET_INDEX.map((s, i) => (
              <tr
                key={i}
                onClick={() => {
                  setDrillMsaId(s.msaId);
                  setDrillMsaName(s.msa);
                  setDrillSubmarketId(s.name.toLowerCase().replace(/\s+/g, "-"));
                  setDrillSubmarketName(s.name);
                  setLevel("submarket-terminal");
                }}
                style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}
              >
                <td style={{ ...dataCell, textAlign: "left" }}><span style={{ color: C.primary, fontWeight: 600, ...sans }}>{s.name}</span></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{s.msa}</span></td>
                <td style={dataCell}><ScoreCell value={s.jedi} size={10} /></td>
                <td style={dataCell}><span style={{ color: C.primary, fontWeight: 600 }}>{s.rent}</span></td>
                <td style={dataCell}><DeltaCell value={s.rentD} /></td>
                <td style={dataCell}><ThresholdVal value={s.vac} thresholds={[5, 8]} invert /></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{s.props}</span></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{s.units}</span></td>
                <td style={dataCell}><ScoreCell value={s.opp} size={9} /></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{s.cap}</span></td>
                <td style={dataCell}><Badge label={s.cycle} color={cycleColor(s.cycle)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProperties = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Property Index</span>
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {PROPERTY_INDEX.length} properties · Click to view</span>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...mono }}>
          <thead>
            <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
              {["PROPERTY", "SUBMARKET", "MSA", "JEDI", "UNITS", "RENT", "OCC", "CAP", "VINTAGE", "OWNER"].map(h => (
                <th key={h} style={hdrCell}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROPERTY_INDEX.map((p, i) => (
              <tr
                key={i}
                onClick={() => handlePropertySelect(p.name)}
                style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}
              >
                <td style={{ ...dataCell, textAlign: "left" }}><span style={{ color: C.primary, fontWeight: 600, ...sans }}>{p.name}</span></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{p.submarket}</span></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{p.msa}</span></td>
                <td style={dataCell}><ScoreCell value={p.jedi} size={10} /></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{p.units}</span></td>
                <td style={dataCell}><span style={{ color: C.primary, fontWeight: 600 }}>{p.rent}</span></td>
                <td style={dataCell}><ThresholdVal value={p.occ} thresholds={[94, 91]} /></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{p.capRate}</span></td>
                <td style={dataCell}><span style={{ color: C.secondary }}>{p.vintage}</span></td>
                <td style={dataCell}><span style={{ color: C.muted }}>{p.owner}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCompare = () => <PeerComparisonPage embedded onViewDetail={() => {}} />;

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": return renderDashboard();
      case "browse": return renderBrowse();
      case "submarkets": return renderSubmarkets();
      case "properties": return renderProperties();
      case "compare": return renderCompare();
      default: return null;
    }
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const TAB_DEFS: { id: ActiveTab; label: string }[] = [
    { id: "dashboard", label: "DASHBOARD" },
    { id: "browse", label: "BROWSE" },
    { id: "submarkets", label: "SUBMARKETS" },
    { id: "properties", label: "PROPERTIES" },
    { id: "compare", label: "COMPARE" },
  ];

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: C.bg, color: C.primary }}>
      {/* Tab Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 10px", height: 28, background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: C.amberBright, fontWeight: 700, ...mono, marginRight: 12, paddingLeft: 2 }}>F4</span>
        {TAB_DEFS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setTrackedOnly(tab.id === "dashboard"); }}
            style={{
              ...mono, fontSize: 9, fontWeight: activeTab === tab.id ? 700 : 400,
              padding: "0 12px", height: "100%", cursor: "pointer",
              background: activeTab === tab.id ? C.active : "transparent",
              color: activeTab === tab.id ? C.amber : C.secondary,
              border: "none", borderBottom: activeTab === tab.id ? `2px solid ${C.amber}` : "2px solid transparent",
              letterSpacing: 0.5,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
