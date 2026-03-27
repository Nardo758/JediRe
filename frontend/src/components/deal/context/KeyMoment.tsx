import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';
import { KeyMoment as KeyMomentType } from '../../../types/activity';
import { format } from 'date-fns';

interface KeyMomentProps {
  moment: KeyMomentType;
  onClick?: (moment: KeyMomentType) => void;
}

const momentIcons: Record<KeyMomentType['momentType'], string> = {
  milestone: '🎯',
  decision: '💡',
  risk: '⚠️',
  achievement: '🏆',
};

const momentAccent: Record<KeyMomentType['momentType'], string> = {
  milestone: BT.text.cyan,
  decision: BT.text.purple,
  risk: BT.text.red,
  achievement: BT.text.green,
};

const importanceColor: Record<KeyMomentType['importance'], string> = {
  low: BT.text.secondary,
  medium: BT.text.cyan,
  high: BT.text.orange,
  critical: BT.text.red,
};

export const KeyMoment: React.FC<KeyMomentProps> = ({ moment, onClick }) => {
  const accent = momentAccent[moment.momentType];
  return (
    <div
      onClick={() => onClick?.(moment)}
      className="p-4 mb-3 transition-all"
      style={{
        background: BT.bg.panel,
        border: `1px solid ${accent}33`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 0,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: BT.font.mono,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{momentIcons[moment.momentType]}</span>
          <div>
            <h3 style={{ fontWeight: 600, color: BT.text.primary, fontSize: 12 }}>{moment.title}</h3>
            <p style={{ fontSize: 9, color: BT.text.muted }}>
              {format(new Date(moment.date), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <span
          className="px-2 py-1"
          style={{
            borderRadius: 2,
            fontSize: 9,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: importanceColor[moment.importance],
            background: `${importanceColor[moment.importance]}22`,
            letterSpacing: 0.5,
          }}
        >
          {moment.importance}
        </span>
      </div>

      {/* Description */}
      <p style={{ color: BT.text.secondary, fontSize: 10 }}>{moment.description}</p>

      {/* Metadata */}
      {moment.metadata && Object.keys(moment.metadata).length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BT.border.subtle}` }}>
          <div className="flex flex-wrap gap-2">
            {Object.entries(moment.metadata).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-1"
                style={{ background: BT.bg.panelAlt, fontSize: 9, color: BT.text.secondary, borderRadius: 2 }}
              >
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span>{' '}
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
