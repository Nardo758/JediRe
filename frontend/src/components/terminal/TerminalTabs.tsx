/**
 * TerminalTabs - Bloomberg-style numbered tab navigation
 * [0] OVERVIEW [1] TRAFFIC [2] FINANCIALS ...
 */

import React from 'react';
import { BT, TERMINAL_TABS, TabKey } from './theme';

interface TerminalTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  searchPlaceholder?: string;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  activeTab,
  onTabChange,
  searchPlaceholder = 'Type ticker to search',
}) => {
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
        {TERMINAL_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
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
                [{tab.num}]
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

// Keyboard navigation hook
export const useTabKeyboard = (
  activeTab: TabKey,
  onTabChange: (tab: TabKey) => void
) => {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 0 && num <= 7) {
        const tab = TERMINAL_TABS.find(t => t.num === num);
        if (tab) {
          onTabChange(tab.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onTabChange]);
};

export default TerminalTabs;
