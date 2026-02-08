import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { useDealStore } from '../stores/dealStore';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'feed' | 'dashboard' | 'network' | 'alerts';

export function NewsIntelligencePage() {
  const { deals, fetchDeals } = useDealStore();
  
  // Panel visibility and widths
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
    parseInt(localStorage.getItem('news-content-width') || '384')
  );

  const [activeView, setActiveView] = useState<ViewType>('feed');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  // Resize state
  const [isResizingViews, setIsResizingViews] = useState(false);
  const [isResizingContent, setIsResizingContent] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const eventMarkers = useRef<mapboxgl.Marker[]>([]);

  const categories = [
    { id: 'all', label: 'All Events', icon: '📋' },
    { id: 'employment', label: 'Employment', icon: '👥' },
    { id: 'development', label: 'Development', icon: '🏗️' },
    { id: 'transactions', label: 'Transactions', icon: '💰' },
    { id: 'government', label: 'Government', icon: '🏛️' },
    { id: 'amenities', label: 'Amenities', icon: '🏪' },
  ];

  const mockEvents = [
    {
      id: 1,
      category: 'employment',
      type: 'company_relocation_inbound',
      headline: 'Microsoft relocating 3,200 employees to Midtown Atlanta',
      source: 'Atlanta Business Chronicle',
      sourceType: 'public',
      date: '2 hours ago',
      location: 'Midtown Atlanta, GA',
      coordinates: [-84.385, 33.785],
      impact: {
        housingDemand: 2100,
        targetRent: [1800, 3200],
        severity: 'high',
      },
      affectedDeals: 2,
      confidence: 0.92,
    },
    {
      id: 2,
      category: 'development',
      type: 'multifamily_permit_approval',
      headline: '400-unit luxury apartment project approved in Buckhead',
      source: 'Email: John Smith (CBRE)',
      sourceType: 'email',
      date: '4 hours ago',
      location: 'Buckhead, Atlanta, GA',
      coordinates: [-84.388, 33.835],
      impact: {
        supplyPressure: 0.08,
        severity: 'moderate',
      },
      affectedDeals: 1,
      confidence: 0.78,
      earlySignalDays: 14,
    },
    {
      id: 3,
      category: 'transactions',
      type: 'property_sale',
      headline: 'Summit Ridge Apartments sells for $68M ($272K/unit)',
      source: 'Real Capital Analytics',
      sourceType: 'public',
      date: '1 day ago',
      location: 'Peachtree Corners, GA',
      coordinates: [-84.220, 33.970],
      impact: {
        compDeviation: 0.12,
        severity: 'medium',
      },
      affectedDeals: 3,
      confidence: 0.95,
    },
  ];

  // Initialize map
  useEffect(() => {
    fetchDeals();
    
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

  // Add deals and events to map
  useEffect(() => {
    if (!map.current || !deals.length) return;

    const m = map.current;

    if (!m.loaded()) {
      m.on('load', () => {
        addDealsToMap(m, deals);
        addEventsToMap(m, mockEvents);
      });
    } else {
      addDealsToMap(m, deals);
      addEventsToMap(m, mockEvents);
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

  const addEventsToMap = (m: mapboxgl.Map, events: any[]) => {
    // Clear existing markers
    eventMarkers.current.forEach(marker => marker.remove());
    eventMarkers.current = [];

    // Add new markers
    events.forEach(event => {
      const el = document.createElement('div');
      el.className = 'event-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      el.style.transition = 'transform 0.2s';
      
      const color = 
        event.category === 'employment' ? '#3b82f6' :
        event.category === 'development' ? '#f97316' :
        event.category === 'transactions' ? '#10b981' :
        event.category === 'government' ? '#8b5cf6' :
        '#6b7280';
      
      el.style.backgroundColor = color;
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });
      
      el.addEventListener('click', () => {
        setSelectedEvent(event.id);
        // Scroll to event in content panel
        const eventElement = document.getElementById(`event-${event.id}`);
        if (eventElement) {
          eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat(event.coordinates as [number, number])
        .addTo(m);

      eventMarkers.current.push(marker);
    });
  };

  const handleEventClick = (event: any) => {
    setSelectedEvent(event.id);
    if (map.current && event.coordinates) {
      map.current.flyTo({
        center: event.coordinates,
        zoom: 13,
        duration: 1000
      });
    }
  };

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingViews) {
        const newWidth = Math.max(200, Math.min(400, e.clientX));
        setViewsWidth(newWidth);
        localStorage.setItem('news-views-width', String(newWidth));
      }
      if (isResizingContent) {
        const newWidth = Math.max(300, Math.min(600, e.clientX - (showViewsSidebar ? viewsWidth : 0)));
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

  // Save visibility state
  useEffect(() => {
    localStorage.setItem('news-views-visible', String(showViewsSidebar));
  }, [showViewsSidebar]);

  useEffect(() => {
    localStorage.setItem('news-content-visible', String(showContentPanel));
  }, [showContentPanel]);

  const renderEventFeed = () => (
    <div className="space-y-4">
      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            id={`event-${event.id}`}
            onClick={() => handleEventClick(event)}
            className={`bg-white rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
              selectedEvent === event.id ? 'border-blue-500 shadow-lg' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">
                  {event.headline}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>📍 {event.location}</span>
                  <span>•</span>
                  <span>{event.date}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-2">
                {event.sourceType === 'email' && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                    🔵 Email
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${
                    event.impact.severity === 'high'
                      ? 'bg-red-100 text-red-700'
                      : event.impact.severity === 'moderate'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {event.impact.severity === 'high' ? '⚠️ High' : 
                   event.impact.severity === 'moderate' ? '⚡ Moderate' : 'ℹ️ Low'}
                </span>
              </div>
            </div>

            <div className="bg-gray-50 rounded p-2 text-xs text-gray-700">
              {event.impact.housingDemand && (
                <div>~{event.impact.housingDemand.toLocaleString()} housing units needed</div>
              )}
              {event.impact.supplyPressure && (
                <div>{(event.impact.supplyPressure * 100).toFixed(1)}% supply pressure increase</div>
              )}
              {event.impact.compDeviation && (
                <div>{(event.impact.compDeviation * 100).toFixed(0)}% above market average</div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs mt-2">
              <span className="text-gray-600">{event.source}</span>
              <span className="text-gray-500">
                {(event.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMarketDashboard = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Demand Momentum</h3>
        <div className="text-3xl font-bold text-green-600 mb-1">+3.2%</div>
        <div className="text-sm text-gray-600 mb-3">Strong growth</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Inbound jobs</span>
            <span className="font-medium text-green-600">+4,200</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Net Impact</span>
            <span className="font-semibold text-green-600">+3,200 jobs</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold mb-3">Supply Pressure</h3>
        <div className="text-3xl font-bold text-yellow-600 mb-1">8.5%</div>
        <div className="text-sm text-gray-600 mb-3">Moderate pressure</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Pipeline units</span>
            <span className="font-medium">1,800</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Existing inventory</span>
            <span className="font-medium">21,200</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderNetworkIntelligence = () => (
    <div className="space-y-3">
      {[
        { name: 'John Smith', company: 'CBRE', credibility: 0.88, signals: 13 },
        { name: 'Sarah Johnson', company: 'JLL', credibility: 0.75, signals: 8 },
        { name: 'Mike Davis', company: 'Colliers', credibility: 0.82, signals: 11 },
      ].map((contact, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">{contact.name}</div>
              <div className="text-xs text-gray-600">{contact.company}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-green-600">
                {(contact.credibility * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">{contact.signals} signals</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-full flex relative">
      {/* Views Sidebar */}
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
                  { id: 'alerts', icon: '🔔', label: 'Alerts', badge: 3 },
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
                    {view.badge && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full">
                        {view.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Resize handle */}
          <div
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={() => setIsResizingViews(true)}
          />
        </>
      )}

      {/* Content Panel */}
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
              {activeView === 'alerts' && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Alerts view coming soon
                </div>
              )}
            </div>
          </div>
          {/* Resize handle */}
          <div
            className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={() => setIsResizingContent(true)}
          />
        </>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        
        {/* Toggle Controls */}
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

        {/* Legend */}
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
