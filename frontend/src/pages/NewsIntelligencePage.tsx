import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../stores/dealStore';
import { newsService, NewsEvent, NewsAlert, MarketDashboard, ContactCredibility } from '../services/news.service';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

export function NewsIntelligencePage() {
  const { deals, fetchDeals } = useDealStore();
  
  const [showViewsSidebar, setShowViewsSidebar] = useState(
    localStorage.getItem('news-views-visible') !== 'false'
  );
  const [showContentPanel, setShowContentPanel] = useState(
    localStorage.getItem('news-content-visible') !== 'false'
  );
  const [viewsWidth, setViewsWidth] = useState(
    parseInt(localStorage.getItem('news-views-width') || '256')
  );
  const [contentWidth, setContentWidth] = useState(
    parseInt(localStorage.getItem('news-content-width') || '550')
  );

  const [activeView, setActiveView] = useState<ViewType>('feed');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  const [isResizingViews, setIsResizingViews] = useState(false);
  const [isResizingContent, setIsResizingContent] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const eventMarkers = useRef<mapboxgl.Marker[]>([]);

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

  useEffect(() => {
    fetchDeals();
    loadData();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [selectedCategory]);

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

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-84.388, 33.749],
        zoom: 11
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch (err) {
      console.error('Map initialization error:', err);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !deals.length) return;

    const m = map.current;

    if (!m.loaded()) {
      m.on('load', () => addDealsToMap(m, deals));
    } else {
      addDealsToMap(m, deals);
    }
  }, [deals]);

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    if (m.getSource('deals')) {
      if (m.getLayer('deal-fills')) m.removeLayer('deal-fills');
      if (m.getLayer('deal-borders')) m.removeLayer('deal-borders');
      m.removeSource('deals');
    }

    const geojson = {
      type: 'FeatureCollection',
      features: deals
        .filter(deal => deal.boundary?.type && deal.boundary?.coordinates)
        .map(deal => ({
          type: 'Feature',
          geometry: deal.boundary,
          properties: {
            id: deal.id,
            name: deal.name,
            tier: deal.tier,
          }
        }))
    };

    m.addSource('deals', { type: 'geojson', data: geojson as any });

    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': ['match', ['get', 'tier'],
          'basic', '#fbbf24',
          'pro', '#3b82f6',
          'enterprise', '#10b981',
          '#6b7280'
        ],
        'fill-opacity': 0.2
      }
    });

    m.addLayer({
      id: 'deal-borders',
      type: 'line',
      source: 'deals',
      paint: {
        'line-color': ['match', ['get', 'tier'],
          'basic', '#f59e0b',
          'pro', '#2563eb',
          'enterprise', '#059669',
          '#4b5563'
        ],
        'line-width': 2
      }
    });
  };

  const handleEventClick = (event: NewsEvent) => {
    setSelectedEvent(event.id);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return '1d ago';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getSeverityLabel = (severity?: string) => {
    switch (severity) {
      case 'high': case 'critical': return '⚠️ High Impact';
      case 'significant': return '🔥 Significant';
      case 'moderate': return '⚡ Moderate Impact';
      default: return 'ℹ️ Low Impact';
    }
  };

  const getSeverityClass = (severity?: string) => {
    switch (severity) {
      case 'high': case 'critical': return 'bg-orange-100 text-orange-700';
      case 'significant': return 'bg-red-100 text-red-700';
      case 'moderate': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingViews) {
        const newWidth = Math.max(200, Math.min(400, e.clientX));
        setViewsWidth(newWidth);
        localStorage.setItem('news-views-width', String(newWidth));
      }
      if (isResizingContent) {
        const newWidth = Math.max(400, Math.min(800, e.clientX - (showViewsSidebar ? viewsWidth : 0)));
        setContentWidth(newWidth);
        localStorage.setItem('news-content-width', String(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsResizingViews(false);
      setIsResizingContent(false);
    };

    if (isResizingViews || isResizingContent) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingViews, isResizingContent, showViewsSidebar, viewsWidth]);

  useEffect(() => {
    localStorage.setItem('news-views-visible', String(showViewsSidebar));
  }, [showViewsSidebar]);

  useEffect(() => {
    localStorage.setItem('news-content-visible', String(showContentPanel));
  }, [showContentPanel]);

  const renderEventFeed = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors font-medium ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="mr-2">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📰</div>
          <div>No events found</div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const data = event.extracted_data || {};
            const impact = event.impact_analysis || {};
            const headline = data.company_name
              ? `${data.company_name} ${event.event_type?.replace(/_/g, ' ')} - ${data.employee_count?.toLocaleString() || ''} employees`
              : data.project_name
              ? `${data.project_name} - ${data.unit_count || ''} units`
              : `${event.event_type?.replace(/_/g, ' ')} in ${event.location_raw}`;

            return (
              <div
                key={event.id}
                id={`event-${event.id}`}
                onClick={() => handleEventClick(event)}
                className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
                  selectedEvent === event.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-base flex-1">
                    {headline}
                  </h3>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {event.source_type === 'email_private' && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                        🔵 Email Intel
                      </span>
                    )}
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getSeverityClass(event.impact_severity)}`}>
                      {getSeverityLabel(event.impact_severity)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">📍 {event.location_raw}</span>
                  <span>•</span>
                  <span>{formatTimestamp(event.published_at)}</span>
                  {event.early_signal_days && (
                    <>
                      <span>•</span>
                      <span className="text-green-600 font-medium">
                        {event.early_signal_days} days early
                      </span>
                    </>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  {impact.housing_demand && (
                    <div className="text-sm text-gray-700">
                      <strong>Demand Impact:</strong> ~{impact.housing_demand.toLocaleString()} housing units needed
                      {impact.target_rent_range && ` • Target rent: $${impact.target_rent_range[0]?.toLocaleString()}–$${impact.target_rent_range[1]?.toLocaleString()}/mo`}
                    </div>
                  )}
                  {impact.supply_pressure && (
                    <div className="text-sm text-gray-700">
                      <strong>Supply Impact:</strong> {(impact.supply_pressure * 100).toFixed(1)}% supply pressure increase
                    </div>
                  )}
                  {impact.cap_rate_trend && (
                    <div className="text-sm text-gray-700">
                      <strong>Market Signal:</strong> {impact.market_signal?.replace(/_/g, ' ')} • Cap rates {impact.cap_rate_trend}
                    </div>
                  )}
                  {impact.development_potential && (
                    <div className="text-sm text-gray-700">
                      <strong>Development:</strong> {impact.development_potential} potential
                      {impact.land_value_impact && ` • Land value +${(impact.land_value_impact * 100).toFixed(0)}%`}
                    </div>
                  )}
                  {impact.property_value_impact && (
                    <div className="text-sm text-gray-700">
                      <strong>Value Impact:</strong> +{(impact.property_value_impact * 100).toFixed(0)}% property value increase expected
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-600">
                    Source: <span className="font-medium">{event.source_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      Confidence: {(event.extraction_confidence * 100).toFixed(0)}%
                    </span>
                    {(event.affected_deals_count ?? 0) > 0 && (
                      <span className="text-blue-600 font-medium">
                        {event.affected_deals_count} {Number(event.affected_deals_count) === 1 ? 'deal' : 'deals'} affected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMarketDashboard = () => (
    <div className="space-y-4">
      {!dashboard ? (
        <div className="text-center py-8 text-gray-500">Loading dashboard...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Demand Momentum</h3>
            <div className={`text-3xl font-bold mb-1 ${dashboard.demand_momentum.net_jobs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboard.demand_momentum.momentum_pct > 0 ? '+' : ''}{dashboard.demand_momentum.momentum_pct.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {dashboard.demand_momentum.net_jobs >= 0 ? 'Growth' : 'Decline'}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Inbound jobs</span>
                <span className="font-medium text-green-600">+{dashboard.demand_momentum.inbound_jobs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Outbound jobs</span>
                <span className="font-medium text-red-600">-{dashboard.demand_momentum.outbound_jobs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Net Impact</span>
                <span className={`font-semibold ${dashboard.demand_momentum.net_jobs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {dashboard.demand_momentum.net_jobs >= 0 ? '+' : ''}{dashboard.demand_momentum.net_jobs.toLocaleString()} jobs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Housing Demand</span>
                <span className="font-medium">{dashboard.demand_momentum.estimated_housing_demand.toLocaleString()} units</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Supply Pressure</h3>
            <div className="text-3xl font-bold text-yellow-600 mb-1">{dashboard.supply_pressure.pressure_pct.toFixed(1)}%</div>
            <div className="text-sm text-gray-600 mb-3">Pipeline pressure</div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Pipeline units</span>
                <span className="font-medium">{dashboard.supply_pressure.pipeline_units.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active projects</span>
                <span className="font-medium">{dashboard.supply_pressure.project_count}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-3">Transaction Activity</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Recent transactions</span>
                <span className="font-medium">{dashboard.transaction_activity.count}</span>
              </div>
              {dashboard.transaction_activity.avg_cap_rate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg cap rate</span>
                  <span className="font-medium">{dashboard.transaction_activity.avg_cap_rate.toFixed(1)}%</span>
                </div>
              )}
              {dashboard.transaction_activity.avg_price_per_unit && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg $/unit</span>
                  <span className="font-medium">${dashboard.transaction_activity.avg_price_per_unit.toLocaleString()}</span>
                </div>
              )}
            </div>
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
          <div>No contacts with enough signals yet</div>
          <div className="text-xs mt-1">Contacts appear after 3+ intelligence signals</div>
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
            <div className="flex items-start justify-between mb-2">
              <h3 className={`font-semibold text-sm flex-1 ${alert.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                {alert.headline}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ml-2 ${getSeverityClass(alert.severity)}`}>
                {alert.severity}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{alert.summary}</p>
            {alert.suggested_action && (
              <div className="bg-blue-50 rounded p-2 text-xs text-blue-700">
                <strong>Suggested:</strong> {alert.suggested_action}
              </div>
            )}
            {!alert.is_read && (
              <button
                onClick={async () => {
                  try {
                    await newsService.updateAlert(alert.id, { is_read: true });
                    setAlerts(alerts.map(a => a.id === alert.id ? { ...a, is_read: true } : a));
                    setUnreadAlertCount(prev => Math.max(0, prev - 1));
                  } catch (e) {
                    console.error('Error marking alert read:', e);
                  }
                }}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Mark as read
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="h-full flex relative">
      {showViewsSidebar && (
        <>
          <div
            className="bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0"
            style={{ width: `${viewsWidth}px` }}
          >
            <div className="p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">VIEWS</h2>
              <div className="space-y-1">
                {[
                  { id: 'feed', icon: '📋', label: 'Event Feed' },
                  { id: 'dashboard', icon: '📊', label: 'Market Dashboard' },
                  { id: 'network', icon: '🔗', label: 'Network Intelligence' },
                  { id: 'alerts', icon: '🔔', label: 'Alerts', badge: unreadAlertCount },
                ].map((view) => (
                  <button
                    key={view.id}
                    onClick={() => setActiveView(view.id as ViewType)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                      activeView === view.id
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{view.icon}</span>
                    <span>{view.label}</span>
                    {view.badge ? (
                      <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full">
                        {view.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={() => setIsResizingViews(true)}
          />
        </>
      )}

      {showContentPanel && (
        <>
          <div
            className="bg-gray-50 overflow-y-auto flex-shrink-0"
            style={{ width: `${contentWidth}px` }}
          >
            <div className="p-4">
              <h1 className="text-xl font-bold text-gray-900 mb-4">
                {activeView === 'feed' && '📋 Event Feed'}
                {activeView === 'dashboard' && '📊 Market Dashboard'}
                {activeView === 'network' && '🔗 Network Intelligence'}
                {activeView === 'alerts' && '🔔 Alerts'}
              </h1>
              {activeView === 'feed' && renderEventFeed()}
              {activeView === 'dashboard' && renderMarketDashboard()}
              {activeView === 'network' && renderNetworkIntelligence()}
              {activeView === 'alerts' && renderAlerts()}
            </div>
          </div>
          <div
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={() => setIsResizingContent(true)}
          />
        </>
      )}

      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        
        <div className="absolute top-4 left-4 flex gap-2 z-10">
          <button
            onClick={() => setShowViewsSidebar(!showViewsSidebar)}
            className="px-3 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition text-sm font-medium"
            title="Toggle Views Sidebar"
          >
            {showViewsSidebar ? '◀ Hide Views' : '▶ Views'}
          </button>
          <button
            onClick={() => setShowContentPanel(!showContentPanel)}
            className="px-3 py-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition text-sm font-medium"
            title="Toggle Content Panel"
          >
            {showContentPanel ? '◀ Hide Content' : '▶ Content'}
          </button>
        </div>

        <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 z-10">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Legend</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
              <span>Employment</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white" />
              <span>Development</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
              <span>Transactions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
