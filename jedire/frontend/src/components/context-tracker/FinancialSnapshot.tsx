/**
 * Financial Snapshot Tab - Context Tracker
 * Quick view of key financial metrics
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const FinancialSnapshot: React.FC = () => {
  return (
    <PlaceholderContent
      title="Financial Snapshot"
      description="Quick view of key financial metrics, budget, and forecasts"
      status="to-be-built"
      icon="💰"
    >
      <div className="text-sm text-gray-600">
        Will display: Key metrics cards, mini charts showing budget vs actual, ROI, cash flow summary, etc.
      </div>
    </PlaceholderContent>
  );
};

export default FinancialSnapshot;
