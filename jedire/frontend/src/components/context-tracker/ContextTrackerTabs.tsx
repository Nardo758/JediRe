import React from 'react';

interface TabItem {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface ContextTrackerTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const ContextTrackerTabs: React.FC<ContextTrackerTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex flex-wrap gap-1 bg-slate-800/40 rounded-lg p-1 border border-slate-700/50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          <span>{tab.icon}</span>
          <span>{tab.name}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextTrackerTabs;
