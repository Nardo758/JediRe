import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Cell, LineChart, Line,
} from "recharts";
import { useUnitMixIntelligence } from "../../../hooks/useUnitMixIntelligence";
import { useTradeAreaStore } from "../../../stores/tradeAreaStore";
import { useDealStore, useDealType } from "../../../stores/dealStore";

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
  avgRent: number; avgConc: number; demandScore: number; avgSF: number;
}

interface GapItem extends InventoryItem { demandShare: number; gap: number; }

const C = {
  bg: "#0A0E17", surface: "#0F1319", card: "#131821", border: "#1E2538",
  muted: "#2A3348", text: "#E8ECF1", dim: "#6B7A8D", faint: "#2A3348",
  studio: "#A78BFA", oneBR: "#00BCD4", twoBR: "#00D26A", threeBR: "#F5A623",
  subject: "#FF8C42", green: "#00D26A", red: "#FF4757", yellow: "#F5A623", blue: "#00BCD4",
  header: "#1A1F2E", secondary: "#A0ABBE",
};

const mono = "var(--bt-mono)";

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
  const totalMonthlyRent = UT_META.reduce((s, ut) => {
    const u = program.units[ut.key];
    return s + Math.round(program.totalUnits * u.mix / 100) * u.rent;
  }, 0);
  const grossRevPA = UT_META.reduce((s, ut) => {
    const u = program.units[ut.key];
    return s + Math.round(program.totalUnits * u.mix / 100) * u.rent * 12 * 0.95;
  }, 0);
  const wtdPSF = totalSF > 0 ? +(totalMonthlyRent / totalSF).toFixed(2) : 0;
  return { totalSF, mixTotal, grossRevPA, wtdPSF };
}

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
    const avgSF   = Math.round(n(c => c.units[ut.key].sf));
    const supplyShare = totalCompUnits > 0 ? typeUnits / totalCompUnits * 100 : 0;
    const vacScore  = Math.max(0, 100 - avgVac * 6);
    const domScore  = Math.max(0, 100 - avgDOM * 2);
    const concScore = Math.max(0, 100 - avgConc * 10);
    const demandScore = Math.round(vacScore * 0.4 + domScore * 0.35 + concScore * 0.25);
    return { ...ut, typeUnits, supplyShare, avgVac, avgDOM, avgRent, avgConc, demandScore, avgSF };
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

function computeOptimalProgram(totalUnits: number, comps: CompData[], opts?: { zoning?: ZoningData; demandScores?: Record<string, number> }): Program {
  const inventory = computeInventory(comps);
  const gaps = computeGaps(inventory);
  const psfPerType = UT_META.map(ut => {
    const avg = compAvg(ut.key, comps);
    return avg.sf > 0 ? avg.rent / avg.sf : 0;
  });
  const maxPsf = Math.max(...psfPerType, 1);
  const psfScores = psfPerType.map(p => (p / maxPsf) * 100);
  const velocityScores = UT_META.map(ut => {
    const avg = compAvg(ut.key, comps);
    const vacPenalty = Math.max(0, 100 - avg.vac * 8);
    const domPenalty = avg.dom > 0 ? Math.max(0, 100 - avg.dom * 3) : 60;
    return (vacPenalty * 0.6 + domPenalty * 0.4);
  });
  const zoningMaxUnits = opts?.zoning?.maxUnits || totalUnits;
  const effectiveUnits = Math.min(totalUnits, zoningMaxUnits);
  const rawScores = UT_META.map((ut, i) => {
    const inv = gaps[i];
    const demandScore = opts?.demandScores?.[ut.key] ?? inv.demandScore ?? 0;
    const psfScore = psfScores[i];
    const gapScore = Math.max(0, inv.gap || 0) * 5;
    const velocity = velocityScores[i];
    return demandScore * 0.35 + psfScore * 0.25 + Math.min(gapScore, 100) * 0.20 + velocity * 0.20;
  });
  const totalScore = rawScores.reduce((s, v) => s + v, 0) || 1;
  const mixPcts = rawScores.map(s => {
    const raw = Math.round(s / totalScore * 100);
    return Math.max(5, Math.min(55, raw));
  });
  let mixSum = mixPcts.reduce((s, v) => s + v, 0);
  const maxIter = 50;
  let iter = 0;
  while (mixSum !== 100 && iter++ < maxIter) {
    const delta = 100 - mixSum;
    const sortedIdxs = rawScores.map((_, i) => i).sort((a, b) =>
      delta > 0 ? rawScores[b] - rawScores[a] : rawScores[a] - rawScores[b]
    );
    for (const idx of sortedIdxs) {
      if (mixSum === 100) break;
      const room = delta > 0 ? 55 - mixPcts[idx] : mixPcts[idx] - 5;
      if (room <= 0) continue;
      const step = delta > 0 ? Math.min(delta, room, 3) : Math.max(delta, -room, -3);
      mixPcts[idx] += step;
      mixSum += step;
    }
  }
  const units: Record<string, { mix: number; sf: number; rent: number }> = {};
  UT_META.forEach((ut, i) => {
    const avg = compAvg(ut.key, comps);
    const baseSf = avg.sf || PROGRAM_SEED.units[ut.key].sf;
    const baseRent = avg.rent || PROGRAM_SEED.units[ut.key].rent;
    let sfTarget = baseSf;
    let rentTarget = baseRent;
    if (opts?.zoning?.maxNetSF) {
      const budgetedSfPerUnit = opts.zoning.maxNetSF / effectiveUnits;
      if (baseSf > budgetedSfPerUnit * 1.3) {
        sfTarget = Math.round(baseSf * 0.95);
      }
    }
    const gapBonus = (gaps[i]?.gap ?? 0) > 3 ? 1.05 : 1;
    rentTarget = Math.round(baseRent * gapBonus);
    units[ut.key] = { mix: mixPcts[i], sf: sfTarget, rent: rentTarget };
  });
  return { totalUnits: effectiveUnits, units: units as Record<UnitKey, ProgramUnit> };
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

function SectionHeader({ mod, title, right }: { mod: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "4px 10px", borderBottom: `1px solid ${C.border}`,
      display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card }}>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <span style={{ color: C.blue, fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: "0.08em" }}>{mod}</span>
        <span style={{ color: C.border }}>·</span>
        <span style={{ color: C.text, fontSize: 10, fontWeight: 700 }}>{title}</span>
      </div>
      {right}
    </div>
  );
}

function UnitTypeToggle({ selected, onSelect, size = "sm" }: { selected: UnitKey | string; onSelect: (k: any) => void; size?: string }) {
  const items = size === "lg" ? [{key:"all",abbr:"ALL",color:C.dim},...UT_META] : UT_META;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {items.map(u => (
        <button key={u.key} onClick={() => onSelect(u.key)} style={{
          background: selected===u.key ? (u.color||C.dim)+"18" : "transparent",
          border: `1px solid ${selected===u.key ? (u.color||C.dim)+"60" : C.border}`,
          borderRadius: 3, padding: "2px 6px",
          color: selected===u.key ? (u.color||C.text) : C.dim,
          fontSize: 8, fontFamily: mono, fontWeight: 700, cursor: "pointer",
        }}>{u.abbr||"ALL"}</button>
      ))}
    </div>
  );
}

