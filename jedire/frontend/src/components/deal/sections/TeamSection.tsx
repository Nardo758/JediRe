/**
 * Team & Communications Section - Deal Page
 * Team members, stakeholders, communication history
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface TeamSectionProps {
  deal: any;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  Team Members (8) | Stakeholders (12)              │
├────────────────────────────────────────────────────┤
│  Internal Team:                                    │
│  👤 John Smith (Lead)      john@example.com        │
│  👤 Sarah Johnson (Analyst) sarah@example.com      │
│  👤 Mike Chen (Legal)       mike@example.com       │
├────────────────────────────────────────────────────┤
│  External Stakeholders:                            │
│  🏢 ABC Capital (Lender)                           │
│  🏢 XYZ Law Firm (Legal)                           │
│  🏢 Smith Inspections (DD)                         │
├────────────────────────────────────────────────────┤
│  Recent Communications:                            │
│  📧 Email: Lender approval received  2 days ago    │
│  📞 Call: Due diligence update      3 days ago    │
│  💬 Chat: Team sync meeting         1 week ago    │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Team & Communications"
      description="Manage team members, stakeholders, and communication history"
      status="to-be-built"
      icon="👥"
      wireframe={wireframe}
    >
      <div className="space-y-3 text-sm text-gray-600">
        <strong>Features to Include:</strong>
        <ul className="list-disc list-inside space-y-1">
          <li>Team member directory with roles</li>
          <li>Stakeholder organization chart</li>
          <li>Communication timeline (emails, calls, meetings)</li>
          <li>Task assignments per person</li>
          <li>Contact information management</li>
          <li>Email integration</li>
          <li>Meeting notes and minutes</li>
          <li>Notification preferences</li>
          <li>Collaboration tools (comments, mentions)</li>
          <li>Access control per team member</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default TeamSection;
