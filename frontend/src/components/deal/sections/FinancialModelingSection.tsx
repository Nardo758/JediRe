/**
 * Financial Modeling Section - Advanced Pro Forma Builder
 * Coming Soon: Advanced scenarios, sensitivity analysis, stress testing
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface FinancialModelingSectionProps {
  dealId: string;
}

export const FinancialModelingSection: React.FC<FinancialModelingSectionProps> = ({ dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Advanced Financial Modeling Suite                 │
├────────────────────────────────────────────────────┤
│  📊 Scenario Builder                               │
│  ┌────────────────────────────────────────────┐   │
│  │ Base Case      | Best Case    | Worst Case │   │
│  │ IRR: 18.5%     | IRR: 24.2%   | IRR: 12.1% │   │
│  │ [Edit] [Clone] | [Edit]       | [Edit]     │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  📈 Sensitivity Analysis                           │
│  ┌────────────────────────────────────────────┐   │
│  │ Occupancy Impact:  -2% → IRR drops 3.2%   │   │
│  │ Rent Growth:       +1% → IRR gains 2.8%   │   │
│  │ Exit Cap Rate:     +25bps → Value -$1.2M  │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  ⚠️ Stress Testing                                 │
│  Recession scenario | Interest rate shock         │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Advanced Financial Modeling"
      description="Pro forma scenario builder with sensitivity analysis and stress testing"
      status="coming-soon"
      icon="📊"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Multi-Scenario Builder:</strong> Create unlimited scenarios (Base, Best, Worst, Custom)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Sensitivity Analysis:</strong> Test IRR impact of key assumptions (occupancy, rent, exit cap)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Stress Testing:</strong> Model recession, rate shocks, vacancy spikes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Tornado Charts:</strong> Visualize which variables have the most impact</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Monte Carlo Simulation:</strong> Probabilistic outcome ranges</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Compare Side-by-Side:</strong> View all scenarios in one grid</span>
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

export default FinancialModelingSection;
