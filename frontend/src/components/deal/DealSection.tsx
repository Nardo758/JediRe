/**
 * DealSection Component
 * Collapsible section with icon, title, status badge, and smooth animations
 */

import React, { useState, useEffect } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
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
    <div className="overflow-hidden transition-all duration-200" style={{ background: BT.bg.panel, border: `1px solid ${BT.border.subtle}`, borderRadius: 0, fontFamily: BT.font.mono }}>
      {/* Header - Always visible, clickable */}
      <button
        onClick={toggleExpanded}
        className="w-full px-6 py-4 flex items-center justify-between transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = BT.bg.hover)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="text-2xl">{icon}</div>

          {/* Title */}
          <h2 style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary, fontFamily: BT.font.display }}>{title}</h2>

          {/* Badges */}
          <div className="flex items-center gap-2">
            {isPremium && (
              <span style={{ padding: '2px 6px', background: `${BT.text.amber}22`, color: BT.text.amber, fontSize: 9, fontWeight: 700, borderRadius: 2, letterSpacing: 0.5 }}>
                ✨ PREMIUM
              </span>
            )}
            {comingSoon && (
              <span style={{ padding: '2px 6px', background: `${BT.text.amber}22`, color: BT.text.amber, fontSize: 9, fontWeight: 700, borderRadius: 2, letterSpacing: 0.5 }}>
                🚀 COMING SOON
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} style={{ color: BT.text.secondary }}>
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
        <div className="px-6 py-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default DealSection;
