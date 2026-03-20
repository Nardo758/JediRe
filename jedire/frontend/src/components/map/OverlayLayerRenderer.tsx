/**
 * Overlay (Choropleth) Layer Renderer
 * Renders data overlays colored by value ranges
 */

import { Source, Layer } from 'react-map-gl';
import { MapLayer as LayerConfig, OverlayStyle } from '../../types/layers';

interface OverlayLayerRendererProps {
  layer: LayerConfig;
  geojson: any; // GeoJSON with properties containing values
}

export const OverlayLayerRenderer: React.FC<OverlayLayerRendererProps> = ({
  layer,
  geojson
}) => {
  if (!geojson || !geojson.features || geojson.features.length === 0) return null;

  const style = layer.style as OverlayStyle;
  const colorScale = style.colorScale || [
    '#dcfce7', // light green
    '#86efac', // medium green
    '#22c55e', // dark green
    '#15803d'  // darkest green
  ];
  const valueRanges = style.valueRanges || [0, 25, 50, 75, 100];

  // Build color expression for choropleth
  // Assumes geojson.features[].properties.value exists
  const colorExpression: any[] = [
    'interpolate',
    ['linear'],
    ['get', 'value']
  ];

  // Add color stops
  for (let i = 0; i < valueRanges.length; i++) {
    const value = valueRanges[i];
    const color = colorScale[Math.min(i, colorScale.length - 1)];
    colorExpression.push(value, color);
  }

  return (
    <Source
      id={`${layer.id}-overlay`}
      type="geojson"
      data={geojson}
    >
      {/* Fill layer */}
      <Layer
        id={`${layer.id}-fill`}
        type="fill"
        paint={{
          'fill-color': colorExpression as any,
          'fill-opacity': (style.opacity || 0.6) * layer.opacity
        }}
      />

      {/* Border layer */}
      <Layer
        id={`${layer.id}-border`}
        type="line"
        paint={{
          'line-color': '#ffffff',
          'line-width': 1,
          'line-opacity': layer.opacity * 0.5
        }}
      />

      {/* Optional labels */}
      <Layer
        id={`${layer.id}-labels`}
        type="symbol"
        layout={{
          'text-field': [
            'concat',
            ['get', 'name'],
            ': ',
            ['to-string', ['get', 'value']]
          ],
          'text-size': 11,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
        }}
        paint={{
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-opacity': layer.opacity
        }}
      />
    </Source>
  );
};

export default OverlayLayerRenderer;
