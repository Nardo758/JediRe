import React, { useState, useMemo } from "react";
import BloombergMarketDetail from "../MarketIntelligence/BloombergMarketDetail";
import PeerComparisonPage from "../MarketIntelligence/PeerComparisonPage";
import { MSATerminal } from "../../components/terminal/MSATerminal";
import { SubmarketTerminal } from "../../components/terminal/SubmarketTerminal";
import { PropertyTerminal } from "../../components/terminal/PropertyTerminal";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };
const sans: React.CSSProperties = { fontFamily: "'IBM Plex Sans',sans-serif" };

const C = {
  bg: "#0A0E17", panel: "#0F1319", panelAlt: "#131821", header: "#1A1F2E",
  hover: "#1E2538", active: "#252D40", topBar: "#050810",
  primary: "#E8ECF1", secondary: "#8B95A5", muted: "#4A5568",
  amber: "#F5A623", amberBright: "#FFD166", green: "#00D26A",
  red: "#FF4757", cyan: "#00BCD4", orange: "#FF8C42", purple: "#A78BFA",
  blue: "#3B82F6", blueBg: "#1e3a5f",
  borderS: "#1E2538", borderM: "#2A3348",
};

interface CorpHealthData {
  alerts?: Array<{ id: string; text: string; severity: string }>;
  sectors?: Array<{ name: string; score: number }>;
  submarketHealth?: Record<string, number>;
  loaded?: boolean;
  loading?: boolean;
}

