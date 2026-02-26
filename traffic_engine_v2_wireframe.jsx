import { useState, useEffect, useRef, useCallback } from "react";

/*
  JEDI RE — Traffic Engine v2 Wireframe (Updated)
  Deal Capsule → Traffic Engine Tab
  
  INTEGRATES: Traffic_Validation_Excel_Supplement.md
  - Excel upload pipeline (expanded from walk-ins → full 7-metric funnel)
  - Validation runner (per-metric error tracking, not just walk-ins)
  - Learning loop (calibrates conversion rates between funnel stages)
  - Upload UX with parsing feedback, template download, error handling
  
  Calibration source: Highlands at Berewick (290 units, 243 weeks)
*/

// ═══════════════════════════════════════════════════════════════
// DATA MODELS
// ═══════════════════════════════════════════════════════════════

const PROPERTY = {
  name: "Highlands at Berewick",
  units: 290,
  type: "Garden — Class A",
  submarket: "Berewick / Charlotte SW",
  dataWeeks: 243,
  firstWeek: "2021-07-13",
  lastWeek: "2026-02-23",
};

// Current week: predicted vs actual (all 7 key metrics)
const CURRENT_WEEK = {
  weekEnding: "2026-02-23",
  predicted: { traffic: 14, tours: 7, apps: 3, netLeases: 2, occPct: 95.0, effRent: 1832, closingRatio: 14.3 },
  actual:    { traffic: 16, tours: 9, apps: 4, netLeases: 3, occPct: 95.2, effRent: 1838, closingRatio: 18.8 },
};

// Learned conversion rates (what the learning loop has calibrated to)
const LEARNED_RATES = {
  tourRate:    { current: 0.56, v1Default: 0.05, learnedFrom: 243, trend: "stable",  seasonal: { summer: 0.62, winter: 0.48 } },
  appRate:     { current: 0.44, v1Default: 0.20, learnedFrom: 243, trend: "rising",  seasonal: { summer: 0.52, winter: 0.32 } },
  leaseRate:   { current: 0.75, v1Default: 0.76, learnedFrom: 243, trend: "stable",  seasonal: { summer: 0.78, winter: 0.70 } },
  renewalRate: { current: 0.58, v1Default: null, learnedFrom: 189, trend: "falling", seasonal: { summer: 0.55, winter: 0.62 } },
};

// Validation history — last 6 uploads
const UPLOAD_HISTORY = [
  { date: "2026-02-24", weekEnding: "2026-02-23", rows: 1, status: "success", mape: 0.11, metricsReported: 7, calibrationApplied: true },
  { date: "2026-02-17", weekEnding: "2026-02-16", rows: 1, status: "success", mape: 0.09, metricsReported: 7, calibrationApplied: false },
  { date: "2026-02-10", weekEnding: "2026-02-09", rows: 1, status: "success", mape: 0.13, metricsReported: 7, calibrationApplied: true },
  { date: "2026-02-03", weekEnding: "2026-02-02", rows: 1, status: "success", mape: 0.06, metricsReported: 5, calibrationApplied: false },
  { date: "2026-01-27", weekEnding: "2026-01-26", rows: 1, status: "success", mape: 0.07, metricsReported: 7, calibrationApplied: false },
  { date: "2026-01-20", weekEnding: "2026-01-19", rows: 1, status: "success", mape: 0.10, metricsReported: 7, calibrationApplied: false },
];

// 5-year projection (sampled monthly)
const PROJECTION = (() => {
  const months = [];
  const baseOcc = 95.2;
  const baseRent = 1808;
  const seasonalOcc = [-.8, -.5, .2, .6, 1.0, 1.5, 1.8, 1.5, .8, .2, -.3, -.7];
  const rentGrowth = 0.032;
  for (let m = 0; m < 60; m++) {
    const year = Math.floor(m / 12);
    const mi = m % 12;
    const occ = Math.min(98, Math.max(88, baseOcc + seasonalOcc[mi] - (year > 3 ? (year - 3) * 0.3 : 0)));
    const rent = baseRent * Math.pow(1 + rentGrowth * (1 - year * 0.002), m / 12);
    const bandW = 0.5 + m * 0.04;
    months.push({
      month: m, occ: Math.round(occ * 10) / 10,
      occHigh: Math.round((occ + bandW) * 10) / 10,
      occLow: Math.round(Math.max(85, occ - bandW) * 10) / 10,
      rent: Math.round(rent),
      rentHigh: Math.round(rent * (1 + m * 0.0012)),
      rentLow: Math.round(rent * (1 - m * 0.0012)),
      revenue: Math.round(290 * (occ / 100) * rent),
      confidence: Math.max(40, Math.round(92 - m * 0.28)),
    });
  }
  return months;
})();

// Seasonal heatmap
const SEASONAL = (() => {
  const base = [3,4,5,6,7,8,9,10,10,11,11,12,12,13,14,15,16,17,18,19,20,21,22,23,24,25,25,24,22,20,18,16,14,12,11,10,9,8,7,6,5,5,4,4,3,3,2,3,3,4,5,5];
  const leases = [1,1,1,1,2,2,2,2,3,3,3,3,3,4,4,4,5,5,6,6,7,7,8,8,9,9,8,7,6,5,4,4,3,3,3,2,2,2,2,1,1,1,1,1,0,0,0,1,1,1,1,1];
  return base.map((t, i) => ({ week: i + 1, traffic: t, leases: leases[i] }));
})();

