import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../services/api.client';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface Asset {
  deal_id: string;
  name: string;
  type: string;
  units: number;
  address: string;
  occupancy_rate: number;
  noi: number;
  budget_noi: number;
  monthly_cash_flow: number;
  budget_variance: number;
  coc_return: number;
  status: 'On Target' | 'Watch' | 'Alert';
}

interface AssetsSummary {
  totalAssets: number;
  totalUnits: number;
  avgOccupancy: number;
  portfolioNOI: number;
}

export const AssetsSection: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<AssetsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get(`${API_URL}/dashboard/assets`);
      
      if (response.data.success) {
        const parsed = (response.data.assets || []).map((a: any) => ({
          ...a,
          units: Number(a.units) || 0,
          occupancy_rate: Number(a.occupancy_rate) || 0,
          noi: Number(a.noi) || 0,
          budget_noi: Number(a.budget_noi) || 0,
          monthly_cash_flow: Number(a.monthly_cash_flow) || 0,
          budget_variance: Number(a.budget_variance) || 0,
          coc_return: Number(a.coc_return) || 0,
        }));
        setAssets(parsed);
        setSummary(response.data.summary || null);
      } else {
        throw new Error('Failed to load assets');
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
      setError('Failed to load portfolio assets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On Target':
        return 'text-green-600 bg-green-50';
      case 'Watch':
        return 'text-yellow-700 bg-yellow-50';
      case 'Alert':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPerformanceIcon = (variance: number) => {
    if (variance > 5) return '⬆️';
    if (variance < -5) return '⬇️';
    return '➡️';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading assets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">{error}</p>
        <button
          onClick={loadAssets}
          className="mt-2 text-red-600 hover:text-red-800 font-medium text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
        <div className="text-4xl mb-2">🏢</div>
        <p className="text-gray-600 mb-4">No assets yet. Add properties to your portfolio.</p>
        <button
          onClick={() => navigate('/deals/create', { state: { category: 'portfolio' } })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Add Asset
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Portfolio Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600">Total Assets</div>
              <div className="text-xl font-bold text-gray-900">{summary.totalAssets} properties</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Total Units</div>
              <div className="text-xl font-bold text-gray-900">{summary.totalUnits} units</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Avg Occupancy</div>
              <div className="text-xl font-bold text-green-600">{summary.avgOccupancy}%</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Portfolio NOI</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(summary.portfolioNOI)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Cards */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase">Assets</h3>
          <button
            onClick={() => navigate('/assets-owned')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            View All →
          </button>
        </div>
        
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.deal_id}
              onClick={() => navigate(`/deals/${asset.deal_id}/view`)}
              className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">{asset.name}</h4>
                  <p className="text-xs text-gray-500">
                    {asset.units} units • {asset.type}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ml-2 ${getStatusColor(asset.status)}`}>
                  {asset.status}
                </span>
              </div>

              {/* Metrics */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Occupancy:</span>
                  <span className={`font-semibold ${asset.occupancy_rate >= 90 ? 'text-green-600' : asset.occupancy_rate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {asset.occupancy_rate.toFixed(1)}% {asset.occupancy_rate >= 90 ? '✅' : '⚠️'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">NOI:</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{formatCurrency(asset.noi)}</span>
                    <span className="text-gray-400 mx-1">vs</span>
                    <span className="text-gray-500 text-xs">{formatCurrency(asset.budget_noi)}</span>
                    <span className="ml-1">{getPerformanceIcon(asset.budget_variance)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Cash Flow:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(asset.monthly_cash_flow)}/mo
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600">CoC Return:</span>
                  <span className="font-semibold text-purple-600">
                    {asset.coc_return.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
