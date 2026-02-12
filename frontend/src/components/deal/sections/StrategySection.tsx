/**
 * Strategy & Arbitrage Section - Deal Page
 * Deal strategy, arbitrage opportunities, value-add strategies
 */

import React, { useState } from 'react';
import { PlaceholderContent } from '../PlaceholderContent';
import { ModuleToggle } from '../ModuleToggle';

interface StrategySectionProps {
  deal: any;
  isPremium?: boolean;
}

export const StrategySection: React.FC<StrategySectionProps> = ({ 
  deal, 
  isPremium = false 
}) => {
  const [mode, setMode] = useState<'basic' | 'enhanced'>('basic');

  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Deal Strategy                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ Strategy Type: [Value-Add / Core / Opport.]  │ │
│  │ Hold Period:   _____ years                   │ │
│  │ Exit Strategy: [Refinance / Sale / Hold]     │ │
│  └──────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────┤
│  Arbitrage Opportunities                           │
│  • Rent vs Market Rate Gap: +12%                   │
│  • Comparable Sale Price Gap: +$450K               │
│  • Zoning Upside Potential: [Detected]             │
│  • Market Timing Score: 8.2/10                     │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <div className="space-y-4">
      {/* Module Toggle */}
      <div className="flex justify-center">
        <ModuleToggle
          mode={mode}
          onModeChange={setMode}
          isPremium={isPremium}
        />
      </div>

      {/* Content */}
      <PlaceholderContent
        title="Strategy & Arbitrage Analysis"
        description="Define deal strategy and identify arbitrage opportunities"
        status="to-be-built"
        icon="🎯"
        wireframe={wireframe}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>Basic Features:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Strategy type selection (Core, Value-Add, Opportunistic)</li>
              <li>Hold period calculator</li>
              <li>Exit strategy planning</li>
              <li>Simple arbitrage detection (rent vs market)</li>
            </ul>
          </div>
          <div>
            <strong>Enhanced Features (Premium):</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>AI-powered arbitrage opportunity detection</li>
              <li>Zoning upside analysis</li>
              <li>Market timing signals</li>
              <li>Comparable deal analysis</li>
              <li>Value-add playbook recommendations</li>
            </ul>
          </div>
        </div>
      </PlaceholderContent>
    </div>
  );
};

export default StrategySection;
