import { useRef, useState, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';
const ATLANTA_CENTER: [number, number] = [-84.388, 33.749];

interface MapPin {
  id: string;
  name: string;
  metric: number;
  metricLabel: string;
  units: number;
  irr: string;
  strat: string;
  stage: string;
  addr: string;
}

interface MapLayerItem {
  id: string;
  name: string;
  type: string;
  visible: boolean;
}

interface TerminalMapViewProps {
  pins: MapPin[];
  layers: MapLayerItem[];
  fkey: string;
  pinColor: (metric: number) => string;
  selectedPinId?: string | null;
  onSelectedPinChange?: (id: string | null) => void;
  onNavigate?: (path: string) => void;
  theme: any;
}

const geocodePin = (pin: MapPin, index: number): [number, number] => {
  const seed = pin.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const spread = 0.35;
  const lng = ATLANTA_CENTER[0] + (Math.sin(seed + index * 0.7) * spread);
  const lat = ATLANTA_CENTER[1] + (Math.cos(seed + index * 1.1) * spread);
  return [lng, lat];
};

const LAYER_TYPE_COLORS: Record<string, string> = {
  warmaps: '#00D26A',
  companalysis: '#A78BFA',
  brokerintel: '#FF8C42',
  marketheat: '#00BCD4',
  overlay: '#00D26A',
  boundary: '#00D26A',
  bubble: '#A78BFA',
  pin: '#FF8C42',
  heatmap: '#00BCD4',
};

const normalizeLayerType = (type: string): string => {
  const aliasMap: Record<string, string> = {
    overlay: 'warmaps',
    boundary: 'warmaps',
    bubble: 'companalysis',
    pin: 'brokerintel',
    heatmap: 'marketheat',
  };
  return aliasMap[type] || type;
};

export default function TerminalMapView({
  pins,
  layers,
  fkey,
  pinColor,
  selectedPinId = null,
  onSelectedPinChange,
  onNavigate,
  theme: T,
}: TerminalMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const selectedPin = selectedPinId;
  const setSelectedPin = (id: string | null) => onSelectedPinChange?.(id); // eslint-disable-line react-hooks/exhaustive-deps -- setSelectedPin is recreated each render; including it would loop
  const [viewState, setViewState] = useState({
    longitude: ATLANTA_CENTER[0],
    latitude: ATLANTA_CENTER[1],
    zoom: 10,
  });

  const geolocatedPins = useMemo(
    () => pins.map((pin, i) => {
      const [lng, lat] = geocodePin(pin, i);
      return { ...pin, lng, lat };
    }),
    [pins]
  );

  const heatmapData = useMemo(() => {
    const hasHeatLayer = layers.some(l => l.visible && (normalizeLayerType(l.type) === 'marketheat'));
    if (!hasHeatLayer || geolocatedPins.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: geolocatedPins.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { weight: Math.max(p.metric / 100, 0.2), name: p.name },
      })),
    };
  }, [geolocatedPins, layers]);

  const compBubbleData = useMemo(() => {
    const hasCompLayer = layers.some(l => l.visible && (normalizeLayerType(l.type) === 'companalysis'));
    if (!hasCompLayer || geolocatedPins.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: geolocatedPins.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { radius: Math.max(p.units / 8, 6), name: p.name, metric: p.metric },
      })),
    };
  }, [geolocatedPins, layers]);

  const brokerIntelData = useMemo(() => {
    const hasBrokerLayer = layers.some(l => l.visible && (normalizeLayerType(l.type) === 'brokerintel'));
    if (!hasBrokerLayer) return null;
    const brokerPoints = geolocatedPins.slice(0, 5).map((p, i) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng + 0.02 * Math.sin(i), p.lat + 0.02 * Math.cos(i)],
      },
      properties: { name: `Broker ${i + 1}`, type: 'broker' },
    }));
    return { type: 'FeatureCollection' as const, features: brokerPoints };
  }, [geolocatedPins, layers]);

  const warMapBoundaries = useMemo(() => {
    const hasWarLayer = layers.some(l => l.visible && (normalizeLayerType(l.type) === 'warmaps'));
    if (!hasWarLayer || geolocatedPins.length < 3) return null;
    const pts = geolocatedPins.slice(0, 5);
    const centerLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const centerLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const r = 0.12;
    const polygon = Array.from({ length: 7 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2;
      return [centerLng + Math.cos(angle) * r * 1.2, centerLat + Math.sin(angle) * r];
    });
    polygon.push(polygon[0]);
    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [polygon] },
        properties: { name: 'Target Zone' },
      }],
    };
  }, [geolocatedPins, layers]);

  const handlePinClick = useCallback((id: string) => {
    setSelectedPin(selectedPin === id ? null : id);
  }, [selectedPin, setSelectedPin]);

  const activeLayerColor = useMemo(() => {
    const vis = layers.find(l => l.visible);
    return vis ? LAYER_TYPE_COLORS[vis.type] || T.text.cyan : null;
  }, [layers, T]);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080C14', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: T.text.muted, fontFamily: T.font.mono }}>MAPBOX TOKEN REQUIRED</div>
        <div style={{ fontSize: 10, color: T.text.secondary, fontFamily: T.font.mono }}>Set VITE_MAPBOX_TOKEN in env</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={() => setSelectedPin(null)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        logoPosition="bottom-left"
      >
        {warMapBoundaries && (
          <Source id="war-boundaries" type="geojson" data={warMapBoundaries}>
            <Layer
              id="war-boundary-fill"
              type="fill"
              paint={{ 'fill-color': '#00D26A', 'fill-opacity': 0.08 }}
            />
            <Layer
              id="war-boundary-line"
              type="line"
              paint={{ 'line-color': '#00D26A', 'line-width': 2, 'line-dasharray': [4, 2] }}
            />
          </Source>
        )}

        {heatmapData && (
          <Source id="heat-data" type="geojson" data={heatmapData}>
            <Layer
              id="heat-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': 1.2,
                'heatmap-radius': 30,
                'heatmap-opacity': 0.6,
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0, 'rgba(0,188,212,0)',
                  0.2, 'rgba(0,188,212,0.3)',
                  0.4, 'rgba(0,210,106,0.5)',
                  0.6, 'rgba(245,166,35,0.7)',
                  0.8, 'rgba(255,71,87,0.85)',
                  1, 'rgba(255,71,87,1)',
                ],
              }}
            />
          </Source>
        )}

        {compBubbleData && (
          <Source id="comp-bubbles" type="geojson" data={compBubbleData}>
            <Layer
              id="comp-bubble-layer"
              type="circle"
              paint={{
                'circle-radius': ['get', 'radius'],
                'circle-color': '#A78BFA',
                'circle-opacity': 0.3,
                'circle-stroke-color': '#A78BFA',
                'circle-stroke-width': 1.5,
              }}
            />
          </Source>
        )}

        {brokerIntelData && (
          <Source id="broker-intel" type="geojson" data={brokerIntelData}>
            <Layer
              id="broker-pin-layer"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#FF8C42',
                'circle-opacity': 0.9,
                'circle-stroke-color': '#fff',
                'circle-stroke-width': 1,
              }}
            />
          </Source>
        )}

        {geolocatedPins.map(pin => {
          const c = activeLayerColor || pinColor(pin.metric);
          const sz = pin.units > 200 ? 14 : pin.units > 100 ? 11 : pin.units > 0 ? 9 : 7;
          const sel = selectedPin === pin.id;
          return (
            <Marker key={pin.id} longitude={pin.lng} latitude={pin.lat} anchor="center">
              <div
                onClick={e => { e.stopPropagation(); handlePinClick(pin.id); }}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <div style={{
                  width: sz,
                  height: sz,
                  borderRadius: '50%',
                  background: c,
                  border: sel ? '2px solid #fff' : `1px solid ${c}`,
                  boxShadow: sel ? `0 0 14px ${c}88` : `0 0 6px ${c}44`,
                  transition: 'all 0.15s',
                }} />
                {!sel && (
                  <div style={{
                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 10, fontFamily: 'monospace', color: c, fontWeight: 700,
                    whiteSpace: 'nowrap', textShadow: '0 0 6px #000',
                  }}>
                    {pin.metricLabel}
                  </div>
                )}
                {sel && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
                      transform: 'translateX(-50%)', background: T.bg.header,
                      border: `1px solid ${T.border.bright}`, padding: '6px 8px',
                      whiteSpace: 'nowrap', zIndex: 20, minWidth: 150,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.text.white, fontFamily: 'monospace', marginBottom: 3 }}>
                      {pin.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: c, fontFamily: 'monospace' }}>{pin.metricLabel}</span>
                      <span style={{ fontSize: 10, color: T.text.amber, fontFamily: 'monospace' }}>{pin.irr}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 4px',
                        background: T.text.purple + '22', color: T.text.purple,
                        border: `1px solid ${T.text.purple}44`,
                      }}>{pin.strat}</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.text.muted, marginBottom: 4 }}>{pin.stage} · {pin.addr}</div>
                    <button
                      onClick={() => onNavigate?.(`/deals/${pin.id}/detail`)}
                      style={{
                        fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                        color: T.text.amber, background: 'transparent',
                        border: 'none', cursor: 'pointer', padding: 0, letterSpacing: 0.3,
                      }}
                    >
                      OPEN CAPSULE →
                    </button>
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>

      {layers.filter(l => l.visible).length > 0 && (
        <div style={{
          position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4,
          flexWrap: 'wrap', zIndex: 5,
        }}>
          {layers.filter(l => l.visible).map(l => (
            <div key={l.id} style={{
              fontSize: 10, fontFamily: T.font.mono, fontWeight: 600,
              padding: '2px 6px', background: (LAYER_TYPE_COLORS[l.type] || T.text.cyan) + '22',
              color: LAYER_TYPE_COLORS[l.type] || T.text.cyan,
              border: `1px solid ${(LAYER_TYPE_COLORS[l.type] || T.text.cyan)}44`,
            }}>
              {l.name}
            </div>
          ))}
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 8, right: 8, display: 'flex',
        flexDirection: 'column', gap: 2, zIndex: 5,
      }}>
        <button
          onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom + 1, duration: 300 })}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >+</button>
        <button
          onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom - 1, duration: 300 })}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary,
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >−</button>
        <button
          onClick={() => mapRef.current?.flyTo({ center: ATLANTA_CENTER, zoom: 10, duration: 500 })}
          style={{
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.cyan,
            fontSize: 11, cursor: 'pointer',
          }}
        >⌖</button>
      </div>

      <button
        onClick={() => onNavigate?.('/map')}
        style={{
          position: 'absolute', bottom: 8, left: 8, fontFamily: 'monospace',
          fontSize: 10, fontWeight: 700, background: T.text.cyan, color: T.bg.terminal,
          border: 'none', padding: '3px 8px', cursor: 'pointer', zIndex: 5,
        }}
      >
        FULL MAP →
      </button>
    </div>
  );
}
