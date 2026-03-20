/**
 * Supply Tracking Section - JEDI RE Enhanced Deal Page
 * Pipeline monitoring, new construction, supply impact analysis
 */

import React from 'react';
import { Deal } from '../../../types/deal';
import { PlaceholderContent } from '../PlaceholderContent';

interface SupplyTrackingSectionProps {
  deal: Deal;
}

export const SupplyTrackingSection: React.FC<SupplyTrackingSectionProps> = ({ deal }) => {
  return (
    <PlaceholderContent
      title="Supply Tracking"
      description="Monitor pipeline, new construction, and supply impact on market"
      status="to-be-built"
      icon="📦"
      wireframe={`
┌─────────────────────────────────────────────────────────────┐
│ Supply Tracking & Pipeline Analysis                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Supply Overview Cards]                                     │
│ Pipeline Units | Under Construction | Planned | Absorption  │
│    2,450       |      890           |  1,560  |  12 months  │
│                                                              │
│ [Pipeline Map]                                              │
│ - Map showing all pipeline projects                         │
│ - Color-coded by status (planned/construction/delivery)     │
│ - Unit counts and delivery dates                            │
│                                                              │
│ [Pipeline Projects Table]                                   │
│ Project | Units | Status | Delivery | Distance | Impact    │
│ ──────────────────────────────────────────────────────────  │
│ Tower A | 350 | Construction | Q3 2024 | 0.8mi | High     │
│ Plaza B | 220 | Planned | Q1 2025 | 1.2mi | Medium        │
│                                                              │
│ [Supply Impact Analysis]                                    │
│ ⚠️ High Risk: 2,450 units (18% of existing stock)          │
│ - Expected absorption: 12-15 months                         │
│ - Rent pressure: -3% to -5%                                 │
│                                                              │
│ [Delivery Timeline]                                         │
│ [Chart showing unit deliveries over next 24 months]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
      `}
    >
      <div className="space-y-4">
        <div className="bg-[#1a0d00] border border-orange-200 rounded-lg p-4">
          <h4 className="font-semibold text-orange-900 mb-2">Features to Include:</h4>
          <ul className="text-sm text-orange-800 space-y-1">
            <li>• Real-time pipeline tracking (planned, construction, delivered)</li>
            <li>• Interactive map of all supply projects</li>
            <li>• Unit count and delivery date tracking</li>
            <li>• Supply risk scoring (low/medium/high/critical)</li>
            <li>• Absorption rate analysis</li>
            <li>• Rent impact projections</li>
            <li>• Delivery timeline visualization</li>
            <li>• Historical supply trends</li>
            <li>• Alerts for new projects added</li>
          </ul>
        </div>
      </div>
    </PlaceholderContent>
  );
};
