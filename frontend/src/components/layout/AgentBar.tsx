/**
 * Agent Bar - Compact horizontal agent selector
 * 
 * Features:
 * - Compact emoji icons in a row
 * - Hover to see agent name + status
 * - Click to open chat drawer
 * - Activity indicator dot
 * - Command palette shortcut (/)
 * 
 * @version 1.0.0
 * @date 2026-03-28
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { T } from '../../styles/terminal-tokens';
import api from '../../lib/api';
import { agentBus, AgentCode } from '../../services/agentBus';
import { useAgents, useAgentChat, useAgentMessages } from '../../hooks/useAgentBus';
import { getAgentByCode, AGENT_SUGGESTED_PROMPTS, AGENT_INTRO_MESSAGES, AGENT_DEFINITIONS } from '../../services/agentRegistry';

// ============================================================================
// Agent Chat Drawer (slides in from right)
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
      width: 400,
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
        padding: '12px 16px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: `linear-gradient(135deg, ${agent?.color}15, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{agent?.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: T.text.primary, fontWeight: 700, fontSize: 14 }}>
              {agent?.name}
            </div>
            <div style={{ color: T.text.muted, fontSize: 11 }}>
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
            marginTop: 8,
            padding: '4px 10px',
            background: `${T.text.amber}20`,
            borderRadius: 4,
            width: 'fit-content',
          }}>
            <span style={{ fontSize: 11, color: T.text.amber }}>📍 {dealContext.name}</span>
            {dealContext.jediScore && (
              <span style={{ fontSize: 10, color: T.text.muted }}>• JEDI {dealContext.jediScore}</span>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {/* Intro */}
        <div style={{
          padding: '10px 12px',
          background: `${agent?.color}10`,
          borderLeft: `3px solid ${agent?.color}`,
          borderRadius: '0 6px 6px 0',
          marginBottom: 12,
          fontSize: 12,
          color: T.text.secondary,
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
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}
            >
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
          <div style={{
            padding: '8px 12px',
            background: T.bg.panelAlt,
            borderRadius: 12,
            width: 'fit-content',
            fontSize: 12,
            color: T.text.muted,
          }}>
            <span className="thinking-dots">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.filter(m => m.topic === 'chat').length === 0 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestedPrompts.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
              style={{
                padding: '5px 10px',
                background: T.bg.panelAlt,
                border: `1px solid ${T.border.subtle}`,
                borderRadius: 4,
                color: T.text.secondary,
                fontSize: 10,
                cursor: 'pointer',
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
            padding: '10px 12px',
            background: T.bg.terminal,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 6,
            color: T.text.primary,
            fontSize: 12,
            fontFamily: T.font.mono,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            padding: '10px 14px',
            background: input.trim() ? agent?.color : T.bg.panelAlt,
            border: 'none',
            borderRadius: 6,
            color: input.trim() ? '#000' : T.text.muted,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Agent Icon Button
// ============================================================================

interface AgentIconProps {
  agent: typeof AGENT_DEFINITIONS[0] & { status: { status: string } };
  isActive: boolean;
  onClick: () => void;
  hasActivity: boolean;
}

const AgentIcon: React.FC<AgentIconProps> = ({ agent, isActive, onClick, hasActivity }) => {
  const [hover, setHover] = useState(false);
  const isOnline = agent.status.status === 'online' || agent.status.status === 'busy';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          border: isActive ? `2px solid ${agent.color}` : `1px solid ${T.border.subtle}`,
          background: isActive ? `${agent.color}20` : hover ? T.bg.hover : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          transition: 'all 0.15s ease',
          transform: hover ? 'scale(1.1)' : 'scale(1)',
        }}
        title={`${agent.name} - ${agent.description}`}
      >
        {agent.emoji}
      </button>
      
      {/* Status dot */}
      <div style={{
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isOnline ? '#22c55e' : '#6b7280',
        border: `2px solid ${T.bg.panel}`,
      }} />

      {/* Activity pulse */}
      {hasActivity && (
        <div style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: agent.color,
          animation: 'pulse 1.5s infinite',
        }} />
      )}

      {/* Tooltip on hover */}
      {hover && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 8,
          padding: '6px 10px',
          background: T.bg.topBar,
          border: `1px solid ${T.border.medium}`,
          borderRadius: 6,
          whiteSpace: 'nowrap',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ color: agent.color, fontWeight: 700, fontSize: 11 }}>{agent.name}</div>
          <div style={{ color: T.text.muted, fontSize: 10 }}>{agent.description}</div>
        </div>
      )}
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
  const recentMessages = useAgentMessages(20);
  const dealId = useDealContext();

  // Check which agents have recent activity
  const activeAgents = new Set(
    recentMessages.slice(-5).map(m => m.from)
  );

  const chatableAgents = agents.filter(a => a.canChatWithUser && a.code !== 'ORCHESTRATOR');

  return (
    <>
      <div style={{
        background: T.bg.panel,
        borderTop: `1px solid ${T.border.medium}`,
        padding: expanded ? '8px 12px' : '4px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
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
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        {/* Label */}
        <span style={{ 
          color: T.text.cyan, 
          fontSize: 10, 
          fontWeight: 700, 
          letterSpacing: 1,
          marginRight: 8,
        }}>
          AGENTS
        </span>

        {/* Agent icons */}
        {expanded && (
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {chatableAgents.map(agent => (
              <AgentIcon
                key={agent.code}
                agent={agent}
                isActive={selectedAgent === agent.code}
                onClick={() => setSelectedAgent(
                  selectedAgent === agent.code ? null : agent.code
                )}
                hasActivity={activeAgents.has(agent.code)}
              />
            ))}
          </div>
        )}

        {/* Collapsed: just show count */}
        {!expanded && (
          <span style={{ color: T.text.muted, fontSize: 11 }}>
            {chatableAgents.filter(a => a.status.status === 'online').length} online
          </span>
        )}

        {/* Quick search hint */}
        <span style={{
          color: T.text.muted,
          fontSize: 10,
          padding: '3px 8px',
          background: T.bg.panelAlt,
          borderRadius: 4,
        }}>
          / to search
        </span>
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
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
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
