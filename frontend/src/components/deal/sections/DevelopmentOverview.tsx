import React from 'react';
import OverviewSection from './OverviewSection';

export const DevelopmentOverview: React.FC<any> = (props) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-500 text-sm font-mono">Ground-Up Development Overview — coming soon</p>
        <p className="text-slate-400 text-xs mt-2">This deal is flagged as a development project. The 7-section development overview is being built.</p>
      </div>
      <OverviewSection {...props} />
    </div>
  );
};

export default DevelopmentOverview;
