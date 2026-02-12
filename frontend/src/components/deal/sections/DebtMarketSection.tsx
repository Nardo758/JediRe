/**
 * Debt Market Section - JEDI RE Enhanced Deal Page
 * Interest rates, lending conditions, financing options tracking
 */

import React from 'react';
import { Deal } from '../../../types/deal';
import { PlaceholderContent } from '../PlaceholderContent';

interface DebtMarketSectionProps {
  deal: Deal;
}

export const DebtMarketSection: React.FC<DebtMarketSectionProps> = ({ deal }) => {
  return (
    <PlaceholderContent
      title="Debt Market"
      description="Track interest rates, lending conditions, and financing options"
      status="to-be-built"
      icon="💳"
      wireframe={`
┌─────────────────────────────────────────────────────────────┐
│ Debt Market & Financing Tracker                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [Current Market Conditions]                                 │
│ Fed Funds Rate | 10Y Treasury | SOFR | Prime Rate           │
│    5.50%       |    4.35%      | 5.32%|   8.50%            │
│                                                              │
│ [Lending Environment Indicators]                            │
│ 🟢 LTV: 70-75% (Favorable)                                  │
│ 🟡 DSCR: 1.25x min (Normal)                                 │
│ 🔴 Spreads: +275 bps (Elevated)                             │
│                                                              │
│ [Financing Options Table]                                   │
│ Lender | Type | Rate | LTV | Term | Fees | Score           │
│ ──────────────────────────────────────────────────────────  │
│ Bank A | Agency | 6.25% | 75% | 10yr | 1.5% | Best        │
│ CMBS 1 | Conduit | 6.85% | 70% | 10yr | 2.0% | Good       │
│ Debt Fund | Bridge | 9.50% | 65% | 3yr | 3.0% | Backup    │
│                                                              │
│ [Rate Trend Chart]                                          │
│ [Chart showing interest rate trends over 12 months]         │
│                                                              │
│ [Debt Strategy Recommendations]                             │
│ 💡 Current recommendation: Lock rate now                    │
│ - Rates likely to increase +25 bps in next 90 days         │
│ - Consider interest rate cap ($45k for 3 years)            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
      `}
    >
      <div className="space-y-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-semibold text-purple-900 mb-2">Features to Include:</h4>
          <ul className="text-sm text-purple-800 space-y-1">
            <li>• Real-time interest rate tracking (Fed, Treasury, SOFR, Prime)</li>
            <li>• Lending environment indicators (LTV, DSCR, spreads)</li>
            <li>• Financing options comparison table</li>
            <li>• Lender database with terms and conditions</li>
            <li>• Historical rate trends and forecasts</li>
            <li>• Debt strategy recommendations</li>
            <li>• Rate lock advisories</li>
            <li>• Interest rate cap/floor analysis</li>
            <li>• Refinancing opportunity alerts</li>
            <li>• Covenant tracking</li>
          </ul>
        </div>
      </div>
    </PlaceholderContent>
  );
};
