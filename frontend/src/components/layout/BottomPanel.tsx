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

const BOTTOM_TABS = [
  { id: 'alerts' as const, label: 'ALERTS', color: T.text.red },
  { id: 'news' as const, label: 'NEWS', color: T.text.green },
  { id: 'email' as const, label: 'EMAIL', color: T.text.orange },
  { id: 'tasks' as const, label: 'TASKS', color: T.text.amber },
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
              fontSize: '9px',
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
          </div>
        )}
      </div>
    </>
  );
};

export default BottomPanel;
