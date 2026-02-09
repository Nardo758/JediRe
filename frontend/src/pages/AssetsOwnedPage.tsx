import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, OwnedAsset, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type TabType = 'grid' | 'performance' | 'documents';

export function AssetsOwnedPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('grid');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async (sort?: GridSort) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (sort) {
        params.append('sort', JSON.stringify(sort));
      }
      const response = await apiClient.get(`${API_URL}/grid/owned?${params.toString()}`);
      setAssets(response.data.assets || []);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('Failed to load assets data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (sort: GridSort) => {
    loadAssets(sort);
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.post(
        `${API_URL}/grid/export`,
        { type: 'owned', data: assets },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `assets_owned_grid_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleRowClick = (row: OwnedAsset) => {
    setSelectedAsset(row.id);
    navigate(`/deals/${row.id}`);
  };

  const formatCurrency = (value: any) =>
    value !== null && value !== undefined
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(Number(value))
      : '—';

  const formatPercent = (value: any) =>
    value !== null && value !== undefined ? `${Number(value).toFixed(1)}%` : '—';

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : '—';

  const renderVariance = (variance: number | null) => {
    if (variance === null || variance === undefined) return <span className="text-gray-400">—</span>;
    const num = Number(variance);
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

  const getPerformanceBadge = (noi_variance: number | null) => {
    if (noi_variance === null || noi_variance === undefined) return null;
    const v = Number(noi_variance);
    if (v > 5) {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Outperforming</span>;
    } else if (v < -10) {
      return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">Underperforming</span>;
    }
    return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">On Track</span>;
  };

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
          <div className="mt-1">{getPerformanceBadge(row.noi_variance)}</div>
        </div>
      ),
    },
    { key: 'address', label: 'Address', sortable: true, filterable: true, width: 180,
      render: (value) => <span className="text-sm text-gray-600">{value || '—'}</span>
    },
    { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
    { key: 'acquisition_date', label: 'Acquired', sortable: true, filterable: true, width: 110, format: formatDate },
    { key: 'hold_period', label: 'Hold (mo)', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => <span className="text-gray-900">{value || 0}mo</span>
    },
    { key: 'actual_noi', label: 'NOI (Actual)', sortable: true, filterable: true, width: 120, align: 'right', format: formatCurrency },
    { key: 'proforma_noi', label: 'NOI (Pro Forma)', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'noi_variance', label: 'NOI Var', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => renderVariance(value)
    },
    { key: 'actual_occupancy', label: 'Occ (Actual)', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value) => value !== null ? `${Number(value).toFixed(1)}%` : '—'
    },
    { key: 'proforma_occupancy', label: 'Occ (PF)', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => value !== null ? `${Number(value).toFixed(1)}%` : '—'
    },
    { key: 'occupancy_variance', label: 'Occ Var', sortable: true, filterable: true, width: 80, align: 'right',
      render: (value) => renderVariance(value)
    },
    { key: 'actual_avg_rent', label: 'Rent (Actual)', sortable: true, filterable: true, width: 110, align: 'right', format: formatCurrency },
    { key: 'proforma_rent', label: 'Rent (PF)', sortable: true, filterable: true, width: 110, align: 'right', format: formatCurrency },
    { key: 'rent_variance', label: 'Rent Var', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => renderVariance(value)
    },
    { key: 'current_irr', label: 'IRR (Current)', sortable: true, filterable: true, width: 110, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatPercent(value)}</div>
          {row.projected_irr && value && (
            <div className="text-xs text-gray-500">vs {formatPercent(row.projected_irr)}</div>
          )}
        </div>
      ),
    },
    { key: 'projected_irr', label: 'IRR (Projected)', sortable: true, filterable: true, width: 110, align: 'right', format: formatPercent },
    { key: 'coc_return', label: 'CoC Return', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'equity_multiple', label: 'Equity Multiple', sortable: true, filterable: true, width: 120, align: 'right',
      render: (value) => value !== null && value !== undefined ? `${Number(value).toFixed(2)}x` : '—'
    },
    { key: 'total_distributions', label: 'Distributions', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'actual_opex_ratio', label: 'Opex Ratio', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'actual_capex', label: 'Capex', sortable: true, filterable: true, width: 120, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatCurrency(value)}</div>
          {row.proforma_capex && (
            <div className="text-xs text-gray-500">vs {formatCurrency(row.proforma_capex)}</div>
          )}
        </div>
      ),
    },
    { key: 'loan_maturity_date', label: 'Loan Maturity', sortable: true, filterable: true, width: 120,
      render: (value, row) => (
        <div>
          <div className="text-gray-900">{formatDate(value)}</div>
          {row.refi_risk_flag && (
            <div className="text-xs text-orange-600 font-medium mt-1">Refi Risk</div>
          )}
        </div>
      ),
    },
    { key: 'months_to_maturity', label: 'Months', sortable: true, filterable: true, width: 80, align: 'right',
      render: (value) => value !== null && value !== undefined ? (
        <span className={Number(value) < 12 ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
          {value}mo
        </span>
      ) : '—'
    },
  ];

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

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

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

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
      markersRef.current.push(marker);
    });
  }, [assets]);

  const totals = {
    totalAssets: assets.length,
    avgOccupancy: assets.length > 0
      ? (assets.reduce((sum, a) => sum + (Number(a.actual_occupancy) || 0), 0) / assets.length).toFixed(1)
      : '0.0',
    totalNOI: assets.reduce((sum, a) => sum + (Number(a.actual_noi) || 0), 0),
    avgIRR: assets.length > 0
      ? (assets.reduce((sum, a) => sum + (Number(a.current_irr) || 0), 0) / assets.length).toFixed(1)
      : '0.0',
    totalDistributions: assets.reduce((sum, a) => sum + (Number(a.total_distributions) || 0), 0),
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'grid', label: 'Grid View', icon: '📊' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  const renderPerformanceView = () => (
    <div className="space-y-4 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Portfolio Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-gray-600">Assets</div>
            <div className="text-2xl font-bold text-gray-900">{totals.totalAssets}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Avg Occupancy</div>
            <div className="text-2xl font-bold text-green-600">{totals.avgOccupancy}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total NOI</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totals.totalNOI)}</div>
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

  const renderDocumentsView = () => (
    <div className="text-center py-12 text-gray-500">
      <div className="text-4xl mb-2">📄</div>
      <div className="font-medium">Documents</div>
      <div className="text-sm mt-1">Property documents and files coming soon</div>
    </div>
  );

  const renderContent = () => {
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => loadAssets()}
            className="mt-2 text-red-600 hover:text-red-800 font-medium"
          >
            Retry
          </button>
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
          <div className="ml-auto text-xs text-gray-500">{assets.length} assets</div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'grid' && (
            <DataGrid
              columns={columns}
              data={assets}
              onRowClick={handleRowClick}
              onSort={handleSort}
              onExport={handleExport}
              loading={loading}
            />
          )}
          {activeTab === 'performance' && (
            loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">🏢</div>
                <div>No owned assets found</div>
              </div>
            ) : renderPerformanceView()
          )}
          {activeTab === 'documents' && renderDocumentsView()}
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
      renderContent={renderContent}
      renderMap={renderMap}
    />
  );
}

export default AssetsOwnedPage;
