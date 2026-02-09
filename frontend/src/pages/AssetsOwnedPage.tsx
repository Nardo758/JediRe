/**
 * Assets Owned Page - Using ThreePanelLayout
 * 
 * Views: All, Performance, Documents
 * Content: Asset cards with occupancy/NOI metrics
 * Map: Asset markers with performance indicators
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout, ViewItem } from '../components/layout/ThreePanelLayout';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

type ViewType = 'all' | 'performance' | 'documents';

// Mock data - replace with real API calls
const mockAssets = [
  {
    id: 1,
    name: 'Midtown Tower',
    units: 250,
    occupancy: 94,
    noi: 2100000,
    class: 'A+',
    location: { lat: 33.7838, lng: -84.3853 },
    address: '1000 Peachtree St NE, Atlanta, GA',
  },
  {
    id: 2,
    name: 'Buckhead Place',
    units: 180,
    occupancy: 91,
    noi: 1500000,
    class: 'A',
    location: { lat: 33.8398, lng: -84.3692 },
    address: '3400 Peachtree Rd NE, Atlanta, GA',
  },
  {
    id: 3,
    name: 'Virginia Highland Apartments',
    units: 120,
    occupancy: 96,
    noi: 980000,
    class: 'B+',
    location: { lat: 33.7844, lng: -84.3522 },
    address: '1000 N Highland Ave NE, Atlanta, GA',
  },
];

export function AssetsOwnedPage() {
  const [activeView, setActiveView] = useState<ViewType>('all');
  const [assets, setAssets] = useState(mockAssets);
  const [selectedAsset, setSelectedAsset] = useState<number | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Define views
  const views: ViewItem[] = [
    { id: 'all', label: 'All', icon: '🏢', count: assets.length },
    { id: 'performance', label: 'Performance', icon: '📊' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  // Portfolio totals
  const totals = {
    totalUnits: assets.reduce((sum, a) => sum + a.units, 0),
    avgOccupancy: (assets.reduce((sum, a) => sum + a.occupancy, 0) / assets.length).toFixed(1),
    totalNOI: assets.reduce((sum, a) => sum + a.noi, 0),
  };

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

  // Add asset markers to map
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Clear existing markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    // Add new markers
    assets.forEach((asset) => {
      const el = document.createElement('div');
      el.className = 'asset-marker';
      el.innerHTML = '🏢';
      el.style.fontSize = '24px';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([asset.location.lng, asset.location.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${asset.name}</h3>
              <div class="text-sm text-gray-600 mt-1">
                <div>${asset.units} units • ${asset.occupancy}% occupied</div>
                <div>Class ${asset.class}</div>
              </div>
            </div>
          `)
        )
        .addTo(map.current!);

      el.addEventListener('click', () => setSelectedAsset(asset.id));
      
      markers.current.push(marker);
    });
  }, [assets]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Content renderer
  const renderContent = (viewId: string) => {
    if (viewId === 'performance') {
      return (
        <div className="space-y-4">
          {/* Portfolio KPIs */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Portfolio Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-gray-600">Total Units</div>
                <div className="text-2xl font-bold text-gray-900">{totals.totalUnits}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Avg Occupancy</div>
                <div className="text-2xl font-bold text-green-600">{totals.avgOccupancy}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total NOI</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totals.totalNOI)}
                </div>
              </div>
            </div>
          </div>

          {/* Performance Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Asset Performance</h3>
            {assets.map((asset) => (
              <div
                key={asset.id}
                className={`bg-white rounded-lg border p-3 ${
                  selectedAsset === asset.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="font-medium text-gray-900 mb-2">{asset.name}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Occupancy</span>
                    <span className="font-semibold text-green-600">{asset.occupancy}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">NOI</span>
                    <span className="font-semibold">{formatCurrency(asset.noi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">NOI per Unit</span>
                    <span className="font-semibold">
                      {formatCurrency(asset.noi / asset.units)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (viewId === 'documents') {
      return (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📄</div>
          <div>Documents view coming soon</div>
        </div>
      );
    }

    // All view
    return (
      <div className="space-y-4">
        {/* Portfolio Summary */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
          <h3 className="font-semibold mb-3">Portfolio</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="opacity-90">Assets</div>
              <div className="text-2xl font-bold">{assets.length}</div>
            </div>
            <div>
              <div className="opacity-90">Units</div>
              <div className="text-2xl font-bold">{totals.totalUnits}</div>
            </div>
            <div>
              <div className="opacity-90">Avg Occ.</div>
              <div className="text-2xl font-bold">{totals.avgOccupancy}%</div>
            </div>
          </div>
        </div>

        {/* Asset Cards */}
        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset.id)}
              className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                selectedAsset === asset.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                  <p className="text-sm text-gray-600">{asset.address}</p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  Class {asset.class}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-600">Units</div>
                  <div className="font-semibold text-lg">{asset.units}</div>
                </div>
                <div>
                  <div className="text-gray-600">Occupancy</div>
                  <div className="font-semibold text-lg text-green-600">{asset.occupancy}%</div>
                </div>
                <div>
                  <div className="text-gray-600">NOI</div>
                  <div className="font-semibold text-lg">{formatCurrency(asset.noi)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Map renderer
  const renderMap = () => (
    <div ref={mapContainer} className="absolute inset-0" />
  );

  return (
    <ThreePanelLayout
      storageKey="assets"
      views={views}
      activeView={activeView}
      onViewChange={(viewId) => setActiveView(viewId as ViewType)}
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}

export default AssetsOwnedPage;
