import { useEffect, useRef, useState, useCallback } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { MapRef } from 'react-map-gl';
import {
  PencilIcon,
  MapPinIcon,
  Square3Stack3DIcon,
  MinusIcon,
  PlusCircleIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  PaintBrushIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface MapDrawingToolsProps {
  mapRef: MapRef | null;
  userId: string;
  onSave?: (drawings: any) => void;
  onLoad?: () => void;
}

interface DrawingStyle {
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeWidth: number;
}

interface SavedDrawing {
  id: string;
  userId: string;
  name: string;
  geojson: any;
  style: DrawingStyle;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_STYLE: DrawingStyle = {
  fillColor: '#3B82F6',
  strokeColor: '#2563EB',
  fillOpacity: 0.2,
  strokeWidth: 2,
};

const PRESET_COLORS = [
  { name: 'Blue', fill: '#3B82F6', stroke: '#2563EB' },
  { name: 'Red', fill: '#EF4444', stroke: '#DC2626' },
  { name: 'Green', fill: '#10B981', stroke: '#059669' },
  { name: 'Yellow', fill: '#F59E0B', stroke: '#D97706' },
  { name: 'Purple', fill: '#8B5CF6', stroke: '#7C3AED' },
  { name: 'Pink', fill: '#EC4899', stroke: '#DB2777' },
  { name: 'Orange', fill: '#F97316', stroke: '#EA580C' },
  { name: 'Teal', fill: '#14B8A6', stroke: '#0D9488' },
];

export default function MapDrawingTools({ mapRef, userId, onSave, onLoad }: MapDrawingToolsProps) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>(DEFAULT_STYLE);
  const [savedDrawings, setSavedDrawings] = useState<SavedDrawing[]>([]);
  const [drawingName, setDrawingName] = useState('');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!mapRef || !mapRef.getMap()) return;

    const map = mapRef.getMap();

    // Custom styles for drawing
    const drawStyles = [
      // Polygon fill
      {
        id: 'gl-draw-polygon-fill-inactive',
        type: 'fill',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        paint: {
          'fill-color': currentStyle.fillColor,
          'fill-outline-color': currentStyle.strokeColor,
          'fill-opacity': currentStyle.fillOpacity,
        },
      },
      {
        id: 'gl-draw-polygon-fill-active',
        type: 'fill',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        paint: {
          'fill-color': currentStyle.fillColor,
          'fill-outline-color': currentStyle.strokeColor,
          'fill-opacity': currentStyle.fillOpacity,
        },
      },
      // Polygon outline
      {
        id: 'gl-draw-polygon-stroke-inactive',
        type: 'line',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': currentStyle.strokeColor,
          'line-width': currentStyle.strokeWidth,
        },
      },
      {
        id: 'gl-draw-polygon-stroke-active',
        type: 'line',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': currentStyle.strokeColor,
          'line-width': currentStyle.strokeWidth,
        },
      },
      // Line
      {
        id: 'gl-draw-line-inactive',
        type: 'line',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': currentStyle.strokeColor,
          'line-width': currentStyle.strokeWidth,
        },
      },
      {
        id: 'gl-draw-line-active',
        type: 'line',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': currentStyle.strokeColor,
          'line-width': currentStyle.strokeWidth,
        },
      },
      // Points
      {
        id: 'gl-draw-point-inactive',
        type: 'circle',
        filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        paint: {
          'circle-radius': 6,
          'circle-color': currentStyle.fillColor,
          'circle-stroke-color': currentStyle.strokeColor,
          'circle-stroke-width': currentStyle.strokeWidth,
        },
      },
      {
        id: 'gl-draw-point-active',
        type: 'circle',
        filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
        paint: {
          'circle-radius': 8,
          'circle-color': currentStyle.fillColor,
          'circle-stroke-color': currentStyle.strokeColor,
          'circle-stroke-width': currentStyle.strokeWidth,
        },
      },
      // Vertices
      {
        id: 'gl-draw-polygon-and-line-vertex-inactive',
        type: 'circle',
        filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
        paint: {
          'circle-radius': 5,
          'circle-color': '#fff',
          'circle-stroke-color': currentStyle.strokeColor,
          'circle-stroke-width': 2,
        },
      },
    ];

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: drawStyles,
    });

    map.addControl(draw as any, 'top-left');
    drawRef.current = draw;

    // Load saved drawings
    loadUserDrawings();

    return () => {
      if (drawRef.current) {
        map.removeControl(drawRef.current as any);
        drawRef.current = null;
      }
    };
  }, [mapRef, currentStyle]);

  // Load user's saved drawings
  const loadUserDrawings = useCallback(async () => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch(`/api/v1/map-annotations?userId=${userId}`);
      if (response.ok) {
        const drawings = await response.json();
        setSavedDrawings(drawings);
        
        // Load each drawing onto the map
        drawings.forEach((drawing: SavedDrawing) => {
          if (drawRef.current && drawing.geojson) {
            drawRef.current.add(drawing.geojson);
          }
        });
        
        onLoad?.();
      }
    } catch (error) {
      console.error('Failed to load drawings:', error);
      // Mock data for development
      const mockDrawings: SavedDrawing[] = [];
      setSavedDrawings(mockDrawings);
    }
  }, [userId, onLoad]);

  // Save current drawing
  const handleSave = useCallback(async () => {
    if (!drawRef.current || !drawingName.trim()) return;

    const data = drawRef.current.getAll();
    
    if (data.features.length === 0) {
      alert('No drawings to save');
      return;
    }

    const newDrawing: SavedDrawing = {
      id: `drawing-${Date.now()}`,
      userId,
      name: drawingName.trim(),
      geojson: data,
      style: currentStyle,
      isShared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/v1/map-annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDrawing),
      });

      if (response.ok) {
        setSavedDrawings([...savedDrawings, newDrawing]);
        setShowSaveModal(false);
        setDrawingName('');
        onSave?.(data);
        alert('Drawing saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save drawing:', error);
      // Mock save for development
      setSavedDrawings([...savedDrawings, newDrawing]);
      setShowSaveModal(false);
      setDrawingName('');
      alert('Drawing saved (mock mode)');
    }
  }, [drawingName, userId, currentStyle, savedDrawings, onSave]);

  // Delete drawing
  const handleDelete = useCallback(async (drawingId: string) => {
    if (!confirm('Delete this drawing?')) return;

    try {
      // TODO: Replace with actual API call
      await fetch(`/api/v1/map-annotations/${drawingId}`, {
        method: 'DELETE',
      });

      setSavedDrawings(savedDrawings.filter((d) => d.id !== drawingId));
      
      // Remove from map
      if (drawRef.current) {
        const features = drawRef.current.getAll().features;
        features.forEach((feature) => {
          if (feature.id === drawingId) {
            drawRef.current?.delete(feature.id as string);
          }
        });
      }
    } catch (error) {
      console.error('Failed to delete drawing:', error);
    }
  }, [savedDrawings]);

  // Export drawing as GeoJSON
  const handleExport = useCallback(() => {
    if (!drawRef.current) return;

    const data = drawRef.current.getAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `map-drawings-${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Clear all drawings
  const handleClearAll = useCallback(() => {
    if (!drawRef.current) return;
    if (!confirm('Clear all drawings from map?')) return;
    
    drawRef.current.deleteAll();
  }, []);

  // Toggle drawing visibility
  const toggleDrawings = useCallback(() => {
    if (!mapRef) return;
    const map = mapRef.getMap();
    const newVisibility = !showDrawings;
    
    // Toggle all draw layers
    const layers = map.getStyle().layers || [];
    layers.forEach((layer) => {
      if (layer.id.startsWith('gl-draw')) {
        map.setLayoutProperty(layer.id, 'visibility', newVisibility ? 'visible' : 'none');
      }
    });
    
    setShowDrawings(newVisibility);
  }, [mapRef, showDrawings]);

  // Drawing tool handlers
  const startDrawing = useCallback((mode: string) => {
    if (!drawRef.current) return;

    switch (mode) {
      case 'point':
        drawRef.current.changeMode('draw_point');
        break;
      case 'line':
        drawRef.current.changeMode('draw_line_string');
        break;
      case 'polygon':
        drawRef.current.changeMode('draw_polygon');
        break;
      case 'select':
        drawRef.current.changeMode('simple_select');
        break;
      default:
        drawRef.current.changeMode('simple_select');
    }
    
    setSelectedTool(mode);
    setIsDrawingMode(mode !== 'select');
  }, []);

  return (
    <>
      {/* Drawing Tools Panel */}
      <div className="absolute top-20 left-4 bg-white rounded-lg shadow-xl p-2 space-y-1 z-20">
        <div className="text-xs font-semibold text-gray-600 px-2 py-1">Drawing Tools</div>
        
        {/* Point/Marker */}
        <button
          onClick={() => startDrawing('point')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            selectedTool === 'point'
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          title="Add marker"
        >
          <MapPinIcon className="w-4 h-4" />
          <span>Marker</span>
        </button>

        {/* Line */}
        <button
          onClick={() => startDrawing('line')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            selectedTool === 'line'
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          title="Draw line"
        >
          <MinusIcon className="w-4 h-4" />
          <span>Line</span>
        </button>

        {/* Polygon */}
        <button
          onClick={() => startDrawing('polygon')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            selectedTool === 'polygon'
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          title="Draw polygon"
        >
          <Square3Stack3DIcon className="w-4 h-4" />
          <span>Polygon</span>
        </button>

        {/* Select/Edit */}
        <button
          onClick={() => startDrawing('select')}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            selectedTool === 'select'
              ? 'bg-blue-100 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          title="Select and edit"
        >
          <PencilIcon className="w-4 h-4" />
          <span>Edit</span>
        </button>

        <div className="border-t border-gray-200 my-1"></div>

        {/* Style */}
        <button
          onClick={() => setShowStylePanel(!showStylePanel)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 text-gray-700 transition-colors"
          title="Style settings"
        >
          <PaintBrushIcon className="w-4 h-4" />
          <span>Style</span>
        </button>

        {/* Toggle Visibility */}
        <button
          onClick={toggleDrawings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 text-gray-700 transition-colors"
          title={showDrawings ? 'Hide drawings' : 'Show drawings'}
        >
          {showDrawings ? (
            <EyeIcon className="w-4 h-4" />
          ) : (
            <EyeSlashIcon className="w-4 h-4" />
          )}
          <span>{showDrawings ? 'Hide' : 'Show'}</span>
        </button>

        <div className="border-t border-gray-200 my-1"></div>

        {/* Save */}
        <button
          onClick={() => setShowSaveModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-green-50 hover:bg-green-100 text-green-700 transition-colors"
          title="Save drawings"
        >
          <PlusCircleIcon className="w-4 h-4" />
          <span>Save</span>
        </button>

        {/* Export */}
        <button
          onClick={handleExport}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 text-gray-700 transition-colors"
          title="Export as GeoJSON"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>Export</span>
        </button>

        {/* Clear All */}
        <button
          onClick={handleClearAll}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
          title="Clear all drawings"
        >
          <TrashIcon className="w-4 h-4" />
          <span>Clear</span>
        </button>
      </div>

      {/* Style Panel */}
      {showStylePanel && (
        <div className="absolute top-20 left-60 bg-white rounded-lg shadow-xl p-4 z-20 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Drawing Style</h3>
            <button
              onClick={() => setShowStylePanel(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <XMarkIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Preset Colors */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">Preset Colors</label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setCurrentStyle({
                    ...currentStyle,
                    fillColor: color.fill,
                    strokeColor: color.stroke,
                  })}
                  className="w-full aspect-square rounded-lg border-2 hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: color.fill,
                    borderColor: color.stroke,
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Fill Color */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Fill Color</label>
            <input
              type="color"
              value={currentStyle.fillColor}
              onChange={(e) => setCurrentStyle({ ...currentStyle, fillColor: e.target.value })}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>

          {/* Stroke Color */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Stroke Color</label>
            <input
              type="color"
              value={currentStyle.strokeColor}
              onChange={(e) => setCurrentStyle({ ...currentStyle, strokeColor: e.target.value })}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>

          {/* Opacity */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Fill Opacity: {(currentStyle.fillOpacity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={currentStyle.fillOpacity * 100}
              onChange={(e) => setCurrentStyle({
                ...currentStyle,
                fillOpacity: parseInt(e.target.value) / 100,
              })}
              className="w-full"
            />
          </div>

          {/* Stroke Width */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Stroke Width: {currentStyle.strokeWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={currentStyle.strokeWidth}
              onChange={(e) => setCurrentStyle({
                ...currentStyle,
                strokeWidth: parseInt(e.target.value),
              })}
              className="w-full"
            />
          </div>

          {/* Reset */}
          <button
            onClick={() => setCurrentStyle(DEFAULT_STYLE)}
            className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Reset to Default
          </button>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Save Drawing</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Drawing Name
              </label>
              <input
                type="text"
                value={drawingName}
                onChange={(e) => setDrawingName(e.target.value)}
                placeholder="e.g., Target Acquisition Zone"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setDrawingName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!drawingName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drawings List (Optional) */}
      {savedDrawings.length > 0 && (
        <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-xl p-3 max-w-xs z-20">
          <h4 className="font-semibold text-gray-900 text-sm mb-2">Saved Drawings</h4>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {savedDrawings.map((drawing) => (
              <div
                key={drawing.id}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {drawing.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(drawing.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  {drawing.isShared && (
                    <ShareIcon className="w-4 h-4 text-blue-600" title="Shared" />
                  )}
                  <button
                    onClick={() => handleDelete(drawing.id)}
                    className="p-1 hover:bg-red-100 rounded"
                    title="Delete"
                  >
                    <TrashIcon className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
