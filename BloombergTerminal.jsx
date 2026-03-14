import { useState, useEffect, useRef } from "react";
import { getDealNav } from "./src/shared/config/deal-type-visibility";

// ═══════════════════════════════════════════════════════════════
// JEDI RE — INTEGRATED BLOOMBERG TERMINAL
// Full platform with F-key navigation, dual context, command bar
// ═══════════════════════════════════════════════════════════════

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace",display:"'IBM Plex Mono',monospace",label:"'IBM Plex Sans',sans-serif" },
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

// ─── DATA ────────────────────────────────────────────────────
const DEALS = [
  {id:1,name:"Westshore Commons",addr:"4201 W Boy Scout Blvd",market:"Tampa, FL",sub:"Westshore",score:82,delta:"+4",strat:"BTS",irr:"24.3%",em:"2.8x",units:248,price:"$38.5M",ppu:"$155K",stage:"DD",days:23,risk:"LOW",rs:32,trend:[72,74,73,76,78,77,79,80,82],lat:27.95,lng:-82.52,projectType:"existing"},
  {id:2,name:"Nocatee Parcels",addr:"Parcel 7-A Nocatee Pkwy",market:"Jacksonville, FL",sub:"Nocatee",score:88,delta:"+7",strat:"BTS",irr:"28.1%",em:"3.2x",units:0,price:"$4.2M",ppu:"LAND",stage:"LOI",days:11,risk:"LOW",rs:24,trend:[71,73,76,78,80,82,84,86,88],lat:30.09,lng:-81.39,projectType:"development"},
  {id:3,name:"Dadeland Station",addr:"8200 SW 72nd Ave",market:"Miami, FL",sub:"Dadeland",score:76,delta:"+2",strat:"RENTAL",irr:"18.7%",em:"2.1x",units:312,price:"$62.4M",ppu:"$200K",stage:"DD",days:34,risk:"MED",rs:54,trend:[70,71,72,72,73,74,75,75,76],lat:25.69,lng:-80.31,projectType:"existing"},
  {id:4,name:"Colonial Crossings",addr:"3400 Colonial Dr",market:"Orlando, FL",sub:"Colonial Town",score:71,delta:"-1",strat:"FLIP",irr:"21.5%",em:"1.6x",units:180,price:"$24.8M",ppu:"$138K",stage:"PROSPECT",days:8,risk:"MED",rs:48,trend:[68,70,72,73,74,73,72,72,71],lat:28.55,lng:-81.36,projectType:"existing"},
  {id:5,name:"Riverview Preserve",addr:"11502 Boyette Rd",market:"Tampa, FL",sub:"Riverview",score:79,delta:"+3",strat:"BTS",irr:"22.8%",em:"2.5x",units:0,price:"$2.8M",ppu:"LAND",stage:"LOI",days:5,risk:"LOW",rs:28,trend:[70,72,73,75,76,77,78,78,79],lat:27.86,lng:-82.33,projectType:"development"},
  {id:6,name:"Ybor Mixed-Use",addr:"1901 N 13th St",market:"Tampa, FL",sub:"Ybor City",score:54,delta:"-3",strat:"STR",irr:"12.4%",em:"1.3x",units:42,price:"$8.6M",ppu:"$205K",stage:"LEAD",days:2,risk:"HIGH",rs:78,trend:[62,60,59,58,57,56,55,55,54],lat:27.96,lng:-82.44,projectType:"redevelopment"},
  {id:7,name:"Kendall Commons",addr:"12000 SW 127th Ave",market:"Miami, FL",sub:"Kendall",score:68,delta:"0",strat:"RENTAL",irr:"16.2%",em:"1.9x",units:224,price:"$44.8M",ppu:"$200K",stage:"PROSPECT",days:15,risk:"MED",rs:52,trend:[67,68,68,67,68,69,68,68,68],lat:25.68,lng:-80.44,projectType:"existing"},
  {id:8,name:"Celebration South",addr:"Parcel 9 Celebration Blvd",market:"Orlando, FL",sub:"Celebration",score:85,delta:"+5",strat:"BTS",irr:"26.4%",em:"3.0x",units:0,price:"$6.1M",ppu:"LAND",stage:"DD",days:18,risk:"LOW",rs:22,trend:[74,76,77,79,80,81,83,84,85],lat:28.32,lng:-81.54,projectType:"development"},
];

const NEWS = [
  {time:"14:23",hl:"Amazon announces 2,000-job Tampa HQ expansion",impact:"+DEMAND",pts:"+3.2",tag:"JOBS",affects:["Westshore Commons"]},
  {time:"13:41",hl:"Greystar breaks ground 380-unit tower Downtown Tampa",impact:"+SUPPLY",pts:"-1.8",tag:"SUPPLY",affects:[]},
  {time:"11:15",hl:"FL Legislature passes insurance reform, 8% rate cap",impact:"RISK DN",pts:"+1.2",tag:"REG",affects:["ALL FL"]},
  {time:"09:32",hl:"Nocatee named #2 top-selling MPC nationally",impact:"+DEMAND",pts:"+2.4",tag:"DEMAND",affects:["Nocatee Parcels"]},
  {time:"YST",hl:"Miami-Dade condo reserve law triggers $2.1B assessments",impact:"+DEMAND",pts:"+0.8",tag:"REG",affects:["Dadeland Station"]},
  {time:"YST",hl:"Colonial Dr BRT Phase 1 funded",impact:"+POSITION",pts:"+1.5",tag:"INFRA",affects:["Colonial Crossings"]},
];

const ALERTS = [
  {type:"ARBITRAGE",sev:"critical",msg:"Nocatee Parcels: BTS outscores Rental by 22pts, zoning 18 DU/ac",deal:"Nocatee Parcels",time:"10m"},
  {type:"RISK",sev:"high",msg:"Ybor Mixed-Use: Insurance risk 78 (+4), wind zone + STR uncertainty",deal:"Ybor Mixed-Use",time:"34m"},
  {type:"SCORE",sev:"med",msg:"Celebration South crossed 85, Strong Opportunity",deal:"Celebration South",time:"1h"},
  {type:"DEADLINE",sev:"high",msg:"Dadeland Station DD expires 9 days, 3 inspections outstanding",deal:"Dadeland Station",time:"2h"},
  {type:"MARKET",sev:"low",msg:"Tampa MSA absorption exceeded 95% 2nd consecutive month",deal:null,time:"3h"},
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
  {key:"F1",label:"DASHBOARD"},{key:"F2",label:"PIPELINE"},{key:"F3",label:"PORTFOLIO"},
  {key:"F4",label:"MARKETS"},{key:"F5",label:"COMPETE"},{key:"F6",label:"NEWS"},
  {key:"F7",label:"OPPS"},{key:"F8",label:"REPORTS"},{key:"F9",label:"SETTINGS"},
];

