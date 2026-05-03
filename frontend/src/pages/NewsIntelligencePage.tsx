import React, { useState, useRef, useEffect } from 'react';
import { newsService, NewsEvent, NewsAlert, MarketDashboard, ContactCredibility } from '../services/news.service';
import { DateRangeFilter, DateRangeOption, getDateRangeFromOption } from '../components/ui/DateRangeFilter';
import { BT } from '../components/deal/bloomberg-ui';
import { apiClient } from '../services/api.client';
import { useAutoContextAnalysis } from '../hooks/useContextAwareness';
import { usePublishContextInsight } from '../contexts/ContextInsightsContext';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

const tabs: { id: ViewType; label: string }[] = [
  { id: 'feed', label: 'EVENT FEED' },
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'network', label: 'NETWORK' },
  { id: 'alerts', label: 'ALERTS' },
];

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

export function NewsIntelligencePage() {
  const [activeView, setActiveView] = useState<ViewType>('feed');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [alerts, setAlerts] = useState<NewsAlert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [dashboard, setDashboard] = useState<MarketDashboard | null>(null);
  const [contacts, setContacts] = useState<ContactCredibility[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Article modal state
  const [selectedArticle, setSelectedArticle] = useState<NewsEvent | null>(null);
  const [articleContent, setArticleContent] = useState<string | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const categories = [
    { id: 'all', label: 'ALL' },
    { id: 'employment', label: 'EMPLOYMENT' },
    { id: 'development', label: 'DEVELOPMENT' },
    { id: 'transactions', label: 'TRANSACTIONS' },
    { id: 'government', label: 'GOVERNMENT' },
    { id: 'amenities', label: 'AMENITIES' },
  ];

  const prevDateRange = useRef(dateRange);

  // Neural network context awareness
  const { analysis: ctxAnalysis } = useAutoContextAnalysis({ context: 'market_dashboard' });

  // Surface this page's context analysis inside the Neural Network Hub widget
  // (instead of rendering an inline pill at the top of the news page).
  usePublishContextInsight('news', 'News Intelligence', ctxAnalysis);

  useEffect(() => {
    loadData();
  // Task #425: useEffect intentionally omits `loadData` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Date-range changes require a fresh fetch (new `from`/`to` window).
    // Category changes are handled client-side by filterEventsByCategory —
    // no re-fetch needed; just let the render pick it up.
    if (prevDateRange.current !== dateRange) {
      prevDateRange.current = dateRange;
      loadEvents();
    }
  // Task #425: useEffect intentionally omits `loadEvents` — the omitted
  // value(s) are either (a) stable references from context/store hooks whose
  // identity is guaranteed by the producer, (b) values captured at first-fire
  // on purpose to prevent re-fetch loops, or (c) inline closures over
  // already-tracked state. Adding them would change observable behavior
  // (extra fetches / lost user input / loops). See task #425 triage notes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Map a unified-feed article (newsletter or provider API) into the NewsEvent
  // shape the F6 page renders. Newsletter items get is_premium badging via
  // source_name; API items use their provider name as source_name.
  const mapFeedArticleToEvent = (a: Record<string, unknown>): NewsEvent => {
    const sourceName = String((a.source as string) || (a.publisher as string) || 'News');
    const isPremium = a.is_premium === true;
    const headline = String(a.headline ?? a.title ?? '');
    return {
      id: String(a.id ?? `feed-${Math.random()}`),
      event_category: String((a.category as string) || 'all'),
      // F6 list renders `event_type` as the row's primary text — put the
      // actual headline here, not the literal source-type string.
      event_type: headline,
      event_status: 'extracted',
      source_type: isPremium ? 'newsletter' : 'api',
      source_name: isPremium ? `${sourceName} (your subscription)` : sourceName,
      source_url: String((a.link as string) || (a.url as string) || ''),
      source_credibility_score: 1,
      extracted_data: { headline, summary: String(a.summary ?? '') },
      location_raw: String((a.market as string) || ''),
      extraction_confidence: 1,
      corroboration_count: 0,
      published_at: String((a.published_at as string) || new Date().toISOString()),
    } as NewsEvent;
  };

  const loadUnifiedFeed = async (): Promise<NewsEvent[]> => {
    try {
      const res = await apiClient.get('/api/v1/news/feed', {
        params: {
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          limit: 50,
        },
      });
      const articles = res.data?.data?.articles || [];
      return articles.map(mapFeedArticleToEvent);
    } catch (e) {
      console.error('Unified feed load failed:', e);
      return [];
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // F6 reads everything from /news/feed only — that endpoint already
      // unifies newsletter parses, free RSS providers, paid API providers, and
      // the user's premium subscription items. The legacy /news/events endpoint
      // is now a thin wrapper around the same data and would only produce
      // duplicate React keys.
      const [alertsRes, dashRes, networkRes, feedEvents] = await Promise.all([
        newsService.getAlerts(),
        newsService.getDashboard(),
        newsService.getNetworkIntelligence(),
        loadUnifiedFeed(),
      ]);

      setEvents(feedEvents);

      if (alertsRes.success) {
        setAlerts(alertsRes.data);
        setUnreadAlertCount(alertsRes.unread_count);
      }
      if (dashRes.success) setDashboard(dashRes.data);
      if (networkRes.success) setContacts(networkRes.data.contacts);
    } catch (error) {
      console.error('Error loading news data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const feedEvents = await loadUnifiedFeed();
      setEvents(feedEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const filterEventsByDate = (events: NewsEvent[]): NewsEvent[] => {
    const { start, end } = getDateRangeFromOption(dateRange, customStartDate, customEndDate);
    if (!start) return events;
    return events.filter((event) => {
      const eventDate = new Date(event.published_at);
      return eventDate >= start && eventDate <= end;
    });
  };

  // Keywords that signal each category — checked against headline + description.
  // Matching is case-insensitive; "all" bypasses filtering entirely.
  const CATEGORY_KEYWORDS: Record<string, RegExp> = {
    employment:   /\b(hire[sd]?|hiring|appoint(ed|ment)?|promot(ed|ion)|join(s|ed)?|named|fired|layoff|resign(ed|ation)?|depart(ed|ure)?|CEO|CFO|CIO|COO|president|director|executive|officer|partner|principal|head of)\b/i,
    development:  /\b(construct(ion|ed|s)?|develop(ed|ment|er)?|groundbreaking|breaks?\s+ground|permit|zoning|project|tower|renovation|redevelop(ment)?|mixed[- ]use|build(ing|ings)?|convert(ed|ing|sion)?|breaks?\s+ground|debut|open(s|ed|ing)?)\b/i,
    transactions: /\b(sell(s|ing)?|sold|sale|buy(s|ing)?|bought|acqui(re[sd]?|sition)|purchase[sd]?|deal|portfolio|invest(ment|or|ing)?|REIT|refinanc(e[sd]?|ing)|loan|lend(s|er|ing)?|capital|fund(s|ing)?|financ(e[sd]?|ing)|clos(e[sd]?|ing)|joint\s+venture|disposition|bid|acquisition)\b/i,
    government:   /\b(legislat(ion|e[sd]?)|bill|senate|congress(ional)?|governor|mayor|city\s+(council|hall)|tax(es|ation)?|regulat(ion|ory|ed|or)?|policy|federal|ordinance|law|government|state|insurance|reform|ballot|commission|zoning|vote[sd]?)\b/i,
    amenities:    /\b(retail|restaurant|hotel|hospit(ality|al)|amenity|amenities|fitness|gym|spa|lifestyle|coworking|co[- ]working|grocery|shop(ping)?|entertainment|lounge|dining|wellness|leisure|resort)\b/i,
  };

  const filterEventsByCategory = (events: NewsEvent[]): NewsEvent[] => {
    if (selectedCategory === 'all') return events;
    const pattern = CATEGORY_KEYWORDS[selectedCategory];
    if (!pattern) return events;
    return events.filter((event) => {
      const text = `${event.event_type || ''} ${event.event_category || ''} ${event.location_raw || ''}`;
      return pattern.test(text);
    });
  };

  const getImpactBadge = (severity: string): { label: string; color: string; bg: string } => {
    if (severity === 'high' || severity === 'critical')
      return { label: 'HIGH', color: BT.text.red, bg: 'rgba(255,71,87,0.12)' };
    if (severity === 'moderate' || severity === 'significant')
      return { label: 'MOD', color: BT.text.amber, bg: 'rgba(245,166,35,0.12)' };
    return { label: 'LOW', color: BT.text.cyan, bg: 'rgba(0,188,212,0.12)' };
  };

  // Handle article click - open in modal
  const handleArticleClick = async (event: NewsEvent) => {
    setSelectedArticle(event);
    setArticleContent(null);
    setLoadingArticle(true);

    // Try to fetch full article content if we have a URL and it's from Guardian
    if (event.source_url && event.source_name?.toLowerCase().includes('guardian')) {
      try {
        // Extract Guardian article ID from URL
        const urlParts = event.source_url.replace('https://www.theguardian.com/', '').split('?')[0];
        const res = await apiClient.get(`/api/v1/news/article/guardian/${urlParts}`);
        if (res.data?.success && res.data?.data?.content) {
          setArticleContent(res.data.data.content);
        }
      } catch (error) {
        console.log('Could not fetch full article');
      }
    }
    
    setLoadingArticle(false);
  };

  // Close article modal
  const closeArticleModal = () => {
    setSelectedArticle(null);
    setArticleContent(null);
  };

  // Article Modal Component
  const ArticleModal = () => {
    if (!selectedArticle) return null;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: 20,
        }}
        onClick={closeArticleModal}
      >
        <div
          style={{
            background: BT.bg.panel,
            border: `1px solid ${BT.border.subtle}`,
            maxWidth: 800,
            maxHeight: '90vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: BT.bg.header,
          }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ fontSize: 10, color: BT.text.cyan, fontWeight: 600, marginBottom: 6, letterSpacing: '0.08em', ...mono }}>
                {selectedArticle.source_name?.toUpperCase() || 'NEWS'}
                {selectedArticle.source_type === 'email_private' && (
                  <span style={{ marginLeft: 8, color: BT.text.amber }}>• FROM YOUR SUBSCRIPTIONS</span>
                )}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: BT.text.primary, margin: 0, lineHeight: 1.3 }}>
                {selectedArticle.event_type}
              </h2>
              <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 8, ...mono }}>
                {new Date(selectedArticle.published_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
            <button
              onClick={closeArticleModal}
              style={{
                background: 'transparent',
                border: 'none',
                color: BT.text.muted,
                fontSize: 24,
                cursor: 'pointer',
                padding: '0 8px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Modal Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {loadingArticle ? (
              <div style={{ textAlign: 'center', padding: 40, color: BT.text.secondary, ...mono }}>
                Loading article...
              </div>
            ) : articleContent ? (
              // Full article content (from Guardian)
              <div
                style={{ color: BT.text.primary, fontSize: 14, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: articleContent }}
              />
            ) : (
              // Preview mode
              <div>
                <p style={{ color: BT.text.secondary, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  {selectedArticle.location_raw || 'Full article content is available on the source website.'}
                </p>
                
                {selectedArticle.extracted_data && Object.keys(selectedArticle.extracted_data).length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, color: BT.text.muted, fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em', ...mono }}>
                      EXTRACTED DATA
                    </div>
                    <pre style={{
                      background: BT.bg.terminal,
                      padding: 12,
                      fontSize: 11,
                      color: BT.text.cyan,
                      overflow: 'auto',
                      ...mono,
                    }}>
                      {JSON.stringify(selectedArticle.extracted_data, null, 2)}
                    </pre>
                  </div>
                )}

                <div style={{
                  padding: 16,
                  background: BT.bg.panelAlt,
                  border: `1px solid ${BT.border.subtle}`,
                  borderLeft: `3px solid ${BT.text.cyan}`,
                }}>
                  <div style={{ fontSize: 11, color: BT.text.muted, marginBottom: 8 }}>
                    This article requires a subscription to read in full.
                  </div>
                  <div style={{ fontSize: 11, color: BT.text.secondary }}>
                    If you have a subscription, forward the newsletter email to have full content extracted automatically.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: `1px solid ${BT.border.subtle}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: BT.bg.header,
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {selectedArticle.event_category && (
                <span style={{
                  padding: '4px 10px',
                  background: BT.bg.panelAlt,
                  color: BT.text.secondary,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  ...mono,
                }}>
                  {selectedArticle.event_category.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={closeArticleModal}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: `1px solid ${BT.border.subtle}`,
                  color: BT.text.secondary,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  ...mono,
                }}
              >
                CLOSE
              </button>
              {selectedArticle.source_url && (
                <a
                  href={selectedArticle.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px',
                    background: BT.text.cyan,
                    border: 'none',
                    color: BT.bg.terminal,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'none',
                    ...mono,
                  }}
                >
                  OPEN SOURCE →
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEventFeed = () => {
    const filteredEvents = filterEventsByCategory(filterEventsByDate(events));
    return (
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 12, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, ...mono }}>TIME RANGE</div>
          <DateRangeFilter
            selectedRange={dateRange}
            onRangeChange={setDateRange}
            showCustom={true}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDatesChange={(start, end) => {
              setCustomStartDate(start);
              setCustomEndDate(end);
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => {
            const dateFiltered = filterEventsByDate(events);
            const count = cat.id === 'all'
              ? dateFiltered.length
              : (() => {
                  const p = CATEGORY_KEYWORDS[cat.id];
                  return p
                    ? dateFiltered.filter((e) =>
                        p.test(`${e.event_type || ''} ${e.event_category || ''} ${e.location_raw || ''}`)
                      ).length
                    : dateFiltered.length;
                })();
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '6px 14px',
                  background: isActive ? BT.text.cyan : BT.bg.panel,
                  color: isActive ? BT.bg.terminal : BT.text.secondary,
                  border: isActive ? 'none' : `1px solid ${BT.border.subtle}`,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  ...mono,
                }}
              >
                {cat.label}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 2,
                  background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.07)',
                  color: isActive ? BT.bg.terminal : BT.text.muted,
                  minWidth: 20,
                  textAlign: 'center',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: BT.text.secondary, ...mono }}>Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted }}>
              <div style={{ fontSize: 12, ...mono }}>NO EVENTS FOUND</div>
              <div style={{ fontSize: 11, color: BT.text.muted, marginTop: 4 }}>Adjust time range or category filters</div>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const badge = getImpactBadge(event.impact_severity);
              return (
                <div
                  key={event.id}
                  onClick={() => handleArticleClick(event)}
                  style={{
                    padding: 14,
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border.subtle}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = BT.bg.panelAlt;
                    e.currentTarget.style.borderColor = BT.text.cyan;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = BT.bg.panel;
                    e.currentTarget.style.borderColor = BT.border.subtle;
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: BT.text.primary, fontSize: 13, flex: 1 }}>{event.event_type}</span>
                    <span style={{
                      padding: '2px 8px',
                      fontSize: 9,
                      fontWeight: 700,
                      color: badge.color,
                      background: badge.bg,
                      letterSpacing: '0.06em',
                      marginLeft: 8,
                      flexShrink: 0,
                      ...mono,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 6 }}>{event.location_raw}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: BT.text.muted, ...mono }}>
                    <span>{event.city}, {event.state}</span>
                    <span style={{ color: BT.border.subtle }}>|</span>
                    <span style={{ color: event.source_type === 'email_private' ? BT.text.cyan : BT.text.muted }}>
                      {event.source_type === 'email_private' ? 'EMAIL INTEL' : 'PUBLIC'}
                    </span>
                    <span style={{ color: BT.border.subtle }}>|</span>
                    <span>{new Date(event.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderMarketDashboard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {!dashboard ? (
        <div style={{ textAlign: 'center', padding: 32, color: BT.text.secondary, ...mono }}>Loading dashboard...</div>
      ) : (
        <>
          <div style={{ padding: 16, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, ...mono }}>DEMAND MOMENTUM</div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: dashboard.demand_momentum.net_jobs >= 0 ? BT.text.green : BT.text.red,
              ...mono,
            }}>
              {dashboard.demand_momentum.momentum_pct > 0 ? '+' : ''}
              {dashboard.demand_momentum.momentum_pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginBottom: 12 }}>
              {dashboard.demand_momentum.net_jobs >= 0 ? 'Growth' : 'Decline'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: BT.text.secondary }}>Net Impact</span>
              <span style={{
                fontWeight: 600,
                color: dashboard.demand_momentum.net_jobs >= 0 ? BT.text.green : BT.text.red,
                ...mono,
              }}>
                {dashboard.demand_momentum.net_jobs >= 0 ? '+' : ''}
                {dashboard.demand_momentum.net_jobs.toLocaleString()} jobs
              </span>
            </div>
          </div>

          <div style={{ padding: 16, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, ...mono }}>SUPPLY PRESSURE</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: BT.text.amber, ...mono }}>
              {dashboard.supply_pressure.pressure_pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary }}>Pipeline pressure</div>
          </div>
        </>
      )}
    </div>
  );

  const renderNetworkIntelligence = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted }}>
          <div style={{ fontSize: 12, ...mono }}>NO CONTACTS</div>
          <div style={{ fontSize: 11, marginTop: 4, color: BT.text.muted }}>Network intelligence will appear here</div>
        </div>
      ) : (
        contacts.map((contact, idx) => (
          <div key={idx} style={{ padding: 12, background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: BT.text.primary }}>{contact.contact_name}</div>
                <div style={{ fontSize: 11, color: BT.text.secondary }}>{contact.contact_company}</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: BT.text.green, ...mono }}>
                  {(contact.credibility_score * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: 10, color: BT.text.muted, ...mono }}>{contact.total_signals} signals</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderAlerts = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: BT.text.muted }}>
          <div style={{ fontSize: 12, ...mono }}>NO ALERTS</div>
          <div style={{ fontSize: 11, marginTop: 4, color: BT.text.muted }}>Alerts will appear here when triggered</div>
        </div>
      ) : (
        alerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              padding: 14,
              background: alert.is_read ? BT.bg.panel : BT.bg.panelAlt,
              border: `1px solid ${alert.is_read ? BT.border.subtle : BT.text.cyan}`,
              borderLeft: alert.is_read ? undefined : `3px solid ${BT.text.cyan}`,
            }}
          >
            <div style={{
              fontWeight: 600,
              fontSize: 13,
              color: alert.is_read ? BT.text.secondary : BT.text.primary,
              marginBottom: 6,
            }}>
              {alert.headline}
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary }}>{alert.summary}</div>
          </div>
        ))
      )}
    </div>
  );

  const renderViewContent = () => {
    switch (activeView) {
      case 'feed': return renderEventFeed();
      case 'dashboard': return renderMarketDashboard();
      case 'network': return renderNetworkIntelligence();
      case 'alerts': return renderAlerts();
      default: return null;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BT.bg.terminal }}>
      {/* Context analysis is now surfaced inside the Neural Network Hub widget. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '12px 24px',
        background: BT.bg.panel,
        borderBottom: `1px solid ${BT.border.subtle}`,
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: BT.text.amber, marginRight: 20, letterSpacing: '0.06em', ...mono }}>NEWS INTELLIGENCE</h1>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: activeView === tab.id ? 700 : 500,
              background: activeView === tab.id ? BT.bg.active : 'transparent',
              color: activeView === tab.id ? BT.text.cyan : BT.text.secondary,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              ...mono,
            }}
          >
            {tab.label}
            {tab.id === 'alerts' && unreadAlertCount > 0 && (
              <span style={{
                padding: '1px 6px',
                fontSize: 9,
                fontWeight: 700,
                background: BT.text.red,
                color: '#fff',
                ...mono,
              }}>{unreadAlertCount}</span>
            )}
          </button>
        ))}
        {activeView === 'feed' && (
          <div style={{ marginLeft: 'auto', fontSize: 10, color: BT.text.muted, ...mono }}>{events.length} events</div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {renderViewContent()}
      </div>
      
      {/* Article Modal */}
      <ArticleModal />
    </div>
  );
}

export default NewsIntelligencePage;
