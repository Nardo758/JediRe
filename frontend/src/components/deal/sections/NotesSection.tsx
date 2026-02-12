/**
 * Notes & Comments Section - Deal Page
 * Deal notes, comments, and collaborative discussions
 */

import React from 'react';
import { PlaceholderContent } from '../PlaceholderContent';

interface NotesSectionProps {
  deal: any;
}

export const NotesSection: React.FC<NotesSectionProps> = ({ deal }) => {
  const wireframe = `
┌────────────────────────────────────────────────────┐
│  [Search notes...] [+ New Note]  [Filter ▾]        │
├────────────────────────────────────────────────────┤
│  📝 Meeting Notes: Lender Call                     │
│     John Smith • 2 days ago • Tagged: #financing   │
│     "Discussed terms, agreed on 75% LTV..."        │
│     [View] [Edit] [Delete]                         │
├────────────────────────────────────────────────────┤
│  💡 Idea: Possible Value-Add Strategy              │
│     Sarah Johnson • 5 days ago • Tagged: #strategy │
│     "Could add covered parking to increase NOI..." │
│     [View] [Edit] [Delete]                         │
├────────────────────────────────────────────────────┤
│  ⚠️ Risk Flag: Environmental Concern               │
│     Mike Chen • 1 week ago • Tagged: #risk         │
│     "Phase I report mentions potential..."         │
│     [View] [Edit] [Delete]                         │
└────────────────────────────────────────────────────┘
  `.trim();

  return (
    <PlaceholderContent
      title="Notes & Comments"
      description="Capture and organize deal notes, comments, and collaborative discussions"
      status="to-be-built"
      icon="💬"
      wireframe={wireframe}
    >
      <div className="space-y-3 text-sm text-gray-600">
        <strong>Features to Include:</strong>
        <ul className="list-disc list-inside space-y-1">
          <li>Rich text note editor (markdown support)</li>
          <li>Search and filter notes</li>
          <li>Tagging system (#tags)</li>
          <li>Categories (meeting notes, ideas, risks, etc.)</li>
          <li>Note types with icons</li>
          <li>Attach files to notes</li>
          <li>@mentions for team members</li>
          <li>Comments and replies on notes</li>
          <li>Pin important notes</li>
          <li>Export notes to PDF/Word</li>
          <li>Note templates</li>
        </ul>
      </div>
    </PlaceholderContent>
  );
};

export default NotesSection;
