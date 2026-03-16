import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, api } from "../services/api.client";
import { useCorporateHealthStore, useCorporateHealth } from "../store/corporateHealthStore";
import { layersService } from "../services/layers.service";

// ═══════════════════════════════════════════════════════════════
// JEDI RE — BLOOMBERG TERMINAL  v3 (graduated from prototype)
// ═══════════════════════════════════════════════════════════════

// ─── TOKEN SYSTEM ─────────────────────────────────────────────
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
type ThemeType = typeof DARK;

const TERMINAL_CSS = `
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

// ─── STATIC FALLBACK DATA ─────────────────────────────────────
const STATIC_ALERTS = [
  {id:"a1",type:"ARBITRAGE",sev:"critical",msg:"BTS outscores Rental by 22pts in current pipeline — rate environment favors construction exit",deal:"Pipeline",time:"10m"},
  {id:"a2",type:"RISK",sev:"high",msg:"Insurance risk elevated on STR deals. FL wind zone + STR uncertainty compounding.",deal:null,time:"34m"},
  {id:"a3",type:"MARKET",sev:"med",msg:"Tampa MSA absorption exceeded 95% for 2nd consecutive month — supply constrained",deal:null,time:"1h"},
  {id:"a4",type:"DEADLINE",sev:"high",msg:"Review outstanding DD checklists — 3 items flagged past target date",deal:null,time:"2h"},
  {id:"a5",type:"MARKET",sev:"low",msg:"Tampa MSA absorption exceeded 95% for 2nd consecutive month",deal:null,time:"3h"},
];

const STATIC_NEWS = [
  {id:"n1",time:"14:23",hl:"Amazon announces 2,000-job Tampa HQ expansion",impact:"+DEMAND",pts:"+3.2",affects:["Pipeline"]},
  {id:"n2",time:"13:41",hl:"Greystar breaks ground 380-unit tower Downtown Tampa",impact:"+SUPPLY",pts:"-1.8",affects:[]},
  {id:"n3",time:"11:15",hl:"FL Legislature passes insurance reform, 8% rate cap",impact:"RISK DN",pts:"+1.2",affects:["All FL"]},
  {id:"n4",time:"09:32",hl:"Nocatee named #2 top-selling MPC nationally",impact:"+DEMAND",pts:"+2.4",affects:[]},
  {id:"n5",time:"YST",hl:"Miami-Dade condo reserve law triggers $2.1B assessments",impact:"+DEMAND",pts:"+0.8",affects:[]},
];

const STATIC_AGENTS = [
  {id:"A01",name:"Data Collector",st:"ON",act:"Scraping comps Apartments.com",t:"2s",m:142},
  {id:"A03",name:"Zoning Agent",st:"ON",act:"Parsing Municode setback rules",t:"8s",m:38},
  {id:"A05",name:"Market Analyst",st:"ON",act:"Updating absorption metrics",t:"34s",m:87},
  {id:"A07",name:"Risk Scorer",st:"ON",act:"Recalculating insurance risk scores",t:"1m",m:64},
  {id:"A08",name:"Strategy Engine",st:"IDLE",act:"Awaiting new intake",t:"4m",m:23},
  {id:"A10",name:"Orchestrator",st:"ON",act:"Coordinating DD checklist review",t:"12s",m:312},
];

const STATIC_EMAILS = [
  {id:1,from:"Marcus Chen",org:"CBRE Capital Markets",subject:"LOI countersigned — next steps",preview:"Good news — seller's counsel returned the countersigned LOI...",time:"2h",deal:"Pipeline Deal",unread:true,folder:"inbox",tag:"LOI",body:"Marcus Chen\nCBRE Capital Markets\n\nLOI countersigned this afternoon. Wire earnest money by Friday EOD, schedule Phase I for next week."},
  {id:2,from:"Deal Engine",org:"JediRe System",subject:"Automated DD checklist reminder",preview:"3 due diligence items remain open...",time:"5h",deal:null,unread:true,folder:"inbox",tag:"DD",body:"AUTOMATED — DEAL ENGINE\n\n3 DD items outstanding. Review and close before deadline."},
  {id:3,from:"JP Morgan RE Debt",org:"JP Morgan",subject:"Term sheet ready for review",preview:"Please find attached the executed term sheet...",time:"1d",deal:null,unread:false,folder:"inbox",tag:"DEBT",body:"Please review the attached term sheet. Respond by Wednesday to hold pricing."},
];

const STATIC_TASKS = [
  {id:"T01",title:"Schedule structural inspection",deal:"Active Deal",pri:"critical",due:"Mar 20",status:"TODO",owner:"M.Dixon"},
  {id:"T02",title:"Wire earnest deposit",deal:"Active Deal",pri:"critical",due:"Mar 19",status:"TODO",owner:"M.Dixon"},
  {id:"T03",title:"Review Phase I ESA report",deal:"Pipeline",pri:"high",due:"Mar 22",status:"IN PROGRESS",owner:"S.Torres"},
  {id:"T04",title:"Update pro forma for rate change",deal:"Pipeline",pri:"high",due:"Mar 23",status:"TODO",owner:"R.Patel"},
  {id:"T05",title:"Pull 12-month rent rolls",deal:"Pipeline",pri:"med",due:"Mar 25",status:"TODO",owner:"R.Patel"},
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
  {key:"F8",label:"ORG TOOLS"},
  {key:"F9",label:"ORG SETTINGS"},
];

const WIDGET_CATALOG = [
  {id:"pipeline",   label:"Deal Pipeline",         desc:"Live scrollable deal list with JEDI scores",            category:"DEALS",  color:"#F5A623"},
  {id:"mydeals",    label:"My Deals",               desc:"Personal deal ownership, stage and status",            category:"DEALS",  color:"#00BCD4"},
  {id:"kpi",        label:"KPI Summary",            desc:"Pipeline value, active deals, portfolio metrics",       category:"DEALS",  color:"#FFD166"},
  {id:"leaderboard",label:"Score Leaderboard",      desc:"Deals ranked by JEDI score with trend lines",          category:"DEALS",  color:"#00D26A"},
  {id:"funnel",     label:"Stage Funnel",           desc:"Stage deal counts with pipeline value",                 category:"DEALS",  color:"#F5A623"},
  {id:"calendar",   label:"Deal Calendar",          desc:"Upcoming DD expiries, closings and deadlines",          category:"DEALS",  color:"#FF8C42"},
  {id:"findings",   label:"Key Findings",           desc:"AI-generated insights from News Intelligence",          category:"INTEL",  color:"#F5A623"},
  {id:"alerts",     label:"Alert Feed",             desc:"Critical and high-priority deal alerts",                category:"INTEL",  color:"#FF4757"},
  {id:"competitor", label:"Competitor Intelligence",desc:"Recent competitor closings and off-market activity",   category:"INTEL",  color:"#FF8C42"},
  {id:"aibrief",    label:"AI Daily Brief",         desc:"AI morning market summary and recommendations",         category:"INTEL",  color:"#00D26A"},
  {id:"vitals",     label:"Market Vitals",          desc:"Absorption, vacancy, and rent growth by market",        category:"MARKET", color:"#00BCD4"},
  {id:"rates",      label:"Interest Rate Monitor",  desc:"SOFR, Fed Funds, Prime, 10Y Treasury with trends",    category:"MARKET", color:"#00BCD4"},
  {id:"yieldcurve", label:"Treasury Yield Curve",   desc:"T-bill through 30Y yield curve chart",                 category:"MARKET", color:"#A78BFA"},
  {id:"caprates",   label:"Cap Rate Tracker",       desc:"Cap rates by asset class and market",                  category:"MARKET", color:"#A78BFA"},
  {id:"reits",      label:"REIT Market Watch",      desc:"Apartment, industrial and office REIT prices",         category:"MARKET", color:"#00D26A"},
  {id:"macro",      label:"Macro Indicators",       desc:"GDP, CPI, unemployment, housing starts",               category:"MARKET", color:"#FF4757"},
  {id:"debt",       label:"Debt Market Monitor",    desc:"CMBS spreads, agency rates, life company debt",        category:"MARKET", color:"#A78BFA"},
  {id:"strategy",   label:"Strategy Snapshot",      desc:"BTS / RENTAL / FLIP / STR performance breakdown",     category:"OPS",    color:"#A78BFA"},
  {id:"agents",     label:"Agent Activity",         desc:"Live status of all AI agents running",                 category:"OPS",    color:"#00D26A"},
  {id:"tasks",      label:"Task List",              desc:"Team task queue with deal assignments",                 category:"OPS",    color:"#FFD166"},
  {id:"tv",         label:"TV / Media",             desc:"Live business news channel selector",                  category:"MEDIA",  color:"#FF8C42"},
];

const TV_CHANNELS = [
  {id:"cnbc",label:"CNBC",url:"https://www.youtube.com/embed/9NyxcX3rhQs?autoplay=1&mute=1",color:"#005594"},
  {id:"bloomberg",label:"Bloomberg TV",url:"https://www.youtube.com/embed/dp8PhLsUcFE?autoplay=1&mute=1",color:"#472F92"},
  {id:"yahoo",label:"Yahoo Finance",url:"https://www.youtube.com/embed/hRs_gWRN0qs?autoplay=1&mute=1",color:"#6001D2"},
  {id:"foxbiz",label:"Fox Business",url:"https://www.youtube.com/embed/xSGDNwtIFz8?autoplay=1&mute=1",color:"#003366"},
];

const NEWS_SOURCES = [
  {id:"costar",label:"CoStar",rss:"https://product.costar.com/rss/news",color:"#0056B3"},
  {id:"globest",label:"Globe St",rss:"https://www.globest.com/feed/",color:"#1A5276"},
  {id:"bisnow",label:"Bisnow",rss:"https://www.bisnow.com/rss/feed",color:"#E74C3C"},
  {id:"trd",label:"The Real Deal",rss:"https://therealdeal.com/feed/",color:"#000000"},
  {id:"housingwire",label:"Housing Wire",rss:"https://www.housingwire.com/feed/",color:"#2E86C1"},
];

const SOCIAL_DEFAULTS = [
  {id:"x-cre",handle:"#CRE",label:"#CRE"},
  {id:"x-multifamily",handle:"#multifamily",label:"#multifamily"},
  {id:"x-costar",handle:"@CoStarGroup",label:"@CoStarGroup"},
];

interface MediaWindow {
  id: string;
  type: "tv"|"rss"|"social";
  title: string;
  color: string;
  url?: string;
  rssUrl?: string;
  handle?: string;
}

interface RssItem { title:string; link:string; pubDate:string; source:string; }

const MAP_TYPES = [
  {id:"warmaps",     label:"War Maps",      color:"#00D26A"},
  {id:"companalysis",label:"Comp Analysis", color:"#A78BFA"},
  {id:"brokerintel", label:"Broker Intel",  color:"#FF8C42"},
  {id:"marketheat",  label:"Market Heat",   color:"#00BCD4"},
];

const TICKERS = ["^ TAMPA CAP 5.2% (-15bps)","* MIAMI ABS 94.7%","v ORL PIPELINE +2400","^ JAX EMPL +3.2%","* FL HOME $412K","^ RENT TPA +3.7%","* FDOT I-275 148.2K","v INS +18% YoY","^ NOCATEE +42%","* TPA JOBS #3"];

// ─── API RESPONSE TYPES ──────────────────────────────────────
interface ApiDeal {
  id: string;
  name?: string;
  propertyAddress?: string;
  address?: string;
  city?: string;
  state?: string;
  purchasePrice?: number;
  dealValue?: number;
  budget?: number;
  units?: number;
  targetUnits?: number;
  pipelineStage?: string;
  stage?: string;
  state_field?: string;
  triageScore?: number;
  signalConfidence?: number;
  strategyName?: string;
  strategy_name?: string;
  dealType?: string;
  irr?: string;
  equityMultiple?: string;
  daysInStage?: number;
  daysInStation?: number;
  project_type?: string;
  projectType?: string;
}

interface ApiAlert {
  id?: string;
  alertType?: string;
  type?: string;
  severity?: string;
  message?: string;
  title?: string;
  dealName?: string;
  deal_name?: string;
  createdAt?: string;
}

interface ApiTask {
  id: string;
  title?: string;
  description?: string;
  dealName?: string;
  deal?: string;
  priority?: string;
  dueDate?: string;
  status?: string;
  assigneeName?: string;
  assignee?: string;
}

interface ApiNewsEvent {
  id?: string;
  publishedAt?: string;
  headline?: string;
  title?: string;
  description?: string;
  impact?: string;
  marketImpact?: string;
  sentiment?: string;
  scoreImpact?: number;
  affectedDeals?: string[];
  deals?: string[];
}

interface ApiEmail {
  id?: number;
  fromName?: string;
  from?: { name?: string; organization?: string };
  senderName?: string;
  fromOrg?: string;
  subject?: string;
  preview?: string;
  snippet?: string;
  body?: string;
  receivedAt?: string;
  dealName?: string;
  isRead?: boolean;
  tag?: string;
  label?: string;
}

// ─── LIVE DEAL ROW TYPE ───────────────────────────────────────
interface LiveDeal {
  id: string;
  name: string;
  addr: string;
  market: string;
  score: number;
  delta: string;
  strat: string;
  irr: string;
  em: string;
  units: number;
  price: string;
  ppu: string;
  stage: string;
  days: number;
  risk: string;
  trend: number[];
}

function mapApiDealToLive(d: ApiDeal): LiveDeal {
  const price = d.purchasePrice || d.dealValue || d.budget || 0;
  const units = d.units || d.targetUnits || 0;
  const stage = (d.pipelineStage || d.stage || d.state || "LEAD").toUpperCase().replace(/_/g," ");
  const stageKey = stage.includes("DD") || stage.includes("EXECUTION") ? "DD"
    : stage.includes("LOI") || stage.includes("UNDERWRITING") ? "LOI"
    : stage.includes("PROSPECT") || stage.includes("INTELL") ? "PROSPECT"
    : "LEAD";
  const score = d.triageScore || d.signalConfidence || 0;
  const ppu = units > 0 && price > 0 ? `$${Math.round(price/units/1000)}K` : "N/A";
  const priceStr = price > 0 ? `$${(price/1000000).toFixed(1)}M` : "—";
  return {
    id: d.id,
    name: d.name || "Untitled Deal",
    addr: d.propertyAddress || d.address || "",
    market: d.city ? `${d.city}${d.state ? ", " + d.state : ""}` : "—",
    score,
    delta: score > 0 ? "+0" : "—",
    strat: (d.strategyName || d.strategy_name || d.dealType || "N/A").toUpperCase().replace(/BUILD.TO.SELL/i,"BTS").replace(/SHORT.TERM RENTAL/i,"STR").slice(0,8),
    irr: d.irr || "—",
    em: d.equityMultiple || "—",
    units,
    price: priceStr,
    ppu,
    stage: stageKey,
    days: d.daysInStage || d.daysInStation || 0,
    risk: score >= 70 ? "LOW" : score >= 50 ? "MED" : "HIGH",
    trend: score > 0 ? [Math.max(0,score-10), Math.max(0,score-7), Math.max(0,score-4), Math.max(0,score-2), score] : [],
  };
}

// ─── UTILITY COMPONENTS ───────────────────────────────────────
function Spark({data,color,w=56,h=16}:{data:number[];color:string;w?:number;h?:number}) {
  if(!data||data.length<2) return <svg width={w} height={h}/>;
  const mx=Math.max(...data),mn=Math.min(...data),r=mx-mn||1;
  const p=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/r)*h}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={p} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}

function Bd({children,c}:{children:React.ReactNode;c:string}) {
  return <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,fontWeight:700,color:c,background:c+"18",border:`1px solid ${c}33`,padding:"1px 5px",letterSpacing:0.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>;
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

function MetricBox({label,value,sub,change,dir,color,T}:{label:string;value:string;sub:string;change?:string;dir?:string;color?:string;T:ThemeType}) {
  const valColor = color || T.text.amber;
  const chColor = dir==="up"?T.text.green:dir==="down"?T.text.red:T.text.secondary;
  return (
    <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"8px 10px",flex:1}}>
      <div style={{fontSize:8,color:T.text.muted,letterSpacing:1,fontWeight:600,marginBottom:4}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:2}}>
        <span style={{fontSize:18,fontWeight:800,color:valColor}}>{value}</span>
        <span style={{fontSize:10,color:T.text.secondary}}>{sub}</span>
      </div>
      {change && <div style={{fontSize:8,color:chColor,marginTop:2,fontWeight:600}}>{change}</div>}
      <Spark data={[3,4,3,5,4,6,5,7,8]} color={color||chColor||T.text.amber} w={80} h={12}/>
    </div>
  );
}

interface WinState { x:number; y:number; w:number; h:number; minimized:boolean; maximized:boolean; zIndex:number }

// ─── MAIN TERMINAL PAGE ───────────────────────────────────────
export default function TerminalPage() {
  const navigate = useNavigate();

  const cmdInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<"dark"|"light">(() => (localStorage.getItem("jedi-theme")||"dark") as "dark"|"light");
  const T = theme==="dark" ? DARK : LIGHT;

  // Core UI state
  const [time, setTime] = useState(new Date());
  const [fkey, setFkey] = useState("F1");
  const [cmd, setCmd] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState<"desc"|"asc">("desc");
  const [fStage, setFStage] = useState("ALL");
  const [fStrat, setFStrat] = useState("ALL");
  const [bottomTab, setBottomTab] = useState("alerts");
  const [mapOpen, setMapOpen] = useState(false);
  const [selDealId, setSelDealId] = useState<string|null>(null);

  // Floating window dashboard system
  const DASH_STORAGE_KEY = "jedi-dash-windows";
  const loadWinState = (): Record<string, WinState> => { try { const s = localStorage.getItem(DASH_STORAGE_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; } };
  const [dashWindows, setDashWindows] = useState<string[]>(() => { try { const s = localStorage.getItem("jedi-dash-open"); return s ? JSON.parse(s) : []; } catch { return []; } });
  const [winStates, setWinStates] = useState<Record<string,WinState>>(loadWinState);
  const [dashMenuOpen, setDashMenuOpen] = useState(false);
  const [dragInfo, setDragInfo] = useState<{id:string,ox:number,oy:number,mode:"move"|"resize"}|null>(null);
  const [topZ, setTopZ] = useState(10);
  const persistWins = (ids: string[], states: Record<string,WinState>) => { localStorage.setItem("jedi-dash-open", JSON.stringify(ids)); localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify(states)); };
  const [floatWidgets, setFloatWidgets] = useState<string[]>([]);
  const [widgetSizes, setWidgetSizes] = useState<Record<string,string>>({});
  const [widgetCols, setWidgetCols] = useState<Record<string,number>>({});
  const [widgetHeights, setWidgetHeights] = useState<Record<string,number>>({});
  const [gridResizing, setGridResizing] = useState<{id:string,startY:number,startH:number}|null>(null);
  const [gridDrag, setGridDrag] = useState<{id:string,x:number,y:number}|null>(null);
  const [gridDragOver, setGridDragOver] = useState<string|null>(null);

  // Org settings state (F9)
  const [orgData, setOrgData] = useState<any>(null);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [orgInvitations, setOrgInvitations] = useState<any[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [orgError, setOrgError] = useState("");
  const [orgSuccess, setOrgSuccess] = useState("");
  const [marketTab, setMarketTab] = useState<"overview"|"corphealth">("overview");
  interface CorpEmployer { company:string; ticker:string|null; employees:number|null; share:number; chs:number|null; tier:string|null; delta:number|null; submarket?:string; naics?:string; sector?:string; momentum?:string }
  interface CorpAlert { severity:string; message:string; time:string }
  interface DivSubmarket { name:string; msa:string|null; schi:number; divergence:number; signal:string; reHealth:number; hhi:number; top5Share:number; employerCount:number; publicCount:number }
  interface SectorRotEntry { naics:string; markets:Record<string,{avgCHS:number|null;count:number}> }
  interface CorpHealthLive { employers:CorpEmployer[]; schi:number|null; reHealth:number|null; divergence:number|null; herfindahl:number|null; alerts:CorpAlert[]; sectors:Record<string,number>; portfolioSubmarkets:DivSubmarket[]; topEmployers:CorpEmployer[]; sectorRotation:{sectors:SectorRotEntry[];markets:string[]}|null; loaded:boolean; loading:boolean }
  const [corpHealthLive, setCorpHealthLive] = useState<CorpHealthLive>({employers:[],schi:null,reHealth:null,divergence:null,herfindahl:null,alerts:[],sectors:{},portfolioSubmarkets:[],topEmployers:[],sectorRotation:null,loaded:false,loading:false});

  // Media floating windows (global overlay, separate from dashboard windows)
  const [mediaWindows, setMediaWindows] = useState<MediaWindow[]>([]);
  const [mediaWinStates, setMediaWinStates] = useState<Record<string,WinState>>({});
  const [mediaDragInfo, setMediaDragInfo] = useState<{id:string,ox:number,oy:number,mode:"move"|"resize"}|null>(null);
  const [mediaTopZ, setMediaTopZ] = useState(100);
  const [mediaWinDropdown, setMediaWinDropdown] = useState(false);
  const [rssCache, setRssCache] = useState<Record<string,{items:RssItem[],ts:number}>>({});

  const openMediaWindow = useCallback((win: MediaWindow) => {
    setMediaWindows(prev => {
      if (prev.find(w => w.id === win.id)) {
        const nz = mediaTopZ + 1; setMediaTopZ(nz);
        setMediaWinStates(ps => ({ ...ps, [win.id]: { ...ps[win.id], minimized: false, zIndex: nz } }));
        return prev;
      }
      const nz = mediaTopZ + 1; setMediaTopZ(nz);
      const idx = prev.length;
      setMediaWinStates(ps => ({ ...ps, [win.id]: { x: 80 + idx * 40, y: 60 + idx * 30, w: 520, h: 380, minimized: false, maximized: false, zIndex: nz } }));
      return [...prev, win];
    });
  }, [mediaTopZ]);

  const closeMediaWindow = useCallback((id: string) => {
    setMediaWindows(prev => prev.filter(w => w.id !== id));
    setMediaWinStates(prev => { const ns = { ...prev }; delete ns[id]; return ns; });
  }, []);

  const minimizeMediaWindow = useCallback((id: string) => {
    setMediaWinStates(prev => ({ ...prev, [id]: { ...prev[id], minimized: !prev[id]?.minimized } }));
  }, []);

  const maximizeMediaWindow = useCallback((id: string) => {
    setMediaWinStates(prev => {
      const cur = prev[id]; if (!cur) return prev;
      return { ...prev, [id]: { ...cur, maximized: !cur.maximized, minimized: false } };
    });
  }, []);

  const bringMediaToFront = useCallback((id: string) => {
    const nz = mediaTopZ + 1; setMediaTopZ(nz);
    setMediaWinStates(prev => ({ ...prev, [id]: { ...prev[id], zIndex: nz } }));
  }, [mediaTopZ]);

  const fetchRss = useCallback((rssUrl: string) => {
    const cached = rssCache[rssUrl];
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return;
    apiClient.get("/api/media/rss", { params: { url: rssUrl } })
      .then(res => {
        const items: RssItem[] = res.data?.data || [];
        setRssCache(prev => ({ ...prev, [rssUrl]: { items, ts: Date.now() } }));
      })
      .catch(() => {});
  }, [rssCache]);

  // Email UI state
  const [emailFolder, setEmailFolder] = useState("inbox");
  const [emailSearch, setEmailSearch] = useState("");
  const [selEmail, setSelEmail] = useState<number|null>(1);

  // Map layer state
  const [mapLayers, setMapLayers] = useState<{id:string;name:string;type:string;visible:boolean}[]>([]);
  const [mapCreating, setMapCreating] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [newMapType, setNewMapType] = useState("warmaps");

  // Live data state
  const [liveDeals, setLiveDeals] = useState<LiveDeal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState(STATIC_ALERTS);
  const [liveTasks, setLiveTasks] = useState(STATIC_TASKS);

  // Live bottom panel data
  const [liveNews, setLiveNews] = useState(STATIC_NEWS);
  const [liveEmails, setLiveEmails] = useState(STATIC_EMAILS);
  const [liveAgents] = useState(STATIC_AGENTS);

  // Flash animations for pipeline rows
  const [flashes, setFlashes] = useState<Record<string,boolean>>({});

  // ─── Effects ──────────────────────────────────────────────
  useEffect(() => { const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); }, []);

  useEffect(() => {
    if(liveDeals.length===0) return;
    const t=setInterval(()=>{
      const d=liveDeals[Math.floor(Math.random()*liveDeals.length)];
      setFlashes(p=>({...p,[d.id]:true}));
      setTimeout(()=>setFlashes(p=>({...p,[d.id]:false})),700);
    },5000);
    return()=>clearInterval(t);
  },[liveDeals]);

  useEffect(() => {
    setDealsLoading(true);
    apiClient.get("/api/v1/deals", { params:{ limit:100 } })
      .then(res => {
        const raw: ApiDeal[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.deals || []);
        setLiveDeals(raw.map(mapApiDealToLive));
      })
      .catch(() => setLiveDeals([]))
      .finally(() => setDealsLoading(false));
  },[]);

  useEffect(() => {
    apiClient.get("/api/v1/tasks", { params:{ limit:20 } })
      .then(res => {
        const raw: ApiTask[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.tasks || []);
        if(raw.length>0) {
          setLiveTasks(raw.slice(0,10).map((t: ApiTask) => ({
            id: t.id, title: t.title||t.description||"Task", deal: t.dealName||t.deal||"—",
            pri: (t.priority||"med").toLowerCase(), due: t.dueDate?new Date(t.dueDate).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—",
            status: (t.status||"TODO").toUpperCase().replace("PENDING","TODO").replace("COMPLETE","DONE"),
            owner: t.assigneeName||t.assignee||"—",
          })));
        }
      })
      .catch(()=>{});
  },[]);

  useEffect(() => {
    const sevMap: Record<string,string> = { red:"critical", yellow:"high", green:"low" };
    apiClient.get("/api/v1/jedi/alerts", { params:{ limit:30 } })
      .then(res => {
        const raw: ApiAlert[] = res.data?.data?.alerts || res.data?.alerts || [];
        if(raw.length > 0) {
          setLiveAlerts(raw.slice(0,20).map((a: ApiAlert, i: number) => ({
            id: a.id || String(i),
            type: (a.alertType || a.type || "INTEL").toUpperCase().replace(/_/g," ").slice(0,12),
            sev: sevMap[a.severity || ""] || a.severity || "med",
            msg: a.message || a.title || "Alert",
            deal: a.dealName || a.deal_name || null,
            time: a.createdAt ? (() => {
              const d = new Date(a.createdAt);
              const diff = Math.floor((Date.now() - d.getTime()) / 60000);
              return diff < 60 ? `${diff}m` : diff < 1440 ? `${Math.floor(diff/60)}h` : `${Math.floor(diff/1440)}d`;
            })() : "—",
          })));
        }
      })
      .catch(()=>{});
  },[]);

  useEffect(() => {
    apiClient.get("/api/v1/news/events", { params:{ limit:15 } })
      .then(res => {
        const raw: ApiNewsEvent[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.events || []);
        if(raw.length > 0) {
          setLiveNews(raw.slice(0,12).map((n: ApiNewsEvent, i: number) => ({
            id: n.id || String(i),
            time: n.publishedAt ? new Date(n.publishedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false}) : "—",
            hl: n.headline || n.title || n.description || "Market update",
            impact: n.impact || n.marketImpact || (n.sentiment === "positive" ? "+DEMAND" : n.sentiment === "negative" ? "RISK DN" : "INFO"),
            pts: n.scoreImpact ? (n.scoreImpact > 0 ? `+${n.scoreImpact.toFixed(1)}` : n.scoreImpact.toFixed(1)) : "0.0",
            affects: n.affectedDeals || n.deals || [],
          })));
        }
      })
      .catch(()=>{});
  },[]);

  useEffect(() => {
    apiClient.get("/api/v1/emails", { params:{ folder:"inbox", limit:15 } })
      .then(res => {
        const raw: ApiEmail[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.emails || []);
        if(raw.length > 0) {
          setLiveEmails(raw.slice(0,10).map((e: ApiEmail, i: number) => ({
            id: e.id || i,
            from: e.fromName || e.from?.name || e.senderName || "Sender",
            org: e.fromOrg || e.from?.organization || "",
            subject: e.subject || "(no subject)",
            preview: e.preview || e.snippet || e.body?.slice(0,80) || "",
            time: e.receivedAt ? (() => {
              const diff = Math.floor((Date.now() - new Date(e.receivedAt).getTime()) / 60000);
              return diff < 60 ? `${diff}m` : diff < 1440 ? `${Math.floor(diff/60)}h` : `${Math.floor(diff/1440)}d`;
            })() : "—",
            deal: e.dealName || null,
            unread: !e.isRead,
            folder: "inbox",
            tag: e.tag || e.label || null,
            body: e.body || "",
          })));
        }
      })
      .catch(()=>{});
  },[]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        cmdInputRef.current?.focus();
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if(tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
      const fKeyMap: Record<string,string> = { F1:"F1", F2:"F2", F3:"F3", F4:"F4", F5:"F5", F6:"F6", F7:"F7", F8:"F8", F9:"F9" };
      if(fKeyMap[e.key]) { e.preventDefault(); setFkey(fKeyMap[e.key]); }
      if(e.key === "/") { e.preventDefault(); cmdInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  },[]);

  // Floating window drag/resize
  useEffect(() => {
    if(!dragInfo) return;
    const onMove=(e:MouseEvent)=>{
      setWinStates(prev=>{
        const cur=prev[dragInfo.id];
        if(!cur) return prev;
        if(dragInfo.mode==="move") return{...prev,[dragInfo.id]:{...cur,x:e.clientX-dragInfo.ox,y:e.clientY-dragInfo.oy,maximized:false}};
        return{...prev,[dragInfo.id]:{...cur,w:Math.max(320,e.clientX-cur.x),h:Math.max(200,e.clientY-cur.y),maximized:false}};
      });
    };
    const onUp=()=>{setDragInfo(null);setWinStates(prev=>{persistWins(dashWindows,prev);return prev;});};
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[dragInfo,dashWindows]);

  // Media window drag/resize
  useEffect(() => {
    if(!mediaDragInfo) return;
    const onMove=(e:MouseEvent)=>{
      setMediaWinStates(prev=>{
        const cur=prev[mediaDragInfo.id];
        if(!cur) return prev;
        if(mediaDragInfo.mode==="move") return{...prev,[mediaDragInfo.id]:{...cur,x:e.clientX-mediaDragInfo.ox,y:e.clientY-mediaDragInfo.oy,maximized:false}};
        return{...prev,[mediaDragInfo.id]:{...cur,w:Math.max(320,e.clientX-cur.x),h:Math.max(200,e.clientY-cur.y),maximized:false}};
      });
    };
    const onUp=()=>setMediaDragInfo(null);
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[mediaDragInfo]);

  // Grid widget vertical resize
  useEffect(()=>{
    if(!gridResizing) return;
    const onMove=(e:MouseEvent)=>{const delta=e.clientY-gridResizing.startY;setWidgetHeights(prev=>({...prev,[gridResizing.id]:Math.max(120,gridResizing.startH+delta)}));};
    const onUp=()=>setGridResizing(null);
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[gridResizing]);

  // Grid widget drag-to-reorder
  useEffect(()=>{
    if(!gridDrag) return;
    const onMove=(e:MouseEvent)=>setGridDrag(prev=>prev?{...prev,x:e.clientX,y:e.clientY}:null);
    const onUp=()=>{
      if(gridDragOver&&gridDrag&&gridDragOver!==gridDrag.id){
        setDashWindows(prev=>{const arr=[...prev];const fi=arr.indexOf(gridDrag.id),ti=arr.indexOf(gridDragOver);if(fi!==-1&&ti!==-1){[arr[fi],arr[ti]]=[arr[ti],arr[fi]];}persistWins(arr,winStates);return arr;});
      }
      setGridDrag(null);setGridDragOver(null);
    };
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[gridDrag,gridDragOver,winStates]);

  // ─── Window helpers ────────────────────────────────────────
  const defaultWinPos = (id: string, idx: number): WinState => ({ x: 40 + idx * 30, y: 40 + idx * 30, w: 480, h: 340, minimized: false, maximized: false, zIndex: topZ + idx });
  const openWindow = useCallback((id: string) => {
    setDashWindows(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      const nz = topZ + 1;
      setTopZ(nz);
      setWinStates(ps => { const ns = { ...ps, [id]: ps[id] ? { ...ps[id], minimized: false, zIndex: nz } : defaultWinPos(id, next.length - 1) }; persistWins(next, ns); return ns; });
      return next;
    });
  }, [topZ]);
  const closeWindow = useCallback((id: string) => {
    setDashWindows(prev => { const next = prev.filter(w => w !== id); setWinStates(ps => { persistWins(next, ps); return ps; }); return next; });
  }, []);
  const minimizeWindow = useCallback((id: string) => {
    setWinStates(prev => { const ns = { ...prev, [id]: { ...prev[id], minimized: !prev[id]?.minimized } }; persistWins(dashWindows, ns); return ns; });
  }, [dashWindows]);
  const maximizeWindow = useCallback((id: string) => {
    setWinStates(prev => { const cur = prev[id]; if (!cur) return prev; const ns = { ...prev, [id]: { ...cur, maximized: !cur.maximized, minimized: false } }; persistWins(dashWindows, ns); return ns; });
  }, [dashWindows]);
  const bringToFront = useCallback((id: string) => {
    const nz = topZ + 1; setTopZ(nz);
    setWinStates(prev => { const ns = { ...prev, [id]: { ...prev[id], zIndex: nz } }; persistWins(dashWindows, ns); return ns; });
  }, [topZ, dashWindows]);
  const floatWidget = useCallback((id: string) => {
    const nz = topZ + 1; setTopZ(nz);
    setFloatWidgets(prev => prev.includes(id) ? prev : [...prev, id]);
    setWinStates(prev => ({ ...prev, [id]: prev[id] ? { ...prev[id], minimized: false, zIndex: nz } : defaultWinPos(id, 0) }));
  }, [topZ]);
  const dockWidget = useCallback((id: string) => {
    setFloatWidgets(prev => prev.filter(w => w !== id));
  }, []);
  const toggleSort = useCallback((c:string)=>{if(sortBy===c)setSortDir(d=>d==="desc"?"asc":"desc");else{setSortBy(c);setSortDir("desc");}}, [sortBy]);
  const toggleTheme = useCallback(()=>{const n=theme==="dark"?"light":"dark";setTheme(n);localStorage.setItem("jedi-theme",n);}, [theme]);

  // Map layer helpers
  const addMapLayer = () => {
    if(!newMapName.trim()) return;
    const localLayer = {id:`layer-${Date.now()}`,name:newMapName.trim(),type:newMapType,visible:true};
    const layerTypeMap: Record<string, "pin" | "bubble" | "heatmap" | "boundary" | "overlay"> = {
      warmaps:"overlay", deals:"pin", comps:"pin", companalysis:"bubble",
      brokerintel:"pin", marketheat:"heatmap", zoning:"boundary", transit:"overlay", schools:"pin",
    };
    const sourceTypeMap: Record<string, "assets" | "pipeline" | "email" | "news" | "market" | "custom"> = {
      warmaps:"market", deals:"pipeline", comps:"assets", companalysis:"market",
      brokerintel:"news", marketheat:"market", zoning:"custom", transit:"custom", schools:"custom",
    };
    layersService.createLayer({
      map_id: "terminal-default",
      name: newMapName.trim(),
      layer_type: layerTypeMap[newMapType] || "pin",
      source_type: sourceTypeMap[newMapType] || "custom",
      visible: true,
    }).then(created => {
      setMapLayers(prev=>[...prev,{id:created.id,name:created.name,type:newMapType,visible:true}]);
    }).catch(() => {
      setMapLayers(prev=>[...prev,localLayer]);
    });
    setNewMapName("");setMapCreating(false);
  };
  const toggleLayerVis = (id:string)=>setMapLayers(prev=>prev.map(l=>l.id===id?{...l,visible:!l.visible}:l));
  const deleteLayer = (id:string)=>setMapLayers(prev=>prev.filter(l=>l.id!==id));

  // ─── Computed values ───────────────────────────────────────
  const sorted = [...liveDeals]
    .filter(d=>(fStage==="ALL"||d.stage===fStage)&&(fStrat==="ALL"||d.strat.includes(fStrat.slice(0,3))))
    .sort((a,b)=>{const dir=sortDir==="desc"?-1:1;if(sortBy==="score")return(a.score-b.score)*dir;if(sortBy==="name")return a.name.localeCompare(b.name)*dir;if(sortBy==="days")return(a.days-b.days)*dir;return 0;});

  const totalPV = liveDeals.reduce((s,d)=>s+parseFloat(d.price.replace(/[$M,—]/g,"")||"0"),0);
  const activeCount = liveDeals.filter(d=>d.stage==="DD"||d.stage==="LOI").length;
  const hAlerts = liveAlerts.filter(a=>a.sev==="critical"||a.sev==="high").length;
  const stages:Record<string,number>={DD:0,LOI:0,PROSPECT:0,LEAD:0};
  liveDeals.forEach(d=>{if(stages[d.stage]!==undefined)stages[d.stage]++;});
  const gc = "30px 1.5fr 0.8fr 44px 40px 60px 52px 48px 56px 48px 46px 42px 42px";

  // ─── DEAL GRID (F2) ────────────────────────────────────────
  const DealGrid = () => (
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
      <div style={{display:"grid",gridTemplateColumns:gc,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        {[{l:"#"},{l:"PROPERTY",c:"name"},{l:"MARKET"},{l:"JEDI",c:"score"},{l:"D30",c:"delta"},{l:"STRAT"},{l:"IRR"},{l:"EM"},{l:"PRICE"},{l:"$/U"},{l:"STAGE"},{l:"RISK"},{l:"DAYS",c:"days"}].map((h,i)=>(
          <div key={i} onClick={()=>h.c&&toggleSort(h.c)} style={{padding:"3px 4px",fontSize:7,fontWeight:700,color:sortBy===h.c?T.text.amber:T.text.muted,letterSpacing:0.5,borderRight:`1px solid ${T.border.subtle}`,cursor:h.c?"pointer":"default",userSelect:"none"}}>
            {h.l}{h.c&&sortBy===h.c&&<span style={{color:T.text.amber,marginLeft:1}}>{sortDir==="desc"?"v":"^"}</span>}
          </div>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        {sorted.length===0&&!dealsLoading&&(
          <div style={{padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:12,color:T.text.muted}}>No deals in pipeline</div>
          </div>
        )}
        {sorted.map((d,i)=>(
          <div key={d.id}
            onClick={()=>setSelDealId(selDealId===d.id?null:d.id)}
            onDoubleClick={()=>navigate(`/deals/${d.id}`)}
            style={{display:"grid",gridTemplateColumns:gc,background:selDealId===d.id?T.bg.active:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",borderLeft:selDealId===d.id?`2px solid ${T.text.amber}`:"2px solid transparent",animation:flashes[d.id]?"flash 0.7s ease-out":"none"}}
          >
            <div style={{padding:4,fontSize:8,color:T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{i+1}</div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`}}>
              <div style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{d.name}</div>
              <div style={{fontSize:7,color:T.text.muted}}>{d.addr}</div>
            </div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`}}><div style={{fontSize:8,color:T.text.secondary}}>{d.market}</div></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:d.score>0?T.text.red:T.text.muted}}>{d.score>0?d.score:"—"}</span>
            </div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>
              <span style={{fontSize:9,fontWeight:600,color:d.delta.startsWith("+")?T.text.green:d.delta.startsWith("-")?T.text.red:T.text.muted}}>{d.delta}</span>
            </div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><StratBd s={d.strat} T={T}/></div>
            <div style={{padding:4,fontSize:9,fontWeight:700,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.irr}</div>
            <div style={{padding:4,fontSize:8,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.em}</div>
            <div style={{padding:4,fontSize:9,fontWeight:600,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.price}</div>
            <div style={{padding:4,fontSize:8,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.ppu}</div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><StageBd stage={d.stage} T={T}/></div>
            <div style={{padding:4,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><RiskDot level={d.risk} T={T}/></div>
            <div style={{padding:4,fontSize:8,color:d.days>30?T.text.orange:T.text.secondary,display:"flex",alignItems:"center"}}>{d.days>0?`${d.days}d`:"—"}</div>
          </div>
        ))}
        {selDealId&&(()=>{const d=sorted.find(x=>x.id===selDealId);return d?(
          <div style={{position:"sticky",bottom:0,background:T.bg.header,borderTop:`1px solid ${T.border.medium}`,padding:"8px 12px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:10,fontWeight:700,color:T.text.amber}}>{d.name}</span>
            <button onClick={()=>navigate(`/deals/${d.id}`)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"5px 14px",cursor:"pointer",letterSpacing:0.4}}>OPEN DEAL CAPSULE →</button>
            <button onClick={()=>setSelDealId(null)} style={{fontFamily:T.font.mono,fontSize:9,color:T.text.muted,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"4px 8px",cursor:"pointer"}}>ESC</button>
          </div>
        ):null;})()}
      </div>
    </div>
  );

  // ─── MAP SIDEBAR ───────────────────────────────────────────
  const MapSidebar = () => (
    <div style={{width:300,borderLeft:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panel}}>
      <PanelHeader T={T} title="MAP LAYERS" subtitle={`${mapLayers.length} layers`} right={<button onClick={()=>setMapOpen(false)} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0px 5px",cursor:"pointer"}}>✕</button>}/>
      {mapCreating&&(
        <div style={{padding:"8px 10px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.medium}`,animation:"fadeIn 0.12s",flexShrink:0}}>
          <div style={{fontSize:8,fontWeight:700,color:T.text.cyan,letterSpacing:0.5,marginBottom:6}}>NEW MAP LAYER</div>
          <input autoFocus value={newMapName} onChange={e=>setNewMapName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addMapLayer();if(e.key==="Escape")setMapCreating(false);}} placeholder="Layer name…" style={{width:"100%",boxSizing:"border-box",fontFamily:T.font.mono,fontSize:9,background:T.bg.input,color:T.text.primary,border:`1px solid ${T.border.medium}`,padding:"4px 7px",marginBottom:6,outline:"none"}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:6}}>
            {MAP_TYPES.map(mt=>(
              <button key={mt.id} onClick={()=>setNewMapType(mt.id)} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:600,padding:"3px 0",cursor:"pointer",background:newMapType===mt.id?mt.color+"22":"transparent",color:newMapType===mt.id?mt.color:T.text.muted,border:`1px solid ${newMapType===mt.id?mt.color:T.border.subtle}`}}>{mt.label}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={addMapLayer} style={{flex:1,fontFamily:T.font.mono,fontSize:8,fontWeight:700,padding:"4px 0",cursor:"pointer",background:T.text.cyan,color:T.bg.terminal,border:"none"}}>CREATE</button>
            <button onClick={()=>setMapCreating(false)} style={{fontFamily:T.font.mono,fontSize:8,padding:"4px 8px",cursor:"pointer",background:"transparent",color:T.text.muted,border:`1px solid ${T.border.subtle}`}}>CANCEL</button>
          </div>
        </div>
      )}
      <div style={{flexShrink:0,maxHeight:180,overflow:"auto",borderBottom:`1px solid ${T.border.medium}`}}>
        {mapLayers.length===0&&!mapCreating&&(
          <div style={{padding:"20px 10px",textAlign:"center"}}>
            <div style={{fontSize:8,color:T.text.muted,lineHeight:"1.6"}}>No layers yet.<br/>Click <span style={{color:T.text.cyan}}>+ New Map</span> to create one.</div>
          </div>
        )}
        {mapLayers.map(layer=>{const mt=MAP_TYPES.find(m=>m.id===layer.type)||MAP_TYPES[0];return(
          <div key={layer.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderBottom:`1px solid ${T.border.subtle}`,background:T.bg.panel,opacity:layer.visible?1:0.45}}>
            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:7,height:7,borderRadius:"50%",background:mt.color,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:8,fontWeight:600,color:T.text.primary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{layer.name}</div><div style={{fontSize:7,color:mt.color,letterSpacing:0.3}}>{mt.label}</div></div>
            <button onClick={()=>toggleLayerVis(layer.id)} style={{background:"transparent",border:`1px solid ${T.border.subtle}`,color:layer.visible?T.text.green:T.text.muted,padding:"1px 5px",fontSize:9,cursor:"pointer"}}>{layer.visible?"●":"○"}</button>
            <button onClick={()=>deleteLayer(layer.id)} style={{background:"transparent",border:`1px solid ${T.border.subtle}`,color:T.text.muted,padding:"1px 4px",fontSize:9,cursor:"pointer"}}>✕</button>
          </div>
        );})}
      </div>
      <div style={{flex:1,background:"#080C14",position:"relative",minHeight:0}}>
        <svg width="100%" height="100%" style={{position:"absolute",inset:0,opacity:0.06}}>
          {Array.from({length:20}).map((_,i)=><line key={i} x1="0" y1={i*25} x2="100%" y2={i*25} stroke="#8B95A5" strokeWidth="0.5"/>)}
          {Array.from({length:15}).map((_,i)=><line key={`v${i}`} x1={i*25} y1="0" x2={i*25} y2="100%" stroke="#8B95A5" strokeWidth="0.5"/>)}
        </svg>
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:8,color:"#8B95A5",opacity:0.18,textAlign:"center",pointerEvents:"none"}}>MAPBOX GL JS<br/>PORTFOLIO OVERVIEW</div>
        <div style={{position:"absolute",bottom:8,left:0,right:0,textAlign:"center"}}>
          <button onClick={()=>navigate("/map")} style={{fontFamily:T.font.mono,fontSize:8,fontWeight:700,background:T.text.cyan,color:T.bg.terminal,border:"none",padding:"4px 12px",cursor:"pointer"}}>OPEN FULL MAP →</button>
        </div>
      </div>
    </div>
  );

  // ─── WIDGET COMPONENTS ─────────────────────────────────────
  const WidgetKeyFindings = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      {STATIC_NEWS.map((n,i)=>(
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
      {liveDeals.slice(0,5).map((d,i)=>(
        <div key={i} onDoubleClick={()=>navigate(`/deals/${d.id}`)} style={{padding:"10px 12px",borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",gap:6,marginBottom:4}}><StageBd stage={d.stage} T={T}/></div>
              <div style={{fontSize:12,fontWeight:700,color:T.text.primary}}>{d.name}</div>
              <div style={{fontSize:8,color:T.text.secondary,marginTop:2}}>{d.addr}</div>
            </div>
            <span style={{fontSize:18,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:d.score>0?T.text.red:T.text.muted}}>{d.score>0?d.score:"—"}</span>
          </div>
        </div>
      ))}
      {liveDeals.length===0&&!dealsLoading&&<div style={{padding:20,textAlign:"center",fontSize:9,color:T.text.muted}}>No deals yet</div>}
    </div>
  );

  const WidgetKPISummary = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[
          {l:"Total Pipeline",v:totalPV>0?`$${totalPV.toFixed(1)}M`:`${liveDeals.length} deals`,sub:liveDeals.length+" deals",c:T.text.amberBright},
          {l:"Active Deals",v:String(activeCount),sub:"in progress",c:T.text.cyan},
          {l:"Pipeline Deals",v:String(liveDeals.length),sub:"total",c:T.text.green},
          {l:"Avg Days/Deal",v:liveDeals.length>0?String(Math.round(liveDeals.reduce((s,d)=>s+d.days,0)/liveDeals.length)):"—",sub:"avg time",c:T.text.amber},
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
      {liveAlerts.map((a,i)=>{
        const bc=({critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted} as Record<string,string>)[a.sev];
        return <div key={i} style={{display:"flex",gap:6,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}><div style={{flex:1}}><div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd>{a.deal&&<span style={{fontSize:8,color:T.text.amber,fontWeight:600}}>{a.deal}</span>}</div><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div></div><span style={{fontSize:7,color:T.text.muted}}>{a.time}</span></div>;
      })}
    </div>
  );

  const WidgetAgents = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border.subtle}}>
        {liveAgents.map((a,i)=>(
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
      {[...liveDeals].filter(d=>d.score>0).sort((a,b)=>b.score-a.score).slice(0,10).map((d,i)=>(
        <div key={d.id} onDoubleClick={()=>navigate(`/deals/${d.id}`)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt,cursor:"pointer"}}>
          <span style={{fontSize:12,fontWeight:800,color:T.text.muted,minWidth:24}}>#{i+1}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:10,fontWeight:600,color:T.text.primary}}>{d.name}</div>
            <div style={{fontSize:8,color:T.text.secondary}}>{d.market} · <StratBd s={d.strat} T={T}/></div>
          </div>
          <Spark data={d.trend} color={d.score>=80?T.text.green:T.text.amber} w={48} h={16}/>
          <div style={{textAlign:"right",minWidth:40}}>
            <div style={{fontSize:18,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}}>{d.score}</div>
          </div>
        </div>
      ))}
      {liveDeals.filter(d=>d.score>0).length===0&&<div style={{padding:20,textAlign:"center",fontSize:9,color:T.text.muted}}>No scored deals yet</div>}
    </div>
  );

  const WidgetFunnel = () => {
    const stageOrder=["LEAD","PROSPECT","LOI","DD"];
    const stageColors:Record<string,string>={LEAD:T.text.muted,PROSPECT:T.text.secondary,LOI:T.text.amber,DD:T.text.green};
    const maxCount=Math.max(...Object.values(stages),1);
    return (
      <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
        {stageOrder.map(s=>(
          <div key={s} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{s}</span>
              <span style={{fontSize:12,fontWeight:800,color:stageColors[s]}}>{stages[s]} deals</span>
            </div>
            <div style={{height:28,background:T.bg.panel,border:`1px solid ${T.border.subtle}`,position:"relative"}}>
              <div style={{height:"100%",width:`${(stages[s]/maxCount)*100}%`,background:stageColors[s]+"44",borderRight:`2px solid ${stageColors[s]}`}}/>
            </div>
          </div>
        ))}
        <div style={{marginTop:12,padding:"8px 10px",background:T.text.amber+"08",borderLeft:`3px solid ${T.text.amber}`}}>
          <div style={{fontSize:9,color:T.text.secondary}}>{liveDeals.length} deals in pipeline</div>
        </div>
      </div>
    );
  };

  const WidgetStrategySnapshot = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",padding:16}}>
      {[
        {s:"BUILD-TO-SELL",abbr:"BTS",c:T.text.green},
        {s:"RENTAL",abbr:"RENTAL",c:T.text.cyan},
        {s:"FLIP",abbr:"FLIP",c:T.text.amber},
        {s:"SHORT-TERM RENTAL",abbr:"STR",c:T.text.orange},
      ].map((row,i)=>{
        const count=liveDeals.filter(d=>d.strat.includes(row.abbr.slice(0,3))).length;
        const avgScore=count>0?Math.round(liveDeals.filter(d=>d.strat.includes(row.abbr.slice(0,3))).reduce((a,d)=>a+d.score,0)/count):0;
        return(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
            <div style={{flex:1}}><div style={{fontSize:10,fontWeight:700,color:row.c}}>{row.s}</div><div style={{fontSize:8,color:T.text.secondary}}>{count} deal{count!==1?"s":""} in pipeline</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:800,color:row.c}}>{avgScore||"—"}</div><div style={{fontSize:7,color:T.text.muted}}>avg score</div></div>
          </div>
        );
      })}
    </div>
  );

  const WidgetRates = () => {
    const rates=[{l:"Fed Funds",v:"5.33%",d:"-0bps",t:[5.0,5.1,5.25,5.33,5.33,5.33],c:T.text.red},{l:"SOFR",v:"5.31%",d:"-2bps",t:[5.05,5.1,5.22,5.29,5.30,5.31],c:T.text.orange},{l:"Prime Rate",v:"8.50%",d:"0bps",t:[7.5,7.8,8.0,8.25,8.50,8.50],c:T.text.amber},{l:"10Y Treasury",v:"4.41%",d:"+6bps",t:[3.8,4.0,4.2,4.31,4.35,4.41],c:T.text.cyan}];
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
    const pts=[{m:"1M",v:5.27},{m:"3M",v:5.30},{m:"6M",v:5.28},{m:"1Y",v:5.05},{m:"2Y",v:4.72},{m:"5Y",v:4.50},{m:"10Y",v:4.41},{m:"20Y",v:4.62},{m:"30Y",v:4.58}];
    const mn=Math.min(...pts.map(p=>p.v))-0.2,mx=Math.max(...pts.map(p=>p.v))+0.2,rng=mx-mn;
    const W=280,H=80;
    const polyline=pts.map((p,i)=>`${(i/(pts.length-1))*W},${H-((p.v-mn)/rng)*H}`).join(" ");
    return (
      <div style={{flex:1,overflow:"auto",padding:12}}>
        <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"10px 12px"}}>
          <svg width="100%" height={H+20} viewBox={`0 0 ${W} ${H+20}`} style={{display:"block",overflow:"visible"}}>
            {[4.0,4.5,5.0,5.5].map((v,i)=>{const y=H-((v-mn)/rng)*H;return<line key={i} x1="0" y1={y} x2={W} y2={y} stroke={T.border.subtle} strokeWidth="0.5" strokeDasharray="3,3"/>;}) }
            <polyline points={polyline} fill="none" stroke={T.text.purple} strokeWidth="2" strokeLinejoin="round"/>
            {pts.map((p,i)=>{const x=(i/(pts.length-1))*W,y=H-((p.v-mn)/rng)*H;return<g key={i}><circle cx={x} cy={y} r="3" fill={T.text.purple}/><text x={x} y={H+14} textAnchor="middle" fontSize="7" fill={T.text.muted}>{p.m}</text></g>;})}
          </svg>
        </div>
        <div style={{marginTop:8,fontSize:8,color:T.text.muted}}>Inverted 2Y/10Y spread: <span style={{color:T.text.orange,fontWeight:700}}>-31bps</span></div>
      </div>
    );
  };

  const WidgetTV = () => {
    const [chan,setChan] = useState("CNBC");
    const channels=["CNBC","Bloomberg","Fox Business","Yahoo Finance"];
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
        </div>
      </div>
    );
  };

  const WidgetCapRates = () => {
    const data=[{cls:"Multifamily",markets:[{m:"Tampa",v:"5.1%"},{m:"Miami",v:"4.8%"},{m:"Orlando",v:"5.4%"},{m:"Jacksonville",v:"5.6%"}]},{cls:"Industrial",markets:[{m:"Tampa",v:"5.5%"},{m:"Miami",v:"4.9%"},{m:"Orlando",v:"5.9%"},{m:"Jacksonville",v:"6.1%"}]},{cls:"Retail",markets:[{m:"Tampa",v:"6.2%"},{m:"Miami",v:"5.7%"},{m:"Orlando",v:"6.4%"},{m:"Jacksonville",v:"7.0%"}]},{cls:"Office",markets:[{m:"Tampa",v:"7.8%"},{m:"Miami",v:"7.2%"},{m:"Orlando",v:"8.1%"},{m:"Jacksonville",v:"8.6%"}]}];
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
    const events=[{deal:"Active Deal",type:"DD EXPIRES",days:9,sev:"critical"},{deal:"Active Deal",type:"EARNEST WIRE",days:3,sev:"critical"},{deal:"Pipeline",type:"BEST & FINAL",days:4,sev:"high"},{deal:"Pipeline",type:"DD START",days:7,sev:"med"},{deal:"Pipeline",type:"CITY MTG",days:14,sev:"low"}];
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
    const items=[{who:"Greystar",action:"Broke ground 380u luxury tower, Downtown Tampa",impact:"SUPPLY +",time:"2d",threat:"HIGH"},{who:"Equity Residential",action:"Acquired 224u Westshore for $44.8M ($200K/door)",impact:"COMP ↑",time:"5d",threat:"MED"},{who:"MAA",action:"Filed permits for 156u Riverview mid-rise",impact:"SUPPLY +",time:"1w",threat:"LOW"},{who:"Blackstone RE",action:"Raised $4.2B multifamily fund — FL allocation $420M",impact:"CAPITAL",time:"1w",threat:"HIGH"}];
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
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:9,fontWeight:700,color:T.text.green}}>● AI ONLINE</span><span style={{fontSize:8,color:T.text.muted}}>Generated {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span></div>
      <div style={{fontSize:10,fontWeight:700,color:T.text.primary,marginBottom:8,lineHeight:1.4}}>Good morning. Today's top priorities:</div>
      {[
        {n:"① Review Active DD",t:"Check outstanding due diligence items. Prioritize inspections and expiry dates.",c:T.text.red},
        {n:"② Pipeline Monitoring",t:"Review deals with score changes. BTS strategies showing 22pt advantage over rental in current rate environment.",c:T.text.orange},
        {n:"③ Market Context",t:"Fed Funds held at 5.33%. Tampa MSA absorption 95.2% — strongest quarter in 3 years.",c:T.text.cyan},
        {n:"Market context",t:"Construction debt (SOFR+275) tightening. Window for BTS deals remains favorable.",c:T.text.green},
      ].map((item,i)=>(
        <div key={i} style={{padding:"8px 10px",marginBottom:8,background:T.bg.panel,border:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${item.c}`}}>
          <div style={{fontSize:9,fontWeight:700,color:item.c,marginBottom:3}}>{item.n}</div>
          <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.5}}>{item.t}</div>
        </div>
      ))}
    </div>
  );

  const WidgetTaskList = () => {
    const pc:Record<string,string>={critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted};
    const sc:Record<string,string>={"TODO":T.text.muted,"IN PROGRESS":T.text.cyan,"DONE":T.text.green};
    return (
      <div style={{flex:1,overflow:"auto"}}>
        {liveTasks.map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"7px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${pc[t.pri]}`,background:i%2===0?T.bg.panel:T.bg.panelAlt,opacity:t.status==="DONE"?0.5:1}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,fontWeight:600,color:t.status==="DONE"?T.text.muted:T.text.primary,textDecoration:t.status==="DONE"?"line-through":"none",lineHeight:1.4}}>{t.title}</div>
              <div style={{marginTop:3,display:"flex",gap:4,flexWrap:"wrap"}}><Bd c={T.text.amber}>{t.deal}</Bd><Bd c={pc[t.pri]}>{t.pri.toUpperCase()}</Bd></div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:8,fontWeight:700,color:sc[t.status]}}>{t.status}</div>
              <div style={{fontSize:7,color:T.text.muted,marginTop:2}}>{t.due} · {t.owner}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── WIDGET ROUTER ─────────────────────────────────────────
  const renderWidget = (id:string) => {
    switch(id) {
      case "pipeline":    return <DealGrid/>;
      case "findings":    return <WidgetKeyFindings/>;
      case "mydeals":     return <WidgetMyDeals/>;
      case "kpi":         return <WidgetKPISummary/>;
      case "alerts":      return <WidgetAlertFeed/>;
      case "agents":      return <WidgetAgents/>;
      case "vitals":      return <ViewMarkets/>;
      case "leaderboard": return <WidgetLeaderboard/>;
      case "funnel":      return <WidgetFunnel/>;
      case "strategy":    return <WidgetStrategySnapshot/>;
      case "rates":       return <WidgetRates/>;
      case "yieldcurve":  return <WidgetYieldCurve/>;
      case "tv":          return <WidgetTV/>;
      case "caprates":    return <WidgetCapRates/>;
      case "reits":       return <WidgetREITs/>;
      case "macro":       return <WidgetMacro/>;
      case "debt":        return <WidgetDebt/>;
      case "calendar":    return <WidgetCalendar/>;
      case "competitor":  return <WidgetCompetitor/>;
      case "aibrief":     return <WidgetAIBrief/>;
      case "tasks":       return <WidgetTaskList/>;
      default: return null;
    }
  };

  // ─── VIEW: F1 DASHBOARD (Grid + Float Window System) ──────
  const ViewDashboard = () => {
    const gridWidgets = dashWindows.filter(id => !floatWidgets.includes(id));
    return (
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,position:"relative"}}>
        {/* Widget catalog overlay */}
        {dashMenuOpen&&(
          <div style={{position:"absolute",inset:0,background:theme==="dark"?"rgba(5,8,16,0.97)":"rgba(240,244,248,0.97)",zIndex:200,display:"flex",flexDirection:"column",animation:"fadeIn 0.35s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,background:T.bg.header}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:T.text.white,letterSpacing:1}}>ADD WIDGET</div>
                <div style={{fontSize:8,color:T.text.muted,marginTop:1}}>{WIDGET_CATALOG.length} available · {dashWindows.length} on dashboard</div>
              </div>
              <button onClick={()=>setDashMenuOpen(false)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.muted,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"4px 10px",cursor:"pointer"}}>✕ CLOSE</button>
            </div>
            <div style={{flex:1,overflow:"auto",padding:"12px 16px"}}>
              {["DEALS","INTEL","MARKET","OPS","MEDIA"].map(cat=>{
                const items=WIDGET_CATALOG.filter(w=>w.category===cat);
                if(!items.length) return null;
                return (
                  <div key={cat} style={{marginBottom:20}}>
                    <div style={{fontSize:8,fontWeight:700,color:T.text.muted,letterSpacing:1.5,marginBottom:8,paddingBottom:4,borderBottom:`1px solid ${T.border.subtle}`}}>{cat}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                      {items.map(w=>{
                        const added=dashWindows.includes(w.id);
                        return (
                          <div key={w.id} style={{background:T.bg.panel,border:`1px solid ${added?w.color+"44":T.border.subtle}`,padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:w.color,display:"inline-block",flexShrink:0}}/>
                              <span style={{fontSize:9,fontWeight:700,color:T.text.primary}}>{w.label}</span>
                            </div>
                            <div style={{fontSize:7,color:T.text.muted,lineHeight:1.5,flex:1}}>{w.desc}</div>
                            <button onClick={()=>{if(!added){openWindow(w.id);setDashMenuOpen(false);}else{closeWindow(w.id);}}} style={{fontFamily:T.font.mono,fontSize:8,fontWeight:700,background:added?T.bg.active:"transparent",color:added?T.text.green:w.color,border:`1px solid ${added?T.text.green+"44":w.color}`,padding:"4px 0",cursor:"pointer",letterSpacing:0.3}}>
                              {added?"✓ OPEN":"+ ADD"}
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

        {/* Dashboard header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:34,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:1}}>DASHBOARD</span>
            {dashWindows.length>0&&<span style={{fontSize:8,color:T.text.muted}}>{gridWidgets.length} grid{floatWidgets.length>0?` · ${floatWidgets.length} floating`:""}</span>}
          </div>
          <div style={{display:"flex",gap:6}}>
            {dashWindows.length>0&&<button onClick={()=>{setDashWindows([]);setWinStates({});setFloatWidgets([]);persistWins([],{});}} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"3px 8px",cursor:"pointer"}}>CLEAR ALL</button>}
            <button onClick={()=>setDashMenuOpen(true)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"4px 12px",cursor:"pointer",letterSpacing:0.3}}>+ ADD WIDGET</button>
          </div>
        </div>

        {/* Empty state */}
        {dashWindows.length===0&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"fadeIn 0.3s"}}>
            <div style={{width:48,height:48,border:`2px solid ${T.border.medium}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:24,color:T.text.muted}}>+</span>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:14,fontWeight:700,color:T.text.primary,marginBottom:6}}>Your dashboard is empty</div>
              <div style={{fontSize:10,color:T.text.muted}}>Choose from {WIDGET_CATALOG.length} widgets to build your view</div>
            </div>
            <button onClick={()=>setDashMenuOpen(true)} style={{fontFamily:T.font.mono,fontSize:11,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"10px 24px",cursor:"pointer",letterSpacing:0.5}}>+ ADD WIDGET</button>
          </div>
        )}

        {/* All-floating placeholder */}
        {dashWindows.length>0&&gridWidgets.length===0&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:9,color:T.text.muted,fontFamily:T.font.mono}}>All widgets are floating — drag them freely on screen</span>
          </div>
        )}

        {/* Widget grid (drag ghost cursor) */}
        {gridDrag&&(()=>{const m=WIDGET_CATALOG.find(w=>w.id===gridDrag.id);return m?<div style={{position:"fixed",left:gridDrag.x+10,top:gridDrag.y-16,background:T.bg.header,border:`1px solid ${m.color}`,padding:"3px 10px",zIndex:300,pointerEvents:"none",fontFamily:T.font.mono,fontSize:8,fontWeight:700,color:m.color,boxShadow:"0 4px 16px rgba(0,0,0,0.5)"}}>⠿ {m.label}</div>:null;})()}

        {/* Widget grid */}
        {gridWidgets.length>0&&(
          <div style={{flex:1,overflow:"auto",padding:10}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gridAutoFlow:"dense",gap:10,alignItems:"start"}}>
              {gridWidgets.map(id=>{
                const meta=WIDGET_CATALOG.find(w=>w.id===id);
                if(!meta) return null;
                const sz=widgetSizes[id]||"md";
                const customH=widgetHeights[id];
                const hMap:{[k:string]:{min:number,max:number}}={sm:{min:140,max:180},md:{min:220,max:320},lg:{min:320,max:500}};
                const h=customH?{min:customH,max:customH}:hMap[sz]||hMap.md;
                const isDragging=gridDrag?.id===id;
                const isDropTarget=gridDragOver===id&&gridDrag?.id!==id;
                return (
                  <div key={id}
                    onMouseEnter={()=>{if(gridDrag&&gridDrag.id!==id)setGridDragOver(id);}}
                    onMouseLeave={()=>setGridDragOver(null)}
                    style={{background:T.bg.panel,border:`1px solid ${isDropTarget?T.text.cyan:T.border.medium}`,display:"flex",flexDirection:"column",minHeight:h.min,height:customH?customH:undefined,maxHeight:customH?undefined:h.max,gridColumn:`span ${widgetCols[id]||2}`,opacity:isDragging?0.35:1,boxShadow:isDropTarget?`0 0 0 2px ${T.text.cyan}44`:"none",transition:"opacity 0.1s,box-shadow 0.1s",position:"relative"}}>
                    {/* Title bar */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span onMouseDown={(e)=>{e.preventDefault();setGridDrag({id,x:e.clientX,y:e.clientY});}} style={{cursor:"grab",fontSize:13,color:T.text.muted,lineHeight:1,padding:"0 4px 0 0",userSelect:"none"}} title="Drag to reorder">⠿</span>
                        <span style={{width:6,height:6,borderRadius:"50%",background:meta.color,display:"inline-block"}}/>
                        <span style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.primary}}>{meta.label}</span>
                      </div>
                      <div style={{display:"flex",gap:3,alignItems:"center"}}>
                        {(["sm","md","lg"] as const).map(s=>(
                          <button key={s} onClick={()=>{setWidgetSizes(prev=>({...prev,[id]:s}));setWidgetHeights(prev=>{const n={...prev};delete n[id];return n;});}} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,padding:"1px 5px",cursor:"pointer",background:!customH&&sz===s?T.text.amber+"22":"transparent",color:!customH&&sz===s?T.text.amber:T.text.muted,border:`1px solid ${!customH&&sz===s?T.text.amber+"66":T.border.subtle}`,lineHeight:1.6}}>
                            {s.toUpperCase()}
                          </button>
                        ))}
                        <span style={{width:1,height:10,background:T.border.medium,display:"inline-block",margin:"0 2px"}}/>
                        {([1,2,3,4] as const).map(c=>{const active=(widgetCols[id]||2)===c;return(
                          <button key={c} onClick={()=>setWidgetCols(prev=>({...prev,[id]:c}))} title={`${c} col${c>1?"s":""}`} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,padding:"1px 4px",cursor:"pointer",background:active?T.text.cyan+"22":"transparent",color:active?T.text.cyan:T.text.muted,border:`1px solid ${active?T.text.cyan+"66":T.border.subtle}`,lineHeight:1.6}}>
                            {c}
                          </button>
                        );})}
                        <button onClick={()=>floatWidget(id)} title="Pop out as floating window" style={{fontFamily:T.font.mono,fontSize:10,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}33`,padding:"0px 5px",cursor:"pointer",marginLeft:2,lineHeight:1.4}}>⊡</button>
                        <button onClick={()=>closeWindow(id)} style={{fontFamily:T.font.mono,fontSize:9,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 2px",lineHeight:1,marginLeft:1}}>✕</button>
                      </div>
                    </div>
                    {/* Content */}
                    <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
                      {renderWidget(id)}
                    </div>
                    {/* Vertical resize handle */}
                    <div onMouseDown={(e)=>{e.preventDefault();const curH=customH||(sz==="sm"?160:sz==="lg"?420:280);setGridResizing({id,startY:e.clientY,startH:curH});}} style={{height:6,flexShrink:0,cursor:"ns-resize",display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",borderTop:`1px solid ${T.border.subtle}`}} title="Drag to resize height">
                      <div style={{width:28,height:2,borderRadius:1,background:T.border.medium}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const CORP_HEALTH_DEMO = [
    {company:"Amazon",ticker:"AMZN",employees:12500,share:18.2,chs:74,tier:"healthy" as const,delta:+3,sector:"Technology",momentum:"+2.1%"},
    {company:"Microsoft",ticker:"MSFT",employees:8200,share:11.9,chs:82,tier:"healthy" as const,delta:+1,sector:"Technology",momentum:"+1.4%"},
    {company:"Boeing",ticker:"BA",employees:6800,share:9.9,chs:38,tier:"stress" as const,delta:-8,sector:"Aerospace",momentum:"-4.2%"},
    {company:"T-Mobile",ticker:"TMUS",employees:4100,share:6.0,chs:65,tier:"watch" as const,delta:-2,sector:"Telecom",momentum:"+0.8%"},
    {company:"Starbucks",ticker:"SBUX",employees:3500,share:5.1,chs:71,tier:"healthy" as const,delta:+5,sector:"Consumer",momentum:"+1.9%"},
    {company:"Costco",ticker:"COST",employees:2900,share:4.2,chs:88,tier:"healthy" as const,delta:+2,sector:"Retail",momentum:"+3.1%"},
    {company:"Swedish Medical",ticker:null,employees:2400,share:3.5,chs:null,tier:null,delta:null,sector:"Healthcare",momentum:"N/A"},
    {company:"Expedia",ticker:"EXPE",employees:2100,share:3.1,chs:59,tier:"watch" as const,delta:-4,sector:"Technology",momentum:"-1.3%"},
  ];
  const DEMO_SCHI = 68.4;
  const DEMO_RE_HEALTH = 72.1;
  const DEMO_DIVERGENCE = -3.7;
  const DEMO_HERFINDAHL = 0.072;
  const tierColor = (tier: string|null) => tier==="healthy"?T.text.green:tier==="stress"?T.text.red:tier==="watch"?T.text.amber:T.text.muted;

  // ─── VIEW: F3 PORTFOLIO ────────────────────────────────────
  const ViewPortfolio = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="OWNED ASSETS" subtitle="Portfolio performance" borderColor={T.text.green} right={<button onClick={()=>navigate("/assets-owned")} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"2px 8px",cursor:"pointer"}}>VIEW ALL →</button>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border.subtle}}>
        {[{l:"PORTFOLIO VALUE",v:"$312M",c:T.text.amberBright},{l:"WEIGHTED IRR",v:"16.8%",c:T.text.amber},{l:"AVG OCCUPANCY",v:"93.4%",c:T.text.green},{l:"NOI VARIANCE",v:"+2.3%",c:T.text.green}].map((m,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"8px 10px"}}>
            <div style={{fontSize:7,color:T.text.muted,letterSpacing:1}}>{m.l}</div>
            <div style={{fontSize:16,fontWeight:800,color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:10}}>
        <div style={{fontSize:9,color:T.text.muted,marginBottom:6}}>Actual vs. projected variance tracking | Monthly actuals upload | Decision timeline</div>
        {["Midtown Heights (248u)","West End Lofts (180u)","Buckhead Tower (312u)","Downtown Station (156u)"].map((a,i)=>(
          <div key={i} onClick={()=>navigate("/assets-owned")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt,cursor:"pointer"}}>
            <span style={{fontSize:10,color:T.text.primary,fontWeight:600}}>{a}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:10,fontWeight:700,color:T.text.green}}>{[76,72,81,68][i]}</span>
              <Spark data={[[72,73,74,75,76],[70,71,71,72,72],[78,79,80,80,81],[70,69,68,68,68]][i]} color={T.text.green} w={40} h={12}/>
              <span style={{fontSize:8,color:T.text.amber}}>{["$44.2M","$28.1M","$72.6M","$31.5M"][i]}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{margin:"0 10px 10px",padding:8,background:T.bg.panel,border:`1px solid ${T.border.subtle}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:T.text.cyan}}/>
          <span style={{fontSize:9,fontWeight:700,color:T.text.white,letterSpacing:0.5}}>CORPORATE HEALTH OVERLAY</span>
        </div>
        {(() => {
          const s = corpHealthLive.schi ?? DEMO_SCHI;
          const d = corpHealthLive.divergence ?? DEMO_DIVERGENCE;
          const h = corpHealthLive.herfindahl ?? DEMO_HERFINDAHL;
          const topEmp = corpHealthLive.employers.length>0 ? (corpHealthLive.employers[0]?.company||corpHealthLive.employers[0]?.company_name||"\u2014") : CORP_HEALTH_DEMO[0].company;
          return <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:s>=60?T.text.green:s>=40?T.text.amber:T.text.red}}>{s.toFixed(0)}</div>
              <div style={{fontSize:7,color:T.text.muted}}>SCHI</div>
            </div>
            <div style={{width:1,height:30,background:T.border.subtle}}/>
            <div>
              <div style={{fontSize:9,color:T.text.secondary}}>Divergence: <span style={{fontWeight:700,color:Math.abs(d)>15?T.text.amber:T.text.green}}>{(d>0?"+":"")+d.toFixed(1)}</span></div>
              <div style={{fontSize:9,color:T.text.secondary}}>Top Employer: <span style={{fontWeight:600,color:T.text.primary}}>{topEmp}</span></div>
              <div style={{fontSize:9,color:T.text.secondary}}>HHI: <span style={{fontWeight:600,color:h<0.1?T.text.green:T.text.red}}>{h.toFixed(3)}</span></div>
            </div>
            <div style={{marginLeft:"auto"}}>
              <Spark data={[68,67,69,70,68,69,s]} color={s>=60?T.text.green:T.text.amber} w={60} h={16}/>
              <div style={{fontSize:7,color:T.text.muted,textAlign:"center"}}>4Q trend</div>
            </div>
          </div>;
        })()}
      </div>
    </div>
  );

  // ─── VIEW: F4 MARKETS ──────────────────────────────────────
  const ViewMarkets = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s",display:"flex",flexDirection:"column"}}>
      <PanelHeader T={T} title="MARKET INTELLIGENCE" subtitle="5 submarkets | 202 properties | 50,380 units" borderColor={T.text.cyan} right={<button onClick={()=>navigate("/market-intelligence")} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"2px 8px",cursor:"pointer"}}>FULL INTEL →</button>}/>
      <div style={{display:"flex",borderBottom:`1px solid ${T.border.medium}`,background:T.bg.header,flexShrink:0}}>
        {([["overview","MARKET OVERVIEW"],["corphealth","CORPORATE HEALTH"]] as const).map(([k,l])=>(
          <div key={k} onClick={()=>setMarketTab(k)} style={{padding:"6px 14px",fontSize:9,fontWeight:700,color:marketTab===k?T.text.amber:T.text.secondary,cursor:"pointer",borderBottom:marketTab===k?`2px solid ${T.text.amber}`:"2px solid transparent",letterSpacing:0.5,transition:"all 0.1s"}}>{l}</div>
        ))}
      </div>
      {marketTab==="overview" ? (
        <div style={{flex:1,overflow:"auto"}}>
          <div style={{padding:"10px 10px 0"}}>
            <div style={{fontSize:9,color:T.text.secondary,marginBottom:4}}>THE DECISION THIS PAGE DRIVES:</div>
            <div style={{fontSize:11,color:T.text.white,fontWeight:600,marginBottom:10}}>Is this submarket getting stronger or weaker — and how fast?</div>
          </div>
          <div style={{display:"flex",gap:1,padding:"0 10px 10px"}}>
            {MARKET_VITALS.map((v,i)=><MetricBox key={i} {...v} T={T}/>)}
          </div>
          <div style={{margin:"0 10px 10px",padding:"6px 10px",background:T.text.amber+"08",borderLeft:`3px solid ${T.text.amber}`}}>
            <span style={{fontSize:9,color:T.text.secondary}}>Tracking 5 submarkets. Momentum signal: <span style={{fontWeight:700,color:T.text.amber}}>STRONG</span>.</span>
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
      ) : (
        <div style={{flex:1,overflow:"auto"}}>
          <div style={{padding:"10px 10px 0"}}>
            <div style={{fontSize:9,color:T.text.secondary,marginBottom:4}}>THE DECISION THIS PAGE DRIVES:</div>
            <div style={{fontSize:11,color:T.text.white,fontWeight:600,marginBottom:10}}>Are the employers in this submarket healthy enough to sustain demand?</div>
          </div>
          {(() => {
            const schi = corpHealthLive.schi ?? DEMO_SCHI;
            const reH = corpHealthLive.reHealth ?? DEMO_RE_HEALTH;
            const div = corpHealthLive.divergence ?? DEMO_DIVERGENCE;
            const hhi = corpHealthLive.herfindahl ?? DEMO_HERFINDAHL;
            const divSubmarkets = corpHealthLive.portfolioSubmarkets.length > 0 ? corpHealthLive.portfolioSubmarkets : [
              {name:"Bellevue CBD",msa:"Seattle",schi:72.4,divergence:-18.2,signal:"bearish_divergence",reHealth:85.1,hhi:0.091,top5Share:0.42,employerCount:24,publicCount:8},
              {name:"South Lake Union",msa:"Seattle",schi:81.3,divergence:12.7,signal:"aligned",reHealth:78.9,hhi:0.145,top5Share:0.58,employerCount:18,publicCount:6},
              {name:"Redmond Tech",msa:"Seattle",schi:76.9,divergence:-8.1,signal:"aligned",reHealth:71.2,hhi:0.203,top5Share:0.63,employerCount:12,publicCount:5},
              {name:"Downtown Seattle",msa:"Seattle",schi:65.1,divergence:22.4,signal:"bullish_divergence",reHealth:45.3,hhi:0.067,top5Share:0.31,employerCount:45,publicCount:15},
              {name:"Eastside Suburban",msa:"Seattle",schi:58.2,divergence:-25.1,signal:"bearish_divergence",reHealth:79.8,hhi:0.112,top5Share:0.48,employerCount:30,publicCount:9},
            ];
            const topEmps = corpHealthLive.topEmployers.length > 0 ? corpHealthLive.topEmployers : CORP_HEALTH_DEMO.slice(0,10).map(c=>({company:c.company,ticker:c.ticker,employees:c.employees,share:c.share/100,submarket:"Bellevue CBD",chs:c.chs,tier:c.tier,delta:c.delta,naics:"51"}));
            const sectorColors:Record<string,string> = {"51":T.text.cyan,"33":T.text.orange,"48":T.text.purple,"44":T.text.amber,"62":T.text.red,"72":T.text.green,"52":T.text.purple,"54":T.text.orange};
            const naicsLabels:Record<string,string> = {"51":"Technology","33":"Aerospace/Mfg","48":"Telecom","44":"Retail","62":"Healthcare","72":"Hospitality","52":"Finance","54":"Professional Svc","XX":"Other"};
            const rotation = corpHealthLive.sectorRotation;
            const rotSectors:SectorRotEntry[] = rotation?.sectors || [];
            const rotMarkets:string[] = rotation?.markets || [];
            return <>
            <div style={{display:"flex",gap:1,padding:"0 10px 10px"}}>
              <MetricBox T={T} label="SCHI SCORE" value={schi.toFixed(1)} sub="Submarket Corporate Health" color={schi>=60?T.text.green:schi>=40?T.text.amber:T.text.red}/>
              <MetricBox T={T} label="RE HEALTH" value={reH.toFixed(1)} sub="Real Estate Fundamentals" color={T.text.cyan}/>
              <MetricBox T={T} label="DIVERGENCE" value={(div>0?"+":"")+div.toFixed(1)} sub={Math.abs(div)>15?(div>0?"BULLISH DIVERGENCE":"BEARISH DIVERGENCE"):"ALIGNED"} color={Math.abs(div)>15?(div>0?T.text.green:T.text.red):T.text.amber}/>
              <MetricBox T={T} label="HERFINDAHL" value={hhi.toFixed(3)} sub={hhi<0.1?"Low concentration":"High concentration"} color={hhi<0.1?T.text.green:T.text.red}/>
            </div>
            <div style={{margin:"0 10px 10px",padding:"6px 10px",background:(Math.abs(div)>15?T.text.red:T.text.green)+"08",borderLeft:`3px solid ${Math.abs(div)>15?T.text.amber:T.text.green}`}}>
              <span style={{fontSize:9,color:T.text.secondary}}>
                Corporate health is <span style={{fontWeight:700,color:schi>=60?T.text.green:T.text.red}}>{schi>=60?"STABLE":"AT RISK"}</span>.
                {" "}Divergence signal: <span style={{fontWeight:700,color:Math.abs(div)>15?T.text.amber:T.text.green}}>{Math.abs(div)>15?(div>0?"BULLISH":"BEARISH"):"ALIGNED"}</span>.
                {corpHealthLive.employers.length > 0 ? ` Top employer: ${corpHealthLive.employers[0]?.company_name || corpHealthLive.employers[0]?.company || "\u2014"}.` : ` Top employer (Amazon) represents ${CORP_HEALTH_DEMO[0].share}% of submarket employment.`}
              </span>
            </div>

            <div style={{margin:"0 10px"}}>
              <PanelHeader T={T} title="DIVERGENCE SCANNER \u2014 ALL SUBMARKETS" subtitle="Sorted by |divergence|"/>
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.6fr 0.5fr 0.5fr",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`}}>
                {["SUBMARKET","MSA","SCHI","RE HEALTH","DIVERGENCE","SIGNAL","HHI","EMPLOYERS"].map(h=>(
                  <div key={h} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
                ))}
              </div>
              {divSubmarkets.sort((a,b)=>Math.abs(b.divergence)-Math.abs(a.divergence)).map((s,i)=>{
                const sigColor = s.signal==="bullish_divergence"?T.text.green:s.signal==="bearish_divergence"?T.text.red:T.text.amber;
                return <div key={i} style={{display:"grid",gridTemplateColumns:"1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.6fr 0.5fr 0.5fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{s.name}</div>
                  <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{s.msa||"\u2014"}</div>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:s.schi>=60?T.text.green:s.schi>=40?T.text.amber:T.text.red,borderRight:`1px solid ${T.border.subtle}`}}>{s.schi.toFixed(1)}</div>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:T.text.cyan,borderRight:`1px solid ${T.border.subtle}`}}>{s.reHealth.toFixed(1)}</div>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:sigColor,borderRight:`1px solid ${T.border.subtle}`}}>{(s.divergence>0?"+":"")+s.divergence.toFixed(1)}</div>
                  <div style={{padding:"5px 6px",display:"flex",alignItems:"center",borderRight:`1px solid ${T.border.subtle}`}}><Bd c={sigColor}>{s.signal==="bullish_divergence"?"BULL":s.signal==="bearish_divergence"?"BEAR":"ALIGN"}</Bd></div>
                  <div style={{padding:"5px 6px",fontSize:9,color:s.hhi<0.1?T.text.green:T.text.red,borderRight:`1px solid ${T.border.subtle}`}}>{s.hhi.toFixed(3)}</div>
                  <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary}}>{s.employerCount} ({s.publicCount} pub)</div>
                </div>;
              })}
            </div>

            <div style={{margin:"10px"}}>
              <PanelHeader T={T} title="TOP 10 PUBLIC EMPLOYERS \u2014 PORTFOLIO-WIDE"/>
              <div style={{display:"grid",gridTemplateColumns:"1.3fr 0.5fr 0.6fr 0.6fr 0.5fr 0.5fr 0.5fr 0.8fr",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`}}>
                {["COMPANY","TICKER","EMPLOYEES","SHARE %","CHS","TIER","\u0394 QoQ","SUBMARKET"].map(h=>(
                  <div key={h} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
                ))}
              </div>
              {topEmps.slice(0,10).map((e,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1.3fr 0.5fr 0.6fr 0.6fr 0.5fr 0.5fr 0.5fr 0.8fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{e.company}</div>
                  <div style={{padding:"5px 6px",fontSize:9,fontWeight:600,color:e.ticker?T.text.cyan:T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{e.ticker||"PVT"}</div>
                  <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{e.employees?.toLocaleString()||"\u2014"}</div>
                  <div style={{padding:"5px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{(e.share*100).toFixed(1)}%</div>
                  <div style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:e.chs?tierColor(e.tier):T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{e.chs??"\u2014"}</div>
                  <div style={{padding:"5px 6px",display:"flex",alignItems:"center",borderRight:`1px solid ${T.border.subtle}`}}><Bd c={tierColor(e.tier)}>{e.tier?.toUpperCase()||"N/A"}</Bd></div>
                  <div style={{padding:"5px 6px",fontSize:9,fontWeight:600,color:e.delta!=null?(e.delta>0?T.text.green:e.delta<0?T.text.red:T.text.muted):T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{e.delta!=null?(e.delta>0?"+":"")+e.delta:"\u2014"}</div>
                  <div style={{padding:"5px 6px",fontSize:8,color:T.text.secondary}}>{e.submarket||"\u2014"}</div>
                </div>
              ))}
            </div>

            <div style={{margin:"10px"}}>
              <PanelHeader T={T} title="SECTOR ROTATION MATRIX" subtitle="Sectors \u00D7 Markets \u2014 Avg CHS Heat Grid"/>
              {rotSectors.length > 0 && rotMarkets.length > 0 ? (
                <div style={{overflowX:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:`120px repeat(${rotMarkets.length}, 1fr)`,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`}}>
                    <div style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`}}>SECTOR</div>
                    {rotMarkets.map((m:string)=>(
                      <div key={m} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.5,borderRight:`1px solid ${T.border.subtle}`,textAlign:"center"}}>{m.length>12?m.slice(0,12)+"..":m}</div>
                    ))}
                  </div>
                  {rotSectors.map((sec,si)=>(
                    <div key={si} style={{display:"grid",gridTemplateColumns:`120px repeat(${rotMarkets.length}, 1fr)`,background:si%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
                      <div style={{padding:"5px 6px",fontSize:9,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{naicsLabels[sec.naics]||sec.naics}</div>
                      {rotMarkets.map((m:string)=>{
                        const cell = sec.markets?.[m];
                        const v = cell?.avgCHS;
                        const bg = v!=null ? (v>=70?T.text.green+"22":v>=50?T.text.amber+"22":T.text.red+"22") : "transparent";
                        const tc = v!=null ? (v>=70?T.text.green:v>=50?T.text.amber:T.text.red) : T.text.muted;
                        return <div key={m} style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:tc,background:bg,textAlign:"center",borderRight:`1px solid ${T.border.subtle}`}}>{v!=null?v.toFixed(0):"\u2014"}</div>;
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{display:"grid",gridTemplateColumns:"120px repeat(3, 1fr)",gap:0}}>
                  <div style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,background:T.bg.header,borderRight:`1px solid ${T.border.subtle}`,borderBottom:`1px solid ${T.border.medium}`}}>SECTOR</div>
                  {["Seattle","Bellevue","Redmond"].map(m=>(
                    <div key={m} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,background:T.bg.header,borderRight:`1px solid ${T.border.subtle}`,borderBottom:`1px solid ${T.border.medium}`,textAlign:"center"}}>{m}</div>
                  ))}
                  {[{s:"Technology",v:[78,82,85]},{s:"Aerospace",v:[38,null,null]},{s:"Telecom",v:[65,61,null]},{s:"Retail",v:[88,71,74]},{s:"Healthcare",v:[null,72,68]}].map((row,ri)=><>
                    <div key={ri+"s"} style={{padding:"5px 6px",fontSize:9,fontWeight:600,color:T.text.primary,background:ri%2===0?T.bg.panel:T.bg.panelAlt,borderRight:`1px solid ${T.border.subtle}`,borderBottom:`1px solid ${T.border.subtle}`}}>{row.s}</div>
                    {row.v.map((v,ci)=>{
                      const bg2 = v!=null?(v>=70?T.text.green+"22":v>=50?T.text.amber+"22":T.text.red+"22"):"transparent";
                      const tc2 = v!=null?(v>=70?T.text.green:v>=50?T.text.amber:T.text.red):T.text.muted;
                      return <div key={ci} style={{padding:"5px 6px",fontSize:10,fontWeight:700,color:tc2,background:ri%2===0?`${T.bg.panel}`:T.bg.panelAlt,borderRight:`1px solid ${T.border.subtle}`,borderBottom:`1px solid ${T.border.subtle}`,textAlign:"center"}}><span style={{background:bg2,padding:"1px 6px",borderRadius:2}}>{v!=null?v:"\u2014"}</span></div>;
                    })}
                  </>)}
                </div>
              )}
            </div>

            <div style={{margin:"10px",display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <PanelHeader T={T} title="SECTOR CONCENTRATION"/>
                {(() => {
                  const sectorBreakdown = corpHealthLive.sectors && typeof corpHealthLive.sectors === 'object' && !Array.isArray(corpHealthLive.sectors) && Object.keys(corpHealthLive.sectors).length > 0
                    ? Object.entries(corpHealthLive.sectors).map(([k,v])=>({sector:naicsLabels[k]||k,pct:typeof v === 'number' ? v : parseFloat(String(v))||0,color:sectorColors[k]||T.text.muted})).sort((a,b)=>b.pct-a.pct)
                    : [{sector:"Technology",pct:33.2,color:T.text.cyan},{sector:"Aerospace",pct:9.9,color:T.text.orange},{sector:"Telecom",pct:6.0,color:T.text.purple},{sector:"Consumer",pct:5.1,color:T.text.amber},{sector:"Retail",pct:4.2,color:T.text.green},{sector:"Healthcare",pct:3.5,color:T.text.red},{sector:"Other",pct:38.1,color:T.text.muted}];
                  return sectorBreakdown.map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",borderBottom:`1px solid ${T.border.subtle}`}}>
                      <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
                      <span style={{fontSize:9,color:T.text.primary,flex:1}}>{s.sector}</span>
                      <div style={{width:100,height:6,background:T.bg.header,borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:`${Math.min(s.pct,100)}%`,height:"100%",background:s.color,borderRadius:3}}/>
                      </div>
                      <span style={{fontSize:8,color:T.text.secondary,width:35,textAlign:"right"}}>{s.pct.toFixed(1)}%</span>
                    </div>
                  ));
                })()}
              </div>
              <div style={{flex:1}}>
                <PanelHeader T={T} title="STRESS ALERTS"/>
                {(corpHealthLive.alerts.length > 0 ? corpHealthLive.alerts.slice(0,5).map((a)=>({sev:a.severity||"med",msg:a.message||"",time:a.time||"now"})) : [
                  {sev:"high",msg:"Boeing (BA) CHS dropped to 38 \u2014 stress tier. 6,800 employees at risk.",time:"2h"},
                  {sev:"med",msg:"Expedia (EXPE) CHS declining: 59 (-4 QoQ). Watch for layoff announcements.",time:"5h"},
                  {sev:"low",msg:"T-Mobile (TMUS) slight CHS decline to 65. Monitor next earnings.",time:"1d"},
                ]).map((a,i)=>{
                  const bc=({high:T.text.red,med:T.text.orange,low:T.text.amber} as Record<string,string>)[a.sev]||T.text.muted;
                  return <div key={i} style={{display:"flex",gap:6,padding:"5px 8px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc}>{a.sev.toUpperCase()}</Bd></div>
                      <div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div>
                    </div>
                    <span style={{fontSize:7,color:T.text.muted,whiteSpace:"nowrap"}}>{a.time}</span>
                  </div>;
                })}
              </div>
            </div>
          </>;})()}
        </div>
      )}
    </div>
  );

  // ─── VIEW: F5 EMAIL ────────────────────────────────────────
  const ViewEmail = () => {
    const TAG_COLORS:Record<string,string>={LOI:T.text.cyan,URGENT:T.text.red,DD:T.text.amber,DEBT:T.text.purple,ZONING:T.text.orange,LP:T.text.secondary,SCORE:T.text.green};
    const folders=[{id:"inbox",label:"INBOX",count:STATIC_EMAILS.filter(e=>e.unread).length},{id:"sent",label:"SENT",count:0},{id:"starred",label:"STARRED",count:1},{id:"all",label:"ALL MAIL",count:STATIC_EMAILS.length}];
    const filtered=STATIC_EMAILS.filter(e=>{
      const matchFolder=emailFolder==="all"||e.folder===emailFolder||emailFolder==="starred";
      const matchSearch=!emailSearch||e.from.toLowerCase().includes(emailSearch.toLowerCase())||e.subject.toLowerCase().includes(emailSearch.toLowerCase());
      return matchFolder&&matchSearch;
    });
    const activeEmail=STATIC_EMAILS.find(e=>e.id===selEmail)||null;
    return (
      <div style={{flex:1,display:"flex",minHeight:0,animation:"fadeIn 0.15s"}}>
        <div style={{width:180,borderRight:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panelAlt}}>
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
            <button onClick={()=>navigate("/dashboard/email")} style={{width:"100%",fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"6px 0",cursor:"pointer",letterSpacing:0.5}}>OPEN EMAIL →</button>
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
        <div style={{width:300,borderRight:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"5px 8px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:4,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"2px 7px",height:22}}>
              <span style={{fontSize:9,color:T.text.muted}}>⌕</span>
              <input value={emailSearch} onChange={e=>setEmailSearch(e.target.value)} placeholder="Search mail…" style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:T.font.mono,fontSize:9,color:T.text.primary}}/>
            </div>
          </div>
          <div style={{flex:1,overflow:"auto"}}>
            {filtered.length===0&&<div style={{padding:20,textAlign:"center",fontSize:9,color:T.text.muted}}>No messages</div>}
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
                <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                  {e.tag&&<Bd c={TAG_COLORS[e.tag]||T.text.muted}>{e.tag}</Bd>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          {!activeEmail&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:10,color:T.text.muted}}>Select an email to read</div></div>}
          {activeEmail&&(
            <>
              <div style={{padding:"10px 16px",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text.primary,marginBottom:4}}>{activeEmail.subject}</div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:9,fontWeight:600,color:T.text.amber}}>{activeEmail.from}</span>
                  <span style={{fontSize:8,color:T.text.muted}}>· {activeEmail.time}</span>
                  {activeEmail.tag&&<Bd c={TAG_COLORS[activeEmail.tag]||T.text.muted}>{activeEmail.tag}</Bd>}
                </div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  {["REPLY","FORWARD"].map(a=>(
                    <button key={a} onClick={()=>navigate("/dashboard/email")} style={{fontFamily:T.font.mono,fontSize:7,fontWeight:600,background:T.bg.input,color:T.text.secondary,border:`1px solid ${T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>{a}</button>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflow:"auto",padding:"16px 18px"}}>
                <pre style={{fontFamily:"'IBM Plex Sans',sans-serif",fontSize:10,color:T.text.primary,lineHeight:"1.7",whiteSpace:"pre-wrap",margin:0}}>{activeEmail.body}</pre>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ─── VIEW: F6 COMPETE ─────────────────────────────────────
  const ViewCompete = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="COMPETITIVE INTELLIGENCE" subtitle="Performance Rankings | Acquisition Intel | Comp Analysis" borderColor={T.text.purple} right={<button onClick={()=>navigate("/competitive-intel")} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.purple,background:"transparent",border:`1px solid ${T.text.purple}44`,padding:"2px 8px",cursor:"pointer"}}>FULL REPORT →</button>}/>
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

  // ─── VIEW: F7 STRATEGIES ───────────────────────────────────
  const ViewStrategies = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="STRATEGIES" subtitle="Strategy library | Builder | Saved profiles" borderColor={T.text.purple} right={<button onClick={()=>navigate("/strategy-builder")} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.purple,background:"transparent",border:`1px solid ${T.text.purple}44`,padding:"2px 8px",cursor:"pointer"}}>OPEN BUILDER →</button>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:1,background:T.border.subtle,margin:10}}>
        {[
          {s:"BUILD-TO-SELL",score:84,desc:"Ground-up construction, sell at CO. Optimal for thin supply + strong demand. Typical IRR 22–28%, 24mo hold.",best:"Jacksonville, Tampa",c:T.text.green},
          {s:"RENTAL",score:69,desc:"Long-term hold for NOI and appreciation. Best in high-barrier markets with rent growth >2.5% YoY.",best:"Miami, Orlando",c:T.text.cyan},
          {s:"FLIP",score:58,desc:"Value-add and resell within 12 months. Requires distress or mismanagement at acquisition. IRR 18–24%.",best:"Orlando (Colonial Town)",c:T.text.amber},
          {s:"SHORT-TERM RENTAL",score:45,desc:"Hospitality-grade operation. High revenue but regulatory and operational risk. FL STR reform pending.",best:"Beach markets (caution)",c:T.text.orange},
        ].map((row,i)=>(
          <div key={i} onClick={()=>navigate("/strategy-builder")} style={{background:T.bg.panel,padding:12,borderTop:`2px solid ${row.c}`,cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.5}}>{row.s}</div>
              <div style={{fontSize:22,fontWeight:800,color:row.c}}>{row.score}</div>
            </div>
            <div style={{fontSize:9,color:T.text.secondary,lineHeight:1.5,marginBottom:6}}>{row.desc}</div>
            <div style={{fontSize:8,color:T.text.muted}}>Best markets: <span style={{color:T.text.amber,fontWeight:600}}>{row.best}</span></div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── VIEW: F8 ORG TOOLS ────────────────────────────────────
  const ViewTools = () => (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
      <PanelHeader T={T} title="ORG TOOLS" subtitle="Tasks · Reports · Team" borderColor={T.text.muted}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:T.border.subtle,margin:10}}>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>TASKS</div>
          {liveTasks.slice(0,4).map((t,i)=>(
            <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`,fontSize:8,color:T.text.secondary}}>{t.title} <span style={{color:T.text.amber}}>({t.deal})</span></div>
          ))}
          <button onClick={()=>navigate("/tasks")} style={{marginTop:6,fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"2px 8px",cursor:"pointer",width:"100%"}}>VIEW ALL TASKS →</button>
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>REPORTS</div>
          {["Deal Memo (latest deal)","LP Quarterly Report Q1 2026 (draft)","Market Report: Tampa MSA (auto)","Comp Report: Dadeland submarket"].map((r,i)=>(
            <div key={i} style={{padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`,fontSize:8,color:T.text.secondary}}>{r}</div>
          ))}
          <button onClick={()=>navigate("/reports")} style={{marginTop:6,fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"2px 8px",cursor:"pointer",width:"100%"}}>VIEW REPORTS →</button>
        </div>
        <div style={{background:T.bg.panel,padding:10}}>
          <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>TEAM</div>
          {[{n:"James R.",role:"Principal",status:"Active"},{n:"Marcus C.",role:"Analyst",status:"Active"},{n:"Sarah K.",role:"Researcher",status:"Active"},{n:"David P.",role:"Advisor",status:"Active"}].map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
              <div><div style={{fontSize:9,color:T.text.primary,fontWeight:600}}>{m.n}</div><div style={{fontSize:7,color:T.text.muted}}>{m.role}</div></div>
              <Bd c={T.text.green}>{m.status}</Bd>
            </div>
          ))}
          <button onClick={()=>navigate("/team")} style={{marginTop:6,fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"2px 8px",cursor:"pointer",width:"100%"}}>VIEW TEAM →</button>
        </div>
      </div>
      <div style={{margin:"0 10px 10px",padding:8,background:T.bg.panel,border:`1px solid ${T.border.subtle}`}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:T.text.cyan}}/>
          <span style={{fontSize:9,fontWeight:700,color:T.text.white,letterSpacing:0.5}}>CORPORATE HEALTH OVERLAY</span>
        </div>
        {(() => {
          const s = corpHealthLive.schi ?? DEMO_SCHI;
          const d = corpHealthLive.divergence ?? DEMO_DIVERGENCE;
          const h = corpHealthLive.herfindahl ?? DEMO_HERFINDAHL;
          const topEmp = corpHealthLive.employers.length>0 ? (corpHealthLive.employers[0]?.company||corpHealthLive.employers[0]?.company_name||"\u2014") : CORP_HEALTH_DEMO[0].company;
          return <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:s>=60?T.text.green:s>=40?T.text.amber:T.text.red}}>{s.toFixed(0)}</div>
              <div style={{fontSize:7,color:T.text.muted}}>SCHI</div>
            </div>
            <div style={{width:1,height:30,background:T.border.subtle}}/>
            <div>
              <div style={{fontSize:9,color:T.text.secondary}}>Divergence: <span style={{fontWeight:700,color:Math.abs(d)>15?T.text.amber:T.text.green}}>{(d>0?"+":"")+d.toFixed(1)}</span></div>
              <div style={{fontSize:9,color:T.text.secondary}}>Top Employer: <span style={{fontWeight:600,color:T.text.primary}}>{topEmp}</span></div>
              <div style={{fontSize:9,color:T.text.secondary}}>HHI: <span style={{fontWeight:600,color:h<0.1?T.text.green:T.text.red}}>{h.toFixed(3)}</span></div>
            </div>
            <div style={{marginLeft:"auto"}}>
              <Spark data={[68,67,69,70,68,69,s]} color={s>=60?T.text.green:T.text.amber} w={60} h={16}/>
              <div style={{fontSize:7,color:T.text.muted,textAlign:"center"}}>4Q trend</div>
            </div>
          </div>;
        })()}
      </div>
    </div>
  );

  // ─── F9: ORG SETTINGS ─────────────────────────────────────
  const fetchOrgData = useCallback(() => {
    setOrgLoading(true); setOrgError(""); setOrgSuccess("");
    apiClient.get("/api/v1/orgs/mine")
      .then(res => {
        const orgs = Array.isArray(res.data) ? res.data : [];
        if(orgs.length > 0) {
          const org = orgs[0];
          setOrgData(org);
          return Promise.all([
            apiClient.get(`/api/v1/orgs/${org.id}/members`),
            apiClient.get(`/api/v1/orgs/${org.id}/invitations`).catch(()=>({data:[]})),
          ]);
        }
        setOrgData(null);
        return null;
      })
      .then(results => {
        if(results) {
          setOrgMembers(Array.isArray(results[0].data) ? results[0].data : []);
          setOrgInvitations(Array.isArray(results[1].data) ? results[1].data : []);
        }
      })
      .catch(() => setOrgError("Failed to load organization data"))
      .finally(() => setOrgLoading(false));
  }, []);

  useEffect(() => { if(fkey === "F9") fetchOrgData(); }, [fkey, fetchOrgData]);

  const corpHealthStore = useCorporateHealth();
  const fetchSubmarketHealth = useCorporateHealthStore(s => s.fetchSubmarketHealth);

  useEffect(() => {
    if (fkey !== "F4" || marketTab !== "corphealth" || corpHealthLive.loaded || corpHealthLive.loading) return;
    setCorpHealthLive(prev => ({...prev, loading: true}));

    const submarketIds = SUBMARKETS.map((_, i) => i + 1);
    const firstSubmarketId = submarketIds[0] || 1;

    fetchSubmarketHealth(firstSubmarketId).catch(() => {});

    Promise.all([
      api.corporateHealth.getAlerts().catch(() => ({data:{data:{alerts:[]}}})),
      api.corporateHealth.getSectorRotation().catch(() => ({data:{data:{sectors:[],markets:[]}}})),
      api.corporateHealth.getSubmarket(firstSubmarketId).catch(() => ({data:{data:null}})),
      api.corporateHealth.getConcentration(firstSubmarketId).catch(() => ({data:{data:null}})),
      api.corporateHealth.getPortfolio().catch(() => ({data:{data:{submarkets:[],topEmployers:[]}}})),
    ]).then(([alertsRes, sectorsRes, subRes, concRes, portfolioRes]) => {
      const alerts = Array.isArray(alertsRes.data?.data?.alerts) ? alertsRes.data.data.alerts : [];
      const sectorRotation = sectorsRes.data?.data || {sectors:[],markets:[]};
      const subData = subRes.data?.data;
      const concData = concRes.data?.data;
      const portfolioData = portfolioRes.data?.data || {};
      setCorpHealthLive(prev => ({
        ...prev,
        alerts,
        sectors: subData?.sectorBreakdown || {},
        sectorRotation,
        portfolioSubmarkets: portfolioData.submarkets || [],
        topEmployers: portfolioData.topEmployers || [],
        schi: subData?.schi ?? null,
        reHealth: subData?.reHealth ?? null,
        divergence: subData?.divergence ?? null,
        herfindahl: concData?.herfindahl ?? null,
        employers: subData?.employers || [],
        loaded: true,
        loading: false,
      }));
    }).catch(() => {
      setCorpHealthLive(prev => ({...prev, loaded: true, loading: false}));
    });
  }, [fkey, marketTab, corpHealthLive.loaded, corpHealthLive.loading, fetchSubmarketHealth]);

  const handleInvite = () => {
    if(!inviteEmail || !orgData) return;
    setOrgError(""); setOrgSuccess("");
    apiClient.post(`/api/v1/orgs/${orgData.id}/invitations`, { email: inviteEmail, role: inviteRole })
      .then(() => { setOrgSuccess(`Invitation sent to ${inviteEmail}`); setInviteEmail(""); fetchOrgData(); })
      .catch(err => setOrgError(err.response?.data?.error || "Failed to send invitation"));
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    if(!orgData) return;
    apiClient.put(`/api/v1/orgs/${orgData.id}/members/${memberId}/role`, { role: newRole })
      .then(() => { setOrgSuccess("Role updated"); fetchOrgData(); })
      .catch(err => setOrgError(err.response?.data?.error || "Failed to update role"));
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    if(!orgData || !confirm(`Remove ${name} from the organization?`)) return;
    apiClient.delete(`/api/v1/orgs/${orgData.id}/members/${memberId}`)
      .then(() => { setOrgSuccess("Member removed"); fetchOrgData(); })
      .catch(err => setOrgError(err.response?.data?.error || "Failed to remove member"));
  };

  const ViewOrgSettings = () => {
    const myRole = orgData?.my_role || "viewer";
    const canManage = myRole === "owner" || myRole === "principal";
    const isOwner = myRole === "owner";
    const roleBadgeColor: Record<string,string> = { owner: T.text.amber, principal: T.text.cyan, analyst: T.text.green, viewer: T.text.muted };
    return (
      <div style={{flex:1,overflow:"auto",animation:"fadeIn 0.15s"}}>
        <PanelHeader T={T} title="ORG SETTINGS" subtitle={orgData ? orgData.name : "Organization Management"} borderColor={T.text.cyan}
          right={<span style={{fontSize:8,color:T.text.muted}}>YOUR ROLE: <span style={{color:roleBadgeColor[myRole]||T.text.muted,fontWeight:700}}>{myRole.toUpperCase()}</span></span>}/>
        {orgLoading ? (
          <div style={{display:"flex",justifyContent:"center",padding:40}}><span style={{fontSize:10,color:T.text.muted,animation:"pulse 1.5s infinite"}}>Loading organization data...</span></div>
        ) : !orgData ? (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:60,gap:12}}>
            <div style={{fontSize:14,color:T.text.muted}}>No organization found</div>
            <div style={{fontSize:9,color:T.text.secondary}}>Contact support to create your organization</div>
          </div>
        ) : (
          <div style={{padding:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {orgError && <div style={{gridColumn:"1/-1",background:T.text.red+"18",border:`1px solid ${T.text.red}44`,padding:"6px 10px",fontSize:9,color:T.text.red}}>{orgError}</div>}
            {orgSuccess && <div style={{gridColumn:"1/-1",background:T.text.green+"18",border:`1px solid ${T.text.green}44`,padding:"6px 10px",fontSize:9,color:T.text.green}}>{orgSuccess}</div>}
            <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`}}>
              <div style={{padding:"8px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`}}>
                <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.8}}>MEMBERS</span>
                <span style={{fontSize:8,color:T.text.muted,marginLeft:8}}>{orgMembers.length} total</span>
              </div>
              <div style={{maxHeight:300,overflow:"auto"}}>
                {orgMembers.map((m,i)=>(
                  <div key={m.id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:9,color:T.text.primary,fontWeight:600}}>{m.full_name || m.first_name || m.email}</div>
                      <div style={{fontSize:7,color:T.text.muted}}>{m.email}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {isOwner && m.role !== "owner" ? (
                        <select value={m.role} onChange={e=>handleRoleChange(m.id, e.target.value)}
                          style={{fontFamily:T.font.mono,fontSize:8,background:T.bg.input,color:T.text.primary,border:`1px solid ${T.border.subtle}`,padding:"2px 4px",cursor:"pointer"}}>
                          <option value="principal">PRINCIPAL</option>
                          <option value="analyst">ANALYST</option>
                          <option value="viewer">VIEWER</option>
                        </select>
                      ) : (
                        <Bd c={roleBadgeColor[m.role]||T.text.muted}>{m.role}</Bd>
                      )}
                      {isOwner && m.role !== "owner" && (
                        <button onClick={()=>handleRemoveMember(m.id, m.full_name||m.email)}
                          style={{fontFamily:T.font.mono,fontSize:8,color:T.text.red,background:"transparent",border:`1px solid ${T.text.red}44`,padding:"1px 6px",cursor:"pointer"}}>x</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {canManage && (
                <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`}}>
                  <div style={{padding:"8px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`}}>
                    <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.8}}>INVITE MEMBER</span>
                  </div>
                  <div style={{padding:10}}>
                    <div style={{display:"flex",gap:6,marginBottom:6}}>
                      <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="email@example.com"
                        style={{flex:1,fontFamily:T.font.mono,fontSize:9,background:T.bg.input,color:T.text.primary,border:`1px solid ${T.border.subtle}`,padding:"4px 8px",outline:"none"}}
                        onKeyDown={e=>{if(e.key==="Enter")handleInvite();}}/>
                      <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                        style={{fontFamily:T.font.mono,fontSize:8,background:T.bg.input,color:T.text.primary,border:`1px solid ${T.border.subtle}`,padding:"4px",cursor:"pointer"}}>
                        <option value="principal">PRINCIPAL</option>
                        <option value="analyst">ANALYST</option>
                        <option value="viewer">VIEWER</option>
                      </select>
                    </div>
                    <button onClick={handleInvite}
                      style={{fontFamily:T.font.mono,fontSize:8,color:T.text.white,background:T.text.cyan+"33",border:`1px solid ${T.text.cyan}`,padding:"4px 12px",cursor:"pointer",width:"100%",fontWeight:700,letterSpacing:0.5}}>+ SEND INVITATION</button>
                    <div style={{marginTop:6,fontSize:7,color:T.text.muted}}>
                      Roles: <span style={{color:T.text.amber}}>OWNER</span> (full control) · <span style={{color:T.text.cyan}}>PRINCIPAL</span> (manage + invite) · <span style={{color:T.text.green}}>ANALYST</span> (read/write deals) · <span style={{color:T.text.muted}}>VIEWER</span> (read-only)
                    </div>
                  </div>
                </div>
              )}
              <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`}}>
                <div style={{padding:"8px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`}}>
                  <span style={{fontSize:10,fontWeight:700,color:T.text.white,letterSpacing:0.8}}>PENDING INVITATIONS</span>
                  <span style={{fontSize:8,color:T.text.muted,marginLeft:8}}>{orgInvitations.filter((inv:any)=>inv.status==="pending").length} pending</span>
                </div>
                <div style={{maxHeight:200,overflow:"auto"}}>
                  {orgInvitations.length === 0 ? (
                    <div style={{padding:10,fontSize:9,color:T.text.muted,textAlign:"center"}}>No invitations sent</div>
                  ) : orgInvitations.map((inv:any,i:number)=>(
                    <div key={inv.id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
                      <div>
                        <div style={{fontSize:9,color:T.text.primary}}>{inv.email}</div>
                        <div style={{fontSize:7,color:T.text.muted}}>Invited by {inv.invited_by_name||"—"} · {inv.role}</div>
                      </div>
                      <Bd c={inv.status==="pending"?T.text.orange:inv.status==="accepted"?T.text.green:T.text.red}>{inv.status}</Bd>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:10}}>
                <div style={{fontSize:10,fontWeight:700,color:T.text.white,marginBottom:6}}>ORGANIZATION</div>
                <div style={{fontSize:8,color:T.text.secondary,marginBottom:3}}>Name: <span style={{color:T.text.primary}}>{orgData.name}</span></div>
                <div style={{fontSize:8,color:T.text.secondary,marginBottom:3}}>Slug: <span style={{color:T.text.muted}}>{orgData.slug}</span></div>
                <div style={{fontSize:8,color:T.text.secondary}}>Created: <span style={{color:T.text.muted}}>{orgData.created_at ? new Date(orgData.created_at).toLocaleDateString() : "—"}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── MAIN CONTENT ROUTER ───────────────────────────────────
  const renderContent = () => {
    switch(fkey) {
      case "F1": return ViewDashboard();
      case "F2": return DealGrid();
      case "F3": return ViewPortfolio();
      case "F4": return ViewMarkets();
      case "F5": return ViewEmail();
      case "F6": return ViewCompete();
      case "F7": return ViewStrategies();
      case "F8": return ViewTools();
      case "F9": return ViewOrgSettings();
      default: return null;
    }
  };

  // ─── BOTTOM PANEL CONTENT ──────────────────────────────────
  const renderBottomTab = () => {
    if(bottomTab==="alerts") return liveAlerts.map((a,i)=>{
      const bc=({critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted} as Record<string,string>)[a.sev];
      return <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}><div style={{flex:1}}><div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd>{a.deal&&<span style={{fontSize:8,color:T.text.amber,fontWeight:600}}>{a.deal}</span>}</div><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div></div><span style={{fontSize:7,color:T.text.muted}}>{a.time}</span></div>;
    });
    if(bottomTab==="news") return liveNews.map((n,i)=>(
      <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
        <span style={{fontSize:8,color:T.text.muted,minWidth:34}}>{n.time}</span>
        <div style={{flex:1}}><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{n.hl}</div>{n.affects.length>0&&<div style={{display:"flex",gap:3,marginTop:2}}>{n.affects.map((a,j)=><Bd key={j} c={T.text.amber}>{a}</Bd>)}</div>}</div>
        <div style={{textAlign:"right",minWidth:50}}><div style={{fontSize:8,fontWeight:700,color:n.impact.includes("+")?T.text.green:T.text.red}}>{n.impact}</div><div style={{fontSize:8,color:n.pts.startsWith("+")?T.text.green:T.text.red}}>{n.pts}</div></div>
      </div>
    ));
    if(bottomTab==="email") return liveEmails.map((e,i)=>(
      <div key={i} style={{display:"flex",gap:8,padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,background:e.unread?T.text.amber+"06":T.bg.panel}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:1}}>
            <span style={{fontSize:9,fontWeight:e.unread?700:400,color:e.unread?T.text.primary:T.text.secondary}}>{e.from}</span>
            {e.unread&&<span style={{width:5,height:5,borderRadius:"50%",background:T.text.orange,display:"inline-block"}}/>}
          </div>
          <div style={{fontSize:9,color:e.unread?T.text.primary:T.text.secondary,fontWeight:e.unread?600:400,lineHeight:1.3}}>{e.subject}</div>
        </div>
        <span style={{fontSize:7,color:T.text.muted,whiteSpace:"nowrap"}}>{e.time}</span>
      </div>
    ));
    if(bottomTab==="agents") return (
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border.subtle}}>
        {liveAgents.map((a,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"5px 8px",borderLeft:a.st==="ON"?`2px solid ${T.text.green}`:`2px solid ${T.text.muted}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}><span style={{fontSize:8,fontWeight:700,color:T.text.purple}}>{a.id} <span style={{color:T.text.primary}}>{a.name}</span></span><span style={{fontSize:7,color:a.st==="ON"?T.text.green:T.text.muted}}>{a.st}</span></div>
            <div style={{fontSize:8,color:T.text.secondary,lineHeight:1.3}}>{a.act}</div>
            <div style={{fontSize:7,color:T.text.muted,marginTop:1}}>{a.t} ago · {a.m} msgs</div>
          </div>
        ))}
      </div>
    );
    if(bottomTab==="tasks") {
      const pc:Record<string,string>={critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted};
      const sc:Record<string,string>={"TODO":T.text.muted,"IN PROGRESS":T.text.cyan,"DONE":T.text.green};
      return liveTasks.map((t,i)=>(
        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${pc[t.pri]}`,background:i%2===0?T.bg.panel:T.bg.panelAlt,opacity:t.status==="DONE"?0.5:1}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9,fontWeight:600,color:t.status==="DONE"?T.text.muted:T.text.primary,textDecoration:t.status==="DONE"?"line-through":"none"}}>{t.title}</div>
            <div style={{marginTop:2,display:"flex",gap:4}}><Bd c={T.text.amber}>{t.deal}</Bd><Bd c={pc[t.pri]}>{t.pri.toUpperCase()}</Bd></div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:8,fontWeight:700,color:sc[t.status]}}>{t.status}</div>
            <div style={{fontSize:7,color:T.text.muted,marginTop:1}}>{t.due} · {t.owner}</div>
          </div>
        </div>
      ));
    }
    if(bottomTab==="media") return (
      <div style={{display:"flex",gap:0,height:"100%"}}>
        <div style={{flex:1,borderRight:`1px solid ${T.border.subtle}`,overflow:"auto",padding:"6px 10px"}}>
          <div style={{fontSize:8,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>LIVE TV</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
            {TV_CHANNELS.map(ch=>{
              const isOpen=mediaWindows.some(w=>w.id===`tv-${ch.id}`);
              return (
                <div key={ch.id} onClick={()=>openMediaWindow({id:`tv-${ch.id}`,type:"tv",title:ch.label,color:ch.color,url:ch.url})}
                  style={{background:T.bg.panel,border:`1px solid ${isOpen?ch.color:T.border.subtle}`,padding:"8px 8px",cursor:"pointer",textAlign:"center",position:"relative"}}>
                  {isOpen&&<span style={{position:"absolute",top:3,right:4,width:5,height:5,borderRadius:"50%",background:T.text.red,animation:"pulse 1.5s infinite"}}/>}
                  <div style={{fontSize:10,fontWeight:700,color:isOpen?ch.color:T.text.primary,letterSpacing:0.5}}>{ch.label}</div>
                  <div style={{fontSize:7,color:T.text.muted,marginTop:2}}>{isOpen?"WATCHING":"Click to open"}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{flex:1,borderRight:`1px solid ${T.border.subtle}`,overflow:"auto",padding:"6px 10px"}}>
          <div style={{fontSize:8,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>NEWS FEEDS</div>
          {NEWS_SOURCES.map(src=>{
            const isOpen=mediaWindows.some(w=>w.id===`rss-${src.id}`);
            return (
              <div key={src.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:src.color,flexShrink:0,display:"inline-block"}}/>
                <span style={{fontSize:9,fontWeight:600,color:T.text.primary,flex:1}}>{src.label}</span>
                <button onClick={()=>{openMediaWindow({id:`rss-${src.id}`,type:"rss",title:src.label,color:src.color,rssUrl:src.rss});fetchRss(src.rss);}}
                  style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,background:isOpen?src.color+"22":"transparent",color:isOpen?src.color:T.text.muted,border:`1px solid ${isOpen?src.color:T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>
                  {isOpen?"OPEN":"OPEN FEED"}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{flex:1,overflow:"auto",padding:"6px 10px"}}>
          <div style={{fontSize:8,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>SOCIAL / X</div>
          {SOCIAL_DEFAULTS.map(s=>{
            const isOpen=mediaWindows.some(w=>w.id===`social-${s.id}`);
            return (
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                <span style={{fontSize:9,fontWeight:600,color:T.text.primary,flex:1}}>{s.label}</span>
                <button onClick={()=>openMediaWindow({id:`social-${s.id}`,type:"social",title:s.label,color:"#1DA1F2",handle:s.handle})}
                  style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,background:isOpen?"#1DA1F222":"transparent",color:isOpen?"#1DA1F2":T.text.muted,border:`1px solid ${isOpen?"#1DA1F2":T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>
                  {isOpen?"OPEN":"OPEN"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
    return null;
  };

  const renderMediaWindowContent = (win: MediaWindow) => {
    if (win.type === "tv") {
      return (
        <iframe src={win.url} style={{width:"100%",height:"100%",border:"none"}} allow="autoplay; encrypted-media" allowFullScreen/>
      );
    }
    if (win.type === "rss") {
      const items = rssCache[win.rssUrl||""]?.items || [];
      return (
        <div style={{flex:1,overflow:"auto",padding:0}}>
          {items.length === 0 && (
            <div style={{padding:20,textAlign:"center"}}>
              <div style={{fontSize:9,color:T.text.muted,animation:"pulse 1.5s infinite"}}>Loading feed...</div>
            </div>
          )}
          {items.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
              style={{display:"block",padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,textDecoration:"none",background:i%2===0?T.bg.panel:T.bg.panelAlt,cursor:"pointer"}}>
              <div style={{fontSize:9,fontWeight:600,color:T.text.primary,lineHeight:1.4}}>{item.title}</div>
              <div style={{fontSize:7,color:T.text.muted,marginTop:2}}>
                {item.pubDate ? new Date(item.pubDate).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}
                {item.source && ` · ${item.source}`}
              </div>
            </a>
          ))}
          <div style={{padding:"6px 10px"}}>
            <button onClick={() => { if(win.rssUrl) { setRssCache(prev => { const ns = {...prev}; delete ns[win.rssUrl!]; return ns; }); fetchRss(win.rssUrl); } }}
              style={{fontFamily:T.font.mono,fontSize:8,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"3px 10px",cursor:"pointer",width:"100%"}}>
              REFRESH
            </button>
          </div>
        </div>
      );
    }
    if (win.type === "social") {
      const handle = win.handle || "";
      const isHashtag = handle.startsWith("#");
      const twitterUrl = isHashtag
        ? `https://twitter.com/search?q=${encodeURIComponent(handle)}&src=typed_query&f=live`
        : `https://twitter.com/${handle.replace("@","")}`;
      return (
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:16}}>
          <div style={{fontSize:24,color:"#1DA1F2",fontWeight:800}}>𝕏</div>
          <div style={{fontSize:12,fontWeight:700,color:T.text.primary}}>{handle}</div>
          <div style={{fontSize:9,color:T.text.secondary,textAlign:"center",lineHeight:1.5}}>
            Twitter/X embeds require the platform widget script.<br/>
            Click below to open in a new tab.
          </div>
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
            style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,background:"#1DA1F2",color:"#fff",border:"none",padding:"8px 20px",cursor:"pointer",textDecoration:"none",letterSpacing:0.3}}>
            OPEN ON X →
          </a>
        </div>
      );
    }
    return null;
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div style={{background:T.bg.terminal,height:"100vh",fontFamily:T.font.mono,color:T.text.primary,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{TERMINAL_CSS}</style>
      {/* CRT overlay */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)"}}/>

      {/* ═══ TOP STATUS BAR — 36px ═══ */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:36,background:T.bg.topBar,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontFamily:T.font.display,fontSize:14,fontWeight:800,color:T.text.amber,letterSpacing:2}}>JEDI RE</span>
          <span style={{fontSize:9,color:T.text.muted}}>|</span>
          <span style={{fontSize:9,color:T.text.secondary}}>PORTFOLIO VIEW</span>
          <span style={{fontSize:9,color:T.text.muted}}>|</span>
          <span style={{fontSize:9,color:T.text.muted}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:9,color:T.text.green,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:T.text.green,animation:"glow 2s infinite"}}/>{liveAgents.filter(a=>a.st==="ON").length} AGENTS</span>
          <span style={{fontSize:9,color:T.text.cyan}}>EMAIL: {liveEmails.filter(e=>e.unread).length}</span>
          {mediaWindows.length>0&&(
            <div style={{position:"relative"}}>
              <button onClick={()=>setMediaWinDropdown(p=>!p)} style={{fontFamily:T.font.mono,fontSize:9,color:T.text.orange,background:"transparent",border:`1px solid ${T.text.orange}44`,padding:"1px 8px",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:T.text.orange,display:"inline-block"}}/>
                {mediaWindows.length} WINDOW{mediaWindows.length!==1?"S":""}
              </button>
              {mediaWinDropdown&&(
                <div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:T.bg.panel,border:`1px solid ${T.border.medium}`,boxShadow:"0 8px 24px rgba(0,0,0,0.6)",zIndex:9998,minWidth:200,maxHeight:300,overflow:"auto"}}>
                  {mediaWindows.map(w=>(
                    <div key={w.id} onClick={()=>{bringMediaToFront(w.id);if(mediaWinStates[w.id]?.minimized)minimizeMediaWindow(w.id);setMediaWinDropdown(false);}}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",background:T.bg.panel}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:w.color,flexShrink:0,display:"inline-block"}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{w.title}</div>
                        <div style={{fontSize:7,color:T.text.muted}}>{w.type.toUpperCase()}{mediaWinStates[w.id]?.minimized?" · minimized":""}</div>
                      </div>
                      <button onClick={(e)=>{e.stopPropagation();closeMediaWindow(w.id);}}
                        style={{fontSize:8,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 4px"}}>✕</button>
                    </div>
                  ))}
                  <div style={{padding:"4px 10px",borderTop:`1px solid ${T.border.medium}`}}>
                    <button onClick={()=>{setMediaWindows([]);setMediaWinStates({});setMediaWinDropdown(false);}}
                      style={{fontFamily:T.font.mono,fontSize:7,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"2px 8px",cursor:"pointer",width:"100%"}}>
                      CLOSE ALL
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <span style={{fontSize:9,color:T.text.secondary}}>KAFKA: 312/s</span>
          <span style={{fontSize:9,color:T.text.amber,fontWeight:600}}>{time.toLocaleTimeString("en-US",{hour12:false})}</span>
          <button onClick={toggleTheme} style={{fontFamily:T.font.mono,fontSize:12,background:"transparent",border:`1px solid ${T.border.medium}`,color:T.text.secondary,padding:"2px 8px",cursor:"pointer",lineHeight:1}} title={theme==="dark"?"Switch to light":"Switch to dark"}>
            {theme==="dark"?"☀":"☾"}
          </button>
        </div>
      </div>

      {/* ═══ TICKER — 27px ═══ */}
      <div style={{height:27,background:"#06080E",borderBottom:`1px solid ${T.border.subtle}`,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center"}}>
        <div style={{display:"flex",gap:24,whiteSpace:"nowrap",animation:"ticker 45s linear infinite",fontSize:9,lineHeight:"27px"}}>
          {[...TICKERS,...TICKERS].map((t,i)=>(
            <span key={i} style={{color:t.startsWith("^")?T.text.green:t.startsWith("v")?T.text.red:T.text.amber}}>{t}</span>
          ))}
        </div>
      </div>

      {/* ═══ KPI BAR — 50px ═══ */}
      <div style={{display:"flex",alignItems:"stretch",background:T.bg.panel,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,height:50}}>
        {[
          {l:"TOTAL PIPELINE",v:totalPV>0?`$${totalPV.toFixed(1)}M`:`${liveDeals.length}`,c:T.text.amberBright,sub:`${liveDeals.length} deals`},
          {l:"ACTIVE DEALS",v:String(activeCount),c:T.text.cyan,sub:"in progress"},
          {l:"PORTFOLIO ASSETS",v:"23",c:T.text.green,sub:"owned"},
          {l:"AVG DAYS/DEAL",v:liveDeals.length>0?String(Math.round(liveDeals.reduce((s,d)=>s+d.days,0)/liveDeals.length)):"—",c:T.text.amber,sub:"avg time"},
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
          <button onClick={()=>navigate("/deals/create")} style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"6px 14px",cursor:"pointer",letterSpacing:0.5}}>+ CREATE DEAL</button>
        </div>
      </div>

      {/* ═══ F-KEY NAV BAR ═══ */}
      <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,background:T.bg.header}}>
        <div style={{display:"flex",flex:1,overflow:"auto"}}>
          {PORTFOLIO_NAV.map(n=>(
            <button key={n.key} onClick={()=>setFkey(n.key)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:600,padding:"0 11px",height:30,cursor:"pointer",background:fkey===n.key?T.text.amber:"transparent",color:fkey===n.key?T.bg.terminal:T.text.secondary,border:"none",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",flexShrink:0}}>
              <span style={{fontSize:7,fontWeight:700,opacity:0.6,color:fkey===n.key?T.bg.terminal:T.text.muted}}>{n.key}</span>
              {n.label}
            </button>
          ))}
        </div>
        <div style={{padding:"0 8px",borderLeft:`1px solid ${T.border.medium}`}}>
          <div style={{display:"flex",alignItems:"center",gap:3,background:T.bg.input,border:`1px solid ${T.border.subtle}`,padding:"0 6px",height:22,width:190}}>
            <span style={{color:T.text.amber,fontSize:9,fontWeight:700}}>{">"}</span>
            <input ref={cmdInputRef} value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="CMD (⌘K)" style={{background:"transparent",border:"none",outline:"none",fontFamily:T.font.mono,fontSize:9,color:T.text.primary,flex:1,width:"100%"}}/>
            <span style={{width:6,height:12,background:T.text.amber,animation:"blink 1s infinite",display:"inline-block"}}/>
          </div>
        </div>
      </div>

      {/* ═══ GLOBAL FILTER TOOLBAR ═══ */}
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

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        {renderContent()}
        {mapOpen&&<MapSidebar/>}
      </div>

      {/* ═══ BOTTOM PANEL — 190px ═══ */}
      <div style={{height:190,borderTop:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0,background:T.bg.panel}}>
        <div style={{display:"flex",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
          {[
            {id:"alerts",l:"ALERTS",ct:hAlerts,cc:T.text.red},
            {id:"news",l:"NEWS",ct:liveNews.length,cc:T.text.cyan},
            {id:"email",l:"EMAIL",ct:liveEmails.filter(e=>e.unread).length,cc:T.text.orange},
            {id:"agents",l:"AGENTS",ct:liveAgents.filter(a=>a.st==="ON").length,cc:T.text.green},
            {id:"tasks",l:"TASKS",ct:liveTasks.filter(t=>t.status!=="DONE").length,cc:T.text.amber},
            {id:"media",l:"MEDIA",ct:mediaWindows.length,cc:T.text.orange},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setBottomTab(tab.id)} style={{fontFamily:T.font.mono,fontSize:9,fontWeight:600,color:bottomTab===tab.id?T.bg.terminal:T.text.secondary,background:bottomTab===tab.id?T.text.amber:"transparent",border:"none",cursor:"pointer",padding:"4px 14px",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
              {tab.l}
              <span style={{fontSize:7,fontWeight:700,padding:"0px 4px",background:bottomTab===tab.id?"rgba(0,0,0,0.2)":tab.cc+"18",color:bottomTab===tab.id?"rgba(0,0,0,0.7)":tab.cc}}>{tab.ct}</span>
            </button>
          ))}
          <div style={{flex:1}}/>
          <div style={{display:"flex",alignItems:"center",paddingRight:12,gap:6}}>
            <button onClick={()=>navigate("/news-intel")} style={{fontFamily:T.font.mono,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>NEWS INTEL →</button>
          </div>
        </div>
        <div style={{flex:1,overflow:"auto"}}>
          {renderBottomTab()}
        </div>
      </div>

      {/* ═══ DASHBOARD FLOATING WINDOWS (global overlay — floated widgets only) ═══ */}
      {floatWidgets.filter(id=>!winStates[id]?.minimized).map(id=>{
        const meta=WIDGET_CATALOG.find(w=>w.id===id);
        const ws=winStates[id]||defaultWinPos(id,0);
        if(!meta) return null;
        const isMax=ws.maximized;
        const isMoving=dragInfo?.id===id&&dragInfo.mode==="move";
        return (
          <div key={id}
            onMouseDown={()=>bringToFront(id)}
            style={{
              position:"fixed",
              left:isMax?"5%":ws.x, top:isMax?"5%":ws.y,
              width:isMax?"90%":ws.w, height:isMax?"90%":ws.h,
              background:T.bg.panel,
              border:`1px solid ${meta.color}55`,
              boxShadow:isMax?"0 16px 64px rgba(0,0,0,0.7)":"0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
              display:"flex",flexDirection:"column",
              zIndex:ws.zIndex||50,
              minWidth:320,minHeight:200,
              transition:isMoving||dragInfo?.mode==="resize"?"none":"box-shadow 0.15s",
            }}>
            <div
              onMouseDown={(e)=>{if(!isMax){e.preventDefault();bringToFront(id);setDragInfo({id,ox:e.clientX-ws.x,oy:e.clientY-ws.y,mode:"move"});}}}
              onDoubleClick={()=>maximizeWindow(id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",background:T.bg.header,borderBottom:`1px solid ${meta.color}44`,flexShrink:0,cursor:isMax?"default":isMoving?"grabbing":"grab",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:meta.color,display:"inline-block"}}/>
                <span style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.primary,letterSpacing:0.3}}>{meta.label}</span>
                <span style={{fontSize:7,color:T.text.muted,opacity:0.6}}>{meta.category}</span>
              </div>
              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                <button onClick={(e)=>{e.stopPropagation();dockWidget(id);}} title="Dock back to grid" style={{fontFamily:T.font.mono,fontSize:7,fontWeight:700,color:T.text.cyan,background:T.text.cyan+"11",border:`1px solid ${T.text.cyan}33`,cursor:"pointer",padding:"1px 6px",lineHeight:1.5,letterSpacing:0.3,marginRight:2}}>↙ DOCK</button>
                <button onClick={(e)=>{e.stopPropagation();minimizeWindow(id);}} title="Minimize" style={{fontFamily:T.font.mono,fontSize:12,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>—</button>
                <button onClick={(e)=>{e.stopPropagation();maximizeWindow(id);}} title={isMax?"Restore":"Maximize"} style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>{isMax?"❐":"□"}</button>
                <button onClick={(e)=>{e.stopPropagation();closeWindow(id);}} title="Close" style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>✕</button>
              </div>
            </div>
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
              {renderWidget(id)}
            </div>
            {!isMax&&<div onMouseDown={(e)=>{e.preventDefault();e.stopPropagation();bringToFront(id);setDragInfo({id,ox:e.clientX,oy:e.clientY,mode:"resize"});}} style={{position:"absolute",bottom:0,right:0,width:14,height:14,cursor:"nwse-resize",background:`linear-gradient(135deg,transparent 40%,${T.border.medium} 40%)`,zIndex:1}}/>}
          </div>
        );
      })}
      {floatWidgets.filter(id=>winStates[id]?.minimized).length>0&&(
        <div style={{position:"fixed",bottom:210,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:9996,background:T.bg.header,border:`1px solid ${T.border.medium}`,padding:"4px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}>
          {floatWidgets.filter(id=>winStates[id]?.minimized).map(id=>{
            const meta=WIDGET_CATALOG.find(w=>w.id===id);
            if(!meta) return null;
            return (
              <button key={id} onClick={()=>minimizeWindow(id)} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.font.mono,fontSize:8,fontWeight:600,background:T.bg.panel,border:`1px solid ${meta.color}44`,color:T.text.secondary,padding:"3px 10px",cursor:"pointer"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:meta.color,display:"inline-block"}}/>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ MEDIA FLOATING WINDOWS (global overlay) ═══ */}
      {mediaWindows.filter(w=>!mediaWinStates[w.id]?.minimized).map(win=>{
        const ws=mediaWinStates[win.id];
        if(!ws) return null;
        const isMax=ws.maximized;
        const isDragging=mediaDragInfo?.id===win.id&&mediaDragInfo.mode==="move";
        return (
          <div key={win.id}
            onMouseDown={()=>bringMediaToFront(win.id)}
            style={{
              position:"fixed",
              left:isMax?"5%":ws.x, top:isMax?"5%":ws.y,
              width:isMax?"90%":ws.w, height:isMax?"90%":ws.h,
              background:T.bg.panel,
              border:`1px solid ${win.color}66`,
              boxShadow:isMax?"0 16px 64px rgba(0,0,0,0.7)":"0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
              display:"flex",flexDirection:"column",
              zIndex:ws.zIndex||100,
              minWidth:320,minHeight:200,
              transition:isDragging||mediaDragInfo?.mode==="resize"?"none":"box-shadow 0.15s",
            }}>
            <div
              onMouseDown={(e)=>{if(!isMax){e.preventDefault();bringMediaToFront(win.id);setMediaDragInfo({id:win.id,ox:e.clientX-ws.x,oy:e.clientY-ws.y,mode:"move"});}}}
              onDoubleClick={()=>maximizeMediaWindow(win.id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",background:T.bg.header,borderBottom:`1px solid ${win.color}44`,flexShrink:0,cursor:isMax?"default":isDragging?"grabbing":"grab",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:win.color,display:"inline-block"}}/>
                <span style={{fontFamily:T.font.mono,fontSize:9,fontWeight:700,color:T.text.primary,letterSpacing:0.3}}>{win.title}</span>
                <span style={{fontSize:7,color:T.text.muted,opacity:0.6}}>{win.type.toUpperCase()}</span>
                {win.type==="tv"&&<span style={{display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:T.text.red,animation:"pulse 1.5s infinite"}}/><span style={{fontSize:7,color:T.text.red,fontWeight:700}}>LIVE</span></span>}
              </div>
              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                <button onClick={(e)=>{e.stopPropagation();minimizeMediaWindow(win.id);}} title="Minimize" style={{fontFamily:T.font.mono,fontSize:12,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>—</button>
                <button onClick={(e)=>{e.stopPropagation();maximizeMediaWindow(win.id);}} title={isMax?"Restore":"Maximize"} style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>{isMax?"❐":"□"}</button>
                <button onClick={(e)=>{e.stopPropagation();closeMediaWindow(win.id);}} title="Close" style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>✕</button>
              </div>
            </div>
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
              {renderMediaWindowContent(win)}
            </div>
            {!isMax&&<div onMouseDown={(e)=>{e.preventDefault();e.stopPropagation();bringMediaToFront(win.id);setMediaDragInfo({id:win.id,ox:e.clientX,oy:e.clientY,mode:"resize"});}} style={{position:"absolute",bottom:0,right:0,width:14,height:14,cursor:"nwse-resize",background:`linear-gradient(135deg,transparent 40%,${T.border.medium} 40%)`,zIndex:1}}/>}
          </div>
        );
      })}
      {mediaWindows.filter(w=>mediaWinStates[w.id]?.minimized).length>0&&(
        <div style={{position:"fixed",bottom:236,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:9997,background:T.bg.header,border:`1px solid ${T.border.medium}`,padding:"4px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}>
          {mediaWindows.filter(w=>mediaWinStates[w.id]?.minimized).map(win=>(
            <button key={win.id} onClick={()=>minimizeMediaWindow(win.id)} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.font.mono,fontSize:8,fontWeight:600,background:T.bg.panel,border:`1px solid ${win.color}44`,color:T.text.secondary,padding:"3px 10px",cursor:"pointer"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:win.color,display:"inline-block"}}/>
              {win.title}
            </button>
          ))}
        </div>
      )}

      {/* ═══ STATUS BAR — 16px ═══ */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",height:16,background:T.bg.topBar,borderTop:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",gap:12}}>
          <span style={{fontSize:7,color:T.text.muted}}>JEDI RE v3.0</span>
          <span style={{fontSize:7,color:T.text.muted}}>REACT + VITE + MAPBOX + KAFKA</span>
        </div>
        <div style={{display:"flex",gap:12}}>
          <span style={{fontSize:7,color:T.text.green}}>DB OK</span>
          <span style={{fontSize:7,color:T.text.green}}>REDIS OK</span>
          <span style={{fontSize:7,color:T.text.muted}}>{liveDeals.length} deals loaded</span>
        </div>
      </div>
    </div>
  );
}
