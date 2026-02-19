/**
 * Overview Section - Deal Page
 * High-level summary, map, quick stats, and actions
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface OverviewSectionProps {
  deal: any;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Quick Stats (4 cards)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Properties│  │  Budget  │  │  Status  │        │
│  │    12    │  │   $45M   │  │  Active  │        │
│  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐                                     │
│  │ Timeline │                                     │
│  │ 45 days  │                                     │
│  └──────────┘                                     │
├────────────────────────────────────────────────────┤
│  Recent Activity Summary                           │
│  • Property analysis completed (2h ago)            │
│  • Financial model updated (1d ago)                │
│  • New note added by John (2d ago)                 │
├────────────────────────────────────────────────────┤
│  Key Contacts & Team Members                       │
│  [Team member cards with roles]                    │
├────────────────────────────────────────────────────┤
│  Quick Actions                                     │
│  [Find Properties] [Run Analysis] [Generate Rpt]   │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Overview Section"
      description="This will display deal summary, interactive map, quick stats, and action buttons"
      status="to-be-built"
      icon="📊"
      wireframe={wireframe}
    >
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Features to Include:</h4>
        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
          <li>Quick stats cards (properties, budget, status, timeline)</li>
          <li>Deal status timeline/progress bar</li>
          <li>Recent activity summary (latest updates and changes)</li>
          <li>Key contacts/team members with roles</li>
          <li>Quick action buttons (find properties, run analysis, etc.)</li>
          <li>Important milestones and deadlines</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default OverviewSection;
