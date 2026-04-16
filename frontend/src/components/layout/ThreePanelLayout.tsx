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
import { BT } from '@/components/deal/bloomberg-ui';

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
  renderMap?: () => ReactNode;

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
  const hasMap = !!renderMap;

  const [showViews, setShowViews] = useState(() => {
    if (!hasViewsPanel) return false;
    const saved = localStorage.getItem(`${storageKey}-show-views`);
    return saved ? JSON.parse(saved) : true;
  });

  const [showContent, setShowContent] = useState(() => {
    const visitedKey = `${storageKey}-content-visited`;
    const hasVisited = localStorage.getItem(visitedKey);
    if (!hasVisited) {
      localStorage.setItem(visitedKey, 'true');
      return true;
    }
    const saved = localStorage.getItem(`${storageKey}-show-content`);
    return saved ? JSON.parse(saved) : true;
  });

  const [showMap, setShowMap] = useState(() => {
    if (!hasMap) return false;
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
      setShowContent(true);
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
    <div className="h-full flex flex-col overflow-hidden">
      <HorizontalBar onNewMap={onNewMap} />
      <div className="flex-1 flex relative min-h-0 min-w-0 overflow-hidden">
      {/* Panel 1: Views Sidebar */}
      {hasViewsPanel && showViews && views && onViewChange && activeView && (
        <aside
          className="w-20 flex-shrink-0 overflow-y-auto"
          style={{ background: BT.bg.panel, borderRight: `1px solid ${BT.border.subtle}` }}
        >
          <div className="p-2">
            <nav className="space-y-1">
              {views.map((view) => (
                <button
                  key={view.id}
                  onClick={() => onViewChange(view.id)}
                  className="w-full flex flex-col items-center gap-1 px-2 py-3 transition-colors text-xs"
                  style={{
                    borderRadius: 2,
                    background: activeView === view.id ? BT.bg.active : 'transparent',
                    color: activeView === view.id ? BT.text.cyan : BT.text.secondary,
                    fontWeight: activeView === view.id ? 600 : 400,
                    fontFamily: BT.font.label,
                  }}
                  title={view.label}
                >
                  <span className="text-xl">{view.icon}</span>
                  <span className="text-center leading-tight">{view.label}</span>
                  {view.count !== undefined && (
                    <span
                      className="px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        background: BT.bg.hover,
                        color: BT.text.secondary,
                        borderRadius: 2,
                      }}
                    >
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
            className={`overflow-y-auto overflow-x-hidden min-w-0 ${
              isContentMaximized || !showMap ? 'flex-1' : 'flex-shrink-0'
            }`}
            style={{
              background: BT.bg.panelAlt,
              borderRight: `1px solid ${BT.border.subtle}`,
              ...((!isContentMaximized && showMap) ? { width: `${contentWidth}px` } : {}),
            }}
          >
            <div className="flex items-center justify-end px-4 pt-2 pb-0">
              <button
                onClick={toggleMaximizeContent}
                className="p-1.5 text-xs transition-colors"
                style={{
                  borderRadius: 2,
                  background: isContentMaximized ? BT.bg.active : 'transparent',
                  color: isContentMaximized ? BT.text.cyan : BT.text.muted,
                }}
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
              className="w-1 cursor-col-resize flex-shrink-0 transition-colors"
              style={{ background: BT.border.medium }}
              onMouseDown={() => setIsResizing(true)}
              title="Drag to resize"
            />
          )}
        </>
      )}

      {/* Panel 3: Map */}
      {showMap && hasMap && (
        <div className="flex-1 min-w-0 relative">
          {renderMap!()}
        </div>
      )}

      {/* Toggle Controls (Top-Right) */}
      <div className="absolute top-3 right-3 flex gap-2 z-20">
        {hasViewsPanel && (
          <button
            onClick={() => setShowViews(!showViews)}
            className="px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              borderRadius: 0,
              background: showViews ? BT.bg.active : BT.bg.panel,
              color: showViews ? BT.text.cyan : BT.text.secondary,
              border: `1px solid ${showViews ? BT.border.bright : BT.border.subtle}`,
              fontFamily: BT.font.mono,
            }}
            title={showViews ? 'Hide views panel' : 'Show views panel'}
          >
            {showViews ? '◀ Views' : '▶ Views'}
          </button>
        )}

        <button
          onClick={() => setShowContent(!showContent)}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderRadius: 0,
            background: showContent ? BT.bg.active : BT.bg.panel,
            color: showContent ? BT.text.cyan : BT.text.secondary,
            border: `1px solid ${showContent ? BT.border.bright : BT.border.subtle}`,
            fontFamily: BT.font.mono,
          }}
          title={showContent ? 'Hide content panel' : 'Show content panel'}
        >
          {showContent ? '◀ Content' : '▶ Content'}
        </button>

        {hasMap && (
        <button
          onClick={() => {
            if (!showMap) {
              setIsContentMaximized(false);
            }
            setShowMap(!showMap);
          }}
          className="px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderRadius: 0,
            background: showMap ? BT.bg.active : BT.bg.panel,
            color: showMap ? BT.text.cyan : BT.text.secondary,
            border: `1px solid ${showMap ? BT.border.bright : BT.border.subtle}`,
            fontFamily: BT.font.mono,
          }}
          title={showMap ? 'Hide map panel' : 'Show map panel'}
        >
          {showMap ? 'Map ▶' : '◀ Map'}
        </button>
        )}
      </div>
      </div>
    </div>
  );
};

export default ThreePanelLayout;
