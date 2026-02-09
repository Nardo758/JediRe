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

import React, { useState, useEffect, useRef, ReactNode } from 'react';
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
  
  /** Optional: Callback for creating a new map */
  onNewMap?: () => void;
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
  maxContentWidth = 1400,
  onNewMap,
}) => {
  const hasViewsPanel = showViewsPanel && views && views.length > 0;
  
  const [showViews, setShowViews] = useState(() => {
    if (!hasViewsPanel) return false;
    const saved = localStorage.getItem(`${storageKey}-show-views`);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [showContent, setShowContent] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-show-content`);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [showMap, setShowMap] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-show-map`);
    return saved ? JSON.parse(saved) : true;
  });
  
  const [contentWidth, setContentWidth] = useState(() => {
    const saved = localStorage.getItem(`${storageKey}-content-width`);
    return saved ? parseInt(saved) : defaultContentWidth;
  });
  
  const [isContentMaximized, setIsContentMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Save panel states to localStorage
  useEffect(() => {
    localStorage.setItem(`${storageKey}-content-width`, contentWidth.toString());
    localStorage.setItem(`${storageKey}-show-views`, JSON.stringify(showViews));
    localStorage.setItem(`${storageKey}-show-content`, JSON.stringify(showContent));
    localStorage.setItem(`${storageKey}-show-map`, JSON.stringify(showMap));
  }, [contentWidth, showViews, showContent, showMap, storageKey]);
  
  useEffect(() => {
    if (!showContent && !showMap) {
      setShowMap(true);
    }
  }, [showContent, showMap]);

  const toggleMaximizeContent = () => {
    if (isContentMaximized) {
      setIsContentMaximized(false);
      setShowMap(true);
    } else {
      setIsContentMaximized(true);
      setShowMap(false);
    }
  };

  // Handle resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const contentLeft = contentRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = Math.max(
        minContentWidth,
        Math.min(maxContentWidth, e.clientX - contentLeft)
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
  }, [isResizing, minContentWidth, maxContentWidth]);

  return (
    <div className="h-full flex flex-col">
      <HorizontalBar onNewMap={onNewMap} />
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
            ref={contentRef}
            className={`bg-gray-50 overflow-y-auto border-r border-gray-200 ${
              isContentMaximized || !showMap ? 'flex-1' : 'flex-shrink-0'
            }`}
            style={!isContentMaximized && showMap ? { width: `${contentWidth}px` } : undefined}
          >
            <div className="flex items-center justify-end px-4 pt-2 pb-0">
              <button
                onClick={toggleMaximizeContent}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  isContentMaximized
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                }`}
                title={isContentMaximized ? 'Restore content panel' : 'Maximize content panel'}
              >
                {isContentMaximized ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="4" y="4" width="9" height="9" rx="1" />
                    <path d="M4 10H2a1 1 0 01-1-1V2a1 1 0 011-1h7a1 1 0 011 1v2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="1" width="12" height="12" rx="1" />
                  </svg>
                )}
              </button>
            </div>
            <div className="p-4 pt-1">
              {renderContent(activeView)}
            </div>
          </div>

          {/* Resize Handle */}
          {showMap && !isContentMaximized && (
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
          onClick={() => {
            if (!showMap) {
              setIsContentMaximized(false);
            }
            setShowMap(!showMap);
          }}
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
