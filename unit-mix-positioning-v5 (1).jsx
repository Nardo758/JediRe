import { useState, useMemo } from "react";

const PROPERTY = {
  name: "Exchange at Holly Springs", asOf: "12/16/2025",
  totalUnits: 320, occupied: 303, vacant: 17, onNotice: 14, mtm: 6,
  currentRank: 28, projectedRank: 9, totalComps: 41,
  pcs: 52.4, projPcs: 78.1, strategy: "Value-Add Repositioning",
  preNOI: 3420000, preBasis: 42000000, postNOI: 4180000, postBasis: 46100000,
};

const FP = [
  { code: "A1A", beds: 1, units: 34, sqft: 711, market: 1255, actual: 1299, ltl: -44, vacant: 0, notice: 0, renoRent: 1420, renoCost: 14500, renoUnits: 20, timeline: "Mo 1–8" },
  { code: "A1B", beds: 1, units: 51, sqft: 737, market: 1389, actual: 1364, ltl: 26, vacant: 1, notice: 4, renoRent: 1525, renoCost: 15000, renoUnits: 30, timeline: "Mo 1–12" },
  { code: "A1C", beds: 1, units: 12, sqft: 788, market: 1403, actual: 1359, ltl: 40, vacant: 1, notice: 0, renoRent: 1550, renoCost: 16000, renoUnits: 8, timeline: "Mo 3–10" },
  { code: "A1D", beds: 1, units: 12, sqft: 793, market: 1387, actual: 1302, ltl: 84, vacant: 2, notice: 1, renoRent: 1540, renoCost: 16000, renoUnits: 10, timeline: "Mo 2–10" },
  { code: "A1E", beds: 1, units: 24, sqft: 822, market: 1465, actual: 1367, ltl: 98, vacant: 0, notice: 3, renoRent: 1600, renoCost: 17000, renoUnits: 16, timeline: "Mo 4–14" },
  { code: "A1F", beds: 1, units: 4, sqft: 849, market: 1443, actual: 1320, ltl: 123, vacant: 1, notice: 0, renoRent: 1610, renoCost: 17500, renoUnits: 3, timeline: "Mo 6–10" },
  { code: "B1A", beds: 1, units: 12, sqft: 1023, market: 1515, actual: 1578, ltl: -64, vacant: 0, notice: 0, renoRent: 1720, renoCost: 19000, renoUnits: 8, timeline: "Mo 6–14" },
  { code: "B1B", beds: 1, units: 4, sqft: 1104, market: 1553, actual: 1653, ltl: -100, vacant: 1, notice: 0, renoRent: 1780, renoCost: 20000, renoUnits: 3, timeline: "Mo 8–14" },
  { code: "B2A", beds: 2, units: 37, sqft: 953, market: 1805, actual: 1554, ltl: 255, vacant: 3, notice: 0, renoRent: 1875, renoCost: 21000, renoUnits: 24, timeline: "Mo 1–14" },
  { code: "B2B", beds: 2, units: 12, sqft: 1031, market: 1655, actual: 1528, ltl: 127, vacant: 0, notice: 0, renoRent: 1780, renoCost: 20000, renoUnits: 8, timeline: "Mo 4–12" },
  { code: "B2C", beds: 2, units: 48, sqft: 1168, market: 1742, actual: 1629, ltl: 111, vacant: 2, notice: 2, renoRent: 1890, renoCost: 22000, renoUnits: 32, timeline: "Mo 1–18" },
  { code: "B2D", beds: 2, units: 9, sqft: 1208, market: 1941, actual: 1852, ltl: 90, vacant: 1, notice: 0, renoRent: 2080, renoCost: 23000, renoUnits: 6, timeline: "Mo 6–14" },
  { code: "B2E", beds: 2, units: 22, sqft: 1266, market: 1776, actual: 1660, ltl: 116, vacant: 0, notice: 2, renoRent: 1920, renoCost: 22500, renoUnits: 14, timeline: "Mo 4–16" },
  { code: "C2A", beds: 2, units: 22, sqft: 1245, market: 1974, actual: 1821, ltl: 155, vacant: 4, notice: 0, renoRent: 2120, renoCost: 24000, renoUnits: 16, timeline: "Mo 3–16" },
  { code: "C2B", beds: 2, units: 6, sqft: 1264, market: 2007, actual: 1831, ltl: 178, vacant: 1, notice: 1, renoRent: 2150, renoCost: 24000, renoUnits: 4, timeline: "Mo 8–14" },
  { code: "C2C", beds: 2, units: 11, sqft: 1344, market: 1832, actual: 1893, ltl: -61, vacant: 0, notice: 0, renoRent: 2060, renoCost: 23000, renoUnits: 7, timeline: "Mo 10–16" },
];

