// TabGroup Component
// Created: 2026-02-20
// Purpose: Collapsible navigation group for deal tabs

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

  // Persist expansion state in localStorage
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

  // Auto-expand if active tab is in this group
  useEffect(() => {
    if (!alwaysExpanded && tabs.some(tab => tab.id === activeTab)) {
      setIsExpanded(true);
    }
  }, [activeTab, tabs, alwaysExpanded]);

  const hasActiveTab = tabs.some(tab => tab.id === activeTab);

  return (
    <div className={`tab-group ${className}`}>
      <button
        onClick={toggleExpanded}
        className={`tab-group-header ${hasActiveTab ? 'has-active' : ''} ${alwaysExpanded ? 'always-expanded' : ''}`}
        aria-expanded={isExpanded}
      >
        <div className="tab-group-header-content">
          {!alwaysExpanded && (
            <span className="expand-icon">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="tab-group-icon">{icon}</span>
          <span className="tab-group-title">{title}</span>
          {tabs.length > 1 && (
            <span className="tab-count">({tabs.length})</span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="tab-group-items">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.icon && <span className="tab-item-icon">{tab.icon}</span>}
              <span className="tab-item-label">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .tab-group {
          margin-bottom: 4px;
        }

        .tab-group-header {
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          display: flex;
          align-items: center;
        }

        .tab-group-header:hover {
          background: #f1f5f9;
          color: #334155;
        }

        .tab-group-header.has-active {
          color: #0f172a;
          background: #f1f5f9;
        }

        .tab-group-header.always-expanded {
          cursor: default;
          padding-left: 8px;
        }

        .tab-group-header-content {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .expand-icon {
          display: flex;
          align-items: center;
          color: #94a3b8;
        }

        .tab-group-icon {
          display: flex;
          align-items: center;
          font-size: 18px;
        }

        .tab-group-title {
          flex: 1;
        }

        .tab-count {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 500;
        }

        .tab-group-items {
          padding-left: 12px;
          margin-top: 2px;
        }

        .tab-item {
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-size: 14px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .tab-item:hover {
          background: #f8fafc;
          color: #334155;
        }

        .tab-item.active {
          background: #3b82f6;
          color: white;
          font-weight: 500;
        }

        .tab-item.active:hover {
          background: #2563eb;
        }

        .tab-item-icon {
          display: flex;
          align-items: center;
          font-size: 16px;
        }

        .tab-item-label {
          flex: 1;
        }
      `}</style>
    </div>
  );
};

export default TabGroup;
