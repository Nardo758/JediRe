import React, { useEffect, useState } from 'react';
import { BT } from '../theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface NarrativeRow {
  id: string;
  kind: 'thesis' | 'highlight';
  text: string;
  broker: string | null;
  propertyName: string | null;
  capturedAt: string;
  sentimentLabel: string | null;
  sentimentScore: number | null;
  sourceFileId: number;
}

interface FeedResponse {
  entityType: 'msa' | 'submarket';
  entityId: string;
  canonicalKey: string;
  entityName: string | null;
  narratives: NarrativeRow[];
}

interface BrokerNarrativesFeedProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  refreshNonce?: number; // bump to force re-fetch
}

const sentimentColor = (label: string | null): string => {
  if (label === 'bullish') return BT.text.green;
  if (label === 'bearish') return BT.text.red;
  if (label === 'neutral') return BT.text.amber;
  return BT.text.muted;
};

const fmtRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days <= 0) {
    const hours = Math.max(1, Math.floor(ms / (3600 * 1000)));
    return `${hours}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const BrokerNarrativesFeed: React.FC<BrokerNarrativesFeedProps> = ({
  entityType, entityId, refreshNonce,
}) => {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken') ?? '';
    fetch(`/api/v1/broker-narratives/${entityType}/${encodeURIComponent(entityId)}?limit=10`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FeedResponse>;
      })
      .then(j => { if (!cancelled) setData(j); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId, refreshNonce]);

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: BT.text.amber,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: `1px solid ${BT.text.amber}44`,
        paddingBottom: 4, marginBottom: 8, ...mono,
      }}>
        Broker Narratives
      </div>

      {loading && (
        <div style={{ fontSize: 11, color: BT.text.muted, ...mono }}>Loading…</div>
      )}

      {error && !loading && (
        <div style={{ fontSize: 11, color: BT.accent.red, ...mono }}>{error}</div>
      )}

      {!loading && !error && data && data.narratives.length === 0 && (
        <div style={{ fontSize: 11, color: BT.text.muted, lineHeight: 1.5 }}>
          No broker offering memoranda have been ingested for this market yet.
        </div>
      )}

      {!loading && !error && data && data.narratives.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.narratives.map(n => (
            <div key={n.id} style={{
              padding: '6px 8px',
              background: BT.bg.panel,
              border: `1px solid ${BT.border.subtle}`,
              borderLeft: `3px solid ${sentimentColor(n.sentimentLabel)}`,
              borderRadius: 3,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 9, color: BT.text.muted, ...mono, marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>{n.kind === 'thesis' ? 'Thesis' : 'Highlight'}</span>
                <span>{fmtRelative(n.capturedAt)}</span>
              </div>
              <div style={{ fontSize: 11, color: BT.text.primary, lineHeight: 1.5 }}>
                {n.text}
              </div>
              {(n.broker || n.propertyName) && (
                <div style={{ fontSize: 9, color: BT.text.muted, ...mono, marginTop: 4 }}>
                  {n.propertyName ?? ''}{n.broker ? ` · ${n.broker}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrokerNarrativesFeed;