function Tag({ label, color, size = "sm" }: { label: string; color: string; size?: string }) {
  return (
    <span style={{ background: color + "18", border: `1px solid ${color}35`, color,
      borderRadius: 2, padding: size === "xs" ? "0px 4px" : "1px 5px",
      fontSize: size === "xs" ? 7 : 8, fontFamily: mono, fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Delt({ value, unit = "" }: { value: number | null | undefined; unit?: string }) {
  if (value === null || value === undefined || isNaN(value)) return null;
  const pos = value > 0;
  const color = Math.abs(value) < 0.5 ? C.dim : pos ? C.green : C.red;
  return (
    <span style={{ color, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>
      {pos ? "+" : ""}{typeof value === "number" ? value.toFixed(1) : value}{unit}
    </span>
  );
}

function SecLabel({ mod, title, sub }: { mod: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 1 }}>
        <span style={{ color: C.blue, fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: "0.08em" }}>{mod}</span>
        <span style={{ color: C.border }}>·</span>
        <span style={{ color: C.text, fontSize: 10, fontWeight: 700 }}>{title}</span>
      </div>
      {sub && <p style={{ color: C.dim, fontSize: 8, margin: 0 }}>{sub}</p>}
    </div>
  );
}

function NumInput({ value, onChange, min, max, step = 1, width = 48, suffix = "", accent }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; width?: number; suffix?: string; accent?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2,
      background: accent ? C.subject + "14" : C.faint,
      border: `1px solid ${accent ? C.subject + "55" : C.border}`, borderRadius: 3, padding: "2px 5px" }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width, background: "none", border: "none", outline: "none",
          color: accent ? C.subject : C.text, fontFamily: mono, fontSize: 10,
          fontWeight: 700, textAlign: "right" }} />
      {suffix && <span style={{ color: C.dim, fontSize: 9 }}>{suffix}</span>}
    </div>
  );
}

function GapBar({ gap, max = 15 }: { gap: number; max?: number }) {
  const clamped = Math.min(Math.abs(gap), max);
  const pct = clamped / max * 100;
  const color = gap > 3 ? C.green : gap < -3 ? C.red : C.yellow;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 80, height: 4, background: C.muted, borderRadius: 2, position: "relative" }}>
        <div style={{ position: "absolute", [gap >= 0 ? "left" : "right"]: "50%",
          width: `${pct / 2}%`, height: "100%", background: color, borderRadius: 2 }} />
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: C.faint }} />
      </div>
      <span style={{ color, fontFamily: mono, fontSize: 9, fontWeight: 700, minWidth: 40 }}>
        {gap > 0 ? "+" : ""}{gap.toFixed(1)}pp
      </span>
    </div>
  );
}

function MiniLine({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data} margin={{ top: 1, right: 1, bottom: 0, left: 0 }}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 8px" }}>
      <div style={{ color: C.dim, fontSize: 7, fontFamily: mono, marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.text, fontSize: 9, fontFamily: mono }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

function ScatterDot({ cx, cy, payload }: any) {
  if (cx === undefined) return null;
  return <circle cx={cx} cy={cy} r={payload.isSubject ? 5 : 3.5} fill={payload.color}
    fillOpacity={payload.isSubject ? 1 : 0.65}
    stroke={payload.isSubject ? "#fff" : "none"} strokeWidth={1.5} />;
}

function ScatterTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, padding: "4px 8px" }}>
      <div style={{ color: d.color, fontFamily: mono, fontSize: 7, fontWeight: 700, marginBottom: 2 }}>
        {d.unitType} · {d.name}
      </div>
      <div style={{ color: C.text, fontSize: 9 }}>
        {d.x.toLocaleString()} SF → <span style={{ color: C.green, fontWeight: 700 }}>${d.y.toLocaleString()}/mo</span>
      </div>
      <div style={{ color: C.dim, fontSize: 8 }}>${d.psf}/SF</div>
      {d.vac != null && <div style={{ color: C.dim, fontSize: 8, marginTop: 2 }}>Vac {d.vac}% · DOM {d.dom}d · Conc {d.conc}wk</div>}
    </div>
  );
}

