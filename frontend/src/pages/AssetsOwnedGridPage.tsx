/**
 * Assets Owned Grid Page
 * Comprehensive grid view for owned assets with performance tracking (25 columns)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, OwnedAsset, GridSort } from '../types/grid';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export function AssetsOwnedGridPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      
      const response = await axios.get(`${API_URL}/grid/owned?${params.toString()}`);
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
      const response = await axios.post(
        `${API_URL}/grid/export`,
        {
          type: 'owned',
          data: assets
        },
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
      alert('Failed to export data');
    }
  };

  const handleRowClick = (row: OwnedAsset) => {
    navigate(`/deals/${row.id}`);
  };

  // Format helpers
  const formatCurrency = (value: number | null) =>
    value !== null && value !== undefined
      ? new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD', 
          maximumFractionDigits: 0 
        }).format(value)
      : '—';

  const formatPercent = (value: number | null) =>
    value !== null && value !== undefined ? `${value.toFixed(1)}%` : '—';

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : '—';

  // Variance renderer with color coding
  const renderVariance = (variance: number | null, label?: string) => {
    if (variance === null || variance === undefined) return <span className="text-gray-400">—</span>;
    
    const isPositive = variance > 0;
    const colorClass = Math.abs(variance) < 5 
      ? 'text-gray-900' 
      : isPositive 
      ? 'text-green-600' 
      : 'text-red-600';
    
    return (
      <span className={`font-medium ${colorClass}`}>
        {isPositive ? '+' : ''}{variance.toFixed(1)}%
        {label && <span className="text-xs ml-1 text-gray-500">{label}</span>}
      </span>
    );
  };

  // Performance badge
  const getPerformanceBadge = (noi_variance: number | null) => {
    if (noi_variance === null) return null;
    
    if (noi_variance > 5) {
      return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">🟢 Outperforming</span>;
    } else if (noi_variance < -10) {
      return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">🔴 Underperforming</span>;
    } else {
      return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">🟡 On Track</span>;
    }
  };

  // Column definitions (25 columns for MVP)
  const columns: ColumnDef[] = [
    // Identity (5)
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
      )
    },
    { key: 'address', label: 'Address', sortable: true, filterable: true, width: 180,
      render: (value) => <span className="text-sm text-gray-600">{value || '—'}</span>
    },
    { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
    { key: 'acquisition_date', label: 'Acquired', sortable: true, filterable: true, width: 110, format: formatDate },
    { key: 'hold_period', label: 'Hold (mo)', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => <span className="text-gray-900">{value || 0}mo</span>
    },

    // Performance vs Underwriting (9)
    { key: 'actual_noi', label: 'NOI (Actual)', sortable: true, filterable: true, width: 120, align: 'right', format: formatCurrency },
    { key: 'proforma_noi', label: 'NOI (Pro Forma)', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'noi_variance', label: 'NOI Var', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => renderVariance(value)
    },
    
    { key: 'actual_occupancy', label: 'Occ (Actual)', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value) => value !== null ? `${value.toFixed(1)}%` : '—'
    },
    { key: 'proforma_occupancy', label: 'Occ (PF)', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => value !== null ? `${value.toFixed(1)}%` : '—'
    },
    { key: 'occupancy_variance', label: 'Occ Var', sortable: true, filterable: true, width: 80, align: 'right',
      render: (value) => renderVariance(value)
    },
    
    { key: 'actual_avg_rent', label: 'Rent (Actual)', sortable: true, filterable: true, width: 110, align: 'right', format: formatCurrency },
    { key: 'proforma_rent', label: 'Rent (PF)', sortable: true, filterable: true, width: 110, align: 'right', format: formatCurrency },
    { key: 'rent_variance', label: 'Rent Var', sortable: true, filterable: true, width: 90, align: 'right',
      render: (value) => renderVariance(value)
    },

    // Returns Tracking (5)
    { key: 'current_irr', label: 'IRR (Current)', sortable: true, filterable: true, width: 110, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatPercent(value)}</div>
          {row.projected_irr && value && (
            <div className="text-xs text-gray-500">vs {formatPercent(row.projected_irr)}</div>
          )}
        </div>
      )
    },
    { key: 'projected_irr', label: 'IRR (Projected)', sortable: true, filterable: true, width: 110, align: 'right', format: formatPercent },
    { key: 'coc_return', label: 'CoC Return', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'equity_multiple', label: 'Equity Multiple', sortable: true, filterable: true, width: 120, align: 'right',
      render: (value) => value !== null && value !== undefined ? `${value.toFixed(2)}x` : '—'
    },
    { key: 'total_distributions', label: 'Distributions', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },

    // Operational Health (4)
    { key: 'actual_opex_ratio', label: 'Opex Ratio', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'actual_capex', label: 'Capex', sortable: true, filterable: true, width: 120, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatCurrency(value)}</div>
          {row.proforma_capex && (
            <div className="text-xs text-gray-500">vs {formatCurrency(row.proforma_capex)}</div>
          )}
        </div>
      )
    },

    // Risk Monitoring (2)
    { key: 'loan_maturity_date', label: 'Loan Maturity', sortable: true, filterable: true, width: 120,
      render: (value, row) => (
        <div>
          <div className="text-gray-900">{formatDate(value)}</div>
          {row.refi_risk_flag && (
            <div className="text-xs text-orange-600 font-medium mt-1">⚠️ Refi Risk</div>
          )}
        </div>
      )
    },
    { key: 'months_to_maturity', label: 'Months', sortable: true, filterable: true, width: 80, align: 'right',
      render: (value) => value !== null && value !== undefined ? (
        <span className={value < 12 ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
          {value}mo
        </span>
      ) : '—'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/assets-owned')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Assets Owned Grid View</h1>
                <p className="text-sm text-gray-600 mt-1">Track performance vs underwriting</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/assets-owned')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Switch to Map View
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Asset
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => loadAssets()}
              className="mt-2 text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <DataGrid
            columns={columns}
            data={assets}
            onRowClick={handleRowClick}
            onSort={handleSort}
            onExport={handleExport}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

export default AssetsOwnedGridPage;
