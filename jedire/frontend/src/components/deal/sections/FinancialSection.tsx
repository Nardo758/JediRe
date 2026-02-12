/**
 * Financial Analysis Section - Deal Page
 * Pro forma, cash flow models, ROI calculations, sensitivity analysis
 */

import React, { useState } from 'react';
import { PlaceholderContent } from '../PlaceholderContent';
import { ModuleToggle } from '../ModuleToggle';

interface FinancialSectionProps {
  deal: any;
  isPremium?: boolean;
}

export const FinancialSection: React.FC<FinancialSectionProps> = ({ 
  deal, 
  isPremium = false 
}) => {
  const [mode, setMode] = useState<'basic' | 'enhanced'>('basic');

  const basicWireframe = `
┌────────────────────────────────────────────────────┐
│  Basic Financial Calculator                        │
│  ┌──────────────────────────────────────────────┐ │
│  │ Purchase Price:        $ _________           │ │
│  │ Down Payment %:          _____  %            │ │
│  │ Interest Rate:           _____  %            │ │
│  │ Term (years):            _____               │ │
│  ├──────────────────────────────────────────────┤ │
│  │ Monthly Payment:       $ _________           │ │
│  │ Total Interest:        $ _________           │ │
│  │ Simple ROI:              _____  %            │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
  `.trim();

  const enhancedWireframe = `
┌────────────────────────────────────────────────────┐
│  Financial Modeling Pro                            │
│  ┌────────────┬────────────┬────────────┐         │
│  │ Pro Forma  │ Cash Flow  │ Waterfall  │         │
│  └────────────┴────────────┴────────────┘         │
│                                                    │
│  [Interactive charts & graphs]                     │
│  [Sensitivity analysis]                            │
│  [Scenario modeling]                               │
│  [IRR / NPV / Cash-on-Cash calculations]           │
│  [Cap rate analysis]                               │
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

      {/* Content based on mode */}
      {mode === 'basic' ? (
        <PlaceholderContent
          title="Basic Financial Calculator"
          description="Simple calculator for basic deal analysis - ROI, monthly payments, etc."
          status="to-be-built"
          icon="🧮"
          wireframe={basicWireframe}
        >
          <div className="text-sm text-gray-600">
            <strong>Basic Mode Features:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Simple purchase price calculator</li>
              <li>Mortgage calculator with amortization</li>
              <li>Basic ROI calculations</li>
              <li>Cap rate calculator</li>
              <li>Cash-on-cash return</li>
            </ul>
          </div>
        </PlaceholderContent>
      ) : (
        <PlaceholderContent
          title="Financial Modeling Pro"
          description="Advanced financial modeling with pro forma, cash flows, and scenario analysis"
          status="to-be-built"
          icon="💎"
          wireframe={enhancedWireframe}
        >
          <div className="text-sm text-gray-600">
            <strong>Enhanced Mode Features:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Full 10-year pro forma with rent growth, expense escalation</li>
              <li>Cash flow waterfall (equity, mezzanine, preferred)</li>
              <li>Sensitivity analysis (rent, cap rate, exit timing)</li>
              <li>Scenario modeling (base, best, worst case)</li>
              <li>IRR, NPV, MOIC calculations</li>
              <li>Market comp analysis integration</li>
              <li>Loan structure optimization</li>
            </ul>
          </div>
        </PlaceholderContent>
      )}
    </div>
  );
};

export default FinancialSection;
