import React, { useEffect, useState, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import { apiClient } from '../../services/api.client';
import { getTierColor } from './FlagPin';

export interface SubmarketGeo {
  name: string;
  city: string;
  state: string;
  dealCount: number;
  lat: number;
  lng: number;
  avgMetric: number;
  avgUnits: number;
  avgYearBuilt: number;
  metricName: string;
}

interface SubmarketBubbleLayerProps {
  /** Whether this layer is visible */
  visible: boolean;
  /** Which metric drives bubble color */
  colorBy: string;
  /** Filter by status (pipeline | owned | both) */
  statusFilter?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════
 * SUBMARKET BUBBLE LAYER — Aggregate market heatmap circles
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fetches /api/v1/submarkets/geo and renders each submarket as a
 * circle sized by deal count and colored by the chosen metric tier.
 * Uses Mapbox native circle layers for performance.
 */
export const SubmarketBubbleLayer: React.FC<SubmarketBubbleLayerProps> = ({
  visible,
  colorBy,
  statusFilter = 'both',
}) => {
  const [submarkets, setSubmarkets] = useState<SubmarketGeo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiClient
      .get('/api/v1/submarkets/geo', {
        params: {
          status: statusFilter,
          metric: colorBy,
        },
      })
      .then((res) => {
        const list = res.data?.submarkets || [];
        setSubmarkets(list);
      })
      .catch((err) => {
        console.error('[SubmarketBubbleLayer] fetch failed:', err);
      })
      .finally(() => setLoading(false));
  }, [visible, colorBy, statusFilter]);

  const geoJSON = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: submarkets.map((s) => ({
        type: 'Feature' as const,
        properties: {
          name: s.name,
          city: s.city,
          dealCount: s.dealCount,
          avgMetric: s.avgMetric ?? 0,
          avgUnits: s.avgUnits ?? 0,
          avgYearBuilt: s.avgYearBuilt ?? 0,
          metricName: s.metricName,
          color: getTierColor(colorBy, s.avgMetric),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [s.lng, s.lat],
        },
      })),
    };
  }, [submarkets, colorBy]);

  if (!visible || submarkets.length === 0) return null;

  return (
    <>
      <Source id="submarket-bubbles" type="geojson" data={geoJSON}>
        {/* Bubble circles — sized by deal count */}
        <Layer
          id="submarket-circles"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              ['interpolate', ['linear'], ['get', 'dealCount'], 1, 8, 5, 14, 20, 24],
              14,
              ['interpolate', ['linear'], ['get', 'dealCount'], 1, 12, 5, 22, 20, 40],
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.65,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-opacity': 0.9,
          }}
        />

        {/* Submarket name labels */}
        <Layer
          id="submarket-labels"
          type="symbol"
          layout={{
            'text-field': ['concat', ['get', 'name'], '\n', ['get', 'dealCount'], ' deals'],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'top',
            'text-offset': [0, 1.2],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          }}
          paint={{
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          }}
        />
      </Source>

      {/* Loading indicator (subtle) */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            right: 16,
            zIndex: 10,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(4px)',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#6366f1',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          Loading submarkets…
        </div>
      )}
    </>
  );
};

export default SubmarketBubbleLayer;
