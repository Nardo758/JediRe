import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api.client';
import { useMapSurfaceStore } from '../stores/mapSurfaceStore';
import type { ParcelRecord } from '../types/map-surface.types';
import { Map2DCanvas } from '../components/map-surface/Map2DCanvas';
import { normalizeAssessorParcel } from '../components/map-surface/PropertySurfaceModule';

/**
 * ═══════════════════════════════════════════════════════════════════
 * MAP DISCOVERY PAGE — /surface
 * ═══════════════════════════════════════════════════════════════════
 *
 * Full-screen parcel discovery surface. Users search by address or
 * parcel ID, view the assessor boundary on the Mapbox satellite map,
 * inspect parcel details, and create a deal directly from the map.
 *
 * Route: /surface
 * Next:  /deals/create?parcelId=...&address=...&boundary=...
 */
export const MapDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();

  // Store
  const selectParcel = useMapSurfaceStore((s) => s.selectParcel);
  const selectedProperty = useMapSurfaceStore((s) => s.selectedProperty);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [parcelBoundary, setParcelBoundary] = useState<GeoJSON.Polygon | undefined>(undefined);

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      {/* ─── Map Canvas (full bleed) ─── */}
      <div className="absolute inset-0">
        <Map2DCanvas
          dealType="discovery"
          parcelBoundary={parcelBoundary}
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
        />
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

      {/* ─── Bottom-left badge ─── */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-xs text-gray-600">
        <span className="font-semibold text-gray-800">JediRe Surface</span>
        <span className="mx-2 text-gray-300">|</span>
        <span className="text-gray-500">Discovery Mode</span>
        {selectedProperty && (
          <>
            <span className="mx-2 text-gray-300">|</span>
            <span className="text-green-600 font-medium">Parcel loaded ✓</span>
          </>
        )}
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

export default MapDiscoveryPage;