function DemandMatrix({ inventory, trendData }: { inventory: InventoryItem[]; trendData: typeof TREND_DATA }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05 · M07" title="Demand by Unit Type" right={
        <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>TRADE AREA AVG</span>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.border }}>
        {inventory.map(u => {
          const dl = demandLabel(u.demandScore);
          const trend = trendData[u.key];
          const vacDelta = trend.length >= 12 ? trend[11].vac - trend[0].vac : 0;
          const rentDelta = trend.length >= 12 ? trend[11].rent - trend[0].rent : 0;
          return (
            <div key={u.key} style={{ background: C.card, padding: "5px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <div style={{ width: 4, height: 4, background: u.color, borderRadius: 1 }} />
                  <span style={{ color: u.color, fontFamily: mono, fontSize: 8, fontWeight: 700, letterSpacing: "0.05em" }}>{u.abbr}</span>
                  <span style={{ color: C.dim, fontSize: 7 }}>{u.sfRange}</span>
                </div>
                <Tag label={dl.label} color={dl.color} size="xs" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <span style={{ color: dl.color, fontFamily: mono, fontSize: 12, fontWeight: 800, lineHeight: 1 }}>{u.demandScore}</span>
                <div style={{ flex: 1, height: 2, background: C.muted, borderRadius: 1, overflow: "hidden" }}>
                  <div style={{ width: `${u.demandScore}%`, height: "100%", background: dl.color, borderRadius: 1 }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 4px", marginBottom: 3 }}>
                {([
                  { label: "VAC", val: u.avgVac.toFixed(1), unit: "%", sig: "vac" as SigKey, delta: vacDelta, dUnit: "pp" },
                  { label: "DOM", val: u.avgDOM.toFixed(0), unit: "d", sig: "dom" as SigKey },
                  { label: "CONC", val: u.avgConc.toFixed(1), unit: "wk", sig: "conc" as SigKey },
                  { label: "RENT", val: `$${u.avgRent.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`, unit: "", sig: null },
                  { label: "AVG SF", val: u.avgSF > 0 ? `${u.avgSF}` : "—", unit: u.avgSF > 0 ? " SF" : "", sig: null },
                ] as const).map((m, mi) => (
                  <div key={mi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0px 0" }}>
                    <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>{m.label}</span>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      <span style={{ color: m.sig ? sigColor(parseFloat(m.val), m.sig) : C.text,
                        fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
                        {m.val}{m.unit}
                      </span>
                      {m.delta !== undefined && m.delta !== 0 && (
                        <span style={{ color: m.delta > 0 ? C.red : C.green, fontFamily: mono, fontSize: 6 }}>
                          {m.delta > 0 ? "▲" : "▼"}{Math.abs(m.delta).toFixed(1)}
                        </span>
                      )}
                      {mi === 3 && rentDelta !== 0 && (
                        <span style={{ color: rentDelta > 0 ? C.green : C.red, fontFamily: mono, fontSize: 6 }}>
                          {rentDelta > 0 ? "+" : ""}${rentDelta}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 2 }}>
                <MiniLine data={trendData[u.key]} dataKey="vac" color={u.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GapAnalysis({ gaps }: { gaps: GapItem[] }) {
  const chartData = gaps.map(g => ({
    name: g.abbr, supply: +g.supplyShare.toFixed(1), demand: +g.demandShare.toFixed(1), color: g.color,
  }));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="DERIVED" title="Supply / Demand Gap" right={
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div style={{ width: 6, height: 2, background: C.muted, borderRadius: 1 }} />
            <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>SUPPLY</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <div style={{ width: 6, height: 2, background: C.blue, borderRadius: 1 }} />
            <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>DEMAND</span>
          </div>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 1, background: C.border }}>
        <div style={{ background: C.card, padding: "5px 8px" }}>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} barCategoryGap="18%">
              <XAxis dataKey="name" tick={{ fill: C.dim, fontSize: 8, fontFamily: mono }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.faint, fontSize: 7 }} axisLine={false} tickLine={false} width={20}
                tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="supply" name="Supply %" radius={[2,2,0,0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color + "40"} />)}
              </Bar>
              <Bar dataKey="demand" name="Demand %" radius={[2,2,0,0]}>
                {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: C.bg, padding: "5px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {gaps.map(g => {
              const dl = demandLabel(g.demandScore);
              return (
                <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 4, height: 4, background: g.color, borderRadius: 1, flexShrink: 0 }} />
                  <span style={{ color: C.text, fontSize: 9, fontWeight: 600, minWidth: 28 }}>{g.abbr}</span>
                  <Tag label={dl.label} color={dl.color} size="xs" />
                  <span style={{ color: C.dim, fontSize: 7, fontFamily: mono, minWidth: 70 }}>
                    S:{g.supplyShare.toFixed(1)}% D:<span style={{ color: g.color }}>{g.demandShare.toFixed(1)}%</span>
                  </span>
                  <div style={{ flex: 1 }}><GapBar gap={g.gap} /></div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 4, padding: "3px 6px", background: C.card, borderRadius: 2,
            border: `1px solid ${C.border}` }}>
            {gaps.filter(g => Math.abs(g.gap) > 3).sort((a, b) => b.gap - a.gap).map(g => (
              <div key={g.key} style={{ display: "flex", gap: 3, marginBottom: 1, alignItems: "flex-start" }}>
                <span style={{ color: g.gap > 0 ? C.green : C.red, fontFamily: mono, fontSize: 8, flexShrink: 0 }}>
                  {g.gap > 0 ? "▲" : "▼"}
                </span>
                <span style={{ color: C.dim, fontSize: 8, lineHeight: 1.3 }}>
                  <span style={{ color: g.color, fontWeight: 700 }}>{g.abbr}</span>
                  {g.gap > 0
                    ? ` undersupplied ${g.gap.toFixed(1)}pp — fast velocity, low vac`
                    : ` oversupplied ${Math.abs(g.gap).toFixed(1)}pp — slow leasing`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoningPanel({ zoning, program, computed, onZoningChange }: { zoning: ZoningData; program: Program; computed: any; onZoningChange: (z: ZoningData) => void }) {
  const sfUtil   = computed.totalSF / zoning.maxNetSF * 100;
  const unitUtil = program.totalUnits / zoning.maxUnits * 100;
  const sfOver   = computed.totalSF > zoning.maxNetSF;
  const unitOver = program.totalUnits > zoning.maxUnits;

  const fields = [
    { label: "Max Units", key: "maxUnits", val: zoning.maxUnits, your: program.totalUnits,
      util: unitUtil, over: unitOver, color: unitOver ? C.red : unitUtil > 88 ? C.yellow : C.green,
      suffix: "units", w: 48, note: "Zoned acres × max DU/acre" },
    { label: "Max Net SF", key: "maxNetSF", val: zoning.maxNetSF, your: computed.totalSF,
      util: sfUtil, over: sfOver, color: sfOver ? C.red : sfUtil > 88 ? C.yellow : C.green,
      suffix: "SF", w: 64, note: zoning.excludesParking ? "Excl. parking & mechanical" : "All enclosed SF" },
    { label: "Max Height",  key: "maxHeight",      val: zoning.maxHeight,      your: null, util: null, suffix: "fl", w: 36, note: "Per LDR §4.12.3" },
    { label: "Lot Coverage",key: "maxLotCoverage", val: zoning.maxLotCoverage, your: null, util: null, suffix: "%",  w: 36, note: "Footprint / lot area" },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${sfOver || unitOver ? C.red + "60" : C.border}`,
      borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M02" title="Zoning Constraints" right={
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <Tag label={zoning.zoningCode} color={C.blue} size="xs" />
          <Tag label={`${zoning.confidence}% CONF`} color={C.green} size="xs" />
          {zoning.excludesParking && <Tag label="SF EXCL. PARKING" color={C.yellow} size="xs" />}
          {(sfOver || unitOver) && <Tag label="⚠ EXCEEDED" color={C.red} />}
          <a href={zoning.sourceUrl} style={{ color: C.blue, fontSize: 8, textDecoration: "none" }}>
            {zoning.source} ↗
          </a>
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.border }}>
        {fields.map(f => (
          <div key={f.key} style={{ background: C.card, padding: "5px 8px" }}>
            <div style={{ color: C.dim, fontSize: 8, marginBottom: 4 }}>{f.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 }}>
              <div>
                <div style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.06em", marginBottom: 2 }}>ALLOWED</div>
                <NumInput value={f.val} min={1} max={9999999} width={f.w} suffix={f.suffix}
                  onChange={v => onZoningChange({ ...zoning, [f.key]: v })} />
              </div>
              {f.your !== null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.06em", marginBottom: 2 }}>YOUR PROGRAM</div>
                  <div style={{ color: f.over ? C.red : C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>
                    {Math.round(f.your).toLocaleString()}
                    <span style={{ color: C.dim, fontSize: 8, marginLeft: 2 }}>{f.suffix}</span>
                  </div>
                </div>
              )}
            </div>
            {f.util !== null && (
              <>
                <div style={{ height: 3, background: C.muted, borderRadius: 1, overflow: "hidden", marginBottom: 2 }}>
                  <div style={{ width: `${Math.min(100, f.util)}%`, height: "100%",
                    background: f.color, borderRadius: 1, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: f.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
                    {f.util.toFixed(1)}%
                  </span>
                  {f.over && <span style={{ color: C.red, fontSize: 8, fontWeight: 700 }}>OVER</span>}
                </div>
              </>
            )}
            <div style={{ color: C.faint, fontSize: 7, marginTop: 4 }}>{f.note}</div>
          </div>
        ))}
      </div>

      {!sfOver && !unitOver && (
        <div style={{ padding: "4px 10px", background: C.bg,
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: C.faint, fontSize: 7, fontFamily: mono }}>REMAINING:</span>
          <span style={{ color: C.green, fontFamily: mono, fontSize: 9 }}>
            {(zoning.maxNetSF - computed.totalSF).toLocaleString()} SF unused
          </span>
          <span style={{ color: C.green, fontFamily: mono, fontSize: 9 }}>
            {zoning.maxUnits - program.totalUnits} unit headroom
          </span>
          <span style={{ color: C.dim, fontSize: 8 }}>
            → ~{Math.floor((zoning.maxNetSF - computed.totalSF) / (computed.totalSF / program.totalUnits))} more avg-sized units fit
          </span>
        </div>
      )}
    </div>
  );
}

function ProgramEditor({ program, computed, zoning, onProgramChange, comps, gaps, onPushToProforma, readOnly }: { program: Program; computed: any; zoning: ZoningData; onProgramChange: (p: Program) => void; comps: CompData[]; gaps?: GapItem[]; onPushToProforma?: (program: Program) => Promise<{ success: boolean; modulesUpdated: string[]; errors: string[] }>; readOnly?: boolean }) {
  const { totalSF, mixTotal, grossRevPA, wtdPSF } = computed;
  const mixOk = Math.abs(mixTotal - 100) < 1;
  const sfPct = zoning.maxNetSF > 0 ? (totalSF / zoning.maxNetSF) * 100 : 0;
  const sfOver = sfPct > 100;
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; modules: string[] } | null>(null);
  const [showSugg, setShowSugg] = useState(!readOnly);

  const suggestion = useMemo(() => {
    if (comps.length === 0) return null;
    const demandScores: Record<string, number> = {};
    if (gaps) gaps.forEach(g => { demandScores[g.key] = g.demandScore; });
    return computeOptimalProgram(program.totalUnits, comps, {
      zoning: { maxUnits: zoning.maxUnits, maxNetSF: zoning.maxNetSF },
      demandScores: gaps ? demandScores : undefined,
    });
  }, [program.totalUnits, comps, gaps, zoning.maxUnits, zoning.maxNetSF]);

  function setUnit(utKey: UnitKey, field: string, val: number) {
    onProgramChange({ ...program, units: { ...program.units, [utKey]: { ...program.units[utKey], [field]: val } } });
  }

  function applySuggestion() {
    if (suggestion) {
      onProgramChange(suggestion);
      setShowSugg(false);
    }
  }

  function resetProgram() {
    const base = computeOptimalProgram(zoning.maxUnits > 0 ? Math.min(PROGRAM_SEED.totalUnits, zoning.maxUnits) : PROGRAM_SEED.totalUnits, comps, {
      zoning: { maxUnits: zoning.maxUnits, maxNetSF: zoning.maxNetSF },
    });
    onProgramChange(base);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M03" title={readOnly ? "Unit Program (Read-Only)" : "Unit Program"} right={
        readOnly ? (
          <Tag label="EXISTING — VIEW ONLY" color={C.faint} />
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {!mixOk && <Tag label={`MIX ${mixTotal}%`} color={C.red} />}
            <button onClick={() => setShowSugg(s => !s)} style={{
              background: showSugg ? C.blue + "22" : "none",
              border: `1px solid ${showSugg ? C.blue + "60" : C.border}`,
              borderRadius: 3, padding: "2px 6px",
              color: showSugg ? C.blue : C.faint, fontSize: 7, fontFamily: mono,
              fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
            }}>{showSugg ? "HIDE AI" : "AI SUGGESTION"}</button>
            <button onClick={resetProgram} style={{ background: "none",
              border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 6px",
              color: C.faint, fontSize: 7, fontFamily: mono, cursor: "pointer" }}>RESET</button>
          </div>
        )
      } />

      {!readOnly && showSugg && suggestion && (
        <div style={{ borderBottom: `1px solid ${C.border}`, background: C.blue + "08" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "5px 8px 4px", borderBottom: `1px solid ${C.blue}18` }}>
            <div>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: "0.06em" }}>
                M03 · AI RECOMMENDATION
              </span>
              <span style={{ color: C.faint, fontFamily: mono, fontSize: 7, marginLeft: 6 }}>
                {comps.length} comp{comps.length !== 1 ? "s" : ""} · demand 35% · PSF 25% · gap 20% · velocity 20%
              </span>
            </div>
            <button onClick={applySuggestion} style={{
              background: C.blue, border: "none", borderRadius: 3, padding: "2px 10px",
              color: "#0A0E1A", fontSize: 7, fontFamily: mono, fontWeight: 800,
              cursor: "pointer", letterSpacing: "0.05em",
            }}>APPLY SUGGESTION →</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1,
            background: C.border, padding: 1 }}>
            {UT_META.map(ut => {
              const s = suggestion.units[ut.key];
              const gap = gaps?.find(g => g.key === ut.key);
              const curr = program.units[ut.key];
              const mixDelta = s.mix - curr.mix;
              const suggCount = Math.round(suggestion.totalUnits * s.mix / 100);
              const gapPp = gap?.gap ?? 0;
              return (
                <div key={ut.key} style={{ background: C.bg, padding: "5px 7px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: ut.color, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>{ut.label}</span>
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>{s.mix}%</span>
                  </div>
                  <div style={{ height: 3, background: C.muted, borderRadius: 1, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ width: `${Math.min(s.mix, 100)}%`, height: "100%", background: ut.color + "bb", borderRadius: 1 }} />
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                    <span style={{ color: C.dim, fontFamily: mono, fontSize: 7 }}>×{suggCount}</span>
                    <span style={{ color: C.dim, fontFamily: mono, fontSize: 7 }}>{s.sf}sf</span>
                    <span style={{ color: C.green, fontFamily: mono, fontSize: 7, fontWeight: 700 }}>${s.rent}/mo</span>
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                    {mixDelta !== 0 && (
                      <span style={{ fontFamily: mono, fontSize: 6,
                        color: mixDelta > 0 ? C.green : C.red }}>
                        {mixDelta > 0 ? "▲" : "▼"}{Math.abs(mixDelta)}pp vs current
                      </span>
                    )}
                    {gap && (
                      <span style={{ fontFamily: mono, fontSize: 6,
                        color: gapPp > 2 ? C.green : gapPp < -2 ? C.red : C.yellow }}>
                        {gapPp > 0 ? "+" : ""}{gapPp.toFixed(1)}pp gap
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: C.border,
        borderBottom: `1px solid ${C.border}` }}>
        {[
          { label: "TOTAL UNITS", content: (
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              {readOnly ? (
                <span style={{ color: C.text, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>{program.totalUnits}</span>
              ) : (
                <NumInput value={program.totalUnits} min={10} max={zoning.maxUnits} suffix="" width={36} accent
                  onChange={v => onProgramChange({ ...program, totalUnits: v })} />
              )}
              <span style={{ color: C.faint, fontSize: 7, fontFamily: mono }}>/ {zoning.maxUnits}</span>
            </div>
          )},
          { label: "NET SF", content: (
            <span style={{ color: sfOver ? C.red : C.text, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
              {totalSF.toLocaleString()}
            </span>
          )},
          { label: "GROSS REV", content: (
            <span style={{ color: C.green, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
              ${(grossRevPA/1e6).toFixed(2)}M
            </span>
          )},
          { label: "WTD $/SF", content: (
            <span style={{ color: C.yellow, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
              ${wtdPSF.toFixed(2)}
            </span>
          )},
        ].map((kpi, i) => (
          <div key={i} style={{ background: C.bg, padding: "4px 8px" }}>
            <div style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.06em", marginBottom: 2 }}>{kpi.label}</div>
            {kpi.content}
          </div>
        ))}
      </div>

      <div style={{ padding: "0 8px" }}>
        {UT_META.map((ut, ri) => {
          const u = program.units[ut.key];
          const avg = compAvg(ut.key, comps);
          const count = Math.round(program.totalUnits * u.mix / 100);
          const psf = u.sf ? +(u.rent / u.sf).toFixed(2) : 0;
          const annRev = count * u.rent * 12 * 0.95;
          const sfDelta = avg.sf > 0 ? u.sf - avg.sf : null;
          const rentDelta = avg.rent > 0 ? u.rent - avg.rent : null;

          return (
            <div key={ut.key} style={{ padding: "8px 0", borderBottom: ri < UT_META.length - 1 ? `1px solid ${C.border}40` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: ut.color, flexShrink: 0 }} />
                <span style={{ color: ut.color, fontSize: 10, fontWeight: 700, fontFamily: mono, minWidth: 42 }}>{ut.label}</span>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: C.muted, borderRadius: 2, overflow: "hidden", maxWidth: 100 }}>
                    <div style={{ width: `${Math.min(u.mix, 100)}%`, height: "100%", background: ut.color + "aa",
                      borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  {readOnly ? (
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{u.mix}%</span>
                  ) : (
                    <NumInput value={u.mix} min={0} max={100} suffix="%" width={28} accent onChange={v => setUnit(ut.key,"mix",v)} />
                  )}
                  {avg.mix > 0 && <Delt value={u.mix - avg.mix} unit="pp" />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, background: C.muted, borderRadius: 3, padding: "1px 6px" }}>
                  <span style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>×</span>
                  <span style={{ color: C.text, fontSize: 10, fontWeight: 700, fontFamily: mono }}>{count}</span>
                </div>
                <div style={{ marginLeft: "auto", color: C.green, fontSize: 9, fontWeight: 700, fontFamily: mono }}>
                  ${(annRev/1000).toFixed(0)}K
                  <span style={{ color: C.faint, fontSize: 7, marginLeft: 2 }}>/yr</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginLeft: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.bg, borderRadius: 3, padding: "2px 6px", border: `1px solid ${C.border}40` }}>
                  <span style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.04em" }}>SF</span>
                  {readOnly ? (
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>{u.sf}</span>
                  ) : (
                    <NumInput value={u.sf} min={200} max={3000} step={5} suffix="" width={36} accent onChange={v => setUnit(ut.key,"sf",v)} />
                  )}
                  {avg.sf > 0 && (
                    <span style={{ color: C.faint, fontSize: 7, fontFamily: mono }}>
                      avg {avg.sf} {sfDelta !== null && <Delt value={sfDelta} unit="" />}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.bg, borderRadius: 3, padding: "2px 6px", border: `1px solid ${C.border}40` }}>
                  <span style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.04em" }}>RENT</span>
                  {readOnly ? (
                    <span style={{ color: C.text, fontFamily: mono, fontSize: 10, fontWeight: 700 }}>${u.rent}</span>
                  ) : (
                    <NumInput value={u.rent} min={500} max={10000} step={10} suffix="$" width={36} accent onChange={v => setUnit(ut.key,"rent",v)} />
                  )}
                  {avg.rent > 0 && (
                    <span style={{ color: C.faint, fontSize: 7, fontFamily: mono }}>
                      avg ${avg.rent} {rentDelta !== null && <Delt value={rentDelta} unit="$" />}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px" }}>
                  <span style={{ color: C.faint, fontSize: 7, fontFamily: mono }}>$/SF</span>
                  <span style={{ color: C.text, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>${psf}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px",
        background: C.bg, borderTop: `2px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.faint, fontSize: 7, fontFamily: mono, fontWeight: 700, letterSpacing: "0.06em" }}>TOTALS</span>
          <span style={{ color: mixOk ? C.green : C.red, fontFamily: mono, fontSize: 9, fontWeight: 800 }}>{mixTotal}%</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ color: C.text, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{program.totalUnits} units</span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ color: C.dim, fontFamily: mono, fontSize: 9 }}>
            {Math.round(totalSF/program.totalUnits).toLocaleString()} avg SF
          </span>
        </div>
        <span style={{ color: C.green, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
          ${(grossRevPA/1e6).toFixed(2)}M/yr
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        background: C.bg, borderTop: `1px solid ${C.border}` }}>
        <span style={{ color: C.faint, fontSize: 7, fontFamily: mono, letterSpacing: "0.04em" }}>SF ENVELOPE</span>
        <div style={{ flex: 1, height: 3, background: C.muted, borderRadius: 1, overflow: "hidden", maxWidth: 160 }}>
          <div style={{ width: `${Math.min(sfPct, 100)}%`, height: "100%",
            background: sfOver ? C.red : sfPct > 88 ? C.yellow : C.green,
            borderRadius: 1, transition: "width 0.3s" }} />
        </div>
        <span style={{ color: sfOver ? C.red : C.text, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>
          {totalSF.toLocaleString()} / {zoning.maxNetSF.toLocaleString()}
        </span>
        {sfOver
          ? <Tag label={`OVER ${(totalSF-zoning.maxNetSF).toLocaleString()} SF`} color={C.red} size="xs" />
          : <Tag label={`${(zoning.maxNetSF-totalSF).toLocaleString()} remaining`} color={C.green} size="xs" />}
      </div>

      {onPushToProforma && !readOnly && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "4px 8px", borderTop: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 7, fontFamily: mono, color: C.faint, letterSpacing: "0.04em" }}>
              ZONING: <span style={{ color: C.blue }}>{zoning.zoningCode || "—"}</span>
            </span>
            <span style={{ color: C.faint, fontSize: 7 }}>·</span>
            <span style={{ fontSize: 7, fontFamily: mono,
              color: !sfOver && mixOk ? C.green : C.red, letterSpacing: "0.04em" }}>
              {!sfOver && mixOk ? "WITHIN ENVELOPE" : sfOver ? "EXCEEDS SF ENVELOPE" : "MIX ≠ 100%"}
            </span>
            {pushResult && (
              <>
                <span style={{ color: C.faint, fontSize: 7 }}>·</span>
                <span style={{ fontSize: 7, fontFamily: mono,
                  color: pushResult.success ? C.green : C.red }}>
                  {pushResult.success
                    ? `PUSHED → ${pushResult.modules.join(", ")}`
                    : "PUSH FAILED"}
                </span>
              </>
            )}
          </div>
          <button
            disabled={pushing || sfOver || !mixOk}
            onClick={async () => {
              setPushing(true);
              setPushResult(null);
              try {
                const res = await onPushToProforma(program);
                setPushResult({ success: res.success, modules: res.modulesUpdated || [] });
              } catch {
                setPushResult({ success: false, modules: [] });
              }
              setPushing(false);
            }}
            style={{
              padding: "2px 8px", border: "none", borderRadius: 2,
              cursor: pushing || sfOver || !mixOk ? "not-allowed" : "pointer",
              fontSize: 7, fontFamily: mono, fontWeight: 700, letterSpacing: "0.04em",
              background: pushing ? C.yellow : sfOver || !mixOk ? C.muted : C.green,
              color: pushing ? C.bg : sfOver || !mixOk ? C.dim : C.bg,
              opacity: sfOver || !mixOk ? 0.5 : 1,
              transition: "all 0.2s",
            }}>
            {pushing ? "PUSHING..." : "PUSH TO PROFORMA →"}
          </button>
        </div>
      )}
    </div>
  );
}

function InventorySnapshot({ inventory, comps }: { inventory: InventoryItem[]; comps: CompData[] }) {
  const total = inventory.reduce((s, u) => s + u.typeUnits, 0);
  const gridTpl = "1fr 32px repeat(4,60px) 40px";
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05" title="Submarket Inventory" right={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {inventory.map(u => (
            <div key={u.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 4, height: 4, background: u.color, borderRadius: 1 }} />
              <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>{u.abbr}</span>
              <span style={{ color: C.text, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>{u.typeUnits}u</span>
              {u.avgSF > 0 && (
                <span style={{ color: C.dim, fontSize: 6, fontFamily: mono }}>· {u.avgSF} SF</span>
              )}
            </div>
          ))}
          <span style={{ color: C.faint, fontSize: 7 }}>·</span>
          <span style={{ color: C.text, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{total.toLocaleString()}</span>
        </div>
      } />
      <div style={{ padding: "4px 8px 2px" }}>
        <div style={{ display: "flex", height: 12, borderRadius: 2, overflow: "hidden", gap: 1 }}>
          {inventory.map(u => (
            <div key={u.key} style={{ flex: u.supplyShare, background: u.color + "cc",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 7, fontWeight: 700, fontFamily: mono }}>
              {u.supplyShare > 10 ? `${u.supplyShare.toFixed(0)}%` : ""}
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
          background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          {["PROPERTY","CLS",...UT_META.map(u => u.abbr),"UNITS"].map((h, i) => (
            <div key={i} style={{ color: i >= 2 && i <= 5 ? UT_META[i-2]?.color : C.faint, fontSize: 7, fontFamily: mono,
              fontWeight: 700, letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>
          ))}
        </div>
        {comps.map((c, i) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridTpl,
            padding: "3px 8px", borderBottom: `1px solid ${C.border}40`,
            background: i % 2 === 0 ? "transparent" : "#1A1F2E10" }}>
            <div style={{ color: C.text, fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
            <div style={{ color: C.dim, fontSize: 8, fontFamily: mono }}>{c.cls}</div>
            {UT_META.map(ut => {
              const pct = c.units[ut.key].mix;
              return (
                <div key={ut.key} style={{ textAlign: "right" }}>
                  <span style={{ color: pct > 0 ? ut.color : C.faint, fontFamily: mono,
                    fontSize: 9, fontWeight: 600 }}>{pct > 0 ? `${pct}%` : "—"}</span>
                </div>
              );
            })}
            <div style={{ textAlign: "right", color: C.dim, fontFamily: mono, fontSize: 8 }}>{c.total}</div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
          background: C.surface, borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.dim, fontSize: 7, fontFamily: mono, fontWeight: 700 }}>AVG SF</div>
          <div />
          {inventory.map(u => (
            <div key={u.key} style={{ textAlign: "right" }}>
              <span style={{ color: u.avgSF > 0 ? u.color : C.faint, fontFamily: mono, fontSize: 8, fontWeight: 600 }}>
                {u.avgSF > 0 ? `${u.avgSF}` : "—"}
              </span>
            </div>
          ))}
          <div />
        </div>
      </div>
    </div>
  );
}

function PropertyDrillDown({ selectedType, onSelect, comps }: { selectedType: UnitKey; onSelect: (k: UnitKey) => void; comps: CompData[] }) {
  const ut = UT_META.find(u => u.key === selectedType)!;
  const rows = comps.filter(c => c.units[selectedType].mix > 0)
    .sort((a, b) => a.units[selectedType].vac - b.units[selectedType].vac);
  const gridTpl = "1fr 32px 44px 52px 56px 48px 56px 60px";

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M15" title="Property Drill-Down" right={
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>sorted by vac ↑</span>
          <UnitTypeToggle selected={selectedType} onSelect={onSelect} />
        </div>
      } />

      <div style={{ display: "grid", gridTemplateColumns: gridTpl,
        padding: "3px 8px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        {["PROPERTY","CLS","MIX","AVG SF","VAC","DOM","CONC","RENT"].map((h, i) => (
          <div key={i} style={{ color: C.faint, fontSize: 7, fontFamily: mono, fontWeight: 700,
            letterSpacing: "0.05em", textAlign: i > 0 ? "right" : "left" }}>{h}</div>
        ))}
      </div>

      {rows.map((c, i) => {
        const u = c.units[selectedType];
        const sigCol = u.vac <= SIG.vac.hot ? C.green : u.vac <= SIG.vac.warm ? C.yellow : C.red;
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridTpl,
            padding: "3px 8px", borderBottom: `1px solid ${C.border}40`,
            background: i % 2 === 0 ? "transparent" : "#1A1F2E10", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: sigCol, fontSize: 5 }}>●</span>
              <span style={{ color: C.text, fontSize: 9 }}>{c.name}</span>
            </div>
            <div style={{ textAlign: "right", color: C.dim, fontSize: 8, fontFamily: mono }}>{c.cls}</div>
            <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.mix}%</div>
            <div style={{ textAlign: "right", color: C.dim, fontFamily: mono, fontSize: 9 }}>{u.sf > 0 ? `${u.sf} SF` : "—"}</div>
            <div style={{ textAlign: "right", color: sigColor(u.vac, "vac"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.vac}%</div>
            <div style={{ textAlign: "right", color: sigColor(u.dom, "dom"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.dom}d</div>
            <div style={{ textAlign: "right", color: sigColor(u.conc, "conc"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{u.conc}wk</div>
            <div style={{ textAlign: "right", color: C.text, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>${u.rent.toLocaleString()}</div>
          </div>
        );
      })}
      <div style={{ padding: "3px 8px", background: C.bg, display: "flex", gap: 8 }}>
        <span style={{ color: C.green, fontSize: 7, fontFamily: mono }}>● HOT vac≤3%</span>
        <span style={{ color: C.yellow, fontSize: 7, fontFamily: mono }}>● WARM vac≤6%</span>
        <span style={{ color: C.red, fontSize: 7, fontFamily: mono }}>● SOFT vac&gt;6%</span>
      </div>
    </div>
  );
}

function TrendDetail({ selectedType, onSelect, trendData }: { selectedType: UnitKey; onSelect: (k: UnitKey) => void; trendData: typeof TREND_DATA }) {
  const ut = UT_META.find(u => u.key === selectedType)!;
  const data = trendData[selectedType];
  const metrics = [
    { key: "vac",  label: "VACANCY",    color: C.red,    fmt: (v: number) => `${v}%`  },
    { key: "dom",  label: "DOM",         color: C.yellow, fmt: (v: number) => `${v}d`  },
    { key: "rent", label: "AVG RENT",    color: C.green,  fmt: (v: number) => `$${v.toLocaleString()}`  },
    { key: "conc", label: "CONCESSIONS", color: C.studio, fmt: (v: number) => `${v}wk` },
  ];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05" title="12-Month Trends" right={
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>submarket avg</span>
          <UnitTypeToggle selected={selectedType} onSelect={onSelect} />
        </div>
      } />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: C.border }}>
        {metrics.map(m => {
          const first = data[0][m.key], last = data[data.length-1][m.key];
          const delta = last - first;
          const good = m.key === "rent" ? delta > 0 : delta < 0;
          return (
            <div key={m.key} style={{ background: C.bg, padding: "4px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ color: C.dim, fontSize: 7, fontFamily: mono, letterSpacing: "0.05em" }}>{m.label}</span>
                <div style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                  <span style={{ color: m.color, fontFamily: mono, fontSize: 11, fontWeight: 700 }}>
                    {m.fmt(last)}
                  </span>
                  <span style={{ color: good ? C.green : C.red, fontFamily: mono, fontSize: 8 }}>
                    {delta > 0 ? "+" : ""}{m.key === "rent" ? `$${delta}` : m.key === "vac" ? `${delta}pp` : delta}
                    {good ? " ▲" : " ▼"}
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={data}>
                  <XAxis dataKey="mo" tick={{ fill: C.faint, fontSize: 7 }} axisLine={false} tickLine={false} interval={2} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey={m.key} name={m.label} stroke={m.color}
                    strokeWidth={1.2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MixMatrix({ program, comps }: { program: Program; comps: CompData[] }) {
  const gridTpl = "1fr 28px repeat(4,68px)";
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05 · M15" title="Mix Matrix" right={
        <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>program vs comp set</span>
      } />
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
        background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        {["PROPERTY","CLS",...UT_META.map(ut => ut.abbr)].map((h, i) => (
          <div key={i} style={{ color: i > 1 ? UT_META[i-2].color : C.faint, fontSize: 7,
            fontFamily: mono, fontWeight: 700, letterSpacing: "0.05em", textAlign: i > 1 ? "right" : "left" }}>{h}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
        background: C.subject + "08", borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${C.subject}` }}>
        <div>
          <span style={{ color: C.subject, fontSize: 9, fontWeight: 700 }}>★ Subject</span>
          <span style={{ color: C.faint, fontSize: 7, marginLeft: 4 }}>{program.totalUnits}u</span>
        </div>
        <div style={{ color: C.green, fontSize: 8, fontFamily: mono, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>A</div>
        {UT_META.map(ut => {
          const pct = program.units[ut.key].mix;
          const avg = compAvg(ut.key, comps);
          return (
            <div key={ut.key} style={{ textAlign: "right" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 3, alignItems: "center" }}>
                <span style={{ color: C.subject, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>{pct}%</span>
                {avg.mix > 0 && <Delt value={pct - avg.mix} unit="pp" />}
              </div>
              <div style={{ width: "100%", height: 2, background: C.muted, borderRadius: 1, overflow: "hidden", marginTop: 1 }}>
                <div style={{ width: `${Math.min(100, pct * 2)}%`, height: "100%", background: C.subject }} />
              </div>
            </div>
          );
        })}
      </div>
      {comps.map((c, ri) => (
        <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
          borderBottom: `1px solid ${C.border}40`, background: ri % 2 === 0 ? "transparent" : "#1A1F2E10",
          borderLeft: "3px solid transparent" }}>
          <div>
            <span style={{ color: C.text, fontSize: 9 }}>{c.name}</span>
            <span style={{ color: C.faint, fontSize: 7, marginLeft: 4 }}>{c.total}u·{c.built}</span>
          </div>
          <div style={{ color: c.cls==="A"?C.green:c.cls==="B+"?C.yellow:C.dim, fontSize: 8, fontFamily: mono,
            fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.cls}</div>
          {UT_META.map(ut => {
            const pct = c.units[ut.key].mix;
            return (
              <div key={ut.key} style={{ textAlign: "right" }}>
                <span style={{ color: pct===0?C.faint:C.text, fontFamily: mono, fontSize: 9, fontWeight: 600 }}>
                  {pct > 0 ? `${pct}%` : "—"}
                </span>
                <div style={{ width: "100%", height: 2, background: C.muted, borderRadius: 1, overflow: "hidden", marginTop: 1 }}>
                  <div style={{ width: `${Math.min(100, pct * 2)}%`, height: "100%", background: ut.color + "70" }} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: gridTpl, padding: "3px 8px",
        background: C.bg, borderTop: `2px solid ${C.border}` }}>
        <div style={{ color: C.dim, fontSize: 9, fontWeight: 700 }}>Comp Average</div>
        <div />
        {UT_META.map(ut => (
          <div key={ut.key} style={{ textAlign: "right", color: ut.color,
            fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
            {compAvg(ut.key, comps).mix.toFixed(1)}%
          </div>
        ))}
      </div>
    </div>
  );
}

function RentSFScatter({ program, filterUT, setFilterUT, comps }: { program: Program; filterUT: string; setFilterUT: (v: string) => void; comps: CompData[] }) {
  const all = buildScatter(program, comps);
  const pts = filterUT === "all" ? all : all.filter(p => p.utKey === filterUT);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05 · M15" title="Rent vs Unit Size" right={
        <UnitTypeToggle selected={filterUT} onSelect={setFilterUT} size="lg" />
      } />
      <div style={{ padding: "4px 8px" }}>
        <ResponsiveContainer width="100%" height={160}>
          <ScatterChart margin={{ top: 4, right: 12, bottom: 14, left: 4 }}>
            <CartesianGrid stroke={C.faint} strokeDasharray="3 3" strokeOpacity={0.15} />
            <XAxis type="number" dataKey="x" name="SF" domain={["dataMin - 60","dataMax + 60"]}
              tick={{ fill: C.dim, fontSize: 8, fontFamily: mono }} tickLine={false} axisLine={{ stroke: C.muted }}
              label={{ value: "SF", position: "insideBottom", offset: -8, fill: C.faint, fontSize: 7 }} />
            <YAxis type="number" dataKey="y" name="Rent" domain={[1000,"dataMax + 200"]}
              tick={{ fill: C.dim, fontSize: 8, fontFamily: mono }} tickLine={false} axisLine={{ stroke: C.muted }}
              tickFormatter={v => `$${(v/1000).toFixed(1)}k`}
              label={{ value: "$/mo", angle: -90, position: "insideLeft", offset: 8, fill: C.faint, fontSize: 7 }} />
            <ZAxis range={[30,30]} />
            <Tooltip content={<ScatterTip />} />
            {UT_META.map(ut => {
              const d = pts.filter(p => p.utKey===ut.key && !p.isSubject);
              return d.length ? <Scatter key={ut.key} data={d} shape={<ScatterDot />} /> : null;
            })}
            <Scatter data={pts.filter(p => p.isSubject)} shape={<ScatterDot />} />
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 10, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
          {UT_META.map(ut => (
            <div key={ut.key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: ut.color, opacity: 0.7 }} />
              <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>{ut.abbr}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.subject,
              border: "1.5px solid white", boxSizing: "border-box" }} />
            <span style={{ color: C.subject, fontSize: 7, fontFamily: mono, fontWeight: 700 }}>Subject</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompTable({ program, utKey, setUtKey, comps }: { program: Program; utKey: UnitKey; setUtKey: (k: UnitKey) => void; comps: CompData[] }) {
  const ut  = UT_META.find(u => u.key === utKey) || UT_META[1];
  const su  = program.units[ut.key];
  const avg = compAvg(ut.key, comps);
  const gridTpl = "1fr 36px 56px 64px 44px 44px 40px 40px 56px";

  function PosTag({ rent }: { rent: number }) {
    if (!rent || !avg.rent) return <span style={{ color: C.faint, fontSize: 7 }}>—</span>;
    const pct = (rent - avg.rent) / avg.rent * 100;
    const color = pct > 3 ? C.green : pct < -3 ? C.red : C.yellow;
    return (
      <div style={{ textAlign: "right" }}>
        <span style={{ color, fontFamily: mono, fontSize: 7, fontWeight: 700 }}>
          {pct > 3 ? "PREM" : pct < -3 ? "DISC" : "MKT"}
        </span>
        <div style={{ color, fontFamily: mono, fontSize: 7 }}>
          {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 4, overflow: "hidden" }}>
      <SectionHeader mod="M05 · M15" title="Comp Detail" right={
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: C.dim, fontSize: 7, fontFamily: mono }}>subject = live program</span>
          <UnitTypeToggle selected={utKey} onSelect={setUtKey} />
        </div>
      } />

      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 4, padding: "3px 8px",
        background: C.bg, borderBottom: `1px solid ${C.border}` }}>
        {["PROPERTY","MIX","SF","RENT","$/SF","VAC","DOM","CONC","POS"].map((h, i) => (
          <div key={i} style={{ color: C.faint, fontSize: 7, fontFamily: mono, fontWeight: 700,
            letterSpacing: "0.05em", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 4, padding: "3px 8px",
        background: C.subject + "08", borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${C.subject}`, alignItems: "center" }}>
        <div>
          <span style={{ color: C.subject, fontSize: 9, fontWeight: 700 }}>★ Subject</span>
          <span style={{ color: C.faint, fontSize: 7, marginLeft: 3 }}>Proposed</span>
        </div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{su.mix}%</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.subject, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{su.sf.toLocaleString()}</div>
          {avg.sf > 0 && <Delt value={su.sf - avg.sf} />}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.subject, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>${su.rent.toLocaleString()}</div>
          {avg.rent > 0 && <Delt value={su.rent - avg.rent} unit="$" />}
        </div>
        <div style={{ textAlign: "right", color: C.subject, fontFamily: mono, fontSize: 8 }}>
          {su.sf ? `$${(su.rent/su.sf).toFixed(2)}` : "—"}
        </div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 8 }}>—</div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 8 }}>—</div>
        <div style={{ textAlign: "right", color: C.faint, fontSize: 8 }}>—</div>
        <PosTag rent={su.rent} />
      </div>

      {comps.filter(c => c.units[ut.key].mix > 0 || c.units[ut.key].sf > 0).map((c, ri) => {
        const u = c.units[ut.key];
        const psf = u.sf ? +(u.rent/u.sf).toFixed(2) : null;
        return (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 4,
            padding: "3px 8px", borderBottom: `1px solid ${C.border}40`,
            background: ri%2===0 ? "transparent" : "#1A1F2E10",
            borderLeft: "3px solid transparent", alignItems: "center" }}>
            <div>
              <span style={{ color: C.text, fontSize: 9 }}>{c.name}</span>
              <span style={{ color: C.faint, fontSize: 7, marginLeft: 3 }}>{c.built}·{c.cls}</span>
            </div>
            <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
              {u.mix > 0 ? `${u.mix}%` : "—"}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.text, fontFamily: mono, fontSize: 9 }}>{u.sf > 0 ? u.sf.toLocaleString() : "—"}</div>
              {u.sf > 0 && avg.sf > 0 && <Delt value={u.sf - avg.sf} />}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.text, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
                {u.rent > 0 ? `$${u.rent.toLocaleString()}` : "—"}
              </div>
              {u.rent > 0 && avg.rent > 0 && <Delt value={u.rent - avg.rent} unit="$" />}
            </div>
            <div style={{ textAlign: "right", color: C.dim, fontFamily: mono, fontSize: 8 }}>
              {psf ? `$${psf}` : "—"}
            </div>
            <div style={{ textAlign: "right", color: sigColor(u.vac,"vac"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
              {u.vac > 0 ? `${u.vac}%` : "—"}
            </div>
            <div style={{ textAlign: "right", color: sigColor(u.dom,"dom"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
              {u.dom > 0 ? `${u.dom}d` : "—"}
            </div>
            <div style={{ textAlign: "right", color: sigColor(u.conc,"conc"), fontFamily: mono, fontSize: 9, fontWeight: 700 }}>
              {u.conc > 0 ? `${u.conc}wk` : "—"}
            </div>
            <PosTag rent={u.rent} />
          </div>
        );
      })}

      <div style={{ display: "grid", gridTemplateColumns: gridTpl, gap: 4, padding: "3px 8px",
        background: C.bg, borderTop: `2px solid ${C.border}`, alignItems: "center" }}>
        <div style={{ color: C.dim, fontSize: 9, fontWeight: 700 }}>Comp Avg</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{avg.mix.toFixed(1)}%</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{avg.sf.toLocaleString()}</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>${avg.rent.toLocaleString()}</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 8, fontWeight: 700 }}>{avg.sf ? `$${(avg.rent/avg.sf).toFixed(2)}` : "—"}</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{avg.vac.toFixed(1)}%</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{Math.round(avg.dom)}d</div>
        <div style={{ textAlign: "right", color: ut.color, fontFamily: mono, fontSize: 9, fontWeight: 700 }}>{avg.conc.toFixed(1)}wk</div>
        <div />
      </div>
    </div>
  );
}

export {
  DemandMatrix, GapAnalysis, ProgramEditor, ZoningPanel, InventorySnapshot,
  PropertyDrillDown, TrendDetail, MixMatrix, RentSFScatter, CompTable,
  computeOptimalProgram, computeProgram, computeInventory, computeGaps,
  compAvg, buildScatter, demandLabel, COMPS, TREND_DATA, PROGRAM_SEED, ZONING_SEED,
  UT_META, C as UMC,
};
export type { Program, UnitKey, CompData, ZoningData, ProgramUnit, InventoryItem, GapItem };

export default function UnitMixIntelligence() {
  const { dealId } = useParams<{ dealId: string }>();
  const { activeTradeArea } = useTradeAreaStore();
  const tradeAreaId = activeTradeArea?.id;
  const developmentEnvelope = useDealStore(s => s.developmentEnvelope);
  const dealType = useDealType();

  const {
    comps: apiComps, demandScores: apiDemandScores, trends: apiTrends,
    zoning: apiZoning, program: apiProgram, loading, error,
    handleProgramChange: saveProgram, pushToProforma,
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
  const hasDbProgramRef = useRef(false);

  useEffect(() => {
    if (loading || initializedRef.current) return;
    initializedRef.current = true;
    if (apiZoning) setZoning(apiZoning as ZoningData);

    const hasSaved = apiProgram && typeof apiProgram === 'object' && 'totalUnits' in apiProgram && (apiProgram as Program).totalUnits > 0;
    if (hasSaved) {
      hasDbProgramRef.current = true;
      setProgram(apiProgram as Program);
    } else {
      const seedUnits = developmentEnvelope?.max_units || PROGRAM_SEED.totalUnits;
      const optimal = computeOptimalProgram(seedUnits, comps, {
        zoning: apiZoning as ZoningData || undefined,
      });
      setProgram(optimal);
    }
  }, [loading, apiZoning, apiProgram]);

  useEffect(() => {
    if (!developmentEnvelope?.max_units || !initializedRef.current || hasDbProgramRef.current) return;
    const newUnits = developmentEnvelope.max_units;
    setProgram(prev => prev.totalUnits === newUnits ? prev : { ...prev, totalUnits: newUnits });
  }, [developmentEnvelope?.max_units]);

  const handleProgramChange = (p: Program) => {
    setProgram(p);
    hasDbProgramRef.current = true;
    saveProgram(p);
  };

  const computed   = computeProgram(program);
  const inventory  = computeInventory(comps);
  const gaps       = computeGaps(inventory);

  const dealTypeLabel = dealType === 'development' ? 'GROUND-UP' : dealType === 'redevelopment' ? 'REDEV' : 'EXISTING';
  const programLabel = dealType === 'existing' ? '✏ Review Mix' : dealType === 'redevelopment' ? '✏ Reconfig Mix' : '✏ Program';
  const tabs = [
    { id: "demand",    label: "Demand"    },
    { id: "program",   label: programLabel },
    { id: "inventory", label: "Inventory" },
    { id: "trends",    label: "Trends"    },
    { id: "comps",     label: "Comps"     },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh",
      fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text, paddingBottom: 40 }}>

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "6px 10px 0", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 1 }}>
              <span style={{ color: C.blue, fontFamily: mono, fontSize: 7, fontWeight: 700, letterSpacing: "0.08em" }}>M02 · M05 · M07 · M15</span>
              <span style={{ color: C.border }}>|</span>
              <span style={{ color: C.faint, fontFamily: mono, fontSize: 7 }}>UNIT MIX INTELLIGENCE · {dealTypeLabel}</span>
            </div>
            <h1 style={{ color: C.text, fontSize: 13, fontWeight: 800, margin: 0 }}>
              Unit Mix & Pricing Intelligence
            </h1>
            <p style={{ color: C.dim, fontSize: 8, margin: "1px 0 0" }}>
              Trade Area · {comps.length} comps ·{" "}
              {comps.reduce((s, c) => s + c.total, 0).toLocaleString()} tracked units ·
              Zoning: <span style={{ color: C.blue }}>{zoning.zoningCode}</span>
            </p>
          </div>

          <div style={{ display: "flex", gap: 3 }}>
            {gaps.map(g => {
              const color = g.gap > 2 ? C.green : g.gap < -2 ? C.red : C.yellow;
              const dl = demandLabel(g.demandScore);
              return (
                <div key={g.key} style={{ background: color+"10", border: `1px solid ${color}30`,
                  borderRadius: 3, padding: "3px 6px", textAlign: "center" }}>
                  <div style={{ color: g.color, fontFamily: mono, fontSize: 7, fontWeight: 700 }}>{g.abbr}</div>
                  <div style={{ color, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>
                    {g.gap > 0 ? "+" : ""}{g.gap.toFixed(1)}pp
                  </div>
                  <div style={{ color: dl.color, fontSize: 7, fontFamily: mono }}>
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
              padding: "4px 10px", marginBottom: -1,
              color: tab === t.id ? C.text : C.dim,
              fontSize: 9, fontWeight: tab === t.id ? 700 : 400,
              fontFamily: mono,
              cursor: "pointer", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>

        {tab === "demand" && (
          <>
            <DemandMatrix inventory={inventory} trendData={trendData} />
            <GapAnalysis gaps={gaps} />
          </>
        )}

        {tab === "program" && (
          <>
            <ZoningPanel zoning={zoning} program={program} computed={computed} onZoningChange={setZoning} />
            <ProgramEditor program={program} computed={computed} zoning={zoning} onProgramChange={handleProgramChange} comps={comps}
              readOnly={dealType === 'existing'}
              onPushToProforma={async (p) => {
                const result = await pushToProforma(p);
                return result;
              }} />
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
