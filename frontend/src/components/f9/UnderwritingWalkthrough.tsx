/**
 * UnderwritingWalkthrough — F9 ProForma sub-tab
 *
 * Displays the Commentary Agent's natural-language narrative explaining
 * how the CashFlow Agent derived each assumption.
 *
 * - "Generate Walkthrough" button — available on demand
 * - Auto-generates for Principal+ tier on run completion (triggered by API)
 * - Loading state, rendered narrative, Copy button
 */

import React, { useState, useEffect } from 'react';
import { BT, BT_CSS } from '../deal/bloomberg-ui';

interface WalkthroughData {
  event_id: string;
  narrative: string | null;
  generated_at: string;
  status: 'available' | 'pending';
  message: string;
}

interface UnderwritingWalkthroughProps {
  dealId: string;
}

export function UnderwritingWalkthrough({ dealId }: UnderwritingWalkthroughProps) {
  const [data, setData] = useState<WalkthroughData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mono = BT.font.mono;

  const requestWalkthrough = async (focus?: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/deals/${dealId}/underwriting/walkthrough`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ focus }),
      });
      if (!r.ok) throw new Error(`Request failed: ${r.status}`);
      const result: WalkthroughData = await r.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // Poll for narrative if status is pending
  useEffect(() => {
    if (!data || data.status !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/deals/${dealId}/underwriting/walkthrough`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        if (!r.ok) return;
        const result: WalkthroughData = await r.json();
        if (result.narrative) {
          setData(result);
          clearInterval(interval);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [data, dealId]);

  const handleCopy = () => {
    if (!data?.narrative) return;
    navigator.clipboard.writeText(data.narrative).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{BT_CSS}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: BT.text.white, letterSpacing: 0.5, marginBottom: 2 }}>
            UNDERWRITING WALKTHROUGH
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>
            AI-generated plain-language explanation of CashFlow Agent decisions
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {data?.narrative && (
            <button
              onClick={handleCopy}
              style={{
                background: copied ? `${BT.text.green}18` : BT.bg.header,
                border: `1px solid ${copied ? BT.text.green : BT.border.medium}`,
                color: copied ? BT.text.green : BT.text.secondary,
                fontFamily: mono, fontSize: 8, padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
              }}
            >
              {copied ? '✓ COPIED' : 'COPY'}
            </button>
          )}
          <button
            onClick={() => requestWalkthrough()}
            disabled={loading}
            style={{
              background: `${BT.accent.agent}18`,
              border: `1px solid ${BT.accent.agent}44`,
              color: BT.accent.agent, fontFamily: mono, fontSize: 8,
              padding: '4px 12px', borderRadius: 3, cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'GENERATING…' : data ? 'REGENERATE' : 'GENERATE WALKTHROUGH'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          fontFamily: mono, fontSize: 8, color: BT.text.red,
          padding: '8px 12px', background: `${BT.text.red}10`,
          border: `1px solid ${BT.text.red}30`, borderRadius: 3,
        }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          padding: 24, background: BT.bg.header, borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.muted, letterSpacing: 1 }}>
            GENERATING NARRATIVE…
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: BT.text.muted }}>
            Commentary Agent is analyzing the evidence chain
          </div>
        </div>
      )}

      {/* Pending — waiting for async generation */}
      {!loading && data?.status === 'pending' && (
        <div style={{
          padding: 24, background: BT.bg.header, borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.amber, letterSpacing: 1 }}>
            PROCESSING…
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: BT.text.secondary }}>
            {data.message}
          </div>
          <div style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted }}>
            Auto-refreshing every 3s
          </div>
        </div>
      )}

      {/* Narrative content */}
      {!loading && data?.narrative && (
        <div style={{
          background: BT.bg.header, borderRadius: 4,
          border: `1px solid ${BT.border.subtle}`,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 12px',
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.muted, letterSpacing: 0.5 }}>
              NARRATIVE · {new Date(data.generated_at).toLocaleString()}
            </span>
            <span style={{ fontFamily: mono, fontSize: 7, color: BT.text.green }}>
              ● READY
            </span>
          </div>
          <div style={{
            padding: '14px 16px',
            fontFamily: mono, fontSize: 9, color: BT.text.secondary,
            lineHeight: 1.8, whiteSpace: 'pre-wrap',
          }}>
            {data.narrative}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div style={{
          padding: 32, background: BT.bg.header, borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          border: `1px dashed ${BT.border.medium}`,
        }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: BT.text.secondary }}>
            No walkthrough generated yet
          </div>
          <div style={{ fontFamily: mono, fontSize: 8, color: BT.text.muted, textAlign: 'center', maxWidth: 280 }}>
            Click "Generate Walkthrough" to get a plain-language explanation of the underwriting evidence and decisions.
            Principal+ tier generates automatically after each agent run.
          </div>
        </div>
      )}
    </div>
  );
}
