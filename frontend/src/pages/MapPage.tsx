import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';
import { apiClient } from '../services/api.client';
import { useMapLayers } from '../contexts/MapLayersContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';
const ATLANTA_CENTER: [number, number] = [-84.388, 33.749];

const T = {
  bg: { terminal: '#0A0E17', panel: '#0F1319', header: '#1A1F2E', input: '#0D1117', hover: '#1E2538' },
  text: { primary: '#E8ECF1', secondary: '#8B95A5', muted: '#4A5568', amber: '#F5A623', green: '#00D26A', red: '#FF4757', cyan: '#00BCD4', purple: '#A78BFA', white: '#FFFFFF', orange: '#FF8C42' },
  border: { subtle: '#1E2538', medium: '#2A3348', bright: '#3B4A6B' },
  font: { mono: "'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

const DRAW_COLORS = [
  { name: 'Cyan', value: '#00BCD4' },
  { name: 'Green', value: '#00D26A' },
  { name: 'Amber', value: '#F5A623' },
  { name: 'Red', value: '#FF4757' },
  { name: 'Purple', value: '#A78BFA' },
  { name: 'Orange', value: '#FF8C42' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'White', value: '#E8ECF1' },
];

type DrawMode = 'select' | 'point' | 'line' | 'polygon' | null;

interface MapNote {
  id: string;
  text: string;
  lng: number;
  lat: number;
  color: string;
  timestamp: string;
}

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

const ToolBtn = ({ active, label, icon, onClick, color }: { active?: boolean; label: string; icon: string; onClick: () => void; color?: string }) => (
  <button onClick={onClick} title={label} style={{
    fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, padding: '4px 8px',
    background: active ? (color || T.text.cyan) + '22' : 'transparent',
    color: active ? (color || T.text.cyan) : T.text.secondary,
    border: `1px solid ${active ? (color || T.text.cyan) + '66' : T.border.subtle}`,
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
  }}>
    <span style={{ fontSize: 12 }}>{icon}</span>{label}
  </button>
);

export function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<MapRef>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const { layers, toggleLayer } = useMapLayers();
  const [viewState, setViewState] = useState({ longitude: ATLANTA_CENTER[0], latitude: ATLANTA_CENTER[1], zoom: 10.5 });
  const [deals, setDeals] = useState<DealPin[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'layers' | 'draw' | 'notes'>('layers');

  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0].value);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [drawingCount, setDrawingCount] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [notes, setNotes] = useState<MapNote[]>([]);
  const [addingNote, setAddingNote] = useState(false);
  const [placingNote, setPlacingNote] = useState(false);
  const [pendingNoteLngLat, setPendingNoteLngLat] = useState<[number, number] | null>(null);
  const [hoverLngLat, setHoverLngLat] = useState<[number, number] | null>(null); // Preview cursor position
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState(DRAW_COLORS[0].value); // Separate note color
  const [editingNote, setEditingNote] = useState<string | null>(null);

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
    const saved = localStorage.getItem('jedire-map-notes');
    if (saved) { try { setNotes(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    if (notes.length > 0) localStorage.setItem('jedire-map-notes', JSON.stringify(notes));
  }, [notes]);

  // ESC key handler for canceling note placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (placingNote || addingNote)) {
        cancelNotePlacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [placingNote, addingNote, cancelNotePlacement]);

  const initDraw = useCallback(() => {
    if (!mapRef.current || drawRef.current) return;
    const map = mapRef.current.getMap();
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
      styles: [
        { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon']], paint: { 'fill-color': drawColor, 'fill-opacity': 0.15 } },
        { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon']], paint: { 'line-color': drawColor, 'line-width': 2 } },
        { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString']], paint: { 'line-color': drawColor, 'line-width': 2.5 } },
        { id: 'gl-draw-point', type: 'circle', filter: ['all', ['==', '$type', 'Point']], paint: { 'circle-radius': 6, 'circle-color': drawColor, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
        { id: 'gl-draw-point-active', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': 5, 'circle-color': '#fff' } },
        { id: 'gl-draw-point-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 3, 'circle-color': drawColor } },
      ],
    });
    map.addControl(draw);
    drawRef.current = draw;

    map.on('draw.create', (e: any) => {
      const feat = e.features[0];
      if (feat.geometry.type === 'LineString') {
        const line = turf.lineString(feat.geometry.coordinates);
        const len = turf.length(line, { units: 'miles' });
        setMeasurement(`${len.toFixed(2)} mi`);
      } else if (feat.geometry.type === 'Polygon') {
        const poly = turf.polygon(feat.geometry.coordinates);
        const a = turf.area(poly);
        const acres = a * 0.000247105;
        setMeasurement(`${acres.toFixed(2)} acres`);
      }
      setDrawingCount(c => c + 1);
      setDrawMode(null);
    });
    map.on('draw.delete', () => setDrawingCount(c => Math.max(0, c - 1)));
  }, [drawColor]);

  const activateDrawMode = (mode: DrawMode) => {
    if (!drawRef.current) initDraw();
    setTimeout(() => {
      if (!drawRef.current) return;
      setDrawMode(mode);
      setMeasurement(null);
      switch (mode) {
        case 'point': drawRef.current.changeMode('draw_point'); break;
        case 'line': drawRef.current.changeMode('draw_line_string'); break;
        case 'polygon': drawRef.current.changeMode('draw_polygon'); break;
        default: drawRef.current.changeMode('simple_select');
      }
    }, 50);
  };

  const deleteSelected = () => { drawRef.current?.trash(); };
  const clearAllDrawings = () => { drawRef.current?.deleteAll(); setDrawingCount(0); setMeasurement(null); };

  const exportGeoJSON = () => {
    if (!drawRef.current) return;
    const data = drawRef.current.getAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'jedire-map-export.geojson'; a.click();
    URL.revokeObjectURL(url);
  };

  const importGeoJSON = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.geojson,.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const geojson = JSON.parse(text);
        if (!drawRef.current) initDraw();
        setTimeout(() => {
          if (geojson.features) {
            geojson.features.forEach((f: any) => drawRef.current?.add(f));
            setDrawingCount(geojson.features.length);
          }
        }, 100);
      } catch { alert('Invalid GeoJSON file'); }
    };
    input.click();
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const [lng, lat] = pendingNoteLngLat || [viewState.longitude, viewState.latitude];
    const note: MapNote = {
      id: `note-${Date.now()}`,
      text: noteText.trim(),
      lng, lat,
      color: noteColor,
      timestamp: new Date().toLocaleString(),
    };
    setNotes(prev => [...prev, note]);
    setNoteText('');
    setAddingNote(false);
    setPendingNoteLngLat(null);
    setPlacingNote(false);
    setHoverLngLat(null);
  };
  
  const cancelNotePlacement = useCallback(() => {
    setPlacingNote(false);
    setHoverLngLat(null);
    setPendingNoteLngLat(null);
    setAddingNote(false);
    setNoteText('');
  }, []);

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const flyToNote = (note: MapNote) => {
    mapRef.current?.flyTo({ center: [note.lng, note.lat], zoom: 13, duration: 500 });
  };

  const shareMap = async () => {
    // Build shareable URL with layer state and map position
    const params = new URLSearchParams();
    params.set('lng', viewState.longitude.toFixed(4));
    params.set('lat', viewState.latitude.toFixed(4));
    params.set('z', viewState.zoom.toFixed(1));
    
    // Encode active layers
    const activeLayers = layers.filter(l => l.active).map(l => l.id);
    if (activeLayers.length > 0) {
      params.set('layers', activeLayers.join(','));
    }
    
    // Encode notes (up to 5 for URL length)
    if (notes.length > 0) {
      const noteData = notes.slice(0, 5).map(n => ({
        lng: n.lng.toFixed(4),
        lat: n.lat.toFixed(4),
        t: n.text.slice(0, 50),
        c: n.color.replace('#', ''),
      }));
      params.set('notes', btoa(JSON.stringify(noteData)));
    }

    const shareUrl = `${window.location.origin}/map?${params.toString()}`;
    
    const shareData = {
      title: 'JediRE Map View',
      text: `Map view: ${deals.length} deals, ${activeLayers.length} active layers, ${notes.length} notes`,
      url: shareUrl,
    };
    
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert('Map link copied to clipboard!');
    }
  };

  // Load shared state from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Restore map position
    const lng = params.get('lng');
    const lat = params.get('lat');
    const z = params.get('z');
    if (lng && lat) {
      setViewState(prev => ({
        ...prev,
        longitude: parseFloat(lng),
        latitude: parseFloat(lat),
        zoom: z ? parseFloat(z) : prev.zoom,
      }));
    }
    
    // Restore active layers
    const layerParam = params.get('layers');
    if (layerParam) {
      const activeIds = layerParam.split(',');
      activeIds.forEach(id => {
        const layer = layers.find(l => l.id === id);
        if (layer && !layer.active) {
          toggleLayer(id);
        }
      });
    }
    
    // Restore shared notes
    const notesParam = params.get('notes');
    if (notesParam) {
      try {
        const sharedNotes = JSON.parse(atob(notesParam));
        const importedNotes: MapNote[] = sharedNotes.map((n: any, i: number) => ({
          id: `shared-${Date.now()}-${i}`,
          text: n.t,
          lng: parseFloat(n.lng),
          lat: parseFloat(n.lat),
          color: `#${n.c}`,
          timestamp: 'Shared',
        }));
        setNotes(prev => [...prev, ...importedNotes]);
      } catch {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const tabStyle = (tab: string) => ({
    fontFamily: T.font.mono, fontSize: 10, fontWeight: 700 as const, padding: '6px 0',
    cursor: 'pointer' as const, flex: 1, textAlign: 'center' as const,
    background: sidebarTab === tab ? T.bg.panel : 'transparent',
    color: sidebarTab === tab ? T.text.cyan : T.text.muted,
    border: 'none', borderBottom: sidebarTab === tab ? `2px solid ${T.text.cyan}` : `2px solid transparent`,
    letterSpacing: 0.5,
  });

  return (
    <div style={{ height: '100vh', display: 'flex', background: T.bg.terminal }}>
      {sidebarOpen && (
        <div style={{ width: 300, borderRight: `1px solid ${T.border.medium}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: T.bg.panel }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: `1px solid ${T.border.medium}`, background: T.bg.header }}>
            <span style={{ fontFamily: T.font.mono, fontSize: 11, fontWeight: 700, color: T.text.white, letterSpacing: 1 }}>WAR MAP</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={shareMap} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.green, background: 'transparent', border: `1px solid ${T.text.green}44`, padding: '2px 8px', cursor: 'pointer' }}>SHARE</button>
              <button onClick={() => navigate(-1)} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.cyan, background: 'transparent', border: `1px solid ${T.text.cyan}44`, padding: '2px 8px', cursor: 'pointer' }}>← TERMINAL</button>
              <button onClick={() => setSidebarOpen(false)} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: 'transparent', border: `1px solid ${T.border.subtle}`, padding: '0 5px', cursor: 'pointer' }}>✕</button>
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: `1px solid ${T.border.medium}`, background: T.bg.header }}>
            <button onClick={() => setSidebarTab('layers')} style={tabStyle('layers')}>LAYERS</button>
            <button onClick={() => setSidebarTab('draw')} style={tabStyle('draw')}>DRAW</button>
            <button onClick={() => setSidebarTab('notes')} style={tabStyle('notes')}>NOTES</button>
          </div>

          {sidebarTab === 'layers' && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              {layers.map(layer => (
                <div key={layer.id} onClick={() => toggleLayer(layer.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderBottom: `1px solid ${T.border.subtle}`, cursor: 'pointer',
                  background: layer.active ? T.bg.header : 'transparent', opacity: layer.active ? 1 : 0.6,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{layer.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, color: T.text.primary }}>{layer.name}</div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, textTransform: 'uppercase' }}>{layer.type}</div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: layer.active ? T.text.green : T.text.muted, border: `1px solid ${layer.active ? T.text.green : T.border.medium}` }} />
                </div>
              ))}
            </div>
          )}

          {sidebarTab === 'draw' && (
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.secondary, letterSpacing: 0.5, marginBottom: 6 }}>DRAWING TOOLS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <ToolBtn active={drawMode === 'select'} label="SELECT" icon="⊹" onClick={() => activateDrawMode('select')} />
                  <ToolBtn active={drawMode === 'point'} label="MARKER" icon="📍" onClick={() => activateDrawMode('point')} />
                  <ToolBtn active={drawMode === 'line'} label="LINE" icon="╱" onClick={() => activateDrawMode('line')} />
                  <ToolBtn active={drawMode === 'polygon'} label="POLYGON" icon="⬡" onClick={() => activateDrawMode('polygon')} />
                </div>
              </div>

              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.secondary, letterSpacing: 0.5, marginBottom: 6 }}>COLOR</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DRAW_COLORS.map(c => (
                    <button key={c.value} onClick={() => setDrawColor(c.value)} title={c.name} style={{
                      width: 20, height: 20, borderRadius: 2, background: c.value, cursor: 'pointer',
                      border: drawColor === c.value ? '2px solid #fff' : `1px solid ${T.border.medium}`,
                      boxShadow: drawColor === c.value ? `0 0 6px ${c.value}66` : 'none',
                    }} />
                  ))}
                </div>
              </div>

              {measurement && (
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}`, background: T.text.cyan + '11' }}>
                  <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, marginBottom: 2 }}>MEASUREMENT</div>
                  <div style={{ fontFamily: T.font.mono, fontSize: 14, fontWeight: 700, color: T.text.cyan }}>{measurement}</div>
                </div>
              )}

              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.secondary, letterSpacing: 0.5, marginBottom: 6 }}>ACTIONS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ToolBtn label="DELETE SELECTED" icon="🗑" onClick={deleteSelected} color={T.text.red} />
                  <ToolBtn label="CLEAR ALL" icon="✕" onClick={clearAllDrawings} color={T.text.red} />
                </div>
              </div>

              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.secondary, letterSpacing: 0.5, marginBottom: 6 }}>IMPORT / EXPORT</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <ToolBtn label="EXPORT" icon="↓" onClick={exportGeoJSON} />
                  <ToolBtn label="IMPORT" icon="↑" onClick={importGeoJSON} />
                </div>
              </div>

              <div style={{ marginTop: 'auto', padding: '8px 10px', borderTop: `1px solid ${T.border.medium}`, background: T.bg.header }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>{drawingCount} drawing{drawingCount !== 1 ? 's' : ''} on map</div>
              </div>
            </div>
          )}

          {sidebarTab === 'notes' && (
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {/* Note Color Picker */}
              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}` }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.secondary, letterSpacing: 0.5, marginBottom: 6 }}>NOTE COLOR</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DRAW_COLORS.map(c => (
                    <button key={c.value} onClick={() => setNoteColor(c.value)} title={c.name} style={{
                      width: 20, height: 20, borderRadius: 2, background: c.value, cursor: 'pointer',
                      border: noteColor === c.value ? '2px solid #fff' : `1px solid ${T.border.medium}`,
                      boxShadow: noteColor === c.value ? `0 0 6px ${c.value}66` : 'none',
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}` }}>
                {!addingNote && !placingNote ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setPlacingNote(true); setSidebarOpen(false); }} style={{
                      flex: 1, fontFamily: T.font.mono, fontSize: 10, fontWeight: 700,
                      background: noteColor, color: T.bg.terminal, border: 'none',
                      padding: '6px 0', cursor: 'pointer', letterSpacing: 0.3,
                    }}>📍 CLICK MAP TO PLACE</button>
                    <button onClick={() => { setAddingNote(true); setPendingNoteLngLat(null); }} style={{
                      fontFamily: T.font.mono, fontSize: 10, fontWeight: 600,
                      background: 'transparent', color: noteColor, border: `1px solid ${noteColor}44`,
                      padding: '6px 8px', cursor: 'pointer', letterSpacing: 0.3,
                    }}>+ HERE</button>
                  </div>
                ) : placingNote ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: noteColor, animation: 'pulse 1s infinite' }} />
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, color: noteColor, fontWeight: 700, flex: 1 }}>CLICK MAP TO PLACE NOTE</div>
                    <button onClick={cancelNotePlacement} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: 'transparent', border: `1px solid ${T.border.subtle}`, padding: '2px 8px', cursor: 'pointer' }}>ESC</button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } if (e.key === 'Escape') setAddingNote(false); }}
                      placeholder="Type note… (Enter to save)"
                      style={{
                        width: '100%', boxSizing: 'border-box', fontFamily: T.font.mono, fontSize: 10,
                        background: T.bg.input, color: T.text.primary, border: `1px solid ${T.text.cyan}`,
                        padding: '6px 8px', outline: 'none', resize: 'vertical', minHeight: 50,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button onClick={addNote} style={{ flex: 1, fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, background: T.text.cyan, color: T.bg.terminal, border: 'none', padding: '4px 0', cursor: 'pointer' }}>SAVE</button>
                      <button onClick={() => { setAddingNote(false); setNoteText(''); }} style={{ fontFamily: T.font.mono, fontSize: 10, background: 'transparent', color: T.text.muted, border: `1px solid ${T.border.subtle}`, padding: '4px 8px', cursor: 'pointer' }}>CANCEL</button>
                    </div>
                  </div>
                )}
              </div>

              {notes.length === 0 && !addingNote && (
                <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>No notes yet</div>
                  <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, marginTop: 4 }}>Add notes to mark locations on the map</div>
                </div>
              )}

              {notes.map(note => (
                <div key={note.id} style={{
                  padding: '8px 10px', borderBottom: `1px solid ${T.border.subtle}`,
                  cursor: 'pointer', background: editingNote === note.id ? T.bg.header : 'transparent',
                }} onClick={() => flyToNote(note)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: note.color, marginTop: 3, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.primary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.text}</div>
                      <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, marginTop: 2 }}>{note.timestamp}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }} style={{
                      fontFamily: T.font.mono, fontSize: 10, color: T.text.red, background: 'transparent',
                      border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0,
                    }}>✕</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 'auto', padding: '8px 10px', borderTop: `1px solid ${T.border.medium}`, background: T.bg.header }}>
                <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onMouseMove={(e) => {
            // Track cursor position for preview marker when placing note
            if (placingNote && e.lngLat) {
              setHoverLngLat([e.lngLat.lng, e.lngLat.lat]);
            }
          }}
          onClick={(e) => {
            if (placingNote && e.lngLat) {
              setPendingNoteLngLat([e.lngLat.lng, e.lngLat.lat]);
              setHoverLngLat(null); // Clear preview
              setAddingNote(true);
              setSidebarOpen(true);
              setSidebarTab('notes');
              setPlacingNote(false);
              return;
            }
            setSelectedDeal(null);
          }}
          onLoad={() => setMapLoaded(true)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={DARK_STYLE}
          style={{ width: '100%', height: '100%', cursor: placingNote ? 'crosshair' : '' }}
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

          {/* Preview marker when placing note - shows where note will go */}
          {placingNote && hoverLngLat && (
            <Marker longitude={hoverLngLat[0]} latitude={hoverLngLat[1]} anchor="center">
              <div style={{
                width: 24, height: 24, borderRadius: '50%', 
                background: noteColor + '44', border: `2px dashed ${noteColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse 1s infinite',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: noteColor }} />
              </div>
            </Marker>
          )}

          {notes.map(note => (
            <Marker key={note.id} longitude={note.lng} latitude={note.lat} anchor="center">
              <div style={{ cursor: 'pointer', position: 'relative' }} onClick={e => { e.stopPropagation(); setEditingNote(editingNote === note.id ? null : note.id); }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: note.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#000', fontWeight: 700, border: '2px solid #fff',
                  boxShadow: `0 0 8px ${note.color}66`,
                }}>✎</div>
                {editingNote === note.id && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: '50%',
                    transform: 'translateX(-50%)', background: T.bg.header,
                    border: `1px solid ${note.color}66`, padding: '6px 8px',
                    zIndex: 20, minWidth: 160, maxWidth: 220,
                  }}>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.primary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.text}</div>
                    <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, marginTop: 3 }}>{note.timestamp}</div>
                  </div>
                )}
              </div>
            </Marker>
          ))}
        </Map>

        {!sidebarOpen && (
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 4, zIndex: 5 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: T.bg.panel, color: T.text.cyan, border: `1px solid ${T.text.cyan}44`, padding: '4px 10px', cursor: 'pointer' }}>LAYERS</button>
            <button onClick={() => { setSidebarOpen(true); setSidebarTab('draw'); }} style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: T.bg.panel, color: T.text.amber, border: `1px solid ${T.text.amber}44`, padding: '4px 10px', cursor: 'pointer' }}>DRAW</button>
            <button onClick={() => { setSidebarOpen(true); setSidebarTab('notes'); }} style={{ fontFamily: T.font.mono, fontSize: 10, fontWeight: 600, background: T.bg.panel, color: T.text.green, border: `1px solid ${T.text.green}44`, padding: '4px 10px', cursor: 'pointer' }}>NOTES</button>
          </div>
        )}

        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 5 }}>
          <button onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom + 1, duration: 300 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: T.font.mono }}>+</button>
          <button onClick={() => mapRef.current?.flyTo({ center: [viewState.longitude, viewState.latitude], zoom: viewState.zoom - 1, duration: 300 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.primary, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: T.font.mono }}>−</button>
          <button onClick={() => mapRef.current?.flyTo({ center: ATLANTA_CENTER, zoom: 10.5, duration: 500 })} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg.panel, border: `1px solid ${T.border.medium}`, color: T.text.cyan, fontSize: 14, cursor: 'pointer' }}>⌖</button>
        </div>

        {(drawMode || placingNote) && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            fontFamily: T.font.mono, fontSize: 10, fontWeight: 700, color: T.text.amber,
            background: T.bg.header + 'ee', padding: '4px 12px', border: `1px solid ${T.text.amber}44`,
            zIndex: 5, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {placingNote ? '📍 CLICK MAP TO PLACE NOTE' : drawMode === 'point' ? 'CLICK TO PLACE MARKER' : drawMode === 'line' ? 'CLICK POINTS · DOUBLE-CLICK TO FINISH' : drawMode === 'polygon' ? 'CLICK VERTICES · DOUBLE-CLICK TO CLOSE' : 'SELECT DRAWINGS TO EDIT'}
            {placingNote && <button onClick={cancelNotePlacement} style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: 'transparent', border: `1px solid ${T.border.subtle}`, padding: '1px 6px', cursor: 'pointer' }}>ESC</button>}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8, zIndex: 5 }}>
          <div style={{ fontFamily: T.font.mono, fontSize: 10, color: T.text.muted, background: T.bg.panel + 'dd', padding: '4px 8px', border: `1px solid ${T.border.subtle}` }}>
            {deals.length} DEALS · {notes.length} NOTES · {drawingCount} DRAWINGS · Z{viewState.zoom.toFixed(1)}
          </div>
        </div>

        {/* Pulse animation for note placement preview */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
          }
        `}</style>
      </div>
    </div>
  );
}
