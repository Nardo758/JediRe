/**
 * News Intelligence Page - Using ThreePanelLayout
 * 
 * Views: Event Feed, Market Dashboard, Network Intelligence, Alerts
 * Content: Event cards, metrics, contact cards, alert cards
 * Map: Event markers, deal boundaries
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { useDealStore } from '../stores/dealStore';
import { newsService, NewsEvent, NewsAlert, MarketDashboard, ContactCredibility } from '../services/news.service';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

function getNewsViewFromPath(pathname: string): ViewType {
  if (pathname.endsWith('/dashboard')) return 'dashboard';
  if (pathname.endsWith('/network')) return 'network';
  if (pathname.endsWith('/alerts')) return 'alerts';
  return 'feed';
}

export function NewsIntelligencePage() {
  const { deals, fetchDeals } = useDealStore();
  const location = useLocation();
  
  const activeView = getNewsViewFromPath(location.pathname);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
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

  // Load data on mount
  useEffect(() => {
    fetchDeals();
    loadData();
  }, []);

  // Load events when category changes
  useEffect(() => {
    loadEvents();
  }, [selectedCategory]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-84.388, 33.749], // Atlanta
      zoom: 10,
    });

    map.current.on('load', () => {
      if (map.current && deals.length > 0) {
        addDealsToMap(map.current, deals);
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map when deals change
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      addDealsToMap(map.current, deals);
    }
  }, [deals]);

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

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    if (m.getSource('deals')) {
      if (m.getLayer('deal-fills')) m.removeLayer('deal-fills');
      if (m.getLayer('deal-borders')) m.removeLayer('deal-borders');
      m.removeSource('deals');
    }

    const geojson = {
      type: 'FeatureCollection',
      features: deals
        .filter((deal) => deal.boundary?.type && deal.boundary?.coordinates)
        .map((deal) => ({
          type: 'Feature',
          geometry: deal.boundary,
          properties: {
            id: deal.id,
            name: deal.name,
            tier: deal.tier,
          },
        })),
    };

    m.addSource('deals', { type: 'geojson', data: geojson as any });

    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': [
          'match',
          ['get', 'tier'],
          'basic',
          '#fbbf24',
          'pro',
          '#3b82f6',
          'enterprise',
          '#10b981',
          '#6b7280',
        ],
        'fill-opacity': 0.2,
      },
    });

    m.addLayer({
      id: 'deal-borders',
      type: 'line',
      source: 'deals',
      paint: {
        'line-color': [
          'match',
          ['get', 'tier'],
          'basic',
          '#f59e0b',
          'pro',
          '#2563eb',
          'enterprise',
          '#059669',
          '#4b5563',
        ],
        'line-width': 2,
      },
    });
  };

  // Render functions for each view
  const renderEventFeed = () => (
    <div className="space-y-4">
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
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📰</div>
            <div>No events found</div>
          </div>
        ) : (
          events.map((event) => (
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

  // Content renderer for ThreePanelLayout
  const renderContent = (viewId: string) => {
    switch (viewId) {
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

  // Map renderer for ThreePanelLayout
  const renderMap = () => (
    <>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map Legend */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 z-10">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Legend</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span>Employment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500" />
            <span>Development</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Transactions</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <ThreePanelLayout
      storageKey="news"
      showViewsPanel={false}
      renderContent={() => renderContent(activeView)}
      renderMap={renderMap}
    />
  );
}

export default NewsIntelligencePage;
