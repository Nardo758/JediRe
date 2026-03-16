import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// JEDI RE — BLOOMBERG TERMINAL PROTOTYPE  v2
// Task #66: header resize · 8-tab nav · 4-tab bottom feeds
//           global filters · dashboard picker · dark/light
// ═══════════════════════════════════════════════════════════════

// ─── TOKEN SYSTEM ────────────────────────────────────────────
const DARK = {
  bg: { terminal:"#0A0E17", panel:"#0F1319", panelAlt:"#131821", header:"#1A1F2E", hover:"#1E2538", active:"#252D40", input:"#0D1117", topBar:"#050810" },
  text: { primary:"#E8ECF1", secondary:"#8B95A5", muted:"#4A5568", amber:"#F5A623", amberBright:"#FFD166", green:"#00D26A", red:"#FF4757", cyan:"#00BCD4", orange:"#FF8C42", purple:"#A78BFA", white:"#FFFFFF" },
  border: { subtle:"#1E2538", medium:"#2A3348", bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace", display:"'IBM Plex Mono',monospace", label:"'IBM Plex Sans',sans-serif" },
};
const LIGHT = {
  bg: { terminal:"#F0F4F8", panel:"#FFFFFF", panelAlt:"#F8FAFC", header:"#E8ECF1", hover:"#EFF6FF", active:"#DBEAFE", input:"#F1F5F9", topBar:"#1A1F2E" },
  text: { primary:"#1E293B", secondary:"#475569", muted:"#94A3B8", amber:"#D97706", amberBright:"#B45309", green:"#059669", red:"#DC2626", cyan:"#0891B2", orange:"#EA580C", purple:"#7C3AED", white:"#FFFFFF" },
  border: { subtle:"#E2E8F0", medium:"#CBD5E1", bright:"#94A3B8" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace", display:"'IBM Plex Mono',monospace", label:"'IBM Plex Sans',sans-serif" },
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes glow{0%,100%{box-shadow:0 0 4px #00D26A44}50%{box-shadow:0 0 10px #00D26A66}}
@keyframes glowR{0%,100%{box-shadow:0 0 4px #FF475744}50%{box-shadow:0 0 10px #FF475766}}
@keyframes flash{0%{background:transparent}15%{background:#F5A62322}100%{background:transparent}}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
*{scrollbar-width:thin;scrollbar-color:#2A3348 #0A0E17}
*::-webkit-scrollbar{width:5px;height:5px}
*::-webkit-scrollbar-track{background:#0A0E17}
*::-webkit-scrollbar-thumb{background:#2A3348}
`;

// ─── STATIC DATA ─────────────────────────────────────────────
const DEALS = [
  {id:1,name:"Westshore Commons",addr:"4201 W Boy Scout Blvd",market:"Tampa, FL",sub:"Westshore",score:82,delta:"+4",strat:"BTS",irr:"24.3%",em:"2.8x",units:248,price:"$38.5M",ppu:"$155K",stage:"DD",days:23,risk:"LOW",rs:32,trend:[72,74,73,76,78,77,79,80,82]},
  {id:2,name:"Nocatee Parcels",addr:"Parcel 7-A Nocatee Pkwy",market:"Jacksonville, FL",sub:"Nocatee",score:88,delta:"+7",strat:"BTS",irr:"28.1%",em:"3.2x",units:0,price:"$4.2M",ppu:"LAND",stage:"LOI",days:11,risk:"LOW",rs:24,trend:[71,73,76,78,80,82,84,86,88]},
  {id:3,name:"Dadeland Station",addr:"8200 SW 72nd Ave",market:"Miami, FL",sub:"Dadeland",score:76,delta:"+2",strat:"RENTAL",irr:"18.7%",em:"2.1x",units:312,price:"$62.4M",ppu:"$200K",stage:"DD",days:34,risk:"MED",rs:54,trend:[70,71,72,72,73,74,75,75,76]},
  {id:4,name:"Colonial Crossings",addr:"3400 Colonial Dr",market:"Orlando, FL",sub:"Colonial Town",score:71,delta:"-1",strat:"FLIP",irr:"21.5%",em:"1.6x",units:180,price:"$24.8M",ppu:"$138K",stage:"PROSPECT",days:8,risk:"MED",rs:48,trend:[68,70,72,73,74,73,72,72,71]},
  {id:5,name:"Riverview Preserve",addr:"11502 Boyette Rd",market:"Tampa, FL",sub:"Riverview",score:79,delta:"+3",strat:"BTS",irr:"22.8%",em:"2.5x",units:0,price:"$2.8M",ppu:"LAND",stage:"LOI",days:5,risk:"LOW",rs:28,trend:[70,72,73,75,76,77,78,78,79]},
  {id:6,name:"Ybor Mixed-Use",addr:"1901 N 13th St",market:"Tampa, FL",sub:"Ybor City",score:54,delta:"-3",strat:"STR",irr:"12.4%",em:"1.3x",units:42,price:"$8.6M",ppu:"$205K",stage:"LEAD",days:2,risk:"HIGH",rs:78,trend:[62,60,59,58,57,56,55,55,54]},
  {id:7,name:"Kendall Commons",addr:"12000 SW 127th Ave",market:"Miami, FL",sub:"Kendall",score:68,delta:"0",strat:"RENTAL",irr:"16.2%",em:"1.9x",units:224,price:"$44.8M",ppu:"$200K",stage:"PROSPECT",days:15,risk:"MED",rs:52,trend:[67,68,68,67,68,69,68,68,68]},
  {id:8,name:"Celebration South",addr:"Parcel 9 Celebration Blvd",market:"Orlando, FL",sub:"Celebration",score:85,delta:"+5",strat:"BTS",irr:"26.4%",em:"3.0x",units:0,price:"$6.1M",ppu:"LAND",stage:"DD",days:18,risk:"LOW",rs:22,trend:[74,76,77,79,80,81,83,84,85]},
];

const ALERTS = [
  {type:"ARBITRAGE",sev:"critical",msg:"Nocatee Parcels: BTS outscores Rental by 22pts, zoning 18 DU/ac",deal:"Nocatee Parcels",time:"10m"},
  {type:"RISK",sev:"high",msg:"Ybor Mixed-Use: Insurance risk 78 (+4), wind zone + STR uncertainty",deal:"Ybor Mixed-Use",time:"34m"},
  {type:"SCORE",sev:"med",msg:"Celebration South crossed 85, Strong Opportunity threshold",deal:"Celebration South",time:"1h"},
  {type:"DEADLINE",sev:"high",msg:"Dadeland Station DD expires 9 days, 3 inspections outstanding",deal:"Dadeland Station",time:"2h"},
  {type:"MARKET",sev:"low",msg:"Tampa MSA absorption exceeded 95% for 2nd consecutive month",deal:null as string|null,time:"3h"},
];

const NEWS = [
  {time:"14:23",hl:"Amazon announces 2,000-job Tampa HQ expansion",impact:"+DEMAND",pts:"+3.2",tag:"JOBS",affects:["Westshore Commons"]},
  {time:"13:41",hl:"Greystar breaks ground 380-unit tower Downtown Tampa",impact:"+SUPPLY",pts:"-1.8",tag:"SUPPLY",affects:[] as string[]},
  {time:"11:15",hl:"FL Legislature passes insurance reform, 8% rate cap",impact:"RISK DN",pts:"+1.2",tag:"REG",affects:["ALL FL"]},
  {time:"09:32",hl:"Nocatee named #2 top-selling MPC nationally",impact:"+DEMAND",pts:"+2.4",tag:"DEMAND",affects:["Nocatee Parcels"]},
  {time:"YST",hl:"Miami-Dade condo reserve law triggers $2.1B assessments",impact:"+DEMAND",pts:"+0.8",tag:"REG",affects:["Dadeland Station"]},
  {time:"YST",hl:"Colonial Dr BRT Phase 1 funded",impact:"+POSITION",pts:"+1.5",tag:"INFRA",affects:["Colonial Crossings"]},
];

const EMAILS = [
  {id:1,from:"Marcus Chen",org:"CBRE Capital Markets",subject:"Westshore Commons — LOI countersigned",preview:"James, good news — seller's counsel returned the countersigned LOI...",body:"James,\n\nGood news — seller's counsel returned the countersigned LOI this afternoon. We are officially under contract. Next steps: wire $250K earnest money by Friday EOD, schedule Phase I for next week, and confirm your DD team roster by tomorrow morning. I'll coordinate the title company intro.\n\nLet me know if you need anything from our side.\n\nBest,\nMarcus Chen\nCBRE Capital Markets",time:"2h",date:"Today 11:42 AM",deal:"Westshore Commons",unread:true,folder:"inbox",tag:"LOI"},
  {id:2,from:"Sarah Kim",org:"JLL Brokerage",subject:"Nocatee Parcels: competing offer received",preview:"Heads up — the seller just informed me there's a competing offer...",body:"James,\n\nHeads up — the seller just informed me there's a competing offer on Nocatee Parcel 7-A. Competing group is out of Atlanta, all-cash, 21-day close. Their number is reportedly $4.6M vs your $4.2M LOI.\n\nSeller wants best-and-final by this Friday at 5pm ET. I strongly recommend you go to $4.5M and shorten your inspection to 14 days. Demand is real here — Nocatee absorption is tracking 42% above projections.\n\nCall me when you can.\n\nSarah Kim\nJLL Brokerage — Jacksonville",time:"3h",date:"Today 10:18 AM",deal:"Nocatee Parcels",unread:true,folder:"inbox",tag:"URGENT"},
  {id:3,from:"Deal Engine",org:"JediRe System",subject:"Dadeland Station — DD checklist: 3 items outstanding",preview:"Automated reminder: 3 due diligence items remain open with...",body:"AUTOMATED — DEAL ENGINE\n\nDadeland Station — Due Diligence Status\n──────────────────────────────────────\nDD Expires: 9 days remaining\n\nOUTSTANDING ITEMS:\n① Phase II Environmental — report pending (Terracon, ETA 6 days)\n② Structural Engineering Inspection — not yet scheduled\n③ Rent Roll Estoppels — 14 of 17 returned; 3 pending (units 204, 311, 408)\n\nCOMPLETED: Title, Survey, Zoning, Financial Audit, Insurance Review\n\nRecommendation: Schedule structural inspection immediately to avoid DD expiry risk.\n\n— JediRe Deal Engine",time:"5h",date:"Today 8:05 AM",deal:"Dadeland Station",unread:true,folder:"inbox",tag:"DD"},
  {id:4,from:"Michael Torres",org:"JP Morgan RE Debt",subject:"Term sheet: $28.8M senior, SOFR+275",preview:"Please find attached the executed term sheet for Westshore Commons...",body:"James,\n\nPlease find attached the executed term sheet for Westshore Commons senior construction financing.\n\nHighlights:\n• Loan Amount: $28.8M (75% LTC)\n• Rate: SOFR + 275bps (currently ~8.05% all-in)\n• Term: 24 months + two 6-month extensions\n• Recourse: Non-recourse with carve-outs\n• Origination: 1.0pt\n• Required Equity: $9.6M (confirmed via equity stack)\n\nWe need executed term sheet back by next Wednesday to hold pricing. Rate lock available at funding.\n\nMichael Torres\nJP Morgan Real Estate Debt",time:"1d",date:"Yesterday 3:14 PM",deal:"Westshore Commons",unread:false,folder:"inbox",tag:"DEBT"},
  {id:5,from:"City of Tampa",org:"Planning & Development",subject:"Re: Zoning pre-application, Boyette Rd parcel",preview:"Thank you for your pre-application submission. Staff has reviewed...",body:"Dear Mr. Dixon,\n\nThank you for your pre-application submission for the Boyette Rd parcel (Folio #12-34-567-89). Planning staff has completed initial review.\n\nThe parcel is currently zoned RSC-6. Your proposed 5-story BTS multifamily at 18 DU/ac is consistent with the adopted FLU designation. A formal Rezoning to PD is recommended to allow height flexibility.\n\nNext Steps:\n• Submit Rezoning application — $4,200 fee\n• Neighborhood meeting required (min. 30 days prior to hearing)\n• Estimated hearing date: Q3 2026\n\nOur office is available Tuesday/Thursday for pre-app consultations.\n\nCity of Tampa — Planning & Development",time:"1d",date:"Yesterday 1:30 PM",deal:"Riverview Preserve",unread:false,folder:"inbox",tag:"ZONING"},
  {id:6,from:"Amanda Ross",org:"Terracon Consultants",subject:"Phase I ESA — Westshore Commons (draft)",preview:"Draft Phase I ESA attached for your review. No RECs identified...",body:"James,\n\nDraft Phase I ESA is attached for your review and comment.\n\nExecutive Summary:\n• No Recognized Environmental Conditions (RECs) identified\n• Historical use: light commercial since 1962, no petroleum or hazardous materials\n• ASTM E1527-21 compliant\n• Recommended: No Phase II warranted\n\nPlease review and confirm if you'd like any additional scope (vapor, asbestos survey, etc.) before we finalize. Final report turnaround 3 business days after your go-ahead.\n\nAmanda Ross\nTerracon Consultants",time:"2d",date:"Mar 14 9:22 AM",deal:"Westshore Commons",unread:false,folder:"inbox",tag:"DD"},
  {id:7,from:"LP Investors",org:"Capital Group",subject:"Q1 2026 reporting — when can we expect the package?",preview:"Hi James, the Q1 close is approaching and our board is asking...",body:"Hi James,\n\nThe Q1 close is approaching and our board is asking about the portfolio reporting package. Can you give us a timeline? We'll need:\n\n① Updated NAV and performance vs. underwriting\n② Capital account statements for each LP\n③ Market commentary for Tampa and Jacksonville\n④ Forward outlook on exit timelines\n\nWe're happy with portfolio performance — just want to stay on top of the LP obligations. Let us know if you need anything from our side.\n\nBest,\nLP Capital Group",time:"2d",date:"Mar 14 8:00 AM",deal:null,unread:false,folder:"inbox",tag:"LP"},
  {id:8,from:"Deal Engine",org:"JediRe System",subject:"Score alert: Celebration South crossed 85 threshold",preview:"Celebration South (Orlando) JEDI Score increased from 83 to 85...",body:"AUTOMATED — DEAL ENGINE ALERT\n\nCelebration South (Parcel 9, Celebration Blvd, Orlando)\nJEDI Score: 83 → 85 (+2pts)\nThreshold: STRONG_OPPORTUNITY (≥85) ✓\n\nTrigger factors:\n• Osceola County absorption upgraded to 91% (+4pts demand)\n• Celebration MPC ranked #1 top-selling community FL (Q1 2026)\n• BTS IRR model updated: 26.4% (+0.8pts from rate assumption)\n\nRecommended action: Advance to full DD authorization. Score trajectory is positive.\n\n— JediRe Deal Engine",time:"3d",date:"Mar 13 4:45 PM",deal:"Celebration South",unread:false,folder:"inbox",tag:"SCORE"},
];

const AGENTS = [
  {id:"A01",name:"Data Collector",st:"ON",act:"Scraped 47 comps Apartments.com, Tampa",t:"2s",m:142},
  {id:"A03",name:"Zoning Agent",st:"ON",act:"Parsed Municode 27-156 setback, Nocatee",t:"8s",m:38},
  {id:"A05",name:"Market Analyst",st:"ON",act:"Updated Tampa absorption 95.2%",t:"34s",m:87},
  {id:"A07",name:"Risk Scorer",st:"ON",act:"Recalculated Ybor insurance 78 (+4)",t:"1m",m:64},
  {id:"A08",name:"Strategy Engine",st:"IDLE",act:"Awaiting new intake",t:"4m",m:23},
  {id:"A10",name:"Orchestrator",st:"ON",act:"Coordinating DD checklist, Dadeland",t:"12s",m:312},
];

const MARKET_VITALS = [
  {label:"Avg Effective Rent",value:"$1,908",sub:"/mo",change:"+3.0%",period:"90d",dir:"up"},
  {label:"Vacancy Rate",value:"8.5",sub:"%",change:"-0.8%",period:"12wk",dir:"down"},
  {label:"Avg Absorbed Units",value:"11,658",sub:" units",change:"steady",period:"wkly",dir:"flat"},
  {label:"Rent Growth Trend",value:"+3.0",sub:"%",change:"Accelerating",period:"",dir:"up"},
  {label:"Submarket Strength",value:"40th",sub:" pctl",change:"Below median",period:"",dir:"down"},
];

const SUBMARKETS = [
  {name:"Midtown",props:52,units:"14,856",rent:"$2,056",vac:"10.1%",growth:"+3.0%",opp:"6.0/10",pressure:"seller"},
  {name:"East Atlanta",props:23,units:"6,789",rent:"$2,031",vac:"15.4%",growth:"-0.6%",opp:"6.2/10",pressure:"seller"},
  {name:"West End",props:53,units:"5,924",rent:"$1,977",vac:"10.5%",growth:"+1.2%",opp:"7.9/10",pressure:"buyer"},
  {name:"Buckhead",props:39,units:"14,338",rent:"$1,883",vac:"9.8%",growth:"-0.5%",opp:"9.0/10",pressure:"buyer"},
  {name:"Downtown",props:35,units:"8,473",rent:"$1,542",vac:"6.9%",growth:"+0.6%",opp:"5.1/10",pressure:"buyer"},
];

const PORTFOLIO_NAV = [
  {key:"F1",label:"DASHBOARD"},
  {key:"F2",label:"PIPELINE"},
  {key:"F3",label:"PORTFOLIO"},
  {key:"F4",label:"MARKETS"},
  {key:"F5",label:"EMAIL"},
  {key:"F6",label:"COMPETE"},
  {key:"F7",label:"STRATEGIES"},
  {key:"F8",label:"TOOLS"},
];

const DEAL_NAV = [
  {key:"F1",label:"OVERVIEW",m:"M01"},{key:"F2",label:"PROPERTY",m:"M02"},{key:"F3",label:"MARKET",m:"M05"},
  {key:"F4",label:"SUPPLY",m:"M04"},{key:"F5",label:"STRATEGY",m:"M08"},{key:"F6",label:"PROFORMA",m:"M09"},
  {key:"F7",label:"CAPITAL",m:"M11"},{key:"F8",label:"RISK",m:"M14"},{key:"F9",label:"COMPS",m:"M15"},
  {key:"F10",label:"TRAFFIC",m:"M07"},{key:"F11",label:"DOCS",m:"M18"},{key:"F12",label:"EXIT",m:"M20"},
];

const WIDGET_CATALOG = [
  // ── DEALS ──
  {id:"pipeline",   label:"Deal Pipeline",          desc:"Live scrollable deal list with JEDI scores",             category:"DEALS",    color:"#F5A623"},
  {id:"mydeals",    label:"My Deals",                desc:"Personal deal ownership, stage and status",             category:"DEALS",    color:"#00BCD4"},
  {id:"kpi",        label:"KPI Summary",             desc:"Pipeline value, active deals, portfolio metrics",        category:"DEALS",    color:"#FFD166"},
  {id:"leaderboard",label:"Score Leaderboard",       desc:"Deals ranked by JEDI score with trend lines",           category:"DEALS",    color:"#00D26A"},
  {id:"funnel",     label:"Stage Funnel",            desc:"DD / LOI / PROSPECT / LEAD deal counts",                category:"DEALS",    color:"#F5A623"},
  {id:"calendar",   label:"Deal Calendar",           desc:"Upcoming DD expiries, closings and deadlines",          category:"DEALS",    color:"#FF8C42"},
  // ── INTEL ──
  {id:"findings",   label:"Key Findings",            desc:"AI-generated insights from News Intelligence",          category:"INTEL",    color:"#F5A623"},
  {id:"alerts",     label:"Alert Feed",              desc:"Critical and high-priority deal alerts",                category:"INTEL",    color:"#FF4757"},
  {id:"competitor", label:"Competitor Intelligence", desc:"Recent competitor closings and off-market activity",    category:"INTEL",    color:"#FF8C42"},
  {id:"aibrief",    label:"AI Daily Brief",          desc:"AI morning market summary and recommendations",         category:"INTEL",    color:"#00D26A"},
  // ── MARKET ──
  {id:"vitals",     label:"Market Vitals",           desc:"Absorption, vacancy, and rent growth by market",        category:"MARKET",   color:"#00BCD4"},
  {id:"rates",      label:"Interest Rate Monitor",   desc:"SOFR, Fed Funds, Prime, 10Y Treasury with trends",     category:"MARKET",   color:"#00BCD4"},
  {id:"yieldcurve", label:"Treasury Yield Curve",    desc:"T-bill through 30Y yield curve chart",                 category:"MARKET",   color:"#A78BFA"},
  {id:"caprates",   label:"Cap Rate Tracker",        desc:"Cap rates by asset class and market",                  category:"MARKET",   color:"#A78BFA"},
  {id:"reits",      label:"REIT Market Watch",       desc:"Apartment, industrial and office REIT prices",         category:"MARKET",   color:"#00D26A"},
  {id:"macro",      label:"Macro Indicators",        desc:"GDP, CPI, unemployment, housing starts",               category:"MARKET",   color:"#FF4757"},
  {id:"debt",       label:"Debt Market Monitor",     desc:"CMBS spreads, agency rates, life company debt",        category:"MARKET",   color:"#A78BFA"},
  // ── OPERATIONS ──
  {id:"strategy",   label:"Strategy Snapshot",       desc:"BTS / RENTAL / FLIP / STR performance breakdown",      category:"OPS",      color:"#A78BFA"},
  {id:"agents",     label:"Agent Activity",          desc:"Live status of all AI agents running",                 category:"OPS",      color:"#00D26A"},
  {id:"tv",         label:"TV / Media",              desc:"Live business news channel selector",                  category:"MEDIA",    color:"#FF8C42"},
];

const MAP_TYPES = [
  {id:"warmaps",label:"War Maps",color:"#00D26A"},
  {id:"companalysis",label:"Comp Analysis",color:"#A78BFA"},
  {id:"brokerintel",label:"Broker Intel",color:"#FF8C42"},
  {id:"marketheat",label:"Market Heat",color:"#00BCD4"},
];

const tickers = ["^ TAMPA CAP 5.2% (-15bps)","* MIAMI ABS 94.7%","v ORL PIPELINE +2400","^ JAX EMPL +3.2%","* FL HOME $412K","^ RENT TPA +3.7%","* FDOT I-275 148.2K","v INS +18% YoY","^ NOCATEE +42%","* TPA JOBS #3"];

// ─── UTILITY COMPONENTS ──────────────────────────────────────
type ThemeType = typeof DARK;

function Spark({data,color,w=56,h=16}:{data:number[];color:string;w?:number;h?:number}) {
  const mx=Math.max(...data),mn=Math.min(...data),r=mx-mn||1;
  const p=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/r)*h}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={p} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}

function Bd({children,c,bg,b}:{children:React.ReactNode;c:string;bg?:string;b?:string}) {
  return <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,fontWeight:700,color:c,background:bg||c+"18",border:`1px solid ${b||c+"33"}`,padding:"1px 5px",letterSpacing:0.5,textTransform:"uppercase" as const,whiteSpace:"nowrap"}}>{children}</span>;
}

function StageBd({stage,T}:{stage:string;T:ThemeType}) {
  const m:Record<string,string>={DD:T.text.cyan,LOI:T.text.amber,PROSPECT:T.text.secondary,LEAD:T.text.muted};
  return <Bd c={m[stage]||T.text.muted}>{stage}</Bd>;
}

function StratBd({s,T}:{s:string;T:ThemeType}) {
  return <Bd c={T.text.purple}>^ {s}</Bd>;
}

function RiskDot({level,T}:{level:string;T:ThemeType}) {
  const c=level==="HIGH"?T.text.red:level==="MED"?T.text.orange:T.text.green;
  return <span style={{display:"flex",alignItems:"center",gap:3,fontSize:8,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:c}}><span style={{width:5,height:5,borderRadius:"50%",background:c,...(level==="HIGH"?{animation:"glowR 2s infinite"}:{})}}/>{level}</span>;
}

function PanelHeader({title,subtitle,right,borderColor,T}:{title:string;subtitle?:string;right?:React.ReactNode;borderColor?:string;T:ThemeType}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,borderTop:borderColor?`2px solid ${borderColor}`:"none",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.8}}>{title}</span>
        {subtitle&&<span style={{fontSize:8,color:T.text.secondary}}>{subtitle}</span>}
      </div>
      {right&&<div style={{display:"flex",alignItems:"center",gap:6}}>{right}</div>}
    </div>
  );
}

function MetricBox({label,value,sub,change,dir,T}:{label:string;value:string;sub:string;change:string;dir:string;T:ThemeType}) {
  return (
    <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"8px 10px",flex:1}}>
      <div style={{fontSize:8,color:T.text.muted,letterSpacing:1,fontWeight:600,marginBottom:4}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:2}}>
        <span style={{fontSize:18,fontWeight:800,color:T.text.amber}}>{value}</span>
        <span style={{fontSize:10,color:T.text.secondary}}>{sub}</span>
      </div>
      <div style={{fontSize:8,color:dir==="up"?T.text.green:dir==="down"?T.text.red:T.text.secondary,marginTop:2,fontWeight:600}}>{change}</div>
      <Spark data={[3,4,3,5,4,6,5,7,8]} color={dir==="up"?T.text.green:dir==="down"?T.text.red:T.text.amber} w={80} h={12}/>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────
type Deal = typeof DEALS[0];

export function TerminalPrototype() {
  const [theme,setTheme] = useState<"dark"|"light">(() => (localStorage.getItem("jedi-theme")||"dark") as "dark"|"light");
  const T = theme==="dark" ? DARK : LIGHT;

  const [time,setTime] = useState(new Date());
  const [ctx,setCtx] = useState<"portfolio"|"deal">("portfolio");
  const [fkey,setFkey] = useState("F1");
  const [activeDeal,setActiveDeal] = useState<Deal|null>(null);
  const [mapOpen,setMapOpen] = useState(false);
  const [selDeal,setSelDeal] = useState<number|null>(null);
  const [bottomTab,setBottomTab] = useState("alerts");
  const [cmd,setCmd] = useState("");
  const [sortBy,setSortBy] = useState("score");
  const [sortDir,setSortDir] = useState<"desc"|"asc">("desc");
  const [fStage,setFStage] = useState("ALL");
  const [fStrat,setFStrat] = useState("ALL");
  const [flashes,setFlashes] = useState<Record<number,boolean>>({});
  const [dashWidgets,setDashWidgets] = useState<string[]>(()=>{try{const s=localStorage.getItem("jedi-dash-widgets");return s?JSON.parse(s):[]}catch{return []}});
  const [dashMenuOpen,setDashMenuOpen] = useState(false);
  const [selEmail,setSelEmail] = useState<number|null>(1);
  const [emailFolder,setEmailFolder] = useState("inbox");
  const [emailSearch,setEmailSearch] = useState("");
  const [mapLayers,setMapLayers] = useState<{id:string;name:string;type:string;visible:boolean}[]>([]);
  const [mapCreating,setMapCreating] = useState(false);
  const [newMapName,setNewMapName] = useState("");
  const [newMapType,setNewMapType] = useState("warmaps");

  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const t=setInterval(()=>{const id=DEALS[Math.floor(Math.random()*DEALS.length)].id;setFlashes(p=>({...p,[id]:true}));setTimeout(()=>setFlashes(p=>({...p,[id]:false})),700);},5000);return()=>clearInterval(t);},[]);

  const toggleTheme=()=>{const n=theme==="dark"?"light":"dark";setTheme(n);localStorage.setItem("jedi-theme",n);};
  const addWidget=(id:string)=>{setDashWidgets(prev=>{const n=prev.includes(id)?prev:[...prev,id];localStorage.setItem("jedi-dash-widgets",JSON.stringify(n));return n;});};
  const removeWidget=(id:string)=>{setDashWidgets(prev=>{const n=prev.filter(w=>w!==id);localStorage.setItem("jedi-dash-widgets",JSON.stringify(n));return n;});};
  const enterDeal=(deal:Deal)=>{setActiveDeal(deal);setCtx("deal");setFkey("F1");};
  const exitDeal=()=>{setCtx("portfolio");setActiveDeal(null);setFkey("F1");};
  const toggleSort=(c:string)=>{if(sortBy===c)setSortDir(d=>d==="desc"?"asc":"desc");else{setSortBy(c);setSortDir("desc");}};

  const nav = ctx==="portfolio" ? PORTFOLIO_NAV : DEAL_NAV;
  const sorted = [...DEALS]
    .filter(d=>(fStage==="ALL"||d.stage===fStage)&&(fStrat==="ALL"||d.strat===fStrat))
    .sort((a,b)=>{const dir=sortDir==="desc"?-1:1;if(sortBy==="score")return(a.score-b.score)*dir;if(sortBy==="name")return a.name.localeCompare(b.name)*dir;if(sortBy==="days")return(a.days-b.days)*dir;return 0;});

  const totalPV = DEALS.reduce((s,d)=>s+parseFloat(d.price.replace(/[$M,]/g,"")),0);
  const avgS = Math.round(DEALS.reduce((s,d)=>s+d.score,0)/DEALS.length);
  const hAlerts = ALERTS.filter(a=>a.sev==="critical"||a.sev==="high").length;
  const unreadEmails = EMAILS.filter(e=>e.unread).length;
  const stages:Record<string,number>={DD:0,LOI:0,PROSPECT:0,LEAD:0};
  DEALS.forEach(d=>{if(stages[d.stage]!==undefined)stages[d.stage]++;});
  const gc = "30px 1.4fr 0.8fr 44px 40px 58px 52px 48px 54px 46px 46px 42px 42px";

  // ─── DEAL GRID ──────────────────────────────────────────────
  const DealGrid = () => (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,fontWeight:700,color:T.text.white}}>DEAL PIPELINE</span>
          <span style={{fontSize:8,color:T.text.secondary}}>{sorted.length} deals</span>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:gc,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        {[{l:"#"},{l:"PROPERTY",c:"name"},{l:"MARKET"},{l:"JEDI",c:"score"},{l:"D30",c:"delta"},{l:"STRAT"},{l:"IRR"},{l:"EM"},{l:"PRICE"},{l:"$/U"},{l:"STAGE"},{l:"RISK"},{l:"DAYS",c:"days"}].map((h,i)=>(
          <div key={i} onClick={()=>h.c&&toggleSort(h.c)} style={{padding:"3px 4px",fontSize:7,fontWeight:700,color:sortBy===h.c?T.text.amber:T.text.muted,letterSpacing:0.5,borderRight:`1px solid ${T.border.subtle}`,cursor:h.c?"pointer":"default",userSelect:"none" as const}}>
            {h.l}{h.c&&sortBy===h.c&&<span style={{color:T.text.amber,marginLeft:1}}>{sortDir==="desc"?"v":"^"}</span>}
          </div>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        {sorted.map((d,i)=>(
          <div key={d.id}
            onDoubleClick={()=>enterDeal(d)}
            onClick={()=>setSelDeal(selDeal===d.id?null:d.id)}
            style={{display:"grid",gridTemplateColumns:gc,background:selDeal===d.id?T.bg.active:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",borderLeft:selDeal===d.id?`2px solid ${T.text.amber}`:"2px solid transparent",animation:flashes[d.id]?"flash 0.7s ease-out":"none"}}
          >
            <div style={{padding:4,fontSize:8,color:T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{i+1}</div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`}}><div style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{d.name}</div><div style={{fontSize:7,color:T.text.muted}}>{d.addr}</div></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`}}><div style={{fontSize:8,color:T.text.secondary}}>{d.market}</div></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><span style={{fontSize:11,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}}>{d.score}</span></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><span style={{fontSize:9,fontWeight:600,color:d.delta.startsWith("+")?T.text.green:d.delta.startsWith("-")?T.text.red:T.text.muted}}>{d.delta}</span></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><StratBd s={d.strat} T={T}/></div>
            <div style={{padding:4,fontSize:9,fontWeight:700,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.irr}</div>
            <div style={{padding:4,fontSize:8,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.em}</div>
            <div style={{padding:4,fontSize:9,fontWeight:600,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.price}</div>
            <div style={{padding:4,fontSize:8,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.ppu}</div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><StageBd stage={d.stage} T={T}/></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><RiskDot level={d.risk} T={T}/></div>
            <div style={{padding:4,fontSize:8,color:d.days>30?T.text.orange:T.text.secondary,display:"flex",alignItems:"center"}}>{d.days}d</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── MAP SIDEBAR ────────────────────────────────────────────
  const addMapLayer = () => {
    if(!newMapName.trim()) return;
    setMapLayers(prev=>[...prev,{id:`layer-${Date.now()}`,name:newMapName.trim(),type:newMapType,visible:true}]);
    setNewMapName("");
    setMapCreating(false);
  };
  const toggleLayerVis = (id:string) => setMapLayers(prev=>prev.map(l=>l.id===id?{...l,visible:!l.visible}:l));
  const deleteLayer = (id:string) => setMapLayers(prev=>prev.filter(l=>l.id!==id));

  const MapSidebar = () => (
    <div style={{width:300,borderLeft:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panel}}>
      <PanelHeader T={T} title="MAP LAYERS" subtitle={`${mapLayers.length} layers`} right={<button onClick={()=>setMapOpen(false)} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0px 5px",cursor:"pointer"}}>✕</button>}/>

      {/* ── Creation form ── */}
      {mapCreating && (
        <div style={{padding:"8px 10px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.medium}`,animation:"fadeIn 0.12s",flexShrink:0}}>
          <div style={{fontSize:8,fontWeight:700,color:T.text.cyan,letterSpacing:0.5,marginBottom:6}}>NEW MAP LAYER</div>
          <input
            autoFocus
            value={newMapName}
            onChange={e=>setNewMapName(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addMapLayer();if(e.key==="Escape")setMapCreating(false);}}
            placeholder="Layer name…"
            style={{width:"100%",boxSizing:"border-box" as const,fontFamily:T.font.mono,fontSize:9,background:T.bg.input,color:T.text.primary,border:`1px solid ${T.border.medium}`,padding:"4px 7px",marginBottom:6,outline:"none"}}
          />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            {MAP_TYPES.map(mt=>(
              <button key={mt.id} onClick={()=>setNewMapType(mt.id)} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:600,padding:"3px 0",cursor:"pointer",background:newMapType===mt.id?mt.color+"22":"transparent",color:newMapType===mt.id?mt.color:T.text.muted,border:`1px solid ${newMapType===mt.id?mt.color:T.border.subtle}`,borderRadius:0}}>
                {mt.label}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={addMapLayer} style={{flex:1,fontFamily:T.font.mono,fontSize:8,fontWeight:700,padding:"4px 0",cursor:"pointer",background:T.text.cyan,color:T.bg.terminal,border:"none"}}>CREATE</button>
            <button onClick={()=>setMapCreating(false)} style={{fontFamily:T.font.mono,fontSize:8,padding:"4px 8px",cursor:"pointer",background:"transparent",color:T.text.muted,border:`1px solid ${T.border.subtle}`}}>CANCEL</button>
          </div>
        </div>
      )}

      {/* ── Layer list ── */}
      <div style={{flexShrink:0,maxHeight:180,overflow:"auto",borderBottom:`1px solid ${T.border.medium}`}}>
        {mapLayers.length===0 && !mapCreating && (
          <div style={{padding:"20px 10px",textAlign:"center" as const}}>
            <div style={{fontSize:8,color:T.text.muted,lineHeight:"1.6"}}>No layers yet.<br/>Click <span style={{color:T.text.cyan}}>+ New Map</span> to create one.</div>
          </div>
        )}
        {mapLayers.map(layer=>{
          const mt = MAP_TYPES.find(m=>m.id===layer.type)||MAP_TYPES[0];
          return (
            <div key={layer.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderBottom:`1px solid ${T.border.subtle}`,background:T.bg.panel,opacity:layer.visible?1:0.45}}>
              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:7,height:7,borderRadius:"50%",background:mt.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:8,fontWeight:600,color:T.text.primary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{layer.name}</div>
                <div style={{fontSize:7,color:mt.color,letterSpacing:0.3}}>{mt.label}</div>
              </div>
              <button onClick={()=>toggleLayerVis(layer.id)} title={layer.visible?"Hide":"Show"} style={{background:"transparent",border:`1px solid ${T.border.subtle}`,color:layer.visible?T.text.green:T.text.muted,padding:"1px 5px",fontSize:9,cursor:"pointer",flexShrink:0,fontFamily:"monospace"}}>
                {layer.visible?"●":"○"}
              </button>
              <button onClick={()=>deleteLayer(layer.id)} style={{background:"transparent",border:`1px solid ${T.border.subtle}`,color:T.text.muted,padding:"1px 4px",fontSize:9,cursor:"pointer",flexShrink:0,lineHeight:1}}>✕</button>
            </div>
          );
        })}
      </div>

      {/* ── Map viewport ── */}
      <div style={{flex:1,background:"#080C14",position:"relative",minHeight:0}}>
        <svg width="100%" height="100%" style={{position:"absolute",inset:0,opacity:0.06}}>
          {Array.from({length:20}).map((_,i)=><line key={i} x1="0" y1={i*25} x2="100%" y2={i*25} stroke="#8B95A5" strokeWidth="0.5"/>)}
          {Array.from({length:15}).map((_,i)=><line key={`v${i}`} x1={i*25} y1="0" x2={i*25} y2="100%" stroke="#8B95A5" strokeWidth="0.5"/>)}
        </svg>
        {[{x:"28%",y:"30%",i:0},{x:"70%",y:"20%",i:1},{x:"58%",y:"62%",i:2},{x:"46%",y:"48%",i:3},{x:"24%",y:"42%",i:4},{x:"32%",y:"38%",i:5}].map((m,idx)=>{
          const d=DEALS[m.i];
          const layerMatch = mapLayers.length===0 || mapLayers.some(l=>l.visible);
          if(mapLayers.length>0 && !layerMatch) return null;
          const c=d.score>=80?DARK.text.green:d.score>=65?DARK.text.amber:DARK.text.red;
          const sz=d.units>200?16:d.units>100?12:d.units>0?9:7;
          const sel=selDeal===d.id;
          const dotColor = mapLayers.length===0 ? c : (() => {const l=mapLayers.find(ly=>ly.visible); return l ? MAP_TYPES.find(mt=>mt.id===l.type)?.color||c : c; })();
          return (
            <div key={idx} onClick={()=>setSelDeal(d.id)} style={{position:"absolute",left:m.x,top:m.y,transform:"translate(-50%,-50%)",cursor:"pointer",zIndex:sel?10:1}}>
              <div style={{width:sz,height:sz,borderRadius:"50%",background:dotColor,border:sel?`2px solid white`:`1px solid ${dotColor}`,opacity:sel?1:0.75,boxShadow:sel?`0 0 12px ${dotColor}88`:"none"}}/>
              {sel&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:"50%",transform:"translateX(-50%)",background:DARK.bg.header,border:`1px solid ${DARK.border.bright}`,padding:"4px 6px",whiteSpace:"nowrap",zIndex:20,animation:"fadeIn 0.15s"}}>
                <div style={{fontSize:9,fontWeight:700,color:DARK.text.white}}>{d.name}</div>
                <div style={{display:"flex",gap:4,marginTop:2}}><span style={{fontSize:8,color:c,fontWeight:700}}>{d.score}</span><span style={{fontSize:8,color:DARK.text.amber}}>{d.irr}</span></div>
                <div onClick={()=>enterDeal(d)} style={{marginTop:3,fontSize:7,color:DARK.text.amber,cursor:"pointer",fontWeight:600}}>OPEN CAPSULE →</div>
              </div>}
            </div>
          );
        })}
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:8,color:"#8B95A5",opacity:0.15,textAlign:"center",pointerEvents:"none"}}>MAPBOX GL JS<br/>FLORIDA</div>
      </div>
    </div>
  );

  // ─── DASHBOARD WIDGETS ──────────────────────────────────────
  const WidgetKeyFindings = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="KEY FINDINGS" subtitle="5 findings requiring attention" borderColor={T.text.amber} right={<span style={{fontSize:8,color:T.text.secondary,cursor:"pointer"}}>Refresh</span>}/>
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border.subtle}`}}>
        {["News Intelligence","Market Signals"].map((tab,i)=>(
          <div key={i} style={{padding:"6px 12px",fontSize:9,fontWeight:600,color:i===0?T.text.amber:T.text.secondary,borderBottom:i===0?`2px solid ${T.text.amber}`:"none",cursor:"pointer"}}>{tab}</div>
        ))}
      </div>
      {NEWS.map((n,i)=>(
        <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${T.text.amber}`}}>
          <div style={{flex:1}}>
            <div style={{fontSize:8,color:T.text.amber,fontWeight:700,letterSpacing:1,marginBottom:3}}>IMPORTANT</div>
            <div style={{fontSize:10,color:T.text.primary,fontWeight:500,lineHeight:1.4}}>{n.hl}</div>
            <div style={{fontSize:8,color:T.text.muted,marginTop:2}}>{n.time} ago</div>
          </div>
          <div style={{textAlign:"right",minWidth:50}}><div style={{fontSize:9,fontWeight:700,color:n.pts.startsWith("+")?T.text.green:T.text.red}}>{n.pts} pts</div></div>
        </div>
      ))}
    </div>
  );

  const WidgetMyDeals = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="MY DEALS" subtitle="" borderColor={T.text.cyan} right={<button style={{fontFamily:T.font.mono,fontSize:8,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"2px 8px",cursor:"pointer",fontWeight:700}}>+ New</button>}/>
      {DEALS.slice(0,5).map((d,i)=>(
        <div key={i} onDoubleClick={()=>enterDeal(d)} style={{padding:"10px 12px",borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",gap:6,marginBottom:4}}><Bd c={T.text.orange}>WATCH</Bd><Bd c={d.stage==="DD"?T.text.cyan:T.text.muted}>{d.stage==="PROSPECT"?"Signal Intake":d.stage==="DD"?"Post-Close":d.stage}</Bd></div>
              <div style={{fontSize:12,fontWeight:700,color:T.text.primary}}>{d.name}</div>
              <div style={{fontSize:8,color:T.text.secondary,marginTop:2}}>{d.addr}</div>
              <div style={{fontSize:8,color:T.text.muted,marginTop:1}}>Today · {d.units>0?`${d.units} units`:"Land"}</div>
            </div>
            <span style={{fontSize:18,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}}>{d.score}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const WidgetKPISummary = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
      <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:12,letterSpacing:1}}>KPI SUMMARY</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[
          {l:"Total Pipeline",v:`$${totalPV.toFixed(1)}M`,sub:"20 deals",c:T.text.amberBright},
          {l:"Active Deals",v:String(DEALS.filter(d=>d.stage==="DD"||d.stage==="LOI").length),sub:"in progress",c:T.text.cyan},
          {l:"Portfolio Assets",v:"23",sub:"owned",c:T.text.green},
          {l:"Avg Days/Deal",v:String(Math.round(DEALS.reduce((s,d)=>s+d.days,0)/DEALS.length)),sub:"days",c:T.text.amber},
        ].map((k,i)=>(
          <div key={i} style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"12px 14px"}}>
            <div style={{fontSize:8,color:T.text.muted,letterSpacing:1,marginBottom:4}}>{k.l}</div>
            <div style={{fontSize:28,fontWeight:800,color:k.c}}>{k.v}</div>
            <div style={{fontSize:8,color:T.text.secondary,marginTop:2}}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
        {Object.entries(stages).map(([s,c])=>(
          <div key={s} style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"8px 10px",textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:800,color:c>0?T.text.amber:T.text.muted}}>{c}</div>
            <div style={{fontSize:7,color:T.text.muted,letterSpacing:1}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const WidgetAlertFeed = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="ALERT FEED" subtitle={`${hAlerts} critical/high`} borderColor={T.text.red}/>
      {ALERTS.map((a,i)=>{
        const bc=({critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted} as Record<string,string>)[a.sev];
        return <div key={i} style={{display:"flex",gap:6,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}><div style={{flex:1}}><div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd>{a.deal&&<span style={{fontSize:8,color:T.text.amber,fontWeight:600}}>{a.deal}</span>}</div><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div></div><span style={{fontSize:7,color:T.text.muted}}>{a.time}</span></div>;
      })}
    </div>
  );

  const WidgetAgents = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="AGENT ACTIVITY" subtitle={`${AGENTS.filter(a=>a.st==="ON").length} active`} borderColor={T.text.green}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border.subtle}}>
        {AGENTS.map((a,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"8px 10px",borderLeft:a.st==="ON"?`2px solid ${T.text.green}`:`2px solid ${T.text.muted}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:9,fontWeight:700,color:T.text.purple}}>{a.id} <span style={{color:T.text.primary,fontWeight:600}}>{a.name}</span></span><span style={{fontSize:7,color:a.st==="ON"?T.text.green:T.text.muted}}>{a.st}</span></div>
            <div style={{fontSize:8,color:T.text.secondary,lineHeight:1.3}}>{a.act}</div>
            <div style={{fontSize:7,color:T.text.muted,marginTop:2}}>{a.t} ago · {a.m} msgs</div>
          </div>
        ))}
      </div>
    </div>
  );

  const WidgetLeaderboard = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="SCORE LEADERBOARD" subtitle="Ranked by JEDI score" borderColor={T.text.green}/>
      {[...DEALS].sort((a,b)=>b.score-a.score).map((d,i)=>(
        <div key={d.id} onDoubleClick={()=>enterDeal(d)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt,cursor:"pointer"}}>
          <span style={{fontSize:12,fontWeight:800,color:T.text.muted,minWidth:24}}>#{i+1}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:600,color:T.text.primary}}>{d.name}</div>
            <div style={{fontSize:8,color:T.text.secondary}}>{d.market} · <StratBd s={d.strat} T={T}/></div>
          </div>
          <Spark data={d.trend} color={d.score>=80?T.text.green:T.text.amber} w={48} h={16}/>
          <div style={{textAlign:"right",minWidth:40}}>
            <div style={{fontSize:18,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}}>{d.score}</div>
            <div style={{fontSize:8,color:d.delta.startsWith("+")?T.text.green:T.text.red}}>{d.delta}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const WidgetFunnel = () => {
    const stageOrder=["LEAD","PROSPECT","LOI","DD"];
    const stageColors:Record<string,string>={LEAD:T.text.muted,PROSPECT:T.text.secondary,LOI:T.text.amber,DD:T.text.green};
    const maxCount=Math.max(...Object.values(stages),1);
    return (
      <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
        <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:16,letterSpacing:1}}>STAGE FUNNEL</div>
        {stageOrder.map(s=>(
          <div key={s} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{s}</span>
              <span style={{fontSize:12,fontWeight:800,color:stageColors[s]}}>{stages[s]} deals</span>
            </div>
            <div style={{height:28,background:T.bg.panel,border:`1px solid ${T.border.subtle}`,position:"relative"}}>
              <div style={{height:"100%",width:`${(stages[s]/maxCount)*100}%`,background:stageColors[s]+"44",borderRight:`2px solid ${stageColors[s]}`}}/>
              <div style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:8,color:T.text.muted}}>{sorted.filter(d=>d.stage===s).map(d=>d.name.split(" ")[0]).join(", ")}</div>
            </div>
          </div>
        ))}
        <div style={{marginTop:12,padding:"8px 10px",background:T.text.amber+"08",borderLeft:`3px solid ${T.text.amber}`}}>
          <div style={{fontSize:9,color:T.text.secondary}}>Total pipeline value: <span style={{color:T.text.amber,fontWeight:700}}>${totalPV.toFixed(1)}M</span> across {DEALS.length} deals</div>
        </div>
      </div>
    );
  };

  const WidgetStrategySnapshot = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
      <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:12,letterSpacing:1}}>STRATEGY SNAPSHOT</div>
      {[
        {s:"BUILD-TO-SELL",count:DEALS.filter(d=>d.strat==="BTS").length,avgScore:Math.round(DEALS.filter(d=>d.strat==="BTS").reduce((a,d)=>a+d.score,0)/Math.max(DEALS.filter(d=>d.strat==="BTS").length,1)),c:T.text.green},
        {s:"RENTAL",count:DEALS.filter(d=>d.strat==="RENTAL").length,avgScore:Math.round(DEALS.filter(d=>d.strat==="RENTAL").reduce((a,d)=>a+d.score,0)/Math.max(DEALS.filter(d=>d.strat==="RENTAL").length,1)),c:T.text.cyan},
        {s:"FLIP",count:DEALS.filter(d=>d.strat==="FLIP").length,avgScore:Math.round(DEALS.filter(d=>d.strat==="FLIP").reduce((a,d)=>a+d.score,0)/Math.max(DEALS.filter(d=>d.strat==="FLIP").length,1)),c:T.text.amber},
        {s:"STR",count:DEALS.filter(d=>d.strat==="STR").length,avgScore:Math.round(DEALS.filter(d=>d.strat==="STR").reduce((a,d)=>a+d.score,0)/Math.max(DEALS.filter(d=>d.strat==="STR").length,1)),c:T.text.orange},
      ].map((row,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
          <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:row.c}}>{row.s}</div><div style={{fontSize:8,color:T.text.secondary}}>{row.count} deal{row.count!==1?"s":""} in pipeline</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:800,color:row.c}}>{row.avgScore||"—"}</div><div style={{fontSize:7,color:T.text.muted}}>avg score</div></div>
        </div>
      ))}
    </div>
  );

  // ─── NEW WIDGETS (10) ────────────────────────────────────────
  const WidgetRates = () => {
    const rates = [{l:"Fed Funds",v:"5.33%",d:"-0bps",t:[5.0,5.1,5.25,5.33,5.33,5.33],c:T.text.red},{l:"SOFR",v:"5.31%",d:"-2bps",t:[5.05,5.1,5.22,5.29,5.30,5.31],c:T.text.orange},{l:"Prime Rate",v:"8.50%",d:"0bps",t:[7.5,7.8,8.0,8.25,8.50,8.50],c:T.text.amber},{l:"10Y Treasury",v:"4.41%",d:"+6bps",t:[3.8,4.0,4.2,4.31,4.35,4.41],c:T.text.cyan}];
    return (
      <div style={{flex:1,overflow:"auto",padding:12}}>
        {rates.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{width:110,fontSize:9,fontWeight:600,color:T.text.secondary}}>{r.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:r.c,minWidth:64}}>{r.v}</div>
            <div style={{fontSize:8,color:r.d.startsWith("+")?T.text.green:r.d.startsWith("-")?T.text.red:T.text.muted,minWidth:44}}>{r.d}</div>
            <Spark data={r.t} color={r.c} w={72} h={20}/>
          </div>
        ))}
        <div style={{padding:"6px 10px",fontSize:7,color:T.text.muted}}>Source: Federal Reserve · Updated daily</div>
      </div>
    );
  };

  const WidgetYieldCurve = () => {
    const pts = [{m:"1M",v:5.27},{m:"3M",v:5.30},{m:"6M",v:5.28},{m:"1Y",v:5.05},{m:"2Y",v:4.72},{m:"5Y",v:4.50},{m:"10Y",v:4.41},{m:"20Y",v:4.62},{m:"30Y",v:4.58}];
    const mn=Math.min(...pts.map(p=>p.v))-0.2, mx=Math.max(...pts.map(p=>p.v))+0.2, rng=mx-mn;
    const W=280,H=80;
    const polyline=pts.map((p,i)=>`${(i/(pts.length-1))*W},${H-((p.v-mn)/rng)*H}`).join(" ");
    return (
      <div style={{flex:1,overflow:"auto",padding:12}}>
        <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"10px 12px"}}>
          <svg width="100%" height={H+20} viewBox={`0 0 ${W} ${H+20}`} style={{display:"block",overflow:"visible"}}>
            {[4.0,4.5,5.0,5.5].map((v,i)=>{const y=H-((v-mn)/rng)*H; return <line key={i} x1="0" y1={y} x2={W} y2={y} stroke={T.border.subtle} strokeWidth="0.5" strokeDasharray="3,3"/>;} )}
            <polyline points={polyline} fill="none" stroke={T.text.purple} strokeWidth="2" strokeLinejoin="round"/>
            {pts.map((p,i)=>{ const x=(i/(pts.length-1))*W,y=H-((p.v-mn)/rng)*H; return <g key={i}><circle cx={x} cy={y} r="3" fill={T.text.purple}/><text x={x} y={H+14} textAnchor="middle" fontSize="7" fill={T.text.muted}>{p.m}</text></g>; })}
          </svg>
        </div>
        <div style={{marginTop:8,fontSize:8,color:T.text.muted}}>Inverted 2Y/10Y spread: <span style={{color:T.text.orange,fontWeight:700}}>-31bps</span> · Normalization in progress</div>
      </div>
    );
  };

  const WidgetTV = () => {
    const [chan,setChan] = React.useState("CNBC");
    const channels = ["CNBC","Bloomberg","Fox Business","Yahoo Finance"];
    return (
      <div style={{flex:1,display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",gap:0,background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
          {channels.map(c=><button key={c} onClick={()=>setChan(c)} style={{fontFamily:T.font.mono,fontSize:8,fontWeight:600,padding:"4px 10px",cursor:"pointer",background:chan===c?T.text.orange:"transparent",color:chan===c?T.bg.terminal:T.text.secondary,border:"none"}}>{c}</button>)}
        </div>
        <div style={{flex:1,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,position:"relative"}}>
          <div style={{position:"absolute",top:8,left:10,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:T.text.red,display:"inline-block",animation:"pulse 1.5s infinite"}}/><span style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,color:T.text.red,letterSpacing:1}}>LIVE</span></div>
          <div style={{fontSize:24,color:"rgba(255,255,255,0.08)",fontWeight:800,letterSpacing:4}}>{chan.toUpperCase()}</div>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>Stream requires authenticated account</div>
          <button style={{fontFamily:T.font.mono,fontSize:8,fontWeight:700,background:T.text.orange,color:"#000",border:"none",padding:"5px 14px",cursor:"pointer",marginTop:4}}>CONNECT ACCOUNT</button>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:22,background:"rgba(255,150,0,0.12)",display:"flex",alignItems:"center",overflow:"hidden"}}>
            <div style={{whiteSpace:"nowrap",fontSize:8,color:T.text.amber,animation:"ticker 20s linear infinite"}}>LIVE · FED HOLDS RATES · TAMPA MSA JOBS +3.2% · NOCATEE MPC #2 NATIONALLY · CMBS SPREADS TIGHTEN 18bps · GREYSTAR 380U GROUNDBREAKING · FL INSURANCE REFORM PASSES ·&nbsp;&nbsp;LIVE · FED HOLDS RATES · TAMPA MSA JOBS +3.2% · NOCATEE MPC #2 NATIONALLY · CMBS SPREADS TIGHTEN 18bps ·</div>
          </div>
        </div>
      </div>
    );
  };

  const WidgetCapRates = () => {
    const data = [{cls:"Multifamily",markets:[{m:"Tampa",v:"5.1%"},{m:"Miami",v:"4.8%"},{m:"Orlando",v:"5.4%"},{m:"Jacksonville",v:"5.6%"}]},{cls:"Industrial",markets:[{m:"Tampa",v:"5.5%"},{m:"Miami",v:"4.9%"},{m:"Orlando",v:"5.9%"},{m:"Jacksonville",v:"6.1%"}]},{cls:"Retail",markets:[{m:"Tampa",v:"6.2%"},{m:"Miami",v:"5.7%"},{m:"Orlando",v:"6.4%"},{m:"Jacksonville",v:"7.0%"}]},{cls:"Office",markets:[{m:"Tampa",v:"7.8%"},{m:"Miami",v:"7.2%"},{m:"Orlando",v:"8.1%"},{m:"Jacksonville",v:"8.6%"}]}];
    return (
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
          {["CLASS","TAMPA","MIAMI","ORLANDO","JACKSONVILLE"].map((h,i)=><div key={i} style={{padding:"4px 8px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.5,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>)}
        </div>
        {data.map((row,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"80px 1fr 1fr 1fr 1fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
            <div style={{padding:"6px 8px",fontSize:8,fontWeight:700,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{row.cls}</div>
            {row.markets.map((m,j)=><div key={j} style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:parseFloat(m.v)>7?T.text.red:parseFloat(m.v)>6?T.text.orange:T.text.green,borderRight:`1px solid ${T.border.subtle}`}}>{m.v}</div>)}
          </div>
        ))}
      </div>
    );
  };

  const WidgetREITs = () => {
    const reits=[{t:"EQR",n:"Equity Residential",p:"$65.42",d:"+1.2%",ytd:"-4.1%",c:T.text.cyan},{t:"MAA",n:"Mid-America Apt",p:"$128.77",d:"+0.8%",ytd:"+2.3%",c:T.text.green},{t:"VNQ",n:"Vanguard RE ETF",p:"$84.31",d:"+0.5%",ytd:"-1.8%",c:T.text.amber},{t:"PLD",n:"Prologis (Ind)",p:"$112.55",d:"+2.1%",ytd:"+6.4%",c:T.text.green},{t:"BXP",n:"BXP (Office)",p:"$62.18",d:"-0.3%",ytd:"-8.2%",c:T.text.red},{t:"SPG",n:"Simon Property (Ret)",p:"$148.90",d:"+1.4%",ytd:"+3.7%",c:T.text.green}];
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {reits.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{width:36,fontSize:9,fontWeight:800,color:r.c}}>{r.t}</div>
            <div style={{flex:1,fontSize:8,color:T.text.secondary}}>{r.n}</div>
            <div style={{fontSize:13,fontWeight:700,color:T.text.primary,minWidth:52,textAlign:"right"}}>{r.p}</div>
            <div style={{fontSize:8,fontWeight:700,color:r.d.startsWith("+")?T.text.green:T.text.red,minWidth:38,textAlign:"right"}}>{r.d}</div>
            <div style={{fontSize:8,color:r.ytd.startsWith("+")?T.text.green:T.text.red,minWidth:38,textAlign:"right"}}>{r.ytd} YTD</div>
          </div>
        ))}
      </div>
    );
  };

  const WidgetMacro = () => {
    const rows=[{l:"GDP Growth (Q4 25)",v:"2.3%",note:"Above consensus 1.9%",arr:"↑",c:T.text.green},{l:"CPI (Feb 26)",v:"3.1%",note:"Core 3.4% — still elevated",arr:"↓",c:T.text.orange},{l:"Unemployment",v:"3.9%",note:"Slight uptick from 3.7%",arr:"↑",c:T.text.amber},{l:"Housing Starts",v:"1.42M",note:"Down 4.2% MoM from Jan",arr:"↓",c:T.text.red},{l:"30Y Mortgage",v:"7.11%",note:"Down from 7.35% peak",arr:"↓",c:T.text.orange},{l:"Consumer Conf.",v:"97.4",note:"Declined 3pts from prior month",arr:"↓",c:T.text.orange}];
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {rows.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{flex:1,fontSize:9,color:T.text.secondary}}>{r.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:r.c,minWidth:48}}>{r.v}</div>
            <div style={{fontSize:12,color:r.c,minWidth:12}}>{r.arr}</div>
            <div style={{fontSize:7,color:T.text.muted,minWidth:130,textAlign:"right"}}>{r.note}</div>
          </div>
        ))}
      </div>
    );
  };

  const WidgetDebt = () => {
    const rows=[{l:"CMBS AAA (10Y)",v:"175 bps",d:"-18bps WoW",c:T.text.green},{l:"CMBS AA",v:"215 bps",d:"-12bps WoW",c:T.text.green},{l:"Agency MF (Fannie)",v:"SOFR + 155",d:"+5bps WoW",c:T.text.red},{l:"Life Company MF",v:"SOFR + 185",d:"0bps",c:T.text.muted},{l:"Bridge / Value-Add",v:"SOFR + 350",d:"+25bps WoW",c:T.text.red},{l:"Construction (BTS)",v:"SOFR + 275",d:"-10bps WoW",c:T.text.green}];
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {rows.map((r,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{flex:1,fontSize:9,color:T.text.secondary}}>{r.l}</div>
            <div style={{fontSize:12,fontWeight:700,color:T.text.amber,minWidth:96}}>{r.v}</div>
            <div style={{fontSize:8,fontWeight:600,color:r.c,minWidth:80,textAlign:"right"}}>{r.d}</div>
          </div>
        ))}
        <div style={{padding:"6px 12px",fontSize:7,color:T.text.muted}}>Spreads to SOFR 5.31% · Updated Mar 15</div>
      </div>
    );
  };

  const WidgetCalendar = () => {
    const events=[{deal:"Dadeland Station",type:"DD EXPIRES",days:9,sev:"critical"},{deal:"Westshore Commons",type:"EARNEST WIRE",days:3,sev:"critical"},{deal:"Nocatee Parcels",type:"BEST & FINAL",days:4,sev:"high"},{deal:"Celebration South",type:"DD START",days:7,sev:"med"},{deal:"Riverview Preserve",type:"CITY MTG",days:14,sev:"low"},{deal:"Colonial Crossings",type:"LOI EXPIRES",days:21,sev:"low"}];
    const sColors:Record<string,string>={critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted};
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {events.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${sColors[e.sev]}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{width:40,textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:sColors[e.sev]}}>{e.days}</div><div style={{fontSize:6,color:T.text.muted}}>days</div></div>
            <div style={{flex:1}}><div style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{e.deal}</div><div style={{marginTop:2}}><Bd c={sColors[e.sev]}>{e.type}</Bd></div></div>
          </div>
        ))}
      </div>
    );
  };

  const WidgetCompetitor = () => {
    const items=[{who:"Greystar",action:"Broke ground 380u luxury tower, Downtown Tampa",impact:"SUPPLY +",time:"2d",threat:"HIGH"},{who:"Equity Residential",action:"Acquired 224u Westshore for $44.8M ($200K/door)",impact:"COMP ↑",time:"5d",threat:"MED"},{who:"MAA",action:"Filed permits for 156u Riverview mid-rise",impact:"SUPPLY +",time:"1w",threat:"LOW"},{who:"Blackstone RE",action:"Raised $4.2B multifamily fund — FL allocation $420M",impact:"CAPITAL",time:"1w",threat:"HIGH"},{who:"AvalonBay",action:"Announced Orlando market entry — seeking sites 200+ units",impact:"BUYER",time:"2w",threat:"MED"}];
    const tc:Record<string,string>={HIGH:T.text.red,MED:T.text.orange,LOW:T.text.muted};
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {items.map((it,i)=>(
          <div key={i} style={{padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:9,fontWeight:700,color:T.text.amber}}>{it.who}</span>
              <div style={{display:"flex",gap:4,alignItems:"center"}}><Bd c={tc[it.threat]}>{it.threat}</Bd><span style={{fontSize:7,color:T.text.muted}}>{it.time}</span></div>
            </div>
            <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.4}}>{it.action}</div>
            <div style={{marginTop:3}}><Bd c={T.text.cyan}>{it.impact}</Bd></div>
          </div>
        ))}
      </div>
    );
  };

  const WidgetAIBrief = () => (
    <div style={{flex:1,overflow:"auto",padding:14}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:9,fontWeight:700,color:T.text.green}}>● AI ONLINE</span><span style={{fontSize:8,color:T.text.muted}}>Generated Mar 16, 2026 · 6:00 AM ET</span></div>
      <div style={{fontSize:10,fontWeight:700,color:T.text.primary,marginBottom:8,lineHeight:1.4}}>Good morning. Today's top priorities:</div>
      {[
        {n:"① Nocatee Parcels",t:"Competing offer received at $4.6M. Best-and-final due Friday 5pm. Recommend counter at $4.5M with shortened inspection.",c:T.text.red},
        {n:"② Dadeland Station",t:"DD expires in 9 days. 3 items outstanding. Escalate structural inspection scheduling immediately.",c:T.text.orange},
        {n:"③ Westshore Commons",t:"LOI countersigned. Wire $250K earnest by Friday. Phase I ESA clean — no RECs. On track for closing.",c:T.text.green},
        {n:"Market context",t:"Fed Funds held at 5.33%. Tampa MSA absorption 95.2% — strongest quarter in 3 years. BTS strategies showing 22pt advantage over rental in current rate environment.",c:T.text.cyan},
      ].map((item,i)=>(
        <div key={i} style={{padding:"8px 10px",marginBottom:8,background:T.bg.panel,border:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${item.c}`}}>
          <div style={{fontSize:9,fontWeight:700,color:item.c,marginBottom:3}}>{item.n}</div>
          <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.5}}>{item.t}</div>
        </div>
      ))}
    </div>
  );

  // ─── WIDGET RENDER ROUTER ────────────────────────────────────
  const renderWidget = (id:string) => {
    switch(id) {
      case "pipeline":    return <DealGrid/>;
      case "findings":   return <WidgetKeyFindings/>;
      case "mydeals":    return <WidgetMyDeals/>;
      case "kpi":        return <WidgetKPISummary/>;
      case "alerts":     return <WidgetAlertFeed/>;
      case "agents":     return <WidgetAgents/>;
      case "vitals":     return <ViewMarkets/>;
      case "leaderboard":return <WidgetLeaderboard/>;
      case "funnel":     return <WidgetFunnel/>;
      case "strategy":   return <WidgetStrategySnapshot/>;
      case "rates":      return <WidgetRates/>;
      case "yieldcurve": return <WidgetYieldCurve/>;
      case "tv":         return <WidgetTV/>;
      case "caprates":   return <WidgetCapRates/>;
      case "reits":      return <WidgetREITs/>;
      case "macro":      return <WidgetMacro/>;
      case "debt":       return <WidgetDebt/>;
      case "calendar":   return <WidgetCalendar/>;
      case "competitor": return <WidgetCompetitor/>;
      case "aibrief":    return <WidgetAIBrief/>;
      default: return null;
    }
  };

  // ─── VIEW DASHBOARD ──────────────────────────────────────────
  const CATEGORIES = ["DEALS","INTEL","MARKET","OPS","MEDIA"];
  const ViewDashboard = () => (
    <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,position:"relative"}}>
      {/* ── Widget menu overlay ── */}
      {dashMenuOpen && (
        <div style={{position:"absolute",inset:0,background:theme==="dark"?"rgba(5,8,16,0.97)":"rgba(240,244,248,0.97)",zIndex:20,display:"flex",flexDirection:"column",animation:"fadeIn 0.35s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,background:T.bg.header}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.text.white,letterSpacing:1}}>ADD WIDGET</div>
              <div style={{fontSize:8,color:T.text.muted,marginTop:1}}>{WIDGET_CATALOG.length} available · {dashWidgets.length} on dashboard</div>
            </div>
            <button onClick={()=>setDashMenuOpen(false)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.muted,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"4px 10px",cursor:"pointer"}}>✕ CLOSE</button>
          </div>
          <div style={{flex:1,overflow:"auto",padding:"12px 16px"}}>
            {CATEGORIES.map(cat=>{
              const items=WIDGET_CATALOG.filter(w=>w.category===cat);
              if(!items.length) return null;
              return (
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontSize:8,fontWeight:700,color:T.text.muted,letterSpacing:1.5,marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${T.border.subtle}`}}>{cat}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {items.map(w=>{
                      const added=dashWidgets.includes(w.id);
                      return (
                        <div key={w.id} style={{background:T.bg.panel,border:`1px solid ${added?w.color+"44":T.border.subtle}`,padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:w.color,display:"inline-block",flexShrink:0}}/>
                            <span style={{fontSize:9,fontWeight:700,color:T.text.primary}}>{w.label}</span>
                          </div>
                          <div style={{fontSize:7,color:T.text.muted,lineHeight:1.5,flex:1}}>{w.desc}</div>
                          <button onClick={()=>{if(!added){addWidget(w.id);setDashMenuOpen(false);}}} style={{fontFamily:T.font.mono,fontSize:8,fontWeight:700,background:added?T.bg.active:"transparent",color:added?T.text.green:w.color,border:`1px solid ${added?T.text.green+"44":w.color}`,padding:"4px 0",cursor:added?"default":"pointer",letterSpacing:0.3}}>
                            {added?"✓ ADDED":"+ ADD"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dashboard header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:34,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:1}}>DASHBOARD</span>
          {dashWidgets.length>0&&<span style={{fontSize:8,color:T.text.muted}}>{dashWidgets.length} widget{dashWidgets.length!==1?"s":""}</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {dashWidgets.length>0&&<button onClick={()=>{setDashWidgets([]);localStorage.setItem("jedi-dash-widgets","[]");}} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"3px 8px",cursor:"pointer"}}>CLEAR</button>}
          <button onClick={()=>setDashMenuOpen(true)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"4px 12px",cursor:"pointer",letterSpacing:0.3}}>+ ADD WIDGET</button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {dashWidgets.length===0 && (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"fadeIn 0.3s"}}>
          <div style={{width:48,height:48,border:`2px solid ${T.border.medium}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:24,color:T.text.muted}}>+</span>
          </div>
          <div style={{textAlign:"center" as const}}>
            <div style={{fontSize:14,fontWeight:700,color:T.text.primary,marginBottom:6}}>Your dashboard is empty</div>
            <div style={{fontSize:10,color:T.text.muted}}>Choose from {WIDGET_CATALOG.length} widgets to build your view</div>
          </div>
          <button onClick={()=>setDashMenuOpen(true)} style={{fontFamily:T.font.mono,fontSize:11,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"10px 24px",cursor:"pointer",letterSpacing:0.5}}>+ ADD WIDGET</button>
        </div>
      )}

      {/* ── Widget grid ── */}
      {dashWidgets.length>0 && (
        <div style={{flex:1,overflow:"auto",padding:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,alignItems:"start"}}>
            {dashWidgets.map(id=>{
              const meta=WIDGET_CATALOG.find(w=>w.id===id);
              if(!meta) return null;
              return (
                <div key={id} style={{background:T.bg.panel,border:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",minHeight:220,maxHeight:320}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,display:"inline-block"}}/>
                      <span style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.primary}}>{meta.label}</span>
                    </div>
                    <button onClick={()=>removeWidget(id)} style={{fontFamily:T.font.mono,fontSize:9,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1}}>✕</button>
                  </div>
                  <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
                    {renderWidget(id)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ─── PORTFOLIO VIEWS ────────────────────────────────────────
  const ViewPortfolio = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="OWNED ASSETS" subtitle="23 properties | $312M value" borderColor={T.text.green} right={<Bd c={T.text.green}>PORTFOLIO JEDI: 74</Bd>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border.subtle}}>
        {[{l:"TOTAL VALUE",v:"$312M",c:T.text.amberBright},{l:"WEIGHTED IRR",v:"16.8%",c:T.text.amber},{l:"AVG OCCUPANCY",v:"93.4%",c:T.text.green},{l:"NOI VARIANCE",v:"+2.3%",c:T.text.green}].map((m,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"8px 10px"}}>
            <div style={{fontSize:7,color:T.text.muted,letterSpacing:1}}>{m.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:10}}>
        <div style={{fontSize:9,color:T.text.muted,marginBottom:6}}>Actual vs. projected variance tracking | Monthly actuals upload | Decision timeline</div>
        {["Midtown Heights (248u)","West End Lofts (180u)","Buckhead Tower (312u)","Downtown Station (156u)"].map((a,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <span style={{fontSize:10,color:T.text.primary,fontWeight:600}}>{a}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:10,fontWeight:700,color:T.text.green}}>{[76,72,81,68][i]}</span>
              <Spark data={[[72,73,74,75,76],[70,71,71,72,72],[78,79,80,80,81],[70,69,68,68,68]][i]} color={T.text.green} w={40} h={12}/>
              <span style={{fontSize:8,color:T.text.amber}}>{["$44.2M","$28.1M","$72.6M","$31.5M"][i]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ViewMarkets = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="MARKET INTELLIGENCE" subtitle="5 submarkets | 202 properties | 50,380 units" borderColor={T.text.cyan} right={<Bd c={T.text.green}>LIVE DATA</Bd>}/>
      <div style={{padding:"10px 10px 0"}}>
        <div style={{fontSize:9,color:T.text.secondary,marginBottom:4,fontFamily:T.font.label}}>THE DECISION THIS PAGE DRIVES:</div>
        <div style={{fontSize:11,color:T.text.white,fontWeight:600,marginBottom:10,fontFamily:T.font.label}}>Is this submarket getting stronger or weaker — and how fast?</div>
      </div>
      <div style={{display:"flex",gap:1,padding:"0 10px 10px"}}>
        {MARKET_VITALS.map((v,i)=><MetricBox key={i} {...v} T={T}/>)}
      </div>
      <div style={{margin:"0 10px 10px",padding:"6px 10px",background:T.text.amber+"08",borderLeft:`3px solid ${T.text.amber}`}}>
        <span style={{fontSize:9,color:T.text.secondary}}>Tracking 5 submarkets with 202 properties and 50,380 total units. Momentum signal: <span style={{fontWeight:700,color:T.text.amber}}>STRONG</span>. Top submarket: Midtown ($2,056 avg rent).</span>
      </div>
      <div style={{margin:"0 10px"}}>
        <PanelHeader T={T} title="SUBMARKET COMPARISON"/>
        <div style={{display:"grid",gridTemplateColumns:"1.2fr 0.6fr 0.8fr 0.7fr 0.7fr 0.8fr 0.7fr 0.7fr",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`}}>
          {["SUBMARKET","PROPS","UNITS","AVG RENT","VACANCY","GROWTH 30D","OPP","PRESSURE"].map(h=>(
            <div key={h} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
          ))}
        </div>
        {SUBMARKETS.map((s,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 0.6fr 0.8fr 0.7fr 0.7fr 0.8fr 0.7fr 0.7fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
            <div style={{padding:"5px 6px",fontSize:10,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{s.name}</div>
            <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{s.props}</div>
            <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{s.units}</div>
            <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`}}>{s.rent}</div>
            <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{s.vac}</div>
            <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:s.growth.startsWith("+")?T.text.green:T.text.red,borderRight:`1px solid ${T.border.subtle}`}}>{s.growth}</div>
            <div style={{padding:"5px 6px",fontSize:9,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`}}>{s.opp}</div>
            <div style={{padding:"5px 6px",display:"flex",alignItems:"center"}}><Bd c={s.pressure==="seller"?T.text.red:T.text.green}>{s.pressure}</Bd></div>
          </div>
        ))}
      </div>
    </div>
  );

  const ViewCompete = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="COMPETITIVE INTELLIGENCE" subtitle="Performance Rankings | Acquisition Intel | Comp Analysis" borderColor={T.text.purple}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border.subtle,margin:10}}>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>PERFORMANCE RANKINGS</div>
          {["Westshore Commons","Celebration South","Riverview Preserve","Dadeland Station"].map((n,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
              <span style={{fontSize:9,color:T.text.primary}}>#{i+1} {n}</span>
              <span style={{fontSize:9,fontWeight:700,color:T.text.amber}}>{[82,85,79,76][i]}</span>
            </div>
          ))}
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>ACQUISITION TARGETS</div>
          {["Flagler Village 42u (distress)","Channelside 186u (value-add)","Winter Park 94u (mismanaged)"].map((n,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
              <span style={{fontSize:9,color:T.text.primary}}>{n}</span>
              <Bd c={T.text.orange}>TARGET</Bd>
            </div>
          ))}
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>OPPORTUNITY ALERTS</div>
          {["Buckhead: opp score 9.0, buyer market","West End: opp 7.9, rent growth accelerating","East Atlanta: vac 15.4%, distress signal"].map((n,i)=>(
            <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`,fontSize:9,color:T.text.secondary}}>{n}</div>
          ))}
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>PATTERN DETECTION</div>
          <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.5}}>3 submarkets showing rent convergence pattern. West End approaching Midtown pricing within 18 months. <span style={{color:T.text.amber,fontWeight:600}}>Gentrification signal: STRONG.</span></div>
        </div>
      </div>
    </div>
  );

  const ViewStrategies = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="STRATEGIES" subtitle="Strategy library | Builder | Saved profiles" borderColor={T.text.purple}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:1,background:T.border.subtle,margin:10}}>
        {[
          {s:"BUILD-TO-SELL",score:84,desc:"Ground-up construction, sell at CO. Optimal for thin supply + strong demand. Typical IRR 22–28%, 24mo hold.",best:"Jacksonville, Tampa"},
          {s:"RENTAL",score:69,desc:"Long-term hold for NOI and appreciation. Best in high-barrier markets with rent growth >2.5% YoY.",best:"Miami, Orlando"},
          {s:"FLIP",score:58,desc:"Value-add and resell within 12 months. Requires distress or mismanagement at acquisition. IRR 18–24%.",best:"Orlando (Colonial Town)"},
          {s:"SHORT-TERM RENTAL",score:45,desc:"Hospitality-grade operation. High revenue but regulatory and operational risk. FL STR reform pending.",best:"Beach markets (caution)"},
        ].map((row,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:12,borderTop:`2px solid ${[T.text.green,T.text.cyan,T.text.amber,T.text.orange][i]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.5}}>{row.s}</div>
              <div style={{fontSize:22,fontWeight:800,color:[T.text.green,T.text.cyan,T.text.amber,T.text.orange][i]}}>{row.score}</div>
            </div>
            <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.5,marginBottom:6}}>{row.desc}</div>
            <div style={{fontSize:8,color:T.text.muted}}>Best markets: <span style={{color:T.text.amber,fontWeight:600}}>{row.best}</span></div>
          </div>
        ))}
      </div>
    </div>
  );

  const ViewEmail = () => {
    const TAG_COLORS:Record<string,string> = {LOI:T.text.cyan,URGENT:T.text.red,DD:T.text.amber,DEBT:T.text.purple,ZONING:T.text.orange,LP:T.text.secondary,SCORE:T.text.green};
    const folders = [{id:"inbox",label:"INBOX",count:EMAILS.filter(e=>e.unread).length},{id:"sent",label:"SENT",count:0},{id:"starred",label:"STARRED",count:2},{id:"all",label:"ALL MAIL",count:EMAILS.length}];
    const filtered = EMAILS.filter(e=>{
      const matchFolder = emailFolder==="all" || e.folder===emailFolder || emailFolder==="starred";
      const matchSearch = !emailSearch || e.from.toLowerCase().includes(emailSearch.toLowerCase()) || e.subject.toLowerCase().includes(emailSearch.toLowerCase()) || (e.deal||"").toLowerCase().includes(emailSearch.toLowerCase());
      return matchFolder && matchSearch;
    });
    const activeEmail = EMAILS.find(e=>e.id===selEmail)||null;
    return (
      <div style={{flex:1,display:"flex",minHeight:0,animation:"fadeIn 0.15s"}}>
        {/* ── Sidebar ── */}
        <div style={{width:180,borderRight:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panelAlt}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
            <button style={{width:"100%",fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"6px 0",cursor:"pointer",letterSpacing:0.5}}>+ COMPOSE</button>
          </div>
          <div style={{flex:1,overflow:"auto"}}>
            {folders.map(f=>(
              <div key={f.id} onClick={()=>setEmailFolder(f.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 12px",cursor:"pointer",background:emailFolder===f.id?T.bg.active:"transparent",borderLeft:emailFolder===f.id?`2px solid ${T.text.amber}`:"2px solid transparent"}}>
                <span style={{fontFamily:T.font.mono,fontSize:9,fontWeight:600,color:emailFolder===f.id?T.text.amber:T.text.secondary}}>{f.label}</span>
                {f.count>0&&<span style={{fontSize:7,fontWeight:700,background:T.text.amber+"22",color:T.text.amber,padding:"1px 5px"}}>{f.count}</span>}
              </div>
            ))}
            <div style={{height:1,background:T.border.subtle,margin:"6px 0"}}/>
            <div style={{padding:"6px 12px 3px"}}><span style={{fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:1}}>LABELS</span></div>
            {["LOI","DD","DEBT","ZONING","URGENT","SCORE","LP"].map(tag=>(
              <div key={tag} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",cursor:"pointer"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:TAG_COLORS[tag]||T.text.muted,display:"inline-block",flexShrink:0}}/>
                <span style={{fontFamily:T.font.mono,fontSize:8,color:T.text.secondary}}>{tag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Email List ── */}
        <div style={{width:300,borderRight:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"5px 8px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:4,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"2px 7px",height:22}}>
              <span style={{fontSize:9,color:T.text.muted}}>⌕</span>
              <input value={emailSearch} onChange={e=>setEmailSearch(e.target.value)} placeholder="Search mail…" style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:T.font.mono,fontSize:9,color:T.text.primary}}/>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto"}}>
            {filtered.length===0&&<div style={{padding:20,textAlign:"center" as const,fontSize:9,color:T.text.muted}}>No messages</div>}
            {filtered.map(e=>(
              <div key={e.id} onClick={()=>setSelEmail(e.id)} style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",background:selEmail===e.id?T.bg.active:e.unread?T.text.amber+"06":T.bg.panel,borderLeft:selEmail===e.id?`2px solid ${T.text.amber}`:e.unread?`2px solid ${T.text.orange}`:`2px solid transparent`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:9,fontWeight:e.unread?700:500,color:e.unread?T.text.primary:T.text.secondary}}>{e.from}</span>
                    {e.unread&&<span style={{width:5,height:5,borderRadius:"50%",background:T.text.orange,display:"inline-block"}}/>}
                  </div>
                  <span style={{fontSize:7,color:T.text.muted,whiteSpace:"nowrap"}}>{e.time}</span>
                </div>
                <div style={{fontSize:8,fontWeight:e.unread?600:400,color:e.unread?T.text.primary:T.text.secondary,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.subject}</div>
                <div style={{fontSize:7,color:T.text.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.preview}</div>
                <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap" as const}}>
                  {e.tag&&<Bd c={TAG_COLORS[e.tag]||T.text.muted}>{e.tag}</Bd>}
                  {e.deal&&<Bd c={T.text.amber}>{e.deal}</Bd>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reading Pane ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          {!activeEmail&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
              <div style={{fontSize:10,color:T.text.muted}}>Select an email to read</div>
            </div>
          )}
          {activeEmail&&(
            <>
              <div style={{padding:"10px 16px",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text.primary,marginBottom:4}}>{activeEmail.subject}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                  <span style={{fontSize:9,fontWeight:600,color:T.text.amber}}>{activeEmail.from}</span>
                  <span style={{fontSize:8,color:T.text.muted}}>{activeEmail.org}</span>
                  <span style={{fontSize:7,color:T.text.muted}}>· {activeEmail.date}</span>
                  {activeEmail.tag&&<Bd c={TAG_COLORS[activeEmail.tag]||T.text.muted}>{activeEmail.tag}</Bd>}
                  {activeEmail.deal&&<Bd c={T.text.amber}>{activeEmail.deal}</Bd>}
                </div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  {["REPLY","REPLY ALL","FORWARD"].map(a=>(
                    <button key={a} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:600,background:T.bg.input,color:T.text.secondary,border:`1px solid ${T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>{a}</button>
                  ))}
                  <div style={{flex:1}}/>
                  {activeEmail.deal&&<button onClick={()=>{ const d=DEALS.find(deal=>deal.name===activeEmail.deal); if(d) enterDeal(d); }} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,background:T.text.amber+"22",color:T.text.amber,border:`1px solid ${T.text.amber}44`,padding:"2px 8px",cursor:"pointer"}}>OPEN CAPSULE →</button>}
                </div>
              </div>
              <div style={{flex:1,overflow:"auto",padding:"16px 18px"}}>
                <pre style={{fontFamily:T.font.label,fontSize:10,color:T.text.primary,lineHeight:"1.7",whiteSpace:"pre-wrap",margin:0}}>{activeEmail.body}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const ViewTools = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="TOOLS" subtitle="Tasks · Reports · Team" borderColor={T.text.muted}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:T.border.subtle,margin:10}}>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>TASKS</div>
          {["DD checklist: Dadeland Station (3 open)","Zoning review: Nocatee Parcel 7-A","Insurance quote: Riverview Preserve","LOI review: Westshore Commons"].map((t,i)=>(
            <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`,fontSize:8,color:T.text.secondary}}>{t}</div>
          ))}
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>REPORTS</div>
          {["Deal Memo: Westshore Commons","LP Quarterly Report Q1 2026 (draft)","Market Report: Tampa MSA (auto)","Comp Report: Dadeland submarket"].map((r,i)=>(
            <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`,fontSize:8,color:T.text.secondary}}>{r}</div>
          ))}
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>TEAM</div>
          {[{n:"James R.",role:"Principal",status:"Active"},{n:"Marcus C.",role:"Analyst",status:"Active"},{n:"Sarah K.",role:"Researcher",status:"Active"},{n:"David P.",role:"Advisor",status:"Active"}].map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
              <div><div style={{fontSize:9,color:T.text.primary,fontWeight:600}}>{m.n}</div><div style={{fontSize:7,color:T.text.muted}}>{m.role}</div></div>
              <Bd c={T.text.green}>{m.status}</Bd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── DEAL CONTEXT VIEWS ─────────────────────────────────────
  const DealOverview = () => {
    const d=activeDeal!;
    const sc=d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red;
    const signals=[{l:"DEMAND",v:88,w:"30%"},{l:"SUPPLY",v:72,w:"25%"},{l:"MOMENTUM",v:85,w:"20%"},{l:"POSITION",v:79,w:"15%"},{l:"RISK",v:81,w:"10%"}];
    return (
      <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
        <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:1,background:T.border.subtle}}>
          <div style={{background:T.bg.panel,padding:14,display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{fontSize:8,color:T.text.muted,letterSpacing:1.5,marginBottom:6}}>JEDI SCORE</div>
            <div style={{width:100,height:100,borderRadius:"50%",border:`3px solid ${sc}`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",boxShadow:`0 0 20px ${sc}33`}}>
              <span style={{fontSize:32,fontWeight:800,color:sc}}>{d.score}</span>
              <span style={{fontSize:9,color:d.delta.startsWith("+")?T.text.green:T.text.red,fontWeight:600}}>{d.delta} 30d</span>
            </div>
            <div style={{fontSize:8,color:T.text.muted,marginTop:6}}>Confidence: 87%</div>
            <Spark data={d.trend} color={sc} w={120} h={24}/>
          </div>
          <div style={{background:T.bg.panel,padding:14}}>
            <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:8}}>5 MASTER SIGNALS</div>
            {signals.map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <span style={{fontSize:8,color:T.text.muted,minWidth:70,letterSpacing:0.5}}>{s.l} <span style={{fontSize:7}}>({s.w})</span></span>
                <div style={{flex:1,height:6,background:T.bg.terminal,position:"relative"}}><div style={{height:"100%",width:`${s.v}%`,background:s.v>=80?T.text.green:s.v>=60?T.text.amber:T.text.red}}/></div>
                <span style={{fontSize:10,fontWeight:700,color:s.v>=80?T.text.green:s.v>=60?T.text.amber:T.text.red,minWidth:24}}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:1,background:T.border.subtle}}>
          {[{l:"BTS",v:84,win:true},{l:"FLIP",v:58},{l:"RENTAL",v:69},{l:"STR",v:45}].map((s,i)=>(
            <div key={i} style={{background:T.bg.panel,padding:10,borderTop:s.win?`2px solid ${T.text.amber}`:"2px solid transparent",textAlign:"center"}}>
              <div style={{fontSize:8,color:T.text.muted,letterSpacing:1}}>{s.l}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.win?T.text.amber:T.text.secondary}}>{s.v}</div>
              {s.win&&<Bd c={T.text.amber}>RECOMMENDED</Bd>}
            </div>
          ))}
        </div>
        <div style={{padding:8,background:T.text.amber+"08",borderLeft:`3px solid ${T.text.amber}`,margin:"1px 0"}}>
          <span style={{fontSize:9,color:T.text.amber,fontWeight:600}}>ARBITRAGE DETECTED:</span>
          <span style={{fontSize:9,color:T.text.secondary}}> BTS outscores Rental by 15pts. Zoning allows 3x density, supply pipeline thin for new construction.</span>
        </div>
      </div>
    );
  };

  const DealStrategy = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="STRATEGY ARBITRAGE" subtitle="M08 | 4-Strategy Comparison" borderColor={T.text.purple}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:1,background:T.border.subtle}}>
        {[
          {s:"BUILD-TO-SELL",sc:84,irr:"24.3%",yoc:"7.2%",time:"24mo",win:true,signals:{D:88,S:72,M:85,P:79,R:81}},
          {s:"FLIP",sc:58,irr:"21.5%",yoc:"N/A",time:"8mo",signals:{D:60,S:55,M:72,P:52,R:48}},
          {s:"RENTAL",sc:69,irr:"18.7%",yoc:"5.8%",time:"Hold",signals:{D:75,S:68,M:62,P:70,R:72}},
          {s:"STR",sc:45,irr:"12.4%",yoc:"4.4%",time:"Hold",signals:{D:42,S:40,M:55,P:48,R:38}},
        ].map((col,ci)=>(
          <div key={ci} style={{background:T.bg.panel,borderTop:col.win?`3px solid ${T.text.amber}`:"3px solid transparent"}}>
            <div style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${T.border.subtle}`}}>
              <div style={{fontSize:9,fontWeight:700,color:col.win?T.text.amber:T.text.secondary,letterSpacing:1}}>{col.s}</div>
              <div style={{fontSize:28,fontWeight:800,color:col.win?T.text.amber:T.text.muted,marginTop:2}}>{col.sc}</div>
              {col.win&&<Bd c={T.text.amber}>WINNER +15</Bd>}
            </div>
            <div style={{padding:8}}>
              {[{l:"IRR",v:col.irr},{l:"YOC",v:col.yoc},{l:"TIMELINE",v:col.time}].map((m,mi)=>(
                <div key={mi} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                  <span style={{fontSize:8,color:T.text.muted}}>{m.l}</span>
                  <span style={{fontSize:9,fontWeight:700,color:T.text.amber}}>{m.v}</span>
                </div>
              ))}
              <div style={{marginTop:6,fontSize:8,color:T.text.muted,letterSpacing:1}}>SIGNALS</div>
              {Object.entries(col.signals).map(([k,v])=>(
                <div key={k} style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                  <span style={{fontSize:7,color:T.text.muted,minWidth:14}}>{k}</span>
                  <div style={{flex:1,height:4,background:T.bg.terminal}}><div style={{height:"100%",width:`${v}%`,background:v>=75?T.text.green:v>=55?T.text.amber:T.text.red}}/></div>
                  <span style={{fontSize:7,fontWeight:700,color:v>=75?T.text.green:v>=55?T.text.amber:T.text.red}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const DealStub = ({title,module,items}:{title:string;module:string;items:{title:string;desc:string}[]}) => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title={title} subtitle={module} borderColor={T.text.cyan}/>
      <div style={{padding:12}}>
        {items.map((item,i)=>(
          <div key={i} style={{padding:"6px 8px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{fontSize:9,color:T.text.primary}}>{item.title}</div>
            <div style={{fontSize:8,color:T.text.muted,marginTop:2}}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── MAIN CONTENT ROUTER ─────────────────────────────────────
  const renderContent = () => {
    if(ctx==="portfolio") {
      switch(fkey) {
        case "F1": return ViewDashboard();
        case "F2": return DealGrid();
        case "F3": return ViewPortfolio();
        case "F4": return ViewMarkets();
        case "F5": return ViewEmail();
        case "F6": return ViewCompete();
        case "F7": return <ViewStrategies/>;
        case "F8": return <ViewTools/>;
        default: return null;
      }
    } else {
      switch(fkey) {
        case "F1": return <DealOverview/>;
        case "F2": return <DealStub title="PROPERTY & ZONING" module="M02" items={[{title:"Zoning: PD-C (Planned Dev Commercial)",desc:"Municode 27-156 | Max density 18 DU/ac | Height 65ft | FAR 2.0"},{title:"Entitlement Status: Pre-Application",desc:"Estimated timeline: 8-12mo | Monte Carlo p50: 10mo"},{title:"Source Chain: 10/10 links verified",desc:"Planning → Permitted Uses → Dev Capacity → HBU → Strategy"},{title:"Setbacks: Front 25ft | Side 10ft | Rear 20ft",desc:"Source: Municode 27-156.4(b) | Verified 3/1/2026"}]}/>;
        case "F3": return <DealStub title="MARKET & DEMAND" module="M05+M06" items={[{title:"Trade Area: 3-mile radius, 42,000 residents",desc:"Avg HHI $78,200 | Renter pct 58% | Growth +2.1% YoY"},{title:"Demand Score: 88 (Strong)",desc:"Absorption 1.3x pipeline | Employment +3.2% | Population inflow"},{title:"Rent Comp: $1,908/mo avg effective",desc:"+3.0% growth 90d | Accelerating trend"},{title:"Market Vitals: 5 tracked metrics",desc:"Vacancy 8.5% | Absorbed 11,658/wk | Strength 40th pctl"}]}/>;
        case "F4": return <DealStub title="SUPPLY PIPELINE" module="M04" items={[{title:"Active Pipeline: 1,240 units within trade area",desc:"Delivering Q3 2026: 380u | Q1 2027: 860u"},{title:"Threat Level: MODERATE",desc:"Pipeline-to-stock ratio: 4.2% (below 5% threshold)"},{title:"Nearest Competitor: Greystar 380u tower",desc:"2.1 miles | Luxury segment | Est. absorption 18mo"},{title:"10-Year Capacity Forecast",desc:"Zoned capacity: 8,400 units | Current stock: 14,200 | Headroom: 59%"}]}/>;
        case "F5": return <DealStrategy/>;
        case "F6": return <DealStub title="PRO FORMA ENGINE" module="M09" items={[{title:"Baseline NOI: $2,840,000",desc:"Broker assumption | Cap rate 5.2% going-in"},{title:"Platform-Adjusted NOI: $2,680,000 (-5.6%)",desc:"AI detected: broker rent growth +4% vs market +3.0%. Insurance understated 22%"},{title:"3-Layer Model Active",desc:"Layer 1: Broker | Layer 2: Platform Intel | Layer 3: Your overrides"},{title:"Sensitivity: IRR range 18.4% - 28.1%",desc:"Key driver: exit cap rate (4.8% - 5.6% range)"}]}/>;
        case "F7": return <DealStub title="CAPITAL STRUCTURE" module="M11" items={[{title:"Senior Debt: $28.8M (75% LTC)",desc:"Rate: SOFR + 275bps | IO 24mo | Term 36mo"},{title:"Mezzanine: $3.8M (10% LTC)",desc:"Rate: 12% fixed | Current pay"},{title:"Equity: $5.9M (15%)",desc:"IRR target: 24% | EM target: 2.8x | Hold: 24mo"},{title:"Capital Stack Visual",desc:"75% senior | 10% mezz | 15% equity | WACC: 8.2%"}]}/>;
        case "F8": return <DealStub title="RISK ASSESSMENT" module="M14" items={[{title:"Overall Risk Score: 32 (LOW)",desc:"Supply: 28 | Regulatory: 18 | Market: 35 | Execution: 42 | Climate: 24 | Insurance: 38"},{title:"Top Risk: Execution (42)",desc:"First-time development in this submarket. Mitigated by experienced GC partnership."},{title:"Insurance Risk: 38",desc:"FL wind zone but inland. Rate capped at 8% per new legislation."},{title:"Monte Carlo: 94% probability of meeting target IRR",desc:"1,000 simulations | p10: 18.4% | p50: 24.3% | p90: 31.2%"}]}/>;
        default: return <DealStub title={DEAL_NAV.find(n=>n.key===fkey)?.label||"MODULE"} module={DEAL_NAV.find(n=>n.key===fkey)?.m||""} items={[{title:"Module content loads here",desc:"This module renders in Bloomberg L1-L4 layout patterns"}]}/>;
      }
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{background:T.bg.terminal,height:"100vh",fontFamily:T.font.mono,color:T.text.primary,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>
      {/* CRT scanline overlay */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)"}}/>

      {/* ═══ TOP STATUS BAR — 36px ═══ */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:36,background:T.bg.topBar,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontFamily:T.font.display,fontSize:14,fontWeight:800,color:T.text.amber,letterSpacing:2}}>JEDI RE</span>
          <span style={{fontSize:9,color:T.text.muted}}>|</span>
          <span style={{fontSize:9,color:T.text.secondary}}>{ctx==="portfolio"?"PORTFOLIO VIEW":"DEAL CAPSULE"}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:9,color:T.text.green,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:T.text.green,animation:"glow 2s infinite"}}/>{AGENTS.filter(a=>a.st==="ON").length} AGENTS</span>
          <span style={{fontSize:9,color:T.text.cyan}}>EMAIL: {unreadEmails}</span>
          <span style={{fontSize:9,color:T.text.secondary}}>KAFKA: 312/s</span>
          <span style={{fontSize:9,color:T.text.amber,fontWeight:600}}>{time.toLocaleTimeString("en-US",{hour12:false})}</span>
          {/* Theme toggle */}
          <button onClick={toggleTheme} style={{fontFamily:T.font.mono,fontSize:12,background:"transparent",border:`1px solid ${T.border.medium}`,color:T.text.secondary,padding:"2px 8px",cursor:"pointer",lineHeight:1}} title={theme==="dark"?"Switch to light mode":"Switch to dark mode"}>
            {theme==="dark"?"☀":"☾"}
          </button>
        </div>
      </div>

      {/* ═══ TICKER — 27px ═══ */}
      <div style={{height:27,background:"#06080E",borderBottom:`1px solid ${T.border.subtle}`,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center"}}>
        <div style={{display:"flex",gap:24,whiteSpace:"nowrap",animation:"ticker 45s linear infinite",fontSize:9,lineHeight:"27px"}}>
          {[...tickers,...tickers].map((t,i)=>(
            <span key={i} style={{color:t.startsWith("^")?T.text.green:t.startsWith("v")?T.text.red:T.text.amber}}>{t}</span>
          ))}
        </div>
      </div>

      {/* ═══ KPI BAR (portfolio only) ═══ */}
      {ctx==="portfolio" && (
        <div style={{display:"flex",alignItems:"stretch",background:T.bg.panel,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,height:50}}>
          {[
            {l:"TOTAL PIPELINE",v:`$${totalPV.toFixed(1)}M`,c:T.text.amberBright,sub:`${DEALS.length} deals`},
            {l:"ACTIVE DEALS",v:String(DEALS.filter(d=>d.stage==="DD"||d.stage==="LOI").length),c:T.text.cyan,sub:"in progress"},
            {l:"PORTFOLIO ASSETS",v:"23",c:T.text.green,sub:"owned"},
            {l:"AVG DAYS/DEAL",v:String(Math.round(DEALS.reduce((s,d)=>s+d.days,0)/DEALS.length)),c:T.text.amber,sub:"avg time"},
          ].map((kpi,i)=>(
            <div key={i} style={{padding:"4px 14px",borderRight:`1px solid ${T.border.subtle}`,minWidth:110}}>
              <div style={{fontSize:7,fontWeight:600,color:T.text.muted,letterSpacing:1}}>{kpi.l}</div>
              <div style={{fontSize:16,fontWeight:800,color:kpi.c}}>{kpi.v}</div>
              <div style={{fontSize:7,color:T.text.secondary}}>{kpi.sub}</div>
            </div>
          ))}
          <div style={{padding:"4px 14px",borderRight:`1px solid ${T.border.subtle}`,minWidth:120}}>
            <div style={{fontSize:7,fontWeight:600,color:T.text.muted,letterSpacing:1}}>BY STAGE</div>
            <div style={{display:"flex",gap:10}}>{Object.entries(stages).map(([s,c])=>(
              <div key={s} style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:700,color:c>0?T.text.amber:T.text.muted}}>{c}</div><div style={{fontSize:6,color:T.text.muted}}>{s}</div></div>
            ))}</div>
          </div>
          <div onClick={()=>setBottomTab("alerts")} style={{padding:"4px 14px",borderRight:`1px solid ${T.border.subtle}`,cursor:"pointer",minWidth:80}}>
            <div style={{fontSize:7,fontWeight:600,color:T.text.muted,letterSpacing:1}}>ALERTS</div>
            <div style={{fontSize:16,fontWeight:800,color:hAlerts>0?T.text.red:T.text.green,animation:hAlerts>0?"pulse 2s infinite":"none"}}>{hAlerts}</div>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",gap:6,paddingRight:12}}>
            <button onClick={()=>{setMapOpen(true);setMapCreating(true);}} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:"transparent",color:T.text.cyan,border:`1px solid ${T.text.cyan}`,padding:"5px 12px",cursor:"pointer",letterSpacing:0.4}}>+ NEW MAP</button>
            <button style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"6px 14px",cursor:"pointer",letterSpacing:0.5}}>+ CREATE DEAL</button>
          </div>
        </div>
      )}

      {/* ═══ DEAL CONTEXT BAR (deal only) ═══ */}
      {ctx==="deal" && activeDeal && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:32,background:T.text.amber+"08",borderBottom:`1px solid ${T.text.amber}22`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={exitDeal} style={{fontFamily:T.font.mono,fontSize:7,color:T.text.muted,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"2px 6px",cursor:"pointer",fontWeight:700}}>ESC</button>
            <span style={{fontSize:12,fontWeight:700,color:T.text.amber}}>{activeDeal.name}</span>
            <span style={{fontSize:9,color:T.text.secondary}}>{activeDeal.addr}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:15,fontWeight:800,color:activeDeal.score>=80?T.text.green:T.text.amber}}>{activeDeal.score}</span>
            <span style={{fontSize:9,color:activeDeal.delta.startsWith("+")?T.text.green:T.text.red}}>{activeDeal.delta}</span>
            <StratBd s={activeDeal.strat} T={T}/>
            <StageBd stage={activeDeal.stage} T={T}/>
          </div>
        </div>
      )}

      {/* ═══ F-KEY NAV BAR ═══ */}
      <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,background:T.bg.header}}>
        <div style={{display:"flex",flex:1,overflow:"auto"}}>
          {nav.map(n=>(
            <button key={n.key} onClick={()=>setFkey(n.key)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:600,padding:"0 11px",height:30,cursor:"pointer",background:fkey===n.key?T.text.amber:"transparent",color:fkey===n.key?T.bg.terminal:T.text.secondary,border:"none",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0}}>
              <span style={{fontSize:7,fontWeight:700,opacity:0.6,color:fkey===n.key?T.bg.terminal:T.text.muted}}>{n.key}</span>
              {n.label}
              {"m" in n && n.m && <span style={{fontSize:6,opacity:0.5,marginLeft:1}}>{(n as typeof DEAL_NAV[0]).m}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"0 8px",borderLeft:`1px solid ${T.border.medium}`}}>
          <div style={{display:"flex",alignItems:"center",gap:3,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"0 6px",height:22,width:190}}>
            <span style={{color:T.text.amber,fontSize:9,fontWeight:700}}>{">"}</span>
            <input value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="CMD (/ to focus)" style={{background:"transparent",border:"none",outline:"none",fontFamily:T.font.mono,fontSize:9,color:T.text.primary,flex:1,width:"100%"}}/>
            <span style={{width:6,height:12,background:T.text.amber,animation:"blink 1s infinite",display:"inline-block"}}/>
          </div>
        </div>
      </div>

      {/* ═══ GLOBAL FILTER TOOLBAR (portfolio only) ═══ */}
      {ctx==="portfolio" && (
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 10px",height:32,background:T.bg.panel,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
          <span style={{fontSize:8,color:T.text.muted,fontWeight:600,letterSpacing:0.5}}>FILTER:</span>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{fontFamily:T.font.mono,fontSize:8,background:T.bg.input,color:T.text.secondary,border:`1px solid ${T.border.subtle}`,padding:"2px 6px",height:22}}>
            <option value="ALL">All Stages</option>
            {["DD","LOI","PROSPECT","LEAD"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fStrat} onChange={e=>setFStrat(e.target.value)} style={{fontFamily:T.font.mono,fontSize:8,background:T.bg.input,color:T.text.secondary,border:`1px solid ${T.border.subtle}`,padding:"2px 6px",height:22}}>
            <option value="ALL">All Strats</option>
            {["BTS","FLIP","RENTAL","STR"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>setMapOpen(!mapOpen)} style={{fontFamily:T.font.mono,fontSize:8,fontWeight:600,background:mapOpen?T.text.amber:T.bg.input,color:mapOpen?T.bg.terminal:T.text.secondary,border:`1px solid ${mapOpen?T.text.amber:T.border.subtle}`,padding:"2px 8px",height:22,cursor:"pointer"}}>
            MAP
          </button>
          <div style={{flex:1}}/>
          {fStage!=="ALL"&&<Bd c={T.text.cyan}>{fStage}</Bd>}
          {fStrat!=="ALL"&&<Bd c={T.text.purple}>{fStrat}</Bd>}
          <span style={{fontSize:8,color:T.text.muted}}>{sorted.length} deals</span>
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        {renderContent()}
        {ctx==="portfolio" && mapOpen && <MapSidebar/>}
      </div>

      {/* ═══ PERSISTENT BOTTOM PANEL (portfolio only) ═══ */}
      {ctx==="portfolio" && (
        <div style={{height:190,borderTop:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panel}}>
          <div style={{display:"flex",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
            {[
              {id:"alerts",l:"ALERTS",ct:hAlerts,cc:T.text.red},
              {id:"news",l:"NEWS",ct:NEWS.length,cc:T.text.cyan},
              {id:"email",l:"EMAIL",ct:unreadEmails,cc:T.text.orange},
              {id:"agents",l:"AGENTS",ct:AGENTS.filter(a=>a.st==="ON").length,cc:T.text.green},
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setBottomTab(tab.id)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:600,color:bottomTab===tab.id?T.bg.terminal:T.text.secondary,background:bottomTab===tab.id?T.text.amber:"transparent",border:"none",cursor:"pointer",padding:"4px 14px",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                {tab.l}
                <span style={{fontSize:7,fontWeight:700,padding:"0px 4px",background:bottomTab===tab.id?"rgba(0,0,0,0.2)":tab.cc+"18",color:bottomTab===tab.id?"rgba(0,0,0,0.7)":tab.cc}}>{tab.ct}</span>
              </button>
            ))}
          </div>
          <div style={{flex:1,overflow:"auto"}}>
            {bottomTab==="alerts" && ALERTS.map((a,i)=>{
              const bc=({critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted} as Record<string,string>)[a.sev];
              return <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}><div style={{flex:1}}><div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd>{a.deal&&<span style={{fontSize:8,color:T.text.amber,fontWeight:600}}>{a.deal}</span>}</div><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div></div><span style={{fontSize:7,color:T.text.muted}}>{a.time}</span></div>;
            })}
            {bottomTab==="news" && NEWS.map((n,i)=>(
              <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
                <span style={{fontSize:8,color:T.text.muted,minWidth:30}}>{n.time}</span>
                <div style={{flex:1}}><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{n.hl}</div>{n.affects.length>0&&<div style={{display:"flex",gap:3,marginTop:2}}>{n.affects.map((a,j)=><Bd key={j} c={T.text.amber}>{a}</Bd>)}</div>}</div>
                <div style={{textAlign:"right",minWidth:50}}><div style={{fontSize:8,fontWeight:700,color:n.impact.includes("+")?T.text.green:T.text.red}}>{n.impact}</div><div style={{fontSize:8,color:n.pts.startsWith("+")?T.text.green:T.text.red}}>{n.pts}</div></div>
              </div>
            ))}
            {bottomTab==="email" && EMAILS.map((e,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,background:e.unread?T.text.amber+"06":T.bg.panel}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:1}}>
                    <span style={{fontSize:9,fontWeight:e.unread?700:400,color:e.unread?T.text.primary:T.text.secondary}}>{e.from}</span>
                    {e.unread&&<span style={{width:5,height:5,borderRadius:"50%",background:T.text.orange,display:"inline-block"}}/>}
                  </div>
                  <div style={{fontSize:9,color:e.unread?T.text.primary:T.text.secondary,fontWeight:e.unread?600:400,lineHeight:1.3}}>{e.subject}</div>
                  {e.deal&&<div style={{marginTop:2}}><Bd c={T.text.amber}>{e.deal}</Bd></div>}
                </div>
                <span style={{fontSize:7,color:T.text.muted,whiteSpace:"nowrap"}}>{e.time}</span>
              </div>
            ))}
            {bottomTab==="agents" && (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border.subtle}}>
                {AGENTS.map((a,i)=>(
                  <div key={i} style={{background:T.bg.panel,padding:"5px 8px",borderLeft:a.st==="ON"?`2px solid ${T.text.green}`:`2px solid ${T.text.muted}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:8,fontWeight:700,color:T.text.purple}}>{a.id} <span style={{color:T.text.primary}}>{a.name}</span></span><span style={{fontSize:7,color:a.st==="ON"?T.text.green:T.text.muted}}>{a.st}</span></div>
                    <div style={{fontSize:8,color:T.text.secondary,lineHeight:1.3}}>{a.act}</div>
                    <div style={{fontSize:7,color:T.text.muted,marginTop:1}}>{a.t} ago · {a.m} msgs</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATUS BAR ═══ */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",height:16,background:T.bg.topBar,borderTop:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",gap:12}}><span style={{fontSize:7,color:T.text.muted}}>JEDI RE v0.32</span><span style={{fontSize:7,color:T.text.muted}}>REACT + VITE + MAPBOX + ZUSTAND + KAFKA</span></div>
        <div style={{display:"flex",gap:12}}><span style={{fontSize:7,color:T.text.green}}>DB OK</span><span style={{fontSize:7,color:T.text.green}}>REDIS OK</span><span style={{fontSize:7,color:T.text.muted}}>{time.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span></div>
      </div>
    </div>
  );
}
