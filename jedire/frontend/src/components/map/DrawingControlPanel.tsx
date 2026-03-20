import React from 'react';
import { useMapDrawingStore } from '../../stores/mapDrawingStore';
import { Button } from '../shared/Button';

interface DrawingControlPanelProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export const DrawingControlPanel: React.FC<DrawingControlPanelProps> = ({
  onComplete,
  onCancel,
}) => {
  const { drawingMode, drawnGeometry } = useMapDrawingStore();

  if (!drawingMode) return null;

  const instructions = {
    boundary: 'Click points on the map to draw the property boundary. Double-click to finish.',
    'trade-area': 'Draw the competitive trade area boundary. Double-click to complete.',
  };

  return (
    <div className="absolute top-20 right-4 z-10">
      <div className="bg-white rounded-lg shadow-2xl border-2 border-blue-500 p-4 w-80">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">✏️</span>
          <h3 className="text-lg font-bold text-gray-900">
            {drawingMode === 'boundary' ? 'Draw Property Boundary' : 'Draw Trade Area'}
          </h3>
        </div>

        {/* Instructions */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {instructions[drawingMode]}
          </p>
        </div>

        {/* Drawing tools info */}
        <div className="mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">▢</span>
            <span>Click: Add point</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">⌫</span>
            <span>Backspace: Undo last point</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">✓</span>
            <span>Double-click: Finish</span>
          </div>
        </div>

        {/* Status */}
        {drawnGeometry && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-semibold">
              ✓ Boundary drawn! Click "Done" to continue.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onComplete}
            disabled={!drawnGeometry}
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Done Drawing
          </Button>
        </div>

        {/* Trash button hint */}
        <div className="mt-3 text-xs text-gray-500 text-center">
          Use the trash icon to delete and redraw
        </div>
      </div>
    </div>
  );
};
