/**
 * Market Research Page - Using ThreePanelLayout
 * 
 * Views: Overview, Comparables, Demographics, Supply/Demand
 * Content: Charts, tables, market metrics, research intelligence
 * Map: Data overlays, heat maps, comp markers
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'overview' | 'comparables' | 'demographics' | 'supply-demand';

const marketTabs: { id: ViewType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Trends', icon: '📊' },
  { id: 'comparables', label: 'Comparables', icon: '🔄' },
  { id: 'demographics', label: 'Demographics', icon: '👥' },
  { id: 'supply-demand', label: 'Supply & Demand', icon: '📦' },
];

// Mock data
const mockMarketMetrics = {
  avgRent: 1850,
  avgRentGrowth: 5.2,
  vacancyRate: 6.8,
  absorption: 420,
  medianIncome: 68500,
  population: 506811,
  deliveries: 2800,
  pipeline: 4200,
};

const mockComps = [
  {
    id: 1,
    name: 'Park Avenue Apartments',
    units: 240,
    rent: 1920,
    occupancy: 95,
    location: { lat: 33.7838, lng: -84.3853 },
    distance: 0.8,
  },
  {
    id: 2,
    name: 'Skyline Towers',
    units: 180,
    rent: 2100,
    occupancy: 92,
    location: { lat: 33.7900, lng: -84.3800 },
    distance: 1.2,
  },
  {
    id: 3,
    name: 'Riverside Commons',
    units: 320,
    rent: 1750,
    occupancy: 97,
    location: { lat: 33.7750, lng: -84.3900 },
    distance: 1.5,
  },
];

export function MarketDataPage() {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-84.388, 33.7838],
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add comp markers when in comparables view
  useEffect(() => {
    if (!map.current || activeView !== 'comparables') return;

    // Clear existing markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Add comp markers
    mockComps.forEach((comp) => {
      const marker = new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([comp.location.lng, comp.location.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${comp.name}</h3>
              <div class="text-sm text-gray-600 mt-1">
                <div>${comp.units} units • $${comp.rent}/mo</div>
                <div>${comp.occupancy}% occupied</div>
                <div>${comp.distance} mi away</div>
              </div>
            </div>
          `)
        )
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [activeView]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderViewContent = (viewId: string) => {
    if (viewId === 'overview') {
      return (
        <div className="space-y-4">
          {/* Market KPIs */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Market Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-600">Avg Rent</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(mockMarketMetrics.avgRent)}
                </div>
                <div className="text-xs text-green-600">
                  +{mockMarketMetrics.avgRentGrowth}% YoY
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Vacancy Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {mockMarketMetrics.vacancyRate}%
                </div>
                <div className="text-xs text-gray-500">Healthy market</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Absorption</div>
                <div className="text-2xl font-bold text-blue-600">
                  {mockMarketMetrics.absorption}
                </div>
                <div className="text-xs text-gray-500">units/quarter</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Deliveries</div>
                <div className="text-2xl font-bold text-orange-600">
                  {mockMarketMetrics.deliveries.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">units this year</div>
              </div>
            </div>
          </div>

          {/* Market Trends */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Key Trends</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-500">▲</span>
                <span>Rents growing faster than MSA average</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-500">●</span>
                <span>Supply pipeline elevated but manageable</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">▲</span>
                <span>Strong employment growth in tech sector</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (viewId === 'comparables') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Comparable Properties</h3>
            <p className="text-sm text-gray-600 mb-3">
              3 comparable properties within 2 miles
            </p>
          </div>

          <div className="space-y-3">
            {mockComps.map((comp) => (
              <div
                key={comp.id}
                className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{comp.name}</h4>
                    <p className="text-xs text-gray-600">{comp.distance} mi away</p>
                  </div>
                  <span className="text-lg">🏢</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-600">Units</div>
                    <div className="font-semibold">{comp.units}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Rent</div>
                    <div className="font-semibold">${comp.rent}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Occ.</div>
                    <div className="font-semibold">{comp.occupancy}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (viewId === 'demographics') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Demographics</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Population</div>
                <div className="text-2xl font-bold text-gray-900">
                  {mockMarketMetrics.population.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Median Income</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(mockMarketMetrics.medianIncome)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Renter Percentage</div>
                <div className="text-2xl font-bold text-blue-600">58%</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (viewId === 'supply-demand') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Supply & Demand</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Pipeline</div>
                <div className="text-2xl font-bold text-orange-600">
                  {mockMarketMetrics.pipeline.toLocaleString()} units
                </div>
                <div className="text-xs text-gray-500">Under construction</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Annual Absorption</div>
                <div className="text-2xl font-bold text-blue-600">
                  {(mockMarketMetrics.absorption * 4).toLocaleString()} units
                </div>
                <div className="text-xs text-gray-500">Based on quarterly avg</div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                <strong className="text-yellow-900">Note:</strong>
                <span className="text-yellow-700 ml-1">
                  Supply pipeline represents ~1.5 years of absorption
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderContent = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-200 bg-white flex-shrink-0">
        {marketTabs.map((tab) => (
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
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {renderViewContent(activeView)}
      </div>
    </div>
  );

  const renderMap = () => (
    <div ref={mapContainer} className="absolute inset-0" />
  );

  return (
    <ThreePanelLayout
      storageKey="market-data"
      showViewsPanel={false}
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}

export default MarketDataPage;
