/**
 * ThreePanelLayout - Reusable 3-panel split-view layout
 * 
 * Standard pattern for all data pages:
 * - Panel 1 (Views): Navigation sidebar (64-80px)
 * - Panel 2 (Content): Main content area (400-800px, resizable)
 * - Panel 3 (Map): Always-visible map (flex-1)
 * 
 * Features:
 * - Toggle panels on/off
 * - Resize Panel 2 with drag handle
 * - Persist widths to localStorage
 * - Responsive controls
 */

import React, { useState, useEffect, ReactNode } from 'react';
import { HorizontalBar } from '../map/HorizontalBar';

export interface ViewItem {
  id: string;
  label: string;
  icon: string;
  count?: number;
}

export interface ThreePanelLayoutProps {
  /** Unique key for localStorage (e.g., 'email', 'pipeline', 'news') */
  storageKey: string;
  
  /** View items for Panel 1 sidebar */
  views?: ViewItem[];
  
  /** Currently active view ID */
  activeView?: string;
  
  /** Callback when view changes */
  onViewChange?: (viewId: string) => void;
  
  /** Content to render in Panel 2 */
  renderContent: (viewId?: string) => ReactNode;
  
  /** Map container for Panel 3 */
  renderMap: () => ReactNode;
  
  /** Optional: Show views panel (default: true if views provided) */
  showViewsPanel?: boolean;
  
  /** Optional: Initial panel widths */
  defaultContentWidth?: number;
  minContentWidth?: number;
  maxContentWidth?: number;
}

export const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({
  storageKey,
  views,
  activeView,
  onViewChange,
  renderContent,
  renderMap,
  showViewsPanel = true,
  defaultContentWidth = 550,
  minContentWidth = 400,
  maxContentWidth = 800,
}) => {
  const hasViewsPanel = showViewsPanel && views && views.length > 0;
  const [showViews, setShowViews] = useState(hasViewsPanel);
  const [showContent, setShowContent] = useState(true);
  const [showMap, setShowMap] = useState(true);
  
  const [contentWidth, setContentWidth] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-content-width`);
    return saved ? parseInt(saved) : defaultContentWidth;
  });
  
  const [isResizing, setIsResizing] = useState(false);

  // Save content width to localStorage
  useEffect(() => {
    localStorage.setItem(`${storageKey}-content-width`, contentWidth.toString());
  }, [contentWidth, storageKey]);

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate new width based on mouse position
      // Account for views panel width if visible
      const viewsWidth = showViews ? 80 : 0;
      const newWidth = Math.max(
        minContentWidth,
        Math.min(maxContentWidth, e.clientX - viewsWidth)
      );
      setContentWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, showViews, minContentWidth, maxContentWidth]);

  return (
    <div className="h-full flex flex-col">
      <HorizontalBar />
      <div className="flex-1 flex relative min-h-0">
      {/* Panel 1: Views Sidebar */}
      {hasViewsPanel && showViews && views && onViewChange && activeView && (
        <aside className="w-20 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="p-2">
            <nav className="space-y-1">
              {views.map((view) => (
                <button
                  key={view.id}
                  onClick={() => onViewChange(view.id)}
                  className={`w-full flex flex-col items-center gap-1 px-2 py-3 rounded-lg transition-colors text-xs ${
                    activeView === view.id
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  title={view.label}
                >
                  <span className="text-xl">{view.icon}</span>
                  <span className="text-center leading-tight">{view.label}</span>
                  {view.count !== undefined && (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-gray-200 text-gray-700 rounded-full">
                      {view.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Panel 2: Content Panel */}
      {showContent && (
        <>
          <div
            className="bg-gray-50 overflow-y-auto flex-shrink-0 border-r border-gray-200"
            style={{ width: showMap ? `${contentWidth}px` : '100%' }}
          >
            <div className="p-4">
              {renderContent(activeView)}
            </div>
          </div>

          {/* Resize Handle */}
          {showMap && (
            <div
              className="w-1 bg-gray-200 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors"
              onMouseDown={() => setIsResizing(true)}
              title="Drag to resize"
            />
          )}
        </>
      )}

      {/* Panel 3: Map */}
      {showMap && (
        <div className="flex-1 relative">
          {renderMap()}
        </div>
      )}

      {/* Toggle Controls (Top-Right) */}
      <div className="absolute top-3 right-3 flex gap-2 z-20">
        {hasViewsPanel && (
          <button
            onClick={() => setShowViews(!showViews)}
            className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition-colors ${
              showViews
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
            title={showViews ? 'Hide views panel' : 'Show views panel'}
          >
            {showViews ? '◀ Views' : '▶ Views'}
          </button>
        )}
        
        <button
          onClick={() => setShowContent(!showContent)}
          className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition-colors ${
            showContent
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
          title={showContent ? 'Hide content panel' : 'Show content panel'}
        >
          {showContent ? '◀ Content' : '▶ Content'}
        </button>
        
        <button
          onClick={() => setShowMap(!showMap)}
          className={`px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition-colors ${
            showMap
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
          title={showMap ? 'Hide map panel' : 'Show map panel'}
        >
          {showMap ? 'Map ▶' : '◀ Map'}
        </button>
      </div>
      </div>
    </div>
  );
};

export default ThreePanelLayout;
