import React, { useState, useRef, useEffect } from 'react';
import { newsService, NewsEvent, NewsAlert, MarketDashboard, ContactCredibility } from '../services/news.service';
import { DateRangeFilter, DateRangeOption, getDateRangeFromOption } from '../components/ui/DateRangeFilter';
import { BT } from '../components/deal/bloomberg-ui';

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

  const categories = [
    { id: 'all', label: 'ALL' },
    { id: 'employment', label: 'EMPLOYMENT' },
    { id: 'development', label: 'DEVELOPMENT' },
    { id: 'transactions', label: 'TRANSACTIONS' },
    { id: 'government', label: 'GOVERNMENT' },
    { id: 'amenities', label: 'AMENITIES' },
  ];

  const prevCategory = useRef(selectedCategory);
  const prevDateRange = useRef(dateRange);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (prevCategory.current !== selectedCategory || prevDateRange.current !== dateRange) {
      prevCategory.current = selectedCategory;
      prevDateRange.current = dateRange;
      loadEvents();
    }
  }, [selectedCategory, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, alertsRes, dashRes, networkRes] = await Promise.all([
        newsService.getEvents({ category: selectedCategory !== 'all' ? selectedCategory : undefined }),
        newsService.getAlerts(),
        newsService.getDashboard(),
        newsService.getNetworkIntelligence(),
      ]);

      if (eventsRes.success) setEvents(eventsRes.data);
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
      const res = await newsService.getEvents({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      if (res.success) setEvents(res.data);
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

  const getImpactBadge = (severity: string): { label: string; color: string; bg: string } => {
    if (severity === 'high' || severity === 'critical')
      return { label: 'HIGH', color: BT.text.red, bg: 'rgba(255,71,87,0.12)' };
    if (severity === 'moderate' || severity === 'significant')
      return { label: 'MOD', color: BT.text.amber, bg: 'rgba(245,166,35,0.12)' };
    return { label: 'LOW', color: BT.text.cyan, bg: 'rgba(0,188,212,0.12)' };
  };

  const renderEventFeed = () => {
    const filteredEvents = filterEventsByDate(events);
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
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 14px',
                background: selectedCategory === cat.id ? BT.text.cyan : BT.bg.panel,
                color: selectedCategory === cat.id ? BT.bg.terminal : BT.text.secondary,
                border: selectedCategory === cat.id ? 'none' : `1px solid ${BT.border.subtle}`,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                ...mono,
              }}
            >
              {cat.label}
            </button>
          ))}
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
                  style={{
                    padding: 14,
                    background: BT.bg.panel,
                    border: `1px solid ${BT.border.subtle}`,
                    cursor: 'pointer',
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
    </div>
  );
}

export default NewsIntelligencePage;
