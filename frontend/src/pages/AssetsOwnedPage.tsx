import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, OwnedAsset, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type TabType = 'rankings' | 'grid' | 'performance' | 'documents';

interface RankedAsset {
  id: string;
  name: string;
  submarket: string;
  pcsScore: number;
  rank: number;
  totalInSubmarket: number;
  movement: number;
  trajectory: 'improving' | 'stable' | 'declining';
  targetRank: number;
  gapToTarget: number;
  monthlyPcs: number[];
  targetLine: number;
  classType: string;
  units: number;
}

const MOCK_RANKED_ASSETS: RankedAsset[] = [
  {
    id: 'ra-1',
    name: 'The Residences at Midtown',
    submarket: 'Midtown Atlanta',
    pcsScore: 82,
    rank: 3,
    totalInSubmarket: 18,
    movement: 2,
    trajectory: 'improving',
    targetRank: 1,
    gapToTarget: 2,
    monthlyPcs: [71, 73, 74, 76, 77, 78, 79, 78, 80, 80, 81, 82],
    targetLine: 88,
    classType: 'Class A',
    units: 320,
  },
  {
    id: 'ra-2',
    name: 'Peachtree Commons',
    submarket: 'Buckhead',
    pcsScore: 74,
    rank: 7,
    totalInSubmarket: 22,
    movement: -1,
    trajectory: 'declining',
    targetRank: 5,
    gapToTarget: 2,
    monthlyPcs: [78, 78, 77, 76, 76, 75, 75, 74, 75, 74, 74, 74],
    targetLine: 80,
    classType: 'Class B',
    units: 248,
  },
  {
    id: 'ra-3',
    name: 'Highlands Park Lofts',
    submarket: 'Virginia Highland',
    pcsScore: 89,
    rank: 1,
    totalInSubmarket: 12,
    movement: 0,
    trajectory: 'stable',
    targetRank: 1,
    gapToTarget: 0,
    monthlyPcs: [87, 87, 88, 88, 88, 89, 88, 89, 89, 89, 89, 89],
    targetLine: 88,
    classType: 'Class A',
    units: 186,
  },
  {
    id: 'ra-4',
    name: 'Decatur Station',
    submarket: 'Decatur',
    pcsScore: 67,
    rank: 5,
    totalInSubmarket: 9,
    movement: -2,
    trajectory: 'declining',
    targetRank: 3,
    gapToTarget: 2,
    monthlyPcs: [72, 71, 71, 70, 69, 69, 68, 68, 67, 67, 67, 67],
    targetLine: 75,
    classType: 'Class B',
    units: 156,
  },
  {
    id: 'ra-5',
    name: 'Atlantic Station Living',
    submarket: 'West Midtown',
    pcsScore: 78,
    rank: 4,
    totalInSubmarket: 15,
    movement: 3,
    trajectory: 'improving',
    targetRank: 2,
    gapToTarget: 2,
    monthlyPcs: [68, 69, 70, 72, 73, 74, 74, 75, 76, 77, 77, 78],
    targetLine: 83,
    classType: 'Class A',
    units: 290,
  },
  {
    id: 'ra-6',
    name: 'Riverside Flats',
    submarket: 'Vinings',
    pcsScore: 71,
    rank: 6,
    totalInSubmarket: 11,
    movement: 1,
    trajectory: 'improving',
    targetRank: 4,
    gapToTarget: 2,
    monthlyPcs: [65, 66, 66, 67, 68, 68, 69, 69, 70, 70, 71, 71],
    targetLine: 77,
    classType: 'Class B',
    units: 204,
  },
];

