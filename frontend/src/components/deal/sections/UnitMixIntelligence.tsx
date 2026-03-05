import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, LineChart, Line,
} from "recharts";
import { useUnitMixIntelligence } from "../../../hooks/useUnitMixIntelligence";
import { useTradeAreaStore } from "../../../stores/tradeAreaStore";

type UnitKey = "studio" | "oneBR" | "twoBR" | "threeBR";
type SigKey = "vac" | "dom" | "conc";

interface UnitData {
  mix: number; sf: number; rent: number; vac: number; dom: number; conc: number;
}

interface CompData {
  id: string; name: string; cls: string; built: number; total: number;
  units: Record<UnitKey, UnitData>;
}

interface ProgramUnit { mix: number; sf: number; rent: number; }
interface Program { totalUnits: number; units: Record<UnitKey, ProgramUnit>; }
interface ZoningData {
  zoningCode: string; maxUnits: number; maxNetSF: number; excludesParking: boolean;
  maxHeight: number; maxLotCoverage: number; source: string; sourceUrl: string; confidence: number;
}

interface InventoryItem {
  key: UnitKey; label: string; abbr: string; sfRange: string; color: string;
  typeUnits: number; supplyShare: number; avgVac: number; avgDOM: number;
  avgRent: number; avgConc: number; demandScore: number;
}

interface GapItem extends InventoryItem { demandShare: number; gap: number; }

// ─────────────────────────────────────────────────────────
//  PALETTE
// ─────────────────────────────────────────────────────────
const C = {
  bg: "#07111f", surface: "#0b1827", card: "#0f1f30", border: "#162232",
  muted: "#1e3347", text: "#d4e2f0", dim: "#4a6880", faint: "#243548",
  studio: "#a78bfa", oneBR: "#38bdf8", twoBR: "#34d399", threeBR: "#fbbf24",
  subject: "#f97316", green: "#34d399", red: "#f87171", yellow: "#fbbf24", blue: "#0ea5e9",
};

const UT_META = [
  { key: "studio",  label: "Studio", abbr: "STU", sfRange: "420–540", color: C.studio  },
  { key: "oneBR",   label: "1 BR",   abbr: "1BR", sfRange: "680–820", color: C.oneBR   },
  { key: "twoBR",   label: "2 BR",   abbr: "2BR", sfRange: "980–1150",color: C.twoBR   },
  { key: "threeBR", label: "3 BR+",  abbr: "3BR", sfRange: "1240–1400",color: C.threeBR },
];

const SIG = {
  vac:  { hot: 3, warm: 6 },
  dom:  { hot: 10, warm: 20 },
  conc: { hot: 0, warm: 2 },
};

// ─────────────────────────────────────────────────────────
//  UNIFIED DATA — units: { mix%, sf, rent, vac%, dom(days), conc(wks) }
// ─────────────────────────────────────────────────────────
const COMPS = [
  { id: "sandpiper", name: "Sandpiper Cove",  cls: "A",  built: 2021, total: 248, units: {
    studio:  { mix: 8,  sf: 525,  rent: 1310, vac: 11,  dom: 34, conc: 6 },
    oneBR:   { mix: 45, sf: 790,  rent: 1720, vac: 4.0, dom: 18, conc: 2 },
    twoBR:   { mix: 37, sf: 1110, rent: 2080, vac: 1.8, dom: 8,  conc: 0 },
    threeBR: { mix: 10, sf: 1350, rent: 2450, vac: 3.2, dom: 14, conc: 1 } } },
  { id: "avana",     name: "Avana Crossings", cls: "A",  built: 2019, total: 312, units: {
    studio:  { mix: 0,  sf: 0,    rent: 0,    vac: 0,   dom: 0,  conc: 0 },
    oneBR:   { mix: 38, sf: 762,  rent: 1690, vac: 5.2, dom: 22, conc: 3 },
    twoBR:   { mix: 52, sf: 1085, rent: 2020, vac: 2.1, dom: 9,  conc: 0 },
    threeBR: { mix: 10, sf: 1290, rent: 2380, vac: 4.4, dom: 18, conc: 2 } } },
  { id: "harbour",   name: "Harbour Pointe",  cls: "B+", built: 2017, total: 400, units: {
    studio:  { mix: 3,  sf: 510,  rent: 1240, vac: 8.0, dom: 28, conc: 4 },
    oneBR:   { mix: 35, sf: 775,  rent: 1650, vac: 6.1, dom: 24, conc: 4 },
    twoBR:   { mix: 48, sf: 1095, rent: 1960, vac: 2.9, dom: 11, conc: 1 },
    threeBR: { mix: 14, sf: 1310, rent: 2290, vac: 5.5, dom: 21, conc: 3 } } },
  { id: "enclave",   name: "The Enclave PSL", cls: "B",  built: 2014, total: 180, units: {
    studio:  { mix: 5,  sf: 490,  rent: 1170, vac: 14,  dom: 42, conc: 8 },
    oneBR:   { mix: 42, sf: 745,  rent: 1590, vac: 7.4, dom: 29, conc: 5 },
    twoBR:   { mix: 43, sf: 1055, rent: 1870, vac: 3.5, dom: 13, conc: 2 },
    threeBR: { mix: 10, sf: 1280, rent: 2180, vac: 6.8, dom: 25, conc: 4 } } },
  { id: "madera",    name: "Madera Ridge",    cls: "B",  built: 2012, total: 220, units: {
    studio:  { mix: 0,  sf: 0,    rent: 0,    vac: 0,   dom: 0,  conc: 0 },
    oneBR:   { mix: 50, sf: 755,  rent: 1560, vac: 8.8, dom: 34, conc: 6 },
    twoBR:   { mix: 40, sf: 1070, rent: 1810, vac: 4.1, dom: 16, conc: 2 },
    threeBR: { mix: 10, sf: 1260, rent: 2100, vac: 7.2, dom: 28, conc: 5 } } },
];

const TREND_DATA = {
  studio:  [
    {mo:"Apr",vac:8, dom:26,rent:1220,conc:4},{mo:"May",vac:9, dom:28,rent:1230,conc:5},
    {mo:"Jun",vac:10,dom:30,rent:1240,conc:5},{mo:"Jul",vac:11,dom:31,rent:1245,conc:6},
    {mo:"Aug",vac:12,dom:33,rent:1250,conc:6},{mo:"Sep",vac:13,dom:34,rent:1255,conc:7},
    {mo:"Oct",vac:13,dom:35,rent:1255,conc:7},{mo:"Nov",vac:14,dom:37,rent:1250,conc:7},
    {mo:"Dec",vac:14,dom:38,rent:1240,conc:8},{mo:"Jan",vac:15,dom:40,rent:1235,conc:8},
    {mo:"Feb",vac:15,dom:42,rent:1230,conc:8},{mo:"Mar",vac:16,dom:44,rent:1220,conc:9},
  ],
  oneBR: [
    {mo:"Apr",vac:7, dom:26,rent:1580,conc:4},{mo:"May",vac:7, dom:25,rent:1590,conc:4},
    {mo:"Jun",vac:6, dom:24,rent:1600,conc:3},{mo:"Jul",vac:6, dom:23,rent:1610,conc:3},
    {mo:"Aug",vac:7, dom:24,rent:1615,conc:4},{mo:"Sep",vac:7, dom:25,rent:1620,conc:4},
    {mo:"Oct",vac:7, dom:26,rent:1620,conc:4},{mo:"Nov",vac:6, dom:24,rent:1625,conc:3},
    {mo:"Dec",vac:6, dom:23,rent:1630,conc:3},{mo:"Jan",vac:6, dom:24,rent:1630,conc:3},
    {mo:"Feb",vac:6, dom:25,rent:1628,conc:3},{mo:"Mar",vac:6, dom:26,rent:1625,conc:3},
  ],
  twoBR: [
    {mo:"Apr",vac:4, dom:14,rent:1890,conc:2},{mo:"May",vac:3, dom:12,rent:1910,conc:1},
    {mo:"Jun",vac:3, dom:11,rent:1930,conc:1},{mo:"Jul",vac:2, dom:10,rent:1960,conc:1},
    {mo:"Aug",vac:2, dom:9, rent:1980,conc:0},{mo:"Sep",vac:2, dom:9, rent:1990,conc:0},
    {mo:"Oct",vac:2, dom:8, rent:2010,conc:0},{mo:"Nov",vac:2, dom:8, rent:2020,conc:0},
    {mo:"Dec",vac:1, dom:7, rent:2040,conc:0},{mo:"Jan",vac:1, dom:7, rent:2050,conc:0},
    {mo:"Feb",vac:2, dom:8, rent:2055,conc:0},{mo:"Mar",vac:2, dom:8, rent:2060,conc:0},
  ],
  threeBR: [
    {mo:"Apr",vac:6, dom:22,rent:2190,conc:3},{mo:"May",vac:6, dom:21,rent:2200,conc:3},
    {mo:"Jun",vac:5, dom:20,rent:2220,conc:2},{mo:"Jul",vac:5, dom:19,rent:2230,conc:2},
    {mo:"Aug",vac:5, dom:20,rent:2240,conc:2},{mo:"Sep",vac:4, dom:18,rent:2260,conc:2},
    {mo:"Oct",vac:5, dom:19,rent:2270,conc:2},{mo:"Nov",vac:5, dom:18,rent:2280,conc:2},
    {mo:"Dec",vac:4, dom:17,rent:2290,conc:1},{mo:"Jan",vac:5, dom:18,rent:2290,conc:2},
    {mo:"Feb",vac:5, dom:18,rent:2295,conc:2},{mo:"Mar",vac:5, dom:18,rent:2300,conc:2},
  ],
};

