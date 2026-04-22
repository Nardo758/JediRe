/**
 * Skills Chat Section
 * 
 * Chat interface for the AI assistant with skill execution visualization.
 * Shows which skills are being called and their results.
 */

import React, { useState, useRef, useEffect } from 'react';
import api from '@/services/api';

// ============================================================================
// TYPES
// ============================================================================

interface SkillCall {
  skillId: string;
  skillName: string;
  parameters: Record<string, any>;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };
  executionTimeMs?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  skillCalls?: SkillCall[];
  timestamp: Date;
  /** If user explicitly @mentioned an advisor, the advisor name shown in header */
  forcedAdvisor?: { name: string; color: string; icon: string };
}

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Advisor {
  /** Skill ID, e.g. 'consult_cfo' */
  id: string;
  /** Display name, e.g. 'CFO' */
  name: string;
  /** Mention slug, e.g. 'CFO' (no spaces) */
  mention: string;
  icon: string;
  color: string;
}

const ADVISOR_COLOR = '#FF6FB5';

// Reverse-build mention slug from skill id: 'consult_chief_financial_officer' -> 'ChiefFinancialOfficer'
// We'll instead use the display name with spaces removed.
function buildAdvisorList(skills: Skill[]): Advisor[] {
  return skills
    .filter(s => s.category === 'advisor' && s.id.startsWith('consult_'))
    .map(s => ({
      id: s.id,
      name: s.name,
      mention: s.name.replace(/[^A-Za-z0-9]/g, ''),
      icon: '🧠',
      color: ADVISOR_COLOR,
    }));
}

/**
 * Parse a leading @Mention from the message. Returns the matched advisor + the
 * stripped message body, or null if no leading mention.
 */
function parseLeadingMention(
  text: string,
  advisors: Advisor[]
): { advisor: Advisor; body: string } | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('@')) return null;
  // Match @Word(s) up to first whitespace
  const m = trimmed.match(/^@([A-Za-z0-9]+)\s*([\s\S]*)$/);
  if (!m) return null;
  const slug = m[1].toLowerCase();
  const body = m[2];
  const advisor = advisors.find(a => a.mention.toLowerCase() === slug);
  if (!advisor) return null;
  return { advisor, body: body.trim() || `Please weigh in on this deal.` };
}

/**
 * Detect an in-progress @ token at the cursor position. Returns the partial
 * text after the @ if the cursor is currently inside a mention being typed.
 */
function detectMentionAtCursor(
  text: string,
  cursorPos: number
): { start: number; partial: string } | null {
  // Walk backward from cursor to find @ or whitespace
  let i = cursorPos - 1;
  while (i >= 0) {
    const c = text[i];
    if (c === '@') {
      // Must be at start, or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1])) {
        const partial = text.slice(i + 1, cursorPos);
        // Reject if partial contains whitespace (closed mention)
        if (/\s/.test(partial)) return null;
        return { start: i, partial };
      }
      return null;
    }
    if (/\s/.test(c)) return null;
    i--;
  }
  return null;
}

interface SkillsChatSectionProps {
  dealId: string;
}

// ============================================================================
// THEME
// ============================================================================

