/**
 * Bottom Panel - Agents, Alerts, News, Email, Tasks
 * 
 * Features:
 * - Tabbed interface with badges
 * - Clickable agents open chat panel
 * - Real-time message feed
 * - Agent status indicators
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, MessageSquare, ChevronRight } from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import { Badge } from '../terminal/Badge';
import api from '../../lib/api';
import { useAgents, useAgentChat, useAgentMessages } from '../../hooks/useAgentBus';
import { agentBus, AgentCode, AgentMessage } from '../../services/agentBus';
import { getAgentByCode, AGENT_SUGGESTED_PROMPTS, AGENT_INTRO_MESSAGES } from '../../services/agentRegistry';

// Helper to extract deal ID from URL
function useDealContext() {
  const location = useLocation();
  const match = location.pathname.match(/\/deals\/([a-f0-9-]+)/i);
  return match ? match[1] : undefined;
}

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: T.text.red,
  high: T.text.orange,
  medium: T.text.amber,
  low: T.text.green,
};

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

interface WinState {
  x: number; y: number; w: number; h: number;
  minimized: boolean; maximized?: boolean; zIndex: number;
}

const BOTTOM_TABS = [
  { id: 'alerts' as const, label: 'ALERTS', color: T.text.red },
  { id: 'news' as const, label: 'NEWS', color: T.text.green },
  { id: 'email' as const, label: 'EMAIL', color: T.text.orange },
  { id: 'tasks' as const, label: 'TASKS', color: T.text.amber },
  { id: 'media' as const, label: 'MEDIA', color: '#FF8C42' },
] as const;

type BottomTabId = typeof BOTTOM_TABS[number]['id'];

// ============================================================================
// Agent Chat Drawer
// ============================================================================

interface AgentChatDrawerProps {
  agentCode: AgentCode;
  onClose: () => void;
  dealId?: string;
}

const AgentChatDrawer: React.FC<AgentChatDrawerProps> = ({ agentCode, onClose, dealId }) => {
  const agent = getAgentByCode(agentCode);
  const { messages, sendMessage } = useAgentChat(agentCode);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [dealContext, setDealContext] = useState<{ name?: string; jediScore?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestedPrompts = AGENT_SUGGESTED_PROMPTS[agentCode] || [];

  // Load deal context if dealId provided
  useEffect(() => {
    if (!dealId) {
      setDealContext(null);
      return;
    }
    
    api.get(`/deals/${dealId}`)
      .then(res => {
        const deal = res.data?.deal || res.data?.data;
        if (deal) {
          setDealContext({
            name: deal.name || deal.address_line1,
            jediScore: deal.jedi_score?.totalScore || deal.jedi_score,
          });
        }
      })
      .catch(() => setDealContext(null));
  }, [dealId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const text = input.trim();
    setInput('');
    setIsThinking(true);

    // Send user message to local bus
    sendMessage(text);

    try {
      // Call real API with deal context
      const response = await api.post('/agents/chat', {
        agentCode,
        message: text,
        dealId,
      });

      if (response.data?.success) {
        const agentResponse = response.data.data;
        agentBus.send({
          from: agentCode,
          to: 'ORCHESTRATOR',
          type: 'response',
          topic: 'chat',
          payload: { 
            text: agentResponse.message,
            fromUser: false,
            data: agentResponse.data,
            suggestedFollowups: agentResponse.suggestedFollowups,
          },
          priority: 'normal',
        });
      } else {
        throw new Error(response.data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Agent chat error:', error);
      agentBus.send({
        from: agentCode,
        to: 'ORCHESTRATOR',
        type: 'response',
        topic: 'chat',
        payload: { 
          text: `Sorry, I encountered an error: ${error.message || 'Unable to process your request'}. Please try again.`,
          fromUser: false,
          isError: true,
        },
        priority: 'normal',
      });
    } finally {
      setIsThinking(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: 420,
      background: T.bg.panel,
      borderLeft: `1px solid ${T.border.medium}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      fontFamily: T.font.mono,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${T.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: T.bg.topBar,
      }}>
        <span style={{ fontSize: 24 }}>{agent?.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.text.primary, fontWeight: 700, fontSize: T.fontSize.md }}>
            {agent?.name}
          </div>
          <div style={{ color: T.text.muted, fontSize: T.fontSize.xs }}>
            {agent?.description}
          </div>
          {dealContext && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              marginTop: 4,
              padding: '3px 8px',
              background: `${T.text.amber}15`,
              borderRadius: 4,
              width: 'fit-content',
            }}>
              <span style={{ fontSize: '10px', color: T.text.amber }}>📍</span>
              <span style={{ fontSize: T.fontSize.xs, color: T.text.amber, fontWeight: 600 }}>
                {dealContext.name}
              </span>
              {dealContext.jediScore && (
                <span style={{ fontSize: '9px', color: T.text.muted }}>
                  JEDI {dealContext.jediScore}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.text.muted,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Intro message */}
        <div style={{
          padding: '10px 14px',
          background: `${agent?.color}15`,
          borderLeft: `3px solid ${agent?.color}`,
          borderRadius: '0 6px 6px 0',
          color: T.text.primary,
          fontSize: T.fontSize.sm,
        }}>
          {AGENT_INTRO_MESSAGES[agentCode]}
        </div>

        {/* Chat messages */}
        {messages.filter(m => m.topic === 'chat').map(msg => {
          const isUser = (msg.payload as any)?.fromUser;
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                background: isUser ? T.text.cyan : T.bg.panelAlt,
                color: isUser ? '#000' : T.text.primary,
                borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                fontSize: T.fontSize.sm,
              }}
            >
              {(msg.payload as any)?.text}
            </div>
          );
        })}

        {isThinking && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 12px',
            background: T.bg.panelAlt,
            borderRadius: '12px 12px 12px 4px',
            color: T.text.muted,
            fontSize: T.fontSize.sm,
          }}>
            <span style={{ animation: 'pulse 1s infinite' }}>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.filter(m => m.topic === 'chat').length === 0 && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          {suggestedPrompts.slice(0, 4).map((prompt, i) => (
            <button
              key={i}
              onClick={() => handlePromptClick(prompt)}
              style={{
                padding: '6px 10px',
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 4,
                color: T.text.secondary,
                fontSize: T.fontSize.xs,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = agent?.color || T.text.cyan;
                e.currentTarget.style.color = T.text.primary;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = T.border.subtle;
                e.currentTarget.style.color = T.text.secondary;
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: `1px solid ${T.border.subtle}`,
        display: 'flex',
        gap: 8,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`Ask ${agent?.shortName}...`}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: T.bg.terminal,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 6,
            color: T.text.primary,
            fontSize: T.fontSize.sm,
            fontFamily: T.font.mono,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            padding: '10px 16px',
            background: input.trim() ? agent?.color : T.bg.panelAlt,
            border: 'none',
            borderRadius: 6,
            color: input.trim() ? '#000' : T.text.muted,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 600,
            fontSize: T.fontSize.sm,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Agents Tab Content
// ============================================================================

const AgentsTabContent: React.FC<{ onSelectAgent: (code: AgentCode) => void }> = ({ onSelectAgent }) => {
  const agents = useAgents();
  const recentMessages = useAgentMessages(20);

  // Filter to just chatable agents, exclude orchestrator from grid
  const displayAgents = agents.filter(a => a.canChatWithUser && a.code !== 'ORCHESTRATOR');

  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      {/* Agent Grid */}
      <div style={{
        flex: '0 0 55%',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
        alignContent: 'start',
      }}>
        {displayAgents.map(agent => {
          const isOnline = agent.status.status === 'online' || agent.status.status === 'busy';
          const lastMsg = recentMessages.find(m => m.from === agent.code);
          
          return (
            <button
              key={agent.code}
              onClick={() => onSelectAgent(agent.code)}
              style={{
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderLeft: `3px solid ${agent.color}`,
                borderRadius: '0 4px 4px 0',
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = agent.color;
                e.currentTarget.style.background = `${agent.color}10`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = T.border.subtle;
                e.currentTarget.style.background = T.bg.panelAlt;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{agent.emoji}</span>
                <span style={{ 
                  color: T.text.primary, 
                  fontWeight: 600, 
                  fontSize: T.fontSize.xs,
                  flex: 1,
                }}>
                  {agent.shortName}
                </span>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isOnline ? T.text.green : T.text.muted,
                }} />
              </div>
              {lastMsg && (
                <div style={{
                  color: T.text.muted,
                  fontSize: '9px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {(lastMsg.payload as any)?.text?.slice(0, 30) || lastMsg.topic}
                </div>
              )}
              {agent.status.currentTask && (
                <div style={{
                  color: agent.color,
                  fontSize: '9px',
                  marginTop: 2,
                }}>
                  {agent.status.currentTask}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Message Feed */}
      <div style={{
        flex: 1,
        borderLeft: `1px solid ${T.border.subtle}`,
        paddingLeft: 12,
        overflowY: 'auto',
      }}>
        <div style={{
          fontSize: T.fontSize.xs,
          color: T.text.muted,
          marginBottom: 6,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}>
          AGENT ACTIVITY
        </div>
        {recentMessages.slice(-10).reverse().map(msg => {
          const agent = getAgentByCode(msg.from);
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: 6,
                padding: '4px 0',
                borderBottom: `1px solid ${T.border.subtle}`,
                fontSize: T.fontSize.xs,
              }}
            >
              <span style={{ color: agent?.color }}>{agent?.emoji}</span>
              <span style={{ color: T.text.muted, width: 50, flexShrink: 0 }}>
                {msg.from}
              </span>
              <span style={{ color: T.text.secondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.topic}: {typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload).slice(0, 40)}
              </span>
            </div>
          );
        })}
        {recentMessages.length === 0 && (
          <div style={{ color: T.text.muted, fontSize: T.fontSize.xs, padding: 8, textAlign: 'center' }}>
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Bottom Panel
// ============================================================================

export const BottomPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTabId>('alerts');
  
  // Data state
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [email, setEmail] = useState<EmailItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Media state
  const [mediaWindows, setMediaWindows] = useState<MediaWindow[]>([]);
  const [mediaWinStates, setMediaWinStates] = useState<Record<string, WinState>>({});
  const [mediaDragInfo, setMediaDragInfo] = useState<{id:string,ox:number,oy:number,mode:"move"|"resize"}|null>(null);
  const [mediaTopZ, setMediaTopZ] = useState(100);
  const [rssCache, setRssCache] = useState<Record<string, {items:{title:string,link:string,pubDate?:string,source?:string}[]}>>({});

  const openMediaWindow = useCallback((win: MediaWindow) => {
    setMediaWindows(prev => {
      if (prev.some(w => w.id === win.id)) {
        const nz = mediaTopZ + 1; setMediaTopZ(nz);
        setMediaWinStates(ps => ({ ...ps, [win.id]: { ...ps[win.id], minimized: false, zIndex: nz } }));
        return prev;
      }
      const idx = prev.length;
      const nz = mediaTopZ + 1; setMediaTopZ(nz);
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
      const cur = prev[id];
      return { ...prev, [id]: { ...cur, maximized: !cur?.maximized } };
    });
  }, []);

  const bringMediaToFront = useCallback((id: string) => {
    const nz = mediaTopZ + 1; setMediaTopZ(nz);
    setMediaWinStates(prev => ({ ...prev, [id]: { ...prev[id], zIndex: nz } }));
  }, [mediaTopZ]);

  const fetchRss = useCallback((rssUrl: string) => {
    fetch(`/api/media/rss?url=${encodeURIComponent(rssUrl)}`)
      .then(r => r.json())
      .then((data: any) => {
        const items = data?.items || data?.data?.items || [];
        setRssCache(prev => ({ ...prev, [rssUrl]: { items } }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mediaDragInfo) return;
    const onMove = (e: MouseEvent) => {
      setMediaWinStates(prev => {
        const cur = prev[mediaDragInfo.id];
        if (!cur) return prev;
        if (mediaDragInfo.mode === "move") return { ...prev, [mediaDragInfo.id]: { ...cur, x: e.clientX - mediaDragInfo.ox, y: e.clientY - mediaDragInfo.oy, maximized: false } };
        return { ...prev, [mediaDragInfo.id]: { ...cur, w: Math.max(320, e.clientX - cur.x), h: Math.max(200, e.clientY - cur.y), maximized: false } };
      });
    };
    const onUp = () => setMediaDragInfo(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [mediaDragInfo]);

  const fetchData = useCallback(async () => {
    try {
      const [alertRes, newsRes, emailRes, taskRes] = await Promise.allSettled([
        api.get('/jedi/alerts'),
        api.get('/news/feed'),
        api.get('/inbox'),
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
      console.warn('[BottomPanel] Failed to fetch data', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const counts: Record<BottomTabId, number> = {
    alerts: alerts.length,
    news: news.length,
    email: email.filter(e => !e.read).length,
    tasks: tasks.length,
    media: mediaWindows.length,
  };

  const renderMediaWindowContent = (win: MediaWindow) => {
    if (win.type === "tv") {
      return <iframe src={win.url} style={{width:"100%",height:"100%",border:"none"}} allow="autoplay; encrypted-media" allowFullScreen/>;
    }
    if (win.type === "rss") {
      const items = rssCache[win.rssUrl||""]?.items || [];
      return (
        <div style={{flex:1,overflow:"auto",padding:0}}>
          {items.length === 0 && <div style={{padding:20,textAlign:"center"}}><div style={{fontSize:10,color:T.text.muted,animation:"pulse 1.5s infinite"}}>Loading feed...</div></div>}
          {items.map((item, i) => (
            <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
              style={{display:"block",padding:"6px 10px",borderBottom:`1px solid ${T.border.subtle}`,textDecoration:"none",background:i%2===0?T.bg.panel:T.bg.panelAlt,cursor:"pointer"}}>
              <div style={{fontSize:10,fontWeight:600,color:T.text.primary,lineHeight:1.4}}>{item.title}</div>
              <div style={{fontSize:10,color:T.text.muted,marginTop:2}}>
                {item.pubDate ? new Date(item.pubDate).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""}
                {item.source && ` · ${item.source}`}
              </div>
            </a>
          ))}
          <div style={{padding:"6px 10px"}}>
            <button onClick={() => { if(win.rssUrl) { setRssCache(prev => { const ns = {...prev}; delete ns[win.rssUrl!]; return ns; }); fetchRss(win.rssUrl); } }}
              style={{fontFamily:T.font.mono,fontSize:10,color:T.text.cyan,background:"transparent",border:`1px solid ${T.text.cyan}44`,padding:"3px 10px",cursor:"pointer",width:"100%"}}>REFRESH</button>
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
          <div style={{fontSize:10,color:T.text.secondary,textAlign:"center",lineHeight:1.5}}>
            Twitter/X embeds require the platform widget script.<br/>Click below to open in a new tab.
          </div>
          <a href={twitterUrl} target="_blank" rel="noopener noreferrer"
            style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:"#1DA1F2",color:"#fff",border:"none",padding:"8px 20px",cursor:"pointer",textDecoration:"none",letterSpacing:0.3}}>OPEN ON X →</a>
        </div>
      );
    }
    return null;
  };

  return (
    <>
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
        {/* Tab Header */}
        <div style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
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
              fontSize: '10px',
              fontFamily: T.font.mono,
              padding: '2px 8px 2px 2px',
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
                fontSize: T.fontSize.base,
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
                  fontSize: '9px',
                  background: `${tab.color}22`,
                  color: tab.color,
                  padding: '1px 4px',
                  borderRadius: 2,
                  fontWeight: 600,
                }}>{counts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {!collapsed && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
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
                    <span style={{ color: T.text.muted, fontSize: T.fontSize.xs }}>
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
                    background: T.bg.panelAlt, borderRadius: 2,
                  }}>
                    <span style={{ color: T.text.muted, fontSize: T.fontSize.xs, width: 50 }}>
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
                    background: T.bg.panelAlt, borderRadius: 2,
                    borderLeft: `3px solid ${e.read ? T.border.subtle : T.text.orange}`,
                  }}>
                    {!e.read && <span style={{ color: T.text.orange, fontSize: '9px', fontWeight: 700 }}>●</span>}
                    <span style={{ color: T.text.cyan, fontSize: T.fontSize.xs, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.from || '—'}
                    </span>
                    <span style={{ color: T.text.primary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</span>
                    <span style={{ color: T.text.muted, fontSize: T.fontSize.xs }}>
                      {e.received_at ? new Date(e.received_at).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
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
                    background: T.bg.panelAlt, borderRadius: 2,
                    borderLeft: `3px solid ${SEVERITY_COLORS[t.priority || ''] || T.text.muted}`,
                  }}>
                    {t.priority && <Badge label={t.priority.toUpperCase()} color={SEVERITY_COLORS[t.priority] || T.text.amber} />}
                    <span style={{ color: T.text.primary, flex: 1 }}>{t.title}</span>
                    {t.assigned_to && <span style={{ color: T.text.cyan, fontSize: T.fontSize.xs }}>{t.assigned_to}</span>}
                    {t.status && <Badge label={t.status.toUpperCase()} color={T.text.muted} />}
                    {t.due_date && (
                      <span style={{ color: T.text.muted, fontSize: T.fontSize.xs }}>
                        {new Date(t.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'media' && (
              <div style={{display:"flex",gap:0,height:"100%"}}>
                <div style={{flex:1,borderRight:`1px solid ${T.border.subtle}`,overflow:"auto",padding:"6px 10px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>LIVE TV</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                    {TV_CHANNELS.map(ch => {
                      const isOpen = mediaWindows.some(w => w.id === `tv-${ch.id}`);
                      return (
                        <div key={ch.id} onClick={() => openMediaWindow({id:`tv-${ch.id}`,type:"tv",title:ch.label,color:ch.color,url:ch.url})}
                          style={{background:T.bg.panel,border:`1px solid ${isOpen?ch.color:T.border.subtle}`,padding:"8px 8px",cursor:"pointer",textAlign:"center",position:"relative"}}>
                          {isOpen && <span style={{position:"absolute",top:3,right:4,width:5,height:5,borderRadius:"50%",background:T.text.red,animation:"pulse 1.5s infinite"}}/>}
                          <div style={{fontSize:10,fontWeight:700,color:isOpen?ch.color:T.text.primary,letterSpacing:0.5}}>{ch.label}</div>
                          <div style={{fontSize:10,color:T.text.muted,marginTop:2}}>{isOpen?"WATCHING":"Click to open"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{flex:1,borderRight:`1px solid ${T.border.subtle}`,overflow:"auto",padding:"6px 10px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>NEWS FEEDS</div>
                  {NEWS_SOURCES.map(src => {
                    const isOpen = mediaWindows.some(w => w.id === `rss-${src.id}`);
                    return (
                      <div key={src.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:src.color,flexShrink:0,display:"inline-block"}}/>
                        <span style={{fontSize:10,fontWeight:600,color:T.text.primary,flex:1}}>{src.label}</span>
                        <button onClick={() => {openMediaWindow({id:`rss-${src.id}`,type:"rss",title:src.label,color:src.color,rssUrl:src.rss});fetchRss(src.rss);}}
                          style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:isOpen?src.color+"22":"transparent",color:isOpen?src.color:T.text.muted,border:`1px solid ${isOpen?src.color:T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>
                          {isOpen?"OPEN":"OPEN FEED"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{flex:1,overflow:"auto",padding:"6px 10px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.text.muted,letterSpacing:1,marginBottom:6}}>SOCIAL / X</div>
                  {SOCIAL_DEFAULTS.map(s => {
                    const isOpen = mediaWindows.some(w => w.id === `social-${s.id}`);
                    return (
                      <div key={s.id} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${T.border.subtle}`}}>
                        <span style={{fontSize:10,fontWeight:600,color:T.text.primary,flex:1}}>{s.label}</span>
                        <button onClick={() => openMediaWindow({id:`social-${s.id}`,type:"social",title:s.label,color:"#1DA1F2",handle:s.handle})}
                          style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,background:isOpen?"#1DA1F222":"transparent",color:isOpen?"#1DA1F2":T.text.muted,border:`1px solid ${isOpen?"#1DA1F2":T.border.subtle}`,padding:"2px 8px",cursor:"pointer"}}>
                          {isOpen?"OPEN":"OPEN"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media floating windows */}
      {mediaWindows.filter(w => !mediaWinStates[w.id]?.minimized).map(win => {
        const ws = mediaWinStates[win.id];
        if (!ws) return null;
        const isMax = ws.maximized;
        const isDragging = mediaDragInfo?.id === win.id && mediaDragInfo.mode === "move";
        return (
          <div key={win.id}
            onMouseDown={() => bringMediaToFront(win.id)}
            style={{
              position:"fixed",
              left:isMax?"5%":ws.x, top:isMax?"5%":ws.y,
              width:isMax?"90%":ws.w, height:isMax?"90%":ws.h,
              background:T.bg.panel,
              border:`1px solid ${win.color}55`,
              boxShadow:isMax?"0 16px 64px rgba(0,0,0,0.7)":"0 8px 32px rgba(0,0,0,0.5)",
              display:"flex",flexDirection:"column",
              zIndex:ws.zIndex||100,
              minWidth:320,minHeight:200,
              transition:isDragging||mediaDragInfo?.mode==="resize"?"none":"box-shadow 0.15s",
            }}>
            <div
              onMouseDown={(e) => {if(!isMax){e.preventDefault();bringMediaToFront(win.id);setMediaDragInfo({id:win.id,ox:e.clientX-ws.x,oy:e.clientY-ws.y,mode:"move"});}}}
              onDoubleClick={() => maximizeMediaWindow(win.id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 8px",background:T.bg.header,borderBottom:`1px solid ${win.color}44`,flexShrink:0,cursor:isMax?"default":isDragging?"grabbing":"grab",userSelect:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:win.color,display:"inline-block"}}/>
                <span style={{fontFamily:T.font.mono,fontSize:10,fontWeight:700,color:T.text.primary,letterSpacing:0.3}}>{win.title}</span>
                <span style={{fontSize:10,color:T.text.muted,opacity:0.6}}>{win.type.toUpperCase()}</span>
              </div>
              <div style={{display:"flex",gap:2,alignItems:"center"}}>
                <button onClick={(e) => {e.stopPropagation();minimizeMediaWindow(win.id);}} title="Minimize" style={{fontFamily:T.font.mono,fontSize:12,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>—</button>
                <button onClick={(e) => {e.stopPropagation();maximizeMediaWindow(win.id);}} title={isMax?"Restore":"Maximize"} style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>{isMax?"❐":"□"}</button>
                <button onClick={(e) => {e.stopPropagation();closeMediaWindow(win.id);}} title="Close" style={{fontFamily:T.font.mono,fontSize:10,color:T.text.muted,background:"transparent",border:"none",cursor:"pointer",padding:"0 5px",lineHeight:1}}>✕</button>
              </div>
            </div>
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
              {renderMediaWindowContent(win)}
            </div>
            {!isMax && <div onMouseDown={(e) => {e.preventDefault();e.stopPropagation();bringMediaToFront(win.id);setMediaDragInfo({id:win.id,ox:e.clientX,oy:e.clientY,mode:"resize"});}} style={{position:"absolute",bottom:0,right:0,width:14,height:14,cursor:"nwse-resize",background:`linear-gradient(135deg,transparent 40%,${T.border.medium} 40%)`,zIndex:1}}/>}
          </div>
        );
      })}

      {/* Minimized media windows bar */}
      {mediaWindows.filter(w => mediaWinStates[w.id]?.minimized).length > 0 && (
        <div style={{position:"fixed",bottom:210,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,zIndex:9996,background:T.bg.header,border:`1px solid ${T.border.medium}`,padding:"4px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.4)"}}>
          {mediaWindows.filter(w => mediaWinStates[w.id]?.minimized).map(win => (
            <button key={win.id} onClick={() => minimizeMediaWindow(win.id)} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.font.mono,fontSize:10,fontWeight:600,background:T.bg.panel,border:`1px solid ${win.color}44`,color:T.text.secondary,padding:"3px 10px",cursor:"pointer"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:win.color,display:"inline-block"}}/>
              {win.title}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default BottomPanel;