// Formula fixes with validation supplement annotations
const FORMULA_FIXES = [
  { id: "F1", file: "multifamilyTrafficService.ts", severity: "critical",
    title: "Tour Rate: 5% → Dynamic (56% avg for multifamily)",
    current: "tour_rate = 0.05 (static, borrowed from retail foot traffic)",
    fix: "tour_rate = f(property_type, season, occupancy). MF avg: 0.56. Summer: 0.62. Winter: 0.48. Learned from 243 weeks.",
    validation: "Each upload: compare predicted tour_rate to actual (tours/traffic), recalibrate with EMA(α=0.15)." },
  { id: "F2", file: "multifamilyTrafficService.ts", severity: "critical",
    title: "App Rate: 20% → Dynamic (44% avg, seasonal 32-52%)",
    current: "app_rate = 0.20 (static)",
    fix: "app_rate = f(season, market_tightness, rent_competitiveness). Avg 0.44. Summer: 0.52. Winter: 0.32.",
    validation: "Recalibrate when both tours AND apps reported. Min 4 weeks before overriding v1 default." },
  { id: "F3", file: "multifamilyTrafficService.ts", severity: "medium",
    title: "Lease Rate: Static 76% → Learned 75% (needs seasonal split)",
    current: "approval_rate × acceptance_rate = 0.765 (static)",
    fix: "net_lease_rate = 1 - cancel_rate(season) - deny_rate(class). Avg 0.75. Summer: 0.78. Winter: 0.70.",
    validation: "Only recalibrate when net_leases AND apps both reported. Partial uploads skip this." },
  { id: "F4", file: "trafficPredictionEngine.ts", severity: "high",
    title: "Seasonality: Sine wave → 52-week learned index",
    current: "seasonal_factor = sin(week × 2π / 52) — smooth, symmetric",
    fix: "52-week learned index from actuals. Sharp Jun-Jul peak, long Oct-Feb trough. Cold-start: SE multifamily template.",
    validation: "Outlier weeks (z-score > 2.5 per supplement) don't update seasonal index." },
  { id: "F5", file: "trafficPredictionEngine.ts", severity: "high",
    title: "No occupancy ↔ traffic feedback loop",
    current: "Traffic prediction ignores current occupancy",
    fix: "occ < 90% → traffic × 1.3 (more marketing). 90-95% → ×1.0. >96% → ×0.7 (less marketing).",
    validation: "If occupancy error > 1% for 3+ consecutive uploads → bias alert → recalibration." },
  { id: "F6", file: "NEW: trafficLearningService.ts", severity: "critical",
    title: "Create learning loop (doesn't exist)",
    current: "No mechanism to ingest actuals or recalibrate",
    fix: "Excel parser (Highlands-format OR simplified 5-field). Per-metric EMA recalibration. Outlier protection. Bias detection (>75% one direction). Cross-property anonymized learning.",
    validation: "This IS the validation supplement, expanded from walk-ins-only to 7-metric funnel." },
  { id: "F7", file: "NEW: tenYearProjectionService.ts", severity: "critical",
    title: "10-year projection layer (doesn't exist)",
    current: "Engine only predicts current week",
    fix: "120-month projection: weekly (1-24mo), monthly (25-60), quarterly (61-120). Confidence bands widen. Feeds M09 ProForma.",
    validation: "Retroactive validation: compare 4-week-ago prediction to actual. Track forecast horizon accuracy." },
];

// Raw weekly prediction data: historical (with actuals) + future (predictions only)
// This is the engine's full output log — every week it predicts, every upload validates
const RAW_WEEKS = [
  // ── FUTURE (predictions only, no actuals yet) ──
  { week: "2026-04-19", phase: "future", conf: 74,
    p: { traffic: 16, tours: 9, apps: 4, netLeases: 3, occPct: 95.4, effRent: 1862, closingRatio: 18.8 }, a: null },
  { week: "2026-04-12", phase: "future", conf: 76,
    p: { traffic: 15, tours: 8, apps: 4, netLeases: 3, occPct: 95.3, effRent: 1860, closingRatio: 20.0 }, a: null },
  { week: "2026-04-05", phase: "future", conf: 78,
    p: { traffic: 14, tours: 8, apps: 3, netLeases: 2, occPct: 95.2, effRent: 1858, closingRatio: 14.3 }, a: null },
  { week: "2026-03-29", phase: "future", conf: 80,
    p: { traffic: 13, tours: 7, apps: 3, netLeases: 2, occPct: 95.1, effRent: 1855, closingRatio: 15.4 }, a: null },
  { week: "2026-03-22", phase: "future", conf: 82,
    p: { traffic: 11, tours: 6, apps: 3, netLeases: 2, occPct: 95.1, effRent: 1852, closingRatio: 18.2 }, a: null },
  { week: "2026-03-15", phase: "future", conf: 84,
    p: { traffic: 10, tours: 5, apps: 2, netLeases: 2, occPct: 95.0, effRent: 1849, closingRatio: 20.0 }, a: null },
  { week: "2026-03-08", phase: "future", conf: 87,
    p: { traffic: 9, tours: 5, apps: 2, netLeases: 1, occPct: 95.0, effRent: 1846, closingRatio: 11.1 }, a: null },
  { week: "2026-03-01", phase: "future", conf: 89,
    p: { traffic: 8, tours: 4, apps: 2, netLeases: 1, occPct: 95.0, effRent: 1843, closingRatio: 12.5 }, a: null },
  // ── CURRENT WEEK ──
  { week: "2026-02-23", phase: "current", conf: 92,
    p: { traffic: 14, tours: 7, apps: 3, netLeases: 2, occPct: 95.0, effRent: 1832, closingRatio: 14.3 },
    a: { traffic: 16, tours: 9, apps: 4, netLeases: 3, occPct: 95.2, effRent: 1838, closingRatio: 18.8 } },
  // ── HISTORICAL (predictions + actuals) ──
  { week: "2026-02-16", phase: "past", conf: 92,
    p: { traffic: 12, tours: 6, apps: 3, netLeases: 2, occPct: 95.1, effRent: 1830, closingRatio: 16.7 },
    a: { traffic: 11, tours: 6, apps: 2, netLeases: 1, occPct: 94.8, effRent: 1835, closingRatio: 9.1 } },
  { week: "2026-02-09", phase: "past", conf: 92,
    p: { traffic: 10, tours: 5, apps: 2, netLeases: 1, occPct: 95.3, effRent: 1828, closingRatio: 10.0 },
    a: { traffic: 13, tours: 7, apps: 3, netLeases: 2, occPct: 95.1, effRent: 1833, closingRatio: 15.4 } },
  { week: "2026-02-02", phase: "past", conf: 91,
    p: { traffic: 9, tours: 5, apps: 2, netLeases: 1, occPct: 95.2, effRent: 1826, closingRatio: 11.1 },
    a: { traffic: 8, tours: null, apps: null, netLeases: 1, occPct: 95.3, effRent: 1830, closingRatio: 12.5 } },
  { week: "2026-01-26", phase: "past", conf: 91,
    p: { traffic: 11, tours: 6, apps: 2, netLeases: 2, occPct: 95.0, effRent: 1824, closingRatio: 18.2 },
    a: { traffic: 10, tours: 5, apps: 2, netLeases: 2, occPct: 95.2, effRent: 1828, closingRatio: 20.0 } },
  { week: "2026-01-19", phase: "past", conf: 91,
    p: { traffic: 8, tours: 4, apps: 2, netLeases: 1, occPct: 95.1, effRent: 1822, closingRatio: 12.5 },
    a: { traffic: 9, tours: 5, apps: 1, netLeases: 1, occPct: 95.0, effRent: 1825, closingRatio: 11.1 } },
  { week: "2026-01-12", phase: "past", conf: 91,
    p: { traffic: 7, tours: 4, apps: 2, netLeases: 1, occPct: 95.3, effRent: 1820, closingRatio: 14.3 },
    a: { traffic: 6, tours: 3, apps: 1, netLeases: 0, occPct: 95.1, effRent: 1818, closingRatio: 0.0 } },
  { week: "2026-01-05", phase: "past", conf: 91,
    p: { traffic: 5, tours: 3, apps: 1, netLeases: 0, occPct: 95.2, effRent: 1818, closingRatio: 0.0 },
    a: { traffic: 4, tours: 2, apps: 1, netLeases: 1, occPct: 95.3, effRent: 1820, closingRatio: 25.0 } },
  { week: "2025-12-29", phase: "past", conf: 90,
    p: { traffic: 3, tours: 2, apps: 1, netLeases: 0, occPct: 95.3, effRent: 1816, closingRatio: 0.0 },
    a: { traffic: 2, tours: 1, apps: 0, netLeases: 0, occPct: 95.2, effRent: 1815, closingRatio: 0.0 } },
  { week: "2025-12-22", phase: "past", conf: 90,
    p: { traffic: 4, tours: 2, apps: 1, netLeases: 0, occPct: 95.4, effRent: 1814, closingRatio: 0.0 },
    a: { traffic: 3, tours: 2, apps: 1, netLeases: 1, occPct: 95.3, effRent: 1814, closingRatio: 33.3 } },
  { week: "2025-12-15", phase: "past", conf: 90,
    p: { traffic: 5, tours: 3, apps: 1, netLeases: 1, occPct: 95.2, effRent: 1812, closingRatio: 20.0 },
    a: { traffic: 5, tours: 3, apps: 2, netLeases: 1, occPct: 95.4, effRent: 1814, closingRatio: 20.0 } },
  { week: "2025-12-08", phase: "past", conf: 90,
    p: { traffic: 6, tours: 3, apps: 1, netLeases: 1, occPct: 95.1, effRent: 1810, closingRatio: 16.7 },
    a: { traffic: 7, tours: 4, apps: 2, netLeases: 1, occPct: 95.2, effRent: 1812, closingRatio: 14.3 } },
  { week: "2025-12-01", phase: "past", conf: 90,
    p: { traffic: 7, tours: 4, apps: 2, netLeases: 1, occPct: 95.0, effRent: 1808, closingRatio: 14.3 },
    a: { traffic: 8, tours: 4, apps: 2, netLeases: 2, occPct: 95.1, effRent: 1810, closingRatio: 25.0 } },
];

