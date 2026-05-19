import React, { useState, useRef, useEffect } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { MessageSquare, X, Send, Minus } from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
};

interface Props {
  shortcode: string;
  onDisconnect: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  usage?: {
    tokens_input: number;
    tokens_output: number;
    total_charged_usd: number;
  };
  error?: boolean;
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  return `$${usd.toFixed(4)}`;
}

export default function RecipientAgentPanel({ shortcode, onDisconnect }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [querying, setQuerying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, open]);

  const submitQuery = async () => {
    const msg = input.trim();
    if (!msg || querying) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setQuerying(true);

    try {
      const res = await fetch(`/api/v1/shares/${shortcode}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: body.error ?? 'Query failed. Please try again.',
          error: true,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: body.response,
          usage: body.usage,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Network error. Please check your connection and try again.',
        error: true,
      }]);
    } finally {
      setQuerying(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`/api/v1/shares/${shortcode}/connect_api`, { method: 'DELETE' });
    } catch {
      // non-fatal
    } finally {
      setDisconnecting(false);
      onDisconnect();
    }
  };

  const totalCost = messages.reduce((sum, m) => sum + (m.usage?.total_charged_usd ?? 0), 0);

  if (!open) {
    return (
      <div style={{
        position: 'fixed', bottom: 80, right: 24, zIndex: 500,
      }}>
        <button
          onClick={() => setOpen(true)}
          title="Ask the agent"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: BT.text.cyan, color: '#000',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
          }}
        >
          <MessageSquare size={20} />
        </button>
        {messages.length > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: '#EAB308', color: '#000',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...mono,
          }}>
            {messages.filter(m => m.role === 'assistant').length}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 24, zIndex: 500,
      width: 380, maxWidth: 'calc(100vw - 32px)',
      background: '#0f1623',
      border: `1px solid ${BT.border.medium}`,
      borderTop: `2px solid ${BT.text.cyan}`,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 120px)',
      ...mono,
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.cyan }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.cyan, letterSpacing: 1 }}>
            DEAL AGENT
          </span>
          {totalCost > 0 && (
            <span style={{ fontSize: 9, color: BT.text.muted }}>
              · {formatCost(totalCost)} total
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 3 }}>
            <Minus size={13} />
          </button>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 3 }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minHeight: 200,
        }}
      >
        {messages.length === 0 && (
          <div style={{ fontSize: 10, color: BT.text.muted, lineHeight: 1.6, textAlign: 'center', paddingTop: 16 }}>
            Ask questions about this deal — financials, market context, assumptions, risks.
            <br />
            Queries run on your API key.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            gap: 4,
          }}>
            <div style={{
              maxWidth: '90%',
              padding: '8px 12px',
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: m.role === 'user'
                ? 'rgba(6,182,212,0.12)'
                : m.error ? 'rgba(239,68,68,0.08)' : BT.bg.panel,
              border: `1px solid ${
                m.role === 'user'
                  ? 'rgba(6,182,212,0.25)'
                  : m.error ? 'rgba(239,68,68,0.25)' : BT.border.subtle
              }`,
              color: m.error ? '#EF4444' : BT.text.primary,
            }}>
              {m.content}
            </div>
            {m.usage && (
              <div style={{ fontSize: 9, color: BT.text.muted, paddingLeft: 4 }}>
                {m.usage.tokens_input}↑ {m.usage.tokens_output}↓ tokens · {formatCost(m.usage.total_charged_usd)}
              </div>
            )}
          </div>
        ))}
        {querying && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <div style={{
              padding: '8px 12px', fontSize: 11,
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              color: BT.text.muted,
            }}>
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: `1px solid ${BT.border.subtle}`,
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuery(); }
          }}
          placeholder="Ask about this deal…"
          disabled={querying}
          rows={1}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontSize: 11,
            background: BT.bg.input,
            border: `1px solid ${BT.border.medium}`,
            color: BT.text.primary,
            outline: 'none',
            resize: 'none',
            minHeight: 36,
            maxHeight: 100,
            overflow: 'auto',
            ...mono,
          }}
        />
        <button
          onClick={submitQuery}
          disabled={querying || !input.trim()}
          style={{
            padding: '8px 12px',
            background: querying || !input.trim() ? BT.bg.active : BT.text.cyan,
            color: querying || !input.trim() ? BT.text.muted : '#000',
            border: 'none',
            cursor: querying || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: querying || !input.trim() ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={13} />
        </button>
      </div>

      {/* Footer — disconnect */}
      <div style={{
        padding: '8px 14px',
        borderTop: `1px solid ${BT.border.subtle}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: BT.text.muted }}>
          Shift+Enter for newline · Enter to send
        </span>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          style={{
            background: 'none', border: 'none',
            fontSize: 9, color: '#EF4444', cursor: 'pointer',
            opacity: disconnecting ? 0.5 : 1,
            ...mono,
          }}
        >
          {disconnecting ? 'DISCONNECTING…' : 'DISCONNECT KEY'}
        </button>
      </div>
    </div>
  );
}
