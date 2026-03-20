/**
 * Layer Control Component
 * Toggle map layers on/off
 */

import { useState } from 'react';
import { 
  Mail, Newspaper, Users, DollarSign, Building, 
  BarChart3, Pencil, Bot, Check, X 
} from 'lucide-react';

export interface Layer {
  id: string;
  name: string;
  icon: React.ReactNode;
  isVisible: boolean;
  description: string;
  color: string;
}

interface LayerControlProps {
  layers: Layer[];
  onLayerToggle: (layerId: string) => void;
  onLayerSettings?: (layerId: string) => void;
}

export default function LayerControl({ 
  layers, 
  onLayerToggle,
  onLayerSettings 
}: LayerControlProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900 text-sm">Map Layers</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isExpanded ? (
            <X className="w-4 h-4" />
          ) : (
            <BarChart3 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Layer List */}
      {isExpanded && (
        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                layer.isVisible ? 'bg-blue-50' : ''
              }`}
            >
              {/* Toggle Checkbox */}
              <button
                onClick={() => onLayerToggle(layer.id)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  layer.isVisible
                    ? `${layer.color} border-transparent`
                    : 'bg-white border-gray-300 hover:border-gray-400'
                }`}
              >
                {layer.isVisible && <Check className="w-3 h-3 text-white" />}
              </button>

              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  layer.isVisible ? layer.color : 'bg-gray-100'
                }`}
              >
                <div className={layer.isVisible ? 'text-white' : 'text-gray-500'}>
                  {layer.icon}
                </div>
              </div>

              {/* Label & Description */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  layer.isVisible ? 'text-gray-900' : 'text-gray-600'
                }`}>
                  {layer.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {layer.description}
                </p>
              </div>

              {/* Settings (optional) */}
              {onLayerSettings && (
                <button
                  onClick={() => onLayerSettings(layer.id)}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Layer settings"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {isExpanded && (
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => layers.forEach(layer => !layer.isVisible && onLayerToggle(layer.id))}
            className="flex-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Show All
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button
            onClick={() => layers.forEach(layer => layer.isVisible && onLayerToggle(layer.id))}
            className="flex-1 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Hide All
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Default layer configuration
 */
export const DEFAULT_LAYERS: Layer[] = [
  {
    id: 'emails',
    name: 'Emails',
    icon: <Mail className="w-4 h-4" />,
    isVisible: true,
    description: 'Property-related emails',
    color: 'bg-blue-600',
  },
  {
    id: 'news',
    name: 'News',
    icon: <Newspaper className="w-4 h-4" />,
    isVisible: false,
    description: 'Market news articles',
    color: 'bg-purple-600',
  },
  {
    id: 'consultants',
    name: 'Consultants',
    icon: <Users className="w-4 h-4" />,
    isVisible: false,
    description: 'Professional network',
    color: 'bg-yellow-600',
  },
  {
    id: 'financials',
    name: 'Financials',
    icon: <DollarSign className="w-4 h-4" />,
    isVisible: false,
    description: 'Deal metrics & ROI',
    color: 'bg-green-600',
  },
  {
    id: 'zoning',
    name: 'Zoning',
    icon: <Building className="w-4 h-4" />,
    isVisible: false,
    description: '3D buildable envelopes',
    color: 'bg-emerald-600',
  },
  {
    id: 'pipeline',
    name: 'Pipeline',
    icon: <BarChart3 className="w-4 h-4" />,
    isVisible: true,
    description: 'Deal flow stages',
    color: 'bg-indigo-600',
  },
  {
    id: 'draw',
    name: 'Drawing',
    icon: <Pencil className="w-4 h-4" />,
    isVisible: false,
    description: 'Annotations & notes',
    color: 'bg-pink-600',
  },
  {
    id: 'ai',
    name: 'AI Agents',
    icon: <Bot className="w-4 h-4" />,
    isVisible: false,
    description: 'Agent activity feed',
    color: 'bg-orange-600',
  },
];