// Excel upload schema (v2)
const UPLOAD_SCHEMA = {
  required: [
    { field: "Week Ending", type: "date", example: "2026-02-23", note: "Sunday date" },
    { field: "Traffic", type: "int", example: "16", note: "Total walk-ins" },
    { field: "Net Leases", type: "int", example: "3", note: "After cancellations/denials" },
    { field: "Occupancy %", type: "float", example: "95.2", note: "End-of-week" },
    { field: "Effective Rent", type: "float", example: "1838", note: "Avg collected per unit" },
  ],
  optional: [
    { field: "In-Person Tours", note: "Enables tour rate calibration" },
    { field: "Applications", note: "Enables app rate calibration" },
    { field: "Move-Ins", note: "Better occupancy modeling" },
    { field: "Move-Outs", note: "Better turnover prediction" },
    { field: "Concessions", note: "Rent pressure signal" },
    { field: "Market Rent", note: "Loss-to-lease calculation" },
    { field: "Notes", note: "Context for outlier detection" },
  ],
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════

const C = {
  bg: "#05080f", surface: "#0c1322", surfaceLight: "#121d30", border: "#1a2744",
  cyan: "#22d3ee", cyanDim: "#0e4f5c", green: "#10b981", greenDim: "#064e3b",
  amber: "#f59e0b", amberDim: "#78350f", red: "#ef4444", redDim: "#7f1d1d",
  blue: "#3b82f6", purple: "#8b5cf6", text: "#e2e8f0", dim: "#94a3b8", muted: "#475569",
};

function Canvas({ draw, width, height, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    el.width = width * dpr;
    el.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }, [draw, width, height]);
  return <canvas ref={ref} style={{ width, height, display: "block", ...style }} />;
}

// ═══════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: "funnel", label: "Leasing Funnel" },
  { id: "rawdata", label: "Raw Data" },
  { id: "upload", label: "Upload & Validate" },
  { id: "learning", label: "Learning Loop" },
  { id: "projection", label: "10-Year Projection" },
  { id: "seasonal", label: "Seasonal Pattern" },
  { id: "wiring", label: "Cross-Module Impact" },
  { id: "fixes", label: "Formula Fixes" },
];

