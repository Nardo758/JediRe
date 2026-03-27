import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

export function MapPage() {
  return (
    <div className="h-full relative" style={{ background: BT.bg.terminal }}>
      {/* Placeholder for full-screen map */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: BT.bg.panel }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: BT.text.primary }}>Interactive Map View</h2>
          <p className="max-w-md" style={{ color: BT.text.secondary }}>
            Full-screen map with property markers, heatmaps, and custom boundaries.
            Mapbox GL JS integration coming soon.
          </p>
          <div className="mt-6 flex gap-4 justify-center">
            <button className="px-4 py-2" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
              Draw Boundary
            </button>
            <button className="px-4 py-2" style={{ background: BT.bg.panelAlt, color: BT.text.secondary, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
              Add Layer
            </button>
          </div>
        </div>
      </div>

      {/* Map Controls (future) */}
      <div className="absolute top-4 right-4 space-y-2">
        <button className="w-10 h-10 flex items-center justify-center" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary }}>
          +
        </button>
        <button className="w-10 h-10 flex items-center justify-center" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary }}>
          −
        </button>
        <button className="w-10 h-10 flex items-center justify-center" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}`, color: BT.text.primary }}>
          📍
        </button>
      </div>
    </div>
  );
}
