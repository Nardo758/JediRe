/**
 * Deal Context Tracker Section - Deal Page
 * Multi-dimensional view of deal context with 8 tabs (Notes first)
 */

import React, { useState } from 'react';
import { CONTEXT_TRACKER_TABS } from '../../../types/deal-enhanced.types';
import { ContextTrackerTabs } from '../../context-tracker/ContextTrackerTabs';
import { NotesSection } from './NotesSection';

interface ContextTrackerSectionProps {
  deal: any;
}

export const ContextTrackerSection: React.FC<ContextTrackerSectionProps> = ({ deal }) => {
  const [activeTab, setActiveTab] = useState(CONTEXT_TRACKER_TABS[0].id);

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🧭 Deal Context Tracker
        </h3>
        <p className="text-sm text-blue-700">
          A unified view of all deal context across multiple dimensions - notes, activity, contacts, documents, financials, dates, decisions, and risks.
        </p>
      </div>

      {/* Tabs Navigation */}
      <ContextTrackerTabs
        tabs={CONTEXT_TRACKER_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Render Notes Section when notes tab is active */}
        {activeTab === 'notes' ? (
          <NotesSection deal={deal} />
        ) : (
          /* Placeholder for other tabs */
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.icon}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.name}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {CONTEXT_TRACKER_TABS.find(t => t.id === activeTab)?.description}
              </p>
              <div className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg">
                🚧 To Be Built
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextTrackerSection;
