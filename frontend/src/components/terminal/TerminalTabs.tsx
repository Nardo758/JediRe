/**
 * TerminalTabs - Bloomberg-style numbered tab navigation
 * [0] OVERVIEW [1] TRAFFIC [2] FINANCIALS ...
 */

import React from 'react';
import { BT, TERMINAL_TABS, TabKey } from './theme';

// Generic tab definition for custom tab sets
export interface TabDef {
  key: string;
  label: string;
  num?: number;
  shortcut?: string;
  desc?: string;
}

interface TerminalTabsProps<T extends string = TabKey> {
  activeTab: T;
  onTabChange: (tab: T) => void;
  tabs?: TabDef[];
  searchPlaceholder?: string;
}

export const TerminalTabs = <T extends string = TabKey>({
  activeTab,
  onTabChange,
  tabs,
  searchPlaceholder = 'Type ticker to search',
}: TerminalTabsProps<T>) => {
  // Use custom tabs or default TERMINAL_TABS
  const tabList: TabDef[] = tabs || TERMINAL_TABS.map((t, i) => ({ ...t, num: t.num ?? i }));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: 40,
      background: BT.bg.terminal,
      borderBottom: `1px solid ${BT.border.subtle}`,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {tabList.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          const tabNum = tab.num ?? tab.shortcut ?? idx;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key as T)}
              title={tab.desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                background: isActive ? BT.bg.active : 'transparent',
                border: isActive ? `1px solid ${BT.border.highlight}` : '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = BT.bg.hover;
                  e.currentTarget.style.borderColor = BT.border.medium;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: isActive ? BT.text.amber : BT.text.dim,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                [{tabNum}]
              </span>
              <span style={{
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? BT.text.primary : BT.text.muted,
                letterSpacing: '0.02em',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search hint */}
      <div style={{
        fontSize: 10,
        color: BT.text.dim,
        fontStyle: 'italic',
      }}>
        Press 0-7 to navigate • {searchPlaceholder}
      </div>
    </div>
  );
};

// Keyboard navigation hook - works with any tab set
export const useTabKeyboard = <T extends string>(
  activeTab: T,
  onTabChange: (tab: T) => void,
  tabs?: TabDef[]
) => {
  React.useEffect(() => {
    const tabList = tabs || TERMINAL_TABS;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 0 && num <= 9) {
        const tab = tabList.find((t, i) => (t.num ?? t.shortcut ?? i) === num.toString() || (t.num ?? i) === num);
        if (tab) {
          onTabChange(tab.key as T);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onTabChange, tabs]);
};

export default TerminalTabs;
