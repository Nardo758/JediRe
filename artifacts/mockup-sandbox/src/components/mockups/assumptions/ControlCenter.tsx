import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════
// F9 · ASSUMPTIONS — CONTROL CENTER  (design mockup)
//
// Architecture:
//   Pro Forma (Y1 · source selectable)  →  ASSUMPTIONS  →  Projections / Returns / Sensitivities
//
// Y1 source picker: BROKER / T12 (with T6/T3/T1 sub-toggle) / PLATFORM / RESOLVED
// All user inputs unified here — concessions + traffic pulled from Projections
// ═══════════════════════════════════════════════════════════════════════

const T = {
  bg: { panel:"#0F1319", panelAlt:"#131821", header:"#1A1F2E", input:"#0D1117", row:"#11161F", rowAlt:"#0D1219", section:"#0C1017", banner:"#091018", active:"#252D40" },
  text: { primary:"#E8ECF1", secondary:"#8B95A5", muted:"#4A5568", amber:"#F5A623", amberBright:"#FFD166", green:"#00D26A", red:"#FF4757", cyan:"#00BCD4", orange:"#FF8C42", purple:"#A78BFA", teal:"#2ADBDB" },
  border: { subtle:"#1E2538", medium:"#2A3348", bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code',monospace", label:"'IBM Plex Sans','Inter',sans-serif" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0;scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17}
*::-webkit-scrollbar{width:5px;height:5px}*::-webkit-scrollbar-track{background:#0A0E17}*::-webkit-scrollbar-thumb{background:#2A3348;border-radius:2px}
.arow:hover td{background:#1A1F2E !important}
.cell-edit:hover{background:#252D40 !important;border-color:#3B4A6B !important;cursor:pointer}
.tab-jump:hover{color:#FFD166 !important;cursor:pointer}
.scn:hover{background:#252D40 !important;cursor:pointer}
.method-pill:hover{background:#252D40 !important;border-color:#3B4A6B !important;cursor:pointer}
.mode-pill:hover{background:#252D40 !important;cursor:pointer}
.action-btn:hover{opacity:0.85;cursor:pointer}
.section-hdr:hover span.stoggle{color:#FFD166 !important;cursor:pointer}
input.f9inp:focus{outline:none;border-color:#F5A623 !important}
.src-btn:hover{opacity:0.8;cursor:pointer}
.t-sub:hover{background:#252D40 !important;cursor:pointer}
.bulk-btn:hover{opacity:0.85;cursor:pointer}
`;

// ─── Source / Provenance config ───────────────────────────────────────
const SRC: Record<string,{lbl:string;c:string;name:string}> = {
  PF:  {lbl:"PF",  c:T.text.cyan,   name:"Pro Forma · Y1"},
  B:   {lbl:"B",   c:T.text.amber,  name:"Broker OM"},
  P:   {lbl:"P",   c:T.text.cyan,   name:"Platform"},
  U:   {lbl:"U",   c:T.text.green,  name:"User Override"},
  T12: {lbl:"T12", c:T.text.purple, name:"T12 Operating"},
  T6:  {lbl:"T6",  c:T.text.purple, name:"T6 Trailing"},
  T3:  {lbl:"T3",  c:T.text.purple, name:"T3 Trailing"},
  T1:  {lbl:"T1",  c:T.text.purple, name:"T1 Trailing"},
  RR:  {lbl:"RR",  c:T.text.purple, name:"Rent Roll"},
  M07: {lbl:"M07", c:T.text.orange, name:"M07 Traffic Engine"},
  M05: {lbl:"M05", c:T.text.orange, name:"M05 Market"},
  PT:  {lbl:"PT",  c:T.text.teal,   name:"Portfolio"},
  CALC:{lbl:"=",   c:T.text.muted,  name:"Computed"},
};
const CONF: Record<string,{d:string;c:string;name:string}> = {
  H:{d:"●●●",c:T.text.green, name:"High"},
  M:{d:"●●○",c:T.text.amber, name:"Medium"},
  L:{d:"●○○",c:T.text.red,   name:"Low"},
};
const METHOD: Record<string,{lbl:string;c:string;desc:string}> = {
  FLAT:   {lbl:"Flat %",         c:T.text.cyan,   desc:"Constant % growth each year"},
  STEP:   {lbl:"Stepped",        c:T.text.cyan,   desc:"Year-by-year custom % schedule"},
  CPI:    {lbl:"CPI-Linked",     c:T.text.purple, desc:"Indexed to projected CPI curve"},
  CURVE:  {lbl:"Curve",          c:T.text.amber,  desc:"Custom curve · monthly granularity"},
  LINK:   {lbl:"Linked",         c:T.text.purple, desc:"Derived from another assumption"},
  M07:    {lbl:"M07 Absorption", c:T.text.orange, desc:"Pulled from M07 Traffic Engine"},
  MANUAL: {lbl:"Manual",         c:T.text.green,  desc:"User specifies each year directly"},
  PASS:   {lbl:"Passthrough",    c:T.text.muted,  desc:"Calculated on dedicated tab"},
};

// ─── Y1 values per data layer ─────────────────────────────────────────
// Each row defines y1 values for: BROKER, T12, T6, T3, T1, PLATFORM, RESOLVED
const Y1_LAYERS: Record<string,{B:string;T12:string;T6:string;T3:string;T1:string;P:string;R:string}> = {
  rent_growth:  {B:"$2,021",   T12:"$1,948", T6:"$1,962", T3:"$1,971", T1:"$1,985", P:"$1,952", R:"$1,948"},
  oth_inc:      {B:"$95",      T12:"$80",    T6:"$82",    T3:"$84",    T1:"$85",    P:"$78",    R:"$80"},
  reno_premium: {B:"—",        T12:"$0",     T6:"$0",     T3:"$0",     T1:"$0",     P:"$0",     R:"$0"},
  phys_occ:     {B:"95.0%",    T12:"92.0%",  T6:"91.5%",  T3:"91.2%",  T1:"92.8%", P:"92.3%",  R:"92.0%"},
  struct_floor: {B:"—",        T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"8.5%",   R:"8.5%"},
  concess_new:  {B:"0 mo",     T12:"1.5 mo", T6:"1.5 mo", T3:"1.4 mo", T1:"1.5 mo",P:"1.5 mo", R:"1.5 mo"},
  concess_ren:  {B:"0 mo",     T12:"0.5 mo", T6:"0.5 mo", T3:"0.5 mo", T1:"0.5 mo",P:"0.5 mo", R:"0.5 mo"},
  concess_pct:  {B:"0%",       T12:"65%",    T6:"63%",    T3:"60%",    T1:"68%",   P:"65%",    R:"65%"},
  loss_to_lease:{B:"1.0%",     T12:"4.2%",   T6:"4.1%",   T3:"4.0%",   T1:"4.3%",  P:"4.2%",   R:"4.2%"},
  bad_debt:     {B:"0.5%",     T12:"1.8%",   T6:"1.9%",   T3:"2.0%",   T1:"1.7%",  P:"1.8%",   R:"1.8%"},
  non_rev:      {B:"0 units",  T12:"3 units",T6:"3 units",T3:"3 units",T1:"3 units",P:"3 units",R:"3 units"},
  econ_occ:     {B:"93.8%",    T12:"86.4%",  T6:"86.0%",  T3:"85.8%",  T1:"87.0%", P:"86.8%",  R:"86.4%"},
  payroll:      {B:"$950/u",   T12:"$1,180/u",T6:"$1,185/u",T3:"$1,190/u",T1:"$1,175/u",P:"$1,165/u",R:"$1,180/u"},
  rm:           {B:"$550/u",   T12:"$680/u", T6:"$682/u", T3:"$685/u", T1:"$678/u", P:"$670/u", R:"$680/u"},
  util:         {B:"$360/u",   T12:"$420/u", T6:"$418/u", T3:"$415/u", T1:"$422/u", P:"$410/u", R:"$420/u"},
  ins:          {B:"$680/u",   T12:"$890/u", T6:"$880/u", T3:"$875/u", T1:"$895/u", P:"$870/u", R:"$890/u"},
  mgmt:         {B:"3.0% EGI", T12:"3.0% EGI",T6:"3.0% EGI",T3:"3.0% EGI",T1:"3.0% EGI",P:"3.0% EGI",R:"3.0% EGI"},
  ga:           {B:"$150/u",   T12:"$185/u", T6:"$186/u", T3:"$187/u", T1:"$184/u", P:"$180/u", R:"$185/u"},
  capex_res:    {B:"$250/u",   T12:"$300/u", T6:"$300/u", T3:"$300/u", T1:"$300/u", P:"$295/u", R:"$300/u"},
  prop_tax:     {B:"$1,800/u", T12:"$2,140/u",T6:"$2,140/u",T3:"$2,140/u",T1:"$2,140/u",P:"$2,140/u",R:"$2,140/u"},
  debt_svc:     {B:"—",        T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"$1,640/u",R:"$1,640/u"},
  exit_cap:     {B:"5.00%",    T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"5.45%",  R:"5.20%"},
  sell_cost:    {B:"1.5%",     T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"2.0%",   R:"2.0%"},
  t01_tours:    {B:"—",        T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"18/wk",  R:"18/wk"},
  t05_close:    {B:"—",        T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"32%",    R:"32%"},
  t06_leases:   {B:"—",        T12:"—",      T6:"—",      T3:"—",      T1:"—",      P:"5.8/wk", R:"5.8/wk"},
};

type Y1Source = "BROKER"|"T12"|"T6"|"T3"|"T1"|"PLATFORM"|"RESOLVED";
type T12Sub = "T12"|"T6"|"T3"|"T1";
type OccMode = "STABILIZED"|"LEASE-UP"|"REDEVELOPMENT";

function getY1Val(id:string, source:Y1Source): {val:string;srcKey:string} {
  const row = Y1_LAYERS[id];
  if (!row) return {val:"—", srcKey:"CALC"};
  const map:Record<Y1Source,[string,string]> = {
    BROKER:   [row.B,   "B"],
    T12:      [row.T12, "T12"],
    T6:       [row.T6,  "T6"],
    T3:       [row.T3,  "T3"],
    T1:       [row.T1,  "T1"],
    PLATFORM: [row.P,   "P"],
    RESOLVED: [row.R,   "PF"],
  };
  const [val, srcKey] = map[source];
  return {val, srcKey};
}

// ─── Row data ─────────────────────────────────────────────────────────
type YrCell = {val:string;src:string;conf:string;prev?:{val:string;src:string}};
interface ARow {
  id:string; lbl:string; method:string;
  yrs:YrCell[];
  basis:string;
  coll?:{broker:string;note:string};
  flowsTo:string[];
  note:string;
  readonly?:boolean;
  jumpTab?:string;
  srcConstraint?:string; // which sources have Y1 data
}

const REV_ROWS:ARow[] = [
  { id:"rent_growth", lbl:"Market Rent Growth", method:"STEP",
    yrs:[{val:"3.4%",src:"U",conf:"H",prev:{val:"3.1%",src:"P"}},{val:"3.2%",src:"P",conf:"H"},{val:"3.1%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"L"}],
    basis:"M05 Westshore submarket · 5yr curve · band 2.8–3.6%",
    coll:{broker:"4.5%",note:"Broker Y1 130bps above platform · ~$42K NOI overstatement"},
    flowsTo:["Projections · GPR","Returns","Sensitivities"],
    note:"avg eff rent / unit / mo", srcConstraint:"all" },
  { id:"oth_inc", lbl:"Other Income Growth", method:"FLAT",
    yrs:[{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"}],
    basis:"Default fee inflation · CPI-linked · parking + RUBS + fees",
    flowsTo:["Projections · Other Income"],
    note:"/ unit / mo", srcConstraint:"all" },
  { id:"reno_premium", lbl:"Renovation Rent Premium", method:"CURVE",
    yrs:[{val:"+$45",src:"U",conf:"M"},{val:"+$95",src:"U",conf:"M"},{val:"+$135",src:"U",conf:"M"},{val:"+$140",src:"P",conf:"L"},{val:"+$140",src:"P",conf:"L"}],
    basis:"User: $150 stabilized premium · 60-unit/yr pace · weighted avg per door",
    flowsTo:["Projections · GPR uplift","Capital Plan"],
    note:"pre-renovation baseline", srcConstraint:"T12+P+R" },
];

const OCC_ROWS:ARow[] = [
  { id:"phys_occ", lbl:"Physical Occupancy", method:"CURVE",
    yrs:[{val:"92.0%",src:"U",conf:"H",prev:{val:"93.0%",src:"P"}},{val:"93.5%",src:"P",conf:"H"},{val:"94.0%",src:"P",conf:"H"},{val:"94.0%",src:"P",conf:"M"},{val:"94.0%",src:"P",conf:"M"}],
    basis:"Y1 user override · reno disruption drag; Y2–5 platform stabilized target",
    coll:{broker:"95.0%",note:"Broker assumes flat 95% from Y1 · ignores reno disruption"},
    flowsTo:["Projections · Vacancy Loss","Returns"],
    note:"current physical occ", srcConstraint:"all" },
  { id:"struct_floor", lbl:"Structural Vacancy Floor", method:"FLAT",
    yrs:[{val:"8.5%",src:"M05",conf:"H"},{val:"8.5%",src:"M05",conf:"H"},{val:"8.5%",src:"M05",conf:"M"},{val:"8.5%",src:"M05",conf:"M"},{val:"8.5%",src:"M05",conf:"L"}],
    basis:"M05 Westshore submarket · structural floor · occ cannot exceed (1 − floor) without flag",
    flowsTo:["Validation guard"],
    note:"M05 submarket floor", srcConstraint:"P+R" },
  { id:"concess_new", lbl:"Concessions · New Leases", method:"CURVE",
    yrs:[{val:"1.5 mo",src:"M05",conf:"H"},{val:"1.0 mo",src:"U",conf:"M",prev:{val:"1.2 mo",src:"P"}},{val:"0.5 mo",src:"U",conf:"M"},{val:"0.5 mo",src:"P",conf:"L"},{val:"0.5 mo",src:"P",conf:"L"}],
    basis:"User burn-off curve · post-reno comp set drops to 0.5mo by Y3",
    coll:{broker:"0 mo",note:"Broker OM models zero concessions · ~3.1% rent overstatement Y1"},
    flowsTo:["Projections · Concession Loss","Economic Occ"],
    note:"market avg · new lease", srcConstraint:"all" },
  { id:"concess_ren", lbl:"Concessions · Renewals", method:"FLAT",
    yrs:[{val:"0.5 mo",src:"P",conf:"M"},{val:"0.5 mo",src:"P",conf:"M"},{val:"0.25 mo",src:"P",conf:"L"},{val:"0.25 mo",src:"P",conf:"L"},{val:"0.25 mo",src:"P",conf:"L"}],
    basis:"Platform default · half of new-lease concession · tapers post-stabilization",
    flowsTo:["Projections · Concession Loss"],
    note:"renewal incentive", srcConstraint:"all" },
  { id:"concess_pct", lbl:"% New Leases w/ Concession", method:"STEP",
    yrs:[{val:"65%",src:"M07",conf:"H"},{val:"45%",src:"P",conf:"M"},{val:"25%",src:"P",conf:"M"},{val:"20%",src:"P",conf:"L"},{val:"20%",src:"P",conf:"L"}],
    basis:"M07 traffic · share of signed leases w/ concession · 90d trailing",
    flowsTo:["Concession aggregate"],
    note:"share receiving concession", srcConstraint:"T12+M07+R" },
  { id:"loss_to_lease", lbl:"Loss to Lease", method:"STEP",
    yrs:[{val:"4.2%",src:"RR",conf:"H"},{val:"2.5%",src:"P",conf:"M"},{val:"1.5%",src:"P",conf:"M"},{val:"1.0%",src:"P",conf:"L"},{val:"1.0%",src:"P",conf:"L"}],
    basis:"Closure curve · 55% Y1, 85% Y2, ~100% Y3 · M05 submarket renewal cadence",
    flowsTo:["Projections · LtL Loss"],
    note:"in-place vs market · from RR", srcConstraint:"all" },
  { id:"bad_debt", lbl:"Bad Debt", method:"STEP",
    yrs:[{val:"1.8%",src:"T12",conf:"H"},{val:"1.5%",src:"P",conf:"M"},{val:"1.2%",src:"P",conf:"M"},{val:"1.0%",src:"P",conf:"L"},{val:"1.0%",src:"P",conf:"L"}],
    basis:"T12 actual · improvement curve toward portfolio avg 1.0% post-stabilization",
    flowsTo:["Projections · Bad Debt"],
    note:"% of GPR · from T12", srcConstraint:"all" },
  { id:"non_rev", lbl:"Non-Revenue Units", method:"MANUAL",
    yrs:[{val:"3",src:"RR",conf:"H"},{val:"3",src:"U",conf:"H"},{val:"2",src:"U",conf:"M"},{val:"2",src:"U",conf:"M"},{val:"2",src:"U",conf:"M"}],
    basis:"1 model + 1 employee + down units · drops to 0 post-reno completion",
    flowsTo:["Projections · GPR adj"],
    note:"model + employee + down · from RR", srcConstraint:"all" },
  { id:"econ_occ", lbl:"Economic Occupancy", method:"LINK", readonly:true,
    yrs:[{val:"86.4%",src:"CALC",conf:"H"},{val:"89.7%",src:"CALC",conf:"H"},{val:"92.1%",src:"CALC",conf:"H"},{val:"92.6%",src:"CALC",conf:"M"},{val:"92.6%",src:"CALC",conf:"M"}],
    basis:"= Phys Occ × (1 − concession − bad debt − LtL) · auto-derived · cannot override",
    flowsTo:["Projections · EGI base"],
    note:"computed · from PF", srcConstraint:"R" },
];

const OPEX_ROWS:ARow[] = [
  { id:"payroll", lbl:"Payroll & Benefits", method:"FLAT",
    yrs:[{val:"3.5%",src:"P",conf:"M"},{val:"3.5%",src:"P",conf:"M"},{val:"3.5%",src:"P",conf:"M"},{val:"3.5%",src:"P",conf:"L"},{val:"3.5%",src:"P",conf:"L"}],
    basis:"Tampa BLS wage growth · 5yr trailing avg",
    flowsTo:["Projections · OpEx"],
    note:"from T12", srcConstraint:"all" },
  { id:"rm", lbl:"Repairs & Maintenance", method:"FLAT",
    yrs:[{val:"3.0%",src:"P",conf:"H"},{val:"3.0%",src:"P",conf:"H"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"L"}],
    basis:"Portfolio actual + CPI · 1986-vintage adjusted",
    flowsTo:["Projections · OpEx"],
    note:"from T12", srcConstraint:"all" },
  { id:"util", lbl:"Utilities (Net of RUBS)", method:"STEP",
    yrs:[{val:"4.5%",src:"P",conf:"M"},{val:"4.0%",src:"P",conf:"M"},{val:"3.5%",src:"P",conf:"L"},{val:"3.5%",src:"P",conf:"L"},{val:"3.5%",src:"P",conf:"L"}],
    basis:"FL utility rate filings · front-loaded curve",
    flowsTo:["Projections · OpEx"],
    note:"from T12", srcConstraint:"all" },
  { id:"ins", lbl:"Insurance", method:"STEP",
    yrs:[{val:"6.0%",src:"U",conf:"M",prev:{val:"5.0%",src:"P"}},{val:"5.0%",src:"U",conf:"M"},{val:"4.0%",src:"P",conf:"L"},{val:"3.5%",src:"P",conf:"L"},{val:"3.5%",src:"P",conf:"L"}],
    basis:"FL wind premium curve · user front-loaded post-reform tail",
    coll:{broker:"3.0%",note:"Broker uses pre-reform avg · understates ~$15K/yr Y1-2"},
    flowsTo:["Projections · OpEx"],
    note:"from T12 · FL wind exposure", srcConstraint:"all" },
  { id:"mgmt", lbl:"Management Fee", method:"LINK", readonly:true,
    yrs:[{val:"3.0%",src:"CALC",conf:"H"},{val:"3.0%",src:"CALC",conf:"H"},{val:"3.0%",src:"CALC",conf:"H"},{val:"3.0%",src:"CALC",conf:"H"},{val:"3.0%",src:"CALC",conf:"H"}],
    basis:"Linked to EGI · contracted rate · auto-scales with revenue",
    flowsTo:["Projections · OpEx"],
    note:"contracted rate", srcConstraint:"R" },
  { id:"ga", lbl:"General & Administrative", method:"FLAT",
    yrs:[{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"L"},{val:"3.0%",src:"P",conf:"L"},{val:"3.0%",src:"P",conf:"L"}],
    basis:"CPI-linked · admin overhead",
    flowsTo:["Projections · OpEx"],
    note:"from T12", srcConstraint:"all" },
  { id:"capex_res", lbl:"CapEx Reserve", method:"FLAT",
    yrs:[{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"M"},{val:"3.0%",src:"P",conf:"L"},{val:"3.0%",src:"P",conf:"L"}],
    basis:"Per-unit replacement reserve · escalates with inflation",
    flowsTo:["Projections · Below NOI","Returns"],
    note:"replacement reserve", srcConstraint:"all" },
];

// Traffic & Absorption — moved from Projections tab
const TRAFFIC_ROWS:ARow[] = [
  { id:"t01_tours", lbl:"Weekly Tour Volume (T01)", method:"M07",
    yrs:[{val:"18/wk",src:"M07",conf:"H"},{val:"21/wk",src:"M07",conf:"H"},{val:"24/wk",src:"M07",conf:"M"},{val:"26/wk",src:"M07",conf:"M"},{val:"26/wk",src:"M07",conf:"L"}],
    basis:"M07 trailing 90d signal · feeds lease-up absorption curve",
    flowsTo:["Occupancy Curve","Lease-Up Timeline"],
    note:"M07 trailing 90d signal", srcConstraint:"M07+R" },
  { id:"t05_close", lbl:"Closing Ratio (T05)", method:"M07",
    yrs:[{val:"32%",src:"M07",conf:"H"},{val:"34%",src:"P",conf:"M"},{val:"35%",src:"P",conf:"M"},{val:"35%",src:"P",conf:"L"},{val:"35%",src:"P",conf:"L"}],
    basis:"Signed leases / tours · current 32% vs submarket 36% · improving",
    flowsTo:["Leases/wk","Absorption Speed"],
    note:"signed / toured", srcConstraint:"M07+R" },
  { id:"t06_leases", lbl:"Weekly Leases Signed (T06)", method:"M07",
    yrs:[{val:"5.8/wk",src:"M07",conf:"H"},{val:"7.0/wk",src:"M07",conf:"H"},{val:"8.4/wk",src:"P",conf:"M"},{val:"9.1/wk",src:"P",conf:"M"},{val:"9.1/wk",src:"P",conf:"L"}],
    basis:"T01 × T05 · current pace implies 95% occ by Y2.8",
    coll:{broker:"—",note:"Broker OM provides no traffic data · absorption unsubstantiated"},
    flowsTo:["Lease-Up Timeline","Projections · Occ Ramp"],
    note:"derived from T01 × T05", srcConstraint:"M07+R" },
  { id:"t07_leaseup", lbl:"Weeks to 95% Occupancy (T07)", method:"M07", readonly:true,
    yrs:[{val:"—",src:"CALC",conf:"H"},{val:"~Y2.8",src:"CALC",conf:"H"},{val:"✓ stab",src:"CALC",conf:"H"},{val:"✓ stab",src:"CALC",conf:"M"},{val:"✓ stab",src:"CALC",conf:"M"}],
    basis:"Derived: (target_occ − curr_occ) × units / (wkly_leases − wkly_turnover) · current: 107 weeks",
    flowsTo:["Occupancy Curve","Hold Period Logic"],
    note:"derived from T01/T05/T06", srcConstraint:"CALC" },
  { id:"stab_occ", lbl:"Stabilized Occupancy Target", method:"STEP",
    yrs:[{val:"92.0%",src:"U",conf:"H"},{val:"93.5%",src:"P",conf:"H"},{val:"94.0%",src:"P",conf:"H"},{val:"94.0%",src:"P",conf:"M"},{val:"94.0%",src:"P",conf:"M"}],
    basis:"User Y1 override · post-reno target 94% · M07 confidence: HIGH",
    flowsTo:["Occupancy · phys_occ","Returns"],
    note:"M07 calibrated target", srcConstraint:"M07+P+R" },
];

const PASS_ROWS:ARow[] = [
  { id:"prop_tax", lbl:"Property Taxes (FL)", method:"PASS", jumpTab:"F9 Taxes", readonly:true,
    yrs:[{val:"reassess",src:"P",conf:"H"},{val:"+10%cap",src:"P",conf:"H"},{val:"+10%cap",src:"P",conf:"H"},{val:"+10%cap",src:"P",conf:"M"},{val:"+10%cap",src:"P",conf:"M"}],
    basis:"FL non-homestead · just value reassessed at close · 10%/yr cap · doc stamps at acq",
    flowsTo:["Projections · Property Tax"],
    note:"reassessed at sale · F9 Taxes tab", srcConstraint:"all" },
  { id:"debt_svc", lbl:"Debt Service", method:"PASS", jumpTab:"F9 Debt", readonly:true,
    yrs:[{val:"IO",src:"P",conf:"H"},{val:"IO",src:"P",conf:"H"},{val:"amort",src:"P",conf:"H"},{val:"amort",src:"P",conf:"M"},{val:"amort",src:"P",conf:"M"}],
    basis:"$26.95M loan · 65% LTV · SOFR+225 · 2yr IO · 30yr amort · see F9 Debt",
    flowsTo:["Projections · Below NOI","Returns · Levered"],
    note:"calculated · F9 Debt tab", srcConstraint:"CALC" },
];

const EXIT_ROWS:ARow[] = [
  { id:"exit_cap", lbl:"Exit Cap Rate", method:"STEP",
    yrs:[{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"M"},{val:"5.50%",src:"U",conf:"M",prev:{val:"5.45%",src:"P"}}],
    basis:"Going-in + 30bps spread · user override slightly above platform default",
    coll:{broker:"5.00%",note:"Broker uses 5.00% exit · 50bps below user · ~$3.8M valuation overstatement"},
    flowsTo:["Returns · Reversion","Sensitivities"],
    note:"going-in · from PF", srcConstraint:"B+P+R" },
  { id:"sell_cost", lbl:"Selling Costs", method:"FLAT",
    yrs:[{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"H"},{val:"—",src:"CALC",conf:"M"},{val:"2.0%",src:"P",conf:"H"}],
    basis:"Brokerage + closing costs · standard institutional sale",
    flowsTo:["Returns · Net Reversion"],
    note:"applied at exit only", srcConstraint:"B+P+R" },
];

// ─── Atoms ────────────────────────────────────────────────────────────
function SrcPill({k}:{k:string}) {
  const s = SRC[k] || SRC.P;
  return <span style={{display:"inline-block",padding:"1px 4px",border:`1px solid ${s.c}55`,color:s.c,fontFamily:T.font.mono,fontSize:9,fontWeight:600,letterSpacing:0.4,background:`${s.c}11`,borderRadius:1,lineHeight:1.4}} title={s.name}>{s.lbl}</span>;
}
function ConfDots({k}:{k:string}) {
  const c = CONF[k] || CONF.M;
  return <span style={{color:c.c,fontSize:8,fontFamily:T.font.mono,letterSpacing:0.5}} title={c.name}>{c.d}</span>;
}
function MethodPill({k}:{k:string}) {
  const m = METHOD[k] || METHOD.FLAT;
  return <button className="method-pill" style={{background:T.bg.input,border:`1px solid ${m.c}44`,color:m.c,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,padding:"3px 7px",letterSpacing:0.3,borderRadius:1,cursor:"pointer"}} title={m.desc}>{m.lbl} <span style={{color:T.text.muted,marginLeft:2}}>▾</span></button>;
}
function PassBadge() {
  return <span style={{padding:"1px 5px",background:`${T.text.muted}22`,color:T.text.secondary,fontFamily:T.font.mono,fontSize:8,fontWeight:700,letterSpacing:0.4,borderRadius:1}}>READ-ONLY</span>;
}

function YrCell({y}:{y:YrCell}) {
  const ovr = y.src === "U";
  return (
    <td className="cell-edit" style={{padding:"6px 8px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`1px solid ${T.border.subtle}`,background:ovr?`${T.text.green}08`:"transparent",textAlign:"right",verticalAlign:"middle",minWidth:82}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:5}}>
        <span style={{color:T.text.primary,fontFamily:T.font.mono,fontSize:11,fontWeight:ovr?600:500}}>{y.val}</span>
        <SrcPill k={y.src} />
        <ConfDots k={y.conf} />
      </div>
      {y.prev && <div style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:8,textAlign:"right",marginTop:2,textDecoration:"line-through"}}>was {y.prev.val} ({y.prev.src})</div>}
    </td>
  );
}

function CollTag({coll}:{coll:{broker:string;note:string}}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 6px",background:`${T.text.amber}11`,border:`1px solid ${T.text.amber}44`,borderRadius:1,marginTop:4}}>
      <span style={{color:T.text.amber,fontFamily:T.font.mono,fontSize:9,fontWeight:700}}>⚠ COLLISION</span>
      <span style={{color:T.text.amberBright,fontFamily:T.font.mono,fontSize:9}}>Broker: {coll.broker}</span>
      <span style={{color:T.text.secondary,fontFamily:T.font.label,fontSize:10}}>· {coll.note}</span>
    </div>
  );
}

function FlowsTo({to}:{to:string[]}) {
  if (!to.length) return null;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,fontFamily:T.font.mono,fontSize:9,color:T.text.muted,flexShrink:0}}>
      <span style={{color:T.text.cyan}}>→</span>
      {to.map((d,i) => <span key={i} className="tab-jump" style={{color:T.text.secondary,padding:"1px 5px",border:`1px solid ${T.border.subtle}`,borderRadius:1}}>{d}</span>)}
    </div>
  );
}

// Y1 cell in the table — shows value from selected source
function Y1Cell({row, source}:{row:ARow; source:Y1Source}) {
  const {val, srcKey} = getY1Val(row.id, source);
  const unavail = val === "—" && source !== "RESOLVED";
  return (
    <td style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`1px solid ${T.border.subtle}`,verticalAlign:"top",width:160,background:unavail?`${T.text.red}05`:`${T.text.cyan}06`}}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <SrcPill k={srcKey} />
        <span style={{color:unavail?T.text.muted:T.text.primary,fontFamily:T.font.mono,fontSize:11,fontWeight:600}}>{val}</span>
        {unavail && <span style={{color:T.text.red,fontFamily:T.font.mono,fontSize:8}}>N/A</span>}
      </div>
      <div style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9,marginTop:3}}>{row.note}</div>
    </td>
  );
}

function TableHead() {
  return (
    <thead>
      <tr style={{background:T.bg.header}}>
        <th style={{padding:"7px 10px",textAlign:"left",color:T.text.secondary,fontFamily:T.font.mono,fontSize:9,fontWeight:600,letterSpacing:0.6,borderBottom:`1px solid ${T.border.medium}`,width:220}}>ASSUMPTION</th>
        <th style={{padding:"7px 10px",textAlign:"left",color:T.text.cyan,fontFamily:T.font.mono,fontSize:9,fontWeight:600,letterSpacing:0.6,borderBottom:`1px solid ${T.border.medium}`,borderLeft:`1px solid ${T.border.subtle}`,width:160,background:`${T.text.cyan}08`}}>← Y1 · SOURCE</th>
        <th style={{padding:"7px 10px",textAlign:"left",color:T.text.secondary,fontFamily:T.font.mono,fontSize:9,fontWeight:600,letterSpacing:0.6,borderBottom:`1px solid ${T.border.medium}`,borderLeft:`1px solid ${T.border.subtle}`,width:120}}>METHOD</th>
        {["Y2","Y3","Y4","Y5","Y1 →"].map((y,i) => (
          <th key={y} style={{padding:"7px 10px",textAlign:"right",color:i===4?T.text.cyan:T.text.secondary,fontFamily:T.font.mono,fontSize:9,fontWeight:600,letterSpacing:0.6,borderBottom:`1px solid ${T.border.medium}`,borderLeft:`1px solid ${T.border.subtle}`,minWidth:82}}>{y}</th>
        ))}
      </tr>
    </thead>
  );
}

function ARowComp({row,dim,source}:{row:ARow;dim:boolean;source:Y1Source}) {
  const isPass = row.method === "PASS";
  return (
    <>
      <tr className="arow" style={{background:dim?T.bg.rowAlt:T.bg.row}}>
        <td style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`,verticalAlign:"top"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div>
              <div style={{color:T.text.primary,fontFamily:T.font.label,fontSize:11,fontWeight:600}}>{row.lbl}</div>
              <div style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:8.5,marginTop:1,letterSpacing:0.3}}>{row.id}</div>
            </div>
            {row.readonly && <PassBadge />}
          </div>
        </td>
        <Y1Cell row={row} source={source} />
        <td style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`1px solid ${T.border.subtle}`,verticalAlign:"top"}}>
          {isPass
            ? <button className="tab-jump" style={{background:"transparent",border:`1px solid ${T.text.muted}66`,color:T.text.secondary,fontFamily:T.font.mono,fontSize:9,fontWeight:600,padding:"3px 7px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>→ {row.jumpTab}</button>
            : <MethodPill k={row.method} />
          }
        </td>
        {row.yrs.slice(0,4).map((y,i) => <YrCell key={i} y={y} />)}
        {/* Y1 mirror at end for reference */}
        <td style={{padding:"6px 8px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`1px solid ${T.border.subtle}`,background:`${T.text.cyan}06`,textAlign:"right",verticalAlign:"middle",opacity:0.65}}>
          <span style={{color:T.text.cyan,fontFamily:T.font.mono,fontSize:10,fontWeight:500}}>{getY1Val(row.id, source).val}</span>
        </td>
      </tr>
      <tr style={{background:dim?T.bg.rowAlt:T.bg.row}}>
        <td colSpan={8} style={{padding:"3px 10px 9px 10px",borderBottom:`1px solid ${T.border.medium}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
            <div style={{flex:1}}>
              <div style={{color:T.text.secondary,fontFamily:T.font.label,fontSize:10,lineHeight:1.5}}>
                <span style={{color:T.text.muted,marginRight:6,fontFamily:T.font.mono,fontSize:8.5,letterSpacing:0.5}}>BASIS</span>
                {row.basis}
              </div>
              {row.coll && <CollTag coll={row.coll} />}
            </div>
            <FlowsTo to={row.flowsTo} />
          </div>
        </td>
      </tr>
    </>
  );
}

function SecHdr({idx,title,count,ovr,coll,expanded,onToggle,extra}:{
  idx:string;title:string;count:number;ovr:number;coll:number;
  expanded:boolean;onToggle:()=>void;extra?:React.ReactNode
}) {
  return (
    <div className="section-hdr" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:T.bg.section,borderTop:`1px solid ${T.border.medium}`,borderBottom:`1px solid ${T.border.subtle}`}}>
      <div onClick={onToggle} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
        <span className="stoggle" style={{color:T.text.muted,width:14}}>{expanded?"▾":"▸"}</span>
        <span className="stoggle" style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:10}}>{idx}</span>
        <span className="stoggle" style={{color:T.text.amberBright,fontFamily:T.font.mono,fontSize:11,fontWeight:700,letterSpacing:0.6}}>{title}</span>
        <span style={{color:T.text.secondary,fontWeight:500,fontSize:10,fontFamily:T.font.mono}}>· {count} assumptions</span>
        {ovr>0 && <span style={{color:T.text.green,fontWeight:600,fontSize:10,fontFamily:T.font.mono}}>· {ovr} overridden</span>}
        {coll>0 && <span style={{color:T.text.amber,fontWeight:600,fontSize:10,fontFamily:T.font.mono}}>· {coll} collision{coll>1?"s":""}</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>{extra}</div>
    </div>
  );
}

// ─── Y1 SOURCE PICKER ─────────────────────────────────────────────────
function Y1SourcePicker({source, t12Sub, onSource, onT12Sub}:{
  source:Y1Source; t12Sub:T12Sub;
  onSource:(s:Y1Source)=>void; onT12Sub:(s:T12Sub)=>void;
}) {
  const mainOptions:[Y1Source,string,string][] = [
    ["BROKER",   "B",  T.text.amber],
    ["T12",      "T12",T.text.purple],
    ["PLATFORM", "P",  T.text.cyan],
    ["RESOLVED", "✓",  T.text.green],
  ];
  const t12Subs:T12Sub[] = ["T12","T6","T3","T1"];
  const showT12Sub = source === "T12" || source === "T6" || source === "T3" || source === "T1";

  return (
    <div style={{background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.medium}`,padding:"7px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9,letterSpacing:0.6}}>Y1 SOURCE</span>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        {mainOptions.map(([s,lbl,c]) => {
          const active = (s==="T12" && (source==="T12"||source==="T6"||source==="T3"||source==="T1")) || source===s;
          return (
            <button key={s} className="src-btn"
              onClick={() => { if (s==="T12") { onSource(t12Sub); } else onSource(s); }}
              style={{background:active?`${c}22`:T.bg.input,border:`1px solid ${active?c:T.border.medium}`,color:active?c:T.text.secondary,fontFamily:T.font.mono,fontSize:10,fontWeight:active?700:500,padding:"4px 11px",letterSpacing:0.5,borderRadius:1,cursor:"pointer"}}>
              {lbl}
            </button>
          );
        })}
      </div>
      {/* T12 sub-toggle */}
      {showT12Sub && (
        <>
          <div style={{width:1,height:16,background:T.border.medium}}/>
          <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9,letterSpacing:0.5}}>PERIOD</span>
          <div style={{display:"flex",alignItems:"center",gap:3}}>
            {t12Subs.map(s => {
              const active2 = source===s;
              return (
                <button key={s} className="t-sub"
                  onClick={() => { onT12Sub(s); onSource(s); }}
                  style={{background:active2?`${T.text.purple}22`:T.bg.input,border:`1px solid ${active2?T.text.purple:T.border.subtle}`,color:active2?T.text.purple:T.text.secondary,fontFamily:T.font.mono,fontSize:9.5,fontWeight:active2?700:400,padding:"3px 8px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>
                  {s}
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:6}}>
            {source==="T12" && <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:8.5}}>Full 12-month trailing period</span>}
            {source==="T6"  && <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:8.5}}>6-month trailing · more recent signal</span>}
            {source==="T3"  && <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:8.5}}>3-month trailing · highest recency weight</span>}
            {source==="T1"  && <span style={{color:T.text.amber,fontFamily:T.font.mono,fontSize:8.5}}>⚡ Last month only · low sample · treat cautiously</span>}
          </div>
        </>
      )}
      <div style={{flex:1}}/>
      <div style={{display:"flex",alignItems:"center",gap:7,fontFamily:T.font.mono,fontSize:9,color:T.text.muted}}>
        <span>Y1 col shows</span>
        <span style={{color:{BROKER:T.text.amber,T12:T.text.purple,T6:T.text.purple,T3:T.text.purple,T1:T.text.purple,PLATFORM:T.text.cyan,RESOLVED:T.text.green}[source],fontWeight:600}}>
          {source==="RESOLVED"?"RESOLVED (auto)":source}
        </span>
        <span>values · right col mirrors for comparison</span>
      </div>
    </div>
  );
}

// ─── BULK ACTION BAR (from screenshot) ───────────────────────────────
function BulkBar() {
  return (
    <div style={{background:"#0A0C12",borderBottom:`1px solid ${T.border.subtle}`,padding:"5px 16px",display:"flex",alignItems:"center",gap:10}}>
      <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,letterSpacing:0.5}}>BULK:</span>
      <button className="bulk-btn" style={{background:T.bg.input,border:`1px solid ${T.text.cyan}55`,color:T.text.cyan,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,padding:"3px 9px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>USE ALL PLATFORM</button>
      <button className="bulk-btn" style={{background:T.bg.input,border:`1px solid ${T.text.amber}55`,color:T.text.amber,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,padding:"3px 9px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>USE ALL BROKER</button>
      <button className="bulk-btn" style={{background:T.bg.input,border:`1px solid ${T.text.purple}55`,color:T.text.purple,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,padding:"3px 9px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>USE ALL T12</button>
      <div style={{flex:1}}/>
      {/* Legend pills — match screenshot */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {[["USER",T.text.green],["FORMULA",T.text.cyan],["PLATFORM",T.text.cyan],["BROKER",T.text.amber]].map(([lbl,c]) => (
          <span key={lbl} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block"}}/>
            <span style={{color:T.text.secondary,fontFamily:T.font.mono,fontSize:9}}>{lbl}</span>
          </span>
        ))}
        <div style={{width:1,height:12,background:T.border.medium}}/>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:T.text.amber,fontFamily:T.font.mono,fontSize:9,fontWeight:700}}>▲ &gt;100bps</span>
        </span>
        <span style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:T.text.red,fontFamily:T.font.mono,fontSize:9,fontWeight:700}}>&gt;2σ outlier</span>
        </span>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────
export default function ControlCenter() {
  const [scenario, setScenario] = useState("Base");
  const [occMode, setOccMode]   = useState<OccMode>("STABILIZED");
  const [search, setSearch]     = useState("");
  const [showOvrOnly, setShowOvrOnly] = useState(false);
  const [y1Source, setY1Source] = useState<Y1Source>("RESOLVED");
  const [t12Sub, setT12Sub]     = useState<T12Sub>("T12");
  const [open, setOpen] = useState({rev:true, occ:true, opex:true, traffic:true, pass:true, exit:true});
  const tog = (k:keyof typeof open) => setOpen(s=>({...s,[k]:!s[k]}));

  const filt = (rows:ARow[]) => rows.filter(r => {
    if (showOvrOnly && !r.yrs.some(y=>y.src==="U")) return false;
    if (!search.trim()) return true;
    return r.lbl.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
  });

  const fRev = filt(REV_ROWS);
  const fOcc = filt(OCC_ROWS);
  const fOpex = filt(OPEX_ROWS);
  const fTraffic = filt(TRAFFIC_ROWS);
  const fPass = filt(PASS_ROWS);
  const fExit = filt(EXIT_ROWS);

  const srcLabel = {BROKER:"BROKER",T12:"T12",T6:"T6",T3:"T3",T1:"T1",PLATFORM:"PLATFORM",RESOLVED:"RESOLVED"}[y1Source];
  const srcColor = {BROKER:T.text.amber,T12:T.text.purple,T6:T.text.purple,T3:T.text.purple,T1:T.text.purple,PLATFORM:T.text.cyan,RESOLVED:T.text.green}[y1Source];

  return (
    <div style={{background:"#0A0E17",color:T.text.primary,fontFamily:T.font.label,minHeight:"100vh",display:"flex",flexDirection:"column",paddingBottom:52}}>
      <style>{CSS}</style>

      {/* ── DATA-FLOW BANNER ────────────────────────────────────────── */}
      <div style={{background:T.bg.banner,borderBottom:`1px solid ${T.border.medium}`,padding:"9px 16px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12,fontFamily:T.font.mono,fontSize:10.5,flexWrap:"wrap"}}>
          <button className="tab-jump" style={{background:"transparent",border:`1px solid ${T.text.cyan}55`,color:T.text.cyan,padding:"5px 11px",fontFamily:T.font.mono,fontSize:10,fontWeight:600,letterSpacing:0.5,borderRadius:1,cursor:"pointer"}}>← F9 · PRO FORMA · Y1 SOURCE</button>
          <span style={{color:T.text.muted,fontSize:13}}>━━▶</span>
          <div style={{background:`${T.text.amber}15`,border:`1px solid ${T.text.amber}`,color:T.text.amberBright,padding:"5px 13px",fontFamily:T.font.mono,fontSize:10,fontWeight:700,letterSpacing:0.6,borderRadius:1}}>ASSUMPTIONS · CONTROL CENTER</div>
          <span style={{color:T.text.muted,fontSize:13}}>━━▶</span>
          <button className="tab-jump" style={{background:"transparent",border:`1px solid ${T.text.cyan}55`,color:T.text.cyan,padding:"5px 11px",fontFamily:T.font.mono,fontSize:10,fontWeight:600,letterSpacing:0.5,borderRadius:1,cursor:"pointer"}}>F9 · PROJECTIONS</button>
          <button className="tab-jump" style={{background:"transparent",border:`1px solid ${T.text.cyan}55`,color:T.text.cyan,padding:"5px 11px",fontFamily:T.font.mono,fontSize:10,fontWeight:600,letterSpacing:0.5,borderRadius:1,cursor:"pointer"}}>F9 · RETURNS</button>
          <button className="tab-jump" style={{background:"transparent",border:`1px solid ${T.text.cyan}55`,color:T.text.cyan,padding:"5px 11px",fontFamily:T.font.mono,fontSize:10,fontWeight:600,letterSpacing:0.5,borderRadius:1,cursor:"pointer"}}>F9 · SENSITIVITIES →</button>
          <div style={{flex:1}}/>
          <span style={{color:T.text.secondary,fontFamily:T.font.mono,fontSize:9.5}}>
            <span style={{color:T.text.muted}}>DEAL · </span>
            <span style={{color:T.text.amberBright,fontWeight:600}}>WSC-248</span>
            <span style={{color:T.text.muted}}> · Westshore Commons · 248u · Tampa FL</span>
          </span>
        </div>
      </div>

      {/* ── CONTROL BAR ─────────────────────────────────────────────── */}
      <div style={{background:T.bg.panel,borderBottom:`1px solid ${T.border.medium}`,padding:"8px 16px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",flexShrink:0}}>
        {/* Scenario */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9,letterSpacing:0.5}}>SCENARIO</span>
          {["Base","Upside","Downside","Stress","Lender View"].map(s => {
            const a = s===scenario;
            return <button key={s} className="scn" onClick={()=>setScenario(s)} style={{background:a?T.bg.active:T.bg.input,border:`1px solid ${a?T.text.amber:T.border.medium}`,color:a?T.text.amberBright:T.text.secondary,fontFamily:T.font.mono,fontSize:9.5,fontWeight:a?700:500,padding:"3px 9px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>{s}</button>;
          })}
          <button className="action-btn" style={{background:"transparent",border:`1px dashed ${T.border.medium}`,color:T.text.muted,fontFamily:T.font.mono,fontSize:9.5,padding:"3px 7px",borderRadius:1,cursor:"pointer"}}>+ NEW</button>
        </div>
        <div style={{width:1,height:16,background:T.border.medium}}/>
        {/* Counters */}
        <div style={{display:"flex",alignItems:"center",gap:14,fontFamily:T.font.mono,fontSize:10}}>
          <span><span style={{color:T.text.muted}}>TOTAL </span><span style={{color:T.text.primary,fontWeight:700}}>42</span></span>
          <span><span style={{color:T.text.muted}}>OVERRIDDEN </span><span style={{color:T.text.green,fontWeight:700}}>9</span></span>
          <span><span style={{color:T.text.muted}}>COLLISIONS </span><span style={{color:T.text.amber,fontWeight:700}}>4</span></span>
          <span><span style={{color:T.text.muted}}>LOCKED </span><span style={{color:T.text.secondary,fontWeight:700}}>3</span></span>
        </div>
        <div style={{width:1,height:16,background:T.border.medium}}/>
        {/* Search */}
        <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:200}}>
          <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:10}}>⌕</span>
          <input className="f9inp" value={search} onChange={e=>setSearch(e.target.value)} placeholder="search assumptions…"
            style={{flex:1,background:T.bg.input,border:`1px solid ${T.border.subtle}`,color:T.text.primary,fontFamily:T.font.mono,fontSize:10.5,padding:"4px 8px",letterSpacing:0.3,borderRadius:1,outline:"none"}}/>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:5,fontFamily:T.font.mono,fontSize:9.5,color:T.text.secondary,cursor:"pointer"}}>
          <input type="checkbox" checked={showOvrOnly} onChange={e=>setShowOvrOnly(e.target.checked)} style={{accentColor:T.text.green}}/>
          OVERRIDES ONLY
        </label>
        <button className="action-btn" style={{background:"transparent",border:`1px solid ${T.text.red}55`,color:T.text.red,fontFamily:T.font.mono,fontSize:9.5,fontWeight:600,padding:"4px 9px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>RESET ALL</button>
        <button className="action-btn" style={{background:T.text.amber,border:`1px solid ${T.text.amber}`,color:"#0A0E17",fontFamily:T.font.mono,fontSize:10,fontWeight:700,padding:"5px 12px",letterSpacing:0.6,borderRadius:1,cursor:"pointer"}}>PUSH → PROJECTIONS</button>
      </div>

      {/* ── Y1 SOURCE PICKER ────────────────────────────────────────── */}
      <Y1SourcePicker source={y1Source} t12Sub={t12Sub} onSource={s=>setY1Source(s)} onT12Sub={s=>setT12Sub(s)} />

      {/* ── BULK ACTION BAR ─────────────────────────────────────────── */}
      <BulkBar />

      {/* ── LEGEND ──────────────────────────────────────────────────── */}
      <div style={{background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,padding:"5px 16px",display:"flex",alignItems:"center",gap:14,fontFamily:T.font.mono,fontSize:9,flexWrap:"wrap",flexShrink:0}}>
        <span style={{color:T.text.muted,letterSpacing:0.5}}>SOURCE PILLS</span>
        {(["PF","P","U","B","T12","RR","M07","CALC"] as const).map(k => (
          <span key={k} style={{display:"flex",alignItems:"center",gap:4}}><SrcPill k={k}/><span style={{color:T.text.secondary}}>{SRC[k].name.split(" · ")[0]}</span></span>
        ))}
        <div style={{width:1,height:12,background:T.border.medium}}/>
        <span style={{color:T.text.muted,letterSpacing:0.5}}>CONFIDENCE</span>
        {(["H","M","L"] as const).map(k => (
          <span key={k} style={{display:"flex",alignItems:"center",gap:4}}><ConfDots k={k}/><span style={{color:T.text.secondary}}>{CONF[k].name}</span></span>
        ))}
        <div style={{flex:1}}/>
        <span style={{color:T.text.muted,fontSize:8.5}}>
          Y1 viewing: <span style={{color:srcColor,fontWeight:600}}>{srcLabel}</span>
          {" · "}last edit: rent_growth · Y1 · <span style={{color:T.text.green}}>3.1% → 3.4%</span> · Leon @ 14:23
        </span>
      </div>

      {/* ── SCROLLABLE SECTIONS ──────────────────────────────────────── */}
      <div style={{flex:1,overflowY:"auto"}}>

        {/* 01 · REVENUE DRIVERS */}
        <SecHdr idx="01" title="REVENUE DRIVERS" count={fRev.length} ovr={1} coll={1} expanded={open.rev} onToggle={()=>tog("rev")}/>
        {open.rev && fRev.length>0 && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <TableHead />
              <tbody>{fRev.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
            </table>
          </div>
        )}

        {/* 02 · OCCUPANCY & CONCESSIONS */}
        <SecHdr idx="02" title="OCCUPANCY & CONCESSIONS" count={fOcc.length} ovr={4} coll={2} expanded={open.occ} onToggle={()=>tog("occ")}
          extra={
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9,letterSpacing:0.5}}>MODE</span>
              {(["STABILIZED","LEASE-UP","REDEVELOPMENT"] as OccMode[]).map(m => {
                const a=m===occMode;
                return <button key={m} className="mode-pill" onClick={()=>setOccMode(m)} style={{background:a?`${T.text.amber}22`:T.bg.input,border:`1px solid ${a?T.text.amber:T.border.medium}`,color:a?T.text.amberBright:T.text.secondary,fontFamily:T.font.mono,fontSize:9,fontWeight:a?700:500,padding:"3px 8px",letterSpacing:0.4,borderRadius:1,cursor:"pointer"}}>{m}</button>;
              })}
            </div>
          }/>
        {open.occ && (
          <>
            <div style={{padding:"6px 16px",background:`${T.text.amber}08`,borderBottom:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center",gap:10,fontFamily:T.font.mono,fontSize:10}}>
              <span style={{color:T.text.amberBright,fontWeight:700,letterSpacing:0.5}}>{occMode}</span>
              <span style={{color:T.text.secondary}}>
                {occMode==="STABILIZED" && "· curve-based · physical occ ramps to stabilized target by Y3"}
                {occMode==="LEASE-UP"   && "· M07 absorption pull · phys_occ row replaced by M07 absorption curve · pre-leased % editable below"}
                {occMode==="REDEVELOPMENT" && "· hybrid · down-unit schedule + re-lease pace rows · concession burn-off extended"}
              </span>
            </div>
            {fOcc.length>0 && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <TableHead />
                  <tbody>{fOcc.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
                </table>
              </div>
            )}
            {/* EGI drag strip */}
            <div style={{padding:"8px 16px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.medium}`,display:"flex",alignItems:"center",gap:22,fontFamily:T.font.mono,fontSize:10}}>
              <span style={{color:T.text.muted,letterSpacing:0.4}}>OCC + CONCESSION DRAG · EGI vs GPR</span>
              {[["Y1","−13.6%",T.text.red],["Y2","−10.3%",T.text.red],["Y3","−7.9%",T.text.amber],["Y4","−7.4%",T.text.amber],["Y5","−7.4%",T.text.amber]].map(([yr,val,c])=>(
                <span key={yr}><span style={{color:T.text.muted}}>{yr} </span><span style={{color:c,fontWeight:700}}>{val}</span></span>
              ))}
              <div style={{flex:1}}/>
              <span style={{color:T.text.green,fontSize:9.5}}>vs broker −2.0% Y1 stabilized · ~$340K cumulative delta</span>
            </div>
          </>
        )}

        {/* 03 · OPERATING EXPENSE DRIVERS */}
        <SecHdr idx="03" title="OPERATING EXPENSE DRIVERS" count={fOpex.length} ovr={1} coll={1} expanded={open.opex} onToggle={()=>tog("opex")}/>
        {open.opex && fOpex.length>0 && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <TableHead />
              <tbody>{fOpex.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
            </table>
          </div>
        )}

        {/* 04 · TRAFFIC & ABSORPTION — moved from Projections */}
        <SecHdr idx="04" title="TRAFFIC & ABSORPTION  ·  M07 ENGINE" count={fTraffic.length} ovr={1} coll={1} expanded={open.traffic} onToggle={()=>tog("traffic")}
          extra={
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <span style={{padding:"2px 7px",background:`${T.text.orange}18`,border:`1px solid ${T.text.orange}55`,color:T.text.orange,fontFamily:T.font.mono,fontSize:9,fontWeight:700,letterSpacing:0.5,borderRadius:1}}>M07 LIVE</span>
              <span style={{color:T.text.muted,fontFamily:T.font.mono,fontSize:9}}>⟵ MOVED FROM PROJECTIONS TAB</span>
            </div>
          }/>
        {open.traffic && (
          <>
            <div style={{padding:"6px 16px",background:`${T.text.orange}08`,borderBottom:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center",gap:12,fontFamily:T.font.mono,fontSize:9.5}}>
              <span style={{color:T.text.orange,fontWeight:700}}>M07 TRAFFIC ENGINE</span>
              <span style={{color:T.text.secondary}}>· live signals feed occupancy ramp, concession burn-off, and lease-up timeline · signals shown here as assumption inputs that flow to Projections</span>
              <div style={{flex:1}}/>
              <span style={{color:T.text.muted}}>confidence:</span>
              <span style={{color:T.text.green,fontWeight:700}}>HIGH ●●●</span>
              <span style={{color:T.text.muted}}>· last updated: 14:02</span>
            </div>
            {fTraffic.length>0 && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <TableHead />
                  <tbody>{fTraffic.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 05 · PASSTHROUGH */}
        <SecHdr idx="05" title="PASSTHROUGH · CALCULATED ON DEDICATED TABS" count={fPass.length} ovr={0} coll={0} expanded={open.pass} onToggle={()=>tog("pass")}/>
        {open.pass && (
          <>
            <div style={{padding:"5px 16px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,color:T.text.muted,fontFamily:T.font.mono,fontSize:9,letterSpacing:0.4}}>
              ▸ computed on F9 Taxes / F9 Debt · displayed here for projection-stack visibility · click tab badge to navigate and edit
            </div>
            {fPass.length>0 && (
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <TableHead />
                  <tbody>{fPass.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* 06 · EXIT METHOD */}
        <SecHdr idx="06" title="EXIT METHOD" count={fExit.length} ovr={1} coll={1} expanded={open.exit} onToggle={()=>tog("exit")}/>
        {open.exit && fExit.length>0 && (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <TableHead />
              <tbody>{fExit.map((r,i)=><ARowComp key={r.id} row={r} dim={i%2===1} source={y1Source}/>)}</tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {[fRev,fOcc,fOpex,fTraffic,fPass,fExit].every(a=>a.length===0) && (
          <div style={{padding:40,textAlign:"center",color:T.text.muted,fontFamily:T.font.mono,fontSize:11}}>
            No assumptions match "{search}"
          </div>
        )}
      </div>

      {/* ── STICKY FOOTER ───────────────────────────────────────────── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:T.bg.banner,borderTop:`1px solid ${T.border.medium}`,padding:"6px 16px",display:"flex",alignItems:"center",gap:14,fontFamily:T.font.mono,fontSize:10,zIndex:20}}>
        <span style={{color:T.text.green,fontWeight:700}}>● LIVE</span>
        <span style={{color:T.text.muted}}>downstream →</span>
        {["Projections","Returns","Sensitivities","Sources & Uses"].map(d=>(
          <span key={d} className="tab-jump" style={{color:T.text.cyan,cursor:"pointer"}}>{d}</span>
        ))}
        <div style={{flex:1}}/>
        <span style={{color:T.text.muted}}>scenario · </span>
        <span style={{color:T.text.amberBright,fontWeight:700}}>{scenario}</span>
        <span style={{color:T.text.muted}}> · occ · </span>
        <span style={{color:T.text.amberBright,fontWeight:700}}>{occMode}</span>
        <span style={{color:T.text.muted}}> · Y1 src · </span>
        <span style={{color:srcColor,fontWeight:700}}>{srcLabel}</span>
        <span style={{color:T.text.green,marginLeft:8}}>9 overrides active</span>
      </div>
    </div>
  );
}
