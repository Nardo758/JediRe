import React, { useState, useEffect } from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  component: React.ComponentType<any>;
  moduleId?: string;
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
    <div className={`mb-1 ${className}`} style={{ fontFamily: BT.font.mono }}>
      <button
        onClick={toggleExpanded}
        className="w-full px-3 py-2.5 text-left flex items-center transition-colors"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: hasActiveTab ? BT.text.primary : BT.text.secondary,
          background: hasActiveTab ? BT.bg.active : 'transparent',
          borderRadius: 0,
          cursor: alwaysExpanded ? 'default' : 'pointer',
          paddingLeft: alwaysExpanded ? 8 : 12,
        }}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 w-full">
          {!alwaysExpanded && (
            <span className="flex items-center" style={{ color: BT.text.muted }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="flex items-center text-lg">{icon}</span>
          <span className="flex-1">{title}</span>
          {tabs.length > 1 && (
            <span style={{ fontSize: 9, color: BT.text.muted, fontWeight: 500 }}>({tabs.length})</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="pl-3 mt-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="w-full px-3 py-2 text-left flex items-center gap-2 mb-0.5 transition-colors"
              style={{
                fontSize: 10,
                borderRadius: 0,
                color: activeTab === tab.id ? BT.bg.terminal : BT.text.secondary,
                background: activeTab === tab.id ? BT.text.cyan : 'transparent',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
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
