/**
 * Agent Bar - Compact horizontal agent selector with proper icons
 * 
 * Features:
 * - Lucide icons grouped by category (Core, Analysts, Specialists)
 * - Hover to see agent name + status
 * - Click to open chat drawer
 * - Status indicator
 * 
 * @version 2.0.0
 * @date 2026-03-28
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { 
  X, Send, ChevronDown, ChevronUp, Settings,
  Brain, Target, Building2, TrendingUp, BarChart3, 
  Newspaper, ShieldAlert, Landmark, DollarSign, Map
} from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';
import { agentBus, AgentCode } from '../../services/agentBus';
import { useAgents, useAgentChat, useAgentMessages } from '../../hooks/useAgentBus';
import { 
  getAgentByCode, 
  AGENT_SUGGESTED_PROMPTS, 
  AGENT_INTRO_MESSAGES, 
  AGENT_DEFINITIONS,
  AgentDefinition,
  AgentCategory,
} from '../../services/agentRegistry';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ size?: number; color?: string }>> = {
  Brain, Target, Building2, TrendingUp, BarChart3, 
  Newspaper, ShieldAlert, Landmark, DollarSign, Map,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Brain;
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

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const text = input.trim();
    setInput('');
    setIsThinking(true);
    sendMessage(text);

    try {
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
          },
          priority: 'normal',
        });
      }
    } catch (error: any) {
      agentBus.send({
        from: agentCode,
        to: 'ORCHESTRATOR',
        type: 'response',
        topic: 'chat',
        payload: { 
          text: `Error: ${error.message || 'Unable to process request'}`,
          fromUser: false,
          isError: true,
        },
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
      width: 420,
      background: T.bg.panel,
      borderLeft: `2px solid ${agent?.color || T.border.medium}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      fontFamily: T.font.mono,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: `linear-gradient(135deg, ${agent?.color}20, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${agent?.color}25`,
            border: `2px solid ${agent?.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <IconComponent size={24} color={agent?.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ 
              color: T.text.primary, 
              fontWeight: 700, 
              fontSize: 15,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {agent?.name}
              <span style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                background: `${agent?.color}30`,
                color: agent?.color,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {agent?.category}
              </span>
            </div>
            <div style={{ color: T.text.muted, fontSize: 11, marginTop: 2 }}>
              {agent?.description}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.text.muted,
              cursor: 'pointer',
              padding: 6,
              borderRadius: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        {dealContext && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            marginTop: 10,
            padding: '5px 10px',
            background: `${T.text.amber}15`,
            borderRadius: 6,
            border: `1px solid ${T.text.amber}30`,
            width: 'fit-content',
          }}>
            <Map size={12} color={T.text.amber} />
            <span style={{ fontSize: 11, color: T.text.amber, fontWeight: 600 }}>{dealContext.name}</span>
            {dealContext.jediScore && (
              <span style={{ fontSize: 10, color: T.text.muted }}>• JEDI {dealContext.jediScore}</span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Intro */}
        <div style={{
          padding: '12px 14px',
          background: `${agent?.color}10`,
          borderLeft: `3px solid ${agent?.color}`,
          borderRadius: '0 8px 8px 0',
          marginBottom: 14,
          fontSize: 12,
          color: T.text.secondary,
          lineHeight: 1.5,
        }}>
          {AGENT_INTRO_MESSAGES[agentCode]}
        </div>

        {/* Chat messages */}
        {messages.filter(m => m.topic === 'chat').map(msg => {
          const isUser = (msg.payload as any)?.fromUser;
          const isError = (msg.payload as any)?.isError;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}
            >
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                background: isUser ? agent?.color : isError ? '#ff000020' : T.bg.panelAlt,
                color: isUser ? '#000' : isError ? '#ff6b6b' : T.text.primary,
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {(msg.payload as any)?.text}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div style={{
            padding: '10px 14px',
            background: T.bg.panelAlt,
            borderRadius: 14,
            width: 'fit-content',
            fontSize: 12,
            color: T.text.muted,
          }}>
            <span className="thinking-dots">Analyzing</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.filter(m => m.topic === 'chat').length === 0 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestedPrompts.slice(0, 4).map((prompt, i) => (
            <button
              key={i}
              onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              style={{
                padding: '6px 12px',
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 6,
                color: T.text.secondary,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = agent?.color || '';
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
        padding: 14,
        borderTop: `1px solid ${T.border.subtle}`,
        display: 'flex',
        gap: 10,
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
            padding: '12px 14px',
            background: T.bg.terminal,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 8,
            color: T.text.primary,
            fontSize: 13,
            fontFamily: T.font.mono,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            padding: '12px 16px',
            background: input.trim() ? agent?.color : T.bg.panelAlt,
            border: 'none',
            borderRadius: 8,
            color: input.trim() ? '#000' : T.text.muted,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Agent Icon Button
// ============================================================================

interface AgentIconProps {
  agent: AgentDefinition & { status: { status: string } };
  isActive: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}

const AgentIcon: React.FC<AgentIconProps> = ({ agent, isActive, onClick, size = 'md' }) => {
  const [hover, setHover] = useState(false);
  const isOnline = agent.status.status === 'online' || agent.status.status === 'busy';
  const IconComponent = getIconComponent(agent.icon);
  
  const dimensions = size === 'sm' ? 36 : 42;
  const iconSize = size === 'sm' ? 18 : 22;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: dimensions,
          height: dimensions,
          borderRadius: 10,
          border: isActive ? `2px solid ${agent.color}` : `1px solid ${T.border.subtle}`,
          background: isActive ? `${agent.color}25` : hover ? `${agent.color}15` : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        }}
        title={`${agent.name}`}
      >
        <IconComponent size={iconSize} color={isActive || hover ? agent.color : T.text.muted} />
      </button>
      
      {/* Status dot */}
      <div style={{
        position: 'absolute',
        bottom: 1,
        right: 1,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isOnline ? '#22c55e' : '#6b7280',
        border: `2px solid ${T.bg.panel}`,
      }} />

      {/* Tooltip on hover */}
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
          padding: '8px 12px',
          background: T.bg.topBar,
          border: `1px solid ${agent.color}40`,
          borderRadius: 8,
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div style={{ 
            color: agent.color, 
            fontWeight: 700, 
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <IconComponent size={14} color={agent.color} />
            {agent.name}
          </div>
          <div style={{ color: T.text.muted, fontSize: 10, marginTop: 3 }}>
            {agent.description.slice(0, 50)}...
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Category Group
// ============================================================================

const CategoryGroup: React.FC<{
  label: string;
  agents: Array<AgentDefinition & { status: { status: string } }>;
  selectedAgent: AgentCode | null;
  onSelect: (code: AgentCode) => void;
}> = ({ label, agents, selectedAgent, onSelect }) => {
  if (agents.length === 0) return null;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ 
        fontSize: 9, 
        color: T.text.muted, 
        letterSpacing: 0.8,
        marginRight: 4,
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {agents.map(agent => (
        <AgentIcon
          key={agent.code}
          agent={agent}
          isActive={selectedAgent === agent.code}
          onClick={() => onSelect(selectedAgent === agent.code ? null as any : agent.code)}
          size="sm"
        />
      ))}
    </div>
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
  const agents = useAgents();
  const dealId = useDealContext();

  const chatableAgents = agents.filter(a => a.canChatWithUser);
  
  const coreAgents = chatableAgents.filter(a => a.category === 'core');
  const analystAgents = chatableAgents.filter(a => a.category === 'analyst');
  const specialistAgents = chatableAgents.filter(a => a.category === 'specialist');

  const onlineCount = chatableAgents.filter(a => 
    a.status.status === 'online' || a.status.status === 'busy'
  ).length;

  return (
    <>
      <div style={{
        background: T.bg.panel,
        borderTop: `1px solid ${T.border.medium}`,
        padding: expanded ? '10px 16px' : '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.2s ease',
      }}>
        {/* Collapse toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.text.muted,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Label + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            color: T.text.cyan, 
            fontSize: 11, 
            fontWeight: 700, 
            letterSpacing: 1,
          }}>
            AGENTS
          </span>
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            background: `${T.text.green}20`,
            color: T.text.green,
            borderRadius: 4,
          }}>
            {onlineCount} online
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: T.border.subtle }} />

        {/* Agent icons by category */}
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
            <CategoryGroup 
              label="" 
              agents={coreAgents} 
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />
            
            <div style={{ width: 1, height: 20, background: T.border.subtle }} />
            
            <CategoryGroup 
              label="Analysts" 
              agents={analystAgents} 
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />
            
            <div style={{ width: 1, height: 20, background: T.border.subtle }} />
            
            <CategoryGroup 
              label="Specialists" 
              agents={specialistAgents} 
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />
          </div>
        )}

        {/* Settings */}
        <button
          onClick={() => window.location.href = '/settings/agents'}
          style={{
            background: 'transparent',
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 6,
            padding: '6px 10px',
            color: T.text.muted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 10,
          }}
        >
          <Settings size={12} />
          AI Settings
        </button>
      </div>

      {/* Chat drawer */}
      {selectedAgent && (
        <AgentChatDrawer
          agentCode={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          dealId={dealId}
        />
      )}

      <style>{`
        .thinking-dots::after {
          content: '';
          animation: dots 1.5s infinite;
        }
        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
      `}</style>
    </>
  );
};

export default AgentBar;
