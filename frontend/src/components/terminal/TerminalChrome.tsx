import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, api } from "../../services/api.client";
import { TickerBar } from "./TickerBar";

const DARK = {
  bg: { terminal:"#0A0E17", panel:"#0F1319", panelAlt:"#131821", header:"#1A1F2E", hover:"#1E2538", active:"#252D40", input:"#0D1117", topBar:"#050810" },
  text: { primary:"#E8ECF1", secondary:"#8B95A5", muted:"#4A5568", amber:"#F5A623", amberBright:"#FFD166", green:"#00D26A", red:"#FF4757", cyan:"#00BCD4", orange:"#FF8C42", purple:"#A78BFA", white:"#FFFFFF", blue:"#3B82F6" },
  border: { subtle:"#1E2538", medium:"#2A3348", bright:"#3B4A6B" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace", display:"'IBM Plex Mono',monospace", label:"'IBM Plex Sans',sans-serif" },
};
const LIGHT = {
  bg: { terminal:"#F0F4F8", panel:"#FFFFFF", panelAlt:"#F8FAFC", header:"#E8ECF1", hover:"#EFF6FF", active:"#DBEAFE", input:"#F1F5F9", topBar:"#1A1F2E" },
  text: { primary:"#1A202C", secondary:"#4A5568", muted:"#A0AEC0", amber:"#D97706", amberBright:"#F59E0B", green:"#059669", red:"#DC2626", cyan:"#0891B2", orange:"#EA580C", purple:"#7C3AED", white:"#FFFFFF", blue:"#2563EB" },
  border: { subtle:"#E2E8F0", medium:"#CBD5E1", bright:"#94A3B8" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace", display:"'IBM Plex Mono',monospace", label:"'IBM Plex Sans',sans-serif" },
};

type ThemeTokens = typeof DARK;

const PORTFOLIO_NAV = [
  {key:"F1",label:"DASHBOARD"},
  {key:"F2",label:"PIPELINE"},
  {key:"F3",label:"PORTFOLIO"},
  {key:"F4",label:"MARKETS"},
  {key:"F5",label:"EMAIL"},
  {key:"F6",label:"NEWS"},
  {key:"F7",label:"STRATEGIES"},
  {key:"F8",label:"REPORTS"},
  {key:"F9",label:"ADMIN"},
  {key:"F10",label:"SETTINGS"},
];

const FKEY_SLUG: Record<string,string> = {
  F1:"dashboard", F2:"pipeline", F3:"portfolio", F4:"markets",
  F5:"email",     F6:"news",     F7:"strategies", F8:"reports", F9:"admin", F10:"settings",
};

const STATIC_NEWS = [
  {id:"n1",time:"14:23",hl:"Amazon announces 2,000-job Tampa HQ expansion",impact:"+DEMAND",pts:"+3.2",affects:["Pipeline"],mkt:"TAMPA·MF"},
  {id:"n2",time:"13:41",hl:"Greystar breaks ground 380-unit tower Downtown Tampa",impact:"+SUPPLY",pts:"-1.8",affects:[],mkt:"TAMPA·MF"},
  {id:"n3",time:"11:15",hl:"FL Legislature passes insurance reform, 8% rate cap",impact:"RISK DN",pts:"+1.2",affects:["All FL"],mkt:"FL·ALL"},
  {id:"n4",time:"09:32",hl:"Nocatee named #2 top-selling MPC nationally",impact:"+DEMAND",pts:"+2.4",affects:[],mkt:"JAX·MF/SFR"},
  {id:"n5",time:"YST",hl:"Miami-Dade condo reserve law triggers $2.1B assessments",impact:"+DEMAND",pts:"+0.8",affects:[],mkt:"MIA·CONDO"},
];

const STATIC_AGENTS = [
  {id:"A01",name:"Data Collector",st:"ON"},
  {id:"A03",name:"Zoning Agent",st:"ON"},
  {id:"A05",name:"Market Analyst",st:"ON"},
  {id:"A07",name:"Risk Scorer",st:"ON"},
  {id:"A08",name:"Strategy Engine",st:"IDLE"},
  {id:"A10",name:"Orchestrator",st:"ON"},
];

const STATIC_EMAILS = [
  {id:1,unread:true},
  {id:2,unread:true},
  {id:3,unread:false},
];

const TICKERS = ["^ TAMPA·MF  CAP 5.2% (-15bps)","* MIAMI·MF  ABS 94.7%","v ORL·MF  PIPELINE +2,400u","^ JAX·MF  EMPL +3.2%","* ATL·MF  MED RENT $2,056","^ TPA·MF  RENT +3.7%","* CHAR·MF  LEASE VEL 22d","v MIA·CONDO  SUPPLY +18%","^ JAX·SFR  DEMAND +42%","* ATL·MF  JOBS +5.8%","^ ORL·MF  OCC 92.9%","* TPA·IND  ABSORB 1.2M SF","v ATL·OFF  VACANCY 21.4%","^ CHAR·MF  JEDI 82 (+3)"];

const CURATED_METRIC_IDS = ['F_CAP_RATE','F_RENT_GROWTH','M_VACANCY','M_ABSORPTION','E_EMPLOYMENT_GROWTH','E_WAGE_GROWTH','E_POPULATION_GROWTH','C_SURGE_INDEX','S_PIPELINE_TO_STOCK','S_MONTHS_OF_SUPPLY','M_LEASE_VELOCITY','D_SEARCH_MOMENTUM'];
const CURATED_METRIC_LABELS: Record<string,string> = {F_CAP_RATE:'CAP RATE',F_RENT_GROWTH:'RENT GROWTH',M_VACANCY:'VACANCY',M_ABSORPTION:'ABSORPTION',E_EMPLOYMENT_GROWTH:'EMPL GROWTH',E_WAGE_GROWTH:'WAGE GROWTH',E_POPULATION_GROWTH:'POP GROWTH',C_SURGE_INDEX:'SURGE IDX',S_PIPELINE_TO_STOCK:'PIPELINE/STOCK',S_MONTHS_OF_SUPPLY:'MOS SUPPLY',M_LEASE_VELOCITY:'LEASE VEL',D_SEARCH_MOMENTUM:'SRCH MOM'};
const SCOPE_ABBREV: Record<string,string> = {property:'PROP',submarket:'SBMKT',zip:'ZIP',county:'CNTY',msa:'MSA'};

const STATIC_METRICS_TICKER = [
  {raw:'ATL·MF  CAP RATE  5.2%',    color:'#F5A623',sub:'MIDTOWN ATL',  subColor:'rgba(245,166,35,0.45)'},
  {raw:'TPA·MF  RENT GROWTH  +3.0%',color:'#00D26A',sub:'YBOR CITY',   subColor:'rgba(245,166,35,0.45)'},
  {raw:'ATL·MF  VACANCY  6.9%',     color:'#F5A623',sub:'DOWNTOWN ATL', subColor:'rgba(245,166,35,0.45)'},
  {raw:'TPA·MF  ABSORPTION  +2,150u/mo',color:'#00D26A',sub:'TPA MSA', subColor:'rgba(245,166,35,0.45)'},
  {raw:'JAX·MF  EMPL GROWTH  +2.4%',color:'#00D26A',sub:'JAX MSA',     subColor:'rgba(245,166,35,0.45)'},
  {raw:'ATL·ALL  WAGE GROWTH  +3.4%',color:'#00D26A',sub:'ATL MSA',    subColor:'rgba(245,166,35,0.45)'},
  {raw:'ORL·MF  POP GROWTH  +1.7%', color:'#00D26A',sub:'ORL MSA',     subColor:'rgba(245,166,35,0.45)'},
  {raw:'TPA·MF  SURGE IDX  +0.42',  color:'#00D26A',sub:'YBOR CITY',   subColor:'rgba(245,166,35,0.45)'},
  {raw:'ATL·MF  PIPELINE/STOCK  15.8%',color:'#F5A623',sub:'ATL MSA',  subColor:'rgba(245,166,35,0.45)'},
  {raw:'MIA·CONDO  MOS SUPPLY  6.2mo',color:'#FF4757',sub:'BRICKELL',  subColor:'rgba(245,166,35,0.45)'},
  {raw:'ATL·MF  LEASE VEL  18d',    color:'#00D26A',sub:'MIDTOWN ATL', subColor:'rgba(245,166,35,0.45)'},
  {raw:'TPA·MF  SRCH MOM  +22%',    color:'#00D26A',sub:'YBOR CITY',   subColor:'rgba(245,166,35,0.45)'},
  {raw:'CHAR·MF  CAP RATE  5.4%',   color:'#F5A623',sub:'UPTOWN CHAR', subColor:'rgba(245,166,35,0.45)'},
  {raw:'ORL·MF  VACANCY  7.1%',     color:'#F5A623',sub:'LAKE NONA',   subColor:'rgba(245,166,35,0.45)'},
  {raw:'JAX·SFR  RENT GROWTH  +4.1%',color:'#00D26A',sub:'NOCATEE',   subColor:'rgba(245,166,35,0.45)'},
];

const fmtMetric = (id:string, ev:string, hib:boolean, scope?:string) => {
  const label=CURATED_METRIC_LABELS[id]||id;
  const v=(ev||'').trim().split(' ')[0];
  const isPos=v.startsWith('+'),isNeg=v.startsWith('-');
  const color=hib?(isPos?'#00D26A':isNeg?'#FF4757':'#F5A623'):(isNeg?'#00D26A':isPos?'#FF4757':'#F5A623');
  const sub=scope?(SCOPE_ABBREV[scope]??scope.toUpperCase()):undefined;
  return {raw:`${label}  ${v}`,color,sub,subColor:'rgba(245,166,35,0.45)'};
};

interface ApiDeal {
  id: string;
  purchasePrice?: number;
  dealValue?: number;
  budget?: number;
  pipelineStage?: string;
  stage?: string;
  state?: string;
}

interface ApiAlert {
  id?: string;
  severity?: string;
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

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span style={{fontSize:10,color:"inherit"}}>{t.toLocaleTimeString("en-US",{hour12:false})}</span>;
}

export interface TerminalChromeProps {
  activeFkey?: string;
  onFkeyChange?: (fkey: string) => void;
  theme?: "dark" | "light";
  onThemeToggle?: () => void;
  rightActions?: React.ReactNode;
  showNavBar?: boolean;
}

export function TerminalChrome({
  activeFkey,
  onFkeyChange,
  theme: themeProp,
  onThemeToggle,
  rightActions,
  showNavBar = true,
}: TerminalChromeProps) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark"|"light">(themeProp || (() => (localStorage.getItem("jedi-theme")||"dark") as "dark"|"light"));
  const T: ThemeTokens = theme === "dark" ? DARK : LIGHT;

  useEffect(() => {
    if (themeProp && themeProp !== theme) setTheme(themeProp);
  }, [themeProp]);

  const toggleTheme = () => {
    if (onThemeToggle) {
      onThemeToggle();
    } else {
      setTheme(p => { const n = p === "dark" ? "light" : "dark"; localStorage.setItem("jedi-theme", n); return n; });
    }
  };

  const [totalPV, setTotalPV] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [hAlerts, setHAlerts] = useState(0);
  const [agentCount] = useState(STATIC_AGENTS.filter(a => a.st === "ON").length);
  const [mailCount] = useState(STATIC_EMAILS.filter(e => e.unread).length);

  const [liveNews, setLiveNews] = useState(STATIC_NEWS);
  const [liveMacroTicker, setLiveMacroTicker] = useState<{raw:string;color:string;sub?:string;subColor?:string}[]>(
    TICKERS.map(t => ({ raw: t, color: t.startsWith('^') ? DARK.text.green : t.startsWith('v') ? DARK.text.red : DARK.text.amber }))
  );
  const [metricsTicker, setMetricsTicker] = useState(STATIC_METRICS_TICKER);

  useEffect(() => {
    apiClient.get("/api/v1/deals", { params: { limit: 100 } })
      .then(res => {
        const raw: ApiDeal[] = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.deals || []);
        const pv = raw.reduce((s, d) => s + (d.purchasePrice || d.dealValue || d.budget || 0), 0) / 1000000;
        setTotalPV(pv);
        const active = raw.filter(d => {
          const st = (d.pipelineStage || d.stage || d.state || "").toUpperCase();
          return st.includes("DD") || st.includes("EXECUTION") || st.includes("LOI") || st.includes("UNDERWRITING");
        }).length;
        setActiveCount(active);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.get("/api/v1/jedi/alerts", { params: { limit: 30 } })
      .then(res => {
        const raw: ApiAlert[] = res.data?.data?.alerts || res.data?.alerts || [];
        setHAlerts(raw.filter(a => a.severity === "critical" || a.severity === "high" || a.severity === "red" || a.severity === "yellow").length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Pull both legacy curated events and the new unified feed (newsletter
    // subscriptions + provider APIs). Premium/subscription items are tagged
    // so the ticker badges them as YOUR FEED.
    Promise.all([
      apiClient.get("/api/v1/news/events", { params: { limit: 15 } }).catch(() => null),
      apiClient.get("/api/v1/news/feed", { params: { limit: 25 } }).catch(() => null),
    ]).then(([eventsRes, feedRes]) => {
      const events: ApiNewsEvent[] = eventsRes
        ? (Array.isArray(eventsRes.data) ? eventsRes.data : (eventsRes.data?.data || eventsRes.data?.events || []))
        : [];
      const feedArticles: Array<Record<string, unknown>> = feedRes?.data?.data?.articles || [];

      const fromEvents = events.map((n, i) => ({
        id: n.id || `ev-${i}`,
        time: n.publishedAt ? new Date(n.publishedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false}) : "—",
        hl: n.headline || n.title || n.description || "Market update",
        impact: n.impact || n.marketImpact || (n.sentiment === "positive" ? "+DEMAND" : n.sentiment === "negative" ? "RISK DN" : "INFO"),
        pts: n.scoreImpact ? (n.scoreImpact > 0 ? `+${n.scoreImpact.toFixed(1)}` : n.scoreImpact.toFixed(1)) : "0.0",
        affects: n.affectedDeals || n.deals || [],
      }));

      const fromFeed = feedArticles.map((a, i) => {
        const ts = (a.published_at as string) || new Date().toISOString();
        const isPremium = a.is_premium === true;
        return {
          id: String(a.id ?? `feed-${i}`),
          time: new Date(ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false}),
          hl: String(a.headline ?? a.title ?? "News update"),
          impact: isPremium ? "YOUR FEED" : String(a.source ?? "API"),
          pts: typeof a.jedi_delta === "number" ? (a.jedi_delta > 0 ? `+${a.jedi_delta.toFixed(1)}` : a.jedi_delta.toFixed(1)) : "0.0",
          affects: [],
        };
      });

      const combined = [...fromFeed, ...fromEvents].slice(0, 24);
      if (combined.length > 0) setLiveNews(combined);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const FALLBACK = TICKERS.map(t => ({
      raw: t,
      color: t.startsWith('^') ? T.text.green : t.startsWith('v') ? T.text.red : T.text.amber,
    }));

    const fetchTicker = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await api.ticker.getFeed();
        const items: { symbol: string; value: string; change: string; direction: 'up'|'down'|'flat' }[] =
          res.data?.data ?? [];
        if (items.length === 0) return;
        setLiveMacroTicker(items.map(item => {
          const arrow = item.direction === 'up' ? '^' : item.direction === 'down' ? 'v' : '*';
          const color = item.direction === 'up' ? T.text.green : item.direction === 'down' ? T.text.red : T.text.amber;
          return { raw: `${arrow} ${item.symbol}  ${item.value} (${item.change})`, color };
        }));
      } catch {
        setLiveMacroTicker(FALLBACK);
      }
    };

    function handleVisibilityChangeTicker() {
      if (document.visibilityState === 'visible') fetchTicker();
    }

    fetchTicker();
    const intervalId = setInterval(fetchTicker, 60_000);
    document.addEventListener('visibilitychange', handleVisibilityChangeTicker);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChangeTicker);
    };
  }, []);

  useEffect(() => {
    apiClient.get('/api/v1/metrics/catalog').then(res => {
      const metrics: Array<Record<string,unknown>> = res.data?.metrics || [];
      const ordered = CURATED_METRIC_IDS
        .map(id => metrics.find(m => m.id === id))
        .filter(Boolean) as Array<Record<string,unknown>>;
      if (ordered.length > 0) {
        setMetricsTicker(ordered.map(m => fmtMetric(m.id as string, m.exampleValue as string, m.higherIsBetter as boolean, 'submarket')));
      }
    }).catch(() => {});
  }, []);

  const handleFkeyClick = (key: string) => {
    if (onFkeyChange) {
      onFkeyChange(key);
    } else {
      const slug = FKEY_SLUG[key] || "dashboard";
      navigate(`/terminal/${slug}`);
    }
  };

  return (
    <>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px",height:28,background:T.bg.topBar,borderBottom:`1px solid ${T.border.subtle}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <span onClick={() => navigate("/terminal/dashboard")} style={{fontFamily:T.font.display,fontSize:14,fontWeight:800,color:T.text.amber,letterSpacing:2,flexShrink:0,cursor:"pointer"}}>JediRE</span>
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0}}>|</span>
          <span style={{fontSize:10,color:T.text.secondary,flexShrink:0}}>PORTFOLIO</span>
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0}}>|</span>
          {totalPV>0&&<span style={{fontSize:10,fontWeight:700,color:T.text.amberBright,flexShrink:0}}>PIPELINE: ${totalPV.toFixed(1)}M</span>}
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0}}>|</span>
          <span style={{fontSize:10,fontWeight:600,color:T.text.cyan,flexShrink:0}}>ACTIVE: {activeCount}</span>
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0}}>|</span>
          <span style={{fontSize:10,fontWeight:700,color:hAlerts>0?T.text.red:T.text.green,flexShrink:0}}>ALERTS: {hAlerts}</span>
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0}}>|</span>
          <span style={{fontSize:10,color:T.text.muted,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <span style={{fontSize:10,color:T.text.green,display:"flex",alignItems:"center",gap:3}}>
            <span style={{width:4,height:4,borderRadius:"50%",background:T.text.green,animation:"glow 2s infinite"}}/>
            {agentCount} AGT
          </span>
          <span style={{fontSize:10,color:T.text.cyan}}>MAIL: {mailCount}</span>
          <span style={{fontSize:10,color:T.text.secondary}}>KAFKA: 312/s</span>
          <span style={{fontSize:10,color:T.text.amber,fontWeight:600}}><LiveClock /></span>
          <button onClick={toggleTheme} style={{fontFamily:T.font.mono,fontSize:12,background:"transparent",border:`1px solid ${T.border.medium}`,color:T.text.secondary,padding:"2px 8px",cursor:"pointer",lineHeight:1}} title={theme==="dark"?"Switch to light":"Switch to dark"}>
            {theme==="dark"?"☀":"☾"}
          </button>
        </div>
      </div>

      <TickerBar height={20} speed={45} label="LIVE" labelColor={T.text.amber}
        items={[
          ...liveNews.map(n => {
            const impactColor = (n.impact||'').includes('DEMAND') ? T.text.green : (n.impact||'').includes('SUPPLY') || (n.impact||'').includes('RISK') ? T.text.red : T.text.amber;
            return { raw: `[${n.time}]${(n as any).mkt ? ` [${(n as any).mkt}]` : ''} ${n.hl}`, color: T.text.primary, sub: `${n.impact}`, subColor: impactColor };
          }),
          ...liveMacroTicker,
          ...metricsTicker,
        ]}
      />

      {showNavBar && (
        <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border.medium}`,flexShrink:0,background:T.bg.header}}>
          <div style={{display:"flex",flex:1,overflowX:"auto"}}>
            {PORTFOLIO_NAV.map(n=>(
              <button key={n.key} onClick={()=>handleFkeyClick(n.key)} style={{fontFamily:T.font.mono,fontSize:11,fontWeight:600,padding:"0 12px",height:32,cursor:"pointer",background:activeFkey===n.key?T.text.amber:"transparent",color:activeFkey===n.key?T.bg.terminal:T.text.secondary,border:"none",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",flexShrink:1,minWidth:0}}>
                <span style={{fontSize:10,fontWeight:700,opacity:0.7,color:activeFkey===n.key?T.bg.terminal:T.text.muted}}>{n.key}</span>
                {n.label}
              </button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",padding:"0 12px",borderLeft:`1px solid ${T.border.medium}`,flexShrink:0,height:"100%"}}>
            <span style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,fontStyle:"italic",letterSpacing:0.4,whiteSpace:"nowrap"}}>
              Press 0-7 to navigate&nbsp;•&nbsp;Type ticker to search
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"0 8px",borderLeft:`1px solid ${T.border.medium}`,flexShrink:0}}>
            <button onClick={()=>navigate("/deals/create")} style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:T.text.amber,color:T.bg.terminal,border:"none",padding:"3px 9px",cursor:"pointer",height:22,letterSpacing:0.3,flexShrink:0}}>+ DEAL</button>
            {rightActions || (
              <button onClick={() => navigate("/terminal/dashboard")} style={{fontFamily:T.font.mono,fontSize:10,fontWeight:600,color:T.text.muted,background:"transparent",border:`1px solid ${T.border.medium}`,padding:"3px 10px",cursor:"pointer",height:22}}>&gt; CMD (⌘K)</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { DARK as CHROME_DARK, LIGHT as CHROME_LIGHT, PORTFOLIO_NAV, FKEY_SLUG };
export type { ThemeTokens as ChromeThemeTokens };
