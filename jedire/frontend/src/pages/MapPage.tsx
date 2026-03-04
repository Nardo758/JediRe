import React from 'react';

export function MapPage() {
  return (
    <div className="h-full bg-gray-100 relative">
      {/* Placeholder for full-screen map */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Interactive Map View</h2>
          <p className="text-gray-600 max-w-md">
            Full-screen map with property markers, heatmaps, and custom boundaries.
            Mapbox GL JS integration coming soon.
          </p>
          <div className="mt-6 flex gap-4 justify-center">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Draw Boundary
            </button>
            <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              Add Layer
            </button>
          </div>
        </div>
      </div>

      {/* Map Controls (future) */}
      <div className="absolute top-4 right-4 space-y-2">
        <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50">
          +
        </button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50">
          −
        </button>
        <button className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50">
          📍
        </button>
      </div>
    </div>
  );
}
