import React, { useState, useMemo } from "react";
import { BT } from "../theme";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

type UnitStatus = "OVERSUPPLIED" | "BALANCED" | "UNDERSUPPLIED";

interface UnitDemandData {
  abbr: string;
  label: string;
  range: string;
  color: string;
  score: number;
  status: UnitStatus;
  statusColor: string;
  vac: number;
  vacDelta: number;
  dom: number;
  domDelta?: number;
  conc: number;
  concUnit: string;
  rent: number;
  rentDelta: number;
  sparkline: number[];
}

interface SupplyDemandGap {
  abbr: string;
  color: string;
  supply: number;
  demand: number;
  gap: number;
  status: UnitStatus;
}

interface DemandInsight {
  direction: "up" | "down";
  unitType: string;
  unitColor: string;
  description: string;
}

const FALLBACK_UNITS: UnitDemandData[] = [
  {
    abbr: "STU", label: "Studio", range: "420–540", color: BT.text.purple, score: 42,
    status: "OVERSUPPLIED", statusColor: BT.text.red,
    vac: 10.8, vacDelta: 8.0, dom: 34, conc: 5.6, concUnit: "wk",
    rent: 1248, rentDelta: -30,
    sparkline: [8, 9, 10, 11, 12, 13, 13, 14, 14, 15, 15, 16],
  },
  {
    abbr: "1BR", label: "1 BR", range: "680–820", color: BT.text.cyan, score: 72,
    status: "BALANCED", statusColor: BT.text.amber,
    vac: 6.3, vacDelta: -1.0, dom: 25, conc: 3.4, concUnit: "wk",
    rent: 1634, rentDelta: 45,
    sparkline: [7, 7, 6, 6, 7, 7, 7, 6, 6, 6, 6, 6],
  },
  {
    abbr: "2BR", label: "2 BR", range: "980–1150", color: BT.text.green, score: 91,
    status: "UNDERSUPPLIED", statusColor: BT.text.green,
    vac: 2.5, vacDelta: -1.5, dom: 9, conc: 0.6, concUnit: "wk",
    rent: 1988, rentDelta: 170,
    sparkline: [4, 3, 3, 2, 2, 2, 2, 2, 1, 1, 2, 2],
  },
  {
    abbr: "3BR", label: "3 BR+", range: "1240–1400", color: BT.text.amber, score: 68,
    status: "BALANCED", statusColor: BT.text.amber,
    vac: 5.0, vacDelta: -1.0, dom: 19, conc: 2.2, concUnit: "wk",
    rent: 2280, rentDelta: 110,
    sparkline: [6, 6, 5, 5, 5, 4, 5, 5, 4, 5, 5, 5],
  },
];

const FALLBACK_GAPS: SupplyDemandGap[] = [
  { abbr: "STU", color: BT.text.purple, supply: 4.2, demand: 3.1, gap: -1.1, status: "BALANCED" },
  { abbr: "1BR", color: BT.text.cyan, supply: 41.2, demand: 38.8, gap: -2.4, status: "BALANCED" },
  { abbr: "2BR", color: BT.text.green, supply: 44.2, demand: 49.6, gap: 5.4, status: "UNDERSUPPLIED" },
  { abbr: "3BR", color: BT.text.amber, supply: 10.4, demand: 8.5, gap: -1.9, status: "BALANCED" },
];

const FALLBACK_INSIGHTS: DemandInsight[] = [
  { direction: "up", unitType: "2BR", unitColor: BT.text.green, description: "undersupplied 5.4pp — fast velocity, low vac" },
  { direction: "down", unitType: "STU", unitColor: BT.text.purple, description: "soft demand — high vac, slow leasing velocity" },
];

function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function sigColor(val: number, type: "vac" | "dom" | "conc"): string {
  if (type === "vac") return val <= 3 ? BT.text.green : val <= 6 ? BT.text.amber : BT.text.red;
  if (type === "dom") return val <= 10 ? BT.text.green : val <= 20 ? BT.text.amber : BT.text.red;
  if (type === "conc") return val <= 0 ? BT.text.green : val <= 2 ? BT.text.amber : BT.text.red;
  return BT.text.primary;
}

