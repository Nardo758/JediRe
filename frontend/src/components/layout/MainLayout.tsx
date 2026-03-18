import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPanel } from './CommandPanel';
import { WarMapsComposer } from '../map/WarMapsComposer';
import { ChatOverlay } from '../chat/ChatOverlay';
import QuickSetupModal from '../onboarding/QuickSetupModal';
import { MapLayer } from '../../types/layers';
import api from '../../lib/api';
import { T } from '../../styles/terminal-tokens';
import { TickerBar } from '../terminal/TickerBar';
import { Badge } from '../terminal/Badge';
import { useTradeAreaStore } from '../../stores/tradeAreaStore';
import { GeographicScopeTabs } from '../trade-area';

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
  { raw: 'CAP RATE  5.2%',         color: T.text.amber },
  { raw: 'RENT GROWTH  +3.2%',     color: T.text.green },
  { raw: 'VACANCY  5.2%',          color: T.text.amber },
  { raw: 'ABSORPTION  +125u/mo',   color: T.text.green },
  { raw: 'EMPL GROWTH  +2.1%',     color: T.text.green },
  { raw: 'WAGE GROWTH  +3.4%',     color: T.text.green },
  { raw: 'POP GROWTH  +1.8%',      color: T.text.green },
  { raw: 'SURGE IDX  +0.35',       color: T.text.green },
  { raw: 'PIPELINE/STOCK  8.5%',   color: T.text.amber },
  { raw: 'MOS SUPPLY  4.2mo',      color: T.text.amber },
  { raw: 'LEASE VEL  24d',         color: T.text.amber },
  { raw: 'SRCH MOM  +18%',         color: T.text.green },
];

const MKTDATA_TICKERS = [
  "^ TAMPA CAP 5.2% (-15bps)",
  "* MIAMI ABS 94.7%",
  "v ORL PIPELINE +2400",
  "^ JAX EMPL +3.2%",
  "* FL HOME $412K",
  "^ RENT TPA +3.7%",
  "* FDOT I-275 148.2K",
  "v INS +18% YoY",
  "^ NOCATEE +42%",
  "* TPA JOBS #3",
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
  { key: 'F4', label: 'MARKETS',   path: '/market-intelligence' },
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

interface AlertItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  deal_name?: string;
  message: string;
  created_at: string;
}

interface NewsItem {
  id: string;
  headline: string;
  published_at: string;
  impact?: string;
  jedi_delta?: number;
  deals?: string[];
}

interface AgentItem {
  id: string;
  code: string;
  name: string;
  status: 'online' | 'idle' | 'offline';
  last_action?: string;
  last_active?: string;
  message_count?: number;
}

