import React, { useState, useMemo, useEffect, useCallback } from "react";
import { M35KeyEventsHub } from "../../components/m35/M35KeyEventsHub";
import { useNavigate } from "react-router-dom";
import PeerComparisonPage from "../MarketIntelligence/PeerComparisonPage";
import { MSATerminal } from "../../components/terminal/MSATerminal";
import { SubmarketTerminal } from "../../components/terminal/SubmarketTerminal";
import { PropertyTerminal } from "../../components/terminal/PropertyTerminal";
import { BT } from "../../components/terminal/theme";
import { useColumnPreferences } from "../../hooks/useColumnPreferences";
import { ColumnPicker } from "../../components/terminal/ColumnPicker";
import { ViewId, getColumnById, isDynamicColumn, extractMetricId, formatMetricValue, buildDynamicColumn, CatalogMetric, DynamicColumnDef } from "../../config/columnRegistry";
import { useMarketMetrics, useSubmarketMetrics, usePropertyMetrics } from "../../hooks/useMarketMetrics";
import { useColumnCorrelations, useMetricRecommendations } from "../../hooks/useCorrelations";
import type { MetricRecommendation } from "../../hooks/useCorrelations";
import { useGridTemplates, GridTemplate } from "../../hooks/useGridTemplates";
import { ColumnConfigPopover, ColumnConfig, DEFAULT_COLUMN_CONFIG } from "../../components/terminal/ColumnConfigPopover";
import api from "../../services/api";
import { DemandTab } from "../../components/terminal/tabs/DemandTab";
import { F4DealsView } from "../../components/terminal/tabs/F4DealsView";
import { SupplyCell } from "../../components/terminal/cells/SupplyCell";

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

