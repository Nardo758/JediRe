import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

const T = {
  bg: { terminal:"#0A0E17", panel:"#0F1319", panelAlt:"#131821", header:"#1A1F2E", hover:"#1E2538", active:"#252D40", input:"#0D1117", topBar:"#050810" },
  text: { primary:"#E8ECF1", secondary:"#8B95A5", muted:"#4A5568", amber:"#F5A623", amberBright:"#FFD166", green:"#00D26A", red:"#FF4757", cyan:"#00BCD4", orange:"#FF8C42", purple:"#A78BFA", white:"#FFFFFF" },
  border: { subtle:"#1E2538", medium:"#2A3348", bright:"#3B4A6B" },
};

// ─── SHARED STATIC DATA ───────────────────────────────────

const PEER_MSA_DATA = [
  { id:"atlanta-ga",      name:"Atlanta, GA",      props:1028, units:"250K", jedi:87, d30:"+4", trend:[78,80,81,82,83,84,85,86,87], rent:"$2,150", rentD:"+4.2%", vac:"5.8%", absorb:"2,840", pipeline:"15.8%", constraint:58, jobs:5.8, pop:"+2.1%", medInc:"$72,400", cap:"5.2%", cycle:"EXPANSION" },
  { id:"raleigh-nc",      name:"Raleigh, NC",      props:480,  units:"98K",  jedi:85, d30:"+3", trend:[77,78,80,81,82,83,84,84,85], rent:"$1,740", rentD:"+3.9%", vac:"6.2%", absorb:"1,120", pipeline:"11.8%", constraint:72, jobs:5.5, pop:"+2.8%", medInc:"$78,200", cap:"5.0%", cycle:"EXPANSION" },
  { id:"tampa-fl",        name:"Tampa, FL",         props:892,  units:"215K", jedi:82, d30:"+2", trend:[74,75,76,77,78,79,80,81,82], rent:"$1,908", rentD:"+3.0%", vac:"6.5%", absorb:"2,150", pipeline:"13.4%", constraint:64, jobs:5.2, pop:"+1.9%", medInc:"$65,800", cap:"5.4%", cycle:"LATE EXP" },
  { id:"charlotte-nc",   name:"Charlotte, NC",    props:680,  units:"142K", jedi:82, d30:"+3", trend:[76,77,78,79,80,80,81,81,82], rent:"$1,680", rentD:"+3.5%", vac:"6.0%", absorb:"1,540", pipeline:"12.4%", constraint:68, jobs:5.2, pop:"+2.2%", medInc:"$68,400", cap:"5.2%", cycle:"EXPANSION" },
  { id:"jacksonville-fl", name:"Jacksonville, FL", props:386,  units:"82K",  jedi:80, d30:"+5", trend:[70,72,73,74,75,76,77,79,80], rent:"$1,580", rentD:"+3.8%", vac:"5.4%", absorb:"980",   pipeline:"9.2%",  constraint:76, jobs:5.1, pop:"+2.4%", medInc:"$64,200", cap:"5.8%", cycle:"EXPANSION" },
  { id:"orlando-fl",      name:"Orlando, FL",       props:714,  units:"178K", jedi:78, d30:"+1", trend:[72,73,74,74,75,76,77,77,78], rent:"$1,820", rentD:"+2.4%", vac:"7.1%", absorb:"1,680", pipeline:"16.2%", constraint:48, jobs:4.9, pop:"+1.7%", medInc:"$62,400", cap:"5.6%", cycle:"PEAK" },
  { id:"miami-fl",        name:"Miami, FL",         props:1245, units:"310K", jedi:74, d30:"-2", trend:[80,79,78,77,76,75,75,74,74], rent:"$2,480", rentD:"+1.2%", vac:"8.4%", absorb:"1,920", pipeline:"18.6%", constraint:38, jobs:4.4, pop:"+0.8%", medInc:"$58,900", cap:"4.8%", cycle:"PEAK" },
];

interface SubmarketRow {
  name:string; props:number; units:string; jedi:number; d30:string; trend:number[];
  rent:string; rentD:string; rentSf:string; vac:string; absorb:string; pipeline:string;
  moSupply:number; opp:number; pressure:string; cap:string; ppu:string; afford:string;
  popGrowth:string; hhi:number; review:number;
}

const PEER_SUB_DATA: SubmarketRow[] = [
  { name:"Midtown",      props:52, units:"14,856", jedi:88, d30:"+3", trend:[80,82,83,84,85,86,86,87,88], rent:"$2,056", rentD:"+4.8%", rentSf:"$2.14", vac:"5.1%", absorb:"3.2%", pipeline:"12.4%", moSupply:14, opp:82, pressure:"BUYER",    cap:"4.8%", ppu:"$245K", afford:"28%", popGrowth:"+2.4%", hhi:0.095, review:4.2 },
  { name:"Buckhead",     props:39, units:"14,338", jedi:84, d30:"+1", trend:[78,79,80,81,82,82,83,83,84], rent:"$1,883", rentD:"+2.1%", rentSf:"$1.92", vac:"6.2%", absorb:"2.1%", pipeline:"8.8%",  moSupply:11, opp:78, pressure:"BALANCED", cap:"5.0%", ppu:"$228K", afford:"31%", popGrowth:"+1.8%", hhi:0.112, review:4.0 },
  { name:"West End",     props:53, units:"5,924",  jedi:79, d30:"+6", trend:[68,70,72,73,74,75,76,78,79], rent:"$1,977", rentD:"+5.2%", rentSf:"$1.88", vac:"6.8%", absorb:"2.8%", pipeline:"6.2%",  moSupply:8,  opp:86, pressure:"BUYER",    cap:"5.4%", ppu:"$185K", afford:"26%", popGrowth:"+3.1%", hhi:0.078, review:3.8 },
  { name:"East Atlanta", props:23, units:"6,789",  jedi:72, d30:"-1", trend:[74,74,73,73,72,72,72,72,72], rent:"$2,031", rentD:"-0.6%", rentSf:"$1.95", vac:"8.4%", absorb:"0.8%", pipeline:"15.4%", moSupply:22, opp:62, pressure:"SELLER",   cap:"5.8%", ppu:"$198K", afford:"33%", popGrowth:"+0.4%", hhi:0.142, review:3.5 },
  { name:"Downtown",     props:35, units:"8,473",  jedi:76, d30:"+2", trend:[70,71,72,73,73,74,75,75,76], rent:"$1,542", rentD:"+2.8%", rentSf:"$1.72", vac:"7.2%", absorb:"1.9%", pipeline:"14.8%", moSupply:18, opp:68, pressure:"BALANCED", cap:"5.6%", ppu:"$172K", afford:"24%", popGrowth:"+1.2%", hhi:0.089, review:3.9 },
  { name:"Sandy Springs",props:28, units:"9,120",  jedi:81, d30:"+2", trend:[74,75,76,77,78,79,79,80,81], rent:"$1,920", rentD:"+3.4%", rentSf:"$1.98", vac:"5.8%", absorb:"2.4%", pipeline:"10.2%", moSupply:12, opp:74, pressure:"BUYER",    cap:"5.2%", ppu:"$215K", afford:"27%", popGrowth:"+2.0%", hhi:0.101, review:4.1 },
];

