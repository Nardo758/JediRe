/**
 * Decision Log Tab - Context Tracker
 * Record of major decisions and approvals
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const DecisionLog: React.FC = () => {
  return (
    <PlaceholderContent
      title="Decision Log"
      description="Record of all major decisions, approvals, and rationale"
      status="to-be-built"
      icon="📝"
    >
      <div className="text-sm text-gray-600">
        Will display: Chronological log of decisions, who made them, rationale, outcome, and impacts
      </div>
    </PlaceholderContent>
  );
};

export default DecisionLog;
