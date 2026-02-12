/**
 * Context Tracker Tabs Navigation
 * Tab navigation for the 7 context tracker views
 */

import React from 'react';
import { ContextTrackerTab } from '../../types/deal-enhanced.types';

interface ContextTrackerTabsProps {
  tabs: ContextTrackerTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const ContextTrackerTabs: React.FC<ContextTrackerTabsProps> = ({
  tabs,
  activeTab,
  onTabChange
}) => {
  return (
    <div className="border-b border-gray-200">
      <div className="flex overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContextTrackerTabs;