function formatRent(val: number): string {
  return "$" + val.toLocaleString("en-US");
}

function UnitCard({ unit }: { unit: UnitDemandData }) {
  const metrics = [
    { label: "VAC", val: `${unit.vac}%`, sig: sigColor(unit.vac, "vac"), delta: unit.vacDelta, bad: unit.vacDelta > 0 },
    { label: "DOM", val: `${unit.dom}d`, sig: sigColor(unit.dom, "dom") },
    { label: "CONC", val: `${unit.conc}${unit.concUnit}`, sig: sigColor(unit.conc, "conc") },
    { label: "RENT", val: formatRent(unit.rent), sig: BT.text.primary, delta: unit.rentDelta, bad: unit.rentDelta < 0 },
  ];

  return (
    <div style={{ background: BT.bg.panelAlt, padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ width: 5, height: 5, background: unit.color, borderRadius: 1 }} />
          <span style={{ color: unit.color, ...mono, fontSize: 9, fontWeight: 700 }}>{unit.abbr}</span>
          <span style={{ color: BT.text.muted, fontSize: 8 }}>{unit.range}</span>
        </div>
        <span style={{
          fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 2,
          background: unit.statusColor + "18", border: `1px solid ${unit.statusColor}35`, color: unit.statusColor,
        }}>{unit.status}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ color: unit.statusColor, ...mono, fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{unit.score}</span>
        <span style={{ color: BT.text.muted, fontSize: 7, ...mono }}>/100</span>
        <div style={{ flex: 1, height: 3, background: BT.border.strong, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${unit.score}%`, height: "100%", background: unit.statusColor, borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px", marginBottom: 5 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 0" }}>
            <span style={{ color: BT.text.muted, fontSize: 8, ...mono }}>{m.label}</span>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              <span style={{ color: m.sig, ...mono, fontSize: 10, fontWeight: 700 }}>{m.val}</span>
              {m.delta !== undefined && m.delta !== 0 && (
                <span style={{ color: m.bad ? BT.text.red : BT.text.green, ...mono, fontSize: 7 }}>
                  {m.delta > 0 ? "▲" : "▼"}{Math.abs(m.delta).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: `1px solid ${BT.border.medium}`, paddingTop: 3 }}>
        <Sparkline data={unit.sparkline} color={unit.color} />
      </div>
    </div>
  );
}

function GapBarChart({ gaps }: { gaps: SupplyDemandGap[] }) {
  const maxBar = 55;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {gaps.map(g => (
        <div key={g.abbr} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: g.color, ...mono, fontSize: 8, fontWeight: 700, width: 24 }}>{g.abbr}</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ height: 6, background: BT.border.strong, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${(g.supply / maxBar) * 100}%`, height: "100%", background: g.color + "40", borderRadius: 2 }} />
            </div>
            <div style={{ height: 6, background: BT.border.strong, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${(g.demand / maxBar) * 100}%`, height: "100%", background: g.color, borderRadius: 2 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GapDetails({ gaps, insights }: { gaps: SupplyDemandGap[]; insights: DemandInsight[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {gaps.map(g => {
        const gapColor = g.gap > 3 ? BT.text.green : g.gap < -3 ? BT.text.red : BT.text.amber;
        const gapPct = Math.min(Math.abs(g.gap), 15) / 15 * 100;
        const statusLabel = g.gap > 3 ? "UNDERSUPPLIED" : g.gap < -3 ? "OVERSUPPLIED" : "BALANCED";
        return (
          <div key={g.abbr} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 5, height: 5, background: g.color, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: BT.text.primary, fontSize: 10, fontWeight: 600, minWidth: 28 }}>{g.abbr}</span>
            <span style={{
              fontSize: 7, fontWeight: 700, padding: "1px 4px", borderRadius: 2, minWidth: 72, textAlign: "center",
              background: gapColor + "18", border: `1px solid ${gapColor}35`, color: gapColor,
            }}>{statusLabel}</span>
            <span style={{ color: BT.text.muted, fontSize: 8, ...mono, minWidth: 75 }}>
              S:{g.supply.toFixed(1)}% D:<span style={{ color: g.color }}>{g.demand.toFixed(1)}%</span>
            </span>
            <div style={{ width: 80, height: 5, background: BT.border.strong, borderRadius: 2, position: "relative" }}>
              <div style={{
                position: "absolute",
                [g.gap >= 0 ? "left" : "right"]: "50%",
                width: `${gapPct / 2}%`, height: "100%", background: gapColor, borderRadius: 2,
              }} />
              <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: BT.text.muted + "40" }} />
            </div>
            <span style={{ color: gapColor, ...mono, fontSize: 10, fontWeight: 700, minWidth: 42 }}>
              {g.gap > 0 ? "+" : ""}{g.gap.toFixed(1)}pp
            </span>
          </div>
        );
      })}

      {insights.length > 0 && (
        <div style={{ marginTop: 6, padding: "5px 7px", background: BT.bg.panelAlt, borderRadius: 3, border: `1px solid ${BT.border.medium}` }}>
          {insights.map((insight, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "flex-start", marginBottom: i < insights.length - 1 ? 2 : 0 }}>
              <span style={{ color: insight.direction === "up" ? BT.text.green : BT.text.red, ...mono, fontSize: 9 }}>
                {insight.direction === "up" ? "▲" : "▼"}
              </span>
              <span style={{ color: BT.text.muted, fontSize: 9 }}>
                <span style={{ color: insight.unitColor, fontWeight: 700 }}>{insight.unitType}</span> {insight.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DemandTabProps {
  msaName?: string;
  msaCode?: string;
}

export function DemandTab({ msaName, msaCode }: DemandTabProps) {
  const [units, setUnits] = useState<UnitDemandData[]>(FALLBACK_UNITS);
  const [gaps, setGaps] = useState<SupplyDemandGap[]>(FALLBACK_GAPS);
  const [insights, setInsights] = useState<DemandInsight[]>(FALLBACK_INSIGHTS);
  const [loading, setLoading] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    const m1 = now.toLocaleString("en-US", { month: "short" }).toUpperCase().slice(0, 3);
    const prev = new Date(now);
    prev.setMonth(prev.getMonth() - 2);
    const m2 = prev.toLocaleString("en-US", { month: "short" }).toUpperCase().slice(0, 3);
    return `M${String(prev.getMonth() + 1).padStart(2, "0")} · M${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "7px 14px", borderBottom: `1px solid ${BT.border.medium}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: BT.text.cyan, ...mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em" }}>{dateRange}</span>
            <span style={{ color: BT.border.medium }}>·</span>
            <span style={{ color: BT.text.primary, fontSize: 11, fontWeight: 700 }}>Demand by Unit Type</span>
          </div>
          <span style={{ color: BT.text.muted, fontSize: 8, ...mono }}>VAC · DOM · CONC AVERAGED ACROSS TRADE AREA</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: BT.border.medium }}>
          {units.map(u => <UnitCard key={u.abbr} unit={u} />)}
        </div>
      </div>

      <div style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.medium}`, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ padding: "7px 14px", borderBottom: `1px solid ${BT.border.medium}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: BT.text.cyan, ...mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.1em" }}>DERIVED</span>
            <span style={{ color: BT.border.medium }}>·</span>
            <span style={{ color: BT.text.primary, fontSize: 11, fontWeight: 700 }}>Supply / Demand Gap</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ c: BT.border.strong, l: "SUPPLY" }, { c: BT.text.cyan, l: "DEMAND" }].map(lg => (
              <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 6, height: 2, background: lg.c, borderRadius: 1 }} />
                <span style={{ color: BT.text.muted, fontSize: 8, ...mono }}>{lg.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 1, background: BT.border.medium }}>
          <div style={{ background: BT.bg.panelAlt, padding: "8px 12px" }}>
            <GapBarChart gaps={gaps} />
          </div>
          <div style={{ background: BT.bg.terminal, padding: "8px 12px" }}>
            <GapDetails gaps={gaps} insights={insights} />
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 20, color: BT.text.muted, ...mono, fontSize: 10 }}>
          Loading demand data...
        </div>
      )}
    </div>
  );
}

export default DemandTab;
