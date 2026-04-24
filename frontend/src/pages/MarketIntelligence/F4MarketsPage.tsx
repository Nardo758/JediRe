/**
 * F4MarketsPage - Bloomberg-style Markets Landing Page
 * Shows all MSAs in a grid/table view with drill-down to MSATerminal
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Search, 
  Award, Users, Grid, List, Filter, ChevronDown,
  RefreshCw, CheckCircle, XCircle, Loader2, AlertCircle, X
} from 'lucide-react';
import { BT } from '../../components/terminal/theme';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';

interface MSACard {
  id: string;
  name: string;
  state: string;
  region: string;
  population: number;
  populationGrowth: number;
  submarketCount: number;
  propertyCount: number;
  totalUnits: number;
  avgRent: number;
  rentGrowth: number;
  occupancy: number;
  avgCapRate: number;
  pipelineUnits: number;
  healthScore: number;
  rank: number;
}

type ViewMode = 'grid' | 'table';
type SortKey = 'rank' | 'name' | 'avgRent' | 'rentGrowth' | 'healthScore' | 'population';

interface F4MarketsPageProps {
  onSelectMarket?: (marketId: string, marketName: string) => void;
  embedded?: boolean;
}

export const F4MarketsPage: React.FC<F4MarketsPageProps> = ({ onSelectMarket, embedded }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'owner';

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  
  // Market dropdown state
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Scroll hint state
  const [tableScrolled, setTableScrolled] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Pipeline refresh state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [showPipelinePanel, setShowPipelinePanel] = useState(false);

  const handleRunPipeline = useCallback(async () => {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    setPipelineResult(null);
    setPipelineError(null);
    setShowPipelinePanel(true);
    try {
      const res: any = await apiClient.post('/georgia/run-pipeline', { skipNews: false });
      setPipelineResult(res);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Pipeline failed';
      setPipelineError(msg);
    } finally {
      setPipelineRunning(false);
    }
  }, [pipelineRunning]);

  // Tracked markets (would come from user preferences in production)
  const trackedMarketIds = ['atlanta-ga', 'raleigh-nc', 'tampa-fl', 'charlotte-nc', 'nashville-tn', 'miami-fl'];

  // Mock MSA data
  const markets: MSACard[] = useMemo(() => [
    { id: 'atlanta-ga', name: 'Atlanta', state: 'GA', region: 'Southeast', population: 6200000, populationGrowth: 1.8, submarketCount: 24, propertyCount: 1847, totalUnits: 485000, avgRent: 1680, rentGrowth: 4.2, occupancy: 94.1, avgCapRate: 5.3, pipelineUnits: 28500, healthScore: 82, rank: 5 },
    { id: 'dallas-tx', name: 'Dallas', state: 'TX', region: 'Southwest', population: 7900000, populationGrowth: 2.1, submarketCount: 32, propertyCount: 2450, totalUnits: 620000, avgRent: 1620, rentGrowth: 3.8, occupancy: 93.2, avgCapRate: 5.2, pipelineUnits: 42000, healthScore: 80, rank: 6 },
    { id: 'phoenix-az', name: 'Phoenix', state: 'AZ', region: 'Southwest', population: 5000000, populationGrowth: 2.5, submarketCount: 18, propertyCount: 1320, totalUnits: 380000, avgRent: 1620, rentGrowth: 3.5, occupancy: 93.5, avgCapRate: 5.4, pipelineUnits: 24000, healthScore: 78, rank: 9 },
    { id: 'charlotte-nc', name: 'Charlotte', state: 'NC', region: 'Southeast', population: 2700000, populationGrowth: 2.2, submarketCount: 14, propertyCount: 980, totalUnits: 245000, avgRent: 1580, rentGrowth: 5.1, occupancy: 94.5, avgCapRate: 5.0, pipelineUnits: 18000, healthScore: 86, rank: 3 },
    { id: 'austin-tx', name: 'Austin', state: 'TX', region: 'Southwest', population: 2400000, populationGrowth: 2.8, submarketCount: 12, propertyCount: 720, totalUnits: 195000, avgRent: 1750, rentGrowth: 2.5, occupancy: 91.8, avgCapRate: 4.9, pipelineUnits: 22000, healthScore: 75, rank: 8 },
    { id: 'nashville-tn', name: 'Nashville', state: 'TN', region: 'Southeast', population: 2000000, populationGrowth: 1.9, submarketCount: 10, propertyCount: 620, totalUnits: 165000, avgRent: 1720, rentGrowth: 4.8, occupancy: 94.1, avgCapRate: 5.1, pipelineUnits: 12000, healthScore: 84, rank: 4 },
    { id: 'raleigh-nc', name: 'Raleigh', state: 'NC', region: 'Southeast', population: 1500000, populationGrowth: 2.4, submarketCount: 8, propertyCount: 480, totalUnits: 125000, avgRent: 1580, rentGrowth: 5.5, occupancy: 95.2, avgCapRate: 4.8, pipelineUnits: 8500, healthScore: 90, rank: 2 },
    { id: 'tampa-fl', name: 'Tampa', state: 'FL', region: 'Southeast', population: 3200000, populationGrowth: 1.6, submarketCount: 16, propertyCount: 1150, totalUnits: 295000, avgRent: 1780, rentGrowth: 4.2, occupancy: 93.8, avgCapRate: 5.3, pipelineUnits: 21000, healthScore: 79, rank: 7 },
    { id: 'denver-co', name: 'Denver', state: 'CO', region: 'Mountain', population: 2900000, populationGrowth: 1.2, submarketCount: 15, propertyCount: 890, totalUnits: 245000, avgRent: 1850, rentGrowth: 2.8, occupancy: 94.2, avgCapRate: 5.0, pipelineUnits: 15000, healthScore: 81, rank: 5 },
    { id: 'seattle-wa', name: 'Seattle', state: 'WA', region: 'Pacific', population: 4000000, populationGrowth: 1.1, submarketCount: 18, propertyCount: 1050, totalUnits: 285000, avgRent: 2150, rentGrowth: 3.2, occupancy: 94.5, avgCapRate: 4.6, pipelineUnits: 18000, healthScore: 83, rank: 4 },
    { id: 'miami-fl', name: 'Miami', state: 'FL', region: 'Southeast', population: 6200000, populationGrowth: 1.4, submarketCount: 22, propertyCount: 1680, totalUnits: 420000, avgRent: 2280, rentGrowth: 5.8, occupancy: 95.1, avgCapRate: 4.5, pipelineUnits: 32000, healthScore: 88, rank: 1 },
    { id: 'orlando-fl', name: 'Orlando', state: 'FL', region: 'Southeast', population: 2700000, populationGrowth: 1.8, submarketCount: 14, propertyCount: 920, totalUnits: 235000, avgRent: 1720, rentGrowth: 4.5, occupancy: 94.0, avgCapRate: 5.2, pipelineUnits: 17500, healthScore: 81, rank: 6 },
  ], []);

  const regions = useMemo(() => 
    ['all', ...new Set(markets.map(m => m.region))],
    [markets]
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMarketDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll hint handlers
  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    setTableScrolled(container.scrollLeft > 10);
    setCanScrollMore(container.scrollLeft + container.clientWidth < container.scrollWidth - 10);
  };

  useEffect(() => {
    const checkScroll = () => {
      if (tableContainerRef.current) {
        const { scrollWidth, clientWidth, scrollLeft } = tableContainerRef.current;
        setCanScrollMore(scrollLeft + clientWidth < scrollWidth - 10);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [viewMode, markets]);

  // Filter and sort
  const filteredMarkets = useMemo(() => {
    let result = [...markets];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.state.toLowerCase().includes(q)
      );
    }
    
    if (regionFilter !== 'all') {
      result = result.filter(m => m.region === regionFilter);
    }
    
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
    
    return result;
  }, [markets, searchQuery, regionFilter, sortBy, sortDir]);

  const handleMarketClick = (market: MSACard) => {
    if (onSelectMarket) {
      onSelectMarket(market.id, market.name);
    } else {
      navigate(`/markets/${market.id}`);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 85) return BT.text.green;
    if (score >= 75) return BT.text.amber;
    return BT.text.red;
  };

  return (
    <div style={{
      minHeight: embedded ? 0 : '100vh',
      background: BT.bg.terminal,
      color: BT.text.primary,
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        @keyframes scrollPulse {
          0%, 100% { opacity: 1; transform: translateX(0); }
          50% { opacity: 0.5; transform: translateX(4px); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Pipeline progress panel — fixed bottom right */}
      {showPipelinePanel && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 380,
          background: '#0D1117',
          border: `1px solid ${pipelineError ? '#FF475755' : pipelineRunning ? '#F5A62355' : '#00D26A55'}`,
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9999,
          animation: 'slideUp 0.25s ease',
          fontFamily: "'JetBrains Mono', monospace",
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px',
            background: pipelineError ? '#FF475715' : pipelineRunning ? '#F5A62315' : '#00D26A15',
            borderBottom: `1px solid ${BT.border.subtle}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pipelineRunning
                ? <Loader2 size={13} color={BT.text.amber} style={{ animation: 'spin 1s linear infinite' }} />
                : pipelineError
                  ? <XCircle size={13} color={BT.text.red} />
                  : <CheckCircle size={13} color={BT.text.green} />
              }
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: pipelineError ? BT.text.red : pipelineRunning ? BT.text.amber : BT.text.green }}>
                {pipelineRunning ? 'PIPELINE RUNNING' : pipelineError ? 'PIPELINE FAILED' : 'PIPELINE COMPLETE'}
              </span>
            </div>
            {!pipelineRunning && (
              <button onClick={() => setShowPipelinePanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: BT.text.muted, padding: 2 }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Steps */}
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pipelineRunning && !pipelineResult && (
              <div style={{ fontSize: 11, color: BT.text.muted, paddingBottom: 4 }}>
                Ingesting Atlanta county data — this may take 2–5 minutes…
              </div>
            )}

            {pipelineError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={12} color={BT.text.red} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: BT.text.red }}>{pipelineError}</span>
              </div>
            )}

            {pipelineResult && (() => {
              const p = pipelineResult.pipeline ?? {};
              const durationSec = pipelineResult.durationMs ? (pipelineResult.durationMs / 1000).toFixed(1) : null;
              const steps = [
                {
                  label: 'County Ingestion',
                  key: 'countyIngest',
                  ok: !p.countyIngest?.error,
                  detail: p.countyIngest?.error
                    ? p.countyIngest.error
                    : `${p.countyIngest?.inserted ?? '?'} inserted · ${p.countyIngest?.counties?.length ?? 0} counties`,
                },
                {
                  label: 'Comp Pool Promotion',
                  key: 'compsPromote',
                  ok: !p.compsPromote?.error,
                  detail: p.compsPromote?.error
                    ? p.compsPromote.error
                    : `${Array.isArray(p.compsPromote?.counties) ? p.compsPromote.counties.length : '?'} counties promoted`,
                },
                {
                  label: 'Apt Locator Sync',
                  key: 'aptLocatorSync',
                  ok: !p.aptLocatorSync?.error,
                  detail: p.aptLocatorSync?.error
                    ? p.aptLocatorSync.error
                    : `${p.aptLocatorSync?.synced ?? p.aptLocatorSync?.inserted ?? '?'} records synced`,
                },
                {
                  label: 'Geocode Apt Locator',
                  key: 'aptLocatorGeocode',
                  ok: !p.aptLocatorGeocode?.error,
                  detail: p.aptLocatorGeocode?.error
                    ? p.aptLocatorGeocode.error
                    : `${p.aptLocatorGeocode?.geocoded ?? '?'} geocoded · ${p.aptLocatorGeocode?.skipped ?? 0} skipped`,
                },
                {
                  label: 'News Ingestion',
                  key: 'newsIngest',
                  ok: !p.newsIngest?.error,
                  detail: p.newsIngest?.error
                    ? p.newsIngest.error
                    : p.newsIngest
                      ? `${p.newsIngest?.inserted ?? p.newsIngest?.count ?? '?'} articles`
                      : 'Skipped',
                },
              ];
              return (
                <>
                  {steps.map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      {s.ok
                        ? <CheckCircle size={12} color={BT.text.green} style={{ marginTop: 2, flexShrink: 0 }} />
                        : <XCircle size={12} color={BT.text.red} style={{ marginTop: 2, flexShrink: 0 }} />
                      }
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: BT.text.primary, letterSpacing: 0.5 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: s.ok ? BT.text.secondary : BT.text.red, marginTop: 1 }}>{s.detail}</div>
                      </div>
                    </div>
                  ))}
                  {durationSec && (
                    <div style={{ borderTop: `1px solid ${BT.border.subtle}`, marginTop: 4, paddingTop: 8, fontSize: 10, color: BT.text.muted }}>
                      Completed in {durationSec}s
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '20px 32px',
        background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: BT.text.muted, letterSpacing: '0.1em', marginBottom: 4 }}>
              F4 MARKETS
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: BT.text.primary }}>
              Market Intelligence
            </div>
            <div style={{ fontSize: 12, color: BT.text.secondary, marginTop: 4 }}>
              {markets.length} markets • {markets.reduce((sum, m) => sum + m.submarketCount, 0)} submarkets • {markets.reduce((sum, m) => sum + m.propertyCount, 0).toLocaleString()} properties
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Refresh Atlanta Data button — owner only */}
            {isOwner && (
              <button
                onClick={handleRunPipeline}
                disabled={pipelineRunning}
                title="Re-ingest all Atlanta county property, sales, apt locator, and news data"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  background: pipelineRunning ? BT.bg.input : '#00D26A18',
                  border: `1px solid ${pipelineRunning ? BT.border.subtle : '#00D26A55'}`,
                  borderRadius: 6,
                  color: pipelineRunning ? BT.text.muted : BT.text.green,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: pipelineRunning ? 'not-allowed' : 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.3,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                {pipelineRunning
                  ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  : <RefreshCw size={13} />
                }
                {pipelineRunning ? 'RUNNING…' : '↻ REFRESH DATA'}
              </button>
            )}
            {/* Market Dropdown */}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                onClick={() => setMarketDropdownOpen(!marketDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: BT.bg.input,
                  border: `1px solid ${marketDropdownOpen ? BT.text.amber : BT.border.subtle}`,
                  borderRadius: 6,
                  color: BT.text.primary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  minWidth: 160,
                }}
              >
                <MapPin size={14} color={BT.text.amber} />
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {selectedMarket 
                    ? markets.find(m => m.id === selectedMarket)?.name || 'All Markets'
                    : 'All Markets'
                  }
                </span>
                <ChevronDown 
                  size={14} 
                  color={BT.text.muted}
                  style={{ 
                    transition: 'transform 0.2s',
                    transform: marketDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}
                />
              </button>
              
              {/* Dropdown Menu */}
              {marketDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  width: 220,
                  background: BT.bg.panel,
                  border: `1px solid ${BT.border.subtle}`,
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  zIndex: 100,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}>
                  {/* All Markets option */}
                  <button
                    onClick={() => {
                      setSelectedMarket(null);
                      setMarketDropdownOpen(false);
                      setSearchQuery('');
                      setRegionFilter('all');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: selectedMarket === null ? BT.bg.active : 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${BT.border.subtle}`,
                      color: BT.text.primary,
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Grid size={14} color={BT.text.muted} />
                    <span style={{ fontWeight: 500 }}>All Markets</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: BT.text.muted }}>
                      {markets.length}
                    </span>
                  </button>

                  {/* Divider */}
                  <div style={{ 
                    padding: '6px 14px', 
                    fontSize: 9, 
                    color: BT.text.dim, 
                    letterSpacing: '0.1em',
                    borderBottom: `1px solid ${BT.border.subtle}`,
                    background: BT.bg.header,
                  }}>
                    ★ TRACKED MARKETS
                  </div>

                  {/* Tracked Markets */}
                  {markets
                    .filter(m => trackedMarketIds.includes(m.id))
                    .sort((a, b) => a.rank - b.rank)
                    .map((market) => (
                      <button
                        key={market.id}
                        onClick={() => {
                          setSelectedMarket(market.id);
                          setMarketDropdownOpen(false);
                          handleMarketClick(market);
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 14px',
                          background: selectedMarket === market.id ? BT.bg.active : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${BT.border.subtle}`,
                          color: BT.text.primary,
                          fontSize: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ 
                          color: BT.text.amber, 
                          fontSize: 10,
                          fontWeight: 700,
                          width: 20,
                          textAlign: 'center'
                        }}>
                          #{market.rank}
                        </span>
                        <span style={{ fontWeight: 500, flex: 1 }}>
                          {market.name}, {market.state}
                        </span>
                        <span style={{ 
                          fontSize: 10, 
                          color: getHealthColor(market.healthScore),
                          fontWeight: 600,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {market.healthScore}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div style={{ width: 1, height: 24, background: BT.border.subtle }} />

            {/* View Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: 8,
                  background: viewMode === 'grid' ? BT.bg.active : 'transparent',
                  border: `1px solid ${viewMode === 'grid' ? BT.text.amber : BT.border.subtle}`,
                  borderRadius: 4,
                  color: viewMode === 'grid' ? BT.text.amber : BT.text.muted,
                  cursor: 'pointer',
                }}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: 8,
                  background: viewMode === 'table' ? BT.bg.active : 'transparent',
                  border: `1px solid ${viewMode === 'table' ? BT.text.amber : BT.border.subtle}`,
                  borderRadius: 4,
                  color: viewMode === 'table' ? BT.text.amber : BT.text.muted,
                  cursor: 'pointer',
                }}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: BT.bg.input,
            borderRadius: 6,
            border: `1px solid ${BT.border.subtle}`,
            width: 280,
          }}>
            <Search size={14} color={BT.text.muted} />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: BT.text.primary,
                fontSize: 12,
                outline: 'none',
                flex: 1,
              }}
            />
          </div>
          
          {/* Region Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color={BT.text.muted} />
            {regions.map((region) => (
              <button
                key={region}
                onClick={() => setRegionFilter(region)}
                style={{
                  padding: '6px 12px',
                  background: regionFilter === region ? BT.bg.active : 'transparent',
                  border: `1px solid ${regionFilter === region ? BT.text.amber : BT.border.subtle}`,
                  borderRadius: 4,
                  color: regionFilter === region ? BT.text.amber : BT.text.muted,
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {region === 'all' ? 'All Regions' : region}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: BT.text.muted }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              style={{
                padding: '6px 10px',
                background: BT.bg.input,
                border: `1px solid ${BT.border.subtle}`,
                borderRadius: 4,
                color: BT.text.primary,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <option value="rank">Rank</option>
              <option value="name">Name</option>
              <option value="healthScore">Health Score</option>
              <option value="avgRent">Avg Rent</option>
              <option value="rentGrowth">Rent Growth</option>
              <option value="population">Population</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 32 }}>
        {viewMode === 'grid' ? (
          /* Grid View */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {filteredMarkets.map((market) => (
              <div
                key={market.id}
                onClick={() => handleMarketClick(market)}
                style={{
                  background: BT.bg.panel,
                  borderRadius: 8,
                  border: `1px solid ${BT.border.subtle}`,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = BT.text.amber;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = BT.border.subtle;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Card Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: BT.bg.header,
                  borderBottom: `1px solid ${BT.border.subtle}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: `${BT.text.amber}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <MapPin size={18} color={BT.text.amber} />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.primary }}>
                        {market.name}
                      </div>
                      <div style={{ fontSize: 10, color: BT.text.muted }}>
                        {market.state} • {market.region}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: `${getHealthColor(market.healthScore)}22`,
                    borderRadius: 4,
                    border: `1px solid ${getHealthColor(market.healthScore)}44`,
                  }}>
                    <Award size={14} color={getHealthColor(market.healthScore)} />
                    <span style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: getHealthColor(market.healthScore),
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {market.healthScore}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: 16 }}>
                  {/* Key Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>AVG RENT</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.green, fontFamily: "'JetBrains Mono'" }}>
                        ${market.avgRent.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: market.rentGrowth >= 0 ? BT.text.green : BT.text.red }}>
                        {market.rentGrowth > 0 ? '+' : ''}{market.rentGrowth}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>OCCUPANCY</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: market.occupancy >= 94 ? BT.text.green : BT.text.amber, fontFamily: "'JetBrains Mono'" }}>
                        {market.occupancy}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: BT.text.muted, marginBottom: 2 }}>CAP RATE</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: BT.text.cyan, fontFamily: "'JetBrains Mono'" }}>
                        {market.avgCapRate}%
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderTop: `1px solid ${BT.border.subtle}`,
                    fontSize: 10,
                    color: BT.text.muted,
                  }}>
                    <span><strong style={{ color: BT.text.secondary }}>{market.submarketCount}</strong> submarkets</span>
                    <span><strong style={{ color: BT.text.secondary }}>{(market.totalUnits / 1000).toFixed(0)}K</strong> units</span>
                    <span>Pipeline <strong style={{ color: BT.text.amber }}>{(market.pipelineUnits / 1000).toFixed(0)}K</strong></span>
                  </div>
                </div>

                {/* Card Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 16px',
                  background: BT.bg.header,
                  borderTop: `1px solid ${BT.border.subtle}`,
                  fontSize: 10,
                }}>
                  <span style={{ color: BT.text.muted }}>
                    Rank <strong style={{ color: BT.text.amber }}>#{market.rank}</strong>
                  </span>
                  <span style={{ color: BT.text.muted }}>
                    <Users size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {(market.population / 1000000).toFixed(1)}M pop
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div style={{ position: 'relative' }}>
            <div 
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              style={{
                background: BT.bg.panel,
                borderRadius: 8,
                border: `1px solid ${BT.border.subtle}`,
                overflow: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ background: BT.bg.header }}>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 10, fontWeight: 500, width: 50 }}>RANK</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>MARKET</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>HEALTH</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>POP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>UNITS</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>AVG RENT</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>GROWTH</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>OCC</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>CAP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: BT.text.muted, fontSize: 10, fontWeight: 500 }}>PIPELINE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.map((market) => (
                    <tr
                      key={market.id}
                      onClick={() => handleMarketClick(market)}
                      style={{ 
                        borderBottom: `1px solid ${BT.border.subtle}`,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = BT.bg.cardHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          width: 24,
                          height: 24,
                          lineHeight: '24px',
                          borderRadius: '50%',
                          background: market.rank <= 3 ? `${BT.text.green}22` : BT.bg.cardHover,
                          color: market.rank <= 3 ? BT.text.green : BT.text.muted,
                          fontWeight: 700,
                          fontSize: 11,
                        }}>
                          {market.rank}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: BT.text.primary }}>{market.name}, {market.state}</div>
                        <div style={{ fontSize: 10, color: BT.text.muted }}>{market.region} • {market.submarketCount} submarkets</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ color: getHealthColor(market.healthScore), fontWeight: 700, fontFamily: "'JetBrains Mono'" }}>
                          {market.healthScore}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                        {(market.population / 1000000).toFixed(1)}M
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                        {(market.totalUnits / 1000).toFixed(0)}K
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.green, fontWeight: 600 }}>
                        ${market.avgRent.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, color: market.rentGrowth >= 0 ? BT.text.green : BT.text.red, fontWeight: 600 }}>
                        {market.rentGrowth > 0 ? '+' : ''}{market.rentGrowth}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: market.occupancy >= 94 ? BT.text.green : BT.text.amber }}>
                        {market.occupancy}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.cyan }}>
                        {market.avgCapRate}%
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: "'JetBrains Mono'", fontSize: 11, color: BT.text.amber }}>
                        {(market.pipelineUnits / 1000).toFixed(0)}K
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Scroll Hint Bar */}
            {canScrollMore && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 16px',
                marginTop: 8,
                background: `${BT.text.amber}11`,
                border: `1px solid ${BT.text.amber}33`,
                borderRadius: 6,
                fontSize: 11,
                color: BT.text.amber,
              }}>
                <span style={{ opacity: 0.7 }}>←</span>
                <span>Scroll for more: CAP RATE, PIPELINE</span>
                <span style={{ animation: 'scrollPulse 1.5s infinite', display: 'inline-block' }}>→</span>
              </div>
            )}
            
            {/* Left fade overlay when scrolled */}
            {tableScrolled && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 40,
                height: '100%',
                background: `linear-gradient(to right, ${BT.bg.panel}, transparent)`,
                pointerEvents: 'none',
                borderRadius: '8px 0 0 8px',
              }} />
            )}
            
            {/* Right fade overlay when can scroll more */}
            {canScrollMore && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 40,
                height: 'calc(100% - 50px)',
                background: `linear-gradient(to left, ${BT.bg.panel}, transparent)`,
                pointerEvents: 'none',
                borderRadius: '0 8px 8px 0',
              }} />
            )}
          </div>
        )}
      </div>

      {!embedded && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 32px',
          background: BT.bg.header,
          borderTop: `1px solid ${BT.border.subtle}`,
          fontSize: 10,
          color: BT.text.dim,
          gap: 16,
        }}>
          <span style={{ color: BT.text.green }}>● {filteredMarkets.length} Markets</span>
          <span>|</span>
          <span>{filteredMarkets.reduce((sum, m) => sum + m.submarketCount, 0)} Submarkets</span>
          <span>|</span>
          <span>{filteredMarkets.reduce((sum, m) => sum + m.propertyCount, 0).toLocaleString()} Properties</span>
          <span>|</span>
          <span>{(filteredMarkets.reduce((sum, m) => sum + m.totalUnits, 0) / 1000000).toFixed(1)}M Units</span>
          <span style={{ marginLeft: 'auto' }}>Click a market to view details</span>
        </div>
      )}
    </div>
  );
};

export default F4MarketsPage;
