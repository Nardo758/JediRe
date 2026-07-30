import React, { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl';
import { apiClient } from '../../services/api.client';
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
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * DEAL PIN LAYER — Performance-metric flag pins on the map
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fetches /api/v1/properties/geo and renders a FlagPin for each
 * property.  Pins are colored by `colorBy` metric tier and show
 * the `display` metric value.  Clicking a pin opens DealPinPopup.
 */
export const DealPinLayer: React.FC<DealPinLayerProps> = ({
  colorBy,
  display,
  visible,
  ownershipFilter,
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

  const filtered = ownershipFilter
    ? properties.filter((p) => ownershipFilter.includes(p.ownershipStatus))
    : properties;

  return (
    <>
      {filtered.map((p) => {
        const color = getTierColor(
          colorBy,
          resolveMetricValue(p, colorBy)
        );
        const displayValue = formatMetricValue(
          display,
          resolveMetricValue(p, display)
        );

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
