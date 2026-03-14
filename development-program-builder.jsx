import { useState, useMemo, useCallback } from "react";

/*
  JEDI RE — Development Program Builder (M03B · Designer Mode)
  
  This is the DEVELOPMENT counterpart to unit-mix-positioning-v5 (acquisition analyzer).
  Same Bloomberg aesthetic. Different question:
    Acquisition: "What's here and what's the upside?"
    Development: "What should I build, what will it cost, and what will it yield?"
  
  Three connected panels:
    1. UNIT MIX DESIGNER — build the program from scratch, informed by market demand
    2. COST STACK — hard costs, soft costs, land, with per-unit and per-SF rollups
    3. ABSORPTION & YIELD — monthly absorption model, stabilization timeline, YOC/spread
*/

// ── DESIGN TOKENS (matches acquisition component exactly) ──
const K = {
  bg: "#0B0E13", s: "rgba(255,255,255,0.025)", sh: "rgba(255,255,255,0.04)",
  b: "rgba(255,255,255,0.06)", bh: "rgba(255,255,255,0.12)",
  t: "#E8E6E1", tm: "rgba(232,230,225,0.5)", td: "rgba(232,230,225,0.22)",
  a: "#63B3ED", ad: "rgba(99,179,237,0.08)",
  g: "#68D391", gd: "rgba(104,211,145,0.08)",
  r: "#FC8181", rd: "rgba(252,129,129,0.08)",
  y: "#F6E05E", yd: "rgba(246,224,94,0.08)",
  p: "#B794F4", pd: "rgba(183,148,244,0.08)",
  o: "#F6AD55", od: "rgba(246,173,85,0.08)",
  c: "#4FD1C5", cd: "rgba(79,209,197,0.08)",
  m: "'JetBrains Mono', monospace", f: "'DM Sans', sans-serif",
};

