import React from 'react';
import { T as BT, mono } from '../deal/bloomberg-tokens';

interface SectionEditorPanelProps {
  section?: string;
  onUpdate?: (updates: any) => void;
  [key: string]: any;
}

export const SectionEditorPanel: React.FC<SectionEditorPanelProps> = ({ section, onUpdate }) => (
  <div style={{ padding: 16, background: BT.bgCard, border: `1px solid ${BT.border}`, borderRadius: 4 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: BT.cyanL, letterSpacing: 2, textTransform: 'uppercase', ...mono, marginBottom: 12 }}>
      {section ? `Edit: ${section}` : 'Section Editor'}
    </div>
    <div style={{ color: BT.td, fontSize: 11, ...mono }}>
      Select a building section to configure dimensions and properties.
    </div>
  </div>
);

export default SectionEditorPanel;