// ─────────────────────────────────────────────────────────
//  SEEDS
// ─────────────────────────────────────────────────────────
const ZONING_SEED = {
  zoningCode: "PUD-R / C-3", maxUnits: 280, maxNetSF: 310000,
  excludesParking: true, maxHeight: 5, maxLotCoverage: 65,
  source: "M02 · Martin County LDR §4.12.3",
  sourceUrl: "https://municode.com/library/fl/martin_county", confidence: 94,
};

const PROGRAM_SEED = {
  totalUnits: 250,
  units: {
    studio:  { mix: 5,  sf: 510,  rent: 1350 },
    oneBR:   { mix: 38, sf: 785,  rent: 1750 },
    twoBR:   { mix: 44, sf: 1100, rent: 2100 },
    threeBR: { mix: 13, sf: 1320, rent: 2480 },
  },
};

// ─────────────────────────────────────────────────────────
//  CALCULATIONS
// ─────────────────────────────────────────────────────────
function compAvg(utKey: UnitKey, comps: CompData[]) {
  const active = comps.filter(c => c.units[utKey].mix > 0);
  if (!active.length) return { mix: 0, sf: 0, rent: 0, vac: 0, dom: 0, conc: 0 };
  const avg = (fn: (c: any) => number) => active.reduce((s, c) => s + fn(c), 0) / active.length;
  return {
    mix:  avg(c => c.units[utKey].mix),
    sf:   Math.round(avg(c => c.units[utKey].sf)),
    rent: Math.round(avg(c => c.units[utKey].rent)),
    vac:  avg(c => c.units[utKey].vac),
    dom:  avg(c => c.units[utKey].dom),
    conc: avg(c => c.units[utKey].conc),
  };
}

function computeProgram(program: Program) {
  const totalSF = UT_META.reduce((s, ut) => {
    const u = program.units[ut.key];
    return s + Math.round(program.totalUnits * u.mix / 100) * u.sf;
  }, 0);
  const mixTotal  = UT_META.reduce((s, ut) => s + program.units[ut.key].mix, 0);
  const grossRevPA = UT_META.reduce((s, ut) => {
    const u = program.units[ut.key];
    return s + Math.round(program.totalUnits * u.mix / 100) * u.rent * 12 * 0.95;
  }, 0);
  return { totalSF, mixTotal, grossRevPA };
}

// Inventory: per unit-type aggregate across all comps
function computeInventory(comps: CompData[]) {
  const totalCompUnits = comps.reduce((s, c) => s + c.total, 0);
  return UT_META.map(ut => {
    const active = comps.filter(c => c.units[ut.key].mix > 0);
    const typeUnits = comps.reduce((s, c) => s + Math.round(c.total * c.units[ut.key].mix / 100), 0);
    const vacUnits  = comps.reduce((s, c) => {
      const u = Math.round(c.total * c.units[ut.key].mix / 100);
      return s + Math.round(u * (c.units[ut.key].vac || 0) / 100);
    }, 0);
    const avgVac  = typeUnits > 0 ? vacUnits / typeUnits * 100 : 0;
    const n = fn => active.length ? active.reduce((s, c) => s + fn(c), 0) / active.length : 0;
    const avgDOM  = n(c => c.units[ut.key].dom);
    const avgRent = n(c => c.units[ut.key].rent);
    const avgConc = n(c => c.units[ut.key].conc);
    const supplyShare = totalCompUnits > 0 ? typeUnits / totalCompUnits * 100 : 0;
    const vacScore  = Math.max(0, 100 - avgVac * 6);
    const domScore  = Math.max(0, 100 - avgDOM * 2);
    const concScore = Math.max(0, 100 - avgConc * 10);
    const demandScore = Math.round(vacScore * 0.4 + domScore * 0.35 + concScore * 0.25);
    return { ...ut, typeUnits, supplyShare, avgVac, avgDOM, avgRent, avgConc, demandScore };
  });
}

function computeGaps(inventory: InventoryItem[]) {
  const proxies = inventory.map(u => (100 - u.avgVac) * (1 / Math.max(1, u.avgDOM)));
  const tot = proxies.reduce((s, v) => s + v, 0) || 1;
  return inventory.map((u, i) => ({
    ...u,
    demandShare: proxies[i] / tot * 100,
    gap: proxies[i] / tot * 100 - u.supplyShare,
  }));
}

function buildScatter(program: Program, comps: CompData[]) {
  const pts = [];
  UT_META.forEach(ut => {
    const su = program.units[ut.key];
    if (su.sf > 0 && su.rent > 0)
      pts.push({ x: su.sf, y: su.rent, name: "★ Subject", unitType: ut.label,
        color: C.subject, isSubject: true, utKey: ut.key, psf: +(su.rent/su.sf).toFixed(2) });
    comps.forEach(c => {
      const cu = c.units[ut.key];
      if (cu.sf > 0 && cu.rent > 0)
        pts.push({ x: cu.sf, y: cu.rent, name: c.name, unitType: ut.label,
          color: ut.color, isSubject: false, utKey: ut.key, psf: +(cu.rent/cu.sf).toFixed(2),
          vac: cu.vac, dom: cu.dom, conc: cu.conc });
    });
  });
  return pts;
}

function demandLabel(score: number) {
  if (score >= 78) return { label: "UNDERSUPPLIED", color: C.green, bg: C.green + "18" };
  if (score >= 58) return { label: "BALANCED",      color: C.yellow, bg: C.yellow + "18" };
  return                  { label: "OVERSUPPLIED",  color: C.red,   bg: C.red + "18" };
}

function sigColor(val: number | null | undefined, key: SigKey) {
  if (val === null || val === undefined) return C.dim;
  return val <= SIG[key].hot ? C.green : val <= SIG[key].warm ? C.yellow : C.red;
}