// Helper function to get dynamic DEAL_NAV based on deal type
function getDealNav_Dynamic(projectType = 'existing') {
  try {
    const nav = getDealNav(projectType);
    return nav.map(item => ({ key: item.key, label: item.label, m: item.m }));
  } catch {
    // Fallback to default if function not available
    return [
      {key:"F1",label:"OVERVIEW",m:"M01"},{key:"F2",label:"PROPERTY",m:"M02"},{key:"F3",label:"MARKET",m:"M05"},
      {key:"F4",label:"SUPPLY",m:"M04"},{key:"F5",label:"STRATEGY",m:"M08"},{key:"F6",label:"PROFORMA",m:"M09"},
      {key:"F7",label:"CAPITAL",m:"M11"},{key:"F8",label:"RISK",m:"M14"},{key:"F9",label:"COMPS",m:"M15"},
      {key:"F10",label:"TRAFFIC",m:"M07"},{key:"F11",label:"DOCS",m:"M18"},{key:"F12",label:"EXIT",m:"M20"},
    ];
  }
}

// ─── UTILITY COMPONENTS ──────────────────────────────────────

function Spark({ data, color = T.text.green, w = 56, h = 16 }) {
  const mx = Math.max(...data), mn = Math.min(...data), r = mx - mn || 1;
  const p = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * h}`).join(" ");
  return (<svg width={w} height={h} style={{ display: "block" }}><polyline points={p} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" /></svg>);
}

function Bd({ children, c, bg, b }) {
  return (<span style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: 700, color: c, background: bg || c + "18", border: `1px solid ${b || c + "33"}`, padding: "1px 5px", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</span>);
}

function StageBd({ stage }) {
  const m = { DD: T.text.cyan, LOI: T.text.amber, PROSPECT: T.text.secondary, LEAD: T.text.muted };
  return (<Bd c={m[stage] || T.text.muted}>{stage}</Bd>);
}

function StratBd({ s }) {
  return (<Bd c={T.text.purple}>{"^"} {s}</Bd>);
}

function RiskDot({ level }) {
  const c = level === "HIGH" ? T.text.red : level === "MED" ? T.text.orange : T.text.green;
  return (<span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 8, fontFamily: T.font.mono, fontWeight: 600, color: c }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: c, ...(level === "HIGH" ? { animation: "glowR 2s infinite" } : {}) }} />{level}</span>);
}

function PanelHeader({ title, subtitle, right, borderColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, borderTop: borderColor ? `2px solid ${borderColor}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.text.white, letterSpacing: 0.8 }}>{title}</span>
        {subtitle && <span style={{ fontSize: 8, color: T.text.secondary }}>{subtitle}</span>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{right}</div>}
    </div>
  );
}

function MetricBox({ label, value, sub, change, dir }) {
  return (
    <div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, padding: "8px 10px", flex: 1 }}>
      <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: T.text.amber }}>{value}</span>
        <span style={{ fontSize: 10, color: T.text.secondary }}>{sub}</span>
      </div>
      <div style={{ fontSize: 8, color: dir === "up" ? T.text.green : dir === "down" ? T.text.red : T.text.secondary, marginTop: 2, fontWeight: 600 }}>{change}</div>
      <Spark data={[3,4,3,5,4,6,5,7,8]} color={dir === "up" ? T.text.green : dir === "down" ? T.text.red : T.text.amber} w={80} h={12} />
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────

