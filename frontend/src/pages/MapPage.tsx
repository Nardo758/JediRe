import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { apiClient } from '../services/api.client';
import { useMapLayers } from '../contexts/MapLayersContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';
const ATLANTA_CENTER: [number, number] = [-84.388, 33.749];

const T = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', input: '#0D1117' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', purple: '#A78BFA', white: '#FFFFFF', orange: '#FF8C42' },
  border: { subtle: '#1E2538', medium: '#2A3348', bright: '#3B4A6B' },
  font: { mono: "'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

interface DealPin {
  id: string;
  name: string;
  score: number;
  units: number;
  irr: string;
  strat: string;
  stage: string;
  addr: string;
  lng: number;
  lat: number;
}

const geocodeDeal = (id: string, index: number): [number, number] => {
  const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const spread = 0.45;
  return [
    ATLANTA_CENTER[0] + Math.sin(seed + index * 0.7) * spread,
    ATLANTA_CENTER[1] + Math.cos(seed + index * 1.1) * spread,
  ];
};

const pinColor = (score: number) =>
  score >= 80 ? T.text.green : score >= 65 ? T.text.amber : score > 0 ? T.text.red : T.text.muted;

export function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);
  const { layers, toggleLayer } = useMapLayers();
  const [viewState, setViewState] = useState({ longitude: ATLANTA_CENTER[0], latitude: ATLANTA_CENTER[1], zoom: 10.5 });
  const [deals, setDeals] = useState<DealPin[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    apiClient.get('/api/pipeline/deals').then((res: any) => {
      const raw = res.data?.deals || res.data || [];
      const mapped = raw.slice(0, 50).map((d: any, i: number) => {
        const [lng, lat] = geocodeDeal(d.id, i);
        return {
          id: d.id,
          name: d.property_name || d.name || '—',
          score: Number(d.jedi_score || d.score || 0),
          units: Number(d.units || 0),
          irr: d.target_irr ? `${Number(d.target_irr).toFixed(1)}%` : '—',
          strat: (d.investment_strategy || d.strategy || 'CORE').toUpperCase().slice(0, 6),
          stage: (d.stage || 'SOURCING').toUpperCase(),
          addr: d.address || d.market || '',
          lng, lat,
        };
      });
      setDeals(mapped);
    }).catch(() => {});
  }, []);

  const heatmapData = useMemo(() => {
    const active = layers.some(l => l.id === 'news-intelligence' && l.active);
    if (!active || deals.length === 0) return null;
    return {
      type: 'FeatureCollection' as const,
      features: deals.map(d => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [d.lng, d.lat] },
        properties: { weight: Math.max(d.score / 100, 0.2) },
      })),
    };
  }, [deals, layers]);

  const pipelineActive = layers.some(l => l.id === 'pipeline' && l.active);
  const assetsActive = layers.some(l => l.id === 'assets-owned' && l.active);

  if (!MAPBOX_TOKEN) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.terminal, flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: T.text.muted, fontFamily: T.font.mono }}>MAPBOX TOKEN REQUIRED</div>
        <button onClick={() => navigate(-1)} style={{ fontFamily: T.font.mono, fontSize: 11, color: T.text.cyan, background: 'transparent', border: `1px solid ${T.text.cyan}44`, padding: '4px 12px', cursor: 'pointer' }}>← BACK</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: T.bg.terminal }}>
      {sidebarOpen && (
        <div style={{ width: 280, borderRight: `1px solid ${T.border.medium}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: T.bg.panel }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${T.border.medium}`, background: T.bg.header }}>
            <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.white, letterSpacing: 1 }}>MAP LAYERS</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => navigate(-1)} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.cyan, background: 'transparent', border: `1px solid ${T.text.cyan}44`, padding: '2px 8px', cursor: 'pointer' }}>← TERMINAL</button>
              <button onClick={() => setSidebarOpen(false)} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: 'transparent', border: `1px solid ${T.border.subtle}`, padding: '0 5px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {layers.map(layer => (
              <div
                key={layer.id}
                onClick={() => toggleLayer(layer.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderBottom: `1px solid ${T.border.subtle}`, cursor: 'pointer',
                  background: layer.active ? T.bg.header : 'transparent',
                  opacity: layer.active ? 1 : 0.6,
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{layer.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, color: T.text.primary }}>{layer.name}</div>
                  <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, textTransform: 'uppercase' }}>{layer.type}</div>
                </div>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: layer.active ? T.text.green : T.text.muted,
                  border: `1px solid ${layer.active ? T.text.green : T.border.medium}`,
                }} />
              </div>
            ))}
          </div>

          <div style={{ padding: '8px 10px', borderTop: `1px solid ${T.border.medium}`, background: T.bg.header }}>
            <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>{deals.length} deals plotted · {layers.filter(l => l.active).length} layers active</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={() => setSelectedDeal(null)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={DARK_STYLE}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          {heatmapData && (
            <Source id="news-heat" type="geojson" data={heatmapData}>
              <Layer
                id="news-heat-layer"
                type="heatmap"
                paint={{
                  'heatmap-weight': ['get', 'weight'],
                  'heatmap-intensity': 1.2,
                  'heatmap-radius': 40,
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

          {deals.map(deal => {
            const show = pipelineActive || assetsActive || layers.every(l => !l.active);
            if (!show) return null;
            const c = pinColor(deal.score);
            const sz = deal.units > 200 ? 16 : deal.units > 100 ? 12 : deal.units > 0 ? 10 : 8;
            const sel = selectedDeal === deal.id;
            return (
              <Marker key={deal.id} longitude={deal.lng} latitude={deal.lat} anchor="center">
                <div onClick={e => { e.stopPropagation(); setSelectedDeal(sel ? null : deal.id); }} style={{ cursor: 'pointer', position: 'relative' }}>
                  <div style={{
                    width: sz, height: sz, borderRadius: '50%', background: c,
                    border: sel ? '2px solid #fff' : `1px solid ${c}`,
                    boxShadow: sel ? `0 0 16px ${c}88` : `0 0 8px ${c}44`,
                    transition: 'all 0.15s',
                  }} />
                  {!sel && (
                    <div style={{
                      position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                      fontSize: 10, fontFamily: T.font.mono, color: c, fontWeight: 700,
                      whiteSpace: 'nowrap', textShadow: '0 0 6px #000',
                    }}>
                      {deal.score > 0 ? deal.score : '—'}
                    </div>
                  )}
                  {sel && (
                    <div onClick={e => e.stopPropagation()} style={{
                      position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
                      transform: 'translateX(-50%)', background: T.bg.header,
                      border: `1px solid ${T.border.bright}`, padding: '8px 10px',
                      whiteSpace: 'nowrap', zIndex: 20, minWidth: 180,
                    }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.white, marginBottom: 4 }}>{deal.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 800, color: c }}>{deal.score > 0 ? `JEDI ${deal.score}` : '—'}</span>
                        <span style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.amber }}>{deal.irr}</span>
                        <span style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, padding: '1px 5px', background: T.text.purple + '22', color: T.text.purple, border: `1px solid ${T.text.purple}44` }}>{deal.strat}</span>
                      </div>
                      <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, marginBottom: 6 }}>{deal.stage} · {deal.addr}</div>
                      <button onClick={() => navigate(`/deals/${deal.id}/detail`)} style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.amber, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: 0.3 }}>OPEN CAPSULE →</button>
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}
        </Map>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={{
            position: 'absolute', top: 12, left: 12, fontFamily: T.font.mono,
            fontSize: 10, fontWeight: 600, background: T.bg.panel,
            color: T.text.cyan, border: `1px solid ${T.text.cyan}44`,
            padding: '4px 10px', cursor: 'pointer', zIndex: 5,
          }}>
            LAYERS
          </button>
        )}

        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 5 }}>
          <button onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom + 1, duration: 300 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: T.font.mono }}>+</button>
          <button onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom - 1, duration: 300 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: T.font.mono }}>−</button>
          <button onClick={() => mapRef.current?.flyTo({ center: ATLANTA_CENTER, zoom: 10.5, duration: 500 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.cyan, fontSize: 14, cursor: 'pointer' }}>⌖</button>
        </div>

        <div style={{ position: 'absolute', bottom: 12, left: sidebarOpen ? 12 : 12, display: 'flex', gap: 8, zIndex: 5 }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: T.bg.panel + 'dd', padding: '4px 8px', border: `1px solid ${T.border.subtle}` }}>
            {deals.length} DEALS · ATLANTA MSA · Z{viewState.zoom.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