const COMPS = [
  { name: "Advenir at Walden Lake", units: 384, avgSF: 1085, vintage: 2017, cls: "A", r1br: 1725, r2br: 2175, occ: 96.1, pcs: 88.2, rank: 3, projRank: 3 },
  { name: "Altis Grand Suncoast", units: 298, avgSF: 1042, vintage: 2021, cls: "A", r1br: 1690, r2br: 2120, occ: 95.8, pcs: 85.7, rank: 5, projRank: 5 },
  { name: "Enclave at Indian River", units: 256, avgSF: 1010, vintage: 2015, cls: "A-", r1br: 1620, r2br: 2050, occ: 95.2, pcs: 81.3, rank: 7, projRank: 7 },
  { name: "Reserve at Port St. Lucie", units: 340, avgSF: 998, vintage: 2012, cls: "B+", r1br: 1580, r2br: 1975, occ: 94.5, pcs: 77.8, rank: 8, projRank: 10 },
  { name: "Exchange at Holly Springs", units: 320, avgSF: 978, vintage: 2004, cls: "B", r1br: 1367, r2br: 1700, occ: 94.7, pcs: 52.4, rank: 28, projRank: 9, isSubject: true, projR1br: 1528, projR2br: 1920, projOcc: 96.0, projPcs: 78.1 },
  { name: "Savannah Lakes", units: 220, avgSF: 965, vintage: 2009, cls: "B", r1br: 1520, r2br: 1920, occ: 94.1, pcs: 72.1, rank: 12, projRank: 13 },
  { name: "Tradition at PSL", units: 188, avgSF: 940, vintage: 2006, cls: "B", r1br: 1480, r2br: 1880, occ: 93.2, pcs: 68.4, rank: 15, projRank: 16 },
  { name: "Gardens at Sandpiper", units: 276, avgSF: 920, vintage: 2001, cls: "B-", r1br: 1380, r2br: 1780, occ: 91.8, pcs: 61.2, rank: 20, projRank: 21 },
  { name: "Lake Forest Apartments", units: 196, avgSF: 895, vintage: 1998, cls: "C+", r1br: 1290, r2br: 1650, occ: 90.4, pcs: 48.8, rank: 30, projRank: 30 },
  { name: "Palm Grove Village", units: 164, avgSF: 860, vintage: 1996, cls: "C", r1br: 1180, r2br: 1520, occ: 88.6, pcs: 42.1, rank: 35, projRank: 35 },
];

const OTHER_INCOME = [
  { label: "Cable/Internet", total: 23542 }, { label: "Trash/Valet", total: 7500 },
  { label: "Garage", total: 3850 }, { label: "Pet Rent", total: 2000 },
  { label: "Pest Control", total: 1192 }, { label: "Storage", total: 1130 },
];

const LEASE_EXP = [
  { p: "Q4'25", u: 10 }, { p: "Q1'26", u: 41 }, { p: "Q2'26", u: 89 },
  { p: "Q3'26", u: 106 }, { p: "Q4'26", u: 33 }, { p: "Q1'27", u: 16 },
];

const TRAFFIC = {
  currentDigitalShare: 3.2, targetDigitalShare: 6.5, top10AvgDigitalShare: 7.8,
  currentAADT: 18400, submarketAvgAADT: 21200,
  currentWalkIns: 842, targetWalkIns: 1380,
  weeklyGoogleSearches: 2100, targetGoogleSearches: 4200,
  corridorPeak: "US-1 / Holly Springs Blvd", peakHours: "7–9 AM, 4–7 PM",
};

const f = n => n?.toLocaleString("en-US") ?? "—";
const fc = n => `$${n?.toLocaleString("en-US") ?? "0"}`;
const fk = n => `$${(n / 1000).toFixed(1)}K`;

const K = {
  bg: "#0B0E13", s: "rgba(255,255,255,0.025)", sh: "rgba(255,255,255,0.04)",
  b: "rgba(255,255,255,0.06)", bh: "rgba(255,255,255,0.12)",
  t: "#E8E6E1", tm: "rgba(232,230,225,0.5)", td: "rgba(232,230,225,0.22)",
  a: "#63B3ED", ad: "rgba(99,179,237,0.08)",
  g: "#68D391", gd: "rgba(104,211,145,0.08)",
  r: "#FC8181", rd: "rgba(252,129,129,0.08)",
  y: "#F6E05E", yd: "rgba(246,224,94,0.08)",
  p: "#B794F4", pd: "rgba(183,148,244,0.08)",
  m: "'JetBrains Mono', monospace", f: "'DM Sans', sans-serif",
};

