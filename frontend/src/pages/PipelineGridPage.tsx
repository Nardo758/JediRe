/**
 * Pipeline Grid Page
 * Comprehensive grid view for pipeline deals with 20+ tracking columns
 * Includes Map View toggle for spatial visualization
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, PipelineDeal, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';
import PipelineMapView from '../components/pipeline/PipelineMapView';
import { MapIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { BT } from '@/components/deal/bloomberg-ui';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type ViewMode = 'grid' | 'map';

export function PipelineGridPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get view mode from URL or default to grid
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'grid'
  );

  useEffect(() => {
    loadDeals();
  }, []);

  // Sync view mode with URL
  useEffect(() => {
    const urlView = searchParams.get('view') as ViewMode;
    if (urlView && urlView !== viewMode) {
      setViewMode(urlView);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
  }, [searchParams]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchParams({ view: mode });
  };

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
          <div className="font-medium" style={{ color: BT.text.primary }}>{value || '—'}</div>
          {row.days_in_stage > 30 && (
            <span style={{ fontSize: '11px', color: BT.text.orange }}>🚨 Stalled {row.days_in_stage}d</span>
          )}
        </div>
      )
    },
    { key: 'asset_type', label: 'Type', sortable: true, filterable: true, width: 120 },
    { key: 'unit_count', label: 'Units', sortable: true, filterable: true, width: 80, align: 'right' },
    { key: 'pipeline_stage', label: 'Stage', sortable: true, filterable: true, width: 120 },
    { key: 'days_in_stage', label: 'Days', sortable: true, filterable: true, width: 70, align: 'right',
      render: (value) => (
        <span style={{ color: value > 30 ? BT.text.orange : BT.text.primary, fontWeight: value > 30 ? 600 : 400 }}>
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
        <span style={{ fontWeight: 600, color: value >= 85 ? BT.text.green : value >= 70 ? BT.text.cyan : value >= 50 ? BT.text.amber : BT.text.secondary }}>
          {value >= 85 && '⭐ '}{value}
        </span>
      ) : <span style={{ color: BT.text.muted }}>—</span>
    },

    // Financial Snapshot (5)
    { key: 'ask_price', label: 'Ask Price', sortable: true, filterable: true, width: 130, align: 'right', format: formatCurrency },
    { key: 'jedi_adjusted_price', label: 'JEDI Price', sortable: true, filterable: true, width: 130, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium" style={{ color: BT.text.primary }}>{formatCurrency(value)}</div>
          {row.ask_price && value && value < row.ask_price && (
            <div style={{ fontSize: '11px', color: BT.text.green }}>💰 ${Math.round((row.ask_price - value) / 1000000)}M gap</div>
          )}
        </div>
      )
    },
    { key: 'broker_projected_irr', label: 'IRR (Broker)', sortable: true, filterable: true, width: 100, align: 'right', format: formatPercent },
    { key: 'jedi_adjusted_irr', label: 'IRR (JEDI)', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value, row) => (
        <div>
          <div className="font-medium" style={{ color: BT.text.primary }}>{formatPercent(value)}</div>
          {row.broker_projected_irr && value && value > row.broker_projected_irr && (
            <div style={{ fontSize: '11px', color: BT.text.green }}>+{(Number(value) - Number(row.broker_projected_irr)).toFixed(1)}%</div>
          )}
        </div>
      )
    },
    { key: 'noi', label: 'NOI', sortable: true, filterable: true, width: 120, align: 'right', format: formatCurrency },

    // Strategy Arbitrage (2)
    { key: 'best_strategy', label: 'Strategy', sortable: true, filterable: true, width: 150,
      render: (value) => value ? (
        <span className="px-2 py-1 text-xs font-medium" style={{
          borderRadius: 0,
          background: value === 'build_to_sell' || value === 'Build-to-Sell' ? BT.bg.active :
            value === 'flip' || value === 'Flip' ? BT.bg.active :
            value === 'rental' || value === 'Rental' ? BT.bg.active :
            BT.bg.panelAlt,
          color: value === 'build_to_sell' || value === 'Build-to-Sell' ? BT.text.green :
            value === 'flip' || value === 'Flip' ? BT.text.cyan :
            value === 'rental' || value === 'Rental' ? BT.text.purple :
            BT.text.secondary,
          border: `1px solid ${BT.border.subtle}`
        }}>
          {value.replace('_', ' ')}
        </span>
      ) : <span style={{ color: BT.text.muted }}>—</span>
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
        <span className="font-medium" style={{ color: BT.text.orange }}>⚠️ Risk</span>
      ) : (
        <span style={{ color: BT.text.muted }}>—</span>
      )
    },
    { key: 'imbalance_score', label: 'Imbalance', sortable: true, filterable: true, width: 100, align: 'right',
      render: (value) => value ? (
        <span className="font-medium" style={{
          color: value >= 70 ? BT.text.green : value >= 40 ? BT.text.amber : BT.text.red
        }}>
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
          <div className="w-16 h-2" style={{ background: BT.bg.active, borderRadius: 0 }}>
            <div
              className="h-2"
              style={{
                width: `${Math.min(100, value)}%`,
                borderRadius: 0,
                background: value >= 80 ? BT.text.green : value >= 50 ? BT.text.amber : BT.text.cyan
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: BT.text.secondary }}>{value}%</span>
        </div>
      ) : <span style={{ color: BT.text.muted }}>—</span>
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: BT.bg.terminal }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: BT.bg.panel, borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/deals')}
                style={{ color: BT.text.muted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = BT.text.secondary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = BT.text.muted)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: BT.text.primary }}>Pipeline Grid View</h1>
                <p className="text-sm mt-1" style={{ color: BT.text.secondary }}>Track deals across acquisition pipeline</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex p-1" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
              <button
                onClick={() => handleViewModeChange('grid')}
                className="flex items-center gap-2 px-4 py-2 transition-all"
                style={{
                  borderRadius: 0,
                  background: viewMode === 'grid' ? BT.bg.active : 'transparent',
                  color: viewMode === 'grid' ? BT.text.primary : BT.text.secondary,
                }}
              >
                <TableCellsIcon className="w-5 h-5" />
                <span className="font-medium">Grid View</span>
              </button>
              <button
                onClick={() => handleViewModeChange('map')}
                className="flex items-center gap-2 px-4 py-2 transition-all"
                style={{
                  borderRadius: 0,
                  background: viewMode === 'map' ? BT.bg.active : 'transparent',
                  color: viewMode === 'map' ? BT.text.primary : BT.text.secondary,
                }}
              >
                <MapIcon className="w-5 h-5" />
                <span className="font-medium">Map View</span>
              </button>
            </div>

            <div className="h-8 w-px" style={{ background: BT.border.medium }} />

            <button
              onClick={() => navigate('/deals')}
              className="px-4 py-2 transition-colors"
              style={{ background: BT.bg.panelAlt, color: BT.text.secondary, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}
            >
              Switch to Kanban
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 transition-colors"
              style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}
            >
              + Create Deal
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className="p-6">
          {error ? (
            <div className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
              <p style={{ color: BT.text.red }}>{error}</p>
              <button
                onClick={() => loadDeals()}
                className="mt-2 font-medium"
                style={{ color: BT.text.red }}
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
      ) : (
        <div className="h-[calc(100vh-5rem)]">
          {error ? (
            <div className="flex items-center justify-center h-full" style={{ background: BT.bg.terminal }}>
              <div className="p-4 max-w-md" style={{ background: BT.bg.panel, border: `1px solid ${BT.text.red}`, borderRadius: 0 }}>
                <p style={{ color: BT.text.red }}>{error}</p>
                <button
                  onClick={() => loadDeals()}
                  className="mt-2 font-medium"
                  style={{ color: BT.text.red }}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <PipelineMapView
              deals={deals}
              onDealClick={handleRowClick}
              loading={loading}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default PipelineGridPage;