const f = n => n?.toLocaleString("en-US") ?? "—";
const fc = n => `$${n?.toLocaleString("en-US") ?? "0"}`;
const fk = n => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1000).toFixed(0)}K`;
const pct = (a, b) => b ? ((a / b) * 100).toFixed(1) : "—";

// ── ZONING CONSTRAINTS (from M02/M03) ──────────────────────
const ZONING = {
  code: "PD-MF", maxDensity: 24, lotAcres: 12.4, maxHeight: 65, stories: 4,
  far: 2.0, lotSF: 540144, setbackSF: 48600, buildableSF: 491544,
  maxUnitsByDensity: 298, maxUnitsByFAR: 312, maxUnitsByHeight: 320,
  bindingConstraint: "density", maxUnits: 298,
  parkingRatio: 1.5, parkingSpaces: 447,
};

// ── MARKET DEMAND SIGNALS (from M05/M06) ──────────────────
const DEMAND = {
  optimalMix: { studio: 5, "1br": 35, "2br": 45, "3br": 15 },
  avgRents: { studio: 1350, "1br": 1575, "2br": 1925, "3br": 2280 },
  avgSF: { studio: 520, "1br": 750, "2br": 1050, "3br": 1300 },
  rentGrowth: 3.2, vacancy: 5.8, absorption: 18,
  submarketRank: "78th percentile", pipelineRatio: 4.2,
};

// ── COST TEMPLATES ─────────────────────────────────────────
const DEFAULT_COSTS = {
  land: { acquisition: 4200000, closing: 126000, impactFees: 1490000, sitePrepDemo: 380000 },
  hard: { vertical: 185, siteInfra: 22, parking: 0, landscaping: 8, ffe: 0, contingency: 8 },
  soft: { archEng: 12, permitsGov: 8, legalAcct: 3, interestReserve: 0, devFee: 4, marketingLease: 5, softContingency: 3 },
};

// ── INITIAL UNIT TYPES ─────────────────────────────────────
const INITIAL_TYPES = [
  { id: 1, name: "Studio A", beds: 0, baths: 1, sf: 520, count: 15, rent: 1350, floor: "1-4" },
  { id: 2, name: "1BR-A", beds: 1, baths: 1, sf: 720, count: 45, rent: 1525, floor: "1-4" },
  { id: 3, name: "1BR-B", beds: 1, baths: 1, sf: 800, count: 40, rent: 1625, floor: "1-4" },
  { id: 4, name: "2BR-A", beds: 2, baths: 2, sf: 1020, count: 60, rent: 1875, floor: "1-4" },
  { id: 5, name: "2BR-B", beds: 2, baths: 2, sf: 1150, count: 55, rent: 2025, floor: "1-4" },
  { id: 6, name: "2BR-C", beds: 2, baths: 2.5, sf: 1280, count: 20, rent: 2180, floor: "2-4" },
  { id: 7, name: "3BR-A", beds: 3, baths: 2, sf: 1300, count: 30, rent: 2250, floor: "1-3" },
  { id: 8, name: "3BR-B", beds: 3, baths: 2.5, sf: 1420, count: 15, rent: 2380, floor: "2-4" },
];

// ── EDITABLE CELL ──────────────────────────────────────────
function EditCell({ value, onChange, prefix = "", suffix = "", width = 56, color = K.t }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(String(value));

  const commit = () => {
    setEditing(false);
    const num = parseFloat(temp.replace(/[,$%]/g, ""));
    if (!isNaN(num)) onChange(num);
    else setTemp(String(value));
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === "Enter" && commit()}
        style={{
          width, background: "rgba(99,179,237,0.1)", border: `1px solid ${K.a}40`,
          borderRadius: 3, padding: "2px 4px", fontFamily: K.m, fontSize: 10.5,
          color: K.a, textAlign: "right", outline: "none",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setTemp(String(value)); setEditing(true); }}
      style={{
        cursor: "pointer", fontFamily: K.m, fontSize: 10.5, fontWeight: 500, color,
        padding: "2px 4px", borderRadius: 3, borderBottom: `1px dashed ${K.a}30`,
        transition: "background 0.1s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(99,179,237,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {prefix}{typeof value === "number" ? f(value) : value}{suffix}
    </span>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────
export default function DevelopmentProgramBuilder() {
  const [types, setTypes] = useState(INITIAL_TYPES);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [activeTab, setActiveTab] = useState("program");
  const [absorptionRate, setAbsorptionRate] = useState(18); // units/month
  const [exitCap, setExitCap] = useState(5.25);
  const [constructionMonths, setConstructionMonths] = useState(18);
  const [preLeasePct, setPreLeasePct] = useState(15);

  const updateType = useCallback((id, field, value) => {
    setTypes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  }, []);

  const updateCost = useCallback((category, field, value) => {
    setCosts(prev => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  }, []);

  // ── DERIVED CALCULATIONS ─────────────────────────────────
  const calc = useMemo(() => {
    const totalUnits = types.reduce((s, t) => s + t.count, 0);
    const totalSF = types.reduce((s, t) => s + t.sf * t.count, 0);
    const avgSF = totalUnits ? Math.round(totalSF / totalUnits) : 0;
    const gpr = types.reduce((s, t) => s + t.rent * t.count, 0) * 12;
    const vacancy = gpr * (DEMAND.vacancy / 100);
    const egi = gpr - vacancy;
    const expenseRatio = 0.38;
    const noi = egi * (1 - expenseRatio);

    // Bed mix
    const bedCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    types.forEach(t => { bedCounts[t.beds] = (bedCounts[t.beds] || 0) + t.count; });
    const bedMix = Object.entries(bedCounts).map(([beds, count]) => ({
      beds: Number(beds),
      count,
      pct: totalUnits ? (count / totalUnits * 100) : 0,
      label: beds === "0" ? "Studio" : `${beds}BR`,
    }));

    // Cost stack
    const landTotal = Object.values(costs.land).reduce((s, v) => s + v, 0);
    const hardPerSF = Object.values(costs.hard).reduce((s, v) => s + v, 0);
    const hardTotal = hardPerSF * totalSF;
    const softPerSF = Object.values(costs.soft).reduce((s, v) => s + v, 0);
    const softTotal = softPerSF * totalSF;
    const totalDevCost = landTotal + hardTotal + softTotal;
    const costPerUnit = totalUnits ? Math.round(totalDevCost / totalUnits) : 0;
    const costPerSF = totalSF ? Math.round(totalDevCost / totalSF) : 0;

    // Yields
    const yoc = totalDevCost ? (noi / totalDevCost * 100) : 0;
    const marketCap = exitCap;
    const devSpread = yoc - marketCap;
    const stabilizedValue = marketCap ? (noi / (marketCap / 100)) : 0;
    const profit = stabilizedValue - totalDevCost;
    const profitMargin = totalDevCost ? (profit / totalDevCost * 100) : 0;

    // Absorption
    const monthsToStabilize = Math.ceil((totalUnits * (1 - preLeasePct / 100)) / absorptionRate);
    const totalTimeline = constructionMonths + monthsToStabilize;

    // Avg rent/SF
    const avgRent = totalUnits ? Math.round(types.reduce((s, t) => s + t.rent * t.count, 0) / totalUnits) : 0;
    const avgRentPerSF = avgSF ? (avgRent / avgSF * 12).toFixed(2) : "0";

    // Zoning utilization
    const zoningUtil = ZONING.maxUnits ? (totalUnits / ZONING.maxUnits * 100) : 0;

    return {
      totalUnits, totalSF, avgSF, gpr, vacancy, egi, noi, bedMix,
      landTotal, hardTotal, softTotal, hardPerSF, softPerSF, totalDevCost,
      costPerUnit, costPerSF, yoc, devSpread, stabilizedValue, profit, profitMargin,
      monthsToStabilize, totalTimeline, avgRent, avgRentPerSF, zoningUtil,
    };
  }, [types, costs, absorptionRate, exitCap, constructionMonths, preLeasePct]);

  // ── DEMAND ALIGNMENT SCORE ───────────────────────────────
  const demandAlignment = useMemo(() => {
    const actual = { studio: 0, "1br": 0, "2br": 0, "3br": 0 };
    types.forEach(t => {
      const key = t.beds === 0 ? "studio" : `${t.beds}br`;
      actual[key] = (actual[key] || 0) + t.count;
    });
    const total = calc.totalUnits || 1;
    let score = 0;
    Object.keys(DEMAND.optimalMix).forEach(k => {
      const actualPct = (actual[k] || 0) / total * 100;
      const optimalPct = DEMAND.optimalMix[k];
      score += Math.max(0, 100 - Math.abs(actualPct - optimalPct) * 3);
    });
    return Math.round(score / 4);
  }, [types, calc.totalUnits]);

  // ── HEADER SECTION ────────────────────────────────────────
  const bedCol = beds => beds === 0 ? K.c : beds === 1 ? K.a : beds === 2 ? K.p : K.o;

  return (
    <div style={{ minHeight: "100vh", background: K.bg, color: K.t, fontFamily: K.f }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px; }
        input[type="range"] { -webkit-appearance: none; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${K.a}; cursor: pointer; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{ padding: "16px 24px 12px", borderBottom: `1px solid ${K.b}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: "-0.3px" }}>Development Program Builder</h1>
              <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: K.gd, color: K.g }}>🏗 Ground-Up Development</span>
            </div>
            <div style={{ fontSize: 11, color: K.tm, display: "flex", gap: 14 }}>
              <span>Zone: <b style={{ color: K.t }}>{ZONING.code}</b></span>
              <span style={{ color: K.td }}>|</span>
              <span>{ZONING.lotAcres} ac · {f(ZONING.lotSF)} SF</span>
              <span style={{ color: K.td }}>|</span>
              <span>Max: <b style={{ color: calc.zoningUtil > 90 ? K.r : calc.zoningUtil > 75 ? K.y : K.g }}>{ZONING.maxUnits}u</b> ({ZONING.bindingConstraint})</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: K.m, color: calc.yoc >= 6 ? K.g : calc.yoc >= 5 ? K.a : K.r }}>{calc.yoc.toFixed(2)}%</div>
              <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>YIELD ON COST</div>
            </div>
            <div style={{ width: 1, height: 36, background: K.b }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: K.m, color: calc.devSpread > 0 ? K.g : K.r }}>
                {calc.devSpread > 0 ? "+" : ""}{calc.devSpread.toFixed(0)} bps
              </div>
              <div style={{ fontSize: 8, color: K.td, letterSpacing: 1, fontFamily: K.m }}>DEV SPREAD</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SUMMARY BANNER ═══ */}
      <div style={{ padding: "10px 24px 12px" }}>
        <div style={{
          padding: "14px 20px", borderRadius: 10,
          background: "linear-gradient(135deg, rgba(104,211,145,0.04), rgba(99,179,237,0.04), rgba(183,148,244,0.02))",
          border: `1px solid rgba(104,211,145,0.08)`,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 8px 1fr 1fr 1fr", gap: 14, alignItems: "center" }}>
            {[
              { l: "TOTAL UNITS", v: calc.totalUnits, s: `of ${ZONING.maxUnits} max`, c: calc.zoningUtil > 90 ? K.r : K.t },
              { l: "TOTAL DEV COST", v: fk(calc.totalDevCost), c: K.a, s: `${fc(calc.costPerUnit)}/unit` },
              { l: "STABILIZED NOI", v: fk(calc.noi), c: K.g, s: `${calc.avgRentPerSF}/SF/yr` },
              { l: "PROFIT MARGIN", v: `${calc.profitMargin.toFixed(1)}%`, c: calc.profitMargin > 15 ? K.g : calc.profitMargin > 5 ? K.y : K.r, s: fk(calc.profit) },
            ].map(x => (
              <div key={x.l}>
                <div style={{ fontSize: 8, color: K.td, letterSpacing: 0.8, fontFamily: K.m, marginBottom: 2 }}>{x.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: x.c || K.t }}>{x.v}</div>
                {x.s && <div style={{ fontSize: 9, color: K.tm }}>{x.s}</div>}
              </div>
            ))}
            <div style={{ background: K.b, width: 1, height: 40, justifySelf: "center" }} />
            {[
              { l: "CONSTRUCTION", v: `${constructionMonths} mo`, c: K.a },
              { l: "LEASE-UP", v: `${calc.monthsToStabilize} mo`, c: K.p },
              { l: "TOTAL TIMELINE", v: `${calc.totalTimeline} mo`, c: K.t, s: `${(calc.totalTimeline / 12).toFixed(1)} yrs` },
            ].map(x => (
              <div key={x.l}>
                <div style={{ fontSize: 8, color: K.td, letterSpacing: 0.8, fontFamily: K.m, marginBottom: 2 }}>{x.l}</div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: x.c }}>{x.v}</div>
                {x.s && <div style={{ fontSize: 9, color: K.tm }}>{x.s}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div style={{ padding: "0 24px", borderBottom: `1px solid ${K.b}` }}>
        <div style={{ display: "flex", gap: 0 }}>
          {[
            { id: "program", label: "Unit Program", icon: "🏢" },
            { id: "costs", label: "Cost Stack", icon: "💰" },
            { id: "timeline", label: "Absorption & Yield", icon: "📈" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 20px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "none", fontFamily: K.f, display: "flex", alignItems: "center", gap: 6,
              background: "transparent", borderBottom: `2px solid ${activeTab === tab.id ? K.a : "transparent"}`,
              color: activeTab === tab.id ? K.t : K.tm, transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div style={{ padding: "16px 24px 24px" }}>

        {/* ── UNIT PROGRAM TAB ── */}
        {activeTab === "program" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
            {/* Left: Unit type table */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: K.td, fontFamily: K.m }}>UNIT TYPE PROGRAM · {calc.totalUnits} UNITS</span>
                <button onClick={() => {
                  const newId = Math.max(...types.map(t => t.id)) + 1;
                  setTypes([...types, { id: newId, name: `New-${newId}`, beds: 1, baths: 1, sf: 750, count: 10, rent: 1500, floor: "1-4" }]);
                }} style={{
                  padding: "4px 12px", borderRadius: 5, fontSize: 9, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${K.a}40`, background: K.ad, color: K.a, fontFamily: K.m,
                }}>+ Add type</button>
              </div>

              {/* Column headers */}
              <div style={{
                display: "grid", gridTemplateColumns: "24px 80px 36px 36px 50px 44px 40px 58px 55px 50px 55px 28px",
                gap: 4, padding: "0 8px 5px", fontSize: 7.5, fontWeight: 600, letterSpacing: 0.6, color: K.td, fontFamily: K.m,
              }}>
                <span></span><span>NAME</span><span style={{ textAlign: "center" }}>BD</span><span style={{ textAlign: "center" }}>BA</span>
                <span style={{ textAlign: "right" }}>SF</span><span style={{ textAlign: "right" }}>COUNT</span>
                <span style={{ textAlign: "right" }}>MIX%</span><span style={{ textAlign: "right" }}>RENT</span>
                <span style={{ textAlign: "right" }}>RENT/SF</span><span style={{ textAlign: "right" }}>MKT</span>
                <span style={{ textAlign: "right" }}>REV/YR</span><span></span>
              </div>

              {/* Unit type rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {types.map(t => {
                  const col = bedCol(t.beds);
                  const mixPct = calc.totalUnits ? (t.count / calc.totalUnits * 100).toFixed(1) : 0;
                  const rentSF = t.sf ? (t.rent / t.sf).toFixed(2) : 0;
                  const mktKey = t.beds === 0 ? "studio" : `${t.beds}br`;
                  const mktRent = DEMAND.avgRents[mktKey] || 0;
                  const vsMkt = t.rent - mktRent;
                  const annualRev = t.rent * t.count * 12;

                  return (
                    <div key={t.id} style={{
                      display: "grid", gridTemplateColumns: "24px 80px 36px 36px 50px 44px 40px 58px 55px 50px 55px 28px",
                      gap: 4, alignItems: "center", padding: "6px 8px", borderRadius: 6,
                      background: K.s, border: `1px solid ${K.b}`, transition: "all 0.1s",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: 2, background: col }} />
                      <EditCell value={t.name} onChange={v => updateType(t.id, "name", v)} width={72} color={K.t} prefix="" />
                      <select value={t.beds} onChange={e => updateType(t.id, "beds", Number(e.target.value))} style={{
                        background: "transparent", border: "none", color: col, fontFamily: K.m, fontSize: 10, textAlign: "center", cursor: "pointer", outline: "none",
                      }}>
                        <option value={0}>S</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                      </select>
                      <select value={t.baths} onChange={e => updateType(t.id, "baths", Number(e.target.value))} style={{
                        background: "transparent", border: "none", color: K.tm, fontFamily: K.m, fontSize: 10, textAlign: "center", cursor: "pointer", outline: "none",
                      }}>
                        {[1, 1.5, 2, 2.5, 3].map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <div style={{ textAlign: "right" }}><EditCell value={t.sf} onChange={v => updateType(t.id, "sf", v)} width={44} /></div>
                      <div style={{ textAlign: "right" }}><EditCell value={t.count} onChange={v => updateType(t.id, "count", v)} width={38} color={K.a} /></div>
                      <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, color: K.td }}>{mixPct}%</span>
                      <div style={{ textAlign: "right" }}><EditCell value={t.rent} onChange={v => updateType(t.id, "rent", v)} width={52} color={K.g} prefix="$" /></div>
                      <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 10, color: K.tm }}>${rentSF}</span>
                      <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 9, color: vsMkt >= 0 ? K.g : K.r }}>
                        {vsMkt >= 0 ? "+" : ""}{fc(vsMkt)}
                      </span>
                      <span style={{ textAlign: "right", fontFamily: K.m, fontSize: 9, color: K.tm }}>{fk(annualRev)}</span>
                      <button onClick={() => setTypes(types.filter(x => x.id !== t.id))} style={{
                        background: "transparent", border: "none", cursor: "pointer", color: K.td, fontSize: 10,
                      }}>×</button>
                    </div>
                  );
                })}
              </div>

              {/* Totals row */}
              <div style={{
                display: "grid", gridTemplateColumns: "24px 80px 36px 36px 50px 44px 40px 58px 55px 50px 55px 28px",
                gap: 4, alignItems: "center", padding: "8px 8px 4px", marginTop: 4,
                borderTop: `1px solid ${K.bh}`, fontSize: 10, fontWeight: 700, fontFamily: K.m,
              }}>
                <span /><span style={{ color: K.tm }}>TOTAL</span><span /><span />
                <span style={{ textAlign: "right", color: K.td }}>{f(calc.avgSF)}</span>
                <span style={{ textAlign: "right", color: K.a }}>{calc.totalUnits}</span>
                <span style={{ textAlign: "right", color: K.td }}>100%</span>
                <span style={{ textAlign: "right", color: K.g }}>{fc(calc.avgRent)}</span>
                <span style={{ textAlign: "right", color: K.tm }}>${calc.avgRentPerSF}</span>
                <span />
                <span style={{ textAlign: "right", color: K.g }}>{fk(calc.gpr)}</span>
                <span />
              </div>

              {/* Zoning utilization bar */}
              <div style={{ marginTop: 12, padding: "10px 14px", background: K.s, borderRadius: 8, border: `1px solid ${K.b}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: K.td, fontFamily: K.m, letterSpacing: 0.8 }}>ZONING UTILIZATION</span>
                  <span style={{ fontSize: 10, fontFamily: K.m, fontWeight: 700, color: calc.zoningUtil > 100 ? K.r : calc.zoningUtil > 90 ? K.y : K.g }}>
                    {calc.totalUnits} / {ZONING.maxUnits} ({calc.zoningUtil.toFixed(0)}%)
                  </span>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${Math.min(100, calc.zoningUtil)}%`,
                    background: calc.zoningUtil > 100 ? K.r : calc.zoningUtil > 90 ? K.y : K.g,
                    borderRadius: 4, transition: "width 0.3s",
                  }} />
                  {calc.zoningUtil > 100 && (
                    <div style={{ position: "absolute", top: 0, right: 0, height: "100%", width: `${calc.zoningUtil - 100}%`, background: `${K.r}80`, borderRadius: 4 }} />
                  )}
                </div>
                {calc.zoningUtil > 100 && (
                  <div style={{ fontSize: 9, color: K.r, marginTop: 4, fontWeight: 600 }}>
                    ⚠ Exceeds max density by {calc.totalUnits - ZONING.maxUnits} units — requires variance or rezone
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 9, color: K.td }}>
                  <span>Density: {ZONING.maxDensity} DU/ac</span>
                  <span>FAR: {ZONING.far}</span>
                  <span>Height: {ZONING.maxHeight}ft / {ZONING.stories} stories</span>
                  <span>Parking: {ZONING.parkingRatio}/unit = {Math.ceil(calc.totalUnits * ZONING.parkingRatio)} req</span>
                </div>
              </div>
            </div>

            {/* Right: Demand alignment + mix visualization */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Demand alignment gauge */}
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 8 }}>DEMAND ALIGNMENT</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, fontFamily: K.m, color: demandAlignment >= 80 ? K.g : demandAlignment >= 60 ? K.y : K.r }}>
                    {demandAlignment}
                  </span>
                  <span style={{ fontSize: 10, color: K.td }}>/100</span>
                </div>

                {/* Mix comparison bars */}
                {calc.bedMix.map(b => {
                  const optKey = b.beds === 0 ? "studio" : `${b.beds}br`;
                  const optimal = DEMAND.optimalMix[optKey] || 0;
                  const delta = b.pct - optimal;
                  return (
                    <div key={b.beds} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 2, background: bedCol(b.beds) }} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: K.t }}>{b.label}</span>
                          <span style={{ fontSize: 9, fontFamily: K.m, color: K.td }}>{b.count}u</span>
                        </div>
                        <span style={{ fontSize: 9, fontFamily: K.m, color: Math.abs(delta) <= 5 ? K.g : K.y }}>
                          {b.pct.toFixed(0)}% vs {optimal}% optimal
                        </span>
                      </div>
                      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
                        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${b.pct}%`, background: bedCol(b.beds), borderRadius: 3, opacity: 0.5 }} />
                        <div style={{ position: "absolute", top: -2, left: `${optimal}%`, width: 2, height: 10, background: K.t, borderRadius: 1, opacity: 0.4 }} />
                      </div>
                    </div>
                  );
                })}

                <div style={{ fontSize: 9, color: K.tm, lineHeight: 1.5, marginTop: 8, padding: "6px 8px", background: "rgba(255,255,255,0.015)", borderRadius: 5 }}>
                  Market demand signals ({DEMAND.submarketRank}) favor 2BR-heavy mix. Absorption rate: {DEMAND.absorption} units/mo. Pipeline ratio: {DEMAND.pipelineRatio}%.
                </div>
              </div>

              {/* Revenue mix donut approximation */}
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 8 }}>REVENUE MIX BY BEDROOM</div>
                {calc.bedMix.filter(b => b.count > 0).map(b => {
                  const revShare = calc.gpr ? types.filter(t => t.beds === b.beds).reduce((s, t) => s + t.rent * t.count * 12, 0) / calc.gpr * 100 : 0;
                  return (
                    <div key={b.beds} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: bedCol(b.beds), fontFamily: K.m, minWidth: 36 }}>{b.label}</span>
                      <div style={{ flex: 1, height: 10, background: "rgba(255,255,255,0.03)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${revShare}%`, background: bedCol(b.beds), borderRadius: 3, opacity: 0.5 }} />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: K.m, color: K.tm, minWidth: 36, textAlign: "right" }}>{revShare.toFixed(0)}%</span>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${K.b}`, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, color: K.td }}>GPR</span>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: K.m, color: K.g }}>{fk(calc.gpr)}/yr</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: K.td }}>Less vacancy ({DEMAND.vacancy}%)</span>
                  <span style={{ fontSize: 10, fontFamily: K.m, color: K.r }}>({fk(calc.vacancy)})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: K.td }}>EGI</span>
                  <span style={{ fontSize: 10, fontWeight: 600, fontFamily: K.m, color: K.t }}>{fk(calc.egi)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: K.td }}>Less OpEx (38%)</span>
                  <span style={{ fontSize: 10, fontFamily: K.m, color: K.r }}>({fk(calc.egi * 0.38)})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: `1px solid ${K.bh}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: K.tm }}>Stabilized NOI</span>
                  <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.g }}>{fk(calc.noi)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COST STACK TAB ── */}
        {activeTab === "costs" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {/* Land costs */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🏞</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Land & Site</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.a }}>{fk(calc.landTotal)}</span>
              </div>
              {Object.entries(costs.land).map(([key, val]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <span style={{ fontSize: 10, color: K.tm, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                  <EditCell value={val} onChange={v => updateCost("land", key, v)} prefix="$" color={K.a} />
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${K.bh}` }}>
                <span style={{ fontSize: 9, color: K.td }}>Per unit</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: K.m, color: K.a }}>{fc(Math.round(calc.landTotal / (calc.totalUnits || 1)))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: K.td }}>Per SF (land)</span>
                <span style={{ fontSize: 10, fontFamily: K.m, color: K.td }}>{fc(Math.round(calc.landTotal / (ZONING.lotSF || 1)))}/SF</span>
              </div>
            </div>

            {/* Hard costs */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>🏗</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Hard Costs</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.p }}>{fk(calc.hardTotal)}</span>
              </div>
              <div style={{ fontSize: 8.5, color: K.td, marginBottom: 8, fontFamily: K.m }}>$/SF of {f(calc.totalSF)} total rentable SF</div>
              {Object.entries(costs.hard).map(([key, val]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <span style={{ fontSize: 10, color: K.tm, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <EditCell value={val} onChange={v => updateCost("hard", key, v)} prefix="$" suffix="/SF" color={K.p} />
                    <span style={{ fontSize: 8.5, fontFamily: K.m, color: K.td, minWidth: 52, textAlign: "right" }}>{fk(val * calc.totalSF)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${K.bh}` }}>
                <span style={{ fontSize: 9, color: K.td }}>Total hard/SF</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: K.m, color: K.p }}>${calc.hardPerSF}/SF</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: K.td }}>Per unit</span>
                <span style={{ fontSize: 10, fontFamily: K.m, color: K.tm }}>{fc(Math.round(calc.hardTotal / (calc.totalUnits || 1)))}</span>
              </div>
            </div>

            {/* Soft costs */}
            <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14 }}>📋</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Soft Costs</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: K.m, color: K.o }}>{fk(calc.softTotal)}</span>
              </div>
              <div style={{ fontSize: 8.5, color: K.td, marginBottom: 8, fontFamily: K.m }}>$/SF of {f(calc.totalSF)} total rentable SF</div>
              {Object.entries(costs.soft).map(([key, val]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  <span style={{ fontSize: 10, color: K.tm, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <EditCell value={val} onChange={v => updateCost("soft", key, v)} prefix="$" suffix="/SF" color={K.o} />
                    <span style={{ fontSize: 8.5, fontFamily: K.m, color: K.td, minWidth: 52, textAlign: "right" }}>{fk(val * calc.totalSF)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 6, borderTop: `1px solid ${K.bh}` }}>
                <span style={{ fontSize: 9, color: K.td }}>Total soft/SF</span>
                <span style={{ fontSize: 10, fontWeight: 600, fontFamily: K.m, color: K.o }}>${calc.softPerSF}/SF</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{ fontSize: 9, color: K.td }}>Per unit</span>
                <span style={{ fontSize: 10, fontFamily: K.m, color: K.tm }}>{fc(Math.round(calc.softTotal / (calc.totalUnits || 1)))}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── ABSORPTION & YIELD TAB ── */}
        {activeTab === "timeline" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
            {/* Left: Timeline visual + controls */}
            <div>
              {/* Assumptions controls */}
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px", marginBottom: 14 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>ASSUMPTIONS — ADJUST INPUTS</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginTop: 12 }}>
                  {[
                    { l: "Absorption rate", v: absorptionRate, set: setAbsorptionRate, min: 8, max: 30, s: "units/mo", c: K.a },
                    { l: "Construction", v: constructionMonths, set: setConstructionMonths, min: 12, max: 30, s: "months", c: K.p },
                    { l: "Pre-lease %", v: preLeasePct, set: setPreLeasePct, min: 0, max: 40, s: "%", c: K.g },
                    { l: "Exit cap rate", v: exitCap, set: setExitCap, min: 4, max: 7, s: "%", c: K.y, step: 0.25 },
                  ].map(ctrl => (
                    <div key={ctrl.l}>
                      <div style={{ fontSize: 9, color: K.td, fontFamily: K.m, marginBottom: 4 }}>{ctrl.l}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: K.m, color: ctrl.c }}>{ctrl.v}</span>
                        <span style={{ fontSize: 9, color: K.td }}>{ctrl.s}</span>
                      </div>
                      <input type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step || 1} value={ctrl.v}
                        onChange={e => ctrl.set(Number(e.target.value))}
                        style={{ width: "100%" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline visualization */}
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>DEVELOPMENT TIMELINE</span>

                {/* Gantt-like bars */}
                <div style={{ marginTop: 14 }}>
                  {[
                    { l: "Pre-development", mo: 4, start: 0, c: K.td },
                    { l: "Entitlement", mo: 6, start: 2, c: K.y },
                    { l: "Construction", mo: constructionMonths, start: 8, c: K.p },
                    { l: "Pre-leasing", mo: Math.round(constructionMonths * 0.3), start: 8 + Math.round(constructionMonths * 0.7), c: K.a },
                    { l: "Lease-up", mo: calc.monthsToStabilize, start: 8 + constructionMonths, c: K.g },
                  ].map((phase, i) => {
                    const totalMo = 8 + constructionMonths + calc.monthsToStabilize + 2;
                    const left = (phase.start / totalMo) * 100;
                    const width = (phase.mo / totalMo) * 100;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 9, color: K.tm, minWidth: 100, textAlign: "right" }}>{phase.l}</span>
                        <div style={{ flex: 1, position: "relative", height: 16 }}>
                          <div style={{ position: "absolute", top: 6, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.03)", borderRadius: 2 }} />
                          <div style={{
                            position: "absolute", top: 2, left: `${left}%`, width: `${width}%`, height: 12,
                            background: `${phase.c}30`, borderRadius: 4, border: `1px solid ${phase.c}40`,
                          }} />
                        </div>
                        <span style={{ fontSize: 9, fontFamily: K.m, color: phase.c, minWidth: 40, textAlign: "right" }}>{phase.mo} mo</span>
                      </div>
                    );
                  })}
                  {/* Month markers */}
                  <div style={{ display: "flex", marginLeft: 110, marginTop: 4 }}>
                    {Array.from({ length: Math.ceil((8 + constructionMonths + calc.monthsToStabilize + 2) / 6) + 1 }, (_, i) => i * 6).map(mo => {
                      const totalMo = 8 + constructionMonths + calc.monthsToStabilize + 2;
                      return (
                        <span key={mo} style={{
                          position: "relative", fontSize: 8, fontFamily: K.m, color: K.td,
                          left: `${(mo / totalMo) * 100}%`, transform: "translateX(-50%)",
                        }}>Mo {mo}</span>
                      );
                    })}
                  </div>
                </div>

                {/* Absorption curve approximation */}
                <div style={{ marginTop: 20 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m }}>ABSORPTION CURVE</span>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, marginTop: 8 }}>
                    {Array.from({ length: calc.monthsToStabilize }, (_, i) => {
                      const preLease = Math.round(calc.totalUnits * preLeasePct / 100);
                      const remaining = calc.totalUnits - preLease;
                      const absorbed = Math.min(remaining, (i + 1) * absorptionRate);
                      const occupancy = ((preLease + absorbed) / calc.totalUnits) * 100;
                      const h = occupancy * 0.75;
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                          <div style={{
                            width: "100%", height: h, borderRadius: 2,
                            background: occupancy >= 93 ? K.g : occupancy >= 80 ? K.a : K.p,
                            opacity: 0.4, transition: "all 0.3s",
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontFamily: K.m, color: K.td, marginTop: 2 }}>
                    <span>Mo 1</span>
                    <span>Stabilized ({Math.round(calc.totalUnits * preLeasePct / 100)} pre-leased → {absorptionRate}/mo → 93%+)</span>
                    <span>Mo {calc.monthsToStabilize}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Yield metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 12 }}>RETURN METRICS</div>
                {[
                  { l: "Total Development Cost", v: fk(calc.totalDevCost), c: K.t, big: true },
                  { l: "Cost per Unit", v: fc(calc.costPerUnit), c: K.a },
                  { l: "Cost per SF", v: `$${calc.costPerSF}`, c: K.a },
                  { sep: true },
                  { l: "Stabilized NOI", v: fk(calc.noi), c: K.g, big: true },
                  { l: "Yield on Cost", v: `${calc.yoc.toFixed(2)}%`, c: calc.yoc >= 6 ? K.g : calc.yoc >= 5 ? K.y : K.r, big: true },
                  { l: "Market Cap Rate", v: `${exitCap}%`, c: K.tm },
                  { l: "Dev Spread", v: `${calc.devSpread > 0 ? "+" : ""}${calc.devSpread.toFixed(0)} bps`, c: calc.devSpread > 0 ? K.g : K.r, big: true },
                  { sep: true },
                  { l: "Stabilized Value", v: fk(calc.stabilizedValue), c: K.g, big: true },
                  { l: "Profit", v: fk(calc.profit), c: calc.profit > 0 ? K.g : K.r },
                  { l: "Profit Margin", v: `${calc.profitMargin.toFixed(1)}%`, c: calc.profitMargin > 15 ? K.g : K.y },
                  { sep: true },
                  { l: "Total Timeline", v: `${calc.totalTimeline} months`, c: K.t },
                  { l: "Absorption Rate", v: `${absorptionRate} units/mo`, c: K.a },
                  { l: "Pre-lease", v: `${preLeasePct}% (${Math.round(calc.totalUnits * preLeasePct / 100)} units)`, c: K.p },
                ].map((row, i) => {
                  if (row.sep) return <div key={i} style={{ height: 1, background: K.b, margin: "6px 0" }} />;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                      <span style={{ fontSize: 10, color: K.tm }}>{row.l}</span>
                      <span style={{ fontSize: row.big ? 14 : 11, fontWeight: row.big ? 800 : 600, fontFamily: K.m, color: row.c }}>{row.v}</span>
                    </div>
                  );
                })}
              </div>

              {/* Cost stack breakdown */}
              <div style={{ background: K.s, border: `1px solid ${K.b}`, borderRadius: 8, padding: "16px 18px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: K.td, fontFamily: K.m, marginBottom: 10 }}>COST STACK BREAKDOWN</div>
                {[
                  { l: "Land & Site", v: calc.landTotal, c: K.a },
                  { l: "Hard Costs", v: calc.hardTotal, c: K.p },
                  { l: "Soft Costs", v: calc.softTotal, c: K.o },
                ].map(item => {
                  const share = calc.totalDevCost ? (item.v / calc.totalDevCost * 100) : 0;
                  return (
                    <div key={item.l} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: item.c, fontWeight: 600 }}>{item.l}</span>
                        <span style={{ fontSize: 10, fontFamily: K.m, color: item.c }}>{fk(item.v)} ({share.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.03)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${share}%`, background: item.c, opacity: 0.4, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
