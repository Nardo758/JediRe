import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { T as BT } from './bloomberg-tokens';
import { BT_CSS, PanelHeader } from './bloomberg-ui';

interface Tab {
  id: string;
  label: string;
  component: React.ComponentType<any>;
}

interface Metric {
  l: string;
  c: string;
}

interface DealScreenWrapperProps {
  passProps: any;
  moduleTitle: string;
  moduleSubtitle?: string;
  moduleBorderColor?: string;
  moduleMetrics?: Metric[];
  accentColor?: string;
  tabs: Tab[];
}

export const DealScreenWrapper: React.FC<DealScreenWrapperProps> = ({
  passProps,
  moduleTitle,
  moduleSubtitle,
  moduleBorderColor,
  moduleMetrics,
  accentColor = BT.cyanL,
  tabs,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const subTabParam = searchParams.get('subTab');
  const [activeTabId, setActiveTabId] = useState<string>(subTabParam || tabs[0]?.id || '');

  useEffect(() => {
    if (subTabParam && tabs.some(t => t.id === subTabParam)) {
      setActiveTabId(subTabParam);
    }
  }, [subTabParam]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const ActiveComponent = activeTab?.component;

  const handleTabClick = (id: string) => {
    setActiveTabId(id);
    const next = new URLSearchParams(searchParams);
    next.set('subTab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BT.bg.terminal }}>
      <style>{BT_CSS}</style>

      <PanelHeader
        title={moduleTitle}
        subtitle={moduleSubtitle}
        accent={moduleBorderColor || accentColor}
        right={moduleMetrics && (
          <div style={{ display: 'flex', gap: 12 }}>
            {moduleMetrics.map((m, i) => (
              <span key={i} style={{ fontSize: 9, fontWeight: 700, color: m.c, letterSpacing: 1, fontFamily: 'monospace' }}>
                {m.l}
              </span>
            ))}
          </div>
        )}
      />

      {tabs.length > 1 && (
        <div style={{
          display: 'flex',
          background: BT.bgPanel,
          borderBottom: `1px solid ${BT.border}`,
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                style={{
                  padding: '8px 16px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  color: isActive ? accentColor : BT.td,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {ActiveComponent && <ActiveComponent {...passProps} />}
      </div>
    </div>
  );
};

export default DealScreenWrapper;
