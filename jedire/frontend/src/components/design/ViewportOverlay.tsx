import React, { useState } from 'react';
import { Html } from '@react-three/drei';

interface ViewportOverlayProps {
  imageUrl: string;
  fileName: string;
  onRemove: () => void;
}

export const ViewportOverlay: React.FC<ViewportOverlayProps> = ({
  imageUrl,
  fileName,
  onRemove,
}) => {
  const [opacity, setOpacity] = useState(0.5);

  return (
    <Html
      position={[0, 30, 0]}
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: 'auto' }}
    >
      <div className="relative" style={{ opacity }}>
        <img
          src={imageUrl}
          alt={fileName}
          className="max-w-[300px] max-h-[200px] rounded-lg shadow-xl border border-white/20"
          draggable={false}
        />
        <div className="absolute top-1 right-1 flex gap-1">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-16 h-4"
            title="Opacity"
          />
          <button
            onClick={onRemove}
            className="bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-700"
          >
            &times;
          </button>
        </div>
        <div className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded text-white text-[10px]">
          {fileName}
        </div>
      </div>
    </Html>
  );
};

export default ViewportOverlay;
