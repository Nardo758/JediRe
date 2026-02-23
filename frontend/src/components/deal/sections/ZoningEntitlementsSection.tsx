/**
 * Zoning & Entitlements Section
 * Coming Soon: Zoning lookup, variance tracking, density calculator
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface ZoningEntitlementsSectionProps {
  deal?: any;
  dealId?: string;
  onUpdate?: () => void;
  onBack?: () => void;
}

export const ZoningEntitlementsSection: React.FC<ZoningEntitlementsSectionProps> = ({ deal, dealId }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Zoning & Entitlements Dashboard                   │
├────────────────────────────────────────────────────┤
│  📋 Current Zoning: R-4 (High-Density Residential) │
│  Allowed Uses: Multifamily, Mixed-Use              │
│  Max Density: 60 units/acre | Height: 75 ft       │
│                                                    │
│  🎯 Variance Tracker                               │
│  ┌────────────────────────────────────────────┐   │
│  │ Parking Variance: Submitted 02/01          │   │
│  │ Status: Under Review | Hearing: 03/15      │   │
│  │ [View Application] [Timeline]              │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  📐 Density Calculator                             │
│  Lot Size: 2.5 acres → Max Units: 150            │
│  Current Plan: 120 units (80% of max)            │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Zoning & Entitlements"
      description="Track zoning compliance, variance applications, and density calculations"
      status="coming-soon"
      icon="🏛️"
      wireframe={wireframe}
    >
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Planned Features</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Zoning Lookup:</strong> Automatic zoning code retrieval by address</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Compliance Checker:</strong> Verify if your plan meets zoning requirements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Variance Tracker:</strong> Manage variance applications with deadline alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Density Calculator:</strong> Calculate max allowable units and setbacks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Permit Timeline:</strong> Track entitlement process from start to finish</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-600">▸</span>
              <span><strong>Municipality Database:</strong> Contact info for planning departments</span>
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

export default ZoningEntitlementsSection;
