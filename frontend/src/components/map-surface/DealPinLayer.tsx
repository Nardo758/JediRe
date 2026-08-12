import React, { useEffect, useState, useMemo } from 'react';
import { Marker } from 'react-map-gl';
import { apiClient } from '../../services/api.client';
import { useMarkerClustering } from '../../hooks/useMarkerClustering';
import type { LayerDataPoint } from '../../types/layers';
import { FlagPin, getTierColor, formatMetricValue } from './FlagPin';
import { DealPinPopup } from './DealPinPopup';

export interface GeoProperty {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
  jediScore: number;
  ownershipStatus: 'portfolio' | 'pipeline' | string;
  pipelineStage: string | null;
  yearBuilt: number | null;
  metrics: {
    occupancyRate: number | null;
    avgEffectiveRent: number | null;
    concessions: number | null;
    vacancyLoss: number | null;
    noi: number | null;
    rentGrowth: number | null;
  };
}

interface DealPinLayerProps {
  /** Which metric drives the pin color tier */
  colorBy: string;
  /** Which metric value is printed on the pin face */
  display: string;
  /** Whether this layer is visible at all */
  visible: boolean;
  /** Filter by ownership status (e.g. ['pipeline','portfolio']). Undefined = all. */
  ownershipFilter?: string[];
  /** Current map zoom (for clustering threshold) */
  mapZoom: number;
  /** Current map bounds (for supercluster viewport) */
  mapBounds: { north: number; south: number; east: number; west: number } | null;
  /** Called when user clicks a cluster — parent should flyTo */
  onClusterZoom?: (center: [number, number], zoom: number) => void;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * DEAL PIN LAYER — Performance-metric flag pins with clustering
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fetches /api/v1/properties/geo and renders FlagPins for each
 * property.  At low zoom levels points are clustered into count
 * badges; clicking a badge flies to the expansion zoom.
 */
export const DealPinLayer: React.FC<DealPinLayerProps> = ({
  colorBy,
  display,
  visible,
  ownershipFilter,
  mapZoom,
  mapBounds,
  onClusterZoom,
}) => {
  const [properties, setProperties] = useState<GeoProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<GeoProperty | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiClient
      .get('/api/v1/properties/geo')
      .then((res) => {
        const list = res.data?.properties || [];
        setProperties(list);
      })
      .catch((err) => {
        console.error('[DealPinLayer] fetch failed:', err);
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = ownershipFilter
    ? properties.filter((p) => ownershipFilter.includes(p.ownershipStatus))
    : properties;

  // Lookup map so we can resolve a clustered data-point back to full GeoProperty
  const pointMap = useMemo(() => {
    const map = new Map<string, GeoProperty>();
    filtered.forEach((p) => map.set(p.id, p));
    return map;
  }, [filtered]);

  // Minimal shape for supercluster
  const dataPoints = useMemo<LayerDataPoint[]>(
    () => filtered.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
    [filtered]
  );

  const {
    clusters,
    isCluster,
    getClusterCount,
    getDataPoint,
    getClusterExpansionZoom,
  } = useMarkerClustering({
    data: dataPoints,
    mapBounds,
    mapZoom,
    enabled: true,
  });

  if (!visible) return null;

  // Empty state: no geocoded properties in DB
  if (!loading && properties.length === 0) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid #e5e7eb',
          textAlign: 'center',
          maxWidth: 320,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
          No geocoded properties yet
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
          Properties need <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4, fontSize: 10 }}>lat</code> / <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 4, fontSize: 10 }}>lng</code> values to appear on the map. Run the geocoding pipeline to populate coordinates.
        </div>
      </div>
    );
  }

  return (
    <>
      {clusters.map((cluster) => {
        const [lng, lat] = cluster.geometry.coordinates;

        // ── Cluster badge ──
        if (isCluster(cluster)) {
          const count = getClusterCount(cluster);
          const clusterId = cluster.properties.cluster_id!;
          const size = 40 + Math.min(count / 10, 20);

          return (
            <Marker
              key={`cluster-${clusterId}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const expansionZoom = getClusterExpansionZoom(clusterId);
                  onClusterZoom?.([lng, lat], expansionZoom);
                }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: count > 99 ? 12 : 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                }}
              >
                {count}
              </div>
            </Marker>
          );
        }

        // ── Individual FlagPin ──
        const dp = getDataPoint(cluster);
        const p = dp ? pointMap.get(dp.id) : undefined;
        if (!p) return null;

        const color = getTierColor(colorBy, resolveMetricValue(p, colorBy));
        const displayValue = formatMetricValue(display, resolveMetricValue(p, display));

        return (
          <Marker
            key={p.id}
            longitude={p.lng}
            latitude={p.lat}
            anchor="bottom"
          >
            <FlagPin
              value={displayValue}
              color={color}
              onClick={() => setSelectedProperty(p)}
            />
          </Marker>
        );
      })}

      {selectedProperty && (
        <DealPinPopup
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          highlightMetric={display}
        />
      )}
    </>
  );
};

/**
 * Resolve a metric value from a GeoProperty, handling both top-level
 * fields (e.g. jediScore) and nested metrics object.
 */
function resolveMetricValue(
  p: GeoProperty,
  key: string
): number | null {
  if (key === 'jediScore') return p.jediScore ?? null;
  return p.metrics[key as keyof GeoProperty['metrics']] ?? null;
}
