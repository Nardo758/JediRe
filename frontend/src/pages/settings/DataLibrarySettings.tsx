import React, { useState, useEffect, useCallback } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { apiClient } from '../../services/api.client';
import { CloudStoragePanel, BulkUploadPanel } from '../../components/data-library';
import AssetDetailModal from '../../components/data-library/AssetDetailModal';
import { Upload, Cloud, Database, ChevronDown, ChevronRight } from 'lucide-react';

interface Asset {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  msa_name: string;
  submarket_name: string;
  property_type: string;
  property_subtype: string;
  asset_class: string;
  year_built: number;
  unit_count: number;
  stories: number;
  height_class: string;
  vintage_tier: string;
  avg_rent: number;
  occupancy_rate: number;
  cap_rate: number;
  sale_price: number;
  price_per_unit: number;
  source_type: string;
  data_quality_score: number;
  created_at: string;
}

interface Stats {
  total_assets: string;
  cities: string;
  msas: string;
  property_types: string;
  total_units: string;
  avg_quality: string;
  owned: string;
  comps: string;
  broker: string;
  manual: string;
}

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  owned_deal: { label: 'OWNED', color: BT.text.green },
  market_comp: { label: 'COMP', color: BT.text.cyan },
  broker_om: { label: 'BROKER', color: BT.text.orange },
  costar: { label: 'COSTAR', color: BT.text.purple },
  manual: { label: 'MANUAL', color: BT.text.secondary },
};

const CLASS_COLORS: Record<string, string> = {
  'A+': '#00D26A', 'A': '#00D26A', 'A-': '#4ADE80',
  'B+': '#00BCD4', 'B': '#00BCD4', 'B-': '#67E8F9',
  'C+': '#F5A623', 'C': '#F5A623', 'C-': '#FFD166',
  'D': '#FF4757',
};

