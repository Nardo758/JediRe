/**
 * Market Competition Section - JEDI RE Enhanced Deal Page
 * Competitive analysis, comparable properties, market positioning
 */

import React from 'react';
import { Deal } from '../../../types/deal';
import { PlaceholderContent } from '../PlaceholderContent';

interface MarketCompetitionSectionProps {
  deal: Deal;
}

export const MarketCompetitionSection: React.FC<MarketCompetitionSectionProps> = ({ deal }) => {
  return (
    <PlaceholderContent
      title="Market Competition"
      description="Competitive analysis and comparable properties within the market"
      status="to-be-built"
      icon="🏆"
      wireframe={`
┌─────────────────────────────────────────────────────────────┐
│ Market Competition Analysis                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Competitive Set Map]                                       │
│ - Property location + competitors on map                    │
│ - Distance/drive-time circles                               │
│ - Color-coded by class/pricing                             │
│                                                              │
│ [Comparable Properties Table]                               │
│ Name | Distance | Units | Rent | Occupancy | Year | Score  │
│ ─────────────────────────────────────────────────────────  │
│ Comp A | 0.5 mi | 250 | $1,850 | 95% | 2020 | 8.5/10     │
│ Comp B | 0.8 mi | 180 | $1,750 | 92% | 2018 | 7.8/10     │
│                                                              │
│ [Market Positioning Chart]                                  │
│ - Rent vs Quality scatter plot                              │
│ - This property vs competitors                              │
│                                                              │
│ [Competitive Advantages/Weaknesses]                         │
│ ✅ Higher quality finishes than 80% of comps               │
│ ⚠️ Slightly higher rent than market average                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
      `}
    >
      <div className="space-y-4">
        <div className="bg-[#0d1e3d] border border-blue-900/50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-300 mb-2">Features to Include:</h4>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• Interactive map with property + competitors</li>
            <li>• Comparable properties table with key metrics</li>
            <li>• Market positioning analysis (rent vs quality)</li>
            <li>• Competitive advantages/weaknesses assessment</li>
            <li>• Distance/drive-time analysis</li>
            <li>• Competitive score/ranking</li>
            <li>• Historical competitive data trends</li>
            <li>• Market share analysis</li>
          </ul>
        </div>
      </div>
    </PlaceholderContent>
  );
};
