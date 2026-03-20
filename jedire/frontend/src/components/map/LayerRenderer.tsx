/**
 * LayerRenderer Component
 * Renders map layers (pins, heatmaps, boundaries) based on layer definitions
 */

import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-map-gl';
import { MapLayer, LayerDataPoint, PinStyle } from '../../types/layers';
import { layersService } from '../../services/layers.service';

interface LayerRendererProps {
  layers: MapLayer[];
  mapId: string;
  onMarkerClick?: (dataPoint: LayerDataPoint) => void;
}

export const LayerRenderer: React.FC<LayerRendererProps> = ({
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
      const visibleLayers = layers.filter(l => l.visible && l.layer_type === 'pin');

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

  // Render markers for each layer
  const renderPinLayer = (layer: MapLayer) => {
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

  // Render all layers (sorted by z-index)
  const sortedLayers = [...layers]
    .filter(l => l.visible && l.layer_type === 'pin')
    .sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sortedLayers.map(layer => renderPinLayer(layer))}

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

export default LayerRenderer;
