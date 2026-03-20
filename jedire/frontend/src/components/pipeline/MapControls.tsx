/**
 * Map Controls
 * Zoom, filters, heatmap, and radius tools
 */

import {
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  FunnelIcon,
  FireIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleHeatmap: () => void;
  onToggleFilters: () => void;
  onDrawRadius: () => void;
  showHeatmap: boolean;
  showFilters: boolean;
  drawMode: 'radius' | null;
}

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onToggleHeatmap,
  onToggleFilters,
  onDrawRadius,
  showHeatmap,
  showFilters,
  drawMode,
}: MapControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
      {/* Filters */}
      <button
        onClick={onToggleFilters}
        className={cn(
          'bg-white p-3 rounded-lg shadow-lg transition-all duration-200',
          showFilters 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'hover:bg-gray-50 text-gray-700'
        )}
        aria-label="Toggle filters"
        title="Filter deals"
      >
        <FunnelIcon className="w-5 h-5" />
      </button>

      {/* Heatmap */}
      <button
        onClick={onToggleHeatmap}
        className={cn(
          'bg-white p-3 rounded-lg shadow-lg transition-all duration-200',
          showHeatmap 
            ? 'bg-orange-600 text-white hover:bg-orange-700' 
            : 'hover:bg-gray-50 text-gray-700'
        )}
        aria-label="Toggle heatmap"
        title="Show deal density heatmap"
      >
        <FireIcon className="w-5 h-5" />
      </button>

      {/* Radius Tool */}
      <button
        onClick={onDrawRadius}
        className={cn(
          'bg-white p-3 rounded-lg shadow-lg transition-all duration-200',
          drawMode === 'radius' 
            ? 'bg-purple-600 text-white hover:bg-purple-700' 
            : 'hover:bg-gray-50 text-gray-700'
        )}
        aria-label="Draw radius"
        title="Search within radius"
      >
        <MapPinIcon className="w-5 h-5" />
      </button>

      <div className="h-px bg-gray-300 my-1" />

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-gray-700"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <MagnifyingGlassPlusIcon className="w-5 h-5" />
      </button>

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        className="bg-white p-3 rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-gray-700"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <MagnifyingGlassMinusIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
