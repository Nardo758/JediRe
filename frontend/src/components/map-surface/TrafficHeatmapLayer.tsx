/**
 * TrafficHeatmapLayer.tsx
 *
 * Renders a Mapbox GL heatmap layer for traffic prediction data.
 * Fetches GeoJSON from /api/v1/properties/geo/traffic and weights
 * each property by its latest weekly_walk_ins prediction.
 */

import React, { useEffect, useState } from 'react';
import { Source, Layer } from 'react-map-gl';
import { apiClient } from '../../services/api.client';

interface TrafficFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    ownershipStatus: string;
    weeklyWalkIns: number;
    confidence: number;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface TrafficGeoJSON {
  type: 'FeatureCollection';
  features: TrafficFeature[];
}

interface Props {
  visible: boolean;
}

export const TrafficHeatmapLayer: React.FC<Props> = ({ visible }) => {
  const [geoJSON, setGeoJSON] = useState<TrafficGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setLoading(true);

    apiClient
      .get('/api/v1/properties/geo/traffic', {
        params: { status: 'both', limit: 1000 },
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success && res.data?.features) {
          setGeoJSON({
            type: 'FeatureCollection',
            features: res.data.features,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[TrafficHeatmapLayer] fetch failed:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible || !geoJSON) return null;

  return (
    <Source id="traffic-heatmap" type="geojson" data={geoJSON}>
      {/* Heatmap layer — warm color ramp, radius ~30px */}
      <Layer
        id="traffic-heat"
        type="heatmap"
        paint={{
          // Weight each point by weeklyWalkIns (normalized to 0–1)
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'weeklyWalkIns'],
            0,
            0,
            10,
            0.3,
            50,
            0.7,
            200,
            1,
          ],
          // Radius in pixels
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            2,
            9,
            20,
            16,
            40,
          ],
          // Intensity
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.8,
            16,
            1.5,
          ],
          // Warm color ramp: transparent → yellow → orange → red
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.2,
            'rgba(255, 235, 59, 0.5)',
            0.4,
            'rgba(255, 193, 7, 0.6)',
            0.6,
            'rgba(255, 152, 0, 0.7)',
            0.8,
            'rgba(255, 87, 34, 0.85)',
            1,
            'rgba(244, 67, 54, 0.95)',
          ],
          // Opacity fades at low zoom to avoid clutter
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            7,
            0.4,
            16,
            0.85,
          ],
        }}
      />

      {/* Optional: point layer for high zoom so individual properties are visible */}
      <Layer
        id="traffic-points"
        type="circle"
        minzoom={14}
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'weeklyWalkIns'],
            0,
            3,
            50,
            8,
            200,
            14,
          ],
          'circle-color': '#f97316',
          'circle-opacity': 0.7,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        }}
      />
    </Source>
  );
};
