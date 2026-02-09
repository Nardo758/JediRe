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

export function AssetsOwnedPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

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
      <div className="h-full">
        <DataGrid
          columns={columns}
          data={assets}
          onRowClick={handleRowClick}
          onSort={handleSort}
          onExport={handleExport}
          loading={loading}
        />
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
