import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { useMapSurfaceStore } from '../stores/mapSurfaceStore';
import type { ParcelRecord } from '../types/map-surface.types';
import { Map2DCanvas, type Map2DCanvasHandle } from '../components/map-surface/Map2DCanvas';
import { DealPinLayer } from '../components/map-surface/DealPinLayer';
import { SubmarketBubbleLayer } from '../components/map-surface/SubmarketBubbleLayer';
import { TrafficHeatmapLayer } from '../components/map-surface/TrafficHeatmapLayer';
import { normalizeAssessorParcel } from '../components/map-surface/PropertySurfaceModule';
import { TIER_COLORS } from '../components/map-surface/FlagPin';

/**
 * ═══════════════════════════════════════════════════════════════════
 * MAP DISCOVERY PAGE — /surface
 * ═══════════════════════════════════════════════════════════════════
 *
 * Full-screen parcel discovery surface. Users search by address or
 * parcel ID, view the assessor boundary on the Mapbox satellite map,
 * inspect parcel details, and create a deal directly from the map.
 *
 * Phase 1 additions:
 *   • Layer toggles (Parcels / Pipeline / Portfolio)
 *   • Metric selector (Color By + Display)
 *   • Flag pins with tier coloring
 *   • Expandable popup on pin click
 *
 * Phase 2 additions:
 *   • Deal clustering at low zoom (Supercluster)
 *   • Cluster click → flyTo expansion zoom
 *   • Submarket aggregation bubbles
 *   • Traffic prediction heatmap
 *
 * Route: /surface
 * Next:  /deals/create?parcelId=...&address=...&boundary=...
 */

const METRIC_OPTIONS = [
  { value: 'jediScore', label: 'JEDI Score' },
  { value: 'occupancyRate', label: 'Occupancy' },
  { value: 'rentGrowth', label: 'Rent Growth' },
  { value: 'concessions', label: 'Concessions' },
  { value: 'vacancyLoss', label: 'Vacancy Loss' },
  { value: 'noi', label: 'NOI' },
];