// ── TAB 1: LEASING FUNNEL ──
function FunnelTab() {
  const { predicted: p, actual: a } = CURRENT_WEEK;
  const stages = [
    { label: "Traffic", pred: p.traffic, act: a.traffic, pct: 100 },
    { label: "In-Person Tours", pred: p.tours, act: a.tours, pct: 75 },
    { label: "Applications", pred: p.apps, act: a.apps, pct: 50 },
    { label: "Net Leases Signed", pred: p.netLeases, act: a.netLeases, pct: 30 },
  ];
  const rates = [
    { label: "Tour Rate", actual: ((a.tours / a.traffic) * 100).toFixed(0), learned: (LEARNED_RATES.tourRate.current * 100).toFixed(0), v1: (LEARNED_RATES.tourRate.v1Default * 100).toFixed(0), weeks: LEARNED_RATES.tourRate.learnedFrom, broken: true },
    { label: "App Rate", actual: ((a.apps / a.tours) * 100).toFixed(0), learned: (LEARNED_RATES.appRate.current * 100).toFixed(0), v1: (LEARNED_RATES.appRate.v1Default * 100).toFixed(0), weeks: LEARNED_RATES.appRate.learnedFrom, broken: true },
    { label: "Lease Rate", actual: ((a.netLeases / a.apps) * 100).toFixed(0), learned: (LEARNED_RATES.leaseRate.current * 100).toFixed(0), v1: (LEARNED_RATES.leaseRate.v1Default * 100).toFixed(0), weeks: LEARNED_RATES.leaseRate.learnedFrom, broken: false },
  ];
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginBottom: 16 }}>
        {stages.map((s, i) => (
          <div key={i} style={{ width: `${s.pct}%`, minWidth: 220, background: `linear-gradient(90deg, ${C.cyan}22 0%, ${C.cyan}08 100%)`, border: `1px solid ${C.cyan}33`, borderRadius: 8, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: C.cyan, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{s.act}</span>
              <span style={{ fontSize: 10, color: s.act >= s.pred ? C.green : C.amber }}>pred: {s.pred}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.cyan, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Conversion Rates (Learned vs v1 Default)</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {rates.map((r, i) => (
          <div key={i} style={{ flex: 1, background: r.broken ? `${C.redDim}33` : C.surface, border: `1px solid ${r.broken ? C.red + "44" : C.border}`, borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{r.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{r.actual}%</div>
                <div style={{ fontSize: 9, color: C.dim }}>this week</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: C.green, fontFamily: "monospace" }}>{r.learned}%</div>
                <div style={{ fontSize: 9, color: C.dim }}>learned ({r.weeks}wk)</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: r.broken ? C.red : C.dim, fontFamily: "monospace", textDecoration: r.broken ? "line-through" : "none" }}>{r.v1}%</div>
                <div style={{ fontSize: 9, color: r.broken ? C.red : C.dim }}>v1 default</div>
              </div>
            </div>
            {r.broken && <div style={{ fontSize: 9, color: C.red, marginTop: 4 }}>⚠ v1 off by {Math.round(Math.abs(parseInt(r.learned) - parseInt(r.v1)) / parseInt(r.v1) * 100)}%</div>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { label: "Occupancy", pred: p.occPct, act: a.occPct, unit: "%", dec: 1 },
          { label: "Effective Rent", pred: p.effRent, act: a.effRent, unit: "", dec: 0, prefix: "$" },
          { label: "Closing Ratio", pred: p.closingRatio, act: a.closingRatio, unit: "%", dec: 1 },
        ].map((m, i) => {
          const diff = m.act - m.pred;
          const errColor = Math.abs(diff / m.pred) < 0.02 ? C.green : Math.abs(diff / m.pred) < 0.1 ? C.amber : C.red;
          return (
            <div key={i} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{m.prefix || ""}{m.act.toFixed(m.dec)}{m.unit}</div>
              <div style={{ fontSize: 10, color: errColor }}>{diff > 0 ? "+" : ""}{diff.toFixed(m.dec)} vs pred</div>
            </div>
          );
        })}
      </div>
      <div style={{ background: C.surfaceLight, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginTop: 10 }}>
        <div style={{ fontSize: 10, color: C.cyan, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Implied Annual (current velocity)</div>
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "Annual Leases", value: `${Math.round(a.netLeases * 52)}`, sub: `${a.netLeases}/wk × 52` },
            { label: "Annual Revenue", value: `$${(290 * (a.occPct / 100) * a.effRent * 12 / 1e6).toFixed(2)}M`, sub: "units × occ × rent × 12" },
            { label: "Rent Growth", value: "+3.2%/yr", sub: "learned from 243 weeks" },
          ].map((m, i) => (
            <div key={i}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "monospace" }}>{m.value}</div>
              <div style={{ fontSize: 10, color: C.dim }}>{m.label}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RAW DATA: WEEKLY PREDICTIONS TABLE ──
function RawDataTab() {
  const [metricView, setMetricView] = useState("all"); // all, traffic, leasing, financial
  const [timeRange, setTimeRange] = useState("all"); // all, future, current, past

  const METRICS = {
    all: [
      { key: "traffic", label: "Traffic", short: "Traf" },
      { key: "tours", label: "Tours", short: "Tour" },
      { key: "apps", label: "Apps", short: "App" },
      { key: "netLeases", label: "Net Leases", short: "Lse" },
      { key: "occPct", label: "Occ %", short: "Occ", dec: 1 },
      { key: "effRent", label: "Eff Rent", short: "Rent", prefix: "$" },
      { key: "closingRatio", label: "Close %", short: "Cls", dec: 1 },
    ],
    traffic: [
      { key: "traffic", label: "Traffic", short: "Traf" },
      { key: "tours", label: "Tours", short: "Tour" },
      { key: "closingRatio", label: "Close %", short: "Cls", dec: 1 },
    ],
    leasing: [
      { key: "apps", label: "Apps", short: "App" },
      { key: "netLeases", label: "Net Leases", short: "Lse" },
      { key: "occPct", label: "Occ %", short: "Occ", dec: 1 },
    ],
    financial: [
      { key: "effRent", label: "Eff Rent", short: "Rent", prefix: "$" },
      { key: "occPct", label: "Occ %", short: "Occ", dec: 1 },
    ],
  };

  const activeMetrics = METRICS[metricView];
  const filtered = RAW_WEEKS.filter(w => timeRange === "all" || w.phase === timeRange);

  const fmtVal = (val, m) => {
    if (val === null || val === undefined) return "—";
    return (m.prefix || "") + (m.dec ? val.toFixed(m.dec) : val);
  };

  const errColor = (p, a, key) => {
    if (a === null || a === undefined) return null;
    const err = a !== 0 ? Math.abs(p - a) / a : 0;
    if (key === "occPct" || key === "effRent") return err < 0.005 ? C.green : err < 0.01 ? C.amber : C.red;
    return err < 0.15 ? C.green : err < 0.35 ? C.amber : C.red;
  };

  // Summary stats
  const pastWeeks = RAW_WEEKS.filter(w => w.phase !== "future" && w.a);
  const avgMape = pastWeeks.length > 0 ? (pastWeeks.reduce((sum, w) => {
    const errs = activeMetrics.map(m => {
      const pv = w.p[m.key], av = w.a ? w.a[m.key] : null;
      return av !== null && av !== undefined && av !== 0 ? Math.abs(pv - av) / av : null;
    }).filter(e => e !== null);
    return sum + (errs.length > 0 ? errs.reduce((s, e) => s + e, 0) / errs.length : 0);
  }, 0) / pastWeeks.length) : 0;

  // Column widths
  const metricColW = metricView === "all" ? 54 : 72;
  const gridCols = `68px 30px ${activeMetrics.map(() => `${metricColW}px`).join(" ")}`;

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {[
            { id: "all", label: "All Metrics" },
            { id: "traffic", label: "Traffic" },
            { id: "leasing", label: "Leasing" },
            { id: "financial", label: "Financial" },
          ].map(v => (
            <button key={v.id} onClick={() => setMetricView(v.id)} style={{
              background: metricView === v.id ? C.cyan + "22" : C.surface,
              border: `1px solid ${metricView === v.id ? C.cyan + "44" : C.border}`,
              color: metricView === v.id ? C.cyan : C.dim,
              padding: "4px 10px", borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: metricView === v.id ? 600 : 400,
            }}>{v.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[
            { id: "all", label: "All" },
            { id: "future", label: "Future" },
            { id: "current", label: "This Week" },
            { id: "past", label: "Historical" },
          ].map(v => (
            <button key={v.id} onClick={() => setTimeRange(v.id)} style={{
              background: timeRange === v.id ? C.purple + "22" : "transparent",
              border: `1px solid ${timeRange === v.id ? C.purple + "44" : "transparent"}`,
              color: timeRange === v.id ? C.purple : C.muted,
              padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontSize: 10,
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted }}>Weeks Shown</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{filtered.length}</span>
        </div>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted }}>Avg MAPE (validated)</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: avgMape < 0.12 ? C.green : C.amber, fontFamily: "monospace" }}>{(avgMape * 100).toFixed(1)}%</span>
        </div>
        <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: C.muted }}>Future Predicted</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: "monospace" }}>{RAW_WEEKS.filter(w => w.phase === "future").length} wks</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, paddingLeft: 4 }}>
        <span style={{ fontSize: 9, color: C.muted }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.cyan + "33", marginRight: 3, verticalAlign: "middle" }} />Predicted
        </span>
        <span style={{ fontSize: 9, color: C.muted }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.text, marginRight: 3, verticalAlign: "middle" }} />Actual
        </span>
        <span style={{ fontSize: 9, color: C.green }}>✓ {"<"}15% err</span>
        <span style={{ fontSize: 9, color: C.amber }}>⚠ 15-35%</span>
        <span style={{ fontSize: 9, color: C.red }}>✗ {">"}35%</span>
        <span style={{ fontSize: 9, color: C.muted, marginLeft: "auto" }}>— = not reported</span>
      </div>

      {/* Data grid */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: gridCols, background: C.surfaceLight, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ padding: "6px 8px", fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Week</div>
          <div style={{ padding: "6px 2px", fontSize: 9, color: C.muted, textTransform: "uppercase", textAlign: "center" }}>Cf</div>
          {activeMetrics.map((m, i) => (
            <div key={i} style={{ padding: "6px 4px", fontSize: 9, color: C.cyan, textTransform: "uppercase", letterSpacing: 0.3, textAlign: "right" }}>
              {metricView === "all" ? m.short : m.label}
            </div>
          ))}
        </div>

        {/* Sub-header: P / A labels */}
        <div style={{ display: "grid", gridTemplateColumns: gridCols, background: C.bg, borderBottom: `1px solid ${C.border}44` }}>
          <div /><div />
          {activeMetrics.map((m, i) => (
            <div key={i} style={{ padding: "2px 4px", fontSize: 8, color: C.muted, textAlign: "right", letterSpacing: 0.5 }}>P · A</div>
          ))}
        </div>

        {/* Scrollable rows */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {filtered.map((w, wi) => {
            const isFuture = w.phase === "future";
            const isCurrent = w.phase === "current";
            const rowBg = isCurrent ? C.cyan + "0a" : isFuture ? C.blue + "06" : "transparent";
            const rowBorder = isCurrent ? C.cyan + "33" : "transparent";

            return (
              <div key={wi} style={{
                display: "grid", gridTemplateColumns: gridCols,
                borderBottom: `1px solid ${C.border}18`,
                borderLeft: `2px solid ${rowBorder}`,
                background: rowBg,
                opacity: isFuture ? 0.7 : 1,
              }}>
                {/* Week date */}
                <div style={{ padding: "5px 8px", fontSize: 11, color: isCurrent ? C.cyan : isFuture ? C.blue : C.dim, fontWeight: isCurrent ? 600 : 400 }}>
                  {w.week.slice(5)}
                  {isCurrent && <span style={{ fontSize: 7, color: C.cyan, marginLeft: 3 }}>NOW</span>}
                </div>
                {/* Confidence */}
                <div style={{ padding: "5px 2px", fontSize: 10, color: w.conf > 85 ? C.green : w.conf > 70 ? C.amber : C.dim, textAlign: "center", fontFamily: "monospace" }}>
                  {w.conf}
                </div>
                {/* Metric cells */}
                {activeMetrics.map((m, mi) => {
                  const pv = w.p[m.key];
                  const av = w.a ? w.a[m.key] : null;
                  const ec = errColor(pv, av, m.key);
                  return (
                    <div key={mi} style={{ padding: "4px 4px", textAlign: "right", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{fmtVal(pv, m)}</span>
                      {!isFuture && (
                        <>
                          <span style={{ fontSize: 8, color: C.muted }}>·</span>
                          <span style={{ fontSize: 10, color: av !== null && av !== undefined ? C.text : C.muted, fontWeight: av !== null && av !== undefined ? 600 : 400, fontFamily: "monospace" }}>
                            {fmtVal(av, m)}
                          </span>
                          {ec && <span style={{ fontSize: 7, color: ec }}>●</span>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: data source note */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 4px" }}>
        <span style={{ fontSize: 9, color: C.muted }}>Engine generates predictions every Monday · Actuals from weekly Excel uploads</span>
        <span style={{ fontSize: 9, color: C.cyan, cursor: "pointer" }}>📥 Export to CSV</span>
      </div>
    </div>
  );
}

// ── TAB 2: UPLOAD & VALIDATE ──
function UploadTab() {
  const [uploadState, setUploadState] = useState("idle");
  const [dragOver, setDragOver] = useState(false);
  const simulateUpload = () => { setUploadState("parsing"); setTimeout(() => setUploadState("validated"), 1500); };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.green, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Required (5 fields)</div>
          {UPLOAD_SCHEMA.required.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{f.field}</span>
              <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{f.example}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.amber, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>Optional (7) — Better Learning</div>
          {UPLOAD_SCHEMA.optional.map((f, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ fontSize: 12, color: C.dim }}>{f.field}</span>
              <span style={{ fontSize: 10, color: C.muted }}>{f.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div onClick={uploadState === "idle" ? simulateUpload : undefined}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); simulateUpload(); }}
        style={{
          background: dragOver ? `${C.cyan}11` : uploadState === "validated" ? `${C.greenDim}22` : C.surface,
          border: `2px dashed ${dragOver ? C.cyan : uploadState === "validated" ? C.green : C.border}`,
          borderRadius: 12, padding: 24, textAlign: "center", cursor: uploadState === "idle" ? "pointer" : "default", transition: "all 0.2s",
        }}>
        {uploadState === "idle" && (<>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Drop Weekly Report Excel</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>or click to browse · .xlsx / .xls / .csv</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
            <span style={{ fontSize: 11, color: C.cyan, cursor: "pointer" }}>📥 Download Template</span>
            <span style={{ fontSize: 11, color: C.muted }}>|</span>
            <span style={{ fontSize: 11, color: C.dim }}>Highlands format or simplified 5-field</span>
          </div>
        </>)}
        {uploadState === "parsing" && (<>
          <div style={{ fontSize: 14, color: C.cyan, fontWeight: 600 }}>⏳ Parsing & Validating...</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 6 }}>Checking columns → Cleaning data → Outlier detection → Comparing to predictions</div>
        </>)}
        {uploadState === "validated" && (<>
          <div style={{ fontSize: 14, color: C.green, fontWeight: 600, marginBottom: 8 }}>✓ Upload Successful — 1 Week Processed</div>
          <div style={{ background: C.bg, borderRadius: 8, padding: 12, textAlign: "left", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Validation — Week Ending Feb 23</div>
            <div style={{ display: "grid", gridTemplateColumns: "100px 55px 55px 55px 40px", gap: 2, fontSize: 11 }}>
              <div style={{ color: C.muted }}>Metric</div><div style={{ color: C.muted, textAlign: "right" }}>Pred</div><div style={{ color: C.muted, textAlign: "right" }}>Actual</div><div style={{ color: C.muted, textAlign: "right" }}>Error</div><div />
              {[
                { m: "Traffic", p: 14, a: 16 }, { m: "Tours", p: 7, a: 9 }, { m: "Apps", p: 3, a: 4 },
                { m: "Net Leases", p: 2, a: 3 }, { m: "Occupancy", p: 95.0, a: 95.2 }, { m: "Eff Rent", p: 1832, a: 1838 },
              ].map((r, i) => {
                const err = r.a !== 0 ? Math.abs(r.p - r.a) / r.a : 0;
                const ok = err < 0.15;
                return [
                  <div key={`m${i}`} style={{ color: C.text, fontWeight: 500, padding: "2px 0" }}>{r.m}</div>,
                  <div key={`p${i}`} style={{ color: C.dim, textAlign: "right", fontFamily: "monospace" }}>{r.p}</div>,
                  <div key={`a${i}`} style={{ color: C.text, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{r.a}</div>,
                  <div key={`e${i}`} style={{ color: ok ? C.green : C.amber, textAlign: "right", fontFamily: "monospace" }}>{(err * 100).toFixed(1)}%</div>,
                  <div key={`s${i}`} style={{ color: ok ? C.green : C.amber, textAlign: "right" }}>{ok ? "✓" : "⚠"}</div>,
                ];
              })}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: C.dim }}>MAPE: <span style={{ color: C.green, fontWeight: 600 }}>11.0%</span></span>
              <span style={{ fontSize: 10, color: C.cyan }}>✓ tour rate adjusted +0.02</span>
            </div>
          </div>
          <div onClick={() => setUploadState("idle")} style={{ fontSize: 12, color: C.cyan, cursor: "pointer", marginTop: 10 }}>Upload another →</div>
        </>)}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Upload History</div>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "85px 85px 40px 55px 60px 1fr", fontSize: 10, color: C.muted, padding: "5px 8px", background: C.surfaceLight, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <div>Uploaded</div><div>Week</div><div>Rows</div><div>Fields</div><div>MAPE</div><div>Calibration</div>
          </div>
          {UPLOAD_HISTORY.map((u, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "85px 85px 40px 55px 60px 1fr", fontSize: 11, padding: "4px 8px", borderTop: `1px solid ${C.border}22` }}>
              <div style={{ color: C.dim }}>{u.date}</div>
              <div style={{ color: C.text }}>{u.weekEnding}</div>
              <div style={{ color: C.dim }}>{u.rows}</div>
              <div style={{ color: u.metricsReported >= 7 ? C.green : C.amber }}>{u.metricsReported}/7</div>
              <div style={{ color: u.mape < 0.10 ? C.green : C.amber, fontFamily: "monospace" }}>{(u.mape * 100).toFixed(1)}%</div>
              <div style={{ color: u.calibrationApplied ? C.cyan : C.muted, fontSize: 10 }}>{u.calibrationApplied ? "✓ rates adjusted" : "within tolerance"}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[
          { label: "Consistency", desc: "Weekday×5 + Weekend×2 ≈ Total", status: "pass", color: C.green },
          { label: "Outliers", desc: "Z-score > 2.5 flagged", status: "pass", color: C.green },
          { label: "Continuity", desc: "No gaps in weekly sequence", status: "1 gap", color: C.amber },
        ].map((chk, i) => (
          <div key={i} style={{ flex: 1, background: C.surface, border: `1px solid ${chk.color}33`, borderRadius: 8, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{chk.label}</span>
              <span style={{ fontSize: 10, color: chk.color, fontWeight: 600 }}>{chk.status}</span>
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{chk.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB 3: LEARNING LOOP ──
function LearningTab() {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>How the Engine Gets Smarter</div>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>Each upload recalibrates conversion rates using EMA (α = 0.15)</div>

      <div style={{ background: C.surfaceLight, border: `1px solid ${C.cyan}33`, borderRadius: 10, padding: 14, marginBottom: 14, fontFamily: "monospace" }}>
        <div style={{ fontSize: 10, color: C.cyan, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Recalibration Formula</div>
        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8 }}>
          <div>new_rate = α × <span style={{ color: C.green }}>actual_rate</span> + (1 - α) × <span style={{ color: C.amber }}>old_rate</span></div>
          <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>α = 0.15 (converges in ~15 uploads) · Outlier dampening: α = 0.05 when |error| {">"} 3σ</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Learned Conversion Rates</div>
      {Object.entries(LEARNED_RATES).map(([key, r]) => (
        <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1").trim()}</span>
              {r.v1Default && <span style={{ fontSize: 10, color: C.red, marginLeft: 8, textDecoration: "line-through" }}>v1: {(r.v1Default * 100).toFixed(0)}%</span>}
            </div>
            <span style={{ fontSize: 10, color: r.trend === "rising" ? C.green : r.trend === "falling" ? C.amber : C.dim, fontWeight: 600 }}>
              {r.trend === "rising" ? "↑ Rising" : r.trend === "falling" ? "↓ Falling" : "→ Stable"}
            </span>
          </div>
          <div style={{ position: "relative", height: 30, background: C.bg, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: `${r.seasonal.winter * 100}%`, width: `${(r.seasonal.summer - r.seasonal.winter) * 100}%`, top: 2, bottom: 2, background: `${C.cyan}15`, borderRadius: 4 }} />
            <div style={{ position: "absolute", left: `${r.current * 100}%`, top: 0, bottom: 0, width: 3, background: C.green, borderRadius: 2, transform: "translateX(-1px)" }} />
            {r.v1Default && <div style={{ position: "absolute", left: `${r.v1Default * 100}%`, top: 0, bottom: 0, width: 2, background: C.red + "66", borderRadius: 1 }} />}
            <div style={{ position: "absolute", left: `${r.seasonal.winter * 100}%`, bottom: 1, fontSize: 8, color: C.muted, transform: "translateX(-50%)" }}>{(r.seasonal.winter * 100).toFixed(0)}%</div>
            <div style={{ position: "absolute", left: `${r.current * 100}%`, top: 1, fontSize: 9, color: C.green, fontWeight: 700, transform: "translateX(-50%)" }}>{(r.current * 100).toFixed(0)}%</div>
            <div style={{ position: "absolute", left: `${r.seasonal.summer * 100}%`, bottom: 1, fontSize: 8, color: C.muted, transform: "translateX(-50%)" }}>{(r.seasonal.summer * 100).toFixed(0)}%</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: C.muted }}>
            <span>Learned from {r.learnedFrom} weeks</span>
            <span>Winter: {(r.seasonal.winter * 100).toFixed(0)}% · Summer: {(r.seasonal.summer * 100).toFixed(0)}%</span>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 14, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Confidence by Data Volume</div>
      <div style={{ display: "flex", gap: 4 }}>
        {[
          { weeks: "0", label: "Cold Start", conf: "40-55%", color: C.red },
          { weeks: "4-8", label: "Early", conf: "55-70%", color: C.amber },
          { weeks: "13-26", label: "Calibrating", conf: "70-85%", color: C.amber },
          { weeks: "52+", label: "Trained", conf: "85-95%", color: C.green },
          { weeks: "104+", label: "High Fidelity", conf: "90-97%", color: C.cyan },
        ].map((t, i) => (
          <div key={i} style={{ flex: 1, background: C.surface, border: `1px solid ${t.color}33`, borderRadius: 8, padding: 6, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: t.color }}>{t.conf}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.text, marginTop: 2 }}>{t.label}</div>
            <div style={{ fontSize: 8, color: C.dim }}>{t.weeks} wks</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.greenDim + "33", border: `1px solid ${C.green}33`, borderRadius: 8, padding: 10, marginTop: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>✓ No Systematic Bias Detected</div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 3 }}>Last 6 uploads: 3 over, 3 under. Bias threshold: {">"} 75% one direction across 4+ consecutive weeks.</div>
      </div>
    </div>
  );
}

// ── TAB 4: PROJECTION ──
function ProjectionTab() {
  const [view, setView] = useState("occupancy");
  const [bands, setBands] = useState(true);
  const drawChart = useCallback((ctx, w, h) => {
    const pad = { top: 28, right: 55, bottom: 36, left: 48 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    const data = PROJECTION;
    const isOcc = view === "occupancy", isRent = view === "rent";
    let minY, maxY, vals, hi, lo, fmt, lc;
    if (isOcc) { minY=85; maxY=100; vals=data.map(d=>d.occ); hi=data.map(d=>d.occHigh); lo=data.map(d=>d.occLow); fmt=v=>v.toFixed(1)+"%"; lc=C.cyan; }
    else if (isRent) { minY=1700; maxY=2300; vals=data.map(d=>d.rent); hi=data.map(d=>d.rentHigh); lo=data.map(d=>d.rentLow); fmt=v=>"$"+Math.round(v); lc=C.green; }
    else { minY=0; maxY=650000; vals=data.map(d=>d.revenue); hi=data.map(d=>Math.round(d.revenue*1.03)); lo=data.map(d=>Math.round(d.revenue*0.97)); fmt=v=>"$"+(v/1000).toFixed(0)+"K"; lc=C.blue; }
    const xS=i=>pad.left+(i/(data.length-1))*cw, yS=v=>pad.top+(1-(v-minY)/(maxY-minY))*ch;
    if (bands) { ctx.beginPath(); for(let i=0;i<data.length;i++) ctx.lineTo(xS(i),yS(hi[i])); for(let i=data.length-1;i>=0;i--) ctx.lineTo(xS(i),yS(lo[i])); ctx.closePath(); ctx.fillStyle=lc+"11"; ctx.fill(); }
    ctx.strokeStyle="#1a274433"; ctx.lineWidth=1;
    for(let i=0;i<=4;i++) { const y=pad.top+(i/4)*ch; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke(); ctx.fillStyle="#475569"; ctx.font="10px monospace"; ctx.textAlign="right"; ctx.fillText(fmt(maxY-(i/4)*(maxY-minY)),pad.left-4,y+3); }
    [0,12,24,36,48].forEach(m => { if(m<data.length) { const x=xS(m); ctx.strokeStyle="#1a274455"; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+ch); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="#64748b"; ctx.font="10px system-ui"; ctx.textAlign="center"; ctx.fillText(`Y${m/12+1}`,x,h-8); }});
    ctx.beginPath(); vals.forEach((v,i)=>i===0?ctx.moveTo(xS(i),yS(v)):ctx.lineTo(xS(i),yS(v))); ctx.strokeStyle=lc; ctx.lineWidth=2.5; ctx.lineJoin="round"; ctx.stroke();
    ctx.fillStyle=lc; ctx.font="bold 11px monospace"; ctx.textAlign="left"; ctx.fillText(fmt(vals[vals.length-1]),xS(vals.length-1)+6,yS(vals[vals.length-1])+4);
    ctx.fillStyle="#e2e8f0"; ctx.font="bold 12px system-ui"; ctx.textAlign="left"; ctx.fillText(`5-Year ${isOcc?"Occupancy":isRent?"Effective Rent":"Revenue"} Projection`,pad.left,16);
  }, [view, bands]);
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {[{id:"occupancy",label:"Occupancy",color:C.cyan},{id:"rent",label:"Eff Rent",color:C.green},{id:"revenue",label:"Revenue",color:C.blue}].map(v=>(
          <button key={v.id} onClick={()=>setView(v.id)} style={{ background:view===v.id?v.color+"22":C.surface, border:`1px solid ${view===v.id?v.color:C.border}`, color:view===v.id?v.color:C.dim, padding:"5px 12px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:view===v.id?600:400 }}>{v.label}</button>
        ))}
        <button onClick={()=>setBands(!bands)} style={{ marginLeft:"auto", background:bands?C.purple+"22":C.surface, border:`1px solid ${bands?C.purple:C.border}`, color:bands?C.purple:C.dim, padding:"5px 10px", borderRadius:6, cursor:"pointer", fontSize:10 }}>{bands?"◉":"○"} Bands</button>
      </div>
      <Canvas draw={drawChart} width={680} height={260} style={{ borderRadius:10, border:`1px solid ${C.border}` }} />
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[{yr:"Y1",occ:"95.2%",rent:"$1,877",rev:"$6.1M",conf:"92%"},{yr:"Y3",occ:"95.8%",rent:"$1,997",rev:"$6.6M",conf:"78%"},{yr:"Y5",occ:"95.5%",rent:"$2,124",rev:"$7.0M",conf:"65%"}].map((m,i)=>(
          <div key={i} style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:8 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.cyan }}>{m.yr}</div>
            <div style={{ fontSize:10, color:C.dim }}>Occ <span style={{color:C.text}}>{m.occ}</span> · Rent <span style={{color:C.green}}>{m.rent}</span> · Rev <span style={{color:C.text}}>{m.rev}</span></div>
            <div style={{ fontSize:9, color:C.muted }}>Confidence: {m.conf}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TAB 5: SEASONAL ──
function SeasonalTab() {
  const drawHeatmap = useCallback((ctx, w, h) => {
    const pad={top:22,right:8,bottom:28,left:38}, cellW=(w-pad.left-pad.right)/52, cellH=24;
    const rows=[{label:"Traffic",data:SEASONAL.map(s=>s.traffic/25),color:C.cyan},{label:"Leases",data:SEASONAL.map(s=>s.leases/9),color:C.green}];
    ctx.fillStyle="#e2e8f0"; ctx.font="bold 11px system-ui"; ctx.fillText("Learned Seasonal Pattern (52 Weeks)",pad.left,14);
    rows.forEach((row,ri)=>{ const y=pad.top+ri*(cellH+3); ctx.fillStyle="#64748b"; ctx.font="9px system-ui"; ctx.textAlign="right"; ctx.fillText(row.label,pad.left-3,y+cellH/2+3);
      row.data.forEach((val,wi)=>{ ctx.fillStyle=row.color+Math.round(Math.max(0.05,Math.min(1,val))*200).toString(16).padStart(2,"0"); ctx.fillRect(pad.left+wi*cellW+0.5,y,cellW-1,cellH); });
    });
    ctx.fillStyle="#64748b"; ctx.font="8px system-ui"; ctx.textAlign="center";
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].forEach((m,i)=>{ ctx.fillText(m,pad.left+(i*4.33+2)*cellW,pad.top+2*(cellH+3)+12); });
  }, []);
  return (
    <div>
      <Canvas draw={drawHeatmap} width={680} height={100} style={{ borderRadius:10, border:`1px solid ${C.border}`, marginBottom:10 }} />
      <div style={{ display:"flex", gap:8 }}>
        <div style={{ flex:1, background:C.greenDim+"44", border:`1px solid ${C.green}33`, borderRadius:8, padding:10 }}>
          <div style={{ color:C.green, fontSize:12, fontWeight:700 }}>Peak: Weeks 20-32 (May-Aug)</div>
          <div style={{ color:C.dim, fontSize:11, marginTop:3 }}>Avg 20 walk-ins/wk, 7 net leases/wk. Fill vacancies here.</div>
        </div>
        <div style={{ flex:1, background:C.redDim+"44", border:`1px solid ${C.red}33`, borderRadius:8, padding:10 }}>
          <div style={{ color:C.red, fontSize:12, fontWeight:700 }}>Risk: Weeks 44-52 (Nov-Dec)</div>
          <div style={{ color:C.dim, fontSize:11, marginTop:3 }}>Avg 3 walk-ins/wk, 0-1 leases. Vacancy stays until spring.</div>
        </div>
      </div>
    </div>
  );
}

// ── TAB 6: WIRING ──
function WiringTab() {
  const mods = [
    { module:"M09 ProForma", color:C.green, icon:"◆", items:[
      {label:"Vacancy",engine:"4.8%",market:"5.5%",note:"Learned occupancy beats market default"},
      {label:"Rent Growth",engine:"+3.2%/yr",market:"+2.8%/yr",note:"243wk actuals > submarket avg"},
      {label:"Absorption",engine:"156/yr",market:"130/yr",note:"3/wk × seasonal adjustment"},
    ]},
    { module:"M08 Strategy Arbitrage", color:C.blue, icon:"◈", items:[
      {label:"Position",engine:"+5 pts",market:"0",note:"Strong velocity + accelerating"},
      {label:"Hold Boost",engine:"+4",market:"0",note:"High occ + rent growth → Hold"},
    ]},
    { module:"M25 JEDI Score", color:C.purple, icon:"◉", items:[
      {label:"Position",engine:"+4 pts",market:"0",note:"4 of 15 Position points from traffic"},
    ]},
  ];
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:10 }}>How Traffic Engine v2 Adjusts Other Modules</div>
      {mods.map((mod,mi)=>(
        <div key={mi} style={{ background:C.surface, border:`1px solid ${mod.color}33`, borderRadius:10, padding:12, marginBottom:8 }}>
          <div style={{ color:mod.color, fontSize:13, fontWeight:700, marginBottom:8 }}>{mod.icon} → {mod.module}</div>
          {mod.items.map((a,ai)=>(
            <div key={ai} style={{ display:"flex", alignItems:"center", gap:10, padding:"4px 0", borderBottom:ai<mod.items.length-1?`1px solid ${C.border}22`:"none" }}>
              <span style={{ color:C.dim, fontSize:11, minWidth:80 }}>{a.label}</span>
              <span style={{ color:C.green, fontSize:12, fontWeight:600, fontFamily:"monospace", minWidth:65 }}>{a.engine}</span>
              <span style={{ color:C.muted, fontSize:10 }}>vs {a.market}</span>
              <span style={{ color:C.dim, fontSize:10, flex:1 }}>{a.note}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── TAB 7: FORMULA FIXES ──
function FixesTab() {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:C.text }}>Formula Fixes Required</div>
          <div style={{ fontSize:11, color:C.dim }}>Engine code vs Highlands actuals + validation supplement</div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {["critical","high","medium"].map(s => {
            const count = FORMULA_FIXES.filter(f=>f.severity===s).length;
            const col = s==="critical"?C.red:s==="high"?C.amber:C.muted;
            return <span key={s} style={{ fontSize:9, color:col, background:col+"18", padding:"2px 6px", borderRadius:3, fontWeight:600, textTransform:"uppercase" }}>{count} {s}</span>;
          })}
        </div>
      </div>
      {FORMULA_FIXES.map((fix,i) => {
        const col = fix.severity==="critical"?C.red:fix.severity==="high"?C.amber:C.muted;
        return (
          <div key={i} style={{ background:C.surface, border:`1px solid ${col}33`, borderRadius:8, padding:12, marginBottom:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:10, color:C.cyan, fontFamily:"monospace", background:C.cyan+"15", padding:"1px 5px", borderRadius:3 }}>{fix.id}</span>
                <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{fix.title}</span>
              </div>
              <span style={{ fontSize:9, fontWeight:600, textTransform:"uppercase", padding:"1px 5px", borderRadius:3, background:col+"22", color:col }}>{fix.severity}</span>
            </div>
            <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:3 }}>{fix.file}</div>
            <div style={{ fontSize:11, color:C.red+"bb", marginBottom:3 }}>Current: {fix.current}</div>
            <div style={{ fontSize:11, color:C.green, background:C.greenDim+"22", padding:"4px 8px", borderRadius:4, marginBottom:3 }}>Fix: {fix.fix}</div>
            <div style={{ fontSize:10, color:C.cyan+"bb", borderTop:`1px solid ${C.border}22`, paddingTop:4, marginTop:4 }}>
              📋 Validation: {fix.validation}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function TrafficEngineV2() {
  const [tab, setTab] = useState("funnel");
  const content = { funnel:<FunnelTab/>, rawdata:<RawDataTab/>, upload:<UploadTab/>, learning:<LearningTab/>, projection:<ProjectionTab/>, seasonal:<SeasonalTab/>, wiring:<WiringTab/>, fixes:<FixesTab/> };

  return (
    <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"'DM Sans', system-ui, sans-serif", color:C.text }}>
      <div style={{ background:`linear-gradient(180deg, ${C.surfaceLight} 0%, ${C.bg} 100%)`, borderBottom:`1px solid ${C.border}`, padding:"12px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:2, color:C.cyan }}>Deal Capsule → Traffic Engine v2</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.text, marginTop:2 }}>🚦 {PROPERTY.name}</div>
            <div style={{ fontSize:11, color:C.dim }}>{PROPERTY.units} units · {PROPERTY.type} · {PROPERTY.submarket}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:9, color:C.muted }}>Calibration</div>
            <div style={{ fontSize:14, fontWeight:700, color:C.green, fontFamily:"monospace" }}>{PROPERTY.dataWeeks} weeks</div>
            <div style={{ fontSize:9, color:C.dim }}>{PROPERTY.firstWeek} → {PROPERTY.lastWeek}</div>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:1, padding:"6px 18px", borderBottom:`1px solid ${C.border}`, background:C.surface, overflowX:"auto" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:tab===t.id?C.cyan+"18":"transparent", border:`1px solid ${tab===t.id?C.cyan+"44":"transparent"}`,
            color:tab===t.id?C.cyan:C.dim, padding:"5px 11px", borderRadius:5, cursor:"pointer", fontSize:11,
            fontWeight:tab===t.id?600:400, whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding:"16px 18px", maxWidth:720, margin:"0 auto" }}>
        {content[tab]}
      </div>
    </div>
  );
}
