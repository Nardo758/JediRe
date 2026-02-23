/**
 * Risk Management Section
 * Coming Soon: Insurance tracker, claims management, risk heat map
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface RiskManagementSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const RiskManagementSection: React.FC<RiskManagementSectionProps> = ({ deal, dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Risk Management & Insurance Center                │
├────────────────────────────────────────────────────┤
│  🛡️ Insurance Portfolio                            │
│  ┌────────────────────────────────────────────┐   │
│  │ Property: $5M coverage | Renewal: 08/2024  │   │
│  │ Liability: $2M umbrella | Premium: $12K    │   │
│  │ Flood: $500K | Wind: Included              │   │
│  │ [View Policies] [Add Coverage] [Claims]    │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  📋 Active Claims                                  │
│  Water Damage - Unit 4B (Filed: 02/10)           │
│  Status: Under Review | Reserve: $15K             │
│                                                    │
│  🗺️ Risk Heat Map                                  │
│  High: Flood zone | Medium: Crime | Low: Fire    │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Risk Management"
      description="Insurance tracking, claims management, and comprehensive risk assessment"
      status="coming-soon"
      icon="🛡️"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Insurance Tracker:</strong> Monitor all policies with renewal alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Claims Management:</strong> Track claims from filing to resolution</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Risk Heat Map:</strong> Visual assessment of property-level risks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Coverage Gap Analysis:</strong> Identify underinsured exposures</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Premium Benchmarking:</strong> Compare your rates to market averages</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Loss History Reports:</strong> 5-year claims history for underwriting</span>
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

export default RiskManagementSection;
