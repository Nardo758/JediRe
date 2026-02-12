/**
 * SectionCard - Expandable/collapsible accordion section for Deal Page
 * 
 * Features:
 * - Expandable/collapsible with smooth animation
 * - Icon, title, and expand/collapse arrow
 * - LocalStorage persistence (remembers collapsed state per section)
 * - Mobile-friendly
 * - Empty state support
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';

export interface SectionCardProps {
  /** Unique identifier for localStorage */
  id: string;
  
  /** Section icon (emoji or unicode character) */
  icon: string;
  
  /** Section title */
  title: string;
  
  /** Section content */
  children: ReactNode;
  
  /** Optional: Start expanded (default: false) */
  defaultExpanded?: boolean;
  
  /** Optional: Deal ID for unique localStorage keys */
  dealId?: string;
  
  /** Optional: Show empty state when no children */
  showEmptyState?: boolean;
  
  /** Optional: Custom empty state message */
  emptyStateMessage?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  id,
  icon,
  title,
  children,
  defaultExpanded = false,
  dealId,
  showEmptyState = true,
  emptyStateMessage = 'No data yet',
}) => {
  const storageKey = dealId ? `deal-${dealId}-section-${id}` : `deal-section-${id}`;
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : defaultExpanded;
  });
  
  const [contentHeight, setContentHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isExpanded));
  }, [isExpanded, storageKey]);

  // Update content height when expanded or content changes
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isExpanded, children]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const isEmpty = !children || (React.Children.count(children) === 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        aria-expanded={isExpanded}
        aria-controls={`section-${id}-content`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-hidden="true">
            {icon}
          </span>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        
        {/* Expand/Collapse Arrow */}
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      <div
        id={`section-${id}-content`}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div ref={contentRef} className="px-6 pb-6">
          {isEmpty && showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3 opacity-30">📭</div>
              <p className="text-sm text-gray-500">{emptyStateMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

export default SectionCard;
