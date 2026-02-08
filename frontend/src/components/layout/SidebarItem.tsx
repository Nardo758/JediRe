/**
 * Enhanced Sidebar Item with Layer Integration
 * Right-click and drag-and-drop to create map layers
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

interface SidebarItemProps {
  icon: string;
  label: string;
  count?: number;
  path?: string;
  isActive?: boolean;
  hasSubItems?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  // Layer integration props
  layerConfig?: {
    sourceType: string;
    layerType: string;
    defaultStyle: any;
  };
  onShowOnMap?: (config: any) => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  count,
  path,
  isActive,
  hasSubItems,
  isExpanded,
  onToggle,
  layerConfig,
  onShowOnMap
}) => {
  const navigate = useNavigate();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (hasSubItems && onToggle) {
      onToggle();
    } else if (path) {
      navigate(path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!layerConfig) return;
    
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleShowOnMap = () => {
    if (layerConfig && onShowOnMap) {
      onShowOnMap({
        name: label,
        source_type: layerConfig.sourceType,
        layer_type: layerConfig.layerType,
        style: layerConfig.defaultStyle,
        visible: true,
        opacity: 1.0
      });
    }
    setShowContextMenu(false);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!layerConfig) return;
    
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      name: label,
      source_type: layerConfig.sourceType,
      layer_type: layerConfig.layerType,
      style: layerConfig.defaultStyle
    }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Close context menu when clicking outside
  const handleClickOutside = () => {
    setShowContextMenu(false);
  };

  return (
    <>
      <div
        ref={itemRef}
        className={`group relative flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer transition-all ${
          isActive
            ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-50'
        } ${isDragging ? 'opacity-50' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable={!!layerConfig}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Icon */}
        <span className="text-xl">{icon}</span>

        {/* Label & Count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{label}</span>
            {count !== undefined && (
              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-medium">
                {count}
              </span>
            )}
          </div>
        </div>

        {/* Expand arrow (for subitems) */}
        {hasSubItems && (
          <ChevronRightIcon
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        )}

        {/* Layer indicator (shows on hover) */}
        {layerConfig && !isDragging && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MapIcon className="w-4 h-4 text-gray-400" />
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleClickOutside}
          />
          
          {/* Menu */}
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y
            }}
          >
            <button
              onClick={handleShowOnMap}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <MapIcon className="w-4 h-4" />
              <span className="font-medium">Show on Map</span>
            </button>
            
            <button
              onClick={() => setShowContextMenu(false)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FunnelIcon className="w-4 h-4" />
              <span>Filter...</span>
            </button>
            
            <button
              onClick={() => setShowContextMenu(false)}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default SidebarItem;
