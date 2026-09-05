import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient } from '../../services/api.client';
import { useMapSurfaceStore } from '../../stores/mapSurfaceStore';
import type { ParcelRecord } from '../../types/map-surface.types';
import { Map2DCanvas } from './Map2DCanvas';
import { ProceduralBuildingScene } from './ProceduralBuildingScene';
import { BuildingParameterPanel } from './BuildingParameterPanel';
import { DesignAgentPanel } from './DesignAgentPanel';
import { DEFAULT_BUILDING_PARAMS, type BuildingParameters } from '../../lib/building-engine';

interface PropertySurfaceModuleProps {
  dealId: string;
  dealType: string;
  parcelBoundary?: GeoJSON.Polygon;
  zoningProfile?: Record<string, unknown>;
}

/**
 * Convert an assessor API parcel response into our canonical ParcelRecord.
 * Falls back to deal boundary geometry when the assessor doesn't provide it.
 */
export function normalizeAssessorParcel(raw: any, fallbackBoundary?: GeoJSON.Polygon): ParcelRecord {
  return {
    parcelId: raw.parcelId ?? raw.parcel_id ?? '',
    address: raw.address ?? '',
    ownerName: raw.ownerName ?? raw.owner ?? 'Unknown',
    ownerMailingAddress: raw.ownerAddress ?? raw.owner_address ?? undefined,
    landUse: raw.propertyType ?? raw.property_type ?? raw.landUse ?? 'Unknown',
    lotSizeSqft: raw.lotSizeSqft ?? raw.lot_size_sqft ?? 0,
    assessedLandValue: raw.landAssessedValue ?? raw.land_assessed_value ?? 0,
    assessedImprovementValue: raw.improvementAssessedValue ?? raw.improvement_assessed_value ?? 0,
    totalAppraisedValue: raw.totalAssessedValue ?? raw.total_assessed_value ?? raw.totalAppraisedValue ?? 0,
    lastAssessmentDate: raw.lastAssessmentDate ?? raw.last_assessment_date ?? new Date().toISOString(),
    geometry: raw.geometry ?? fallbackBoundary ?? {
      type: 'Polygon',
      coordinates: [],
    } as unknown as GeoJSON.Polygon,
    county: raw.county ?? 'Unknown',
    state: raw.state ?? 'GA',
    rawAssessorData: raw,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * PROPERTY SURFACE MODULE — F7 Tab (M30)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Map-centric parcel intelligence with 3D design mode.
 * Phase 1: 2D map with parcel overlay, property sidebar, layer panel
 * Phase 3: 3D procedural building mode — parcel polygon extruded in real-time
 * Phase 3+: AI Generate mode (Design Agent via GPT-6 Astra)
 */
export const PropertySurfaceModule: React.FC<PropertySurfaceModuleProps> = ({
  dealId,
  dealType,
  parcelBoundary,
  zoningProfile,
}) => {
  const { id: urlDealId } = useParams<{ id: string }>();
  const effectiveDealId = dealId || urlDealId;

  // Store selectors
  const mode = useMapSurfaceStore((s) => s.mode);
  const setMode = useMapSurfaceStore((s) => s.setMode);
  const selectedProperty = useMapSurfaceStore((s) => s.selectedProperty);
  const selectParcel = useMapSurfaceStore((s) => s.selectParcel);
  const activeLayers = useMapSurfaceStore((s) => s.activeLayers);
  const toggleLayer = useMapSurfaceStore((s) => s.toggleLayer);
  const isLoadingParcels = useMapSurfaceStore((s) => s.isLoadingParcels);
  const setIsLoadingParcels = useMapSurfaceStore((s) => s.setIsLoadingParcels);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [buildingParams, setBuildingParams] = useState<BuildingParameters>(DEFAULT_BUILDING_PARAMS);
  const [designReasoning, setDesignReasoning] = useState<string | null>(null);

  // Load parcel data from deal address on mount
  useEffect(() => {
    if (!effectiveDealId) return;

    const loadParcelFromDeal = async () => {
      setIsLoadingParcels(true);
      setError(null);
      try {
        const dealRes = await apiClient.get(`/api/v1/deals/${effectiveDealId}`);
        const deal = dealRes.data?.deal || dealRes.data?.data || dealRes.data;
        const address = deal?.address;

        if (address) {
          const assessorRes = await apiClient.get('/api/assessor/lookup', {
            params: { address },
          });

          if (assessorRes.data?.success && assessorRes.data?.parcel) {
            const parcel = normalizeAssessorParcel(
              assessorRes.data.parcel,
              parcelBoundary
            );
            selectParcel(parcel);
          } else {
            console.log('[PropertySurface] No assessor data for address:', address);
          }
        }
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'Failed to load parcel';
        console.warn('[PropertySurface] Could not load parcel data:', msg);
      } finally {
        setIsLoadingParcels(false);
      }
    };

    loadParcelFromDeal();
  }, [effectiveDealId, parcelBoundary, selectParcel, setIsLoadingParcels]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setError(null);
    setIsLoadingParcels(true);

    try {
      const trimmed = searchQuery.trim();
      const isParcelId = /^\d{2}-?[A-Z]-?\d{3}-?\d{3}$/i.test(trimmed) || /^\d+$/i.test(trimmed);

      const assessorRes = await apiClient.get('/api/assessor/lookup', {
        params: isParcelId ? { parcelId: trimmed } : { address: trimmed },
      });

      if (assessorRes.data?.success && assessorRes.data?.parcel) {
        const parcel = normalizeAssessorParcel(assessorRes.data.parcel, parcelBoundary);
        selectParcel(parcel);
      } else {
        setError('No parcel found for that query');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Search failed';
      setError(msg);
    } finally {
      setIsLoadingParcels(false);
    }
  }, [searchQuery, parcelBoundary, selectParcel, setIsLoadingParcels]);

  const handleLayerToggle = useCallback(
    (layerId: string) => {
      toggleLayer(layerId);
    },
    [toggleLayer]
  );

  const handleDesignGenerated = useCallback((params: BuildingParameters, reasoning: string) => {
    setBuildingParams(params);
    setDesignReasoning(reasoning);
  }, []);

  // Determine which geometry to use for 3D mode
  const parcelGeometry = selectedProperty?.geometry ?? parcelBoundary;

  const parcelContext = selectedProperty
    ? {
        lotSizeSqft: selectedProperty.lotSizeSqft,
        address: selectedProperty.address,
        county: selectedProperty.county,
        state: selectedProperty.state,
        geometry: selectedProperty.geometry,
      }
    : undefined;

  return (
    <div className="flex h-full w-full bg-gray-50">
      {/* LEFT PANEL */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Property Surface</h2>
          <p className="text-xs text-gray-500 mt-1">
            Parcel intelligence & 3D design
          </p>
        </div>

        {/* Search — only in 2d mode */}
        {mode === '2d' && (
          <div className="p-3 border-b border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address or parcel ID..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                🔍
              </button>
            </div>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['2d', '3d', 'ai-generate'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                  mode === m
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m === '2d' && '🗺️ 2D Map'}
                {m === '3d' && '🏗️ 3D Design'}
                {m === 'ai-generate' && '✨ AI Generate'}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Mode: AI Design Agent + Parameter Panel */}
        {mode === '3d' && parcelGeometry && parcelContext && (
          <div className="flex-1 overflow-y-auto">
            <DesignAgentPanel
              parcelContext={parcelContext}
              onDesignGenerated={handleDesignGenerated}
            />
            {designReasoning && (
              <div className="mx-4 mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800 leading-relaxed">{designReasoning}</p>
              </div>
            )}
            <div className="border-t border-gray-200">
              <BuildingParameterPanel params={buildingParams} onChange={setBuildingParams} />
            </div>
          </div>
        )}

        {/* 2D Mode: Layer Panel + Property Card */}
        {mode === '2d' && (
          <>
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Layers
              </h3>
              <div className="space-y-1.5">
                {activeLayers.map((layer) => (
                  <label
                    key={layer.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={() => handleLayerToggle(layer.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{layer.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {selectedProperty ? (
                <PropertyCard parcel={selectedProperty} />
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📍</div>
                  <p className="text-sm text-gray-500">
                    Click a parcel on the map to view details
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Canvas Area */}
      <div className="flex-1 relative">
        {mode === '2d' && (
          <Map2DCanvas
            dealId={effectiveDealId}
            dealType={dealType}
            parcelBoundary={parcelBoundary}
            onParcelSelect={selectParcel}
          />
        )}

        {mode === '3d' && parcelGeometry && (
          <ProceduralBuildingScene
            parcelBoundary={parcelGeometry}
            params={buildingParams}
          />
        )}

        {mode === '3d' && !parcelGeometry && (
          <div className="flex items-center justify-center h-full bg-gray-900">
            <div className="text-center">
              <div className="text-6xl mb-4">🏗️</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Parcel Selected
              </h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Switch to 2D Map mode and select a parcel to view the 3D building preview.
              </p>
            </div>
          </div>
        )}

        {mode === 'ai-generate' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-lg">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI Design Agent
              </h3>
              <p className="text-gray-600 mb-6">
                Describe what you want to build and the AI will generate an
                initial massing study optimized for your parcel and zoning.
              </p>
              <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <textarea
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="e.g., 'Design a 5-story wrap-style apartment with 72 units and a pool courtyard'"
                />
                <button className="mt-3 w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  Generate Design
                </button>
              </div>
              <div className="mt-4 text-xs text-gray-400">
                Powered by Kimi K3 + Pascal Editor
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoadingParcels && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Loading parcels...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const PropertyCard: React.FC<{ parcel: ParcelRecord }> = ({ parcel }) => (
  <div className="space-y-3">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <h4 className="font-semibold text-blue-900 text-sm">{parcel.address}</h4>
      <p className="text-xs text-blue-700 mt-1">Parcel ID: {parcel.parcelId}</p>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <MetricBox label="Owner" value={parcel.ownerName} />
      <MetricBox label="Land Use" value={parcel.landUse} />
      <MetricBox label="Lot Size" value={`${parcel.lotSizeSqft.toLocaleString()} sqft`} />
      <MetricBox
        label="Total Value"
        value={`$${parcel.totalAppraisedValue.toLocaleString()}`}
      />
    </div>

    <div className="bg-gray-50 rounded-lg p-3">
      <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
        Assessment Breakdown
      </h5>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Land</span>
          <span>${parcel.assessedLandValue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Improvements</span>
          <span>${parcel.assessedImprovementValue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <span className="text-gray-600">Total</span>
          <span className="font-semibold">${parcel.totalAppraisedValue.toLocaleString()}</span>
        </div>
      </div>
    </div>

    <div className="text-xs text-gray-400">
      Last assessed: {new Date(parcel.lastAssessmentDate).toLocaleDateString()}
    </div>
  </div>
);

const MetricBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gray-50 rounded-lg p-2.5">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
  </div>
);

export default PropertySurfaceModule;
