/**
 * Marketing & Leasing Section
 * Coming Soon: Campaign management, lead tracking, tour scheduling
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface MarketingLeasingSectionProps {
  dealId: string;
}

export const MarketingLeasingSection: React.FC<MarketingLeasingSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Marketing & Leasing Hub                           │
├────────────────────────────────────────────────────┤
│  📢 Active Campaigns                               │
│  ┌────────────────────────────────────────────┐   │
│  │ Spring Promo: 1 Month Free                 │   │
│  │ Budget: $5K | Spent: $3.2K | Leads: 42    │   │
│  │ Conv Rate: 18% | Cost/Lead: $76            │   │
│  │ [Edit] [Pause] [Analytics]                 │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  🎯 Lead Pipeline                                  │
│  New: 12 | Contacted: 8 | Tours: 5 | Apps: 2     │
│                                                    │
│  📅 Tour Schedule                                  │
│  Today: 3 tours | Tomorrow: 5 tours              │
│  [Calendar View] [Send Reminders]                 │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Marketing & Leasing"
      description="Campaign management, lead tracking, and tour scheduling"
      status="coming-soon"
      icon="📢"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-[#0F1319] rounded-lg p-4 border border-[#1e2a3d]">
          <h4 className="font-semibold text-[#E8E6E1] mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-[#9EA8B4]">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Campaign Manager:</strong> Track marketing spend and ROI across channels</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Lead Tracking:</strong> CRM-style pipeline from inquiry to lease signing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Tour Scheduling:</strong> Integrated calendar with automated reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Listing Syndication:</strong> Push to Apartments.com, Zillow, etc.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Email Templates:</strong> Pre-built sequences for follow-ups</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Analytics Dashboard:</strong> Conversion rates, cost per lease, channel performance</span>
            </li>
          </ul>
        </div>
        
        <div className="flex items-center justify-center gap-3 pt-2">
          <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
            Request Early Access
          </button>
          <button className="px-6 py-2 bg-[#0F1319] border border-[#253347] text-[#9EA8B4] rounded-lg hover:bg-[#0F1319] transition-colors font-medium">
            Learn More
          </button>
        </div>
      </div>
    </PlaceholderContent>
  );
};

export default MarketingLeasingSection;