const T = {
  bg: { 
    terminal: '#0A0E14', 
    panel: '#0F1923', 
    input: '#0D1720',
    message: '#111C27',
    skill: '#0D2818',
  },
  text: { 
    primary: '#E8F4FD', 
    secondary: '#8BA8BF', 
    muted: '#4A6070', 
    cyan: '#00B4D8', 
    green: '#00D26A', 
    red: '#FF4D4D', 
    amber: '#F6A623',
    purple: '#B794F4',
  },
  border: { subtle: '#1A2C3D', medium: '#1E3448' },
  font: { mono: '"JetBrains Mono", "Consolas", monospace' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function SkillsChatSection({ dealId }: SkillsChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showSkills, setShowSkills] = useState(false);
  const [mentionState, setMentionState] = useState<{ start: number; partial: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const advisors = React.useMemo(() => buildAdvisorList(skills), [skills]);

  const mentionMatches = React.useMemo(() => {
    if (!mentionState) return [];
    const q = mentionState.partial.toLowerCase();
    return advisors
      .filter(a => a.mention.toLowerCase().startsWith(q) || a.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionState, advisors]);

  // Load available skills
  useEffect(() => {
    api.get(`/deals/${dealId}/skills/list`)
      .then(res => setSkills(res.data?.skills || []))
      .catch(() => {});
  }, [dealId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const raw = input.trim();
    const mention = parseLeadingMention(raw, advisors);
    const forcedSkillId = mention?.advisor.id;
    const forcedAdvisor = mention
      ? { name: mention.advisor.name, color: mention.advisor.color, icon: mention.advisor.icon }
      : undefined;
    const sentMessage = mention ? mention.body : raw;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: raw,
      timestamp: new Date(),
      forcedAdvisor,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setMentionState(null);
    setLoading(true);

    try {
      const res = await api.post(`/deals/${dealId}/skills/chat`, {
        message: sentMessage,
        conversationId,
        ...(forcedSkillId ? { forcedSkillId } : {}),
      });

      if (res.data?.success) {
        setConversationId(res.data.conversationId);
        
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: res.data.message,
          skillCalls: res.data.skillCalls,
          timestamp: new Date(),
          forcedAdvisor,
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setMessages(prev => [...prev, {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `Error: ${res.data?.error || 'Unknown error'}`,
          timestamp: new Date(),
        }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.response?.data?.error || error.message || 'Failed to send message'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const acceptMention = (advisor: Advisor) => {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.start);
    const after = input.slice(mentionState.start + 1 + mentionState.partial.length);
    const replaced = `${before}@${advisor.mention} ${after.trimStart()}`;
    setInput(replaced);
    setMentionState(null);
    setMentionIndex(0);
    // Restore focus & put cursor after the mention + space
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = before.length + 2 + advisor.mention.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const cursor = e.target.selectionStart ?? value.length;
    const detected = detectMentionAtCursor(value, cursor);
    setMentionState(detected);
    setMentionIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention autocomplete navigation
    if (mentionState && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        acceptMention(mentionMatches[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: T.bg.terminal,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: `1px solid ${T.border.subtle}`,
        background: T.bg.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, fontFamily: T.font.mono }}>
              JEDI ASSISTANT
            </div>
            <div style={{ fontSize: 9, color: T.text.muted, fontFamily: T.font.mono }}>
              {skills.length} skills available
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSkills(!showSkills)}
            style={{
              padding: '6px 12px',
              background: showSkills ? T.text.cyan + '22' : 'transparent',
              border: `1px solid ${showSkills ? T.text.cyan : T.border.subtle}`,
              borderRadius: 4,
              color: showSkills ? T.text.cyan : T.text.muted,
              fontSize: 10,
              fontFamily: T.font.mono,
              cursor: 'pointer',
            }}
          >
            {showSkills ? 'HIDE SKILLS' : 'SHOW SKILLS'}
          </button>
          <button
            onClick={startNewConversation}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: `1px solid ${T.border.subtle}`,
              borderRadius: 4,
              color: T.text.muted,
              fontSize: 10,
              fontFamily: T.font.mono,
              cursor: 'pointer',
            }}
          >
            NEW CHAT
          </button>
        </div>
      </div>

      {/* Skills Panel (collapsible) */}
      {showSkills && (
        <div style={{
          padding: 12,
          borderBottom: `1px solid ${T.border.subtle}`,
          background: T.bg.panel,
          maxHeight: 150,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {skills.map(skill => (
              <div
                key={skill.id}
                style={{
                  padding: '6px 10px',
                  background: T.bg.terminal,
                  border: `1px solid ${T.border.subtle}`,
                  borderRadius: 4,
                  fontSize: 9,
                  fontFamily: T.font.mono,
                }}
                title={skill.description}
              >
                <span style={{ color: getCategoryColor(skill.category) }}>●</span>
                <span style={{ color: T.text.secondary, marginLeft: 6 }}>{skill.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: T.text.muted,
            fontFamily: T.font.mono,
            fontSize: 11,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
            <div>Ask me anything about this deal.</div>
            <div style={{ fontSize: 10, marginTop: 8 }}>
              I can fetch data, run analyses, update assumptions, and generate reports.
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Advisor header (if user @mentioned an advisor) */}
            {msg.forcedAdvisor && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                marginBottom: 6,
                background: msg.forcedAdvisor.color + '22',
                border: `1px solid ${msg.forcedAdvisor.color}66`,
                borderRadius: 4,
                fontSize: 9,
                fontFamily: T.font.mono,
                color: msg.forcedAdvisor.color,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                <span>{msg.forcedAdvisor.icon}</span>
                <span>{msg.role === 'user' ? '→' : ''} {msg.forcedAdvisor.name}</span>
                {msg.role === 'assistant' && <span style={{ opacity: 0.7 }}>responding</span>}
              </div>
            )}

            {/* Skill calls (if any) */}
            {msg.skillCalls && msg.skillCalls.length > 0 && (
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 6, 
                marginBottom: 8,
                maxWidth: '85%',
              }}>
                {msg.skillCalls.map((call, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 8px',
                      background: call.result?.success ? T.bg.skill : T.text.red + '11',
                      border: `1px solid ${call.result?.success ? T.text.green + '44' : T.text.red + '44'}`,
                      borderRadius: 4,
                      fontSize: 9,
                      fontFamily: T.font.mono,
                    }}
                  >
                    <span style={{ color: call.result?.success ? T.text.green : T.text.red }}>
                      {call.result?.success ? '✓' : '✗'}
                    </span>
                    <span style={{ color: T.text.secondary, marginLeft: 6 }}>
                      {call.skillName}
                    </span>
                    {call.executionTimeMs && (
                      <span style={{ color: T.text.muted, marginLeft: 6 }}>
                        {call.executionTimeMs}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Message bubble */}
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                background: msg.role === 'user' ? T.text.cyan + '22' : T.bg.message,
                border: `1px solid ${msg.role === 'user' ? T.text.cyan + '44' : T.border.subtle}`,
                borderRadius: 8,
                borderTopRightRadius: msg.role === 'user' ? 2 : 8,
                borderTopLeftRadius: msg.role === 'assistant' ? 2 : 8,
              }}
            >
              <div style={{
                fontSize: 11,
                fontFamily: T.font.mono,
                color: T.text.primary,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}>
                {msg.content}
              </div>
              <div style={{
                fontSize: 8,
                color: T.text.muted,
                fontFamily: T.font.mono,
                marginTop: 6,
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: T.bg.message,
            border: `1px solid ${T.border.subtle}`,
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: T.text.cyan,
              animation: 'pulse 1s infinite',
            }} />
            <span style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>
              Thinking...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 16,
        borderTop: `1px solid ${T.border.subtle}`,
        background: T.bg.panel,
        position: 'relative',
      }}>
        {/* Mention autocomplete dropdown */}
        {mentionState && mentionMatches.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% - 4px)',
              left: 16,
              right: 16,
              maxHeight: 220,
              overflowY: 'auto',
              background: T.bg.terminal,
              border: `1px solid ${ADVISOR_COLOR}55`,
              borderRadius: 6,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
              zIndex: 50,
            }}
          >
            <div style={{
              padding: '6px 10px',
              fontSize: 9,
              color: T.text.muted,
              fontFamily: T.font.mono,
              borderBottom: `1px solid ${T.border.subtle}`,
            }}>
              ADVISORS — ↑↓ to navigate, Tab/Enter to select, Esc to close
            </div>
            {mentionMatches.map((a, i) => (
              <div
                key={a.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptMention(a);
                }}
                onMouseEnter={() => setMentionIndex(i)}
                style={{
                  padding: '8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  background: i === mentionIndex ? ADVISOR_COLOR + '22' : 'transparent',
                  borderLeft: `3px solid ${i === mentionIndex ? ADVISOR_COLOR : 'transparent'}`,
                  fontFamily: T.font.mono,
                  fontSize: 11,
                }}
              >
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <span style={{ color: ADVISOR_COLOR, fontWeight: 700 }}>@{a.mention}</span>
                <span style={{ color: T.text.secondary, marginLeft: 4 }}>{a.name}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          position: 'relative',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this deal... (type @ to consult an advisor)"
            rows={1}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: T.bg.input,
              border: `1px solid ${T.border.subtle}`,
              borderRadius: 6,
              color: T.text.primary,
              fontSize: 12,
              fontFamily: T.font.mono,
              resize: 'none',
              outline: 'none',
              minHeight: 40,
              maxHeight: 120,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              padding: '10px 20px',
              background: input.trim() && !loading ? T.text.cyan : T.bg.input,
              border: `1px solid ${input.trim() && !loading ? T.text.cyan : T.border.subtle}`,
              borderRadius: 6,
              color: input.trim() && !loading ? '#000' : T.text.muted,
              fontSize: 11,
              fontFamily: T.font.mono,
              fontWeight: 700,
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !loading ? 1 : 0.5,
            }}
          >
            SEND
          </button>
        </div>
        <div style={{
          marginTop: 8,
          fontSize: 9,
          color: T.text.muted,
          fontFamily: T.font.mono,
        }}>
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'data': return T.text.cyan;
    case 'analysis': return T.text.purple;
    case 'document': return T.text.amber;
    case 'action': return T.text.green;
    case 'report': return T.text.primary;
    default: return T.text.muted;
  }
}

export default SkillsChatSection;
