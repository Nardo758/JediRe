/**
 * Risk Flags Tab - Context Tracker
 * Active risks and mitigation strategies
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const RiskFlags: React.FC = () => {
  return (
    <PlaceholderContent
      title="Risk Flags"
      description="Active risks, concerns, and mitigation strategies"
      status="to-be-built"
      icon="⚠️"
    >
      <div className="text-sm text-gray-600">
        Will display: Risk matrix, active risks categorized by severity, mitigation plans, risk timeline
      </div>
    </PlaceholderContent>
  );
};

export default RiskFlags;
