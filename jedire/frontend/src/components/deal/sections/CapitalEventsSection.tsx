/**
 * Capital Events Section
 * Coming Soon: Refinancing tracker, 1031 exchange, disposition process
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface CapitalEventsSectionProps {
  dealId: string;
}

export const CapitalEventsSection: React.FC<CapitalEventsSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Capital Events & Disposition Planning             │
├────────────────────────────────────────────────────┤
│  🔄 Refinancing Tracker                            │
│  ┌────────────────────────────────────────────┐   │
│  │ Current: 5.25% | Maturity: 06/2027         │   │
│  │ Refi Target: 4.75% | Savings: $250K/yr    │   │
│  │ [Lender Quotes] [Compare Terms]            │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  🔁 1031 Exchange Manager                          │
│  Replacement Property Search | Deadline: 45 days  │
│  [Qualified Intermediary] [Timeline]              │
│                                                    │
│  💰 Disposition Process                            │
│  Sale Prep | Marketing | Offers | Due Diligence   │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Capital Events"
      description="Manage refinancing, recapitalizations, and property dispositions"
      status="coming-soon"
      icon="💼"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Refinancing Dashboard:</strong> Track loan maturity and refi opportunities</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Lender Comparison:</strong> Side-by-side quote analysis with NPV calculations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>1031 Exchange Tracker:</strong> Manage identification and closing deadlines</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Recapitalization Manager:</strong> Track equity raises and partner distributions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Sale Process Workflow:</strong> Step-by-step disposition checklist</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Marketing Analytics:</strong> Track buyer interest and campaign performance</span>
            </li>
          </ul>
        </div>
        
        <div className="flex items-center justify-center gap-3 pt-2">
          <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
            Request Early Access
          </button>
          <button className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            Learn More
          </button>
        </div>
      </div>
    </PlaceholderContent>
  );
};

export default CapitalEventsSection;
