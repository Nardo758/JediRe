import { useEffect, useState } from 'react';
import { BT } from '../../theme/bloombergTokens';

interface Connection {
  id: string;
  type: 'email' | 'rss' | 'oauth';
  label: string;
  address: string | null;
  status: string;
  metadata: { detectedPublishers?: string[]; provider?: string; host?: string; note?: string };
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface NewsItem {
  id: string;
  connection_id: string;
  publisher: string | null;
  url: string;
  title: string;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
}

const API = '/api/v1/news-connections';

const ENTERPRISE_PROVIDERS: Array<{ id: string; label: string; blurb: string }> = [
  { id: 'bloomberg', label: 'Bloomberg', blurb: 'Bloomberg Terminal API access — requires customer-supplied license.' },
  { id: 'reuters', label: 'Reuters', blurb: 'Reuters Connect feeds via your enterprise account.' },
  { id: 'refinitiv', label: 'Refinitiv', blurb: 'Refinitiv Eikon news streams via your enterprise account.' },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function NewsConnectionsPage() {
  const [tab, setTab] = useState<'email' | 'rss' | 'enterprise'>('email');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailLabel, setEmailLabel] = useState('Forwarded newsletters');
  const [rssUrl, setRssUrl] = useState('');
  const [rssLabel, setRssLabel] = useState('');

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, i] = await Promise.all([
        api<{ connections: Connection[] }>(''),
        api<{ items: NewsItem[] }>('/items?limit=25'),
      ]);
      setConnections(c.connections);
      setItems(i.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function provisionEmail() {
    setBusy(true);
    setError(null);
    try {
      await api('/email', { method: 'POST', body: JSON.stringify({ label: emailLabel }) });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addRss() {
    if (!rssUrl.trim() || !rssLabel.trim()) {
      setError('Both URL and label are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api('/rss', {
        method: 'POST',
        body: JSON.stringify({ url: rssUrl.trim(), label: rssLabel.trim() }),
      });
      setRssUrl('');
      setRssLabel('');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncConnection(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/${id}/sync`, { method: 'POST' });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeConnection(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestEnterprise(provider: string) {
    setBusy(true);
    setError(null);
    try {
      await api('/oauth-request', { method: 'POST', body: JSON.stringify({ provider }) });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  const panel: React.CSSProperties = {
    background: BT.bg.panel,
    border: `1px solid ${BT.border.subtle}`,
    borderRadius: 0,
    padding: 24,
  };
  const subpanel: React.CSSProperties = {
    background: BT.bg.panelAlt,
    border: `1px solid ${BT.border.subtle}`,
    borderRadius: 0,
    padding: 16,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: BT.bg.input,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    color: BT.text.primary,
    outline: 'none',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
  };
  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    background: BT.text.cyan,
    color: '#000',
    border: 'none',
    borderRadius: 0,
    cursor: busy ? 'wait' : 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: 600,
  };
  const ghostButton: React.CSSProperties = {
    padding: '6px 12px',
    background: 'transparent',
    color: BT.text.secondary,
    border: `1px solid ${BT.border.medium}`,
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
  };
  const dangerButton: React.CSSProperties = {
    ...ghostButton,
    color: BT.text.red,
    borderColor: BT.text.red,
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    background: active ? BT.bg.panel : 'transparent',
    color: active ? BT.text.primary : BT.text.muted,
    border: `1px solid ${active ? BT.border.strong : BT.border.subtle}`,
    borderBottom: active ? 'none' : `1px solid ${BT.border.subtle}`,
    borderRadius: 0,
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: 600,
  });

  const emailConns = connections.filter((c) => c.type === 'email');
  const rssConns = connections.filter((c) => c.type === 'rss');
  const oauthConns = connections.filter((c) => c.type === 'oauth');

  return (
    <div style={panel}>
      <h2
        style={{
          color: BT.text.primary,
          fontSize: 11,
          letterSpacing: 0.8,
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: 8,
        }}
      >
        NEWS SUBSCRIPTIONS
      </h2>
      <p style={{ color: BT.text.muted, fontSize: 12, marginBottom: 16 }}>
        Bring your own premium news. Forward newsletters, paste personalized RSS feeds,
        or request enterprise OAuth for Bloomberg / Reuters / Refinitiv.
      </p>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: BT.bg.panelAlt,
            border: `1px solid ${BT.text.red}`,
            color: BT.text.red,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setTab('email')} style={tabBtn(tab === 'email')}>
          EMAIL FORWARDING
        </button>
        <button onClick={() => setTab('rss')} style={tabBtn(tab === 'rss')}>
          AUTHENTICATED RSS
        </button>
        <button onClick={() => setTab('enterprise')} style={tabBtn(tab === 'enterprise')}>
          ENTERPRISE FEEDS
        </button>
      </div>

      {tab === 'email' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={subpanel}>
            <div style={{ color: BT.text.secondary, fontSize: 12, marginBottom: 12 }}>
              Generate a unique address, then add it as a forwarding rule in your email
              client. We extract headlines + links from anything you forward (WSJ Real
              Estate Daily, FT Property, Bloomberg Businessweek, etc.).
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    color: BT.text.muted,
                    fontSize: 10,
                    marginBottom: 4,
                    letterSpacing: 0.6,
                  }}
                >
                  LABEL
                </label>
                <input
                  type="text"
                  value={emailLabel}
                  onChange={(e) => setEmailLabel(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. WSJ Real Estate Daily"
                />
              </div>
              <button onClick={provisionEmail} disabled={busy} style={buttonStyle}>
                GENERATE ADDRESS
              </button>
            </div>
          </div>

          <ConnectionList
            title="YOUR FORWARDING ADDRESSES"
            empty="No forwarding addresses yet."
            connections={emailConns}
            loading={loading}
            onCopy={copy}
            onDelete={removeConnection}
            subpanel={subpanel}
            ghostButton={ghostButton}
            dangerButton={dangerButton}
          />
        </div>
      )}

      {tab === 'rss' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={subpanel}>
            <div style={{ color: BT.text.secondary, fontSize: 12, marginBottom: 12 }}>
              Paste a personalized RSS URL (e.g. your FT myFT topic feed). The URL is
              encrypted at rest and never returned to the client. We poll hourly.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    color: BT.text.muted,
                    fontSize: 10,
                    marginBottom: 4,
                    letterSpacing: 0.6,
                  }}
                >
                  LABEL
                </label>
                <input
                  type="text"
                  value={rssLabel}
                  onChange={(e) => setRssLabel(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. FT Property myFT"
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    color: BT.text.muted,
                    fontSize: 10,
                    marginBottom: 4,
                    letterSpacing: 0.6,
                  }}
                >
                  FEED URL
                </label>
                <input
                  type="url"
                  value={rssUrl}
                  onChange={(e) => setRssUrl(e.target.value)}
                  style={inputStyle}
                  placeholder="https://www.ft.com/myft/following/your-token.rss"
                />
              </div>
              <button
                onClick={addRss}
                disabled={busy || !rssUrl || !rssLabel}
                style={buttonStyle}
              >
                ADD FEED
              </button>
            </div>
          </div>

          <ConnectionList
            title="YOUR RSS FEEDS"
            empty="No RSS feeds yet."
            connections={rssConns}
            loading={loading}
            onSync={syncConnection}
            onDelete={removeConnection}
            subpanel={subpanel}
            ghostButton={ghostButton}
            dangerButton={dangerButton}
          />
        </div>
      )}

      {tab === 'enterprise' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ ...subpanel, borderColor: BT.text.cyan }}>
            <div
              style={{
                color: BT.text.cyan,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              ENTERPRISE TIER
            </div>
            <div style={{ color: BT.text.secondary, fontSize: 12 }}>
              Direct integrations with Bloomberg Terminal API, Reuters Connect, and
              Refinitiv Eikon require a customer-supplied license. Request access below
              and our team will reach out to complete the OAuth handoff.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {ENTERPRISE_PROVIDERS.map((p) => (
              <div key={p.id} style={subpanel}>
                <div
                  style={{
                    color: BT.text.primary,
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {p.label}
                </div>
                <div style={{ color: BT.text.muted, fontSize: 11, marginBottom: 12, minHeight: 48 }}>
                  {p.blurb}
                </div>
                <button
                  onClick={() => requestEnterprise(p.id)}
                  disabled={busy}
                  style={ghostButton}
                >
                  REQUEST ACCESS
                </button>
              </div>
            ))}
          </div>

          <ConnectionList
            title="REQUESTED ENTERPRISE FEEDS"
            empty="No enterprise feed requests yet."
            connections={oauthConns}
            loading={loading}
            onDelete={removeConnection}
            subpanel={subpanel}
            ghostButton={ghostButton}
            dangerButton={dangerButton}
          />
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <h3
          style={{
            color: BT.text.primary,
            fontSize: 11,
            letterSpacing: 0.8,
            fontFamily: "'JetBrains Mono', monospace",
            marginBottom: 12,
          }}
        >
          RECENT INGESTED ITEMS
        </h3>
        <div style={subpanel}>
          {items.length === 0 ? (
            <div style={{ color: BT.text.muted, fontSize: 12 }}>
              Nothing yet. Forward a newsletter or add an RSS feed to start ingesting.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    paddingBottom: 10,
                    borderBottom: `1px solid ${BT.border.subtle}`,
                  }}
                >
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: BT.text.cyan,
                      fontSize: 12,
                      textDecoration: 'none',
                      display: 'block',
                      marginBottom: 2,
                    }}
                  >
                    {it.title}
                  </a>
                  <div style={{ color: BT.text.muted, fontSize: 10 }}>
                    {it.publisher || 'Unknown'} ·{' '}
                    {new Date(it.published_at || it.fetched_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ListProps {
  title: string;
  empty: string;
  connections: Connection[];
  loading: boolean;
  onCopy?: (text: string) => void;
  onSync?: (id: string) => void;
  onDelete: (id: string) => void;
  subpanel: React.CSSProperties;
  ghostButton: React.CSSProperties;
  dangerButton: React.CSSProperties;
}

function ConnectionList(props: ListProps) {
  const { title, empty, connections, loading, onCopy, onSync, onDelete, subpanel, ghostButton, dangerButton } = props;
  return (
    <div style={subpanel}>
      <div
        style={{
          color: BT.text.muted,
          fontSize: 10,
          letterSpacing: 0.8,
          marginBottom: 12,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {title}
      </div>
      {loading ? (
        <div style={{ color: BT.text.muted, fontSize: 12 }}>Loading…</div>
      ) : connections.length === 0 ? (
        <div style={{ color: BT.text.muted, fontSize: 12 }}>{empty}</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {connections.map((c) => (
            <div
              key={c.id}
              style={{
                padding: 12,
                background: BT.bg.panel,
                border: `1px solid ${BT.border.subtle}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: BT.text.primary, fontSize: 12, fontWeight: 600 }}>
                    {c.label}
                  </div>
                  {c.address && (
                    <div
                      style={{
                        color: BT.text.cyan,
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        wordBreak: 'break-all',
                        marginTop: 4,
                      }}
                    >
                      {c.address}
                    </div>
                  )}
                  <div
                    style={{
                      color: BT.text.muted,
                      fontSize: 10,
                      marginTop: 6,
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>STATUS: {c.status.toUpperCase()}</span>
                    {c.last_synced_at && (
                      <span>LAST SYNC: {new Date(c.last_synced_at).toLocaleString()}</span>
                    )}
                    {c.metadata?.detectedPublishers?.length ? (
                      <span>SOURCES: {c.metadata.detectedPublishers.join(', ')}</span>
                    ) : null}
                  </div>
                  {c.last_error && (
                    <div style={{ color: BT.text.red, fontSize: 10, marginTop: 4 }}>
                      ERROR: {c.last_error}
                    </div>
                  )}
                  {c.metadata?.note && (
                    <div style={{ color: BT.text.muted, fontSize: 10, marginTop: 4 }}>
                      {c.metadata.note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {onCopy && c.address && (
                    <button onClick={() => onCopy(c.address!)} style={ghostButton}>
                      COPY
                    </button>
                  )}
                  {onSync && (
                    <button onClick={() => onSync(c.id)} style={ghostButton}>
                      SYNC
                    </button>
                  )}
                  <button onClick={() => onDelete(c.id)} style={dangerButton}>
                    REMOVE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsConnectionsPage;
