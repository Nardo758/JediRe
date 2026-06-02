/**
 * Activity Tab — chronological deal activity feed
 * Sources: document uploads (deal_files) + deal lifecycle events (deal_activity)
 * Filterable by activity type.
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../../services/api.client';

const T = {
  bg:     { panel: '#0F1319', header: '#1A1F2E', hover: '#1E2538' },
  text:   { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4' },
  border: { subtle: '#1E2538', medium: '#2A3348' },
  font:   { mono: "'JetBrains Mono', monospace" },
};

interface Activity {
  id: string;
  type: string;
  actor: string;
  description: string;
  meta: string | null;
  timestamp: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  document_upload: { label: 'Document',  icon: '📄', color: T.text.cyan   },
  deal_event:      { label: 'Deal',      icon: '🏠', color: T.text.green  },
  financial_change:{ label: 'Financial', icon: '📊', color: T.text.amber  },
  agent_run:       { label: 'Agent',     icon: '🤖', color: T.text.secondary },
};
const ALL_TYPES = Object.keys(TYPE_CONFIG);

function fmtRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(s: string, max = 72): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export default function ActivityTab({ dealId }: { dealId?: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState<string>('all');

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    const url = filter === 'all'
      ? `/api/v1/operations/${dealId}/activity?limit=100`
      : `/api/v1/operations/${dealId}/activity?type=${filter}&limit=100`;
    apiClient.get(url)
      .then(res => {
        setActivities(res.data?.activities ?? []);
      })
      .catch(() => setError('Failed to load activity'))
      .finally(() => setLoading(false));
  }, [dealId, filter]);

  const visibleTypes = filter === 'all' ? ALL_TYPES : [filter];
  const filtered = activities.filter(a => visibleTypes.includes(a.type));

  return (
    <div style={{ fontFamily: T.font.mono }}>
      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap', borderBottom: `1px solid ${T.border.subtle}` }}>
        {[{ key: 'all', label: 'ALL' }, ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ key: k, label: v.label.toUpperCase() }))].map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            style={{
              fontFamily: T.font.mono, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              padding: '4px 9px', borderRadius: 2, letterSpacing: '0.5px',
              border: `1px solid ${filter === chip.key ? T.text.amber : T.border.medium}`,
              background: filter === chip.key ? T.text.amber + '18' : 'transparent',
              color: filter === chip.key ? T.text.amber : T.text.muted,
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: T.text.muted, fontSize: 10 }}>
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 24, textAlign: 'center', color: T.text.red, fontSize: 10 }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 10, color: T.text.muted }}>
              {dealId ? 'No activity yet for this filter.' : 'No deal selected.'}
            </div>
          </div>
        )}

        {!loading && filtered.map((act, i) => {
          const cfg = TYPE_CONFIG[act.type] ?? { icon: '📝', color: T.text.muted, label: act.type };
          const isLast = i === filtered.length - 1;
          return (
            <div key={act.id} style={{
              display: 'flex', gap: 10, padding: '10px 12px',
              borderBottom: isLast ? 'none' : `1px solid ${T.border.subtle}`,
              alignItems: 'flex-start',
            }}>
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                {!isLast && (
                  <div style={{ width: 1, flex: 1, marginTop: 4, background: T.border.subtle, minHeight: 12 }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, color: cfg.color,
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    border: `1px solid ${cfg.color}44`, padding: '1px 5px', borderRadius: 2,
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 9, color: T.text.muted, marginLeft: 'auto', flexShrink: 0 }}>
                    {fmtRelative(act.timestamp)}
                  </span>
                </div>

                <div style={{ fontSize: 10, color: T.text.primary, lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {truncate(act.description)}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                  {act.actor && act.actor !== 'System' && (
                    <span style={{ fontSize: 9, color: T.text.secondary }}>
                      {act.actor}
                    </span>
                  )}
                  {act.meta && (
                    <span style={{ fontSize: 8, color: T.text.muted }}>
                      {act.meta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
