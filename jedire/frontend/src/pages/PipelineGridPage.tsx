/**
 * Pipeline Grid Page
 * Comprehensive grid view for pipeline deals with 20+ tracking columns
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, PipelineDeal, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export function PipelineGridPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async (sort?: GridSort) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (sort) {
        params.append('sort', JSON.stringify(sort));
      }
      
      const response = await apiClient.get(`${API_URL}/grid/pipeline?${params.toString()}`);
      setDeals(response.data.deals || []);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (sort: GridSort) => {
    loadDeals(sort);
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.post(
        `${API_URL}/grid/export`,
        {
          type: 'pipeline',
          data: deals
        },
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
      alert('Failed to export data');
    }
  };

  const handleRowClick = (row: PipelineDeal) => {
    navigate(`/deals/${row.id}`);
  };

  // Format helpers
  const formatCurrency = (value: any) =>
    value !== null && value !== undefined
      ? new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD', 
          maximumFractionDigits: 0 
        }).format(Number(value))
      : '—';

  const formatPercent = (value: any) =>
    value !== null && value !== undefined ? `${Number(value).toFixed(1)}%` : '—';

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : '—';

  // Column definitions (20 columns for MVP)
  const columns: ColumnDef[] = [
    // Identity & Status (7)
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
            <span className="text-xs text-orange-600">🚨 Stalled {row.days_in_stage}d</span>
          )}
        </div>
      )
    },
    { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
    { key: 'unit_count', label: 'Units', sortable: true, filterable: true, width: 80, align: 'right' },
    { key: 'pipeline_stage', label: 'Stage', sortable: true, filterable: true, width: 120 },
    { key: 'days_in_stage', label: 'Days', sortable: true, filterable: true, width: 70, align: 'right',
      render: (value) => (
        <span className={value > 30 ? 'text-orange-600 font-semibold' : 'text-gray-900'}>
          {value || 0}
        </span>
      )
    },
    { 
      key: 'ai_opportunity_score',
      label: 'AI Score',
      sortable: true,
      filterable: true,
      width: 90,
      align: 'right',
      render: (value) => value ? (
        <span className={`font-semibold ${
          value >= 85 ? 'text-green-600' :
          value >= 70 ? 'text-blue-600' :
          value >= 50 ? 'text-yellow-600' :
          'text-gray-600'
        }`}>
          {value >= 85 && '⭐ '}{value}
        </span>
      ) : <span className="text-gray-400">—</span>
    },

    // Financial Snapshot (5)
    { key: 'ask_price', label: 'Ask Price', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'jedi_adjusted_price', label: 'JEDI Price', sortable: true, filterable: true, width: 130, align: 'right', 
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatCurrency(value)}</div>
          {row.ask_price && value && value < row.ask_price && (
            <div className="text-xs text-green-600">💰 ${Math.round((row.ask_price - value) / 1000000)}M gap</div>
          )}
        </div>
      )
    },
    { key: 'broker_projected_irr', label: 'IRR (Broker)', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'jedi_adjusted_irr', label: 'IRR (JEDI)', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{formatPercent(value)}</div>
          {row.broker_projected_irr && value && value > row.broker_projected_irr && (
            <div className="text-xs text-green-600">+{(Number(value) - Number(row.broker_projected_irr)).toFixed(1)}%</div>
          )}
        </div>
      )
    },
    { key: 'noi', label: 'NOI', sortable: true, filterable: true, width: 120, align: 'right', format: formatCurrency },

    // Strategy Arbitrage (2)
    { key: 'best_strategy', label: 'Strategy', sortable: true, filterable: true, width: 150,
      render: (value) => value ? (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'build_to_sell' || value === 'Build-to-Sell' ? 'bg-green-100 text-green-700' :
          value === 'flip' || value === 'Flip' ? 'bg-blue-100 text-blue-700' :
          value === 'rental' || value === 'Rental' ? 'bg-purple-100 text-purple-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {value.replace('_', ' ')}
        </span>
      ) : <span className="text-gray-400">—</span>
    },
    { key: 'strategy_confidence', label: 'Confidence', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value) => value ? `${value}%` : '—'
    },

    // Market Context (2)
    {
      key: 'supply_risk_flag',
      label: 'Supply Risk',
      sortable: true,
      filterable: true,
      width: 110,
      align: 'center',
      render: (value) => value ? (
        <span className="text-orange-600 font-medium">⚠️ Risk</span>
      ) : (
        <span className="text-gray-400">—</span>
      )
    },
    { key: 'imbalance_score', label: 'Imbalance', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value) => value ? (
        <span className={`font-medium ${
          value >= 70 ? 'text-green-600' :
          value >= 40 ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {value}
        </span>
      ) : '—'
    },

    // Velocity (4)
    { key: 'source', label: 'Source', sortable: true, filterable: true, width: 120 },
    { key: 'loi_deadline', label: 'LOI Deadline', sortable: true, filterable: true, width: 120, format: formatDate },
    { key: 'closing_date', label: 'Closing', sortable: true, filterable: true, width: 120, format: formatDate },
    { key: 'dd_checklist_pct', label: 'DD %', sortable: true, filterable: true, width: 70, align: 'right',
      render: (value) => value !== null && value !== undefined ? (
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, value)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{value}%</span>
        </div>
      ) : <span className="text-gray-400">—</span>
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
                onClick={() => navigate('/deals')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Pipeline Grid View</h1>
                <p className="text-sm text-gray-600 mt-1">Track deals across acquisition pipeline</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/deals')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Switch to Kanban
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Create Deal
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
              onClick={() => loadDeals()}
              className="mt-2 text-red-600 hover:text-red-800 font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <DataGrid
            columns={columns}
            data={deals}
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

export default PipelineGridPage;
