/**
 * Market Analysis Section - Deal Page
 * Market trends, demographics, supply/demand, competitive analysis
 */

import React, { useState } from 'react';
import { PlaceholderContent } from '../PlaceholderContent';
import { ModuleToggle } from '../ModuleToggle';

interface MarketSectionProps {
  deal: any;
  isPremium?: boolean;
}

export const MarketSection: React.FC<MarketSectionProps> = ({ 
  deal, 
  isPremium = false 
}) => {
  const [mode, setMode] = useState<'basic' | 'enhanced'>('basic');

  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Market Overview: Atlanta, GA - Buckhead           │
├────────────────────────────────────────────────────┤
│  📊 Key Metrics                                    │
│  • Median Rent: $1,850/mo (+5.2% YoY)             │
│  • Vacancy Rate: 4.2% (↓ from 5.1%)               │
│  • Population Growth: +2.8% annually               │
│  • Median Income: $68,500 (+3.1% YoY)             │
├────────────────────────────────────────────────────┤
│  Supply & Demand                                   │
│  [Chart: New supply vs absorption]                 │
│  • Units Delivered (12mo): 1,245                   │
│  • Units Absorbed: 1,580                           │
│  • Pipeline: 890 units                             │
├────────────────────────────────────────────────────┤
│  Competitive Set (5 properties within 1 mi)        │
│  [List of comparable properties]                   │
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
        title="Market Analysis"
        description="Comprehensive market trends, demographics, and competitive analysis"
        status="to-be-built"
        icon="📈"
        wireframe={wireframe}
      >
        <div className="space-y-3 text-sm text-gray-600">
          <div>
            <strong>Basic Features:</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Market summary (rent, vacancy, growth)</li>
              <li>Basic demographics</li>
              <li>Competitive properties list</li>
              <li>Supply/demand overview</li>
            </ul>
          </div>
          <div>
            <strong>Enhanced Features (Premium):</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Deep demographic analysis (income, age, education)</li>
              <li>5-year market forecasts</li>
              <li>Employment trends by sector</li>
              <li>Transit and infrastructure impact analysis</li>
              <li>Submarket comparison</li>
              <li>Migration patterns</li>
              <li>Competitive set benchmarking</li>
            </ul>
          </div>
        </div>
      </PlaceholderContent>
    </div>
  );
};

export default MarketSection;
