/**
 * PlaceholderContent Component
 * Reusable placeholder for sections that are to be built
 */

import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { PlaceholderContentProps } from '../../types/deal-enhanced.types';

const statusConfig = {
  'to-be-built': { color: BT.text.secondary, label: 'TO BE BUILT' },
  'in-progress': { color: BT.text.cyan, label: 'IN PROGRESS' },
  'complete': { color: BT.text.green, label: 'COMPLETE' },
  'coming-soon': { color: BT.text.purple, label: 'COMING SOON' },
} as const;

export const PlaceholderContent: React.FC<PlaceholderContentProps> = ({
  title,
  description,
  status = 'to-be-built',
  icon = '🚧',
  wireframe,
  children
}) => {
  const cfg = statusConfig[status];

  return (
    <div className="p-6" style={{ background: BT.bg.panel, border: `1px solid ${cfg.color}33`, borderLeft: `2px solid ${cfg.color}`, borderRadius: 0, fontFamily: BT.font.mono }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{icon}</div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: BT.text.primary }}>{title}</h3>
            <p style={{ fontSize: 10, color: BT.text.secondary, marginTop: 4 }}>{description}</p>
          </div>
        </div>
        <span style={{ padding: '2px 6px', borderRadius: 2, fontSize: 9, fontWeight: 700, background: `${cfg.color}22`, color: cfg.color, letterSpacing: 0.5 }}>
          {cfg.label}
        </span>
      </div>

      {/* Wireframe / Preview */}
      {wireframe && (
        <div className="mb-4 p-4" style={{ background: BT.bg.panelAlt, border: `1px solid ${BT.border.subtle}`, fontFamily: BT.font.mono, fontSize: 9, color: BT.text.secondary, whiteSpace: 'pre' }}>
          {wireframe}
        </div>
      )}

      {/* Custom Content */}
      {children && (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
          {children}
        </div>
      )}

      {/* Default Message */}
      {!children && !wireframe && (
        <div className="text-center py-8">
          <div style={{ color: BT.text.muted, fontSize: 10 }}>
            This section will be built in a future phase
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceholderContent;