const SUB_DATA_BY_MSA: Record<string, SubmarketRow[]> = {
  "atlanta-ga": PEER_SUB_DATA,
  "raleigh-nc": [
    { name:"Downtown Raleigh", props:28, units:"9,200", jedi:87, d30:"+4", trend:[80,82,83,84,85,86,86,87,87], rent:"$1,820", rentD:"+4.6%", rentSf:"$1.86", vac:"5.4%", absorb:"3.4%", pipeline:"9.2%",  moSupply:9,  opp:84, pressure:"BUYER",    cap:"4.8%", ppu:"$210K", afford:"24%", popGrowth:"+3.2%", hhi:0.082, review:4.3 },
    { name:"North Hills",      props:18, units:"5,800", jedi:83, d30:"+2", trend:[77,78,79,80,81,82,82,83,83], rent:"$1,760", rentD:"+3.8%", rentSf:"$1.80", vac:"5.9%", absorb:"2.8%", pipeline:"8.4%",  moSupply:10, opp:79, pressure:"BUYER",    cap:"5.1%", ppu:"$198K", afford:"26%", popGrowth:"+2.6%", hhi:0.097, review:4.1 },
    { name:"Cary",             props:22, units:"7,100", jedi:82, d30:"+1", trend:[76,77,78,79,80,80,81,81,82], rent:"$1,710", rentD:"+3.2%", rentSf:"$1.75", vac:"6.4%", absorb:"2.4%", pipeline:"10.8%", moSupply:13, opp:75, pressure:"BALANCED", cap:"5.2%", ppu:"$192K", afford:"27%", popGrowth:"+2.1%", hhi:0.114, review:3.9 },
    { name:"Durham",           props:16, units:"5,200", jedi:80, d30:"+3", trend:[73,74,75,76,77,78,79,80,80], rent:"$1,640", rentD:"+4.1%", rentSf:"$1.68", vac:"6.8%", absorb:"2.2%", pipeline:"14.2%", moSupply:16, opp:72, pressure:"BALANCED", cap:"5.4%", ppu:"$178K", afford:"28%", popGrowth:"+2.8%", hhi:0.138, review:3.8 },
  ],
  "charlotte-nc": [
    { name:"South End",  props:20, units:"6,500", jedi:86, d30:"+4", trend:[80,81,82,83,84,85,85,86,86], rent:"$1,820", rentD:"+4.8%", rentSf:"$1.86", vac:"5.2%", absorb:"3.2%", pipeline:"9.4%",  moSupply:10, opp:84, pressure:"BUYER",    cap:"4.9%", ppu:"$218K", afford:"26%", popGrowth:"+2.8%", hhi:0.091, review:4.4 },
    { name:"Uptown",     props:14, units:"4,800", jedi:82, d30:"+2", trend:[76,77,78,79,80,80,81,81,82], rent:"$1,750", rentD:"+3.6%", rentSf:"$1.80", vac:"5.8%", absorb:"2.6%", pipeline:"11.2%", moSupply:12, opp:78, pressure:"BUYER",    cap:"5.1%", ppu:"$205K", afford:"28%", popGrowth:"+1.9%", hhi:0.108, review:4.0 },
    { name:"Ballantyne", props:18, units:"5,900", jedi:80, d30:"+1", trend:[74,75,76,77,78,79,79,80,80], rent:"$1,640", rentD:"+3.1%", rentSf:"$1.68", vac:"6.4%", absorb:"2.0%", pipeline:"10.8%", moSupply:14, opp:72, pressure:"BALANCED", cap:"5.4%", ppu:"$188K", afford:"29%", popGrowth:"+1.6%", hhi:0.122, review:3.9 },
  ],
};

const SUPPLY_PIPELINE_DATA = [
  {quarter:"Q1 25", permitted:420, construction:1240, delivering:380},
  {quarter:"Q2 25", permitted:510, construction:1180, delivering:420},
  {quarter:"Q3 25", permitted:380, construction:1320, delivering:510},
  {quarter:"Q4 25", permitted:290, construction:1450, delivering:680},
  {quarter:"Q1 26", permitted:320, construction:1380, delivering:740},
  {quarter:"Q2 26", permitted:410, construction:1290, delivering:820},
];

const SUPPLY_PROJECTS = [
  {name:"Midtown Collective",    developer:"Greystar",          units:312, status:"Under Construction", delivery:"Q3 2026", submarket:"Midtown",      distance:"0.8", segment:"Luxury"},
  {name:"The Peachtree",         developer:"Camden Property",   units:248, status:"Permitted",          delivery:"Q1 2027", submarket:"Buckhead",     distance:"2.1", segment:"Class A"},
  {name:"West End Residences",   developer:"Lincoln Property",  units:186, status:"Delivering",         delivery:"Q2 2026", submarket:"West End",     distance:"1.4", segment:"Class B"},
  {name:"Sandy Springs Station", developer:"Cortland",          units:422, status:"Under Construction", delivery:"Q4 2026", submarket:"Sandy Springs",distance:"3.2", segment:"Class A"},
  {name:"Decatur Commons",       developer:"Trammell Crow",     units:144, status:"Permitted",          delivery:"Q2 2027", submarket:"Decatur",      distance:"4.1", segment:"Mid-market"},
  {name:"Downtown Tower",        developer:"Related Companies", units:580, status:"Planned",            delivery:"Q3 2027", submarket:"Downtown",     distance:"1.2", segment:"Luxury"},
];

