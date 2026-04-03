/**
 * Agent Bar - Compact agent selector for 18 agents
 * 
 * Features:
 * - Scrollable row of agent icons
 * - Core agents always visible
 * - Analyst agents in expandable section
 * - Click to open chat drawer
 * 
 * @version 3.0.0
 * @date 2026-03-28
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  X, Send, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Settings,
  Brain, Target, LineChart, Calculator, Megaphone, Hammer, Scale, Landmark,
  Handshake, Building, Home, Key, Wrench, TrendingUp, Leaf, ShieldCheck,
  Receipt, Search, Users
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';
import { agentBus, AgentCode } from '../../services/agentBus';
import { useAgents, useAgentChat } from '../../hooks/useAgentBus';
import { 
  getAgentByCode, 
  AGENT_SUGGESTED_PROMPTS, 
  AGENT_INTRO_MESSAGES, 
  AgentDefinition,
} from '../../services/agentRegistry';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string; className?: string }>> = {
  Brain, Target, LineChart, Calculator, Megaphone, Hammer, Scale, Landmark,
  Handshake, Building, Home, Key, Wrench, TrendingUp, Leaf, ShieldCheck,
  Receipt, Search, Users,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Users;
}

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
  const IconComponent = agent ? getIconComponent(agent.icon) : Brain;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!dealId) { setDealContext(null); return; }
    api.get(`/deals/${dealId}`)
      .then(res => {
        const deal = res.data?.deal || res.data?.data;
        if (deal) {
          setDealContext({ name: deal.name || deal.address_line1, jediScore: deal.jedi_score?.totalScore || deal.jedi_score });
        }
      })
      .catch(() => setDealContext(null));
  }, [dealId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    setIsThinking(true);
    sendMessage(text);

    try {
      const response = await api.post('/agents/chat', { agentCode, message: text, dealId });
      if (response.data?.success) {
        agentBus.send({
          from: agentCode,
          to: 'ORCHESTRATOR',
          type: 'response',
          topic: 'chat',
          payload: { text: response.data.data.message, fromUser: false },
          priority: 'normal',
        });
      }
    } catch (error: any) {
      agentBus.send({
        from: agentCode,
        to: 'ORCHESTRATOR',
        type: 'response',
        topic: 'chat',
        payload: { text: `Error: ${error.message}`, fromUser: false, isError: true },
        priority: 'normal',
      });
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      bottom: 0,
      width: 400,
      background: T.bg.panel,
      borderLeft: `2px solid ${agent?.color}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      fontFamily: T.font.mono,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: `linear-gradient(135deg, ${agent?.color}15, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: `${agent?.color}20`,
            border: `2px solid ${agent?.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconComponent size={20} color={agent?.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text.primary, fontWeight: 700, fontSize: 14 }}>
              {agent?.code} · {agent?.name}
            </div>
            <div style={{ color: agent?.color, fontSize: 10, fontWeight: 600 }}>
              {agent?.focus}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {dealContext && (
          <div style={{ marginTop: 8, padding: '4px 8px', background: `${T.text.amber}15`, borderRadius: 4, fontSize: 10, color: T.text.amber }}>
            📍 {dealContext.name} {dealContext.jediScore && `• JEDI ${dealContext.jediScore}`}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <div style={{ padding: '10px 12px', background: `${agent?.color}10`, borderLeft: `3px solid ${agent?.color}`, borderRadius: '0 6px 6px 0', marginBottom: 12, fontSize: 12, color: T.text.secondary }}>
          {AGENT_INTRO_MESSAGES[agentCode]}
        </div>
        {messages.filter(m => m.topic === 'chat').map(msg => {
          const isUser = (msg.payload as any)?.fromUser;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '80%',
                padding: '8px 12px',
                background: isUser ? agent?.color : T.bg.panelAlt,
                color: isUser ? '#000' : T.text.primary,
                borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                fontSize: 12,
              }}>
                {(msg.payload as any)?.text}
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div style={{ padding: '8px 12px', background: T.bg.panelAlt, borderRadius: 12, width: 'fit-content', fontSize: 12, color: T.text.muted }}>
            Analyzing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Prompts */}
      {messages.filter(m => m.topic === 'chat').length === 0 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {suggestedPrompts.slice(0, 4).map((prompt, i) => (
            <button key={i} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              style={{ padding: '5px 10px', background: T.bg.panelAlt, border: `1px solid ${T.border.subtle}`, borderRadius: 4, color: T.text.secondary, fontSize: 10, cursor: 'pointer' }}>
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, borderTop: `1px solid ${T.border.subtle}`, display: 'flex', gap: 8 }}>
        <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`Ask ${agent?.shortName}...`}
          style={{ flex: 1, padding: '10px 12px', background: T.bg.terminal, border: `1px solid ${T.border.subtle}`, borderRadius: 6, color: T.text.primary, fontSize: 12, fontFamily: T.font.mono, outline: 'none' }} />
        <button onClick={handleSend} disabled={!input.trim()}
          style={{ padding: '10px 14px', background: input.trim() ? agent?.color : T.bg.panelAlt, border: 'none', borderRadius: 6, color: input.trim() ? '#000' : T.text.muted, cursor: input.trim() ? 'pointer' : 'not-allowed' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Agent Chip
// ============================================================================

interface AgentChipProps {
  agent: AgentDefinition & { status: { status: string } };
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

const AgentChip: React.FC<AgentChipProps> = ({ agent, isActive, onClick, compact }) => {
  const [hover, setHover] = useState(false);
  const IconComponent = getIconComponent(agent.icon);
  const isOnline = agent.status.status === 'online' || agent.status.status === 'busy';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${agent.code}: ${agent.name} - ${agent.focus}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '4px 8px' : '6px 10px',
        borderRadius: 6,
        border: isActive ? `2px solid ${agent.color}` : `1px solid ${T.border.subtle}`,
        background: isActive ? `${agent.color}20` : hover ? `${agent.color}10` : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ position: 'relative' }}>
        <IconComponent size={compact ? 14 : 16} color={isActive || hover ? agent.color : T.text.muted} />
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isOnline ? '#22c55e' : '#6b7280',
          border: `1px solid ${T.bg.panel}`,
        }} />
      </div>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: isActive || hover ? agent.color : T.text.secondary }}>
        {agent.code}
      </span>
    </button>
  );
};

