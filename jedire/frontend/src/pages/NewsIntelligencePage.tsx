/**
 * News Intelligence Page - Using ThreePanelLayout
 * 
 * Views: Event Feed, Market Dashboard, Network Intelligence, Alerts
 * Content: Event cards, metrics, contact cards, alert cards
 * Map: Event markers, deal boundaries
 */

import React, { useState, useRef, useEffect } from 'react';
import { newsService, NewsEvent, NewsAlert, MarketDashboard, ContactCredibility } from '../services/news.service';
import { DateRangeFilter, DateRangeOption, getDateRangeFromOption } from '../components/ui/DateRangeFilter';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

const tabs: { id: ViewType; label: string; icon: string }[] = [
  { id: 'feed', label: 'Event Feed', icon: '📋' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'network', label: 'Network', icon: '🔗' },
  { id: 'alerts', label: 'Alerts', icon: '🔔' },
];

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
    { id: 'all', label: 'All Events', icon: '📋' },
    { id: 'employment', label: 'Employment', icon: '👥' },
    { id: 'development', label: 'Development', icon: '🏗️' },
    { id: 'transactions', label: 'Transactions', icon: '💰' },
    { id: 'government', label: 'Government', icon: '🏛️' },
    { id: 'amenities', label: 'Amenities', icon: '🏪' },
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

  // Filter events by date range
  const filterEventsByDate = (events: NewsEvent[]): NewsEvent[] => {
    const { start, end } = getDateRangeFromOption(dateRange, customStartDate, customEndDate);
    
    if (!start) {
      return events; // "All time" - no filtering
    }
    
    return events.filter((event) => {
      const eventDate = new Date(event.published_at);
      return eventDate >= start && eventDate <= end;
    });
  };

  // Render functions for each view
  const renderEventFeed = () => {
    const filteredEvents = filterEventsByDate(events);
    
    return (
      <div className="space-y-4 max-w-4xl">
        {/* Date Range Filter */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Time Range</div>
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

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-sm transition-colors ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="mr-1.5">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

        {/* Event Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📰</div>
              <div>No events found in this time range</div>
            </div>
          ) : (
            filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 flex-1">{event.event_type}</h3>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ml-2 ${
                    event.impact_severity === 'high' || event.impact_severity === 'critical'
                      ? 'bg-orange-100 text-orange-700'
                      : event.impact_severity === 'moderate' || event.impact_severity === 'significant'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {event.impact_severity === 'high' || event.impact_severity === 'critical'
                    ? '⚠️ High Impact'
                    : event.impact_severity === 'moderate' || event.impact_severity === 'significant'
                    ? '⚡ Moderate'
                    : 'ℹ️ Low Impact'}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-2">{event.location_raw}</div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>📍 {event.city}, {event.state}</span>
                <span>•</span>
                <span>{event.source_type === 'email_private' ? '🔵 Email Intel' : 'Public'}</span>
                <span>•</span>
                <span>{new Date(event.published_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  };

  const renderMarketDashboard = () => (
    <div className="space-y-4">
      {!dashboard ? (
        <div className="text-center py-8 text-gray-500">Loading dashboard...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Demand Momentum</h3>
            <div
              className={`text-3xl font-bold mb-1 ${
                dashboard.demand_momentum.net_jobs >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {dashboard.demand_momentum.momentum_pct > 0 ? '+' : ''}
              {dashboard.demand_momentum.momentum_pct.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {dashboard.demand_momentum.net_jobs >= 0 ? 'Growth' : 'Decline'}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Net Impact</span>
                <span
                  className={`font-semibold ${
                    dashboard.demand_momentum.net_jobs >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {dashboard.demand_momentum.net_jobs >= 0 ? '+' : ''}
                  {dashboard.demand_momentum.net_jobs.toLocaleString()} jobs
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Supply Pressure</h3>
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {dashboard.supply_pressure.pressure_pct.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mb-3">Pipeline pressure</div>
          </div>
        </>
      )}
    </div>
  );

  const renderNetworkIntelligence = () => (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🔗</div>
          <div>No contacts yet</div>
        </div>
      ) : (
        contacts.map((contact, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{contact.contact_name}</div>
                <div className="text-xs text-gray-600">{contact.contact_company}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-600">
                  {(contact.credibility_score * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-500">{contact.total_signals} signals</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-3">
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🔔</div>
          <div>No alerts</div>
        </div>
      ) : (
        alerts.map((alert) => (
          <div
            key={alert.id}
            className={`bg-white rounded-lg border p-4 ${
              alert.is_read ? 'border-gray-200' : 'border-blue-300 bg-blue-50'
            }`}
          >
            <h3
              className={`font-semibold text-sm mb-2 ${
                alert.is_read ? 'text-gray-700' : 'text-gray-900'
              }`}
            >
              {alert.headline}
            </h3>
            <p className="text-sm text-gray-600">{alert.summary}</p>
          </div>
        ))
      )}
    </div>
  );

  const renderViewContent = () => {
    switch (activeView) {
      case 'feed':
        return renderEventFeed();
      case 'dashboard':
        return renderMarketDashboard();
      case 'network':
        return renderNetworkIntelligence();
      case 'alerts':
        return renderAlerts();
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900 mr-6">News Intelligence</h1>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeView === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === 'alerts' && unreadAlertCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">{unreadAlertCount}</span>
            )}
          </button>
        ))}
        {activeView === 'feed' && (
          <div className="ml-auto text-xs text-gray-500">{events.length} events</div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {renderViewContent()}
      </div>
    </div>
  );
}

export default NewsIntelligencePage;
