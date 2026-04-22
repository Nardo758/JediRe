import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPanel } from './CommandPanel';
import { BottomPanel } from './BottomPanel';
import { SkillsBar } from './SkillsBar';
import { WarMapsComposer } from '../map/WarMapsComposer';
import { ChatOverlay } from '../chat/ChatOverlay';
import QuickSetupModal from '../onboarding/QuickSetupModal';
import { MapLayer } from '../../types/layers';
import api from '../../lib/api';
import { T } from '../../styles/terminal-tokens';
import { TickerBar } from '../terminal/TickerBar';
import { Badge } from '../terminal/Badge';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { useTheme } from '../../contexts/ThemeContext';

const DEFAULT_MAP_ID = 'default';

const CURATED_METRIC_IDS = [
  'F_CAP_RATE', 'F_RENT_GROWTH', 'M_VACANCY', 'M_ABSORPTION',
  'E_EMPLOYMENT_GROWTH', 'E_WAGE_GROWTH', 'E_POPULATION_GROWTH',
  'C_SURGE_INDEX', 'S_PIPELINE_TO_STOCK', 'S_MONTHS_OF_SUPPLY',
  'M_LEASE_VELOCITY', 'D_SEARCH_MOMENTUM',
];

const CURATED_METRIC_LABELS: Record<string, string> = {
  F_CAP_RATE: 'CAP RATE', F_RENT_GROWTH: 'RENT GROWTH', M_VACANCY: 'VACANCY',
  M_ABSORPTION: 'ABSORPTION', E_EMPLOYMENT_GROWTH: 'EMPL GROWTH',
  E_WAGE_GROWTH: 'WAGE GROWTH', E_POPULATION_GROWTH: 'POP GROWTH',
  C_SURGE_INDEX: 'SURGE IDX', S_PIPELINE_TO_STOCK: 'PIPELINE/STOCK',
  S_MONTHS_OF_SUPPLY: 'MOS SUPPLY', M_LEASE_VELOCITY: 'LEASE VEL',
  D_SEARCH_MOMENTUM: 'SRCH MOM',
};

const SCOPE_ABBREV: Record<string, string> = {
  property: 'PROP', submarket: 'SBMKT', zip: 'ZIP', county: 'CNTY', msa: 'MSA',
};

interface MetricTickerItem { raw: string; color: string; sub?: string; subColor?: string; }

const formatMetricItem = (id: string, exampleValue: string, higherIsBetter: boolean, scope?: string): MetricTickerItem => {
  const label = CURATED_METRIC_LABELS[id] || id;
  const ev = (exampleValue || '').trim().split(' ')[0];
  const isPos = ev.startsWith('+');
  const isNeg = ev.startsWith('-');
  const color = higherIsBetter
    ? (isPos ? T.text.green : isNeg ? T.text.red : T.text.amber)
    : (isNeg ? T.text.green : isPos ? T.text.red : T.text.amber);
  const sub = scope ? (SCOPE_ABBREV[scope] ?? scope.toUpperCase()) : undefined;
  return { raw: `${label}  ${ev}`, color, sub, subColor: 'rgba(245,166,35,0.45)' };
};

const STATIC_METRICS_TICKER: MetricTickerItem[] = [
  { raw: 'ATL·MF  CAP RATE  5.2%',       color: T.text.amber, sub: 'MIDTOWN ATL',  subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'TPA·MF  RENT GROWTH  +3.0%',   color: T.text.green, sub: 'YBOR CITY',    subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'ATL·MF  VACANCY  6.9%',        color: T.text.amber, sub: 'DOWNTOWN ATL', subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'TPA·MF  ABSORPTION  +2,150u/mo', color: T.text.green, sub: 'TPA MSA',   subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'JAX·MF  EMPL GROWTH  +2.4%',   color: T.text.green, sub: 'JAX MSA',     subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'ATL·ALL  WAGE GROWTH  +3.4%',  color: T.text.green, sub: 'ATL MSA',     subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'ORL·MF  POP GROWTH  +1.7%',   color: T.text.green, sub: 'ORL MSA',     subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'TPA·MF  SURGE IDX  +0.42',    color: T.text.green, sub: 'YBOR CITY',   subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'ATL·MF  PIPELINE/STOCK  15.8%', color: T.text.amber, sub: 'ATL MSA',   subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'MIA·CONDO  MOS SUPPLY  6.2mo', color: T.text.red,   sub: 'BRICKELL',    subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'ATL·MF  LEASE VEL  18d',      color: T.text.green, sub: 'MIDTOWN ATL', subColor: 'rgba(245,166,35,0.45)' },
  { raw: 'TPA·MF  SRCH MOM  +22%',      color: T.text.green, sub: 'YBOR CITY',   subColor: 'rgba(245,166,35,0.45)' },
];