// ============================================================================
// Main Agent Bar
// ============================================================================

function useDealContext() {
  const location = useLocation();
  const match = location.pathname.match(/\/deals\/([a-f0-9-]+)/i);
  return match ? match[1] : undefined;
}

export const AgentBar: React.FC = () => {
  const [selectedAgent, setSelectedAgent] = useState<AgentCode | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showAnalysts, setShowAnalysts] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const agents = useAgents();
  const navigate = useNavigate();
  const dealId = useDealContext();

  const coreAgents = agents.filter(a => a.category === 'core');
  const analystAgents = agents.filter(a => a.category === 'analyst');
  const onlineCount = agents.filter(a => a.status.status === 'online' || a.status.status === 'busy').length;

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatSending) return;
    const text = chatInput.trim();
    setChatInput('');
    setChatSending(true);
    const target: AgentCode = selectedAgent || 'OPUS';
    agentBus.send({ from: 'USER' as any, to: target, type: 'request', topic: 'chat', payload: { text, fromUser: true }, priority: 'normal' });
    try {
      const response = await api.post('/agents/chat', { agentCode: target, message: text, dealId });
      if (response.data?.success) {
        agentBus.send({ from: target, to: 'ORCHESTRATOR', type: 'response', topic: 'chat', payload: { text: response.data.data.message, fromUser: false }, priority: 'normal' });
      }
    } catch (error: any) {
      agentBus.send({ from: target, to: 'ORCHESTRATOR', type: 'response', topic: 'chat', payload: { text: `Error: ${error.message}`, fromUser: false, isError: true }, priority: 'normal' });
    } finally {
      setChatSending(false);
      if (!selectedAgent) setSelectedAgent('OPUS');
    }
  };

  const activeAgentDef = selectedAgent ? getAgentByCode(selectedAgent) : null;

  return (
    <>
      <div style={{
        background: T.bg.panel,
        borderTop: `1px solid ${T.border.medium}`,
        fontFamily: T.font.mono,
        flexShrink: 0,
      }}>
        {expanded && (
          <div style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: `1px solid ${T.border.subtle}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: T.text.cyan, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>AGENTS</span>
              <span style={{ fontSize: 9, padding: '1px 5px', background: `${T.text.green}20`, color: T.text.green, borderRadius: 3 }}>
                {onlineCount}/{agents.length}
              </span>
            </div>

            <div style={{ width: 1, height: 14, background: T.border.subtle }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {coreAgents.map(agent => (
                <AgentChip
                  key={agent.code}
                  agent={agent}
                  isActive={selectedAgent === agent.code}
                  onClick={() => setSelectedAgent(selectedAgent === agent.code ? null : agent.code)}
                  compact
                />
              ))}
            </div>

            <div style={{ width: 1, height: 14, background: T.border.subtle }} />

            <button
              onClick={() => setShowAnalysts(!showAnalysts)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px',
                background: showAnalysts ? `${T.text.amber}15` : 'transparent',
                border: `1px solid ${showAnalysts ? T.text.amber + '55' : T.border.subtle}`,
                borderRadius: 4,
                color: showAnalysts ? T.text.amber : T.text.muted,
                cursor: 'pointer', fontSize: 9, fontWeight: 600,
              }}
            >
              <Users size={10} />
              16 ANALYSTS
              {showAnalysts ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => navigate('/terminal/settings?tab=agents')}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '3px 7px', background: 'transparent',
                border: `1px solid ${T.border.subtle}`, borderRadius: 3,
                color: T.text.muted, cursor: 'pointer', fontSize: 9,
              }}
            >
              <Settings size={10} />
              AI
            </button>
          </div>
        )}

        {expanded && showAnalysts && (
          <div style={{
            padding: '5px 12px',
            borderBottom: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <button onClick={() => scroll('left')} style={{ background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 2 }}>
              <ChevronLeft size={12} />
            </button>
            <div ref={scrollRef} style={{
              flex: 1, display: 'flex', gap: 4,
              overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
            }}>
              {analystAgents.map(agent => (
                <AgentChip key={agent.code} agent={agent} isActive={selectedAgent === agent.code}
                  onClick={() => setSelectedAgent(selectedAgent === agent.code ? null : agent.code)} compact />
              ))}
            </div>
            <button onClick={() => scroll('right')} style={{ background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 2 }}>
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        {/* ── OPUS CHAT INPUT BAR ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
        }}>
          <button onClick={() => setExpanded(!expanded)} style={{
            background: 'transparent', border: 'none', color: T.text.muted, cursor: 'pointer', padding: 2, flexShrink: 0,
          }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <Brain size={14} color={activeAgentDef?.color || '#8B5CF6'} />
            <span style={{ fontSize: 10, fontWeight: 700, color: activeAgentDef?.color || '#8B5CF6', letterSpacing: 0.5 }}>
              {activeAgentDef?.name || 'OPUS'}
            </span>
          </div>

          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            background: T.bg.input || '#0D1117',
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 4, padding: '0 8px', height: 28,
          }}>
            <span style={{ color: T.text.amber, fontSize: 11, fontWeight: 700, marginRight: 6, flexShrink: 0 }}>{'>'}</span>
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleChatSend(); }}
              placeholder={dealId ? 'Ask Opus about this deal...' : 'Ask Opus anything...'}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: T.font.mono, fontSize: 11, color: T.text.primary,
                minWidth: 0,
              }}
            />
            {chatSending && (
              <span style={{ fontSize: 9, color: T.text.amber, marginRight: 6, animation: 'pulse 1.5s infinite' }}>THINKING...</span>
            )}
            <span style={{
              width: 5, height: 12, background: T.text.amber,
              animation: 'blink 1s infinite', display: 'inline-block', flexShrink: 0,
            }} />
          </div>

          <button
            onClick={handleChatSend}
            disabled={chatSending || !chatInput.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, flexShrink: 0,
              background: chatInput.trim() ? T.text.amber : 'transparent',
              color: chatInput.trim() ? '#0A0E17' : T.text.muted,
              border: chatInput.trim() ? 'none' : `1px solid ${T.border.subtle}`,
              borderRadius: 4, cursor: chatInput.trim() ? 'pointer' : 'default',
            }}
          >
            <Send size={12} />
          </button>
        </div>
      </div>

      {selectedAgent && (
        <AgentChatDrawer
          agentCode={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          dealId={dealId}
        />
      )}

      <style>{`
        div::-webkit-scrollbar { display: none; }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </>
  );
};

export default AgentBar;
