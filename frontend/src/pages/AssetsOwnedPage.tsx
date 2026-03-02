import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ThreePanelLayout } from '../components/layout/ThreePanelLayout';
import { DataGrid } from '../components/grid/DataGrid';
import { ColumnDef, OwnedAsset, GridSort } from '../types/grid';
import { apiClient } from '../services/api.client';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type TabType = 'rankings' | 'grid' | 'performance' | 'documents';
type ViewType = TabType | 'compset';

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

interface CompSetAsset {
  id: string;
  dealId: string;
  name: string;
  submarket: string;
  classType: string;
  units: number;
  pcsRank: number;
  submarketSize: number;
  compSetSize: number;
  avgRent: number;
  compAvgRent: number;
  occupancy: number;
  compAvgOccupancy: number;
  rentPremiumPct: number;
  trendDirection: 'up' | 'stable' | 'down';
  monthlyRentTrend: number[];
}

const MOCK_COMP_SET_ASSETS: CompSetAsset[] = [
  {
    id: 'cs-1', dealId: 'c7a7338a-b520-4f76-b15b-5be1b9400fec', name: 'The Residences at Midtown', submarket: 'Midtown Atlanta', classType: 'Class A', units: 320,
    pcsRank: 3, submarketSize: 18, compSetSize: 8, avgRent: 2150, compAvgRent: 1980,
    occupancy: 94.2, compAvgOccupancy: 91.8, rentPremiumPct: 8.6, trendDirection: 'up',
    monthlyRentTrend: [1980, 2000, 2020, 2040, 2060, 2080, 2090, 2100, 2110, 2120, 2140, 2150],
  },
  {
    id: 'cs-2', dealId: '5d738adc-c4fe-42e9-986b-112e5fb550a8', name: 'Peachtree Commons', submarket: 'Buckhead', classType: 'Class B', units: 248,
    pcsRank: 7, submarketSize: 22, compSetSize: 12, avgRent: 1680, compAvgRent: 1720,
    occupancy: 91.0, compAvgOccupancy: 93.4, rentPremiumPct: -2.3, trendDirection: 'down',
    monthlyRentTrend: [1750, 1740, 1730, 1720, 1710, 1705, 1700, 1695, 1690, 1685, 1682, 1680],
  },
  {
    id: 'cs-3', dealId: 'ab17f229-8b9e-4628-8126-76729ef1e2ee', name: 'Highlands Park Lofts', submarket: 'Virginia Highland', classType: 'Class A', units: 186,
    pcsRank: 1, submarketSize: 12, compSetSize: 6, avgRent: 2380, compAvgRent: 2050,
    occupancy: 96.1, compAvgOccupancy: 92.0, rentPremiumPct: 16.1, trendDirection: 'up',
    monthlyRentTrend: [2200, 2220, 2250, 2270, 2290, 2310, 2330, 2340, 2350, 2360, 2370, 2380],
  },
  {
    id: 'cs-4', dealId: 'fcaa546f-f082-432d-85b5-eb496ebd435b', name: 'Decatur Station', submarket: 'Decatur', classType: 'Class B', units: 156,
    pcsRank: 5, submarketSize: 9, compSetSize: 5, avgRent: 1420, compAvgRent: 1480,
    occupancy: 88.5, compAvgOccupancy: 91.2, rentPremiumPct: -4.1, trendDirection: 'down',
    monthlyRentTrend: [1500, 1490, 1480, 1475, 1465, 1460, 1450, 1445, 1440, 1435, 1425, 1420],
  },
  {
    id: 'cs-5', dealId: '1f8e270a-dfe0-4eb8-8f0b-f27b748aab0d', name: 'Atlantic Station Living', submarket: 'West Midtown', classType: 'Class A', units: 290,
    pcsRank: 4, submarketSize: 15, compSetSize: 9, avgRent: 1950, compAvgRent: 1890,
    occupancy: 93.0, compAvgOccupancy: 92.1, rentPremiumPct: 3.2, trendDirection: 'up',
    monthlyRentTrend: [1800, 1820, 1840, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950],
  },
  {
    id: 'cs-6', dealId: '4f6115a8-499f-426b-a3f0-b1c988cf8d02', name: 'Riverside Flats', submarket: 'Vinings', classType: 'Class B', units: 204,
    pcsRank: 6, submarketSize: 11, compSetSize: 7, avgRent: 1560, compAvgRent: 1540,
    occupancy: 90.8, compAvgOccupancy: 90.5, rentPremiumPct: 1.3, trendDirection: 'stable',
    monthlyRentTrend: [1530, 1535, 1540, 1540, 1545, 1545, 1550, 1550, 1555, 1555, 1558, 1560],
  },
];

