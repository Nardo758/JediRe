/**
 * Due Diligence Section - Deal Page
 * Checklists, inspections, legal review, environmental reports
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface DueDiligenceSectionProps {
  deal: any;
}

export const DueDiligenceSection: React.FC<DueDiligenceSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  DD Checklist Progress: ████████░░ 78%             │
├────────────────────────────────────────────────────┤
│  ☑ Legal Review              [Complete]            │
│  ☑ Title Search              [Complete]            │
│  ☑ Environmental Phase I      [Complete]           │
│  ☐ Property Inspection        [In Progress]        │
│  ☐ Financial Records Review   [Pending]            │
│  ☐ Tenant Estoppels          [Pending]            │
├────────────────────────────────────────────────────┤
│  Critical Issues (2)                               │
│  ⚠️ Environmental concern in Phase I report         │
│  ⚠️ Missing 3 tenant estoppels                      │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Due Diligence Tracking"
      description="Track and manage all due diligence activities, checklists, and findings"
      status="to-be-built"
      icon="✅"
      wireframe={wireframe}
    >
      <div className="space-y-3 text-sm text-gray-600">
        <strong>Features to Include:</strong>
        <ul className="list-disc list-inside space-y-1">
          <li>Customizable DD checklists by deal type</li>
          <li>Document upload and organization</li>
          <li>Critical issues tracker</li>
          <li>Inspection scheduling and reports</li>
          <li>Legal review status</li>
          <li>Environmental reports (Phase I/II)</li>
          <li>Title and survey review</li>
          <li>Tenant estoppels tracking</li>
          <li>Financial records verification</li>
          <li>Deadline reminders</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default DueDiligenceSection;
