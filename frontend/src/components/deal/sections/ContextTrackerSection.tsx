import React, { useState } from 'react';
import { CONTEXT_TRACKER_TABS } from '../../../types/deal-enhanced.types';
import { ContextTrackerTabs } from '../../context-tracker/ContextTrackerTabs';
import { NotesSection } from './NotesSection';

interface ContextTrackerSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const ContextTrackerSection: React.FC<ContextTrackerSectionProps> = ({ deal, dealId }) => {
  const [activeTab, setActiveTab] = useState(CONTEXT_TRACKER_TABS[0].id);

  return (
    <div className="space-y-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-300 mb-2">
          Deal Context Tracker
        </h3>
        <p className="text-sm text-blue-400/80">
          A unified view of all deal context across multiple dimensions - notes, activity, contacts, documents, financials, dates, decisions, and risks.
        </p>
      </div>

      <ContextTrackerTabs
        tabs={CONTEXT_TRACKER_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="min-h-[400px]">
        {activeTab === 'notes' ? (
          <NotesSection deal={deal} />
        ) : (
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-6">
            <div className="text-center py-12">
              <div className="text-5xl mb-4">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.name}
              </h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.description}
              </p>
              <div className="inline-block px-4 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-sm">
                Coming Soon
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextTrackerSection;