const MKTDATA_TICKERS = [
  "^ TAMPA·MF  CAP 5.2% (-15bps)",
  "* MIAMI·MF  ABS 94.7%",
  "v ORL·MF  PIPELINE +2,400u",
  "^ JAX·MF  EMPL +3.2%",
  "* ATL·MF  MED RENT $2,056",
  "^ TPA·MF  RENT +3.7%",
  "* CHAR·MF  LEASE VEL 22d",
  "v MIA·CONDO  SUPPLY +18%",
  "^ JAX·SFR  DEMAND +42%",
  "* ATL·MF  JOBS +5.8%",
];

const STATIC_NEWS_TICKER = [
  { id: "n1", time: "14:23", hl: "Amazon announces 2,000-job Tampa HQ expansion",            impact: "+DEMAND", pts: "+3.2" },
  { id: "n2", time: "13:41", hl: "Greystar breaks ground 380-unit tower Downtown Tampa",    impact: "+SUPPLY", pts: "-1.8" },
  { id: "n3", time: "11:15", hl: "FL Legislature passes insurance reform, 8% rate cap",     impact: "RISK DN", pts: "+1.2" },
  { id: "n4", time: "09:32", hl: "Nocatee named #2 top-selling MPC nationally",             impact: "+DEMAND", pts: "+2.4" },
  { id: "n5", time: "YST",   hl: "Miami-Dade condo reserve law triggers $2.1B assessments", impact: "+DEMAND", pts: "+0.8" },
];

const PORTFOLIO_NAV = [
  { key: 'F1', label: 'DASHBOARD', path: '/dashboard' },
  { key: 'F2', label: 'PIPELINE',  path: '/deals' },
  { key: 'F3', label: 'PORTFOLIO', path: '/assets-owned' },
  { key: 'F4', label: 'MARKETS',   path: '/terminal' },
  { key: 'F5', label: 'COMPETE',   path: '/competitive-intelligence' },
  { key: 'F6', label: 'NEWS',      path: '/news-intel' },
  { key: 'F7', label: 'OPPS',      path: '/opportunities' },
  { key: 'F8', label: 'REPORTS',   path: '/reports' },
  { key: 'F9', label: 'SETTINGS',  path: '/settings' },
];

const DEAL_NAV = [
  { key: 'F1',  label: 'OVERVIEW' },
  { key: 'F2',  label: 'ZONING' },
  { key: 'F3',  label: 'MARKET' },
  { key: 'F4',  label: 'SUPPLY' },
  { key: 'F5',  label: 'COMPS' },
  { key: 'F6',  label: 'STRATEGY' },
  { key: 'F7',  label: 'TRAFFIC' },
  { key: 'F8',  label: 'PROFORMA' },
  { key: 'F9',  label: 'CAPITAL' },
  { key: 'F10', label: 'RISK' },
  { key: 'F11', label: 'EXECUTE' },
  { key: 'F12', label: 'AI AGENT' },
];

interface TickerDeal {
  name: string;
  score?: number;
  delta?: string;
}

// Bottom panel types moved to ./BottomPanel.tsx

