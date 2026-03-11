/**
 * DealSection Component
 * Collapsible section with icon, title, status badge, and smooth animations
 */

import React, { useState, useEffect } from 'react';
import { DealSectionProps } from '../../types/deal-enhanced.types';

export const DealSection: React.FC<DealSectionProps> = ({
  id,
  icon,
  title,
  defaultExpanded = false,
  isPremium = false,
  comingSoon = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`deal-section-${id}`);
    if (savedState !== null) {
      setIsExpanded(savedState === 'true');
    }
  }, [id]);

  // Save state to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`deal-section-${id}`, String(newState));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* Header - Always visible, clickable */}
      <button
        onClick={toggleExpanded}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="text-2xl">{icon}</div>
          
          {/* Title */}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          
          {/* Badges */}
          <div className="flex items-center gap-2">
            {isPremium && (
              <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium rounded-full">
                ✨ Premium
              </span>
            )}
            {comingSoon && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                🚀 Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content - Collapsible with smooth animation */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={{ overflow: isExpanded ? 'visible' : 'hidden' }}
      >
        <div className="px-6 py-4 border-t border-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
};

export default DealSection;