// ── COMPACT UNIT CARD ───────────────────────────────────────
function UnitCard({ plan, selected, onSelect, compRents }) {
  const premium = plan.renoRent - plan.actual;
  const col = plan.beds === 1 ? K.a : K.p;
  const occ = ((plan.units - plan.vacant) / plan.units * 100);
  const occC = occ >= 95 ? K.g : occ >= 90 ? K.y : K.r;
  const cRents = compRents.map(c => plan.beds === 1 ? c.r1br : c.r2br);
  const cMin = Math.min(...cRents) - 30, cMax = Math.max(...cRents) + 80, cRange = cMax - cMin;
  const cAvg = cRents.reduce((s, r) => s + r, 0) / cRents.length;
  const pos = v => Math.max(2, Math.min(98, ((v - cMin) / cRange) * 100));

  return (
    <div onClick={onSelect} style={{
      background: K.s, border: `1px solid ${selected ? col + "40" : K.b}`,
      borderRadius: 7, padding: selected ? "10px 12px" : "8px 12px", cursor: "pointer",
      transition: "all 0.15s", position: "relative",
    }}>
      {/* Single-line header + metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "70px 34px 1fr 52px 52px 52px 42px 34px", gap: 4, alignItems: "center" }}>
        {/* Plan code + bed badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: col, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: K.m }}>{plan.code}</span>
          <span style={{ fontSize: 8.5, color: K.td }}>{plan.beds}B</span>
        </div>
        <span style={{ fontSize: 9.5, fontFamily: K.m, color: K.td, textAlign: "center" }}>{plan.units}u</span>
        {/* Comp positioning mini bar */}
        <div style={{ position: "relative", height: 10 }}>
          <div style={{ position: "absolute", top: 4, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
          {cRents.map((r, i) => (
            <div key={i} style={{ position: "absolute", left: `${pos(r)}%`, top: 3, width: 4, height: 5, borderRadius: 1, background: "rgba(255,255,255,0.07)", transform: "translateX(-50%)" }} />
          ))}
          <div style={{ position: "absolute", left: `${pos(cAvg)}%`, top: 1, width: 1, height: 9, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ position: "absolute", left: `${pos(plan.actual)}%`, top: 2, width: 7, height: 7, borderRadius: "50%", background: "rgba(232,230,225,0.4)", border: `1.5px solid ${K.bg}`, transform: "translateX(-50%)", zIndex: 2 }} />
          <div style={{ position: "absolute", left: `${pos(plan.renoRent)}%`, top: 2, width: 7, height: 7, borderRadius: "50%", background: col, border: `1.5px solid ${K.bg}`, transform: "translateX(-50%)", zIndex: 3 }} />
          {plan.renoRent > plan.actual && (
            <div style={{ position: "absolute", left: `${pos(plan.actual)}%`, top: 5, width: `${pos(plan.renoRent) - pos(plan.actual)}%`, height: 1.5, background: `linear-gradient(90deg, rgba(232,230,225,0.1), ${col}50)`, zIndex: 1 }} />
          )}
        </div>
        <span style={{ fontSize: 10, fontFamily: K.m, color: K.tm, textAlign: "right" }}>{fc(plan.actual)}</span>
        <span style={{ fontSize: 10, fontFamily: K.m, fontWeight: 600, color: col, textAlign: "right" }}>{fc(plan.renoRent)}</span>
        <span style={{ fontSize: 10, fontFamily: K.m, fontWeight: 600, color: K.g, textAlign: "right" }}>+{fc(premium)}</span>
        <span style={{ fontSize: 9, fontFamily: K.m, fontWeight: 600, color: plan.ltl > 0 ? K.r : K.g, textAlign: "right" }}>
          {plan.ltl > 0 ? "+" : ""}{fc(plan.ltl)}
        </span>
        <span style={{ fontSize: 9, fontFamily: K.m, fontWeight: 600, color: occC, textAlign: "right" }}>{occ.toFixed(0)}%</span>
      </div>

      {/* Expanded detail */}
      {selected && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: `${col}08`, borderRadius: 5, border: `1px solid ${col}15` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {[
              { l: "SF", v: f(plan.sqft) }, { l: "MKT RENT", v: fc(plan.market) },
              { l: "RENO UNITS", v: `${plan.renoUnits} of ${plan.units}` }, { l: "COST/UNIT", v: fk(plan.renoCost), c: col },
              { l: "ANNUAL UPLIFT", v: `+${fc(premium * plan.renoUnits * 12)}`, c: K.g }, { l: "TIMELINE", v: plan.timeline },
            ].map(x => (
              <div key={x.l}>
                <div style={{ fontSize: 7.5, color: K.td, fontFamily: K.m, letterSpacing: 0.5 }}>{x.l}</div>
                <div style={{ fontSize: 11, fontWeight: 600, fontFamily: K.m, color: x.c || K.t }}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────
export default function UnitMixPositioning() {
  const [activeView, setActiveView] = useState("pre");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [bedFilter, setBedFilter] = useState("all");

  const totalOI = OTHER_INCOME.reduce((s, x) => s + x.total, 0);
  const totalRenoUnits = FP.reduce((s, p) => s + p.renoUnits, 0);
  const totalRenoCost = FP.reduce((s, p) => s + p.renoCost * p.renoUnits, 0);
  const totalAnnualUplift = FP.reduce((s, p) => s + (p.renoRent - p.actual) * p.renoUnits * 12, 0);
  const blendedPremium = Math.round(FP.reduce((s, p) => s + (p.renoRent - p.actual) * p.renoUnits, 0) / totalRenoUnits);
  const preYOC = ((PROPERTY.preNOI / PROPERTY.preBasis) * 100).toFixed(2);
  const postYOC = ((PROPERTY.postNOI / PROPERTY.postBasis) * 100).toFixed(2);
  const yocOnReno = ((totalAnnualUplift / totalRenoCost) * 100).toFixed(1);
  const filtered = bedFilter === "all" ? FP : FP.filter(p => p.beds === parseInt(bedFilter));
  const sortedComps = [...COMPS].sort((a, b) => (activeView === "pre" ? a.rank : a.projRank) - (activeView === "pre" ? b.rank : b.projRank));
  const compGridCols = "28px 1fr 40px 42px 52px 52px 44px 60px 36px";

  return (
    <div style={{ minHeight: "100vh", background: K.bg, color: K.t, fontFamily: K.f }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${K.b}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.3px" }}>{PROPERTY.name}</h1>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: K.ad, color: K.a }}>🔄 {PROPERTY.strategy}</span>
            </div>
            <div style={{ fontSize: 11, color: K.tm, display: "flex", gap: 14 }}>
              <span>{PROPERTY.totalUnits} Units</span><span style={{ color: K.td }}>|</span>
              <span>{FP.length} Plans</span><span style={{ color: K.td }}>|</span>
              <span style={{ color: K.g }}>{PROPERTY.occupied} Occ</span><span style={{ color: K.td }}>|</span>
              <span style={{ color: K.r }}>{PROPERTY.vacant} Vacant</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: K.m, color: K.tm }}>#{PROPERTY.currentRank}</div>
              <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>CURRENT</div>
            </div>
            <svg width="28" height="16" viewBox="0 0 28 16"><path d="M2 13 L12 8 L24 3" stroke={K.g} strokeWidth="2" fill="none" strokeLinecap="round" /><polygon points="24,3 19,2 20,7" fill={K.g} /></svg>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: K.m, color: K.g }}>#{PROPERTY.projectedRank}</div>
              <div style={{ fontSize: 8, color: `${K.g}80`, letterSpacing: 1, fontFamily: K.m }}>PROJECTED</div>
            </div>
            <div style={{ fontSize: 9, color: K.td }}>of {PROPERTY.totalComps}</div>
          </div>
        </div>
      </div>

      {/* ═══ STRATEGY SUMMARY BANNER ═══ */}
      <div style={{ padding: "10px 24px 12px" }}>
        <div style={{
          padding: "14px 20px", borderRadius: 10,
          background: "linear-gradient(135deg, rgba(99,179,237,0.04), rgba(104,211,145,0.04), rgba(183,148,244,0.02))",
          border: `1px solid rgba(99,179,237,0.08)`,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 8px 1fr 1fr", gap: 14, alignItems: "center" }}>
            {[
              { l: "RENO SCOPE", v: totalRenoUnits, s: `of ${PROPERTY.totalUnits}` },
              { l: "TOTAL CAPEX", v: `$${(totalRenoCost / 1e6).toFixed(2)}M`, c: K.a, s: `${fc(Math.round(totalRenoCost / totalRenoUnits))}/unit` },
              { l: "BLENDED PREMIUM", v: `+${fc(blendedPremium)}`, c: K.g, s: "per unit / mo" },
              { l: "ANNUAL UPLIFT", v: `+$${(totalAnnualUplift / 1000).toFixed(0)}K`, c: K.g, s: "incremental NOI" },
            ].map(x => (
              <div key={x.l}>
                <div style={{ fontSize: 8, color: K.td, letterSpacing: 0.8, fontFamily: K.m, marginBottom: 2 }}>{x.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: x.c || K.t }}>{x.v}</div>
                {x.s && <div style={{ fontSize: 9, color: K.tm }}>{x.s}</div>}
              </div>
            ))}
            <div style={{ background: K.b, width: 1, height: 40, justifySelf: "center" }} />
            <div style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: `1px solid ${K.b}` }}>
              <div style={{ fontSize: 8, color: K.td, letterSpacing: 0.8, fontFamily: K.m, marginBottom: 2 }}>PRE-STRATEGY YOC</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: K.tm }}>{preYOC}%</div>
              <div style={{ fontSize: 9, color: K.td }}>${(PROPERTY.preNOI / 1e6).toFixed(2)}M / ${(PROPERTY.preBasis / 1e6).toFixed(1)}M</div>
            </div>
            <div style={{ padding: "6px 10px", borderRadius: 6, background: K.gd, border: `1px solid ${K.g}20` }}>
              <div style={{ fontSize: 8, color: `${K.g}80`, letterSpacing: 0.8, fontFamily: K.m, marginBottom: 2 }}>POST-STRATEGY YOC</div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: K.g }}>{postYOC}%</div>
              <div style={{ fontSize: 9, color: K.tm }}>${(PROPERTY.postNOI / 1e6).toFixed(2)}M / ${(PROPERTY.postBasis / 1e6).toFixed(1)}M</div>
              <div style={{ fontSize: 8, color: K.g, fontWeight: 600, fontFamily: K.m }}>Reno YOC: {yocOnReno}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TWO COLUMN: NARROW UNIT MIX | WIDE COMP SET ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%", borderTop: `1px solid ${K.b}` }}>

        {/* LEFT — Compact Unit Mix */}
        <div style={{ padding: "12px 16px", borderRight: `1px solid ${K.b}`, overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m }}>UNIT MIX · STRATEGY IMPACT</span>
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.02)", borderRadius: 5, padding: 1.5, border: `1px solid ${K.b}` }}>
              {[{ v: "all", l: "All" }, { v: "1", l: "1BR" }, { v: "2", l: "2BR" }].map(x => (
                <button key={x.v} onClick={() => setBedFilter(x.v)} style={{
                  padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600, cursor: "pointer",
                  border: "none", fontFamily: K.f,
                  background: bedFilter === x.v ? "rgba(255,255,255,0.06)" : "transparent",
                  color: bedFilter === x.v ? K.t : K.tm,
                }}>{x.l}</button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "70px 34px 1fr 52px 52px 52px 42px 34px",
            gap: 4, padding: "0 12px 4px",
            fontSize: 7.5, fontWeight: 600, letterSpacing: 0.6, color: K.td, fontFamily: K.m,
          }}>
            <span>PLAN</span><span style={{ textAlign: "center" }}>#</span><span>COMP RANGE</span>
            <span style={{ textAlign: "right" }}>IN-PLC</span><span style={{ textAlign: "right" }}>RENO</span>
            <span style={{ textAlign: "right" }}>PREM</span><span style={{ textAlign: "right" }}>LTL</span>
            <span style={{ textAlign: "right" }}>OCC</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.map(p => (
              <UnitCard key={p.code} plan={p}
                selected={selectedPlan === p.code}
                onSelect={() => setSelectedPlan(selectedPlan === p.code ? null : p.code)}
                compRents={COMPS.filter(c => !c.isSubject)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — Comp Set Power Rankings (wider) */}
        <div style={{ padding: "12px 18px", overflow: "auto", maxHeight: "calc(100vh - 280px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m }}>COMP SET · POWER RANKINGS</span>
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.02)", borderRadius: 5, padding: 1.5, border: `1px solid ${K.b}` }}>
              <button onClick={() => setActiveView("pre")} style={{
                padding: "3px 12px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                border: "none", fontFamily: K.f,
                background: activeView === "pre" ? "rgba(255,255,255,0.06)" : "transparent",
                color: activeView === "pre" ? K.t : K.tm,
              }}>Pre-Strategy</button>
              <button onClick={() => setActiveView("post")} style={{
                padding: "3px 12px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer",
                border: "none", fontFamily: K.f,
                background: activeView === "post" ? K.gd : "transparent",
                color: activeView === "post" ? K.g : K.tm,
              }}>Post-Strategy</button>
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: compGridCols,
            gap: 6, padding: "0 8px 5px",
            fontSize: 8, fontWeight: 600, letterSpacing: 0.8, color: K.td, fontFamily: K.m,
          }}>
            <span>#</span><span>PROPERTY</span><span style={{ textAlign: "center" }}>UNITS</span>
            <span style={{ textAlign: "right" }}>AVG SF</span>
            <span style={{ textAlign: "right" }}>1BR</span><span style={{ textAlign: "right" }}>2BR</span>
            <span style={{ textAlign: "right" }}>OCC</span><span style={{ textAlign: "right" }}>PCS</span>
            <span style={{ textAlign: "center" }}>Δ</span>
          </div>

          {sortedComps.map(comp => {
            const isS = comp.isSubject;
            const isP = activeView === "post";
            const rank = isP ? comp.projRank : comp.rank;
            const r1 = isS && isP ? comp.projR1br : comp.r1br;
            const r2 = isS && isP ? comp.projR2br : comp.r2br;
            const occ = isS && isP ? comp.projOcc : comp.occ;
            const pcs = isS && isP ? comp.projPcs : comp.pcs;
            const rd = comp.rank - comp.projRank;
            const pcsC = pcs >= 75 ? K.g : pcs >= 50 ? K.a : K.tm;

            return (
              <div key={comp.name} style={{
                display: "grid", gridTemplateColumns: compGridCols,
                gap: 6, alignItems: "center", padding: "7px 8px", borderRadius: 6,
                background: isS ? (isP ? `${K.g}0A` : `${K.a}0A`) : "transparent",
                border: `1px solid ${isS ? (isP ? `${K.g}20` : `${K.a}20`) : "transparent"}`,
                marginBottom: 1, transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!isS) e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                onMouseLeave={e => { if (!isS) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: K.m, fontWeight: 700, fontSize: 10,
                  background: rank <= 5 ? K.gd : rank <= 15 ? K.ad : "rgba(255,255,255,0.03)",
                  color: rank <= 5 ? K.g : rank <= 15 ? K.a : K.td,
                  border: isS ? `1px solid ${isP ? K.g + "40" : K.a + "40"}` : "none",
                }}>{rank}</div>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: isS ? 700 : 500,
                    color: isS ? (isP ? K.g : K.a) : K.t,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {comp.name}{isS && <span style={{ fontSize: 8, opacity: 0.4, marginLeft: 3 }}>★</span>}
                  </div>
                  <div style={{ fontSize: 8.5, color: K.td }}>{comp.cls} · {comp.vintage}</div>
                </div>

                <span style={{ textAlign: "center", fontFamily: K.m, fontSize: 10, color: K.tm }}>{comp.units}</span>
                <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, color: K.td }}>{f(comp.avgSF)}</span>
                <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, fontWeight: 500, color: isS && isP ? K.a : K.t }}>{fc(r1)}</span>
                <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, fontWeight: 500, color: isS && isP ? K.p : K.t }}>{fc(r2)}</span>
                <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, color: occ >= 95 ? K.g : K.tm }}>{occ}%</span>

                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                  <span style={{ fontFamily: K.m, fontSize: 9.5, fontWeight: 600, color: pcsC }}>{pcs.toFixed(1)}</span>
                  <div style={{ width: 24, height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pcs}%`, background: pcsC, borderRadius: 2, transition: "width 0.4s" }} />
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  {rd !== 0 ? (
                    <span style={{ fontFamily: K.m, fontSize: 9.5, fontWeight: 600, color: rd > 0 ? K.g : K.r }}>
                      {rd > 0 ? "▲" : "▼"}{Math.abs(rd)}
                    </span>
                  ) : <span style={{ color: K.td, fontSize: 9 }}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ BOTTOM: TRAFFIC | LEASE EXPOSURE | REVENUE (half) | OCCUPANCY (half) ═══ */}
      <div style={{ padding: "16px 24px 20px", borderTop: `1px solid ${K.b}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m, marginBottom: 12 }}>
          PERFORMANCE DRIVERS · PATH TO RANK #{PROPERTY.projectedRank}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.1fr 0.8fr 0.8fr", gap: 12, marginBottom: 14 }}>

          {/* ── TRAFFIC ── */}
          <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>🛣</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Traffic Position</span>
              </div>
              <span style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>25%</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: K.m, color: "#94A3B8" }}>68</span>
              <span style={{ fontSize: 9, color: K.td }}>/100 · Location-fixed</span>
            </div>

            {/* Digital share — controllable */}
            <div style={{ padding: "8px 10px", background: K.ad, borderRadius: 6, border: `1px solid ${K.a}20`, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: K.a }}>Digital Share ← Push here</span>
                <span style={{ fontSize: 9, fontFamily: K.m, color: K.a }}>Controllable</span>
              </div>
              <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3, marginBottom: 3 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(TRAFFIC.currentDigitalShare / TRAFFIC.top10AvgDigitalShare) * 100}%`, background: K.a, borderRadius: 3, opacity: 0.5 }} />
                <div style={{ position: "absolute", left: `${(TRAFFIC.targetDigitalShare / TRAFFIC.top10AvgDigitalShare) * 100}%`, top: -3, width: 2, height: 12, background: K.g, borderRadius: 1 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: K.m }}>
                <span style={{ color: K.tm }}>Now: {TRAFFIC.currentDigitalShare}%</span>
                <span style={{ color: K.g, fontWeight: 600 }}>Target: {TRAFFIC.targetDigitalShare}%</span>
                <span style={{ color: K.td }}>Top 10: {TRAFFIC.top10AvgDigitalShare}%</span>
              </div>
            </div>

            {/* Walk-ins */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", borderRadius: 5 }}>
                <div style={{ fontSize: 7.5, color: K.td, fontFamily: K.m }}>WALK-INS</div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: K.m }}>{f(TRAFFIC.currentWalkIns)}/mo</div>
              </div>
              <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.015)", borderRadius: 5 }}>
                <div style={{ fontSize: 7.5, color: K.td, fontFamily: K.m }}>TARGET</div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: K.m, color: K.g }}>{f(TRAFFIC.targetWalkIns)}/mo</div>
              </div>
            </div>

            <div style={{ padding: "7px 9px", background: `${K.g}08`, borderRadius: 5, border: `1px solid ${K.g}12` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: K.g, marginBottom: 3 }}>📍 PLAYBOOK</div>
              <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.5 }}>
                Double Google impressions ({f(TRAFFIC.weeklyGoogleSearches)} → {f(TRAFFIC.targetGoogleSearches)}/wk). ILS optimization + SEM on {TRAFFIC.corridorPeak} corridor ({TRAFFIC.peakHours}). Each 1% digital share ≈ +64 walk-ins/mo.
              </div>
            </div>
          </div>

          {/* ── LEASE EXPOSURE & INCOME ── */}
          <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📋</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Lease Exposure & Income</span>
              </div>
              <span style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>25%</span>
            </div>

            {/* Lease chart */}
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 52, marginBottom: 3 }}>
              {LEASE_EXP.map(e => {
                const mx = Math.max(...LEASE_EXP.map(x => x.u));
                const h = (e.u / mx) * 42;
                const hot = e.u > 60;
                return (
                  <div key={e.p} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span style={{ fontSize: 7.5, fontFamily: K.m, fontWeight: 600, color: hot ? K.y : K.td }}>{e.u}</span>
                    <div style={{ width: "100%", height: h, borderRadius: 2, background: hot ? `${K.y}40` : `${K.a}20` }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
              {LEASE_EXP.map(e => <div key={e.p} style={{ flex: 1, textAlign: "center", fontSize: 7, fontFamily: K.m, color: K.td }}>{e.p}</div>)}
            </div>

            <div style={{ padding: "5px 8px", borderRadius: 4, background: K.yd, border: `1px solid ${K.y}15`, marginBottom: 8 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: K.y }}>⚠ 195 units (64%) expire Q2–Q3 '26</div>
              <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.4, marginTop: 1 }}>Begin renewal outreach 90 days prior to capture LTL.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
              {[{ l: "MTM", v: PROPERTY.mtm, c: K.r, bg: K.rd }, { l: "NOTICE", v: PROPERTY.onNotice, c: K.y, bg: K.yd }, { l: "VACANT", v: PROPERTY.vacant, c: K.r, bg: K.rd }].map(x => (
                <div key={x.l} style={{ padding: "4px 6px", borderRadius: 4, background: x.bg }}>
                  <div style={{ fontSize: 7, color: K.td, fontFamily: K.m }}>{x.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: K.m, color: x.c }}>{x.v}</div>
                </div>
              ))}
            </div>

            {/* Other income compact */}
            <div style={{ fontSize: 8, fontWeight: 600, letterSpacing: 0.8, color: K.td, fontFamily: K.m, marginBottom: 4 }}>OTHER INCOME</div>
            {OTHER_INCOME.map((x, i) => (
              <div key={x.label} style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 0", borderBottom: i < OTHER_INCOME.length - 1 ? `1px solid rgba(255,255,255,0.03)` : "none" }}>
                <span style={{ fontSize: 9.5, color: K.tm }}>{x.label}</span>
                <span style={{ fontSize: 9.5, fontFamily: K.m, fontWeight: 600 }}>{fc(x.total)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, paddingTop: 5, borderTop: `1px solid ${K.bh}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: K.tm }}>Total</span>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: K.m, color: K.p }}>{fc(totalOI)}/mo</span>
            </div>
            <div style={{ fontSize: 8.5, color: K.td, marginTop: 2, textAlign: "right" }}>${Math.round(totalOI / PROPERTY.occupied)}/occ unit · ${(totalOI * 12 / 1000).toFixed(0)}K/yr</div>
          </div>

          {/* ── REVENUE (compact) ── */}
          <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>💰</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Revenue</span>
              </div>
              <span style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>30%</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: K.m, color: K.g }}>82</span>
              <span style={{ fontSize: 9, color: K.td }}>/100</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: K.m, color: K.g }}>+44</span>
            </div>

            <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, position: "relative", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "38%", background: "rgba(232,230,225,0.1)", borderRadius: 3 }} />
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "82%", background: K.g, opacity: 0.5, borderRadius: 3 }} />
            </div>

            {[
              { l: "AVG PREMIUM", v: `+${fc(blendedPremium)}/mo`, c: K.g },
              { l: "LTL CAPTURE", v: `+$${(FP.reduce((s, p) => s + Math.max(0, p.ltl) * (p.units - p.vacant), 0) * 12 / 1000).toFixed(0)}K/yr`, c: K.a },
              { l: "RENT/SF", v: "$1.55 → $1.78", c: K.g },
            ].map(x => (
              <div key={x.l} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.015)", borderRadius: 5, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 8.5, color: K.td, fontFamily: K.m }}>{x.l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: K.m, color: x.c }}>{x.v}</span>
              </div>
            ))}

            <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.5, marginTop: 6 }}>
              2BR units carry heaviest LTL — B2A alone $255/unit gap. Revenue score jumps 38 → 82 through premiums + LTL capture at Q2–Q3 renewal wave.
            </div>
          </div>

          {/* ── OCCUPANCY (compact) ── */}
          <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Occupancy</span>
              </div>
              <span style={{ fontSize: 8, color: K.td, fontFamily: K.m }}>20%</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: K.m, color: K.a }}>78</span>
              <span style={{ fontSize: 9, color: K.td }}>/100</span>
              <span style={{ fontSize: 10, fontWeight: 700, fontFamily: K.m, color: K.g }}>+23</span>
            </div>

            <div style={{ height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, position: "relative", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "55%", background: "rgba(232,230,225,0.1)", borderRadius: 3 }} />
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "78%", background: K.a, opacity: 0.5, borderRadius: 3 }} />
            </div>

            {[
              { l: "PHYSICAL OCC", v: "94.7% → 96.0%", c: K.g },
              { l: "VACANT", v: `${PROPERTY.vacant} → 13 units`, c: K.a },
              { l: "LEASE VELOCITY", v: "12–14/mo target", c: K.g },
            ].map(x => (
              <div key={x.l} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.015)", borderRadius: 5, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 8.5, color: K.td, fontFamily: K.m }}>{x.l}</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: K.m, color: x.c }}>{x.v}</span>
              </div>
            ))}

            <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.5, marginTop: 6 }}>
              Convert 6 MTM to 12-month terms at market. Maintain 96%+ through reno period unit downtime.
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{
          padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: K.s, borderRadius: 8, border: `1px solid ${K.b}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {[
              { l: "COMPOSITE PCS", v: <><span style={{ color: K.tm }}>{PROPERTY.pcs}</span><span style={{ color: K.td, margin: "0 6px" }}>→</span><span style={{ color: K.g }}>{PROPERTY.projPcs}</span></> },
              { l: "RANK", v: <span style={{ color: K.g }}>+{PROPERTY.currentRank - PROPERTY.projectedRank} positions</span> },
              { l: "VALUE IMPACT", v: <span style={{ color: K.g }}>+$1.6M</span> },
              { l: "EXIT CAP", v: <span style={{ color: K.a }}>5.8% → 5.2%</span> },
            ].map((x, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {i > 0 && <div style={{ width: 1, height: 24, background: K.b }} />}
                <div>
                  <div style={{ fontSize: 8, color: K.td, letterSpacing: 0.8, fontFamily: K.m }}>{x.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: K.m, marginTop: 1 }}>{x.v}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: K.td, maxWidth: 180, lineHeight: 1.4, textAlign: "right" }}>
            #{PROPERTY.currentRank} → #{PROPERTY.projectedRank} adds $1.6M exit value via cap rate compression.
          </div>
        </div>
      </div>
    </div>
  );
}
