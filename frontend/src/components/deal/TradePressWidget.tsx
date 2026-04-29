import React, { useEffect, useState } from 'react';
import { newsService, type NewsDiscovery } from '../../services/news.service';
import { mono as bMono } from './bloomberg-tokens';
import { BT, SectionPanel } from './bloomberg-ui';

const MONO: React.CSSProperties = { fontFamily: bMono };

function fmtPubDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export interface TradePressWidgetProps {
  dealId: string;
  limit?: number;
}

/**
 * Per-deal trade-press news widget.
 *
 * Lists the most recent items from `news_discoveries` (GlobeSt, Bisnow,
 * Connect CRE, etc.) tagged to this deal, plus the caller's own premium
 * subscription items that mention the deal. Each item links out to the
 * publisher URL in a new tab.
 *
 * Backed by `GET /api/v1/news/discoveries?deal_id=...`.
 */
export const TradePressWidget: React.FC<TradePressWidgetProps> = ({
  dealId,
  limit = 8,
}) => {
  const [items, setItems] = useState<NewsDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    newsService
      .getDiscoveries({ dealId, limit })
      .then((res) => {
        if (cancelled) return;
        const raw = Array.isArray(res?.data) ? res.data : [];
        // Drop rows with missing/invalid publisher URLs and defensively
        // sort newest-first so mixed premium + public hits always render
        // in publish-date order regardless of how the backend interleaves
        // them.
        const cleaned = raw
          .filter((it) => typeof it.url === 'string' && /^https?:\/\//i.test(it.url))
          .sort((a, b) => {
            const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return tb - ta;
          });
        setItems(cleaned);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setError(e?.response?.data?.message || e?.message || 'Failed to load trade-press items');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, limit]);

  return (
    <SectionPanel
      title="TRADE PRESS"
      subtitle="GlobeSt · Bisnow · Connect CRE"
      borderColor={BT.text.cyan}
    >
      {loading && (
        <div
          style={{
            padding: '8px 8px',
            textAlign: 'center',
            fontSize: 9,
            color: BT.text.muted,
            ...MONO,
          }}
        >
          Loading…
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: '8px 8px',
            textAlign: 'center',
            fontSize: 9,
            color: BT.text.red,
            ...MONO,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          style={{
            padding: '8px 8px',
            textAlign: 'center',
            fontSize: 9,
            color: BT.text.muted,
            ...MONO,
          }}
        >
          No trade-press items tagged to this deal yet
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '4px 8px',
                borderBottom: `1px solid ${BT.border.subtle}`,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
              title={item.summary || item.headline}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: BT.text.primary,
                  lineHeight: 1.3,
                  ...MONO,
                }}
              >
                {item.headline}
              </span>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: BT.text.cyan,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    ...MONO,
                  }}
                >
                  {item.source || 'TRADE PRESS'}
                  {item.isPremium && (
                    <span style={{ marginLeft: 6, color: BT.text.purple }}>
                      ★ SUBSCRIPTION
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 9, color: BT.text.muted, ...MONO }}>
                  {fmtPubDate(item.publishedAt)}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionPanel>
  );
};

export default TradePressWidget;