export function DataLibrarySettings() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Upload panels state
  const [activePanel, setActivePanel] = useState<'none' | 'upload' | 'cloud'>('none');
  const [showUploadSection, setShowUploadSection] = useState(true);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('property_type', filterType);
      if (filterSource) params.set('source_type', filterSource);
      params.set('sort_by', sortBy);
      params.set('sort_dir', sortDir);
      params.set('limit', '50');

      const res = await apiClient.get(`/api/v1/data-library-assets?${params}`);
      setAssets(res.data.assets || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterSource, sortBy, sortDir]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/data-library-assets/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const sortArrow = (col: string) => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const fmt = (v: number | null | undefined, prefix = '', suffix = '') => {
    if (v === null || v === undefined) return '—';
    return `${prefix}${Number(v).toLocaleString()}${suffix}`;
  };

  const fmtCurrency = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '—';
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  const handleUploadComplete = () => {
    fetchAssets();
    fetchStats();
  };

  return (
    <div style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}` }}>
      {/* Upload Section */}
      <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
        <button
          onClick={() => setShowUploadSection(!showUploadSection)}
          style={{
            width: '100%',
            padding: '12px 20px',
            background: BT.bg.panelAlt,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: BT.text.primary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} style={{ color: BT.text.cyan }} />
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: MONO }}>BULK UPLOAD & CLOUD SYNC</span>
          </div>
          {showUploadSection ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        
        {showUploadSection && (
          <div style={{ padding: '16px 20px' }}>
            {/* Tab buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setActivePanel(activePanel === 'upload' ? 'none' : 'upload')}
                style={{
                  padding: '8px 16px',
                  background: activePanel === 'upload' ? BT.bg.accent : BT.bg.input,
                  border: `1px solid ${activePanel === 'upload' ? BT.border.accent : BT.border.medium}`,
                  borderRadius: 4,
                  color: activePanel === 'upload' ? BT.text.amber : BT.text.secondary,
                  fontFamily: MONO,
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Upload size={14} />
                Upload Files
              </button>
              <button
                onClick={() => setActivePanel(activePanel === 'cloud' ? 'none' : 'cloud')}
                style={{
                  padding: '8px 16px',
                  background: activePanel === 'cloud' ? BT.bg.accent : BT.bg.input,
                  border: `1px solid ${activePanel === 'cloud' ? BT.border.accent : BT.border.medium}`,
                  borderRadius: 4,
                  color: activePanel === 'cloud' ? BT.text.amber : BT.text.secondary,
                  fontFamily: MONO,
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Cloud size={14} />
                Cloud Storage
              </button>
            </div>
            
            {/* Panel content */}
            {activePanel === 'upload' && (
              <BulkUploadPanel onUploadComplete={handleUploadComplete} />
            )}
            {activePanel === 'cloud' && (
              <CloudStoragePanel onSyncComplete={handleUploadComplete} />
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BT.border.subtle}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: BT.text.amber, fontFamily: MONO, letterSpacing: 1, margin: 0 }}>
              <Database size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
              DATA LIBRARY
            </h2>
            <p style={{ fontSize: 11, color: BT.text.secondary, margin: '4px 0 0', fontFamily: MONO }}>
              Structured asset database for like-kind comp matching
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>
              {total} ASSETS
            </span>
          </div>
        </div>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'TOTAL ASSETS', value: stats.total_assets, color: BT.text.primary },
              { label: 'TOTAL UNITS', value: Number(stats.total_units).toLocaleString(), color: BT.text.cyan },
              { label: 'CITIES', value: stats.cities, color: BT.text.green },
              { label: 'MSAs', value: stats.msas, color: BT.text.amber },
              { label: 'AVG QUALITY', value: `${stats.avg_quality || 0}/100`, color: Number(stats.avg_quality) > 60 ? BT.text.green : BT.text.orange },
              { label: 'SOURCES', value: `${stats.owned}O/${stats.comps}C/${stats.broker}B/${stats.manual}M`, color: BT.text.secondary },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px 10px', background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}` }}>
                <div style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: MONO }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            style={{
              flex: 1, padding: '6px 10px', background: BT.bg.input,
              border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
              fontFamily: MONO, fontSize: 11,
            }}
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{
              padding: '6px 10px', background: BT.bg.input,
              border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
              fontFamily: MONO, fontSize: 11,
            }}
          >
            <option value="">All Types</option>
            <option value="multifamily">Multifamily</option>
            <option value="btr">BTR</option>
            <option value="student">Student</option>
            <option value="senior">Senior</option>
            <option value="affordable">Affordable</option>
            <option value="mixed_use">Mixed Use</option>
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            style={{
              padding: '6px 10px', background: BT.bg.input,
              border: `1px solid ${BT.border.medium}`, color: BT.text.primary,
              fontFamily: MONO, fontSize: 11,
            }}
          >
            <option value="">All Sources</option>
            <option value="owned_deal">Owned Deals</option>
            <option value="market_comp">Market Comps</option>
            <option value="broker_om">Broker OMs</option>
            <option value="costar">CoStar</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 10 }}>
          <thead>
            <tr style={{ background: BT.bg.panelAlt }}>
              {[
                { key: 'property_name', label: 'PROPERTY' },
                { key: 'city', label: 'LOCATION' },
                { key: 'property_type', label: 'TYPE' },
                { key: 'asset_class', label: 'CLASS' },
                { key: 'unit_count', label: 'UNITS' },
                { key: 'year_built', label: 'VINTAGE' },
                { key: 'avg_rent', label: 'AVG RENT' },
                { key: 'occupancy_rate', label: 'OCC' },
                { key: 'cap_rate', label: 'CAP' },
                { key: 'sale_price', label: 'SALE $' },
                { key: 'source_type', label: 'SOURCE' },
                { key: 'data_quality_score', label: 'DQ' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '8px 6px', textAlign: 'left', color: BT.text.muted,
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${BT.border.medium}`,
                    fontSize: 9, letterSpacing: 0.5,
                  }}
                >
                  {col.label}{sortArrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ padding: 40, textAlign: 'center', color: BT.text.muted }}>
                  Loading assets...
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: 40, textAlign: 'center', color: BT.text.muted }}>
                  <div style={{ marginBottom: 8, fontSize: 12 }}>No assets in the data library yet</div>
                  <div style={{ fontSize: 10, color: BT.text.secondary }}>
                    Assets are auto-populated from closed deals, or can be imported manually via CSV
                  </div>
                </td>
              </tr>
            ) : (
              assets.map((a, i) => {
                const src = SOURCE_LABELS[a.source_type] || { label: (a.source_type || '').toUpperCase(), color: BT.text.muted };
                const classColor = CLASS_COLORS[a.asset_class] || BT.text.muted;
                return (
                  <tr
                    key={a.id}
                    onClick={() => setEditingAsset(a)}
                    title="Click to edit details or attach files"
                    style={{ background: i % 2 === 0 ? BT.bg.panel : BT.bg.panelAlt, borderBottom: `1px solid ${BT.border.subtle}`, cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px', maxWidth: 160 }}>
                      <div style={{ color: BT.text.primary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.property_name || '—'}
                      </div>
                      <div style={{ color: BT.text.muted, fontSize: 9 }}>{a.address || ''}</div>
                    </td>
                    <td style={{ padding: '6px', color: BT.text.secondary, whiteSpace: 'nowrap' }}>
                      {a.city}{a.state ? `, ${a.state}` : ''}
                      {a.submarket_name && <div style={{ fontSize: 9, color: BT.text.muted }}>{a.submarket_name}</div>}
                    </td>
                    <td style={{ padding: '6px', color: BT.text.cyan, textTransform: 'uppercase' }}>
                      {(a.property_type || '—').replace('_', ' ')}
                      {a.property_subtype && <div style={{ fontSize: 9, color: BT.text.muted }}>{a.property_subtype}</div>}
                    </td>
                    <td style={{ padding: '6px' }}>
                      <span style={{ color: classColor, fontWeight: 700 }}>{a.asset_class || '—'}</span>
                    </td>
                    <td style={{ padding: '6px', color: BT.text.primary, textAlign: 'right' }}>
                      {fmt(a.unit_count)}
                      {a.height_class && <div style={{ fontSize: 9, color: BT.text.muted }}>{a.height_class}</div>}
                    </td>
                    <td style={{ padding: '6px', color: BT.text.secondary }}>
                      {a.year_built || '—'}
                      {a.vintage_tier && <div style={{ fontSize: 9, color: BT.text.muted }}>{a.vintage_tier}</div>}
                    </td>
                    <td style={{ padding: '6px', color: BT.text.green, textAlign: 'right' }}>
                      {a.avg_rent ? `$${Number(a.avg_rent).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: a.occupancy_rate && Number(a.occupancy_rate) >= 93 ? BT.text.green : a.occupancy_rate ? BT.text.orange : BT.text.muted }}>
                      {a.occupancy_rate ? `${Number(a.occupancy_rate).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '6px', color: BT.text.amber, textAlign: 'right' }}>
                      {a.cap_rate ? `${(Number(a.cap_rate) * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td style={{ padding: '6px', color: BT.text.primary, textAlign: 'right' }}>
                      {fmtCurrency(a.sale_price)}
                      {a.price_per_unit && <div style={{ fontSize: 9, color: BT.text.muted }}>{fmtCurrency(a.price_per_unit)}/u</div>}
                    </td>
                    <td style={{ padding: '6px' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: src.color,
                        padding: '1px 6px', border: `1px solid ${src.color}33`,
                        background: `${src.color}11`,
                      }}>{src.label}</span>
                    </td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>
                      <div style={{
                        width: 28, height: 4, background: BT.bg.panelAlt,
                        position: 'relative', display: 'inline-block',
                      }}>
                        <div style={{
                          width: `${Math.min(a.data_quality_score || 0, 100)}%`, height: '100%',
                          background: (a.data_quality_score || 0) > 70 ? BT.text.green : (a.data_quality_score || 0) > 40 ? BT.text.amber : BT.text.red,
                        }} />
                      </div>
                      <div style={{ fontSize: 9, color: BT.text.muted }}>{a.data_quality_score || 0}</div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div style={{ padding: '10px 16px', borderTop: `1px solid ${BT.border.subtle}`, textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: BT.text.muted, fontFamily: MONO }}>
            Showing {assets.length} of {total} assets
          </span>
        </div>
      )}

      {editingAsset && (
        <AssetDetailModal
          assetId={editingAsset.id}
          customLabel={editingAsset.property_name || ''}
          editMode
          onClose={() => setEditingAsset(null)}
          onSave={() => { fetchAssets(); fetchStats(); }}
        />
      )}
    </div>
  );
}
