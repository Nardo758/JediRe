/**
 * Documents Section - Deal Page
 * All deal-related documents, contracts, reports, and files
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface DocumentsSectionProps {
  deal: any;
}

export const DocumentsSection: React.FC<DocumentsSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  📁 All Documents (42) | [Upload] [Search]         │
├────────────────────────────────────────────────────┤
│  Folders:                                          │
│  ├─ 📂 Contracts (8)                               │
│  ├─ 📂 Financial (12)                              │
│  ├─ 📂 Legal (6)                                   │
│  ├─ 📂 Environmental (4)                           │
│  ├─ 📂 Inspections (5)                             │
│  └─ 📂 Marketing (7)                               │
├────────────────────────────────────────────────────┤
│  Recent Documents:                                 │
│  📄 Purchase Agreement.pdf        2 days ago       │
│  📄 Phase I Environmental.pdf     5 days ago       │
│  📄 Pro Forma 2024.xlsx          1 week ago       │
│  📄 Title Report.pdf             1 week ago       │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Document Management"
      description="Organize, search, and manage all deal-related documents"
      status="to-be-built"
      icon="📄"
      wireframe={wireframe}
    >
      <div className="space-y-3 text-sm text-gray-600">
        <strong>Features to Include:</strong>
        <ul className="list-disc list-inside space-y-1">
          <li>Folder organization by category</li>
          <li>Drag-and-drop upload</li>
          <li>Full-text search across documents</li>
          <li>Version control</li>
          <li>Document preview</li>
          <li>Tagging and labeling</li>
          <li>Access control per document</li>
          <li>Document templates</li>
          <li>AI-powered document extraction</li>
          <li>Activity log (who viewed/edited)</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default DocumentsSection;
