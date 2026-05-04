import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════
// F9 · ASSUMPTIONS TAB — PROFORMA CONTROL CENTER
//
// Architecture:  Pro Forma (Y1)  →  ASSUMPTIONS (this tab)  →  Projections
//                                   methods · curves · escalators
//
// Every row mirrors a Y1 baseline from the Pro Forma tab (read-only),
// applies a method (growth/curve/link), and produces Y2..Y5+ values that
// flow into Projections, Returns, Sensitivities, and Sources & Uses.
// ═══════════════════════════════════════════════════════════════════════

const T = {
  bg:{ panel:"#0F1319", panelAlt:"#131821", header:"#1A1F2E", hover:"#1A1F2E", active:"#252D40", input:"#0D1117", row:"#11161F", rowAlt:"#0D1219", section:"#0C1017", banner:"#091018" },
  text:{ primary:"#E8ECF1", secondary:"#8B95A5", muted:"#4A5568", amber:"#F5A623", amberBright:"#FFD166", green:"#00D26A", red:"#FF4757", cyan:"#00BCD4", orange:"#FF8C42", purple:"#A78BFA", white:"#FFFFFF" },
  border:{ subtle:"#1E2538", medium:"#2A3348", bright:"#3B4A6B", focus:"#F5A623" },
  font:{ mono:"'JetBrains Mono','Fira Code','SF Mono',monospace", display:"'IBM Plex Mono',monospace", label:"'IBM Plex Sans',sans-serif" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17}
*::-webkit-scrollbar{width:6px;height:6px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348}
@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.45}}
.row:hover{background:#1A1F2E !important}
.cell-edit:hover{background:#252D40 !important;border-color:#3B4A6B !important;cursor:pointer}
.tab-jump:hover{color:#FFD166 !important;cursor:pointer}
.scn:hover{background:#252D40 !important;cursor:pointer}
.method-pill:hover{background:#252D40 !important;border-color:#3B4A6B !important;cursor:pointer}
.mode-pill:hover{background:#252D40 !important;cursor:pointer}
.action-btn:hover{background:#252D40 !important;color:#FFD166 !important;cursor:pointer}
.section-toggle:hover{color:#FFD166 !important;cursor:pointer}
input.f9-inp:focus{outline:none;border-color:#F5A623 !important}
`;

// ─── PROVENANCE PILLS (LayeredValue<T>) ────────────────────────────────
const SRC = {
  PF:  { lbl:"PF",  c:T.text.cyan,    name:"Pro Forma · Y1" },
  B:   { lbl:"B",   c:T.text.amber,   name:"Broker OM" },
  P:   { lbl:"P",   c:T.text.cyan,    name:"Platform" },
  U:   { lbl:"U",   c:T.text.green,   name:"User Override" },
  T12: { lbl:"T12", c:T.text.purple,  name:"T12 Operating" },
  RR:  { lbl:"RR",  c:T.text.purple,  name:"Rent Roll" },
  M07: { lbl:"M07", c:T.text.orange,  name:"M07 Traffic" },
  M05: { lbl:"M05", c:T.text.orange,  name:"M05 Market" },
  PT:  { lbl:"PT",  c:"#7BCFF5",      name:"Portfolio" },
  CALC:{ lbl:"=",   c:T.text.muted,   name:"Computed" },
};
const CONF = {
  H:{ d:"●●●", c:T.text.green, name:"High"   },
  M:{ d:"●●○", c:T.text.amber, name:"Medium" },
  L:{ d:"●○○", c:T.text.red,   name:"Low"    },
};

// Method types — how Y1 becomes Y2-Y5+
const METHOD = {
  FLAT:    { lbl:"Flat %",        c:T.text.cyan,    desc:"Constant % growth applied each year" },
  STEP:    { lbl:"Stepped",       c:T.text.cyan,    desc:"Year-by-year custom % schedule" },
  CPI:     { lbl:"CPI-Linked",    c:T.text.purple,  desc:"Indexed to projected CPI curve" },
  CURVE:   { lbl:"Curve",         c:T.text.amber,   desc:"Custom curve · monthly granularity" },
  LINK:    { lbl:"Linked",        c:T.text.purple,  desc:"Computed from another assumption" },
  M07:     { lbl:"M07 Absorption",c:T.text.orange,  desc:"Pulled from M07 Traffic Engine" },
  MANUAL:  { lbl:"Manual",        c:T.text.green,   desc:"User specifies each year directly" },
  PASS:    { lbl:"Passthrough",   c:T.text.muted,   desc:"Calculated on dedicated tab · displayed here" },
};

// ─── DEAL CONTEXT ──────────────────────────────────────────────────────
const DEAL = {
  name:"Westshore Commons", ticker:"WSC-248", units:248,
  type:"RENTAL · Value-Add", market:"Tampa, FL · Westshore",
  vintage:1986, hold:5, scenario:"Base",
  scenarios:["Base","Upside","Downside","Stress","Lender View"],
  occMode:"STABILIZED",  // STABILIZED | LEASE-UP | REDEVELOPMENT
  totalAssumptions:42, overridden:7, collisions:2, locked:3,
  lastEdit:{ field:"rent_growth · Y1", from:"3.1%", to:"3.4%", who:"Leon", at:"14:23" },
};

const YEARS = ["Y1","Y2","Y3","Y4","Y5"];

// ─── REVENUE DRIVERS ───────────────────────────────────────────────────
// Y1 mirrors from Pro Forma; method drives Y2-Y5
const REV_ROWS = [
  {
    id:"rent_growth", lbl:"Market Rent Growth",
    y1:{ val:"$1,948", note:"avg eff rent / unit / mo · from PF" },
    method:"STEP",
    yrs:[
      { val:"3.4%", src:"U", conf:"H", prev:{val:"3.1%",src:"P"} },
      { val:"3.2%", src:"P", conf:"H" },
      { val:"3.1%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"L" },
    ],
    basis:"M05 Westshore submarket · 5yr curve · band 2.8-3.6%",
    coll:{ broker:"4.5%", note:"Broker Y1 130bps above platform · ~$42K NOI overstatement" },
    flowsTo:["Projections · GPR","Returns","Sensitivities"],
  },
  {
    id:"oth_inc_growth", lbl:"Other Income Growth",
    y1:{ val:"$80", note:"/ unit / mo · parking + RUBS + fees · from PF" },
    method:"FLAT",
    yrs:[
      { val:"3.0%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"M" },
      { val:"3.0%", src:"P", conf:"M" },
    ],
    basis:"Default fee inflation · CPI-linked · trimmed",
    flowsTo:["Projections · OI"],
  },
  {
    id:"reno_premium", lbl:"Renovation Rent Premium",
    y1:{ val:"$0", note:"pre-renovation baseline" },
    method:"CURVE",
    yrs:[
      { val:"+$45", src:"U", conf:"M" },
      { val:"+$95", src:"U", conf:"M" },
      { val:"+$135", src:"U", conf:"M" },
      { val:"+$140", src:"P", conf:"L" },
      { val:"+$140", src:"P", conf:"L" },
    ],
    basis:"User: $150 stabilized premium · 60-unit/yr pace · weighted avg per door",
    flowsTo:["Projections · GPR uplift","Capital Plan"],
  },
];

// ─── OCCUPANCY & CONCESSIONS · MODE-AWARE ──────────────────────────────
// In STABILIZED mode (Westshore example), uses curve methods.
// LEASE-UP mode would replace phys_occ row with M07 absorption pull.
// REDEV mode adds down-unit schedule row.
const OCC_ROWS = [
  {
    id:"phys_occ", lbl:"Physical Occupancy",
    y1:{ val:"92.0%", note:"current · from RR snapshot · PF baseline" },
    method:"CURVE",
    yrs:[
      { val:"92.0%", src:"U", conf:"H", prev:{val:"93.0%",src:"P"} },
      { val:"93.5%", src:"P", conf:"H" },
      { val:"94.0%", src:"P", conf:"H" },
      { val:"94.0%", src:"P", conf:"M" },
      { val:"94.0%", src:"P", conf:"M" },
    ],
    basis:"Y1 user override · reno disruption drag; Y2-5 platform stabilized target",
    coll:{ broker:"95.0%", note:"Broker assumes flat 95% from Y1 · ignores reno disruption" },
    flowsTo:["Projections · Vacancy Loss","Returns"],
  },
  {
    id:"struct_floor", lbl:"Structural Vacancy Floor",
    y1:{ val:"8.5%", note:"Westshore submarket · M05" },
    method:"FLAT",
    yrs:[
      { val:"8.5%", src:"M05", conf:"H" },
      { val:"8.5%", src:"M05", conf:"H" },
      { val:"8.5%", src:"M05", conf:"M" },
      { val:"8.5%", src:"M05", conf:"M" },
      { val:"8.5%", src:"M05", conf:"L" },
    ],
    basis:"M05 submarket · structural floor · physical occ cannot exceed (1 − floor) without flag",
    flowsTo:["Validation guard"],
  },
  {
    id:"concess_new", lbl:"Concessions · New Leases",
    y1:{ val:"1.5 mo", note:"market avg · new lease · from PF" },
    method:"CURVE",
    yrs:[
      { val:"1.5 mo", src:"M05", conf:"H" },
      { val:"1.0 mo", src:"U", conf:"M", prev:{val:"1.2 mo",src:"P"} },
      { val:"0.5 mo", src:"U", conf:"M" },
      { val:"0.5 mo", src:"P", conf:"L" },
      { val:"0.5 mo", src:"P", conf:"L" },
    ],
    basis:"User burn-off curve · post-reno comp set drops to 0.5mo by Y3",
    coll:{ broker:"0 mo", note:"Broker OM models zero concessions · ~3.1% rent overstatement Y1" },
    flowsTo:["Projections · Concession Loss","Economic Occ"],
  },
  {
    id:"concess_ren", lbl:"Concessions · Renewals",
    y1:{ val:"0.5 mo", note:"renewal incentive · from PF" },
    method:"FLAT",
    yrs:[
      { val:"0.5 mo", src:"P", conf:"M" },
      { val:"0.5 mo", src:"P", conf:"M" },
      { val:"0.25 mo",src:"P", conf:"L" },
      { val:"0.25 mo",src:"P", conf:"L" },
      { val:"0.25 mo",src:"P", conf:"L" },
    ],
    basis:"Platform default · half of new-lease concession · tapers post-stabilization",
    flowsTo:["Projections · Concession Loss"],
  },
  {
    id:"concess_pct", lbl:"% New Leases w/ Concession",
    y1:{ val:"65%", note:"share of new leases receiving concession" },
    method:"STEP",
    yrs:[
      { val:"65%", src:"M07", conf:"H" },
      { val:"45%", src:"P",   conf:"M" },
      { val:"25%", src:"P",   conf:"M" },
      { val:"20%", src:"P",   conf:"L" },
      { val:"20%", src:"P",   conf:"L" },
    ],
    basis:"M07 traffic · share of signed leases w/ concession · 90d trailing",
    flowsTo:["Concession aggregate"],
  },
  {
    id:"loss_to_lease", lbl:"Loss to Lease",
    y1:{ val:"4.2%", note:"in-place vs market · from RR" },
    method:"STEP",
    yrs:[
      { val:"4.2%", src:"RR", conf:"H" },
      { val:"2.5%", src:"P",  conf:"M" },
      { val:"1.5%", src:"P",  conf:"M" },
      { val:"1.0%", src:"P",  conf:"L" },
      { val:"1.0%", src:"P",  conf:"L" },
    ],
    basis:"Closure curve · 55% Y1, 85% Y2, ~100% Y3 · M05 submarket renewal cadence",
    flowsTo:["Projections · LtL Loss"],
  },
  {
    id:"bad_debt", lbl:"Bad Debt",
    y1:{ val:"1.8%", note:"% of GPR · from T12" },
    method:"STEP",
    yrs:[
      { val:"1.8%", src:"T12", conf:"H" },
      { val:"1.5%", src:"P",   conf:"M" },
      { val:"1.2%", src:"P",   conf:"M" },
      { val:"1.0%", src:"P",   conf:"L" },
      { val:"1.0%", src:"P",   conf:"L" },
    ],
    basis:"T12 actual · improvement curve toward portfolio avg 1.0% post-stabilization",
    flowsTo:["Projections · Bad Debt"],
  },
  {
    id:"non_rev", lbl:"Non-Revenue Units",
    y1:{ val:"3 units", note:"model + employee + down · from RR" },
    method:"MANUAL",
    yrs:[
      { val:"3", src:"RR", conf:"H" },
      { val:"3", src:"U",  conf:"H" },
      { val:"2", src:"U",  conf:"M" },
      { val:"2", src:"U",  conf:"M" },
      { val:"2", src:"U",  conf:"M" },
    ],
    basis:"1 model + 1 employee + down units (drops to 0 post-reno completion)",
    flowsTo:["Projections · GPR adj"],
  },
  {
    id:"econ_occ", lbl:"Economic Occupancy",
    y1:{ val:"86.4%", note:"computed · from PF" },
    method:"LINK",
    yrs:[
      { val:"86.4%", src:"CALC", conf:"H" },
      { val:"89.7%", src:"CALC", conf:"H" },
      { val:"92.1%", src:"CALC", conf:"H" },
      { val:"92.6%", src:"CALC", conf:"M" },
      { val:"92.6%", src:"CALC", conf:"M" },
    ],
    basis:"= Phys Occ × (1 − concession − bad debt − LtL) · auto-derived · cannot override directly",
    flowsTo:["Projections · EGI base"],
  },
];

// ─── OPERATING EXPENSE DRIVERS ─────────────────────────────────────────
const OPEX_ROWS = [
  {
    id:"payroll", lbl:"Payroll & Benefits",
    y1:{ val:"$1,180 / unit", note:"from T12" },
    method:"FLAT",
    yrs:[ {val:"3.5%",src:"P",conf:"M"}, {val:"3.5%",src:"P",conf:"M"}, {val:"3.5%",src:"P",conf:"M"}, {val:"3.5%",src:"P",conf:"L"}, {val:"3.5%",src:"P",conf:"L"} ],
    basis:"Tampa BLS wage growth · 5yr trailing avg",
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"rm", lbl:"Repairs & Maintenance",
    y1:{ val:"$680 / unit", note:"from T12" },
    method:"FLAT",
    yrs:[ {val:"3.0%",src:"P",conf:"H"}, {val:"3.0%",src:"P",conf:"H"}, {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"L"} ],
    basis:"Portfolio actual + CPI · 1986-vintage adjusted",
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"util", lbl:"Utilities (Net of RUBS)",
    y1:{ val:"$420 / unit", note:"from T12" },
    method:"STEP",
    yrs:[ {val:"4.5%",src:"P",conf:"M"}, {val:"4.0%",src:"P",conf:"M"}, {val:"3.5%",src:"P",conf:"L"}, {val:"3.5%",src:"P",conf:"L"}, {val:"3.5%",src:"P",conf:"L"} ],
    basis:"FL utility rate filings · front-loaded",
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"ins", lbl:"Insurance",
    y1:{ val:"$890 / unit", note:"from T12 · FL wind exposure" },
    method:"STEP",
    yrs:[ {val:"6.0%",src:"U",conf:"M",prev:{val:"5.0%",src:"P"}}, {val:"5.0%",src:"U",conf:"M"}, {val:"4.0%",src:"P",conf:"L"}, {val:"3.5%",src:"P",conf:"L"}, {val:"3.5%",src:"P",conf:"L"} ],
    basis:"FL wind premium curve · user front-loaded post-reform tail",
    coll:{ broker:"3.0%", note:"Broker uses pre-reform avg · understates ~$15K/yr Y1-2" },
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"mgmt", lbl:"Management Fee",
    y1:{ val:"3.0% of EGI", note:"contracted rate" },
    method:"LINK",
    yrs:[ {val:"3.0%",src:"CALC",conf:"H"}, {val:"3.0%",src:"CALC",conf:"H"}, {val:"3.0%",src:"CALC",conf:"H"}, {val:"3.0%",src:"CALC",conf:"H"}, {val:"3.0%",src:"CALC",conf:"H"} ],
    basis:"Linked to EGI · auto-scales with revenue",
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"ga", lbl:"General & Administrative",
    y1:{ val:"$185 / unit", note:"from T12" },
    method:"FLAT",
    yrs:[ {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"L"}, {val:"3.0%",src:"P",conf:"L"}, {val:"3.0%",src:"P",conf:"L"} ],
    basis:"CPI-linked",
    flowsTo:["Projections · OpEx"],
  },
  {
    id:"capex_res", lbl:"CapEx Reserve",
    y1:{ val:"$300 / unit", note:"replacement reserve" },
    method:"FLAT",
    yrs:[ {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"M"}, {val:"3.0%",src:"P",conf:"L"}, {val:"3.0%",src:"P",conf:"L"} ],
    basis:"Per-unit reserve · escalates w/ inflation",
    flowsTo:["Projections · Below NOI","Returns"],
  },
];

// ─── PASSTHROUGH ROWS (calculated on dedicated tabs · shown here for visibility)
const PASS_ROWS = [
  {
    id:"prop_tax", lbl:"Property Taxes (FL)",
    y1:{ val:"$2,140 / unit", note:"reassessed at sale · F9 Taxes tab" },
    method:"PASS",
    yrs:[ {val:"reassess",src:"P",conf:"H"}, {val:"+10%cap",src:"P",conf:"H"}, {val:"+10%cap",src:"P",conf:"H"}, {val:"+10%cap",src:"P",conf:"M"}, {val:"+10%cap",src:"P",conf:"M"} ],
    basis:"FL non-homestead · just value reassessed at close · 10%/yr cap thereafter · doc stamps + intangible at acq",
    jumpTab:"F9 Taxes",
    flowsTo:["Projections · Property Tax"],
  },
  {
    id:"debt_svc", lbl:"Debt Service",
    y1:{ val:"$1,640 / unit", note:"calculated · F9 Debt tab" },
    method:"PASS",
    yrs:[ {val:"IO",src:"P",conf:"H"}, {val:"IO",src:"P",conf:"H"}, {val:"amort",src:"P",conf:"H"}, {val:"amort",src:"P",conf:"M"}, {val:"amort",src:"P",conf:"M"} ],
    basis:"$26.95M loan · 65% LTV · SOFR+225 · 2yr IO · 30yr amort · F9 Debt tab",
    jumpTab:"F9 Debt",
    flowsTo:["Projections · Below NOI","Returns · Levered"],
  },
];

// ─── EXIT ASSUMPTIONS ──────────────────────────────────────────────────
const EXIT_ROWS = [
  {
    id:"exit_cap", lbl:"Exit Cap Rate",
    y1:{ val:"5.20%", note:"going-in · from PF" },
    method:"STEP",
    yrs:[
      { val:"—",     src:"CALC", conf:"H" },
      { val:"—",     src:"CALC", conf:"H" },
      { val:"—",     src:"CALC", conf:"H" },
      { val:"—",     src:"CALC", conf:"M" },
      { val:"5.50%", src:"U",    conf:"M", prev:{val:"5.45%",src:"P"} },
    ],
    basis:"Going-in + 30bps spread · user override slightly above platform default",
    coll:{ broker:"5.00%", note:"Broker uses 5.00% exit · 50bps below user · ~$3.8M valuation overstatement" },
    flowsTo:["Returns · Reversion","Sensitivities"],
  },
  {
    id:"sell_cost", lbl:"Selling Costs",
    y1:{ val:"—", note:"applied at exit only" },
    method:"FLAT",
    yrs:[
      { val:"—", src:"CALC", conf:"H" },
      { val:"—", src:"CALC", conf:"H" },
      { val:"—", src:"CALC", conf:"H" },
      { val:"—", src:"CALC", conf:"M" },
      { val:"2.0%",src:"P",  conf:"H" },
    ],
    basis:"Brokerage + closing · standard institutional sale",
    flowsTo:["Returns · Net Reversion"],
  },
];

// Mode toggle for Occupancy section
const OCC_MODES = [
  { id:"STABILIZED",     lbl:"STABILIZED",      desc:"Curve-based · current asset" },
  { id:"LEASE-UP",       lbl:"LEASE-UP",        desc:"M07 absorption pull · pre-leased + ramp" },
  { id:"REDEVELOPMENT",  lbl:"REDEVELOPMENT",   desc:"Hybrid · down-unit schedule + re-lease" },
];

// ═══ ATOMS ═════════════════════════════════════════════════════════════

function SourcePill({ k }) {
  const s = SRC[k] || SRC.P;
  return (
    <span style={{ display:"inline-block", padding:"1px 4px", border:`1px solid ${s.c}55`, color:s.c, fontFamily:T.font.mono, fontSize:9, fontWeight:600, letterSpacing:0.4, background:`${s.c}11`, borderRadius:1, lineHeight:1.4 }} title={s.name}>{s.lbl}</span>
  );
}

function ConfDots({ k }) {
  const c = CONF[k] || CONF.M;
  return <span style={{ color:c.c, fontSize:8, fontFamily:T.font.mono, letterSpacing:0.5 }} title={`Confidence: ${c.name}`}>{c.d}</span>;
}

function MethodPill({ k }) {
  const m = METHOD[k] || METHOD.FLAT;
  return (
    <button className="method-pill" style={{ background:T.bg.input, border:`1px solid ${m.c}44`, color:m.c, fontFamily:T.font.mono, fontSize:10, fontWeight:600, padding:"3px 7px", letterSpacing:0.3, borderRadius:1 }} title={m.desc}>
      {m.lbl} <span style={{ color:T.text.muted, marginLeft:3 }}>▾</span>
    </button>
  );
}

function YearCell({ y }) {
  if (!y) return <td style={{ padding:"6px 8px", borderBottom:`1px solid ${T.border.subtle}` }} />;
  const overridden = y.src === "U";
  return (
    <td className="cell-edit" style={{ padding:"6px 8px", borderBottom:`1px solid ${T.border.subtle}`, borderLeft:`1px solid ${T.border.subtle}`, background:overridden ? `${T.text.green}08` : "transparent", textAlign:"right", verticalAlign:"middle" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6 }}>
        <span style={{ color:T.text.primary, fontFamily:T.font.mono, fontSize:11, fontWeight:overridden ? 600 : 500 }}>{y.val}</span>
        <SourcePill k={y.src} />
        <ConfDots k={y.conf} />
      </div>
      {y.prev ? <div style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:8.5, textAlign:"right", marginTop:2, textDecoration:"line-through" }}>was {y.prev.val} ({y.prev.src})</div> : null}
    </td>
  );
}

function FlowsToTrail({ to }) {
  if (!to || to.length === 0) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontFamily:T.font.mono, fontSize:9, color:T.text.muted }}>
      <span style={{ color:T.text.cyan }}>→</span>
      {to.map((dest, i) => (
        <span key={i} className="tab-jump" style={{ color:T.text.secondary, padding:"1px 5px", border:`1px solid ${T.border.subtle}`, borderRadius:1 }}>{dest}</span>
      ))}
    </div>
  );
}

function CollisionTag({ coll }) {
  if (!coll) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 6px", background:`${T.text.amber}11`, border:`1px solid ${T.text.amber}44`, borderRadius:1, marginTop:4 }}>
      <span style={{ color:T.text.amber, fontFamily:T.font.mono, fontSize:9, fontWeight:700 }}>⚠ COLLISION</span>
      <span style={{ color:T.text.amberBright, fontFamily:T.font.mono, fontSize:9.5 }}>Broker: {coll.broker}</span>
      <span style={{ color:T.text.secondary, fontFamily:T.font.label, fontSize:10 }}>· {coll.note}</span>
    </div>
  );
}

// ═══ ROW · STANDARD (with Y1 mirror, method, Y2-Y5) ═══════════════════
function AssumptionRow({ row, dim }) {
  const yrCells = [];
  for (let i = 0; i < 5; i++) yrCells.push(<YearCell key={i} y={row.yrs[i]} />);

  return (
    <>
      <tr className="row" style={{ background:dim ? T.bg.rowAlt : T.bg.row }}>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:240 }}>
          <div style={{ color:T.text.primary, fontFamily:T.font.label, fontSize:11.5, fontWeight:600 }}>{row.lbl}</div>
          <div style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9, marginTop:2, letterSpacing:0.3 }}>{row.id}</div>
        </td>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, borderLeft:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:160, background:`${T.text.cyan}06` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <SourcePill k="PF" />
            <span style={{ color:T.text.primary, fontFamily:T.font.mono, fontSize:11, fontWeight:600 }}>{row.y1.val}</span>
          </div>
          <div style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9, marginTop:3 }}>{row.y1.note}</div>
        </td>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, borderLeft:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:130 }}>
          <MethodPill k={row.method} />
        </td>
        {yrCells}
      </tr>
      <tr style={{ background:dim ? T.bg.rowAlt : T.bg.row }}>
        <td colSpan={8} style={{ padding:"4px 10px 10px 10px", borderBottom:`1px solid ${T.border.medium}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
            <div style={{ flex:1 }}>
              <div style={{ color:T.text.secondary, fontFamily:T.font.label, fontSize:10.5, lineHeight:1.5 }}>
                <span style={{ color:T.text.muted, marginRight:6, fontFamily:T.font.mono, fontSize:9, letterSpacing:0.5 }}>BASIS</span>
                {row.basis}
              </div>
              <CollisionTag coll={row.coll} />
            </div>
            <FlowsToTrail to={row.flowsTo} />
          </div>
        </td>
      </tr>
    </>
  );
}

// ═══ ROW · PASSTHROUGH (links to dedicated tab) ═══════════════════════
function PassRow({ row, dim }) {
  const yrCells = [];
  for (let i = 0; i < 5; i++) yrCells.push(<YearCell key={i} y={row.yrs[i]} />);
  return (
    <>
      <tr className="row" style={{ background:dim ? T.bg.rowAlt : T.bg.row, opacity:0.92 }}>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:240 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ color:T.text.primary, fontFamily:T.font.label, fontSize:11.5, fontWeight:600 }}>{row.lbl}</div>
            <span style={{ padding:"1px 5px", background:`${T.text.muted}22`, color:T.text.secondary, fontFamily:T.font.mono, fontSize:8.5, fontWeight:700, letterSpacing:0.4, borderRadius:1 }}>READ-ONLY</span>
          </div>
          <div style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9, marginTop:2, letterSpacing:0.3 }}>{row.id}</div>
        </td>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, borderLeft:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:160, background:`${T.text.cyan}06` }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <SourcePill k="PF" />
            <span style={{ color:T.text.primary, fontFamily:T.font.mono, fontSize:11, fontWeight:600 }}>{row.y1.val}</span>
          </div>
          <div style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9, marginTop:3 }}>{row.y1.note}</div>
        </td>
        <td style={{ padding:"8px 10px", borderBottom:`1px solid ${T.border.subtle}`, borderLeft:`1px solid ${T.border.subtle}`, verticalAlign:"top", width:130 }}>
          <button className="tab-jump" style={{ background:"transparent", border:`1px solid ${T.text.muted}66`, color:T.text.secondary, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, padding:"3px 7px", letterSpacing:0.4, borderRadius:1 }}>
            → {row.jumpTab}
          </button>
        </td>
        {yrCells}
      </tr>
      <tr style={{ background:dim ? T.bg.rowAlt : T.bg.row }}>
        <td colSpan={8} style={{ padding:"4px 10px 10px 10px", borderBottom:`1px solid ${T.border.medium}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
            <div style={{ color:T.text.secondary, fontFamily:T.font.label, fontSize:10.5, lineHeight:1.5, flex:1 }}>
              <span style={{ color:T.text.muted, marginRight:6, fontFamily:T.font.mono, fontSize:9, letterSpacing:0.5 }}>BASIS</span>
              {row.basis}
            </div>
            <FlowsToTrail to={row.flowsTo} />
          </div>
        </td>
      </tr>
    </>
  );
}

// ═══ SECTION HEADER ═══════════════════════════════════════════════════
function SectionHeader({ id, idx, title, count, ovr, coll, expanded, onToggle, extra }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:T.bg.section, borderTop:`1px solid ${T.border.medium}`, borderBottom:`1px solid ${T.border.subtle}` }}>
      <div className="section-toggle" onClick={onToggle} style={{ display:"flex", alignItems:"center", gap:10, color:T.text.amberBright, fontFamily:T.font.mono, fontSize:11, fontWeight:700, letterSpacing:0.6 }}>
        <span style={{ color:T.text.muted, width:14 }}>{expanded ? "▾" : "▸"}</span>
        <span style={{ color:T.text.muted }}>{idx}</span>
        <span>{title}</span>
        <span style={{ color:T.text.secondary, fontWeight:500, fontSize:10 }}>· {count} assumptions</span>
        {ovr > 0 ? <span style={{ color:T.text.green, fontWeight:600, fontSize:10 }}>· {ovr} overridden</span> : null}
        {coll > 0 ? <span style={{ color:T.text.amber, fontWeight:600, fontSize:10 }}>· {coll} collision{coll>1?"s":""}</span> : null}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {extra}
      </div>
    </div>
  );
}

// ═══ TABLE COLUMN HEADER ══════════════════════════════════════════════
function TableHead() {
  return (
    <thead>
      <tr style={{ background:T.bg.header }}>
        <th style={{ padding:"7px 10px", textAlign:"left", color:T.text.secondary, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, letterSpacing:0.6, borderBottom:`1px solid ${T.border.medium}`, width:240 }}>ASSUMPTION</th>
        <th style={{ padding:"7px 10px", textAlign:"left", color:T.text.cyan, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, letterSpacing:0.6, borderBottom:`1px solid ${T.border.medium}`, borderLeft:`1px solid ${T.border.subtle}`, width:160, background:`${T.text.cyan}08` }}>← Y1 · FROM PRO FORMA</th>
        <th style={{ padding:"7px 10px", textAlign:"left", color:T.text.secondary, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, letterSpacing:0.6, borderBottom:`1px solid ${T.border.medium}`, borderLeft:`1px solid ${T.border.subtle}`, width:130 }}>METHOD</th>
        {YEARS.slice(1).map(y => (
          <th key={y} style={{ padding:"7px 10px", textAlign:"right", color:T.text.secondary, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, letterSpacing:0.6, borderBottom:`1px solid ${T.border.medium}`, borderLeft:`1px solid ${T.border.subtle}` }}>{y}</th>
        ))}
        <th style={{ padding:"7px 10px", textAlign:"right", color:T.text.cyan, fontFamily:T.font.mono, fontSize:9.5, fontWeight:600, letterSpacing:0.6, borderBottom:`1px solid ${T.border.medium}`, borderLeft:`1px solid ${T.border.subtle}` }}>{YEARS[0]} →</th>
      </tr>
    </thead>
  );
}
// Note: header shows Y1 as the destination column on the right (Y1 mirror lives in dedicated col); Y2..Y5 are the projected years. Table body fills 5 yr cells in order.

// ═══ MAIN COMPONENT ═══════════════════════════════════════════════════
export default function F9AssumptionsTab() {
  const [scenario, setScenario] = useState("Base");
  const [occMode, setOccMode]   = useState(DEAL.occMode);
  const [search, setSearch]     = useState("");
  const [showOvrOnly, setShowOvrOnly] = useState(false);

  const [openSections, setOpenSections] = useState({ rev:true, occ:true, opex:true, pass:true, exit:true });
  const toggle = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  // Pre-compute filtered row sets (no IIFE in JSX)
  const filt = (rows) => rows.filter(r => {
    if (showOvrOnly && !r.yrs.some(y => y && y.src === "U")) return false;
    if (search.trim().length === 0) return true;
    const q = search.toLowerCase();
    return r.lbl.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
  });

  const revRows  = filt(REV_ROWS);
  const occRows  = filt(OCC_ROWS);
  const opexRows = filt(OPEX_ROWS);
  const passRows = filt(PASS_ROWS);
  const exitRows = filt(EXIT_ROWS);

  // Build section row arrays once (avoid inline maps with keyed fragments inside grids)
  const buildRows = (rows, isPass) => rows.map((r, i) => isPass
    ? <PassRow key={r.id} row={r} dim={i % 2 === 1} />
    : <AssumptionRow key={r.id} row={r} dim={i % 2 === 1} />
  );

  const revTbody  = buildRows(revRows,  false);
  const occTbody  = buildRows(occRows,  false);
  const opexTbody = buildRows(opexRows, false);
  const passTbody = buildRows(passRows, true);
  const exitTbody = buildRows(exitRows, false);

  return (
    <div style={{ background:"#0A0E17", color:T.text.primary, fontFamily:T.font.label, minHeight:"100vh", paddingBottom:60 }}>
      <style>{CSS}</style>

      {/* ─── DATA-FLOW BANNER ─────────────────────────────────────── */}
      <div style={{ background:T.bg.banner, borderBottom:`1px solid ${T.border.medium}`, padding:"10px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, fontFamily:T.font.mono, fontSize:11 }}>
          <button className="tab-jump" style={{ background:"transparent", border:`1px solid ${T.text.cyan}55`, color:T.text.cyan, padding:"5px 12px", fontFamily:T.font.mono, fontSize:10.5, fontWeight:600, letterSpacing:0.5, borderRadius:1 }}>
            ← F9 · PRO FORMA · Y1 SOURCE
          </button>
          <span style={{ color:T.text.muted, fontSize:14 }}>━━▶</span>
          <div style={{ background:`${T.text.amber}15`, border:`1px solid ${T.text.amber}`, color:T.text.amberBright, padding:"5px 14px", fontFamily:T.font.mono, fontSize:10.5, fontWeight:700, letterSpacing:0.6, borderRadius:1 }}>
            ASSUMPTIONS · CONTROL CENTER
          </div>
          <span style={{ color:T.text.muted, fontSize:14 }}>━━▶</span>
          <button className="tab-jump" style={{ background:"transparent", border:`1px solid ${T.text.cyan}55`, color:T.text.cyan, padding:"5px 12px", fontFamily:T.font.mono, fontSize:10.5, fontWeight:600, letterSpacing:0.5, borderRadius:1 }}>F9 · PROJECTIONS</button>
          <button className="tab-jump" style={{ background:"transparent", border:`1px solid ${T.text.cyan}55`, color:T.text.cyan, padding:"5px 12px", fontFamily:T.font.mono, fontSize:10.5, fontWeight:600, letterSpacing:0.5, borderRadius:1 }}>F9 · RETURNS</button>
          <button className="tab-jump" style={{ background:"transparent", border:`1px solid ${T.text.cyan}55`, color:T.text.cyan, padding:"5px 12px", fontFamily:T.font.mono, fontSize:10.5, fontWeight:600, letterSpacing:0.5, borderRadius:1 }}>F9 · SENSITIVITIES →</button>

          <div style={{ flex:1 }} />
          <div style={{ color:T.text.secondary, fontSize:10 }}>
            <span style={{ color:T.text.muted }}>DEAL · </span>
            <span style={{ color:T.text.amberBright, fontWeight:600 }}>{DEAL.ticker}</span>
            <span style={{ color:T.text.muted }}> · {DEAL.units}u · {DEAL.market}</span>
          </div>
        </div>
      </div>

      {/* ─── CONTROL BAR ──────────────────────────────────────────── */}
      <div style={{ background:T.bg.panel, borderBottom:`1px solid ${T.border.medium}`, padding:"10px 16px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
        {/* Scenario switcher */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:0.5 }}>SCENARIO</span>
          {DEAL.scenarios.map(s => {
            const active = s === scenario;
            return (
              <button key={s} className="scn" onClick={() => setScenario(s)}
                style={{ background:active ? T.bg.active : T.bg.input, border:`1px solid ${active ? T.text.amber : T.border.medium}`, color:active ? T.text.amberBright : T.text.secondary, fontFamily:T.font.mono, fontSize:10, fontWeight:active ? 700 : 500, padding:"4px 10px", letterSpacing:0.4, borderRadius:1 }}>
                {s}
              </button>
            );
          })}
          <button className="action-btn" style={{ background:"transparent", border:`1px dashed ${T.border.medium}`, color:T.text.muted, fontFamily:T.font.mono, fontSize:10, padding:"4px 8px", borderRadius:1 }}>+ NEW</button>
        </div>

        <div style={{ width:1, height:18, background:T.border.medium }} />

        {/* Counters */}
        <div style={{ display:"flex", alignItems:"center", gap:14, fontFamily:T.font.mono, fontSize:10 }}>
          <span><span style={{ color:T.text.muted }}>TOTAL </span><span style={{ color:T.text.primary, fontWeight:700 }}>{DEAL.totalAssumptions}</span></span>
          <span><span style={{ color:T.text.muted }}>OVERRIDDEN </span><span style={{ color:T.text.green, fontWeight:700 }}>{DEAL.overridden}</span></span>
          <span><span style={{ color:T.text.muted }}>COLLISIONS </span><span style={{ color:T.text.amber, fontWeight:700 }}>{DEAL.collisions}</span></span>
          <span><span style={{ color:T.text.muted }}>LOCKED </span><span style={{ color:T.text.secondary, fontWeight:700 }}>{DEAL.locked}</span></span>
        </div>

        <div style={{ width:1, height:18, background:T.border.medium }} />

        {/* Search */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flex:1, minWidth:240 }}>
          <span style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9.5 }}>⌕</span>
          <input className="f9-inp" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search assumptions · id · label"
            style={{ flex:1, background:T.bg.input, border:`1px solid ${T.border.subtle}`, color:T.text.primary, fontFamily:T.font.mono, fontSize:10.5, padding:"5px 9px", letterSpacing:0.3, borderRadius:1 }} />
        </div>

        {/* Toggle */}
        <label style={{ display:"flex", alignItems:"center", gap:6, fontFamily:T.font.mono, fontSize:10, color:T.text.secondary, cursor:"pointer" }}>
          <input type="checkbox" checked={showOvrOnly} onChange={(e) => setShowOvrOnly(e.target.checked)} style={{ accentColor:T.text.green }} />
          OVERRIDES ONLY
        </label>

        <button className="action-btn" style={{ background:"transparent", border:`1px solid ${T.text.red}55`, color:T.text.red, fontFamily:T.font.mono, fontSize:10, fontWeight:600, padding:"5px 10px", letterSpacing:0.4, borderRadius:1 }}>RESET ALL OVERRIDES</button>
        <button className="action-btn" style={{ background:T.text.amber, border:`1px solid ${T.text.amber}`, color:"#0A0E17", fontFamily:T.font.mono, fontSize:10, fontWeight:700, padding:"5px 12px", letterSpacing:0.6, borderRadius:1 }}>PUSH → PROJECTIONS</button>
      </div>

      {/* ─── LEGEND ────────────────────────────────────────────────── */}
      <div style={{ background:T.bg.panelAlt, borderBottom:`1px solid ${T.border.subtle}`, padding:"6px 16px", display:"flex", alignItems:"center", gap:18, fontFamily:T.font.mono, fontSize:9.5 }}>
        <span style={{ color:T.text.muted, letterSpacing:0.5 }}>SOURCE</span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="PF" /><span style={{ color:T.text.secondary }}>Pro Forma</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="P" /><span style={{ color:T.text.secondary }}>Platform</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="U" /><span style={{ color:T.text.secondary }}>User Override</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="B" /><span style={{ color:T.text.secondary }}>Broker</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="T12" /><span style={{ color:T.text.secondary }}>T12/RR</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="M07" /><span style={{ color:T.text.secondary }}>M07/M05</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><SourcePill k="CALC" /><span style={{ color:T.text.secondary }}>Computed</span></span>
        <div style={{ width:1, height:14, background:T.border.medium }} />
        <span style={{ color:T.text.muted, letterSpacing:0.5 }}>CONFIDENCE</span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><ConfDots k="H" /><span style={{ color:T.text.secondary }}>High</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><ConfDots k="M" /><span style={{ color:T.text.secondary }}>Med</span></span>
        <span style={{ display:"flex", alignItems:"center", gap:5 }}><ConfDots k="L" /><span style={{ color:T.text.secondary }}>Low</span></span>
        <div style={{ flex:1 }} />
        <span style={{ color:T.text.muted }}>last edit · {DEAL.lastEdit.field} · <span style={{ color:T.text.green }}>{DEAL.lastEdit.from} → {DEAL.lastEdit.to}</span> · {DEAL.lastEdit.who} @ {DEAL.lastEdit.at}</span>
      </div>

      {/* ═══ SECTION 1 · REVENUE DRIVERS ═══════════════════════════ */}
      <SectionHeader id="rev" idx="01" title="REVENUE DRIVERS" count={REV_ROWS.length} ovr={1} coll={1} expanded={openSections.rev} onToggle={() => toggle("rev")} />
      {openSections.rev ? (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead />
            <tbody>{revTbody}</tbody>
          </table>
        </div>
      ) : null}

      {/* ═══ SECTION 2 · OCCUPANCY & CONCESSIONS · MODE-AWARE ══════ */}
      <SectionHeader id="occ" idx="02" title="OCCUPANCY & CONCESSIONS" count={OCC_ROWS.length} ovr={3} coll={1}
        expanded={openSections.occ} onToggle={() => toggle("occ")}
        extra={
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ color:T.text.muted, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:0.5, marginRight:4 }}>MODE</span>
            {OCC_MODES.map(m => {
              const active = m.id === occMode;
              return (
                <button key={m.id} className="mode-pill" onClick={() => setOccMode(m.id)} title={m.desc}
                  style={{ background:active ? `${T.text.amber}22` : T.bg.input, border:`1px solid ${active ? T.text.amber : T.border.medium}`, color:active ? T.text.amberBright : T.text.secondary, fontFamily:T.font.mono, fontSize:9.5, fontWeight:active ? 700 : 500, padding:"4px 9px", letterSpacing:0.5, borderRadius:1 }}>
                  {m.lbl}
                </button>
              );
            })}
          </div>
        } />

      {openSections.occ ? (
        <>
          {/* Mode context strip */}
          <div style={{ padding:"8px 16px", background:`${T.text.amber}08`, borderBottom:`1px solid ${T.border.subtle}`, display:"flex", alignItems:"center", gap:10, fontFamily:T.font.mono, fontSize:10 }}>
            <span style={{ color:T.text.amberBright, fontWeight:700, letterSpacing:0.5 }}>{occMode}</span>
            <span style={{ color:T.text.secondary }}>{OCC_MODES.find(m => m.id === occMode).desc}</span>
            {occMode === "LEASE-UP" ? <span style={{ color:T.text.cyan }}>· phys_occ row replaced by M07 absorption curve · pre-leased % editable below</span> : null}
            {occMode === "REDEVELOPMENT" ? <span style={{ color:T.text.cyan }}>· hybrid · adds down-unit schedule + re-lease pace rows</span> : null}
            {occMode === "STABILIZED" ? <span style={{ color:T.text.muted }}>· curve-based · physical occ ramps to stabilized target by Y3</span> : null}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead />
              <tbody>{occTbody}</tbody>
            </table>
          </div>
          {/* Aggregate impact preview */}
          <div style={{ padding:"10px 16px", background:T.bg.panelAlt, borderBottom:`1px solid ${T.border.medium}`, display:"flex", alignItems:"center", gap:24, fontFamily:T.font.mono, fontSize:10 }}>
            <span style={{ color:T.text.muted, letterSpacing:0.5 }}>OCCUPANCY & CONCESSION DRAG · IMPACT ON EGI</span>
            <span><span style={{ color:T.text.muted }}>Y1 </span><span style={{ color:T.text.red, fontWeight:700 }}>−13.6%</span></span>
            <span><span style={{ color:T.text.muted }}>Y2 </span><span style={{ color:T.text.red, fontWeight:700 }}>−10.3%</span></span>
            <span><span style={{ color:T.text.muted }}>Y3 </span><span style={{ color:T.text.amber, fontWeight:700 }}>−7.9%</span></span>
            <span><span style={{ color:T.text.muted }}>Y4 </span><span style={{ color:T.text.amber, fontWeight:700 }}>−7.4%</span></span>
            <span><span style={{ color:T.text.muted }}>Y5 </span><span style={{ color:T.text.amber, fontWeight:700 }}>−7.4%</span></span>
            <div style={{ flex:1 }} />
            <span style={{ color:T.text.green }}>vs broker −2.0% Y1 stabilized · ~$340K cumulative</span>
          </div>
        </>
      ) : null}

      {/* ═══ SECTION 3 · OPERATING EXPENSE DRIVERS ═════════════════ */}
      <SectionHeader id="opex" idx="03" title="OPERATING EXPENSE DRIVERS" count={OPEX_ROWS.length} ovr={1} coll={1} expanded={openSections.opex} onToggle={() => toggle("opex")} />
      {openSections.opex ? (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead />
            <tbody>{opexTbody}</tbody>
          </table>
        </div>
      ) : null}

      {/* ═══ SECTION 4 · PASSTHROUGH (calculated on dedicated tabs) ═══ */}
      <SectionHeader id="pass" idx="04" title="PASSTHROUGH · CALCULATED ON DEDICATED TABS" count={PASS_ROWS.length} ovr={0} coll={0} expanded={openSections.pass} onToggle={() => toggle("pass")} />
      {openSections.pass ? (
        <>
          <div style={{ padding:"6px 16px", background:T.bg.panelAlt, borderBottom:`1px solid ${T.border.subtle}`, color:T.text.muted, fontFamily:T.font.mono, fontSize:9.5, letterSpacing:0.4 }}>
            ▸ these values are computed on F9 Taxes / F9 Debt / F9 Capital Waterfall · displayed here for visibility into projection stack · click tab badge to edit
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <TableHead />
              <tbody>{passTbody}</tbody>
            </table>
          </div>
        </>
      ) : null}

      {/* ═══ SECTION 5 · EXIT METHOD ═══════════════════════════════ */}
      <SectionHeader id="exit" idx="05" title="EXIT METHOD" count={EXIT_ROWS.length} ovr={1} coll={1} expanded={openSections.exit} onToggle={() => toggle("exit")} />
      {openSections.exit ? (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <TableHead />
            <tbody>{exitTbody}</tbody>
          </table>
        </div>
      ) : null}

      {/* ─── FOOTER · DOWNSTREAM PUSH STATUS ──────────────────────── */}
      <div style={{ position:"sticky", bottom:0, background:T.bg.banner, borderTop:`1px solid ${T.border.medium}`, padding:"8px 16px", display:"flex", alignItems:"center", gap:14, fontFamily:T.font.mono, fontSize:10 }}>
        <span style={{ color:T.text.green, fontWeight:700, letterSpacing:0.5 }}>● LIVE</span>
        <span style={{ color:T.text.muted }}>downstream consumers</span>
        <span style={{ color:T.text.cyan }}>Projections (synced)</span>
        <span style={{ color:T.text.cyan }}>Returns (synced)</span>
        <span style={{ color:T.text.cyan }}>Sensitivities (synced)</span>
        <span style={{ color:T.text.cyan }}>Sources & Uses (synced)</span>
        <div style={{ flex:1 }} />
        <span style={{ color:T.text.muted }}>scenario · </span>
        <span style={{ color:T.text.amberBright, fontWeight:700 }}>{scenario}</span>
        <span style={{ color:T.text.muted }}>· occ-mode · </span>
        <span style={{ color:T.text.amberBright, fontWeight:700 }}>{occMode}</span>
      </div>
    </div>
  );
}
