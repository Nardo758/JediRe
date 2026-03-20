/**
 * Activity Timeline Tab - Context Tracker
 * Chronological view of all deal activities
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const ActivityTimeline: React.FC = () => {
  return (
    <PlaceholderContent
      title="Activity Timeline"
      description="Chronological view of all deal activities, updates, and milestones"
      status="to-be-built"
      icon="📋"
    >
      <div className="text-sm text-gray-600">
        Will display: Timeline of all deal events, updates, document uploads, status changes, team actions, etc.
      </div>
    </PlaceholderContent>
  );
};

export default ActivityTimeline;
