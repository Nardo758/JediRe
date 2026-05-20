import React, { useState } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { X } from 'lucide-react';

const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
};

interface Props {
  shortcode: string;
  onConnected: () => void;
  onClose: () => void;
}

type Phase = 'form' | 'validating' | 'success' | 'error';

const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude Sonnet)',
    keyPrefix: 'sk-ant-',
    placeholder: 'sk-ant-api03-…',
    model: 'claude-sonnet-4-20250514',
    costInput: '$3.00',
    costOutput: '$15.00',
    costRange: '$0.003–0.02 per query',
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o)',
    keyPrefix: 'sk-',
    placeholder: 'sk-proj-…',
    model: 'gpt-4o',
    costInput: '$2.50',
    costOutput: '$10.00',
    costRange: '$0.002–0.015 per query',
  },
];

function validateKeyFormat(provider: string, key: string): string | null {
  if (!key.trim()) return 'API key is required';
  if (provider === 'anthropic' && !key.startsWith('sk-ant-')) {
    return 'Anthropic keys start with sk-ant-';
  }
  if (provider === 'openai' && !key.startsWith('sk-')) {
    return 'OpenAI keys start with sk-';
  }
  return null;
}

export default function RecipientConnectModal({ shortcode, onConnected, onClose }: Props) {
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [validationErr, setValidationErr] = useState('');

  const selectedProvider = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0];

  const handleSubmit = async () => {
    const fmt = validateKeyFormat(provider, apiKey);
    if (fmt) { setValidationErr(fmt); return; }
    setValidationErr('');
    setPhase('validating');

    try {
      const res = await fetch(`/api/v1/shares/${shortcode}/connect_api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorMsg(body.detail ?? body.error ?? 'Connection failed. Check your API key and try again.');
        setPhase('error');
        return;
      }
      setPhase('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('error');
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  };

  const card: React.CSSProperties = {
    background: '#0f1623',
    border: `1px solid ${BT.border.medium}`,
    borderTop: `2px solid ${BT.text.cyan}`,
    width: '100%',
    maxWidth: 460,
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
    ...mono,
  };

  const input: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 12,
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    color: BT.text.primary,
    outline: 'none',
    boxSizing: 'border-box',
    ...mono,
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={card}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: BT.text.cyan }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: BT.text.cyan, letterSpacing: 1.2 }}>
              CONNECT API KEY
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 2 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 24px' }}>

          {phase === 'success' ? (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 20,
              }}>✓</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>
                You're connected.
              </div>
              <div style={{ fontSize: 11, color: BT.text.muted, lineHeight: 1.6, marginBottom: 24 }}>
                Your {selectedProvider.label} key has been validated and encrypted.
                You can now ask the agent questions from within the deal view.
              </div>
              <button
                onClick={() => { onConnected(); onClose(); }}
                style={{
                  width: '100%', padding: '12px 20px',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  background: BT.text.cyan, color: '#000',
                  border: 'none', cursor: 'pointer', ...mono,
                }}
              >
                ENTER DEAL VIEW →
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: BT.text.muted, lineHeight: 1.6, marginBottom: 20 }}>
                Connect your AI provider key to ask questions about this deal. Queries run on
                your key — the sender cannot see your key or your questions.
              </div>

              {/* Provider */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, marginBottom: 6 }}>
                  PROVIDER
                </label>
                <select
                  value={provider}
                  onChange={e => { setProvider(e.target.value); setValidationErr(''); }}
                  disabled={phase === 'validating'}
                  style={{ ...input, cursor: 'pointer' }}
                >
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: BT.text.muted, marginBottom: 6 }}>
                  API KEY
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => { setApiKey(e.target.value); setValidationErr(''); }}
                  placeholder={selectedProvider.placeholder}
                  disabled={phase === 'validating'}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                  style={input}
                  autoComplete="off"
                />
                {validationErr && (
                  <div style={{ fontSize: 10, color: '#EF4444', marginTop: 5 }}>{validationErr}</div>
                )}
              </div>

              {/* Error */}
              {phase === 'error' && (
                <div style={{
                  padding: '10px 12px', marginBottom: 16, fontSize: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#EF4444', lineHeight: 1.5,
                }}>
                  {errorMsg}
                </div>
              )}

              {/* Privacy + cost note */}
              <div style={{
                padding: '10px 12px', marginBottom: 20,
                background: 'rgba(6,182,212,0.04)',
                border: `1px solid rgba(6,182,212,0.15)`,
                fontSize: 10, color: BT.text.muted, lineHeight: 1.6,
              }}>
                <div style={{ marginBottom: 6 }}>
                  🔒 Your key is encrypted with AES-256-GCM and never visible to the sender or other parties.
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span>
                    <span style={{ color: BT.text.primary, fontWeight: 700 }}>Model:</span>{' '}
                    {selectedProvider.model}
                  </span>
                  <span>
                    <span style={{ color: BT.text.primary, fontWeight: 700 }}>Est. cost:</span>{' '}
                    {selectedProvider.costRange}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: 9, opacity: 0.75 }}>
                  {selectedProvider.costInput}/M input · {selectedProvider.costOutput}/M output tokens
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={phase === 'validating' ? undefined : handleSubmit}
                disabled={phase === 'validating'}
                style={{
                  width: '100%', padding: '12px 20px',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  background: phase === 'validating' ? BT.bg.active : BT.text.cyan,
                  color: phase === 'validating' ? BT.text.muted : '#000',
                  border: 'none',
                  cursor: phase === 'validating' ? 'not-allowed' : 'pointer',
                  opacity: phase === 'validating' ? 0.7 : 1,
                  ...mono,
                }}
              >
                {phase === 'validating' ? 'VALIDATING KEY…' : 'CONNECT & ENCRYPT'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
