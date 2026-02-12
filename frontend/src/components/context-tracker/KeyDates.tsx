/**
 * Key Dates Tab - Context Tracker
 * Important deadlines and milestones
 */

import React from 'react';
import { PlaceholderContent } from '../deal/PlaceholderContent';

export const KeyDates: React.FC = () => {
  return (
    <PlaceholderContent
      title="Key Dates"
      description="Important deadlines, milestones, and calendar events"
      status="to-be-built"
      icon="📅"
    >
      <div className="text-sm text-gray-600">
        Will display: Calendar view, upcoming deadlines, milestone tracking, critical path visualization
      </div>
    </PlaceholderContent>
  );
};

export default KeyDates;
