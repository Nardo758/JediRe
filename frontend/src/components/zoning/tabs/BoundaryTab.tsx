/**
 * Boundary Tab - Step 1 of Zoning Analysis
 * Wrapper for PropertyBoundarySection
 */

import React from 'react';
import { PropertyBoundarySection } from '../../deal/sections/PropertyBoundarySection';

interface BoundaryTabProps {
  deal?: any;
  dealId?: string;
  onComplete?: () => void;
}

export default function BoundaryTab({ deal, dealId, onComplete }: BoundaryTabProps) {
  const handleBoundaryUpdate = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <div className="boundary-tab-wrapper">
      <PropertyBoundarySection
        deal={deal}
        dealId={dealId}
        onUpdate={handleBoundaryUpdate}
      />
    </div>
  );
}