function Spark({ data, color = C.green, w = 52, h = 14 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" /></svg>;
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ ...mono, fontSize: 8, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}33`, padding: "1px 5px", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{label}</span>;
}

function ScoreCell({ value, size = 11 }: { value: number | string; size?: number }) {
  const n = typeof value === "string" ? parseInt(value) : value;
  const c = n >= 80 ? C.green : n >= 65 ? C.amber : C.red;
  return <span style={{ fontSize: size, fontWeight: 800, color: c, ...mono }}>{value}</span>;
}

function DeltaCell({ value }: { value: string | undefined }) {
  if (!value || value === "—") return <span style={{ color: C.muted, fontSize: 9, ...mono }}>—</span>;
  const s = String(value); const pos = s.startsWith("+"); const neg = s.startsWith("-");
  return <span style={{ fontSize: 9, fontWeight: 600, color: pos ? C.green : neg ? C.red : C.muted, ...mono }}>{s}</span>;
}

function ThresholdVal({ value, thresholds, invert }: { value: string; thresholds: [number, number]; invert?: boolean }) {
  const n = parseFloat(value);
  let c: string;
  if (invert) c = n <= thresholds[0] ? C.green : n <= thresholds[1] ? C.amber : C.red;
  else c = n >= thresholds[0] ? C.green : n >= thresholds[1] ? C.amber : C.red;
  return <span style={{ fontSize: 10, fontWeight: 600, color: c, ...mono }}>{value}</span>;
}

const MSA_OPTIONS = [
  { id: "atlanta-ga", name: "Atlanta, GA" },
  { id: "raleigh-nc", name: "Raleigh, NC" },
  { id: "charlotte-nc", name: "Charlotte, NC" },
  { id: "tampa-fl", name: "Tampa, FL" },
  { id: "orlando-fl", name: "Orlando, FL" },
  { id: "miami-fl", name: "Miami, FL" },
  { id: "jacksonville-fl", name: "Jacksonville, FL" },
];

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

const TRACKED_MARKETS: TrackedMarket[] = [
  { id: "atlanta-ga", rank: 1, starred: true, msa: "Atlanta, GA", props: 1028, units: "250K", jedi: 87, d30: 4, trend: [78,80,82,83,84,85,86,87], rent: "$2,150", rentNum: 2150, rentD: "+4.2%", vac: "5.8%", vacNum: 5.8, absorb: "2,840", absorbNum: 2840, pipeline: "15.8%", pipelineNum: 15.8, costs: "$8,200", costsNum: 8200, dApt: "58", dAptNum: 58, popD: "+2.1%", popDNum: 2.1, medInc: "$72,400", medIncNum: 72400, cap: "5.2%", capNum: 5.2, cycle: "EXPANSION" },
  { id: "raleigh-nc", rank: 2, starred: true, msa: "Raleigh, NC", props: 480, units: "98K", jedi: 85, d30: 3, trend: [76,78,80,81,82,83,84,85], rent: "$1,740", rentNum: 1740, rentD: "+3.9%", vac: "6.2%", vacNum: 6.2, absorb: "1,120", absorbNum: 1120, pipeline: "11.8%", pipelineNum: 11.8, costs: "$7,200", costsNum: 7200, dApt: "72", dAptNum: 72, popD: "+2.8%", popDNum: 2.8, medInc: "$78,200", medIncNum: 78200, cap: "5.0%", capNum: 5.0, cycle: "EXPANSION" },
  { id: "tampa-fl", rank: 3, starred: true, msa: "Tampa, FL", props: 892, units: "215K", jedi: 82, d30: 2, trend: [74,76,78,79,80,81,81,82], rent: "$1,908", rentNum: 1908, rentD: "+3.0%", vac: "6.5%", vacNum: 6.5, absorb: "2,150", absorbNum: 2150, pipeline: "13.4%", pipelineNum: 13.4, costs: "$9,100", costsNum: 9100, dApt: "64", dAptNum: 64, popD: "+1.9%", popDNum: 1.9, medInc: "$65,800", medIncNum: 65800, cap: "5.4%", capNum: 5.4, cycle: "LATE EXP" },
  { id: "jacksonville-fl", rank: 4, starred: false, msa: "Jacksonville, FL", props: 386, units: "82K", jedi: 80, d30: 5, trend: [68,70,72,74,76,78,79,80], rent: "$1,580", rentNum: 1580, rentD: "+3.8%", vac: "5.4%", vacNum: 5.4, absorb: "980", absorbNum: 980, pipeline: "9.2%", pipelineNum: 9.2, costs: "$6,400", costsNum: 6400, dApt: "76", dAptNum: 76, popD: "+2.4%", popDNum: 2.4, medInc: "$64,200", medIncNum: 64200, cap: "5.8%", capNum: 5.8, cycle: "EXPANSION" },
  { id: "orlando-fl", rank: 5, starred: false, msa: "Orlando, FL", props: 714, units: "178K", jedi: 78, d30: 1, trend: [72,73,74,75,76,77,77,78], rent: "$1,820", rentNum: 1820, rentD: "+2.4%", vac: "7.1%", vacNum: 7.1, absorb: "1,680", absorbNum: 1680, pipeline: "16.2%", pipelineNum: 16.2, costs: "$8,600", costsNum: 8600, dApt: "48", dAptNum: 48, popD: "+1.7%", popDNum: 1.7, medInc: "$62,400", medIncNum: 62400, cap: "5.6%", capNum: 5.6, cycle: "PEAK" },
  { id: "miami-fl", rank: 6, starred: false, msa: "Miami, FL", props: 1245, units: "310K", jedi: 74, d30: -2, trend: [80,79,78,77,76,75,74,74], rent: "$2,480", rentNum: 2480, rentD: "+1.2%", vac: "8.4%", vacNum: 8.4, absorb: "1,920", absorbNum: 1920, pipeline: "18.6%", pipelineNum: 18.6, costs: "$12,200", costsNum: 12200, dApt: "38", dAptNum: 38, popD: "+0.8%", popDNum: 0.8, medInc: "$58,900", medIncNum: 58900, cap: "5.0%", capNum: 5.0, cycle: "PEAK" },
];

const ALL_MSAS: TrackedMarket[] = [
  ...TRACKED_MARKETS,
  { id: "charlotte-nc", rank: 7, starred: false, msa: "Charlotte, NC", props: 620, units: "155K", jedi: 83, d30: 3, trend: [75,77,78,79,80,81,82,83], rent: "$1,680", rentNum: 1680, rentD: "+3.6%", vac: "6.0%", vacNum: 6.0, absorb: "1,450", absorbNum: 1450, pipeline: "12.6%", pipelineNum: 12.6, costs: "$7,800", costsNum: 7800, dApt: "65", dAptNum: 65, popD: "+2.3%", popDNum: 2.3, medInc: "$68,500", medIncNum: 68500, cap: "5.3%", capNum: 5.3, cycle: "EXPANSION" },
  { id: "nashville-tn", rank: 8, starred: false, msa: "Nashville, TN", props: 540, units: "132K", jedi: 81, d30: 2, trend: [73,75,76,77,78,79,80,81], rent: "$1,720", rentNum: 1720, rentD: "+3.2%", vac: "6.8%", vacNum: 6.8, absorb: "1,280", absorbNum: 1280, pipeline: "14.2%", pipelineNum: 14.2, costs: "$8,400", costsNum: 8400, dApt: "60", dAptNum: 60, popD: "+1.8%", popDNum: 1.8, medInc: "$67,200", medIncNum: 67200, cap: "5.1%", capNum: 5.1, cycle: "LATE EXP" },
  { id: "austin-tx", rank: 9, starred: false, msa: "Austin, TX", props: 780, units: "195K", jedi: 76, d30: -1, trend: [82,81,80,79,78,77,76,76], rent: "$1,890", rentNum: 1890, rentD: "+1.8%", vac: "8.2%", vacNum: 8.2, absorb: "1,560", absorbNum: 1560, pipeline: "19.4%", pipelineNum: 19.4, costs: "$9,800", costsNum: 9800, dApt: "42", dAptNum: 42, popD: "+2.5%", popDNum: 2.5, medInc: "$76,800", medIncNum: 76800, cap: "4.8%", capNum: 4.8, cycle: "PEAK" },
  { id: "dallas-tx", rank: 10, starred: false, msa: "Dallas, TX", props: 1380, units: "345K", jedi: 79, d30: 1, trend: [74,75,76,76,77,78,78,79], rent: "$1,640", rentNum: 1640, rentD: "+2.6%", vac: "7.4%", vacNum: 7.4, absorb: "2,680", absorbNum: 2680, pipeline: "16.8%", pipelineNum: 16.8, costs: "$7,600", costsNum: 7600, dApt: "52", dAptNum: 52, popD: "+1.6%", popDNum: 1.6, medInc: "$70,100", medIncNum: 70100, cap: "5.4%", capNum: 5.4, cycle: "LATE EXP" },
  { id: "phoenix-az", rank: 11, starred: false, msa: "Phoenix, AZ", props: 920, units: "228K", jedi: 77, d30: 0, trend: [78,78,77,77,77,77,77,77], rent: "$1,560", rentNum: 1560, rentD: "+2.0%", vac: "7.8%", vacNum: 7.8, absorb: "1,840", absorbNum: 1840, pipeline: "15.2%", pipelineNum: 15.2, costs: "$8,200", costsNum: 8200, dApt: "46", dAptNum: 46, popD: "+1.4%", popDNum: 1.4, medInc: "$64,800", medIncNum: 64800, cap: "5.5%", capNum: 5.5, cycle: "PEAK" },
  { id: "denver-co", rank: 12, starred: false, msa: "Denver, CO", props: 680, units: "168K", jedi: 75, d30: -1, trend: [80,79,78,77,76,76,75,75], rent: "$1,780", rentNum: 1780, rentD: "+1.4%", vac: "8.6%", vacNum: 8.6, absorb: "1,120", absorbNum: 1120, pipeline: "17.8%", pipelineNum: 17.8, costs: "$10,200", costsNum: 10200, dApt: "40", dAptNum: 40, popD: "+1.2%", popDNum: 1.2, medInc: "$78,400", medIncNum: 78400, cap: "4.9%", capNum: 4.9, cycle: "CONTRACTION" },
];

type SortKey = "rank" | "msa" | "props" | "jedi" | "d30" | "rentNum" | "vacNum" | "absorbNum" | "pipelineNum" | "costsNum" | "dAptNum" | "popDNum" | "medIncNum" | "capNum" | "cycle";

function computeMedian(markets: TrackedMarket[]) {
  const med = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
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
}

const SUBMARKET_INDEX = [
  { name: "Midtown", msa: "Atlanta, GA", jedi: 88, rent: "$2,056", rentD: "+4.8%", vac: "5.1%", props: 52, units: "14.8K", opp: 82, cap: "4.8%", cycle: "EXPANSION" },
  { name: "Buckhead", msa: "Atlanta, GA", jedi: 84, rent: "$1,883", rentD: "+2.1%", vac: "6.2%", props: 38, units: "11.2K", opp: 78, cap: "5.0%", cycle: "EXPANSION" },
  { name: "Sandy Springs", msa: "Atlanta, GA", jedi: 81, rent: "$1,920", rentD: "+3.4%", vac: "5.8%", props: 44, units: "12.6K", opp: 74, cap: "5.2%", cycle: "EXPANSION" },
  { name: "Downtown Tampa", msa: "Tampa, FL", jedi: 80, rent: "$1,850", rentD: "+3.2%", vac: "6.8%", props: 62, units: "18.4K", opp: 72, cap: "5.4%", cycle: "LATE EXP" },
  { name: "Ybor City", msa: "Tampa, FL", jedi: 78, rent: "$1,720", rentD: "+4.1%", vac: "5.6%", props: 28, units: "8.2K", opp: 80, cap: "5.6%", cycle: "EXPANSION" },
  { name: "South Beach", msa: "Miami, FL", jedi: 76, rent: "$2,890", rentD: "+0.8%", vac: "9.2%", props: 45, units: "15.6K", opp: 62, cap: "4.6%", cycle: "PEAK" },
  { name: "Brickell", msa: "Miami, FL", jedi: 74, rent: "$3,120", rentD: "+0.4%", vac: "8.8%", props: 52, units: "18.2K", opp: 58, cap: "4.4%", cycle: "PEAK" },
  { name: "Downtown Raleigh", msa: "Raleigh, NC", jedi: 86, rent: "$1,680", rentD: "+4.2%", vac: "5.4%", props: 32, units: "9.8K", opp: 84, cap: "5.2%", cycle: "EXPANSION" },
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

type DrillLevel = "landing" | "msa-terminal" | "submarket-terminal" | "property-terminal";
type PrimaryTab = "f4-landing" | "all-msas";
type SubTab = "msa-detail" | "msa-index" | "submarkets" | "watchlist" | "peer-comp" | "property-stock";

interface F4MarketsViewProps {
  corpHealthData?: CorpHealthData;
}

const hdrCell: React.CSSProperties = {
  padding: "4px 6px", fontSize: 7, fontWeight: 700, color: "#4A5568",
  letterSpacing: 0.5, borderRight: "1px solid #1E2538", borderBottom: "1px solid #2A3348",
  textAlign: "center", cursor: "pointer", whiteSpace: "nowrap",
  fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
};

const dataCell: React.CSSProperties = {
  padding: "4px 6px", textAlign: "center", borderRight: "1px solid #1E2538",
  fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  whiteSpace: "nowrap",
};

export default function F4MarketsView({ corpHealthData }: F4MarketsViewProps) {
  const [level, setLevel] = useState<DrillLevel>("landing");
  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("f4-landing");
  const [subTab, setSubTab] = useState<SubTab>("msa-detail");
  const [selectedMsaId, setSelectedMsaId] = useState("atlanta-ga");
  const [drillOriginTab, setDrillOriginTab] = useState<PrimaryTab>("all-msas");
  const [drillMsaId, setDrillMsaId] = useState("");
  const [drillMsaName, setDrillMsaName] = useState("");
  const [drillSubmarketId, setDrillSubmarketId] = useState("");
  const [drillSubmarketName, setDrillSubmarketName] = useState("");
  const [drillPropertyId, setDrillPropertyId] = useState("");
  const [drillPropertyName, setDrillPropertyName] = useState("");
  const [sortCol, setSortCol] = useState<SortKey>("jedi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [allMsaSortCol, setAllMsaSortCol] = useState<SortKey>("jedi");
  const [allMsaSortDir, setAllMsaSortDir] = useState<"asc" | "desc">("desc");
  const [allMsaSearch, setAllMsaSearch] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);

  const selectedMsa = MSA_OPTIONS.find(m => m.id === selectedMsaId) || MSA_OPTIONS[0];
  const selectedMarketData = TRACKED_MARKETS.find(m => m.id === selectedMsaId);

  const sorted = useMemo(() => {
    const s = [...TRACKED_MARKETS];
    s.sort((a, b) => {
      const av = a[sortCol as keyof TrackedMarket];
      const bv = b[sortCol as keyof TrackedMarket];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      if (typeof av === "string" && typeof bv === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return 0;
    });
    return s;
  }, [sortCol, sortDir]);

  const allMsasSorted = useMemo(() => {
    let filtered = [...ALL_MSAS];
    if (allMsaSearch) {
      filtered = filtered.filter(m => m.msa.toLowerCase().includes(allMsaSearch.toLowerCase()));
    }
    filtered.sort((a, b) => {
      const av = a[allMsaSortCol as keyof TrackedMarket];
      const bv = b[allMsaSortCol as keyof TrackedMarket];
      if (typeof av === "number" && typeof bv === "number") return allMsaSortDir === "asc" ? av - bv : bv - av;
      if (typeof av === "string" && typeof bv === "string") return allMsaSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return 0;
    });
    return filtered;
  }, [allMsaSortCol, allMsaSortDir, allMsaSearch]);

  const median = useMemo(() => computeMedian(TRACKED_MARKETS), []);
  const allMsaMedian = useMemo(() => computeMedian(ALL_MSAS), []);

  const handleSort = (col: SortKey) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const handleAllMsaSort = (col: SortKey) => {
    if (allMsaSortCol === col) setAllMsaSortDir(d => d === "asc" ? "desc" : "asc");
    else { setAllMsaSortCol(col); setAllMsaSortDir("desc"); }
  };

  const handleDrillToMsa = (marketId: string) => {
    const mkt = ALL_MSAS.find(m => m.id === marketId) || TRACKED_MARKETS.find(m => m.id === marketId);
    setDrillOriginTab(primaryTab);
    setDrillMsaId(marketId);
    setDrillMsaName(mkt?.msa || marketId);
    setLevel("msa-terminal");
  };

  const handleSubmarketSelect = (submarketId: string) => {
    setDrillSubmarketId(submarketId);
    const sub = SUBMARKET_INDEX.find(s => s.name.toLowerCase().replace(/\s+/g, "-") === submarketId);
    setDrillSubmarketName(sub?.name || submarketId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    setLevel("submarket-terminal");
  };

  const handlePropertySelect = (propertyId: string) => {
    setDrillPropertyId(propertyId);
    const prop = PROPERTY_INDEX.find(p => p.name.toLowerCase().replace(/\s+/g, "-") === propertyId);
    setDrillPropertyName(prop?.name || propertyId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    setLevel("property-terminal");
  };

  const cycleColor = (c: string) => {
    if (c === "EXPANSION") return C.green;
    if (c === "LATE EXP") return C.amber;
    if (c === "PEAK") return C.orange;
    if (c === "CONTRACTION") return C.red;
    return C.muted;
  };

  const filteredMsaOptions = MSA_OPTIONS.filter(m =>
    m.name.toLowerCase().includes(marketSearch.toLowerCase())
  );

  const originLabel = drillOriginTab === "all-msas" ? "ALL MSAs" : "F4 LANDING";

  if (level === "msa-terminal") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => { setPrimaryTab(drillOriginTab); setLevel("landing"); }} style={{ ...mono, fontSize: 9, fontWeight: 700, background: "transparent", color: C.amber, border: `1px solid ${C.amber}44`, padding: "3px 10px", cursor: "pointer", letterSpacing: 0.5 }}>
            ← BACK
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>{originLabel}</span>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <span style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{drillMsaName.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <MSATerminal
            msaId={drillMsaId}
            onSubmarketSelect={handleSubmarketSelect}
            onPropertySelect={handlePropertySelect}
            onBackToMarkets={() => setLevel("landing")}
          />
        </div>
      </div>
    );
  }

  if (level === "submarket-terminal") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => setLevel("msa-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 700, background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}44`, padding: "3px 10px", cursor: "pointer", letterSpacing: 0.5 }}>
            ← BACK
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>{originLabel}</span>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <button onClick={() => setLevel("msa-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 600, background: "transparent", color: C.amber, border: "none", padding: "2px 6px", cursor: "pointer" }}>
            {drillMsaName.toUpperCase()}
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <span style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{drillSubmarketName.toUpperCase() || "SUBMARKET"}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <SubmarketTerminal
            submarketId={drillSubmarketId}
            onPropertySelect={handlePropertySelect}
            onMsaNavigate={() => setLevel("msa-terminal")}
          />
        </div>
      </div>
    );
  }

  if (level === "property-terminal") {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
          <button onClick={() => setLevel("submarket-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 700, background: "transparent", color: C.cyan, border: `1px solid ${C.cyan}44`, padding: "3px 10px", cursor: "pointer", letterSpacing: 0.5 }}>
            ← BACK
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>{originLabel}</span>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <button onClick={() => setLevel("msa-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 600, background: "transparent", color: C.amber, border: "none", padding: "2px 6px", cursor: "pointer" }}>
            {drillMsaName.toUpperCase()}
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <button onClick={() => setLevel("submarket-terminal")} style={{ ...mono, fontSize: 9, fontWeight: 600, background: "transparent", color: C.cyan, border: "none", padding: "2px 6px", cursor: "pointer" }}>
            {drillSubmarketName.toUpperCase() || "SUBMARKET"}
          </button>
          <span style={{ ...mono, fontSize: 8, color: C.muted }}>›</span>
          <span style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{drillPropertyName.toUpperCase() || "PROPERTY"}</span>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <PropertyTerminal dealId={drillPropertyId} />
        </div>
      </div>
    );
  }

  const renderMarketTable = (markets: TrackedMarket[], medianRow: ReturnType<typeof computeMedian>, sCol: SortKey, sDir: "asc" | "desc", onSort: (col: SortKey) => void, showSubject?: boolean, singleClickDrill?: boolean) => (
    <div style={{ flex: 1, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...mono }}>
        <thead>
          <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
            <th style={{ ...hdrCell, width: 28 }}>#</th>
            <th style={{ ...hdrCell, width: 120, textAlign: "left" }} onClick={() => onSort("msa")}>MSA</th>
            <th style={{ ...hdrCell, width: 52 }} onClick={() => onSort("props")}>PROPS</th>
            <th style={{ ...hdrCell, width: 44 }}>UNITS</th>
            <th style={{ ...hdrCell, width: 48, color: C.amber }} onClick={() => onSort("jedi")}>JEDI{sCol === "jedi" ? (sDir === "desc" ? "▼" : "▲") : "▼"}</th>
            <th style={{ ...hdrCell, width: 36 }} onClick={() => onSort("d30")}>Δ30</th>
            <th style={{ ...hdrCell, width: 56 }}>TREND</th>
            <th style={{ ...hdrCell, width: 56 }} onClick={() => onSort("rentNum")}>RENT</th>
            <th style={{ ...hdrCell, width: 48 }}>RENT Δ</th>
            <th style={{ ...hdrCell, width: 42 }} onClick={() => onSort("vacNum")}>VAC</th>
            <th style={{ ...hdrCell, width: 52 }} onClick={() => onSort("absorbNum")}>ABSORB</th>
            <th style={{ ...hdrCell, width: 52 }} onClick={() => onSort("pipelineNum")}>PIPELN</th>
            <th style={{ ...hdrCell, width: 52 }}>COSTS</th>
            <th style={{ ...hdrCell, width: 42 }}>$/APT</th>
            <th style={{ ...hdrCell, width: 48 }} onClick={() => onSort("popDNum")}>POP Δ</th>
            <th style={{ ...hdrCell, width: 56 }} onClick={() => onSort("medIncNum")}>MED INC</th>
            <th style={{ ...hdrCell, width: 44 }} onClick={() => onSort("capNum")}>CAP</th>
            <th style={{ ...hdrCell, width: 76 }}>CYCLE</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: C.panelAlt, borderBottom: `1px solid ${C.borderM}` }}>
            <td style={dataCell}><span style={{ color: C.muted, fontStyle: "italic" }}>n</span></td>
            <td style={{ ...dataCell, textAlign: "left" }}><span style={{ color: C.muted }}>Median</span></td>
            <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
            <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
            <td style={dataCell}><ScoreCell value={medianRow.jedi} size={10} /></td>
            <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
            <td style={dataCell}><span style={{ color: C.muted }}>─</span></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.rent}</span></td>
            <td style={dataCell}><DeltaCell value={medianRow.rentD} /></td>
            <td style={dataCell}><ThresholdVal value={medianRow.vac} thresholds={[5, 8]} invert /></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.absorb}</span></td>
            <td style={dataCell}><ThresholdVal value={medianRow.pipeline} thresholds={[8, 14]} invert /></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.costs}</span></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.dApt}</span></td>
            <td style={dataCell}><DeltaCell value={medianRow.popD} /></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.medInc}</span></td>
            <td style={dataCell}><span style={{ color: C.primary }}>{medianRow.cap}</span></td>
            <td style={dataCell}><span style={{ color: C.muted }}>—</span></td>
          </tr>
          {markets.map((m, i) => (
            <tr
              key={m.id}
              onClick={singleClickDrill ? () => handleDrillToMsa(m.id) : undefined}
              onDoubleClick={!singleClickDrill ? () => handleDrillToMsa(m.id) : undefined}
              style={{
                background: showSubject && m.id === selectedMsaId ? C.amber + "0A" : i % 2 === 0 ? C.panel : C.panelAlt,
                borderBottom: `1px solid ${C.borderS}`,
                borderLeft: showSubject && m.id === selectedMsaId ? `2px solid ${C.amber}` : "2px solid transparent",
                cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.hover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = showSubject && m.id === selectedMsaId ? C.amber + "0A" : i % 2 === 0 ? C.panel : C.panelAlt; }}
            >
              <td style={dataCell}>
                <span style={{ color: m.starred ? C.amber : C.muted, marginRight: 2 }}>{m.starred ? "★" : ""}</span>
                {showSubject && m.id === selectedMsaId && <span style={{ color: C.amberBright, marginRight: 1, fontSize: 8 }}>*</span>}
                <span style={{ color: C.secondary }}>{m.rank}</span>
              </td>
              <td style={{ ...dataCell, textAlign: "left" }}>
                <span style={{ color: showSubject && m.id === selectedMsaId ? C.amberBright : C.primary, fontWeight: showSubject && m.id === selectedMsaId ? 700 : 500, ...sans }}>{m.msa}</span>
              </td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.props.toLocaleString()}</span></td>
              <td style={dataCell}><span style={{ color: C.secondary }}>{m.units}</span></td>
              <td style={dataCell}><ScoreCell value={m.jedi} size={10} /></td>
              <td style={dataCell}><DeltaCell value={m.d30 >= 0 ? `+${m.d30}` : `${m.d30}`} /></td>
              <td style={dataCell}><Spark data={m.trend} color={m.d30 >= 0 ? C.green : C.red} w={44} h={12} /></td>
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

  const renderLandingContent = () => {
    if (subTab === "msa-detail") {
      return <BloombergMarketDetail embedded marketId={selectedMsaId} corpHealthData={corpHealthData} />;
    }

    if (subTab === "msa-index") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>My Markets</span>
              <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {TRACKED_MARKETS.length} tracked markets · Double-click to drill</span>
            </div>
          </div>
          {renderMarketTable(sorted, median, sortCol, sortDir, handleSort, true)}
        </div>
      );
    }

    if (subTab === "watchlist") {
      const watched = TRACKED_MARKETS.filter(m => m.starred);
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, ...sans }}>★ Watchlist</span>
            <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {watched.length} watched markets</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
              {watched.map(m => (
                <div key={m.id} onDoubleClick={() => handleDrillToMsa(m.id)} style={{ background: C.panel, border: `1px solid ${C.borderM}`, padding: "10px 12px", cursor: "pointer" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.amber; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.borderM; }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary, ...sans }}>{m.msa}</span>
                    <ScoreCell value={m.jedi} size={14} />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
                    <div><span style={{ fontSize: 8, color: C.muted, ...mono }}>RENT</span><br /><span style={{ fontSize: 10, color: C.primary, fontWeight: 600, ...mono }}>{m.rent}</span></div>
                    <div><span style={{ fontSize: 8, color: C.muted, ...mono }}>VAC</span><br /><ThresholdVal value={m.vac} thresholds={[5, 8]} invert /></div>
                    <div><span style={{ fontSize: 8, color: C.muted, ...mono }}>Δ30</span><br /><DeltaCell value={m.d30 >= 0 ? `+${m.d30}` : `${m.d30}`} /></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Spark data={m.trend} color={m.d30 >= 0 ? C.green : C.red} w={80} h={16} />
                    <Badge label={m.cycle} color={cycleColor(m.cycle)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (subTab === "submarkets") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Submarket Index</span>
            <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {SUBMARKET_INDEX.length} submarkets across tracked markets</span>
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
                  <tr key={i} style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
                    onDoubleClick={() => {
                      const mkt = TRACKED_MARKETS.find(m => m.msa === s.msa);
                      if (mkt) { setDrillMsaId(mkt.id); setDrillMsaName(mkt.msa); }
                      setDrillSubmarketId(s.name.toLowerCase().replace(/\s+/g, "-"));
                      setDrillSubmarketName(s.name);
                      setLevel("submarket-terminal");
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.hover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}>
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
    }

    if (subTab === "peer-comp") {
      return <PeerComparisonPage embedded onViewDetail={() => { setPrimaryTab("f4-landing"); setSubTab("msa-detail"); }} />;
    }

    if (subTab === "property-stock") {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Property Stock</span>
            <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {PROPERTY_INDEX.length} key properties across tracked markets</span>
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
                  <tr key={i} style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
                    onDoubleClick={() => {
                      const mkt = TRACKED_MARKETS.find(m => m.msa === p.msa);
                      if (mkt) { setDrillMsaId(mkt.id); setDrillMsaName(mkt.msa); }
                      setDrillSubmarketId(p.submarket.toLowerCase().replace(/\s+/g, "-"));
                      setDrillSubmarketName(p.submarket);
                      setDrillPropertyId(p.name.toLowerCase().replace(/\s+/g, "-"));
                      setDrillPropertyName(p.name);
                      setLevel("property-terminal");
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.hover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}>
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
    }

    return null;
  };

  const renderAllMsasContent = () => {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>All MSAs</span>
            <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {ALL_MSAS.length} markets · Click row to drill into MSA Overview</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              value={allMsaSearch}
              onChange={e => setAllMsaSearch(e.target.value)}
              placeholder="Search MSAs..."
              style={{ width: 160, padding: "3px 8px", background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, fontSize: 9, ...mono, outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ fontSize: 8, color: C.muted, ...mono }}>{allMsasSorted.length} results</span>
          </div>
        </div>
        {renderMarketTable(allMsasSorted, allMsaMedian, allMsaSortCol, allMsaSortDir, handleAllMsaSort, false, true)}
      </div>
    );
  };

  const SUB_TAB_DEFS: { id: SubTab; label: string }[] = [
    { id: "msa-detail", label: "MSA DETAIL" },
    { id: "msa-index", label: "MSA INDEX" },
    { id: "submarkets", label: "SUBMARKETS" },
    { id: "watchlist", label: `WATCHLIST (${TRACKED_MARKETS.filter(m => m.starred).length})` },
    { id: "peer-comp", label: "PEER COMP" },
    { id: "property-stock", label: "PROPERTY STOCK" },
  ];

  return (
    <div style={{ flex: 1, overflow: "hidden", animation: "fadeIn 0.15s", display: "flex", flexDirection: "column", background: C.bg, color: C.primary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 10px", height: 28, background: C.header, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: C.muted, ...mono, marginRight: 8 }}>F4</span>
        <span style={{ fontSize: 9, color: C.amberBright, fontWeight: 700, ...mono, marginRight: 12 }}>MARKETS</span>

        <div style={{ position: "relative", marginRight: 12 }}>
          <button
            onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
            style={{
              ...mono, fontSize: 9, fontWeight: 500,
              padding: "0 8px", height: 22, cursor: "pointer",
              background: "transparent", color: C.secondary,
              border: `1px solid ${C.borderS}`, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            MSA · <span style={{ color: C.amber, fontWeight: 700 }}>{selectedMsa.name}</span> <span style={{ fontSize: 7 }}>▾</span>
          </button>
          {marketDropdownOpen && (
            <div style={{ position: "absolute", top: 24, left: 0, zIndex: 100, background: C.panel, border: `1px solid ${C.borderM}`, minWidth: 220, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
              <input
                autoFocus
                value={marketSearch}
                onChange={e => setMarketSearch(e.target.value)}
                placeholder="Search markets..."
                style={{ width: "100%", padding: "6px 10px", background: C.bg, color: C.primary, border: "none", borderBottom: `1px solid ${C.borderS}`, fontSize: 10, ...mono, outline: "none", boxSizing: "border-box" }}
              />
              {filteredMsaOptions.map(m => (
                <div
                  key={m.id}
                  onClick={() => { setSelectedMsaId(m.id); setMarketDropdownOpen(false); setMarketSearch(""); }}
                  style={{
                    padding: "6px 10px", cursor: "pointer", fontSize: 10, ...mono,
                    color: m.id === selectedMsaId ? C.amber : C.primary,
                    background: m.id === selectedMsaId ? C.active : "transparent",
                    fontWeight: m.id === selectedMsaId ? 700 : 400,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.hover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = m.id === selectedMsaId ? C.active : "transparent"; }}
                >
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: C.green, display: "flex", alignItems: "center", gap: 3, ...mono }}>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.green, display: "inline-block" }} />
          JEDI {selectedMarketData?.jedi || 87}
        </span>
        <span style={{ fontSize: 8, color: C.muted, margin: "0 6px" }}>|</span>
        <span style={{ fontSize: 9, color: C.primary, fontWeight: 600, ...mono }}>{selectedMarketData?.rent || "$2,150"}</span>
        <span style={{ margin: "0 4px" }}><DeltaCell value={selectedMarketData?.rentD || "+4.2%"} /></span>
        <span style={{ fontSize: 8, color: C.muted, margin: "0 4px" }}>|</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>Vac </span>
        <ThresholdVal value={selectedMarketData?.vac || "5.8%"} thresholds={[5, 8]} invert />
      </div>

      <div style={{ display: "flex", alignItems: "center", height: 30, background: C.panel, borderBottom: `1px solid ${C.borderM}`, flexShrink: 0 }}>
        {([
          { id: "f4-landing" as PrimaryTab, label: "F4 LANDING" },
          { id: "all-msas" as PrimaryTab, label: "ALL MSAs" },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setPrimaryTab(tab.id)}
            style={{
              ...mono, fontSize: 9, fontWeight: primaryTab === tab.id ? 700 : 500,
              padding: "0 16px", height: "100%", cursor: "pointer",
              background: primaryTab === tab.id ? C.active : "transparent",
              color: primaryTab === tab.id ? C.amber : C.secondary,
              border: "none", borderBottom: primaryTab === tab.id ? `2px solid ${C.amber}` : "2px solid transparent",
              letterSpacing: 0.5,
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 8, color: C.muted, ...mono, marginRight: 10 }}>
          {primaryTab === "f4-landing" ? `${selectedMsa.name} · ${TRACKED_MARKETS.length} tracked` : `${ALL_MSAS.length} total MSAs`}
        </span>
      </div>

      {primaryTab === "f4-landing" && (
        <div style={{ display: "flex", alignItems: "center", height: 26, background: C.panelAlt, borderBottom: `1px solid ${C.borderS}`, flexShrink: 0, gap: 0 }}>
          {SUB_TAB_DEFS.map((t, idx) => (
            <React.Fragment key={t.id}>
              {idx === 3 && <span style={{ width: 1, height: 14, background: C.borderM, margin: "0 4px" }} />}
              <button
                onClick={() => setSubTab(t.id)}
                style={{
                  ...mono, fontSize: 8, fontWeight: subTab === t.id ? 700 : 400,
                  padding: "0 10px", height: "100%", cursor: "pointer",
                  background: subTab === t.id ? C.active : "transparent",
                  color: subTab === t.id ? C.amber : C.muted,
                  border: "none", borderBottom: subTab === t.id ? `1px solid ${C.amber}` : "1px solid transparent",
                }}
              >
                {t.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {primaryTab === "f4-landing" ? renderLandingContent() : renderAllMsasContent()}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: C.topBar, borderTop: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>{primaryTab === "all-msas" ? "Click" : "Double-click"} row = drill down · Click column header = sort · * = subject property · ★ = watchlist</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>Sources: Apartment Locator AI · Census ACS · BLS QCEW · County Permits · Google Places</span>
        <span style={{ fontSize: 8, color: C.muted, ...mono }}>{selectedMsa.name} · JEDI {selectedMarketData?.jedi || 87} · MSA Level</span>
      </div>
    </div>
  );
}
