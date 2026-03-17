import React, { useState } from 'react';
import { T as BT, mono as bMono, sans as bSans } from './bloomberg-tokens';

export interface DealScreenTab {
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

interface DealScreenWrapperProps {
  tabs: DealScreenTab[];
  passProps?: Record<string, any>;
  initialTab?: string;
}

export const DealScreenWrapper: React.FC<DealScreenWrapperProps> = ({ tabs, passProps = {}, initialTab }) => {
  const [active, setActive] = useState(initialTab || tabs[0]?.id || '');

  if (tabs.length === 0) return null;

  if (tabs.length === 1) {
    const C = tabs[0].component;
    return <C {...passProps} />;
  }

  const activeTab = tabs.find(t => t.id === active) || tabs[0];
  const C = activeTab.component;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: BT.bgBase }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BT.border}`, background: BT.bgCard, flexShrink: 0, overflowX: 'auto' }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                whiteSpace: 'nowrap',
                color: isActive ? BT.tm : BT.td,
                background: isActive ? BT.bgPanel : 'none',
                border: 'none',
                borderBottom: isActive ? `2px solid ${BT.amber}` : '2px solid transparent',
                cursor: 'pointer',
                letterSpacing: 0.5,
                transition: 'all 0.15s',
                ...bSans,
              } as any}
            >
              {tab.label.toUpperCase()}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <C {...passProps} />
      </div>
    </div>
  );
};