// ─────────────────────────────────────────────────────────
//  SHARED ATOMS
// ─────────────────────────────────────────────────────────
function Tag({ label, color, size = "sm" }: { label: string; color: string; size?: string }) {
  return (
    <span style={{ background: color + "18", border: `1px solid ${color}35`, color,
      borderRadius: 3, padding: size === "xs" ? "1px 5px" : "2px 7px",
      fontSize: size === "xs" ? 9 : 10, fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Delt({ value, unit = "" }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const pos = value > 0;
  const color = Math.abs(value) < 0.5 ? C.dim : pos ? C.green : C.red;
  return (
    <span style={{ color, fontFamily: "monospace", fontSize: 10, fontWeight: 700 }}>
      {pos ? "+" : ""}{typeof value === "number" ? value.toFixed(1) : value}{unit}
    </span>
  );
}

function SecLabel({ mod, title, sub }: { mod: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
        <span style={{ color: C.blue, fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>{mod}</span>
        <span style={{ color: C.border }}>·</span>
        <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{title}</span>
      </div>
      {sub && <p style={{ color: C.dim, fontSize: 11, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 1, width = 60, suffix = "", accent }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; width?: number; suffix?: string; accent?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3,
      background: accent ? C.subject + "14" : C.faint,
      border: `1px solid ${accent ? C.subject + "55" : C.border}`, borderRadius: 5, padding: "3px 8px" }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width, background: "none", border: "none", outline: "none",
          color: accent ? C.subject : C.text, fontFamily: "monospace", fontSize: 13,
          fontWeight: 700, textAlign: "right" }} />
      {suffix && <span style={{ color: C.dim, fontSize: 11 }}>{suffix}</span>}
    </div>
  );
}

function GapBar({ gap, max = 15 }: { gap: number; max?: number }) {
  const clamped = Math.min(Math.abs(gap), max);
  const pct = clamped / max * 100;
  const color = gap > 3 ? C.green : gap < -3 ? C.red : C.yellow;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 100, height: 6, background: C.muted, borderRadius: 3, position: "relative" }}>
        <div style={{ position: "absolute", [gap >= 0 ? "left" : "right"]: "50%",
          width: `${pct / 2}%`, height: "100%", background: color, borderRadius: 3 }} />
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: C.faint }} />
      </div>
      <span style={{ color, fontFamily: "monospace", fontSize: 11, fontWeight: 700, minWidth: 48 }}>
        {gap > 0 ? "+" : ""}{gap.toFixed(1)}pp
      </span>
    </div>
  );
}

