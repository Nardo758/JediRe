/**
 * Pipeline Page (Deals) - Kanban Board with Map
 * 
 * Full-width Kanban board showing all deal stages
 * Content: Draggable deal cards organized by stage
 * Map: Deal boundaries color-coded by tier
 */

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { MoreVertical, MapPin, DollarSign, Clock } from 'lucide-react';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { useDealStore } from '../stores/dealStore';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export function DealsPage() {
  const navigate = useNavigate();
  const { deals, fetchDeals, updateDeal, isLoading } = useDealStore();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

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

  // Handle deal stage change
  const handleDealMove = async (dealId: string, newStage: string) => {
    try {
      await updateDeal(dealId, { status: newStage });
      // Optionally show a success toast
    } catch (error) {
      console.error('Failed to update deal:', error);
      // Optionally show an error toast
    }
  };

  const stages = [
    { id: 'lead', label: 'Watching', color: 'bg-gray-500' },
    { id: 'qualified', label: 'Analyzing', color: 'bg-blue-500' },
    { id: 'due_diligence', label: 'Due Diligence', color: 'bg-yellow-500' },
    { id: 'under_contract', label: 'Offer', color: 'bg-purple-500' },
    { id: 'closing', label: 'Closing', color: 'bg-green-500' },
  ];

  const [draggedDeal, setDraggedDeal] = React.useState<any>(null);

  const getDealsForStage = (stageId: string) => deals.filter(d => d.status === stageId);
  
  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(n);
  
  const getDaysInStage = (createdAt: string) => {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };
  
  const getStrategyColor = (strategy?: string) => {
    const colors: Record<string, string> = {
      'build_to_sell': 'bg-green-100 text-green-700',
      'flip': 'bg-blue-100 text-blue-700',
      'rental': 'bg-purple-100 text-purple-700',
      'airbnb': 'bg-orange-100 text-orange-700',
      'development': 'bg-pink-100 text-pink-700',
    };
    return colors[strategy || ''] || 'bg-gray-100 text-gray-700';
  };

  // Content renderer
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          Loading deals...
        </div>
      );
    }

    if (deals.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-xl mb-2">No deals found</div>
          <p className="text-sm mb-6">Create your first deal to get started</p>
          <button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Create Deal
          </button>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        {/* Header with toggle */}
        <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Pipeline - Kanban View</h2>
          <button
            onClick={() => navigate('/deals/grid')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Switch to Grid View →
          </button>
        </div>
        
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full p-6 min-w-max">
            {stages.map(stage => {
              const stageDeals = getDealsForStage(stage.id);
            
            return (
              <div
                key={stage.id}
                className="w-80 bg-gray-200 rounded-xl p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedDeal) {
                    handleDealMove(draggedDeal.id, stage.id);
                    setDraggedDeal(null);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                  </div>
                  <span className="text-sm text-gray-500 bg-white px-2 py-0.5 rounded">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {stageDeals.map(deal => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => setDraggedDeal(deal)}
                      onClick={() => navigate(`/deals/${deal.id}`)}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{deal.name}</h4>
                          {deal.propertyAddress && (
                            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {deal.propertyAddress}
                            </p>
                          )}
                        </div>
                        <button 
                          className="text-gray-400 hover:text-gray-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Add menu actions
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm mb-3">
                        <span className="text-gray-900 font-semibold flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          {deal.estimatedValue ? formatCurrency(deal.estimatedValue) : 'TBD'}
                        </span>
                        {deal.projectType && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStrategyColor(deal.projectType)}`}>
                            {deal.projectType.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {getDaysInStage(deal.createdAt)}d in stage
                        </span>
                        <span className="font-semibold text-gray-700">
                          Score: {deal.tier === 'enterprise' ? '94' : deal.tier === 'pro' ? '88' : '78'}
                        </span>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-300 rounded-lg">
                      Drop deals here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
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
      showViewsPanel={false}
      renderContent={renderContent}
      renderMap={renderMap}
      defaultContentWidth={1000}
      minContentWidth={800}
      maxContentWidth={1400}
    />
  );
}

export default DealsPage;