interface EmailItem {
  id: string;
  from?: string;
  subject?: string;
  preview?: string;
  received_at?: string;
  read?: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
}

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
          background: T.gradient.tealCyan,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: 1.5,
        }}>JEDI RE</span>
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
            boxShadow: `0 0 4px ${T.text.green}88`,
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
            <span style={{ fontSize: '7px', fontWeight: 800, letterSpacing: 1.2, color: isActive ? T.text.amber : T.text.muted, lineHeight: 1 }}>{item.key}</span>
            <span style={{ fontSize: T.fontSize.sm, fontWeight: isActive ? 700 : 500, letterSpacing: 0.4, lineHeight: 1.1 }}>{item.label}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
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
  const { activeScope, setScope, geographicStats, activeTradeArea } = useTradeAreaStore();

  if (!deal) return null;

  const dealName    = deal.name;
  const dealAddress = deal.address || deal.location;

  return (
    <div style={{
      height: 36,
      background: 'rgba(245, 166, 35, 0.08)',
      borderBottom: `1px solid ${T.text.amber}22`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 16,
      flexShrink: 0,
      fontFamily: T.font.mono,
      fontSize: T.fontSize.sm,
      overflow: 'hidden',
    }}>
      {/* Deal name + address */}
      <span style={{ color: T.text.amber, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, minWidth: 0 }}>
        📍
        {dealName && (
          <span style={{ color: T.text.primary, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
            {dealName}
          </span>
        )}
        {dealName && dealAddress && (
          <span style={{ color: T.text.muted, fontWeight: 400 }}>·</span>
        )}
        {dealAddress && (
          <span style={{ color: T.text.secondary, fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: dealName ? 180 : 280 }}>
            {dealAddress}
          </span>
        )}
        {!dealName && !dealAddress && (
          <span style={{ color: T.text.primary }}>Deal</span>
        )}
      </span>
      {deal.jedi_score != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ color: T.text.amber, fontWeight: 700 }}>JEDI {deal.jedi_score}</span>
          {deal.delta_30d != null && (
            <span style={{
              color: deal.delta_30d >= 0 ? T.text.green : T.text.red,
              fontWeight: 600,
            }}>
              {deal.delta_30d >= 0 ? '▲' : '▼'}{deal.delta_30d >= 0 ? '+' : ''}{deal.delta_30d}
            </span>
          )}
        </span>
      )}
      {deal.pipeline_stage && (
        <Badge label={deal.pipeline_stage.toUpperCase()} color={T.text.cyan} />
      )}
      {deal.recommended_strategy && (
        <Badge label={deal.recommended_strategy.toUpperCase()} color={T.text.purple} />
      )}

      {/* Geographic scope tabs — right-aligned in this bar */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <GeographicScopeTabs
          activeScope={activeScope}
          onChange={setScope}
          tradeAreaEnabled={!!activeTradeArea}
          onDefineTradeArea={() => window.dispatchEvent(new CustomEvent('open-trade-area-panel'))}
          stats={geographicStats as any}
          compact
        />
      </div>
    </div>
  );
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: T.text.red,
  high: T.text.orange,
  medium: T.text.amber,
  low: T.text.green,
};

const BOTTOM_TABS = [
  { id: 'alerts' as const, label: 'ALERTS', color: T.text.red    },
  { id: 'news'   as const, label: 'NEWS',   color: T.text.cyan   },
  { id: 'email'  as const, label: 'EMAIL',  color: T.text.orange },
  { id: 'agents' as const, label: 'AGENTS', color: T.text.green  },
  { id: 'tasks'  as const, label: 'TASKS',  color: T.text.amber  },
] as const;
type BottomTabId = typeof BOTTOM_TABS[number]['id'];

const TASK_PRIORITY_COLORS: Record<string, string> = {
  critical: T.text.red, high: T.text.orange, medium: T.text.amber, low: T.text.green,
};

const BottomPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTabId>('alerts');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [email, setEmail] = useState<EmailItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [alertRes, newsRes, agentRes, emailRes, taskRes] = await Promise.allSettled([
        api.get('/jedi/alerts'),
        api.get('/news/feed'),
        api.get('/agent-status'),
        api.get('/email/inbox'),
        api.get('/tasks'),
      ]);
      if (alertRes.status === 'fulfilled') {
        const ad = alertRes.value.data;
        const raw = ad?.data?.alerts || ad?.alerts || ad?.data;
        setAlerts(Array.isArray(raw) ? raw : []);
      }
      if (newsRes.status === 'fulfilled') {
        const nd = newsRes.value.data;
        const raw = nd?.data?.articles || nd?.articles || nd?.data;
        setNews(Array.isArray(raw) ? raw : []);
      }
      if (agentRes.status === 'fulfilled') {
        const gd = agentRes.value.data;
        const raw = gd?.data?.agents || gd?.agents || gd?.data;
        setAgents(Array.isArray(raw) ? raw : []);
      }
      if (emailRes.status === 'fulfilled') {
        const ed = emailRes.value.data;
        const raw = ed?.data?.emails || ed?.emails || ed?.data;
        setEmail(Array.isArray(raw) ? raw : []);
      }
      if (taskRes.status === 'fulfilled') {
        const td = taskRes.value.data;
        const raw = td?.data?.tasks || td?.tasks || td?.data;
        setTasks(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      console.warn('[BottomPanel] Failed to fetch panel data', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const counts: Record<BottomTabId, number> = {
    alerts: alerts.length,
    news:   news.length,
    email:  email.length,
    agents: agents.length,
    tasks:  tasks.length,
  };

  return (
    <div style={{
      height: collapsed ? 28 : 180,
      background: T.bg.panel,
      borderTop: `1px solid ${T.border.medium}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'height 0.18s ease',
      fontFamily: T.font.mono,
    }}>
      <div style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 0,
        borderBottom: collapsed ? 'none' : `1px solid ${T.border.subtle}`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            border: 'none',
            background: 'transparent',
            color: T.text.muted,
            cursor: 'pointer',
            fontSize: '9px',
            fontFamily: T.font.mono,
            padding: '2px 8px 2px 2px',
            letterSpacing: 0.5,
          }}
        >
          {collapsed ? '▲' : '▼'}
        </button>
        {BOTTOM_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (collapsed) setCollapsed(false); }}
            style={{
              height: '100%',
              padding: '0 12px',
              border: 'none',
              borderBottom: activeTab === tab.id && !collapsed ? `2px solid ${tab.color}` : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id && !collapsed ? tab.color : T.text.muted,
              fontSize: T.fontSize.xs,
              fontFamily: T.font.mono,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.label}
            {counts[tab.id] > 0 && (
              <span style={{
                fontSize: '7px',
                background: `${tab.color}22`,
                color: tab.color,
                padding: '1px 4px',
                borderRadius: 3,
                fontWeight: 600,
              }}>{counts[tab.id]}</span>
            )}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {activeTab === 'alerts' && (
            <div>
              {alerts.length === 0 && (
                <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: 12, textAlign: 'center' }}>No alerts</div>
              )}
              {alerts.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px',
                  borderLeft: `3px solid ${SEVERITY_COLORS[a.severity] || T.text.muted}`,
                  marginBottom: 2, fontSize: T.fontSize.sm,
                  background: T.bg.panelAlt, borderRadius: '0 3px 3px 0',
                }}>
                  <Badge label={a.type?.toUpperCase() || 'ALERT'} color={SEVERITY_COLORS[a.severity] || T.text.amber} />
                  {a.deal_name && <span style={{ color: T.text.amber, fontWeight: 600 }}>{a.deal_name}</span>}
                  <span style={{ color: T.text.primary, flex: 1 }}>{a.message}</span>
                  <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, flexShrink: 0 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleTimeString('en-GB', { hour12: false }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'news' && (
            <div>
              {news.length === 0 && (
                <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: 12, textAlign: 'center' }}>No news</div>
              )}
              {news.map(n => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px',
                  marginBottom: 2, fontSize: T.fontSize.sm,
                  background: T.bg.panelAlt, borderRadius: 3,
                }}>
                  <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, flexShrink: 0, width: 50 }}>
                    {n.published_at ? new Date(n.published_at).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <span style={{ color: T.text.primary, flex: 1 }}>{n.headline}</span>
                  {n.impact && <Badge label={n.impact} color={T.text.cyan} />}
                  {n.jedi_delta != null && (
                    <span style={{ color: n.jedi_delta >= 0 ? T.text.green : T.text.red, fontWeight: 600, fontSize: T.fontSize.xs }}>
                      {n.jedi_delta >= 0 ? '+' : ''}{n.jedi_delta} pts
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'email' && (
            <div>
              {email.length === 0 && (
                <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: 12, textAlign: 'center' }}>No emails</div>
              )}
              {email.map(e => (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px',
                  marginBottom: 2, fontSize: T.fontSize.sm,
                  background: T.bg.panelAlt, borderRadius: 3,
                  borderLeft: `3px solid ${e.read ? T.border.subtle : T.text.orange}`,
                }}>
                  {!e.read && <span style={{ color: T.text.orange, fontSize: '7px', fontWeight: 700 }}>●</span>}
                  <span style={{ color: T.text.cyan, fontSize: T.fontSize.xs, flexShrink: 0, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.from || '—'}
                  </span>
                  <span style={{ color: T.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</span>
                  {e.preview && <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{e.preview}</span>}
                  <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, flexShrink: 0 }}>
                    {e.received_at ? new Date(e.received_at).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'agents' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {agents.length === 0 && (
                <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: 12, textAlign: 'center', gridColumn: '1/-1' }}>No agents</div>
              )}
              {agents.map(ag => (
                <div key={ag.id} style={{
                  background: T.bg.panelAlt, borderRadius: 4, padding: '6px 8px',
                  borderLeft: `3px solid ${ag.status === 'online' ? T.text.green : T.text.muted}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ color: T.text.purple, fontWeight: 700, fontSize: T.fontSize.xs }}>{ag.code}</span>
                    <span style={{ color: T.text.primary, fontSize: T.fontSize.sm, fontWeight: 600 }}>{ag.name}</span>
                  </div>
                  {ag.last_action && (
                    <div style={{ color: T.text.secondary, fontSize: T.fontSize.xs }}>{ag.last_action}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ color: T.text.muted, fontSize: '7px' }}>{ag.last_active || ''}</span>
                    {ag.message_count != null && (
                      <span style={{ color: T.text.muted, fontSize: '7px' }}>{ag.message_count} msgs</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'tasks' && (
            <div>
              {tasks.length === 0 && (
                <div style={{ color: T.text.muted, fontSize: T.fontSize.sm, padding: 12, textAlign: 'center' }}>No tasks</div>
              )}
              {tasks.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px',
                  marginBottom: 2, fontSize: T.fontSize.sm,
                  background: T.bg.panelAlt, borderRadius: 3,
                  borderLeft: `3px solid ${TASK_PRIORITY_COLORS[t.priority || ''] || T.text.muted}`,
                }}>
                  {t.priority && <Badge label={t.priority.toUpperCase()} color={TASK_PRIORITY_COLORS[t.priority] || T.text.amber} />}
                  <span style={{ color: T.text.primary, flex: 1 }}>{t.title}</span>
                  {t.assigned_to && <span style={{ color: T.text.cyan, fontSize: T.fontSize.xs }}>{t.assigned_to}</span>}
                  {t.status && <Badge label={t.status.toUpperCase()} color={T.text.muted} />}
                  {t.due_date && (
                    <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, flexShrink: 0 }}>
                      {new Date(t.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

  const isInsideDeal = location.pathname.startsWith('/deals/');
  const dealIdMatch = isInsideDeal ? location.pathname.match(/\/deals\/([^/]+)/) : null;
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

      <TickerBar height={20} speed={55} label="NEWS" labelColor={T.text.cyan}
        items={newsTickerItems.map(n => {
          const impactColor = n.impact?.includes('DEMAND') ? T.text.green : n.impact?.includes('SUPPLY') || n.impact?.includes('RISK') ? T.text.red : T.text.amber;
          return { raw: `[${n.time}]  ${n.hl}`, color: T.text.primary, sub: `${n.impact}  ${n.pts}pts`, subColor: impactColor };
        })}
      />
      <TickerBar height={20} speed={45} label="MKTDATA" labelColor={T.text.green}
        items={MKTDATA_TICKERS.map(t => ({ raw: t, color: t.startsWith('^') ? T.text.green : t.startsWith('v') ? T.text.red : T.text.amber }))}
      />
      <TickerBar height={20} speed={28} label="METRICS" labelColor={T.text.amber}
        items={metricsTicker}
      />

      {!isInsideDeal && <FKeyNavBar activePath={location.pathname} onNavigate={navigate} isInsideDeal={false} />}

      {isInsideDeal && <DealContextBar deal={dealContext} />}

      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Outlet context={{ layers, setLayers }} />
      </main>

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
