import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout, ViewItem } from '../components/layout/ThreePanelLayout';
import { apiClient } from '../services/api.client';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type ViewType = 'all' | 'performance' | 'documents';

function getViewFromPath(pathname: string): ViewType {
  if (pathname.endsWith('/performance')) return 'performance';
  if (pathname.endsWith('/documents')) return 'documents';
  return 'all';
}

interface Asset {
  id: string;
  property_name: string;
  address: string;
  asset_type: string;
  acquisition_date: string;
  hold_period: number;
  actual_noi: number;
  proforma_noi: number;
  noi_variance: number;
  actual_occupancy: number;
  proforma_occupancy: number;
  occupancy_variance: number;
  actual_avg_rent: number;
  proforma_rent: number;
  rent_variance: number;
  current_irr: number;
  projected_irr: number;
  coc_return: number;
  equity_multiple: number;
  total_distributions: number;
  actual_opex_ratio: number;
  actual_capex: number;
  proforma_capex: number;
  loan_maturity_date: string;
  months_to_maturity: number;
  refi_risk_flag: boolean;
}

export function AssetsOwnedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const activeView = getViewFromPath(location.pathname);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const handleViewChange = (viewId: string) => {
    if (viewId === 'all') navigate('/assets-owned');
    else navigate(`/assets-owned/${viewId}`);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`${API_URL}/grid/owned`);
      setAssets(response.data.assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const views: ViewItem[] = [
    { id: 'all', label: 'All', icon: '🏢', count: assets.length },
    { id: 'performance', label: 'Performance', icon: '📊' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  const totals = {
    totalUnits: assets.length,
    avgOccupancy: assets.length > 0
      ? (assets.reduce((sum, a) => sum + (Number(a.actual_occupancy) || 0), 0) / assets.length).toFixed(1)
      : '0.0',
    totalNOI: assets.reduce((sum, a) => sum + (Number(a.actual_noi) || 0), 0),
    avgIRR: assets.length > 0
      ? (assets.reduce((sum, a) => sum + (Number(a.current_irr) || 0), 0) / assets.length).toFixed(1)
      : '0.0',
    totalDistributions: assets.reduce((sum, a) => sum + (Number(a.total_distributions) || 0), 0),
  };

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

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    assets.forEach((asset) => {
      const el = document.createElement('div');
      el.className = 'asset-marker';
      el.innerHTML = '🏢';
      el.style.fontSize = '24px';
      el.style.cursor = 'pointer';

      const lat = 33.75 + Math.random() * 0.1;
      const lng = -84.42 + Math.random() * 0.1;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${asset.property_name}</h3>
              <div class="text-sm text-gray-600 mt-1">
                <div>${Number(asset.actual_occupancy || 0).toFixed(1)}% occupied</div>
                <div>NOI: ${formatCurrency(asset.actual_noi)}</div>
              </div>
            </div>
          `)
        )
        .addTo(map.current!);

      el.addEventListener('click', () => setSelectedAsset(asset.id));
      markers.current.push(marker);
    });
  }, [assets]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `${Number(value).toFixed(1)}%`;
  };

  const renderVariance = (value: number | null | undefined) => {
    if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
    const num = Number(value);
    const isPositive = num > 0;
    const colorClass = Math.abs(num) < 5
      ? 'text-gray-900'
      : isPositive
      ? 'text-green-600'
      : 'text-red-600';
    return (
      <span className={`font-medium ${colorClass}`}>
        {isPositive ? '+' : ''}{num.toFixed(1)}%
      </span>
    );
  };

  const getPerformanceBadge = (noiVariance: number | null | undefined) => {
    if (noiVariance === null || noiVariance === undefined) return null;
    const v = Number(noiVariance);
    if (v > 5) {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Outperforming</span>;
    } else if (v < -10) {
      return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Underperforming</span>;
    }
    return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">On Track</span>;
  };

  const renderContent = (viewId: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (assets.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">🏢</div>
          <div>No owned assets found</div>
        </div>
      );
    }

    if (viewId === 'performance') {
      return (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Portfolio Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-gray-600">Assets</div>
                <div className="text-2xl font-bold text-gray-900">{assets.length}</div>
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
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
              <div>
                <div className="text-sm text-gray-600">Avg IRR</div>
                <div className="text-xl font-bold text-purple-600">{totals.avgIRR}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Distributions</div>
                <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.totalDistributions)}</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Asset Performance</h3>
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset.id)}
                className={`bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${
                  selectedAsset === asset.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-gray-900">{asset.property_name}</div>
                  {getPerformanceBadge(asset.noi_variance)}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">NOI (Actual vs PF)</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(asset.actual_noi)}</span>
                      <span className="text-gray-400 mx-1">vs</span>
                      <span className="text-gray-500">{formatCurrency(asset.proforma_noi)}</span>
                      <span className="ml-2">{renderVariance(asset.noi_variance)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Occupancy</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatPercent(asset.actual_occupancy)}</span>
                      <span className="text-gray-400 mx-1">vs</span>
                      <span className="text-gray-500">{formatPercent(asset.proforma_occupancy)}</span>
                      <span className="ml-2">{renderVariance(asset.occupancy_variance)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IRR</span>
                    <div className="text-right">
                      <span className="font-semibold">{formatPercent(asset.current_irr)}</span>
                      <span className="text-gray-400 mx-1">vs</span>
                      <span className="text-gray-500">{formatPercent(asset.projected_irr)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CoC / Equity Multiple</span>
                    <span className="font-semibold">
                      {formatPercent(asset.coc_return)} / {Number(asset.equity_multiple || 0).toFixed(2)}x
                    </span>
                  </div>
                  {asset.refi_risk_flag && (
                    <div className="flex items-center gap-1 text-orange-600 font-medium mt-1">
                      <span>Refi Risk</span>
                      <span className="text-gray-500 font-normal">
                        ({asset.months_to_maturity}mo to maturity)
                      </span>
                    </div>
                  )}
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

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
          <h3 className="font-semibold mb-3">Portfolio</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="opacity-90">Assets</div>
              <div className="text-2xl font-bold">{assets.length}</div>
            </div>
            <div>
              <div className="opacity-90">Avg Occ.</div>
              <div className="text-2xl font-bold">{totals.avgOccupancy}%</div>
            </div>
            <div>
              <div className="opacity-90">Total NOI</div>
              <div className="text-2xl font-bold">{formatCurrency(totals.totalNOI)}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Owned Assets</h3>
          <button
            onClick={() => navigate('/assets-owned/grid')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Grid View
          </button>
        </div>

        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset.id)}
              className={`bg-white rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${
                selectedAsset === asset.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{asset.property_name}</h3>
                  <p className="text-sm text-gray-600">{asset.address || 'Atlanta, GA'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                    {asset.asset_type || 'Multifamily'}
                  </span>
                  {getPerformanceBadge(asset.noi_variance)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-600">Occupancy</div>
                  <div className="font-semibold text-lg text-green-600">
                    {formatPercent(asset.actual_occupancy)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">NOI</div>
                  <div className="font-semibold text-lg">{formatCurrency(asset.actual_noi)}</div>
                </div>
                <div>
                  <div className="text-gray-600">IRR</div>
                  <div className="font-semibold text-lg text-purple-600">
                    {formatPercent(asset.current_irr)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-600">Hold Period</div>
                  <div className="font-semibold">{asset.hold_period || 0}mo</div>
                </div>
                <div>
                  <div className="text-gray-600">Equity Multiple</div>
                  <div className="font-semibold">{asset.equity_multiple ? Number(asset.equity_multiple).toFixed(2) : '—'}x</div>
                </div>
                <div>
                  <div className="text-gray-600">CoC Return</div>
                  <div className="font-semibold">{formatPercent(asset.coc_return)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMap = () => (
    <div ref={mapContainer} className="absolute inset-0" />
  );

  return (
    <ThreePanelLayout
      storageKey="assets"
      showViewsPanel={false}
      renderContent={() => renderContent(activeView)}
      renderMap={renderMap}
    />
  );
}

export default AssetsOwnedPage;
