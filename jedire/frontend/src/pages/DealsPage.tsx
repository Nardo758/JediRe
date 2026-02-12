/**
 * Pipeline Page (Deals) - Grid View as default content
 * 
 * Content: Pipeline grid with 20+ tracking columns
 * Map: Deal boundaries color-coded by tier
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { useDealStore } from '../stores/dealStore';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, PipelineDeal, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type TabType = 'all' | 'active' | 'closed';

const formatCurrency = (value: any) =>
  value !== null && value !== undefined
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value))
    : '—';

const formatPercent = (value: any) =>
  value !== null && value !== undefined ? `${Number(value).toFixed(1)}%` : '—';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const columns: ColumnDef[] = [
  {
    key: 'property_name',
    label: 'Property',
    sortable: true,
    filterable: true,
    width: 200,
    render: (value, row) => (
      <div>
        <div className="font-medium text-gray-900">{value || '—'}</div>
        {row.days_in_stage > 30 && (
          <span className="text-xs text-orange-600">Stalled {row.days_in_stage}d</span>
        )}
      </div>
    ),
  },
  { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
  { key: 'unit_count', label: 'Units', sortable: true, filterable: true, width: 80, align: 'right' },
  { key: 'pipeline_stage', label: 'Stage', sortable: true, filterable: true, width: 120 },
  {
    key: 'days_in_stage',
    label: 'Days',
    sortable: true,
    filterable: true,
    width: 70,
    align: 'right',
    render: (value) => (
      <span className={value > 30 ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
        {value || 0}
      </span>
    ),
  },
  {
    key: 'ai_opportunity_score',
    label: 'AI Score',
    sortable: true,
    filterable: true,
    width: 90,
    align: 'right',
    render: (value) =>
      value ? (
        <span
          className={`font-semibold ${
            value >= 85
              ? 'text-green-600'
              : value >= 70
              ? 'text-blue-600'
              : value >= 50
              ? 'text-yellow-600'
              : 'text-gray-600'
          }`}
        >
          {value}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  { key: 'ask_price', label: 'Ask Price', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
  {
    key: 'jedi_adjusted_price',
    label: 'JEDI Price',
    sortable: true,
    filterable: true,
    width: 130,
    align: 'right',
    render: (value, row) => (
      <div>
        <div className="font-medium text-gray-900">{formatCurrency(value)}</div>
        {row.ask_price && value && value < row.ask_price && (
          <div className="text-xs text-green-600">${Math.round((row.ask_price - value) / 1000000)}M gap</div>
        )}
      </div>
    ),
  },
  { key: 'broker_projected_irr', label: 'IRR (Broker)', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
  {
    key: 'jedi_adjusted_irr',
    label: 'IRR (JEDI)',
    sortable: true,
    filterable: true,
    width: 100,
    align: 'right',
    render: (value, row) => (
      <div>
        <div className="font-medium text-gray-900">{formatPercent(value)}</div>
        {row.broker_projected_irr && value && value > row.broker_projected_irr && (
          <div className="text-xs text-green-600">+{(Number(value) - Number(row.broker_projected_irr)).toFixed(1)}%</div>
        )}
      </div>
    ),
  },
  { key: 'noi', label: 'NOI', sortable: true, filterable: true, width: 120, align: 'right', format: formatCurrency },
  {
    key: 'best_strategy',
    label: 'Strategy',
    sortable: true,
    filterable: true,
    width: 150,
    render: (value) =>
      value ? (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value === 'build_to_sell' || value === 'Build-to-Sell'
              ? 'bg-green-100 text-green-700'
              : value === 'flip' || value === 'Flip'
              ? 'bg-blue-100 text-blue-700'
              : value === 'rental' || value === 'Rental'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {value.replace('_', ' ')}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
  {
    key: 'strategy_confidence',
    label: 'Confidence',
    sortable: true,
    filterable: true,
    width: 100,
    align: 'right',
    render: (value) => (value ? `${value}%` : '—'),
  },
  {
    key: 'supply_risk_flag',
    label: 'Supply Risk',
    sortable: true,
    filterable: true,
    width: 110,
    align: 'center',
    render: (value) => (value ? <span className="text-orange-600 font-medium">Risk</span> : <span className="text-gray-400">—</span>),
  },
  {
    key: 'imbalance_score',
    label: 'Imbalance',
    sortable: true,
    filterable: true,
    width: 100,
    align: 'right',
    render: (value) =>
      value ? (
        <span className={`font-medium ${value >= 70 ? 'text-green-600' : value >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
          {value}
        </span>
      ) : (
        '—'
      ),
  },
  { key: 'source', label: 'Source', sortable: true, filterable: true, width: 120 },
  { key: 'loi_deadline', label: 'LOI Deadline', sortable: true, filterable: true, width: 120, format: formatDate },
  { key: 'closing_date', label: 'Closing', sortable: true, filterable: true, width: 120, format: formatDate },
  {
    key: 'dd_checklist_pct',
    label: 'DD %',
    sortable: true,
    filterable: true,
    width: 70,
    align: 'right',
    render: (value) =>
      value !== null && value !== undefined ? (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, value)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{value}%</span>
        </div>
      ) : (
        <span className="text-gray-400">—</span>
      ),
  },
];

export function DealsPage() {
  const navigate = useNavigate();
  const { deals: mapDeals, fetchDeals: fetchMapDeals } = useDealStore();

  const [gridDeals, setGridDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'all', label: 'All Deals', icon: '📊' },
    { id: 'active', label: 'Active', icon: '🔄' },
    { id: 'closed', label: 'Closed', icon: '✅' },
  ];

  const filteredDeals = activeTab === 'all'
    ? gridDeals
    : activeTab === 'active'
    ? gridDeals.filter((d) => d.pipeline_stage !== 'Closed' && d.pipeline_stage !== 'Dead')
    : gridDeals.filter((d) => d.pipeline_stage === 'Closed' || d.pipeline_stage === 'Dead');

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    loadGridDeals();
    fetchMapDeals();
  }, [fetchMapDeals]);

  const loadGridDeals = async (sort?: GridSort) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (sort) params.append('sort', JSON.stringify(sort));
      const response = await apiClient.get(`${API_URL}/grid/pipeline?${params.toString()}`);
      setGridDeals(response.data.deals || []);
    } catch (err) {
      console.error('Failed to load pipeline grid:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (sort: GridSort) => loadGridDeals(sort);

  const handleExport = async () => {
    try {
      const response = await apiClient.post(
        `${API_URL}/grid/export`,
        { type: 'pipeline', data: gridDeals },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pipeline_grid_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleRowClick = (row: PipelineDeal) => navigate(`/deals/${row.id}/view`);

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
    if (!map.current || !map.current.isStyleLoaded() || !mapDeals.length) return;
    addDealsToMap(map.current, mapDeals);
  }, [mapDeals]);

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
          properties: { id: deal.id, name: deal.name, tier: deal.tier },
        })),
    };

    m.addSource('deals', { type: 'geojson', data: geojson as any });

    m.addLayer({
      id: 'deal-fills',
      type: 'fill',
      source: 'deals',
      paint: {
        'fill-color': ['match', ['get', 'tier'], 'basic', '#fbbf24', 'pro', '#3b82f6', 'enterprise', '#10b981', '#6b7280'],
        'fill-opacity': 0.2,
      },
    });

    m.addLayer({
      id: 'deal-borders',
      type: 'line',
      source: 'deals',
      paint: {
        'line-color': ['match', ['get', 'tier'], 'basic', '#f59e0b', 'pro', '#2563eb', 'enterprise', '#059669', '#4b5563'],
        'line-width': 2,
      },
    });

    m.on('click', 'deal-fills', (e) => {
      if (e.features && e.features[0]) {
        const dealId = e.features[0].properties?.id;
        if (dealId) navigate(`/deals/${dealId}/view`);
      }
    });
    m.on('mouseenter', 'deal-fills', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'deal-fills', () => { m.getCanvas().style.cursor = ''; });
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={() => loadGridDeals()} className="mt-2 text-red-600 hover:text-red-800 font-medium">
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-200 bg-white flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <div className="ml-auto text-xs text-gray-500">{filteredDeals.length} deals</div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DataGrid
            columns={columns}
            data={filteredDeals}
            onRowClick={handleRowClick}
            onSort={handleSort}
            onExport={handleExport}
            loading={loading}
          />
        </div>
      </div>
    );
  };

  const renderMap = () => (
    <>
      <div ref={mapContainer} className="absolute inset-0" />
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
      defaultContentWidth={900}
      minContentWidth={600}
      maxContentWidth={1400}
    />
  );
}

export default DealsPage;
