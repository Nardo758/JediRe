/**
 * ClusteredMarkers Component
 * Renders markers with automatic clustering for performance
 */

import { Marker, Popup } from 'react-map-gl';
import { useState } from 'react';
import { useMarkerClustering } from '../../hooks/useMarkerClustering';
import { LayerDataPoint, PinStyle } from '../../types/layers';

interface ClusteredMarkersProps {
  data: LayerDataPoint[];
  style: PinStyle;
  opacity: number;
  mapBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  mapZoom: number;
  enableClustering?: boolean;
  onMarkerClick?: (dataPoint: LayerDataPoint) => void;
  onClusterClick?: (dataPoints: LayerDataPoint[], zoom: number) => void;
}

export const ClusteredMarkers: React.FC<ClusteredMarkersProps> = ({
  data,
  style,
  opacity,
  mapBounds,
  mapZoom,
  enableClustering = true,
  onMarkerClick,
  onClusterClick
}) => {
  const [selectedMarker, setSelectedMarker] = useState<LayerDataPoint | null>(null);

  const {
    clusters,
    isCluster,
    getClusterCount,
    getDataPoint,
    getClusterExpansionZoom,
    getClusterLeaves
  } = useMarkerClustering({
    data,
    mapBounds,
    mapZoom,
    enabled: enableClustering && data.length > 50 // Only cluster if > 50 points
  });

  const markerIcon = style.icon || '📍';
  const markerColor = style.color || '#3b82f6';
  const markerSize = style.size === 'small' ? 20 : style.size === 'large' ? 40 : 30;

  return (
    <>
      {clusters.map((cluster, index) => {
        const [lng, lat] = cluster.geometry.coordinates;

        // Cluster marker
        if (isCluster(cluster)) {
          const count = getClusterCount(cluster);
          const clusterId = cluster.properties.cluster_id!;

          // Calculate cluster size based on point count
          const clusterSize = 40 + Math.min(count / 10, 20);

          return (
            <Marker
              key={`cluster-${clusterId}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                const expansionZoom = getClusterExpansionZoom(clusterId);
                const leaves = getClusterLeaves(clusterId);
                onClusterClick?.(leaves, expansionZoom);
              }}
            >
              <div
                className="flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                style={{
                  width: clusterSize,
                  height: clusterSize,
                  borderRadius: '50%',
                  backgroundColor: markerColor,
                  opacity,
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: count > 99 ? '12px' : '14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                {count}
              </div>
            </Marker>
          );
        }

        // Individual marker
        const dataPoint = getDataPoint(cluster);
        if (!dataPoint) return null;

        return (
          <Marker
            key={`marker-${dataPoint.id || index}`}
            longitude={lng}
            latitude={lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedMarker(dataPoint);
              onMarkerClick?.(dataPoint);
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
              {dataPoint.icon || markerIcon}
            </div>
          </Marker>
        );
      })}

      {/* Popup */}
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

export default ClusteredMarkers;
