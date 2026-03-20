/**
 * Vendor Management Section
 * Coming Soon: Contractor database, bid comparison, performance tracking
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface VendorManagementSectionProps {
  dealId: string;
}

export const VendorManagementSection: React.FC<VendorManagementSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Vendor & Contractor Management                    │
├────────────────────────────────────────────────────┤
│  👷 Contractor Database                            │
│  ┌────────────────────────────────────────────┐   │
│  │ ABC Plumbing - ⭐⭐⭐⭐⭐ (4.8/5.0)        │   │
│  │ Licensed | Insured | 12 projects          │   │
│  │ Avg Response: 2 hours | On-time: 95%      │   │
│  │ [Contact] [History] [Add to RFP]          │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  💰 Bid Comparison                                 │
│  HVAC Replacement: 3 bids received                │
│  Low: $45K | Mid: $52K | High: $58K              │
│                                                    │
│  📊 Performance Scorecard                          │
│  Quality: A | Cost: B+ | Timeliness: A-          │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Vendor Management"
      description="Contractor database, bid comparison, and performance tracking"
      status="coming-soon"
      icon="👷"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Contractor Database:</strong> Centralized vendor directory with licenses and insurance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Bid Comparison Tool:</strong> Side-by-side quote analysis with scope breakdown</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Performance Tracking:</strong> Rate vendors on quality, cost, and timeliness</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>RFP Generator:</strong> Create and send RFPs with automated follow-up</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Compliance Tracker:</strong> Monitor license renewals and insurance expirations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Preferred Vendor Lists:</strong> Tag favorites for quick selection</span>
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

export default VendorManagementSection;
