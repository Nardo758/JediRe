import { useState, useEffect, useRef, useCallback } from "react";

// ─── TOKENS ──────────────────────────────────────────────────
const DARK = {
  bg: { app:"#0A0E17",panel:"#0F1319",panelAlt:"#131821",header:"#1A1F2E",hover:"#1E2538",active:"#252D40",input:"#0D1117",topBar:"#050810" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",amberBright:"#FFD166",green:"#00D26A",red:"#FF4757",cyan:"#00BCD4",orange:"#FF8C42",purple:"#A78BFA",white:"#FFFFFF" },
  border: { subtle:"#1E2538",medium:"#2A3348",bright:"#3B4A6B" },
};
const LIGHT = {
  bg: { app:"#F0F2F5",panel:"#FFFFFF",panelAlt:"#F8F9FA",header:"#E9ECEF",hover:"#DEE2E6",active:"#CED4DA",input:"#FFFFFF",topBar:"#1A1F2E" },
  text: { primary:"#1A1F2E",secondary:"#495057",muted:"#868E96",amber:"#C96600",amberBright:"#E07800",green:"#2B8A3E",red:"#C92A2A",cyan:"#0B7285",orange:"#D9480F",purple:"#5F3DC4",white:"#FFFFFF" },
  border: { subtle:"#DEE2E6",medium:"#CED4DA",bright:"#ADB5BD" },
};
const MONO = "'JetBrains Mono','IBM Plex Mono','Fira Code',monospace";

// ─── DATA ─────────────────────────────────────────────────────
const DEALS = [
  {id:1,name:"Westshore Commons",market:"Tampa, FL",score:82,delta:"+4",strat:"BTS",irr:"24.3%",em:"2.8x",price:"$38.5M",stage:"DD",days:23,risk:"LOW",trend:[72,74,76,78,79,80,82]},
  {id:2,name:"Nocatee Parcels",market:"Jacksonville, FL",score:88,delta:"+7",strat:"BTS",irr:"28.1%",em:"3.2x",price:"$4.2M",stage:"LOI",days:11,risk:"LOW",trend:[71,73,78,82,84,86,88]},
  {id:3,name:"Dadeland Station",market:"Miami, FL",score:76,delta:"+2",strat:"RENTAL",irr:"18.7%",em:"2.1x",price:"$62.4M",stage:"DD",days:34,risk:"MED",trend:[70,71,72,73,74,75,76]},
  {id:4,name:"Colonial Crossings",market:"Orlando, FL",score:71,delta:"-1",strat:"FLIP",irr:"21.5%",em:"1.6x",price:"$24.8M",stage:"PROSPECT",days:8,risk:"MED",trend:[74,73,73,72,72,71,71]},
  {id:5,name:"Riverview Preserve",market:"Tampa, FL",score:79,delta:"+3",strat:"BTS",irr:"22.8%",em:"2.5x",price:"$2.8M",stage:"LOI",days:5,risk:"LOW",trend:[70,72,74,76,77,78,79]},
  {id:6,name:"Ybor Mixed-Use",market:"Tampa, FL",score:54,delta:"-3",strat:"STR",irr:"12.4%",em:"1.3x",price:"$8.6M",stage:"LEAD",days:2,risk:"HIGH",trend:[62,60,58,57,56,55,54]},
  {id:7,name:"Celebration South",market:"Orlando, FL",score:85,delta:"+5",strat:"BTS",irr:"26.4%",em:"3.0x",price:"$6.1M",stage:"DD",days:18,risk:"LOW",trend:[74,77,79,81,83,84,85]},
];
const NEWS_ITEMS = [
  {time:"14:23",hl:"Amazon announces 2,000-job Tampa HQ expansion",impact:"+DEMAND",pts:"+3.2",tag:"JOBS"},
  {time:"13:41",hl:"Greystar breaks ground 380-unit tower Downtown Tampa",impact:"+SUPPLY",pts:"-1.8",tag:"SUPPLY"},
  {time:"11:15",hl:"FL Legislature passes insurance reform, 8% rate cap",impact:"RISK DN",pts:"+1.2",tag:"REG"},
  {time:"09:32",hl:"Nocatee named #2 top-selling MPC nationally",impact:"+DEMAND",pts:"+2.4",tag:"DEMAND"},
  {time:"YST",hl:"Miami-Dade condo reserve law triggers $2.1B assessments",impact:"+DEMAND",pts:"+0.8",tag:"REG"},
];
const ALERTS = [
  {sev:"critical",type:"ARBITRAGE",msg:"Nocatee: BTS outscores Rental by 22pts, zoning 18 DU/ac",time:"10m"},
  {sev:"high",type:"RISK",msg:"Ybor Mixed-Use: Insurance risk 78 (+4), STR uncertainty",time:"34m"},
  {sev:"med",type:"SCORE",msg:"Celebration South crossed 85 — Strong Opportunity",time:"1h"},
  {sev:"high",type:"DEADLINE",msg:"Dadeland Station DD expires 9 days, 3 inspections outstanding",time:"2h"},
  {sev:"low",type:"MARKET",msg:"Tampa MSA absorption exceeded 95% 2nd consecutive month",time:"3h"},
];
const AGENTS = [
  {id:"A01",name:"Data Collector",st:"ON",act:"Scraped 47 comps Apartments.com, Tampa",t:"2s"},
  {id:"A03",name:"Zoning Agent",st:"ON",act:"Parsed Municode 27-156 setback, Nocatee",t:"8s"},
  {id:"A05",name:"Market Analyst",st:"ON",act:"Updated Tampa absorption 95.2%",t:"34s"},
  {id:"A07",name:"Risk Scorer",st:"ON",act:"Recalculated Ybor insurance 78 (+4)",t:"1m"},
  {id:"A08",name:"Strategy Engine",st:"IDLE",act:"Awaiting new intake",t:"4m"},
];
const SUBMARKETS = [
  {name:"Midtown",rent:"$2,056",vac:"10.1%",growth:"+3.0%",opp:"6.0"},
  {name:"Westshore",rent:"$2,031",vac:"8.4%",growth:"+2.8%",opp:"7.2"},
  {name:"Downtown",rent:"$1,977",vac:"9.5%",growth:"+1.2%",opp:"7.9"},
  {name:"Channelside",rent:"$1,883",vac:"9.8%",growth:"-0.5%",opp:"9.0"},
  {name:"Ybor City",rent:"$1,542",vac:"12.9%",growth:"-0.8%",opp:"5.1"},
];
const TICKERS = ["^ TAMPA CAP 5.2% (-15bps)","* MIAMI ABS 94.7%","v ORL PIPELINE +2400","^ JAX EMPL +3.2%","* FL HOME $412K","^ RENT TPA +3.7%","* FDOT I-275 148.2K","v INS +18% YoY","^ NOCATEE +42%","* TPA JOBS #3 NATIONALLY"];
const LAYER_TYPES = ["Heatmap","Cluster","Bubble","Overlay"];
const SOURCE_TYPES = ["Rent Comps","Vacancy Data","Demographics","Zoning","Traffic"];
const PORTFOLIO_NAV = ["DASHBOARD","PIPELINE","PORTFOLIO","MARKETS","MAP + LAYERS","NEWS","COMPETE","REPORTS","SETTINGS"];
const DEAL_NAV = ["OVERVIEW","PROPERTY","MARKET","SUPPLY","STRATEGY","PROFORMA","CAPITAL","RISK","COMPS","TRAFFIC","DOCS","EXIT"];
const DEAL_FKEYS = ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"];

const INJECTED_CSS = `
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes glowR{0%,100%{box-shadow:0 0 4px #FF475744}50%{box-shadow:0 0 10px #FF475766}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
`;

// ─── HELPERS ──────────────────────────────────────────────────
function Spark({ data, color, w=60, h=14 }: {data:number[];color:string;w?:number;h?:number}) {
  const mx=Math.max(...data),mn=Math.min(...data),r=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-mn)/r)*h}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
}

