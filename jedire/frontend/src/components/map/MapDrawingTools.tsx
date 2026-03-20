/**
 * MapDrawingTools Component
 * Comprehensive drawing and annotation toolbar for Mapbox maps
 * Features: draw shapes, markers, measure distance, text labels, color picker, save/load
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MapRef } from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import {
  PencilIcon,
  MapPinIcon,
  Square3Stack3DIcon,
  ArrowPathIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  RulerIcon,
  PaintBrushIcon,
  XMarkIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import mapAnnotationsService, { MapAnnotation } from '@/services/mapAnnotations.service';

interface MapDrawingToolsProps {
  mapRef: React.RefObject<MapRef>;
  mapType: 'pipeline' | 'assets' | 'general';
  onAnnotationsChange?: (annotations: MapAnnotation[]) => void;
  className?: string;
}

type DrawMode =
  | 'simple_select'
  | 'direct_select'
  | 'draw_point'
  | 'draw_line_string'
  | 'draw_polygon'
  | 'measure'
  | null;

const COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Green', value: '#10B981' },
  { name: 'Yellow', value: '#F59E0B' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Orange', value: '#F97316' },
];

export default function MapDrawingTools({
  mapRef,
  mapType,
  onAnnotationsChange,
  className,
}: MapDrawingToolsProps) {
  const [drawControl, setDrawControl] = useState<MapboxDraw | null>(null);
  const [activeMode, setActiveMode] = useState<DrawMode>('simple_select');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showMeasurement, setShowMeasurement] = useState(false);
  const [measurementValue, setMeasurementValue] = useState<string>('');
  const undoStackRef = useRef<any[]>([]);
  const redoStackRef = useRef<any[]>([]);

  // Initialize Mapbox Draw
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: [
        // Customize drawing styles
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          paint: {
            'fill-color': selectedColor,
            'fill-outline-color': selectedColor,
            'fill-opacity': 0.3,
          },
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
          paint: {
            'fill-color': selectedColor,
            'fill-outline-color': selectedColor,
            'fill-opacity': 0.3,
          },
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': selectedColor,
            'line-width': 3,
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
            'line-color': selectedColor,
            'line-width': 3,
          },
        },
        {
          id: 'gl-draw-line-inactive',
          type: 'line',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': selectedColor,
            'line-width': 3,
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
            'line-color': selectedColor,
            'line-width': 3,
          },
        },
        {
          id: 'gl-draw-point-inactive',
          type: 'circle',
          filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']],
          paint: {
            'circle-radius': 8,
            'circle-color': selectedColor,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        },
        {
          id: 'gl-draw-point-active',
          type: 'circle',
          filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 10,
            'circle-color': selectedColor,
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 3,
          },
        },
      ],
    });

    map.addControl(draw);
    setDrawControl(draw);

    // Event listeners for drawing
    map.on('draw.create', handleDrawCreate);
    map.on('draw.update', handleDrawUpdate);
    map.on('draw.delete', handleDrawDelete);
    map.on('draw.selectionchange', handleSelectionChange);

    return () => {
      map.off('draw.create', handleDrawCreate);
      map.off('draw.update', handleDrawUpdate);
      map.off('draw.delete', handleDrawDelete);
      map.off('draw.selectionchange', handleSelectionChange);
      map.removeControl(draw);
    };
  }, [mapRef]);

  // Load existing annotations
  useEffect(() => {
    loadAnnotations();
  }, [mapType]);

  const loadAnnotations = async () => {
    try {
      const data = await mapAnnotationsService.getAnnotations({ map_type: mapType });
      setAnnotations(data);
      
      // Load into draw control
      if (drawControl && data.length > 0) {
        data.forEach((annotation) => {
          const feature = mapAnnotationsService.annotationToMapboxFeature(annotation);
          drawControl.add(feature);
        });
      }

      onAnnotationsChange?.(data);
    } catch (error) {
      console.error('Failed to load annotations:', error);
    }
  };

  const handleDrawCreate = useCallback(
    async (e: any) => {
      const feature = e.features[0];
      
      // Calculate measurement if it's a line
      if (feature.geometry.type === 'LineString') {
        const distance = mapAnnotationsService.calculateLineDistance(feature.geometry.coordinates);
        setMeasurementValue(`${distance.miles.toFixed(2)} miles`);
        setShowMeasurement(true);
        
        feature.properties.measurement_value = distance.miles;
        feature.properties.measurement_unit = 'miles';
      } else if (feature.geometry.type === 'Polygon') {
        const area = mapAnnotationsService.calculatePolygonArea(feature.geometry.coordinates);
        setMeasurementValue(`${area.acres.toFixed(2)} acres`);
        setShowMeasurement(true);
        
        feature.properties.measurement_value = area.acres;
        feature.properties.measurement_unit = 'acres';
      }

      // Set color
      feature.properties.color = selectedColor;

      // Save to backend
      try {
        setIsSaving(true);
        const annotation = mapAnnotationsService.mapboxFeatureToAnnotation(feature, mapType, {
          color: selectedColor,
        });
        const saved = await mapAnnotationsService.createAnnotation(annotation);
        setAnnotations((prev) => [...prev, saved]);
        onAnnotationsChange?.([...annotations, saved]);

        // Update feature with saved ID
        drawControl?.setFeatureProperty(feature.id, 'annotationId', saved.id);
      } catch (error) {
        console.error('Failed to save annotation:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [drawControl, selectedColor, mapType, annotations, onAnnotationsChange]
  );

  const handleDrawUpdate = useCallback(
    async (e: any) => {
      const feature = e.features[0];
      const annotationId = feature.properties?.annotationId;

      if (!annotationId) return;

      try {
        setIsSaving(true);
        await mapAnnotationsService.updateAnnotation(annotationId, {
          geometry: feature.geometry,
          properties: feature.properties,
        });

        setAnnotations((prev) =>
          prev.map((a) => (a.id === annotationId ? { ...a, geometry: feature.geometry } : a))
        );
      } catch (error) {
        console.error('Failed to update annotation:', error);
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const handleDrawDelete = useCallback(
    async (e: any) => {
      const feature = e.features[0];
      const annotationId = feature.properties?.annotationId;

      if (!annotationId) return;

      try {
        await mapAnnotationsService.deleteAnnotation(annotationId);
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
        onAnnotationsChange?.(annotations.filter((a) => a.id !== annotationId));
      } catch (error) {
        console.error('Failed to delete annotation:', error);
      }
    },
    [annotations, onAnnotationsChange]
  );

  const handleSelectionChange = useCallback((e: any) => {
    // Handle selection changes if needed
  }, []);

  const setDrawMode = (mode: DrawMode) => {
    if (!drawControl) return;

    setActiveMode(mode);
    setShowMeasurement(false);

    switch (mode) {
      case 'draw_point':
        drawControl.changeMode('draw_point');
        break;
      case 'draw_line_string':
        drawControl.changeMode('draw_line_string');
        break;
      case 'draw_polygon':
        drawControl.changeMode('draw_polygon');
        break;
      case 'simple_select':
        drawControl.changeMode('simple_select');
        break;
      case 'direct_select':
        drawControl.changeMode('direct_select');
        break;
      default:
        drawControl.changeMode('simple_select');
    }
  };

  const handleDeleteSelected = () => {
    if (!drawControl) return;
    const selected = drawControl.getSelected();
    if (selected.features.length > 0) {
      drawControl.trash();
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete all drawings on this map?')) return;

    try {
      await mapAnnotationsService.deleteAllAnnotations(mapType);
      drawControl?.deleteAll();
      setAnnotations([]);
      onAnnotationsChange?.([]);
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  };

  const handleExport = async () => {
    try {
      await mapAnnotationsService.downloadAsGeoJSON(mapType, `${mapType}-map-annotations.geojson`);
    } catch (error) {
      console.error('Failed to export annotations:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.geojson,.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const geojson = JSON.parse(text);
        const result = await mapAnnotationsService.importAnnotations(geojson, mapType);
        
        alert(`Imported ${result.imported} annotations${result.errors > 0 ? ` (${result.errors} errors)` : ''}`);
        await loadAnnotations();
      } catch (error) {
        console.error('Failed to import annotations:', error);
        alert('Failed to import file. Please check the format.');
      }
    };
    input.click();
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    // Toggle visibility of draw layers
    // This would need more complex implementation with Mapbox layer visibility
  };

  return (
    <div className={cn('absolute top-4 right-4 z-10', className)}>
      {/* Main Toolbar */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* Drawing Tools */}
        <div className="p-2 space-y-1">
          {/* Select Tool */}
          <button
            onClick={() => setDrawMode('simple_select')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeMode === 'simple_select'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
            title="Select & Edit"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Select</span>
          </button>

          {/* Point/Marker Tool */}
          <button
            onClick={() => setDrawMode('draw_point')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeMode === 'draw_point'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
            title="Draw Marker"
          >
            <MapPinIcon className="w-4 h-4" />
            <span>Marker</span>
          </button>

          {/* Line Tool */}
          <button
            onClick={() => setDrawMode('draw_line_string')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeMode === 'draw_line_string'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
            title="Draw Line / Measure Distance"
          >
            <RulerIcon className="w-4 h-4" />
            <span>Line</span>
          </button>

          {/* Polygon Tool */}
          <button
            onClick={() => setDrawMode('draw_polygon')}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeMode === 'draw_polygon'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )}
            title="Draw Polygon / Area"
          >
            <Square3Stack3DIcon className="w-4 h-4" />
            <span>Polygon</span>
          </button>

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              title="Choose Color"
            >
              <PaintBrushIcon className="w-4 h-4" />
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: selectedColor }}
              />
              <span>Color</span>
            </button>

            {/* Color Picker Dropdown */}
            {showColorPicker && (
              <div className="absolute left-full ml-2 top-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 w-48">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => {
                        setSelectedColor(color.value);
                        setShowColorPicker(false);
                      }}
                      className={cn(
                        'w-full aspect-square rounded-md border-2 transition-all hover:scale-110',
                        selectedColor === color.value
                          ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-300'
                          : 'border-gray-300'
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 my-1" />

          {/* Delete Tool */}
          <button
            onClick={handleDeleteSelected}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            title="Delete Selected"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Delete</span>
          </button>

          {/* Clear All */}
          <button
            onClick={handleClearAll}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            title="Clear All Drawings"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Clear All</span>
          </button>

          <div className="border-t border-gray-200 my-1" />

          {/* Export */}
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            title="Export as GeoJSON"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>Export</span>
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            title="Import GeoJSON"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            <span>Import</span>
          </button>

          {/* Toggle Visibility */}
          <button
            onClick={toggleVisibility}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            title={isVisible ? 'Hide Drawings' : 'Show Drawings'}
          >
            {isVisible ? (
              <>
                <EyeSlashIcon className="w-4 h-4" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <EyeIcon className="w-4 h-4" />
                <span>Show</span>
              </>
            )}
          </button>
        </div>

        {/* Status Footer */}
        <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600 border-t border-gray-200">
          {isSaving ? (
            <div className="flex items-center gap-1">
              <div className="animate-spin w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span>Saving...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <CheckIcon className="w-3 h-3 text-green-600" />
              <span>{annotations.length} saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Measurement Display */}
      {showMeasurement && measurementValue && (
        <div className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-xs font-medium">Measurement</div>
          <div className="text-lg font-bold">{measurementValue}</div>
        </div>
      )}
    </div>
  );
}
