import React from 'react';
import { X } from 'lucide-react';

export interface ArchitectureInfo {
  page: string;
  frontend: {
    component: string;
    state?: string;
    apis: string[];
  };
  backend: {
    service: string;
    database: string[];
    features: string[];
  };
}

interface ArchitectureOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  info: ArchitectureInfo;
}

export const ArchitectureOverlay: React.FC<ArchitectureOverlayProps> = ({
  isOpen,
  onClose,
  info,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            🏗️ Architecture View
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Page Name */}
        <div className="text-sm text-gray-500">
          Page: <span className="font-semibold text-gray-900">{info.page}</span>
        </div>

        {/* Frontend Layer */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <h3 className="font-bold text-blue-900">FRONTEND LAYER</h3>
          </div>
          <div className="space-y-1 text-sm text-blue-800">
            <div>
              • React Component: <span className="font-mono">{info.frontend.component}</span>
            </div>
            {info.frontend.state && (
              <div>
                • State: <span className="font-mono">{info.frontend.state}</span>
              </div>
            )}
            {info.frontend.apis.map((api, idx) => (
              <div key={idx}>
                • API: <span className="font-mono">{api}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Backend Layer */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h3 className="font-bold text-green-900">BACKEND MODULE</h3>
          </div>
          <div className="space-y-1 text-sm text-green-800">
            <div>
              • Service: <span className="font-mono">{info.backend.service}</span>
            </div>
            {info.backend.database.map((db, idx) => (
              <div key={idx}>
                • Database: <span className="font-mono">{db}</span>
              </div>
            ))}
            {info.backend.features.map((feature, idx) => (
              <div key={idx}>
                • {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-500 pt-2 border-t">
          This overlay shows the technical architecture powering this page.
        </div>
      </div>
    </div>
  );
};
