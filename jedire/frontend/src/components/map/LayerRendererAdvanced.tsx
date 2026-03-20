/**
 * Advanced Layer Renderer
 * Supports pin, boundary, and heatmap layers
 */

import React, { useEffect, useState, useRef } from 'react';
import { Marker, Popup, Source, Layer as MapLayer } from 'react-map-gl';
import { MapLayer as LayerConfig, LayerDataPoint, PinStyle, BoundaryStyle, HeatmapStyle } from '../../types/layers';
import { layersService } from '../../services/layers.service';
import * as turf from '@turf/turf';

interface LayerRendererAdvancedProps {
  layers: LayerConfig[];
  mapId: string;
  onMarkerClick?: (dataPoint: LayerDataPoint) => void;
}

export const LayerRendererAdvanced: React.FC<LayerRendererAdvancedProps> = ({
  layers,
  mapId,
  onMarkerClick
}) => {
  const [layerData, setLayerData] = useState<Record<string, LayerDataPoint[]>>({});
  const [selectedMarker, setSelectedMarker] = useState<LayerDataPoint | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Fetch data for all visible layers
  useEffect(() => {
    const fetchLayerData = async () => {
      const visibleLayers = layers.filter(l => l.visible);

      for (const layer of visibleLayers) {
        // Skip if already loaded
        if (layerData[layer.id]) continue;

        // Mark as loading
        setLoading(prev => ({ ...prev, [layer.id]: true }));

        try {
          const data = await layersService.getLayerSourceData(layer.source_type, mapId);
          setLayerData(prev => ({ ...prev, [layer.id]: data }));
        } catch (error) {
          console.error(`Failed to load data for layer ${layer.name}:`, error);
        } finally {
          setLoading(prev => ({ ...prev, [layer.id]: false }));
        }
      }
    };

    fetchLayerData();
  }, [layers, mapId]);

  // Clear data for invisible layers
  useEffect(() => {
    const visibleLayerIds = new Set(layers.filter(l => l.visible).map(l => l.id));
    setLayerData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (!visibleLayerIds.has(id)) {
          delete updated[id];
        }
      });
      return updated;
    });
  }, [layers]);

  // Render pin markers
  const renderPinLayer = (layer: LayerConfig) => {
    const data = layerData[layer.id];
    if (!data || data.length === 0) return null;

    const style = layer.style as PinStyle;
    const opacity = layer.opacity;

    return data.map((point, index) => {
      const markerColor = point.color || style.color || '#3b82f6';
      const markerIcon = point.icon || style.icon || '📍';
      const markerSize = style.size === 'small' ? 20 : style.size === 'large' ? 40 : 30;

      return (
        <Marker
          key={`${layer.id}-${point.id || index}`}
          longitude={point.lng}
          latitude={point.lat}
          anchor="bottom"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setSelectedMarker(point);
            onMarkerClick?.(point);
          }}
        >
          <div
            className="cursor-pointer transform transition-transform hover:scale-110"
            style={{
              opacity,
              fontSize: `${markerSize}px`,
              filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`
            }}
          >
            {markerIcon}
          </div>
        </Marker>
      );
    });
  };

  // Render boundary layer (polygons)
  const renderBoundaryLayer = (layer: LayerConfig) => {
    const data = layerData[layer.id];
    if (!data || data.length === 0) return null;

    const style = layer.style as BoundaryStyle;

    // Convert data points to GeoJSON
    const geojson = {
      type: 'FeatureCollection' as const,
      features: data.map((point, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [point.lng, point.lat]
        },
        properties: {
          id: point.id || `${layer.id}-${index}`,
          label: point.label || '',
          ...point.popup
        }
      }))
    };

    // Create a buffer around each point to make a polygon
    const bufferedFeatures = geojson.features.map(feature => {
      const buffered = turf.buffer(feature, 0.5, { units: 'miles' });
      return buffered;
    });

    const bufferedGeojson = {
      type: 'FeatureCollection' as const,
      features: bufferedFeatures
    };

    return (
      <>
        <Source
          id={`${layer.id}-boundary`}
          type="geojson"
          data={bufferedGeojson as any}
        >
          {/* Fill layer */}
          <MapLayer
            id={`${layer.id}-fill`}
            type="fill"
            paint={{
              'fill-color': style.fillColor || '#3b82f6',
              'fill-opacity': (style.fillOpacity || 0.2) * layer.opacity
            }}
          />
          {/* Border layer */}
          <MapLayer
            id={`${layer.id}-border`}
            type="line"
            paint={{
              'line-color': style.strokeColor || '#2563eb',
              'line-width': style.strokeWidth || 2,
              'line-opacity': layer.opacity,
              ...(style.strokeDasharray ? {
                'line-dasharray': style.strokeDasharray.split(',').map(Number)
              } : {})
            }}
          />
        </Source>
      </>
    );
  };

  // Render heatmap layer
  const renderHeatmapLayer = (layer: LayerConfig) => {
    const data = layerData[layer.id];
    if (!data || data.length === 0) return null;

    const style = layer.style as HeatmapStyle;
    const colorScale = style.colorScale || [
      '#fef3c7',
      '#fbbf24',
      '#f59e0b',
      '#dc2626'
    ];

    // Convert data points to GeoJSON
    const geojson = {
      type: 'FeatureCollection' as const,
      features: data.map((point, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [point.lng, point.lat]
        },
        properties: {
          id: point.id || `${layer.id}-${index}`,
          // Use impact_score or default weight
          weight: (point as any).impact_score || 1
        }
      }))
    };

    return (
      <Source
        id={`${layer.id}-heatmap`}
        type="geojson"
        data={geojson as any}
      >
        <MapLayer
          id={`${layer.id}-heat`}
          type="heatmap"
          paint={{
            // Increase weight as diameter breast height increases
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'weight'],
              0, 0,
              6, 1
            ],
            // Increase intensity as zoom level increases
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, style.intensity || 1,
              9, (style.intensity || 1) * 3
            ],
            // Color ramp for heatmap
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 255, 0)',
              0.2, colorScale[0],
              0.4, colorScale[1],
              0.6, colorScale[2],
              1, colorScale[3]
            ],
            // Adjust the heatmap radius by zoom level
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, style.radius || 20,
              9, (style.radius || 20) * 2
            ],
            // Transition from heatmap to circle layer by zoom level
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              7, layer.opacity,
              9, layer.opacity * 0.5
            ]
          }}
        />
      </Source>
    );
  };

  // Render all layers (sorted by z-index)
  const sortedLayers = [...layers]
    .filter(l => l.visible)
    .sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sortedLayers.map(layer => {
        switch (layer.layer_type) {
          case 'pin':
            return <React.Fragment key={layer.id}>{renderPinLayer(layer)}</React.Fragment>;
          case 'boundary':
            return <React.Fragment key={layer.id}>{renderBoundaryLayer(layer)}</React.Fragment>;
          case 'heatmap':
            return <React.Fragment key={layer.id}>{renderHeatmapLayer(layer)}</React.Fragment>;
          default:
            return null;
        }
      })}

      {/* Popup for selected marker */}
      {selectedMarker && (
        <Popup
          longitude={selectedMarker.lng}
          latitude={selectedMarker.lat}
          anchor="top"
          onClose={() => setSelectedMarker(null)}
          closeButton={true}
          closeOnClick={false}
        >
          <div className="p-2 min-w-[200px]">
            <h3 className="font-bold text-sm mb-2">
              {selectedMarker.label || 'Property'}
            </h3>
            {selectedMarker.popup && (
              <div className="text-xs text-gray-600 space-y-1">
                {Object.entries(selectedMarker.popup).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="font-medium capitalize">
                      {key.replace(/_/g, ' ')}:
                    </span>
                    <span className="ml-2">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Popup>
      )}
    </>
  );
};

export default LayerRendererAdvanced;