const TRENDS_DATA = [
  {mo:"Mar 24",rentGrowth:2.1,vacancy:7.8,absorption:1.6,pipeline:14.2,employment:1.8},
  {mo:"Jun 24",rentGrowth:2.6,vacancy:7.2,absorption:2.0,pipeline:14.8,employment:2.1},
  {mo:"Sep 24",rentGrowth:3.1,vacancy:6.8,absorption:2.4,pipeline:15.2,employment:2.4},
  {mo:"Dec 24",rentGrowth:3.5,vacancy:6.4,absorption:2.7,pipeline:15.8,employment:2.6},
  {mo:"Mar 25",rentGrowth:3.8,vacancy:6.1,absorption:2.9,pipeline:15.4,employment:2.8},
  {mo:"Jun 25",rentGrowth:4.0,vacancy:5.9,absorption:2.8,pipeline:14.9,employment:2.9},
  {mo:"Sep 25",rentGrowth:4.2,vacancy:5.8,absorption:2.8,pipeline:14.6,employment:3.1},
  {mo:"Dec 25",rentGrowth:4.1,vacancy:5.8,absorption:2.7,pipeline:15.1,employment:3.0},
  {mo:"Mar 26",rentGrowth:4.2,vacancy:5.8,absorption:2.8,pipeline:15.8,employment:2.8},
];

const COMPS_DATA = [
  {name:"Summit Ridge Apts",      sub:"Midtown",      units:240, year:1998, cls:"B",  rentSf:"$1.42", occ:"92.4%", rating:4.1, concession:"1 mo free", dist:"0.8"},
  {name:"The Peachtree Towers",   sub:"Buckhead",     units:348, year:2016, cls:"A",  rentSf:"$1.98", occ:"94.2%", rating:4.4, concession:"None",      dist:"2.1"},
  {name:"West End Lofts",         sub:"West End",     units:186, year:2004, cls:"B+", rentSf:"$1.88", occ:"91.8%", rating:3.9, concession:"$500 off",  dist:"1.4"},
  {name:"Sandy Springs Residences",sub:"Sandy Springs",units:312,year:2019, cls:"A",  rentSf:"$2.02", occ:"95.1%", rating:4.5, concession:"None",      dist:"3.2"},
  {name:"Midtown Commons",        sub:"Midtown",      units:192, year:2011, cls:"B+", rentSf:"$1.68", occ:"89.5%", rating:3.8, concession:"2 wks free",dist:"0.5"},
  {name:"Downtown Flats",         sub:"Downtown",     units:420, year:2021, cls:"A",  rentSf:"$1.72", occ:"88.2%", rating:4.0, concession:"1 mo free", dist:"1.2"},
];

const DEMO_EMPLOYERS = [
  {company:"Amazon",    sector:"Tech",    employees:12400, share:18.4, chs:82, delta:"+2.1"},
  {company:"Coca-Cola", sector:"FMCG",   employees:8200,  share:12.2, chs:74, delta:"-0.8"},
  {company:"Delta Air", sector:"Aviation",employees:6800, share:10.1, chs:68, delta:"-1.4"},
  {company:"NCR Corp",  sector:"FinTech",employees:4200,  share:6.2,  chs:71, delta:"+0.3"},
  {company:"UPS HQ",    sector:"Logistics",employees:3800,share:5.6,  chs:77, delta:"+1.2"},
];

interface CorpHealthData {
  schi: number;
  reHealth: number;
  divergence: number;
  herfindahl: number;
  portfolioSubmarkets: {name:string; msa:string|null; schi:number; divergence:number; signal:string; reHealth:number; hhi:number; employerCount:number; publicCount:number}[];
  employers?: {company:string; sector:string; employees:number; share:number; chs:number; delta:string}[];
  topEmployerText: string;
}

interface F4Props {
  selectedMsaId: string;
  setSelectedMsaId: (id:string) => void;
  corpHealthData: CorpHealthData;
  marketsTab: "overview"|"submarkets"|"supply"|"trends"|"comps";
  setMarketsTab: (t:"overview"|"submarkets"|"supply"|"trends"|"comps") => void;
}

// ─── MINI-BAR helper ─────────────────────────────────────
function MiniBar({val, max, color}: {val:number; max:number; color:string}) {
  return (
    <div style={{display:"inline-block",width:28,height:8,background:T.bg.panelAlt,verticalAlign:"middle",position:"relative"}}>
      <div style={{position:"absolute",left:0,top:1,height:6,width:`${Math.min(100,(val/max)*100)}%`,background:color}}/>
    </div>
  );
}

const MSA_OPTIONS = [
  { id: "atlanta-ga",    name: "Atlanta, GA" },
  { id: "raleigh-nc",    name: "Raleigh, NC" },
  { id: "charlotte-nc",  name: "Charlotte, NC" },
];

