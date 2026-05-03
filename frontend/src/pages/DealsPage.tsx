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
import { BT } from '../components/deal/bloomberg-ui';
import { M35KeyEventsHub } from '../components/m35/M35KeyEventsHub';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type TabType = 'all' | 'active' | 'closed';
type QuadrantType = 'Hidden Gem' | 'Validated Winner' | 'Hype Risk' | 'Dead Weight';
type RankTier = 'Top 10' | 'Top 25' | 'Top 50' | 'All';

const quadrantStyles: Record<QuadrantType, { background: string; color: string }> = {
  'Hidden Gem': { background: BT.bg.active, color: BT.text.green },
  'Validated Winner': { background: BT.bg.active, color: BT.text.cyan },
  'Hype Risk': { background: BT.bg.active, color: BT.text.amber },
  'Dead Weight': { background: BT.bg.active, color: BT.text.red },
};

const quadrantOptions: QuadrantType[] = ['Hidden Gem', 'Validated Winner', 'Hype Risk', 'Dead Weight'];
const rankTierOptions: RankTier[] = ['Top 10', 'Top 25', 'Top 50', 'All'];

const mockIntelligenceData: { pcs_rank: number; pcs_movement: number; t04_quadrant: QuadrantType; target_score: number }[] = [
  { pcs_rank: 3, pcs_movement: 2, t04_quadrant: 'Validated Winner', target_score: 91 },
  { pcs_rank: 7, pcs_movement: -1, t04_quadrant: 'Hidden Gem', target_score: 84 },
  { pcs_rank: 12, pcs_movement: 5, t04_quadrant: 'Hidden Gem', target_score: 78 },
  { pcs_rank: 15, pcs_movement: 0, t04_quadrant: 'Hype Risk', target_score: 62 },
  { pcs_rank: 22, pcs_movement: -3, t04_quadrant: 'Dead Weight', target_score: 41 },
  { pcs_rank: 1, pcs_movement: 0, t04_quadrant: 'Validated Winner', target_score: 96 },
  { pcs_rank: 5, pcs_movement: 1, t04_quadrant: 'Validated Winner', target_score: 88 },
  { pcs_rank: 9, pcs_movement: -2, t04_quadrant: 'Hype Risk', target_score: 55 },
  { pcs_rank: 18, pcs_movement: 4, t04_quadrant: 'Hidden Gem', target_score: 73 },
  { pcs_rank: 28, pcs_movement: -5, t04_quadrant: 'Dead Weight', target_score: 35 },
  { pcs_rank: 2, pcs_movement: 1, t04_quadrant: 'Validated Winner', target_score: 93 },
  { pcs_rank: 11, pcs_movement: 3, t04_quadrant: 'Hidden Gem', target_score: 80 },
  { pcs_rank: 20, pcs_movement: 0, t04_quadrant: 'Hype Risk', target_score: 58 },
  { pcs_rank: 35, pcs_movement: -7, t04_quadrant: 'Dead Weight', target_score: 29 },
  { pcs_rank: 6, pcs_movement: 2, t04_quadrant: 'Validated Winner', target_score: 86 },
  { pcs_rank: 14, pcs_movement: -1, t04_quadrant: 'Hidden Gem', target_score: 76 },
  { pcs_rank: 25, pcs_movement: 0, t04_quadrant: 'Hype Risk', target_score: 50 },
  { pcs_rank: 8, pcs_movement: 3, t04_quadrant: 'Hidden Gem', target_score: 82 },
  { pcs_rank: 30, pcs_movement: -4, t04_quadrant: 'Dead Weight', target_score: 38 },
  { pcs_rank: 4, pcs_movement: 1, t04_quadrant: 'Validated Winner', target_score: 90 },
];

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
        <div className="font-medium" style={{ color: BT.text.primary }}>{value || '—'}</div>
        {row.days_in_stage > 30 && (
          <span className="text-xs" style={{ color: BT.text.orange }}>Stalled {row.days_in_stage}d</span>
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
      <span className={value > 30 ? 'font-semibold' : ''} style={{ color: value > 30 ? BT.text.orange : BT.text.primary }}>
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
          className="font-semibold"
          style={{
            color: value >= 85
              ? BT.text.green
              : value >= 70
              ? BT.text.cyan
              : value >= 50
              ? BT.text.amber
              : BT.text.secondary,
          }}
        >
          {value}
        </span>
      ) : (
        <span style={{ color: BT.text.muted }}>—</span>
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
        <div className="font-medium" style={{ color: BT.text.primary }}>{formatCurrency(value)}</div>
        {row.ask_price && value && value < row.ask_price && (
          <div className="text-xs" style={{ color: BT.text.green }}>${Math.round((row.ask_price - value) / 1000000)}M gap</div>
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
        <div className="font-medium" style={{ color: BT.text.primary }}>{formatPercent(value)}</div>
        {row.broker_projected_irr && value && value > row.broker_projected_irr && (
          <div className="text-xs" style={{ color: BT.text.green }}>+{(Number(value) - Number(row.broker_projected_irr)).toFixed(1)}%</div>
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
          className="px-2 py-1 text-xs font-medium"
          style={{
            borderRadius: 2,
            background: BT.bg.active,
            color:
              value === 'build_to_sell' || value === 'Build-to-Sell'
                ? BT.text.green
                : value === 'flip' || value === 'Flip'
                ? BT.text.cyan
                : value === 'rental' || value === 'Rental'
                ? BT.text.purple
                : BT.text.secondary,
          }}
        >
          {value.replace('_', ' ')}
        </span>
      ) : (
        <span style={{ color: BT.text.muted }}>—</span>
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
    render: (value) => (value ? <span className="font-medium" style={{ color: BT.text.orange }}>Risk</span> : <span style={{ color: BT.text.muted }}>—</span>),
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
        <span className="font-medium" style={{ color: value >= 70 ? BT.text.green : value >= 40 ? BT.text.amber : BT.text.red }}>
          {value}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'pcs_rank',
    label: 'PCS Rank',
    sortable: true,
    filterable: true,
    width: 110,
    align: 'center',
    render: (value, row) => {
      if (!value) return <span style={{ color: BT.text.muted }}>—</span>;
      const movement = row.pcs_movement || 0;
      return (
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-semibold" style={{ color: BT.text.primary }}>#{value}</span>
          {movement !== 0 && (
            <span className="inline-flex items-center text-xs font-medium" style={{ color: movement > 0 ? BT.text.green : BT.text.red }}>
              {movement > 0 ? '▲' : '▼'}{Math.abs(movement)}
            </span>
          )}
          {movement === 0 && (
            <span className="inline-flex items-center text-xs" style={{ color: BT.text.muted }}>—</span>
          )}
        </div>
      );
    },
  },
  {
    key: 't04_quadrant',
    label: 'T-04 Quadrant',
    sortable: true,
    filterable: true,
    width: 150,
    align: 'center',
    render: (value) => {
      if (!value) return <span style={{ color: BT.text.muted }}>—</span>;
      const style = quadrantStyles[value as QuadrantType] || { background: BT.bg.active, color: BT.text.secondary };
      return (
        <span className="px-2 py-1 text-xs font-medium" style={{ borderRadius: 2, background: style.background, color: style.color }}>
          {value}
        </span>
      );
    },
  },
  {
    key: 'target_score',
    label: 'Target Score',
    sortable: true,
    filterable: true,
    width: 110,
    align: 'right',
    render: (value) => {
      if (value === null || value === undefined) return <span style={{ color: BT.text.muted }}>—</span>;
      const color = value >= 80 ? BT.text.green : value >= 60 ? BT.text.cyan : value >= 40 ? BT.text.amber : BT.text.red;
      const barColor = value >= 80 ? BT.text.green : value >= 60 ? BT.text.cyan : value >= 40 ? BT.text.amber : BT.text.red;
      return (
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 h-1.5" style={{ background: BT.bg.hover, borderRadius: 1 }}>
            <div
              className="h-1.5"
              style={{ width: `${Math.min(100, value)}%`, background: barColor, borderRadius: 1 }}
            />
          </div>
          <span className="font-semibold" style={{ color }}>{value}</span>
        </div>
      );
    },
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
          <div className="w-16 h-2" style={{ background: BT.bg.hover, borderRadius: 1 }}>
            <div
              className="h-2"
              style={{
                width: `${Math.min(100, value)}%`,
                background: value >= 80 ? BT.text.green : value >= 50 ? BT.text.amber : BT.text.cyan,
                borderRadius: 1,
              }}
            />
          </div>
          <span className="text-xs" style={{ color: BT.text.secondary }}>{value}%</span>
        </div>
      ) : (
        <span style={{ color: BT.text.muted }}>—</span>
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
  const [quadrantFilter, setQuadrantFilter] = useState<QuadrantType | null>(null);
  const [rankTierFilter, setRankTierFilter] = useState<RankTier>('All');
  const [intelligenceData, setIntelligenceData] = useState<Map<string, any>>(new Map());
  const [m35EventsOpen, setM35EventsOpen] = useState(false);
  const [m35ExpandedEvent, setM35ExpandedEvent] = useState<string | null>(null);

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'all', label: 'All Deals', icon: '📊' },
    { id: 'active', label: 'Active', icon: '🔄' },
    { id: 'closed', label: 'Closed', icon: '✅' },
  ];

  const tabFiltered = activeTab === 'all'
    ? gridDeals
    : activeTab === 'active'
    ? gridDeals.filter((d) => d.pipeline_stage !== 'Closed' && d.pipeline_stage !== 'Dead')
    : gridDeals.filter((d) => d.pipeline_stage === 'Closed' || d.pipeline_stage === 'Dead');

  const filteredDeals = tabFiltered.filter((d) => {
    if (quadrantFilter && d.t04_quadrant !== quadrantFilter) return false;
    if (rankTierFilter !== 'All') {
      const rank = d.pcs_rank;
      if (!rank) return false;
      if (rankTierFilter === 'Top 10' && rank > 10) return false;
      if (rankTierFilter === 'Top 25' && rank > 25) return false;
      if (rankTierFilter === 'Top 50' && rank > 50) return false;
    }
    return true;
  });

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response: any = await apiClient.get('/rankings/pipeline/atlanta');
        const data = response?.data || response;
        if (data?.intelligence && Array.isArray(data.intelligence)) {
          const map = new Map();
          data.intelligence.forEach((item: any) => {
            map.set(item.id, {
              pcs_rank: item.pcs_rank,
              pcs_movement: item.pcs_movement,
              t04_quadrant: item.t04_quadrant,
              target_score: item.target_score,
            });
          });
          setIntelligenceData(map);
          await loadGridDeals(undefined, map);
        } else {
          await loadGridDeals();
        }
      } catch (err) {
        console.error('Failed to load intelligence data:', err);
        await loadGridDeals();
      }
    };
    loadData();
    fetchMapDeals();
  // hook intentionally omits loadGridDeals — it's an inline function recreated each render; including it would cause an infinite re-fetch loop. The function close over the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMapDeals]);

  const loadGridDeals = async (sort?: GridSort, intelData?: Map<string, any>) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (sort) params.append('sort', JSON.stringify(sort));
      const response = await apiClient.get(`${API_URL}/grid/pipeline?${params.toString()}`);
      const dataToUse = intelData || intelligenceData;
      const deals = (response.data.deals || []).map((deal: PipelineDeal, index: number) => {
        const intelligence = dataToUse.get(deal.id) || mockIntelligenceData[index % mockIntelligenceData.length];
        return {
          ...deal,
          ...intelligence,
        };
      });
      setGridDeals(deals);
    } catch (err) {
      console.error('Failed to load pipeline grid:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (sort: GridSort) => loadGridDeals(sort, intelligenceData);

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

  const handleRowClick = (row: PipelineDeal) => navigate(`/deals/${row.id}/detail`);

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
  // hook intentionally omits addDealsToMap — it's an inline function recreated each render; including it would cause an infinite re-fetch loop. The function close over the listed primitive deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (dealId) navigate(`/deals/${dealId}/detail`);
      }
    });
    m.on('mouseenter', 'deal-fills', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'deal-fills', () => { m.getCanvas().style.cursor = ''; });
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="p-6">
          <div className="p-4" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
            <p style={{ color: BT.text.red }}>{error}</p>
            <button onClick={() => loadGridDeals()} className="mt-2 font-medium" style={{ color: BT.text.red }}>
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: `1px solid ${BT.border.subtle}`, background: BT.bg.panel }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderRadius: 2,
                background: activeTab === tab.id ? BT.bg.active : 'transparent',
                color: activeTab === tab.id ? BT.text.cyan : BT.text.secondary,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <div className="ml-auto text-xs" style={{ color: BT.text.secondary }}>{filteredDeals.length} deals</div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap" style={{ background: BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}` }}>
          <span className="text-xs font-medium mr-1" style={{ color: BT.text.secondary }}>Quadrant:</span>
          {quadrantOptions.map((q) => {
            const qStyle = quadrantStyles[q];
            return (
              <button
                key={q}
                onClick={() => setQuadrantFilter(quadrantFilter === q ? null : q)}
                className="px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  borderRadius: 2,
                  background: quadrantFilter === q ? qStyle.background : 'transparent',
                  color: quadrantFilter === q ? qStyle.color : BT.text.secondary,
                  border: quadrantFilter === q ? 'none' : `1px solid ${BT.border.subtle}`,
                }}
              >
                {q}
              </button>
            );
          })}
          <div className="w-px h-5 mx-1" style={{ background: BT.border.subtle }} />
          <span className="text-xs font-medium mr-1" style={{ color: BT.text.secondary }}>Rank:</span>
          {rankTierOptions.map((tier) => (
            <button
              key={tier}
              onClick={() => setRankTierFilter(tier)}
              className="px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                borderRadius: 2,
                background: rankTierFilter === tier ? BT.bg.active : 'transparent',
                color: rankTierFilter === tier ? BT.text.purple : BT.text.secondary,
                border: rankTierFilter === tier ? 'none' : `1px solid ${BT.border.subtle}`,
              }}
            >
              {tier}
            </button>
          ))}
          {(quadrantFilter || rankTierFilter !== 'All') && (
            <button
              onClick={() => { setQuadrantFilter(null); setRankTierFilter('All'); }}
              className="px-2 py-1 text-xs underline"
              style={{ color: BT.text.secondary }}
            >
              Clear filters
            </button>
          )}
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
      <div className="absolute bottom-6 left-6 p-4 z-10" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0 }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: BT.text.secondary, fontFamily: BT.font.mono }}>Deal Tiers</h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ background: BT.text.amber, borderRadius: 2 }} />
            <span style={{ color: BT.text.primary }}>Basic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ background: BT.text.cyan, borderRadius: 2 }} />
            <span style={{ color: BT.text.primary }}>Pro</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4" style={{ background: BT.text.green, borderRadius: 2 }} />
            <span style={{ color: BT.text.primary }}>Enterprise</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ThreePanelLayout
          storageKey="pipeline"
          showViewsPanel={false}
          renderContent={renderContent}
          renderMap={renderMap}
          defaultContentWidth={900}
          minContentWidth={600}
          maxContentWidth={1400}
        />
      </div>
      <M35KeyEventsHub
        variant="portfolio"
        isCollapsed={!m35EventsOpen}
        onToggle={() => setM35EventsOpen(!m35EventsOpen)}
      />
    </div>
  );
}

export default DealsPage;
