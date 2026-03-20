/**
 * Properties Section - Deal Page
 * Property details, comps, unit mix, amenities, conditions
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface PropertiesSectionProps {
  deal: any;
}

export const PropertiesSection: React.FC<PropertiesSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Properties in Deal: 12                            │
├────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────┐   │
│  │ 📍 Property 1: 123 Main St                 │   │
│  │ Type: Multifamily | Units: 24 | Built: 1985│   │
│  │ Condition: Good | Comps: $215K/unit        │   │
│  │ [View Details] [Comps] [Unit Mix]          │   │
│  └────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────┐   │
│  │ 📍 Property 2: 456 Oak Ave                 │   │
│  │ Type: Multifamily | Units: 36 | Built: 1992│   │
│  │ Condition: Fair | Comps: $198K/unit        │   │
│  │ [View Details] [Comps] [Unit Mix]          │   │
│  └────────────────────────────────────────────┘   │
│  ...                                               │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Properties"
      description="Detailed property information, comps, unit mix, and condition assessments"
      status="to-be-built"
      icon="🏢"
      wireframe={wireframe}
    >
      <div className="space-y-3 text-sm text-[#9EA8B4]">
        <strong>Features to Include:</strong>
        <ul className="list-disc list-inside space-y-1">
          <li>Property list with key details</li>
          <li>Interactive map showing all properties</li>
          <li>Unit mix breakdown (1BR, 2BR, etc.)</li>
          <li>Comparable sales analysis</li>
          <li>Property condition reports</li>
          <li>Amenities checklist</li>
          <li>Photos and virtual tours</li>
          <li>Rent roll integration</li>
          <li>Property-level financial metrics</li>
          <li>Acquisition status per property</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default PropertiesSection;
