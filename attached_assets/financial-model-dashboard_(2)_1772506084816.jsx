import { useState, useRef, useEffect, useCallback } from "react";

const INITIAL_MODEL = {
  propertyName: "ShoreView Waterfront Apartments",
  meta: "216 Units | Bradenton, FL | 2021 Vintage",
  acquisition: {
    units: 216, sqft: 221184, purchasePrice: 58000000,
    closingCostsPct: 0.02, acquisitionDate: "Q2 2026",
  },
  capex: {
    interiorPerUnit: 5000,
    unitsY1: 45, unitsY2: 40, unitsY3: 35, unitsY4: 25, unitsY5: 15,
    renovationPremium: 85, exteriorCapex: 175000,
    deferredMaintenance: 75000, ongoingReservePerUnit: 200,
  },
  revenue: {
    currentMonthlyRent: 384116, currentAvgRentOccupied: 1970,
    currentAvgMarketRent: 2076, currentOccupancy: 0.903,
    stabilizedOccupancy: 0.95,
    rentGrowthY1: 0.04, rentGrowthY2: 0.035, rentGrowthY3: 0.03,
    rentGrowthY4: 0.025, rentGrowthY5: 0.025,
  },
  debt: {
    selectedLoan: "freddie7",
    loans: {
      freddie7: { name: "Freddie Mac 7-Yr", ltv: 0.63, rate: 0.052, ioYears: 3.5, amortYears: 35, proceeds: 36540000 },
      freddie5: { name: "Freddie Mac 5-Yr", ltv: 0.65, rate: 0.0505, ioYears: 1.5, amortYears: 30, proceeds: 37470000 },
      debtFund: { name: "Debt Fund Bridge", ltv: 0.72, rate: 0.065, ioYears: 2, amortYears: 25, proceeds: 41760000 },
    },
  },
  exit: { holdYears: 7, exitCapRate: 0.055, saleCostPct: 0.015 },
  scenarios: {
    base: { irr: 35.9, equityMultiple: 8.58, cashOnCash: 25, noi: 2350000, dscr: 3.53, yoc: 14.2, exitValue: 55100000 },
    best: { irr: 40.8, equityMultiple: 10.96, cashOnCash: 27.5, noi: 2524000, dscr: 3.79, yoc: 15.3, exitValue: 69900000 },
    worst: { irr: 28.7, equityMultiple: 5.84, cashOnCash: 20.4, noi: 2095000, dscr: 2.92, yoc: 12.7, exitValue: 38800000 },
  },
};

const MODULES_DEF = [
  { id: "strategy", label: "Strategy", icon: "⊕", description: "Strategy Arbitrage Engine (M08)", fields: ["BTS / Flip / Rental / STR scores", "Arbitrage flag when delta >15pts", "Recommended strategy"] },
  { id: "traffic", label: "Traffic", icon: "↗", description: "Traffic Fusion Engine v2 (M10)", fields: ["AADT from Florida DOT", "Digital traffic via SpyFu", "Weekly walk-in forecast"] },
  { id: "proforma", label: "Pro Forma", icon: "$", description: "Pro Forma Engine (M05)", fields: ["NOI projection 5-year", "Rent roll with occupancy", "Expense assumptions"] },
  { id: "debt", label: "Debt", icon: "○", description: "Capital Structure Engine (M06)", fields: ["3 loan options compared", "DSCR & IO analysis", "Defeasance modeling"] },
];

function computeModel(m) {
  const loan = m.debt.loans[m.debt.selectedLoan];
  const totalInteriorCapex = (m.capex.unitsY1 + m.capex.unitsY2 + m.capex.unitsY3 + m.capex.unitsY4 + m.capex.unitsY5) * m.capex.interiorPerUnit;
  const totalDay1Capex = m.capex.exteriorCapex + m.capex.deferredMaintenance;
  const closingCosts = m.acquisition.purchasePrice * m.acquisition.closingCostsPct;
  const totalCost = m.acquisition.purchasePrice + closingCosts + totalInteriorCapex + totalDay1Capex;
  const equity = totalCost - loan.proceeds;
  const annualDebtService = loan.proceeds * loan.rate;
  const stabilizedNOI = m.revenue.currentMonthlyRent * 12 * (1 + m.revenue.rentGrowthY1) * m.revenue.stabilizedOccupancy;
  const dscr = stabilizedNOI / annualDebtService;
  const exitValue = stabilizedNOI / m.exit.exitCapRate;
  const netProceeds = exitValue * (1 - m.exit.saleCostPct) - loan.proceeds;
  return { loan, totalInteriorCapex, totalDay1Capex, closingCosts, totalCost, equity, annualDebtService, stabilizedNOI, dscr, exitValue, netProceeds };
}

