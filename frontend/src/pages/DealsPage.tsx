/**
 * Pipeline Page (Deals) - Using ThreePanelLayout
 * 
 * Views: All, Active, Qualified, Due Diligence, Closing, Closed
 * Content: Deal cards with tier badges
 * Map: Deal boundaries color-coded by tier
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout, ViewItem } from '../components/layout/ThreePanelLayout';
import { useDealStore } from '../stores/dealStore';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'all' | 'active' | 'qualified' | 'due_diligence' | 'closing' | 'closed';

const stageLabels: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  due_diligence: 'Due Diligence',
  under_contract: 'Under Contract',
  closing: 'Closing',
  closed: 'Closed',
};

const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  basic: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  pro: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  enterprise: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
};

export function DealsPage() {
  const navigate = useNavigate();
  const { deals, fetchDeals, isLoading } = useDealStore();
  
  const [activeView, setActiveView] = useState<ViewType>('all');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // Define views
  const views: ViewItem[] = [
    { id: 'all', label: 'All', icon: '📊', count: deals.length },
    { id: 'active', label: 'Active', icon: '🟢' },
    { id: 'qualified', label: 'Qualified', icon: '🔍' },
    { id: 'due_diligence', label: 'Due D.', icon: '📝' },
    { id: 'closing', label: 'Closing', icon: '🏁' },
    { id: 'closed', label: 'Closed', icon: '✅' },
  ];

  // Load deals on mount
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-84.388, 33.749],
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map with deals
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !deals.length) return;
    addDealsToMap(map.current, deals);
  }, [deals]);

  const addDealsToMap = (m: mapboxgl.Map, deals: any[]) => {
    // Remove existing layers
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
          'basic', '#fbbf24',
          'pro', '#3b82f6',
          'enterprise', '#10b981',
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
          'basic', '#f59e0b',
          'pro', '#2563eb',
          'enterprise', '#059669',
          '#4b5563',
        ],
        'line-width': 2,
      },
    });

    // Add click handler
    m.on('click', 'deal-fills', (e) => {
      if (e.features && e.features[0]) {
        const dealId = e.features[0].properties?.id;
        if (dealId) navigate(`/deals/${dealId}`);
      }
    });

    // Change cursor on hover
    m.on('mouseenter', 'deal-fills', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'deal-fills', () => {
      m.getCanvas().style.cursor = '';
    });
  };

  // Filter deals by view
  const filteredDeals = deals.filter((deal) => {
    if (activeView === 'all') return true;
    if (activeView === 'active') return ['lead', 'qualified', 'due_diligence'].includes(deal.status);
    return deal.status === activeView;
  });

  // Content renderer
  const renderContent = (viewId: string) => {
    if (isLoading) {
      return <div className="text-center py-8 text-gray-500">Loading deals...</div>;
    }

    if (filteredDeals.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div>No deals found</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + Create Deal
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredDeals.map((deal) => {
          const tierStyle = tierColors[deal.tier] || tierColors.basic;
          
          return (
            <div
              key={deal.id}
              onClick={() => navigate(`/deals/${deal.id}`)}
              className={`bg-white rounded-lg border-2 ${tierStyle.border} p-4 cursor-pointer hover:shadow-md transition-shadow`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${tierStyle.bg} ${tierStyle.text}`}>
                      {deal.tier.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {stageLabels[deal.status] || deal.status}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900">{deal.name}</h3>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-600">Type</div>
                  <div className="font-medium capitalize">{deal.projectType?.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-gray-600">Status</div>
                  <div className="font-medium capitalize">{deal.status}</div>
                </div>
                {deal.boundary && (
                  <div>
                    <div className="text-gray-600">Area</div>
                    <div className="font-medium">
                      {(deal.boundary as any).area || '-'} acres
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-gray-600">Created</div>
                  <div className="font-medium">
                    {new Date(deal.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Footer */}
              {deal.propertyAddress && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600 line-clamp-2">{deal.propertyAddress}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Map renderer
  const renderMap = () => (
    <>
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 z-10">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Deal Tiers</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-500" />
            <span>Basic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500" />
            <span>Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>Enterprise</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <ThreePanelLayout
      storageKey="pipeline"
      views={views}
      activeView={activeView}
      onViewChange={(viewId) => setActiveView(viewId as ViewType)}
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}

export default DealsPage;