export default function JEDITerminal() {
  const [time, setTime] = useState(new Date());
  const [ctx, setCtx] = useState("portfolio"); // portfolio | deal
  const [fkey, setFkey] = useState("F1");
  const [activeDeal, setActiveDeal] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [selDeal, setSelDeal] = useState(null);
  const [btab, setBtab] = useState("alerts");
  const [cmd, setCmd] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sortBy, setSortBy] = useState("score");
  const [sortDir, setSortDir] = useState("desc");
  const [fStage, setFStage] = useState("ALL");
  const [fStrat, setFStrat] = useState("ALL");
  const [flashes, setFlashes] = useState({});

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => { const id = DEALS[Math.floor(Math.random() * DEALS.length)].id; setFlashes(p => ({ ...p, [id]: true })); setTimeout(() => setFlashes(p => ({ ...p, [id]: false })), 700); }, 5000); return () => clearInterval(t); }, []);

  const enterDeal = (deal) => { setActiveDeal(deal); setCtx("deal"); setFkey("F1"); };
  const exitDeal = () => { setCtx("portfolio"); setActiveDeal(null); setFkey("F1"); };

  const nav = ctx === "portfolio" ? PORTFOLIO_NAV : getDealNav_Dynamic(activeDeal?.projectType || 'existing');
  const sorted = [...DEALS].filter(d => (fStage === "ALL" || d.stage === fStage) && (fStrat === "ALL" || d.strat === fStrat)).sort((a, b) => { const dir = sortDir === "desc" ? -1 : 1; if (sortBy === "score") return (a.score - b.score) * dir; if (sortBy === "name") return a.name.localeCompare(b.name) * dir; if (sortBy === "days") return (a.days - b.days) * dir; return 0; });
  const toggleSort = (c) => { if (sortBy === c) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortBy(c); setSortDir("desc"); } };

  const totalPV = DEALS.reduce((s, d) => s + parseFloat(d.price.replace(/[$M,]/g, "")), 0);
  const avgS = Math.round(DEALS.reduce((s, d) => s + d.score, 0) / DEALS.length);
  const hAlerts = ALERTS.filter(a => a.sev === "critical" || a.sev === "high").length;
  const stages = { DD: 0, LOI: 0, PROSPECT: 0, LEAD: 0 }; DEALS.forEach(d => { if (stages[d.stage] !== undefined) stages[d.stage]++; });

  const tickers = ["^ TAMPA CAP 5.2% (-15bps)", "* MIAMI ABS 94.7%", "v ORL PIPELINE +2400", "^ JAX EMPL +3.2%", "* FL HOME $412K", "^ RENT TPA +3.7%", "* FDOT I-275 148.2K", "v INS +18% YoY", "^ NOCATEE +42%", "* TPA JOBS #3"];
  const gc = "30px 1.4fr 0.8fr 44px 40px 58px 52px 48px 54px 46px 46px 42px 42px";

  // ─── DEAL GRID (reused in F1 + F2) ─────────────────────────
  const DealGrid = ({ compact }) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {!compact && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text.white }}>DEAL PIPELINE</span>
            <span style={{ fontSize: 8, color: T.text.secondary }}>{sorted.length} deals</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <select value={fStage} onChange={e => setFStage(e.target.value)} style={{ fontFamily: T.font.mono, fontSize: 8, background: T.bg.input, color: T.text.secondary, border: `1px solid ${T.border.subtle}`, padding: "1px 4px" }}>
              <option value="ALL">ALL STAGES</option>
              {["DD", "LOI", "PROSPECT", "LEAD"].map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
            <select value={fStrat} onChange={e => setFStrat(e.target.value)} style={{ fontFamily: T.font.mono, fontSize: 8, background: T.bg.input, color: T.text.secondary, border: `1px solid ${T.border.subtle}`, padding: "1px 4px" }}>
              <option value="ALL">ALL STRAT</option>
              {["BTS", "FLIP", "RENTAL", "STR"].map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
            <button onClick={() => setMapOpen(!mapOpen)} style={{ fontFamily: T.font.mono, fontSize: 8, fontWeight: 600, background: mapOpen ? T.text.amber : T.bg.input, color: mapOpen ? T.bg.terminal : T.text.secondary, border: `1px solid ${mapOpen ? T.text.amber : T.border.subtle}`, padding: "1px 6px", cursor: "pointer" }}>MAP</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: gc, background: T.bg.header, borderBottom: `1px solid ${T.border.medium}`, flexShrink: 0 }}>
        {[{l:"#"},{l:"PROPERTY",c:"name"},{l:"MARKET"},{l:"JEDI",c:"score"},{l:"D30",c:"delta"},{l:"STRAT"},{l:"IRR"},{l:"EM"},{l:"PRICE"},{l:"$/U"},{l:"STAGE"},{l:"RISK"},{l:"DAYS",c:"days"}].map((h, i) => (
          <div key={i} onClick={() => h.c && toggleSort(h.c)} style={{ padding: "3px 4px", fontSize: 7, fontWeight: 700, color: sortBy === h.c ? T.text.amber : T.text.muted, letterSpacing: 0.5, borderRight: `1px solid ${T.border.subtle}`, cursor: h.c ? "pointer" : "default", userSelect: "none" }}>
            {h.l}{h.c && sortBy === h.c && <span style={{ color: T.text.amber, marginLeft: 1 }}>{sortDir === "desc" ? "v" : "^"}</span>}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {sorted.map((d, i) => (
          <div key={d.id} onDoubleClick={() => enterDeal(d)} onClick={() => setSelDeal(selDeal === d.id ? null : d.id)} style={{
            display: "grid", gridTemplateColumns: gc,
            background: selDeal === d.id ? T.bg.active : i % 2 === 0 ? T.bg.panel : T.bg.panelAlt,
            borderBottom: `1px solid ${T.border.subtle}`, cursor: "pointer",
            borderLeft: selDeal === d.id ? `2px solid ${T.text.amber}` : "2px solid transparent",
            animation: flashes[d.id] ? "flash 0.7s ease-out" : "none",
          }}
            onMouseEnter={e => { if (selDeal !== d.id) e.currentTarget.style.background = T.bg.hover; }}
            onMouseLeave={e => { if (selDeal !== d.id) e.currentTarget.style.background = i % 2 === 0 ? T.bg.panel : T.bg.panelAlt; }}>
            <div style={{ padding: 4, fontSize: 8, color: T.text.muted, borderRight: `1px solid ${T.border.subtle}` }}>{i + 1}</div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}` }}><div style={{ fontSize: 9, fontWeight: 600, color: T.text.primary }}>{d.name}</div><div style={{ fontSize: 7, color: T.text.muted }}>{d.addr}</div></div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}` }}><div style={{ fontSize: 8, color: T.text.secondary }}>{d.market}</div></div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}><span style={{ fontSize: 11, fontWeight: 800, color: d.score >= 80 ? T.text.green : d.score >= 65 ? T.text.amber : T.text.red }}>{d.score}</span></div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}><span style={{ fontSize: 9, fontWeight: 600, color: d.delta.startsWith("+") ? T.text.green : d.delta.startsWith("-") ? T.text.red : T.text.muted }}>{d.delta}</span></div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}><StratBd s={d.strat} /></div>
            <div style={{ padding: 4, fontSize: 9, fontWeight: 700, color: T.text.amber, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}>{d.irr}</div>
            <div style={{ padding: 4, fontSize: 8, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}>{d.em}</div>
            <div style={{ padding: 4, fontSize: 9, fontWeight: 600, color: T.text.amber, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}>{d.price}</div>
            <div style={{ padding: 4, fontSize: 8, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}>{d.ppu}</div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}><StageBd stage={d.stage} /></div>
            <div style={{ padding: 4, borderRight: `1px solid ${T.border.subtle}`, display: "flex", alignItems: "center" }}><RiskDot level={d.risk} /></div>
            <div style={{ padding: 4, fontSize: 8, color: d.days > 30 ? T.text.orange : T.text.secondary, display: "flex", alignItems: "center" }}>{d.days}d</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── BOTTOM PANEL ──────────────────────────────────────────
  const BottomPanel = () => (
    <div style={{ height: 180, borderTop: `1px solid ${T.border.medium}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ display: "flex", background: T.bg.header, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
        {[{ id: "alerts", l: "ALERTS", ct: hAlerts, cc: T.text.red }, { id: "news", l: "NEWS", ct: NEWS.length, cc: T.text.cyan }, { id: "agents", l: "AGENTS", ct: `${AGENTS.filter(a => a.st === "ON").length}`, cc: T.text.green }].map(tab => (
          <button key={tab.id} onClick={() => setBtab(tab.id)} style={{ fontFamily: T.font.mono, fontSize: 9, fontWeight: 600, color: btab === tab.id ? T.bg.terminal : T.text.secondary, background: btab === tab.id ? T.text.amber : "transparent", border: "none", cursor: "pointer", padding: "4px 12px", display: "flex", alignItems: "center", gap: 4 }}>
            {tab.l}<span style={{ fontSize: 7, fontWeight: 700, padding: "0px 4px", background: btab === tab.id ? "rgba(0,0,0,0.2)" : tab.cc + "18", color: btab === tab.id ? "rgba(0,0,0,0.7)" : tab.cc }}>{tab.ct}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {btab === "alerts" && ALERTS.map((a, i) => { const bc = { critical: T.text.red, high: T.text.orange, med: T.text.amber, low: T.text.muted }[a.sev]; return (<div key={i} style={{ display: "flex", gap: 6, padding: "5px 10px", borderBottom: `1px solid ${T.border.subtle}`, borderLeft: `3px solid ${bc}` }}><div style={{ flex: 1 }}><div style={{ display: "flex", gap: 4, marginBottom: 2 }}><Bd c={bc}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd>{a.deal && <span style={{ fontSize: 8, color: T.text.amber, fontWeight: 600 }}>{a.deal}</span>}</div><div style={{ fontSize: 9, color: T.text.primary, lineHeight: 1.3 }}>{a.msg}</div></div><span style={{ fontSize: 7, color: T.text.muted }}>{a.time}</span></div>); })}
        {btab === "news" && NEWS.map((n, i) => (<div key={i} style={{ display: "flex", gap: 6, padding: "5px 10px", borderBottom: `1px solid ${T.border.subtle}` }}><span style={{ fontSize: 8, color: T.text.muted, minWidth: 30 }}>{n.time}</span><div style={{ flex: 1 }}><div style={{ fontSize: 9, color: T.text.primary, lineHeight: 1.3 }}>{n.hl}</div>{n.affects.length > 0 && <div style={{ display: "flex", gap: 3, marginTop: 2 }}>{n.affects.map((a, j) => (<Bd key={j} c={T.text.amber}>{a}</Bd>))}</div>}</div><div style={{ textAlign: "right", minWidth: 50 }}><div style={{ fontSize: 8, fontWeight: 700, color: n.impact.includes("+") ? T.text.green : T.text.red }}>{n.impact}</div><div style={{ fontSize: 8, color: n.pts.startsWith("+") ? T.text.green : T.text.red }}>{n.pts}</div></div></div>))}
        {btab === "agents" && (<div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: T.border.subtle }}>{AGENTS.map((a, i) => (<div key={i} style={{ background: T.bg.panel, padding: "6px 8px", borderLeft: a.st === "ON" ? `2px solid ${T.text.green}` : `2px solid ${T.text.muted}` }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}><span style={{ fontSize: 9, fontWeight: 700, color: T.text.purple }}>{a.id} <span style={{ color: T.text.primary, fontWeight: 600 }}>{a.name}</span></span><span style={{ fontSize: 7, color: a.st === "ON" ? T.text.green : T.text.muted }}>{a.st}</span></div><div style={{ fontSize: 8, color: T.text.secondary, lineHeight: 1.3 }}>{a.act}</div><div style={{ fontSize: 7, color: T.text.muted, marginTop: 2 }}>{a.t} ago | {a.m} msgs</div></div>))}</div>)}
      </div>
    </div>
  );

  // ─── MAP PANEL ─────────────────────────────────────────────
  const MapPanel = () => (
    <div style={{ width: 340, borderLeft: `1px solid ${T.border.medium}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <PanelHeader title="MAP" subtitle="LIVE" right={<button onClick={() => setMapOpen(false)} style={{ fontFamily: T.font.mono, fontSize: 8, color: T.text.muted, background: "transparent", border: `1px solid ${T.border.subtle}`, padding: "0px 5px", cursor: "pointer" }}>X</button>} />
      <div style={{ flex: 1, background: "#080C14", position: "relative" }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.05 }}>{Array.from({ length: 20 }).map((_, i) => (<line key={i} x1="0" y1={i * 25} x2="100%" y2={i * 25} stroke="#8B95A5" strokeWidth="0.5" />))}{Array.from({ length: 15 }).map((_, i) => (<line key={`v${i}`} x1={i * 25} y1="0" x2={i * 25} y2="100%" stroke="#8B95A5" strokeWidth="0.5" />))}</svg>
        {[{x:"28%",y:"30%",i:0},{x:"70%",y:"20%",i:1},{x:"58%",y:"62%",i:2},{x:"46%",y:"48%",i:3},{x:"24%",y:"42%",i:4},{x:"32%",y:"38%",i:5},{x:"62%",y:"68%",i:6},{x:"48%",y:"40%",i:7}].map((m, idx) => {
          const d = DEALS[m.i]; const c = d.score >= 80 ? T.text.green : d.score >= 65 ? T.text.amber : T.text.red;
          const sz = d.units > 200 ? 16 : d.units > 100 ? 12 : d.units > 0 ? 9 : 7;
          const sel = selDeal === d.id;
          return (<div key={idx} onClick={() => setSelDeal(d.id)} style={{ position: "absolute", left: m.x, top: m.y, transform: "translate(-50%,-50%)", cursor: "pointer", zIndex: sel ? 10 : 1 }}><div style={{ width: sz, height: sz, borderRadius: "50%", background: c, border: sel ? `2px solid white` : `1px solid ${c}`, opacity: sel ? 1 : 0.8, boxShadow: sel ? `0 0 12px ${c}66` : "none" }} />{sel && (<div style={{ position: "absolute", top: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", background: T.bg.header, border: `1px solid ${T.border.bright}`, padding: "4px 6px", whiteSpace: "nowrap", zIndex: 20, animation: "fadeIn 0.15s" }}><div style={{ fontSize: 9, fontWeight: 700, color: T.text.white }}>{d.name}</div><div style={{ display: "flex", gap: 4, marginTop: 2 }}><span style={{ fontSize: 8, color: c, fontWeight: 700 }}>{d.score}</span><span style={{ fontSize: 8, color: T.text.amber }}>{d.irr}</span><StratBd s={d.strat} /></div><div onClick={() => enterDeal(d)} style={{ marginTop: 3, fontSize: 7, color: T.text.amber, cursor: "pointer", fontWeight: 600 }}>OPEN CAPSULE &rarr;</div></div>)}</div>);
        })}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 8, color: T.text.muted, opacity: 0.15, textAlign: "center", pointerEvents: "none" }}>MAPBOX GL JS<br />FLORIDA</div>
      </div>
    </div>
  );

  // ─── PORTFOLIO VIEWS ───────────────────────────────────────

  const ViewDashboard = () => (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DealGrid />
        <BottomPanel />
      </div>
      {mapOpen && <MapPanel />}
    </div>
  );

  const ViewPipeline = () => (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <DealGrid />
      </div>
      {mapOpen && <MapPanel />}
    </div>
  );

  const ViewPortfolio = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="OWNED ASSETS" subtitle="23 properties | $312M value" borderColor={T.text.green} right={<Bd c={T.text.green}>PORTFOLIO JEDI: 74</Bd>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: T.border.subtle }}>
        {[{ l: "TOTAL VALUE", v: "$312M", c: T.text.amberBright }, { l: "WEIGHTED IRR", v: "16.8%", c: T.text.amber }, { l: "AVG OCCUPANCY", v: "93.4%", c: T.text.green }, { l: "NOI VARIANCE", v: "+2.3%", c: T.text.green }].map((m, i) => (
          <div key={i} style={{ background: T.bg.panel, padding: "8px 10px" }}>
            <div style={{ fontSize: 7, color: T.text.muted, letterSpacing: 1 }}>{m.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 9, color: T.text.muted, marginBottom: 6 }}>Actual vs. projected variance tracking | Monthly actuals upload | Decision timeline</div>
        {["Midtown Heights (248u)", "West End Lofts (180u)", "Buckhead Tower (312u)", "Downtown Station (156u)"].map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
            <span style={{ fontSize: 10, color: T.text.primary, fontWeight: 600 }}>{a}</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.text.green }}>{[76, 72, 81, 68][i]}</span>
              <Spark data={[[72, 73, 74, 75, 76], [70, 71, 71, 72, 72], [78, 79, 80, 80, 81], [70, 69, 68, 68, 68]][i]} color={T.text.green} w={40} h={12} />
              <span style={{ fontSize: 8, color: T.text.amber }}>{["$44.2M", "$28.1M", "$72.6M", "$31.5M"][i]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ViewMarkets = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="MARKET INTELLIGENCE" subtitle="5 submarkets | 202 properties | 50,380 units" borderColor={T.text.cyan} right={<Bd c={T.text.green}>LIVE DATA</Bd>} />
      <div style={{ padding: "10px 10px 0" }}>
        <div style={{ fontSize: 9, color: T.text.secondary, marginBottom: 4, fontFamily: T.font.label }}>THE DECISION THIS PAGE DRIVES:</div>
        <div style={{ fontSize: 11, color: T.text.white, fontWeight: 600, marginBottom: 10, fontFamily: T.font.label }}>Is this submarket getting stronger or weaker &mdash; and how fast?</div>
      </div>
      <div style={{ display: "flex", gap: 1, padding: "0 10px 10px", background: "transparent" }}>
        {MARKET_VITALS.map((v, i) => (<MetricBox key={i} {...v} />))}
      </div>
      <div style={{ margin: "0 10px 10px", padding: "6px 10px", background: T.text.amber + "08", borderLeft: `3px solid ${T.text.amber}` }}>
        <span style={{ fontSize: 9, color: T.text.secondary }}>Tracking 5 submarkets with 202 properties and 50,380 total units. Momentum signal: <span style={{ fontWeight: 700, color: T.text.amber }}>STRONG</span>. Top submarket: Midtown ($2,056 avg rent).</span>
      </div>
      <div style={{ margin: "0 10px" }}>
        <PanelHeader title="SUBMARKET COMPARISON" />
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr 0.7fr 0.7fr 0.8fr 0.7fr 0.7fr", background: T.bg.header, borderBottom: `1px solid ${T.border.medium}` }}>
          {["SUBMARKET", "PROPS", "UNITS", "AVG RENT", "VACANCY", "GROWTH 30D", "OPP", "PRESSURE"].map(h => (
            <div key={h} style={{ padding: "4px 6px", fontSize: 7, fontWeight: 700, color: T.text.muted, letterSpacing: 0.7, borderRight: `1px solid ${T.border.subtle}` }}>{h}</div>
          ))}
        </div>
        {SUBMARKETS.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.6fr 0.8fr 0.7fr 0.7fr 0.8fr 0.7fr 0.7fr", background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt, borderBottom: `1px solid ${T.border.subtle}` }}>
            <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 600, color: T.text.primary, borderRight: `1px solid ${T.border.subtle}` }}>{s.name}</div>
            <div style={{ padding: "5px 6px", fontSize: 9, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{s.props}</div>
            <div style={{ padding: "5px 6px", fontSize: 9, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{s.units}</div>
            <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 700, color: T.text.amber, borderRight: `1px solid ${T.border.subtle}` }}>{s.rent}</div>
            <div style={{ padding: "5px 6px", fontSize: 9, color: T.text.secondary, borderRight: `1px solid ${T.border.subtle}` }}>{s.vac}</div>
            <div style={{ padding: "5px 6px", fontSize: 10, fontWeight: 700, color: s.growth.startsWith("+") ? T.text.green : T.text.red, borderRight: `1px solid ${T.border.subtle}` }}>{s.growth}</div>
            <div style={{ padding: "5px 6px", fontSize: 9, color: T.text.amber, borderRight: `1px solid ${T.border.subtle}` }}>{s.opp}</div>
            <div style={{ padding: "5px 6px", display: "flex", alignItems: "center" }}><Bd c={s.pressure === "seller" ? T.text.red : T.text.green}>{s.pressure}</Bd></div>
          </div>
        ))}
      </div>
    </div>
  );

  const ViewCompete = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="COMPETITIVE INTELLIGENCE" subtitle="Performance Rankings | Acquisition Intel | Comp Analysis" borderColor={T.text.purple} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.border.subtle, margin: 10 }}>
        <div style={{ background: T.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>PERFORMANCE RANKINGS</div>
          {["Westshore Commons", "Celebration South", "Riverview Preserve", "Dadeland Station"].map((n, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
              <span style={{ fontSize: 9, color: T.text.primary }}>#{i + 1} {n}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.text.amber }}>{[82, 85, 79, 76][i]}</span>
            </div>
          ))}
        </div>
        <div style={{ background: T.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>ACQUISITION TARGETS</div>
          {["Flagler Village 42u (distress)", "Channelside 186u (value-add)", "Winter Park 94u (mismanaged)"].map((n, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
              <span style={{ fontSize: 9, color: T.text.primary }}>{n}</span>
              <Bd c={T.text.orange}>TARGET</Bd>
            </div>
          ))}
        </div>
        <div style={{ background: T.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>OPPORTUNITY ALERTS</div>
          {["Buckhead: opp score 9.0, buyer market", "West End: opp 7.9, rent growth accelerating", "East Atlanta: vac 15.4%, distress signal"].map((n, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: `1px solid ${T.border.subtle}`, fontSize: 9, color: T.text.secondary }}>{n}</div>
          ))}
        </div>
        <div style={{ background: T.bg.panel, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 6 }}>PATTERN DETECTION</div>
          <div style={{ fontSize: 9, color: T.text.secondary, lineHeight: 1.5 }}>3 submarkets showing rent convergence pattern. West End approaching Midtown pricing within 18 months at current trajectory. <span style={{ color: T.text.amber, fontWeight: 600 }}>Gentrification signal: STRONG.</span></div>
        </div>
      </div>
    </div>
  );

  const ViewNews = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="NEWS INTELLIGENCE" subtitle="Event taxonomy | Score impact | Deal linking" borderColor={T.text.cyan} />
      {NEWS.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${T.border.subtle}` }}>
          <span style={{ fontSize: 9, color: T.text.muted, minWidth: 36 }}>{n.time}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: T.text.primary, fontWeight: 500, lineHeight: 1.4 }}>{n.hl}</div>{n.affects.length > 0 && <div style={{ display: "flex", gap: 4, marginTop: 3 }}>{n.affects.map((a, j) => (<Bd key={j} c={T.text.amber}>{a}</Bd>))}</div>}</div>
          <div style={{ textAlign: "right", minWidth: 60 }}><div style={{ fontSize: 9, fontWeight: 700, color: n.impact.includes("+") ? T.text.green : T.text.red }}>{n.impact}</div><div style={{ fontSize: 9, fontWeight: 600, color: n.pts.startsWith("+") ? T.text.green : T.text.red }}>{n.pts} pts</div><Bd c={T.text.secondary}>{n.tag}</Bd></div>
        </div>
      ))}
    </div>
  );

  const ViewStub = ({ title, subtitle, items }) => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title={title} subtitle={subtitle} borderColor={T.text.amber} />
      <div style={{ padding: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
            <span style={{ fontSize: 9, color: T.text.amber, fontWeight: 700, minWidth: 20 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontSize: 10, color: T.text.primary }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── DEAL CONTEXT VIEWS ────────────────────────────────────

  const DealOverview = () => {
    const d = activeDeal;
    const sc = d.score >= 80 ? T.text.green : d.score >= 65 ? T.text.amber : T.text.red;
    const signals = [{ l: "DEMAND", v: 88, w: "30%" }, { l: "SUPPLY", v: 72, w: "25%" }, { l: "MOMENTUM", v: 85, w: "20%" }, { l: "POSITION", v: 79, w: "15%" }, { l: "RISK", v: 81, w: "10%" }];
    return (
      <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 1, background: T.border.subtle }}>
          {/* JEDI Score */}
          <div style={{ background: T.bg.panel, padding: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1.5, marginBottom: 6 }}>JEDI SCORE</div>
            <div style={{ width: 100, height: 100, borderRadius: "50%", border: `3px solid ${sc}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", boxShadow: `0 0 20px ${sc}33` }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: sc }}>{d.score}</span>
              <span style={{ fontSize: 9, color: d.delta.startsWith("+") ? T.text.green : T.text.red, fontWeight: 600 }}>{d.delta} 30d</span>
            </div>
            <div style={{ fontSize: 8, color: T.text.muted, marginTop: 6 }}>Confidence: 87%</div>
            <Spark data={d.trend} color={sc} w={120} h={24} />
          </div>
          {/* Signals */}
          <div style={{ background: T.bg.panel, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, marginBottom: 8 }}>5 MASTER SIGNALS</div>
            {signals.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 8, color: T.text.muted, minWidth: 70, letterSpacing: 0.5 }}>{s.l} <span style={{ color: T.text.muted, fontSize: 7 }}>({s.w})</span></span>
                <div style={{ flex: 1, height: 6, background: T.bg.terminal, position: "relative" }}>
                  <div style={{ height: "100%", width: `${s.v}%`, background: s.v >= 80 ? T.text.green : s.v >= 60 ? T.text.amber : T.text.red }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: s.v >= 80 ? T.text.green : s.v >= 60 ? T.text.amber : T.text.red, minWidth: 24 }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Strategy + Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.border.subtle }}>
          {[{ l: "BTS", v: 84, win: true }, { l: "FLIP", v: 58 }, { l: "RENTAL", v: 69 }, { l: "STR", v: 45 }].map((s, i) => (
            <div key={i} style={{ background: T.bg.panel, padding: 10, borderTop: s.win ? `2px solid ${T.text.amber}` : "2px solid transparent", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: T.text.muted, letterSpacing: 1 }}>{s.l}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.win ? T.text.amber : T.text.secondary }}>{s.v}</div>
              {s.win && <Bd c={T.text.amber}>RECOMMENDED</Bd>}
            </div>
          ))}
        </div>
        <div style={{ padding: 8, background: T.text.amber + "08", borderLeft: `3px solid ${T.text.amber}`, margin: "1px 0" }}>
          <span style={{ fontSize: 9, color: T.text.amber, fontWeight: 600 }}>ARBITRAGE DETECTED:</span>
          <span style={{ fontSize: 9, color: T.text.secondary }}> BTS outscores Rental by 15pts. Zoning allows 3x density, supply pipeline thin for new construction.</span>
        </div>
      </div>
    );
  };

  const DealStrategy = () => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title="STRATEGY ARBITRAGE" subtitle="M08 | 4-Strategy Comparison" borderColor={T.text.purple} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.border.subtle }}>
        {[
          { s: "BUILD-TO-SELL", sc: 84, irr: "24.3%", yoc: "7.2%", time: "24mo", win: true, signals: { D: 88, S: 72, M: 85, P: 79, R: 81 } },
          { s: "FLIP", sc: 58, irr: "21.5%", yoc: "N/A", time: "8mo", signals: { D: 60, S: 55, M: 72, P: 52, R: 48 } },
          { s: "RENTAL", sc: 69, irr: "18.7%", yoc: "5.8%", time: "Hold", signals: { D: 75, S: 68, M: 62, P: 70, R: 72 } },
          { s: "STR", sc: 45, irr: "12.4%", yoc: "4.4%", time: "Hold", signals: { D: 42, S: 40, M: 55, P: 48, R: 38 } },
        ].map((col, ci) => (
          <div key={ci} style={{ background: T.bg.panel, borderTop: col.win ? `3px solid ${T.text.amber}` : "3px solid transparent" }}>
            <div style={{ padding: "8px 10px", textAlign: "center", borderBottom: `1px solid ${T.border.subtle}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: col.win ? T.text.amber : T.text.secondary, letterSpacing: 1 }}>{col.s}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: col.win ? T.text.amber : T.text.muted, marginTop: 2 }}>{col.sc}</div>
              {col.win && <Bd c={T.text.amber}>WINNER +15</Bd>}
            </div>
            <div style={{ padding: 8 }}>
              {[{ l: "IRR", v: col.irr }, { l: "YOC", v: col.yoc }, { l: "TIMELINE", v: col.time }].map((m, mi) => (
                <div key={mi} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `1px solid ${T.border.subtle}` }}>
                  <span style={{ fontSize: 8, color: T.text.muted }}>{m.l}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.text.amber }}>{m.v}</span>
                </div>
              ))}
              <div style={{ marginTop: 6, fontSize: 8, color: T.text.muted, letterSpacing: 1 }}>SIGNALS</div>
              {Object.entries(col.signals).map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 7, color: T.text.muted, minWidth: 14 }}>{k}</span>
                  <div style={{ flex: 1, height: 4, background: T.bg.terminal }}><div style={{ height: "100%", width: `${v}%`, background: v >= 75 ? T.text.green : v >= 55 ? T.text.amber : T.text.red }} /></div>
                  <span style={{ fontSize: 7, fontWeight: 700, color: v >= 75 ? T.text.green : v >= 55 ? T.text.amber : T.text.red }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const DealStub = ({ title, module, items }) => (
    <div style={{ flex: 1, overflow: "auto", animation: "fadeIn 0.15s" }}>
      <PanelHeader title={title} subtitle={module} borderColor={T.text.cyan} />
      <div style={{ padding: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border.subtle}`, background: i % 2 === 0 ? T.bg.panel : T.bg.panelAlt }}>
            <div style={{ fontSize: 9, color: T.text.primary }}>{item.title}</div>
            <div style={{ fontSize: 8, color: T.text.muted, marginTop: 2 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── RENDER ────────────────────────────────────────────────

  const renderContent = () => {
    if (ctx === "portfolio") {
      switch (fkey) {
        case "F1": return (<ViewDashboard />);
        case "F2": return (<ViewPipeline />);
        case "F3": return (<ViewPortfolio />);
        case "F4": return (<ViewMarkets />);
        case "F5": return (<ViewCompete />);
        case "F6": return (<ViewNews />);
        case "F7": return (<ViewStub title="OPPORTUNITY CENTER" subtitle="Deals the platform detected for you" items={["Flagler Village 42u: Distress signal, owner behind on taxes 18mo", "Channelside 186u: Below-market rents by 22%, value-add play", "Winter Park 94u: Management score 2.1/10, NOI 34% below potential", "Lake Nona Parcel: Zoning change approved, BTS score 91", "St Pete Beach 28u: STR deregulation passed, RevPAR premium 2.1x"]} />);
        case "F8": return (<ViewStub title="REPORTS" subtitle="Deal memos | LP presentations | Market reports" items={["Deal Memo: Westshore Commons (generated 2d ago)", "LP Quarterly Report Q1 2026 (draft)", "Market Report: Tampa MSA (monthly auto-gen)", "Comp Report: Dadeland submarket (on request)", "Strategy Brief: Nocatee BTS opportunity"]} />);
        case "F9": return (<ViewStub title="SETTINGS & LIBRARIES" subtitle="Comp Library | Data Library | Benchmarks | Team" items={["Comp Library: 847 comps across 4 markets", "Data Library: CSV/Excel upload for monthly actuals", "Template Library: ProForma, Deal Memo, LP Report", "Market Benchmarks: Cap rates, rent growth by submarket", "Model Library: Saved financial model versions", "Team: 4 members, role-based permissions"]} />);
        default: return null;
      }
    } else {
      switch (fkey) {
        case "F1": return (<DealOverview />);
        case "F5": return (<DealStrategy />);
        case "F2": return (<DealStub title="PROPERTY & ZONING" module="M02" items={[{title:"Zoning: PD-C (Planned Dev Commercial)",desc:"Municode 27-156 | Max density 18 DU/ac | Height 65ft | FAR 2.0"},{title:"Entitlement Status: Pre-Application",desc:"Estimated timeline: 8-12mo | Monte Carlo p50: 10mo"},{title:"Source Chain: 10/10 links verified",desc:"Planning -> Permitted Uses -> Dev Capacity -> HBU -> Strategy"},{title:"Setbacks: Front 25ft | Side 10ft | Rear 20ft",desc:"Source: Municode 27-156.4(b) | Verified 3/1/2026"}]} />);
        case "F3": return (<DealStub title="MARKET & DEMAND" module="M05+M06" items={[{title:"Trade Area: 3-mile radius, 42,000 residents",desc:"Avg HHI $78,200 | Renter pct 58% | Growth +2.1% YoY"},{title:"Demand Score: 88 (Strong)",desc:"Absorption 1.3x pipeline | Employment +3.2% | Population inflow"},{title:"Rent Comp: $1,908/mo avg effective",desc:"+3.0% growth 90d | Accelerating trend"},{title:"Market Vitals: 5 tracked metrics",desc:"Vacancy 8.5% | Absorbed 11,658/wk | Strength 40th pctl"}]} />);
        case "F4": return (<DealStub title="SUPPLY PIPELINE" module="M04" items={[{title:"Active Pipeline: 1,240 units within trade area",desc:"Delivering Q3 2026: 380u | Q1 2027: 860u"},{title:"Threat Level: MODERATE",desc:"Pipeline-to-stock ratio: 4.2% (below 5% threshold)"},{title:"Nearest Competitor: Greystar 380u tower",desc:"2.1 miles | Luxury segment | Est. absorption 18mo"},{title:"10-Year Capacity Forecast",desc:"Zoned capacity: 8,400 units | Current stock: 14,200 | Headroom: 59%"}]} />);
        case "F6": return (<DealStub title="PRO FORMA ENGINE" module="M09" items={[{title:"Baseline NOI: $2,840,000",desc:"Broker assumption | Cap rate 5.2% going-in"},{title:"Platform-Adjusted NOI: $2,680,000 (-5.6%)",desc:"AI detected: broker rent growth +4% vs market +3.0%. Insurance understated 22%"},{title:"3-Layer Model Active",desc:"Layer 1: Broker | Layer 2: Platform Intel | Layer 3: Your overrides"},{title:"Sensitivity: IRR range 18.4% - 28.1%",desc:"Key driver: exit cap rate (4.8% - 5.6% range)"}]} />);
        case "F7": return (<DealStub title="CAPITAL STRUCTURE" module="M11" items={[{title:"Senior Debt: $28.8M (75% LTC)",desc:"Rate: SOFR + 275bps | IO 24mo | Term 36mo"},{title:"Mezzanine: $3.8M (10% LTC)",desc:"Rate: 12% fixed | Current pay"},{title:"Equity: $5.9M (15%)",desc:"IRR target: 24% | EM target: 2.8x | Hold: 24mo"},{title:"Capital Stack Visual",desc:"75% senior | 10% mezz | 15% equity | WACC: 8.2%"}]} />);
        case "F8": return (<DealStub title="RISK ASSESSMENT" module="M14" items={[{title:"Overall Risk Score: 32 (LOW)",desc:"Supply: 28 | Regulatory: 18 | Market: 35 | Execution: 42 | Climate: 24 | Insurance: 38"},{title:"Top Risk: Execution (42)",desc:"First-time development in this submarket. Mitigated by experienced GC partnership."},{title:"Insurance Risk: 38",desc:"FL wind zone but inland. Rate capped at 8% per new legislation."},{title:"Monte Carlo: 94% probability of meeting target IRR",desc:"1,000 simulations | p10: 18.4% | p50: 24.3% | p90: 31.2%"}]} />);
        default: return (<DealStub title={nav.find(n => n.key === fkey)?.label || "MODULE"} module={nav.find(n => n.key === fkey)?.m || ""} items={[{title:"Module content loads here",desc:"This module renders in Bloomberg L1-L4 layout patterns"}]} />);
      }
    }
  };

  return (
    <div style={{ background: T.bg.terminal, height: "100vh", fontFamily: T.font.mono, color: T.text.primary, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px)" }} />

      {/* ═══ TOP STATUS BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 24, background: T.bg.topBar, borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: T.font.display, fontSize: 12, fontWeight: 800, color: T.text.amber, letterSpacing: 2 }}>JEDI RE</span>
          <span style={{ fontSize: 8, color: T.text.muted }}>|</span>
          <span style={{ fontSize: 8, color: T.text.secondary }}>{ctx === "portfolio" ? "PORTFOLIO" : "DEAL"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 8, color: T.text.green, display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 4, height: 4, borderRadius: "50%", background: T.text.green, animation: "glow 2s infinite" }} />{AGENTS.filter(a => a.st === "ON").length} AGENTS</span>
          <span style={{ fontSize: 8, color: T.text.cyan }}>EMAIL: 5</span>
          <span style={{ fontSize: 8, color: T.text.secondary }}>KAFKA: 312/s</span>
          <span style={{ fontSize: 8, color: T.text.amber, fontWeight: 600 }}>{time.toLocaleTimeString("en-US", { hour12: false })}</span>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <div style={{ height: 18, background: "#06080E", borderBottom: `1px solid ${T.border.subtle}`, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 20, whiteSpace: "nowrap", animation: "ticker 45s linear infinite", fontSize: 8, lineHeight: "18px" }}>
          {[...tickers, ...tickers].map((t, i) => (<span key={i} style={{ color: t.startsWith("^") ? T.text.green : t.startsWith("v") ? T.text.red : T.text.amber }}>{t}</span>))}
        </div>
      </div>

      {/* ═══ DEAL CONTEXT BAR (only when inside a deal) ═══ */}
      {ctx === "deal" && activeDeal && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 26, background: T.text.amber + "08", borderBottom: `1px solid ${T.text.amber}22`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={exitDeal} style={{ fontFamily: T.font.mono, fontSize: 7, color: T.text.muted, background: T.bg.input, border: `1px solid ${T.border.subtle}`, padding: "1px 5px", cursor: "pointer", fontWeight: 700 }}>ESC</button>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text.amber }}>{activeDeal.name}</span>
            <span style={{ fontSize: 8, color: T.text.secondary }}>{activeDeal.addr}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: activeDeal.score >= 80 ? T.text.green : T.text.amber }}>{activeDeal.score}</span>
            <span style={{ fontSize: 8, color: activeDeal.delta.startsWith("+") ? T.text.green : T.text.red }}>{activeDeal.delta}</span>
            <StratBd s={activeDeal.strat} />
            <StageBd stage={activeDeal.stage} />
          </div>
        </div>
      )}

      {/* ═══ KPI BAR (portfolio only) ═══ */}
      {ctx === "portfolio" && (
        <div style={{ display: "flex", alignItems: "stretch", background: T.bg.panel, borderBottom: `1px solid ${T.border.medium}`, flexShrink: 0, height: 50 }}>
          {[
            { l: "PIPELINE", v: `$${totalPV.toFixed(1)}M`, c: T.text.amberBright, sub: "+$6.1M wk" },
            { l: "DEALS", v: DEALS.length, c: T.text.amber, sub: "4 mkts" },
            { l: "AVG JEDI", v: avgS, c: avgS >= 75 ? T.text.green : T.text.amber, sub: "+2.3" },
          ].map((kpi, i) => (
            <div key={i} style={{ padding: "4px 12px", borderRight: `1px solid ${T.border.subtle}`, minWidth: 90 }}>
              <div style={{ fontSize: 7, fontWeight: 600, color: T.text.muted, letterSpacing: 1 }}>{kpi.l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: kpi.c }}>{kpi.v}</div>
              <div style={{ fontSize: 7, color: T.text.green }}>{kpi.sub}</div>
            </div>
          ))}
          <div style={{ padding: "4px 12px", borderRight: `1px solid ${T.border.subtle}`, minWidth: 120 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: T.text.muted, letterSpacing: 1 }}>BY STAGE</div>
            <div style={{ display: "flex", gap: 8 }}>{Object.entries(stages).map(([s, c]) => (<div key={s} style={{ textAlign: "center" }}><div style={{ fontSize: 11, fontWeight: 700, color: c > 0 ? T.text.amber : T.text.muted }}>{c}</div><div style={{ fontSize: 6, color: T.text.muted }}>{s}</div></div>))}</div>
          </div>
          <div onClick={() => setBtab("alerts")} style={{ padding: "4px 12px", borderRight: `1px solid ${T.border.subtle}`, cursor: "pointer", minWidth: 70 }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: T.text.muted, letterSpacing: 1 }}>ALERTS</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: hAlerts > 0 ? T.text.red : T.text.green, animation: hAlerts > 0 ? "pulse 2s infinite" : "none" }}>{hAlerts}</div>
          </div>
          <div style={{ flex: 1 }} />
        </div>
      )}

      {/* ═══ F-KEY NAV BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${T.border.medium}`, flexShrink: 0, background: T.bg.header }}>
        <div style={{ display: "flex", flex: 1, overflow: "auto" }}>
          {nav.map(n => (
            <button key={n.key} onClick={() => setFkey(n.key)} style={{
              fontFamily: T.font.mono, fontSize: 9, fontWeight: 600, padding: "0 10px", height: 28, cursor: "pointer",
              background: fkey === n.key ? T.text.amber : "transparent",
              color: fkey === n.key ? T.bg.terminal : T.text.secondary,
              border: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <span style={{ fontSize: 7, fontWeight: 700, opacity: 0.6, color: fkey === n.key ? T.bg.terminal : T.text.muted }}>{n.key}</span>
              {n.label}
              {n.m && <span style={{ fontSize: 6, opacity: 0.5, marginLeft: 1 }}>{n.m}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding: "0 8px", borderLeft: `1px solid ${T.border.medium}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, background: T.bg.input, border: `1px solid ${T.border.subtle}`, padding: "0 6px", height: 20, width: 180 }}>
            <span style={{ color: T.text.amber, fontSize: 8, fontWeight: 700 }}>{">"}</span>
            <input value={cmd} onChange={e => setCmd(e.target.value)} placeholder="CMD (/ to focus)" style={{ background: "transparent", border: "none", outline: "none", fontFamily: T.font.mono, fontSize: 9, color: T.text.primary, flex: 1, width: "100%" }} />
            <span style={{ width: 6, height: 11, background: T.text.amber, animation: "blink 1s infinite" }} />
          </div>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {renderContent()}
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", height: 16, background: T.bg.topBar, borderTop: `1px solid ${T.border.subtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 12 }}><span style={{ fontSize: 7, color: T.text.muted }}>JEDI RE v0.31</span><span style={{ fontSize: 7, color: T.text.muted }}>REACT + VITE + MAPBOX + ZUSTAND + KAFKA</span></div>
        <div style={{ display: "flex", gap: 12 }}><span style={{ fontSize: 7, color: T.text.green }}>DB OK</span><span style={{ fontSize: 7, color: T.text.green }}>REDIS OK</span><span style={{ fontSize: 7, color: T.text.muted }}>{time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div>
      </div>
    </div>
  );
}
