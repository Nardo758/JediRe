/**
 * Construction Management Section
 * Coming Soon: Draw schedule, punch list, change orders, inspections
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface ConstructionManagementSectionProps {
  dealId: string;
}

export const ConstructionManagementSection: React.FC<ConstructionManagementSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Construction Management Dashboard                 │
├────────────────────────────────────────────────────┤
│  🏗️ Draw Schedule                                  │
│  ┌────────────────────────────────────────────┐   │
│  │ Draw #1: Complete ($250K)                  │   │
│  │ Draw #2: Submitted ($180K) - Under Review  │   │
│  │ Draw #3: Scheduled 03/01 ($220K)           │   │
│  │ Total Budget: $2.5M | Drawn: $430K (17%)   │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ✅ Punch List (12 items)                          │
│  Critical: 2 | Major: 5 | Minor: 5               │
│                                                    │
│  📝 Change Orders                                  │
│  Pending: 3 ($45K) | Approved: 8 ($120K)         │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Construction Management"
      description="Track draw schedules, punch lists, change orders, and inspections"
      status="coming-soon"
      icon="🏗️"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Draw Schedule:</strong> Track construction loan draws and documentation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Punch List Manager:</strong> Digital walkthrough checklist with photos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Change Order Tracking:</strong> Manage scope changes and budget impacts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Inspection Calendar:</strong> Schedule and track inspections (framing, electrical, final)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Progress Photos:</strong> Time-stamped photo gallery by milestone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Budget Variance Reports:</strong> Real-time cost tracking vs. budget</span>
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

export default ConstructionManagementSection;