function AwaitingData({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", color: C.muted }}>
      <div style={{ fontSize: 13, fontWeight: 700, ...mono, marginBottom: 8, color: loading ? C.amber : C.secondary }}>
        {loading ? "LOADING DATA..." : "AWAITING DATA"}
      </div>
      <div style={{ fontSize: 10, ...mono, textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
        {loading
          ? `Fetching live ${label} from the server.`
          : `No ${label} available yet. Data will appear here once market metrics are computed. Try refreshing or check back later.`}
      </div>
    </div>
  );
}

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

type ActiveTab = "dashboard" | "browse" | "submarkets" | "properties" | "demand" | "deals" | "compare";
type DrillLevel = "landing" | "msa-terminal" | "submarket-terminal" | "property-terminal";
type SortKey = "rank" | "msa" | "jedi" | "d30" | "rentNum" | "vacNum" | "absorbNum" | "pipelineNum" | "capNum" | "cycle";
type CycleFilter = "all" | "EXPANSION" | "LATE EXP" | "PEAK" | "CONTRACTION";

// ============================================================================
// Main Component
// ============================================================================

export interface MarketMover {
  msa: string;
  d30: number;
  jedi: number;
  cycle: string;
}

export default function F4MarketsView({ onTopMovers }: { onTopMovers?: (movers: MarketMover[]) => void }) {
  const nav = useNavigate();
  
  // Tab & drill state
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [level, setLevel] = useState<DrillLevel>("landing");
  const [drillMsaId, setDrillMsaId] = useState("");
  const [drillMsaName, setDrillMsaName] = useState("");
  const [drillSubmarketId, setDrillSubmarketId] = useState("");
  const [drillSubmarketName, setDrillSubmarketName] = useState("");
  
  // M35 Key Events Hub state
  const [m35EventsExpanded, setM35EventsExpanded] = useState(false);

  // Filter & sort state
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>("all");
  const [sortCol, setSortCol] = useState<SortKey>("jedi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const { markets: liveMarkets, loading: marketsLoading, lastUpdated, refresh: refreshMarkets } = useMarketMetrics();
  const { submarkets: liveSubmarkets, loading: subLoading, refresh: refreshSubmarkets } = useSubmarketMetrics();
  const { properties: liveProperties, loading: propLoading, refresh: refreshProperties } = usePropertyMetrics();

  const ALL_MARKETS_RESOLVED = useMemo(() => {
    return liveMarkets.length > 0 ? liveMarkets as TrackedMarket[] : ALL_MARKETS;
  }, [liveMarkets]);

  const SUBMARKET_RESOLVED = useMemo(() => {
    return liveSubmarkets.length > 0 ? liveSubmarkets : SUBMARKET_INDEX;
  }, [liveSubmarkets]);

  const PROPERTY_RESOLVED = useMemo(() => {
    return liveProperties.length > 0 ? liveProperties : PROPERTY_INDEX;
  }, [liveProperties]);

  const isLive = liveMarkets.length > 0;
  const marketsEmpty = ALL_MARKETS_RESOLVED.length === 0;
  const subEmpty = SUBMARKET_RESOLVED.length === 0;
  const propEmpty = PROPERTY_RESOLVED.length === 0;

  const marketGeoIds = useMemo(() => {
    if (ALL_MARKETS_RESOLVED.length === 0) return [];
    return ALL_MARKETS_RESOLVED.map(m => {
      const slug = m.id.replace(/-[a-z]{2}$/, "");
      const state = (m.msa.split(", ").pop() || "FL").toLowerCase();
      return { geoType: "metro", geoId: `${slug}-${state}-${state}` };
    });
  }, [ALL_MARKETS_RESOLVED]);

  const trackedGeoIds = useMemo(() => {
    const starred = ALL_MARKETS_RESOLVED.filter(m => m.starred);
    if (starred.length === 0) return marketGeoIds;
    return starred.map(m => {
      const slug = m.id.replace(/-[a-z]{2}$/, "");
      const state = (m.msa.split(", ").pop() || "FL").toLowerCase();
      return { geoType: "metro", geoId: `${slug}-${state}-${state}` };
    });
  }, [ALL_MARKETS_RESOLVED, marketGeoIds]);

  const submarketGeoIds = useMemo(() => {
    const msaSet = new Set<string>();
    SUBMARKET_RESOLVED.forEach(s => {
      if (s.msaId) msaSet.add(s.msaId);
    });
    return Array.from(msaSet).map(id => {
      const slug = id.replace(/-[a-z]{2}$/, "");
      const state = id.split("-").pop() || "fl";
      return { geoType: "metro", geoId: `${slug}-${state}-${state}` };
    });
  }, [SUBMARKET_RESOLVED]);

  const propertyGeoIds = useMemo(() => {
    const msaSet = new Set<string>();
    PROPERTY_RESOLVED.forEach(p => {
      const msaSlug = (p.msa || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      if (msaSlug) msaSet.add(msaSlug);
    });
    return Array.from(msaSet).map(slug => {
      const parts = slug.split("-");
      const state = parts.pop() || "fl";
      const city = parts.join("-");
      return { geoType: "metro", geoId: `${city}-${state}-${state}` };
    });
  }, [PROPERTY_RESOLVED]);

  const recommendationGeoIds = useMemo(() => {
    switch (activeTab) {
      case "submarkets": return submarketGeoIds.length > 0 ? submarketGeoIds : trackedGeoIds;
      case "properties": return propertyGeoIds.length > 0 ? propertyGeoIds : trackedGeoIds;
      case "browse": return marketGeoIds;
      default: return trackedGeoIds;
    }
  }, [activeTab, submarketGeoIds, propertyGeoIds, marketGeoIds, trackedGeoIds]);

  const { correlationMap: columnCorrelations, staleCount: corrStaleCount, totalCount: corrTotalCount } = useColumnCorrelations(marketGeoIds);
  const { recommendations: metricRecs, loading: recsLoading } = useMetricRecommendations(recommendationGeoIds);
  const [recsCollapsed, setRecsCollapsed] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const dashCols = useColumnPreferences("f4_dashboard");
  const browseCols = useColumnPreferences("f4_browse");
  const subCols = useColumnPreferences("f4_submarkets");
  const propCols = useColumnPreferences("f4_properties");
  const compCols = useColumnPreferences("f4_compare");

  // Memoized so consumers (setColumnConfig, allActiveColumns) get a
  // stable reference and don't recompute on every render.
  const colPrefsMap = useMemo<Record<string, ReturnType<typeof useColumnPreferences>>>(() => ({
    dashboard: dashCols,
    browse: browseCols,
    submarkets: subCols,
    properties: propCols,
    compare: compCols,
  }), [dashCols, browseCols, subCols, propCols, compCols]);

  const viewIdMap: Record<string, ViewId> = {
    dashboard: "f4_dashboard",
    browse: "f4_browse",
    submarkets: "f4_submarkets",
    properties: "f4_properties",
    compare: "f4_compare",
  };

  const safeTab = (activeTab === "demand" || activeTab === "deals") ? "dashboard" : activeTab;

  const [pickerOpen, setPickerOpen] = useState<ActiveTab | null>(null);

  const gridTemplates = useGridTemplates(viewIdMap[safeTab]);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig>>({});
  const [configPopoverCol, setConfigPopoverCol] = useState<string | null>(null);
  const [catalogMetricsMap, setCatalogMetricsMap] = useState<Map<string, CatalogMetric>>(new Map());
  const [showManageModal, setShowManageModal] = useState(false);

  const activeColumnConfig = colPrefsMap[safeTab]?.columnConfig;
  useEffect(() => {
    if (activeColumnConfig && Object.keys(activeColumnConfig).length > 0) {
      setColumnConfigs(prev => ({ ...prev, ...activeColumnConfig }));
    }
  }, [safeTab, activeColumnConfig]);

  const getColumnConfig = useCallback((colId: string): ColumnConfig => {
    return columnConfigs[colId] || DEFAULT_COLUMN_CONFIG;
  }, [columnConfigs]);

  const setColumnConfig = useCallback((colId: string, config: ColumnConfig) => {
    setColumnConfigs(prev => {
      const next = { ...prev, [colId]: config };
      colPrefsMap[safeTab]?.saveColumnConfig(next);
      return next;
    });
  }, [colPrefsMap, safeTab]);

  const allActiveColumns = useMemo(() => {
    const all = new Set<string>();
    for (const prefs of Object.values(colPrefsMap)) {
      for (const c of prefs.columns) all.add(c);
    }
    return [...all];
    // The explicit per-tab `.columns` deps are more granular than depending
    // on `colPrefsMap` itself — we re-derive only when one of those arrays
    // actually changes, instead of on every parent re-render that produces
    // a new `colPrefsMap` object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashCols.columns, browseCols.columns, subCols.columns, propCols.columns, compCols.columns]);

  const dynamicMetricIds = useMemo(() =>
    allActiveColumns.filter(isDynamicColumn).map(c => extractMetricId(c)!).filter(Boolean),
    [allActiveColumns]
  );

  // Extract complex deps to a stable string key so ESLint can statically
  // verify dependencies (avoids the "complex expression in the dep array"
  // warning) while preserving the original join-based change detection.
  const dynamicMetricIdsKey = dynamicMetricIds.join(',');
  useEffect(() => {
    api.get('/columns/catalog').then(res => {
      if (res.data.success) {
        const map = new Map<string, CatalogMetric>();
        for (const m of res.data.metrics) {
          map.set(m.id, m);
        }
        setCatalogMetricsMap(map);
        const unhydrated = dynamicMetricIds.filter(id => !getColumnById(`metric:${id}`));
        for (const id of unhydrated) {
          const metric = map.get(id);
          if (metric) buildDynamicColumn(metric);
        }
      }
    }).catch(() => {});
    // We re-fetch the catalog when the set of active dynamic metric IDs
    // changes; `dynamicMetricIds`, `getColumnById`, and `buildDynamicColumn`
    // are all derived from that key in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicMetricIdsKey]);

  interface GridCellData {
    value: number | null;
    previousValue: number | null;
    trailing3Avg: number | null;
    date: string;
    geoName: string;
    geoType: string;
    geoId: string;
    trend: 'up' | 'down' | 'flat' | null;
    yoyChange: number | null;
  }
  interface DriverInsightData {
    outcomeMetricId: string;
    pearsonR: number;
    rSquared: number;
    lagWeeks: number;
    direction: string;
    driverName: string;
  }
  const [gridData, setGridData] = useState<Record<string, Record<string, GridCellData>>>({});
  const [columnInsights, setColumnInsights] = useState<Record<string, DriverInsightData>>({});

  useEffect(() => {
    api.get('/columns/insights').then(res => {
      if (res.data.success) setColumnInsights(res.data.insights);
    }).catch(() => {});
  }, []);

  const trackedMarkets = useMemo(() => ALL_MARKETS_RESOLVED.filter(m => m.starred), [ALL_MARKETS_RESOLVED]);
  
  const filteredMarkets = useMemo(() => {
    let markets = activeTab === "dashboard" && trackedOnly 
      ? ALL_MARKETS_RESOLVED.filter(m => m.starred)
      : ALL_MARKETS_RESOLVED;
    
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
  }, [ALL_MARKETS_RESOLVED, activeTab, trackedOnly, cycleFilter, searchQuery, sortCol, sortDir]);

  const kpis = useMemo(() => {
    const markets = trackedMarkets;
    const len = markets.length || 1;
    const avgJedi = Math.round(markets.reduce((s, m) => s + m.jedi, 0) / len);
    const avgRent = Math.round(markets.reduce((s, m) => s + m.rentNum, 0) / len);
    const avgVac = (markets.reduce((s, m) => s + m.vacNum, 0) / len).toFixed(1);
    const expanding = markets.filter(m => m.cycle === "EXPANSION" || m.cycle === "LATE EXP").length;
    return { count: markets.length, avgJedi, avgRent, avgVac, expanding };
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

  const visibleGeoIds = useMemo(() => {
    const geos = new Set<string>();
    for (const m of filteredMarkets) {
      const slug = m.id.replace(/-[a-z]{2}$/, "");
      const state = (m.msa.split(", ").pop() || "FL").toLowerCase();
      geos.add(`${slug}-${state}-${state}`);
      geos.add(m.id);
    }
    for (const s of SUBMARKET_INDEX) {
      geos.add(s.name.toLowerCase().replace(/\s+/g, "-"));
    }
    for (const p of PROPERTY_INDEX) {
      geos.add(p.name.toLowerCase().replace(/\s+/g, "-"));
    }
    return [...geos].slice(0, 500);
  }, [filteredMarkets]);

  const visibleGeoIdsKey = visibleGeoIds.join(',');
  useEffect(() => {
    if (dynamicMetricIds.length === 0) return;
    const geoParam = visibleGeoIds.length > 0 ? `&geoIds=${visibleGeoIds.join(',')}` : '';
    api.get(`/columns/grid-data?metricIds=${dynamicMetricIds.join(',')}${geoParam}`).then(res => {
      if (res.data.success) setGridData(res.data.data);
    }).catch(() => {});
    // Re-fetch grid data only when the metric/geo identity set actually
    // changes (string-keyed), not on every render that recreates the arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynamicMetricIdsKey, visibleGeoIdsKey]);

  const topMovers = useMemo(() => {
    return [...ALL_MARKETS_RESOLVED].sort((a, b) => Math.abs(b.d30) - Math.abs(a.d30)).slice(0, 6);
  }, [ALL_MARKETS_RESOLVED]);

  useEffect(() => {
    if (onTopMovers) {
      onTopMovers(topMovers.map(m => ({ msa: m.msa, d30: m.d30, jedi: m.jedi, cycle: m.cycle })));
    }
  }, [topMovers, onTopMovers]);

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
    const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
    const haystack: Array<{ id?: string; name: string }> = [
      ...(SUBMARKET_RESOLVED as Array<{ id?: string; name: string }>),
      ...SUBMARKET_INDEX,
    ];
    const sub =
      haystack.find(s => s.id === submarketId) ||
      haystack.find(s => slugify(s.name) === submarketId) ||
      haystack.find(s => s.name.toLowerCase() === submarketId.toLowerCase());
    const prettyName =
      sub?.name ||
      submarketId
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    setDrillSubmarketName(prettyName);
    setLevel("submarket-terminal");
  };

  const handlePropertySelect = (propertyId: string, propertyName?: string) => {
    const slug = propertyId.toLowerCase().replace(/\s+/g, "-");
    nav(`/property-card/${slug}`, {
      state: {
        msaId: drillMsaId,
        msaName: drillMsaName,
        submarketId: drillSubmarketId,
        submarketName: drillSubmarketName,
        propertyName: propertyName || propertyId,
      }
    });
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
          <SubmarketTerminal
            submarketId={drillSubmarketId}
            submarketName={drillSubmarketName}
            msaId={drillMsaId}
            msaName={drillMsaName}
            onPropertySelect={handlePropertySelect}
            onMsaNavigate={() => setLevel("msa-terminal")}
            embedded
          />
        </div>
      </div>
    );
  }

  // ============================================================================
  // Dynamic Cell Renderer — Market-level data
  // ============================================================================

  const renderDynamicCell = (colId: string, geoType: string, geoId: string) => {
    const metricId = extractMetricId(colId);
    if (!metricId) return <span style={{ color: C.muted }}>—</span>;
    const metricData = gridData[metricId];
    if (!metricData) return <span style={{ color: C.muted, fontSize: 8 }}>…</span>;

    const config = getColumnConfig(colId);

    if (config.geoScope !== 'auto' && config.geoScope !== geoType) {
      return <span style={{ color: C.muted }}>—</span>;
    }

    const effectiveGeoId = config.pinnedGeoId || geoId;
    const geoKey = `${geoType}:${effectiveGeoId}`;
    const altGeoType = geoType === 'msa' ? 'metro' : geoType === 'metro' ? 'msa' : null;
    const altGeoKey = altGeoType ? `${altGeoType}:${effectiveGeoId}` : null;
    const cell = metricData[geoKey] || (altGeoKey ? metricData[altGeoKey] : null);
    if (!cell || cell.value == null) return <span style={{ color: C.muted }}>—</span>;

    const def = getColumnById(colId);

    let displayValue = cell.value;
    if (config.aggregation === 'yoy' && cell.yoyChange != null) {
      displayValue = cell.yoyChange;
    } else if (config.aggregation === '3mo_avg' && cell.trailing3Avg != null) {
      displayValue = cell.trailing3Avg;
    }

    let formatted: string;
    if (config.displayFormat === 'pct') {
      formatted = `${displayValue.toFixed(1)}%`;
    } else if (config.displayFormat === 'dollar') {
      formatted = `$${displayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    } else if (config.displayFormat === 'decimals') {
      formatted = displayValue.toFixed(2);
    } else {
      formatted = def?.format ? def.format(displayValue) : formatMetricValue(displayValue, def?.unit);
    }

    const trendColor = cell.trend === 'up' ? C.green : cell.trend === 'down' ? C.red : C.muted;
    const trendArrow = cell.trend === 'up' ? '▲' : cell.trend === 'down' ? '▼' : '';

    return (
      <span style={{ color: C.primary, fontSize: 9 }}>
        {formatted}
        {trendArrow && <span style={{ color: trendColor, fontSize: 6, marginLeft: 2 }}>{trendArrow}</span>}
      </span>
    );
  };

  const renderMarketCell = (colId: string, m: TrackedMarket, isMedian = false) => {
    if (isDynamicColumn(colId)) {
      if (isMedian) return <span style={{ color: C.muted }}>—</span>;
      const slug = m.id.replace(/-[a-z]{2}$/, "");
      const state = (m.msa.split(", ").pop() || "FL").toLowerCase();
      const geoId = `${slug}-${state}-${state}`;
      return renderDynamicCell(colId, "msa", geoId);
    }

    if (isMedian && median) {
      const medMap: Record<string, React.ReactNode> = {
        rank: <span style={{ color: C.muted, fontStyle: "italic" }}>—</span>,
        starred: null,
        msa: <span style={{ color: C.muted }}>Median</span>,
        props: <span style={{ color: C.muted }}>—</span>,
        units: <span style={{ color: C.muted }}>—</span>,
        jedi: <ScoreCell value={median.jedi} size={10} />,
        d30: <span style={{ color: C.muted }}>—</span>,
        trend: <span style={{ color: C.muted }}>───</span>,
        rent: <span style={{ color: C.primary }}>{median.rent}</span>,
        rentD: <DeltaCell value={median.rentD} />,
        vac: <ThresholdVal value={median.vac} thresholds={[5, 8]} invert />,
        absorb: <span style={{ color: C.primary }}>{median.absorb}</span>,
        pipeline: <ThresholdVal value={median.pipeline} thresholds={[8, 14]} invert />,
        costs: <span style={{ color: C.primary }}>{median.costs}</span>,
        dApt: <span style={{ color: C.primary }}>{median.dApt}</span>,
        popD: <DeltaCell value={median.popD} />,
        medInc: <span style={{ color: C.primary }}>{median.medInc}</span>,
        cap: <span style={{ color: C.primary }}>{median.cap}</span>,
        cycle: <span style={{ color: C.muted }}>—</span>,
      };
      return medMap[colId] ?? <span style={{ color: C.muted }}>—</span>;
    }

    const cellMap: Record<string, React.ReactNode> = {
      rank: <span style={{ color: C.secondary }}>{m.rank}</span>,
      starred: <span style={{ color: m.starred ? C.amber : C.muted, fontSize: 10 }}>{m.starred ? "★" : "☆"}</span>,
      msa: <span style={{ color: C.primary, fontWeight: 600, ...sans }}>{m.msa}</span>,
      props: <span style={{ color: C.secondary }}>{m.props.toLocaleString()}</span>,
      units: <span style={{ color: C.secondary }}>{m.units}</span>,
      jedi: <ScoreCell value={m.jedi} size={10} />,
      d30: <DeltaCell value={m.d30} />,
      trend: <Spark data={m.trend} color={m.d30 >= 0 ? C.green : C.red} w={40} h={12} />,
      rent: <span style={{ color: C.primary, fontWeight: 600 }}>{m.rent}</span>,
      rentD: <DeltaCell value={m.rentD} />,
      vac: <ThresholdVal value={m.vac} thresholds={[5, 8]} invert />,
      absorb: <span style={{ color: C.primary }}>{m.absorb}</span>,
      pipeline: <SupplyCell value={m.pipeline} valueNum={m.pipelineNum} marketId={m.id} />,
      costs: <span style={{ color: C.secondary }}>{m.costs}</span>,
      dApt: <span style={{ color: C.secondary }}>{m.dApt}</span>,
      popD: <DeltaCell value={m.popD} />,
      medInc: <span style={{ color: C.secondary }}>{m.medInc}</span>,
      cap: <span style={{ color: C.secondary }}>{m.cap}</span>,
      cycle: <Badge label={m.cycle} color={cycleColor(m.cycle)} />,
    };
    return cellMap[colId] ?? <span style={{ color: C.muted }}>—</span>;
  };

  const renderSubmarketCell = (colId: string, s: typeof SUBMARKET_INDEX[number]) => {
    if (isDynamicColumn(colId)) {
      const subGeoId = s.name.toLowerCase().replace(/\s+/g, "-");
      return renderDynamicCell(colId, "submarket", subGeoId);
    }
    const cellMap: Record<string, React.ReactNode> = {
      name: <span style={{ color: C.primary, fontWeight: 600, ...sans }}>{s.name}</span>,
      msa: <span style={{ color: C.secondary }}>{s.msa}</span>,
      jedi: <ScoreCell value={s.jedi} size={10} />,
      rent: <span style={{ color: C.primary, fontWeight: 600 }}>{s.rent}</span>,
      rentD: <DeltaCell value={s.rentD} />,
      vac: <ThresholdVal value={s.vac} thresholds={[5, 8]} invert />,
      props: <span style={{ color: C.secondary }}>{s.props}</span>,
      units: <span style={{ color: C.secondary }}>{s.units}</span>,
      opp: <ScoreCell value={s.opp} size={9} />,
      cap: <span style={{ color: C.secondary }}>{s.cap}</span>,
      cycle: <Badge label={s.cycle} color={cycleColor(s.cycle)} />,
    };
    return cellMap[colId] ?? <span style={{ color: C.muted }}>—</span>;
  };

  const renderPropertyCell = (colId: string, p: typeof PROPERTY_INDEX[number]) => {
    if (isDynamicColumn(colId)) {
      const propGeoId = p.name.toLowerCase().replace(/\s+/g, "-");
      return renderDynamicCell(colId, "property", propGeoId);
    }
    const cellMap: Record<string, React.ReactNode> = {
      name: <span style={{ color: C.primary, fontWeight: 600, ...sans }}>{p.name}</span>,
      submarket: <span style={{ color: C.secondary }}>{p.submarket}</span>,
      msa: <span style={{ color: C.secondary }}>{p.msa}</span>,
      jedi: <ScoreCell value={p.jedi} size={10} />,
      units: <span style={{ color: C.secondary }}>{p.units}</span>,
      rent: <span style={{ color: C.primary, fontWeight: 600 }}>{p.rent}</span>,
      occ: <ThresholdVal value={p.occ} thresholds={[94, 91]} />,
      capRate: <span style={{ color: C.secondary }}>{p.capRate}</span>,
      vintage: <span style={{ color: C.secondary }}>{p.vintage}</span>,
      owner: <span style={{ color: C.muted }}>{p.owner}</span>,
    };
    return cellMap[colId] ?? <span style={{ color: C.muted }}>—</span>;
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    await gridTemplates.saveTemplate(saveTemplateName.trim(), colPrefsMap[safeTab]?.columns || [], columnConfigs);
    setSaveTemplateName("");
    setShowSaveDialog(false);
  };

  const handleLoadTemplate = async (template: GridTemplate) => {
    if (template.columns && Array.isArray(template.columns)) {
      const dynamicCols = template.columns.filter(isDynamicColumn);
      if (dynamicCols.length > 0) {
        try {
          const catalogRes = await api.get('/columns/catalog');
          if (catalogRes.data.success) {
            const metricsMap = new Map(catalogRes.data.metrics.map((m: CatalogMetric) => [m.id, m]));
            for (const colId of dynamicCols) {
              const metricId = extractMetricId(colId);
              if (metricId && metricsMap.has(metricId)) {
                buildDynamicColumn(metricsMap.get(metricId));
              }
            }
          }
        } catch {}
      }
      const templateConfig = template.column_config && typeof template.column_config === 'object'
        ? template.column_config as Record<string, ColumnConfig>
        : {};
      if (Object.keys(templateConfig).length > 0) {
        setColumnConfigs(templateConfig);
      }
      colPrefsMap[safeTab]?.saveColumns(template.columns, templateConfig);
      gridTemplates.setActiveTemplate(template.id);
    }
    setTemplateDropdownOpen(false);
  };

  const GearButton = ({ tab }: { tab: ActiveTab }) => (
    <div style={{ position: "relative", display: "flex", gap: 4, alignItems: "center" }}>
      <button
        onClick={() => setPickerOpen(pickerOpen === tab ? null : tab)}
        style={{
          ...mono, fontSize: 9, background: pickerOpen === tab ? C.active : "transparent",
          color: pickerOpen === tab ? C.amber : C.muted, border: `1px solid ${pickerOpen === tab ? C.amber + "44" : C.borderS}`,
          padding: "2px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
        }}
        title="Customize columns"
      >
        ⚙ COLUMNS
        {colPrefsMap[tab].columns.filter(isDynamicColumn).length > 0 && (
          <span style={{ color: "#2196F3", fontSize: 8 }}>+{colPrefsMap[tab].columns.filter(isDynamicColumn).length}</span>
        )}
      </button>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
          style={{
            ...mono, fontSize: 9, background: templateDropdownOpen ? C.active : "transparent",
            color: templateDropdownOpen ? C.amber : C.muted, border: `1px solid ${templateDropdownOpen ? C.amber + "44" : C.borderS}`,
            padding: "2px 6px", cursor: "pointer",
          }}
        >
          TEMPLATES {gridTemplates.templates.length > 0 && `(${gridTemplates.templates.length})`}
        </button>
        {templateDropdownOpen && (
          <div style={{
            position: "absolute", top: 24, right: 0, width: 220, background: C.panel,
            border: `1px solid ${C.borderM}`, zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "6px 8px", borderBottom: `1px solid ${C.borderS}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.amber }}>GRID TEMPLATES</span>
              <button
                onClick={() => { setShowSaveDialog(true); setTemplateDropdownOpen(false); }}
                style={{ ...mono, fontSize: 8, color: C.green, background: C.green + "15", border: `1px solid ${C.green}33`, padding: "1px 6px", cursor: "pointer" }}
              >
                + SAVE AS
              </button>
            </div>
            {gridTemplates.templates.length === 0 ? (
              <div style={{ ...mono, fontSize: 8, color: C.muted, padding: "8px", textAlign: "center" }}>No saved templates</div>
            ) : (
              gridTemplates.templates.map(t => (
                <div
                  key={t.id}
                  style={{
                    display: "flex", alignItems: "center", padding: "4px 8px", cursor: "pointer",
                    background: gridTemplates.activeTemplate === t.id ? C.active : "transparent",
                    borderBottom: `1px solid ${C.borderS}22`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.hover}
                  onMouseLeave={e => e.currentTarget.style.background = gridTemplates.activeTemplate === t.id ? C.active : "transparent"}
                >
                  <div style={{ flex: 1 }} onClick={() => handleLoadTemplate(t)}>
                    <div style={{ ...mono, fontSize: 9, color: C.primary }}>{t.name}</div>
                    <div style={{ ...mono, fontSize: 7, color: C.muted }}>
                      {t.columns.length} cols
                      {t.columns.filter(isDynamicColumn).length > 0 && ` · ${t.columns.filter(isDynamicColumn).length} metrics`}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); gridTemplates.deleteTemplate(t.id); }}
                    style={{ ...mono, fontSize: 8, color: C.red, background: "transparent", border: "none", cursor: "pointer", padding: "2px" }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
            {gridTemplates.templates.length > 0 && (
              <div style={{ padding: "4px 8px", borderTop: `1px solid ${C.borderS}` }}>
                <button
                  onClick={() => { setShowManageModal(true); setTemplateDropdownOpen(false); }}
                  style={{ ...mono, fontSize: 8, color: C.muted, background: "transparent", border: `1px solid ${C.borderS}`, padding: "2px 8px", cursor: "pointer", width: "100%" }}
                >
                  MANAGE TEMPLATES
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showSaveDialog && (
        <div style={{
          position: "absolute", top: 24, right: 0, width: 240, background: C.panel,
          border: `1px solid ${C.amber}44`, zIndex: 100, padding: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}>
          <div style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.amber, marginBottom: 6 }}>SAVE TEMPLATE</div>
          <input
            type="text"
            value={saveTemplateName}
            onChange={e => setSaveTemplateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
            placeholder="Template name..."
            autoFocus
            style={{ ...mono, fontSize: 9, width: "100%", background: C.bg, color: C.primary, border: `1px solid ${C.borderS}`, padding: "4px 6px", outline: "none", marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <button onClick={() => setShowSaveDialog(false)} style={{ ...mono, fontSize: 8, color: C.muted, background: "transparent", border: `1px solid ${C.borderS}`, padding: "2px 8px", cursor: "pointer" }}>CANCEL</button>
            <button onClick={handleSaveTemplate} style={{ ...mono, fontSize: 8, color: C.bg, background: C.amber, border: "none", padding: "2px 8px", cursor: "pointer", fontWeight: 700 }}>SAVE</button>
          </div>
        </div>
      )}

      {pickerOpen === tab && (
        <ColumnPicker
          viewId={viewIdMap[tab]}
          activeColumns={colPrefsMap[tab].columns}
          onToggle={colPrefsMap[tab].toggleColumn}
          onReorder={colPrefsMap[tab].reorderColumns}
          onReset={colPrefsMap[tab].resetToDefaults}
          onClose={() => setPickerOpen(null)}
          isDefault={colPrefsMap[tab].isDefault}
        />
      )}
    </div>
  );

  // ============================================================================
  // Market Table
  // ============================================================================

  const renderMarketTable = (viewTab: ActiveTab = "browse") => {
    const cols = colPrefsMap[viewTab].columns;
    const sortableMap: Record<string, SortKey> = { rank: "rank", msa: "msa", jedi: "jedi", d30: "d30", rent: "rentNum", vac: "vacNum", absorb: "absorbNum", pipeline: "pipelineNum", cap: "capNum", cycle: "cycle" };

    if (marketsEmpty) {
      return <AwaitingData loading={marketsLoading} label="market metrics" />;
    }

    return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
            {cols.map(colId => {
              const def = getColumnById(colId);
              const label = def?.label || (isDynamicColumn(colId) ? extractMetricId(colId) : colId.toUpperCase());
              const w = def?.width || (isDynamicColumn(colId) ? 64 : 50);
              const sortKey = sortableMap[colId];
              const corrInfo = columnCorrelations[colId];
              const metricId = extractMetricId(colId);
              const catalogId = metricId || def?.catalogMetricId || '';
              const dynDef = def as DynamicColumnDef | undefined;
              const dbMetricId = dynDef?.dbMetricId || catalogMetricsMap.get(catalogId)?.dbMetricId || catalogId;
              const driverInsight = columnInsights[catalogId] || columnInsights[dbMetricId] || null;
              const absR = driverInsight ? Math.abs(driverInsight.pearsonR) : 0;
              const insightStrength = absR >= 0.7 ? 'strong' : absR >= 0.5 ? 'moderate' : 'weak';
              const insightColor = insightStrength === 'strong' ? '#4CAF50' : insightStrength === 'moderate' ? '#00BCD4' : '#78909C';
              return (
                <th
                  key={colId}
                  style={{
                    ...hdrCell, width: w, position: "relative",
                    textAlign: colId === "msa" ? "left" : "center",
                    color: colId === "jedi" ? C.amber : isDynamicColumn(colId) ? "#2196F3" : undefined,
                  }}
                  onClick={sortKey ? () => handleSort(sortKey) : isDynamicColumn(colId) ? () => setConfigPopoverCol(configPopoverCol === colId ? null : colId) : undefined}
                  title={driverInsight
                    ? `r=${driverInsight.pearsonR > 0 ? '+' : ''}${driverInsight.pearsonR.toFixed(3)} (R²=${driverInsight.rSquared.toFixed(2)}) ${driverInsight.direction} → ${driverInsight.outcomeMetricId} (${driverInsight.lagWeeks}w lead) [${insightStrength.toUpperCase()}]`
                    : corrInfo?.isStrong && corrInfo.topCorrelation
                    ? `r=${corrInfo.topCorrelation.correlation_r.toFixed(2)} with ${corrInfo.topCorrelation.metric_a === corrInfo.metricId ? corrInfo.topCorrelation.metric_b : corrInfo.topCorrelation.metric_a}${corrInfo.topCorrelation.lead_lag_months ? ` (${corrInfo.topCorrelation.lead_lag_months}mo lag)` : ""}`
                    : def?.description}
                >
                  {isDynamicColumn(colId) && <span style={{ fontSize: 6, marginRight: 1, opacity: 0.6 }}>◆</span>}
                  {label}
                  {isDynamicColumn(colId) && (
                    <span
                      onClick={e => { e.stopPropagation(); setConfigPopoverCol(configPopoverCol === colId ? null : colId); }}
                      style={{ fontSize: 7, marginLeft: 2, cursor: "pointer", opacity: configPopoverCol === colId ? 1 : 0.5, color: "#2196F3" }}
                      title="Column config"
                    >⚙</span>
                  )}
                  {driverInsight && (
                    <span style={{
                      ...mono, fontSize: 6, fontWeight: 700, marginLeft: 2,
                      color: insightColor,
                      background: insightColor + "15",
                      border: `1px solid ${insightColor}30`,
                      padding: "0px 3px", borderRadius: 2, verticalAlign: "super",
                    }}>
                      {driverInsight.direction === 'positive' ? '↗' : '↘'}r{driverInsight.pearsonR > 0 ? '+' : ''}{driverInsight.pearsonR.toFixed(2)}→{driverInsight.outcomeMetricId.replace('OP_', '').substring(0, 6)} {driverInsight.lagWeeks}w
                    </span>
                  )}
                  {!driverInsight && corrInfo?.isStrong && (
                    <span style={{
                      ...mono, fontSize: 7, fontWeight: 700, marginLeft: 2,
                      color: corrInfo.topCorrelation!.correlation_r > 0 ? C.green : C.red,
                      background: (corrInfo.topCorrelation!.correlation_r > 0 ? C.green : C.red) + "18",
                      border: `1px solid ${(corrInfo.topCorrelation!.correlation_r > 0 ? C.green : C.red)}33`,
                      padding: "0px 3px", borderRadius: 2, verticalAlign: "super",
                    }}>
                      r{corrInfo.topCorrelation!.correlation_r > 0 ? "+" : ""}{corrInfo.topCorrelation!.correlation_r.toFixed(1)}
                    </span>
                  )}
                  {" "}{sortKey && sortCol === sortKey && (sortDir === "desc" ? "▼" : "▲")}
                  {configPopoverCol === colId && isDynamicColumn(colId) && def && (
                    <ColumnConfigPopover
                      colDef={def}
                      config={getColumnConfig(colId)}
                      onConfigChange={(cfg) => setColumnConfig(colId, cfg)}
                      onClose={() => setConfigPopoverCol(null)}
                      insight={driverInsight}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {median && (
            <tr style={{ background: C.panelAlt, borderBottom: `1px solid ${C.borderM}` }}>
              {cols.map(colId => (
                <td key={colId} style={{ ...dataCell, textAlign: colId === "msa" ? "left" : "center" }}>
                  {renderMarketCell(colId, filteredMarkets[0], true)}
                </td>
              ))}
            </tr>
          )}
          {filteredMarkets.map((m, i) => (
            <tr
              key={m.id}
              onClick={() => handleDrillToMsa(m)}
              style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = C.hover; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}
            >
              {cols.map(colId => (
                <td key={colId} style={{ ...dataCell, textAlign: colId === "msa" ? "left" : "center" }}>
                  {renderMarketCell(colId, m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  };

  // ============================================================================
  // Tab Content Renderers
  // ============================================================================

  const renderSuggestedMetrics = () => {
    if (metricRecs.length === 0 && !recsLoading) return null;
    const activeColPrefs = colPrefsMap[safeTab];
    const activeCols = new Set(activeColPrefs.columns);
    const activeMetricIds = new Set(
      activeColPrefs.columns
        .filter(c => c.startsWith("metric:"))
        .map(c => c.substring(7))
    );
    const missing = metricRecs.filter(rec => {
      if (rec.columnId && activeCols.has(rec.columnId)) return false;
      if (rec.metricId && activeMetricIds.has(rec.metricId)) return false;
      return true;
    });
    if (missing.length === 0 && !recsLoading) return null;
    return (
      <div style={{ borderBottom: `1px solid ${C.borderS}`, flexShrink: 0 }}>
        <div
          onClick={() => setRecsCollapsed(!recsCollapsed)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 12px",
            background: C.purple + "12", cursor: "pointer",
            borderBottom: recsCollapsed ? "none" : `1px solid ${C.borderS}`,
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: C.purple, ...mono }}>
            {recsCollapsed ? "▶" : "▼"} SUGGESTED METRICS
          </span>
          <span style={{ fontSize: 8, color: C.muted, ...mono }}>
            {missing.length} metric{missing.length !== 1 ? "s" : ""} you may be missing
          </span>
          {recsLoading && <span style={{ fontSize: 8, color: C.amber, ...mono }}>Computing...</span>}
        </div>
        {!recsCollapsed && missing.length > 0 && (
          <div style={{ display: "flex", gap: 0, overflowX: "auto", overflowY: "hidden", background: C.panel }}>
            {missing.slice(0, 5).map((rec: MetricRecommendation) => {
              const rColor = rec.correlationR > 0 ? C.green : C.red;
              const trendIcon = rec.trendDirection === "rising" ? "▲" : rec.trendDirection === "falling" ? "▼" : "─";
              const trendColor = rec.trendDirection === "rising" ? C.green : rec.trendDirection === "falling" ? C.red : C.muted;

              return (
                <div
                  key={`${rec.geographyId}:${rec.metricId}`}
                  style={{
                    minWidth: 200, maxWidth: 260, padding: "8px 12px",
                    borderRight: `1px solid ${C.borderS}`,
                    display: "flex", flexDirection: "column", gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: C.primary }}>{rec.metricLabel}</span>
                    <span style={{
                      ...mono, fontSize: 7, fontWeight: 700, padding: "1px 4px",
                      background: rColor + "18", color: rColor,
                      border: `1px solid ${rColor}33`, borderRadius: 2,
                    }}>
                      r{rec.correlationR > 0 ? "+" : ""}{rec.correlationR.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ ...mono, fontSize: 8, color: C.secondary, lineHeight: 1.4 }}>
                    {rec.reason}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ ...mono, fontSize: 8, color: trendColor, fontWeight: 700 }}>
                      {trendIcon} {rec.trendDirection.toUpperCase()}
                    </span>
                    {rec.geoCount > 1 && (
                      <span style={{ ...mono, fontSize: 7, color: C.muted }}>
                        {rec.geoCount} mkts
                      </span>
                    )}
                    {rec.leadLagMonths !== 0 && (
                      <span style={{ ...mono, fontSize: 7, color: C.cyan }}>
                        {Math.abs(rec.leadLagMonths)}mo {rec.leadLagMonths > 0 ? "lead" : "lag"}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {rec.columnId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          activeColPrefs.toggleColumn(rec.columnId!);
                        }}
                        style={{
                          ...mono, fontSize: 7, fontWeight: 700,
                          background: C.purple + "22",
                          color: C.purple,
                          border: `1px solid ${C.purple}44`,
                          padding: "2px 6px", cursor: "pointer",
                        }}
                      >
                        + ADD COL
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderMetricsLegend = () => {
    if (!showLegend) return null;
    const legendItems: { icon: React.ReactNode; label: string; desc: string }[] = [
      {
        icon: <span style={{ color: "#2196F3", fontSize: 8 }}>◆</span>,
        label: "Dynamic Column",
        desc: "Data-backed metric from the catalog, added via Metrics Library",
      },
      {
        icon: <span style={{ color: "#2196F3", fontSize: 9 }}>⚙</span>,
        label: "Column Config",
        desc: "Click to set aggregation (latest / YoY / 3mo avg), geo scope, and display format",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: "#4CAF50", background: "#4CAF5015", border: "1px solid #4CAF5030", padding: "0px 3px", borderRadius: 2 }}>r+0.82</span>,
        label: "Strong Correlation (|r| >= 0.7)",
        desc: "Column header badge: strong statistical relationship. Green in grid headers by strength",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: "#00BCD4", background: "#00BCD415", border: "1px solid #00BCD430", padding: "0px 3px", borderRadius: 2 }}>r+0.55</span>,
        label: "Moderate Correlation (|r| >= 0.5)",
        desc: "Column header badge: moderate relationship. Cyan in grid headers by strength",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: "#78909C", background: "#78909C15", border: "1px solid #78909C30", padding: "0px 3px", borderRadius: 2 }}>r+0.35</span>,
        label: "Weak Correlation (|r| < 0.5)",
        desc: "Column header badge: weak or no significant relationship. Gray in grid headers",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: "#4CAF50", background: "#4CAF5015", border: "1px solid #4CAF5030", padding: "0px 3px", borderRadius: 2 }}>r+0.82</span>,
        label: "Suggestion Card Badge",
        desc: "In suggested metrics bar: colored by sign (green = positive r, red = negative r). Distinct from header badges above",
      },
      {
        icon: <span style={{ color: C.green, fontSize: 9, fontWeight: 700 }}>▲</span>,
        label: "Trend Rising",
        desc: "Metric value is increasing in the most recent period",
      },
      {
        icon: <span style={{ color: C.red, fontSize: 9, fontWeight: 700 }}>▼</span>,
        label: "Trend Falling",
        desc: "Metric value is decreasing in the most recent period",
      },
      {
        icon: <span style={{ color: C.muted, fontSize: 9, fontWeight: 700 }}>─</span>,
        label: "Trend Flat",
        desc: "No significant change in the most recent period",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, color: C.green, fontWeight: 700 }}>+4.2%</span>,
        label: "YoY Change (green)",
        desc: "Year-over-year increase — positive for metrics where higher is better",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, color: C.red, fontWeight: 700 }}>-2.1%</span>,
        label: "YoY Change (red)",
        desc: "Year-over-year decrease — negative for metrics where higher is better",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, fontWeight: 700, color: C.purple, background: C.purple + "22", border: `1px solid ${C.purple}44`, padding: "1px 4px", borderRadius: 2 }}>+ ADD COL</span>,
        label: "Suggested Metric",
        desc: "Correlation analysis recommends this metric — click to add as a grid column",
      },
      {
        icon: <span style={{ ...mono, fontSize: 7, color: C.cyan }}>3mo lead</span>,
        label: "Lead / Lag",
        desc: "This metric leads or lags an outcome metric by the shown number of months",
      },
    ];

    return (
      <div style={{ borderBottom: `1px solid ${C.borderS}`, flexShrink: 0, background: C.panel }}>
        <div
          onClick={() => setShowLegend(false)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "5px 12px",
            cursor: "pointer", borderBottom: `1px solid ${C.borderS}`,
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, color: C.cyan, ...mono }}>
            ▼ METRICS LEGEND
          </span>
          <span style={{ fontSize: 8, color: C.muted, ...mono }}>
            Visual indicators used in data grids
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {legendItems.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 12px",
                borderBottom: `1px solid ${C.borderS}22`,
                borderRight: i % 2 === 0 ? `1px solid ${C.borderS}22` : "none",
              }}
            >
              <div style={{ minWidth: 28, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 1 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ ...mono, fontSize: 9, fontWeight: 700, color: C.primary, lineHeight: 1.3 }}>{item.label}</div>
                <div style={{ ...mono, fontSize: 8, color: C.secondary, lineHeight: 1.4, marginTop: 1 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* KPI Strip */}
      <div style={{ display: "flex", gap: 1, background: C.borderS, padding: 0, flexShrink: 0 }}>
        <KPICard label="TRACKED" value={kpis.count} subtext="markets" />
        <KPICard label="AVG JEDI" value={kpis.avgJedi} subtext={kpis.avgJedi >= 80 ? "▲ strong" : "● moderate"} color={kpis.avgJedi >= 80 ? C.green : C.amber} />
        <KPICard label="AVG RENT" value={`$${kpis.avgRent.toLocaleString()}`} />
        <KPICard label="AVG VAC" value={`${kpis.avgVac}%`} color={parseFloat(kpis.avgVac) <= 6 ? C.green : C.amber} />
        <KPICard label="EXPANDING" value={`${kpis.expanding}/${kpis.count}`} color={C.green} />
      </div>

      {/* M35 Cross-Market Event Intelligence Strip */}
      <M35KeyEventsHub
        variant="markets"
        isExpanded={m35EventsExpanded}
        onToggle={() => setM35EventsExpanded(v => !v)}
      />

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
        {isLive && <span style={{ fontSize: 8, color: C.green, ...mono, fontWeight: 700 }}>LIVE</span>}
        {corrStaleCount > 0 && (
          <span
            style={{ fontSize: 8, color: C.red, ...mono, fontWeight: 700 }}
            title={`${corrStaleCount} of ${corrTotalCount} market correlations are stale (>7 days old)`}
          >
            CORR STALE ({corrStaleCount}/{corrTotalCount})
          </span>
        )}
        {corrTotalCount > 0 && corrStaleCount === 0 && (
          <span
            style={{ fontSize: 8, color: C.cyan, ...mono, fontWeight: 700 }}
            title="All market correlations are fresh (<7 days)"
          >
            CORR FRESH
          </span>
        )}
        {marketsLoading && <span style={{ fontSize: 8, color: C.amber, ...mono }}>Loading...</span>}
        <button
          onClick={(e) => { e.stopPropagation(); refreshMarkets(); }}
          style={{ ...mono, fontSize: 8, background: "transparent", color: C.muted, border: `1px solid ${C.borderS}`, padding: "1px 5px", cursor: "pointer" }}
          title="Refresh market data"
        >
          REFRESH
        </button>
        <GearButton tab="dashboard" />
      </div>

      {/* Main Table - Full Width */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {renderMarketTable("dashboard")}
      </div>

    </div>
  );

  const renderBrowse = () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
        {isLive && <span style={{ fontSize: 8, color: C.green, ...mono, fontWeight: 700 }}>LIVE</span>}
        {corrStaleCount > 0 && (
          <span style={{ fontSize: 8, color: C.red, ...mono, fontWeight: 700 }} title={`${corrStaleCount} of ${corrTotalCount} market correlations are stale (>7 days old)`}>
            CORR STALE ({corrStaleCount}/{corrTotalCount})
          </span>
        )}
        {corrTotalCount > 0 && corrStaleCount === 0 && (
          <span style={{ fontSize: 8, color: C.cyan, ...mono, fontWeight: 700 }} title="All market correlations are fresh (<7 days)">
            CORR FRESH
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); refreshMarkets(); }}
          style={{ ...mono, fontSize: 8, background: "transparent", color: C.muted, border: `1px solid ${C.borderS}`, padding: "1px 5px", cursor: "pointer" }}
          title="Refresh market data"
        >
          REFRESH
        </button>
        <GearButton tab="browse" />
      </div>
      {renderMarketTable("browse")}
    </div>
  );

  const renderSubmarkets = () => {
    const cols = subCols.columns;
    return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Submarket Index</span>
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {SUBMARKET_RESOLVED.length} submarkets{isLive ? " · LIVE" : ""} · Click to drill</span>
        <div style={{ flex: 1 }} />
        <GearButton tab="submarkets" />
      </div>
      {subEmpty ? <AwaitingData loading={subLoading} label="submarket data" /> : (
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...mono }}>
          <thead>
            <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
              {cols.map(colId => {
                const def = getColumnById(colId);
                const dynDef = def && 'isDynamic' in def ? (def as DynamicColumnDef) : null;
                const catalogId = dynDef?.catalogMetricId || colId.replace(/^metric:/, '');
                const dbMetricId = dynDef?.dbMetricId || catalogMetricsMap.get(catalogId)?.dbMetricId || catalogId;
                const driverInsight = columnInsights[catalogId] || columnInsights[dbMetricId] || null;
                const absR = driverInsight ? Math.abs(driverInsight.pearsonR) : 0;
                const insightStrength = absR >= 0.7 ? 'strong' : absR >= 0.5 ? 'moderate' : 'weak';
                const insightColor = insightStrength === 'strong' ? '#4CAF50' : insightStrength === 'moderate' ? '#00BCD4' : '#78909C';
                return (
                  <th key={colId} style={{
                    ...hdrCell, textAlign: colId === "name" ? "left" : "center",
                    color: isDynamicColumn(colId) ? "#2196F3" : undefined, position: "relative",
                  }}>
                    {def?.label || colId.toUpperCase()}
                    {isDynamicColumn(colId) && (
                      <span onClick={e => { e.stopPropagation(); setConfigPopoverCol(configPopoverCol === colId ? null : colId); }}
                        style={{ fontSize: 7, marginLeft: 2, cursor: "pointer", opacity: configPopoverCol === colId ? 1 : 0.5, color: "#2196F3" }}
                        title="Column config">⚙</span>
                    )}
                    {driverInsight && (
                      <span style={{ ...mono, fontSize: 6, fontWeight: 700, marginLeft: 2, color: insightColor, background: insightColor + "15", border: `1px solid ${insightColor}30`, padding: "0px 3px", borderRadius: 2, verticalAlign: "super" }}>
                        {driverInsight.direction === 'positive' ? '↗' : '↘'}r{driverInsight.pearsonR > 0 ? '+' : ''}{driverInsight.pearsonR.toFixed(2)}
                      </span>
                    )}
                    {configPopoverCol === colId && isDynamicColumn(colId) && def && (
                      <ColumnConfigPopover colDef={def} config={getColumnConfig(colId)} onConfigChange={(cfg) => setColumnConfig(colId, cfg)} onClose={() => setConfigPopoverCol(null)} insight={driverInsight} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {SUBMARKET_RESOLVED.map((s, i) => (
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
                {cols.map(colId => (
                  <td key={colId} style={{ ...dataCell, textAlign: colId === "name" ? "left" : "center" }}>
                    {renderSubmarketCell(colId, s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
  };

  const renderProperties = () => {
    const cols = propCols.columns;
    return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.borderS}`, background: C.panel, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, ...sans }}>Property Index</span>
        <span style={{ fontSize: 9, color: C.muted, ...mono }}>| {PROPERTY_RESOLVED.length} properties{isLive ? " · LIVE" : ""} · Click to view</span>
        <div style={{ flex: 1 }} />
        <GearButton tab="properties" />
      </div>
      {propEmpty ? <AwaitingData loading={propLoading} label="property data" /> : (
      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...mono }}>
          <thead>
            <tr style={{ background: C.header, position: "sticky", top: 0, zIndex: 2 }}>
              {cols.map(colId => {
                const def = getColumnById(colId);
                const dynDef = def && 'isDynamic' in def ? (def as DynamicColumnDef) : null;
                const catalogId = dynDef?.catalogMetricId || colId.replace(/^metric:/, '');
                const dbMetricId = dynDef?.dbMetricId || catalogMetricsMap.get(catalogId)?.dbMetricId || catalogId;
                const driverInsight = columnInsights[catalogId] || columnInsights[dbMetricId] || null;
                const absR = driverInsight ? Math.abs(driverInsight.pearsonR) : 0;
                const insightStrength = absR >= 0.7 ? 'strong' : absR >= 0.5 ? 'moderate' : 'weak';
                const insightColor = insightStrength === 'strong' ? '#4CAF50' : insightStrength === 'moderate' ? '#00BCD4' : '#78909C';
                return (
                  <th key={colId} style={{
                    ...hdrCell, textAlign: colId === "name" ? "left" : "center",
                    color: isDynamicColumn(colId) ? "#2196F3" : undefined, position: "relative",
                  }}>
                    {def?.label || colId.toUpperCase()}
                    {isDynamicColumn(colId) && (
                      <span onClick={e => { e.stopPropagation(); setConfigPopoverCol(configPopoverCol === colId ? null : colId); }}
                        style={{ fontSize: 7, marginLeft: 2, cursor: "pointer", opacity: configPopoverCol === colId ? 1 : 0.5, color: "#2196F3" }}
                        title="Column config">⚙</span>
                    )}
                    {driverInsight && (
                      <span style={{ ...mono, fontSize: 6, fontWeight: 700, marginLeft: 2, color: insightColor, background: insightColor + "15", border: `1px solid ${insightColor}30`, padding: "0px 3px", borderRadius: 2, verticalAlign: "super" }}>
                        {driverInsight.direction === 'positive' ? '↗' : '↘'}r{driverInsight.pearsonR > 0 ? '+' : ''}{driverInsight.pearsonR.toFixed(2)}
                      </span>
                    )}
                    {configPopoverCol === colId && isDynamicColumn(colId) && def && (
                      <ColumnConfigPopover colDef={def} config={getColumnConfig(colId)} onConfigChange={(cfg) => setColumnConfig(colId, cfg)} onClose={() => setConfigPopoverCol(null)} insight={driverInsight} />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PROPERTY_RESOLVED.map((p, i) => (
              <tr
                key={i}
                onClick={() => handlePropertySelect(p.name)}
                style={{ background: i % 2 === 0 ? C.panel : C.panelAlt, borderBottom: `1px solid ${C.borderS}`, cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? C.panel : C.panelAlt; }}
              >
                {cols.map(colId => (
                  <td key={colId} style={{ ...dataCell, textAlign: colId === "name" ? "left" : "center" }}>
                    {renderPropertyCell(colId, p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
  };

  const renderCompare = () => <PeerComparisonPage embedded onViewDetail={() => {}} />;

  const renderDemand = () => <DemandTab msaName={drillMsaName || undefined} msaCode={drillMsaId || undefined} />;

  const renderDeals = () => <F4DealsView />;

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": return renderDashboard();
      case "browse": return renderBrowse();
      case "submarkets": return renderSubmarkets();
      case "properties": return renderProperties();
      case "demand": return renderDemand();
      case "deals": return renderDeals();
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
    { id: "demand", label: "DEMAND" },
    { id: "deals", label: "DEALS" },
    { id: "compare", label: "COMPARE" },
  ];

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: C.bg, color: C.primary, outline: "none" }}>
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
              borderTop: "none", borderLeft: "none", borderRight: "none",
              borderBottom: activeTab === tab.id ? `2px solid ${C.amber}` : "2px solid transparent",
              letterSpacing: 0.5, outline: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: C.muted, fontStyle: "italic", paddingRight: 12, whiteSpace: "nowrap" }}>
          Press 0-7 to navigate • Type ticker to search
        </span>
        <button
          onClick={() => setShowLegend(!showLegend)}
          style={{
            ...mono, fontSize: 8, fontWeight: 700,
            padding: "0 8px", height: "100%", cursor: "pointer",
            background: showLegend ? C.cyan + "18" : "transparent",
            color: showLegend ? C.cyan : C.muted,
            borderTop: "none", borderLeft: "none", borderRight: "none",
            borderBottom: showLegend ? `2px solid ${C.cyan}` : "2px solid transparent",
            letterSpacing: 0.5, outline: "none",
          }}
          title="Toggle metrics legend"
        >
          ? LEGEND
        </button>
      </div>

      {activeTab !== "demand" && activeTab !== "deals" && renderMetricsLegend()}

      {activeTab !== "demand" && activeTab !== "deals" && renderSuggestedMetrics()}

      {/* Tab Content */}
      {renderTabContent()}

      {showManageModal && (
        <div
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowManageModal(false)}
        >
          <div
            style={{ background: C.panel, border: `1px solid ${C.borderM}`, width: 420, maxHeight: "60vh", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.8)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.borderM}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: C.amber }}>MANAGE GRID TEMPLATES</span>
              <button onClick={() => setShowManageModal(false)} style={{ ...mono, fontSize: 10, color: C.muted, background: "transparent", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
              {gridTemplates.templates.length === 0 ? (
                <div style={{ ...mono, fontSize: 9, color: C.muted, padding: "20px", textAlign: "center" }}>No saved templates yet. Use "Save As" to create one.</div>
              ) : (
                gridTemplates.templates.map(t => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex", alignItems: "center", padding: "8px 14px", gap: 10,
                      background: gridTemplates.activeTemplate === t.id ? C.active : "transparent",
                      borderBottom: `1px solid ${C.borderS}22`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ ...mono, fontSize: 10, color: C.primary, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ ...mono, fontSize: 8, color: C.muted, marginTop: 2 }}>
                        {t.columns.length} columns
                        {t.columns.filter(isDynamicColumn).length > 0 && ` · ${t.columns.filter(isDynamicColumn).length} metrics`}
                        {t.column_config && Object.keys(t.column_config).length > 0 && ` · ${Object.keys(t.column_config).length} configured`}
                      </div>
                      <div style={{ ...mono, fontSize: 7, color: C.muted, marginTop: 1 }}>
                        Created {new Date(t.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => { handleLoadTemplate(t); setShowManageModal(false); }}
                      style={{ ...mono, fontSize: 8, color: C.cyan, background: C.cyan + "15", border: `1px solid ${C.cyan}33`, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}
                    >
                      LOAD
                    </button>
                    <button
                      onClick={() => gridTemplates.updateTemplate(t.id, { columns: colPrefsMap[safeTab]?.columns || [], columnConfig: columnConfigs })}
                      style={{ ...mono, fontSize: 8, color: C.amber, background: C.amber + "15", border: `1px solid ${C.amber}33`, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}
                    >
                      UPDATE
                    </button>
                    <button
                      onClick={() => gridTemplates.deleteTemplate(t.id)}
                      style={{ ...mono, fontSize: 8, color: C.red, background: C.red + "15", border: `1px solid ${C.red}33`, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}
                    >
                      DELETE
                    </button>
                  </div>
                ))
              )}
            </div>
            <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.borderM}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowManageModal(false)}
                style={{ ...mono, fontSize: 9, color: C.primary, background: "transparent", border: `1px solid ${C.borderS}`, padding: "4px 14px", cursor: "pointer" }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