export const MapDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();

  // Map canvas ref for flyTo on cluster click
  const mapCanvasRef = useRef<Map2DCanvasHandle>(null);

  // Store
  const selectParcel = useMapSurfaceStore((s) => s.selectParcel);
  const selectedProperty = useMapSurfaceStore((s) => s.selectedProperty);

  // Local state — search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [parcelBoundary, setParcelBoundary] = useState<GeoJSON.Polygon | undefined>(undefined);

  // Local state — layer toggles & metric selectors
  const [showParcels, setShowParcels] = useState(true);
  const [showPipeline, setShowPipeline] = useState(true);
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [showSubmarkets, setShowSubmarkets] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [colorBy, setColorBy] = useState('jediScore');
  const [display, setDisplay] = useState('jediScore');

  // Local state — map view (for clustering)
  const [mapZoom, setMapZoom] = useState(13);
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  // Seed search from URL ?search=... (arriving from Deal Detail or Terminal)
  useEffect(() => {
    const q = urlSearchParams.get('search');
    if (q) {
      setSearchQuery(q);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-search when searchQuery was seeded from URL
  const didAutoSearchRef = React.useRef(false);
  useEffect(() => {
    if (searchQuery && !didAutoSearchRef.current && !isSearching && !selectedProperty) {
      didAutoSearchRef.current = true;
      const t = setTimeout(() => handleSearch(), 150);
      return () => clearTimeout(t);
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setError(null);
    setIsSearching(true);
    setPanelOpen(false);

    try {
      const trimmed = searchQuery.trim();
      const isParcelId = /^\d{2}-?[A-Z]-?\d{3}-?\d{3}$/i.test(trimmed) || /^\d+$/i.test(trimmed);

      const assessorRes = await apiClient.get('/api/assessor/lookup', {
        params: isParcelId ? { parcelId: trimmed } : { address: trimmed },
      });

      if (assessorRes.data?.success && assessorRes.data?.parcel) {
        const parcel = normalizeAssessorParcel(assessorRes.data.parcel);
        selectParcel(parcel);
        setParcelBoundary(parcel.geometry);
        setPanelOpen(true);
      } else {
        setError('No parcel found for that query');
        selectParcel(null);
        setParcelBoundary(undefined);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Search failed';
      setError(msg);
      selectParcel(null);
      setParcelBoundary(undefined);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectParcel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleUnderwrite = () => {
    if (!selectedProperty) return;
    const p = selectedProperty;
    const params = new URLSearchParams();
    params.set('parcelId', p.parcelId);
    params.set('address', p.address);
    if (p.geometry && p.geometry.coordinates?.length > 0) {
      params.set('boundary', JSON.stringify(p.geometry));
    }
    navigate(`/deals/create?${params.toString()}`);
  };

  const handleClear = () => {
    setSearchQuery('');
    setError(null);
    selectParcel(null);
    setParcelBoundary(undefined);
    setPanelOpen(false);
  };

  const handleClusterZoom = useCallback((center: [number, number], zoom: number) => {
    mapCanvasRef.current?.flyTo({ center, zoom });
  }, []);

  // Build ownership filter array from toggles
  const ownershipFilter = [
    ...(showPipeline ? ['pipeline'] : []),
    ...(showPortfolio ? ['portfolio'] : []),
  ];

  const anyDealLayerVisible = showPipeline || showPortfolio;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      {/* ─── Map Canvas (full bleed) ─── */}
      <div className="absolute inset-0">
        <Map2DCanvas
          ref={mapCanvasRef}
          dealType="discovery"
          parcelBoundary={showParcels ? parcelBoundary : undefined}
          onParcelSelect={(p) => {
            if (p) {
              selectParcel(p);
              setParcelBoundary(p.geometry);
              setPanelOpen(true);
            } else {
              selectParcel(null);
              setParcelBoundary(undefined);
              setPanelOpen(false);
            }
          }}
          onViewStateChange={({ zoom, bounds }) => {
            setMapZoom(zoom);
            setMapBounds(bounds);
          }}
        >
          {/* Traffic prediction heatmap */}
          <TrafficHeatmapLayer visible={showTraffic} />

          {/* Submarket aggregation bubbles */}
          <SubmarketBubbleLayer
            visible={showSubmarkets}
            colorBy={colorBy}
          />

          {/* Deal flag pins */}
          {anyDealLayerVisible && (
            <DealPinLayer
              colorBy={colorBy}
              display={display}
              visible={anyDealLayerVisible}
              ownershipFilter={ownershipFilter.length > 0 ? ownershipFilter : undefined}
              mapZoom={mapZoom}
              mapBounds={mapBounds}
              onClusterZoom={handleClusterZoom}
            />
          )}
        </Map2DCanvas>
      </div>

      {/* ─── Floating Search Bar (top-center) ─── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl px-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex items-center">
          <div className="pl-4 text-gray-400">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by address or parcel ID..."
            className="flex-1 px-3 py-3.5 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="px-3 text-gray-400 hover:text-gray-600 transition"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-5 py-3.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Error toast under search bar */}
        {error && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 shadow-sm flex items-center gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* ─── Layer Toggle & Metric Control Bar (top-right) ─── */}
      <div className="absolute top-6 right-4 z-10 flex flex-col gap-2 items-end">
        {/* Layer toggles */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-3">
          <ToggleChip
            label="Parcels"
            active={showParcels}
            onClick={() => setShowParcels((v) => !v)}
            color="#2563eb"
          />
          <ToggleChip
            label="Pipeline"
            active={showPipeline}
            onClick={() => setShowPipeline((v) => !v)}
            color="#d97706"
          />
          <ToggleChip
            label="Portfolio"
            active={showPortfolio}
            onClick={() => setShowPortfolio((v) => !v)}
            color="#1d4ed8"
          />
          <ToggleChip
            label="Submarkets"
            active={showSubmarkets}
            onClick={() => setShowSubmarkets((v) => !v)}
            color="#7c3aed"
          />
          <ToggleChip
            label="Traffic"
            active={showTraffic}
            onClick={() => setShowTraffic((v) => !v)}
            color="#ef4444"
          />
        </div>

        {/* Metric selectors */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Color</span>
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {METRIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Display</span>
            <select
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {METRIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Legend Bar (bottom-center) ─── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-4">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Legend</span>
          <LegendDot color={TIER_COLORS.strong} label="Strong" />
          <LegendDot color={TIER_COLORS.fair} label="Fair" />
          <LegendDot color={TIER_COLORS.watch} label="Watch" />
          <LegendDot color={TIER_COLORS.risk} label="Risk" />
          <LegendDot color={TIER_COLORS.neutral} label="No Data" />
        </div>
      </div>

      {/* ─── Slide-in Parcel Panel (left) ─── */}
      <div
        className={`absolute top-0 left-0 h-full z-20 transition-transform duration-300 ease-out ${
          panelOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-80 bg-white shadow-2xl border-r border-gray-200 flex flex-col">
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Parcel Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">Assessor data</p>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedProperty ? (
              <div className="space-y-4">
                {/* Address + Parcel ID */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-semibold text-blue-900 text-sm leading-tight">
                    {selectedProperty.address}
                  </h4>
                  <p className="text-xs text-blue-700 mt-1">
                    Parcel ID: {selectedProperty.parcelId}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label="Owner" value={selectedProperty.ownerName} />
                  <MetricBox label="Land Use" value={selectedProperty.landUse} />
                  <MetricBox
                    label="Lot Size"
                    value={`${selectedProperty.lotSizeSqft.toLocaleString()} sqft`}
                  />
                  <MetricBox
                    label="Total Value"
                    value={`$${selectedProperty.totalAppraisedValue.toLocaleString()}`}
                  />
                </div>

                {/* Assessment Breakdown */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Assessment Breakdown
                  </h5>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Land</span>
                      <span className="font-medium text-gray-900">
                        ${selectedProperty.assessedLandValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Improvements</span>
                      <span className="font-medium text-gray-900">
                        ${selectedProperty.assessedImprovementValue.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1">
                      <span className="text-gray-600">Total</span>
                      <span className="font-semibold text-gray-900">
                        ${selectedProperty.totalAppraisedValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Jurisdiction
                  </h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">County</span>
                      <span className="font-medium text-gray-900">{selectedProperty.county}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">State</span>
                      <span className="font-medium text-gray-900">{selectedProperty.state}</span>
                    </div>
                  </div>
                </div>

                {/* Last Assessment */}
                <div className="text-xs text-gray-400">
                  Last assessed:{' '}
                  {new Date(selectedProperty.lastAssessmentDate).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📍</div>
                <p className="text-sm text-gray-500">Search for a parcel to see details</p>
              </div>
            )}
          </div>

          {/* Panel Footer — CTA */}
          {selectedProperty && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleUnderwrite}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <span>📋</span>
                Underwrite This Parcel
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Creates a new deal with this parcel pre-filled
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const MetricBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-2.5">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
  </div>
);

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}> = ({ label, active, onClick, color }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
      active
        ? 'border-transparent text-white'
        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
    }`}
    style={active ? { backgroundColor: color } : undefined}
  >
    <span
      className={`w-2 h-2 rounded-full ${active ? 'bg-white/80' : 'bg-gray-300'}`}
    />
    {label}
  </button>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-[10px] text-gray-500 font-medium">{label}</span>
  </div>
);

export default MapDiscoveryPage;
