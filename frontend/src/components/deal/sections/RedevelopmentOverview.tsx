import React from 'react';
import OverviewSection from './OverviewSection';

export const RedevelopmentOverview: React.FC<any> = (props) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500 text-sm font-mono">Redevelopment Overview — coming soon</p>
        <p className="text-slate-400 text-xs mt-2">This deal is flagged as a redevelopment project. The 9-section redevelopment overview is being built.</p>
      </div>
      <OverviewSection {...props} />
    </div>
  );
};

export default RedevelopmentOverview;