const TopStatusBar: React.FC<{ contextLabel: string; agentCount: number; emailCount: number }> = ({
  contextLabel, agentCount, emailCount,
}) => {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      height: 24,
      background: T.bg.topBar,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      borderBottom: `1px solid ${T.border.subtle}`,
      flexShrink: 0,
      fontFamily: T.font.mono,
      fontSize: T.fontSize.sm,
      userSelect: 'none',
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontWeight: 800,
          fontSize: T.fontSize.md,
          color: T.text.cyan,
          letterSpacing: 1.5,
        }}>JediRE</span>
        <span style={{ color: T.text.secondary, fontSize: T.fontSize.xs }}>|</span>
        <span style={{ color: T.text.secondary, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {contextLabel}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.text.secondary }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: T.text.green,
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          {agentCount} AGENTS
        </span>
        <span style={{ color: T.text.secondary }}>
          EMAIL: <span style={{ color: T.text.primary, fontWeight: 600 }}>{emailCount}</span>
        </span>
        <span style={{ color: T.text.secondary }}>
          KAFKA: <span style={{ color: T.text.primary, fontWeight: 600 }}>312/s</span>
        </span>
        <span style={{ color: T.text.amber, fontWeight: 700, letterSpacing: 1 }}>
          {clock}
        </span>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
};

interface FKeyNavBarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  isInsideDeal: boolean;
}

const DEAL_TAB_IDS = ['overview','zoning','market','supply','competition','strategy','traffic','proforma','capital','risk','execution','ai-agent'];

const FKeyNavBar: React.FC<FKeyNavBarProps> = ({
  activePath, onNavigate, isInsideDeal,
}) => {
  const items = isInsideDeal ? DEAL_NAV : PORTFOLIO_NAV;
  const [dealActiveTab, setDealActiveTab] = useState('overview');
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (!isInsideDeal) return;
    const handler = (e: Event) => {
      const tabId = (e as CustomEvent<string>).detail;
      if (tabId) setDealActiveTab(tabId);
    };
    window.addEventListener('deal-active-tab', handler);
    return () => window.removeEventListener('deal-active-tab', handler);
  }, [isInsideDeal]);

  return (
    <div style={{
      height: 40,
      background: T.bg.topBar,
      display: 'flex',
      alignItems: 'stretch',
      gap: 0,
      borderBottom: `1px solid ${T.border.subtle}`,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {items.map((item, idx) => {
        const isActive = isInsideDeal
          ? (dealActiveTab === DEAL_TAB_IDS[idx])
          : (activePath === (item as typeof PORTFOLIO_NAV[0]).path ||
             ((item as typeof PORTFOLIO_NAV[0]).path === '/deals' && activePath.startsWith('/deals')) ||
             ((item as typeof PORTFOLIO_NAV[0]).path === '/dashboard' && (activePath === '/' || activePath === '/terminal')));
        return (
          <button
            key={item.key}
            onClick={() => {
              if (isInsideDeal) {
                window.dispatchEvent(new CustomEvent('deal-tab-change', { detail: DEAL_TAB_IDS[idx] }));
              } else if ('path' in item) {
                onNavigate((item as typeof PORTFOLIO_NAV[0]).path);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 2,
              padding: '5px 12px 5px 10px',
              height: '100%',
              border: 'none',
              borderRight: `1px solid ${T.border.subtle}`,
              borderBottom: isActive ? `2px solid ${T.text.amber}` : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: T.font.mono,
              background: isActive ? `${T.text.amber}0f` : 'transparent',
              color: isActive ? T.text.primary : T.text.secondary,
              transition: 'all 0.12s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget.style.background = T.bg.hover);
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget.style.background = 'transparent');
            }}
          >
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: 1.2, color: isActive ? T.text.amber : T.text.muted, lineHeight: 1 }}>{item.key}</span>
            <span style={{ fontSize: T.fontSize.sm, fontWeight: isActive ? 700 : 500, letterSpacing: 0.4, lineHeight: 1.1 }}>{item.label}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: '0 12px',
          background: 'transparent', border: 'none',
          borderLeft: `1px solid ${T.border.subtle}`,
          cursor: 'pointer',
          fontSize: 14,
          color: T.text.secondary,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget.style.color = T.text.amber); }}
        onMouseLeave={e => { (e.currentTarget.style.color = T.text.secondary); }}
      >
        {isDark ? '☀' : '☾'}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', borderLeft: `1px solid ${T.border.subtle}`, paddingLeft: 12, paddingRight: 12 }}>
        <span style={{
          fontSize: T.fontSize.xs,
          color: T.text.muted,
          fontFamily: T.font.mono,
          letterSpacing: 0.8,
        }}>⌘K CMD</span>
      </div>
    </div>
  );
};