const fmt$ = (n) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n) => `${(n*100).toFixed(1)}%`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.fd{display:flex;height:100vh;font-family:'Inter',sans-serif;overflow:hidden;background:#f0f2f5}

/* ── CHAT (dark) ── */
.fc{width:380px;min-width:320px;display:flex;flex-direction:column;background:#0c0d10;border-right:1px solid #1c1e26;flex-shrink:0}
.fc-top{padding:14px 16px 12px;border-bottom:1px solid #181a21;flex-shrink:0}
.fc-brand{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.fc-mark{width:24px;height:24px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#000;font-family:'Syne',sans-serif}
.fc-name{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#e1e4ea;letter-spacing:.04em}
.fc-name span{color:#f59e0b}
.fc-h{font-size:12px;font-weight:600;color:#c5cad4;margin-bottom:2px}
.fc-s{font-size:11px;color:#3e4455;line-height:1.4}
.fc-ctx{padding:7px 16px;border-bottom:1px solid #181a21;background:#09090c;display:flex;align-items:center;gap:6px;flex-shrink:0}
.fc-dot{width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 5px #22c55e;flex-shrink:0}
.fc-ctxt{font-size:10.5px;color:#3e4455;font-family:'JetBrains Mono',monospace}
.fc-ctxt b{color:#f59e0b;font-weight:500}
.fc-msgs{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:0;scrollbar-width:thin;scrollbar-color:#1c1e26 transparent}
.fc-msg{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid #121419}
.fc-msg:last-child{border-bottom:none}
.fc-av{width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;font-family:'Syne',sans-serif}
.fc-av.u{background:#16244a;color:#60a5fa;border:1px solid #1d3461}
.fc-av.a{background:#38200a;color:#f59e0b;border:1px solid #78350f}
.fc-mi{flex:1;min-width:0}
.fc-mr{font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;margin-bottom:4px;color:#383d4a}
.fc-mr.a{color:#f59e0b}
.fc-mt{font-size:12.5px;line-height:1.65;color:#c5cad4}
.fc-mt p{margin-bottom:5px}
.fc-mt p:last-child{margin-bottom:0}
.fc-chip{display:inline-flex;align-items:center;gap:4px;margin-top:7px;padding:3px 9px;border-radius:4px;font-size:10.5px;font-family:'JetBrains Mono',monospace;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.2);color:#4ade80}
.fc-think{display:flex;gap:3px;align-items:center;padding:3px 0}
.fc-think span{width:4px;height:4px;border-radius:50%;background:#f59e0b;animation:fp 1.2s ease-in-out infinite}
.fc-think span:nth-child(2){animation-delay:.2s}
.fc-think span:nth-child(3){animation-delay:.4s}
@keyframes fp{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
.fc-qp{padding:8px 14px 6px;border-top:1px solid #181a21;display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0}
.fc-qb{padding:4px 9px;border-radius:3px;font-size:10.5px;cursor:pointer;border:1px solid #1c1e26;background:#11131a;color:#3e4455;transition:all .12s;font-family:'Inter',sans-serif}
.fc-qb:hover{border-color:#f59e0b;color:#f59e0b;background:rgba(245,158,11,.06)}
.fc-ia{padding:10px 14px 12px;border-top:1px solid #181a21;flex-shrink:0}
.fc-ii{display:flex;align-items:flex-end;gap:8px;background:#11131a;border:1px solid #1c1e26;border-radius:8px;padding:8px 10px;transition:border-color .12s}
.fc-ii:focus-within{border-color:#f59e0b}
.fc-ii textarea{flex:1;background:transparent;border:none;outline:none;color:#c5cad4;font-size:12.5px;font-family:'Inter',sans-serif;resize:none;line-height:1.5;max-height:100px;overflow-y:auto}
.fc-ii textarea::placeholder{color:#272b35}
.fc-sb{width:28px;height:28px;border-radius:5px;border:none;background:#f59e0b;color:#000;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;transition:all .12s}
.fc-sb:hover{background:#d97706}
.fc-sb:disabled{background:#1c1e26;color:#272b35;cursor:not-allowed}
@keyframes mi{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.mi{animation:mi .2s ease-out}

/* ── MODEL PANEL (light) ── */
.fm{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f0f2f5}
.fm-tb{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:48px;background:#fff;border-bottom:1px solid #e2e5ed;flex-shrink:0}
.fm-tbl{display:flex;align-items:center;gap:8px}
.fm-logo{font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#111827}
.fm-logo span{color:#f59e0b}
.fm-sep{width:1px;height:14px;background:#e2e5ed}
.fm-bc{font-size:12px;color:#6b7280;display:flex;align-items:center;gap:5px}
.fm-bc strong{color:#111827}
.fm-tbr{display:flex;align-items:center;gap:6px}
.fm-bdg{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:500;border:1px solid}
.fm-bdg.amb{background:#fffbeb;color:#b45309;border-color:#fcd34d}
.fm-bdg.grn{background:#f0fdf4;color:#166534;border-color:#86efac}
.fm-act{padding:5px 10px;border-radius:5px;font-size:11px;border:1px solid #e2e5ed;background:#f9fafb;color:#6b7280;cursor:pointer;transition:all .12s;font-family:'Inter',sans-serif}
.fm-act:hover{border-color:#d1d5db;color:#374151}

/* HERO CARD */
.fm-hero{margin:16px 20px 0;background:#13151c;border-radius:10px 10px 0 0;padding:18px 22px 16px;border:1px solid #1e2028;border-bottom:none;flex-shrink:0}
.fm-hl{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4a8cf0;margin-bottom:8px;font-family:'JetBrains Mono',monospace}
.fm-ht{font-size:19px;font-weight:700;color:#eef0f5;font-family:'Syne',sans-serif;margin-bottom:5px;line-height:1.2}
.fm-hs{font-size:12px;color:#454d5e;line-height:1.4}

/* MODULE BAR */
.fm-mb{margin:0 20px;background:#fff;border:1px solid #e2e5ed;border-top:none;padding:10px 16px;display:flex;align-items:center;gap:7px;flex-shrink:0;flex-wrap:wrap}
.fm-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:500;border:1.5px solid;cursor:pointer;transition:all .15s;font-family:'Inter',sans-serif}
.fm-pill.inactive{border-color:#e2e5ed;color:#9ba3b0;background:#f9fafb}
.fm-pill.inactive:hover{border-color:#d1d5db;color:#6b7280}
.fm-pill.live{border-color:#22c55e;color:#15803d;background:#f0fdf4}
.fm-pill.mock{border-color:#f59e0b;color:#b45309;background:#fffbeb}
.fm-pill.error{border-color:#ef4444;color:#b91c1c;background:#fef2f2}
.fp-icon{font-size:10px}
.fp-name{font-weight:600}
.fp-st{font-size:10px;font-weight:400;opacity:.8}
.fm-mc{margin-left:auto;font-size:11px;color:#9ba3b0;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.fm-mc b{color:#374151}
.fm-rfr{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;border:1px solid #e2e5ed;background:#f9fafb;color:#6b7280;font-size:11px;cursor:pointer;transition:all .12s;font-family:'Inter',sans-serif}
.fm-rfr:hover{border-color:#d1d5db;color:#374151}

/* MODULE DETAIL */
.fm-md{margin:0 20px;background:#fff;border:1px solid #e2e5ed;border-top:1px solid #f3f4f6;overflow:hidden;max-height:0;transition:max-height .25s ease;flex-shrink:0}
.fm-md.open{max-height:220px}
.fm-mdi{padding:14px 16px}
.fm-mdi h4{font-size:12px;font-weight:700;color:#1f2937;margin-bottom:10px}
.fm-mg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.fm-mi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}
.fm-mil{font-size:9.5px;color:#9ba3b0;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
.fm-min{font-size:12px;font-weight:700;color:#1f2937;margin-bottom:4px}
.fm-mif{font-size:10.5px;color:#6b7280;line-height:1.5}
.fm-mist{display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:600}
.fm-mist.live{background:#dcfce7;color:#166534}
.fm-mist.mock{background:#fef3c7;color:#92400e}
.fm-mist.none{background:#f3f4f6;color:#6b7280}

/* TABS */
.fm-tabs{margin:0 20px;border-bottom:1px solid #e2e5ed;background:#fff;display:flex;align-items:center;padding:0 4px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}
.fm-tab{padding:11px 16px;font-size:12.5px;font-weight:500;color:#9ba3b0;cursor:pointer;border-bottom:2px solid transparent;transition:all .12s;white-space:nowrap;background:transparent;border-top:none;border-left:none;border-right:none;display:flex;align-items:center;gap:5px;font-family:'Inter',sans-serif}
.fm-tab:hover:not(.on){color:#4b5563}
.fm-tab.on{color:#111827;border-bottom-color:#111827;font-weight:600}

/* CONTENT */
.fm-cnt{flex:1;overflow-y:auto;margin:0 20px 16px;background:#fff;border:1px solid #e2e5ed;border-top:none;border-radius:0 0 10px 10px;scrollbar-width:thin;scrollbar-color:#e2e5ed transparent}

/* COMPARISON */
.cmp{padding:24px}
.cmp-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px}
.cmp-hdr h3{font-size:16px;font-weight:700;color:#111827;margin-bottom:3px}
.cmp-hdr p{font-size:12px;color:#9ba3b0}
.cmp-tbl{width:100%;border-collapse:collapse}
.cmp-tbl thead tr{border-bottom:2px solid #f3f4f6}
.cmp-tbl thead th{padding:12px 16px;text-align:left;font-weight:400;vertical-align:top}
.th-lbl{width:160px;font-size:11px;color:#9ba3b0;text-transform:uppercase;letter-spacing:.06em;font-family:'JetBrains Mono',monospace}
.th-base{background:#eef2ff;border-radius:8px 8px 0 0}
.th-base .cn{font-size:15px;font-weight:700;color:#1e3a8a}
.th-base .cs{font-size:11px;color:#6b7280;margin-top:2px}
.th-best .cn{font-size:15px;font-weight:700;color:#111827}
.th-best .cs{font-size:11px;color:#9ba3b0;margin-top:2px}
.th-worst .cn{font-size:15px;font-weight:700;color:#111827}
.th-worst .cs{font-size:11px;color:#9ba3b0;margin-top:2px}
.cmp-tbl tbody tr{border-bottom:1px solid #f9fafb}
.cmp-tbl tbody tr:hover td{background:#fcfcfd}
.cmp-tbl tbody tr:hover .cb{background:#e8edff}
td.cm{padding:14px 16px;vertical-align:middle}
td.cm-lbl{font-size:13px;color:#374151}
td.cb{background:#eef2ff}
.cv{font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#111827}
td.cbe .cv{color:#059669}
td.cwo .cv{color:#dc2626}
.cd{font-size:11px;margin-top:2px;font-family:'JetBrains Mono',monospace}
.cd.p{color:#059669}
.cd.n{color:#dc2626}
.ai-call{margin-top:20px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px}
.ai-call h4{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.ai-call ul{list-style:none;display:flex;flex-direction:column;gap:5px}
.ai-call li{font-size:12px;color:#78350f;display:flex;gap:7px;line-height:1.5}
.ai-call li strong{color:#451a03}

/* ASSUMPTIONS */
.ass{padding:24px}
.slbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ba3b0;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #f3f4f6;font-family:'JetBrains Mono',monospace}
.dtbl{width:100%;border-collapse:collapse;margin-bottom:22px}
.dtbl th{text-align:left;padding:7px 12px;font-size:10px;color:#9ba3b0;font-weight:600;letter-spacing:.05em;text-transform:uppercase;background:#f9fafb;border-bottom:1px solid #f3f4f6}
.dtbl td{padding:9px 12px;border-bottom:1px solid #f9fafb;font-size:12px;color:#374151}
.dtbl tr:last-child td{border-bottom:none}
.dtbl tr:hover td{background:#fcfcfd}
.tv{font-family:'JetBrains Mono',monospace;font-weight:600;color:#111827;text-align:right}
.thl{font-family:'JetBrains Mono',monospace;font-weight:700;color:#1d4ed8;text-align:right}
.tgr{font-family:'JetBrains Mono',monospace;font-weight:700;color:#059669;text-align:right}
.tsc{font-size:10px;color:#9ba3b0;font-style:italic}

/* DEBT */
.dbt{padding:24px}
.lc{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.lcard{border:2px solid #e5e7eb;border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color .15s;background:#fff}
.lcard:hover{border-color:#93c5fd}
.lcard.sel{border-color:#2563eb}
.lch{padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
.lch span{font-size:12px;font-weight:700;color:#111827}
.lch .sd{width:8px;height:8px;border-radius:50%;background:#2563eb}
.lr{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f3f4f6}
.lr:last-child{border-bottom:none}
.lr .lk{font-size:11px;color:#9ba3b0}
.lr .lv{font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;color:#111827}

/* SENSITIVITY */
.sns{padding:24px}
.scard{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px}
.stit{padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#374151}
.ht{width:100%;border-collapse:collapse}
.ht th{padding:7px 12px;text-align:center;font-size:10.5px;color:#9ba3b0;border-bottom:1px solid #f3f4f6;font-family:'JetBrains Mono',monospace;background:#f9fafb}
.ht td{padding:8px 12px;text-align:center;font-size:12px;font-family:'JetBrains Mono',monospace;font-weight:600;border-bottom:1px solid #f9fafb}
.rl{font-size:11px;color:#9ba3b0;background:#f9fafb;font-weight:400;border-right:1px solid #e5e7eb;text-align:left}

/* DECISION */
.dec{padding:24px}
.win{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;margin-bottom:20px}
.win h4{font-size:14px;font-weight:700;color:#1e40af}
.win p{font-size:11px;color:#6b7280;margin-top:2px}
.bbl{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:600;background:#dbeafe;color:#1d4ed8;border:1px solid #93c5fd}
.bgr{padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:600;background:#dcfce7;color:#166534;border:1px solid #86efac}
.dc{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px}
.dc h4{font-size:13px;font-weight:700;color:#111827;margin-bottom:10px;display:flex;align-items:center;gap:7px}
.dc ul{list-style:none}
.dc li{font-size:12px;color:#6b7280;padding:6px 0;border-bottom:1px solid #e5e7eb;display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.dc li:last-child{border-bottom:none}

@keyframes spin{to{transform:rotate(360deg)}}
`;

const METRICS = [
  { key: "irr", label: "IRR", fmt: v => `${v}%` },
  { key: "equityMultiple", label: "Equity Multiple", fmt: v => `${v}x` },
  { key: "cashOnCash", label: "Cash-on-Cash", fmt: v => `${v}%` },
  { key: "noi", label: "Year 1 NOI", fmt: v => fmt$(v) },
  { key: "dscr", label: "DSCR", fmt: v => `${v}x` },
  { key: "yoc", label: "Yield on Cost", fmt: v => `${v}%` },
  { key: "exitValue", label: "Exit Value", fmt: v => fmt$(v) },
];

function CompView({ model }) {
  const s = model.scenarios;
  return (
    <div className="cmp">
      <div className="cmp-hdr">
        <div><h3>Side-by-Side Model Comparison</h3><p>3 scenarios generated from upstream data</p></div>
        <span className="bgr">Auto-calculated</span>
      </div>
      <table className="cmp-tbl">
        <thead>
          <tr>
            <th className="th-lbl">METRIC</th>
            <th className="th-base"><div className="cn">Base Case</div><div className="cs">Pro Forma + Strategy + Traffic</div></th>
            <th className="th-best"><div className="cn">Best Case</div><div className="cs">Optimistic traffic + tight market</div></th>
            <th className="th-worst"><div className="cn">Worst Case</div><div className="cs">Weak traffic + rate pressure</div></th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map(m => {
            const bv = s.base[m.key], bev = s.best[m.key], wv = s.worst[m.key];
            const bd = (((bev - bv) / bv) * 100).toFixed(1);
            const wd = (((wv - bv) / bv) * 100).toFixed(1);
            return (
              <tr key={m.key}>
                <td className="cm cm-lbl">{m.label}</td>
                <td className="cm cb"><div className="cv">{m.fmt(bv)}</div></td>
                <td className="cm cbe"><div className="cv">{m.fmt(bev)}</div><div className="cd p">+{bd}%</div></td>
                <td className="cm cwo"><div className="cv">{m.fmt(wv)}</div><div className="cd n">{wd}%</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="ai-call">
        <h4>⚡ AI Model Intelligence</h4>
        <ul>
          <li><span>→</span><span><strong>Freddie Mac 7-Yr wins.</strong> 3–4yr IO saves ~$450K/yr vs amortizing during the stabilization ramp (Y1–Y3).</span></li>
          <li><span>→</span><span><strong>IRR spread of 12.1%</strong> between Best/Worst — deal is exit cap-sensitive. 50bps expansion compresses value by ~$8.2M.</span></li>
          <li><span>→</span><span><strong>Strategy Arbitrage:</strong> Rental highest at 84/100. STR capped by Bradenton HOA restrictions per Zoning Agent.</span></li>
        </ul>
      </div>
    </div>
  );
}

function AssView({ model }) {
  const c = computeModel(model);
  return (
    <div className="ass">
      <div className="slbl">ACQUISITION ASSUMPTIONS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{textAlign:"right"}}>Value</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>Number of Units</td><td className="tv">{model.acquisition.units}</td><td className="tsc">OM</td></tr>
          <tr><td>Total Square Feet</td><td className="tv">{model.acquisition.sqft.toLocaleString()}</td><td className="tsc">OM (216 × 1,024 avg)</td></tr>
          <tr><td>Purchase Price</td><td className="thl">{fmt$(model.acquisition.purchasePrice)}</td><td className="tsc"></td></tr>
          <tr><td>Price Per Unit</td><td className="tv">${Math.round(model.acquisition.purchasePrice/model.acquisition.units).toLocaleString()}</td><td className="tsc"></td></tr>
          <tr><td>Closing Costs</td><td className="tv">{fmtPct(model.acquisition.closingCostsPct)} — {fmt$(c.closingCosts)}</td><td className="tsc"></td></tr>
        </tbody>
      </table>
      <div className="slbl">CAPITAL IMPROVEMENTS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{textAlign:"right"}}>Value</th></tr></thead>
        <tbody>
          <tr><td>Interior Reno $/Unit</td><td className="tv">${model.capex.interiorPerUnit.toLocaleString()}</td></tr>
          <tr><td>Units Y1/Y2/Y3/Y4/Y5</td><td className="tv">{model.capex.unitsY1}/{model.capex.unitsY2}/{model.capex.unitsY3}/{model.capex.unitsY4}/{model.capex.unitsY5}</td></tr>
          <tr><td>Total Interior CapEx</td><td className="thl">{fmt$(c.totalInteriorCapex)}</td></tr>
          <tr><td>Renovation Rent Premium</td><td className="tv">${model.capex.renovationPremium}/mo</td></tr>
          <tr><td>Total Day-1 CapEx Budget</td><td className="thl">{fmt$(c.totalDay1Capex)}</td></tr>
        </tbody>
      </table>
      <div className="slbl">REVENUE ASSUMPTIONS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{textAlign:"right"}}>Value</th><th>Source</th></tr></thead>
        <tbody>
          <tr><td>Monthly Rent In-Place</td><td className="tv">{fmt$(model.revenue.currentMonthlyRent)}</td><td className="tsc">2/5/26 Rent Roll</td></tr>
          <tr><td>Current Avg Rent (Occupied)</td><td className="tv">${model.revenue.currentAvgRentOccupied.toLocaleString()}</td><td className="tsc"></td></tr>
          <tr><td>Current Avg Market Rent</td><td className="tv">${model.revenue.currentAvgMarketRent.toLocaleString()}</td><td className="tsc">Market Survey</td></tr>
          <tr><td>Current Occupancy</td><td className="tv">{fmtPct(model.revenue.currentOccupancy)}</td><td className="tsc"></td></tr>
          <tr><td>Stabilized Target</td><td className="tgr">{fmtPct(model.revenue.stabilizedOccupancy)}</td><td className="tsc"></td></tr>
          <tr><td>Rent Growth Y1/Y2/Y3</td><td className="tv">{fmtPct(model.revenue.rentGrowthY1)}/{fmtPct(model.revenue.rentGrowthY2)}/{fmtPct(model.revenue.rentGrowthY3)}</td><td className="tsc">Market Agent</td></tr>
        </tbody>
      </table>
      <div className="slbl">DERIVED OUTPUTS</div>
      <table className="dtbl">
        <thead><tr><th>Item</th><th style={{textAlign:"right"}}>Value</th></tr></thead>
        <tbody>
          <tr><td>Total Acquisition Cost</td><td className="thl">{fmt$(c.totalCost)}</td></tr>
          <tr><td>Loan Proceeds ({c.loan.name})</td><td className="tv">{fmt$(c.loan.proceeds)}</td></tr>
          <tr><td>Required Equity</td><td className="tgr">{fmt$(c.equity)}</td></tr>
          <tr><td>Stabilized NOI (Y2)</td><td className="tgr">{fmt$(c.stabilizedNOI)}</td></tr>
          <tr><td>DSCR (Stabilized)</td><td className="tgr">{c.dscr.toFixed(2)}x</td></tr>
          <tr><td>Exit Value ({model.exit.holdYears}yr @ {fmtPct(model.exit.exitCapRate)})</td><td className="thl">{fmt$(c.exitValue)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function DebtView({ model, setModel }) {
  return (
    <div className="dbt">
      <div className="slbl">LOAN OPTIONS — CLICK TO SELECT</div>
      <div className="lc">
        {Object.entries(model.debt.loans).map(([key, loan]) => (
          <div key={key} className={`lcard${model.debt.selectedLoan===key?" sel":""}`} onClick={()=>setModel(m=>({...m,debt:{...m.debt,selectedLoan:key}}))}>
            <div className="lch"><span>{loan.name}</span>{model.debt.selectedLoan===key&&<div className="sd"/>}</div>
            <div className="lr"><span className="lk">LTV</span><span className="lv">{(loan.ltv*100).toFixed(0)}%</span></div>
            <div className="lr"><span className="lk">Rate</span><span className="lv">{(loan.rate*100).toFixed(2)}%</span></div>
            <div className="lr"><span className="lk">IO Period</span><span className="lv">{loan.ioYears} yrs</span></div>
            <div className="lr"><span className="lk">Amortization</span><span className="lv">{loan.amortYears} yrs</span></div>
            <div className="lr"><span className="lk">Proceeds</span><span className="lv">{fmt$(loan.proceeds)}</span></div>
          </div>
        ))}
      </div>
      <div className="ai-call">
        <h4>⚡ AI Debt Analysis</h4>
        <ul>
          <li><span>→</span><span><strong>Freddie Mac 7-Yr selected.</strong> 3.5yr IO saves ~$450K/yr vs amortizing during the critical stabilization ramp.</span></li>
          <li><span>→</span><span><strong>5-Yr Freddie dealbreaker:</strong> Only 1.5yr IO — insufficient for a turnaround where Y1 cash flow is tight.</span></li>
          <li><span>→</span><span><strong>Debt Fund:</strong> More leverage but 6%+ floating with extension risk. Doesn't suit a 7-year hold thesis.</span></li>
        </ul>
      </div>
    </div>
  );
}

function SensView({ model }) {
  const exitCaps=[.045,.050,.055,.060,.065];
  const rents=[.02,.03,.04,.05];
  const hc=irr=>irr>40?{background:"#dcfce7",color:"#166534"}:irr>35?{background:"#d1fae5",color:"#065f46"}:irr>28?{background:"#dbeafe",color:"#1e40af"}:irr>20?{background:"#fef9c3",color:"#854d0e"}:{background:"#fee2e2",color:"#991b1b"};
  const ec=em=>em>9?{background:"#dcfce7",color:"#166534"}:em>6?{background:"#dbeafe",color:"#1e40af"}:em>4?{background:"#fef9c3",color:"#854d0e"}:{background:"#fee2e2",color:"#991b1b"};
  const ai=( cap,rg)=>Math.max(8,Math.min(55,model.scenarios.base.irr+(0.055-cap)*200+(rg-.04)*150));
  return (
    <div className="sns">
      <div className="slbl">IRR SENSITIVITY — EXIT CAP × RENT GROWTH</div>
      <div className="scard">
        <div className="stit">IRR (%) · Exit Cap Rate (rows) vs Year 1 Rent Growth (columns)</div>
        <table className="ht">
          <thead><tr><th style={{textAlign:"left",padding:"7px 12px"}}>Exit Cap ↓ / Rent →</th>{rents.map(r=><th key={r}>{(r*100).toFixed(0)}% Rent</th>)}</tr></thead>
          <tbody>{exitCaps.map(cap=><tr key={cap}><td className="rl" style={{padding:"8px 12px"}}>{(cap*100).toFixed(1)}% Cap</td>{rents.map(rg=>{const irr=ai(cap,rg);return <td key={rg} style={{...hc(irr),padding:"8px 12px"}}>{irr.toFixed(1)}%</td>})}</tr>)}</tbody>
        </table>
      </div>
      <div className="slbl">EQUITY MULTIPLE SENSITIVITY — HOLD PERIOD × EXIT CAP</div>
      <div className="scard">
        <div className="stit">Equity Multiple (x) · Hold Period (rows) vs Exit Cap Rate (columns)</div>
        <table className="ht">
          <thead><tr><th style={{textAlign:"left",padding:"7px 12px"}}>Hold ↓ / Cap →</th>{exitCaps.map(c=><th key={c}>{(c*100).toFixed(1)}%</th>)}</tr></thead>
          <tbody>{[5,6,7,8].map(h=><tr key={h}><td className="rl" style={{padding:"8px 12px"}}>{h}yr Hold</td>{exitCaps.map(cap=>{const em=Math.max(1.5,Math.min(14,8.58+(7-h)*-.8+(.055-cap)*60));return <td key={cap} style={{...ec(em),padding:"8px 12px"}}>{em.toFixed(2)}x</td>})}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function DecView({ model }) {
  const loan=model.debt.loans[model.debt.selectedLoan];
  return (
    <div className="dec">
      <div className="win">
        <div><h4>✓ Recommended: {loan.name}</h4><p>Selected by AI — IO period, rate, and turnaround cash flow match</p></div>
        <span className="bbl">High Conviction</span>
      </div>
      <div className="slbl">DECISION RATIONALE</div>
      <div className="dc">
        <h4>🏆 Why Freddie Mac 7-Year Wins</h4>
        <ul>
          <li><span>✦</span><span><strong>{fmt$(loan.proceeds)} proceeds ({(loan.ltv*100).toFixed(0)}% LTV)</strong> — DSCR-constrained below 70% max. Conservative leverage protects cash flow.</span></li>
          <li><span>✦</span><span><strong>{(loan.rate*100).toFixed(2)}% fixed rate</strong> — Locked for 7 years, eliminates rate risk across the entire hold period.</span></li>
          <li><span>✦</span><span><strong>{loan.ioYears} years IO</strong> — Saves ~$450K/yr during stabilization ramp when cash flow is tightest.</span></li>
          <li><span>✦</span><span><strong>{loan.amortYears}-yr amortization</strong> after IO — Low payments maintain healthy DSCR once they kick in.</span></li>
          <li><span>✦</span><span><strong>7-year term</strong> — Exit at Year 5 or hold through Year 7 depending on market timing.</span></li>
        </ul>
      </div>
      <div className="dc">
        <h4>⚠️ Risk Flags</h4>
        <ul>
          <li><span style={{color:"#f59e0b"}}>▲</span><span>Defeasance/Yield Maintenance prepay — exit before maturity carries a premium.</span></li>
          <li><span style={{color:"#f59e0b"}}>▲</span><span>DSCR at 2.92x in Worst Case — limited buffer if occupancy recovery stalls past Y2.</span></li>
          <li><span style={{color:"#ef4444"}}>▲</span><span>45-unit Y1 renovation requires contractor availability. Delay shifts NOI ramp 6–12 months.</span></li>
        </ul>
      </div>
      <div className="dc">
        <h4>📋 Action Items</h4>
        <ul>
          <li><span style={{color:"#059669"}}>→</span><span>Lock Freddie Mac 7-Yr term sheet within 14 days of PSA execution.</span></li>
          <li><span style={{color:"#059669"}}>→</span><span>Commission contractor bids for 45 Y1 units before close.</span></li>
          <li><span style={{color:"#059669"}}>→</span><span>Order Phase I ESA and Property Condition Report concurrently with DD.</span></li>
        </ul>
      </div>
    </div>
  );
}

function buildSysPrompt(model, ms) {
  const c=computeModel(model);
  const conn=MODULES_DEF.filter(m=>ms[m.id]&&ms[m.id]!=="none").map(m=>`${m.label}(${ms[m.id]})`).join(", ")||"none";
  return `You are JEDI — elite real estate financial modeling AI embedded in JEDI RE. You can modify the live deal model.
DEAL: ${model.propertyName} | ${model.meta}
CONNECTED MODULES: ${conn}
MODEL: Purchase ${fmt$(model.acquisition.purchasePrice)} | ${model.acquisition.units} units | Occ ${fmtPct(model.revenue.currentOccupancy)}→${fmtPct(model.revenue.stabilizedOccupancy)} | CapEx $${model.capex.interiorPerUnit.toLocaleString()}/unit | ${model.debt.loans[model.debt.selectedLoan].name} @ ${fmtPct(model.debt.loans[model.debt.selectedLoan].rate)} IO:${model.debt.loans[model.debt.selectedLoan].ioYears}yr | Equity ${fmt$(c.equity)} | NOI ${fmt$(c.stabilizedNOI)} | DSCR ${c.dscr.toFixed(2)}x | Exit ${fmt$(c.exitValue)} @ ${fmtPct(model.exit.exitCapRate)} | IRR Base:${model.scenarios.base.irr}% Best:${model.scenarios.best.irr}% Worst:${model.scenarios.worst.irr}%
To modify: respond with \`\`\`model_update\n{"description":"...","changes":{"acquisition.purchasePrice":56000000},"explanation":"..."}\`\`\`
Speak like a senior institutional analyst — direct, data-driven, precise.`;
}
function applyUpdate(model,changes){let u=JSON.parse(JSON.stringify(model));for(const[p,v]of Object.entries(changes)){const k=p.split(".");let o=u;for(let i=0;i<k.length-1;i++)o=o[k[i]];o[k[k.length-1]]=v;}return u;}
function parseResp(text){const m=text.match(/```model_update\n([\s\S]*?)```/);if(!m)return{text,update:null};try{const u=JSON.parse(m[1]);return{text:text.replace(/```model_update[\s\S]*?```/,"").trim(),update:u};}catch{return{text,update:null};}}

const QP=["Which loan wins?","Stress: 6% exit cap","Break-even occupancy?","Build best case","IRR vs rent growth?","Raise CapEx $7K/unit"];
const TABS=[{k:"comparison",l:"Model Comparison",i:"⊞"},{k:"assumptions",l:"Assumptions",i:"≡"},{k:"debt",l:"Debt Comparison",i:"⊙"},{k:"sensitivity",l:"Sensitivity Analysis",i:"∿"},{k:"decision",l:"Decision Summary",i:"✓"}];

export default function App() {
  const [model,setModel]=useState(INITIAL_MODEL);
  const [ms,setMs]=useState({strategy:"mock",traffic:"none",proforma:"live",debt:"live"});
  const [expanded,setExpanded]=useState(null);
  const [msgs,setMsgs]=useState([{role:"assistant",text:"ShoreView Waterfront loaded — 216 units, Bradenton FL. Pro Forma and Debt modules are live. Strategy Arbitrage is on mock data; Traffic Engine not yet connected.\n\nFreddie Mac 7-Yr is the active structure. Want me to stress-test the exit cap, swap debt, or run a scenario variation?",update:null}]);
  const [inp,setInp]=useState("");
  const [load,setLoad]=useState(false);
  const [tab,setTab]=useState("comparison");
  const [spin,setSpin]=useState(false);
  const endRef=useRef(null);

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,load]);

  const refresh=()=>{setSpin(true);setTimeout(()=>{setMs(p=>({...p,traffic:"mock"}));setSpin(false);},1200);};
  const connCount=Object.values(ms).filter(s=>s!=="none").length;

  const pillCls=id=>{const s=ms[id]||"none";return s==="live"?"live":s==="mock"?"mock":s==="error"?"error":"inactive";};
  const pillSt=id=>{const s=ms[id]||"none";return s==="live"?"live":s==="mock"?"mock data":s==="error"?"error":"no data";};

  const send=useCallback(async(ov)=>{
    const t=(ov||inp).trim();if(!t||load)return;
    setInp("");
    const um={role:"user",text:t};
    setMsgs(p=>[...p,um]);setLoad(true);
    try{
      const hist=[...msgs,um].map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildSysPrompt(model,ms),messages:hist})});
      const d=await r.json();
      const raw=d.content?.map(c=>c.text||"").join("")||"Error.";
      const {text:ct,update}=parseResp(raw);
      setMsgs(p=>[...p,{role:"assistant",text:ct,update}]);
      if(update?.changes)setModel(p=>applyUpdate(p,update.changes));
    }catch{setMsgs(p=>[...p,{role:"assistant",text:"Connection error.",update:null}]);}
    finally{setLoad(false);}
  },[inp,load,msgs,model,ms]);

  return (
    <>
      <style>{CSS}</style>
      <div className="fd">

        {/* CHAT */}
        <div className="fc">
          <div className="fc-top">
            <div className="fc-brand"><div className="fc-mark">J</div><div className="fc-name">JEDI <span>RE</span></div></div>
            <div className="fc-h">AI Financial Analyst</div>
            <div className="fc-s">Ask JEDI to stress test, build variations, or swap assumptions. Changes reflect live in the model.</div>
          </div>
          <div className="fc-ctx">
            <div className="fc-dot"/>
            <div className="fc-ctxt"><b>{model.acquisition.units} units</b> · <b>{fmt$(model.acquisition.purchasePrice)}</b> · <b>{model.debt.loans[model.debt.selectedLoan].name}</b></div>
          </div>
          <div className="fc-msgs">
            {msgs.map((m,i)=>(
              <div key={i} className="fc-msg mi">
                <div className={`fc-av ${m.role==="user"?"u":"a"}`}>{m.role==="user"?"L":"J"}</div>
                <div className="fc-mi">
                  <div className={`fc-mr${m.role==="assistant"?" a":""}`}>{m.role==="user"?"YOU":"JEDI"}</div>
                  <div className="fc-mt">{m.text.split("\n").filter(l=>l.trim()).map((l,j)=><p key={j}>{l}</p>)}</div>
                  {m.update&&<div className="fc-chip">✓ {m.update.description}</div>}
                </div>
              </div>
            ))}
            {load&&<div className="fc-msg mi"><div className="fc-av a">J</div><div className="fc-mi"><div className="fc-mr a">JEDI</div><div className="fc-think"><span/><span/><span/></div></div></div>}
            <div ref={endRef}/>
          </div>
          <div className="fc-qp">{QP.map(p=><button key={p} className="fc-qb" onClick={()=>send(p)}>{p}</button>)}</div>
          <div className="fc-ia">
            <div className="fc-ii">
              <textarea rows={1} value={inp} placeholder="Ask JEDI to model a scenario..." onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}/>
              <button className="fc-sb" disabled={!inp.trim()||load} onClick={()=>send()}>↑</button>
            </div>
          </div>
        </div>

        {/* MODEL PANEL */}
        <div className="fm">
          <div className="fm-tb">
            <div className="fm-tbl">
              <div className="fm-logo">JEDI<span> RE</span></div>
              <div className="fm-sep"/>
              <div className="fm-bc"><span>ShoreView Waterfront</span><span>/</span><strong>Financial Model</strong></div>
            </div>
            <div className="fm-tbr">
              <span className="fm-bdg amb">216 Units · Bradenton FL</span>
              <span className="fm-bdg grn">Q2 2026</span>
              <button className="fm-act">↓ Export</button>
              <button className="fm-act">⊕ Save Variation</button>
            </div>
          </div>

          {/* DARK HERO */}
          <div className="fm-hero">
            <div className="fm-hl">FINANCIAL MODULE DASHBOARD</div>
            <div className="fm-ht">Strategy + Traffic + Pro Forma + Debt → Model Variations</div>
            <div className="fm-hs">Auto-builds Base, Best, Worst, and strategy-specific scenarios from all upstream modules</div>
          </div>

          {/* MODULE STATUS BAR */}
          <div className="fm-mb">
            {MODULES_DEF.map(mod=>(
              <button key={mod.id} className={`fm-pill ${pillCls(mod.id)}`} onClick={()=>setExpanded(p=>p===mod.id?null:mod.id)}>
                <span className="fp-icon">{mod.icon}</span>
                <span className="fp-name">{mod.label}</span>
                <span className="fp-st">{pillSt(mod.id)}</span>
              </button>
            ))}
            <div className="fm-mc">
              <span><b>{connCount}</b>/{MODULES_DEF.length} modules feeding the model</span>
              <button className="fm-rfr" onClick={refresh}>
                <span style={{display:"inline-block",animation:spin?"spin .8s linear infinite":"none"}}>↻</span> Refresh
              </button>
            </div>
          </div>

          {/* MODULE DETAIL DRAWER */}
          <div className={`fm-md${expanded?" open":""}`}>
            {expanded&&(
              <div className="fm-mdi">
                <h4>Module Pipeline Details — Data Sources Feeding This Model</h4>
                <div className="fm-mg">
                  {MODULES_DEF.map(m=>{
                    const st=ms[m.id]||"none";
                    return(
                      <div key={m.id} className="fm-mi">
                        <div className="fm-mil">{m.icon} {m.label}</div>
                        <div className="fm-min">{m.description}</div>
                        <div className="fm-mif">{m.fields.map((f,i)=><span key={i}>{f}{i<m.fields.length-1?" · ":""}</span>)}</div>
                        <div className={`fm-mist ${st==="live"?"live":st==="mock"?"mock":"none"}`}>
                          {st==="live"?"● Live Data":st==="mock"?"◐ Mock Data":"○ Not Connected"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* TABS */}
          <div className="fm-tabs">
            {TABS.map(t=><button key={t.k} className={`fm-tab${tab===t.k?" on":""}`} onClick={()=>setTab(t.k)}><span>{t.i}</span>{t.l}</button>)}
          </div>

          {/* CONTENT */}
          <div className="fm-cnt">
            {tab==="comparison"&&<CompView model={model}/>}
            {tab==="assumptions"&&<AssView model={model}/>}
            {tab==="debt"&&<DebtView model={model} setModel={setModel}/>}
            {tab==="sensitivity"&&<SensView model={model}/>}
            {tab==="decision"&&<DecView model={model}/>}
          </div>
        </div>
      </div>
    </>
  );
}
