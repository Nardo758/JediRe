import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  component: React.ComponentType<any>;
}

export interface TabGroupProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  defaultExpanded?: boolean;
  alwaysExpanded?: boolean;
  className?: string;
}

export const TabGroup: React.FC<TabGroupProps> = ({
  id,
  title,
  icon,
  tabs,
  activeTab,
  onTabChange,
  defaultExpanded = false,
  alwaysExpanded = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || alwaysExpanded);

  useEffect(() => {
    const stored = localStorage.getItem(`tabgroup-${id}-expanded`);
    if (stored !== null && !alwaysExpanded) {
      setIsExpanded(stored === 'true');
    }
  }, [id, alwaysExpanded]);

  const toggleExpanded = () => {
    if (alwaysExpanded) return;
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    localStorage.setItem(`tabgroup-${id}-expanded`, String(newExpanded));
  };

  useEffect(() => {
    if (!alwaysExpanded && tabs.some(tab => tab.id === activeTab)) {
      setIsExpanded(true);
    }
  }, [activeTab, tabs, alwaysExpanded]);

  const hasActiveTab = tabs.some(tab => tab.id === activeTab);

  return (
    <div className={`mb-1 ${className}`}>
      <button
        onClick={toggleExpanded}
        className={`w-full px-3 py-2.5 rounded-lg text-left text-sm font-semibold flex items-center transition-colors ${
          alwaysExpanded ? 'cursor-default pl-2' : 'cursor-pointer'
        } ${
          hasActiveTab
            ? 'text-slate-900 bg-slate-100'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
        }`}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 w-full">
          {!alwaysExpanded && (
            <span className="flex items-center text-slate-400">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="flex items-center text-lg">{icon}</span>
          <span className="flex-1">{title}</span>
          {tabs.length > 1 && (
            <span className="text-xs text-slate-400 font-medium">({tabs.length})</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="pl-3 mt-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2 mb-0.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white font-medium hover:bg-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon && <span className="flex items-center">{tab.icon}</span>}
              <span className="flex-1">{tab.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TabGroup;
