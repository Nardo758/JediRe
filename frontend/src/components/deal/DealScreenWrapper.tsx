import React, { useState } from 'react';

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
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-0 border-b border-slate-200 bg-white flex-shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              active === tab.id
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <C {...passProps} />
      </div>
    </div>
  );
};