// ─── OVERVIEW TAB ────────────────────────────────────────
function F4OverviewTab() {
  const totalMsas = PEER_MSA_DATA.length;
  const totalSubs = PEER_SUB_DATA.length;
  const totalUnits = PEER_MSA_DATA.reduce((s,m)=>s+parseInt(m.units.replace(/[^0-9]/g,"")||"0")*1000,0);
  const avgMomentum = Math.round(PEER_MSA_DATA.reduce((s,m)=>s+m.jedi,0)/PEER_MSA_DATA.length);
  const [sortCol, setSortCol] = useState<string>("jedi");
  const [sortD, setSortD] = useState<"asc"|"desc">("desc");
  const handleSort = (col:string) => { if(sortCol===col) setSortD(d=>d==="desc"?"asc":"desc"); else { setSortCol(col); setSortD("desc"); } };
  const sorted = [...PEER_MSA_DATA].sort((a,b)=>{
    const av = (a as Record<string,unknown>)[sortCol] as number|string;
    const bv = (b as Record<string,unknown>)[sortCol] as number|string;
    const n = typeof av==="number"&&typeof bv==="number"?(bv-av):String(av).localeCompare(String(bv));
    return sortD==="asc"?-n:n;
  });
  const kpis=[
    {label:"TRACKED MSAs",value:String(totalMsas),color:T.text.cyan},
    {label:"TRACKED SUBMARKETS",value:String(totalSubs),color:T.text.amber},
    {label:"TOTAL UNITS",value:(totalUnits/1000).toFixed(0)+"K",color:T.text.green},
    {label:"WEIGHTED MOMENTUM",value:String(avgMomentum),color:T.text.orange},
  ];
  const cols=[
    {k:"name",   l:"MSA",         w:"1.8fr"},
    {k:"jedi",   l:"JEDI SCORE",  w:"0.7fr"},
    {k:"d30",    l:"MOMENTUM",    w:"0.7fr"},
    {k:"rentD",  l:"RENT Δ",      w:"0.7fr"},
    {k:"vac",    l:"VACANCY",     w:"0.7fr"},
    {k:"absorb", l:"ABSORPTION",  w:"0.9fr"},
    {k:"pipeline",l:"PIPELINE",   w:"0.7fr"},
    {k:"cycle",  l:"CYCLE",       w:"0.8fr"},
    {k:"trend",  l:"TREND SPARK", w:"0.8fr"},
  ];
  const gridCols = cols.map(c=>c.w).join(" ");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:0,overflow:"auto",flex:1}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border.subtle,padding:"1px",flexShrink:0}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"8px 12px"}}>
            <div style={{fontSize:8,color:T.text.muted,letterSpacing:1,...mono,marginBottom:3}}>{k.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:k.color,...mono,lineHeight:1}}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:gridCols,background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`,position:"sticky",top:0,zIndex:1}}>
          {cols.map(c=>(
            <div key={c.k} onClick={()=>handleSort(c.k)} style={{padding:"5px 8px",fontSize:7,fontWeight:700,color:sortCol===c.k?T.text.amber:T.text.muted,letterSpacing:0.8,cursor:"pointer",...mono,borderRight:`1px solid ${T.border.subtle}`,userSelect:"none"}}>
              {c.l}{sortCol===c.k?(sortD==="desc"?" ▼":" ▲"):""}
            </div>
          ))}
        </div>
        {sorted.map((m,i)=>{
          const tmax = Math.max(...m.trend);
          const tmin = Math.min(...m.trend);
          const momentumVal = parseInt(m.d30.replace(/[^-0-9]/g,""))||0;
          return (
            <div key={m.id} style={{display:"grid",gridTemplateColumns:gridCols,background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
              <div style={{padding:"6px 8px",fontSize:10,fontWeight:600,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.name}</div>
              <div style={{padding:"6px 8px",fontSize:11,fontWeight:800,color:m.jedi>=85?T.text.green:m.jedi>=75?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.jedi}</div>
              <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:momentumVal>0?T.text.green:momentumVal<0?T.text.red:T.text.muted,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.d30}<span style={{fontSize:7,color:T.text.muted,marginLeft:2}}>pts</span></div>
              <div style={{padding:"6px 8px",fontSize:10,color:m.rentD.startsWith("+")?T.text.green:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.rentD}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:parseFloat(m.vac)<7?T.text.green:T.text.orange,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.vac}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.absorb}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:parseFloat(m.pipeline)<14?T.text.green:T.text.orange,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.pipeline}</div>
              <div style={{padding:"6px 8px",fontSize:9,color:m.cycle==="EXPANSION"?T.text.green:m.cycle==="PEAK"?T.text.orange:T.text.amber,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{m.cycle}</div>
              <div style={{padding:"6px 8px",display:"flex",alignItems:"center",gap:1}}>
                {m.trend.slice(-7).map((v,ti)=>(
                  <MiniBar key={ti} val={v-tmin} max={tmax-tmin||1} color={momentumVal>=0?T.text.green:T.text.red}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{height:72,background:T.bg.panelAlt,borderTop:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{fontSize:9,color:T.text.muted,...mono,letterSpacing:1}}>MSA HEATMAP · Mapbox colored by market score · {/* TODO: wire Mapbox */}PLACEHOLDER</span>
      </div>
    </div>
  );
}

// ─── SUBMARKETS TAB ──────────────────────────────────────
function F4SubmarketsTab({selectedMsaId, setSelectedMsaId}: {selectedMsaId:string; setSelectedMsaId:(id:string)=>void}) {
  const navigate = useNavigate();
  const [sortCol, setSortCol] = useState("jedi");
  const [sortD, setSortD] = useState<"asc"|"desc">("desc");
  const handleSort = (col:string) => { if(sortCol===col) setSortD(d=>d==="desc"?"asc":"desc"); else { setSortCol(col); setSortD("desc"); } };
  const subData = SUB_DATA_BY_MSA[selectedMsaId] || PEER_SUB_DATA;
  const sorted = [...subData].sort((a,b)=>{
    const av = (a as Record<string,unknown>)[sortCol] as number|string;
    const bv = (b as Record<string,unknown>)[sortCol] as number|string;
    const n = typeof av==="number"&&typeof bv==="number"?(bv-av):String(av).localeCompare(String(bv));
    return sortD==="asc"?-n:n;
  });
  const cols=[
    {k:"name",      l:"SUBMARKET",  w:"1.5fr"},
    {k:"jedi",      l:"SCORE",      w:"0.5fr"},
    {k:"rentSf",    l:"RENT/SF",    w:"0.7fr"},
    {k:"rentD",     l:"RENT Δ 90D", w:"0.8fr"},
    {k:"vac",       l:"VACANCY",    w:"0.7fr"},
    {k:"absorb",    l:"ABSORB",     w:"0.7fr"},
    {k:"pipeline",  l:"PIPELINE",   w:"0.7fr"},
    {k:"moSupply",  l:"MOS SUPPLY", w:"0.8fr"},
    {k:"popGrowth", l:"POP GROWTH", w:"0.8fr"},
    {k:"hhi",       l:"HHI",        w:"0.6fr"},
    {k:"opp",       l:"OPP",        w:"0.5fr"},
    {k:"trend",     l:"TREND",      w:"0.7fr"},
  ];
  const gridCols = cols.map(c=>c.w).join(" ");
  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1}}>MSA</span>
        <select value={selectedMsaId} onChange={e=>setSelectedMsaId(e.target.value)}
          style={{background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:10,...mono,fontWeight:700,padding:"2px 6px",cursor:"pointer",outline:"none"}}>
          {MSA_OPTIONS.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <span style={{fontSize:8,color:T.text.muted,...mono}}>· {sorted.length} submarkets · Click row → deal-level view</span>
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:gridCols,background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`,position:"sticky",top:0,zIndex:1}}>
          {cols.map(c=>(
            <div key={c.k} onClick={()=>handleSort(c.k)} style={{padding:"5px 8px",fontSize:7,fontWeight:700,color:sortCol===c.k?T.text.amber:T.text.muted,letterSpacing:0.8,cursor:"pointer",...mono,borderRight:`1px solid ${T.border.subtle}`,userSelect:"none"}}>
              {c.l}{sortCol===c.k?(sortD==="desc"?" ▼":" ▲"):""}
            </div>
          ))}
        </div>
        {sorted.map((s,i)=>{
          const tmax = Math.max(...s.trend);
          const tmin = Math.min(...s.trend);
          return (
            <div key={i} onClick={()=>navigate(`/terminal/markets/${s.name.toLowerCase().replace(/\s+/g,"-")}`)}
              style={{display:"grid",gridTemplateColumns:gridCols,background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",transition:"background 0.1s"}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=T.bg.hover}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===0?T.bg.panel:T.bg.panelAlt}>
              <div style={{padding:"6px 8px",fontSize:10,fontWeight:600,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.name}</div>
              <div style={{padding:"6px 8px",fontSize:11,fontWeight:800,color:s.jedi>=85?T.text.green:s.jedi>=75?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.jedi}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.rentSf}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:s.rentD.startsWith("+")?T.text.green:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.rentD}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:parseFloat(s.vac)<7?T.text.green:T.text.orange,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.vac}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.absorb}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:parseFloat(s.pipeline)<12?T.text.green:T.text.orange,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.pipeline}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:s.moSupply<=12?T.text.green:s.moSupply<=18?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.moSupply}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:s.popGrowth.startsWith("+")?T.text.green:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.popGrowth}</div>
              <div style={{padding:"6px 8px",fontSize:10,color:s.hhi<0.1?T.text.green:s.hhi<0.15?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.hhi.toFixed(3)}</div>
              <div style={{padding:"6px 8px",fontSize:11,fontWeight:700,color:s.opp>=80?T.text.green:s.opp>=70?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{s.opp}</div>
              <div style={{padding:"6px 8px",display:"flex",alignItems:"center",gap:1}}>
                {s.trend.slice(-5).map((v,ti)=>(
                  <MiniBar key={ti} val={v-tmin} max={tmax-tmin||1} color={T.text.green}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUPPLY TAB ──────────────────────────────────────────
function F4SupplyTab() {
  const totalPermitted = SUPPLY_PIPELINE_DATA.reduce((s,r)=>s+r.permitted,0);
  const totalUC = SUPPLY_PIPELINE_DATA.reduce((s,r)=>s+r.construction,0);
  const totalDel = SUPPLY_PIPELINE_DATA.reduce((s,r)=>s+r.delivering,0);
  const kpis = [
    {label:"PERMITTED",value:totalPermitted.toLocaleString(),color:T.text.cyan},
    {label:"UNDER CONSTRUCTION",value:totalUC.toLocaleString(),color:T.text.orange},
    {label:"DELIVERING 6MO",value:totalDel.toLocaleString(),color:T.text.green},
    {label:"TOTAL PIPELINE",value:(totalPermitted+totalUC+totalDel).toLocaleString(),color:T.text.amber},
  ];
  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"auto",gap:0}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border.subtle,padding:"1px",flexShrink:0}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"8px 12px"}}>
            <div style={{fontSize:8,color:T.text.muted,letterSpacing:1,...mono,marginBottom:3}}>{k.label}</div>
            <div style={{fontSize:20,fontWeight:800,color:k.color,...mono,lineHeight:1}}>{k.value}</div>
          </div>
        ))}
      </div>
      {/* Recharts stacked bar chart */}
      <div style={{background:T.bg.panel,padding:"12px 16px 8px",borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{fontSize:9,color:T.text.muted,...mono,letterSpacing:1,marginBottom:6}}>
          PIPELINE BY STATUS · Quarters {/* TODO: wire GET /api/v1/supply/pipeline/:tradeAreaId */}· STUB DATA
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={SUPPLY_PIPELINE_DATA} margin={{top:4,right:8,left:0,bottom:0}} barSize={28}>
            <XAxis dataKey="quarter" tick={{fill:T.text.muted,fontSize:8,...mono}} axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip
              contentStyle={{background:T.bg.panel,border:`1px solid ${T.border.medium}`,borderRadius:0,...mono,fontSize:9}}
              labelStyle={{color:T.text.amber,fontWeight:700}}
              itemStyle={{color:T.text.primary}}
            />
            <Legend iconSize={8} wrapperStyle={{fontSize:8,...mono,paddingTop:4,color:T.text.secondary}}/>
            <Bar dataKey="permitted"    stackId="a" fill={T.text.cyan}   name="Permitted"/>
            <Bar dataKey="construction" stackId="a" fill={T.text.orange} name="Under Construction"/>
            <Bar dataKey="delivering"   stackId="a" fill={T.text.green}  name="Delivering"/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Project list table */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{fontSize:8,color:T.text.amber,...mono,letterSpacing:1,padding:"6px 12px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`}}>
          PROJECT LIST · STUB DATA · {SUPPLY_PROJECTS.length} projects {/* TODO: wire GET /api/v1/supply/pipeline/:tradeAreaId */}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.5fr 1.2fr 0.8fr 1fr 0.5fr 0.8fr",background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`,position:"sticky",top:0,zIndex:1}}>
          {["PROJECT","DEVELOPER","UNITS","STATUS","DELIVERY","SUBMARKET","DIST","SEGMENT"].map(h=>(
            <div key={h} style={{padding:"5px 8px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.8,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
          ))}
        </div>
        {SUPPLY_PROJECTS.map((p,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 0.5fr 1.2fr 0.8fr 1fr 0.5fr 0.8fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
            <div style={{padding:"5px 8px",fontSize:10,fontWeight:600,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.name}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.developer}</div>
            <div style={{padding:"5px 8px",fontSize:10,fontWeight:700,color:T.text.amber,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.units}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:p.status==="Delivering"?T.text.green:p.status==="Under Construction"?T.text.orange:T.text.cyan,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.status}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.delivery}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.submarket}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.muted,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{p.distance}mi</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.muted,...mono}}>{p.segment}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TRENDS TAB ──────────────────────────────────────────
function F4TrendsTab({corpHealthData}: {corpHealthData: CorpHealthData}) {
  const [range, setRange] = useState<"6mo"|"12mo"|"24mo">("12mo");
  const [corpExpanded, setCorpExpanded] = useState(false);
  const pts = range==="6mo"?4:range==="12mo"?7:TRENDS_DATA.length;
  const data = TRENDS_DATA.slice(-pts);
  const {schi, reHealth, divergence: div, herfindahl, portfolioSubmarkets} = corpHealthData;
  const employers = corpHealthData.employers || DEMO_EMPLOYERS;

  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"auto"}}>
      {/* Range toggle */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1}}>RANGE</span>
        {(["6mo","12mo","24mo"] as const).map(r=>(
          <button key={r} onClick={()=>setRange(r)} style={{fontSize:8,...mono,fontWeight:range===r?700:400,color:range===r?T.text.amber:T.text.secondary,background:range===r?T.bg.active:"transparent",border:`1px solid ${range===r?T.text.amber:T.border.subtle}`,padding:"2px 8px",cursor:"pointer",letterSpacing:0.5}}>{r.toUpperCase()}</button>
        ))}
      </div>
      {/* Recharts multi-line chart — all 5 required series */}
      <div style={{padding:"12px 16px 8px",background:T.bg.panel,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{fontSize:9,color:T.text.muted,...mono,letterSpacing:1,marginBottom:6}}>MARKET TRENDS · {range.toUpperCase()} · 5-SERIES</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{top:4,right:8,left:0,bottom:4}}>
            <CartesianGrid strokeDasharray="2 2" stroke={T.border.subtle}/>
            <XAxis dataKey="mo" tick={{fill:T.text.muted,fontSize:7,...mono}} axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip
              contentStyle={{background:T.bg.panel,border:`1px solid ${T.border.medium}`,borderRadius:0,...mono,fontSize:9}}
              labelStyle={{color:T.text.amber,fontWeight:700}}
              itemStyle={{color:T.text.primary}}
            />
            <Legend iconSize={8} wrapperStyle={{fontSize:8,...mono,paddingTop:4,color:T.text.secondary}}/>
            <Line type="monotone" dataKey="rentGrowth" stroke={T.text.green}  strokeWidth={1.5} dot={false} name="Rent Growth %"/>
            <Line type="monotone" dataKey="vacancy"    stroke={T.text.red}    strokeWidth={1.5} dot={false} name="Vacancy %"/>
            <Line type="monotone" dataKey="absorption" stroke={T.text.cyan}   strokeWidth={1.5} dot={false} name="Absorption"/>
            <Line type="monotone" dataKey="pipeline"   stroke={T.text.orange} strokeWidth={1.5} dot={false} name="Pipeline Pressure %"/>
            <Line type="monotone" dataKey="employment" stroke={T.text.amber}  strokeWidth={1.5} dot={false} name="Empl Growth %"/>
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Correlation/anomaly panel */}
      <div style={{padding:"10px 16px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{fontSize:9,color:T.text.amber,...mono,letterSpacing:1,marginBottom:6}}>CORRELATION & ANOMALY SIGNALS</div>
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"Rent ↔ Employment",corr:"+0.82",color:T.text.green,note:"Strong positive"},
            {label:"Vacancy ↔ Pipeline",corr:"+0.61",color:T.text.amber,note:"Moderate positive"},
            {label:"Absorption anomaly",corr:"2.8σ", color:T.text.orange,note:"Above seasonal avg"},
          ].map((c,i)=>(
            <div key={i} style={{background:T.bg.panel,border:`1px solid ${T.border.subtle}`,padding:"6px 10px",flex:1}}>
              <div style={{fontSize:8,color:T.text.muted,...mono,marginBottom:2}}>{c.label}</div>
              <div style={{fontSize:16,fontWeight:800,color:c.color,...mono,lineHeight:1}}>{c.corr}</div>
              <div style={{fontSize:7,color:T.text.secondary,...mono,marginTop:2}}>{c.note}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Corporate Health collapsible section */}
      <div style={{flexShrink:0}}>
        <div onClick={()=>setCorpExpanded(e=>!e)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 16px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer",userSelect:"none"}}>
          <span style={{fontSize:9,color:T.text.cyan,...mono,fontWeight:700,letterSpacing:1}}>CORPORATE HEALTH INTELLIGENCE</span>
          <span style={{fontSize:7,color:T.text.muted,...mono}}>SCHI {schi.toFixed(0)} · DIV {(div>0?"+":"")+div.toFixed(1)}</span>
          <div style={{flex:1}}/>
          <span style={{fontSize:9,color:T.text.muted,...mono}}>{corpExpanded?"▲ COLLAPSE":"▼ EXPAND"}</span>
        </div>
        {corpExpanded && (
          <div style={{padding:"10px 12px",background:T.bg.panel,borderBottom:`1px solid ${T.border.subtle}`}}>
            {/* SCHI Metrics row */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              {[
                {label:"SCHI SCORE",   value:schi.toFixed(1),           color:schi>=60?T.text.green:schi>=40?T.text.amber:T.text.red},
                {label:"RE HEALTH",    value:reHealth.toFixed(1),       color:T.text.cyan},
                {label:"DIVERGENCE",   value:(div>0?"+":"")+div.toFixed(1), color:Math.abs(div)>15?(div>0?T.text.green:T.text.red):T.text.amber},
                {label:"HERFINDAHL",   value:herfindahl.toFixed(3),     color:herfindahl<0.1?T.text.green:T.text.red},
              ].map((m,i)=>(
                <div key={i} style={{flex:1,background:T.bg.panelAlt,border:`1px solid ${T.border.subtle}`,padding:"6px 10px"}}>
                  <div style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:0.8,marginBottom:2}}>{m.label}</div>
                  <div style={{fontSize:16,fontWeight:800,color:m.color,...mono,lineHeight:1}}>{m.value}</div>
                </div>
              ))}
            </div>
            {/* Divergence scanner table */}
            <div style={{fontSize:8,color:T.text.amber,...mono,letterSpacing:1,marginBottom:4}}>DIVERGENCE SCANNER · PORTFOLIO SUBMARKETS</div>
            <div style={{display:"grid",gridTemplateColumns:"1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.7fr",background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`}}>
              {["SUBMARKET","MSA","SCHI","RE HLTH","DIVERG","SIGNAL"].map(h=>(
                <div key={h} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{h}</div>
              ))}
            </div>
            {portfolioSubmarkets.slice(0,5).map((s,i)=>{
              const sc = s.signal==="bullish_divergence"?T.text.green:s.signal==="bearish_divergence"?T.text.red:T.text.amber;
              return (
                <div key={i} style={{display:"grid",gridTemplateColumns:"1.4fr 0.8fr 0.6fr 0.6fr 0.7fr 0.7fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
                  <div style={{padding:"4px 6px",fontSize:9,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{s.name}</div>
                  <div style={{padding:"4px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{s.msa||"—"}</div>
                  <div style={{padding:"4px 6px",fontSize:9,fontWeight:700,color:s.schi>=60?T.text.green:s.schi>=40?T.text.amber:T.text.red,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{s.schi.toFixed(1)}</div>
                  <div style={{padding:"4px 6px",fontSize:9,fontWeight:700,color:T.text.cyan,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{s.reHealth.toFixed(1)}</div>
                  <div style={{padding:"4px 6px",fontSize:9,fontWeight:700,color:sc,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{(s.divergence>0?"+":"")+s.divergence.toFixed(1)}</div>
                  <div style={{padding:"4px 6px",fontSize:8,fontWeight:700,color:sc,...mono}}>{s.signal==="bullish_divergence"?"BULL":s.signal==="bearish_divergence"?"BEAR":"ALIGN"}</div>
                </div>
              );
            })}
            {/* Employer table */}
            <div style={{fontSize:8,color:T.text.amber,...mono,letterSpacing:1,marginBottom:4,marginTop:10}}>TOP EMPLOYERS · Employer health & RE demand linkage</div>
            <div style={{display:"grid",gridTemplateColumns:"1.6fr 0.8fr 0.9fr 0.7fr 0.5fr 0.6fr",background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`}}>
              {["COMPANY","SECTOR","EMPLOYEES","SHARE","CHS","Δ30D"].map(h=>(
                <div key={h} style={{padding:"4px 6px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.7,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{h}</div>
              ))}
            </div>
            {employers.map((emp,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1.6fr 0.8fr 0.9fr 0.7fr 0.5fr 0.6fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
                <div style={{padding:"4px 6px",fontSize:9,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{emp.company}</div>
                <div style={{padding:"4px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{emp.sector}</div>
                <div style={{padding:"4px 6px",fontSize:9,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{emp.employees.toLocaleString()}</div>
                <div style={{padding:"4px 6px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{emp.share}%</div>
                <div style={{padding:"4px 6px",fontSize:9,fontWeight:700,color:emp.chs>=75?T.text.green:emp.chs>=55?T.text.amber:T.text.red,borderRight:`1px solid ${T.border.subtle}`,...mono}}>{emp.chs}</div>
                <div style={{padding:"4px 6px",fontSize:9,color:String(emp.delta).startsWith("+")?T.text.green:T.text.red,...mono}}>{emp.delta}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPS TAB ───────────────────────────────────────────
function F4CompsTab() {
  const [filterSub, setFilterSub] = useState("ALL");
  const [filterCls, setFilterCls] = useState("ALL");
  const [filterYearMin, setFilterYearMin] = useState(1990);
  const [filterYearMax, setFilterYearMax] = useState(2025);
  const [filterUnitsMax, setFilterUnitsMax] = useState(600);
  const [filterDistMax, setFilterDistMax] = useState(5.0);
  const subs = ["ALL",...Array.from(new Set(COMPS_DATA.map(c=>c.sub)))];
  const cls  = ["ALL",...Array.from(new Set(COMPS_DATA.map(c=>c.cls)))];
  const filtered = COMPS_DATA.filter(c=>
    (filterSub==="ALL"||c.sub===filterSub) &&
    (filterCls==="ALL"||c.cls===filterCls) &&
    c.year>=filterYearMin && c.year<=filterYearMax &&
    c.units<=filterUnitsMax &&
    parseFloat(c.dist)<=filterDistMax
  );
  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      {/* Filter bar */}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,flexWrap:"wrap"}}>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1}}>SUBMARKET</span>
        <select value={filterSub} onChange={e=>setFilterSub(e.target.value)}
          style={{background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:10,...mono,fontWeight:700,padding:"2px 6px",cursor:"pointer",outline:"none"}}>
          {subs.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1}}>CLASS</span>
        {cls.map(c=>(
          <button key={c} onClick={()=>setFilterCls(c)} style={{fontSize:8,...mono,fontWeight:filterCls===c?700:400,color:filterCls===c?T.text.amber:T.text.secondary,background:filterCls===c?T.bg.active:"transparent",border:`1px solid ${filterCls===c?T.text.amber:T.border.subtle}`,padding:"2px 7px",cursor:"pointer"}}>{c}</button>
        ))}
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1,marginLeft:4}}>YEAR BUILT</span>
        <input type="number" value={filterYearMin} onChange={e=>setFilterYearMin(Number(e.target.value))} min={1980} max={2024}
          style={{width:48,background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:9,...mono,padding:"2px 4px",outline:"none",textAlign:"center"}}/>
        <span style={{fontSize:8,color:T.text.muted,...mono}}>–</span>
        <input type="number" value={filterYearMax} onChange={e=>setFilterYearMax(Number(e.target.value))} min={1980} max={2025}
          style={{width:48,background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:9,...mono,padding:"2px 4px",outline:"none",textAlign:"center"}}/>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1,marginLeft:4}}>MAX UNITS</span>
        <input type="number" value={filterUnitsMax} onChange={e=>setFilterUnitsMax(Number(e.target.value))} min={50} max={1000} step={50}
          style={{width:52,background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:9,...mono,padding:"2px 4px",outline:"none",textAlign:"center"}}/>
        <span style={{fontSize:8,color:T.text.muted,...mono,letterSpacing:1,marginLeft:4}}>MAX DIST</span>
        <input type="number" value={filterDistMax} onChange={e=>setFilterDistMax(Number(e.target.value))} min={0.5} max={10} step={0.5}
          style={{width:44,background:T.bg.panel,color:T.text.amber,border:`1px solid ${T.border.medium}`,fontSize:9,...mono,padding:"2px 4px",outline:"none",textAlign:"center"}}/>
        <span style={{fontSize:8,color:T.text.muted,...mono}}>mi</span>
        <span style={{fontSize:7,color:T.text.muted,...mono,marginLeft:4}}>{/* TODO: wire GET /api/v1/comps/library */}STUB · {filtered.length} comps</span>
      </div>
      {/* Comp grid */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.5fr 0.5fr 0.5fr 0.7fr 0.8fr 0.5fr 1fr 0.5fr",background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`,position:"sticky",top:0,zIndex:1}}>
          {["PROPERTY","SUBMARKET","UNITS","YEAR","CLASS","RENT/SF","OCC","RATING","CONCESSIONS","DIST"].map(h=>(
            <div key={h} style={{padding:"5px 8px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:0.8,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
          ))}
        </div>
        {filtered.length===0 ? (
          <div style={{padding:20,fontSize:9,color:T.text.muted,...mono,textAlign:"center"}}>No comps match current filters</div>
        ) : filtered.map((c,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 0.5fr 0.5fr 0.5fr 0.7fr 0.8fr 0.5fr 1fr 0.5fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
            <div style={{padding:"5px 8px",fontSize:10,fontWeight:600,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.name}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.secondary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.sub}</div>
            <div style={{padding:"5px 8px",fontSize:10,color:T.text.amber,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.units}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.muted,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.year}</div>
            <div style={{padding:"5px 8px",fontSize:9,fontWeight:700,color:c.cls.startsWith("A")?T.text.green:T.text.amber,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.cls}</div>
            <div style={{padding:"5px 8px",fontSize:10,fontWeight:600,color:T.text.primary,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.rentSf}</div>
            <div style={{padding:"5px 8px",fontSize:10,color:parseFloat(c.occ)>=93?T.text.green:parseFloat(c.occ)>=90?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.occ}</div>
            <div style={{padding:"5px 8px",fontSize:10,color:c.rating>=4.3?T.text.green:c.rating>=4?T.text.amber:T.text.red,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.rating}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:c.concession==="None"?T.text.green:T.text.amber,...mono,borderRight:`1px solid ${T.border.subtle}`}}>{c.concession}</div>
            <div style={{padding:"5px 8px",fontSize:9,color:T.text.muted,...mono}}>{c.dist}mi</div>
          </div>
        ))}
      </div>
      {/* Rent vs Year Built scatter placeholder */}
      <div style={{height:64,background:T.bg.panelAlt,borderTop:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{fontSize:9,color:T.text.muted,...mono,letterSpacing:1}}>RENT/SF vs YEAR BUILT SCATTER · {/* TODO: wire GET /api/v1/comps/library */}PLACEHOLDER · {filtered.length} comps in view</span>
      </div>
    </div>
  );
}

// ─── F4 MARKETS VIEW (main export) ───────────────────────
const F4_TABS: {id:"overview"|"submarkets"|"supply"|"trends"|"comps"; label:string}[] = [
  {id:"overview",   label:"OVERVIEW"},
  {id:"submarkets", label:"SUBMARKETS"},
  {id:"supply",     label:"SUPPLY"},
  {id:"trends",     label:"TRENDS"},
  {id:"comps",      label:"COMPS"},
];

export default function F4MarketsView({selectedMsaId, setSelectedMsaId, corpHealthData, marketsTab, setMarketsTab}: F4Props) {
  return (
    <div style={{flex:1,overflow:"hidden",animation:"fadeIn 0.15s",display:"flex",flexDirection:"column"}}>
      {/* 5-tab sub-nav */}
      <div style={{display:"flex",alignItems:"center",height:30,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        {F4_TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setMarketsTab(tab.id)}
            style={{height:"100%",padding:"0 16px",fontSize:9,...mono,fontWeight:marketsTab===tab.id?700:400,color:marketsTab===tab.id?T.text.amber:T.text.secondary,background:marketsTab===tab.id?T.bg.active:"transparent",border:"none",borderRight:`1px solid ${T.border.subtle}`,borderBottom:marketsTab===tab.id?`2px solid ${T.text.amber}`:"none",cursor:"pointer",letterSpacing:0.8}}>
            {tab.label}
          </button>
        ))}
        <div style={{flex:1}}/>
        <span style={{fontSize:7,color:T.text.muted,...mono,padding:"0 10px",letterSpacing:0.5}}>F4 · MARKETS — PORTFOLIO-LEVEL MACRO INTEL</span>
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {marketsTab==="overview"   && <F4OverviewTab/>}
        {marketsTab==="submarkets" && <F4SubmarketsTab selectedMsaId={selectedMsaId} setSelectedMsaId={setSelectedMsaId}/>}
        {marketsTab==="supply"     && <F4SupplyTab/>}
        {marketsTab==="trends"     && <F4TrendsTab corpHealthData={corpHealthData}/>}
        {marketsTab==="comps"      && <F4CompsTab/>}
      </div>
    </div>
  );
}