export function AssetsOwnedPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  
  const validViews: ViewType[] = ['rankings', 'grid', 'performance', 'documents', 'compset'];
  const rawView = searchParams.get('view') || 'rankings';
  const initialView: ViewType = validViews.includes(rawView as ViewType) ? (rawView as ViewType) : 'rankings';
  const [activeTab, setActiveTab] = useState<ViewType>(initialView);

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
  const [previousTab, setPreviousTab] = useState<TabType>('rankings');

  const handleTabChange = (tab: TabType) => {
    setPreviousTab(tab);
    setActiveTab(tab);
    setSearchParams({ view: tab });
  };

  const handleCompSetClick = () => {
    if (activeTab !== 'compset') setPreviousTab(activeTab as TabType);
    setActiveTab('compset');
    setSearchParams({ view: 'compset' });
  };

  const handleBackFromCompSet = () => {
    setActiveTab(previousTab);
    setSearchParams({ view: previousTab });
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
                          navigate('/competitive-intelligence/performance');
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

  const compSetAvgPremium = (MOCK_COMP_SET_ASSETS.reduce((s, a) => s + a.rentPremiumPct, 0) / MOCK_COMP_SET_ASSETS.length).toFixed(1);
  const compSetLeaders = MOCK_COMP_SET_ASSETS.filter(a => a.rentPremiumPct > 0).length;
  const compSetLaggards = MOCK_COMP_SET_ASSETS.filter(a => a.rentPremiumPct < 0).length;
  const avgCompSetOccDelta = (MOCK_COMP_SET_ASSETS.reduce((s, a) => s + (a.occupancy - a.compAvgOccupancy), 0) / MOCK_COMP_SET_ASSETS.length).toFixed(1);
  const totalCompSetComps = MOCK_COMP_SET_ASSETS.reduce((s, a) => s + a.compSetSize, 0);

  const CompSetSparkline = ({ data }: { data: number[] }) => {
    const max = Math.max(...data) + 20;
    const min = Math.min(...data) - 20;
    const range = max - min || 1;
    const w = 100;
    const h = 28;
    const points = data
      .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
      .join(' ');
    return (
      <svg width={w} height={h} className="inline-block">
        <polyline fill="none" stroke="#8b5cf6" strokeWidth={1.5} points={points} />
        <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill="#8b5cf6" />
      </svg>
    );
  };

  const renderCompSetView = () => (
    <div className="space-y-5 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      <div className="bg-stone-900 text-white rounded-xl p-4 border-l-4 border-violet-500">
        <div className="text-[10px] font-mono text-violet-400 tracking-widest mb-1">THE DECISION THIS PAGE DRIVES</div>
        <div className="text-lg font-semibold">How is each owned asset performing relative to its competitive set — and where are we falling behind?</div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-stone-900">Comp Set Vitals</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
            <span className="text-[10px] text-stone-400">{MOCK_COMP_SET_ASSETS.length} owned assets</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Owned Assets', value: String(MOCK_COMP_SET_ASSETS.length), trend: `${totalCompSetComps} total comps tracked`, trendDir: 'up' as const, sparkData: [4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6] },
            { label: 'Avg Rent Premium', value: `${Number(compSetAvgPremium) > 0 ? '+' : ''}${compSetAvgPremium}%`, trend: `${compSetLeaders} leading, ${compSetLaggards} trailing`, trendDir: Number(compSetAvgPremium) > 0 ? 'up' as const : 'down' as const, sparkData: [2.1, 2.4, 2.8, 3.0, 3.2, 3.5, 3.6, 3.7, 3.8, 3.8, 3.9, Number(compSetAvgPremium)] },
            { label: 'Avg Occ vs Comps', value: `${Number(avgCompSetOccDelta) > 0 ? '+' : ''}${avgCompSetOccDelta}%`, trend: 'vs comp set avg', trendDir: Number(avgCompSetOccDelta) > 0 ? 'up' as const : 'down' as const, sparkData: [0.2, 0.3, 0.4, 0.3, 0.5, 0.6, 0.5, 0.7, 0.6, 0.7, 0.8, Number(avgCompSetOccDelta)] },
            { label: 'Top Rank Held', value: '#1', trend: 'Highlands Park Lofts', trendDir: 'up' as const, sparkData: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
            { label: 'Assets at Risk', value: String(compSetLaggards), trend: 'Below comp avg rent', trendDir: 'down' as const, sparkData: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, compSetLaggards] },
          ].map((vital, i) => (
            <div key={i} className="border border-stone-200 rounded-lg p-3 hover:border-stone-300 transition-colors">
              <div className="text-[10px] font-mono text-stone-400 tracking-wider mb-1">{vital.label}</div>
              <div className="text-xl font-bold text-stone-900">{vital.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[10px] font-medium ${vital.trendDir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {vital.trendDir === 'up' ? '↑' : '↓'} {vital.trend}
                </span>
              </div>
              <div className="mt-2 h-6 flex items-end gap-px">
                {vital.sparkData.slice(-12).map((v, idx, arr) => {
                  const min = Math.min(...arr);
                  const max = Math.max(...arr);
                  const range = max - min || 1;
                  const height = ((v - min) / range) * 100;
                  return (
                    <div key={idx} className={`flex-1 rounded-sm ${idx === arr.length - 1 ? 'bg-violet-500' : 'bg-stone-200'}`} style={{ height: `${Math.max(10, height)}%` }} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
        <p className="text-sm text-violet-900">
          Portfolio averages a <strong>{Number(compSetAvgPremium) > 0 ? '+' : ''}{compSetAvgPremium}% rent premium</strong> vs comp sets. <strong>{compSetLeaders} of {MOCK_COMP_SET_ASSETS.length}</strong> assets outperform their comp set on rent. Occupancy delta averages <strong>{Number(avgCompSetOccDelta) > 0 ? '+' : ''}{avgCompSetOccDelta}%</strong> vs competitors. Focus on underperformers to close the gap.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-stone-900">Comp Set Performance by Asset</h3>
            <p className="text-sm text-stone-500 mt-0.5">Each owned property vs its competitive set</p>
          </div>
          <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">MOCK DATA</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 text-left">
                <th className="px-4 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider">PROPERTY</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">PCS RANK</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">COMP SET</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-right">AVG RENT</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-right">COMP AVG</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">PREMIUM</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-right">OCC</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-right">COMP OCC</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">TREND</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">RENT TREND</th>
                <th className="px-3 py-2.5 text-[10px] font-mono text-stone-400 tracking-wider text-center">DEAL CAPSULE</th>
              </tr>
            </thead>
            <tbody>
              {[...MOCK_COMP_SET_ASSETS].sort((a, b) => a.pcsRank - b.pcsRank).map((asset) => (
                <tr key={asset.id} className="border-t border-stone-100 hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-stone-900">{asset.name}</div>
                    <div className="text-xs text-stone-500">{asset.submarket} · {asset.classType} · {asset.units} units</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                      asset.pcsRank <= Math.ceil(asset.submarketSize * 0.25) ? 'bg-emerald-100 text-emerald-800' :
                      asset.pcsRank <= Math.ceil(asset.submarketSize * 0.75) ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      #{asset.pcsRank}
                    </span>
                    <div className="text-[10px] text-stone-400 mt-0.5">of {asset.submarketSize}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-semibold text-stone-700">{asset.compSetSize}</span>
                    <div className="text-[10px] text-stone-400">comps</div>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-stone-900">
                    ${asset.avgRent.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-stone-500">
                    ${asset.compAvgRent.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      asset.rentPremiumPct > 0 ? 'bg-emerald-100 text-emerald-700' :
                      asset.rentPremiumPct < 0 ? 'bg-red-100 text-red-700' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {asset.rentPremiumPct > 0 ? '+' : ''}{asset.rentPremiumPct}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-stone-900">
                    {asset.occupancy.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-right text-stone-500">
                    {asset.compAvgOccupancy.toFixed(1)}%
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-semibold ${
                      asset.trendDirection === 'up' ? 'text-emerald-600' :
                      asset.trendDirection === 'down' ? 'text-red-500' :
                      'text-stone-400'
                    }`}>
                      {asset.trendDirection === 'up' ? '↑ Rising' : asset.trendDirection === 'down' ? '↓ Falling' : '→ Stable'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <CompSetSparkline data={asset.monthlyRentTrend} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/deals/${asset.dealId}?tab=competition&subtab=f40`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-md transition-colors border border-violet-200"
                    >
                      🎯 Comp Set
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          {activeTab === 'compset' ? (
            <button
              onClick={handleBackFromCompSet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              <span>←</span>
              <span>Back to {tabs.find(t => t.id === previousTab)?.label || 'Assets'}</span>
            </button>
          ) : (
            tabs.map((tab) => (
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
            ))
          )}
          <div className="ml-auto flex items-center gap-3">
            {activeTab !== 'compset' && (
              <button
                onClick={handleCompSetClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-stone-900 text-violet-300 border border-violet-500/30 hover:bg-stone-800 hover:text-violet-200 transition-colors"
              >
                <span>🎯</span>
                <span>Comp Set Performance</span>
              </button>
            )}
            <span className="text-xs text-gray-500">{assets.length} assets</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'rankings' && renderRankingsView()}
          {activeTab === 'compset' && renderCompSetView()}
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
