/**
 * Bubble Layer Renderer
 * Renders sized circles based on metric values
 */

import { Source, Layer } from 'react-map-gl';
import { MapLayer as LayerConfig, LayerDataPoint, BubbleStyle } from '../../types/layers';

interface BubbleLayerRendererProps {
  layer: LayerConfig;
  data: LayerDataPoint[];
}

export const BubbleLayerRenderer: React.FC<BubbleLayerRendererProps> = ({
  layer,
  data
}) => {
  if (!data || data.length === 0) return null;

  const style = layer.style as BubbleStyle;
  const metric = style.metric || 'value';
  const minRadius = style.minRadius || 10;
  const maxRadius = style.maxRadius || 50;
  const colorScale = style.colorScale || ['#dbeafe', '#3b82f6', '#1e40af'];
  const strokeColor = style.strokeColor || '#ffffff';
  const strokeWidth = style.strokeWidth || 1;

  // Calculate min/max values for the metric
  const values = data
    .map(d => (d as any)[metric])
    .filter(v => typeof v === 'number');
  
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Create GeoJSON with metric values
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
        value: (point as any)[metric] || 0,
        normalizedValue: values.length > 0 
          ? ((point as any)[metric] - minValue) / (maxValue - minValue)
          : 0.5,
        label: point.label || '',
        ...point.popup
      }
    }))
  };

  // Calculate color stops for interpolation
  const colorStops = colorScale.length === 3
    ? [
        [0, colorScale[0]],
        [0.5, colorScale[1]],
        [1, colorScale[2]]
      ]
    : colorScale.map((color, i) => [
        i / (colorScale.length - 1),
        color
      ]);

  return (
    <Source
      id={`${layer.id}-bubble`}
      type="geojson"
      data={geojson as any}
    >
      {/* Bubble circles */}
      <Layer
        id={`${layer.id}-circles`}
        type="circle"
        paint={{
          // Size based on metric value
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'normalizedValue'],
            0, minRadius,
            1, maxRadius
          ],
          // Color based on metric value
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'normalizedValue'],
            ...colorStops.flat()
          ],
          'circle-opacity': layer.opacity,
          'circle-stroke-color': strokeColor,
          'circle-stroke-width': strokeWidth,
          'circle-stroke-opacity': layer.opacity
        }}
      />

      {/* Optional labels */}
      <Layer
        id={`${layer.id}-labels`}
        type="symbol"
        layout={{
          'text-field': ['get', 'value'],
          'text-size': 12,
          'text-offset': [0, 0],
          'text-anchor': 'center'
        }}
        paint={{
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
          'text-opacity': layer.opacity
        }}
      />
    </Source>
  );
};

export default BubbleLayerRenderer;