function Bd({ children, c }: {children:React.ReactNode;c:string}) {
  return <span style={{fontFamily:MONO,fontSize:8,fontWeight:700,color:c,background:c+"18",border:`1px solid ${c}33`,padding:"1px 5px",letterSpacing:.5,textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>;
}

// ─── FLOATING WINDOW ──────────────────────────────────────────
type WinData = {id:string;title:string;x:number;y:number;w:number;h:number;minimized:boolean;z:number;type:"news"|"tv"};

function FloatingWindow({ win, T, onClose, onMinimize, onFocus, onMove }: {
  win:WinData; T:typeof DARK; onClose:()=>void; onMinimize:()=>void; onFocus:()=>void; onMove:(x:number,y:number)=>void;
}) {
  const dragRef = useRef<{startX:number;startY:number;winX:number;winY:number}|null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onFocus();
    dragRef.current = {startX:e.clientX,startY:e.clientY,winX:win.x,winY:win.y};
    const onMove_ = (e2:MouseEvent) => {
      if(!dragRef.current) return;
      onMove(dragRef.current.winX+(e2.clientX-dragRef.current.startX), dragRef.current.winY+(e2.clientY-dragRef.current.startY));
    };
    const onUp = () => { dragRef.current=null; document.removeEventListener("mousemove",onMove_); document.removeEventListener("mouseup",onUp); };
    document.addEventListener("mousemove",onMove_);
    document.addEventListener("mouseup",onUp);
  };
  return (
    <div onClick={onFocus} style={{position:"fixed",left:win.x,top:win.y,width:win.w,height:win.minimized?32:win.h,zIndex:win.z,background:T.bg.panel,border:`1px solid ${T.border.medium}`,boxShadow:`0 8px 32px #00000066`,display:"flex",flexDirection:"column",overflow:"hidden",userSelect:"none"}}>
      <div onMouseDown={onMouseDown} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,cursor:"move",flexShrink:0}}>
        <span style={{fontFamily:MONO,fontSize:9,fontWeight:700,color:T.text.amber}}>{win.title}</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={(e)=>{e.stopPropagation();onMinimize();}} style={{fontFamily:MONO,fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0 5px",cursor:"pointer",lineHeight:"14px"}}>_</button>
          <button onClick={(e)=>{e.stopPropagation();onClose();}} style={{fontFamily:MONO,fontSize:8,color:T.text.red,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0 5px",cursor:"pointer",lineHeight:"14px"}}>x</button>
        </div>
      </div>
      {!win.minimized && (
        <div style={{flex:1,overflow:"auto",padding:8}}>
          {win.type==="news" ? (
            NEWS_ITEMS.map((n,i)=>(
              <div key={i} style={{padding:"5px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                  <span style={{fontSize:8,color:T.text.muted,minWidth:32}}>{n.time}</span>
                  <Bd c={T.text.cyan}>{n.tag}</Bd>
                  <span style={{fontSize:8,fontWeight:700,color:n.pts.startsWith("+")?T.text.green:T.text.red}}>{n.pts}</span>
                </div>
                <div style={{fontSize:9,color:T.text.primary,lineHeight:1.4}}>{n.hl}</div>
              </div>
            ))
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:9,color:T.text.secondary,marginBottom:4}}>Select a channel to stream:</div>
              {["CNBC Live","Bloomberg TV","Yahoo Finance Live","Fox Business"].map((ch,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",background:T.bg.panelAlt,border:`1px solid ${T.border.subtle}`,cursor:"pointer"}}>
                  <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:T.text.primary}}>{ch}</span>
                  <Bd c={T.text.green}>LIVE</Bd>
                </div>
              ))}
              <div style={{marginTop:8,padding:"10px",background:T.bg.active,border:`1px solid ${T.border.medium}`,textAlign:"center"}}>
                <div style={{fontSize:8,color:T.text.muted,marginBottom:4}}>CNBC LIVE FEED</div>
                <div style={{fontSize:9,color:T.text.amber}}>▶ Streaming — embed would load here</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VIEWS ────────────────────────────────────────────────────
function PipelineView({ T, onDealClick }: {T:typeof DARK;onDealClick:(d:typeof DEALS[0])=>void}) {
  const [sortKey,setSortKey]=useState("score");
  const sorted=[...DEALS].sort((a,b)=>b[sortKey as "score"|"days"]-a[sortKey as "score"|"days"]);
  const cols="30px 1.6fr 0.9fr 44px 40px 56px 52px 54px 50px 46px 46px 44px";
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"grid",gridTemplateColumns:cols,background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
        {["#","PROPERTY","MARKET","JEDI","D30","STRAT","IRR","PRICE","STAGE","RISK","DAYS","TREND"].map((h,i)=>(
          <div key={i} onClick={()=>i===3&&setSortKey("score")} style={{padding:"3px 5px",fontSize:7,fontWeight:700,color:i===3&&sortKey==="score"?T.text.amber:T.text.muted,letterSpacing:.5,borderRight:`1px solid ${T.border.subtle}`,cursor:i===3?"pointer":"default"}}>{h}{i===3&&" ▼"}</div>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        {sorted.map((d,i)=>(
          <div key={d.id} onDoubleClick={()=>onDealClick(d)} style={{display:"grid",gridTemplateColumns:cols,background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,cursor:"pointer"}}
            onMouseEnter={e=>(e.currentTarget.style.background=T.bg.hover)} onMouseLeave={e=>(e.currentTarget.style.background=i%2===0?T.bg.panel:T.bg.panelAlt)}>
            <div style={{padding:4,fontSize:8,color:T.text.muted,borderRight:`1px solid ${T.border.subtle}`}}>{i+1}</div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`}}><div style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{d.name}</div></div>
            <div style={{padding:"3px 5px",fontSize:8,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.market}</div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><span style={{fontSize:12,fontWeight:800,color:d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}}>{d.score}</span></div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><span style={{fontSize:9,fontWeight:600,color:d.delta.startsWith("+")?T.text.green:T.text.red}}>{d.delta}</span></div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><Bd c={T.text.purple}>{d.strat}</Bd></div>
            <div style={{padding:"3px 5px",fontSize:9,fontWeight:700,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.irr}</div>
            <div style={{padding:"3px 5px",fontSize:9,fontWeight:600,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.price}</div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><Bd c={{DD:T.text.cyan,LOI:T.text.amber,PROSPECT:T.text.secondary,LEAD:T.text.muted}[d.stage]||T.text.muted}>{d.stage}</Bd></div>
            <div style={{padding:"3px 5px",borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}><span style={{fontSize:8,fontWeight:600,color:{HIGH:T.text.red,MED:T.text.orange,LOW:T.text.green}[d.risk]}}>{d.risk}</span></div>
            <div style={{padding:"3px 5px",fontSize:8,color:d.days>30?T.text.orange:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`,display:"flex",alignItems:"center"}}>{d.days}d</div>
            <div style={{padding:"3px 5px",display:"flex",alignItems:"center"}}><Spark data={d.trend} color={d.score>=80?T.text.green:d.score>=65?T.text.amber:T.text.red}/></div>
          </div>
        ))}
      </div>
      <div style={{padding:"4px 10px",background:T.bg.header,borderTop:`1px solid ${T.border.subtle}`,flexShrink:0,fontSize:8,color:T.text.muted}}>
        {DEALS.length} deals · Double-click a row to open Deal Capsule
      </div>
    </div>
  );
}

function PortfolioView({ T }: {T:typeof DARK}) {
  const metrics=[{l:"TOTAL VALUE",v:"$312M",c:T.text.amberBright},{l:"WEIGHTED IRR",v:"16.8%",c:T.text.amber},{l:"AVG OCCUPANCY",v:"93.4%",c:T.text.green},{l:"NOI VARIANCE",v:"+2.3%",c:T.text.green}];
  const assets=[{n:"Midtown Heights (248u)",s:76,v:"$44.2M",d:[72,73,74,75,76]},{n:"West End Lofts (180u)",s:72,v:"$28.1M",d:[70,71,71,72,72]},{n:"Buckhead Tower (312u)",s:81,v:"$72.6M",d:[78,79,80,80,81]},{n:"Downtown Station (156u)",s:68,v:"$31.5M",d:[70,69,68,68,68]}];
  return (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn .15s"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border.subtle,margin:"0 0 1px"}}>
        {metrics.map((m,i)=>(
          <div key={i} style={{background:T.bg.panel,padding:"10px 12px"}}>
            <div style={{fontSize:7,color:T.text.muted,letterSpacing:1,marginBottom:4}}>{m.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:m.c}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{padding:"8px 12px",fontSize:9,color:T.text.muted,borderBottom:`1px solid ${T.border.subtle}`}}>23 owned assets · $312M total value · Weighted IRR 16.8%</div>
      {assets.map((a,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 12px",borderBottom:`1px solid ${T.border.subtle}`,background:i%2===0?T.bg.panel:T.bg.panelAlt}}>
          <span style={{fontSize:10,color:T.text.primary,fontWeight:600}}>{a.n}</span>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <span style={{fontSize:11,fontWeight:800,color:T.text.green}}>{a.s}</span>
            <Spark data={a.d} color={T.text.green} w={44} h={14}/>
            <span style={{fontSize:9,color:T.text.amber,fontWeight:600}}>{a.v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketsView({ T }: {T:typeof DARK}) {
  return (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn .15s"}}>
      <div style={{padding:"8px 12px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
        <div style={{fontSize:8,color:T.text.muted,marginBottom:2}}>THE DECISION THIS PAGE DRIVES:</div>
        <div style={{fontSize:11,color:T.text.primary,fontWeight:600}}>Is this submarket getting stronger or weaker — and how fast?</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr .7fr .8fr .7fr .7fr .7fr",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`}}>
        {["SUBMARKET","PROPS","AVG RENT","VACANCY","GROWTH 30D","OPP"].map(h=>(
          <div key={h} style={{padding:"4px 8px",fontSize:7,fontWeight:700,color:T.text.muted,letterSpacing:.7,borderRight:`1px solid ${T.border.subtle}`}}>{h}</div>
        ))}
      </div>
      {SUBMARKETS.map((s,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:"1.4fr .7fr .8fr .7fr .7fr .7fr",background:i%2===0?T.bg.panel:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`}}>
          <div style={{padding:"6px 8px",fontSize:10,fontWeight:600,color:T.text.primary,borderRight:`1px solid ${T.border.subtle}`}}>{s.name}</div>
          <div style={{padding:"6px 8px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>52</div>
          <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:T.text.amber,borderRight:`1px solid ${T.border.subtle}`}}>{s.rent}</div>
          <div style={{padding:"6px 8px",fontSize:9,color:T.text.secondary,borderRight:`1px solid ${T.border.subtle}`}}>{s.vac}</div>
          <div style={{padding:"6px 8px",fontSize:10,fontWeight:700,color:s.growth.startsWith("+")?T.text.green:T.text.red,borderRight:`1px solid ${T.border.subtle}`}}>{s.growth}</div>
          <div style={{padding:"6px 8px",fontSize:9,color:T.text.amber}}>{s.opp}/10</div>
        </div>
      ))}
    </div>
  );
}

type Layer = {id:number;name:string;type:string;source:string;opacity:number;visible:boolean};

function MapLayersView({ T }: {T:typeof DARK}) {
  const [layers,setLayers]=useState<Layer[]>([
    {id:1,name:"Rent Heatmap",type:"Heatmap",source:"Rent Comps",opacity:0.8,visible:true},
    {id:2,name:"Deal Clusters",type:"Cluster",source:"Demographics",opacity:1,visible:true},
  ]);
  const [form,setForm]=useState({name:"",type:"Heatmap",source:"Rent Comps",opacity:0.8});
  const [drawerOpen,setDrawerOpen]=useState(true);
  const nextId=useRef(3);
  const addLayer=()=>{
    if(!form.name.trim()) return;
    setLayers(l=>[...l,{id:nextId.current++,...form,visible:true}]);
    setForm(f=>({...f,name:""}));
  };
  const mapDots=[{x:"22%",y:"38%",c:T.text.green},{x:"68%",y:"25%",c:T.text.green},{x:"54%",y:"58%",c:T.text.amber},{x:"42%",y:"45%",c:T.text.amber},{x:"28%",y:"52%",c:T.text.green},{x:"36%",y:"44%",c:T.text.red},{x:"60%",y:"65%",c:T.text.green},{x:"45%",y:"35%",c:T.text.green}];
  return (
    <div style={{display:"flex",height:"100%"}}>
      <div style={{flex:1,position:"relative",background:"#080C14",overflow:"hidden"}}>
        <svg width="100%" height="100%" style={{position:"absolute",inset:0,opacity:.05}}>
          {Array.from({length:20}).map((_,i)=><line key={`h${i}`} x1="0" y1={i*30} x2="100%" y2={i*30} stroke="#8B95A5" strokeWidth=".5"/>)}
          {Array.from({length:30}).map((_,i)=><line key={`v${i}`} x1={i*30} y1="0" x2={i*30} y2="100%" stroke="#8B95A5" strokeWidth=".5"/>)}
        </svg>
        {mapDots.map((d,i)=>(
          <div key={i} style={{position:"absolute",left:d.x,top:d.y,width:10,height:10,borderRadius:"50%",background:d.c,opacity:.85,boxShadow:`0 0 8px ${d.c}88`,transform:"translate(-50%,-50%)"}}/>
        ))}
        <div style={{position:"absolute",top:8,left:8,display:"flex",gap:4}}>
          {layers.filter(l=>l.visible).map(l=>(
            <div key={l.id} style={{padding:"2px 6px",background:T.bg.header+"CC",border:`1px solid ${T.border.medium}`,fontSize:8,color:T.text.amber,fontFamily:MONO}}>{l.name}</div>
          ))}
        </div>
        <div style={{position:"absolute",bottom:8,left:8,fontSize:8,color:T.text.muted,opacity:.4}}>Tampa, FL MSA · Interactive Map</div>
      </div>
      <div style={{width:260,borderLeft:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",background:T.bg.panel,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`}}>
          <span style={{fontSize:9,fontWeight:700,color:T.text.white,letterSpacing:.8}}>LAYER MANAGER</span>
          <button onClick={()=>setDrawerOpen(o=>!o)} style={{fontSize:8,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0 5px",cursor:"pointer",fontFamily:MONO}}>{drawerOpen?"▲":"▼"}</button>
        </div>
        {drawerOpen && (
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0}}>
            <div style={{fontSize:8,color:T.text.muted,marginBottom:6,letterSpacing:.8}}>CREATE LAYER</div>
            <div style={{marginBottom:4}}>
              <div style={{fontSize:7,color:T.text.muted,marginBottom:2}}>LAYER NAME</div>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rent Heatmap" style={{width:"100%",padding:"3px 6px",background:T.bg.input,border:`1px solid ${T.border.medium}`,color:T.text.primary,fontFamily:MONO,fontSize:9,boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:4}}>
              <div style={{fontSize:7,color:T.text.muted,marginBottom:2}}>LAYER TYPE</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {LAYER_TYPES.map(t=>(
                  <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{fontFamily:MONO,fontSize:7,padding:"2px 6px",background:form.type===t?T.text.amber:T.bg.panelAlt,color:form.type===t?T.bg.app:T.text.secondary,border:`1px solid ${form.type===t?T.text.amber:T.border.subtle}`,cursor:"pointer"}}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:4}}>
              <div style={{fontSize:7,color:T.text.muted,marginBottom:2}}>DATA SOURCE</div>
              <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={{width:"100%",padding:"3px 6px",background:T.bg.input,border:`1px solid ${T.border.medium}`,color:T.text.primary,fontFamily:MONO,fontSize:9}}>
                {SOURCE_TYPES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:7,color:T.text.muted,marginBottom:2}}>OPACITY: {Math.round(form.opacity*100)}%</div>
              <input type="range" min="0" max="1" step=".05" value={form.opacity} onChange={e=>setForm(f=>({...f,opacity:parseFloat(e.target.value)}))} style={{width:"100%",accentColor:T.text.amber}}/>
            </div>
            <button onClick={addLayer} style={{width:"100%",padding:"5px",background:T.text.amber,color:T.bg.app,fontFamily:MONO,fontSize:9,fontWeight:700,border:"none",cursor:"pointer",letterSpacing:.5}}>+ CREATE LAYER</button>
          </div>
        )}
        <div style={{flex:1,overflow:"auto"}}>
          <div style={{padding:"4px 10px",fontSize:7,color:T.text.muted,letterSpacing:.8,borderBottom:`1px solid ${T.border.subtle}`}}>ACTIVE LAYERS ({layers.filter(l=>l.visible).length}/{layers.length})</div>
          {layers.map(l=>(
            <div key={l.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`,background:l.visible?T.bg.panel:T.bg.panelAlt}}>
              <div style={{flex:1}}>
                <div style={{fontSize:9,fontWeight:600,color:l.visible?T.text.primary:T.text.muted}}>{l.name}</div>
                <div style={{fontSize:7,color:T.text.muted}}>{l.type} · {l.source} · {Math.round(l.opacity*100)}%</div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>setLayers(ls=>ls.map(x=>x.id===l.id?{...x,visible:!x.visible}:x))} style={{fontSize:7,padding:"1px 5px",background:"transparent",border:`1px solid ${T.border.subtle}`,color:l.visible?T.text.green:T.text.muted,cursor:"pointer",fontFamily:MONO}}>{l.visible?"ON":"OFF"}</button>
                <button onClick={()=>setLayers(ls=>ls.filter(x=>x.id!==l.id))} style={{fontSize:7,padding:"1px 5px",background:"transparent",border:`1px solid ${T.border.subtle}`,color:T.text.red,cursor:"pointer",fontFamily:MONO}}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewsView({ T, onOpenWindow }: {T:typeof DARK;onOpenWindow:(type:"news"|"tv")=>void}) {
  return (
    <div style={{flex:1,overflow:"auto",animation:"fadeIn .15s"}}>
      <div style={{padding:"6px 12px",background:T.bg.panelAlt,borderBottom:`1px solid ${T.border.subtle}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:9,color:T.text.secondary}}>Real-time market intelligence · Score-linked event taxonomy</span>
        <button onClick={()=>onOpenWindow("news")} style={{fontFamily:MONO,fontSize:8,padding:"2px 8px",background:T.text.cyan+"18",border:`1px solid ${T.text.cyan}33`,color:T.text.cyan,cursor:"pointer"}}>⤢ OPEN IN WINDOW</button>
      </div>
      {NEWS_ITEMS.map((n,i)=>(
        <div key={i} style={{display:"flex",gap:10,padding:"8px 12px",borderBottom:`1px solid ${T.border.subtle}`}}>
          <span style={{fontSize:9,color:T.text.muted,minWidth:36}}>{n.time}</span>
          <div style={{flex:1}}><div style={{fontSize:10,color:T.text.primary,fontWeight:500,lineHeight:1.4}}>{n.hl}</div></div>
          <div style={{textAlign:"right",minWidth:70}}>
            <div style={{fontSize:9,fontWeight:700,color:n.impact.includes("+")?T.text.green:T.text.red}}>{n.impact}</div>
            <div style={{fontSize:9,color:n.pts.startsWith("+")?T.text.green:T.text.red}}>{n.pts} pts</div>
            <Bd c={T.text.secondary}>{n.tag}</Bd>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── BOTTOM PANEL ─────────────────────────────────────────────
function BottomPanel({ T, onOpenWindow }: {T:typeof DARK;onOpenWindow:(type:"news"|"tv")=>void}) {
  const [tab,setTab]=useState("alerts");
  const tabs=[{id:"alerts",l:"ALERTS",ct:ALERTS.filter(a=>a.sev==="critical"||a.sev==="high").length,cc:T.text.red},{id:"news",l:"NEWS",ct:NEWS_ITEMS.length,cc:T.text.cyan},{id:"agents",l:"AGENTS",ct:AGENTS.filter(a=>a.st==="ON").length,cc:T.text.green},{id:"media",l:"MEDIA",ct:"TV",cc:T.text.orange}];
  return (
    <div style={{height:180,borderTop:`1px solid ${T.border.medium}`,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{display:"flex",background:T.bg.header,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{fontFamily:MONO,fontSize:9,fontWeight:600,color:tab===t.id?T.bg.app:T.text.secondary,background:tab===t.id?T.text.amber:"transparent",border:"none",cursor:"pointer",padding:"4px 12px",display:"flex",alignItems:"center",gap:4}}>
            {t.l} <span style={{fontSize:7,padding:"0 4px",background:tab===t.id?"rgba(0,0,0,.2)":t.cc+"18",color:tab===t.id?"rgba(0,0,0,.7)":t.cc}}>{t.ct}</span>
          </button>
        ))}
      </div>
      <div style={{flex:1,overflow:"auto"}}>
        {tab==="alerts" && ALERTS.map((a,i)=>{
          const bc={critical:T.text.red,high:T.text.orange,med:T.text.amber,low:T.text.muted}[a.sev];
          return <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`,borderLeft:`3px solid ${bc}`}}>
            <div style={{flex:1}}><div style={{display:"flex",gap:4,marginBottom:2}}><Bd c={bc!}>{a.sev}</Bd><Bd c={T.text.cyan}>{a.type}</Bd></div><div style={{fontSize:9,color:T.text.primary,lineHeight:1.3}}>{a.msg}</div></div>
            <span style={{fontSize:7,color:T.text.muted}}>{a.time}</span>
          </div>;
        })}
        {tab==="news" && NEWS_ITEMS.map((n,i)=>(
          <div key={i} style={{display:"flex",gap:6,padding:"5px 10px",borderBottom:`1px solid ${T.border.subtle}`}}>
            <span style={{fontSize:8,color:T.text.muted,minWidth:30}}>{n.time}</span>
            <div style={{flex:1,fontSize:9,color:T.text.primary,lineHeight:1.3}}>{n.hl}</div>
            <button onClick={()=>onOpenWindow("news")} style={{fontSize:7,color:T.text.cyan,background:"transparent",border:"none",cursor:"pointer"}}>⤢</button>
          </div>
        ))}
        {tab==="agents" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border.subtle}}>
            {AGENTS.map((a,i)=>(
              <div key={i} style={{background:T.bg.panel,padding:"6px 8px",borderLeft:a.st==="ON"?`2px solid ${T.text.green}`:`2px solid ${T.text.muted}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                  <span style={{fontSize:9,fontWeight:700,color:T.text.purple}}>{a.id} <span style={{color:T.text.primary}}>{a.name}</span></span>
                  <span style={{fontSize:7,color:a.st==="ON"?T.text.green:T.text.muted}}>{a.st}</span>
                </div>
                <div style={{fontSize:8,color:T.text.secondary,lineHeight:1.3}}>{a.act}</div>
                <div style={{fontSize:7,color:T.text.muted,marginTop:2}}>{a.t} ago</div>
              </div>
            ))}
          </div>
        )}
        {tab==="media" && (
          <div style={{display:"flex",gap:8,padding:10}}>
            {["CNBC Live","Bloomberg TV","Yahoo Finance","Fox Business"].map((ch,i)=>(
              <button key={i} onClick={()=>onOpenWindow("tv")} style={{flex:1,padding:"8px 6px",background:T.bg.panelAlt,border:`1px solid ${T.border.medium}`,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:8,fontWeight:700,color:T.text.primary,fontFamily:MONO,marginBottom:2}}>{ch}</div>
                <Bd c={T.text.green}>LIVE ⤢</Bd>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────
export function TerminalPrototype() {
  const [dark,setDark]=useState(true);
  const T=dark?DARK:LIGHT;
  const [fkey,setFkey]=useState(0);
  const [ctx,setCtx]=useState<"portfolio"|"deal">("portfolio");
  const [activeDeal,setActiveDeal]=useState<typeof DEALS[0]|null>(null);
  const [time,setTime]=useState(new Date());
  const [windows,setWindows]=useState<WinData[]>([]);
  const maxZ=useRef(1000);

  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);

  const openWindow=useCallback((type:"news"|"tv")=>{
    const id=`w${Date.now()}`;
    maxZ.current+=1;
    setWindows(ws=>[...ws,{id,title:type==="news"?"NEWS INTELLIGENCE":"LIVE TV",x:120+ws.length*30,y:80+ws.length*30,w:400,h:320,minimized:false,z:maxZ.current,type}]);
  },[]);
  const closeWindow=useCallback((id:string)=>setWindows(ws=>ws.filter(w=>w.id!==id)),[]);
  const minimizeWindow=useCallback((id:string)=>setWindows(ws=>ws.map(w=>w.id===id?{...w,minimized:!w.minimized}:w)),[]);
  const focusWindow=useCallback((id:string)=>{maxZ.current+=1;setWindows(ws=>ws.map(w=>w.id===id?{...w,z:maxZ.current}:w));},[]);
  const moveWindow=useCallback((id:string,x:number,y:number)=>setWindows(ws=>ws.map(w=>w.id===id?{...w,x,y}:w)),[]);

  const enterDeal=(d:typeof DEALS[0])=>{setActiveDeal(d);setCtx("deal");setFkey(0);};
  const exitDeal=()=>{setCtx("portfolio");setActiveDeal(null);setFkey(0);};

  const nav=ctx==="portfolio"?PORTFOLIO_NAV:DEAL_NAV;

  const tickerContent=TICKERS.join("    ·    ");

  const views: Record<number,React.ReactNode> = {
    0: <PipelineView T={T} onDealClick={enterDeal}/>,
    1: <PortfolioView T={T}/>,
    2: <MarketsView T={T}/>,
    3: <MapLayersView T={T}/>,
    4: <NewsView T={T} onOpenWindow={openWindow}/>,
  };
  const dealViews: Record<number,React.ReactNode> = {};
  for(let i=0;i<12;i++) dealViews[i]=(
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
      <div style={{fontSize:11,color:T.text.amber,fontFamily:MONO,fontWeight:700}}>{activeDeal?.name} — {DEAL_NAV[i]}</div>
      <div style={{fontSize:9,color:T.text.muted}}>Module content renders here · Wire to production module in Task #62</div>
    </div>
  );

  return (
    <div style={{width:"100vw",height:"100vh",display:"flex",flexDirection:"column",background:T.bg.app,fontFamily:MONO,overflow:"hidden",position:"relative"}}>
      <style>{INJECTED_CSS}</style>

      {/* TOP BAR */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 12px",background:T.bg.topBar,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,minHeight:32}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,fontWeight:800,color:T.text.amber,letterSpacing:1}}>JEDI RE</span>
          {ctx==="deal" && activeDeal && (
            <>
              <span style={{fontSize:9,color:T.text.muted}}>›</span>
              <span style={{fontSize:9,fontWeight:600,color:T.text.primary}}>{activeDeal.name}</span>
              <button onClick={exitDeal} style={{fontSize:7,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.subtle}`,padding:"0 5px",cursor:"pointer"}}>← BACK</button>
            </>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {windows.length>0&&<button onClick={()=>focusWindow(windows[windows.length-1].id)} style={{fontSize:8,color:T.text.cyan,background:T.text.cyan+"18",border:`1px solid ${T.text.cyan}33`,padding:"1px 7px",cursor:"pointer"}}>{windows.length} WINDOW{windows.length!==1?"S":""}</button>}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:T.text.green,animation:"pulse 2s infinite",display:"inline-block"}}/>
            <span style={{fontSize:7,color:T.text.muted}}>5 AGENTS ON</span>
          </div>
          <span style={{fontSize:10,fontWeight:600,color:T.text.primary}}>{time.toLocaleTimeString("en-US",{hour12:false})}</span>
          <button onClick={()=>setDark(d=>!d)} style={{fontFamily:MONO,fontSize:8,padding:"2px 8px",background:dark?T.text.amber+"18":"#1A1F2E",border:`1px solid ${dark?T.text.amber+"44":T.border.medium}`,color:dark?T.text.amber:T.text.primary,cursor:"pointer",letterSpacing:.3}}>{dark?"☾ DARK":"☀ LIGHT"}</button>
        </div>
      </div>

      {/* F-KEY NAV */}
      <div style={{display:"flex",background:T.bg.header,borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,overflow:"hidden"}}>
        {nav.map((label,i)=>{
          const key=ctx==="portfolio"?`F${i+1}`:`F${i+1}`;
          const active=fkey===i;
          return (
            <button key={i} onClick={()=>setFkey(i)} style={{fontFamily:MONO,fontSize:8,fontWeight:active?700:500,color:active?T.bg.app:T.text.secondary,background:active?T.text.amber:"transparent",border:"none",borderRight:`1px solid ${T.border.subtle}`,padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap",letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:7,color:active?T.bg.app+"88":T.text.muted}}>{key}</span> {label}
            </button>
          );
        })}
      </div>

      {/* TICKER */}
      <div style={{background:T.bg.topBar,borderBottom:`1px solid ${T.border.subtle}`,height:18,overflow:"hidden",flexShrink:0}}>
        <div style={{display:"inline-block",animation:"ticker 40s linear infinite",whiteSpace:"nowrap",paddingTop:2}}>
          {[tickerContent,tickerContent].map((t,i)=>(
            <span key={i} style={{fontSize:8,color:T.text.muted,marginRight:40}}>{t}</span>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",animation:"fadeIn .1s"}}>
        {ctx==="portfolio" ? (views[fkey]||views[0]) : (dealViews[fkey]||dealViews[0])}
      </div>

      {/* BOTTOM PANEL */}
      <BottomPanel T={T} onOpenWindow={openWindow}/>

      {/* FLOATING WINDOWS */}
      {windows.map(w=>(
        <FloatingWindow key={w.id} win={w} T={T}
          onClose={()=>closeWindow(w.id)} onMinimize={()=>minimizeWindow(w.id)}
          onFocus={()=>focusWindow(w.id)} onMove={(x,y)=>moveWindow(w.id,x,y)}/>
      ))}
    </div>
  );
}