export function AssetsOwnedPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  
  const initialTab = (searchParams.get('view') as TabType) || 'rankings';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

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

  // Sync tab changes to URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ view: tab });
  };

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'rankings', label: 'Performance & Rankings', icon: '🏆' },
    { id: 'grid', label: 'Grid View', icon: '📊' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'documents', label: 'Documents', icon: '📄' },
  ];

  const portfolioAvgPcs = Math.round(
    MOCK_RANKED_ASSETS.reduce((s, a) => s + a.pcsScore, 0) / MOCK_RANKED_ASSETS.length
  );

  const priorityAsset = [...MOCK_RANKED_ASSETS].sort(
    (a, b) => (b.rank - b.targetRank) - (a.rank - a.targetRank)
  )[0];

  const MiniSparkline = ({ data, targetLine }: { data: number[]; targetLine: number }) => {
    const max = Math.max(...data, targetLine) + 2;
    const min = Math.min(...data, targetLine) - 2;
    const range = max - min || 1;
    const w = 120;
    const h = 32;
    const points = data
      .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
      .join(' ');
    const targetY = h - ((targetLine - min) / range) * h;
    return (
      <svg width={w} height={h} className="inline-block">
        <line x1={0} y1={targetY} x2={w} y2={targetY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,3" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth={1.5} points={points} />
        <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill="#3b82f6" />
      </svg>
    );
  };

  const MovementBadge = ({ movement }: { movement: number }) => {
    if (movement > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
          <span>▲</span>{movement}
        </span>
      );
    }
    if (movement < 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
          <span>▼</span>{Math.abs(movement)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
        ◆ 0
      </span>
    );
  };

  const TrajectoryBadge = ({ trajectory }: { trajectory: string }) => {
    const styles: Record<string, string> = {
      improving: 'bg-green-100 text-green-800',
      stable: 'bg-blue-100 text-blue-800',
      declining: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[trajectory] || 'bg-gray-100 text-gray-800'}`}>
        {trajectory}
      </span>
    );
  };

  const renderRankingsView = () => (
    <div className="space-y-4 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white col-span-1">
          <div className="text-sm text-blue-100 mb-1">Portfolio Aggregate PCS</div>
          <div className="text-4xl font-bold">{portfolioAvgPcs}</div>
          <div className="text-sm text-blue-200 mt-1">Weighted avg across {MOCK_RANKED_ASSETS.length} assets</div>
          <div className="mt-3 w-full bg-blue-500/40 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${portfolioAvgPcs}%` }}
            />
          </div>
        </div>

        {priorityAsset && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-600 text-lg">⚡</span>
              <span className="text-sm font-semibold text-amber-800">Action Priority</span>
            </div>
            <div className="text-base font-bold text-gray-900">{priorityAsset.name}</div>
            <div className="text-sm text-gray-600 mt-1">
              Currently ranked <span className="font-semibold">#{priorityAsset.rank}</span> of {priorityAsset.totalInSubmarket} in {priorityAsset.submarket}
              {' '}— target is <span className="font-semibold">#{priorityAsset.targetRank}</span>
              {' '}({priorityAsset.rank - priorityAsset.targetRank} positions to close)
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">PCS: {priorityAsset.pcsScore}</span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">Target PCS: {priorityAsset.targetLine}</span>
              <span className="text-xs text-gray-400">|</span>
              <TrajectoryBadge trajectory={priorityAsset.trajectory} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Owned Asset Rankings</h3>
          <span className="text-xs text-gray-500">PCS = Property Competitive Score</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2">Asset</th>
                <th className="px-3 py-2 text-center">PCS</th>
                <th className="px-3 py-2 text-center">Rank</th>
                <th className="px-3 py-2 text-center">Movement</th>
                <th className="px-3 py-2 text-center">Trajectory</th>
                <th className="px-3 py-2 text-center">12-Mo Trend</th>
                <th className="px-3 py-2 text-center">Target</th>
                <th className="px-3 py-2 text-center">Gap</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_RANKED_ASSETS.sort((a, b) => a.rank - b.rank).map((asset) => {
                const isPriority = asset.id === priorityAsset?.id;
                return (
                  <tr
                    key={asset.id}
                    className={`hover:bg-gray-50 transition-colors ${isPriority ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{asset.name}</div>
                      <div className="text-xs text-gray-500">{asset.submarket} · {asset.classType} · {asset.units} units</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                        asset.pcsScore >= 80 ? 'bg-green-100 text-green-800' :
                        asset.pcsScore >= 70 ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {asset.pcsScore}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-semibold text-gray-900">#{asset.rank}</span>
                      <span className="text-xs text-gray-400 ml-0.5">/{asset.totalInSubmarket}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MovementBadge movement={asset.movement} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <TrajectoryBadge trajectory={asset.trajectory} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <MiniSparkline data={asset.monthlyPcs} targetLine={asset.targetLine} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-gray-600 font-medium">#{asset.targetRank}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {asset.gapToTarget === 0 ? (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">On Target</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {asset.rank - asset.targetRank} pos
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/competitive-intelligence/projection');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200"
                      >
                        <span>📊</span> Rank Me
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

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
              onClick={() => handleTabChange(tab.id)}
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
          {activeTab === 'rankings' && renderRankingsView()}
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

  return (
    <ThreePanelLayout
      storageKey="assets"
      showViewsPanel={false}
      renderContent={renderContent}
    />
  );
}

export default AssetsOwnedPage;