interface DealContextInfo {
  address?: string;
  location?: string;
  name?: string;
  jedi_score?: number;
  delta_30d?: number;
  pipeline_stage?: string;
  recommended_strategy?: string;
}

const DealContextBar: React.FC<{ deal: DealContextInfo | null }> = ({ deal }) => {
  const { geographicStats, activeTradeArea } = useTradeAreaStore();

  if (!deal) return null;

  const dealName    = deal.name;
  const dealAddress = deal.address || deal.location;

  const fmtOcc = (v: unknown): string | null => {
    const n = Number(v);
    if (!v || isNaN(n)) return null;
    const pct = n > 1 ? n : n * 100;
    return `${pct.toFixed(1)}%`;
  };
  const fmtRent = (v: unknown): string | null => {
    const n = Number(v);
    if (!v || isNaN(n)) return null;
    return `$${Math.round(n).toLocaleString()}`;
  };

  const smOcc  = fmtOcc(geographicStats?.submarket?.occupancy);
  const smRent = fmtRent(geographicStats?.submarket?.avg_rent);
  const msaOcc  = fmtOcc(geographicStats?.msa?.occupancy);
  const msaRent = fmtRent(geographicStats?.msa?.avg_rent);

  const pipe = <span style={{ color: T.border.medium, margin: '0 8px', fontSize: 10 }}>│</span>;

  return (
    <div style={{
      height: 28,
      background: T.bg.topBar,
      borderBottom: `1px solid ${T.border.subtle}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 0,
      flexShrink: 0,
      fontFamily: T.font.mono,
      overflow: 'hidden',
    }}>
      {/* Left: pin + name + address + JEDI score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flex: 1 }}>
        <span style={{ color: T.text.red, fontSize: 9, marginRight: 5, flexShrink: 0 }}>📍</span>
        {dealName && (
          <span style={{ color: T.text.primary, fontWeight: 700, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, letterSpacing: 0.3 }}>
            {dealName}
          </span>
        )}
        {dealAddress && (
          <>
            <span style={{ color: T.border.medium, margin: '0 5px', fontSize: 9 }}>·</span>
            <span style={{ color: T.text.secondary, fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, letterSpacing: 0.2 }}>
              {dealAddress}
            </span>
          </>
        )}
        {deal.jedi_score != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 10 }}>
            <span style={{ color: T.text.amber, fontSize: 9, fontWeight: 700, letterSpacing: 0.3 }}>JEDI {deal.jedi_score}</span>
            {deal.delta_30d != null && (
              <span style={{ fontSize: 9, fontWeight: 700, color: deal.delta_30d >= 0 ? T.text.green : T.text.red }}>
                {deal.delta_30d >= 0 ? '▲' : '▼'}{deal.delta_30d >= 0 ? '+' : ''}{deal.delta_30d}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Right: TRADE AREA | SUBMARKET | MSA | EDIT */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-trade-area-panel'))}
          style={{
            background: 'transparent', border: `1px solid ${T.text.amber}55`, cursor: 'pointer',
            padding: '2px 8px', fontFamily: T.font.mono,
            fontSize: 9, fontWeight: 800, color: T.text.amber, letterSpacing: 0.8,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ▶ TRADE AREA
        </button>

        {(smOcc || smRent) && (
          <>
            {pipe}
            <span style={{ fontSize: 9, color: T.text.secondary, letterSpacing: 0.5, marginRight: 4 }}>SUBMARKET</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.text.primary, letterSpacing: 0.2 }}>
              {[smOcc, smRent].filter(Boolean).join(' · ')}
            </span>
          </>
        )}

        {(msaOcc || msaRent) && (
          <>
            {pipe}
            <span style={{ fontSize: 9, color: T.text.secondary, letterSpacing: 0.5, marginRight: 4 }}>MSA</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: T.text.primary, letterSpacing: 0.2 }}>
              {[msaOcc, msaRent].filter(Boolean).join(' · ')}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// BottomPanel moved to ./BottomPanel.tsx

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [isWarMapsOpen, setIsWarMapsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [tickerItems, setTickerItems] = useState<TickerDeal[]>([]);
  const [newsTickerItems, setNewsTickerItems] = useState(STATIC_NEWS_TICKER);
  const [metricsTicker, setMetricsTicker] = useState<MetricTickerItem[]>(STATIC_METRICS_TICKER);
  const [dealContext, setDealContext] = useState<DealContextInfo | null>(null);
  const [rawCatalogMetrics, setRawCatalogMetrics] = useState<Array<Record<string, unknown>>>([]);

  const { activeScope } = useTradeAreaStore();

  const isInsideDeal = location.pathname.startsWith('/deals/') || /^\/assets-owned\/[^/]+\/property/.test(location.pathname);
  const dealIdMatch = location.pathname.startsWith('/deals/')
    ? location.pathname.match(/\/deals\/([^/]+)/)
    : location.pathname.match(/\/assets-owned\/([^/]+)\/property/);
  const dealId = dealIdMatch?.[1];

  const contextLabel = isInsideDeal
    ? (dealContext?.name || dealContext?.address || 'DEAL')
    : 'PORTFOLIO';

  useEffect(() => {
    if (!dealId) { setDealContext(null); return; }
    const fetchDealAndScore = async () => {
      try {
        const dealRes = await api.get(`/deals/${dealId}`);
        const d = dealRes.data?.deal || dealRes.data?.data || dealRes.data;
        let ctx: DealContextInfo = d || {};
        if (ctx.jedi_score != null && typeof ctx.jedi_score === 'object') {
          const scoreObj = ctx.jedi_score as unknown as Record<string, unknown>;
          ctx = { ...ctx, jedi_score: (scoreObj.totalScore ?? scoreObj.total_score) as number | undefined };
        }
        try {
          const scoreRes = await api.get(`/jedi/score/${dealId}`);
          const s = scoreRes.data?.data || scoreRes.data;
          // endpoint shape: { data: { score: <scoreObj>, trend: {...} } }
          // scoreObj has totalScore as a number; fall back to flat totalScore/score fields
          const scoreObj = s?.score && typeof s.score === 'object' ? s.score : s;
          const resolvedScore: number | undefined =
            typeof scoreObj?.totalScore === 'number' ? scoreObj.totalScore :
            typeof scoreObj?.total_score === 'number' ? scoreObj.total_score :
            typeof s?.totalScore === 'number' ? s.totalScore : undefined;
          const resolvedDelta: number | undefined =
            s?.trend?.change ?? scoreObj?.scoreDelta ?? s?.delta_30d ?? s?.delta ?? ctx.delta_30d;
          if (resolvedScore != null) ctx = { ...ctx, jedi_score: resolvedScore, delta_30d: resolvedDelta };
        } catch {
          /* JEDI score endpoint may not have data */
        }
        setDealContext(ctx);
      } catch {
        setDealContext(null);
      }
    };
    fetchDealAndScore();
  }, [dealId]);

  useEffect(() => {
    api.get('/deals').then(res => {
      const deals: Array<Record<string, unknown>> = res.data?.deals || res.data?.data || [];
      setTickerItems(deals.slice(0, 30).map(d => {
        let score: number | undefined;
        if (d.jedi_score != null) {
          score = typeof d.jedi_score === 'object'
            ? ((d.jedi_score as Record<string, unknown>).totalScore ?? (d.jedi_score as Record<string, unknown>).total_score) as number | undefined
            : d.jedi_score as number;
        }
        return {
          name: (d.name as string) || 'Untitled',
          score,
          delta: d.delta_30d != null ? ((d.delta_30d as number) >= 0 ? `+${d.delta_30d}` : `${d.delta_30d}`) : undefined,
        };
      }));
    }).catch(() => setTickerItems([]));
  }, []);

  useEffect(() => {
    api.get('/news/feed').then(res => {
      const raw: Array<Record<string, unknown>> = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.events || res.data?.news || []);
      if (raw.length > 0) {
        setNewsTickerItems(raw.slice(0, 12).map((n, i) => ({
          id: (n.id as string) || String(i),
          time: n.publishedAt ? new Date(n.publishedAt as string).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : (n.time as string) || '—',
          hl: (n.headline || n.title || n.description || 'Market update') as string,
          impact: (n.impact || n.marketImpact || (n.sentiment === 'positive' ? '+DEMAND' : n.sentiment === 'negative' ? 'RISK DN' : 'INFO')) as string,
          pts: n.scoreImpact != null ? ((n.scoreImpact as number) > 0 ? `+${(n.scoreImpact as number).toFixed(1)}` : (n.scoreImpact as number).toFixed(1)) : (n.pts as string) || '0.0',
        })));
      }
    }).catch(() => { /* keep static fallback */ });
  }, []);

  useEffect(() => {
    api.get('/metrics/catalog').then(res => {
      const metrics: Array<Record<string, unknown>> = res.data?.metrics || [];
      const ordered = CURATED_METRIC_IDS
        .map(id => metrics.find(m => m.id === id))
        .filter(Boolean) as Array<Record<string, unknown>>;
      if (ordered.length > 0) setRawCatalogMetrics(ordered);
    }).catch(() => { /* keep static fallback */ });
  }, []);

  useEffect(() => {
    if (rawCatalogMetrics.length > 0) {
      setMetricsTicker(rawCatalogMetrics.map(m =>
        formatMetricItem(m.id as string, m.exampleValue as string, m.higherIsBetter as boolean, activeScope)
      ));
    }
  }, [rawCatalogMetrics, activeScope]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPanelOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleFKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      if (isInsideDeal) return;
      const idx = ['F1','F2','F3','F4','F5','F6','F7','F8','F9'].indexOf(e.key);
      if (idx === -1) return;
      e.preventDefault();
      navigate(PORTFOLIO_NAV[idx].path);
    };
    window.addEventListener('keydown', handleFKey);
    return () => window.removeEventListener('keydown', handleFKey);
  }, [isInsideDeal, navigate]);

  useEffect(() => {
    const handler = () => setIsWarMapsOpen(true);
    window.addEventListener('open-war-maps', handler);
    return () => window.removeEventListener('open-war-maps', handler);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setOnboardingChecked(true); return; }
    const checkOnboarding = async () => {
      try {
        const response = await api.get('/preferences/user');
        const prefs = response.data.data;
        if (!prefs || !prefs.onboarding_completed) setShowOnboarding(true);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        setOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, []);

  const handleWarMapsCreated = (newLayers: MapLayer[]) => {
    setLayers([...layers, ...newLayers]);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: T.bg.terminal,
      color: T.text.primary,
      overflow: 'hidden',
    }}>
      <TopStatusBar contextLabel={contextLabel} agentCount={5} emailCount={5} />

      {!isInsideDeal && (
        <>
          <TickerBar height={18} speed={55} label="NEWS" labelColor={T.text.cyan}
            items={newsTickerItems.map(n => {
              const impactColor = n.impact?.includes('DEMAND') ? T.text.green : n.impact?.includes('SUPPLY') || n.impact?.includes('RISK') ? T.text.red : T.text.amber;
              return { raw: `[${n.time}]  ${n.hl}`, color: T.text.primary, sub: `${n.impact}  ${n.pts}pts`, subColor: impactColor };
            })}
          />
          <TickerBar height={18} speed={45} label="MKTDATA" labelColor={T.text.green}
            items={MKTDATA_TICKERS.map(t => ({ raw: t, color: t.startsWith('^') ? T.text.green : t.startsWith('v') ? T.text.red : T.text.amber }))}
          />
          <TickerBar height={18} speed={28} label="METRICS" labelColor={T.text.amber}
            items={metricsTicker}
          />
        </>
      )}

      {!isInsideDeal && <FKeyNavBar activePath={location.pathname} onNavigate={navigate} isInsideDeal={false} />}

      {isInsideDeal && <DealContextBar deal={dealContext} />}

      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Outlet context={{ layers, setLayers }} />
      </main>

      <SkillsBar />
      <BottomPanel />

      {isWarMapsOpen && (
        <WarMapsComposer
          isOpen={isWarMapsOpen}
          onClose={() => setIsWarMapsOpen(false)}
          mapId={DEFAULT_MAP_ID}
          existingLayers={layers}
          onLayersCreated={handleWarMapsCreated}
        />
      )}

      {onboardingChecked && (
        <QuickSetupModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <CommandPanel
        isOpen={commandPanelOpen}
        onClose={() => setCommandPanelOpen(false)}
      />

      <ChatOverlay />
    </div>
  );
};

export default MainLayout;