function MiniLine({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a1827", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ color: C.dim, fontSize: 10, fontFamily: "monospace", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text, fontSize: 11, fontFamily: "monospace" }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

function ScatterDot({ cx, cy, payload }: any) {
  if (cx === undefined) return null;
  return <circle cx={cx} cy={cy} r={payload.isSubject ? 7 : 5} fill={payload.color}
    fillOpacity={payload.isSubject ? 1 : 0.65}
    stroke={payload.isSubject ? "#fff" : "none"} strokeWidth={2} />;
}

function ScatterTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: "#0a1827", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ color: d.color, fontFamily: "monospace", fontSize: 10, fontWeight: 700, marginBottom: 5 }}>
        {d.unitType} · {d.name}
      </div>
      <div style={{ color: C.text, fontSize: 12 }}>
        {d.x.toLocaleString()} SF → <span style={{ color: C.green, fontWeight: 700 }}>${d.y.toLocaleString()}/mo</span>
      </div>
      <div style={{ color: C.dim, fontSize: 11 }}>${d.psf}/SF</div>
      {d.vac != null && <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>Vac {d.vac}% · DOM {d.dom}d · Conc {d.conc}wk</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 1A — DEMAND MATRIX (4 score cards)
// ─────────────────────────────────────────────────────────
function DemandMatrix({ inventory, trendData }: { inventory: InventoryItem[]; trendData: typeof TREND_DATA }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <SecLabel mod="M05 · M07" title="Demand by Unit Type"
          sub="Vacancy · Days on Market · Concessions averaged across all trade area comps" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.border }}>
        {inventory.map(u => {
          const dl = demandLabel(u.demandScore);
          const trend = trendData[u.key];
          const vacDelta = trend.length >= 12 ? trend[11].vac - trend[0].vac : 0;
          const rentDelta = trend.length >= 12 ? trend[11].rent - trend[0].rent : 0;
          return (
            <div key={u.key} style={{ background: C.card, padding: "18px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ color: u.color, fontFamily: "monospace", fontSize: 10,
                    fontWeight: 700, letterSpacing: "0.1em", marginBottom: 2 }}>{u.label.toUpperCase()}</div>
                  <div style={{ color: C.dim, fontSize: 10 }}>{u.sfRange} SF</div>
                </div>
                <Tag label={dl.label} color={dl.color} />
              </div>

              {/* Score ring */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                  <svg width="48" height="48" viewBox="0 0 48 48">
                    <circle cx="24" cy="24" r="18" fill="none" stroke={C.faint} strokeWidth="4" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke={dl.color} strokeWidth="4"
                      strokeDasharray={`${u.demandScore * 1.131} 113.1`}
                      strokeLinecap="round" transform="rotate(-90 24 24)" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                    justifyContent: "center", color: dl.color, fontFamily: "monospace",
                    fontSize: 11, fontWeight: 700 }}>{u.demandScore}</div>
                </div>
                <div style={{ color: C.faint, fontSize: 10, lineHeight: 1.5 }}>
                  Demand Score<br />vac × DOM × conc
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Vacancy",    val: u.avgVac.toFixed(1),  unit: "%",  sig: "vac",
                    delta: vacDelta, dUnit: "pp" },
                  { label: "DOM",        val: u.avgDOM.toFixed(0),   unit: "d",  sig: "dom" },
                  { label: "Concessions",val: u.avgConc.toFixed(1), unit: "wk", sig: "conc" },
                ].map(m => (
                  <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: C.dim, fontSize: 11 }}>{m.label}</span>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{ color: sigColor(parseFloat(m.val), m.sig),
                        fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                        {m.val}{m.unit}
                      </span>
                      {m.delta !== undefined && (
                        <span style={{ color: m.delta > 0 ? C.red : C.green, fontFamily: "monospace", fontSize: 10 }}>
                          {m.delta > 0 ? "▲" : "▼"}{Math.abs(m.delta).toFixed(1)}{m.dUnit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  paddingTop: 8, borderTop: `1px solid ${C.faint}` }}>
                  <span style={{ color: C.dim, fontSize: 11 }}>Avg Rent</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: C.text, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
                      ${u.avgRent.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </span>
                    <span style={{ color: rentDelta > 0 ? C.green : C.red, fontFamily: "monospace", fontSize: 10 }}>
                      {rentDelta > 0 ? "+" : ""}${rentDelta}
                    </span>
                  </div>
                </div>
              </div>

              {/* 12-mo vacancy sparkline */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.faint}` }}>
                <div style={{ color: C.faint, fontSize: 8, fontFamily: "monospace", marginBottom: 3 }}>
                  12-MO VACANCY
                </div>
                <MiniLine data={trendData[u.key]} dataKey="vac" color={u.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 1B — GAP ANALYSIS
// ─────────────────────────────────────────────────────────
function GapAnalysis({ gaps }: { gaps: GapItem[] }) {
  const chartData = gaps.map(g => ({
    name: g.label, supply: +g.supplyShare.toFixed(1), demand: +g.demandShare.toFixed(1), color: g.color,
  }));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <SecLabel mod="DERIVED" title="Supply / Demand Gap"
          sub="Demand share (vacancy × DOM proxy) vs inventory share. Positive = undersupplied." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.border }}>
        {/* Bar chart */}
        <div style={{ background: C.card, padding: "18px 20px" }}>
          <div style={{ color: C.faint, fontSize: 9, fontFamily: "monospace", marginBottom: 12 }}>
            SUPPLY % vs DEMAND % — TRADE AREA
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.faint, fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="supply" name="Supply %" radius={[3,3,0,0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color + "40"} />)}
              </Bar>
              <Bar dataKey="demand" name="Demand %" radius={[3,3,0,0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, background: C.muted, borderRadius: 2 }} />
              <span style={{ color: C.dim, fontSize: 11 }}>Supply %</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, background: C.twoBR, borderRadius: 2 }} />
              <span style={{ color: C.dim, fontSize: 11 }}>Demand %</span>
            </div>
          </div>
        </div>

        {/* Gap table */}
        <div style={{ background: "#060f1a", padding: "18px 20px" }}>
          <div style={{ color: C.faint, fontSize: 9, fontFamily: "monospace", marginBottom: 14 }}>
            GAP — DEMAND MINUS SUPPLY
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {gaps.map(g => {
              const dl = demandLabel(g.demandScore);
              return (
                <div key={g.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                      <div style={{ width: 8, height: 8, background: g.color, borderRadius: 2 }} />
                      <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                      <Tag label={dl.label} color={dl.color} size="xs" />
                    </div>
                    <span style={{ color: C.dim, fontSize: 10, fontFamily: "monospace" }}>
                      S: {g.supplyShare.toFixed(1)}% · D: <span style={{ color: g.color }}>{g.demandShare.toFixed(1)}%</span>
                    </span>
                  </div>
                  <GapBar gap={g.gap} />
                </div>
              );
            })}
          </div>

          {/* Interpretation */}
          <div style={{ marginTop: 18, padding: 12, background: C.card, borderRadius: 8,
            border: `1px solid ${C.border}` }}>
            <div style={{ color: C.faint, fontSize: 8, fontFamily: "monospace", marginBottom: 8 }}>INTERPRETATION</div>
            {gaps.filter(g => Math.abs(g.gap) > 3).sort((a, b) => b.gap - a.gap).map(g => (
              <div key={g.key} style={{ display: "flex", gap: 7, marginBottom: 7, alignItems: "flex-start" }}>
                <span style={{ color: g.gap > 0 ? C.green : C.red, fontFamily: "monospace", fontSize: 11, flexShrink: 0 }}>
                  {g.gap > 0 ? "▲" : "▼"}
                </span>
                <span style={{ color: C.dim, fontSize: 11, lineHeight: 1.5 }}>
                  <span style={{ color: g.color, fontWeight: 700 }}>{g.label}</span>
                  {g.gap > 0
                    ? ` undersupplied by ${g.gap.toFixed(1)}pp — fast lease velocity, low vacancy, minimal concessions.`
                    : ` oversupplied by ${Math.abs(g.gap).toFixed(1)}pp — slow leasing, landlords conceding.`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 2 — ZONING PANEL (M02)
// ─────────────────────────────────────────────────────────
function ZoningPanel({ zoning, program, computed, onZoningChange }: { zoning: ZoningData; program: Program; computed: any; onZoningChange: (z: ZoningData) => void }) {
  const sfUtil   = computed.totalSF / zoning.maxNetSF * 100;
  const unitUtil = program.totalUnits / zoning.maxUnits * 100;
  const sfOver   = computed.totalSF > zoning.maxNetSF;
  const unitOver = program.totalUnits > zoning.maxUnits;

  const fields = [
    { label: "Max Units", key: "maxUnits", val: zoning.maxUnits, your: program.totalUnits,
      util: unitUtil, over: unitOver, color: unitOver ? C.red : unitUtil > 88 ? C.yellow : C.green,
      suffix: "units", w: 60, note: "Zoned acres × max DU/acre" },
    { label: "Max Net SF", key: "maxNetSF", val: zoning.maxNetSF, your: computed.totalSF,
      util: sfUtil, over: sfOver, color: sfOver ? C.red : sfUtil > 88 ? C.yellow : C.green,
      suffix: "SF", w: 86, note: zoning.excludesParking ? "Excl. parking & mechanical" : "All enclosed SF" },
    { label: "Max Height",  key: "maxHeight",      val: zoning.maxHeight,      your: null, util: null, suffix: "fl", w: 44, note: "Per LDR §4.12.3" },
    { label: "Lot Coverage",key: "maxLotCoverage", val: zoning.maxLotCoverage, your: null, util: null, suffix: "%",  w: 44, note: "Footprint / lot area" },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${sfOver || unitOver ? C.red + "60" : C.border}`,
      borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: C.blue, fontFamily: "monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em" }}>M02</span>
          <span style={{ color: C.border }}>·</span>
          <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>Zoning Constraints</span>
          <Tag label={zoning.zoningCode} color={C.blue} size="xs" />
          <Tag label={`${zoning.confidence}% CONF`} color={C.green} size="xs" />
          {zoning.excludesParking && <Tag label="SF EXCL. PARKING" color={C.yellow} size="xs" />}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(sfOver || unitOver) && <Tag label="⚠ EXCEEDED" color={C.red} />}
          <a href={zoning.sourceUrl} style={{ color: C.blue, fontSize: 10, textDecoration: "none" }}>
            {zoning.source} ↗
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.border }}>
        {fields.map(f => (
          <div key={f.key} style={{ background: C.card, padding: "14px 18px" }}>
            <div style={{ color: C.dim, fontSize: 10, marginBottom: 10 }}>{f.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
              <div>
                <div style={{ color: C.faint, fontSize: 8, fontFamily: "monospace", marginBottom: 4 }}>ALLOWED</div>
                <NumInput value={f.val} min={1} max={9999999} width={f.w} suffix={f.suffix}
                  onChange={v => onZoningChange({ ...zoning, [f.key]: v })} />
              </div>
              {f.your !== null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.faint, fontSize: 8, fontFamily: "monospace", marginBottom: 4 }}>YOUR PROGRAM</div>
                  <div style={{ color: f.over ? C.red : C.text, fontFamily: "monospace",
                    fontSize: 13, fontWeight: 700 }}>
                    {Math.round(f.your).toLocaleString()}
                    <span style={{ color: C.dim, fontSize: 10, marginLeft: 3 }}>{f.suffix}</span>
                  </div>
                </div>
              )}
            </div>
            {f.util !== null && (
              <>
                <div style={{ height: 4, background: C.muted, borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ width: `${Math.min(100, f.util)}%`, height: "100%",
                    background: f.color, borderRadius: 2, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: f.color, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                    {f.util.toFixed(1)}%
                  </span>
                  {f.over && <span style={{ color: C.red, fontSize: 10, fontWeight: 700 }}>OVER</span>}
                </div>
              </>
            )}
            <div style={{ color: C.faint, fontSize: 9, marginTop: 7 }}>{f.note}</div>
          </div>
        ))}
      </div>

      {!sfOver && !unitOver && (
        <div style={{ padding: "8px 20px", background: "#040c17",
          display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: C.faint, fontSize: 9, fontFamily: "monospace" }}>REMAINING:</span>
          <span style={{ color: C.green, fontFamily: "monospace", fontSize: 11 }}>
            {(zoning.maxNetSF - computed.totalSF).toLocaleString()} SF unused
          </span>
          <span style={{ color: C.green, fontFamily: "monospace", fontSize: 11 }}>
            {zoning.maxUnits - program.totalUnits} unit headroom
          </span>
          <span style={{ color: C.dim, fontSize: 10 }}>
            → ~{Math.floor((zoning.maxNetSF - computed.totalSF) / (computed.totalSF / program.totalUnits))} more avg-sized units fit
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 2 — PROGRAM EDITOR
// ─────────────────────────────────────────────────────────
function ProgramEditor({ program, computed, zoning, onProgramChange, comps }: { program: Program; computed: any; zoning: ZoningData; onProgramChange: (p: Program) => void; comps: CompData[] }) {
  const { totalSF, mixTotal, grossRevPA } = computed;
  const mixOk = Math.abs(mixTotal - 100) < 1;

  function setUnit(utKey: UnitKey, field: string, val: number) {
    onProgramChange({ ...program, units: { ...program.units, [utKey]: { ...program.units[utKey], [field]: val } } });
  }

  function applyCompAvgs() {
    const units = {};
    UT_META.forEach(ut => {
      const avg = compAvg(ut.key, comps);
      units[ut.key] = { mix: Math.round(avg.mix) || program.units[ut.key].mix, sf: avg.sf || program.units[ut.key].sf, rent: avg.rent || program.units[ut.key].rent };
    });
    onProgramChange({ ...program, units });
  }

  const gridTpl = "96px 90px 76px 100px 80px 100px 80px 68px 100px";

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SecLabel mod="PROGRAM EDITOR" title="Unit Program"
          sub="Edit mix %, unit SF, and target rent. All views update live." />
        <div style={{ display: "flex", gap: 8 }}>
          {!mixOk && <Tag label={`MIX = ${mixTotal}% ≠ 100`} color={C.red} />}
          <button onClick={applyCompAvgs} style={{ background: "none", border: `1px solid ${C.border}`,
            borderRadius: 6, padding: "4px 11px", color: C.dim, fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>
            ↓ Comp Avgs
          </button>
          <button onClick={() => onProgramChange(PROGRAM_SEED)} style={{ background: "none",
            border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 11px",
            color: C.dim, fontSize: 10, fontFamily: "monospace", cursor: "pointer" }}>↺ Reset</button>
        </div>
      </div>

      {/* Totals bar */}
      <div style={{ padding: "9px 20px", background: "#060f1a", borderBottom: `1px solid ${C.border}`,
        display: "flex", gap: 20, alignItems: "center" }}>
        <span style={{ color: C.dim, fontSize: 12 }}>Total Units</span>
        <NumInput value={program.totalUnits} min={10} max={zoning.maxUnits} suffix="units" width={52} accent
          onChange={v => onProgramChange({ ...program, totalUnits: v })} />
        <span style={{ color: C.faint, fontSize: 11 }}>
          of <span style={{ color: C.blue, fontFamily: "monospace" }}>{zoning.maxUnits}</span> max (M02)
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          <span style={{ color: C.dim, fontSize: 11 }}>
            Net SF: <span style={{ color: totalSF > zoning.maxNetSF ? C.red : C.text,
              fontFamily: "monospace", fontWeight: 700 }}>{totalSF.toLocaleString()}</span>
            <span style={{ color: C.faint }}> / {zoning.maxNetSF.toLocaleString()}</span>
          </span>
          <span style={{ color: C.dim, fontSize: 11 }}>
            Rev: <span style={{ color: C.green, fontFamily: "monospace", fontWeight: 700 }}>${(grossRevPA/1e6).toFixed(2)}M/yr</span>
          </span>
        </div>
      </div>

      {/* Col headers */}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "7px 20px",
        background: "#060f1a", borderBottom: `1px solid ${C.border}`, gap: 0 }}>
        {["Type","Mix %","Count","Unit SF","vs Avg SF","Rent/mo","vs Avg Rent","Rent/SF","Annual Rev"].map((h, i) => (
          <div key={i} style={{ color: C.faint, fontSize: 9, fontFamily: "monospace",
            letterSpacing: "0.06em", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
        ))}
      </div>

      {UT_META.map((ut, ri) => {
        const u = program.units[ut.key];
        const avg = compAvg(ut.key, comps);
        const count = Math.round(program.totalUnits * u.mix / 100);
        const psf = u.sf ? +(u.rent / u.sf).toFixed(2) : 0;
        const annRev = count * u.rent * 12 * 0.95;
        return (
          <div key={ut.key} style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "10px 20px",
            borderBottom: `1px solid ${C.border}`, background: ri % 2 === 0 ? "transparent" : "#060f1a0a",
            alignItems: "center", gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, background: ut.color, borderRadius: 2 }} />
              <span style={{ color: ut.color, fontSize: 12, fontWeight: 700 }}>{ut.label}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <NumInput value={u.mix} min={0} max={100} suffix="%" width={36} accent onChange={v => setUnit(ut.key,"mix",v)} />
              {avg.mix > 0 && <Delt value={u.mix - avg.mix} unit="pp" />}
            </div>
            <div style={{ textAlign: "right", color: C.dim, fontFamily: "monospace", fontSize: 12 }}>{count}</div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <NumInput value={u.sf} min={200} max={3000} step={5} suffix="SF" width={52} accent onChange={v => setUnit(ut.key,"sf",v)} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.faint, fontFamily: "monospace", fontSize: 10 }}>{avg.sf||"—"}</div>
              {avg.sf > 0 && <Delt value={u.sf - avg.sf} unit=" SF" />}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <NumInput value={u.rent} min={500} max={10000} step={10} suffix="$" width={52} accent onChange={v => setUnit(ut.key,"rent",v)} />
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.faint, fontFamily: "monospace", fontSize: 10 }}>{avg.rent ? `$${avg.rent}` : "—"}</div>
              {avg.rent > 0 && <Delt value={u.rent - avg.rent} unit="$" />}
            </div>
            <div style={{ textAlign: "right", color: C.text, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>${psf}</div>
            <div style={{ textAlign: "right", color: C.green, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
              ${(annRev/1000).toFixed(0)}K
            </div>
          </div>
        );
      })}

      {/* Totals row */}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "10px 20px",
        background: "#060f1a", borderTop: `2px solid ${C.border}`, alignItems: "center", gap: 0 }}>
        <div style={{ color: C.dim, fontSize: 11, fontWeight: 700 }}>TOTAL</div>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: mixOk ? C.green : C.red, fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>{mixTotal}%</span>
        </div>
        <div style={{ textAlign: "right", color: C.text, fontFamily: "monospace", fontWeight: 700 }}>{program.totalUnits}</div>
        <div style={{ textAlign: "right", color: C.dim, fontFamily: "monospace", fontSize: 10 }}>
          {Math.round(totalSF/program.totalUnits).toLocaleString()} avg
        </div>
        <div /><div /><div /><div />
        <div style={{ textAlign: "right", color: C.green, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          ${(grossRevPA/1e6).toFixed(2)}M
        </div>
      </div>

      {/* SF envelope */}
      <div style={{ padding: "8px 20px", background: "#040c17", borderTop: `1px solid ${C.border}`,
        display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ color: C.faint, fontSize: 9, fontFamily: "monospace" }}>SF ENVELOPE:</span>
        <span style={{ color: C.text, fontFamily: "monospace", fontSize: 11 }}>
          {totalSF.toLocaleString()} of {zoning.maxNetSF.toLocaleString()} allowed
        </span>
        {totalSF > zoning.maxNetSF
          ? <Tag label={`OVER BY ${(totalSF-zoning.maxNetSF).toLocaleString()} SF`} color={C.red} />
          : <Tag label={`${(zoning.maxNetSF-totalSF).toLocaleString()} SF remaining`} color={C.green} size="xs" />}
        <span style={{ color: C.faint, fontSize: 9, marginLeft: "auto" }}>
          {zoning.excludesParking ? "Excl. parking per M02" : "All enclosed SF"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 3A — INVENTORY SNAPSHOT
// ─────────────────────────────────────────────────────────
function InventorySnapshot({ inventory, comps }: { inventory: InventoryItem[]; comps: CompData[] }) {
  const total = inventory.reduce((s, u) => s + u.typeUnits, 0);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <SecLabel mod="M05" title="Submarket Unit Inventory" sub="Total tracked units by type across trade area comps" />
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.faint, fontSize: 9, fontFamily: "monospace" }}>TOTAL TRACKED</div>
          <div style={{ color: C.text, fontSize: 18, fontFamily: "monospace", fontWeight: 700 }}>{total.toLocaleString()} units</div>
        </div>
      </div>
      {/* Stacked bar */}
      <div style={{ padding: "14px 20px 10px" }}>
        <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 10 }}>
          {inventory.map(u => (
            <div key={u.key} style={{ flex: u.supplyShare, background: u.color + "cc",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>
              {u.supplyShare > 8 ? `${u.supplyShare.toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {inventory.map(u => (
            <div key={u.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, background: u.color, borderRadius: 2 }} />
              <span style={{ color: C.dim, fontSize: 11 }}>{u.label}</span>
              <span style={{ color: C.text, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{u.typeUnits}u</span>
              <span style={{ color: C.faint, fontSize: 10 }}>({u.supplyShare.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
      {/* Property table */}
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 48px repeat(5,1fr)", padding: "7px 20px",
          background: "#060f1a", borderBottom: `1px solid ${C.border}` }}>
          {["Property","Cls","Studio","1 BR","2 BR","3 BR+","Units"].map((h, i) => (
            <div key={i} style={{ color: C.faint, fontSize: 9, fontFamily: "monospace",
              textAlign: i > 1 ? "right" : "left" }}>{h}</div>
          ))}
        </div>
        {[...comps].map((c, i) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "160px 48px repeat(5,1fr)",
            padding: "9px 20px", borderBottom: `1px solid ${C.border}`,
            background: i % 2 === 0 ? "transparent" : "#060f1a0a" }}>
            <div style={{ color: C.text, fontSize: 12 }}>{c.name}</div>
            <div style={{ color: C.dim, fontSize: 11 }}>{c.cls}</div>
            {UT_META.map(ut => {
              const pct = c.units[ut.key].mix;
              return (
                <div key={ut.key} style={{ textAlign: "right" }}>
                  <span style={{ color: pct > 0 ? ut.color : C.faint, fontFamily: "monospace",
                    fontSize: 12, fontWeight: 600 }}>{pct > 0 ? `${pct}%` : "—"}</span>
                </div>
              );
            })}
            <div style={{ textAlign: "right", color: C.dim, fontFamily: "monospace", fontSize: 11 }}>{c.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 3B — PROPERTY DRILL-DOWN
// ─────────────────────────────────────────────────────────
function PropertyDrillDown({ selectedType, onSelect, comps }: { selectedType: UnitKey; onSelect: (k: UnitKey) => void; comps: CompData[] }) {
  const ut = UT_META.find(u => u.key === selectedType);
  const rows = comps.filter(c => c.units[selectedType].mix > 0)
    .sort((a, b) => a.units[selectedType].vac - b.units[selectedType].vac);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SecLabel mod="M15" title={`Property Drill-Down — ${ut.label}`}
          sub="Sorted by vacancy (lowest = tightest demand). HOT/WARM/SOFT signal." />
        <div style={{ display: "flex", gap: 5 }}>
          {UT_META.map(u => (
            <button key={u.key} onClick={() => onSelect(u.key)} style={{
              background: selectedType === u.key ? u.color + "20" : "transparent",
              border: `1px solid ${selectedType === u.key ? u.color : C.border}`,
              borderRadius: 5, padding: "4px 10px",
              color: selectedType === u.key ? u.color : C.dim,
              fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer",
            }}>{u.abbr}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 72px 90px 86px 90px 86px",
        padding: "7px 20px", background: "#060f1a", borderBottom: `1px solid ${C.border}` }}>
        {["Property","Cls","Mix %","Vacancy","DOM","Concessions","Avg Rent"].map((h, i) => (
          <div key={i} style={{ color: C.faint, fontSize: 9, fontFamily: "monospace",
            textAlign: i > 0 ? "right" : "left" }}>{h}</div>
        ))}
      </div>

      {rows.map((c, i) => {
        const u = c.units[selectedType];
        const sig = u.vac <= SIG.vac.hot ? "🟢" : u.vac <= SIG.vac.warm ? "🟡" : "🔴";
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 56px 72px 90px 86px 90px 86px",
            padding: "10px 20px", borderBottom: `1px solid ${C.border}`,
            background: i % 2 === 0 ? "transparent" : "#060f1a0a", alignItems: "center" }}>
            <div style={{ color: C.text, fontSize: 12 }}>{sig} {c.name}</div>
            <div style={{ textAlign: "right", color: C.dim, fontSize: 11 }}>{c.cls}</div>
            <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace",
              fontSize: 12, fontWeight: 700 }}>{u.mix}%</div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.vac, "vac"), fontFamily: "monospace",
                fontSize: 12, fontWeight: 700 }}>{u.vac}%</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.dom, "dom"), fontFamily: "monospace",
                fontSize: 12, fontWeight: 700 }}>{u.dom}d</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.conc, "conc"), fontFamily: "monospace",
                fontSize: 12, fontWeight: 700 }}>{u.conc}wk</span>
            </div>
            <div style={{ textAlign: "right", color: C.text, fontFamily: "monospace",
              fontSize: 12, fontWeight: 700 }}>${u.rent.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ padding: "9px 20px", background: "#060f1a" }}>
        <span style={{ color: C.faint, fontSize: 9, fontFamily: "monospace" }}>
          🟢 HOT (vac ≤3%, DOM ≤10d) &nbsp; 🟡 WARM (vac ≤6%, DOM ≤20d) &nbsp; 🔴 SOFT (vac &gt;6%, DOM &gt;20d)
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 4 — TREND DETAIL (12-month charts)
// ─────────────────────────────────────────────────────────
function TrendDetail({ selectedType, onSelect, trendData }: { selectedType: UnitKey; onSelect: (k: UnitKey) => void; trendData: typeof TREND_DATA }) {
  const ut = UT_META.find(u => u.key === selectedType);
  const data = trendData[selectedType];
  const metrics = [
    { key: "vac",  label: "Vacancy %",            color: C.red,    fmt: (v: number) => `${v}%`  },
    { key: "dom",  label: "Days on Market",        color: C.yellow, fmt: (v: number) => `${v}d`  },
    { key: "rent", label: "Avg Rent",              color: C.green,  fmt: (v: number) => `$${v}`  },
    { key: "conc", label: "Concessions (wks free)",color: C.studio, fmt: (v: number) => `${v}wk` },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SecLabel mod="M05" title="12-Month Demand Trends"
          sub="Submarket averages across trade area comps. Direction matters as much as current value." />
        <div style={{ display: "flex", gap: 5 }}>
          {UT_META.map(u => (
            <button key={u.key} onClick={() => onSelect(u.key)} style={{
              background: selectedType === u.key ? u.color + "20" : "transparent",
              border: `1px solid ${selectedType === u.key ? u.color : C.border}`,
              borderRadius: 6, padding: "4px 11px",
              color: selectedType === u.key ? u.color : C.dim,
              fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer",
            }}>{u.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {metrics.map(m => {
          const first = data[0][m.key], last = data[data.length-1][m.key];
          const delta = last - first;
          const good = m.key === "rent" ? delta > 0 : delta < 0;
          return (
            <div key={m.key} style={{ background: "#060f1a", borderRadius: 8, padding: 14,
              border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: C.dim, fontSize: 11 }}>{m.label}</span>
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: m.color, fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
                    {m.fmt(last)}
                  </span>
                  <span style={{ color: good ? C.green : C.red, fontFamily: "monospace",
                    fontSize: 10, marginLeft: 8 }}>
                    {delta > 0 ? "+" : ""}{m.key === "rent" ? `$${delta}` : m.key === "vac" ? `${delta}pp` : delta}
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={64}>
                <LineChart data={data}>
                  <XAxis dataKey="mo" tick={{ fill: C.faint, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color}
                    strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 5A — MIX MATRIX
// ─────────────────────────────────────────────────────────
function MixMatrix({ program, comps }: { program: Program; comps: CompData[] }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
        <SecLabel mod="M05 · M15" title="Mix Matrix — Program vs Comp Set"
          sub="Your proposed allocation vs every comp. Comp Average anchored at bottom." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "180px 56px repeat(4,1fr)", gap: 8,
        padding: "7px 20px", background: "#060f1a", borderBottom: `1px solid ${C.border}` }}>
        {["PROPERTY","CLS",...UT_META.map(ut => ut.abbr)].map((h, i) => (
          <div key={i} style={{ color: i > 1 ? UT_META[i-2].color : C.faint, fontSize: 9,
            fontFamily: "monospace", fontWeight: 700, textAlign: i > 1 ? "right" : "left" }}>{h}</div>
        ))}
      </div>
      {/* Subject */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 56px repeat(4,1fr)", gap: 8,
        padding: "10px 20px", background: "#f9731606",
        borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.subject}` }}>
        <div>
          <div style={{ color: C.subject, fontSize: 12, fontWeight: 700 }}>★ Subject Property</div>
          <div style={{ color: C.faint, fontSize: 10 }}>{program.totalUnits}u · Proposed</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Tag label="A" color={C.green} size="xs" />
        </div>
        {UT_META.map(ut => {
          const pct = program.units[ut.key].mix;
          const avg = compAvg(ut.key, comps);
          return (
            <div key={ut.key} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <span style={{ color: C.subject, fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>{pct}%</span>
                {avg.mix > 0 && <Delt value={pct - avg.mix} unit="pp" />}
              </div>
              <div style={{ width: 52, height: 3, background: C.muted, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct * 2.1)}%`, height: "100%", background: C.subject, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
      {comps.map((c, ri) => (
        <div key={c.id} style={{ display: "grid", gridTemplateColumns: "180px 56px repeat(4,1fr)", gap: 8,
          padding: "10px 20px", borderBottom: `1px solid ${C.border}`,
          background: ri % 2 === 0 ? "transparent" : "#060f1a50",
          borderLeft: "3px solid transparent" }}>
          <div>
            <div style={{ color: C.text, fontSize: 12 }}>{c.name}</div>
            <div style={{ color: C.faint, fontSize: 10 }}>{c.total}u · {c.built}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag label={c.cls} color={c.cls==="A"?C.green:c.cls==="B+"?C.yellow:C.dim} size="xs" />
          </div>
          {UT_META.map(ut => {
            const pct = c.units[ut.key].mix;
            return (
              <div key={ut.key} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <span style={{ color: pct===0?C.faint:C.text, fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>
                  {pct > 0 ? `${pct}%` : "—"}
                </span>
                <div style={{ width: 52, height: 3, background: C.muted, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, pct * 2.1)}%`, height: "100%", background: ut.color + "70", borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "180px 56px repeat(4,1fr)", gap: 8,
        padding: "10px 20px", background: "#060f1a", borderTop: `2px solid ${C.border}` }}>
        <div style={{ color: C.dim, fontSize: 12, fontWeight: 700 }}>Comp Average</div>
        <div />
        {UT_META.map(ut => (
          <div key={ut.key} style={{ textAlign: "right", color: ut.color,
            fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
            {compAvg(ut.key, comps).mix.toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 5B — RENT × SF SCATTER
// ─────────────────────────────────────────────────────────
function RentSFScatter({ program, filterUT, setFilterUT, comps }: { program: Program; filterUT: string; setFilterUT: (v: string) => void; comps: CompData[] }) {
  const all = buildScatter(program, comps);
  const pts = filterUT === "all" ? all : all.filter(p => p.utKey === filterUT);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SecLabel mod="M05 · M15" title="Rent vs Unit Size"
          sub="Orange = your program (updates live). Dot above the cluster = premium extraction." />
        <div style={{ display: "flex", gap: 5 }}>
          {[{key:"all",label:"All",color:C.dim},...UT_META].map(ut => (
            <button key={ut.key} onClick={() => setFilterUT(ut.key)} style={{
              background: filterUT===ut.key ? (ut.color||C.dim)+"22" : "transparent",
              border: `1px solid ${filterUT===ut.key ? (ut.color||C.dim) : C.border}`,
              borderRadius: 5, padding: "4px 10px",
              color: filterUT===ut.key ? (ut.color||C.text) : C.faint,
              fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer",
            }}>{ut.label||"All"}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <ResponsiveContainer width="100%" height={270}>
          <ScatterChart margin={{ top: 8, right: 20, bottom: 22, left: 10 }}>
            <CartesianGrid stroke={C.faint} strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis type="number" dataKey="x" name="SF" domain={["dataMin - 60","dataMax + 60"]}
              tick={{ fill: C.dim, fontSize: 10 }} tickLine={false} axisLine={{ stroke: C.muted }}
              label={{ value: "Unit SF", position: "insideBottom", offset: -12, fill: C.faint, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Rent" domain={[1000,"dataMax + 200"]}
              tick={{ fill: C.dim, fontSize: 10 }} tickLine={false} axisLine={{ stroke: C.muted }}
              tickFormatter={v => `$${(v/1000).toFixed(1)}k`}
              label={{ value: "Rent/mo", angle: -90, position: "insideLeft", offset: 15, fill: C.faint, fontSize: 11 }} />
            <ZAxis range={[40,40]} />
            <Tooltip content={<ScatterTip />} />
            {UT_META.map(ut => {
              const d = pts.filter(p => p.utKey===ut.key && !p.isSubject);
              return d.length ? <Scatter key={ut.key} data={d} shape={<ScatterDot />} /> : null;
            })}
            <Scatter data={pts.filter(p => p.isSubject)} shape={<ScatterDot />} />
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {UT_META.map(ut => (
            <div key={ut.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: ut.color, opacity: 0.7 }} />
              <span style={{ color: C.dim, fontSize: 11 }}>{ut.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.subject,
              border: "2px solid white", boxSizing: "border-box" }} />
            <span style={{ color: C.subject, fontSize: 11, fontWeight: 700 }}>Your Program</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  TAB 5C — COMP DETAIL TABLE
// ─────────────────────────────────────────────────────────
function CompTable({ program, utKey, setUtKey, comps }: { program: Program; utKey: UnitKey; setUtKey: (k: UnitKey) => void; comps: CompData[] }) {
  const ut  = UT_META.find(u => u.key === utKey) || UT_META[1];
  const su  = program.units[ut.key];
  const avg = compAvg(ut.key, comps);
  const gridTpl = "1fr 56px 88px 94px 68px 72px 72px 68px 90px";

  function PosTags({ rent }: { rent: number }) {
    if (!rent || !avg.rent) return <span style={{ color: C.faint }}>—</span>;
    const pct = (rent - avg.rent) / avg.rent * 100;
    const color = pct > 3 ? C.green : pct < -3 ? C.red : C.yellow;
    return (
      <div style={{ textAlign: "right" }}>
        <Tag label={pct > 3 ? "PREMIUM" : pct < -3 ? "DISCOUNT" : "AT MKT"} color={color} size="xs" />
        <div style={{ color, fontFamily: "monospace", fontSize: 10, marginTop: 2 }}>
          {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SecLabel mod="M05 · M15 · M07" title={`Comp Detail — ${ut.label}`}
          sub="Subject row = your live program. Deltas vs comp average shown in small text." />
        <div style={{ display: "flex", gap: 5 }}>
          {UT_META.map(u => (
            <button key={u.key} onClick={() => setUtKey(u.key)} style={{
              background: utKey===u.key ? u.color+"20" : "transparent",
              border: `1px solid ${utKey===u.key ? u.color : C.border}`,
              borderRadius: 5, padding: "4px 10px", color: utKey===u.key ? u.color : C.faint,
              fontSize: 10, fontFamily: "monospace", fontWeight: 700, cursor: "pointer",
            }}>{u.abbr}</button>
          ))}
        </div>
      </div>

      {/* Headers */}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 10, padding: "7px 20px",
        background: "#060f1a", borderBottom: `1px solid ${C.border}` }}>
        {["Property","Mix","Unit SF","Rent/mo","Rent/SF","Vacancy","DOM","Conc","Position"].map((h, i) => (
          <div key={i} style={{ color: C.faint, fontSize: 9, fontFamily: "monospace",
            textAlign: i === 0 ? "left" : "right" }}>{h}</div>
        ))}
      </div>

      {/* Subject */}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 10, padding: "11px 20px",
        background: "#f9731606", borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.subject}`, alignItems: "center" }}>
        <div>
          <div style={{ color: C.subject, fontSize: 12, fontWeight: 700 }}>★ Subject (Program)</div>
          <div style={{ color: C.faint, fontSize: 10 }}>Proposed · 2025</div>
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{su.mix}%</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.subject, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{su.sf.toLocaleString()}</div>
          {avg.sf > 0 && <Delt value={su.sf - avg.sf} unit=" SF" />}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.subject, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>${su.rent.toLocaleString()}</div>
          {avg.rent > 0 && <Delt value={su.rent - avg.rent} unit="$" />}
        </div>
        <div style={{ textAlign: "right", color: C.subject, fontFamily: "monospace", fontSize: 12 }}>
          {su.sf ? `$${(su.rent/su.sf).toFixed(2)}` : "—"}
        </div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 11 }}>—</div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 11 }}>—</div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 11 }}>—</div>
        <PosTags rent={su.rent} />
      </div>

      {/* Comp rows */}
      {comps.filter(c => c.units[ut.key].mix > 0 || c.units[ut.key].sf > 0).map((c, ri) => {
        const u = c.units[ut.key];
        const psf = u.sf ? +(u.rent/u.sf).toFixed(2) : null;
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 10,
            padding: "11px 20px", borderBottom: `1px solid ${C.border}`,
            background: ri%2===0 ? "transparent" : "#060f1a50",
            borderLeft: "3px solid transparent", alignItems: "center" }}>
            <div>
              <div style={{ color: C.text, fontSize: 12 }}>{c.name}</div>
              <div style={{ color: C.faint, fontSize: 10 }}>{c.built} · {c.cls}</div>
            </div>
            <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace",
              fontSize: 12, fontWeight: 700 }}>{u.mix > 0 ? `${u.mix}%` : "—"}</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.text, fontFamily: "monospace", fontSize: 12 }}>{u.sf > 0 ? u.sf.toLocaleString() : "—"}</div>
              {u.sf > 0 && avg.sf > 0 && <Delt value={u.sf - avg.sf} unit=" SF" />}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.text, fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
                {u.rent > 0 ? `$${u.rent.toLocaleString()}` : "—"}
              </div>
              {u.rent > 0 && avg.rent > 0 && <Delt value={u.rent - avg.rent} unit="$" />}
            </div>
            <div style={{ textAlign: "right", color: C.dim, fontFamily: "monospace", fontSize: 12 }}>
              {psf ? `$${psf}` : "—"}
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.vac,"vac"), fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                {u.vac > 0 ? `${u.vac}%` : "—"}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.dom,"dom"), fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                {u.dom > 0 ? `${u.dom}d` : "—"}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: sigColor(u.conc,"conc"), fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                {u.conc > 0 ? `${u.conc}wk` : "—"}
              </span>
            </div>
            <PosTags rent={u.rent} />
          </div>
        );
      })}

      {/* Avg row */}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 10, padding: "10px 20px",
        background: "#060f1a", borderTop: `2px solid ${C.border}`, alignItems: "center" }}>
        <div style={{ color: C.dim, fontSize: 12, fontWeight: 700 }}>Comp Average</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {avg.mix.toFixed(1)}%
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {avg.sf.toLocaleString()}
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          ${avg.rent.toLocaleString()}
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {avg.sf ? `$${(avg.rent/avg.sf).toFixed(2)}` : "—"}
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {avg.vac.toFixed(1)}%
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {Math.round(avg.dom)}d
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
          {avg.conc.toFixed(1)}wk
        </div>
        <div />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────
export default function UnitMixIntelligence() {
  const { dealId } = useParams<{ dealId: string }>();
  const { activeTradeArea } = useTradeAreaStore();
  const tradeAreaId = activeTradeArea?.id;

  const {
    comps: apiComps, demandScores: apiDemandScores, trends: apiTrends,
    zoning: apiZoning, program: apiProgram, loading, error,
    handleProgramChange: saveProgram,
  } = useUnitMixIntelligence(dealId, tradeAreaId);

  const hasApiComps = apiComps && apiComps.length > 0;
  const hasApiTrends = apiTrends && Object.keys(apiTrends).some(k => apiTrends[k]?.length > 0);
  const comps: CompData[] = hasApiComps ? (apiComps as CompData[]) : COMPS;
  const trendData = hasApiTrends ? apiTrends : TREND_DATA;

  const [zoning,    setZoning]    = useState<ZoningData>(ZONING_SEED);
  const [program,   setProgram]   = useState<Program>(PROGRAM_SEED);
  const [tab,       setTab]       = useState("demand");
  const [drillType, setDrillType] = useState<UnitKey>("twoBR");
  const [trendType, setTrendType] = useState<UnitKey>("twoBR");
  const [filterUT,  setFilterUT]  = useState("all");
  const [tableUT,   setTableUT]   = useState<UnitKey>("twoBR");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (loading || initializedRef.current) return;
    initializedRef.current = true;
    if (apiZoning) setZoning(apiZoning as ZoningData);
    if (apiProgram && (apiProgram as any).totalUnits) setProgram(apiProgram as Program);
  }, [loading, apiZoning, apiProgram]);

  const handleProgramChange = (p: Program) => {
    setProgram(p);
    saveProgram(p as any);
  };

  const computed   = computeProgram(program);
  const inventory  = computeInventory(comps);
  const gaps       = computeGaps(inventory);

  const tabs = [
    { id: "demand",    label: "Demand"    },
    { id: "program",   label: "✏ Program" },
    { id: "inventory", label: "Inventory" },
    { id: "trends",    label: "Trends"    },
    { id: "comps",     label: "Comps"     },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh",
      fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, paddingBottom: 60 }}>

      {/* HEADER */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
              <span style={{ color: C.blue, fontFamily: "monospace", fontSize: 9,
                fontWeight: 700, letterSpacing: "0.12em" }}>M02 · M05 · M07 · M15</span>
              <span style={{ color: C.border }}>|</span>
              <span style={{ color: C.faint, fontFamily: "monospace", fontSize: 9 }}>
                UNIT MIX INTELLIGENCE
              </span>
            </div>
            <h1 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 800, margin: 0 }}>
              Unit Mix & Pricing Intelligence
            </h1>
            <p style={{ color: C.dim, fontSize: 11, margin: "2px 0 0" }}>
              Trade Area · {comps.length} comps ·{" "}
              {comps.reduce((s, c) => s + c.total, 0).toLocaleString()} tracked units ·
              Zoning: <span style={{ color: C.blue }}>{zoning.zoningCode}</span>
            </p>
          </div>

          {/* Gap + demand pills */}
          <div style={{ display: "flex", gap: 7 }}>
            {gaps.map(g => {
              const color = g.gap > 2 ? C.green : g.gap < -2 ? C.red : C.yellow;
              const dl = demandLabel(g.demandScore);
              return (
                <div key={g.key} style={{ background: color+"10", border: `1px solid ${color}30`,
                  borderRadius: 7, padding: "5px 10px", textAlign: "center" }}>
                  <div style={{ color: g.color, fontFamily: "monospace", fontSize: 9, fontWeight: 700 }}>{g.abbr}</div>
                  <div style={{ color, fontFamily: "monospace", fontSize: 12, fontWeight: 800 }}>
                    {g.gap > 0 ? "+" : ""}{g.gap.toFixed(1)}pp
                  </div>
                  <div style={{ color: dl.color, fontSize: 8, fontFamily: "monospace" }}>
                    {dl.label.slice(0,4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "none", border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.blue}` : "2px solid transparent",
              padding: "7px 16px", marginBottom: -1,
              color: tab === t.id ? "#e2e8f0" : C.dim,
              fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {tab === "demand" && (
          <>
            <DemandMatrix inventory={inventory} trendData={trendData} />
            <GapAnalysis gaps={gaps} />
          </>
        )}

        {tab === "program" && (
          <>
            <ZoningPanel zoning={zoning} program={program} computed={computed} onZoningChange={setZoning} />
            <ProgramEditor program={program} computed={computed} zoning={zoning} onProgramChange={handleProgramChange} comps={comps} />
          </>
        )}

        {tab === "inventory" && (
          <>
            <InventorySnapshot inventory={inventory} comps={comps} />
            <PropertyDrillDown selectedType={drillType} onSelect={setDrillType} comps={comps} />
          </>
        )}

        {tab === "trends" && (
          <>
            <TrendDetail selectedType={trendType} onSelect={setTrendType} trendData={trendData} />
            <PropertyDrillDown selectedType={trendType} onSelect={setTrendType} comps={comps} />
          </>
        )}

        {tab === "comps" && (
          <>
            <MixMatrix program={program} comps={comps} />
            <RentSFScatter program={program} filterUT={filterUT} setFilterUT={setFilterUT} comps={comps} />
            <CompTable program={program} utKey={tableUT} setUtKey={setTableUT} comps={comps} />
          </>
        )}
      </div>
    </div>
  );
}
